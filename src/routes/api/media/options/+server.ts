import { THEGAMESDB_API_KEY, TMDB_READ_ACCESS_TOKEN } from '$app/env/private';
import { failure } from '#lib/server/media/response';
import { getMediaService } from '#lib/server/media/service';
import { parseOptionsRequest } from '#lib/server/media/validate';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, request }) => {
	try {
		const category = parseOptionsRequest(url);
		const result = await getMediaService(TMDB_READ_ACCESS_TOKEN, THEGAMESDB_API_KEY).options(
			category,
			request.signal
		);
		return json(result, { headers: { 'cache-control': 'private, max-age=300' } });
	} catch (error) {
		return failure(error);
	}
};
