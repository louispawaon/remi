import type { CardRecord } from '#lib/card/types';
import { RevisionConflictError } from './errors';

export type AutosaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export type SaveFunction = (record: CardRecord) => Promise<CardRecord>;

export interface AutosaveOptions {
	debounceMs?: number;
	onStatus?: (status: AutosaveStatus, detail?: string) => void;
	onSaved?: (record: CardRecord) => void;
}

/**
 * Debounced, revision-aware saver. The base revision always adopts what storage
 * acknowledged, even when a newer edit queued during the write; failed saves keep the
 * working record in memory so the caller can still export it.
 */
export class Autosave {
	#record: CardRecord;
	readonly #documentId: string;
	#status: AutosaveStatus = 'saved';
	#timer: ReturnType<typeof setTimeout> | undefined;
	#version = 0;
	#dirty = false;
	#inFlight: Promise<CardRecord | null> | null = null;
	#disposed = false;

	constructor(
		record: CardRecord,
		private readonly save: SaveFunction,
		private readonly options: AutosaveOptions = {}
	) {
		this.#record = record;
		this.#documentId = record.document.id;
	}

	get record(): CardRecord {
		return this.#record;
	}

	get status(): AutosaveStatus {
		return this.#status;
	}

	update(record: CardRecord): void {
		if (this.#disposed) return;
		if (record.document.id !== this.#documentId) {
			throw new Error('This autosave belongs to a different card.');
		}
		this.#record = record;
		this.#version += 1;
		this.#dirty = true;
		this.#setStatus('dirty');
		this.#schedule();
	}

	async flush(): Promise<CardRecord | null> {
		if (this.#disposed) return null;
		this.#clearTimer();
		while (this.#inFlight) {
			if (!(await this.#inFlight)) return null;
		}
		if (this.#disposed) return null;
		if (!this.#dirty) return this.#record;
		const saved = await this.#saveNow();
		return saved && this.#dirty && !this.#disposed ? this.flush() : saved;
	}

	dispose(): void {
		this.#disposed = true;
		this.#clearTimer();
	}

	#schedule(): void {
		this.#clearTimer();
		this.#timer = setTimeout(() => {
			this.#timer = undefined;
			void this.flush();
		}, this.options.debounceMs ?? 600);
	}

	#clearTimer(): void {
		if (this.#timer !== undefined) {
			clearTimeout(this.#timer);
			this.#timer = undefined;
		}
	}

	async #saveNow(): Promise<CardRecord | null> {
		if (this.#disposed) return null;
		const version = this.#version;
		const pending = this.#record;
		this.#setStatus('saving');

		this.#inFlight = this.save(pending)
			.then((saved) => {
				if (this.#disposed) return saved;

				// A newer edit may have arrived mid-write. Keep its content but adopt the
				// revision storage acknowledged, so the next write is not falsely stale.
				const adopted =
					version === this.#version
						? saved
						: {
								...this.#record,
								document: { ...this.#record.document, revision: saved.document.revision }
							};

				this.#record = adopted;
				this.options.onSaved?.(adopted);

				if (version === this.#version) {
					this.#dirty = false;
					this.#setStatus('saved');
				} else {
					this.#dirty = true;
					this.#setStatus('dirty');
					this.#schedule();
				}
				return adopted;
			})
			.catch((error: unknown) => {
				if (this.#disposed) return null;
				this.#dirty = true;
				this.#setStatus(
					error instanceof RevisionConflictError ? 'conflict' : 'error',
					message(error)
				);
				return null;
			});

		try {
			return await this.#inFlight;
		} finally {
			this.#inFlight = null;
		}
	}

	#setStatus(status: AutosaveStatus, detail?: string): void {
		if (status === this.#status && detail === undefined) return;
		this.#status = status;
		this.options.onStatus?.(status, detail);
	}
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
