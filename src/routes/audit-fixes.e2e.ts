import { expect, test, type Page } from '@playwright/test';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

async function seed(page: Page) {
	await page.goto('/dev/library');
	await page.waitForFunction(() => Boolean(window.__remiLibrary));
	const id = await page.evaluate(() => window.__remiLibrary!.createFixture());
	await page.goto(`/editor/${id}`);
	await page.getByTestId('tabs').waitFor();
	await page.locator('.cell').first().waitFor();
	return id;
}

async function readDocument(page: Page, id: string) {
	return page.evaluate(async (cardId) => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('remi');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<import('#lib/card/types').CardDocument>((resolve, reject) => {
				const request = database.transaction('cards').objectStore('cards').get(cardId);
				request.onsuccess = () => resolve(request.result.document);
				request.onerror = () => reject(request.error);
			});
		} finally {
			database.close();
		}
	}, id);
}

test('keeps a dirty editor open when navigation discovers a save failure', async ({ page }) => {
	await page.route('**/api/media/options*', (route) =>
		route.fulfill({
			status: 503,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'provider_credentials_missing', message: 'Setup required' })
		})
	);
	const id = await seed(page);
	await page.getByTestId('tabs').getByRole('button', { name: 'Add', exact: true }).click();
	await page.getByRole('link', { name: 'Credits and setup' }).waitFor();
	let confirmations = 0;
	page.on('dialog', async (dialog) => {
		confirmations += 1;
		await dialog.dismiss();
	});
	await page.evaluate(() => {
		const original = IDBObjectStore.prototype.put;
		(window as unknown as { restorePut: () => void }).restorePut = () => {
			IDBObjectStore.prototype.put = original;
		};
		IDBObjectStore.prototype.put = function () {
			throw new DOMException('full', 'QuotaExceededError');
		};
		const input = document.querySelector<HTMLInputElement>('[data-testid=title]')!;
		input.value = 'Keep this work';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		document.querySelector<HTMLAnchorElement>('a[href="/credits"]')!.click();
	});
	await expect.poll(() => confirmations).toBe(1);
	await expect(page).toHaveURL(new RegExp(`/editor/${id}$`));
	await expect(page.getByTestId('title')).toHaveValue('Keep this work');
	expect((await readDocument(page, id)).title).toBe('Remi fixture card');
	await page.evaluate(() => (window as unknown as { restorePut: () => void }).restorePut());
	await page.getByRole('button', { name: 'Retry save' }).click();
	await expect(page.getByTestId('save-status')).toHaveText('Saved');
	await page.getByRole('link', { name: 'Credits and setup' }).click();
	await expect(page).toHaveURL(/\/credits$/);
	expect((await readDocument(page, id)).title).toBe('Keep this work');
});

test('saves a pending edit before following browser Back', async ({ page }) => {
	await page.goto('/');
	await page.getByTestId('new-card').click();
	await page.getByTestId('title').waitFor();
	const id = page.url().split('/').pop()!;
	await page.evaluate(async (cardId) => {
		const database = await new Promise<IDBDatabase>((resolve) => {
			const request = indexedDB.open('remi');
			request.onsuccess = () => resolve(request.result);
		});
		let released = false;
		(window as unknown as { releaseWrite: () => void }).releaseWrite = () => {
			released = true;
		};
		const transaction = database.transaction('cards', 'readwrite');
		const store = transaction.objectStore('cards');
		const hold = () => {
			store.get(cardId).onsuccess = () => {
				if (!released) hold();
			};
		};
		hold();
		transaction.oncomplete = () => database.close();
	}, id);
	await page.getByTestId('title').fill('Earlier edit');
	await expect(page.getByTestId('save-status')).toHaveText('Saving…');
	await page.evaluate(() => {
		const input = document.querySelector<HTMLInputElement>('[data-testid=title]')!;
		input.value = 'Saved before Back';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		setTimeout(() => (window as unknown as { releaseWrite: () => void }).releaseWrite(), 200);
		history.back();
	});
	await expect(page).toHaveURL(/\/$/);
	await page.getByRole('heading', { name: 'Library' }).waitFor();
	expect((await readDocument(page, id)).title).toBe('Saved before Back');
});

