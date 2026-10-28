import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtworkError, normalizeArtwork, validateArtworkSource } from './artwork';
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

describe('pre-decode pixel guard', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('rejects disguised unsupported images before decoding', async () => {
		const decode = vi.fn();
		vi.stubGlobal('createImageBitmap', decode);
		await expect(
			normalizeArtwork(new Blob([new Uint8Array([0x47, 0x49, 0x46, 0x38])], { type: 'image/png' }))
		).rejects.toMatchObject({ code: 'decode_failed' });
		expect(decode).not.toHaveBeenCalled();
	});

	it('rejects oversized JPEGs with dimensions after a large metadata segment before decoding', async () => {
		const bytes = new Uint8Array(65_560);
		bytes.set([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]);
		bytes.set([0xff, 0xc0, 0, 17, 8, 0x27, 0x10, 0x27, 0x10], 65_539);
		const decode = vi.fn(async () => ({ width: 10000, height: 10000, close() {} }));
		vi.stubGlobal('createImageBitmap', decode);
		await expect(normalizeArtwork(new Blob([bytes], { type: 'image/jpeg' }))).rejects.toMatchObject(
			{ code: 'too_many_pixels' }
		);
		expect(decode).not.toHaveBeenCalled();
	});

	it('rejects a 30MP PNG before createImageBitmap runs', async () => {
		const bytes = new Uint8Array(24);
		bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const view = new DataView(bytes.buffer);
		view.setUint32(16, 6000);
		view.setUint32(20, 5000);

		const decode = vi.fn();
		vi.stubGlobal('createImageBitmap', decode);
		const blob = new Blob([bytes], { type: 'image/png' });

		await expect(normalizeArtwork(blob)).rejects.toMatchObject({ code: 'too_many_pixels' });
		expect(decode).not.toHaveBeenCalled();
	});
});
