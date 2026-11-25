import type { MediaOptions, MediaResult, MediaSearchResult } from '#lib/media/types';
import type { MediaAdapter } from './adapter';
import {
	MediaError,
	RequestError,
	missingIgdbCredentials,
	timeoutError,
	upstreamError
} from './errors';
import { retryAfterSeconds } from './http';
import { withTimeout } from './timeout';

const BASE = 'https://api.igdb.com/v4';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IMAGE_PREFIX = 'https://images.igdb.com/igdb/image/upload/t_cover_big/';
const PAGE_SIZE = 24;

interface IgdbName {
	name?: string;
}

interface IgdbGame {
	id: number;
	name?: string;
	cover?: { image_id?: string };
	first_release_date?: number;
	platforms?: IgdbName[];
	genres?: IgdbName[];
}

interface IgdbCharacter {
	id: number;
	name?: string;
	mug_shot?: { image_id?: string };
	games?: IgdbName[];
}

export interface IgdbOptions {
	clientId: string | undefined;
	clientSecret: string | undefined;
	fetch?: typeof fetch;
	now?: () => number;
}

export function createIgdb(options: IgdbOptions): MediaAdapter {
	const { clientId, clientSecret } = options;
	const fetcher = options.fetch ?? globalThis.fetch;
	const now = options.now ?? Date.now;

	if (!clientId || !clientSecret) {
		const missing = missingIgdbCredentials();
		return {
			search: async () => {
				throw missing;
			},
			options: async () => {
				throw missing;
			}
		};
	}

	const id = clientId;
	const secret = clientSecret;
	let token: { value: string; expiresAt: number } | null = null;

	async function accessToken(signal?: AbortSignal): Promise<string> {
		const clock = now();
		if (token && clock < token.expiresAt) return token.value;

		let response: Response;
		try {
			response = await fetcher(TOKEN_URL, {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					accept: 'application/json'
				},
				body: new URLSearchParams({
					client_id: id,
					client_secret: secret,
					grant_type: 'client_credentials'
				}),
				signal: withTimeout(signal)
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'TimeoutError') {
				throw timeoutError('IGDB');
			}
			throw new MediaError(
				'provider_unavailable',
				'IGDB is not answering right now. Try again in a moment.'
			);
		}

		if (response.status === 400 || response.status === 401 || response.status === 403) {
			throw new MediaError(
				'provider_credentials_invalid',
				'IGDB rejected its credentials. Check IGDB_CLIENT_ID and IGDB_CLIENT_SECRET in .env.',
				502
			);
		}
		if (!response.ok) {
			throw upstreamError('IGDB', response.status, retryAfterSeconds(response));
		}

		const body = (await response.json().catch(() => null)) as {
			access_token?: string;
			expires_in?: number;
		} | null;
		if (!body?.access_token) {
			throw new MediaError('provider_unavailable', 'IGDB returned an unreadable token.');
		}

		token = {
			value: body.access_token,
			expiresAt: clock + Math.max(0, (body.expires_in ?? 0) - 60) * 1000
		};
		return token.value;
	}

	async function query<T>(
		endpoint: 'games' | 'characters',
		body: string,
		signal?: AbortSignal,
		retried = false
	): Promise<{ rows: T[]; total: number | null }> {
		const bearer = await accessToken(signal);
		let response: Response;
		try {
			response = await fetcher(`${BASE}/${endpoint}`, {
				method: 'POST',
				headers: {
					'Client-ID': id,
					Authorization: `Bearer ${bearer}`,
					accept: 'application/json'
				},
				body,
				signal: withTimeout(signal)
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'TimeoutError') {
				throw timeoutError('IGDB');
			}
			throw new MediaError(
				'provider_unavailable',
				'IGDB is not answering right now. Try again in a moment.'
			);
		}

		if (response.status === 401 && !retried) {
			token = null;
			return query<T>(endpoint, body, signal, true);
		}
		if (!response.ok) {
			throw upstreamError('IGDB', response.status, retryAfterSeconds(response));
		}

		const rows = await response.json().catch(() => null);
		if (!Array.isArray(rows)) {
			throw new MediaError('provider_unavailable', 'IGDB returned an unexpected response.');
		}

		const count = Number(response.headers.get('x-count'));
		return { rows: rows as T[], total: Number.isFinite(count) ? count : null };
	}

	return {
		async search(request, signal): Promise<MediaSearchResult> {
			if (request.mode !== 'search') {
				throw new RequestError('Game search needs a title.');
			}

			const scope = request.scope ?? 'title';
			const queryText = request.query?.trim();
			if (scope === 'character') {
				if (!queryText) throw new RequestError('Search needs a character name.');
				const offset = (request.page - 1) * PAGE_SIZE;
				const { rows } = await query<IgdbCharacter>(
					'characters',
					`search "${escape(queryText)}"; fields name, mug_shot.image_id, games.name; limit ${PAGE_SIZE}; offset ${offset};`,
					signal
				);
				// The index carries junk and artless entries; only portrait tiles are useful here.
				return {
					results: rows.filter((row) => row.mug_shot?.image_id).map(normalizeCharacter),
					page: request.page,
					hasNextPage: rows.length === PAGE_SIZE,
					total: null
				};
			}
			if (scope !== 'title') {
				throw new RequestError('IGDB does not carry people.');
			}
			if (request.titleLanguage !== 'english') {
				throw new RequestError('IGDB supplies one title; language choice applies to AniList.');
			}
			if (request.year || request.genre || request.format || request.status) {
				throw new RequestError('Filters are not available for games.');
			}

			if (!queryText) throw new RequestError('Search needs a game title.');

			const offset = (request.page - 1) * PAGE_SIZE;
			const { rows, total } = await query<IgdbGame>(
				'games',
				`search "${escape(queryText)}"; fields name, cover.image_id, first_release_date, platforms.name, genres.name; limit ${PAGE_SIZE}; offset ${offset};`,
				signal
			);

			return {
				results: rows.map(normalize),
				page: request.page,
				hasNextPage: total === null ? rows.length === PAGE_SIZE : offset + rows.length < total,
				total
			};
		},

		async options(category): Promise<MediaOptions> {
			if (category !== 'game') {
				throw new MediaError('provider_unavailable', 'IGDB only carries games.');
			}
			return {
				category,
				provider: 'igdb',
				scopes: [
					{ value: 'title', label: 'Titles' },
					{ value: 'character', label: 'Characters' }
				],
				supportsYear: false,
				titleLanguages: [],
				filters: []
			};
		}
	};
}

function escape(value: string): string {
	return value.replace(/[\\"]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalize(game: IgdbGame): MediaResult {
	const title = game.name?.trim() || 'Untitled';
	const platforms = (game.platforms ?? []).map((platform) => platform.name).filter(Boolean);
	const shown = platforms.slice(0, 2).join(', ');
	const extra = platforms.length - 2;
	return {
		provider: 'igdb',
		providerId: String(game.id),
		category: 'game',
		title: { preferred: title, alternatives: [] },
		year: yearFrom(game.first_release_date),
		format: shown ? (extra > 0 ? `${shown} +${extra}` : shown) : 'Game',
		status: null,
		genres: (game.genres ?? []).map((genre) => genre.name).filter(Boolean) as string[],
		coverPath: game.cover?.image_id ? `${IMAGE_PREFIX}${game.cover.image_id}.jpg` : null
	};
}

function normalizeCharacter(character: IgdbCharacter): MediaResult {
	return {
		provider: 'igdb',
		providerId: `character:${character.id}`,
		category: 'game',
		title: { preferred: character.name?.trim() || 'Unknown character', alternatives: [] },
		year: null,
		format: character.games?.[0]?.name ?? 'Game',
		status: null,
		genres: [],
		coverPath: character.mug_shot?.image_id
			? `${IMAGE_PREFIX}${character.mug_shot.image_id}.jpg`
			: null
	};
}

function yearFrom(timestamp: number | undefined): number | null {
	if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null;
	const year = new Date(timestamp * 1000).getUTCFullYear();
	return Number.isFinite(year) && year > 0 ? year : null;
}