test('keeps spaces while typing a caption', async ({ page }) => {
	await seed(page);
	await page.locator('.sheet-map .row').first().click();
	await page.getByTestId('tabs').getByRole('button', { name: 'Style', exact: true }).click();
	const caption = page.locator('input[type=text]').last();
	await caption.fill('');
	await caption.pressSequentially('Two words');
	await expect(caption).toHaveValue('Two words');
});

test('replaces the original artwork when selection changes during decoding', async ({ page }) => {
	const id = await seed(page);
	const before = await readDocument(page, id);
	await page.locator('.sheet-map .row').nth(0).click();
	await page.getByTestId('tabs').getByRole('button', { name: 'Style', exact: true }).click();
	await page.evaluate(() => {
		const original = window.createImageBitmap;
		window.createImageBitmap = (async (...args: unknown[]) => {
			window.createImageBitmap = original;
			await new Promise<void>((resolve) => {
				(window as unknown as { releaseDecode: () => void }).releaseDecode = resolve;
			});
			return (original as (...args: unknown[]) => Promise<ImageBitmap>)(...args);
		}) as typeof createImageBitmap;
	});
	await page
		.locator('input[type=file]')
		.last()
		.setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: PNG });
	await page.waitForFunction(() =>
		Boolean((window as unknown as { releaseDecode?: () => void }).releaseDecode)
	);
	await page.locator('.sheet-map .row').nth(1).click();
	await page.evaluate(() => (window as unknown as { releaseDecode: () => void }).releaseDecode());
	await expect
		.poll(async () => (await readDocument(page, id)).items[0].artwork?.id)
		.not.toBe(before.items[0].artwork?.id);
	const after = await readDocument(page, id);
	expect(after.items[1].artwork).toEqual(before.items[1].artwork);
});

test('rejects oversized text while keeping the accepted card exportable', async ({ page }) => {
	await seed(page);
	await page.getByTestId('title').fill('界'.repeat(350_000));
	await expect(page.getByRole('alert')).toContainText('manifest');
	await expect(page.getByTestId('title')).toHaveValue('Remi fixture card');
	await page.getByRole('button', { name: 'Export', exact: true }).click();
	await expect(page.getByTestId('save-png')).toBeEnabled();
	const download = page.waitForEvent('download');
	await page.getByTestId('export-project').click();
	expect((await download).suggestedFilename()).toMatch(/\.remi$/);
});

test('searches the chosen medium without discovery filters', async ({ page }) => {
	const requests: URL[] = [];
	await page.route('**/api/media/options*', (route) => {
		const category = new URL(route.request().url()).searchParams.get('category');
		return route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				category,
				provider: category === 'tv' ? 'tmdb' : 'anilist',
				supportsYear: true,
				titleLanguages: [],
				filters:
					category === 'tv'
						? [
								{ key: 'genre', label: 'Genre', options: [{ value: '12', label: 'Adventure' }] },
								{
									key: 'status',
									label: 'Status',
									options: [{ value: '0', label: 'Returning series' }]
								}
							]
						: []
			})
		});
	});
	await page.route('**/api/media/search*', (route) => {
		requests.push(new URL(route.request().url()));
		return route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ results: [], total: 0, page: 1, hasNextPage: false })
		});
	});
	await seed(page);
	await page.getByTestId('tabs').getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Browse', exact: true })).toHaveCount(0);
	await page.getByLabel('Category').selectOption('tv');
	await expect(page.locator('.filters select')).toHaveCount(0);
	await page.getByTestId('search-input').fill('Breaking Bad');
	await expect.poll(() => requests.at(-1)?.searchParams.get('query')).toBe('Breaking Bad');
	expect(requests.at(-1)?.searchParams.get('category')).toBe('tv');
	expect(requests.at(-1)?.searchParams.get('mode')).toBe('search');
	expect(requests.at(-1)?.searchParams.has('genre')).toBe(false);
	expect(requests.at(-1)?.searchParams.has('status')).toBe(false);
});
