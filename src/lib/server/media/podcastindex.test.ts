import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { MediaSearchRequest } from '#lib/media/types';
import { RequestError } from './errors';
import { createPodcastIndex } from './podcastindex';

const NOW = 1_700_000_000_000;
const request: MediaSearchRequest = {
	category: 'podcast',
	mode: 'search',
	query: 'serial',
	page: 1,
	titleLanguage: 'english'
};

const feeds = Array.from({ length: 30 }, (_, index) => ({
	id: index + 1,
	title: `Podcast ${index + 1}`,
	author: `Publisher ${index + 1}`,
	artwork: `https://cdn.example.com/${index + 1}.jpg`,
	image: `https://cdn.example.com/${index + 1}-small.jpg`,
	episodeCount: 10
}));

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init
	});
}

function fetchMock(body: unknown = { status: 'true', feeds, count: feeds.length }) {
	return vi.fn<typeof fetch>(async () => jsonResponse(body));
}

describe('Podcast Index adapter', () => {
	it('signs requests and slices pages from one bounded search', async () => {
		const fetcher = fetchMock();
		const adapter = createPodcastIndex({
			key: 'key',
			secret: 'secret',
			fetch: fetcher as unknown as typeof fetch,
			now: () => NOW
		});

		const first = await adapter.search(request);
		const url = new URL(String(fetcher.mock.calls[0][0]));
		expect(url.pathname).toBe('/api/1.0/search/byterm');
		expect(url.searchParams.get('q')).toBe('serial');
		expect(url.searchParams.get('max')).toBe('100');

		const headers = fetcher.mock.calls[0][1]!.headers as Record<string, string>;
		const date = String(NOW / 1000);
		expect(headers['X-Auth-Key']).toBe('key');
		expect(headers['X-Auth-Date']).toBe(date);
		expect(headers.Authorization).toBe(createHash('sha1').update(`keysecret${date}`).digest('hex'));

		expect(first.results).toHaveLength(24);
		expect(first.hasNextPage).toBe(true);
		expect(first.total).toBeNull();
		expect(first.results[0]).toMatchObject({
			provider: 'podcastindex',
			providerId: '1',
			category: 'podcast',
			title: { preferred: 'Podcast 1', alternatives: [] },
			year: null,
			format: 'Publisher 1',
			coverPath: 'https://cdn.example.com/1.jpg'
		});

		const second = await adapter.search({ ...request, page: 2 });
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(second.results).toHaveLength(6);
		expect(second.results[0].providerId).toBe('25');
		expect(second.hasNextPage).toBe(false);
	});

	it('falls back to image when artwork is not HTTPS', async () => {
		const fetcher = fetchMock({
			status: 'true',
			feeds: [
				{
					id: 1,
					title: 'HTTP artwork',
					author: 'Publisher',
					artwork: 'http://cdn.example.com/art.jpg',
					image: 'https://cdn.example.com/art.jpg'
				}
			]
		});
		const adapter = createPodcastIndex({
			key: 'key',
			secret: 'secret',
			fetch: fetcher as unknown as typeof fetch,
			now: () => NOW
		});
		const result = await adapter.search({ ...request, query: 'art' });
		expect(result.results[0].coverPath).toBe('https://cdn.example.com/art.jpg');
	});

	it('requires both key and secret', async () => {
		const adapter = createPodcastIndex({
			key: undefined,
			secret: 'secret',
			fetch: fetchMock() as unknown as typeof fetch
		});
		await expect(adapter.search(request)).rejects.toMatchObject({
			code: 'provider_credentials_missing',
			status: 503
		});
		await expect(adapter.options('podcast')).rejects.toMatchObject({
			code: 'provider_credentials_missing'
		});
	});

	it('rejects filters and modes it cannot honor', async () => {
		const adapter = createPodcastIndex({
			key: 'key',
			secret: 'secret',
			fetch: fetchMock() as unknown as typeof fetch
		});

		await expect(
			adapter.search({ ...request, mode: 'browse', query: undefined })
		).rejects.toBeInstanceOf(RequestError);
		await expect(adapter.search({ ...request, year: 2020 })).rejects.toBeInstanceOf(RequestError);
		await expect(adapter.search({ ...request, genre: 'News' })).rejects.toBeInstanceOf(
			RequestError
		);
		await expect(adapter.search({ ...request, titleLanguage: 'native' })).rejects.toBeInstanceOf(
			RequestError
		);
	});

	it('offers no filters, year, or title languages', async () => {
		const adapter = createPodcastIndex({
			key: 'key',
			secret: 'secret',
			fetch: fetchMock() as unknown as typeof fetch
		});
		await expect(adapter.options('podcast')).resolves.toEqual({
			category: 'podcast',
			provider: 'podcastindex',
			supportsYear: false,
			titleLanguages: [],
			filters: []
		});
	});

	it('maps rejected credentials, rate limits, and unexpected payloads', async () => {
		const rejected = createPodcastIndex({
			key: 'key',
			secret: 'secret',
			fetch: (async () => new Response('', { status: 401 })) as unknown as typeof fetch
		});
		await expect(rejected.search(request)).rejects.toMatchObject({
			code: 'provider_credentials_invalid'
		});

		const limited = createPodcastIndex({
			key: 'key',
			secret: 'secret',
			fetch: (async () =>
				new Response('', {
					status: 429,
					headers: { 'retry-after': '6' }
				})) as unknown as typeof fetch
		});
		await expect(limited.search(request)).rejects.toMatchObject({
			code: 'provider_rate_limited',
			retryAfter: 6
		});

		const broken = createPodcastIndex({
			key: 'key',
			secret: 'secret',
			fetch: (async () => jsonResponse({ status: 'true' })) as unknown as typeof fetch
		});
		await expect(broken.search(request)).rejects.toMatchObject({
			code: 'provider_unavailable'
		});
	});
});
