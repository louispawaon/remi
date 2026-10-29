import type { MediaOptions, MediaResult, MediaSearchResult } from '#lib/media/types';
import type { MediaAdapter } from './adapter';
import { MediaError, RequestError, timeoutError, upstreamError } from './errors';
import { retryAfterSeconds } from './http';
import { withTimeout } from './timeout';

const BASE = 'https://api.deezer.com';
/** Tracks and albums each contribute half of one result page. */
const PER_TYPE = 12;

interface DeezerArtist {
	name?: string;
}

interface DeezerAlbumRef {
	title?: string;
	cover_xl?: string;
	cover_big?: string;
}

interface DeezerTrack {
	id: number;
	title?: string;
	artist?: DeezerArtist;
	album?: DeezerAlbumRef;
}

interface DeezerAlbum {
	id: number;
	title?: string;
	artist?: DeezerArtist;
	cover_xl?: string;
	cover_big?: string;
	record_type?: string;
}

interface DeezerPage<T> {
	data?: T[];
	total?: number;
	next?: string;
}

const RECORD_TYPES: Record<string, string> = {
	album: 'Album',
	single: 'Single',
	ep: 'EP',
	compile: 'Compilation'
};

export function createDeezer(fetcher: typeof fetch = globalThis.fetch): MediaAdapter {
	async function getJson<T>(
		path: string,
		params: Record<string, string>,
		signal?: AbortSignal
	): Promise<DeezerPage<T>> {
		const url = new URL(`${BASE}${path}`);
		for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

		let response: Response;
		try {
			response = await fetcher(url, {
				headers: { accept: 'application/json' },
				signal: withTimeout(signal)
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'TimeoutError') {
				throw timeoutError('Deezer');
			}
			throw new MediaError(
				'provider_unavailable',
				'Deezer is not answering right now. Try again in a moment.'
			);
		}

		if (!response.ok) {
			throw upstreamError('Deezer', response.status, retryAfterSeconds(response));
		}

		try {
			return (await response.json()) as DeezerPage<T>;
		} catch {
			throw new MediaError('provider_unavailable', 'Deezer returned an unreadable response.');
		}
	}

	return {
		async search(request, signal): Promise<MediaSearchResult> {
			if (request.mode !== 'search') {
				throw new RequestError('Music search needs a song, album or artist name.');
			}
			if (request.titleLanguage !== 'english') {
				throw new RequestError('Deezer supplies one title; language choice applies to AniList.');
			}
			if (request.year || request.genre || request.format || request.status) {
				throw new RequestError('Filters are not available for music.');
			}

			const query = request.query?.trim();
			if (!query) throw new RequestError('Search needs a title, album or artist.');

			const params = {
				q: query,
				limit: String(PER_TYPE),
				index: String((request.page - 1) * PER_TYPE)
			};
			const [tracks, albums] = await Promise.all([
				getJson<DeezerTrack>('/search/track', params, signal),
				getJson<DeezerAlbum>('/search/album', params, signal)
			]);
			if (!Array.isArray(tracks.data) || !Array.isArray(albums.data)) {
				throw new MediaError('provider_unavailable', 'Deezer returned an unexpected response.');
			}

			const total =
				typeof tracks.total === 'number' && typeof albums.total === 'number'
					? tracks.total + albums.total
					: null;

			return {
				results: interleave(tracks.data.map(normalizeTrack), albums.data.map(normalizeAlbum)),
				page: request.page,
				hasNextPage: Boolean(tracks.next || albums.next),
				total
			};
		},

		async options(category): Promise<MediaOptions> {
			if (category !== 'music') {
				throw new MediaError('provider_unavailable', 'Deezer only carries music.');
			}
			return {
				category,
				provider: 'deezer',
				supportsYear: false,
				titleLanguages: [],
				filters: []
			};
		}
	};
}

function normalizeTrack(track: DeezerTrack): MediaResult {
	const title = track.title?.trim() || 'Untitled';
	const artist = track.artist?.name?.trim();
	return {
		provider: 'deezer',
		providerId: `track:${track.id}`,
		category: 'music',
		title: { preferred: artist ? `${artist} - ${title}` : title, alternatives: [] },
		year: null,
		format: track.album?.title ?? 'Song',
		status: null,
		genres: [],
		coverPath: track.album?.cover_xl ?? track.album?.cover_big ?? null
	};
}

function normalizeAlbum(album: DeezerAlbum): MediaResult {
	const title = album.title?.trim() || 'Untitled';
	const artist = album.artist?.name?.trim();
	const type = album.record_type ?? '';
	return {
		provider: 'deezer',
		providerId: `album:${album.id}`,
		category: 'music',
		title: { preferred: artist ? `${artist} - ${title}` : title, alternatives: [] },
		year: null,
		format: RECORD_TYPES[type] ?? humanize(type) ?? 'Album',
		status: null,
		genres: [],
		coverPath: album.cover_xl ?? album.cover_big ?? null
	};
}

/** Alternate tracks and albums so one kind does not bury the other on the page. */
function interleave<T>(tracks: T[], albums: T[]): T[] {
	const merged: T[] = [];
	for (let index = 0; index < Math.max(tracks.length, albums.length); index += 1) {
		if (index < tracks.length) merged.push(tracks[index]);
		if (index < albums.length) merged.push(albums[index]);
	}
	return merged;
}

function humanize(value: string): string | undefined {
	if (!value) return undefined;
	return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
