import { describe, expect, it } from 'vitest';
import { isFreeSpaceCell, placedItemIds } from './document';
import { createFixtureDocument } from './fixture';

describe('createFixtureDocument', () => {
	it('builds a rectangular slot array', () => {
		const document = createFixtureDocument({ gridColumns: 7, gridRows: 3 });
		expect(document.slots).toHaveLength(21);
		expect(document.gridColumns).toBe(7);
		expect(document.gridRows).toBe(3);
		expect(isFreeSpaceCell(document, 10)).toBe(true);
	});

	it('does not drop items on a one-cell grid', () => {
		const document = createFixtureDocument({ gridColumns: 1, gridRows: 1 });
		expect(document.slots).toHaveLength(1);
		expect(placedItemIds(document)).toHaveLength(0);
		expect(document.items.length).toBeGreaterThan(0);
	});
});
