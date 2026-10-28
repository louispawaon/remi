import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

function readPngSize(bytes: Buffer): [number, number] {
	expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
	return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

async function createCard(page: Page): Promise<string> {
	await page.goto('/');
	await page.getByTestId('new-card').click();
	await page.waitForURL(/\/editor\//);
	await page.waitForSelector('[data-testid="tabs"]');
	return page.url().split('/').pop()!;
}

async function seedFixture(page: Page): Promise<string> {
	await page.goto('/dev/library');
	await page.waitForFunction(() => Boolean(window.__remiLibrary));
	await page.evaluate(() => window.__remiLibrary!.reset());
	const id = await page.evaluate(() => window.__remiLibrary!.createFixture());
	await page.goto(`/editor/${id}`);
	await page.waitForSelector('[data-testid="tabs"]');
	await page.waitForTimeout(300);
	return id;
}

async function openExport(page: Page) {
	await page.getByRole('button', { name: 'Export', exact: true }).click();
	await expect(page.getByTestId('export-dialog')).toBeVisible();
}

test('creates a card, saves its title, reloads, and shows it in the library', async ({ page }) => {
	await createCard(page);
	await page.getByTestId('title').fill('Friday Night Rotation');
	await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 });

	await page.reload();
	await page.waitForSelector('[data-testid="title"]');
	await expect(page.getByTestId('title')).toHaveValue('Friday Night Rotation');

	await page.getByRole('button', { name: 'REMI' }).click();
	await page.waitForURL(/\/$/);
	await expect(page.getByTestId('card').first()).toContainText('Friday Night Rotation');
});

test('library renames, duplicates, and deletes independently', async ({ page }) => {
	await createCard(page);
	await page.getByTestId('title').fill('First sheet');
	await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 });
	await page.getByRole('button', { name: 'REMI' }).click();
	await page.waitForURL(/\/$/);

	await page.getByTestId('card').first().getByRole('button', { name: 'Rename' }).click();
	await page.getByLabel('Card title').fill('Renamed sheet');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('card')).toHaveCount(1);
	await expect(page.getByTestId('card').first()).toContainText('Renamed sheet');

	await page.getByTestId('card').first().getByRole('button', { name: 'Duplicate' }).click();
	await expect(page.getByTestId('card')).toHaveCount(2);

	const first = page.getByTestId('card').first();
	await first.getByRole('button', { name: 'Delete' }).click();
	await first.getByRole('button', { name: 'Confirm delete' }).click();
	await expect(page.getByTestId('card')).toHaveCount(1);
});

