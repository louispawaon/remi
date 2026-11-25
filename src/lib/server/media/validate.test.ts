import { describe, expect, it } from 'vitest';
import { RequestError } from './errors';
import {
	parseCastRequest,
	parseImageRequest,
	parseOptionsRequest,
	parseSearchRequest
} from './validate';

const search = (query: string) => new URL(`https://remi.test/api/media/search?${query}`);
const options = (query: string) => new URL(`https://remi.test/api/media/options?${query}`);
const image = (query: string) => new URL(`https://remi.test/api/media/image?${query}`);

describe('request validation', () => {
	it('defaults page and title language, and clears browse queries', () => {
		const request = parseSearchRequest(search('category=anime&mode=browse&query=ignored'));
		expect(request).toMatchObject({
			category: 'anime',
			mode: 'browse',
			page: 1,
			titleLanguage: 'english',
			query: undefined
		});
	});

	it('defaults scope to title and accepts character or person searches', () => {
		expect(parseSearchRequest(search('category=game&mode=search&query=zelda')).scope).toBe('title');
		expect(
			parseSearchRequest(search('category=game&mode=search&query=zelda&scope=character')).scope
		).toBe('character');
		expect(() =>
			parseSearchRequest(search('category=game&mode=search&query=zelda&scope=nope'))
		).toThrow(RequestError);
	});

	it('parses cast requests for movies and TV only', () => {
		expect(
			parseCastRequest(new URL('https://remi.test/api/media/cast?category=movie&id=5'))
		).toEqual({ category: 'movie', id: '5' });
		expect(() =>
			parseCastRequest(new URL('https://remi.test/api/media/cast?category=anime&id=5'))
		).toThrow(RequestError);
	});

	it('requires a query for search and validates enums and ranges', () => {
		expect(() => parseSearchRequest(search('category=anime&mode=search'))).toThrow(RequestError);
		expect(() => parseSearchRequest(search('category=nope&mode=search&query=x'))).toThrow(
			RequestError
		);
		expect(() => parseSearchRequest(search('category=anime&mode=search&query=x&page=0'))).toThrow(
			RequestError
		);
		expect(() =>
			parseSearchRequest(search('category=anime&mode=search&query=x&year=1800'))
		).toThrow(RequestError);
	});

	it('parses filters and numeric fields', () => {
		const request = parseSearchRequest(
			search(
				'category=tv&mode=browse&page=3&year=2024&genre=18&format=TV&status=0&titleLanguage=native'
			)
		);
		expect(request).toMatchObject({
			category: 'tv',
			mode: 'browse',
			page: 3,
			year: 2024,
			genre: '18',
			format: 'TV',
			status: '0',
			titleLanguage: 'native'
		});
	});

	it('validates category and image parameters', () => {
		expect(parseOptionsRequest(options('category=movie'))).toBe('movie');
		expect(() => parseOptionsRequest(options('category=nope'))).toThrow(RequestError);
		expect(
			parseImageRequest(image('provider=anilist&path=https%3A%2F%2Fs4.anilist.co%2Ffile%2Fx.jpg'))
		).toEqual({
			provider: 'anilist',
			path: 'https://s4.anilist.co/file/x.jpg'
		});
		expect(
			parseImageRequest(
				image(
					'provider=deezer&path=https%3A%2F%2Fcdn-images.dzcdn.net%2Fimages%2Fcover%2Fabc%2Fx.jpg'
				)
			)
		).toEqual({
			provider: 'deezer',
			path: 'https://cdn-images.dzcdn.net/images/cover/abc/x.jpg'
		});
		expect(
			parseImageRequest(
				image(
					'provider=igdb&path=https%3A%2F%2Fimages.igdb.com%2Figdb%2Fimage%2Fupload%2Ft_cover_big%2Fco1uii.jpg'
				)
			)
		).toEqual({
			provider: 'igdb',
			path: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1uii.jpg'
		});
		expect(parseSearchRequest(search('category=game&mode=search&query=sonic')).category).toBe(
			'game'
		);
		expect(
			parseImageRequest(image('provider=podcastindex&path=https%3A%2F%2Fcdn.example.com%2Fart.jpg'))
		).toEqual({
			provider: 'podcastindex',
			path: 'https://cdn.example.com/art.jpg'
		});
		expect(parseSearchRequest(search('category=podcast&mode=search&query=serial')).category).toBe(
			'podcast'
		);
		expect(() => parseImageRequest(image('provider=other&path=x'))).toThrow(RequestError);
	});
});
