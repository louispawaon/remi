import { describe, expect, it, vi } from 'vitest';
import {
	createMediaSearch,
	fetchMediaSearch,
	imageUrl,
	MediaClientError,
	searchUrl
} from './client';
import type { MediaSearchRequest, MediaSearchResult } from './types';

const request: MediaSearchRequest = {
	category: 'anime',
	mode: 'search',
	query: 'bebop',
	page: 2,
	year: 1998,
	genre: 'Action',
	titleLanguage: 'english'
};

const result = (query: string): MediaSearchResult => ({
	results: [
		{
			provider: 'anilist',
			providerId: query,
			category: 'anime',
			title: { preferred: query, alternatives: [] },
			year: null,
			format: null,
			status: null,
			genres: [],
			coverPath: null
		}
	],
	page: 1,
	hasNextPage: false,
	total: 1
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('media client urls', () => {
	it('serializes only the filters in use', () => {
		const url = searchUrl(request);
		expect(url).toContain('category=anime');
		expect(url).toContain('mode=search');
		expect(url).toContain('page=2');
		expect(url).toContain('year=1998');
		expect(url).toContain('genre=Action');
		expect(url).not.toContain('format=');
		expect(url).not.toContain('status=');
		expect(imageUrl('anilist', 'https://s4.anilist.co/file/x.jpg')).toContain('provider=anilist');
	});

	it('surfaces structured provider errors', async () => {
		const fetcher = (async () =>
			new Response(
				JSON.stringify({
					error: 'provider_rate_limited',
					message: 'Slow down.',
					retryAfter: 10
				}),
				{ status: 429, headers: { 'content-type': 'application/json' } }
			)) as unknown as typeof fetch;

		await expect(fetchMediaSearch(request, undefined, fetcher)).rejects.toMatchObject({
			code: 'provider_rate_limited',
			status: 429,
			retryAfter: 10
		});
	});
});

describe('createMediaSearch', () => {
	it('debounces rapid requests into one call', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response(JSON.stringify(result('one')), {
					headers: { 'content-type': 'application/json' }
				})
		);
		const search = createMediaSearch({ debounceMs: 5, fetch: fetcher as unknown as typeof fetch });
		const onResult = vi.fn();

		search.schedule(request, { onResult, onError: vi.fn() });
		search.schedule(request, { onResult, onError: vi.fn() });
		search.schedule(request, { onResult, onError: vi.fn() });
		await wait(25);

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(onResult).toHaveBeenCalledTimes(1);
	});

	it('cancels before the debounce fires', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response(JSON.stringify(result('one')), {
					headers: { 'content-type': 'application/json' }
				})
		);
		const search = createMediaSearch({ debounceMs: 20, fetch: fetcher as unknown as typeof fetch });

		search.schedule(request, { onResult: vi.fn(), onError: vi.fn() });
		search.cancel();
		await wait(40);

		expect(fetcher).not.toHaveBeenCalled();
	});

	it('ignores results from a superseded request', async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const query = new URL(String(input), 'http://localhost').searchParams.get('query');
			if (query === 'first') {
				await wait(30);
				return new Response(JSON.stringify(result('first')), {
					headers: { 'content-type': 'application/json' }
				});
			}
			return new Response(JSON.stringify(result('second')), {
				headers: { 'content-type': 'application/json' }
			});
		});
		const search = createMediaSearch({ debounceMs: 5, fetch: fetcher as unknown as typeof fetch });
		const seen: string[] = [];

		search.schedule(
			{ ...request, query: 'first' },
			{
				onResult: (value) => seen.push(value.results[0].providerId),
				onError: vi.fn()
			}
		);
		await wait(10);
		search.schedule(
			{ ...request, query: 'second' },
			{
				onResult: (value) => seen.push(value.results[0].providerId),
				onError: vi.fn()
			}
		);
		await wait(60);

		expect(seen).toEqual(['second']);
	});

	it('reports client errors from the API', async () => {
		const fetcher = (async () =>
			new Response(JSON.stringify({ error: 'provider_unavailable', message: 'Try later.' }), {
				status: 502,
				headers: { 'content-type': 'application/json' }
			})) as unknown as typeof fetch;
		const search = createMediaSearch({ debounceMs: 5, fetch: fetcher });
		const onError = vi.fn();

		search.schedule(request, { onResult: vi.fn(), onError });
		await wait(30);

		expect(onError).toHaveBeenCalledWith(expect.any(MediaClientError));
		expect(onError.mock.calls[0][0]).toMatchObject({ code: 'provider_unavailable', status: 502 });
	});
});
