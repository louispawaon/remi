import { coverCrop } from './crop';
import { slotNumbers } from './document';
import { captionHeight, LAYOUT_METRICS, type CardLayout, type Rect } from './layout';
import type { LegendPlan } from './legend';
import { wrapText } from './text';
import type { CardDocument, CardItem, FontChoice } from './types';

export type DrawableArtwork = HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas;

export interface DrawCardInput {
	document: CardDocument;
	layout: CardLayout;
	resolveArtwork: (id: string) => DrawableArtwork | undefined;
	/** Library thumbnails skip the footer line; it is unreadable at their size. */
	footer?: boolean;
	/** Planned numbered index; omitted when the card uses cell captions or no titles. */
	legend?: LegendPlan | null;
}

/** Printed on every exported sheet. */
export const CARD_FOOTER = 'REMI.PROJECT1OF1.COM';

const FONTS: Record<FontChoice, { stack: string; weight: number }> = {
	sans: { stack: '"Archivo", system-ui, sans-serif', weight: 700 },
	serif: { stack: 'Georgia, "Times New Roman", serif', weight: 600 },
	display: { stack: '"Archivo Expanded", "Archivo", system-ui, sans-serif', weight: 800 }
};

/** Shared with the legend planner so index measurements use the card face. */
export function cardFont(choice: FontChoice): { stack: string; weight: number } {
	return FONTS[choice];
}

/** The exported card keeps one fixed caption ink, whatever the card colours are. */
const CAPTION_INK = '#f6ebc0';

export function drawCard(ctx: CanvasRenderingContext2D, input: DrawCardInput): void {
	const { document: doc, layout, resolveArtwork } = input;
	const measure = (text: string) => ctx.measureText(text).width;
	const font = FONTS[doc.appearance.font];
	const numbers = slotNumbers(doc);

	ctx.save();
	if (doc.appearance.background === 'transparent') {
		ctx.clearRect(0, 0, layout.width, layout.height);
	} else {
		ctx.fillStyle = doc.appearance.background;
		ctx.fillRect(0, 0, layout.width, layout.height);
	}
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';

	if (doc.appearance.titles !== 'off' && doc.title.trim() !== '') {
		ctx.fillStyle = doc.appearance.foreground;
		ctx.font = `${font.weight} ${layout.titleFontSize}px ${font.stack}`;
		const lines = wrapText(doc.title.toLocaleUpperCase(), layout.heading.width, measure, 2);
		const lineHeight = layout.titleFontSize * 0.92;
		const centre = layout.heading.y + layout.heading.height / 2;
		lines.forEach((line, index) => {
			ctx.fillText(line, layout.heading.x, centre + (index - (lines.length - 1) / 2) * lineHeight);
		});
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
		drawItem(ctx, rect, item, numbers[index], doc, layout, font, resolveArtwork, measure);
	}

	if (input.legend) {
		drawLegend(ctx, layout, input.legend, doc, font);
	}

	if (input.footer !== false) {
		drawFooter(ctx, layout, doc.appearance.foreground);
	}

	ctx.restore();
}

function drawItem(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	item: CardItem,
	number: number | null,
	doc: CardDocument,
	layout: CardLayout,
	font: { stack: string; weight: number },
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

	if (doc.appearance.titles === 'cells' && item.artwork) {
		drawCaption(ctx, rect, title, layout, font, measure);
	} else if (doc.appearance.titles === 'index' && number !== null) {
		drawIndexNumber(ctx, rect, number, layout, font, measure);
	}

	ctx.restore();
}

/** A plate number stamped inside the artwork, matching the caption treatment. */
function drawIndexNumber(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	number: number,
	layout: CardLayout,
	font: { stack: string; weight: number },
	measure: (text: string) => number
) {
	const label = String(number).padStart(2, '0');
	const fontSize = Math.max(
		10 * layout.resolution,
		Math.min(layout.caption.fontSize * 0.85, rect.width * 0.22)
	);
	const padding = fontSize * 0.36;

	ctx.font = `700 ${fontSize}px ${font.stack}`;
	const width = measure(label) + padding * 2;
	const height = fontSize + padding * 2;
	const x = rect.x + rect.width - layout.caption.padding - width;
	const y = rect.y + layout.caption.padding;

	ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
	ctx.fillRect(x, y, width, height);
	ctx.fillStyle = CAPTION_INK;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, x + padding, y + height / 2);
}

