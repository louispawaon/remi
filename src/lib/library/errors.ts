export class StorageUnavailableError extends Error {
	name = 'StorageUnavailableError';
}

export class StorageWriteError extends Error {
	name = 'StorageWriteError';
}

export class CardGoneError extends Error {
	name = 'CardGoneError';

	constructor() {
		super('That card was deleted in another tab. Reload the library.');
	}
}

export class RevisionConflictError extends Error {
	name = 'RevisionConflictError';

	constructor(readonly currentRevision: number) {
		super('This card changed in another tab. Reload it before saving.');
	}
}

/** Map browser storage failures to actionable messages without hiding the cause. */
export function toStorageError(error: unknown): Error {
	if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
		if (error.name === 'QuotaExceededError') {
			return new StorageWriteError(
				'This browser is out of storage for this card. Export the project to keep your work.'
			);
		}
		if (error.name === 'InvalidStateError' || error.name === 'UnknownError') {
			return new StorageUnavailableError(
				'Local storage is unavailable in this browser. Export projects to keep your work.'
			);
		}
	}
	return error instanceof Error ? error : new StorageWriteError(String(error));
}
