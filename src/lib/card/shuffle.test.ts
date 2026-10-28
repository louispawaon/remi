import { describe, expect, it } from 'vitest';
import { createFixtureDocument } from './fixture';
import { placedItemIds, unplacedItems } from './document';
import { shuffleDocument } from './shuffle';

describe('shuffleDocument', () => {
	it('keeps the same items, blanks, and free-space cell', () => {
		const document = createFixtureDocument({ gridSize: 5, freeSpace: true });
		const shuffled = shuffleDocument(document, () => 0.5);

		expect(placedItemIds(shuffled).sort()).toEqual(placedItemIds(document).sort());
		expect(unplacedItems(shuffled).map((item) => item.id)).toEqual(
			unplacedItems(document).map((item) => item.id)
		);
		expect(shuffled.slots.map((slot) => slot !== null)).toEqual(
			document.slots.map((slot) => slot !== null)
		);
		expect(shuffled.slots[12]).toBeNull();
	});

	it('is deterministic for a supplied random source', () => {
		const document = createFixtureDocument({ gridSize: 5 });
		const left = shuffleDocument(document, () => 0.25);
		const right = shuffleDocument(document, () => 0.25);
		expect(left.slots).toEqual(right.slots);
	});
});
