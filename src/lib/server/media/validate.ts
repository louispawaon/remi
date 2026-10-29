import { CATEGORIES, type Category } from '#lib/card/types';
import {
	MEDIA_PROVIDERS,
	TITLE_LANGUAGES,
	type MediaSearchRequest,
	type SearchMode
} from '#lib/media/types';
import * as v from 'valibot';
import { RequestError } from './errors';

const optionalText = (max: number) =>
	v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max)));

const optionalNumber = (min: number, max: number) =>
	v.optional(
		v.pipe(
			v.string(),
			v.transform(Number),
			v.number(),
			v.integer(),
			v.minValue(min),
			v.maxValue(max)
		)
	);

const searchSchema = v.object({
	category: v.picklist(CATEGORIES),
	mode: v.picklist(['search', 'browse']),
	query: optionalText(200),
	page: optionalNumber(1, 500),
	year: optionalNumber(1900, 2100),
	genre: optionalText(64),
	format: optionalText(64),
	status: optionalText(64),
	titleLanguage: v.optional(v.picklist(TITLE_LANGUAGES))
});

const optionsSchema = v.object({ category: v.picklist(CATEGORIES) });

const imageSchema = v.object({
	provider: v.picklist(MEDIA_PROVIDERS),
	path: v.pipe(v.string(), v.minLength(1), v.maxLength(2048))
});

function param(url: URL, key: string): string | undefined {
	const value = url.searchParams.get(key)?.trim();
	return value ? value : undefined;
}

function parse<T extends v.GenericSchema>(schema: T, input: Record<string, string | undefined>) {
	const parsed = v.safeParse(schema, input);
	if (!parsed.success) {
		throw new RequestError(parsed.issues[0]?.message ?? 'Invalid request');
	}
	return parsed.output;
}

export function parseSearchRequest(url: URL): MediaSearchRequest {
	const parsed = parse(searchSchema, {
		category: param(url, 'category'),
		mode: param(url, 'mode'),
		query: param(url, 'query'),
		page: param(url, 'page'),
		year: param(url, 'year'),
		genre: param(url, 'genre'),
		format: param(url, 'format'),
		status: param(url, 'status'),
		titleLanguage: param(url, 'titleLanguage')
	});

	const mode = parsed.mode as SearchMode;
	if (mode === 'search' && !parsed.query) {
		throw new RequestError('Search needs a title.');
	}

	return {
		category: parsed.category as Category,
		mode,
		query: mode === 'search' ? parsed.query : undefined,
		page: parsed.page ?? 1,
		year: parsed.year,
		genre: parsed.genre,
		format: parsed.format,
		status: parsed.status,
		titleLanguage: parsed.titleLanguage ?? 'english'
	};
}

export function parseOptionsRequest(url: URL): Category {
	return parse(optionsSchema, { category: param(url, 'category') }).category as Category;
}

export function parseImageRequest(url: URL) {
	return parse(imageSchema, {
		provider: param(url, 'provider'),
		path: param(url, 'path')
	});
}
