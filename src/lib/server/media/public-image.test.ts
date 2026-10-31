import { describe, expect, it, vi } from 'vitest';
import { RequestError } from './errors';
import {
	isBlockedAddress,
	proxyPublicImage,
	validatePublicImageUrl,
	type PublicImageResponse,
	type PublicImageTransport
} from './public-image';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const signal = new AbortController().signal;

function response(
	status: number,
	headers: Record<string, string>,
	chunks: Uint8Array[] = []
): PublicImageResponse {
	return {
		status,
		headers,
		body: (async function* () {
			for (const chunk of chunks) yield chunk;
		})()
	};
}

function transport(...responses: PublicImageResponse[]) {
	let index = 0;
	return vi.fn<PublicImageTransport>(
		async () => responses[Math.min(index++, responses.length - 1)]
	);
}

describe('validatePublicImageUrl', () => {
	it('accepts ordinary HTTPS artwork URLs with cache-busting queries', () => {
		expect(validatePublicImageUrl('https://cdn.example.com/art.jpg?cache=1').href).toBe(
			'https://cdn.example.com/art.jpg?cache=1'
		);
	});

	it('rejects unsafe schemes, ports, credentials, fragments, and local hosts', () => {
		for (const value of [
			'http://cdn.example.com/art.jpg',
			'https://user:pass@cdn.example.com/art.jpg',
			'https://cdn.example.com:8443/art.jpg',
			'https://cdn.example.com/art.jpg#fragment',
			'https://localhost/art.jpg',
			'https://127.0.0.1/art.jpg',
			'https://[::1]/art.jpg',
			'https://metadata.google.internal/art.jpg',
			'https://printer.local/art.jpg'
		]) {
			expect(() => validatePublicImageUrl(value)).toThrow(RequestError);
		}
	});
});

describe('isBlockedAddress', () => {
	it('blocks private, loopback, link-local, and reserved ranges', () => {
		for (const [address, family] of [
			['0.0.0.0', 4],
			['10.1.2.3', 4],
			['100.64.1.1', 4],
			['127.0.0.1', 4],
			['169.254.169.254', 4],
			['172.16.0.1', 4],
			['192.168.1.1', 4],
			['198.18.0.1', 4],
			['224.0.0.1', 4],
			['::1', 6],
			['fc00::1', 6],
			['fe80::1', 6],
			['::ffff:127.0.0.1', 6]
		] as const) {
			expect(isBlockedAddress(address, family)).toBe(true);
		}
	});

	it('allows public addresses', () => {
		expect(isBlockedAddress('8.8.8.8', 4)).toBe(false);
		expect(isBlockedAddress('1.1.1.1', 4)).toBe(false);
		expect(isBlockedAddress('2606:4700:4700::1111', 6)).toBe(false);
	});
});

describe('proxyPublicImage', () => {
	it('returns validated image bytes', async () => {
		const fetcher = transport(
			response(200, { 'content-type': 'image/jpeg', 'content-length': String(JPEG.length) }, [JPEG])
		);
		const result = await proxyPublicImage(
			new URL('https://cdn.example.com/a.jpg'),
			signal,
			fetcher
		);

		expect(result.status).toBe(200);
		expect(result.headers.get('content-type')).toBe('image/jpeg');
		expect(new Uint8Array(await result.arrayBuffer())).toEqual(JPEG);
	});

	it('follows a safe redirect and revalidates the target', async () => {
		const fetcher = transport(
			response(302, { location: 'https://cdn.example.com/b.jpg' }),
			response(200, { 'content-type': 'image/jpeg' }, [JPEG])
		);
		const result = await proxyPublicImage(new URL('https://example.com/a.jpg'), signal, fetcher);

		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(String(fetcher.mock.calls[1][0])).toBe('https://cdn.example.com/b.jpg');
	});

	it('rejects redirects to unsafe targets', async () => {
		const fetcher = transport(response(302, { location: 'http://127.0.0.1/a.jpg' }));
		await expect(
			proxyPublicImage(new URL('https://example.com/a.jpg'), signal, fetcher)
		).rejects.toBeInstanceOf(RequestError);
	});

	it('rejects unsupported types, oversized bodies, and fake images', async () => {
		const html = transport(response(200, { 'content-type': 'text/html' }, [JPEG]));
		await expect(
			proxyPublicImage(new URL('https://example.com/a'), signal, html)
		).rejects.toMatchObject({ code: 'image_rejected' });

		const huge = transport(
			response(200, { 'content-type': 'image/jpeg', 'content-length': '999999999' })
		);
		await expect(
			proxyPublicImage(new URL('https://example.com/a'), signal, huge)
		).rejects.toMatchObject({ code: 'image_too_large' });

		const fake = transport(
			response(200, { 'content-type': 'image/jpeg' }, [new Uint8Array([1, 2, 3])])
		);
		await expect(
			proxyPublicImage(new URL('https://example.com/a'), signal, fake)
		).rejects.toMatchObject({ code: 'image_rejected' });
	});

	it('maps upstream failures', async () => {
		const limited = transport(response(429, { 'retry-after': '9' }));
		await expect(
			proxyPublicImage(new URL('https://example.com/a'), signal, limited)
		).rejects.toMatchObject({ code: 'provider_rate_limited', retryAfter: 9 });

		const missing = transport(response(404, {}));
		await expect(
			proxyPublicImage(new URL('https://example.com/a'), signal, missing)
		).rejects.toMatchObject({ code: 'provider_unavailable' });
	});
});
