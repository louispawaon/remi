import { describe, expect, it, vi } from 'vitest';
import type { MediaSearchRequest } from '#lib/media/types';
import { RequestError } from './errors';
import { createIgdb } from './igdb';

const gameRequest: MediaSearchRequest = {
	category: 'game',
	mode: 'search',
	query: 'sonic',
	page: 2,
	titleLanguage: 'english'
};

const rows = [
	{
		id: 53,
		name: 'Sonic the Hedgehog',
		first_release_date: Date.UTC(1991, 5, 23) / 1000,
		cover: { image_id: 'co1uii' },
		platforms: [{ name: 'Sega Genesis' }, { name: 'Arcade' }],
		genres: [{ name: 'Platform' }]
	},
	{
		id: 54,
		name: 'Sonic the Hedgehog 2',
		first_release_date: Date.UTC(1992, 10, 24) / 1000,
		platforms: [{ name: 'Sega Genesis' }]
	}
];

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init
	});
}

function fetchMock() {
	return vi.fn<typeof fetch>(async (input) => {
		const url = String(input);
		if (url.includes('id.twitch.tv')) {
			return jsonResponse({ access_token: 'token', expires_in: 5_000_000 });
		}
		return new Response(JSON.stringify(rows), {
			status: 200,
			headers: { 'content-type': 'application/json', 'x-count': '40' }
		});
	});
}

function create(fetcher: ReturnType<typeof fetchMock>) {
	return createIgdb({
		clientId: 'client',
		clientSecret: 'secret',
		fetch: fetcher as unknown as typeof fetch,
		now: () => 1000
	});
}

describe('IGDB adapter', () => {
	it('exchanges credentials once then searches games with a bearer token', async () => {
		const fetcher = fetchMock();
		const adapter = create(fetcher);
		const result = await adapter.search(gameRequest);

		const tokenCall = fetcher.mock.calls[0];
		const tokenUrl = new URL(String(tokenCall[0]));
		expect(tokenUrl.hostname).toBe('id.twitch.tv');
		expect(new URLSearchParams(String(tokenCall[1]?.body)).get('client_id')).toBe('client');
		expect(new URLSearchParams(String(tokenCall[1]?.body)).get('client_secret')).toBe('secret');

		const searchCall = fetcher.mock.calls[1];
		const searchUrl = new URL(String(searchCall[0]));
		expect(searchUrl.pathname).toBe('/v4/games');
		const headers = new Headers(searchCall[1]?.headers);
		expect(headers.get('client-id')).toBe('client');
		expect(headers.get('authorization')).toBe('Bearer token');
		const body = String(searchCall[1]?.body);
		expect(body).toContain('search "sonic"');
		expect(body).toContain('limit 24');
		expect(body).toContain('offset 24');

		expect(result.hasNextPage).toBe(true);
		expect(result.total).toBe(40);
		expect(result.results[0]).toMatchObject({
			provider: 'igdb',
			providerId: '53',
			category: 'game',
			title: { preferred: 'Sonic the Hedgehog', alternatives: [] },
			year: 1991,
			format: 'Sega Genesis, Arcade',
			genres: ['Platform'],
			coverPath: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1uii.jpg'
		});
		expect(result.results[1]).toMatchObject({
			providerId: '54',
			year: 1992,
			format: 'Sega Genesis',
			coverPath: null
		});
	});

	it('reuses the cached token for later pages', async () => {
		const fetcher = fetchMock();
		const adapter = create(fetcher);

		await adapter.search(gameRequest);
		await adapter.search({ ...gameRequest, page: 3 });

		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(String(fetcher.mock.calls[0][0])).toContain('id.twitch.tv');
		expect(String(fetcher.mock.calls[1][0])).toContain('/v4/games');
		expect(String(fetcher.mock.calls[2][0])).toContain('/v4/games');
	});

	it('refreshes the token once when IGDB rejects it', async () => {
		let gamesCalls = 0;
		const fetcher = vi.fn<typeof fetch>(async (input) => {
			const url = String(input);
			if (url.includes('id.twitch.tv')) {
				return jsonResponse({ access_token: `token-${gamesCalls}`, expires_in: 5_000_000 });
			}
			gamesCalls += 1;
			if (gamesCalls === 1) {
				return jsonResponse({ message: 'expired' }, { status: 401 });
			}
			return new Response(JSON.stringify(rows), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		});
		const adapter = create(fetcher);

		const result = await adapter.search(gameRequest);
		expect(result.results).toHaveLength(2);
		expect(fetcher).toHaveBeenCalledTimes(4);
	});

	it('requires a client id and secret', async () => {
		const adapter = createIgdb({
			clientId: undefined,
			clientSecret: undefined,
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
		const adapter = create(fetchMock());

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

	it('searches characters and keeps only entries with art', async () => {
		const fetcher = vi.fn<typeof fetch>(async (input) => {
			if (String(input).includes('id.twitch.tv')) {
				return jsonResponse({ access_token: 'token', expires_in: 5_000_000 });
			}
			return jsonResponse([
				{ id: 1, name: 'Kratos', mug_shot: { image_id: 'cm1' }, games: [{ name: 'God of War' }] },
				{ id: 2, name: 'Artless', games: [] }
			]);
		});
		const adapter = create(fetcher);
		const result = await adapter.search({ ...gameRequest, scope: 'character', page: 1 });

		expect(String(fetcher.mock.calls[1][0])).toContain('/v4/characters');
		expect(String(fetcher.mock.calls[1][1]?.body)).toContain('mug_shot.image_id');
		expect(result.results).toHaveLength(1);
		expect(result.results[0]).toMatchObject({
			providerId: 'character:1',
			title: { preferred: 'Kratos' },
			format: 'God of War',
			coverPath: 'https://images.igdb.com/igdb/image/upload/t_cover_big/cm1.jpg'
		});
	});

	it('offers no filters, year, or title languages', async () => {
		const adapter = create(fetchMock());
		await expect(adapter.options('game')).resolves.toEqual({
			category: 'game',
			provider: 'igdb',
			scopes: [
				{ value: 'title', label: 'Titles' },
				{ value: 'character', label: 'Characters' }
			],
			supportsYear: false,
			titleLanguages: [],
			filters: []
		});
	});

	it('maps rejected credentials and unexpected payloads', async () => {
		const rejected = createIgdb({
			clientId: 'client',
			clientSecret: 'secret',
			fetch: (async () => jsonResponse({ message: 'invalid client' }, { status: 400 })) as never
		});
		await expect(rejected.search(gameRequest)).rejects.toMatchObject({
			code: 'provider_credentials_invalid'
		});

		const broken = createIgdb({
			clientId: 'client',
			clientSecret: 'secret',
			fetch: (async (input: RequestInfo | URL) => {
				if (String(input).includes('id.twitch.tv')) {
					return jsonResponse({ access_token: 'token', expires_in: 5_000_000 });
				}
				return jsonResponse({ message: 'nope' });
			}) as unknown as typeof fetch
		});
		await expect(broken.search(gameRequest)).rejects.toMatchObject({
			code: 'provider_unavailable'
		});
	});
});
