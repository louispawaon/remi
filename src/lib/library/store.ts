import {
	createDefaultDocument,
	duplicateDocument,
	randomId,
	renameDocument,
	unplacedItems
} from '#lib/card/document';
import { CARD_LIMITS, type CardDocument, type CardRecord } from '#lib/card/types';
import { getDatabase } from './db';
import { RevisionConflictError, StorageWriteError, toStorageError } from './errors';
import type { CardSummary } from './types';

export interface NewCard {
	document: CardDocument;
	artwork: Record<string, Blob>;
}

export interface SaveOptions {
	thumbnail?: Blob;
}

export function summarize(record: CardRecord, thumbnail: Blob | null): CardSummary {
	return {
		id: record.document.id,
		title: record.document.title,
		gridSize: record.document.gridSize,
		format: record.document.format,
		itemCount: record.document.items.length,
		unplacedCount: unplacedItems(record.document).length,
		updatedAt: record.document.updatedAt,
		revision: record.document.revision,
		thumbnail
	};
}

/** Storage refuses cards the renderer would choke on; limits match the archive contract. */
export function assertStorable(record: CardRecord): void {
	if (record.document.items.length > CARD_LIMITS.maxItems) {
		throw new StorageWriteError(`A card can hold at most ${CARD_LIMITS.maxItems} items.`);
	}

	let total = 0;
	for (const blob of Object.values(record.artwork)) {
		if (blob.size > CARD_LIMITS.maxArtworkBytes) {
			throw new StorageWriteError('One artwork file is larger than the 8 MiB card limit.');
		}
		total += blob.size;
		if (total > CARD_LIMITS.maxCardArtworkBytes) {
			throw new StorageWriteError('This card’s artwork is larger than the 40 MiB limit.');
		}
	}
}

export async function listCards(): Promise<CardSummary[]> {
	const database = await getDatabase();
	const summaries = await database.getAll('library');
	return summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function loadCard(id: string): Promise<CardRecord | null> {
	const database = await getDatabase();
	return (await database.get('cards', id)) ?? null;
}

export async function getThumbnail(id: string): Promise<Blob | null> {
	const database = await getDatabase();
	return (await database.get('library', id))?.thumbnail ?? null;
}

/**
 * Atomic document + summary write. A stale revision is rejected inside the same transaction
 * that would have written it, so two tabs cannot silently overwrite each other.
 */
export async function saveCard(record: CardRecord, options: SaveOptions = {}): Promise<CardRecord> {
	assertStorable(record);
	const database = await getDatabase();

	try {
		const transaction = database.transaction(['cards', 'library'], 'readwrite');
		const cards = transaction.objectStore('cards');
		const library = transaction.objectStore('library');

		const existing = await cards.get(record.document.id);
		if (existing && existing.document.revision !== record.document.revision) {
			throw new RevisionConflictError(existing.document.revision);
		}

		const prior = await library.get(record.document.id);
		const next: CardRecord = {
			document: {
				...record.document,
				revision: record.document.revision + 1,
				updatedAt: new Date().toISOString()
			},
			artwork: record.artwork
		};

		await cards.put(next, next.document.id);
		await library.put(
			summarize(next, options.thumbnail ?? prior?.thumbnail ?? null),
			next.document.id
		);
		await transaction.done;
		return next;
	} catch (error) {
		if (error instanceof RevisionConflictError) throw error;
		throw toStorageError(error);
	}
}

export function createEmptyCard(now = new Date().toISOString()): CardRecord {
	return { document: createDefaultDocument(randomId(), now), artwork: {} };
}

/** Import and fixture seeding always get a new identity; never overwrite an existing card. */
export function prepareNewCard(record: CardRecord, now = new Date().toISOString()): CardRecord {
	return {
		document: {
			...structuredClone(record.document),
			id: randomId(),
			revision: 0,
			createdAt: now,
			updatedAt: now
		},
		artwork: record.artwork
	};
}

export async function createCard(
	record?: CardRecord,
	options: SaveOptions = {}
): Promise<CardRecord> {
	return saveCard(record ? prepareNewCard(record) : createEmptyCard(), options);
}

export async function renameCard(id: string, title: string): Promise<CardRecord> {
	const existing = await loadCard(id);
	if (!existing) throw new StorageWriteError('That card no longer exists.');
	return saveCard({ ...existing, document: renameDocument(existing.document, title) });
}

export async function duplicateCard(id: string): Promise<CardRecord> {
	const existing = await loadCard(id);
	if (!existing) throw new StorageWriteError('That card no longer exists.');

	const now = new Date().toISOString();
	const copy: CardRecord = {
		document: duplicateDocument(existing.document, randomId(), now),
		artwork: structuredClone(existing.artwork)
	};
	const thumbnail = await getThumbnail(id);
	return saveCard(copy, thumbnail ? { thumbnail } : {});
}

export async function deleteCard(id: string): Promise<void> {
	const database = await getDatabase();
	try {
		const transaction = database.transaction(['cards', 'library'], 'readwrite');
		await Promise.all([
			transaction.objectStore('cards').delete(id),
			transaction.objectStore('library').delete(id)
		]);
		await transaction.done;
	} catch (error) {
		throw toStorageError(error);
	}
}
