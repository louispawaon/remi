import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});

test('has no accessibility violations', async ({ page }) => {
	await page.goto('/');

	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
