import { describe, expect, it } from 'vitest';
import { optionalSecret } from './env';

describe('optionalSecret', () => {
	it('treats absent and blank values as missing', () => {
		expect(optionalSecret(undefined)).toBeUndefined();
		expect(optionalSecret('')).toBeUndefined();
		expect(optionalSecret('   ')).toBeUndefined();
	});

	it('returns the trimmed secret when configured', () => {
		expect(optionalSecret(' abc123 ')).toBe('abc123');
	});
});
