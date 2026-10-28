import type { CardRecord, Format, GridSize } from '#lib/card/types';

/** Lightweight library row: never includes artwork beyond the thumbnail. */
export interface CardSummary {
	id: string;
	title: string;
	gridSize: GridSize;
	format: Format;
	itemCount: number;
	unplacedCount: number;
	updatedAt: string;
	revision: number;
	thumbnail: Blob | null;
}

export type { CardRecord };
