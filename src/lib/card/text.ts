export type Measure = (text: string) => number;

const ELLIPSIS = '…';

export function wrapText(text: string, maxWidth: number, measure: Measure, maxLines = 2): string[] {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (normalized === '') return [''];

	const lines = breakLines(normalized, maxWidth, measure);
	if (lines.length <= maxLines) return lines;

	const kept = lines.slice(0, maxLines);
	kept[maxLines - 1] = addEllipsis(kept[maxLines - 1], maxWidth, measure);
	return kept;
}

export function truncateText(text: string, maxWidth: number, measure: Measure): string {
	return wrapText(text, maxWidth, measure, 1)[0];
}

/** Greedy character wrap that prefers the last space, so CJK and Latin both break sensibly. */
function breakLines(text: string, maxWidth: number, measure: Measure): string[] {
	const lines: string[] = [];
	let line = '';

	for (const char of Array.from(text)) {
		const candidate = line + char;
		if (line !== '' && measure(candidate) > maxWidth) {
			const space = line.lastIndexOf(' ');
			if (space > 0) {
				lines.push(line.slice(0, space));
				line = line.slice(space + 1) + char;
			} else {
				lines.push(line);
				line = char;
			}
		} else {
			line = candidate;
		}
	}

	if (line !== '') lines.push(line);
	return lines
		.map((entry) => entry.trim())
		.filter((entry, index, all) => entry || all.length === 1);
}

function addEllipsis(line: string, maxWidth: number, measure: Measure): string {
	let trimmed = line;
	while (trimmed.length > 0 && measure(trimmed + ELLIPSIS) > maxWidth) {
		trimmed = trimmed.slice(0, -1).trimEnd();
	}
	return trimmed + ELLIPSIS;
}
