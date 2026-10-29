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
	await page.getByRole('button', { name: 'Confirm remove' }).click();
	await expect(page.locator('.sheet-foot .mono').first()).toContainText('07 items');
});

test('drags a placed cell onto another to swap their items', async ({ page }) => {
	await seedFixture(page);
	const first = page.locator('.cell[aria-label^="Slot 01:"]');
	const second = page.locator('.cell[aria-label^="Slot 02:"]');
	const firstTitle = (await first.getAttribute('aria-label'))!.replace(/^Slot \d+: /, '');
	const secondTitle = (await second.getAttribute('aria-label'))!.replace(/^Slot \d+: /, '');

	await expect(first).toHaveAttribute('draggable', 'true');
	await first.dragTo(second);

	await expect(page.locator('.cell[aria-label^="Slot 01:"]')).toHaveAttribute(
		'aria-label',
		`Slot 01: ${secondTitle}`
	);
	await expect(page.locator('.cell[aria-label^="Slot 02:"]')).toHaveAttribute(
		'aria-label',
		`Slot 02: ${firstTitle}`
	);
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
	const standardBytes = readFileSync((await (await standard).path())!);
	expect(readPngSize(standardBytes)).toEqual([1080, 1350]);

	await page.getByRole('button', { name: /2×/ }).click();
	await expect(page.getByText(/Prepared 2160 × 2700/)).toBeVisible({ timeout: 15_000 });
	const doubled = page.waitForEvent('download');
	await page.getByTestId('save-png').click();
	const doubledBytes = readFileSync((await (await doubled).path())!);
	expect(readPngSize(doubledBytes)).toEqual([2160, 2700]);

	await page.getByRole('button', { name: /Standard/ }).click();
	await expect(page.getByText(/Prepared 1080 × 1350/)).toBeVisible({ timeout: 10_000 });
	await page.getByRole('button', { name: /2×/ }).click();
	await expect(page.getByText(/Prepared 2160 × 2700/)).toBeVisible({ timeout: 15_000 });

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
	await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 8000 });

	await page.reload();
	await page.waitForSelector('[data-testid="tabs"]');
	await expect(page.getByTestId('save-status')).toHaveText('Saved');
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
	await page.getByLabel('Category').selectOption('movie');
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
	await expect(page.locator('main.sheet')).toBeHidden();
	await page.getByTestId('tabs').getByRole('button', { name: 'Arrange' }).click();
	await expect(page.locator('main.sheet')).toBeVisible();
	await page.locator('.cell[aria-label^="Slot 01:"]').click();
	await page.getByTestId('tabs').getByRole('button', { name: 'Style' }).click();
	await expect(page.getByLabel('Crop horizontal position')).toBeVisible();

	await page.getByTestId('mobile-export').click();
	await expect(page.getByTestId('export-dialog')).toBeVisible();
	await expect(page.getByTestId('save-png')).toBeVisible();
	await context.close();
});

test('closes the export sheet from the backdrop', async ({ page }) => {
	await seedFixture(page);
	await openExport(page);
	await page.mouse.click(10, 10);
	await expect(page.getByTestId('export-dialog')).toBeHidden();
});

test('dismisses the mobile export sheet by dragging its handle', async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const page = await context.newPage();
	await seedFixture(page);
	await page.getByTestId('mobile-export').click();
	await expect(page.getByTestId('export-dialog')).toBeVisible();

	const handle = page.locator('.handle');
	await handle.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientY: 300 });
	await handle.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientY: 420 });
	await handle.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientY: 420 });
	await expect(page.getByTestId('export-dialog')).toBeHidden();
	await context.close();
});

test('brings the card back into view when moving on mobile', async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const page = await context.newPage();
	await seedFixture(page);
	await page.getByTestId('tabs').getByRole('button', { name: 'Arrange' }).click();

	const first = page.locator('.cell[aria-label^="Slot 01:"]');
	await first.click();
	await page.evaluate(() => window.scrollTo(0, 500));
	await page.getByRole('button', { name: 'Move', exact: true }).click();
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);

	await page.locator('.cell[aria-label^="Slot 02:"]').click();
	await expect(first).toHaveAttribute('aria-label', /^Slot 01: 나 혼자만 레벨업/);
	await context.close();
});

test('library and editor pass an axe accessibility scan', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('heading', { name: 'Library' }).waitFor();
	let results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);

	await seedFixture(page);
	results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});