test('changes format and grid without losing items, and keeps per-format crops', async ({
	page
}) => {
	await seedFixture(page);
	await expect(page.locator('.sheet-foot .mono').first()).toContainText('08 items');

	await page.getByTestId('tabs').getByRole('button', { name: 'Arrange' }).click();
	await page.locator('.sheet-map .row').first().click();
	await page.getByTestId('tabs').getByRole('button', { name: 'Style' }).click();

	const horizontal = page.getByLabel('Crop horizontal position');
	await horizontal.evaluate((element) => {
		const input = element as HTMLInputElement;
		input.value = '0';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await page.getByRole('button', { name: '9:16', exact: true }).click();
	await expect(horizontal).toHaveValue('50');
	await horizontal.evaluate((element) => {
		const input = element as HTMLInputElement;
		input.value = '100';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await page.getByRole('button', { name: '4:5', exact: true }).click();
	await expect(horizontal).toHaveValue('0');
	await page.getByRole('button', { name: '9:16', exact: true }).click();
	await expect(horizontal).toHaveValue('100');

	await page.getByTestId('tabs').getByRole('button', { name: 'Arrange' }).click();
	await page.getByRole('button', { name: '3', exact: true }).click();
	await expect(page.locator('.sheet-foot .mono').first()).toContainText('08 items');
	await expect(page.locator('.sheet-map .row')).toHaveCount(9);

	await page.getByRole('button', { name: '5', exact: true }).click();
	await expect(page.locator('.sheet-map .row')).toHaveCount(25);
	await expect(page.locator('.sheet-foot .mono').first()).toContainText('08 items');
});

test('selects a cell by keyboard, moves an item, and removes it without losing the rest', async ({
	page
}) => {
	await seedFixture(page);
	await page.getByTestId('tabs').getByRole('button', { name: 'Arrange' }).click();

	const cell = page.locator('.cell[aria-label^="Slot 01:"]');
	await cell.focus();
	await page.keyboard.press('Enter');
	await expect(cell).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.selected-note')).toContainText('東京リベンジャーズ');

	await page.getByRole('button', { name: 'Move', exact: true }).click();
	await page.locator('.cell[aria-label^="Slot 07:"]').click();
	await expect(page.locator('.sheet-map .row').nth(0)).toContainText('— blank —');
	await expect(page.locator('.sheet-foot .mono').first()).toContainText('08 items');

	await page.getByRole('button', { name: 'Remove item' }).click();
	await expect(page.locator('.sheet-foot .mono').first()).toContainText('07 items');
});

test('uploads artwork, saves it, and exports standard and 2x PNG files', async ({ page }) => {
	await createCard(page);
	await page.getByTestId('tabs').getByRole('button', { name: 'Add' }).click();
	await page.getByTestId('add-upload').setInputFiles({
		name: 'kickoff.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await expect(page.locator('.sheet-foot .mono').first()).toContainText('01 items');
	await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 6000 });

	await openExport(page);
	await expect(page.getByText(/Prepared 1080 × 1350/)).toBeVisible({ timeout: 10_000 });
	const standard = page.waitForEvent('download');
	await page.getByTestId('save-png').click();
	expect(readPngSize(readFileSync((await (await standard).path())!))).toEqual([1080, 1350]);

	await page.getByRole('button', { name: /2×/ }).click();
	await expect(page.getByText(/Prepared 2160 × 2700/)).toBeVisible({ timeout: 15_000 });
	const doubled = page.waitForEvent('download');
	await page.getByTestId('save-png').click();
	expect(readPngSize(readFileSync((await (await doubled).path())!))).toEqual([2160, 2700]);

	const project = page.waitForEvent('download');
	await page.getByTestId('export-project').click();
	expect((await project).suggestedFilename()).toMatch(/\.remi$/);
});

test('adds a mocked provider result through the search panel', async ({ page }) => {
	await page.route('**/api/media/options*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				category: 'anime',
				provider: 'anilist',
				supportsYear: true,
				titleLanguages: [
					{ value: 'english', label: 'English' },
					{ value: 'romaji', label: 'Romaji' }
				],
				filters: [
					{ key: 'genre', label: 'Genre', options: [{ value: 'Fantasy', label: 'Fantasy' }] },
					{ key: 'format', label: 'Format', options: [{ value: 'TV', label: 'TV' }] },
					{ key: 'status', label: 'Status', options: [{ value: 'FINISHED', label: 'Finished' }] }
				]
			})
		})
	);
	await page.route('**/api/media/search*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				results: [
					{
						provider: 'anilist',
						providerId: '154587',
						category: 'anime',
						title: {
							preferred: 'Frieren: Beyond Journey’s End',
							alternatives: ['Sousou no Frieren']
						},
						year: 2023,
						format: 'TV',
						status: 'FINISHED',
						genres: ['Adventure', 'Fantasy'],
						coverPath: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587.jpg'
					}
				],
				page: 1,
				hasNextPage: false,
				total: 1
			})
		})
	);
	await page.route('**/api/media/image*', (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
	);

	await createCard(page);
	await page.getByTestId('tabs').getByRole('button', { name: 'Add' }).click();
	await page.getByTestId('search-input').fill('frieren');
	await expect(page.getByTestId('result')).toHaveCount(1);
	await page.getByTestId('result').getByRole('button', { name: 'Add' }).click();

	await expect(page.locator('.sheet-foot .mono').first()).toContainText('01 items');
	await expect(page.locator('.sheet-map')).toContainText('Frieren');
});

test('shows credential guidance when movie discovery is unavailable', async ({ page }) => {
	await page.route('**/api/media/options*', (route) =>
		route.fulfill({
			status: 503,
			contentType: 'application/json',
			body: JSON.stringify({
				error: 'provider_credentials_missing',
				message: 'Movie and TV search needs a TMDB read access token.'
			})
		})
	);

	await createCard(page);
	await page.getByTestId('tabs').getByRole('button', { name: 'Add' }).click();
	await page.getByRole('button', { name: 'Movie', exact: true }).click();
	await expect(page.getByText(/TMDB read access token/)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Credits and setup' })).toBeVisible();
});

test('mobile editor keeps all tabs and export reachable without horizontal overflow', async ({
	browser
}) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const page = await context.newPage();
	await seedFixture(page);

	await expect(page.getByTestId('tabs').getByRole('button')).toHaveCount(4);
	await expect(page.getByTestId('mobile-export')).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);

	await page.getByTestId('tabs').getByRole('button', { name: 'Add' }).click();
	await expect(page.getByTestId('add-upload')).toBeAttached();
	await page.getByTestId('tabs').getByRole('button', { name: 'Arrange' }).click();
	await page.locator('.panel .slot').first().click();
	await page.getByTestId('tabs').getByRole('button', { name: 'Style' }).click();
	await expect(page.getByLabel('Crop horizontal position')).toBeVisible();

	await page.getByTestId('mobile-export').click();
	await expect(page.getByTestId('export-dialog')).toBeVisible();
	await expect(page.getByTestId('save-png')).toBeVisible();
	await context.close();
});

test('library and editor pass an axe accessibility scan', async ({ page }) => {
	await page.goto('/');
	await page.waitForSelector('text=Every card is a sheet.');
	let results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);

	await seedFixture(page);
	results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
