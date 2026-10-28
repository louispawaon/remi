import { describe, expect, it } from 'vitest';
import { isFreeSpaceCell, placedItemIds, unplacedItems } from './document';
import { createFixtureDocument } from './fixture';

describe('card document helpers', () => {
	it('treats the centre of an odd grid as free space only when enabled', () => {
		const enabled = createFixtureDocument({ gridSize: 5, freeSpace: true });
		expect(isFreeSpaceCell(enabled, 12)).toBe(true);
		expect(isFreeSpaceCell(enabled, 11)).toBe(false);

		const disabled = createFixtureDocument({ gridSize: 5, freeSpace: false });
		expect(isFreeSpaceCell(disabled, 12)).toBe(false);

		const even = createFixtureDocument({ gridSize: 4, freeSpace: true });
		expect(even.slots.every((_, index) => !isFreeSpaceCell(even, index))).toBe(true);
	});

	it('lists placed items in slot order without blanks', () => {
		const document = createFixtureDocument();
		const placed = placedItemIds(document);
		expect(placed).toHaveLength(6);
		expect(placed[0]).toBe('jp');
		expect(placed).not.toContain('unplaced-art');
		expect(new Set(placed).size).toBe(placed.length);
	});

	it('reports items that are not placed in any slot', () => {
		const document = createFixtureDocument();
		const unplaced = unplacedItems(document).map((item) => item.id);
		expect(unplaced).toEqual(['unplaced-art', 'unplaced-text']);
	});
});
