export interface CacheOptions {
	ttlMs: number;
	maxEntries: number;
	now?: () => number;
}

/** Small bounded TTL/LRU cache for provider responses. */
export class TTLCache<T> {
	#entries = new Map<string, { value: T; expires: number }>();
	readonly #ttlMs: number;
	readonly #maxEntries: number;
	readonly #now: () => number;

	constructor(options: CacheOptions) {
		this.#ttlMs = options.ttlMs;
		this.#maxEntries = options.maxEntries;
		this.#now = options.now ?? Date.now;
	}

	get(key: string): T | undefined {
		const entry = this.#entries.get(key);
		if (!entry) return undefined;
		if (entry.expires <= this.#now()) {
			this.#entries.delete(key);
			return undefined;
		}
		this.#entries.delete(key);
		this.#entries.set(key, entry);
		return entry.value;
	}

	set(key: string, value: T, ttlMs = this.#ttlMs): void {
		if (this.#entries.size >= this.#maxEntries) {
			const oldest = this.#entries.keys().next().value;
			if (oldest !== undefined) this.#entries.delete(oldest);
		}
		this.#entries.set(key, { value, expires: this.#now() + ttlMs });
	}

	get size(): number {
		return this.#entries.size;
	}
}
