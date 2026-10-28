import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyCardArtwork } from './verify';
import { createDefaultDocument } from './document';

afterEach(() => vi.unstubAllGlobals());

describe('imported artwork validation', () => {
	it('finds oversized JPEG dimensions after a large metadata segment before decoding', async () => {
		const bytes = new Uint8Array(65_560);
		bytes.set([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]);
		bytes.set([0xff, 0xc0, 0, 17, 8, 0x27, 0x10, 0x27, 0x10], 65_539);
		const decode = vi.fn(async () => ({ width: 10000, height: 10000, close() {} }));
		vi.stubGlobal('createImageBitmap', decode);
		await expect(
			verifyCardArtwork({
				document: createDefaultDocument('test', '2026-10-29'),
				artwork: { huge: new Blob([bytes], { type: 'image/jpeg' }) }
			})
		).rejects.toThrow(/pixel limit/);
		expect(decode).not.toHaveBeenCalled();
	});

	it('rejects oversized PNG headers before decoding', async () => {
		const bytes = new Uint8Array(24);
		bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
		const view = new DataView(bytes.buffer);
		view.setUint32(16, 10000);
		view.setUint32(20, 10000);
		const decode = vi.fn();
		vi.stubGlobal('createImageBitmap', decode);
		await expect(
			verifyCardArtwork({
				document: createDefaultDocument('test', '2026-10-29'),
				artwork: { huge: new Blob([bytes], { type: 'image/png' }) }
			})
		).rejects.toThrow(/pixel limit/);
		expect(decode).not.toHaveBeenCalled();
	});

	it('rejects unknown image headers before handing them to the decoder', async () => {
		const decode = vi.fn();
		vi.stubGlobal('createImageBitmap', decode);
		await expect(
			verifyCardArtwork({
				document: createDefaultDocument('test', '2026-10-29'),
				artwork: {
					disguised: new Blob([new Uint8Array([0x47, 0x49, 0x46, 0x38])], { type: 'image/png' })
				}
			})
		).rejects.toThrow(/PNG, JPEG, or WebP/);
		expect(decode).not.toHaveBeenCalled();
	});

	it('retains the decoded pixel check when dimensions disagree with the header', async () => {
		const bytes = new Uint8Array(24);
		bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
		const view = new DataView(bytes.buffer);
		view.setUint32(16, 1);
		view.setUint32(20, 1);
		const close = vi.fn();
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(async () => ({ width: 10000, height: 10000, close }))
		);
		await expect(
			verifyCardArtwork({
				document: createDefaultDocument('test', '2026-10-29'),
				artwork: { huge: new Blob([bytes], { type: 'image/png' }) }
			})
		).rejects.toThrow(/pixel limit/);
		expect(close).toHaveBeenCalledOnce();
	});
});
