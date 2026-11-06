import type { CardRecord, Format, GridDimension } from '#lib/card/types';

/** Lightweight library row: never includes artwork beyond the thumbnail. */
export interface CardSummary {
	id: string;
	title: string;
	gridColumns: GridDimension;
	gridRows: GridDimension;
	format: Format;
	itemCount: number;
	unplacedCount: number;
	updatedAt: string;
	revision: number;
	thumbnail: Blob | null;
}

export type { CardRecord };
