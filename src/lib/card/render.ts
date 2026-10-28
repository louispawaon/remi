import { coverCrop } from './crop';
import { captionHeight, type CardLayout, type Rect } from './layout';
import { truncateText, wrapText } from './text';
import type { CardDocument, CardItem, FontChoice } from './types';

export type DrawableArtwork = HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas;

export interface DrawCardInput {
	document: CardDocument;
	layout: CardLayout;
	resolveArtwork: (id: string) => DrawableArtwork | undefined;
}

const FONT_STACKS: Record<FontChoice, string> = {
	sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
	serif: 'Georgia, "Times New Roman", serif',
	display: '"Avenir Next", "Trebuchet MS", system-ui, sans-serif'
};

export function drawCard(ctx: CanvasRenderingContext2D, input: DrawCardInput): void {
	const { document: doc, layout, resolveArtwork } = input;
	const measure = (text: string) => ctx.measureText(text).width;
	const font = FONT_STACKS[doc.appearance.font];

	ctx.save();
	ctx.fillStyle = doc.appearance.background;
	ctx.fillRect(0, 0, layout.width, layout.height);
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';

	if (doc.appearance.titleVisible && doc.title.trim() !== '') {
		ctx.fillStyle = doc.appearance.foreground;
		ctx.font = `600 ${layout.titleFontSize}px ${font}`;
		const title = truncateText(doc.title, layout.heading.width, measure);
		ctx.fillText(title, layout.heading.x, layout.heading.y + layout.heading.height / 2);
	}

	for (let index = 0; index < layout.cells.length; index++) {
		const rect = layout.cells[index];

		if (index === layout.freeCellIndex) {
			drawFreeSpace(ctx, rect, layout, doc, font);
			continue;
		}

		const itemId = doc.slots[index] ?? null;
		if (itemId === null) {
			drawBlank(ctx, rect, layout, doc.appearance.foreground);
			continue;
		}

		const item = doc.items.find((candidate) => candidate.id === itemId);
		if (!item) throw new Error(`Unknown item in slot: ${itemId}`);
		drawItem(ctx, rect, item, doc, layout, font, resolveArtwork, measure);
	}

	ctx.restore();
}

function drawItem(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	item: CardItem,
	doc: CardDocument,
	layout: CardLayout,
	font: string,
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
		const source = coverCrop(artwork.width, artwork.height, rect.width, rect.height, crop);
		ctx.drawImage(
			artwork,
			source.x,
			source.y,
			source.width,
			source.height,
			rect.x,
			rect.y,
			rect.width,
			rect.height
		);
	} else {
		drawTextTile(ctx, rect, title, doc.appearance.foreground, layout, font, measure);
	}

	if (doc.appearance.titleVisible && item.artwork) {
		drawCaption(ctx, rect, title, layout, font, measure);
	}

	ctx.restore();
}

function drawTextTile(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	title: string,
	color: string,
	layout: CardLayout,
	font: string,
	measure: (text: string) => number
) {
	const fontSize = layout.caption.fontSize * 1.2;
	const lineHeight = fontSize * 1.3;
	ctx.fillStyle = color;
	ctx.font = `600 ${fontSize}px ${font}`;
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
	font: string,
	measure: (text: string) => number
) {
	const height = captionHeight(layout);
	const top = rect.y + rect.height - height;

	ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
	ctx.fillRect(rect.x, top, rect.width, height);

	ctx.fillStyle = '#ffffff';
	ctx.font = `500 ${layout.caption.fontSize}px ${font}`;
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

function drawFreeSpace(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	layout: CardLayout,
	doc: CardDocument,
	font: string
) {
	ctx.save();
	ctx.globalAlpha = 0.06;
	ctx.fillStyle = doc.appearance.foreground;
	ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
	ctx.globalAlpha = 0.8;
	ctx.fillStyle = doc.appearance.foreground;
	ctx.font = `700 ${layout.caption.fontSize * 1.2}px ${font}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('FREE', rect.x + rect.width / 2, rect.y + rect.height / 2);
	ctx.restore();
}

function drawBlank(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	layout: CardLayout,
	foreground: string
) {
	ctx.save();
	ctx.globalAlpha = 0.14;
	ctx.strokeStyle = foreground;
	ctx.lineWidth = 2 * layout.resolution;
	ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
	ctx.restore();
}
