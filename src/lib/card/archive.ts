import { strToU8, unzipSync, zipSync } from 'fflate';
import * as v from 'valibot';
import { isFreeSpaceCell } from './document';
import {
	ARTWORK_TYPES,
	CARD_LIMITS,
	CARD_SCHEMA_VERSION,
	CATEGORIES,
	FONT_CHOICES,
	FORMATS,
	type CardDocument,
	type CardRecord
} from './types';

export const ARCHIVE_LIMITS = {
	compressedBytes: 64 * 1024 * 1024,
	expandedBytes: 64 * 1024 * 1024,
	entries: 102,
	manifestBytes: 1024 * 1024
} as const;

export const PROJECT_MANIFEST_PATH = 'manifest.json';
const ARTWORK_DIRECTORY = 'artwork';

const cropSchema = v.strictObject({
	x: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
	y: v.pipe(v.number(), v.minValue(0), v.maxValue(1))
});

const artworkRefSchema = v.strictObject({
	id: v.pipe(v.string(), v.minLength(1)),
	type: v.picklist(ARTWORK_TYPES),
	width: v.pipe(v.number(), v.integer(), v.minValue(1)),
	height: v.pipe(v.number(), v.integer(), v.minValue(1))
});

const itemSchema = v.strictObject({
	id: v.pipe(v.string(), v.minLength(1)),
	category: v.picklist(CATEGORIES),
	sourceId: v.nullable(v.string()),
	titles: v.strictObject({
		preferred: v.string(),
		alternatives: v.array(v.string())
	}),
	titleOverride: v.nullable(v.string()),
	artwork: v.nullable(artworkRefSchema),
	crops: v.partial(
		v.strictObject({
			'4:5': cropSchema,
			'3:4': cropSchema,
			'9:16': cropSchema,
			'1:1': cropSchema
		})
	)
});

const documentSchema = v.strictObject({
	schemaVersion: v.literal(CARD_SCHEMA_VERSION),
	id: v.pipe(v.string(), v.minLength(1)),
	title: v.string(),
	gridSize: v.picklist([3, 4, 5]),
	format: v.picklist(FORMATS),
	freeSpace: v.boolean(),
	appearance: v.strictObject({
		titleVisible: v.boolean(),
		background: v.string(),
		foreground: v.string(),
		font: v.picklist(FONT_CHOICES)
	}),
	items: v.array(itemSchema),
	slots: v.array(v.nullable(v.string())),
	createdAt: v.string(),
	updatedAt: v.string(),
	revision: v.pipe(v.number(), v.integer(), v.minValue(0))
});

const manifestSchema = v.strictObject({
	schemaVersion: v.literal(CARD_SCHEMA_VERSION),
	document: documentSchema,
	artwork: v.array(
		v.strictObject({
			id: v.pipe(v.string(), v.minLength(1)),
			path: v.pipe(v.string(), v.minLength(1)),
			type: v.picklist(ARTWORK_TYPES),
			width: v.pipe(v.number(), v.integer(), v.minValue(1)),
			height: v.pipe(v.number(), v.integer(), v.minValue(1))
		})
	)
});

type Manifest = v.InferOutput<typeof manifestSchema>;
type ManifestArtwork = Manifest['artwork'][number];

const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;

function buildManifest(document: CardDocument): Manifest {
	const byId = new Map<string, ManifestArtwork>();
	for (const item of document.items) {
		if (!item.artwork) continue;
		const existing = byId.get(item.artwork.id);
		if (existing) {
			assertSameArtwork(existing, item.artwork);
		} else {
			byId.set(item.artwork.id, {
				...item.artwork,
				path: `${ARTWORK_DIRECTORY}/${byId.size}.${EXTENSIONS[item.artwork.type]}`
			});
		}
	}
	return {
		schemaVersion: CARD_SCHEMA_VERSION,
		document,
		artwork: [...byId.values()]
	};
}

function manifestByteLength(document: CardDocument): number {
	return strToU8(JSON.stringify(buildManifest(document))).byteLength;
}

/** Used by the editor to allow a card that is over budget to be shrunk back under it. */
export function projectManifestSize(document: CardDocument): number {
	return manifestByteLength(document);
}

