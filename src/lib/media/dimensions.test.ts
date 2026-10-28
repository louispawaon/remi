import { describe, expect, it } from 'vitest';
import { sniffDimensions } from './dimensions';

function png(width: number, height: number) {
	const bytes = new Uint8Array(24);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const view = new DataView(bytes.buffer);
	view.setUint32(16, width);
	view.setUint32(20, height);
	return bytes;
}

describe('sniffDimensions', () => {
	it('reads PNG headers', () => {
		expect(sniffDimensions(png(6000, 5000))).toEqual({ width: 6000, height: 5000 });
	});

	it('reads JPEG start-of-frame headers', () => {
		const bytes = new Uint8Array(20);
		bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x0b, 0xb8, 0x0f, 0xa0]);
		expect(sniffDimensions(bytes)).toEqual({ width: 4000, height: 3000 });
	});

	it('reads WebP VP8X headers', () => {
		const bytes = new Uint8Array(30);
		bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
		bytes.set([0x56, 0x50, 0x38, 0x58], 12);
		const width = 1599;
		const height = 899;
		bytes[24] = width & 0xff;
		bytes[25] = (width >> 8) & 0xff;
		bytes[26] = (width >> 16) & 0xff;
		bytes[27] = height & 0xff;
		bytes[28] = (height >> 8) & 0xff;
		bytes[29] = (height >> 16) & 0xff;
		expect(sniffDimensions(bytes)).toEqual({ width: 1600, height: 900 });
	});

	it('returns null for unknown or truncated data', () => {
		expect(sniffDimensions(new Uint8Array([1, 2, 3]))).toBeNull();
		expect(sniffDimensions(new Uint8Array(10))).toBeNull();
	});
});
