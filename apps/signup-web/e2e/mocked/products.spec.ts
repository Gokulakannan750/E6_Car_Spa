import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { catalog, demoCatalog, countedCatalog, FakeSignupApi } from './fakeApi';
import type { PublicCatalog } from '../../src/lib/types';
async function fill(page: Page) {
	await page.getByLabel('Business name').fill('Product business');
	await page.getByLabel('Your name').fill('Owner');
	await page.getByLabel('Mobile number').fill('9876543210');
	await page.getByLabel('Email').fill('owner@test.in');
	await page.getByLabel('City').fill('Erode');
	await page.getByLabel('State').selectOption('Tamil Nadu');
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
}
test('two products show a chooser and independent pricing and signup routes', async ({ page }) => {
	const api = new FakeSignupApi([catalog, demoCatalog]);
	await api.install(page);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Choose your product' })).toBeVisible();
	await page.getByRole('link', { name: /Demo View plans/ }).click();
	await expect(page).toHaveURL(/\/pricing\/demo$/);
	await expect(page.getByRole('button', { name: 'Choose Demo workspace' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Choose Professional' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Choose Demo workspace' }).click();
	await expect(page).toHaveURL(/\/signup\/demo$/);
	await expect(page.getByRole('group', { name: 'How are you joining?' })).toHaveCount(0);
	await page.goto('/pricing/carspa');
	await expect(page.getByRole('button', { name: 'Choose Professional' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Choose Demo workspace' })).toHaveCount(0);
	expect(api.calls.filter((c) => c.path === '/catalog').map((c) => c.product)).toEqual(['demo', 'carspa']);
});
test('None has no seat controls, pays only its own plan and preserves product across reload', async ({ page }) => {
	const api = new FakeSignupApi([catalog, demoCatalog]);
	await api.install(page);
	await page.goto('/signup/demo');
	await fill(page);
	await expect(page.getByRole('heading', { name: 'Choose your plan', exact: true })).toBeVisible();
	await expect(page.getByText('No per-user charges', { exact: true })).toBeVisible();
	await expect(page.getByRole('spinbutton')).toHaveCount(0);
	await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(0);
	await expect(page.getByText('Total per year', { exact: true }).locator('..').getByText('₹123.40', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Choose your plan', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Continue to payment' }).click();
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: /Pay .*\(test\)/ }).click();
	await expect(page.getByRole('heading', { name: 'Product business is ready' })).toBeVisible();
	await expect(page.getByText('No per-user charges.', { exact: true })).toBeVisible();
	const sent = api.calls.find((c) => c.path === '/signup')!.body as any;
	expect(sent.plan).toEqual({ planCode: 'basic', interval: 'Year', seats: {}, addOns: {} });
	expect(sent.plan).not.toHaveProperty('licences');
	expect(api.calls.filter((c) => c.path !== '/products').every((c) => c.product === 'demo')).toBe(true);
});
test('Counted has one named stepper and enforces minimum with live totals', async ({ page }) => {
	const api = new FakeSignupApi([countedCatalog]);
	await api.install(page);
	await page.goto('/signup/counted');
	await fill(page);
	const input = page.getByLabel('Workspace member licences', { exact: true });
	await expect(input).toHaveValue('2');
	await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(1);
	await page.getByRole('button', { name: 'Fewer Workspace member licences' }).click();
	await expect(page.getByRole('alert')).toContainText('At least 2 seats');
	await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
	await page.getByRole('button', { name: 'More Workspace member licences' }).click();
	await page.getByRole('radio', { name: 'Monthly', exact: true }).click();
	await expect(page.getByText('₹15.00', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'More Workspace member licences' }).click();
	await expect(page.getByText('₹17.50', { exact: true })).toBeVisible();
});
test('generic PerType renders configured types, default, minimum and raw-key fallback', async ({ page }) => {
	const generic: PublicCatalog = {
		...countedCatalog,
		productKey: 'studio',
		productName: 'Studio',
		seatModel: 'PerType',
		seatTypes: [
			{ code: 'reviewer', name: 'Reviewer', sortOrder: 2, defaultSeat: false },
			{ code: 'operator', name: 'Operator', sortOrder: 1, defaultSeat: true },
		],
		plans: [
			{
				...countedCatalog.plans[0]!,
				modules: ['unknown.key'],
				monthly: {
					companyFeeMinor: 1000,
					seats: [
						{ code: 'operator', name: 'Operator', quantity: 0, priceMinor: 100 },
						{ code: 'reviewer', name: 'Reviewer', quantity: 0, priceMinor: 200 },
					],
				},
				yearly: {
					companyFeeMinor: 10000,
					seats: [
						{ code: 'operator', name: 'Operator', quantity: 0, priceMinor: 1000 },
						{ code: 'reviewer', name: 'Reviewer', quantity: 0, priceMinor: 2000 },
					],
				},
			},
		],
	};
	const api = new FakeSignupApi([generic]);
	await api.install(page);
	await page.goto('/signup/studio');
	await expect(page.getByRole('group', { name: 'How are you joining?' })).toHaveCount(0);
	await fill(page);
	await expect(page.getByLabel('Operator licences', { exact: true })).toHaveValue('2');
	await expect(page.getByLabel('Reviewer licences', { exact: true })).toHaveValue('0');
	await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(2);
	await expect(page.getByText('unknown.key', { exact: true })).toBeVisible();
	await page.getByRole('radio', { name: 'Monthly', exact: true }).click();
	await expect(page.getByText('₹12.00', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'More Reviewer licences' }).click();
	await expect(page.getByText('₹14.00', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Fewer Operator licences' }).click();
	await page.getByRole('button', { name: 'Fewer Operator licences' }).click();
	await expect(page.getByRole('alert')).toContainText('At least 2 seats');
	await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
});
test('unknown product gives a friendly page without catalog or signup calls', async ({ page }) => {
	const api = new FakeSignupApi([catalog, demoCatalog]);
	await api.install(page);
	await page.goto('/signup/missing');
	await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Choose a product' })).toBeVisible();
	expect(api.calls.filter((c) => c.path !== '/products')).toEqual([]);
});
test('switching products never carries business, plans or seats into the other product', async ({ page }) => {
	const api = new FakeSignupApi([catalog, demoCatalog]);
	await api.install(page);
	await page.goto('/signup/carspa');
	await fill(page);
	await page.getByRole('radio', { name: /^Starter/ }).click();
	await page.getByRole('button', { name: 'More Android only licences' }).click();
	await expect(page.getByText('₹14,980.00', { exact: true })).toBeVisible();
	await page.goto('/signup/demo');
	await expect(page.getByLabel('Business name')).toHaveValue('');
	await fill(page);
	await expect(page.getByRole('radio', { name: /^Demo workspace/ })).toBeVisible();
	await page.goto('/signup/carspa/plan');
	await expect(page.getByRole('radio', { name: /^Starter/ })).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByLabel('Android only licences', { exact: true })).toHaveValue('1');
	await expect(page.getByRole('radio', { name: /^Demo workspace/ })).toHaveCount(0);
	const quotes = api.calls.filter((c) => c.path === '/signup/quote');
	expect(quotes.every((c) => (c.product === 'demo' ? (c.body as any).planCode === 'basic' : (c.body as any).planCode !== 'basic'))).toBe(true);
});
test('chooser renders cards with public listing fields, starting price, action buttons and links, responsive at 390px and 1366px', async ({ page }) => {
	const api = new FakeSignupApi([catalog, demoCatalog]);
	await api.install(page);

	for (const viewport of [{ width: 1366, height: 768, name: 'desktop' }, { width: 390, height: 844, name: 'phone' }]) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'Choose your product' })).toBeVisible();
		await expect(page.getByText('Pick the software you want to try. Every product starts with a free trial.')).toBeVisible();

		const screenshotDir = path.resolve(process.cwd(), '../../docs/platform-multi-product-stage-7-screenshots');
		await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-chooser.png`), fullPage: true });

		// Baylior card
		await expect(page.getByRole('heading', { name: 'Baylior' })).toBeVisible();
		await expect(page.getByText('Car spa management made simple')).toBeVisible();
		await expect(page.getByText('Everything you need to run a detailing and car spa business.')).toBeVisible();
		await expect(page.getByText('from ₹499/mo / user')).toBeVisible();
		await expect(page.getByRole('link', { name: /Baylior Start free trial/ })).toBeVisible();
		await expect(page.getByRole('link', { name: /Baylior View plans/ })).toBeVisible();
		await expect(page.getByRole('link', { name: /Baylior Learn more/ })).toHaveAttribute('href', 'https://trovotechsolutions.in/carspa');

		// Demo card
		await expect(page.getByRole('heading', { name: 'Demo' })).toBeVisible();
		await expect(page.getByText('Demo product for testing')).toBeVisible();
		await expect(page.getByText('Try out Trovo platform capabilities.')).toBeVisible();
		await expect(page.getByText('from ₹12.34/mo')).toBeVisible();
		await expect(page.getByRole('link', { name: /Demo Start free trial/ })).toBeVisible();
		await expect(page.getByRole('link', { name: /Demo View plans/ })).toBeVisible();
		await expect(page.getByRole('link', { name: /Demo Learn more/ })).toHaveCount(0);
	}

	// Clicking Start free trial goes to signup
	await page.getByRole('link', { name: /Demo Start free trial/ }).click();
	await expect(page).toHaveURL(/\/signup\/demo$/);
});
test('copy nit: products without seats do not show add users and modules copy', async ({ page }) => {
	const api = new FakeSignupApi([catalog, demoCatalog]);
	await api.install(page);

	// Seatless product (demo)
	await page.goto('/signup/demo');
	await fill(page);
	await expect(page.getByRole('heading', { name: 'Choose your plan' })).toBeVisible();
	await expect(page.getByText('You can add users and modules later.')).toHaveCount(0);

	// Seat product (carspa)
	await page.goto('/signup/carspa');
	await fill(page);
	await expect(page.getByRole('heading', { name: 'Choose your plan and users' })).toBeVisible();
	await expect(page.getByText('You can add users and modules later.')).toBeVisible();
});

