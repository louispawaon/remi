import { describe, expect, it } from 'vitest';
import { coverCrop } from './crop';

describe('coverCrop', () => {
	it('centres the window by default and clamps at both edges', () => {
		const centred = coverCrop(100, 200, 100, 100, { x: 0.5, y: 0.5 });
		expect(centred).toEqual({ x: 0, y: 50, width: 100, height: 100 });

		expect(coverCrop(100, 200, 100, 100, { x: 0, y: 0 }).y).toBe(0);
		expect(coverCrop(100, 200, 100, 100, { x: 1, y: 1 }).y).toBe(100);
	});

	it('moves horizontally for landscape images and vertically for portrait ones', () => {
		expect(coverCrop(200, 100, 100, 100, { x: 0, y: 0.5 }).x).toBe(0);
		expect(coverCrop(200, 100, 100, 100, { x: 1, y: 0.5 }).x).toBe(100);
		expect(coverCrop(200, 100, 100, 100, { x: 0.5, y: 0.5 }).x).toBe(50);
		expect(coverCrop(200, 100, 100, 100, { x: 0.5, y: 0.5 }).y).toBe(0);
	});

	it('keeps the crop window inside the image and preserves the target aspect', () => {
		for (const crop of [
			{ x: 0, y: 0 },
			{ x: 0.5, y: 0.5 },
			{ x: 1, y: 1 },
			{ x: -5, y: 12 }
		]) {
			const source = coverCrop(800, 450, 120, 200, crop);
			expect(source.x).toBeGreaterThanOrEqual(0);
			expect(source.y).toBeGreaterThanOrEqual(0);
			expect(source.x + source.width).toBeLessThanOrEqual(800);
			expect(source.y + source.height).toBeLessThanOrEqual(450);
			expect(source.width / source.height).toBeCloseTo(120 / 200, 6);
		}
	});

	it('rejects artwork without pixels', () => {
		expect(() => coverCrop(0, 100, 100, 100, { x: 0.5, y: 0.5 })).toThrow(/pixels/i);
	});
});
