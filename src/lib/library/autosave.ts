import { RevisionConflictError } from './errors';
import type { CardRecord } from '#lib/card/types';

export type AutosaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export type SaveFunction = (record: CardRecord) => Promise<CardRecord>;

export interface AutosaveOptions {
	debounceMs?: number;
	onStatus?: (status: AutosaveStatus, detail?: string) => void;
	onSaved?: (record: CardRecord) => void;
}

/**
 * Debounced, revision-aware saver. Failed saves keep the working record in memory so the
 * caller can still export it; a conflict stops retrying until the caller reloads.
 */
export class Autosave {
	#record: CardRecord;
	#status: AutosaveStatus = 'saved';
	#timer: ReturnType<typeof setTimeout> | undefined;
	#version = 0;
	#inFlight: Promise<CardRecord | null> | null = null;
	#disposed = false;

	constructor(
		record: CardRecord,
		private readonly save: SaveFunction,
		private readonly options: AutosaveOptions = {}
	) {
		this.#record = record;
	}

	get record(): CardRecord {
		return this.#record;
	}

	get status(): AutosaveStatus {
		return this.#status;
	}

	update(record: CardRecord): void {
		if (this.#disposed) return;
		this.#record = record;
		this.#version += 1;
		this.#setStatus('dirty');
		this.#schedule();
	}

	async flush(): Promise<CardRecord | null> {
		if (this.#disposed) return null;
		this.#clearTimer();
		if (this.#inFlight) await this.#inFlight;
		return this.#saveNow();
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
				if (version === this.#version) {
					this.#record = saved;
					this.#setStatus('saved');
					this.options.onSaved?.(saved);
				} else {
					// A newer edit arrived while saving; queue that one instead.
					this.#setStatus('dirty');
					this.#schedule();
				}
				return saved;
			})
			.catch((error: unknown) => {
				const conflict = error instanceof RevisionConflictError;
				this.#setStatus(conflict ? 'conflict' : 'error', message(error));
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
