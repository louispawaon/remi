import { describe, expect, it, vi } from 'vitest';
import type { MediaSearchRequest } from '#lib/media/types';
import { createDeezer } from './deezer';
import { RequestError } from './errors';

const musicRequest: MediaSearchRequest = {
	category: 'music',
	mode: 'search',
	query: 'blonde',
	page: 1,
	titleLanguage: 'english'
};

const cover = 'https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg';

const trackPage = {
	data: [
		{
			id: 1,
			title: 'Nights',
			artist: { name: 'Frank Ocean' },
			album: { title: 'Blonde', cover_xl: cover }
		}
	],
	total: 100,
	next: 'https://api.deezer.com/search/track?q=blonde&limit=12&index=12'
};

const albumPage = {
	data: [
		{
			id: 2,
			title: 'Blonde',
			artist: { name: 'Frank Ocean' },
			cover_xl: cover,
			record_type: 'album'
		}
	],
	total: 50
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init
	});
}

function fetchMock(tracks = trackPage, albums = albumPage) {
	return vi.fn<typeof fetch>(async (input) => {
		const url = new URL(String(input));
		if (url.pathname === '/search/track') return jsonResponse(tracks);
		if (url.pathname === '/search/album') return jsonResponse(albums);
		return jsonResponse({});
	});
}

describe('Deezer adapter', () => {
	it('searches tracks and albums and interleaves them', async () => {
		const fetcher = fetchMock();
		const adapter = createDeezer(fetcher as unknown as typeof fetch);
		const result = await adapter.search(musicRequest);

		expect(fetcher).toHaveBeenCalledTimes(2);
		const urls = fetcher.mock.calls.map(([input]) => new URL(String(input)));
		expect(urls.map((url) => url.pathname)).toEqual(['/search/track', '/search/album']);
		for (const url of urls) {
			expect(url.searchParams.get('q')).toBe('blonde');
			expect(url.searchParams.get('limit')).toBe('12');
			expect(url.searchParams.get('index')).toBe('0');
		}

		expect(result.results).toHaveLength(2);
		expect(result.results[0]).toMatchObject({
			provider: 'deezer',
			providerId: 'track:1',
			category: 'music',
			title: { preferred: 'Frank Ocean - Nights', alternatives: [] },
			format: 'Blonde',
			coverPath: cover
		});
		expect(result.results[1]).toMatchObject({
			providerId: 'album:2',
			title: { preferred: 'Frank Ocean - Blonde' },
			format: 'Album',
			coverPath: cover
		});
		expect(result.hasNextPage).toBe(true);
		expect(result.total).toBe(150);
	});

	it('pages both result kinds by the same offset', async () => {
		const fetcher = fetchMock();
		const adapter = createDeezer(fetcher as unknown as typeof fetch);
		await adapter.search({ ...musicRequest, page: 2 });

		for (const [input] of fetcher.mock.calls) {
			expect(new URL(String(input)).searchParams.get('index')).toBe('12');
		}
	});

	it('rejects browse mode, filters, and title languages it cannot honor', async () => {
		const adapter = createDeezer(fetchMock() as unknown as typeof fetch);

		await expect(
			adapter.search({ ...musicRequest, mode: 'browse', query: undefined })
		).rejects.toBeInstanceOf(RequestError);
		await expect(adapter.search({ ...musicRequest, genre: 'pop' })).rejects.toBeInstanceOf(
			RequestError
		);
		await expect(adapter.search({ ...musicRequest, year: 2016 })).rejects.toBeInstanceOf(
			RequestError
		);
		await expect(
			adapter.search({ ...musicRequest, titleLanguage: 'native' })
		).rejects.toBeInstanceOf(RequestError);
	});

	it('offers no filters, year, or title languages', async () => {
		const adapter = createDeezer(fetchMock() as unknown as typeof fetch);
		await expect(adapter.options('music')).resolves.toEqual({
			category: 'music',
			provider: 'deezer',
			supportsYear: false,
			titleLanguages: [],
			filters: []
		});
		await expect(adapter.options('movie')).rejects.toMatchObject({
			code: 'provider_unavailable'
		});
	});

	it('maps rate limits and unexpected payloads', async () => {
		const limited = createDeezer(
			(async () =>
				new Response('', {
					status: 429,
					headers: { 'retry-after': '7' }
				})) as unknown as typeof fetch
		);
		await expect(limited.search(musicRequest)).rejects.toMatchObject({
			code: 'provider_rate_limited',
			retryAfter: 7
		});

		const broken = createDeezer((async () =>
			jsonResponse({ error: { message: 'quota' } })) as unknown as typeof fetch);
		await expect(broken.search(musicRequest)).rejects.toMatchObject({
			code: 'provider_unavailable'
		});
	});
});
