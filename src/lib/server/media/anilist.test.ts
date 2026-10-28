import { describe, expect, it, vi } from 'vitest';
import { createAniList } from './anilist';
import { MediaError } from './errors';
import type { MediaSearchRequest } from '#lib/media/types';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init
	});
}

function page(media: unknown[] = [], hasNextPage = false, total = 1) {
	return jsonResponse({ data: { Page: { pageInfo: { hasNextPage, total }, media } } });
}

const media = {
	id: 21,
	title: { romaji: 'One Piece', english: 'One Piece', native: 'ワンピース' },
	coverImage: {
		extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21.jpg'
	},
	format: 'TV',
	status: 'RELEASING',
	seasonYear: 1999,
	genres: ['Action', 'Adventure']
};

const request: MediaSearchRequest = {
	category: 'anime',
	mode: 'search',
	query: 'one piece',
	page: 2,
	titleLanguage: 'english'
};

function fetchMock(response = page([media], true, 42)) {
	return vi.fn<typeof fetch>(async () => response);
}

describe('AniList adapter', () => {
	it.each(['manga', 'manhwa', 'manhua'] as const)(
		'filters %s by publication year and returns that year',
		async (category) => {
			const fetcher = fetchMock(page([{ ...media, seasonYear: null, startDate: { year: 1997 } }]));
			const adapter = createAniList(fetcher);
			const result = await adapter.search({ ...request, category, year: 1997 });
			const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
			expect(body.variables.startYear).toBe('1997%');
			expect(body.variables.year).toBeUndefined();
			expect(body.query).toContain('startDate_like: $startYear');
			expect(result.results[0].year).toBe(1997);
		}
	);

	it('searches anime with title matching and normalizes the result', async () => {
		const fetcher = fetchMock();
		const adapter = createAniList(fetcher as unknown as typeof fetch);
		const result = await adapter.search(request);

		expect(result.page).toBe(2);
		expect(result.hasNextPage).toBe(true);
		expect(result.total).toBe(42);
		expect(result.results[0]).toMatchObject({
			provider: 'anilist',
			providerId: '21',
			category: 'anime',
			year: 1999,
			format: 'TV',
			status: 'RELEASING',
			genres: ['Action', 'Adventure'],
			coverPath: media.coverImage.extraLarge
		});
		expect(result.results[0].title.preferred).toBe('One Piece');
		expect(result.results[0].title.alternatives).toContain('ワンピース');

		const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
		expect(body.variables).toMatchObject({
			page: 2,
			type: 'ANIME',
			search: 'one piece',
			sort: ['SEARCH_MATCH']
		});
		expect(body.variables.country).toBeUndefined();
		expect(body.variables.countries).toBeUndefined();
		expect(body.variables.isAdult).toBe(false);
	});

	it('maps manga, manhwa, and manhua country filters', async () => {
		const cases = [
			{ category: 'manga' as const, country: 'JP', countries: undefined },
			{ category: 'manhwa' as const, country: 'KR', countries: undefined },
			{ category: 'manhua' as const, country: undefined, countries: ['CN', 'TW'] }
		];

		for (const entry of cases) {
			const fetcher = fetchMock();
			const adapter = createAniList(fetcher as unknown as typeof fetch);
			await adapter.search({ ...request, category: entry.category });
			const variables = JSON.parse(fetcher.mock.calls[0][1]!.body as string).variables;
			expect(variables.type).toBe('MANGA');
			expect(variables.country).toBe(entry.country);
			expect(variables.countries).toEqual(entry.countries);
		}
	});

	it('browses by popularity instead of search match', async () => {
		const fetcher = fetchMock();
		const adapter = createAniList(fetcher as unknown as typeof fetch);
		await adapter.search({
			...request,
			mode: 'browse',
			query: undefined,
			year: 2020,
			genre: 'Action',
			format: 'TV',
			status: 'RELEASING'
		});

		const variables = JSON.parse(fetcher.mock.calls[0][1]!.body as string).variables;
		expect(variables.search).toBeUndefined();
		expect(variables.sort).toEqual(['POPULARITY_DESC']);
		expect(variables).toMatchObject({
			year: 2020,
			genre: 'Action',
			format: 'TV',
			status: 'RELEASING'
		});
	});

	it('honours the title language preference', async () => {
		const fetcher = fetchMock();
		const adapter = createAniList(fetcher as unknown as typeof fetch);
		const result = await adapter.search({ ...request, titleLanguage: 'native' });
		expect(result.results[0].title.preferred).toBe('ワンピース');
	});

	it('maps rate limits and malformed responses', async () => {
		const limited = createAniList(
			(async () =>
				new Response('', {
					status: 429,
					headers: { 'retry-after': '12' }
				})) as unknown as typeof fetch
		);
		await expect(limited.search(request)).rejects.toMatchObject({
			code: 'provider_rate_limited',
			status: 429,
			retryAfter: 12
		});

		const malformed = createAniList(
			fetchMock(jsonResponse({ data: {} })) as unknown as typeof fetch
		);
		await expect(malformed.search(request)).rejects.toBeInstanceOf(MediaError);
	});

	it('distinguishes deadlines from caller cancellations', async () => {
		const waiting = () =>
			vi.fn<typeof fetch>((input, init) => {
				void input;
				return new Promise<Response>((_resolve, reject) => {
					init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason));
				});
			});

		const deadline = createAniList(waiting());
		await expect(deadline.search(request, AbortSignal.timeout(5))).rejects.toMatchObject({
			code: 'provider_timeout'
		});

		const cancelled = createAniList(waiting());
		const controller = new AbortController();
		const pending = cancelled.search(request, controller.signal);
		controller.abort();
		await expect(pending).rejects.toMatchObject({ code: 'provider_unavailable' });
	});

	it('exposes category-appropriate options', async () => {
		const adapter = createAniList();
		const anime = await adapter.options('anime');
		const manga = await adapter.options('manga');

		expect(anime.provider).toBe('anilist');
		expect(anime.filters.map((filter) => filter.key)).toEqual(['genre', 'format', 'status']);
		expect(
			anime.filters.find((filter) => filter.key === 'format')?.options.map((option) => option.value)
		).toContain('TV');
		expect(
			manga.filters.find((filter) => filter.key === 'format')?.options.map((option) => option.value)
		).toContain('MANGA');
		expect(
			manga.filters.find((filter) => filter.key === 'status')?.options.map((option) => option.value)
		).toContain('HIATUS');
		expect(anime.titleLanguages.map((option) => option.value)).toEqual([
			'english',
			'romaji',
			'native'
		]);
	});
});
