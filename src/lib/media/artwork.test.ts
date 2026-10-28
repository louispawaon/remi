import { describe, expect, it } from 'vitest';
import { ArtworkError, validateArtworkSource } from './artwork';
import { imageUrl } from './client';

describe('upload validation', () => {
	it('accepts supported raster types within limits', () => {
		expect(() => validateArtworkSource({ type: 'image/png', size: 1024 })).not.toThrow();
		expect(() => validateArtworkSource({ type: 'image/jpeg', size: 1024 })).not.toThrow();
		expect(() => validateArtworkSource({ type: 'image/webp', size: 1024 })).not.toThrow();
	});

	it('rejects unsupported, oversized, and empty files', () => {
		expect(() => validateArtworkSource({ type: 'image/svg+xml', size: 100 })).toThrow(ArtworkError);
		expect(() => validateArtworkSource({ type: 'image/gif', size: 100 })).toThrow(
			/PNG, JPEG, or WebP/
		);
		expect(() => validateArtworkSource({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toThrow(
			/10 MiB/
		);
		expect(() => validateArtworkSource({ type: 'image/png', size: 0 })).toThrow(/empty/);
	});

	it('builds encoded image proxy urls', () => {
		const url = imageUrl('anilist', 'https://s4.anilist.co/file/anilistcdn/media/x y.jpg');
		expect(url).toContain('provider=anilist');
		expect(url).toContain('x+y.jpg');
	});
});
