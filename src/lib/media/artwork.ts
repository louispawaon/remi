import { imageUrl } from './client';
import { imageFormat, sniffDimensions } from './dimensions';
import type { MediaProvider } from './types';

export const UPLOAD_LIMITS = {
	maxBytes: 10 * 1024 * 1024,
	maxPixels: 24_000_000,
	maxStoredBytes: 8 * 1024 * 1024,
	maxEdge: 1600
} as const;

export const ALLOWED_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type ArtworkErrorCode =
	'unsupported_type' | 'too_large' | 'too_many_pixels' | 'decode_failed' | 'stored_too_large';

export class ArtworkError extends Error {
	constructor(
		message: string,
		readonly code: ArtworkErrorCode
	) {
		super(message);
		this.name = 'ArtworkError';
	}
}

export interface NormalizedArtwork {
	blob: Blob;
	width: number;
	height: number;
	type: 'image/png' | 'image/jpeg' | 'image/webp';
}

/** Cheap checks before any bytes are decoded. */
export function validateArtworkSource(source: { type: string; size: number }): void {
	if (!ALLOWED_UPLOAD_TYPES.includes(source.type as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
		throw new ArtworkError('Use a PNG, JPEG, or WebP image.', 'unsupported_type');
	}
	if (source.size > UPLOAD_LIMITS.maxBytes) {
		throw new ArtworkError('That image is larger than 10 MiB.', 'too_large');
	}
	if (source.size === 0) {
		throw new ArtworkError('That file is empty.', 'decode_failed');
	}
}

/** Normalize to the stored contract: max 1600 px long edge, max 8 MiB, transparency kept. */
export async function normalizeArtwork(
	blob: Blob,
	declaredType?: string
): Promise<NormalizedArtwork> {
	const type = declaredType ?? blob.type;
	validateArtworkSource({ type, size: blob.size });

	let header = new Uint8Array(await blob.slice(0, 65_536).arrayBuffer());
	const format = imageFormat(header);
	if (!format) {
		throw new ArtworkError(
			'That file is not a readable PNG, JPEG, or WebP image.',
			'decode_failed'
		);
	}
	// JPEG start-of-frame markers can sit beyond the first 64 KiB of metadata.
	if (format === 'jpeg') header = new Uint8Array(await blob.arrayBuffer());

	const sniffed = sniffDimensions(header);
	if (sniffed && sniffed.width * sniffed.height > UPLOAD_LIMITS.maxPixels) {
		throw new ArtworkError('That image has more than 24 megapixels.', 'too_many_pixels');
	}

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
	} catch {
		throw new ArtworkError('That file could not be read as an image.', 'decode_failed');
	}

	try {
		const pixels = bitmap.width * bitmap.height;
		if (pixels > UPLOAD_LIMITS.maxPixels) {
			throw new ArtworkError('That image has more than 24 megapixels.', 'too_many_pixels');
		}

		const scale = Math.min(1, UPLOAD_LIMITS.maxEdge / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d');
		if (!context) throw new ArtworkError('Canvas 2D is unavailable.', 'decode_failed');
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';
		context.drawImage(bitmap, 0, 0, width, height);

		const output = await encode(canvas, type);
		if (output.blob.size > UPLOAD_LIMITS.maxStoredBytes) {
			throw new ArtworkError('The stored image would exceed 8 MiB.', 'stored_too_large');
		}

		return { ...output, width, height };
	} finally {
		bitmap.close();
	}
}

async function encode(
	canvas: HTMLCanvasElement,
	sourceType: string
): Promise<{ blob: Blob; type: NormalizedArtwork['type'] }> {
	const preferred: NormalizedArtwork['type'] =
		sourceType === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
	const encoded = await toBlob(canvas, preferred, preferred === 'image/jpeg' ? 0.9 : 0.92);
	if (encoded) {
		const actual = encoded.type as NormalizedArtwork['type'];
		return {
			blob: encoded,
			type: ALLOWED_UPLOAD_TYPES.includes(actual) ? actual : preferred
		};
	}

	const fallback: NormalizedArtwork['type'] =
		sourceType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
	const png = await toBlob(canvas, fallback, undefined);
	if (!png) throw new ArtworkError('The image could not be encoded.', 'decode_failed');
	return { blob: png, type: fallback };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Provider artwork is fetched through the restricted proxy, then normalized like an upload. */
export async function fetchProviderArtwork(
	provider: MediaProvider,
	path: string,
	signal?: AbortSignal,
	fetcher: typeof fetch = globalThis.fetch
): Promise<NormalizedArtwork> {
	const response = await fetcher(imageUrl(provider, path), { signal });
	if (!response.ok) {
		let message = 'That artwork could not be retrieved.';
		try {
			const body = (await response.json()) as { message?: string };
			if (body.message) message = body.message;
		} catch {
			// keep the generic message
		}
		throw new ArtworkError(message, response.status === 413 ? 'too_large' : 'decode_failed');
	}

	const blob = await response.blob();
	return normalizeArtwork(blob, blob.type);
}
