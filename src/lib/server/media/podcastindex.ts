import { createHash } from 'node:crypto';
import type { MediaOptions, MediaResult, MediaSearchResult } from '#lib/media/types';
import type { MediaAdapter } from './adapter';
import { TTLCache } from './cache';
import {
	MediaError,
	RequestError,
	missingPodcastIndexCredentials,
	timeoutError,
	upstreamError
} from './errors';
import { retryAfterSeconds } from './http';
import { withTimeout } from './timeout';

const BASE = 'https://api.podcastindex.org/api/1.0';
const PAGE_SIZE = 24;
/** Podcast Index search has no offset; fetch a bounded set and slice it. */
const MAX_FEEDS = 100;
const USER_AGENT = 'remi/1.0 (+https://remi.project1of1.com)';

interface PodcastFeed {
	id?: number;
	title?: string;
	author?: string;
	ownerName?: string;
	artwork?: string;
	image?: string;
	itunesId?: number;
	episodeCount?: number;
	language?: string;
	explicit?: boolean;
}

interface PodcastIndexPayload {
	status?: string | boolean;
	feeds?: PodcastFeed[];
	count?: number;
	description?: string;
}

export interface PodcastIndexOptions {
	key: string | undefined;
	secret: string | undefined;
	fetch?: typeof fetch;
	now?: () => number;
}

export function createPodcastIndex(options: PodcastIndexOptions): MediaAdapter {
	const { key, secret } = options;
	const fetcher = options.fetch ?? globalThis.fetch;
	const now = options.now ?? Date.now;
	const cache = new TTLCache<PodcastFeed[]>({ ttlMs: 45_000, maxEntries: 20, now });

	if (!key || !secret) {
		const missing = missingPodcastIndexCredentials();
		return {
			search: async () => {
				throw missing;
			},
			options: async () => {
				throw missing;
			}
		};
	}
	const apiKey = key;
	const apiSecret = secret;

	async function getFeeds(query: string, signal?: AbortSignal): Promise<PodcastFeed[]> {
		const cacheKey = query.trim().toLowerCase();
		const cached = cache.get(cacheKey);
		if (cached) return cached;

		const url = new URL(`${BASE}/search/byterm`);
		url.searchParams.set('q', query);
		url.searchParams.set('max', String(MAX_FEEDS));

		const date = String(Math.floor(now() / 1000));
		const authorization = createHash('sha1').update(`${apiKey}${apiSecret}${date}`).digest('hex');

		let response: Response;
		try {
			response = await fetcher(url, {
				headers: {
					accept: 'application/json',
					'user-agent': USER_AGENT,
					'X-Auth-Key': apiKey,
					'X-Auth-Date': date,
					Authorization: authorization
				},
				signal: withTimeout(signal)
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'TimeoutError') {
				throw timeoutError('Podcast Index');
			}
			throw new MediaError(
				'provider_unavailable',
				'Podcast Index is not answering right now. Try again in a moment.'
			);
		}

		if (response.status === 401 || response.status === 403) {
			throw new MediaError(
				'provider_credentials_invalid',
				'Podcast Index rejected its credentials. Check the key and secret in .env.',
				502
			);
		}
		if (!response.ok) {
			throw upstreamError('Podcast Index', response.status, retryAfterSeconds(response));
		}

		let payload: PodcastIndexPayload;
		try {
			payload = (await response.json()) as PodcastIndexPayload;
		} catch {
			throw new MediaError(
				'provider_unavailable',
				'Podcast Index returned an unreadable response.'
			);
		}
		if (!Array.isArray(payload.feeds)) {
			throw new MediaError(
				'provider_unavailable',
				payload.description ?? 'Podcast Index returned an unexpected response.'
			);
		}

		cache.set(cacheKey, payload.feeds);
		return payload.feeds;
	}

	return {
		async search(request, signal): Promise<MediaSearchResult> {
			if (request.mode !== 'search') {
				throw new RequestError('Podcast search needs a title.');
			}
			if (request.titleLanguage !== 'english') {
				throw new RequestError(
					'Podcast Index supplies one title; language choice applies to AniList.'
				);
			}
			if (request.year || request.genre || request.format || request.status) {
				throw new RequestError('Filters are not available for podcasts.');
			}

			const query = request.query?.trim();
			if (!query) throw new RequestError('Search needs a podcast name.');

			const feeds = await getFeeds(query, signal);
			const start = (request.page - 1) * PAGE_SIZE;
			return {
				results: feeds.slice(start, start + PAGE_SIZE).map(normalize),
				page: request.page,
				hasNextPage: start + PAGE_SIZE < feeds.length,
				// The search response has no total; avoid claiming a catalogue count.
				total: null
			};
		},

		async options(category): Promise<MediaOptions> {
			if (category !== 'podcast') {
				throw new MediaError('provider_unavailable', 'Podcast Index only carries podcasts.');
			}
			return {
				category,
				provider: 'podcastindex',
				supportsYear: false,
				titleLanguages: [],
				filters: []
			};
		}
	};
}

function normalize(feed: PodcastFeed): MediaResult {
	return {
		provider: 'podcastindex',
		providerId: String(feed.id),
		category: 'podcast',
		title: { preferred: feed.title?.trim() || 'Untitled', alternatives: [] },
		year: null,
		format: feed.author?.trim() || feed.ownerName?.trim() || 'Podcast',
		status: null,
		genres: [],
		coverPath: httpsImage(feed.artwork) ?? httpsImage(feed.image)
	};
}

function httpsImage(value: string | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}
