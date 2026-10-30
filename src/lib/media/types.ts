import type { Category } from '#lib/card/types';

export const MEDIA_PROVIDERS = ['anilist', 'tmdb', 'deezer', 'thegamesdb'] as const;
export type MediaProvider = (typeof MEDIA_PROVIDERS)[number];

export const SEARCH_MODES = ['search', 'browse'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export const TITLE_LANGUAGES = ['english', 'romaji', 'native'] as const;
export type TitleLanguage = (typeof TITLE_LANGUAGES)[number];

export interface MediaTitle {
	preferred: string;
	alternatives: string[];
}

export interface MediaResult {
	provider: MediaProvider;
	providerId: string;
	category: Category;
	title: MediaTitle;
	year: number | null;
	format: string | null;
	status: string | null;
	genres: string[];
	/** Provider image path or absolute allow-listed URL for /api/media/image. */
	coverPath: string | null;
}

export interface MediaSearchRequest {
	category: Category;
	mode: SearchMode;
	query?: string;
	page: number;
	year?: number;
	genre?: string;
	format?: string;
	status?: string;
	titleLanguage: TitleLanguage;
}

export interface MediaSearchResult {
	results: MediaResult[];
	page: number;
	hasNextPage: boolean;
	total: number | null;
}

export interface MediaOption {
	value: string;
	label: string;
}

export interface MediaFilter {
	key: 'genre' | 'format' | 'status';
	label: string;
	options: MediaOption[];
}

export interface MediaOptions {
	category: Category;
	provider: MediaProvider;
	filters: MediaFilter[];
	titleLanguages: MediaOption[];
	supportsYear: boolean;
}

export interface MediaErrorBody {
	error: string;
	message: string;
	retryAfter?: number;
}
