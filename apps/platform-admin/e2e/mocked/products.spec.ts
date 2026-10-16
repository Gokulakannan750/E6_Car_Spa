import { test, expect, type Page } from '@playwright/test';
import { FakePlatform } from './fakePlatform';
import { carSpa, demo } from '../../src/test/products';
import type { Product } from '../../src/lib/types';

async function start(page: Page, products: Product[], configure?: (api: FakePlatform) => void) {
	const api = new FakePlatform({ products });
	configure?.(api);
	await api.install(page);
	await page.goto('/');
	await page.getByLabel('Staff email').fill('owner@trovo.test');
	await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
	await page.getByRole('button', { name: /continue/i }).click();
	await page.getByLabel('Authentication code').fill('123456');
	await page.getByRole('button', { name: 'Verify', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
	return api;
}
async function newPaid(page: Page) {
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Companies', exact: true }).click();
	await page.getByRole('button', { name: 'New company', exact: true }).click();
	await page.getByRole('radio', { name: /Already paid/ }).click();
	return page.getByRole('dialog');
}

test('single product hides selector and keeps per-type controls and feature labels', async ({ page }) => {
	await start(page, [carSpa]);
	await expect(page.getByRole('combobox', { name: 'Product', exact: true })).toHaveCount(0);
	const dialog = await newPaid(page);
	for (const s of carSpa.seatTypes) await expect(dialog.getByLabel(`${s.name} licences`, { exact: true })).toBeVisible();
	await expect(dialog.getByText('WhatsApp automation', { exact: true })).toBeVisible();
});

test('All products shows badges and blocks company creation and catalog until selected', async ({ page }) => {
	const api = await start(page, [carSpa, demo]);
	api.companies.push({ ...api.companies[0]!, id: 'demo-c1', name: 'Demo company', productKey: 'demo', seats: [] });
	await page.reload();
	const selector = page.getByRole('combobox', { name: 'Product', exact: true });
	await expect(selector).toHaveValue('');
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Companies', exact: true }).click();
	await expect(page.getByRole('row', { name: /Open 0001 E6/ }).getByText('Car Spa', { exact: true })).toBeVisible();
	await expect(page.getByRole('row', { name: /Open 0001 Demo/ }).getByText('Demo', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'New company', exact: true }).click();
	await expect(page.getByRole('dialog')).toContainText('Choose a product');
	await expect(page.getByRole('button', { name: 'Create company', exact: true })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Plans & Prices' }).click();
	await expect(page.getByRole('status')).toContainText('Choose a product');
	expect(api.requests.filter((r) => r.path === '/plans')).toHaveLength(0);
});

test('None product uses scoped create and catalog calls with unlimited seats and no controls', async ({ page }) => {
	const api = await start(page, [carSpa, demo]);
	await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption('demo');
	const dialog = await newPaid(page);
	await expect(dialog.getByText('Unlimited seats').first()).toBeVisible();
	await expect(dialog.locator('input[inputmode="numeric"]')).toHaveCount(0);
	await expect(dialog.getByText('Project workspace', { exact: true })).toBeVisible();
	await dialog.getByLabel('Company name').fill('Demo paid company');
	await dialog.getByRole('button', { name: 'Create company', exact: true }).click();
	await expect(dialog.getByText('Demo paid company is ready')).toBeVisible();
	const created = api.requests.find((r) => r.method === 'POST' && r.path === '/companies')!;
	expect(created.product).toBe('demo');
	expect(created.body).toMatchObject({ plan: { planCode: 'basic', seats: {} } });
	expect(created.body).not.toHaveProperty('plan.licences');
	expect(api.requests.filter((r) => r.path === '/plans').every((r) => r.product === 'demo')).toBe(true);
	await page.reload();
	await expect(page.getByRole('combobox', { name: 'Product', exact: true })).toHaveValue('demo');
});

test('Counted product renders exactly its one named stepper', async ({ page }) => {
	const counted: Product = {
		...demo,
		key: 'counted',
		name: 'Counted',
		seatModel: 'Counted',
		seatTypes: [{ code: 'user', name: 'Workspace member', sortOrder: 1, isActive: true }],
	};
	await start(page, [counted]);
	const dialog = await newPaid(page);
	await expect(dialog.getByLabel('Workspace member licences', { exact: true })).toHaveValue('1');
	await expect(dialog.locator('input[inputmode="numeric"]')).toHaveCount(1);
	await dialog.getByRole('button', { name: 'More Workspace member licences' }).click();
	await expect(dialog.getByText('₹15.00', { exact: true })).toBeVisible();
});

test('generic PerType uses every product seat and live totals without app codes', async ({ page }) => {
	const workshop: Product = {
		...demo,
		key: 'workshop',
		name: 'Workshop',
		seatModel: 'PerType',
		seatTypes: [
			{ code: 'operator', name: 'Operator', sortOrder: 1, isActive: true },
			{ code: 'reviewer', name: 'Reviewer', sortOrder: 2, isActive: true },
		],
	};
	await start(page, [workshop]);
	const dialog = await newPaid(page);
	await expect(dialog.locator('input[inputmode="numeric"]')).toHaveCount(2);
	await dialog.getByRole('button', { name: 'More Reviewer licences' }).click();
	await expect(dialog.getByText('₹15.00', { exact: true })).toBeVisible();
	await expect(dialog.getByText('Project workspace', { exact: true })).toBeVisible();
});

test('catalog writes generic seat prices and product features with the selected product', async ({ page }) => {
	const api = await start(page, [carSpa, demo]);
	await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption('demo');
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Plans & Prices' }).click();
	await page.getByRole('button', { name: 'New plan', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name', { exact: true }).fill('Project Plus');
	await expect(dialog.getByText('Project workspace', { exact: true })).toBeVisible();
	await expect(dialog.getByLabel('Minimum seats', { exact: true })).toHaveCount(0);
	await dialog.getByLabel('Company fee (₹)', { exact: true }).nth(0).fill('10');
	await dialog.getByLabel('Company fee (₹)', { exact: true }).nth(1).fill('100');
	await dialog.getByLabel('Reason (recorded in the audit log)').fill('Offer another workspace plan');
	await dialog.getByRole('button', { name: 'Create plan', exact: true }).click();
	await expect(page.getByText('Plan Project Plus created.')).toBeVisible();
	const write = api.requests.find((r) => r.method === 'POST' && r.path === '/plans')!;
	expect(write.product).toBe('demo');
	expect(write.body).toMatchObject({
		minimumLicences: 0,
		monthly: { companyFeeMinor: 1000, seatPrices: {} },
		yearly: { companyFeeMinor: 10000, seatPrices: {} },
		features: { 'demo.enabled': 'false' },
	});
	expect(write.body).not.toHaveProperty('monthly.androidUserPriceMinor');
});

test('settings and migrations scope calls and all-product migration requires confirmation', async ({ page }) => {
	const api = await start(page, [carSpa, demo]);
	await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption('demo');
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'System', exact: true }).click();
	await expect(page.getByText('Subscription settings · Demo')).toBeVisible();
	await expect(page.getByLabel('Trial seats')).toHaveCount(0);
	await page.getByLabel('Free trial (days)').fill('10');
	await page.getByLabel('Reason (recorded in the audit log)').fill('Longer demo trial');
	await page.getByRole('button', { name: 'Save settings' }).click();
	await expect(page.getByText('Settings saved. They apply to new trials and the next checks.')).toBeVisible();
	expect(api.requests.find((r) => r.method === 'PUT' && r.path === '/settings')?.product).toBe('demo');
	await page.getByRole('button', { name: 'Run migrations · Demo' }).click();
	await expect(page.getByRole('dialog')).toContainText('External product commands will run');
	await page.getByRole('dialog').getByRole('button', { name: 'Update now' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	expect(api.requests.filter((r) => r.path === '/migrations/run')[0]?.product).toBe('demo');
	await page.getByRole('button', { name: 'Run for all products', exact: true }).click();
	await expect(page.getByRole('dialog')).toContainText('Run for all products?');
	await page.getByRole('dialog').getByRole('button', { name: 'Update now' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	expect(api.requests.filter((r) => r.path === '/migrations/run')[1]?.product).toBeNull();
});

test('product filters reach every list and mixed sign-up, invoice, audit and migration rows carry badges', async ({ page }) => {
	const api = await start(page, [carSpa, demo], (api) => {
		api.companies.push({ ...api.companies[0]!, id: 'demo-c1', productKey: 'demo', name: 'Demo company', seats: [] });
		const now = new Date().toISOString();
		api.signupOrders.push({
			id: 'demo-signup',
			createdAt: now,
			start: 'Trial',
			status: 'Completed',
			businessName: 'Demo signup',
			ownerName: 'Demo owner',
			mobile: '9999999999',
			email: 'demo@example.test',
			city: 'Erode',
			state: 'Tamil Nadu',
			planCode: 'basic',
			interval: 'Month',
			seats: [],
			productKey: 'demo',
			amountMinor: 0,
			currency: 'INR',
			companyId: 'demo-c1',
			companyCode: '0001',
			paymentProvider: null,
			paymentReference: null,
			failureReason: null,
			completedAt: now,
			expiresAt: now,
		});
		api.auditEntries.push({
			id: 'demo-audit',
			createdAt: now,
			administratorEmail: 'owner@trovo.test',
			action: 'company.created',
			targetCompanyId: 'demo-c1',
			beforeValues: null,
			afterValues: null,
			reason: 'Demo isolation check',
			ipAddress: '127.0.0.1',
			productKey: 'demo',
		});
	});
	await page.goto('/signups');
	await expect(page.getByRole('row', { name: 'Open order from Demo signup' }).getByText('Demo', { exact: true })).toBeVisible();
	await page.goto('/invoices');
	await expect(page.getByRole('row', { name: /TROVO/ }).getByText('Car Spa', { exact: true })).toBeVisible();
	await page.goto('/audit-log');
	await expect(page.getByRole('row').filter({ hasText: 'Demo isolation check' }).getByText('Demo', { exact: true })).toBeVisible();
	await page.goto('/system');
	await expect(page.getByRole('row').filter({ hasText: 'Demo company' }).getByText('Demo', { exact: true })).toBeVisible();
	await expect(page.getByText('Different versions within a product')).toHaveCount(0);
	await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption('demo');
	for (const [route, endpoint] of [
		['/dashboard', '/dashboard'],
		['/companies', '/companies'],
		['/signups', '/signups'],
		['/invoices', '/invoices'],
		['/audit-log', '/audit-logs'],
		['/system', '/migrations'],
	]) {
		await page.goto(route!);
		await expect.poll(() => api.requests.filter((r) => r.path === endpoint).at(-1)?.product).toBe('demo');
	}
});
