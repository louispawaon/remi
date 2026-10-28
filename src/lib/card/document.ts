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
