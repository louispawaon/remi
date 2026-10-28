/** Bound upstream calls even when the browser keeps the request open. */
export function withTimeout(signal: AbortSignal | undefined, ms = 10_000): AbortSignal {
	const timeout = AbortSignal.timeout(ms);
	return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
