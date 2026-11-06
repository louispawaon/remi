import {
	CARD_SCHEMA_VERSION,
	GRID_MAX,
	GRID_MIN,
	type CardDocument,
	type CardItem,
	type GridDimension
} from './types';

export function clampGridDimension(value: number): GridDimension {
	return Math.min(GRID_MAX, Math.max(GRID_MIN, Math.round(value))) as GridDimension;
}

/** The single centre cell, only meaningful when both axes are odd and at least 3. */
export function centreCellIndex(
	gridColumns: GridDimension,
	gridRows: GridDimension
): number | null {
	if (gridColumns < 3 || gridRows < 3) return null;
	if (gridColumns % 2 === 0 || gridRows % 2 === 0) return null;
	return ((gridRows - 1) / 2) * gridColumns + (gridColumns - 1) / 2;
}

export function isFreeSpaceCell(document: CardDocument, index: number): boolean {
	return document.freeSpace && index === centreCellIndex(document.gridColumns, document.gridRows);
}

export function placedItemIds(document: CardDocument): string[] {
	return document.slots.filter(
		(id, index): id is string => id !== null && !isFreeSpaceCell(document, index)
	);
}

export function unplacedItems(document: CardDocument): CardItem[] {
	const placed = new Set(placedItemIds(document));
	return document.items.filter((item) => !placed.has(item.id));
}

export function randomId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

	// randomUUID is secure-context only; LAN HTTP is a supported delivery target.
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createDefaultDocument(id: string, now: string): CardDocument {
	const slots: (string | null)[] = Array.from({ length: 25 }, () => null);
	return {
		schemaVersion: CARD_SCHEMA_VERSION,
		id,
		title: 'Untitled card',
		gridColumns: 5,
		gridRows: 5,
		format: '4:5',
		freeSpace: true,
		appearance: {
			titleVisible: true,
			background: '#0c0c0f',
			foreground: '#f6ebc0',
			font: 'display'
		},
		items: [],
		slots,
		createdAt: now,
		updatedAt: now,
		revision: 0
	};
}

/** Format changes never move items or change capacity. */
export function setFormat(document: CardDocument, format: CardDocument['format']): CardDocument {
	return { ...document, format };
}

export function renameDocument(document: CardDocument, title: string): CardDocument {
	return { ...document, title };
}

/** Removing an item leaves its slot deliberately empty. */
export function removeItem(document: CardDocument, itemId: string): CardDocument {
	return {
		...document,
		items: document.items.filter((item) => item.id !== itemId),
		slots: document.slots.map((slot) => (slot === itemId ? null : slot))
	};
}

/** Reflow placed items in order, then unplaced items, into the new capacity. */
export function resizeGrid(
	document: CardDocument,
	gridColumns: CardDocument['gridColumns'],
	gridRows: CardDocument['gridRows']
): CardDocument {
	if (document.gridColumns === gridColumns && document.gridRows === gridRows) return document;

	const size = gridColumns * gridRows;
	const freeCell = document.freeSpace ? centreCellIndex(gridColumns, gridRows) : null;
	const order = [...placedItemIds(document), ...unplacedItems(document).map((item) => item.id)];
	const slots: (string | null)[] = Array.from({ length: size }, () => null);

	let cursor = 0;
	for (let index = 0; index < size && cursor < order.length; index++) {
		if (index === freeCell) continue;
		slots[index] = order[cursor++];
	}

	return { ...document, gridColumns, gridRows, slots };
}

/** Enabling free space displaces the centre item into the unplaced tray. */
export function setFreeSpace(document: CardDocument, enabled: boolean): CardDocument {
	if (document.freeSpace === enabled) return document;

	const slots = [...document.slots];
	const centre = centreCellIndex(document.gridColumns, document.gridRows);
	if (enabled && centre !== null) {
		slots[centre] = null;
	}
	return { ...document, freeSpace: enabled, slots };
}

/** A duplicate is independently editable: new card and item identities, same artwork refs. */
export function duplicateDocument(document: CardDocument, id: string, now: string): CardDocument {
	const itemIds = new Map(document.items.map((item) => [item.id, randomId()]));
	const items = document.items.map((item) => ({
		...structuredClone(item),
		id: itemIds.get(item.id)!
	}));
	const slots = document.slots.map((slot) => (slot === null ? null : (itemIds.get(slot) ?? null)));

	return {
		...structuredClone(document),
		id,
		title: `${document.title} copy`,
		items,
		slots,
		revision: 0,
		createdAt: now,
		updatedAt: now
	};
}
