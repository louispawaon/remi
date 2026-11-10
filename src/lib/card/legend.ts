import { wrapText, type Measure } from './text';

export interface LegendEntry {
	number: string;
	lines: string[];
	/** Top offset inside its column, in standard (1x) units. */
	y: number;
}

export interface LegendColumn {
	x: number;
	width: number;
	entries: LegendEntry[];
}

export interface LegendPlan {
	fontSize: number;
	lineHeight: number;
	numberWidth: number;
	numberGap: number;
	columns: LegendColumn[];
	/** Includes the space above the first line. */
	height: number;
	truncated: boolean;
}

export interface LegendMeasure extends Measure {
	setFont: (size: number) => void;
}

const FONT_SIZES = [16, 15, 14, 13, 12, 11, 10] as const;
const MAX_COLUMNS = 8;
const MAX_LINES = 3;
const TOP_PADDING = 12;
const COLUMN_GAP = 24;

/**
 * Lay out a numbered key above the footer. Full titles win up to three lines;
 * the largest type that fits the height budget is used, otherwise the smallest.
 */
export function planLegend(
	titles: string[],
	options: { width: number; maxHeight: number; measure: LegendMeasure }
): LegendPlan | null {
	if (titles.length === 0) return null;

	let fallback: LegendPlan | null = null;
	for (const fontSize of FONT_SIZES) {
		options.measure.setFont(fontSize);
		const plan = bestPlanAtSize(titles, fontSize, options);
		if (!plan) continue;
		fallback = plan;
		if (!plan.truncated && plan.height <= options.maxHeight) return plan;
	}
	return fallback;
}

function bestPlanAtSize(
	titles: string[],
	fontSize: number,
	options: { width: number; measure: LegendMeasure }
): LegendPlan | null {
	const lineHeight = Math.round(fontSize * 1.35);
	const numberWidth = options.measure('00');
	const numberGap = fontSize * 0.55;
	const maxColumns = Math.min(MAX_COLUMNS, Math.ceil(titles.length / 3));
	let best: LegendPlan | null = null;

	for (let columnCount = 1; columnCount <= maxColumns; columnCount++) {
		const plan = planColumns(titles, {
			width: options.width,
			fontSize,
			lineHeight,
			numberWidth,
			numberGap,
			columnCount,
			measure: options.measure
		});
		if (
			!best ||
			plan.truncated < best.truncated ||
			(plan.truncated === best.truncated && plan.height < best.height)
		) {
			best = plan;
		}
	}
	return best;
}

function planColumns(
	titles: string[],
	input: {
		width: number;
		fontSize: number;
		lineHeight: number;
		numberWidth: number;
		numberGap: number;
		columnCount: number;
		measure: LegendMeasure;
	}
): LegendPlan {
	const { width, fontSize, lineHeight, numberWidth, numberGap, columnCount, measure } = input;
	const columnWidth = (width - COLUMN_GAP * (columnCount - 1)) / columnCount;
	const titleWidth = columnWidth - numberWidth - numberGap;
	const rows = Math.ceil(titles.length / columnCount);
	const columns: LegendColumn[] = [];
	let height = TOP_PADDING;
	let truncated = false;

	for (let column = 0; column < columnCount; column++) {
		const entries: LegendEntry[] = [];
		let y = TOP_PADDING;
		const group = titles.slice(column * rows, (column + 1) * rows);
		for (let index = 0; index < group.length; index++) {
			const title = group[index]!.replace(/\s+/g, ' ').trim();
			const all = wrapText(title, titleWidth, measure, 1000);
			const lines = all.length > MAX_LINES ? wrapText(title, titleWidth, measure, MAX_LINES) : all;
			if (all.length > MAX_LINES) truncated = true;
			entries.push({ number: keyLabel(column * rows + index + 1), lines, y });
			y += lines.length * lineHeight + Math.max(4, fontSize * 0.3);
		}
		columns.push({ x: column * (columnWidth + COLUMN_GAP), width: columnWidth, entries });
		height = Math.max(height, y);
	}

	return {
		fontSize,
		lineHeight,
		numberWidth,
		numberGap,
		columns,
		height: Math.ceil(height),
		truncated
	};
}

function keyLabel(number: number): string {
	return String(number).padStart(2, '0');
}
