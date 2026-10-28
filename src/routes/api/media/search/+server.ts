import { TMDB_READ_ACCESS_TOKEN } from '$app/env/private';
import { getMediaService } from '#lib/server/media/service';
import { failure } from '#lib/server/media/response';
import { parseSearchRequest } from '#lib/server/media/validate';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, request }) => {
	try {
		const query = parseSearchRequest(url);
		const result = await getMediaService(TMDB_READ_ACCESS_TOKEN).search(query, request.signal);
		return json(result, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		return failure(error);
	}
};
