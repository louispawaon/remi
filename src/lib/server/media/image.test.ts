import { describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_BYTES, proxyImage, resolveImageUrl } from './image';
import { MediaError, RequestError } from './errors';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

const signal = new AbortController().signal;

describe('resolveImageUrl', () => {
	it('accepts AniList CDN URLs and TMDB poster paths', () => {
		expect(
			resolveImageUrl(
				'anilist',
				'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21.jpg'
			).hostname
		).toBe('s4.anilist.co');
		expect(resolveImageUrl('tmdb', '/t/p/w500/abc.jpg').href).toBe(
			'https://image.tmdb.org/t/p/w500/abc.jpg'
		);
	});

	it('rejects arbitrary hosts, protocols, credentials, and unapproved paths', () => {
		expect(() => resolveImageUrl('anilist', 'https://evil.example/file/anilistcdn/x.jpg')).toThrow(
			RequestError
		);
		expect(() => resolveImageUrl('anilist', 'http://s4.anilist.co/file/anilistcdn/x.jpg')).toThrow(
			RequestError
		);
		expect(() =>
			resolveImageUrl('anilist', 'https://user:pass@s4.anilist.co/file/anilistcdn/x.jpg')
		).toThrow(RequestError);
		expect(() => resolveImageUrl('anilist', 'https://s4.anilist.co/other/path/x.jpg')).toThrow(
			RequestError
		);
		expect(() => resolveImageUrl('tmdb', '/w500/abc.jpg')).toThrow(RequestError);
		expect(() => resolveImageUrl('tmdb', '/t/p/../../etc/passwd')).toThrow(RequestError);
		expect(() =>
			resolveImageUrl('anilist', 'https://s4.anilist.co/file/anilistcdn/%2e%2e/x.jpg')
		).toThrow(RequestError);
		expect(() =>
			resolveImageUrl('anilist', 'https://s4.anilist.co:8443/file/anilistcdn/x.jpg')
		).toThrow(RequestError);
		expect(() =>
			resolveImageUrl('anilist', 'https://s4.anilist.co/file/anilistcdn/x.jpg?q=1')
		).toThrow(RequestError);
		expect(() =>
			resolveImageUrl('anilist', 'https://s4.anilist.co/file/anilistcdn/x.jpg#f')
		).toThrow(RequestError);
		expect(() =>
			resolveImageUrl('anilist', 'https://s4.anilist.co./file/anilistcdn/x.jpg')
		).toThrow(RequestError);
	});
});

describe('proxyImage', () => {
	it('returns validated raster bytes with safe headers', async () => {
		const fetcher = vi.fn(async () => {
			return new Response(PNG, {
				headers: { 'content-type': 'image/png', 'content-length': String(PNG.byteLength) }
			});
		});

		const response = await proxyImage(
			new URL('https://image.tmdb.org/t/p/w500/abc.jpg'),
			fetcher as unknown as typeof fetch,
			signal
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(PNG));
	});

	it('refuses redirects', async () => {
		const fetcher = vi.fn(async () => new Response(null, { status: 302 }));
		await expect(
			proxyImage(
				new URL('https://image.tmdb.org/t/p/x.jpg'),
				fetcher as unknown as typeof fetch,
				signal
			)
		).rejects.toMatchObject({ code: 'image_rejected' });
	});

	it('refuses non-raster content types and disguised bytes', async () => {
		const svg = vi.fn(async () => {
			return new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } });
		});
		await expect(
			proxyImage(
				new URL('https://image.tmdb.org/t/p/x.jpg'),
				svg as unknown as typeof fetch,
				signal
			)
		).rejects.toMatchObject({ code: 'image_rejected' });

		const fake = vi.fn(async () => {
			return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
		});
		await expect(
			proxyImage(
				new URL('https://image.tmdb.org/t/p/x.jpg'),
				fake as unknown as typeof fetch,
				signal
			)
		).rejects.toMatchObject({ code: 'image_rejected' });
	});

	it('enforces declared and streamed size limits', async () => {
		const declared = vi.fn(async () => {
			return new Response(null, {
				headers: { 'content-type': 'image/png', 'content-length': String(MAX_IMAGE_BYTES + 1) }
			});
		});
		await expect(
			proxyImage(
				new URL('https://image.tmdb.org/t/p/x.jpg'),
				declared as unknown as typeof fetch,
				signal
			)
		).rejects.toMatchObject({ code: 'image_too_large', status: 413 });

		const streamed = vi.fn(async () => {
			return new Response(new Uint8Array(MAX_IMAGE_BYTES + 1), {
				headers: { 'content-type': 'image/png' }
			});
		});
		await expect(
			proxyImage(
				new URL('https://image.tmdb.org/t/p/x.jpg'),
				streamed as unknown as typeof fetch,
				signal
			)
		).rejects.toMatchObject({ code: 'image_too_large' });
	});

	it('maps upstream rate limits and aborts', async () => {
		const limited = vi.fn(async () => {
			return new Response('', { status: 429, headers: { 'retry-after': '9' } });
		});
		await expect(
			proxyImage(
				new URL('https://image.tmdb.org/t/p/x.jpg'),
				limited as unknown as typeof fetch,
				signal
			)
		).rejects.toMatchObject({ code: 'provider_rate_limited', retryAfter: 9 });

		const aborted = vi.fn(async () => {
			throw new DOMException('aborted', 'AbortError');
		});
		await expect(
			proxyImage(
				new URL('https://image.tmdb.org/t/p/x.jpg'),
				aborted as unknown as typeof fetch,
				signal
			)
		).rejects.toMatchObject({ code: 'provider_unavailable' });

		const timed = vi.fn<typeof fetch>((input, init) => {
			void input;
			return new Promise<Response>((_resolve, reject) => {
				init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason));
			});
		});
		await expect(
			proxyImage(new URL('https://image.tmdb.org/t/p/x.jpg'), timed, AbortSignal.timeout(5))
		).rejects.toMatchObject({ code: 'provider_timeout' });
	});

	it('maps mid-stream failures instead of leaking a 500', async () => {
		const broken = vi.fn<typeof fetch>(async () => {
			const body = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(PNG);
					controller.error(new DOMException('timeout', 'TimeoutError'));
				}
			});
			return new Response(body, { headers: { 'content-type': 'image/png' } });
		});

		await expect(
			proxyImage(new URL('https://image.tmdb.org/t/p/x.jpg'), broken, signal)
		).rejects.toMatchObject({ code: 'provider_timeout' });
	});

	it('maps upstream failures to a provider error', async () => {
		const failing = vi.fn(async () => new Response('', { status: 500 }));
		await expect(
			proxyImage(
				new URL('https://image.tmdb.org/t/p/x.jpg'),
				failing as unknown as typeof fetch,
				signal
			)
		).rejects.toBeInstanceOf(MediaError);
	});
});
