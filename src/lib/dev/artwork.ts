import { FIXTURE_ARTWORK } from '#lib/card/fixture';
import type { CardRecord, CardDocument } from '#lib/card/types';

const PALETTE = ['#b8452f', '#2f6bb8', '#3f8f5a', '#8f6b2f', '#7a3f8f', '#2f8f8a'];

/** Deterministic browser-only artwork so render and archive checks are repeatable. */
export async function createFixtureArtwork(): Promise<Record<string, Blob>> {
	const artwork: Record<string, Blob> = {};

	for (const [index, ref] of FIXTURE_ARTWORK.entries()) {
		artwork[ref.id] = await drawArtwork(
			ref.width,
			ref.height,
			PALETTE[index % PALETTE.length],
			ref.id === 'art-jp',
			ref.type
		);
	}

	return artwork;
}

export function recordFor(document: CardDocument, artwork: Record<string, Blob>): CardRecord {
	return { document, artwork };
}

async function drawArtwork(
	width: number,
	height: number,
	color: string,
	transparentBand: boolean,
	type: (typeof FIXTURE_ARTWORK)[number]['type']
): Promise<Blob> {
	const canvas = globalThis.document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas 2D is unavailable');

	const gradient = context.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, color);
	gradient.addColorStop(1, '#12100e');
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);

	context.fillStyle = 'rgba(255, 255, 255, 0.22)';
	for (let y = 0; y < height; y += height / 8) {
		context.fillRect(0, y, width, height / 32);
	}

	if (transparentBand) {
		context.clearRect(width * 0.25, height * 0.35, width * 0.5, height * 0.3);
	}

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error(`Could not encode ${type} fixture`))),
			type,
			0.9
		);
	});
}
