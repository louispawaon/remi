import type { Category } from '#lib/card/types';
import type {
	MediaOptions,
	MediaProvider,
	MediaSearchRequest,
	MediaSearchResult
} from '#lib/media/types';
import { createAniList } from './anilist';
import type { MediaAdapter } from './adapter';
import { TTLCache } from './cache';
import { createDeezer } from './deezer';
import { missingTmdbCredentials } from './errors';
import { createTmdb } from './tmdb';

const PROVIDERS: Record<Category, MediaProvider> = {
	anime: 'anilist',
	manga: 'anilist',
	manhwa: 'anilist',
	manhua: 'anilist',
	movie: 'tmdb',
	tv: 'tmdb',
	music: 'deezer'
};

export interface MediaServiceOptions {
	tmdbToken?: string;
	fetch?: typeof fetch;
	now?: () => number;
}

export class MediaService {
	readonly #searchCache: TTLCache<MediaSearchResult>;
	readonly #optionsCache: TTLCache<MediaOptions>;
	readonly #anilist: MediaAdapter;
	readonly #tmdb: MediaAdapter | undefined;
	readonly #deezer: MediaAdapter;
	readonly #searchInFlight = new Map<string, Promise<MediaSearchResult>>();
	readonly #optionsInFlight = new Map<Category, Promise<MediaOptions>>();

	constructor(options: MediaServiceOptions) {
		this.#searchCache = new TTLCache({
			ttlMs: 45_000,
			maxEntries: 100,
			now: options.now
		});
		this.#optionsCache = new TTLCache({
			ttlMs: 6 * 60 * 60 * 1000,
			maxEntries: 20,
			now: options.now
		});
		this.#anilist = createAniList(options.fetch);
		this.#tmdb = createTmdb({ token: options.tmdbToken, fetch: options.fetch });
		this.#deezer = createDeezer(options.fetch);
	}

	#adapter(provider: MediaProvider): MediaAdapter {
		if (provider === 'anilist') return this.#anilist;
		if (provider === 'deezer') return this.#deezer;
		return this.#tmdb!;
	}

	async search(request: MediaSearchRequest, signal?: AbortSignal): Promise<MediaSearchResult> {
		const provider = PROVIDERS[request.category];
		if (provider === 'tmdb' && !this.#tmdb) throw missingTmdbCredentials();

		const key = searchKey(request);
		const cached = this.#searchCache.get(key);
		if (cached) return cached;

		const existing = this.#searchInFlight.get(key);
		if (existing) return existing;

		const adapter = this.#adapter(provider);
		const pending = adapter
			.search(request)
			.then((result) => {
				this.#searchCache.set(key, result);
				return result;
			})
			.finally(() => this.#searchInFlight.delete(key));
		this.#searchInFlight.set(key, pending);
		return abortable(pending, signal);
	}

	async options(category: Category, signal?: AbortSignal): Promise<MediaOptions> {
		const provider = PROVIDERS[category];
		if (provider === 'tmdb' && !this.#tmdb) throw missingTmdbCredentials();

		const cached = this.#optionsCache.get(category);
		if (cached) return cached;

		const existing = this.#optionsInFlight.get(category);
		if (existing) return existing;

		const adapter = this.#adapter(provider);
		const pending = adapter
			.options(category)
			.then((result) => {
				this.#optionsCache.set(category, result);
				return result;
			})
			.finally(() => this.#optionsInFlight.delete(category));
		this.#optionsInFlight.set(category, pending);
		return abortable(pending, signal);
	}
}

/** Detach a caller from a shared upstream request without aborting it for everyone else. */
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) return promise;
	if (signal.aborted) {
		return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
	}
	return new Promise((resolve, reject) => {
		const onAbort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
		signal.addEventListener('abort', onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener('abort', onAbort);
				resolve(value);
			},
			(error) => {
				signal.removeEventListener('abort', onAbort);
				reject(error);
			}
		);
	});
}

function searchKey(request: MediaSearchRequest): string {
	return JSON.stringify([
		request.category,
		request.mode,
		request.query ?? '',
		request.page,
		request.year ?? '',
		request.genre ?? '',
		request.format ?? '',
		request.status ?? '',
		request.titleLanguage
	]);
}

let service: MediaService | undefined;
let serviceToken: string | undefined;

export function getMediaService(tmdbToken: string | undefined): MediaService {
	if (!service || serviceToken !== tmdbToken) {
		service = new MediaService({ tmdbToken });
		serviceToken = tmdbToken;
	}
	return service;
}

export function providerFor(category: Category): MediaProvider {
	return PROVIDERS[category];
}
