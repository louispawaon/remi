import { describe, expect, it, vi } from 'vitest';
import { createTmdb } from './tmdb';
import { RequestError } from './errors';
import type { MediaSearchRequest } from '#lib/media/types';

const movieRequest: MediaSearchRequest = {
	category: 'movie',
	mode: 'search',
	query: 'arrival',
	page: 1,
	year: 2016,
	titleLanguage: 'english'
};

const tvRequest: MediaSearchRequest = {
	category: 'tv',
	mode: 'browse',
	page: 2,
	genre: '18',
	year: 2024,
	status: '0',
	titleLanguage: 'english'
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init
	});
}

function fetchMock(
	response = jsonResponse({ page: 1, total_pages: 3, total_results: 60, results: [] })
) {
	return vi.fn<typeof fetch>(async () => response);
}

describe('TMDB adapter', () => {
	it('requires a token', async () => {
		const adapter = createTmdb({ token: undefined });
		await expect(adapter.search(movieRequest)).rejects.toMatchObject({
			code: 'provider_credentials_missing',
			status: 503
		});
		await expect(adapter.options('tv')).rejects.toMatchObject({
			code: 'provider_credentials_missing'
		});
	});

	it('searches movies with bearer auth, query, and year', async () => {
		const fetcher = fetchMock(
			jsonResponse({
				page: 1,
				total_pages: 2,
				total_results: 21,
				results: [
					{
						id: 329865,
						title: 'Arrival',
						original_title: 'Arrival',
						release_date: '2016-11-11',
						poster_path: '/abc.jpg'
					}
				]
			})
		);
		const adapter = createTmdb({ token: 'secret', fetch: fetcher as unknown as typeof fetch });
		const result = await adapter.search(movieRequest);

		const url = new URL(String(fetcher.mock.calls[0][0]));
		expect(url.pathname).toBe('/3/search/movie');
		expect(url.searchParams.get('query')).toBe('arrival');
		expect(url.searchParams.get('year')).toBe('2016');
		expect((fetcher.mock.calls[0][1]!.headers as Record<string, string>).authorization).toBe(
			'Bearer secret'
		);

		expect(result.hasNextPage).toBe(true);
		expect(result.results[0]).toMatchObject({
			provider: 'tmdb',
			category: 'movie',
			year: 2016,
			format: 'Movie',
			coverPath: '/t/p/w500/abc.jpg'
		});
	});

	it('searches TV with the first-air-date year', async () => {
		const fetcher = fetchMock();
		const adapter = createTmdb({ token: 'secret', fetch: fetcher as unknown as typeof fetch });
		await adapter.search({
			...tvRequest,
			mode: 'search',
			query: 'severance',
			genre: undefined,
			status: undefined
		});

		const url = new URL(String(fetcher.mock.calls[0][0]));
		expect(url.pathname).toBe('/3/search/tv');
		expect(url.searchParams.get('first_air_date_year')).toBe('2024');
	});

	it('browses movies by genre and year', async () => {
		const fetcher = fetchMock();
		const adapter = createTmdb({ token: 'secret', fetch: fetcher as unknown as typeof fetch });
		await adapter.search({ ...movieRequest, mode: 'browse', query: undefined, genre: '878' });

		const url = new URL(String(fetcher.mock.calls[0][0]));
		expect(url.pathname).toBe('/3/discover/movie');
		expect(url.searchParams.get('with_genres')).toBe('878');
		expect(url.searchParams.get('primary_release_year')).toBe('2016');
		expect(url.searchParams.get('sort_by')).toBe('popularity.desc');
	});

	it('browses TV with status and normalizes names', async () => {
		const fetcher = fetchMock(
			jsonResponse({
				page: 2,
				total_pages: 5,
				total_results: 100,
				results: [
					{
						id: 9,
						name: 'Severance',
						original_name: 'Severance',
						first_air_date: '2022-02-18',
						poster_path: null
					}
				]
			})
		);
		const adapter = createTmdb({ token: 'secret', fetch: fetcher as unknown as typeof fetch });
		const result = await adapter.search(tvRequest);

		const url = new URL(String(fetcher.mock.calls[0][0]));
		expect(url.pathname).toBe('/3/discover/tv');
		expect(url.searchParams.get('with_status')).toBe('0');
		expect(url.searchParams.get('first_air_date_year')).toBe('2024');
		expect(result.results[0]).toMatchObject({
			category: 'tv',
			year: 2022,
			format: 'TV',
			coverPath: null
		});
	});

	it('rejects filters TMDB would otherwise drop', async () => {
		const adapter = createTmdb({
			token: 'secret',
			fetch: fetchMock() as unknown as typeof fetch
		});

		await expect(adapter.search({ ...movieRequest, genre: '18' })).rejects.toBeInstanceOf(
			RequestError
		);
		await expect(
			adapter.search({ ...movieRequest, mode: 'browse', query: undefined, status: '3' })
		).rejects.toBeInstanceOf(RequestError);
		await expect(
			adapter.search({ ...movieRequest, titleLanguage: 'native' })
		).rejects.toBeInstanceOf(RequestError);
		await expect(
			adapter.search({ ...movieRequest, mode: 'browse', query: undefined, format: 'TV' })
		).rejects.toBeInstanceOf(RequestError);
	});

	it('maps rejected credentials and rate limits', async () => {
		const unauthorized = createTmdb({
			token: 'secret',
			fetch: (async () => new Response('', { status: 401 })) as unknown as typeof fetch
		});
		await expect(unauthorized.search(movieRequest)).rejects.toMatchObject({
			code: 'provider_credentials_invalid'
		});

		const limited = createTmdb({
			token: 'secret',
			fetch: (async () =>
				new Response('', {
					status: 429,
					headers: { 'retry-after': '5' }
				})) as unknown as typeof fetch
		});
		await expect(limited.search(movieRequest)).rejects.toMatchObject({
			code: 'provider_rate_limited',
			retryAfter: 5
		});
	});

	it('exposes genre filters and TV status but not for movies', async () => {
		const fetcher = vi.fn(async () =>
			jsonResponse({
				genres: [
					{ id: 18, name: 'Drama' },
					{ id: 878, name: 'Science Fiction' }
				]
			})
		);
		const adapter = createTmdb({ token: 'secret', fetch: fetcher as unknown as typeof fetch });

		const movie = await adapter.options('movie');
		expect(movie.filters.map((filter) => filter.key)).toEqual(['genre']);
		expect(movie.filters[0].options).toContainEqual({ value: '878', label: 'Science Fiction' });

		const tv = await adapter.options('tv');
		expect(tv.filters.map((filter) => filter.key)).toEqual(['genre', 'status']);
		expect(tv.filters[1].options.map((option) => option.value)).toContain('0');
	});
});
