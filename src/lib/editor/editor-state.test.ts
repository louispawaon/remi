import { describe, expect, it } from 'vitest';
import { randomId } from '#lib/card/document';
import { createFixtureDocument } from '#lib/card/fixture';
import type { CardItem, CardRecord } from '#lib/card/types';
import { EditorState } from './editor-state.svelte';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

function fixtureRecord(): CardRecord {
	const document = createFixtureDocument();
	const artwork: Record<string, Blob> = {};
	for (const item of document.items) {
		if (item.artwork && !artwork[item.artwork.id]) {
			artwork[item.artwork.id] = new Blob([PNG], { type: item.artwork.type });
		}
	}
	return { document, artwork };
}

function withState(run: (state: EditorState) => void) {
	const state = new EditorState(fixtureRecord());
	try {
		run(state);
	} finally {
		state.dispose();
	}
}

describe('EditorState', () => {
	it('swaps two placed items instead of dropping either', () => {
		withState((state) => {
			const document = state.document;
			const first = document.slots[0]!;
			const second = document.slots[1]!;

			state.placeItem(first, 1);

			expect(state.document.slots[0]).toBe(second);
			expect(state.document.slots[1]).toBe(first);
			expect(state.selectedSlot).toBe(1);
			expect(state.document.items).toHaveLength(8);
		});
	});

	it('removes an item, keeps an empty slot, and recycles only its artwork', () => {
		withState((state) => {
			state.selectSlot(0);
			const artworkId = state.selectedItem?.artwork?.id;
			expect(artworkId).toBeTruthy();

			state.removeSelectedItem();

			expect(state.document.slots[0]).toBeNull();
			expect(state.document.items.some((item) => item.id === 'jp')).toBe(false);
			expect(state.record.artwork[artworkId!]).toBeUndefined();
			expect(state.record.artwork['art-kr']).toBeDefined();
		});
	});

	it('displaces the centre item into the tray when free space is enabled', () => {
		const record = fixtureRecord();
		record.document.freeSpace = false;
		record.document.slots[12] = 'unplaced-art';
		const state = new EditorState(record);

		try {
			state.setFreeSpace(true);
			expect(state.document.slots[12]).toBeNull();
			expect(state.unplaced.map((item) => item.id)).toContain('unplaced-art');
		} finally {
			state.dispose();
		}
	});

	it('keeps a new item in the tray when every cell is occupied', () => {
		const record = fixtureRecord();
		record.document.freeSpace = false;
		record.document.slots = Array.from(
			{ length: 25 },
			(_, index) => record.document.items[index % record.document.items.length].id
		);
		const state = new EditorState(record);

		try {
			const item: CardItem = {
				id: randomId(),
				category: 'movie',
				sourceId: null,
				titles: { preferred: 'Overflow', alternatives: [] },
				titleOverride: null,
				artwork: null,
				crops: {}
			};
			state.addItem(item, null);

			expect(state.document.slots).not.toContain(item.id);
			expect(state.unplaced.map((candidate) => candidate.id)).toContain(item.id);
			expect(state.document.items).toHaveLength(9);
		} finally {
			state.dispose();
		}
	});
});
