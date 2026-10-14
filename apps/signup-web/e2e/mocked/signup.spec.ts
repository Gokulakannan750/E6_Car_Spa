import { expect, test, type Page } from '@playwright/test';
import { FakeSignupApi } from './fakeApi';

async function setup(page: Page) {
	const api = new FakeSignupApi();
	await api.install(page);
	const problems: string[] = [];
	page.on('pageerror', (e) => problems.push(e.message));
	page.on('console', (m) => {
		if (m.type() === 'error' && !m.text().includes('Failed to load resource')) problems.push(m.text());
	});
	await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP blocked ${e.blockedURI}`)));
	return { api, problems };
}

async function fillBusiness(page: Page, mobile = '98765 43210') {
	await page.getByLabel('Business name').fill('Sunrise Detailing');
	await page.getByLabel('Your name').fill('Arun Kumar');
	await page.getByLabel('Mobile number').fill(mobile);
	await page.getByLabel('Email').fill('arun@sunrise.in');
	await page.getByLabel('City').fill('Erode');
	await page.getByLabel('State').selectOption('Tamil Nadu');
}

test('buys Professional yearly with mixed licences and an add-on, pays (test) and gets the codes', async ({ page }) => {
	const { api, problems } = await setup(page);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Run your car spa on Baylior' })).toBeVisible();
	await expect(page.getByText('₹14,990')).toBeVisible(); // Professional yearly, both apps
	await page.getByRole('button', { name: 'Choose Professional' }).click();

	// Step 1 checks the fields before moving on.
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByText('Enter your business name.')).toBeVisible();
	await fillBusiness(page, '12345');
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByText('Enter a 10-digit mobile number.')).toBeVisible();
	await page.getByLabel('Mobile number').fill('98765 43210');
	await page.getByRole('button', { name: 'Continue' }).click();

	// Step 2: licences and add-ons; the server's price shows in the summary.
	await expect(page.getByRole('heading', { name: 'Choose your plan and users' })).toBeVisible();
	await page.getByRole('button', { name: 'More Android only licences' }).click();
	await page.getByRole('button', { name: 'More Android only licences' }).click();
	await page.getByRole('checkbox').check(); // Showroom (WhatsApp and outside jobs are included in Professional)
	await expect(page.getByText('Included in Professional').first()).toBeVisible();
	await expect(page.getByText('₹40,960.00')).toBeVisible();
	await page.getByRole('button', { name: 'Continue to payment' }).click();

	// Step 3: test mode, terms, pay.
	await expect(page.getByText('Test mode — no real money is taken')).toBeVisible();
	const pay = page.getByRole('button', { name: /Pay ₹40,960 \(test\)/ });
	await expect(pay).toBeDisabled();
	await page.getByRole('checkbox').check();
	await pay.click();

	await expect(page.getByRole('heading', { name: 'Sunrise Detailing is ready' })).toBeVisible();
	await expect(page.getByText('K7QM-4RTX-9PWD').first()).toBeVisible();
	await expect(page.getByText('0007').first()).toBeVisible();
	await expect(page.getByText(/invoice TROVO\/2026-27\/0012/)).toBeVisible();

	const order = api.calls.find((c) => c.path === '/signup')!.body as { plan: object; business: object; acceptTerms: boolean };
	expect(order.plan).toEqual({ planCode: 'professional', interval: 'Year', licences: { android: 2, windows: 0, both: 1 }, addOns: { showroom: 1 } });
	expect(order.business).toMatchObject({ name: 'Sunrise Detailing', mobile: '98765 43210', state: 'Tamil Nadu', gstin: null });
	expect(order.acceptTerms).toBe(true);
	expect(problems).toEqual([]);
});

test('a failed payment shows the failure screen and lets the customer try again', async ({ page }) => {
	const { api } = await setup(page);
	api.paymentFails = true;
	await page.goto('/signup');
	await fillBusiness(page);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByText(/₹14,990\.00/).last()).toBeVisible();
	await page.getByRole('button', { name: 'Continue to payment' }).click();
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: /Pay .* \(test\)/ }).click();
	await expect(page.getByRole('heading', { name: "Payment didn't go through" })).toBeVisible();
	await expect(page.getByText('This order has expired. Please start again.')).toBeVisible();

	api.paymentFails = false;
	await page.getByRole('button', { name: 'Try again' }).click();
	await page.getByRole('button', { name: /Pay .* \(test\)/ }).click();
	await expect(page.getByRole('heading', { name: 'Sunrise Detailing is ready' })).toBeVisible();
});

test('a franchise outlet checks the code, must consent, and is linked when the trial starts', async ({ page }) => {
	const { api, problems } = await setup(page);
	await page.goto('/signup');
	await expect(page.getByRole('radio', { name: /My own car spa/ })).toBeChecked();
	await page.getByRole('radio', { name: /Joining a franchise network/ }).check();

	await page.getByRole('textbox', { name: /^Franchise code/ }).fill('AAAA-BBBB-CCCC');
	await page.getByRole('button', { name: 'Check code' }).click();
	await expect(page.getByText(/This franchise code is not valid/)).toBeVisible();

	await page.getByRole('textbox', { name: /^Franchise code/ }).fill('fran-4cod-e7xy');
	await page.getByRole('button', { name: 'Check code' }).click();
	await expect(page.getByText('Franchise of')).toBeVisible();
	await expect(page.getByText('Financial totals (revenue, collections, jobs, invoices)')).toBeVisible();

	await fillBusiness(page);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByText(/Tick the box to allow your franchisor/)).toBeVisible();
	await page.getByRole('checkbox', { name: 'I allow E6 Car Spa to see these items.' }).check();
	await page.getByRole('button', { name: 'Continue' }).click();

	await page.getByRole('button', { name: /free trial instead/ }).click();
	await expect(page.getByRole('heading', { name: 'Your free trial has started' })).toBeVisible();
	await expect(page.getByText(/Linked to the franchise network of/)).toBeVisible();
	const sent = api.calls.find((c) => c.path === '/signup')!.body as { franchiseCode: string; franchiseConsent: boolean };
	expect(sent).toMatchObject({ franchiseCode: 'FRAN-4COD-E7XY', franchiseConsent: true });
	expect(problems).toEqual([]);
});

test('adding a branch is not a sign-up: the site explains where to do it', async ({ page }) => {
	const { api } = await setup(page);
	await page.goto('/signup');
	await page.getByRole('radio', { name: /Adding a branch/ }).check();
	await expect(page.getByText(/not signed up here/)).toBeVisible();
	await expect(page.getByLabel('Business name')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
	expect(api.calls.filter((c) => c.path.startsWith('/signup'))).toEqual([]);
});

for (const width of [320, 390, 768, 1366]) {
	test(`header keeps the product return link usable at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 844 });
		await setup(page);
		await page.goto('/');
		const header = page.getByRole('banner');
		const back = header.getByRole('link', { name: 'About Baylior' });
		const brand = header.getByRole('link', { name: 'Baylior home' });
		const contact = header.getByRole('link', { name: /Call Trovo/ });
		await expect(back).toBeVisible();
		await expect(back).toHaveAttribute('href', (await page.getByRole('contentinfo').getByRole('link', { name: 'About Baylior' }).getAttribute('href'))!);
		await back.focus();
		await expect(back).toBeFocused();
		const [logoBox, backBox, contactBox] = await Promise.all([brand.boundingBox(), back.boundingBox(), contact.boundingBox()]);
		expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(backBox!.x);
		expect(backBox!.x + backBox!.width).toBeLessThanOrEqual(contactBox!.x);
		expect(contactBox!.x + contactBox!.width).toBeLessThanOrEqual(width);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
	});
}

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	test('starts the free trial and shows the codes', async ({ page }) => {
		const { problems } = await setup(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Start free trial' }).first().click();
		await fillBusiness(page);
		await page.getByRole('button', { name: 'Continue' }).click();
		await page.getByRole('button', { name: 'Start 7-day free trial instead' }).click();

		await expect(page.getByRole('heading', { name: 'Your free trial has started' })).toBeVisible();
		await expect(page.getByText('H3TB-8KWQ-2MZD').first()).toBeVisible();
		await expect(page.getByText('No payment taken.')).toBeVisible();
		// Nothing wider than the screen.
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
		expect(problems).toEqual([]);
	});
});
