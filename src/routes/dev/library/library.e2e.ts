import { expect, test, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

async function openLibrary(page: Page) {
	await page.goto('/dev/library');
	await page.waitForFunction(() => Boolean(window.__remiLibrary));
	await page.evaluate(() => window.__remiLibrary!.reset());
}

test('creates a fixture card with a thumbnail and survives a refresh', async ({ page }) => {
	await openLibrary(page);
	const id = await page.evaluate(() => window.__remiLibrary!.createFixture());

	const before = await page.evaluate(() => window.__remiLibrary!.list());
	expect(before).toHaveLength(1);
	expect(before[0]).toMatchObject({
		id,
		revision: 1,
		itemCount: 8,
		unplacedCount: 2
	});
	expect(before[0].thumbnailBytes).toBeGreaterThan(0);

	await page.reload();
	await page.waitForFunction(() => Boolean(window.__remiLibrary));

	const after = await page.evaluate(() => window.__remiLibrary!.list());
	expect(after).toEqual(before);

	const loaded = await page.evaluate((cardId) => window.__remiLibrary!.load(cardId), id);
	expect(loaded?.document.title).toBe('Remi fixture card');
	expect(loaded?.document.items).toHaveLength(8);
	expect(loaded?.artwork).toHaveLength(6);
});

test('autosaves a title and persists it after a reload', async ({ page }) => {
	await openLibrary(page);
	const id = await page.evaluate(() => window.__remiLibrary!.createEmpty());
	await page.evaluate((cardId) => window.__remiLibrary!.open(cardId), id);

	await page.getByTestId('title').fill('Friday Night Rotation');
	await expect(page.getByTestId('status')).toHaveText('Unsaved changes');
	await expect(page.getByTestId('status')).toHaveText('Saved', { timeout: 5000 });

	await expect
		.poll(
			() =>
				page.evaluate(
					async (cardId) =>
						(await window.__remiLibrary!.list()).find((card) => card.id === cardId)?.revision,
					id
				),
			{ timeout: 5000 }
		)
		.toBe(2);

	await page.reload();
	await page.waitForFunction(() => Boolean(window.__remiLibrary));
	const loaded = await page.evaluate((cardId) => window.__remiLibrary!.load(cardId), id);
	expect(loaded?.document.title).toBe('Friday Night Rotation');
});

test('duplicates independently and deletes only the chosen card', async ({ page }) => {
	await openLibrary(page);
	const originalId = await page.evaluate(() => window.__remiLibrary!.createFixture());
	const copyId = await page.evaluate((id) => window.__remiLibrary!.duplicate(id), originalId);

	await page.evaluate(async ({ id }) => window.__remiLibrary!.rename(id, 'Copy only'), {
		id: copyId
	});

	const copy = await page.evaluate((id) => window.__remiLibrary!.load(id), copyId);
	expect(copy?.document.title).toBe('Copy only');
	expect(copy?.document.items).toHaveLength(8);
	expect(copy?.artwork).toHaveLength(6);

	const original = await page.evaluate((id) => window.__remiLibrary!.load(id), originalId);
	expect(original?.document.title).toBe('Remi fixture card');
	expect(original?.document.revision).toBe(1);

	await page.evaluate((id) => window.__remiLibrary!.remove(id), originalId);

	const list = await page.evaluate(() => window.__remiLibrary!.list());
	expect(list.map((card) => card.id)).toEqual([copyId]);
	expect(await page.evaluate((id) => window.__remiLibrary!.load(id), originalId)).toBeNull();
});

test('imports a project offline as a new card with artwork and thumbnail', async ({ browser }) => {
	const source = await browser.newPage();
	await openLibrary(source);
	const originalId = await source.evaluate(() => window.__remiLibrary!.createFixture());
	const bytes = await source.evaluate((id) => window.__remiLibrary!.exportBytes(id), originalId);
	await source.close();

	const offline = await browser.newContext();
	const external: string[] = [];
	await offline.route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
			await route.continue();
		} else {
			external.push(url.href);
			await route.abort();
		}
	});

	const page = await offline.newPage();
	await page.goto(`${BASE_URL}/dev/library`);
	await page.waitForFunction(() => Boolean(window.__remiLibrary));
	await page.evaluate(() => window.__remiLibrary!.reset());

	const importedId = await page.evaluate((data) => window.__remiLibrary!.importBytes(data), bytes);
	const imported = await page.evaluate((id) => window.__remiLibrary!.load(id), importedId);

	expect(imported?.document.title).toBe('Remi fixture card');
	expect(imported?.document.items).toHaveLength(8);
	expect(imported?.artwork).toHaveLength(6);
	expect(importedId).not.toBe(originalId);

	const list = await page.evaluate(() => window.__remiLibrary!.list());
	expect(list).toHaveLength(1);
	expect(list[0].thumbnailBytes).toBeGreaterThan(0);
	expect(external).toEqual([]);

	await offline.close();
});
