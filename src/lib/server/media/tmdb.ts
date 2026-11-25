import type { Category } from '#lib/card/types';
import type {
	MediaOptions,
	MediaResult,
	MediaSearchRequest,
	MediaSearchResult
} from '#lib/media/types';
import type { MediaAdapter } from './adapter';
import {
	missingTmdbCredentials,
	MediaError,
	RequestError,
	timeoutError,
	upstreamError
} from './errors';
import { retryAfterSeconds } from './http';
import { withTimeout } from './timeout';

const BASE = 'https://api.themoviedb.org/3';
const IMAGE_PREFIX = '/t/p/w500';

const TV_STATUSES = [
	{ value: '0', label: 'Returning series' },
	{ value: '1', label: 'Planned' },
	{ value: '2', label: 'In production' },
	{ value: '3', label: 'Ended' },
	{ value: '4', label: 'Canceled' },
	{ value: '5', label: 'Pilot' }
];

export interface TmdbOptions {
	token: string | undefined;
	fetch?: typeof fetch;
}

interface TmdbItem {
	id: number;
	title?: string;
	name?: string;
	original_title?: string;
	original_name?: string;
	release_date?: string;
	first_air_date?: string;
	poster_path?: string | null;
	status?: string;
}

interface TmdbPage {
	page?: number;
	results?: TmdbItem[];
	total_pages?: number;
	total_results?: number;
}

interface TmdbPerson {
	id: number;
	name?: string;
	profile_path?: string | null;
	known_for_department?: string;
	known_for?: { title?: string; name?: string; media_type?: string }[];
}

interface TmdbPersonPage {
	page?: number;
	results?: TmdbPerson[];
	total_pages?: number;
	total_results?: number;
}

interface TmdbCastEntry {
	id: number;
	credit_id?: string;
	name?: string;
	character?: string;
	roles?: { character?: string }[];
	profile_path?: string | null;
}

interface TmdbCredits {
	cast?: TmdbCastEntry[];
}

