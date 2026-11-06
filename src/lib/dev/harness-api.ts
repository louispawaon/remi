import type { CardDocument, Format, GridDimension, Resolution } from '#lib/card/types';

export interface HarnessRenderResult {
	width: number;
	height: number;
	/** RGBA samples at cell centres, used to prove artwork survived a round-trip. */
	samples: number[][];
}

export interface HarnessMatrixEntry {
	gridColumns: GridDimension;
	gridRows: GridDimension;
	format: Format;
	resolution: Resolution;
	width: number;
	height: number;
}

/** Test-only surface exposed by the diagnostic harness route. */
export interface HarnessApi {
	renderMatrix(): Promise<HarnessMatrixEntry[]>;
	render(
		gridColumns: GridDimension,
		gridRows: GridDimension,
		format: Format,
		resolution: Resolution
	): Promise<HarnessRenderResult>;
	renderCurrent(resolution?: Resolution): Promise<HarnessRenderResult>;
	state(): CardDocument | null;
	importBytes(bytes: number[]): Promise<void>;
	missingArtworkError(): Promise<string | null>;
}
