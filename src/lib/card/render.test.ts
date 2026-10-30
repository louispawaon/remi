import { describe, expect, it } from 'vitest';
import { computeLayout } from './layout';
import { CARD_FOOTER, drawCard } from './render';
import type { CardDocument, Format } from './types';

function fakeContext() {
	const texts: { text: string; x: number; y: number }[] = [];
	const ctx = {
		fillStyle: '',
		font: '',
		textAlign: 'left',
		textBaseline: 'alphabetic',
		globalAlpha: 1,
		strokeStyle: '',
		lineWidth: 0,
		save() {},
		restore() {},
		fillRect() {},
		clearRect() {},
		beginPath() {},
		rect() {},
		clip() {},
		drawImage() {},
		strokeRect() {},
		fillText(text: string, x: number, y: number) {
			texts.push({ text, x, y });
		},
		measureText(text: string) {
			return { width: text.length * 10 };
		}
	};
	return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

function card(format: Format = '4:5'): CardDocument {
	return {
		schemaVersion: 1,
		id: 'card',
		title: '',
		gridSize: 3,
		format,
		freeSpace: false,
		appearance: {
			titleVisible: false,
			background: '#000000',
			foreground: '#ffffff',
			font: 'sans'
		},
		items: [],
		slots: Array.from({ length: 9 }, () => null),
		createdAt: '',
		updatedAt: '',
		revision: 1
	};
}

function layoutFor(format: Format = '4:5') {
	return computeLayout({ gridSize: 3, format, freeSpace: false, resolution: 1 });
}

describe('card footer', () => {
	it('prints the production link below the grid', () => {
		const { ctx, texts } = fakeContext();
		const layout = layoutFor();
		drawCard(ctx, { document: card(), layout, resolveArtwork: () => undefined });

		const footer = texts.find((entry) => entry.text === CARD_FOOTER);
		expect(footer).toBeDefined();
		expect(footer!.y).toBeGreaterThan(layout.grid.y + layout.grid.height);
	});

	it.each(['4:5', '3:4', '9:16', '1:1'] as const)(
		'prints the link just under the %s grid',
		(format) => {
			const { ctx, texts } = fakeContext();
			const layout = layoutFor(format);
			drawCard(ctx, { document: card(format), layout, resolveArtwork: () => undefined });

			const footer = texts.find((entry) => entry.text === CARD_FOOTER)!;
			const gridBottom = layout.grid.y + layout.grid.height;
			expect(footer.y).toBeGreaterThan(gridBottom);
			expect(footer.y - gridBottom).toBeLessThanOrEqual(40);
		}
	);

	it('keeps the story credit above the Instagram safe area', () => {
		const { ctx, texts } = fakeContext();
		const layout = layoutFor('9:16');
		drawCard(ctx, { document: card('9:16'), layout, resolveArtwork: () => undefined });

		const footer = texts.find((entry) => entry.text === CARD_FOOTER)!;
		expect(footer.y).toBeLessThan(1920 - 240);
	});

	it('omits the link when the render opts out', () => {
		const { ctx, texts } = fakeContext();
		drawCard(ctx, {
			document: card(),
			layout: layoutFor(),
			resolveArtwork: () => undefined,
			footer: false
		});
		expect(texts.some((entry) => entry.text === CARD_FOOTER)).toBe(false);
	});
});