test('detects a newer revision from another tab and keeps the work exportable', async ({
	page,
	context
}) => {
	const id = await seedFixture(page);

	const other = await context.newPage();
	await other.goto('/dev/library');
	await other.waitForFunction(() => Boolean(window.__remiLibrary));
	await other.evaluate(
		(cardId) => window.__remiLibrary!.rename(cardId, 'Newer from another tab'),
		id
	);

	await page.getByTestId('title').fill('Local unsaved title');
	await expect(page.getByTestId('save-status')).toHaveText(/Changed in another tab/, {
		timeout: 8000
	});
	await expect(page.getByRole('alert')).toContainText(/changed in another tab/i);

	await page.getByRole('button', { name: 'Export project' }).click();
	await expect(page.getByTestId('export-dialog')).toBeVisible();
	await other.close();
});

test('retries a provider outage without losing the search draft', async ({ page }) => {
	let fail = true;
	await page.route('**/api/media/options*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				category: 'anime',
				provider: 'anilist',
				supportsYear: true,
				titleLanguages: [{ value: 'english', label: 'English' }],
				filters: []
			})
		})
	);
	await page.route('**/api/media/search*', (route) => {
		if (fail) {
			fail = false;
			return route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'provider_unavailable', message: 'Provider outage.' })
			});
		}
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				results: [
					{
						provider: 'anilist',
						providerId: '1',
						category: 'anime',
						title: { preferred: 'Recovered result', alternatives: [] },
						year: 2024,
						format: 'TV',
						status: 'FINISHED',
						genres: [],
						coverPath: null
					}
				],
				page: 1,
				hasNextPage: false,
				total: 1
			})
		});
	});

	await createCard(page);
	await page.getByTestId('tabs').getByRole('button', { name: 'Add' }).click();
	await page.getByTestId('search-input').fill('retry me');
	await expect(page.getByText('Provider outage.')).toBeVisible();
	await page.getByRole('button', { name: 'Retry' }).click();
	await expect(page.getByTestId('result')).toHaveCount(1);
});

test('keeps the working card exportable after a storage write failure', async ({ page }) => {
	await seedFixture(page);
	await page.evaluate(() => {
		const target = window as unknown as { __restorePut?: () => void };
		const prototype = IDBObjectStore.prototype;
		const original = prototype.put;
		prototype.put = function () {
			throw new DOMException('full', 'QuotaExceededError');
		};
		target.__restorePut = () => {
			prototype.put = original;
		};
	});

	await page.getByTestId('title').fill('Unsaved work');
	await expect(page.getByTestId('save-status')).toHaveText(/Save failed/i, { timeout: 8000 });
	await expect(page.getByRole('alert')).toContainText(/out of storage/i);

	await page.getByRole('button', { name: 'Export project' }).click();
	await expect(page.getByTestId('export-dialog')).toBeVisible();
	await expect(page.getByTestId('export-project')).toBeVisible();

	await page.evaluate(() => {
		const target = window as unknown as { __restorePut?: () => void };
		target.__restorePut?.();
	});
});

test('imports a .remi project through a mobile file picker', async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const page = await context.newPage();

	await page.goto('/dev/library');
	await page.waitForFunction(() => Boolean(window.__remiLibrary));
	await page.evaluate(() => window.__remiLibrary!.reset());
	const id = await page.evaluate(() => window.__remiLibrary!.createFixture());
	const bytes = await page.evaluate((cardId) => window.__remiLibrary!.exportBytes(cardId), id);

	const { writeFileSync, unlinkSync } = await import('node:fs');
	const { tmpdir } = await import('node:os');
	const { join } = await import('node:path');
	const path = join(tmpdir(), `remi-mobile-${Date.now()}.remi`);
	writeFileSync(path, Buffer.from(bytes));

	try {
		await page.goto('/');
		await page.getByRole('heading', { name: 'Library' }).waitFor();
		await page.getByTestId('import-input').setInputFiles(path);
		await page.waitForURL(/\/editor\//);
		await page.waitForSelector('[data-testid="title"]');
		await expect(page.getByTestId('title')).toHaveValue('Remi fixture card');
	} finally {
		unlinkSync(path);
		await context.close();
	}
});

