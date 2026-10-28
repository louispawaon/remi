import { readProjectArchive } from '#lib/card/archive';
import type { CardRecord } from '#lib/card/types';
import { verifyCardArtwork } from '#lib/card/verify';
import { createCard } from './store';
import { createThumbnail } from './thumbnail';

/** Parse, validate, decode-check, thumbnail, then persist as a brand-new card. */
export async function importProjectFile(bytes: Uint8Array): Promise<CardRecord> {
	const parsed = readProjectArchive(bytes);
	await verifyCardArtwork(parsed);
	const thumbnail = await createThumbnail(parsed);
	return createCard(parsed, { thumbnail });
}
