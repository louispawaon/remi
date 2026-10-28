import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtureDocument } from '#lib/card/fixture';
import { CARD_LIMITS, type CardRecord } from '#lib/card/types';
import { getDatabase, resetLibrary } from './db';
import { importProjectFile } from './import';
import { CardGoneError, RevisionConflictError, StorageWriteError, toStorageError } from './errors';
import {
	assertStorable,
	createCard,
	deleteCard,
	duplicateCard,
	listCards,
	loadCard,
	renameCard,
	saveCard
} from './store';

const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

function fixtureRecord(): CardRecord {
	const document = createFixtureDocument();
	const artwork: Record<string, Blob> = {};
	for (const item of document.items) {
		if (item.artwork && !artwork[item.artwork.id]) {
			artwork[item.artwork.id] = new Blob([TINY_PNG], { type: item.artwork.type });
		}
	}
	return { document, artwork };
}

beforeEach(async () => {
	await resetLibrary();
});

describe('card library store', () => {
	it('creates a default card with one saved revision', async () => {
		const saved = await createCard();
		expect(saved.document.revision).toBe(1);
		expect(saved.document.gridSize).toBe(5);
		expect(saved.document.freeSpace).toBe(true);

		const list = await listCards();
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id: saved.document.id, revision: 1, itemCount: 0 });
	});

	it('stores the whole record and increments the revision on save', async () => {
		const saved = await createCard(fixtureRecord());
		const loaded = await loadCard(saved.document.id);

		expect(loaded?.document.items.length).toBe(8);
		expect(Object.keys(loaded?.artwork ?? {})).toHaveLength(6);

		const next = await saveCard({
			...loaded!,
			document: { ...loaded!.document, title: 'Renamed' }
		});
		expect(next.document.revision).toBe(2);

		const reloaded = await loadCard(saved.document.id);
		expect(reloaded?.document.title).toBe('Renamed');
		expect(new Uint8Array(await reloaded!.artwork['art-jp'].arrayBuffer())).toEqual(
			new Uint8Array(TINY_PNG)
		);
	});

	it('rejects stale revisions without changing the newer card', async () => {
		const saved = await createCard(fixtureRecord());
		const stale = await loadCard(saved.document.id);
		expect(stale).not.toBeNull();

		await renameCard(saved.document.id, 'Newer title');

		await expect(
			saveCard({ ...stale!, document: { ...stale!.document, title: 'Stale overwrite' } })
		).rejects.toBeInstanceOf(RevisionConflictError);

		const reloaded = await loadCard(saved.document.id);
		expect(reloaded?.document.title).toBe('Newer title');
		expect(reloaded?.document.revision).toBe(2);
	});

	it('renames a card and updates its summary', async () => {
		const saved = await createCard(fixtureRecord());
		await renameCard(saved.document.id, 'Friday Night Rotation');

		const list = await listCards();
		expect(list[0].title).toBe('Friday Night Rotation');
		expect(list[0].revision).toBe(2);
	});

	it('duplicates into an independently editable card', async () => {
		const original = await createCard(fixtureRecord());
		const copy = await duplicateCard(original.document.id);

		expect(copy.document.id).not.toBe(original.document.id);
		expect(copy.document.title).toBe(`${original.document.title} copy`);
		expect(Object.keys(copy.artwork)).toHaveLength(6);

		await renameCard(copy.document.id, 'Copy only');
		await deleteCard(original.document.id);

		expect(await loadCard(original.document.id)).toBeNull();
		const remaining = await loadCard(copy.document.id);
		expect(remaining?.document.title).toBe('Copy only');
		expect((await listCards()).map((card) => card.id)).toEqual([copy.document.id]);
	});

	it('deletes both the record and its library row', async () => {
		const saved = await createCard();
		await deleteCard(saved.document.id);
		expect(await loadCard(saved.document.id)).toBeNull();
		expect(await listCards()).toEqual([]);
	});

	it('stores thumbnails with summaries and keeps them across title saves', async () => {
		const thumbnail = new Blob(['thumb'], { type: 'image/webp' });
		const saved = await createCard(fixtureRecord(), { thumbnail });

		await renameCard(saved.document.id, 'Still has a thumb');
		const [summary] = await listCards();
		expect(summary.thumbnail?.size).toBe(thumbnail.size);
		expect(await loadCard(saved.document.id)).not.toBeNull();
	});

	it('imports a project as a new card and never overwrites an existing one', async () => {
		const existing = await createCard(fixtureRecord());
		const imported = await createCard(fixtureRecord());

		expect(imported.document.id).not.toBe(existing.document.id);
		expect((await listCards()).map((card) => card.id).sort()).toEqual(
			[existing.document.id, imported.document.id].sort()
		);
	});

	it('does not resurrect a card deleted in another tab', async () => {
		const saved = await createCard(fixtureRecord());
		const stale = await loadCard(saved.document.id);
		await deleteCard(saved.document.id);

		await expect(saveCard(stale!)).rejects.toBeInstanceOf(CardGoneError);
		expect(await listCards()).toEqual([]);
	});

	it('rolls back both stores when the write fails', async () => {
		const saved = await createCard(fixtureRecord());
		const before = await loadCard(saved.document.id);
		const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
			throw new DOMException('full', 'QuotaExceededError');
		});

		try {
			await expect(
				saveCard({ ...before!, document: { ...before!.document, title: 'Should not land' } })
			).rejects.toBeInstanceOf(StorageWriteError);
		} finally {
			put.mockRestore();
		}

		expect((await loadCard(saved.document.id))?.document.title).toBe(before!.document.title);
		expect((await listCards())[0].title).toBe(before!.document.title);
		expect(await getDatabase()).toBeTruthy();
	});

	it('leaves the library untouched when an import is invalid', async () => {
		await createCard(fixtureRecord());
		await expect(importProjectFile(new Uint8Array([1, 2, 3]))).rejects.toThrow();
		expect(await listCards()).toHaveLength(1);
	});

	it('refuses cards over the storage limits', () => {
		const record = fixtureRecord();
		const tooMany = {
			...record,
			document: {
				...record.document,
				items: Array.from({ length: CARD_LIMITS.maxItems + 1 }, () => record.document.items[0])
			}
		};
		expect(() => assertStorable(tooMany)).toThrow(/100 items/i);

		const oversized = {
			...record,
			artwork: { big: new Blob([new Uint8Array(CARD_LIMITS.maxArtworkBytes + 1)]) }
		};
		expect(() => assertStorable(oversized)).toThrow(/8 MiB/i);

		const total = {
			...record,
			artwork: Object.fromEntries(
				Array.from({ length: 6 }, (_, index) => [
					`art-${index}`,
					new Blob([new Uint8Array(7 * 1024 * 1024)])
				])
			)
		};
		expect(() => assertStorable(total)).toThrow(/40 MiB/i);
	});

	it('maps quota failures to an actionable storage error', () => {
		const quota = new DOMException('full', 'QuotaExceededError');
		const mapped = toStorageError(quota);
		expect(mapped).toBeInstanceOf(StorageWriteError);
		expect(mapped.message).toMatch(/export the project/i);
	});
});
