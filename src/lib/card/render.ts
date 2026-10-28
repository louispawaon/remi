import { captionHeight, type CardLayout, type Rect } from './layout';
import { truncateText, wrapText } from './text';
import type { CardDocument, CardItem } from './types';

export type DrawableArtwork = HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas;

export interface DrawCardInput {
	document: CardDocument;
	layout: CardLayout;
	resolveArtwork: (id: string) => DrawableArtwork | undefined;
}

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function drawCard(ctx: CanvasRenderingContext2D, input: DrawCardInput): void {
	const { document: doc, layout, resolveArtwork } = input;
	const measure = (text: string) => ctx.measureText(text).width;

	ctx.save();
	ctx.fillStyle = doc.appearance.background;
	ctx.fillRect(0, 0, layout.width, layout.height);
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';

	if (doc.appearance.titleVisible && doc.title.trim() !== '') {
		ctx.fillStyle = doc.appearance.foreground;
		ctx.font = `600 ${layout.titleFontSize}px ${FONT_STACK}`;
		const title = truncateText(doc.title, layout.heading.width, measure);
		ctx.fillText(title, layout.heading.x, layout.heading.y + layout.heading.height / 2);
	}

	for (let index = 0; index < layout.cells.length; index++) {
		const rect = layout.cells[index];

		if (index === layout.freeCellIndex) {
			drawFreeSpace(ctx, rect, layout);
			continue;
		}

		const itemId = doc.slots[index] ?? null;
		if (itemId === null) {
			drawBlank(ctx, rect, layout);
			continue;
		}

		const item = doc.items.find((candidate) => candidate.id === itemId);
		if (!item) throw new Error(`Unknown item in slot: ${itemId}`);
		drawItem(ctx, rect, item, doc, layout, resolveArtwork, measure);
	}

	ctx.restore();
}

function drawItem(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	item: CardItem,
	doc: CardDocument,
	layout: CardLayout,
	resolveArtwork: DrawCardInput['resolveArtwork'],
	measure: (text: string) => number
) {
	const title = item.titleOverride ?? item.titles.preferred;

	ctx.save();
	ctx.beginPath();
	ctx.rect(rect.x, rect.y, rect.width, rect.height);
	ctx.clip();
	ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
	ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

	if (item.artwork) {
		const artwork = resolveArtwork(item.artwork.id);
		if (!artwork) throw new Error(`Missing artwork: ${item.artwork.id}`);
		const crop = item.crops[layout.format] ?? { x: 0.5, y: 0.5 };
		drawCover(ctx, artwork, rect, crop);
	} else {
		drawTextTile(ctx, rect, title, doc.appearance.foreground, layout, measure);
	}

	if (doc.appearance.titleVisible && item.artwork) {
		drawCaption(ctx, rect, title, layout, measure);
	}

	ctx.restore();
}

function drawCover(
	ctx: CanvasRenderingContext2D,
	artwork: DrawableArtwork,
	rect: Rect,
	crop: { x: number; y: number }
) {
	const width = artwork.width;
	const height = artwork.height;
	if (width <= 0 || height <= 0) throw new Error('Artwork has no pixels');

	const scale = Math.max(rect.width / width, rect.height / height);
	const sourceWidth = rect.width / scale;
	const sourceHeight = rect.height / scale;
	const maxX = width - sourceWidth;
	const maxY = height - sourceHeight;
	const sourceX = Math.min(Math.max(maxX * crop.x, 0), maxX);
	const sourceY = Math.min(Math.max(maxY * crop.y, 0), maxY);

	ctx.drawImage(
		artwork,
		sourceX,
		sourceY,
		sourceWidth,
		sourceHeight,
		rect.x,
		rect.y,
		rect.width,
		rect.height
	);
}

function drawTextTile(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	title: string,
	color: string,
	layout: CardLayout,
	measure: (text: string) => number
) {
	const fontSize = layout.caption.fontSize * 1.2;
	const lineHeight = fontSize * 1.3;
	ctx.fillStyle = color;
	ctx.font = `600 ${fontSize}px ${FONT_STACK}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	const lines = wrapText(title, rect.width - layout.caption.padding * 2, measure, 3);
	const centre = rect.y + rect.height / 2;
	lines.forEach((line, index) => {
		ctx.fillText(
			line,
			rect.x + rect.width / 2,
			centre + (index - (lines.length - 1) / 2) * lineHeight
		);
	});
	ctx.textAlign = 'left';
}

function drawCaption(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	title: string,
	layout: CardLayout,
	measure: (text: string) => number
) {
	const height = captionHeight(layout);
	const top = rect.y + rect.height - height;

	ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
	ctx.fillRect(rect.x, top, rect.width, height);

	ctx.fillStyle = '#ffffff';
	ctx.font = `500 ${layout.caption.fontSize}px ${FONT_STACK}`;
	ctx.textBaseline = 'middle';

	const lines = wrapText(
		title,
		rect.width - layout.caption.padding * 2,
		measure,
		layout.caption.maxLines
	);
	lines.forEach((line, index) => {
		ctx.fillText(
			line,
			rect.x + layout.caption.padding,
			top + layout.caption.padding + layout.caption.lineHeight * (index + 0.5)
		);
	});
}

function drawFreeSpace(ctx: CanvasRenderingContext2D, rect: Rect, layout: CardLayout) {
	ctx.save();
	ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
	ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
	ctx.globalAlpha = 0.8;
	ctx.fillStyle = '#ffffff';
	ctx.font = `700 ${layout.caption.fontSize * 1.2}px ${FONT_STACK}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('FREE', rect.x + rect.width / 2, rect.y + rect.height / 2);
	ctx.restore();
}

function drawBlank(ctx: CanvasRenderingContext2D, rect: Rect, layout: CardLayout) {
	ctx.save();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
	ctx.lineWidth = 2 * layout.resolution;
	ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
	ctx.restore();
}
