import { MediaError, RequestError, timeoutError } from './errors';
import { retryAfterSeconds } from './http';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ANILIST_HOSTS = new Set(['s4.anilist.co', 'img.anilist.co']);
const ALLOWED_TYPES: Record<string, string> = {
	'image/png': 'image/png',
	'image/jpeg': 'image/jpeg',
	'image/jpg': 'image/jpeg',
	'image/webp': 'image/webp'
};

/** Only provider-owned artwork paths may be fetched; arbitrary URLs are rejected. */
export function resolveImageUrl(provider: 'anilist' | 'tmdb', value: string): URL {
	if (provider === 'anilist') {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			throw new RequestError('Invalid AniList image URL.');
		}
		if (url.protocol !== 'https:' || url.username || url.password || url.port) {
			throw new RequestError('AniList images must be plain HTTPS URLs.');
		}
		if (!ANILIST_HOSTS.has(url.hostname)) {
			throw new RequestError('AniList images must come from its CDN.');
		}
		let pathname: string;
		try {
			pathname = decodeURIComponent(url.pathname);
		} catch {
			throw new RequestError('AniList image path is not approved.');
		}
		if (!pathname.startsWith('/file/anilistcdn/') || pathname.includes('..')) {
			throw new RequestError('AniList image path is not approved.');
		}
		if (url.search || url.hash) {
			throw new RequestError('AniList image URLs cannot carry a query or fragment.');
		}
		return url;
	}

	if (!value.startsWith('/t/p/')) {
		throw new RequestError('TMDB image paths must start with /t/p/.');
	}
	if (!/^[A-Za-z0-9/._-]+$/.test(value) || value.includes('..')) {
		throw new RequestError('TMDB image path is not approved.');
	}
	return new URL(`https://image.tmdb.org${value}`);
}

export async function proxyImage(
	target: URL,
	fetcher: typeof fetch,
	signal: AbortSignal
): Promise<Response> {
	let response: Response;
	try {
		response = await fetcher(target, {
			headers: { accept: 'image/png,image/jpeg,image/webp', 'user-agent': 'remi/1.0' },
			redirect: 'manual',
			signal
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === 'TimeoutError') {
			throw timeoutError('The image provider');
		}
		throw new MediaError('provider_unavailable', 'The image provider is not answering right now.');
	}

	if (response.status >= 300 && response.status < 400) {
		throw new MediaError(
			'image_rejected',
			'The image provider redirected; redirects are not followed.'
		);
	}
	if (!response.ok) {
		if (response.status === 429) {
			throw new MediaError(
				'provider_rate_limited',
				'The image provider is rate limiting requests. Try again shortly.',
				429,
				retryAfterSeconds(response)
			);
		}
		throw new MediaError('provider_unavailable', 'The image provider rejected the request.');
	}

	const contentType = (response.headers.get('content-type') ?? '')
		.split(';')[0]
		.trim()
		.toLowerCase();
	const type = ALLOWED_TYPES[contentType];
	if (!type) {
		throw new MediaError('image_rejected', 'The image provider returned an unsupported file type.');
	}

	const declared = Number(response.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
		throw new MediaError('image_too_large', 'That image is larger than 10 MiB.', 413);
	}

	const body = response.body;
	if (!body) throw new MediaError('image_rejected', 'The image response was empty.');

	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > MAX_IMAGE_BYTES) {
				await reader.cancel();
				throw new MediaError('image_too_large', 'That image is larger than 10 MiB.', 413);
			}
			chunks.push(value);
		}
	} catch (error) {
		await reader.cancel().catch(() => undefined);
		if (error instanceof MediaError) throw error;
		if (error instanceof DOMException && error.name === 'TimeoutError') {
			throw timeoutError('The image provider');
		}
		throw new MediaError('provider_unavailable', 'The image provider stopped mid-download.');
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	if (!matchesSignature(type, bytes)) {
		throw new MediaError(
			'image_rejected',
			'The image provider returned bytes that are not an image.'
		);
	}

	return new Response(bytes, {
		headers: {
			'content-type': type,
			'content-length': String(bytes.byteLength),
			'cache-control': 'public, max-age=3600',
			'x-content-type-options': 'nosniff'
		}
	});
}

function matchesSignature(type: string, bytes: Uint8Array): boolean {
	if (type === 'image/png') {
		const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		return signature.every((byte, index) => bytes[index] === byte);
	}
	if (type === 'image/jpeg') {
		return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	}
	if (type === 'image/webp') {
		return (
			bytes[0] === 0x52 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes[3] === 0x46 &&
			bytes[8] === 0x57 &&
			bytes[9] === 0x45 &&
			bytes[10] === 0x42 &&
			bytes[11] === 0x50
		);
	}
	return false;
}
