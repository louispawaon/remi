import { isFreeSpaceCell } from '#lib/card/document';
import type { CardDocument } from '#lib/card/types';

/** Shuffle the placed items among their slots; blanks and free space stay put. */
export function shuffleDocument(
	document: CardDocument,
	random: () => number = Math.random
): CardDocument {
	const slots = [...document.slots];
	const indices = slots
		.map((slot, index) => (slot !== null && !isFreeSpaceCell(document, index) ? index : -1))
		.filter((index) => index >= 0);
	const items = indices.map((index) => slots[index]!);

	for (let index = items.length - 1; index > 0; index--) {
		const swap = Math.floor(random() * (index + 1));
		[items[index], items[swap]] = [items[swap], items[index]];
	}

	indices.forEach((slotIndex, position) => {
		slots[slotIndex] = items[position];
	});

	return { ...document, slots };
}