/** Shared by editing, saving, and export so every accepted card stays portable. */
export function createProjectManifest(document: CardDocument): Manifest {
	const manifest = buildManifest(document);
	if (strToU8(JSON.stringify(manifest)).byteLength > ARCHIVE_LIMITS.manifestBytes) {
		throw new Error(
			'Project manifest exceeds the 1 MiB limit. Shorten the card title or captions.'
		);
	}
	return manifest;
}

export async function createProjectArchive(record: CardRecord): Promise<Uint8Array> {
	if (record.document.items.length > CARD_LIMITS.maxItems) {
		throw new Error(`Card has more than ${CARD_LIMITS.maxItems} items`);
	}

	const manifest = createProjectManifest(record.document);
	const files: Record<string, Uint8Array> = {};
	let artworkBytes = 0;
	for (const entry of manifest.artwork) {
		const blob = record.artwork[entry.id];
		if (!blob) throw new Error(`Cannot export project: artwork ${entry.id} is missing`);
		if (blob.size > CARD_LIMITS.maxArtworkBytes) {
			throw new Error(`Artwork ${entry.id} exceeds the ${CARD_LIMITS.maxArtworkBytes} byte limit`);
		}
		artworkBytes += blob.size;
		if (artworkBytes > CARD_LIMITS.maxCardArtworkBytes) {
			throw new Error(`Card artwork exceeds the ${CARD_LIMITS.maxCardArtworkBytes} byte limit`);
		}
		files[entry.path] = new Uint8Array(await blob.arrayBuffer());
	}
	files[PROJECT_MANIFEST_PATH] = strToU8(JSON.stringify(manifest));
	return zipSync(files, { level: 6 });
}

export function readProjectArchive(bytes: Uint8Array): CardRecord {
	if (bytes.byteLength > ARCHIVE_LIMITS.compressedBytes) {
		throw new Error(
			`Archive size ${bytes.byteLength} exceeds the ${ARCHIVE_LIMITS.compressedBytes} byte limit`
		);
	}

	// shortcut: synchronous unzip is acceptable while archives stay capped at 64 MiB;
	// move to a worker if import jank becomes user-visible.
	let expandedBytes = 0;
	let entryCount = 0;
	const names = new Set<string>();

	const files = unzipSync(bytes, {
		filter: (file) => {
			if (file.name.endsWith('/')) return false;
			if (file.compression === 0 && file.size !== file.originalSize) {
				throw new Error('Stored archive entry sizes are inconsistent');
			}
			if (++entryCount > ARCHIVE_LIMITS.entries) {
				throw new Error(`Archive has more than ${ARCHIVE_LIMITS.entries} entries`);
			}
			if (!isSafePath(file.name)) throw new Error(`Unsafe archive path: ${file.name}`);
			if (names.has(file.name)) throw new Error(`Duplicate archive entry: ${file.name}`);
			names.add(file.name);
			if (file.name === PROJECT_MANIFEST_PATH && file.originalSize > ARCHIVE_LIMITS.manifestBytes) {
				throw new Error(`Manifest exceeds the ${ARCHIVE_LIMITS.manifestBytes} byte limit`);
			}
			expandedBytes += file.originalSize;
			if (expandedBytes > ARCHIVE_LIMITS.expandedBytes) {
				throw new Error(
					`Expanded archive size exceeds the ${ARCHIVE_LIMITS.expandedBytes} byte limit`
				);
			}
			return true;
		}
	});

	const manifestBytes = files[PROJECT_MANIFEST_PATH];
	if (!manifestBytes) throw new Error('Project archive is missing its manifest');
	if (manifestBytes.byteLength > ARCHIVE_LIMITS.manifestBytes)
		throw new Error('Manifest exceeds its byte limit');

	let json: unknown;
	try {
		json = JSON.parse(new TextDecoder().decode(manifestBytes));
	} catch {
		throw new Error('Project manifest is not valid JSON');
	}

	const parsed = v.safeParse(manifestSchema, json);
	if (!parsed.success) {
		throw new Error(
			`Project manifest schema is invalid or unsupported: ${parsed.issues[0]?.message ?? 'unknown issue'}`
		);
	}
	const manifest = parsed.output;

	validateDocument(manifest);
	const artwork = collectArtwork(manifest, files);

	return { document: manifest.document, artwork };
}

