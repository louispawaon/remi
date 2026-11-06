import { CARD_SCHEMA_VERSION, type CardDocument } from './types';

type LegacyDocument = Omit<CardDocument, 'schemaVersion' | 'gridColumns' | 'gridRows'> & {
	schemaVersion: number;
	gridSize?: number;
	gridColumns?: number;
	gridRows?: number;
};

/** Version 1 stored square cards as a single gridSize. */
export function upgradeDocument(document: CardDocument): CardDocument {
	const legacy = document as unknown as LegacyDocument;
	if (typeof legacy.gridColumns === 'number' && typeof legacy.gridRows === 'number') {
		return document;
	}
	if (typeof legacy.gridSize !== 'number') return document;

	const { gridSize, ...rest } = legacy;
	return {
		...rest,
		schemaVersion: CARD_SCHEMA_VERSION,
		gridColumns: gridSize,
		gridRows: gridSize
	} as CardDocument;
}
