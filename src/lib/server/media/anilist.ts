import type {
	MediaOptions,
	MediaResult,
	MediaSearchRequest,
	MediaTitle,
	TitleLanguage
} from '#lib/media/types';
import type { MediaAdapter } from './adapter';
import { MediaError, timeoutError, upstreamError } from './errors';
import { rateLimitResetSeconds, retryAfterSeconds } from './http';
import { withTimeout } from './timeout';

const ENDPOINT = 'https://graphql.anilist.co';
const PER_PAGE = 24;

const CATEGORY_MAP: Record<string, { type: 'ANIME' | 'MANGA'; countries: string[] }> = {
	anime: { type: 'ANIME', countries: [] },
	manga: { type: 'MANGA', countries: ['JP'] },
	manhwa: { type: 'MANGA', countries: ['KR'] },
	manhua: { type: 'MANGA', countries: ['CN', 'TW'] }
};

const GENRES = [
	'Action',
	'Adventure',
	'Comedy',
	'Drama',
	'Ecchi',
	'Fantasy',
	'Horror',
	'Mahou Shoujo',
	'Mecha',
	'Music',
	'Mystery',
	'Psychological',
	'Romance',
	'Sci-Fi',
	'Slice of Life',
	'Sports',
	'Supernatural',
	'Thriller'
];

const ANIME_FORMATS = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'];
const MANGA_FORMATS = ['MANGA', 'NOVEL', 'ONE_SHOT'];
const ANIME_STATUSES = ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED'];
const MANGA_STATUSES = [...ANIME_STATUSES, 'HIATUS'];

const SEARCH_QUERY = `
query Media(
	$page: Int,
	$perPage: Int,
	$search: String,
	$type: MediaType,
	$country: CountryCode,
	$countries: [CountryCode],
	$year: Int,
	$startYear: String,
	$genre: String,
	$format: MediaFormat,
	$status: MediaStatus,
	$sort: [MediaSort],
	$isAdult: Boolean
) {
	Page(page: $page, perPage: $perPage) {
		pageInfo { hasNextPage currentPage total }
		media(
			search: $search,
			type: $type,
			countryOfOrigin: $country,
			countryOfOrigin_in: $countries,
			seasonYear: $year,
			startDate_like: $startYear,
			genre: $genre,
			format: $format,
			status: $status,
			isAdult: $isAdult,
			sort: $sort
		) {
			id
			title { romaji english native }
			coverImage { extraLarge large }
			format
			status
			seasonYear
			startDate { year }
			genres
		}
	}
}`;

interface AniListMedia {
	id: number;
	title: { romaji?: string | null; english?: string | null; native?: string | null };
	coverImage?: { extraLarge?: string | null; large?: string | null } | null;
	format?: string | null;
	status?: string | null;
	seasonYear?: number | null;
	startDate?: { year?: number | null } | null;
	genres?: string[] | null;
}

interface AniListPayload {
	data?: {
		Page?: {
			pageInfo?: { hasNextPage?: boolean; total?: number };
			media?: AniListMedia[];
		};
	};
}

