import type { MediaProvider } from '#lib/media/types';
import { MediaError, RequestError, timeoutError } from './errors';
import { retryAfterSeconds } from './http';
import { ALLOWED_TYPES, MAX_IMAGE_BYTES, matchesSignature } from './image-utils';
import { validatePublicImageUrl } from './public-image';

export { MAX_IMAGE_BYTES };

const ANILIST_HOSTS = new Set(['s4.anilist.co', 'img.anilist.co']);
const DEEZER_HOST = 'cdn-images.dzcdn.net';
const THEGAMESDB_HOST = 'cdn.thegamesdb.net';

/** Only provider-owned artwork paths may be fetched; arbitrary URLs are rejected. */
export function resolveImageUrl(provider: MediaProvider, value: string): URL {
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

	if (provider === 'deezer') {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			throw new RequestError('Invalid Deezer image URL.');
		}
		if (url.protocol !== 'https:' || url.username || url.password || url.port) {
			throw new RequestError('Deezer images must be plain HTTPS URLs.');
		}
		if (url.hostname !== DEEZER_HOST) {
			throw new RequestError('Deezer images must come from its CDN.');
		}
		let pathname: string;
		try {
			pathname = decodeURIComponent(url.pathname);
		} catch {
			throw new RequestError('Deezer image path is not approved.');
		}
		if (!pathname.startsWith('/images/cover/') || pathname.includes('..')) {
			throw new RequestError('Deezer image path is not approved.');
		}
		if (url.search || url.hash) {
			throw new RequestError('Deezer image URLs cannot carry a query or fragment.');
		}
		return url;
	}

	if (provider === 'thegamesdb') {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			throw new RequestError('Invalid TheGamesDB image URL.');
		}
		if (url.protocol !== 'https:' || url.username || url.password || url.port) {
			throw new RequestError('TheGamesDB images must be plain HTTPS URLs.');
		}
		if (url.hostname !== THEGAMESDB_HOST) {
			throw new RequestError('TheGamesDB images must come from its CDN.');
		}
		let pathname: string;
		try {
			pathname = decodeURIComponent(url.pathname);
		} catch {
			throw new RequestError('TheGamesDB image path is not approved.');
		}
		if (!pathname.startsWith('/images/large/boxart/') || pathname.includes('..')) {
			throw new RequestError('TheGamesDB image path is not approved.');
		}
		if (url.search || url.hash) {
			throw new RequestError('TheGamesDB image URLs cannot carry a query or fragment.');
		}
		return url;
	}

	if (provider === 'podcastindex') {
		return validatePublicImageUrl(value);
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
