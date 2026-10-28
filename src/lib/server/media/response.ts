import type { MediaErrorBody } from '#lib/media/types';
import { json } from '@sveltejs/kit';
import { MediaError, RequestError } from './errors';

export function failure(error: unknown): Response {
	if (error instanceof RequestError) {
		return json({ error: 'invalid_request', message: error.message } satisfies MediaErrorBody, {
			status: 400
		});
	}

	if (error instanceof MediaError) {
		const body: MediaErrorBody = { error: error.code, message: error.message };
		if (error.retryAfter !== undefined) body.retryAfter = error.retryAfter;
		return json(body, {
			status: error.status,
			headers: error.retryAfter ? { 'retry-after': String(error.retryAfter) } : undefined
		});
	}

	console.error('[media] unexpected failure', error);
	return json(
		{ error: 'unknown', message: 'Something went wrong talking to the media providers.' },
		{ status: 500 }
	);
}