export function createAniList(fetcher: typeof fetch = globalThis.fetch): MediaAdapter {
	return {
		async search(request, signal) {
			const mapping = CATEGORY_MAP[request.category];
			if (!mapping)
				throw new MediaError('provider_unavailable', 'AniList does not carry this category.');

			const variables: Record<string, unknown> = {
				page: request.page,
				perPage: PER_PAGE,
				type: mapping.type,
				isAdult: false,
				sort: request.mode === 'search' ? ['SEARCH_MATCH'] : ['POPULARITY_DESC']
			};
			if (request.mode === 'search') variables.search = request.query;
			if (mapping.countries.length === 1) variables.country = mapping.countries[0];
			if (mapping.countries.length > 1) variables.countries = mapping.countries;
			if (request.year) {
				if (mapping.type === 'ANIME') variables.year = request.year;
				else variables.startYear = `${request.year}%`;
			}
			if (request.genre) variables.genre = request.genre;
			if (request.format) variables.format = request.format;
			if (request.status) variables.status = request.status;

			let response: Response;
			try {
				response = await fetcher(ENDPOINT, {
					method: 'POST',
					headers: { 'content-type': 'application/json', accept: 'application/json' },
					body: JSON.stringify({ query: SEARCH_QUERY, variables }),
					signal: withTimeout(signal)
				});
			} catch (error) {
				throw fetchFailure(error, 'AniList');
			}

			if (!response.ok) {
				throw upstreamError(
					'AniList',
					response.status,
					retryAfterSeconds(response) ?? rateLimitResetSeconds(response)
				);
			}

			let payload: AniListPayload;
			try {
				payload = (await response.json()) as AniListPayload;
			} catch {
				throw new MediaError('provider_unavailable', 'AniList returned an unreadable response.');
			}

			const page = payload.data?.Page;
			if (!page || !Array.isArray(page.media)) {
				throw new MediaError('provider_unavailable', 'AniList returned an unexpected response.');
			}

			return {
				results: page.media.map((media) => normalize(media, request)),
				page: request.page,
				hasNextPage: page.pageInfo?.hasNextPage ?? false,
				total: page.pageInfo?.total ?? null
			};
		},

		async options(category) {
			const mapping = CATEGORY_MAP[category];
			if (!mapping)
				throw new MediaError('provider_unavailable', 'AniList does not carry this category.');
			const formats = mapping.type === 'ANIME' ? ANIME_FORMATS : MANGA_FORMATS;
			const statuses = mapping.type === 'ANIME' ? ANIME_STATUSES : MANGA_STATUSES;

			return {
				category,
				provider: 'anilist',
				supportsYear: true,
				titleLanguages: [
					{ value: 'english', label: 'English' },
					{ value: 'romaji', label: 'Romaji' },
					{ value: 'native', label: 'Native' }
				],
				filters: [
					{
						key: 'genre',
						label: 'Genre',
						options: GENRES.map((genre) => ({ value: genre, label: genre }))
					},
					{
						key: 'format',
						label: 'Format',
						options: formats.map((format) => ({ value: format, label: humanize(format) }))
					},
					{
						key: 'status',
						label: 'Status',
						options: statuses.map((status) => ({ value: status, label: humanize(status) }))
					}
				]
			} satisfies MediaOptions;
		}
	};
}

function normalize(media: AniListMedia, request: MediaSearchRequest): MediaResult {
	return {
		provider: 'anilist',
		providerId: String(media.id),
		category: request.category,
		title: pickTitle(media.title, request.titleLanguage),
		year:
			request.category === 'anime' ? (media.seasonYear ?? null) : (media.startDate?.year ?? null),
		format: media.format ?? null,
		status: media.status ?? null,
		genres: media.genres ?? [],
		coverPath: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null
	};
}

export function pickTitle(
	titles: { romaji?: string | null; english?: string | null; native?: string | null },
	language: TitleLanguage
): MediaTitle {
	const candidates = [titles[language], titles.english, titles.romaji, titles.native];
	const preferred = candidates.find((title) => title?.trim()) ?? 'Untitled';
	const alternatives = [
		...new Set([titles.english, titles.romaji, titles.native].filter((title) => title?.trim()))
	].filter((title) => title !== preferred) as string[];
	return { preferred, alternatives };
}

export function humanize(value: string): string {
	return value
		.replaceAll('_', ' ')
		.toLowerCase()
		.replace(/\b\w/g, (character) => character.toUpperCase())
		.replace(/\bTv\b/, 'TV');
}

function fetchFailure(error: unknown, provider: string): Error {
	if (error instanceof DOMException && error.name === 'TimeoutError') {
		return timeoutError(provider);
	}
	return new MediaError(
		'provider_unavailable',
		`${provider} is not answering right now. Try again in a moment.`
	);
}
