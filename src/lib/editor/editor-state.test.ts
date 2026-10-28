import { describe, expect, it } from 'vitest';
import { randomId } from '#lib/card/document';
import { createFixtureDocument } from '#lib/card/fixture';
import { ARCHIVE_LIMITS } from '#lib/card/archive';
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
	it('rejects a 101st item without changing the working card', () => {
		withState((state) => {
			while (state.document.items.length < 100) {
				state.addItem({ ...state.document.items[4], id: randomId() }, null);
			}
			const before = state.record;
			expect(() => state.addItem({ ...state.document.items[4], id: randomId() }, null)).toThrow(
				/100/
			);
			expect(state.record).toBe(before);
		});
	});

	it('rejects additions that exceed the card artwork total before mutation', () => {
		withState((state) => {
			const blob = new Blob([new Uint8Array(6.5 * 1024 * 1024)]);
			for (const id of Object.keys(state.record.artwork)) state.record.artwork[id] = blob;
			const before = state.record;
			const item = {
				...state.document.items[0],
				id: randomId(),
				artwork: { ...state.document.items[0].artwork!, id: 'new' }
			};
			expect(() => state.addItem(item, new Blob([new Uint8Array(2 * 1024 * 1024)]))).toThrow(
				/40 MiB/
			);
			expect(state.record).toBe(before);
		});
	});

	it('rejects a title that would make the project too large', () => {
		withState((state) => {
			const before = state.record;
			state.setTitle('界'.repeat(ARCHIVE_LIMITS.manifestBytes / 2));
			expect(Object.is(state.record, before)).toBe(true);
			expect(state.editError).toMatch(/manifest/i);
			state.setTitle('Allowed title');
			expect(state.document.title).toBe('Allowed title');
			expect(state.editError).toBeNull();
		});
	});

	it('replaces the captured item after selection changes, and ignores removed items', () => {
		withState((state) => {
			const [first, second] = state.document.items;
			const secondArtwork = second.artwork;
			state.selectSlot(1);
			const normalized = { blob: new Blob([PNG]), width: 1, height: 1, type: 'image/png' as const };
			state.replaceArtwork(first.id, normalized);
			expect(state.document.items[0].artwork?.id).not.toBe(first.artwork?.id);
			expect(state.document.items[1].artwork).toEqual(secondArtwork);
			state.removeItem(first.id);
			const before = state.record;
			state.replaceArtwork(first.id, normalized);
			expect(state.record).toBe(before);
		});
	});

	it('rejects replacement artwork that exceeds the total without deleting old artwork', () => {
		withState((state) => {
			const blob = new Blob([new Uint8Array(6.5 * 1024 * 1024)]);
			for (const id of Object.keys(state.record.artwork)) state.record.artwork[id] = blob;
			const before = state.record;
			expect(() =>
				state.replaceArtwork(state.document.items[0].id, {
					blob: new Blob([new Uint8Array(8 * 1024 * 1024)]),
					width: 1,
					height: 1,
					type: 'image/png'
				})
			).toThrow(/40 MiB/);
			expect(state.record).toBe(before);
		});
	});

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

	it('accepts shrinking edits while a card is over the manifest limit', () => {
		const record = fixtureRecord();
		record.document.title = 'x'.repeat(1_500_000);
		const state = new EditorState(record);

		try {
			state.setTitle('x'.repeat(1_200_000));
			expect(state.record.document.title).toHaveLength(1_200_000);
			expect(state.editError).toMatch(/manifest/i);

			state.setTitle('Short enough');
			expect(state.record.document.title).toBe('Short enough');
			expect(state.editError).toBeNull();
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
