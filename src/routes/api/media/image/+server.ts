import { failure } from '#lib/server/media/response';
import { proxyImage, resolveImageUrl } from '#lib/server/media/image';
import { parseImageRequest } from '#lib/server/media/validate';
import type { RequestHandler } from './$types';

/** Workers only: Node and dev have no Cache API, so requests go straight to the provider. */
const edge = (globalThis as unknown as { caches?: { default: Cache } }).caches;

export const GET: RequestHandler = async ({ url, request, fetch }) => {
	try {
		const { provider, path } = parseImageRequest(url);
		const target = resolveImageUrl(provider, path);
		const key = new Request(target, { method: 'GET' });

		const cached = await edge?.default.match(key);
		if (cached) return cached;

		const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8000)]);
		const response = await proxyImage(target, fetch, signal);
		if (!edge) return response;

		const cacheable = new Response(response.body, {
			status: response.status,
			headers: {
				...Object.fromEntries(response.headers),
				'cache-control': 'public, max-age=604800'
			}
		});
		await edge.default.put(key, cacheable.clone());
		return cacheable;
	} catch (error) {
		return failure(error);
	}
};
