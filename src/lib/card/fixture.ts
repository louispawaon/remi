import type { CardDocument, CardItem, Format, GridSize } from './types';

const TIMESTAMP = '2026-10-28T00:00:00.000Z';

const items: CardItem[] = [
	{
		id: 'jp',
		category: 'anime',
		sourceId: 'anilist:1',
		titles: {
			preferred: '東京リベンジャーズ 天竺編 特別編集版',
			alternatives: ['Tokyo Revengers']
		},
		titleOverride: null,
		artwork: { id: 'art-jp', type: 'image/png', width: 600, height: 900 },
		crops: { '4:5': { x: 0.5, y: 0.2 } }
	},
	{
		id: 'kr',
		category: 'manhwa',
		sourceId: 'anilist:2',
		titles: { preferred: '나 혼자만 레벨업', alternatives: ['Solo Leveling'] },
		titleOverride: null,
		artwork: { id: 'art-kr', type: 'image/jpeg', width: 600, height: 900 },
		crops: {}
	},
	{
		id: 'zh',
		category: 'manhua',
		sourceId: 'anilist:3',
		titles: { preferred: '魔道祖师 前尘篇', alternatives: ['Mo Dao Zu Shi'] },
		titleOverride: null,
		artwork: { id: 'art-zh', type: 'image/webp', width: 600, height: 900 },
		crops: {}
	},
	{
		id: 'latin',
		category: 'tv',
		sourceId: 'tmdb:4',
		titles: {
			preferred:
				'The Extraordinarily Long and Unabridged Title of a Very Long Running Television Series',
			alternatives: []
		},
		titleOverride: null,
		artwork: { id: 'art-latin', type: 'image/png', width: 900, height: 600 },
		crops: {}
	},
	{
		id: 'text-only',
		category: 'movie',
		sourceId: 'tmdb:5',
		titles: { preferred: 'Text Only Tile', alternatives: [] },
		titleOverride: null,
		artwork: null,
		crops: {}
	},
	{
		id: 'cropped',
		category: 'manga',
		sourceId: 'anilist:6',
		titles: { preferred: 'Cropped Artwork', alternatives: [] },
		titleOverride: null,
		artwork: { id: 'art-cropped', type: 'image/png', width: 800, height: 800 },
		crops: { '4:5': { x: 0, y: 0 }, '1:1': { x: 1, y: 1 } }
	},
	{
		id: 'unplaced-art',
		category: 'anime',
		sourceId: 'anilist:7',
		titles: { preferred: 'Unplaced Artwork', alternatives: [] },
		titleOverride: 'Renamed Title',
		artwork: { id: 'art-unplaced', type: 'image/png', width: 600, height: 900 },
		crops: { '9:16': { x: 0.25, y: 0.75 } }
	},
	{
		id: 'unplaced-text',
		category: 'manhwa',
		sourceId: null,
		titles: { preferred: 'Unplaced Text', alternatives: [] },
		titleOverride: null,
		artwork: null,
		crops: {}
	}
];

export interface FixtureOptions {
	gridSize?: GridSize;
	format?: Format;
	freeSpace?: boolean;
}

/** Deterministic card covering artwork, text-only, blank, free-space and unplaced states. */
export function createFixtureDocument(options: FixtureOptions = {}): CardDocument {
	const gridSize = options.gridSize ?? 5;
	const format = options.format ?? '4:5';
	const freeSpace = options.freeSpace ?? true;
	const slotCount = gridSize * gridSize;
	const freeCellIndex = freeSpace && gridSize % 2 === 1 ? (slotCount - 1) / 2 : null;

	const slots: (string | null)[] = Array.from({ length: slotCount }, () => null);
	const placeable = Array.from({ length: slotCount }, (_, index) => index).filter(
		(index) => index !== freeCellIndex
	);
	// Leave two blanks and two unplaced items so both states are always exercised.
	const placed = items.slice(0, Math.min(6, placeable.length - 2));
	placed.forEach((item, position) => {
		slots[placeable[position]] = item.id;
	});

	return {
		schemaVersion: 1,
		id: 'fixture-card',
		title: 'Remi fixture card',
		gridSize,
		format,
		freeSpace,
		appearance: {
			titleVisible: true,
			background: '#0c0c0f',
			foreground: '#f6ebc0',
			font: 'display'
		},
		items: items.map((item) => structuredClone(item)),
		slots,
		createdAt: TIMESTAMP,
		updatedAt: TIMESTAMP,
		revision: 1
	};
}

/** Every artwork id the fixture references, with its intended pixel dimensions. */
export const FIXTURE_ARTWORK = [
	{ id: 'art-jp', type: 'image/png', width: 600, height: 900 },
	{ id: 'art-kr', type: 'image/jpeg', width: 600, height: 900 },
	{ id: 'art-zh', type: 'image/webp', width: 600, height: 900 },
	{ id: 'art-latin', type: 'image/png', width: 900, height: 600 },
	{ id: 'art-cropped', type: 'image/png', width: 800, height: 800 },
	{ id: 'art-unplaced', type: 'image/png', width: 600, height: 900 }
] as const;
