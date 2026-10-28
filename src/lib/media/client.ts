import type { Category } from '#lib/card/types';
import type { MediaErrorBody, MediaOptions, MediaSearchRequest, MediaSearchResult } from './types';

export class MediaClientError extends Error {
	constructor(
		message: string,
		readonly code = 'unknown',
		readonly status = 0,
		readonly retryAfter?: number
	) {
		super(message);
		this.name = 'MediaClientError';
	}
}

export function searchUrl(request: MediaSearchRequest): string {
	const params = new URLSearchParams({
		category: request.category,
		mode: request.mode,
		page: String(request.page),
		titleLanguage: request.titleLanguage
	});
	if (request.query) params.set('query', request.query);
	if (request.year) params.set('year', String(request.year));
	if (request.genre) params.set('genre', request.genre);
	if (request.format) params.set('format', request.format);
	if (request.status) params.set('status', request.status);
	return `/api/media/search?${params}`;
}

export function optionsUrl(category: Category): string {
	return `/api/media/options?${new URLSearchParams({ category })}`;
}

export function imageUrl(provider: 'anilist' | 'tmdb', path: string): string {
	return `/api/media/image?${new URLSearchParams({ provider, path })}`;
}

export async function fetchMediaSearch(
	request: MediaSearchRequest,
	signal?: AbortSignal,
	fetcher: typeof fetch = globalThis.fetch
): Promise<MediaSearchResult> {
	const response = await fetcher(searchUrl(request), { signal });
	if (!response.ok) throw await toClientError(response);
	return (await response.json()) as MediaSearchResult;
}

export async function fetchMediaOptions(
	category: Category,
	signal?: AbortSignal,
	fetcher: typeof fetch = globalThis.fetch
): Promise<MediaOptions> {
	const response = await fetcher(optionsUrl(category), { signal });
	if (!response.ok) throw await toClientError(response);
	return (await response.json()) as MediaOptions;
}

export interface SearchHandlers {
	onResult: (result: MediaSearchResult) => void;
	onError: (error: MediaClientError) => void;
}

export interface MediaSearchOptions {
	debounceMs?: number;
	fetch?: typeof fetch;
}

/** Debounced search that cancels the previous request and ignores stale results. */
export function createMediaSearch(options: MediaSearchOptions = {}) {
	const debounceMs = options.debounceMs ?? 250;
	const fetcher = options.fetch ?? globalThis.fetch;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;
	let generation = 0;

	return {
		schedule(request: MediaSearchRequest, handlers: SearchHandlers): void {
			clearTimeout(timer);
			controller?.abort();
			const current = ++generation;

			timer = setTimeout(() => {
				timer = undefined;
				const active = new AbortController();
				controller = active;

				fetchMediaSearch(request, active.signal, fetcher)
					.then((result) => {
						if (current === generation) handlers.onResult(result);
					})
					.catch(async (error: unknown) => {
						if (current !== generation) return;
						if (error instanceof DOMException && error.name === 'AbortError') return;
						handlers.onError(
							error instanceof MediaClientError
								? error
								: new MediaClientError(error instanceof Error ? error.message : String(error))
						);
					});
			}, debounceMs);
		},

		cancel(): void {
			clearTimeout(timer);
			timer = undefined;
			controller?.abort();
			controller = undefined;
			generation += 1;
		}
	};
}

async function toClientError(response: Response): Promise<MediaClientError> {
	let body: MediaErrorBody | undefined;
	try {
		body = (await response.json()) as MediaErrorBody;
	} catch {
		body = undefined;
	}
	return new MediaClientError(
		body?.message ?? `The media request failed (${response.status}).`,
		body?.error ?? 'unknown',
		response.status,
		body?.retryAfter
	);
}