function drawTextTile(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	title: string,
	color: string,
	layout: CardLayout,
	font: { stack: string; weight: number },
	measure: (text: string) => number
) {
	const fontSize = layout.caption.fontSize * 1.2;
	const lineHeight = fontSize * 1.3;
	ctx.fillStyle = color;
	ctx.font = `${font.weight} ${fontSize}px ${font.stack}`;
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
	font: { stack: string; weight: number },
	measure: (text: string) => number
) {
	const height = captionHeight(layout);
	const top = rect.y + rect.height - height;

	ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
	ctx.fillRect(rect.x, top, rect.width, height);

	ctx.fillStyle = CAPTION_INK;
	ctx.font = `${font.weight === 800 ? 700 : 600} ${layout.caption.fontSize}px ${font.stack}`;
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
	font: { stack: string; weight: number }
) {
	const unit = Math.max(1, layout.caption.fontSize * 0.08);
	ctx.save();
	ctx.strokeStyle = doc.appearance.foreground;
	ctx.globalAlpha = 0.28;
	ctx.lineWidth = unit * 1.4;
	ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
	ctx.globalAlpha = 0.7;
	ctx.fillStyle = doc.appearance.foreground;
	ctx.font = `${font.weight} ${layout.caption.fontSize * 0.95}px ${font.stack}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('FREE', rect.x + rect.width / 2, rect.y + rect.height / 2);
	ctx.restore();
}

/** The index list: plate numbers in the card ink, titles in full, above the credit. */
function drawLegend(
	ctx: CanvasRenderingContext2D,
	layout: CardLayout,
	plan: LegendPlan,
	doc: CardDocument,
	font: { stack: string; weight: number }
): void {
	const scale = layout.resolution;
	const x0 = layout.legend.x;
	const y0 = layout.legend.y;

	ctx.save();
	ctx.fillStyle = doc.appearance.foreground;
	ctx.globalAlpha = 0.22;
	ctx.fillRect(x0, y0, layout.legend.width, scale);

	ctx.font = `${font.weight === 800 ? 700 : 600} ${plan.fontSize * scale}px ${font.stack}`;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';

	for (const column of plan.columns) {
		const x = x0 + column.x * scale;
		const titleX = x + (plan.numberWidth + plan.numberGap) * scale;
		for (const entry of column.entries) {
			const top = y0 + entry.y * scale;
			ctx.globalAlpha = 0.55;
			ctx.fillText(entry.number, x, top + (plan.lineHeight * scale) / 2);
			ctx.globalAlpha = 0.92;
			entry.lines.forEach((line, index) => {
				ctx.fillText(line, titleX, top + (index + 0.5) * plan.lineHeight * scale);
			});
		}
	}
	ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, layout: CardLayout, color: string): void {
	const size = Math.round(layout.caption.fontSize * 0.8);
	// With an index, the credit sits in its own band below the list.
	const y =
		layout.legend.height > 0
			? layout.legend.y +
				layout.legend.height +
				(LAYOUT_METRICS.footerReserve * layout.resolution) / 2
			: // Sit the credit right under the grid so tall formats do not push it to the edge.
				layout.grid.y + layout.grid.height + LAYOUT_METRICS.gap * layout.resolution + size / 2;

	ctx.save();
	ctx.globalAlpha = 0.55;
	ctx.fillStyle = color;
	ctx.font = `600 ${size}px ${FONTS.sans.stack}`;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillText(CARD_FOOTER, layout.footer.x, y);
	ctx.restore();
}

function drawBlank(
	ctx: CanvasRenderingContext2D,
	rect: Rect,
	layout: CardLayout,
	foreground: string
) {
	ctx.save();
	ctx.globalAlpha = 0.2;
	ctx.strokeStyle = foreground;
	ctx.lineWidth = 1.5 * layout.resolution;
	ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
	ctx.restore();
}