test('shows an export error, then recovers on retry', async ({ page }) => {
	await createCard(page);
	await page.getByTestId('tabs').getByRole('button', { name: 'Add' }).click();
	await page.getByTestId('add-upload').setInputFiles({
		name: 'break.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await expect(page.locator('.sheet-foot .mono').first()).toContainText('01 items');

	await page.evaluate(() => {
		const target = window as unknown as { __restoreToBlob?: () => void };
		const prototype = HTMLCanvasElement.prototype;
		const original = prototype.toBlob;
		prototype.toBlob = function (callback) {
			callback(null);
		};
		target.__restoreToBlob = () => {
			prototype.toBlob = original;
		};
	});

	await openExport(page);
	await expect(page.getByText('PNG encoding failed')).toBeVisible({ timeout: 10_000 });
	await expect(page.getByTestId('retry-preparation')).toBeVisible();

	await page.evaluate(() => {
		const target = window as unknown as { __restoreToBlob?: () => void };
		target.__restoreToBlob?.();
	});
	await page.getByTestId('retry-preparation').click();
	await expect(page.getByText(/Prepared 1080 × 1350/)).toBeVisible({ timeout: 10_000 });
});

test('standard and 2x keep the same composition on a populated card', async ({ page }) => {
	await seedFixture(page);
	await openExport(page);
	await expect(page.getByTestId('export-dialog')).toContainText(
		'02 unplaced items excluded from this PNG.'
	);
	await expect(page.getByText(/Prepared 1080 × 1350/)).toBeVisible({ timeout: 10_000 });

	const standard = page.waitForEvent('download');
	await page.getByTestId('save-png').click();
	const standardBytes = readFileSync((await (await standard).path())!);

	await page.getByRole('button', { name: /2×/ }).click();
	await expect(page.getByText(/Prepared 2160 × 2700/)).toBeVisible({ timeout: 15_000 });
	const doubled = page.waitForEvent('download');
	await page.getByTestId('save-png').click();
	const doubledBytes = readFileSync((await (await doubled).path())!);

	const difference = await page.evaluate(
		async ({ standard, doubled }) => {
			const decode = async (base64: string) => {
				const binary = atob(base64);
				const bytes = new Uint8Array(binary.length);
				for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
				return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
			};
			const [small, large] = await Promise.all([decode(standard), decode(doubled)]);
			const canvas = document.createElement('canvas');
			canvas.width = small.width;
			canvas.height = small.height;
			const context = canvas.getContext('2d')!;
			context.drawImage(small, 0, 0);
			const smallPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(large, 0, 0, canvas.width, canvas.height);
			const largePixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

			let total = 0;
			let changed = 0;
			let samples = 0;
			for (let index = 0; index < smallPixels.length; index += 4 * 11) {
				const delta =
					Math.abs(smallPixels[index] - largePixels[index]) +
					Math.abs(smallPixels[index + 1] - largePixels[index + 1]) +
					Math.abs(smallPixels[index + 2] - largePixels[index + 2]);
				total += delta;
				if (delta > 48) changed += 1;
				samples += 1;
			}
			small.close();
			large.close();
			return { mean: total / samples, changed: changed / samples };
		},
		{ standard: standardBytes.toString('base64'), doubled: doubledBytes.toString('base64') }
	);

	expect(difference.mean).toBeLessThan(6);
	expect(difference.changed).toBeLessThan(0.04);
});

test('cancels export preparation and retries cleanly', async ({ page }) => {
	await seedFixture(page);
	await page.evaluate(() => {
		const target = window as unknown as { __restoreBitmap?: () => void };
		const original = window.createImageBitmap;
		window.createImageBitmap = (async (...args: unknown[]) => {
			await new Promise((resolve) => setTimeout(resolve, 250));
			return (original as (...values: unknown[]) => Promise<ImageBitmap>)(...args);
		}) as typeof createImageBitmap;
		target.__restoreBitmap = () => {
			window.createImageBitmap = original;
		};
	});

	await openExport(page);
	await expect(page.getByTestId('prep-stage')).toContainText(/Loading artwork/);
	await page.getByTestId('cancel-preparation').click();
	await expect(page.getByText('Preparation cancelled.')).toBeVisible();
	await expect(page.getByTestId('retry-preparation')).toBeVisible();

	await page.evaluate(() => {
		const target = window as unknown as { __restoreBitmap?: () => void };
		target.__restoreBitmap?.();
	});
	await page.getByTestId('retry-preparation').click();
	await expect(page.getByText(/Prepared 1080 × 1350/)).toBeVisible({ timeout: 10_000 });
});

test('explains that sharing is unavailable while keeping Save usable', async ({ page }) => {
	await seedFixture(page);
	await openExport(page);
	await expect(page.getByText(/Prepared 1080 × 1350/)).toBeVisible({ timeout: 10_000 });

	await page.evaluate(() => {
		Object.defineProperty(navigator, 'canShare', {
			configurable: true,
			value: () => false
		});
	});
	await page.getByRole('button', { name: 'Share…' }).click();
	await expect(page.getByText(/Sharing files is unavailable/)).toBeVisible();
	await expect(page.getByTestId('save-png')).toBeEnabled();
});
