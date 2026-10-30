import { describe, expect, it, vi } from 'vitest';
import { TTLCache } from './cache';
import { MediaService } from './service';
import type { MediaSearchRequest } from '#lib/media/types';

const anilistPage = {
	data: {
		Page: {
			pageInfo: { hasNextPage: false, total: 1 },
			media: [
				{
					id: 1,
					title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop', native: 'カウボーイビバップ' },
					coverImage: {
						extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg'
					},
					format: 'TV',
					status: 'FINISHED',
					seasonYear: 1998,
					genres: ['Action']
				}
			]
		}
	}
};

const animeRequest: MediaSearchRequest = {
	category: 'anime',
	mode: 'search',
	query: 'bebop',
	page: 1,
	titleLanguage: 'english'
};

function fetcherMock() {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes('graphql.anilist.co')) {
			return new Response(JSON.stringify(anilistPage), {
				headers: { 'content-type': 'application/json' }
			});
		}
		if (url.includes('/genre/')) {
			return new Response(JSON.stringify({ genres: [{ id: 18, name: 'Drama' }] }), {
				headers: { 'content-type': 'application/json' }
			});
		}
		if (url.includes('api.deezer.com')) {
			return new Response(JSON.stringify({ data: [], total: 0 }), {
				headers: { 'content-type': 'application/json' }
			});
		}
		if (url.includes('api.thegamesdb.net')) {
			return new Response(
				JSON.stringify({
					data: { count: 0, games: [] },
					include: {},
					pages: { next: null }
				}),
				{ headers: { 'content-type': 'application/json' } }
			);
		}
		return new Response(
			JSON.stringify({
				page: 1,
				total_pages: 1,
				total_results: 1,
				results: [{ id: 5, title: 'Heat', release_date: '1995-12-15', poster_path: '/heat.jpg' }]
			}),
			{ headers: { 'content-type': 'application/json' } }
		);
	});
}

describe('MediaService', () => {
	it('routes categories to the right provider and caches search briefly', async () => {
		let now = 1000;
		const fetcher = fetcherMock();
		const service = new MediaService({
			tmdbToken: 'token',
			fetch: fetcher as unknown as typeof fetch,
			now: () => now
		});

		const first = await service.search(animeRequest);
		const second = await service.search(animeRequest);
		expect(second).toEqual(first);
		expect(fetcher).toHaveBeenCalledTimes(1);

		now += 46_000;
		await service.search(animeRequest);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('caches provider options for six hours', async () => {
		let now = 1000;
		const fetcher = fetcherMock();
		const service = new MediaService({
			tmdbToken: 'token',
			fetch: fetcher as unknown as typeof fetch,
			now: () => now
		});

		await service.options('movie');
		await service.options('movie');
		expect(fetcher).toHaveBeenCalledTimes(1);

		now += 6 * 60 * 60 * 1000 + 1;
		await service.options('movie');
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('coalesces concurrent identical searches into one upstream call', async () => {
		let release: (() => void) | undefined;
		const fetcher = vi.fn<typeof fetch>(
			() =>
				new Promise<Response>((resolve) => {
					release = () =>
						resolve(
							new Response(JSON.stringify(anilistPage), {
								headers: { 'content-type': 'application/json' }
							})
						);
				})
		);
		const service = new MediaService({ fetch: fetcher, now: () => 0 });

		const first = service.search(animeRequest);
		const second = service.search(animeRequest);
		release!();
		const [left, right] = await Promise.all([first, second]);

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(right).toEqual(left);
	});

	it('keeps a shared request alive when one caller cancels', async () => {
		let release: (() => void) | undefined;
		const fetcher = vi.fn<typeof fetch>(
			() =>
				new Promise<Response>((resolve) => {
					release = () =>
						resolve(
							new Response(JSON.stringify(anilistPage), {
								headers: { 'content-type': 'application/json' }
							})
						);
				})
		);
		const service = new MediaService({ fetch: fetcher, now: () => 0 });

		const controller = new AbortController();
		const first = service.search(animeRequest, controller.signal);
		const second = service.search(animeRequest, new AbortController().signal);
		controller.abort();

		await expect(first).rejects.toMatchObject({ name: 'AbortError' });
		release!();
		await expect(second).resolves.toBeTruthy();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('does not cache across pages', async () => {
		const fetcher = fetcherMock();
		const service = new MediaService({
			tmdbToken: 'token',
			fetch: fetcher as unknown as typeof fetch
		});
		await service.search(animeRequest);
		await service.search({ ...animeRequest, page: 2 });
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('reports missing TMDB credentials for movie and TV only', async () => {
		const fetcher = fetcherMock();
		const service = new MediaService({ fetch: fetcher as unknown as typeof fetch });

		await expect(
			service.search({ ...animeRequest, category: 'movie', query: 'heat' })
		).rejects.toMatchObject({ code: 'provider_credentials_missing' });
		await expect(service.options('tv')).rejects.toMatchObject({
			code: 'provider_credentials_missing'
		});

		await expect(service.search(animeRequest)).resolves.toBeTruthy();
	});

	it('routes music to Deezer without a credential', async () => {
		const fetcher = fetcherMock();
		const service = new MediaService({ fetch: fetcher as unknown as typeof fetch });

		await expect(
			service.search({ ...animeRequest, category: 'music', query: 'blonde' })
		).resolves.toMatchObject({ results: [] });
		await expect(service.options('music')).resolves.toMatchObject({ provider: 'deezer' });
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('routes games to TheGamesDB without touching TMDB', async () => {
		const fetcher = fetcherMock();
		const service = new MediaService({
			theGamesDbKey: 'key',
			fetch: fetcher as unknown as typeof fetch
		});

		await expect(
			service.search({ ...animeRequest, category: 'game', query: 'sonic' })
		).resolves.toMatchObject({ results: [] });
		await expect(service.options('game')).resolves.toMatchObject({ provider: 'thegamesdb' });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('reports a missing TheGamesDB key for games', async () => {
		const service = new MediaService({ fetch: fetcherMock() as unknown as typeof fetch });

		await expect(
			service.search({ ...animeRequest, category: 'game', query: 'sonic' })
		).rejects.toMatchObject({ code: 'provider_credentials_missing' });
		await expect(service.options('game')).rejects.toMatchObject({
			code: 'provider_credentials_missing'
		});
	});

	it('searches TMDB when a token is configured', async () => {
		const fetcher = fetcherMock();
		const service = new MediaService({
			tmdbToken: 'token',
			fetch: fetcher as unknown as typeof fetch
		});
		const result = await service.search({
			...animeRequest,
			category: 'movie',
			query: 'heat'
		});
		expect(result.results[0]).toMatchObject({ provider: 'tmdb', category: 'movie', year: 1995 });
	});
});

describe('TTLCache', () => {
	it('expires entries and evicts the least recently used', () => {
		let now = 0;
		const cache = new TTLCache<number>({ ttlMs: 100, maxEntries: 2, now: () => now });
		cache.set('a', 1);
		cache.set('b', 2);
		expect(cache.get('a')).toBe(1);
		cache.set('c', 3);
		expect(cache.get('b')).toBeUndefined();
		expect(cache.get('a')).toBe(1);
		expect(cache.get('c')).toBe(3);

		now = 101;
		expect(cache.get('a')).toBeUndefined();
	});
});
