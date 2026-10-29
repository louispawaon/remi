export const CARD_SCHEMA_VERSION = 1;

export const CATEGORIES = ['anime', 'manga', 'manhwa', 'manhua', 'movie', 'tv', 'music'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Offered by the add panel. Manga search covers manhwa and manhua too. */
export const ADD_CATEGORIES = ['anime', 'manga', 'movie', 'tv', 'music'] as const;

export const GRID_SIZES = [3, 4, 5] as const;
export type GridSize = (typeof GRID_SIZES)[number];

export const FORMATS = ['4:5', '3:4', '9:16', '1:1'] as const;
export type Format = (typeof FORMATS)[number];

export type Resolution = 1 | 2;

export const ARTWORK_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ArtworkType = (typeof ARTWORK_TYPES)[number];

export const FONT_CHOICES = ['sans', 'serif', 'display'] as const;
export type FontChoice = (typeof FONT_CHOICES)[number];

export const CARD_LIMITS = {
	maxItems: 100,
	maxArtworkBytes: 8 * 1024 * 1024,
	maxCardArtworkBytes: 40 * 1024 * 1024
} as const;

/** Normalized focal point for cover-cropping, where 0.5 is centered. */
export interface CropPosition {
	x: number;
	y: number;
}

export interface ArtworkRef {
	id: string;
	type: ArtworkType;
	width: number;
	height: number;
}

export interface CardItem {
	id: string;
	category: Category;
	/** Provider id, or null for uploads and text-only items. */
	sourceId: string | null;
	titles: {
		preferred: string;
		alternatives: string[];
	};
	titleOverride: string | null;
	/** null is an intentional text-only tile, not a missing image. */
	artwork: ArtworkRef | null;
	crops: Partial<Record<Format, CropPosition>>;
}

export interface CardAppearance {
	titleVisible: boolean;
	background: string;
	foreground: string;
	font: FontChoice;
}

/** Slot index holds an item id, or null for a deliberate blank cell. */
export type Slot = string | null;

export interface CardDocument {
	schemaVersion: typeof CARD_SCHEMA_VERSION;
	id: string;
	title: string;
	gridSize: GridSize;
	format: Format;
	freeSpace: boolean;
	appearance: CardAppearance;
	items: CardItem[];
	slots: Slot[];
	createdAt: string;
	updatedAt: string;
	revision: number;
}

/** A document together with its artwork bytes; the unit saved to IndexedDB and archives. */
export interface CardRecord {
	document: CardDocument;
	artwork: Record<string, Blob>;
}
