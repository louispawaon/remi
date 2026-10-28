import type { CardDocument, CardItem } from './types';

export function isFreeSpaceCell(document: CardDocument, index: number): boolean {
	return (
		document.freeSpace &&
		document.gridSize % 2 === 1 &&
		index === (document.gridSize * document.gridSize - 1) / 2
	);
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
		schemaVersion: 1,
		id,
		title: 'Untitled card',
		gridSize: 5,
		format: '4:5',
		freeSpace: true,
		appearance: {
			titleVisible: true,
			background: '#12100e',
			foreground: '#f4efe6',
			font: 'sans'
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
	gridSize: CardDocument['gridSize']
): CardDocument {
	if (document.gridSize === gridSize) return document;

	const size = gridSize * gridSize;
	const freeCell = document.freeSpace && gridSize % 2 === 1 ? (size - 1) / 2 : -1;
	const order = [...placedItemIds(document), ...unplacedItems(document).map((item) => item.id)];
	const slots: (string | null)[] = Array.from({ length: size }, () => null);

	let cursor = 0;
	for (let index = 0; index < size && cursor < order.length; index++) {
		if (index === freeCell) continue;
		slots[index] = order[cursor++];
	}

	return { ...document, gridSize, slots };
}

/** Enabling free space displaces the centre item into the unplaced tray. */
export function setFreeSpace(document: CardDocument, enabled: boolean): CardDocument {
	if (document.freeSpace === enabled) return document;

	const slots = [...document.slots];
	if (enabled && document.gridSize % 2 === 1) {
		const centre = (document.gridSize * document.gridSize - 1) / 2;
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
