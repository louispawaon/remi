import { describe, expect, it, vi } from 'vitest';
import { createFixtureDocument } from '#lib/card/fixture';
import type { CardRecord } from '#lib/card/types';
import { Autosave, type AutosaveStatus } from './autosave';
import { RevisionConflictError, StorageWriteError } from './errors';

const record = (): CardRecord => ({ document: createFixtureDocument(), artwork: {} });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Autosave', () => {
	it('coalesces rapid edits into one debounced save', async () => {
		const saver = vi.fn(async (value: CardRecord) => value);
		const autosave = new Autosave(record(), saver, { debounceMs: 10 });

		autosave.update(record());
		autosave.update(record());
		autosave.update(record());

		await wait(30);
		expect(saver).toHaveBeenCalledTimes(1);
		expect(autosave.status).toBe('saved');
		autosave.dispose();
	});

	it('reports dirty, saving, then saved', async () => {
		const statuses: AutosaveStatus[] = [];
		const autosave = new Autosave(record(), async (value) => value, {
			onStatus: (status) => statuses.push(status)
		});

		autosave.update(record());
		await autosave.flush();

		expect(statuses).toEqual(['dirty', 'saving', 'saved']);
		autosave.dispose();
	});

	it('keeps the working record exportable after a failed save', async () => {
		const failing = vi.fn(async () => {
			throw new StorageWriteError('This browser is out of storage.');
		});
		const messages: string[] = [];
		const autosave = new Autosave(record(), failing, {
			onStatus: (_status, detail) => messages.push(detail ?? '')
		});

		const pending = { ...record(), document: { ...record().document, title: 'Unsaved work' } };
		autosave.update(pending);
		expect(await autosave.flush()).toBeNull();

		expect(autosave.status).toBe('error');
		expect(autosave.record.document.title).toBe('Unsaved work');
		expect(messages.join(' ')).toMatch(/out of storage/i);

		const succeeding = vi.fn(async (value: CardRecord) => value);
		const retry = new Autosave(autosave.record, succeeding, { debounceMs: 10 });
		expect(await retry.flush()).not.toBeNull();
		expect(retry.status).toBe('saved');
		autosave.dispose();
		retry.dispose();
	});

	it('surfaces a revision conflict without retrying', async () => {
		const conflict = vi.fn(async () => {
			throw new RevisionConflictError(4);
		});
		const statuses: AutosaveStatus[] = [];
		const autosave = new Autosave(record(), conflict, {
			debounceMs: 10,
			onStatus: (status) => statuses.push(status)
		});

		autosave.update(record());
		await wait(30);

		expect(statuses).toContain('conflict');
		expect(conflict).toHaveBeenCalledTimes(1);
		expect(autosave.status).toBe('conflict');
		autosave.dispose();
	});

	it('does not save after disposal', async () => {
		const saver = vi.fn(async (value: CardRecord) => value);
		const autosave = new Autosave(record(), saver, { debounceMs: 10 });

		autosave.update(record());
		autosave.dispose();
		await wait(30);

		expect(saver).not.toHaveBeenCalled();
	});
});
