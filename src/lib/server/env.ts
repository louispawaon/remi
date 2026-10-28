/** Blank or whitespace-only configuration reads as missing, not as a credential. */
export function optionalSecret(value: string | undefined): string | undefined {
	return value?.trim() || undefined;
}
