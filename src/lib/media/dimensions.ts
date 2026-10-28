export interface ImageDimensions {
	width: number;
	height: number;
}

/** Read dimensions from headers so oversized images are rejected before decoding. */
export function sniffDimensions(bytes: Uint8Array): ImageDimensions | null {
	if (isPng(bytes)) {
		if (bytes.length < 24) return null;
		return { width: readU32(bytes, 16), height: readU32(bytes, 20) };
	}
	if (isJpeg(bytes)) return jpegDimensions(bytes);
	if (isWebp(bytes)) return webpDimensions(bytes);
	return null;
}

function isPng(bytes: Uint8Array) {
	return (
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	);
}

function isJpeg(bytes: Uint8Array) {
	return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array) {
	return (
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	);
}

function readU32(bytes: Uint8Array, offset: number) {
	return (
		((bytes[offset] << 24) |
			(bytes[offset + 1] << 16) |
			(bytes[offset + 2] << 8) |
			bytes[offset + 3]) >>>
		0
	);
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
	let offset = 2;
	while (offset + 9 < bytes.length) {
		if (bytes[offset] !== 0xff) {
			offset += 1;
			continue;
		}
		const marker = bytes[offset + 1];
		if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			offset += 2;
			continue;
		}
		const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
		if (length < 2) return null;
		const isStartOfFrame =
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf);
		if (isStartOfFrame) {
			return {
				height: (bytes[offset + 5] << 8) | bytes[offset + 6],
				width: (bytes[offset + 7] << 8) | bytes[offset + 8]
			};
		}
		offset += 2 + length;
	}
	return null;
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
	const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
	if (chunk === 'VP8X' && bytes.length >= 30) {
		return {
			width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
			height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
		};
	}
	if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
		const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
		return {
			width: 1 + (bits & 0x3fff),
			height: 1 + ((bits >> 14) & 0x3fff)
		};
	}
	if (chunk === 'VP8 ' && bytes.length >= 30) {
		return {
			width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
			height: (bytes[28] | (bytes[29] << 8)) & 0x3fff
		};
	}
	return null;
}
