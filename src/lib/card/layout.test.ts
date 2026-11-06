import { describe, expect, it } from 'vitest';
import { computeLayout, captionHeight, FORMAT_SIZES } from './layout';
import { FORMATS, GRID_DIMENSIONS } from './types';

const resolutions = [1, 2] as const;
const EPSILON = 1e-6;
const SHAPES = GRID_DIMENSIONS.flatMap((gridColumns) =>
	GRID_DIMENSIONS.map((gridRows) => ({ gridColumns, gridRows }))
);

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
	return (
		a.x < b.x + b.width - EPSILON &&
		b.x < a.x + a.width - EPSILON &&
		a.y < b.y + b.height - EPSILON &&
		b.y < a.y + a.height - EPSILON
	);
}

function centreIndex(gridColumns: number, gridRows: number): number | null {
	if (gridColumns < 3 || gridRows < 3 || gridColumns % 2 === 0 || gridRows % 2 === 0) return null;
	return ((gridRows - 1) / 2) * gridColumns + (gridColumns - 1) / 2;
}

describe('computeLayout', () => {
	it('produces exact output dimensions for every shape, format and resolution', () => {
		for (const { gridColumns, gridRows } of SHAPES) {
			for (const format of FORMATS) {
				for (const resolution of resolutions) {
					const layout = computeLayout({
						gridColumns,
						gridRows,
						format,
						freeSpace: false,
						resolution
					});
					const [width, height] = FORMAT_SIZES[format];
					expect(layout.width).toBe(width * resolution);
					expect(layout.height).toBe(height * resolution);
				}
			}
		}
	});

	it('keeps every grid inside the remaining area, centered, non-overlapping and within the cell ratio bound', () => {
		for (const { gridColumns, gridRows } of SHAPES) {
			for (const format of FORMATS) {
				const layout = computeLayout({
					gridColumns,
					gridRows,
					format,
					freeSpace: true,
					resolution: 1
				});
				expect(layout.cells).toHaveLength(gridColumns * gridRows);

				for (const cell of layout.cells) {
					expect(cell.x).toBeGreaterThanOrEqual(layout.grid.x - EPSILON);
					expect(cell.y).toBeGreaterThanOrEqual(layout.grid.y - EPSILON);
					expect(cell.x + cell.width).toBeLessThanOrEqual(
						layout.grid.x + layout.grid.width + EPSILON
					);
					expect(cell.y + cell.height).toBeLessThanOrEqual(
						layout.grid.y + layout.grid.height + EPSILON
					);
					expect(cell.width / cell.height).toBeGreaterThanOrEqual(0.72 - EPSILON);
					expect(cell.width / cell.height).toBeLessThanOrEqual(1.15 + EPSILON);
				}

				for (let i = 0; i < layout.cells.length; i++) {
					for (let j = i + 1; j < layout.cells.length; j++) {
						expect(rectsOverlap(layout.cells[i], layout.cells[j])).toBe(false);
					}
				}

				expect(layout.grid.x).toBeCloseTo((layout.width - layout.grid.width) / 2, 6);
				expect(layout.heading.y + layout.heading.height).toBeLessThanOrEqual(
					layout.grid.y + EPSILON
				);
				expect(layout.grid.y + layout.grid.height).toBeLessThanOrEqual(layout.footer.y + EPSILON);
			}
		}
	});

	it('marks the centre cell as free space only when both axes are odd and at least 3', () => {
		for (const { gridColumns, gridRows } of SHAPES) {
			const enabled = computeLayout({
				gridColumns,
				gridRows,
				format: '4:5',
				freeSpace: true,
				resolution: 1
			});
			const disabled = computeLayout({
				gridColumns,
				gridRows,
				format: '4:5',
				freeSpace: false,
				resolution: 1
			});
			expect(enabled.freeCellIndex).toBe(centreIndex(gridColumns, gridRows));
			expect(disabled.freeCellIndex).toBeNull();
		}
	});

	it('scales the whole composition exactly for 2x output', () => {
		for (const { gridColumns, gridRows } of SHAPES) {
			for (const format of FORMATS) {
				const standard = computeLayout({
					gridColumns,
					gridRows,
					format,
					freeSpace: true,
					resolution: 1
				});
				const doubled = computeLayout({
					gridColumns,
					gridRows,
					format,
					freeSpace: true,
					resolution: 2
				});
				expect(doubled.width).toBe(standard.width * 2);
				expect(doubled.height).toBe(standard.height * 2);
				expect(doubled.titleFontSize).toBe(standard.titleFontSize * 2);
				expect(doubled.caption.fontSize).toBe(standard.caption.fontSize * 2);
				expect(doubled.heading).toEqual(scaleRect(standard.heading, 2));
				expect(doubled.grid).toEqual(scaleRect(standard.grid, 2));
				expect(doubled.cells).toEqual(standard.cells.map((cell) => scaleRect(cell, 2)));
			}
		}
	});

	it('reserves story insets above and below the grid', () => {
		const story = computeLayout({
			gridColumns: 5,
			gridRows: 5,
			format: '9:16',
			freeSpace: true,
			resolution: 1
		});
		expect(story.heading.y + story.heading.height).toBe(160);
		expect(story.footer.y).toBe(1920 - 240);

		const square = computeLayout({
			gridColumns: 5,
			gridRows: 5,
			format: '1:1',
			freeSpace: true,
			resolution: 1
		});
		expect(square.heading.y + square.heading.height).toBe(160);
		expect(square.footer.y).toBe(1080 - 80);
	});

	it('gives the grid the heading reserve when the title is off', () => {
		for (const format of FORMATS) {
			const withTitle = computeLayout({
				gridColumns: 5,
				gridRows: 5,
				format,
				freeSpace: true,
				resolution: 1
			});
			const headless = computeLayout({
				gridColumns: 5,
				gridRows: 5,
				format,
				freeSpace: true,
				resolution: 1,
				headless: true
			});
			expect(headless.heading.height).toBe(0);
			expect(headless.grid.y).toBeLessThanOrEqual(withTitle.grid.y);
			if (format !== '9:16') {
				expect(headless.grid.y).toBeLessThan(withTitle.grid.y);
				expect(headless.grid.height).toBeGreaterThan(withTitle.grid.height);
			}
		}
	});

	it('gives captions room for two lines inside each cell', () => {
		for (const format of FORMATS) {
			const layout = computeLayout({
				gridColumns: 5,
				gridRows: 5,
				format,
				freeSpace: true,
				resolution: 1
			});
			const height = captionHeight(layout);
			expect(height).toBe(layout.caption.lineHeight * 2 + layout.caption.padding * 2);
			expect(height).toBeLessThan(layout.cells[0].height);
		}
	});
});

function scaleRect(rect: { x: number; y: number; width: number; height: number }, factor: number) {
	return {
		x: rect.x * factor,
		y: rect.y * factor,
		width: rect.width * factor,
		height: rect.height * factor
	};
}
