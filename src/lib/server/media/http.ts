export function retryAfterSeconds(response: Response): number | undefined {
	const header = response.headers.get('retry-after');
	if (!header) return undefined;
	const seconds = Number(header);
	return Number.isFinite(seconds) ? seconds : undefined;
}

/** AniList publishes an epoch timestamp rather than a delta. */
export function rateLimitResetSeconds(response: Response): number | undefined {
	const header = response.headers.get('x-ratelimit-reset');
	if (!header) return undefined;
	const reset = Number(header);
	if (!Number.isFinite(reset)) return undefined;
	return Math.max(1, reset - Math.floor(Date.now() / 1000));
}
