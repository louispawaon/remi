import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	centreCellIndex,
	createDefaultDocument,
	duplicateDocument,
	isFreeSpaceCell,
	placedItemIds,
	randomId,
	removeItem,
	resizeGrid,
	setFormat,
	setFreeSpace,
	slotNumbers,
	unplacedItems
} from './document';
import { createFixtureDocument } from './fixture';
import { CARD_SCHEMA_VERSION } from './types';

describe('card document helpers', () => {
	it('treats the centre of an odd, at-least-3-by-3 grid as free space only when enabled', () => {
		const enabled = createFixtureDocument({ gridColumns: 5, gridRows: 5, freeSpace: true });
		expect(isFreeSpaceCell(enabled, 12)).toBe(true);
		expect(isFreeSpaceCell(enabled, 11)).toBe(false);

		const disabled = createFixtureDocument({ gridColumns: 5, gridRows: 5, freeSpace: false });
		expect(isFreeSpaceCell(disabled, 12)).toBe(false);

		const even = createFixtureDocument({ gridColumns: 4, gridRows: 5, freeSpace: true });
		expect(even.slots.every((_, index) => !isFreeSpaceCell(even, index))).toBe(true);

		const single = createFixtureDocument({ gridColumns: 1, gridRows: 1, freeSpace: true });
		expect(isFreeSpaceCell(single, 0)).toBe(false);
	});

	it('finds the centre cell for rectangular odd grids', () => {
		expect(centreCellIndex(3, 5)).toBe(7);
		expect(centreCellIndex(5, 3)).toBe(7);
		expect(centreCellIndex(7, 7)).toBe(24);
		expect(centreCellIndex(4, 5)).toBeNull();
		expect(centreCellIndex(1, 3)).toBeNull();
	});

	it('numbers filled cells in reading order and skips blanks and free space', () => {
		const document = createDefaultDocument('card', '2026-01-01T00:00:00.000Z');
		document.gridColumns = 3;
		document.gridRows = 3;
		document.slots = ['a', null, 'b', null, 'free', null, 'c', null, null];

		expect(slotNumbers(document)).toEqual([1, null, 2, null, null, null, 3, null, null]);
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

	it('starts new cards with the agreed defaults', () => {
		const document = createDefaultDocument('new-card', '2026-10-28T00:00:00.000Z');
		expect(document.schemaVersion).toBe(CARD_SCHEMA_VERSION);
		expect(document.gridColumns).toBe(5);
		expect(document.gridRows).toBe(5);
		expect(document.format).toBe('4:5');
		expect(document.freeSpace).toBe(true);
		expect(document.appearance.titles).toBe('cells');
		expect(document.items).toEqual([]);
		expect(document.slots).toHaveLength(25);
		expect(document.revision).toBe(0);
	});

	it('changes format without moving items or changing capacity', () => {
		const document = createFixtureDocument({ gridColumns: 5, gridRows: 5, format: '4:5' });
		const next = setFormat(document, '9:16');
		expect(next.slots).toEqual(document.slots);
		expect(next.items).toEqual(document.items);
		expect(next.slots).toHaveLength(25);
	});

	it('reflows placed items in order and keeps overflow unplaced when the grid shrinks', () => {
		const document = createFixtureDocument({ gridColumns: 5, gridRows: 5, freeSpace: true });
		const before = placedItemIds(document);
		const next = resizeGrid(document, 3, 3);

		expect(next.gridColumns).toBe(3);
		expect(next.gridRows).toBe(3);
		expect(next.slots).toHaveLength(9);
		const ordered = [...before, ...unplacedItems(document).map((item) => item.id)];
		const reflowed = placedItemIds(next);
		expect(reflowed).toEqual(ordered.slice(0, 8));
		expect(next.items).toHaveLength(document.items.length);
		expect(unplacedItems(next).length).toBe(document.items.length - 8);
		expect(isFreeSpaceCell(next, 4)).toBe(true);
	});

	it('reflows into a rectangular grid and moves the free space with the centre', () => {
		const document = createFixtureDocument({ gridColumns: 5, gridRows: 5, freeSpace: true });
		const before = placedItemIds(document);
		const next = resizeGrid(document, 7, 3);

		expect(next.slots).toHaveLength(21);
		expect(isFreeSpaceCell(next, 10)).toBe(true);
		expect(placedItemIds(next)).toEqual([
			...before,
			...unplacedItems(document).map((item) => item.id)
		]);
		expect(next.slots[10]).toBeNull();
	});

	it('displaces the centre item into the tray when free space is enabled', () => {
		const document = createFixtureDocument({ gridColumns: 3, gridRows: 5, freeSpace: false });
		const centre = 7;
		document.slots[centre] = 'unplaced-art';

		const next = setFreeSpace(document, true);
		expect(next.slots[centre]).toBeNull();
		expect(unplacedItems(next).map((item) => item.id)).toContain('unplaced-art');
		expect(next.items.some((item) => item.id === 'unplaced-art')).toBe(true);
	});

	it('leaves a deliberate empty slot when an item is removed', () => {
		const document = createFixtureDocument();
		const slot = document.slots.findIndex((id) => id !== null);
		const itemId = document.slots[slot]!;

		const next = removeItem(document, itemId);
		expect(next.slots[slot]).toBeNull();
		expect(next.items.some((item) => item.id === itemId)).toBe(false);
	});

	it('creates an independent duplicate with new card and item identities', () => {
		const document = createFixtureDocument();
		const copy = duplicateDocument(document, 'copy-card', '2026-10-28T01:00:00.000Z');

		expect(copy.id).toBe('copy-card');
		expect(copy.title).toBe('Remi fixture card copy');
		expect(copy.revision).toBe(0);
		expect(copy.slots.map((slot) => slot !== null)).toEqual(
			document.slots.map((slot) => slot !== null)
		);
		expect(copy.items.map((item) => item.id)).not.toEqual(document.items.map((item) => item.id));
		expect(copy.items.map((item) => item.artwork?.id)).toEqual(
			document.items.map((item) => item.artwork?.id)
		);
		expect(copy.items.map((item) => item.titles)).toEqual(
			document.items.map((item) => item.titles)
		);
	});
});

describe('randomId', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('still produces a UUID when randomUUID is unavailable over LAN HTTP', () => {
		vi.stubGlobal('crypto', {
			getRandomValues: (bytes: Uint8Array) => {
				for (let index = 0; index < bytes.length; index++) bytes[index] = index;
				return bytes;
			}
		});

		expect(randomId()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
	});
});
