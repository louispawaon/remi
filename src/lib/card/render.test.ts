import { describe, expect, it } from 'vitest';
import { computeLayout } from './layout';
import type { LegendPlan } from './legend';
import { CARD_FOOTER, drawCard, type DrawableArtwork } from './render';
import type { CardDocument, CardItem, Format } from './types';

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
		schemaVersion: 3,
		id: 'card',
		title: '',
		gridColumns: 3,
		gridRows: 3,
		format,
		freeSpace: false,
		appearance: {
			titles: 'off',
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
	return computeLayout({ gridColumns: 3, gridRows: 3, format, freeSpace: false, resolution: 1 });
}

function item(id: string, title: string): CardItem {
	return {
		id,
		category: 'movie',
		sourceId: null,
		titles: { preferred: title, alternatives: [] },
		titleOverride: null,
		artwork: { id: `art-${id}`, type: 'image/png', width: 100, height: 100 },
		crops: {}
	};
}

function cardWithItems(titles: string, mode: CardDocument['appearance']['titles'] = 'index') {
	const document = card();
	document.appearance.titles = mode;
	document.items = titles.split('|').map((title, index) => item(`i${index}`, title));
	const slots: (string | null)[] = document.items.map((entry) => entry.id);
	while (slots.length < 9) slots.push(null);
	document.slots = slots;
	return document;
}

const artwork = { width: 100, height: 100 } as unknown as DrawableArtwork;

function legend(): LegendPlan {
	return {
		fontSize: 14,
		lineHeight: 19,
		numberWidth: 20,
		numberGap: 8,
		columns: [
			{
				x: 0,
				width: 984,
				entries: [
					{ number: '01', lines: ['First title'], y: 12 },
					{ number: '02', lines: ['Second title'], y: 35 }
				]
			}
		],
		height: 80,
		truncated: false
	};
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

describe('numbered index', () => {
	it('replaces cell captions with plate numbers', () => {
		const { ctx, texts } = fakeContext();
		drawCard(ctx, {
			document: cardWithItems('First title|Second title'),
			layout: layoutFor(),
			resolveArtwork: () => artwork
		});

		expect(texts.map((entry) => entry.text)).toEqual(expect.arrayContaining(['01', '02']));
		expect(texts.some((entry) => entry.text.includes('First title'))).toBe(false);
	});

	it('keeps captions in cells mode and draws no numbers', () => {
		const { ctx, texts } = fakeContext();
		drawCard(ctx, {
			document: cardWithItems('First title|Second title', 'cells'),
			layout: layoutFor(),
			resolveArtwork: () => artwork
		});

		expect(texts.some((entry) => entry.text === 'First title')).toBe(true);
		expect(texts.some((entry) => entry.text === '01')).toBe(false);
	});

	it('prints every key entry and puts the credit below the list', () => {
		const { ctx, texts } = fakeContext();
		const layout = computeLayout({
			gridColumns: 3,
			gridRows: 3,
			format: '4:5',
			freeSpace: false,
			resolution: 1,
			legendHeight: 80
		});
		drawCard(ctx, {
			document: cardWithItems('First title|Second title'),
			layout,
			resolveArtwork: () => artwork,
			legend: legend()
		});

		expect(texts.map((entry) => entry.text)).toEqual(
			expect.arrayContaining(['01', 'First title', '02', 'Second title'])
		);
		const footer = texts.find((entry) => entry.text === CARD_FOOTER)!;
		expect(footer.y).toBeGreaterThan(layout.legend.y + layout.legend.height);
	});
});
