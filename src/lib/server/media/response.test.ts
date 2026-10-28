import { describe, expect, it, vi } from 'vitest';
import { MediaError, RequestError } from './errors';
import { failure } from './response';

async function inspect(response: Response) {
	return {
		status: response.status,
		body: (await response.json()) as Record<string, unknown>,
		retryAfter: response.headers.get('retry-after')
	};
}

describe('media error responses', () => {
	it('maps invalid requests to 400', async () => {
		const result = await inspect(failure(new RequestError('Search needs a title.')));
		expect(result.status).toBe(400);
		expect(result.body).toEqual({ error: 'invalid_request', message: 'Search needs a title.' });
	});

	it('maps missing credentials to an actionable 503', async () => {
		const result = await inspect(
			failure(new MediaError('provider_credentials_missing', 'Add a token.', 503))
		);
		expect(result.status).toBe(503);
		expect(result.body.error).toBe('provider_credentials_missing');
	});

	it('maps rate limits with retry-after in body and header', async () => {
		const result = await inspect(
			failure(new MediaError('provider_rate_limited', 'Slow down.', 429, 12))
		);
		expect(result.status).toBe(429);
		expect(result.retryAfter).toBe('12');
		expect(result.body).toMatchObject({ error: 'provider_rate_limited', retryAfter: 12 });
	});

	it('maps timeouts to 504', async () => {
		const result = await inspect(failure(new MediaError('provider_timeout', 'Too slow.', 504)));
		expect(result.status).toBe(504);
	});

	it('hides unexpected failures behind a 500', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await inspect(failure(new Error('boom')));
		expect(result.status).toBe(500);
		expect(result.body).toEqual({
			error: 'unknown',
			message: 'Something went wrong talking to the media providers.'
		});
		spy.mockRestore();
	});
});
