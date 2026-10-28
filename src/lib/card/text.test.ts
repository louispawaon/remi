import { describe, expect, it } from 'vitest';
import { truncateText, wrapText, type Measure } from './text';

// Deterministic stand-in for canvas measurement: CJK glyphs are twice as wide as Latin ones.
const measure: Measure = (text) =>
	Array.from(text).reduce((width, char) => width + (isWide(char) ? 20 : 10), 0);

function isWide(char: string) {
	return /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(char);
}

function fit(text: string, maxWidth: number, maxLines = 2) {
	const lines = wrapText(text, maxWidth, measure, maxLines);
	for (const line of lines) {
		expect(measure(line)).toBeLessThanOrEqual(maxWidth);
	}
	expect(lines.length).toBeLessThanOrEqual(maxLines);
	return lines;
}

describe('wrapText', () => {
	it('keeps text that fits on one line', () => {
		expect(fit('short title', 200)).toEqual(['short title']);
	});

	it('collapses whitespace and never returns an empty array', () => {
		expect(fit('  a   b  ', 200)).toEqual(['a b']);
		expect(wrapText('   ', 200, measure)).toEqual(['']);
	});

	it('breaks Latin text at spaces', () => {
		const lines = fit('one two three four five', 100);
		expect(lines.length).toBe(2);
		expect(lines[0]).toBe('one two');
	});

	it('breaks CJK text per character without needing spaces', () => {
		const lines = fit('東京リベンジャーズ', 100);
		expect(lines.length).toBe(2);
		expect(lines[0]).toHaveLength(5);
	});

	it('clamps to two lines and adds a visible ellipsis', () => {
		const lines = fit('東京リベンジャーズ天竺編特別編集版', 100);
		expect(lines).toHaveLength(2);
		expect(lines[1].endsWith('…')).toBe(true);
	});

	it('truncates long Latin and Korean titles with an ellipsis', () => {
		const latin = fit(
			'The Extraordinarily Long and Unabridged Title of a Very Long Running Television Series',
			120
		);
		expect(latin).toHaveLength(2);
		expect(latin[1].endsWith('…')).toBe(true);

		const korean = fit('나 혼자만 레벨업 특별 외전 합본판', 100);
		expect(korean).toHaveLength(2);
		expect(korean[1].endsWith('…')).toBe(true);
	});

	it('does not add an ellipsis when the text fits exactly', () => {
		const lines = fit('東京リベンジャーズ', 100);
		expect(lines.join('')).toBe('東京リベンジャーズ');
	});
});

describe('truncateText', () => {
	it('returns one line with an ellipsis only when needed', () => {
		expect(truncateText('abcdefghij', 200, measure)).toBe('abcdefghij');
		const truncated = truncateText('abcdefghijklmnop', 100, measure);
		expect(truncated.endsWith('…')).toBe(true);
		expect(measure(truncated)).toBeLessThanOrEqual(100);
	});
});
