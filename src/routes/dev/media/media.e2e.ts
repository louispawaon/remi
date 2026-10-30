import { expect, test, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

async function openMedia(page: Page) {
	await page.goto('/dev/media');
	await page.waitForFunction(() => Boolean(window.__remiMedia));
}

test('normalizes a large upload to the 1600px stored contract', async ({ page }) => {
	await openMedia(page);
	const png = await page.evaluate(() => window.__remiMedia!.createPng(2400, 1200));
	const result = await page.evaluate(
		(data) => window.__remiMedia!.normalize(data, 'image/png'),
		png
	);

	expect(result.width).toBe(1600);
	expect(result.height).toBe(800);
	expect(['image/webp', 'image/png']).toContain(result.type);
	expect(result.size).toBeGreaterThan(0);
	expect(result.size).toBeLessThanOrEqual(8 * 1024 * 1024);
});

test('rejects unsupported and oversized uploads with an actionable message', async ({ page }) => {
	await openMedia(page);

	await page.getByTestId('upload').setInputFiles({
		name: 'vector.svg',
		mimeType: 'image/svg+xml',
		buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')
	});
	await expect(page.getByTestId('status')).toHaveText(/PNG, JPEG, or WebP/);

	await page.getByTestId('upload').setInputFiles({
		name: 'huge.png',
		mimeType: 'image/png',
		buffer: Buffer.alloc(10 * 1024 * 1024 + 1)
	});
	await expect(page.getByTestId('status')).toHaveText(/10 MiB/);
});

test('rejects invalid requests and unsafe image paths', async ({ page }) => {
	const missing = await page.request.get(`${BASE_URL}/api/media/search`);
	expect(missing.status()).toBe(400);
	expect((await missing.json()).error).toBe('invalid_request');

	const noQuery = await page.request.get(`${BASE_URL}/api/media/search?category=anime&mode=search`);
	expect(noQuery.status()).toBe(400);

	const badHost = await page.request.get(
		`${BASE_URL}/api/media/image?${new URLSearchParams({
			provider: 'anilist',
			path: 'https://evil.example/file/anilistcdn/x.jpg'
		})}`
	);
	expect(badHost.status()).toBe(400);

	const traversal = await page.request.get(
		`${BASE_URL}/api/media/image?${new URLSearchParams({
			provider: 'tmdb',
			path: '/t/p/../../etc/passwd'
		})}`
	);
	expect(traversal.status()).toBe(400);

	const badOptions = await page.request.get(`${BASE_URL}/api/media/options?category=nope`);
	expect(badOptions.status()).toBe(400);
});

test('credits page carries the required attribution', async ({ page }) => {
	await page.goto('/credits');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Credits');
	await expect(page.getByText(/not endorsed or certified by TMDB/)).toBeVisible();
	await expect(page.locator('main')).toContainText('needs no account or token');
	await expect(page.locator('main')).toContainText('Deezer');
	await expect(page.locator('main')).toContainText('TheGamesDB');
});
