import { describe, expect, it } from 'vitest';
import { planLegend, type LegendMeasure } from './legend';

function measureFor(): LegendMeasure {
	let size = 16;
	const measure = ((text: string) => Array.from(text).length * size * 0.55) as LegendMeasure;
	measure.setFont = (next) => {
		size = next;
	};
	return measure;
}

function titles(count: number, length = 20): string[] {
	return Array.from({ length: count }, (_, index) =>
		`title ${String(index + 1).padStart(2, '0')}`.padEnd(length, 'x')
	);
}

function entries(plan: NonNullable<ReturnType<typeof planLegend>>) {
	return plan.columns.flatMap((column) => column.entries);
}

describe('planLegend', () => {
	it('returns null without titles', () => {
		expect(planLegend([], { width: 984, maxHeight: 300, measure: measureFor() })).toBeNull();
	});

	it('keys every placed title in reading order', () => {
		const plan = planLegend(titles(25), { width: 984, maxHeight: 300, measure: measureFor() })!;
		const all = entries(plan);
		expect(all).toHaveLength(25);
		expect(all.map((entry) => entry.number)).toEqual(
			Array.from({ length: 25 }, (_, index) => String(index + 1).padStart(2, '0'))
		);
		expect(all.every((entry) => entry.lines.length === 1)).toBe(true);
		expect(plan.columns.length).toBeGreaterThan(1);
		expect(plan.truncated).toBe(false);
		expect(plan.height).toBeLessThanOrEqual(300);
	});

	it('fits a dense 7x7 card within the budget', () => {
		const plan = planLegend(titles(49, 24), { width: 984, maxHeight: 420, measure: measureFor() })!;
		expect(entries(plan)).toHaveLength(49);
		expect(plan.truncated).toBe(false);
		expect(plan.height).toBeLessThanOrEqual(420);
	});

	it('caps a pathological title at three lines with an ellipsis', () => {
		const plan = planLegend(['x'.repeat(2000)], {
			width: 984,
			maxHeight: 200,
			measure: measureFor()
		})!;
		const [entry] = entries(plan);
		expect(entry!.lines).toHaveLength(3);
		expect(entry!.lines[2]!.endsWith('…')).toBe(true);
		expect(plan.truncated).toBe(true);
	});

	it('keeps columns inside the content width', () => {
		const plan = planLegend(titles(30), { width: 984, maxHeight: 420, measure: measureFor() })!;
		for (const column of plan.columns) {
			expect(column.x).toBeGreaterThanOrEqual(0);
			expect(column.x + column.width).toBeLessThanOrEqual(984 + 1e-6);
		}
	});
});
