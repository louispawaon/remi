export class RequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RequestError';
	}
}

export type MediaErrorCode =
	| 'provider_credentials_missing'
	| 'provider_credentials_invalid'
	| 'provider_rate_limited'
	| 'provider_unavailable'
	| 'provider_timeout'
	| 'image_rejected'
	| 'image_too_large';

export class MediaError extends Error {
	constructor(
		readonly code: MediaErrorCode,
		message: string,
		readonly status = 502,
		readonly retryAfter?: number
	) {
		super(message);
		this.name = 'MediaError';
	}
}

export function missingTmdbCredentials(): MediaError {
	return new MediaError(
		'provider_credentials_missing',
		'Movie and TV search needs a TMDB read access token. Add TMDB_READ_ACCESS_TOKEN to .env and restart.',
		503
	);
}

export function upstreamError(provider: string, status: number, retryAfter?: number): MediaError {
	if (status === 401 || status === 403) {
		return new MediaError(
			'provider_credentials_invalid',
			`${provider} rejected its credentials. Check the TMDB token in .env.`,
			502
		);
	}
	if (status === 429) {
		return new MediaError(
			'provider_rate_limited',
			`${provider} is rate limiting requests. Try again shortly.`,
			429,
			retryAfter
		);
	}
	return new MediaError(
		'provider_unavailable',
		`${provider} is not answering right now. Try again in a moment.`,
		502
	);
}

export function timeoutError(provider: string): MediaError {
	return new MediaError('provider_timeout', `${provider} took too long to answer. Try again.`, 504);
}
