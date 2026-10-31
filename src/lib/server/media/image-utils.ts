export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_TYPES: Record<string, string> = {
	'image/png': 'image/png',
	'image/jpeg': 'image/jpeg',
	'image/jpg': 'image/jpeg',
	'image/webp': 'image/webp'
};

export function matchesSignature(type: string, bytes: Uint8Array): boolean {
	if (type === 'image/png') {
		const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		return signature.every((byte, index) => bytes[index] === byte);
	}
	if (type === 'image/jpeg') {
		return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	}
	if (type === 'image/webp') {
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
	return false;
}
