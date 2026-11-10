import { centreCellIndex } from './document';
import type { Format, GridDimension, Resolution } from './types';

export const FORMAT_SIZES: Record<Format, readonly [number, number]> = {
	'4:5': [1080, 1350],
	'3:4': [1080, 1440],
	'9:16': [1080, 1920],
	'1:1': [1080, 1080]
};

export const LAYOUT_METRICS = {
	margin: 48,
	gap: 12,
	headingReserve: 112,
	footerReserve: 32,
	storyTopReserve: 160,
	storyBottomReserve: 240,
	minCellRatio: 0.72,
	maxCellRatio: 1.15,
	titleFontSize: 56,
	captionFontSize: 24,
	captionLineHeight: 30,
	captionPadding: 10,
	captionMaxLines: 2
} as const;

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface CardLayout {
	width: number;
	height: number;
	format: Format;
	gridColumns: GridDimension;
	gridRows: GridDimension;
	resolution: Resolution;
	heading: Rect;
	footer: Rect;
	/** Empty when the card has no numbered index. */
	legend: Rect;
	grid: Rect;
	/** Row-major cell rectangles; a cell may be blank or free space. */
	cells: Rect[];
	freeCellIndex: number | null;
	titleFontSize: number;
	caption: {
		fontSize: number;
		lineHeight: number;
		padding: number;
		maxLines: number;
	};
}

export interface LayoutInput {
	gridColumns: GridDimension;
	gridRows: GridDimension;
	format: Format;
	freeSpace: boolean;
	resolution: Resolution;
	/** No title band: the grid takes the heading reserve. */
	headless?: boolean;
	/** Space reserved for a numbered index above the footer, in standard units. */
	legendHeight?: number;
}

export function captionHeight(layout: CardLayout): number {
	return layout.caption.lineHeight * layout.caption.maxLines + layout.caption.padding * 2;
}

export function computeLayout(input: LayoutInput): CardLayout {
	const { margin, gap } = LAYOUT_METRICS;
	const [standardWidth, standardHeight] = FORMAT_SIZES[input.format];
	const topInset =
		input.format === '9:16'
			? LAYOUT_METRICS.storyTopReserve
			: input.headless
				? margin
				: margin + LAYOUT_METRICS.headingReserve;
	const bottomInset =
		input.format === '9:16'
			? LAYOUT_METRICS.storyBottomReserve
			: margin + LAYOUT_METRICS.footerReserve;
	const legendHeight = Math.max(0, input.legendHeight ?? 0);
	const legendBottom =
		standardHeight -
		(input.format === '9:16' ? LAYOUT_METRICS.storyBottomReserve : margin) -
		LAYOUT_METRICS.footerReserve;
	const legend: Rect = {
		x: margin,
		y: legendBottom - legendHeight,
		width: standardWidth - margin * 2,
		height: legendHeight
	};

	const availableWidth = standardWidth - margin * 2;
	const availableHeight = Math.max(
		0,
		legendHeight > 0
			? legend.y - LAYOUT_METRICS.gap - topInset
			: standardHeight - topInset - bottomInset
	);

	let cellWidth = (availableWidth - (input.gridColumns - 1) * gap) / input.gridColumns;
	let cellHeight = (availableHeight - (input.gridRows - 1) * gap) / input.gridRows;
	const ratio = cellWidth / cellHeight;
	if (ratio < LAYOUT_METRICS.minCellRatio) {
		cellHeight = cellWidth / LAYOUT_METRICS.minCellRatio;
	} else if (ratio > LAYOUT_METRICS.maxCellRatio) {
		cellWidth = cellHeight * LAYOUT_METRICS.maxCellRatio;
	}

	const gridWidth = input.gridColumns * cellWidth + (input.gridColumns - 1) * gap;
	const gridHeight = input.gridRows * cellHeight + (input.gridRows - 1) * gap;
	const grid: Rect = {
		x: (standardWidth - gridWidth) / 2,
		y: topInset + (availableHeight - gridHeight) / 2,
		width: gridWidth,
		height: gridHeight
	};

	const cells: Rect[] = [];
	for (let row = 0; row < input.gridRows; row++) {
		for (let column = 0; column < input.gridColumns; column++) {
			cells.push({
				x: grid.x + column * (cellWidth + gap),
				y: grid.y + row * (cellHeight + gap),
				width: cellWidth,
				height: cellHeight
			});
		}
	}

	const layout: CardLayout = {
		width: standardWidth,
		height: standardHeight,
		format: input.format,
		gridColumns: input.gridColumns,
		gridRows: input.gridRows,
		resolution: input.resolution,
		heading: {
			x: margin,
			y: margin,
			width: standardWidth - margin * 2,
			height: input.headless ? 0 : LAYOUT_METRICS.headingReserve
		},
		footer: {
			x: margin,
			y: standardHeight - bottomInset,
			width: standardWidth - margin * 2,
			height: bottomInset - margin
		},
		legend,
		grid,
		cells,
		freeCellIndex: input.freeSpace ? centreCellIndex(input.gridColumns, input.gridRows) : null,
		titleFontSize: LAYOUT_METRICS.titleFontSize,
		caption: {
			fontSize: LAYOUT_METRICS.captionFontSize,
			lineHeight: LAYOUT_METRICS.captionLineHeight,
			padding: LAYOUT_METRICS.captionPadding,
			maxLines: LAYOUT_METRICS.captionMaxLines
		}
	};

	return scaleLayout(layout, input.resolution);
}

/** 2x output doubles every measurement without changing the composition. */
function scaleLayout(layout: CardLayout, factor: number): CardLayout {
	if (factor === 1) return layout;
	const scale = (rect: Rect): Rect => ({
		x: rect.x * factor,
		y: rect.y * factor,
		width: rect.width * factor,
		height: rect.height * factor
	});
	return {
		...layout,
		width: layout.width * factor,
		height: layout.height * factor,
		heading: scale(layout.heading),
		footer: scale(layout.footer),
		legend: scale(layout.legend),
		grid: scale(layout.grid),
		cells: layout.cells.map(scale),
		titleFontSize: layout.titleFontSize * factor,
		caption: {
			fontSize: layout.caption.fontSize * factor,
			lineHeight: layout.caption.lineHeight * factor,
			padding: layout.caption.padding * factor,
			maxLines: layout.caption.maxLines
		}
	};
}
