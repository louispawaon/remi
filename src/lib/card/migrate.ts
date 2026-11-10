import { CARD_SCHEMA_VERSION, type CardAppearance, type CardDocument } from './types';

type LegacyAppearance = Omit<CardAppearance, 'titles'> & {
	titles?: CardAppearance['titles'];
	titleVisible?: boolean;
};

type LegacyDocument = Omit<
	CardDocument,
	'schemaVersion' | 'gridColumns' | 'gridRows' | 'appearance'
> & {
	schemaVersion: number;
	gridSize?: number;
	gridColumns?: number;
	gridRows?: number;
	appearance?: LegacyAppearance;
};

/** Upgrade cards loaded from older storage and archives to the current schema. */
export function upgradeDocument(document: CardDocument): CardDocument {
	const legacy = document as unknown as LegacyDocument;
	let columns = legacy.gridColumns;
	let rows = legacy.gridRows;
	if (
		(typeof columns !== 'number' || typeof rows !== 'number') &&
		typeof legacy.gridSize === 'number'
	) {
		columns = legacy.gridSize;
		rows = legacy.gridSize;
	}
	if (typeof columns !== 'number' || typeof rows !== 'number') return document;

	const rest = { ...legacy };
	delete rest.gridSize;

	return {
		...rest,
		schemaVersion: CARD_SCHEMA_VERSION,
		gridColumns: columns,
		gridRows: rows,
		appearance: upgradeAppearance(legacy.appearance)
	} as CardDocument;
}

/** Version 2 stored one boolean for both the heading and the cell captions. */
export function upgradeAppearance(appearance: LegacyAppearance | undefined): CardAppearance {
	if (!appearance)
		return { titles: 'cells', background: '#0c0c0f', foreground: '#f6ebc0', font: 'display' };
	const { titleVisible, ...rest } = appearance;
	return {
		...rest,
		titles: appearance.titles ?? (titleVisible === false ? 'off' : 'cells')
	} as CardAppearance;
}
