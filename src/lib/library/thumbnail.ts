import type { CardRecord } from '#lib/card/types';
import { canvasToPng, renderCard } from '#lib/card/png';

/** Small library thumbnail; the sheet label carries the title, so the art stays clean. */
export async function createThumbnail(record: CardRecord, maxWidth = 360): Promise<Blob> {
	const preview: CardRecord = {
		...record,
		document: {
			...record.document,
			appearance: { ...record.document.appearance, titleVisible: false }
		}
	};
	const { canvas } = await renderCard(preview, 1);
	const scale = Math.min(1, maxWidth / canvas.width);
	const thumbnail = document.createElement('canvas');
	thumbnail.width = Math.max(1, Math.round(canvas.width * scale));
	thumbnail.height = Math.max(1, Math.round(canvas.height * scale));

	const context = thumbnail.getContext('2d');
	if (!context) throw new Error('Canvas 2D is unavailable');
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = 'high';
	context.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);

	const webp = await new Promise<Blob | null>((resolve) => {
		thumbnail.toBlob(resolve, 'image/webp', 0.82);
	});
	return webp ?? canvasToPng(thumbnail);
}
