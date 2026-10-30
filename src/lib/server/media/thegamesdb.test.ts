import { describe, expect, it, vi } from 'vitest';
import type { MediaSearchRequest } from '#lib/media/types';
import { RequestError } from './errors';
import { createTheGamesDb } from './thegamesdb';

const gameRequest: MediaSearchRequest = {
	category: 'game',
	mode: 'search',
	query: 'sonic',
	page: 2,
	titleLanguage: 'english'
};

const payload = {
	code: 200,
	status: 'Success',
	remaining_monthly_allowance: 900,
	data: {
		count: 2,
		games: [
			{ id: 53, game_title: 'Sonic the Hedgehog', release_date: '1991-06-23', platform: 18 },
			{ id: 54, game_title: 'Sonic the Hedgehog 2', release_date: '1992-11-24', platform: 18 }
		]
	},
	include: {
		boxart: {
			base_url: { large: 'https://cdn.thegamesdb.net/images/large/' },
			data: {
				'53': [
					{
						type: 'boxart',
						side: 'front',
						filename: 'boxart/front/53-1.jpg',
						resolution: '1080x1521'
					}
				],
				'54': [{ type: 'boxart', side: 'back', filename: 'boxart/back/54-1.jpg' }]
			}
		},
		platform: { data: { '18': { id: 18, name: 'Sega Genesis' } } }
	},
	pages: {
		next: 'https://api.thegamesdb.net/v1.1/Games/ByGameName?apikey=x&name=sonic&page=3',
		previous: null,
		current: 'https://api.thegamesdb.net/v1.1/Games/ByGameName?apikey=x&name=sonic&page=2'
	}
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init
	});
}

function fetchMock(body = payload) {
	return vi.fn<typeof fetch>(async () => jsonResponse(body));
}

describe('TheGamesDB adapter', () => {
	it('searches by name with boxart and platform included', async () => {
		const fetcher = fetchMock();
		const adapter = createTheGamesDb({ key: 'secret', fetch: fetcher as unknown as typeof fetch });
		const result = await adapter.search(gameRequest);

		const url = new URL(String(fetcher.mock.calls[0][0]));
		expect(url.pathname).toBe('/v1.1/Games/ByGameName');
		expect(url.searchParams.get('apikey')).toBe('secret');
		expect(url.searchParams.get('name')).toBe('sonic');
		expect(url.searchParams.get('include')).toBe('boxart,platform');
		expect(url.searchParams.get('page')).toBe('2');

		expect(result.hasNextPage).toBe(true);
		expect(result.total).toBe(2);
		expect(result.results[0]).toMatchObject({
			provider: 'thegamesdb',
			providerId: '53',
			category: 'game',
			title: { preferred: 'Sonic the Hedgehog', alternatives: [] },
			year: 1991,
			format: 'Sega Genesis',
			coverPath: 'https://cdn.thegamesdb.net/images/large/boxart/front/53-1.jpg'
		});
		expect(result.results[1]).toMatchObject({
			providerId: '54',
			year: 1992,
			coverPath: null
		});
	});

	it('requires a key', async () => {
		const adapter = createTheGamesDb({
			key: undefined,
			fetch: fetchMock() as unknown as typeof fetch
		});
		await expect(adapter.search(gameRequest)).rejects.toMatchObject({
			code: 'provider_credentials_missing',
			status: 503
		});
		await expect(adapter.options('game')).rejects.toMatchObject({
			code: 'provider_credentials_missing'
		});
	});

	it('rejects filters and modes it cannot honor', async () => {
		const adapter = createTheGamesDb({
			key: 'secret',
			fetch: fetchMock() as unknown as typeof fetch
		});

		await expect(
			adapter.search({ ...gameRequest, mode: 'browse', query: undefined })
		).rejects.toBeInstanceOf(RequestError);
		await expect(adapter.search({ ...gameRequest, year: 1991 })).rejects.toBeInstanceOf(
			RequestError
		);
		await expect(adapter.search({ ...gameRequest, genre: 'Action' })).rejects.toBeInstanceOf(
			RequestError
		);
		await expect(
			adapter.search({ ...gameRequest, titleLanguage: 'native' })
		).rejects.toBeInstanceOf(RequestError);
	});

	it('offers no filters, year, or title languages', async () => {
		const adapter = createTheGamesDb({
			key: 'secret',
			fetch: fetchMock() as unknown as typeof fetch
		});
		await expect(adapter.options('game')).resolves.toEqual({
			category: 'game',
			provider: 'thegamesdb',
			supportsYear: false,
			titleLanguages: [],
			filters: []
		});
	});

	it('maps rejected keys and unexpected payloads', async () => {
		const rejected = createTheGamesDb({
			key: 'secret',
			fetch: (async () =>
				jsonResponse(
					{ status: 'Invalid API key was provided.' },
					{ status: 403 }
				)) as unknown as typeof fetch
		});
		await expect(rejected.search(gameRequest)).rejects.toMatchObject({
			code: 'provider_credentials_invalid'
		});

		const broken = createTheGamesDb({
			key: 'secret',
			fetch: (async () => jsonResponse({ status: 'Success' })) as unknown as typeof fetch
		});
		await expect(broken.search(gameRequest)).rejects.toMatchObject({
			code: 'provider_unavailable'
		});
	});
});
