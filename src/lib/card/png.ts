import { placedItemIds } from './document';
import { computeLayout, type CardLayout } from './layout';
import { drawCard } from './render';
import type { CardRecord, Resolution } from './types';

export type RenderStage = 'fonts' | 'artwork' | 'drawing' | 'encoding';

export interface RenderOptions {
	signal?: AbortSignal;
	onProgress?: (stage: RenderStage, completed?: number, total?: number) => void;
}

export interface RenderedCard {
	canvas: HTMLCanvasElement;
	layout: CardLayout;
}

/** Shared preview/export path: same layout, same drawing code, exact output pixels. */
export async function renderCard(
	record: CardRecord,
	resolution: Resolution = 1,
	options: RenderOptions = {}
): Promise<RenderedCard> {
	const document = record.document;
	const layout = computeLayout({
		gridSize: document.gridSize,
		format: document.format,
		freeSpace: document.freeSpace,
		resolution
	});

	options.onProgress?.('fonts');
	await globalThis.document.fonts?.ready;
	abortIfNeeded(options.signal);

	const canvas = globalThis.document.createElement('canvas');
	canvas.width = layout.width;
	canvas.height = layout.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas 2D is unavailable');

	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = 'high';

	const placedItems = new Set(placedItemIds(document));
	const requiredArtwork = Array.from(
		new Set(
			document.items
				.filter((item) => placedItems.has(item.id) && item.artwork)
				.map((item) => item.artwork!.id)
		)
	);

	const bitmaps = new Map<string, ImageBitmap>();
	try {
		options.onProgress?.('artwork', 0, requiredArtwork.length);
		for (const [index, id] of requiredArtwork.entries()) {
			abortIfNeeded(options.signal);
			const blob = record.artwork[id];
			if (blob) bitmaps.set(id, await createImageBitmap(blob));
			options.onProgress?.('artwork', index + 1, requiredArtwork.length);
		}

		abortIfNeeded(options.signal);
		options.onProgress?.('drawing');
		drawCard(context, { document, layout, resolveArtwork: (id) => bitmaps.get(id) });
	} finally {
		for (const bitmap of bitmaps.values()) bitmap.close();
	}

	return { canvas, layout };
}

export async function renderCardPng(
	record: CardRecord,
	resolution: Resolution = 1,
	options: RenderOptions = {}
): Promise<RenderedCard & { blob: Blob }> {
	const rendered = await renderCard(record, resolution, options);
	abortIfNeeded(options.signal);
	options.onProgress?.('encoding');
	const blob = await canvasToPng(rendered.canvas);
	abortIfNeeded(options.signal);
	return { ...rendered, blob };
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))),
			'image/png'
		);
	});
}

function abortIfNeeded(signal?: AbortSignal) {
	if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
}
