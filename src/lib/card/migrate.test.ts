import { describe, expect, it } from 'vitest';
import { createFixtureDocument } from './fixture';
import { upgradeDocument } from './migrate';
import type { CardDocument } from './types';

function legacy(version: number, titleVisible: boolean): CardDocument {
	const document = structuredClone(createFixtureDocument());
	const raw = document as unknown as Record<string, unknown> & {
		appearance: Record<string, unknown>;
	};
	raw.schemaVersion = version;
	raw.appearance = { ...raw.appearance, titleVisible };
	delete raw.appearance.titles;
	return document;
}

describe('upgradeDocument', () => {
	it('maps the old title toggle to captions or off', () => {
		expect(upgradeDocument(legacy(2, true)).appearance.titles).toBe('cells');
		expect(upgradeDocument(legacy(2, false)).appearance.titles).toBe('off');
	});

	it('upgrades a version 1 square grid and title toggle together', () => {
		const document = legacy(1, false);
		const raw = document as unknown as Record<string, unknown> & { gridSize?: number };
		raw.gridSize = 4;
		delete raw.gridColumns;
		delete raw.gridRows;

		const upgraded = upgradeDocument(document);
		expect(upgraded.schemaVersion).toBe(3);
		expect(upgraded.gridColumns).toBe(4);
		expect(upgraded.gridRows).toBe(4);
		expect(upgraded.appearance.titles).toBe('off');
	});
});
