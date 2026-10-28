import { strFromU8, strToU8, unzipSync, zipSync, Zip, ZipPassThrough } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
	ARCHIVE_LIMITS,
	createProjectArchive,
	PROJECT_MANIFEST_PATH,
	readProjectArchive
} from './archive';
import { createFixtureDocument } from './fixture';
import type { CardRecord } from './types';

// Smallest valid PNG (1x1, transparent).
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

function makeRecord(): CardRecord {
	const document = createFixtureDocument();
	const artwork: Record<string, Blob> = {};
	for (const item of document.items) {
		if (item.artwork && !artwork[item.artwork.id]) {
			artwork[item.artwork.id] = new Blob([TINY_PNG], { type: item.artwork.type });
		}
	}
	return { document, artwork };
}

async function manifestOf(record: CardRecord) {
	const archive = await createProjectArchive(record);
	const files = unzipSync(archive);
	return JSON.parse(strFromU8(files[PROJECT_MANIFEST_PATH])) as Record<string, unknown>;
}

interface MutableManifest {
	schemaVersion: number;
	document: Record<string, unknown> & { slots: unknown[]; title: string };
	artwork: unknown[];
}

async function archiveWithManifest(
	record: CardRecord,
	mutate: (manifest: MutableManifest) => void
) {
	const archive = await createProjectArchive(record);
	const files = unzipSync(archive);
	const manifest = JSON.parse(strFromU8(files[PROJECT_MANIFEST_PATH])) as MutableManifest;
	mutate(manifest);
	files[PROJECT_MANIFEST_PATH] = strToU8(JSON.stringify(manifest));
	return zipSync(files);
}

function zipWithDuplicateEntry(manifest: Uint8Array): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		const chunks: Uint8Array[] = [];
		const zip = new Zip((error, data, final) => {
			if (error) reject(error);
			else {
				chunks.push(data);
				if (final) {
					const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
					const output = new Uint8Array(length);
					let offset = 0;
					for (const chunk of chunks) {
						output.set(chunk, offset);
						offset += chunk.length;
					}
					resolve(output);
				}
			}
		});
		for (let copy = 0; copy < 2; copy++) {
			const entry = new ZipPassThrough(PROJECT_MANIFEST_PATH);
			zip.add(entry);
			entry.push(manifest, true);
		}
		zip.end();
	});
}

describe('project archive', () => {
	it('round-trips the document and every artwork blob, including unplaced items', async () => {
		const record = makeRecord();
		const archive = await createProjectArchive(record);
		const restored = readProjectArchive(archive);

		expect(restored.document).toEqual(record.document);
		expect(Object.keys(restored.artwork).sort()).toEqual(Object.keys(record.artwork).sort());
		expect(Object.keys(restored.artwork)).toContain('art-unplaced');

		for (const [id, blob] of Object.entries(record.artwork)) {
			expect(new Uint8Array(await restored.artwork[id].arrayBuffer())).toEqual(
				new Uint8Array(await blob.arrayBuffer())
			);
			expect(restored.artwork[id].type).toBe(blob.type);
		}
	});

	it('excludes credentials and temporary urls from the manifest', async () => {
		const manifest = await manifestOf(makeRecord());
		const serialized = JSON.stringify(manifest);
		expect(serialized).not.toMatch(/token|api[_-]?key|https?:\/\//i);
	});

	it('rejects unsupported schema versions', async () => {
		const bytes = await archiveWithManifest(makeRecord(), (manifest) => {
			manifest.schemaVersion = 2;
		});
		expect(() => readProjectArchive(bytes)).toThrow(/schema/i);
	});

	it('rejects malformed manifests', async () => {
		const archive = await createProjectArchive(makeRecord());
		const files = unzipSync(archive);
		files[PROJECT_MANIFEST_PATH] = strToU8('{not json');
		expect(() => readProjectArchive(zipSync(files))).toThrow(/manifest/i);
	});

	it('rejects slots that do not match the grid', async () => {
		const bytes = await archiveWithManifest(makeRecord(), (manifest) => {
			manifest.document.slots = manifest.document.slots.slice(1);
		});
		expect(() => readProjectArchive(bytes)).toThrow(/slot/i);
	});

	it('rejects missing artwork files', async () => {
		const archive = await createProjectArchive(makeRecord());
		const files = unzipSync(archive);
		const artworkPath = Object.keys(files).find((path) => path.startsWith('artwork/'));
		delete files[artworkPath!];
		expect(() => readProjectArchive(zipSync(files))).toThrow(/missing/i);
	});

	it('rejects unknown files that are not declared in the manifest', async () => {
		const archive = await createProjectArchive(makeRecord());
		const files = unzipSync(archive);
		files['artwork/extra.bin'] = new Uint8Array([1, 2, 3]);
		expect(() => readProjectArchive(zipSync(files))).toThrow(/unexpected/i);
	});

	it('rejects unsafe archive paths', async () => {
		const manifest = strToU8(JSON.stringify(await manifestOf(makeRecord())));
		const archive = zipSync({
			[PROJECT_MANIFEST_PATH]: manifest,
			'../escape.txt': new Uint8Array([1])
		});
		expect(() => readProjectArchive(archive)).toThrow(/path/i);
	});

	it('rejects duplicate entries', async () => {
		const manifest = strToU8(JSON.stringify(await manifestOf(makeRecord())));
		const bytes = await zipWithDuplicateEntry(manifest);
		expect(() => readProjectArchive(bytes)).toThrow(/duplicate/i);
	});

	it('rejects archives with too many entries', async () => {
		const manifest = strToU8(JSON.stringify(await manifestOf(makeRecord())));
		const files: Record<string, Uint8Array> = { [PROJECT_MANIFEST_PATH]: manifest };
		for (let index = 0; index < ARCHIVE_LIMITS.entries; index++) {
			files[`artwork/${index}.bin`] = new Uint8Array([index % 255]);
		}
		expect(() => readProjectArchive(zipSync(files))).toThrow(/entries/i);
	});

	it('rejects manifests larger than the limit', async () => {
		const bytes = await archiveWithManifest(makeRecord(), (manifest) => {
			manifest.document.title = 'x'.repeat(ARCHIVE_LIMITS.manifestBytes);
		});
		expect(() => readProjectArchive(bytes)).toThrow(/manifest/i);
	});

	it('rejects archives whose expanded size exceeds the limit', async () => {
		const manifest = strToU8(JSON.stringify(await manifestOf(makeRecord())));
		const bytes = zipSync({
			[PROJECT_MANIFEST_PATH]: manifest,
			'artwork/bomb.bin': new Uint8Array(ARCHIVE_LIMITS.expandedBytes + 1)
		});
		expect(() => readProjectArchive(bytes)).toThrow(/size/i);
	});
});