export function createTmdb(options: TmdbOptions): MediaAdapter {
	const { token } = options;
	const fetcher = options.fetch ?? globalThis.fetch;

	if (!token) {
		const missing = missingTmdbCredentials();
		return {
			search: async () => {
				throw missing;
			},
			options: async () => {
				throw missing;
			}
		};
	}

	async function getJson(path: string, params: Record<string, string>, signal?: AbortSignal) {
		const url = new URL(`${BASE}${path}`);
		for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

		let response: Response;
		try {
			response = await fetcher(url, {
				headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
				signal: withTimeout(signal)
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'TimeoutError') {
				throw timeoutError('TMDB');
			}
			throw new MediaError(
				'provider_unavailable',
				'TMDB is not answering right now. Try again in a moment.'
			);
		}

		if (!response.ok) {
			throw upstreamError('TMDB', response.status, retryAfterSeconds(response));
		}

		try {
			return (await response.json()) as unknown;
		} catch {
			throw new MediaError('provider_unavailable', 'TMDB returned an unreadable response.');
		}
	}

	async function searchPeople(
		request: MediaSearchRequest,
		signal?: AbortSignal
	): Promise<MediaSearchResult> {
		if (request.mode !== 'search' || !request.query?.trim()) {
			throw new RequestError('Search needs an actor name.');
		}

		const payload = (await getJson(
			'/search/person',
			{
				query: request.query.trim(),
				page: String(request.page),
				language: 'en-US',
				include_adult: 'false'
			},
			signal
		)) as TmdbPersonPage;

		if (!Array.isArray(payload.results)) {
			throw new MediaError('provider_unavailable', 'TMDB returned an unexpected response.');
		}

		return {
			results: payload.results.map((person) => normalizePerson(person, request.category)),
			page: request.page,
			hasNextPage: request.page < (payload.total_pages ?? 0),
			total: payload.total_results ?? null
		};
	}

	return {
		async search(request, signal): Promise<MediaSearchResult> {
			const scope = request.scope ?? 'title';
			if (scope === 'person') return searchPeople(request, signal);
			if (scope !== 'title') {
				throw new RequestError('TMDB finds characters through a title, not by name.');
			}
			if (request.titleLanguage !== 'english') {
				throw new RequestError('TMDB supplies one title; language choice applies to AniList.');
			}
			if (request.format) {
				throw new RequestError('Format filters are not available for movies and TV.');
			}
			if (request.mode === 'search' && (request.genre || request.status)) {
				throw new RequestError('Genre and status filters apply to Browse, not Search.');
			}
			if (request.category === 'movie' && request.status) {
				throw new RequestError('Status filters apply to TV only.');
			}

			const isMovie = request.category === 'movie';
			const path = isMovie
				? request.mode === 'search'
					? '/search/movie'
					: '/discover/movie'
				: request.mode === 'search'
					? '/search/tv'
					: '/discover/tv';

			const params: Record<string, string> = {
				page: String(request.page),
				language: 'en-US',
				include_adult: 'false'
			};

			if (request.mode === 'search') {
				params.query = request.query ?? '';
				if (request.year) params[isMovie ? 'year' : 'first_air_date_year'] = String(request.year);
			} else {
				params.sort_by = 'popularity.desc';
				if (request.genre) params.with_genres = request.genre;
				if (request.year) {
					params[isMovie ? 'primary_release_year' : 'first_air_date_year'] = String(request.year);
				}
				if (!isMovie && request.status) params.with_status = request.status;
			}

			const payload = (await getJson(path, params, signal)) as TmdbPage;
			if (!Array.isArray(payload.results)) {
				throw new MediaError('provider_unavailable', 'TMDB returned an unexpected response.');
			}

			return {
				results: payload.results.map((item) => normalize(item, request.category)),
				page: request.page,
				hasNextPage: request.page < (payload.total_pages ?? 0),
				total: payload.total_results ?? null
			};
		},

		async options(category, signal): Promise<MediaOptions> {
			const payload = (await getJson(`/genre/${category}/list`, { language: 'en-US' }, signal)) as {
				genres?: { id: number; name: string }[];
			};

			if (!Array.isArray(payload.genres)) {
				throw new MediaError('provider_unavailable', 'TMDB returned an unexpected response.');
			}

			return {
				category,
				provider: 'tmdb',
				scopes: [
					{ value: 'title', label: 'Titles' },
					{ value: 'person', label: 'Actors' }
				],
				supportsYear: true,
				titleLanguages: [],
				filters: [
					{
						key: 'genre',
						label: 'Genre',
						options: payload.genres.map((genre) => ({
							value: String(genre.id),
							label: genre.name
						}))
					},
					...(category === 'tv'
						? [{ key: 'status' as const, label: 'Status', options: TV_STATUSES }]
						: [])
				]
			};
		},

		async cast(category, id, signal): Promise<MediaResult[]> {
			if (category !== 'movie' && category !== 'tv') {
				throw new RequestError('TMDB only browses cast for movies and TV.');
			}
			const path =
				category === 'movie'
					? `/movie/${encodeURIComponent(id)}/credits`
					: `/tv/${encodeURIComponent(id)}/aggregate_credits`;
			const payload = (await getJson(path, { language: 'en-US' }, signal)) as TmdbCredits;
			if (!Array.isArray(payload.cast)) {
				throw new MediaError('provider_unavailable', 'TMDB returned an unexpected response.');
			}
			return payload.cast.slice(0, 24).map((entry) => normalizeCast(entry, category));
		}
	};
}

function normalizePerson(person: TmdbPerson, category: Category): MediaResult {
	const knownFor = person.known_for?.find((item) => item.title || item.name);
	const context = knownFor?.title || knownFor?.name || person.known_for_department || 'Person';
	return {
		provider: 'tmdb',
		providerId: `person:${person.id}`,
		category,
		title: { preferred: person.name?.trim() || 'Unknown person', alternatives: [] },
		year: null,
		format: context,
		status: null,
		genres: [],
		coverPath: person.profile_path ? `${IMAGE_PREFIX}${person.profile_path}` : null
	};
}

function normalizeCast(entry: TmdbCastEntry, category: Category): MediaResult {
	const role = entry.character?.trim() || entry.roles?.[0]?.character?.trim();
	const actor = entry.name?.trim();
	return {
		provider: 'tmdb',
		providerId: `character:${entry.credit_id ?? entry.id}`,
		category,
		title: { preferred: role || actor || 'Unknown role', alternatives: actor ? [actor] : [] },
		year: null,
		format: actor || 'Cast',
		status: null,
		genres: [],
		coverPath: entry.profile_path ? `${IMAGE_PREFIX}${entry.profile_path}` : null
	};
}

function normalize(item: TmdbItem, category: Category): MediaResult {
	const isMovie = category === 'movie';
	const preferred = (isMovie ? item.title : item.name) ?? 'Untitled';
	const original = isMovie ? item.original_title : item.original_name;
	const date = isMovie ? item.release_date : item.first_air_date;
	const year = date ? Number(date.slice(0, 4)) : null;

	return {
		provider: 'tmdb',
		providerId: String(item.id),
		category,
		title: {
			preferred,
			alternatives: original && original !== preferred ? [original] : []
		},
		year: Number.isFinite(year) ? year : null,
		format: isMovie ? 'Movie' : 'TV',
		status: item.status ?? null,
		genres: [],
		coverPath: item.poster_path ? `${IMAGE_PREFIX}${item.poster_path}` : null
	};
}
