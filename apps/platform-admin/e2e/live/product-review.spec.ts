import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { assumeBudgetUsed, liveConfig, signIn, stamp } from './helpers';
const config = liveConfig();
test.skip(config.missing.length > 0, `Set ${config.missing.join(', ')} for the isolated live review.`);
test('demo company and product screens at desktop and phone widths', async ({ page }) => {
	assumeBudgetUsed();
	await signIn(page, config.owner.email, config.owner.password, config.owner.totpSecret);
	const directory = path.resolve(process.env.PLATFORM_E2E_SCREENSHOTS ?? '../../docs/platform-multi-product-stage-6-screenshots');
	await mkdir(directory, { recursive: true });
	const name = `Demo workspace ${stamp()}`;
	async function capture(screen: string, size: string) {
		await page.screenshot({ path: path.join(directory, `${size}-${screen}.png`) });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	}
	async function select(key: string) {
		await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption(key);
	}
	async function go(route: string) {
		await page.goto(route);
		await expect(page.getByRole('combobox', { name: 'Product', exact: true })).toBeVisible();
	}
	for (const size of ['desktop', 'phone']) {
		await page.setViewportSize(size === 'desktop' ? { width: 1366, height: 768 } : { width: 390, height: 844 });
		await go('/dashboard');
		await select('');
		await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
		await capture('product-selector', size);
		await go('/companies');
		await select('demo');
		await page.getByRole('button', { name: 'New company', exact: true }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('radio', { name: /Already paid/ }).click();
		await expect(dialog.getByText('Unlimited seats').first()).toBeVisible();
		await expect(dialog.locator('input[inputmode="numeric"]')).toHaveCount(0);
		await expect(dialog.getByRole('radio', { name: /Demo workspace/ })).toBeVisible();
		await dialog.getByLabel('Company name').fill(name);
		await capture('new-company-none', size);
		if (size === 'desktop') {
			await dialog.getByRole('button', { name: 'Create company', exact: true }).click();
			await expect(dialog.getByText(`${name} is ready`)).toBeVisible({ timeout: 60000 });
			await dialog.getByRole('button', { name: 'Done', exact: true }).click();
		} else await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
		await select('');
		await expect(page.getByRole('row', { name: new RegExp(`Open .* ${name}`) }).getByText('Demo', { exact: true })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Car Spa', exact: true }).first()).toBeVisible();
		await capture('companies-badges', size);
		await go('/plans');
		await select('demo');
		await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
		await expect(page.getByText('Unlimited seats', { exact: true })).toBeVisible();
		await expect(page.getByText('Project workspace', { exact: true })).toBeVisible();
		await capture('plans', size);
		await go('/system');
		await select('demo');
		await expect(page.getByText('Subscription settings · Demo')).toBeVisible();
		await expect(page.getByLabel('Trial seats')).toHaveCount(0);
		await capture('settings', size);
		await select('');
		if (size === 'desktop') {
			await page.getByRole('button', { name: 'Run for all products', exact: true }).click();
			await expect(page.getByRole('dialog')).toContainText('External product commands will run');
			await page.getByRole('dialog').getByRole('button', { name: 'Update now' }).click();
			await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60000 });
		}
		await page.getByRole('heading', { name: 'Company databases', exact: true }).evaluate((element) => element.closest('section')!.scrollIntoView({ block: 'start' }));
		const demoRow = page.getByRole('row').filter({ hasText: name });
		await expect(demoRow).toContainText('demo-v1');
		await expect(demoRow).toContainText('Up to date');
		await capture('migrations', size);
	}
});
