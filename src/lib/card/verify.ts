import { imageFormat, sniffDimensions } from '#lib/media/dimensions';
import type { CardRecord } from './types';

/** Uploads accept 24 megapixels; imported artwork must decode within the same bound. */
export const MAX_DECODED_PIXELS = 24_000_000;

/** Decode every stored artwork once so corrupt or hostile files fail before a card is saved. */
export async function verifyCardArtwork(record: CardRecord): Promise<void> {
	for (const [id, blob] of Object.entries(record.artwork)) {
		let header = new Uint8Array(await blob.slice(0, 65_536).arrayBuffer());
		const format = imageFormat(header);
		if (!format) throw new Error(`Artwork ${id} is not a readable PNG, JPEG, or WebP image`);
		if (format === 'jpeg') header = new Uint8Array(await blob.arrayBuffer());

		const dimensions = sniffDimensions(header);
		if (dimensions && dimensions.width * dimensions.height > MAX_DECODED_PIXELS) {
			throw new Error(`Artwork ${id} exceeds the ${MAX_DECODED_PIXELS} pixel limit`);
		}
		let bitmap: ImageBitmap;
		try {
			bitmap = await createImageBitmap(blob);
		} catch {
			throw new Error(`Artwork ${id} could not be decoded`);
		}

		try {
			const pixels = bitmap.width * bitmap.height;
			if (pixels > MAX_DECODED_PIXELS) {
				throw new Error(
					`Artwork ${id} decodes to ${pixels} pixels, above the ${MAX_DECODED_PIXELS} pixel limit`
				);
			}
		} finally {
			bitmap.close();
		}
	}
}