function validateDocument(manifest: Manifest) {
	const { document, artwork } = manifest;
	const expectedSlots = document.gridSize * document.gridSize;
	if (document.slots.length !== expectedSlots) {
		throw new Error(
			`Slot count ${document.slots.length} does not match the ${document.gridSize}x${document.gridSize} grid`
		);
	}
	if (document.items.length > CARD_LIMITS.maxItems) {
		throw new Error(`Card has more than ${CARD_LIMITS.maxItems} items`);
	}

	const itemIds = new Set<string>();
	for (const item of document.items) {
		if (item.id === '__proto__') throw new Error('Reserved item id');
		if (itemIds.has(item.id)) throw new Error(`Duplicate item id: ${item.id}`);
		itemIds.add(item.id);
	}

	const placed = new Set<string>();
	for (let index = 0; index < document.slots.length; index++) {
		const slot = document.slots[index];
		if (slot === null) continue;
		if (!itemIds.has(slot)) throw new Error(`Slot references an unknown item: ${slot}`);
		if (isFreeSpaceCell(document, index)) {
			throw new Error(`Item ${slot} cannot occupy the free-space cell`);
		}
		if (placed.has(slot)) throw new Error(`Item ${slot} is placed in more than one slot`);
		placed.add(slot);
	}

	const artworkIds = new Set<string>();
	for (const entry of artwork) {
		if (entry.id === '__proto__') throw new Error('Reserved artwork id');
		if (artworkIds.has(entry.id)) throw new Error(`Duplicate artwork id: ${entry.id}`);
		artworkIds.add(entry.id);
	}

	const referenced = new Set<string>();
	for (const item of document.items) {
		if (!item.artwork) continue;
		const entry = artwork.find((candidate) => candidate.id === item.artwork!.id);
		if (!entry) throw new Error(`Missing artwork entry: ${item.artwork.id}`);
		assertSameArtwork(entry, item.artwork);
		referenced.add(item.artwork.id);
	}

	for (const entry of artwork) {
		if (!referenced.has(entry.id)) throw new Error(`Unreferenced artwork entry: ${entry.id}`);
	}
}

function collectArtwork(manifest: Manifest, files: Record<string, Uint8Array>) {
	const declared = new Set<string>([PROJECT_MANIFEST_PATH]);
	const artwork: Record<string, Blob> = {};
	let totalBytes = 0;

	for (const entry of manifest.artwork) {
		if (!isSafePath(entry.path)) throw new Error(`Unsafe artwork path: ${entry.path}`);
		if (declared.has(entry.path)) throw new Error(`Duplicate artwork path: ${entry.path}`);
		declared.add(entry.path);
		const data = files[entry.path];
		if (!data) throw new Error(`Project archive is missing artwork file ${entry.path}`);
		if (data.byteLength > CARD_LIMITS.maxArtworkBytes) {
			throw new Error(`Artwork ${entry.id} exceeds the ${CARD_LIMITS.maxArtworkBytes} byte limit`);
		}
		totalBytes += data.byteLength;
		if (totalBytes > CARD_LIMITS.maxCardArtworkBytes) {
			throw new Error(`Card artwork exceeds the ${CARD_LIMITS.maxCardArtworkBytes} byte limit`);
		}
		artwork[entry.id] = new Blob([new Uint8Array(data)], { type: entry.type });
	}

	for (const path of Object.keys(files)) {
		if (!declared.has(path)) throw new Error(`Unexpected file in project archive: ${path}`);
	}

	return artwork;
}

function assertSameArtwork(
	existing: { type: string; width: number; height: number },
	candidate: { type: string; width: number; height: number }
) {
	if (
		existing.type !== candidate.type ||
		existing.width !== candidate.width ||
		existing.height !== candidate.height
	) {
		throw new Error('Artwork metadata is inconsistent across items');
	}
}

function isSafePath(path: string) {
	if (!/^[A-Za-z0-9._/-]+$/.test(path)) return false;
	if (path.startsWith('/') || path.includes('\\')) return false;
	return path
		.split('/')
		.every(
			(segment) => segment !== '' && segment !== '.' && segment !== '..' && segment !== '__proto__'
		);
}
