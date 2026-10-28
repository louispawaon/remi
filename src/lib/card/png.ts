import { computeLayout, type CardLayout } from './layout';
import { drawCard } from './render';
import type { CardRecord, Resolution } from './types';

export interface RenderedCard {
	canvas: HTMLCanvasElement;
	layout: CardLayout;
}

/** Shared preview/export path: same layout, same drawing code, exact output pixels. */
export async function renderCard(
	record: CardRecord,
	resolution: Resolution = 1
): Promise<RenderedCard> {
	const document = record.document;
	const layout = computeLayout({
		gridSize: document.gridSize,
		format: document.format,
		freeSpace: document.freeSpace,
		resolution
	});

	await globalThis.document.fonts?.ready;

	const canvas = globalThis.document.createElement('canvas');
	canvas.width = layout.width;
	canvas.height = layout.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas 2D is unavailable');

	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = 'high';

	const bitmaps = new Map<string, ImageBitmap>();
	try {
		for (const [id, blob] of Object.entries(record.artwork)) {
			bitmaps.set(id, await createImageBitmap(blob));
		}
		drawCard(context, { document, layout, resolveArtwork: (id) => bitmaps.get(id) });
	} finally {
		for (const bitmap of bitmaps.values()) bitmap.close();
	}

	return { canvas, layout };
}

export async function renderCardPng(
	record: CardRecord,
	resolution: Resolution = 1
): Promise<RenderedCard & { blob: Blob }> {
	const rendered = await renderCard(record, resolution);
	return { ...rendered, blob: await canvasToPng(rendered.canvas) };
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))),
			'image/png'
		);
	});
}
