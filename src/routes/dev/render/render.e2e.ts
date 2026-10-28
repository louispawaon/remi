import { readFileSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';
import type { Format } from '#lib/card/types';

const BASE_URL = 'http://localhost:3000';

const DIMENSIONS: Record<Format, readonly [number, number]> = {
	'4:5': [1080, 1350],
	'3:4': [1080, 1440],
	'9:16': [1080, 1920],
	'1:1': [1080, 1080]
};

async function openHarness(page: import('@playwright/test').Page) {
	await page.goto('/dev/render');
	await page.waitForFunction(() => Boolean(window.__remiHarness?.state()));
}

function readPngSize(bytes: Buffer): [number, number] {
	expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
	return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test('renders all 24 grid, format and resolution combinations at exact dimensions', async ({
	page
}) => {
	await openHarness(page);
	const results = await page.evaluate(() => window.__remiHarness!.renderMatrix());
	expect(results).toHaveLength(24);

	for (const result of results) {
		const [width, height] = DIMENSIONS[result.format];
		expect({
			grid: result.gridSize,
			format: result.format,
			resolution: result.resolution,
			width: result.width,
			height: result.height
		}).toEqual({
			grid: result.gridSize,
			format: result.format,
			resolution: result.resolution,
			width: width * result.resolution,
			height: height * result.resolution
		});
	}
});

test('downloads and opens a PNG at exact dimensions in a mobile viewport', async ({ browser }) => {
	const context = await browser.newContext({ ...devices['Pixel 7'] });
	const page = await context.newPage();
	await page.goto(`${BASE_URL}/dev/render`);
	await page.waitForFunction(() => Boolean(window.__remiHarness?.state()));

	await page.getByTestId('grid').selectOption('3');
	await page.getByTestId('format').selectOption('9:16');
	await page.getByTestId('resolution').selectOption('2');
	await page.getByTestId('render').click();
	await expect(page.getByTestId('status')).toContainText('2160 × 3840');

	const downloadPromise = page.waitForEvent('download');
	await page.getByTestId('download-png').click();
	const download = await downloadPromise;
	const path = await download.path();
	expect(path).toBeTruthy();
	expect(readPngSize(readFileSync(path!))).toEqual([2160, 3840]);

	const popupPromise = context.waitForEvent('page');
	await page.getByTestId('open-image').click();
	const popup = await popupPromise;
	await popup.waitForLoadState();
	expect(popup.url()).toMatch(/^blob:/);
	await expect.poll(() => popup.evaluate(() => document.images[0]?.naturalWidth ?? 0)).toBe(2160);

	await context.close();
});

test('restores an exported project offline with identical state, artwork and crops', async ({
	browser
}) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`${BASE_URL}/dev/render`);
	await page.waitForFunction(() => Boolean(window.__remiHarness?.state()));

	const before = await page.evaluate(() => window.__remiHarness!.render(5, '4:5', 1));
	const beforeState = await page.evaluate(() => window.__remiHarness!.state());
	expect(beforeState?.items.length).toBeGreaterThan(0);

	const downloadPromise = page.waitForEvent('download');
	await page.getByTestId('export-project').click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/\.remi$/);
	const projectPath = await download.path();

	const offline = await browser.newContext();
	const externalRequests: string[] = [];
	await offline.route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
			await route.continue();
		} else {
			externalRequests.push(url.href);
			await route.abort();
		}
	});

	const restored = await offline.newPage();
	await restored.goto(`${BASE_URL}/dev/render`);
	await restored.waitForFunction(() => Boolean(window.__remiHarness?.state()));
	await restored.getByTestId('import-input').setInputFiles(projectPath!);
	await expect(restored.getByTestId('status')).toContainText('Imported');

	const afterState = await restored.evaluate(() => window.__remiHarness!.state());
	const after = await restored.evaluate(() => window.__remiHarness!.renderCurrent(1));

	expect(afterState).toEqual(beforeState);
	expect(after.samples).toEqual(before.samples);
	expect(externalRequests).toEqual([]);

	await offline.close();
	await context.close();
});

test('fails visibly when referenced artwork is missing', async ({ page }) => {
	await openHarness(page);
	const message = await page.evaluate(() => window.__remiHarness!.missingArtworkError());
	expect(message).toMatch(/missing artwork/i);
});
