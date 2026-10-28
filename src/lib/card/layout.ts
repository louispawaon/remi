import type { Format, GridSize, Resolution } from './types';

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
	gridSize: GridSize;
	resolution: Resolution;
	heading: Rect;
	footer: Rect;
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
	gridSize: GridSize;
	format: Format;
	freeSpace: boolean;
	resolution: Resolution;
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
			: margin + LAYOUT_METRICS.headingReserve;
	const bottomInset =
		input.format === '9:16'
			? LAYOUT_METRICS.storyBottomReserve
			: margin + LAYOUT_METRICS.footerReserve;

	const availableWidth = standardWidth - margin * 2;
	const availableHeight = standardHeight - topInset - bottomInset;

	let cellWidth = (availableWidth - (input.gridSize - 1) * gap) / input.gridSize;
	let cellHeight = (availableHeight - (input.gridSize - 1) * gap) / input.gridSize;
	const ratio = cellWidth / cellHeight;
	if (ratio < LAYOUT_METRICS.minCellRatio) {
		cellHeight = cellWidth / LAYOUT_METRICS.minCellRatio;
	} else if (ratio > LAYOUT_METRICS.maxCellRatio) {
		cellWidth = cellHeight * LAYOUT_METRICS.maxCellRatio;
	}

	const gridWidth = input.gridSize * cellWidth + (input.gridSize - 1) * gap;
	const gridHeight = input.gridSize * cellHeight + (input.gridSize - 1) * gap;
	const grid: Rect = {
		x: (standardWidth - gridWidth) / 2,
		y: topInset + (availableHeight - gridHeight) / 2,
		width: gridWidth,
		height: gridHeight
	};

	const cells: Rect[] = [];
	for (let row = 0; row < input.gridSize; row++) {
		for (let column = 0; column < input.gridSize; column++) {
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
		gridSize: input.gridSize,
		resolution: input.resolution,
		heading: {
			x: margin,
			y: margin,
			width: standardWidth - margin * 2,
			height: LAYOUT_METRICS.headingReserve
		},
		footer: {
			x: margin,
			y: standardHeight - bottomInset,
			width: standardWidth - margin * 2,
			height: bottomInset - margin
		},
		grid,
		cells,
		freeCellIndex:
			input.freeSpace && input.gridSize % 2 === 1
				? (input.gridSize * input.gridSize - 1) / 2
				: null,
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
