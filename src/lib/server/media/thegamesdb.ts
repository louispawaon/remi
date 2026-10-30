import type { MediaOptions, MediaResult, MediaSearchResult } from '#lib/media/types';
import type { MediaAdapter } from './adapter';
import {
	MediaError,
	RequestError,
	missingTheGamesDbKey,
	timeoutError,
	upstreamError
} from './errors';
import { retryAfterSeconds } from './http';
import { withTimeout } from './timeout';

const BASE = 'https://api.thegamesdb.net';
const IMAGE_PREFIX = 'https://cdn.thegamesdb.net/images/large/';

interface TgdbGame {
	id: number;
	game_title?: string;
	release_date?: string;
	platform?: number;
}

interface TgdbBoxart {
	type?: string;
	side?: string;
	filename?: string;
}

interface TgdbPayload {
	code?: number;
	status?: string;
	data?: {
		count?: number;
		games?: TgdbGame[];
	};
	include?: {
		boxart?: {
			base_url?: Record<string, string>;
			data?: Record<string, TgdbBoxart[]>;
		};
		platform?: {
			data?: Record<string, { id?: number; name?: string }>;
		};
	};
	pages?: {
		next?: string | null;
	};
}

export interface TheGamesDbOptions {
	key: string | undefined;
	fetch?: typeof fetch;
}

export function createTheGamesDb(options: TheGamesDbOptions): MediaAdapter {
	const { key } = options;
	const fetcher = options.fetch ?? globalThis.fetch;

	if (!key) {
		const missing = missingTheGamesDbKey();
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

	async function getJson(
		params: Record<string, string>,
		signal?: AbortSignal
	): Promise<TgdbPayload> {
		const url = new URL(`${BASE}/v1.1/Games/ByGameName`);
		url.searchParams.set('apikey', apiKey);
		for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

		let response: Response;
		try {
			response = await fetcher(url, {
				headers: { accept: 'application/json' },
				signal: withTimeout(signal)
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'TimeoutError') {
				throw timeoutError('TheGamesDB');
			}
			throw new MediaError(
				'provider_unavailable',
				'TheGamesDB is not answering right now. Try again in a moment.'
			);
		}

		if (response.status === 403) {
			let detail = '';
			try {
				const body = (await response.json()) as { status?: string };
				detail = body.status ? ` ${body.status}` : '';
			} catch {
				// keep the generic message
			}
			throw new MediaError(
				'provider_credentials_invalid',
				`TheGamesDB rejected the key, rate limit, or monthly allowance.${detail}`,
				502
			);
		}
		if (!response.ok) {
			throw upstreamError('TheGamesDB', response.status, retryAfterSeconds(response));
		}

		try {
			return (await response.json()) as TgdbPayload;
		} catch {
			throw new MediaError('provider_unavailable', 'TheGamesDB returned an unreadable response.');
		}
	}

	return {
		async search(request, signal): Promise<MediaSearchResult> {
			if (request.mode !== 'search') {
				throw new RequestError('Game search needs a title.');
			}
			if (request.titleLanguage !== 'english') {
				throw new RequestError(
					'TheGamesDB supplies one title; language choice applies to AniList.'
				);
			}
			if (request.year || request.genre || request.format || request.status) {
				throw new RequestError('Filters are not available for games.');
			}

			const query = request.query?.trim();
			if (!query) throw new RequestError('Search needs a game title.');

			const payload = await getJson(
				{
					name: query,
					include: 'boxart,platform',
					page: String(request.page)
				},
				signal
			);
			const games = payload.data?.games;
			if (!Array.isArray(games)) {
				throw new MediaError('provider_unavailable', 'TheGamesDB returned an unexpected response.');
			}

			return {
				results: games.map((game) => normalize(game, payload)),
				page: request.page,
				hasNextPage: Boolean(payload.pages?.next),
				total: typeof payload.data?.count === 'number' ? payload.data.count : null
			};
		},

		async options(category): Promise<MediaOptions> {
			if (category !== 'game') {
				throw new MediaError('provider_unavailable', 'TheGamesDB only carries games.');
			}
			return {
				category,
				provider: 'thegamesdb',
				supportsYear: false,
				titleLanguages: [],
				filters: []
			};
		}
	};
}

function normalize(game: TgdbGame, payload: TgdbPayload): MediaResult {
	const title = game.game_title?.trim() || 'Untitled';
	const platform = game.platform
		? payload.include?.platform?.data?.[String(game.platform)]?.name
		: undefined;
	return {
		provider: 'thegamesdb',
		providerId: String(game.id),
		category: 'game',
		title: { preferred: title, alternatives: [] },
		year: yearFrom(game.release_date),
		format: platform ?? 'Game',
		status: null,
		genres: [],
		coverPath: coverFor(game.id, payload)
	};
}

function coverFor(gameId: number, payload: TgdbPayload): string | null {
	const entries = payload.include?.boxart?.data?.[String(gameId)] ?? [];
	const front = entries.find((entry) => entry.type === 'boxart' && entry.side === 'front');
	if (!front?.filename) return null;

	const base = payload.include?.boxart?.base_url?.large ?? IMAGE_PREFIX;
	try {
		return new URL(front.filename, base.endsWith('/') ? base : `${base}/`).href;
	} catch {
		return null;
	}
}

function yearFrom(date: string | undefined): number | null {
	const match = date?.match(/^(\d{4})/);
	if (!match) return null;
	const year = Number(match[1]);
	return Number.isFinite(year) && year > 0 ? year : null;
}
