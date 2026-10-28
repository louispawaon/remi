import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CardRecord } from '#lib/card/types';
import { StorageUnavailableError, toStorageError } from './errors';
import type { CardSummary } from './types';

export interface LibrarySchema extends DBSchema {
	cards: { key: string; value: CardRecord };
	library: { key: string; value: CardSummary };
}

export const DATABASE_NAME = 'remi';
export const DATABASE_VERSION = 1;

let databasePromise: Promise<IDBPDatabase<LibrarySchema>> | undefined;

export function getDatabase(): Promise<IDBPDatabase<LibrarySchema>> {
	if (typeof indexedDB === 'undefined') {
		return Promise.reject(
			new StorageUnavailableError('Local storage is unavailable in this browser.')
		);
	}
	databasePromise ??= openDB<LibrarySchema>(DATABASE_NAME, DATABASE_VERSION, {
		upgrade(database) {
			database.createObjectStore('cards');
			database.createObjectStore('library');
		}
	}).catch((error) => {
		databasePromise = undefined;
		throw toStorageError(error);
	});
	return databasePromise;
}

/** Test and harness reset; keeps the schema in place. */
export async function resetLibrary(): Promise<void> {
	const database = await getDatabase();
	const transaction = database.transaction(['cards', 'library'], 'readwrite');
	await Promise.all([
		transaction.objectStore('cards').clear(),
		transaction.objectStore('library').clear()
	]);
	await transaction.done;
}
