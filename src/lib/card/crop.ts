import type { CropPosition } from './types';

export interface SourceRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Cover-crop window for one image into a target rect, clamped to the image. */
export function coverCrop(
	imageWidth: number,
	imageHeight: number,
	targetWidth: number,
	targetHeight: number,
	crop: CropPosition
): SourceRect {
	if (imageWidth <= 0 || imageHeight <= 0) throw new Error('Artwork has no pixels');

	const scale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
	const width = targetWidth / scale;
	const height = targetHeight / scale;
	const maxX = imageWidth - width;
	const maxY = imageHeight - height;

	return {
		x: Math.min(Math.max(maxX * crop.x, 0), maxX),
		y: Math.min(Math.max(maxY * crop.y, 0), maxY),
		width,
		height
	};
}
