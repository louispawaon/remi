import { failure } from '#lib/server/media/response';
import { proxyImage, resolveImageUrl } from '#lib/server/media/image';
import { parseImageRequest } from '#lib/server/media/validate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, request, fetch }) => {
	try {
		const { provider, path } = parseImageRequest(url);
		const target = resolveImageUrl(provider, path);
		const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8000)]);
		return await proxyImage(target, fetch, signal);
	} catch (error) {
		return failure(error);
	}
};
