import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * The real website against a running API (sign-up and test payments on). Creates two companies per run, so use a
 * throwaway catalog only. The codes shown are then used for the app's registration (POST /api/auth/register).
 */
const base = process.env.SIGNUP_E2E_URL ?? 'http://localhost:5192';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) && process.env.SIGNUP_E2E_ALLOW_REMOTE !== '1') {
	throw new Error(`Live sign-up tests create real companies; refusing to run against ${base}.`);
}

const productKey = process.env.SIGNUP_E2E_PRODUCT_KEY;
if (!productKey || !/^pts6[a-z0-9]{8,16}$/.test(productKey)) throw new Error('Set SIGNUP_E2E_PRODUCT_KEY to an isolated helper product key.');
const run = Date.now().toString().slice(-8);
const mobile = (first: string) => `${first}${run}${Math.floor(Math.random() * 10)}`;

async function capture(page: Page, view: string) {
	const folder = path.resolve('../../docs/platform-multi-product-stage-7-screenshots');
	await mkdir(folder, { recursive: true });
	for (const [kind, width, height] of [
		['desktop', 1366, 768],
		['phone', 390, 844],
	] as const) {
		await page.setViewportSize({ width, height });
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
		await page.screenshot({ path: path.join(folder, `${kind}-${view}.png`), fullPage: true });
	}
	await page.setViewportSize({ width: 1366, height: 768 });
}

async function fillBusiness(page: Page, name: string, email: string, phone: string) {
	await page.goto(`/signup/${productKey}`);
	await page.getByLabel('Business name').fill(name);
	await page.getByLabel('Your name').fill('E2E Owner');
	await page.getByLabel('Mobile number').fill(phone);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('City').fill('Erode');
	await page.getByLabel('State').selectOption('Tamil Nadu');
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('heading', { name: 'Choose your plan and users' })).toBeVisible();
}

async function codesShown(page: Page) {
	const codes = page.locator('code.select-all');
	return { company: (await codes.nth(0).textContent())!.trim(), registration: (await codes.nth(1).textContent())!.trim() };
}

test('a paid sign-up creates the company, and the codes register in the app', async ({ page, request }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Choose your product' })).toBeVisible();
	await capture(page, 'chooser');
	await fillBusiness(page, `E2E Paid ${run}`, `paid-${run}@e2e.test`, mobile('8'));
	await page.getByRole('radio', { name: /^Starter/ }).click();
	await page.getByRole('radio', { name: /Monthly/ }).click();
	await page.getByRole('button', { name: 'More Android only licences' }).click();
	await page.getByRole('checkbox', { name: /Outside jobs/ }).check();
	// 1 × ₹999 + 1 × ₹499 + ₹299 at the placeholder prices.
	await expect(page.getByText('₹1,797.00')).toBeVisible();
	await capture(page, 'carspa-plan');
	await page.getByRole('button', { name: 'Continue to payment' }).click();
	await expect(page.getByText('Test mode — no real money is taken')).toBeVisible();

	await capture(page, 'review');
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: /Pay ₹1,797 \(test\)/ }).click();
	await expect(page.getByRole('heading', { name: `E2E Paid ${run} is ready` })).toBeVisible({ timeout: 60_000 });
	await expect(page.getByText(/invoice TROVO\//)).toBeVisible();
	await capture(page, 'done');
	const codes = await codesShown(page);

	const registered = await request.post(`${base}/api/auth/register`, {
		data: {
			companyCode: codes.company,
			registrationCode: codes.registration,
			fullName: 'E2E Owner',
			username: 'owner',
			password: `E2e#Owner${run}`,
			confirmPassword: `E2e#Owner${run}`,
		},
	});
	expect(registered.status(), await registered.text()).toBe(201);
	const login = await request.post(`${base}/api/auth/login`, { data: { companyCode: codes.company, username: 'owner', password: `E2e#Owner${run}`, app: 'windows' } });
	expect(login.status()).toBe(200);
	const status = await (await request.get(`${base}/api/subscription/status`, { headers: { Authorization: `Bearer ${(await login.json()).token}` } })).json();
	expect(status.status).toBe('Active');
	expect(status.planCode).toBe('starter');
	expect(status.features['outside_jobs.enabled']).toBe('true');
});

test('a free trial creates the company at once, and only one trial per mobile', async ({ page, request }) => {
	const phone = mobile('9');
	await fillBusiness(page, `E2E Trial ${run}`, `trial-${run}@e2e.test`, phone);
	await page.getByRole('button', { name: /free trial instead/ }).click();
	await expect(page.getByRole('heading', { name: 'Your free trial has started' })).toBeVisible({ timeout: 60_000 });
	const codes = await codesShown(page);
	expect(codes.registration).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

	const registered = await request.post(`${base}/api/auth/register`, {
		data: {
			companyCode: codes.company,
			registrationCode: codes.registration,
			fullName: 'E2E Owner',
			username: 'owner',
			password: `E2e#Owner${run}`,
			confirmPassword: `E2e#Owner${run}`,
		},
	});
	expect(registered.status(), await registered.text()).toBe(201);

	// A second trial with the same mobile is refused, with the server's message.
	await page.evaluate(() => sessionStorage.clear());
	await fillBusiness(page, `E2E Trial Again ${run}`, `again-${run}@e2e.test`, phone);
	await page.getByRole('button', { name: /free trial instead/ }).click();
	await expect(page.getByText(/already used with this email or mobile/)).toBeVisible();
});

test('a franchisor makes a code in the app, and a new franchisee who uses it is linked at once', async ({ page, request }) => {
	// The franchisor: a paid sign-up with the Franchise network add-on, then registered and signed in like the app.
	await fillBusiness(page, `E2E Franchisor ${run}`, `franchisor-${run}@e2e.test`, mobile('7'));
	await page.getByRole('radio', { name: /^Professional/ }).click();
	await page.getByRole('radio', { name: /Monthly/ }).click();
	await page.getByRole('checkbox', { name: /^Franchise network/ }).check();
	await page.getByRole('button', { name: 'Continue to payment' }).click();
	await expect(page.getByText('Test mode — no real money is taken')).toBeVisible();
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: /Pay .* \(test\)/ }).click();
	await expect(page.getByRole('heading', { name: `E2E Franchisor ${run} is ready` })).toBeVisible({ timeout: 60_000 });
	const franchisorCodes = await codesShown(page);
	const password = `E2e#Owner${run}`;
	expect(
		(
			await request.post(`${base}/api/auth/register`, {
				data: {
					companyCode: franchisorCodes.company,
					registrationCode: franchisorCodes.registration,
					fullName: 'Franchisor Owner',
					username: 'owner',
					password,
					confirmPassword: password,
				},
			})
		).status(),
	).toBe(201);
	const login = await request.post(`${base}/api/auth/login`, { data: { companyCode: franchisorCodes.company, username: 'owner', password, app: 'windows' } });
	const auth = { Authorization: `Bearer ${(await login.json()).token}` };

	const made = await request.post(`${base}/api/franchise/signup-codes`, { headers: auth, data: { scopes: ['financial_totals', 'invoice_list'], label: 'E2E' } });
	expect(made.status(), await made.text()).toBe(200);
	const franchiseCode = (await made.json()).code as string;

	// The franchisee: chooses "Joining a franchise network", checks the code, consents and starts the trial.
	await page.evaluate(() => sessionStorage.clear());
	await page.goto(`/signup/${productKey}`);
	await page.getByRole('radio', { name: /Joining a franchise network/ }).check();
	await page.getByRole('textbox', { name: /^Franchise code/ }).fill(franchiseCode.toLowerCase());
	await page.getByRole('button', { name: 'Check code' }).click();
	await expect(page.getByText(`Franchise of E2E Franchisor ${run}`)).toBeVisible();
	await page.getByRole('checkbox', { name: `I allow E2E Franchisor ${run} to see these items.` }).check();
	await page.getByLabel('Business name').fill(`E2E Franchisee ${run}`);
	await page.getByLabel('Your name').fill('E2E Franchisee');
	await page.getByLabel('Mobile number').fill(mobile('6'));
	await page.getByLabel('Email').fill(`franchisee-${run}@e2e.test`);
	await page.getByLabel('City').fill('Salem');
	await page.getByLabel('State').selectOption('Tamil Nadu');
	await page.getByRole('button', { name: 'Continue' }).click();
	await page.getByRole('button', { name: /free trial instead/ }).click();
	await expect(page.getByRole('heading', { name: 'Your free trial has started' })).toBeVisible({ timeout: 60_000 });
	await expect(page.getByText(/Linked to the franchise network of/)).toBeVisible();

	// The franchisor sees the new franchisee in its network, active, with both items allowed; the code is used.
	const networkBody = await (await request.get(`${base}/api/franchise`, { headers: auth })).json();
	const franchisee = networkBody.franchisees.find((l: { partnerName: string }) => l.partnerName === `E2E Franchisee ${run}`);
	expect(franchisee.status).toBe('Active');
	expect(franchisee.scopes.map((s: { status: string }) => s.status)).toEqual(['Granted', 'Granted']);
	const codesBody = await (await request.get(`${base}/api/franchise/signup-codes`, { headers: auth })).json();
	expect(codesBody.codes[0].status).toBe('Used');
});

for (const trial of [false, true]) {
	test(`Demo None real ${trial ? 'trial' : 'paid test-payment'} signup`, async ({ page }) => {
		await page.goto('/signup/demo');
		await expect(page.getByRole('group', { name: 'How are you joining?' })).toHaveCount(0);
		await page.getByLabel('Business name').fill(`E2E Demo ${trial ? 'Trial' : 'Paid'} ${run}`);
		await page.getByLabel('Your name').fill('Demo Owner');
		await page.getByLabel('Mobile number').fill(mobile(trial ? '9' : '8'));
		await page.getByLabel('Email').fill(`demo-${trial ? 'trial' : 'paid'}-${run}@e2e.test`);
		await page.getByLabel('City').fill('Erode');
		await page.getByLabel('State').selectOption('Tamil Nadu');
		await page.getByRole('button', { name: 'Continue', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Choose your plan', exact: true })).toBeVisible();
		await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(0);
		await expect(page.getByText('No per-user charges', { exact: true })).toBeVisible();
		if (trial) {
			await page.getByRole('button', { name: /free trial instead/ }).click();
			await expect(page.getByRole('heading', { name: 'Your free trial has started' })).toBeVisible({ timeout: 60000 });
		} else {
			await expect(page.getByText('Total per year', { exact: true }).locator('..').getByText('₹123.40', { exact: true })).toBeVisible();
			await capture(page, 'demo-plan');
			await page.getByRole('button', { name: 'Continue to payment' }).click();
			await expect(page.getByText('Test mode — no real money is taken')).toBeVisible();
			await expect(page.getByText('No per-user charges', { exact: true })).toBeVisible();
			await capture(page, 'demo-review');
			await page.getByRole('checkbox').check();
			await page.getByRole('button', { name: /Pay ₹123.40 \(test\)/ }).click();
			await expect(page.getByRole('heading', { name: `E2E Demo Paid ${run} is ready` })).toBeVisible({ timeout: 60000 });
			await capture(page, 'demo-done');
		}
		const codes = await codesShown(page);
		expect(codes.company).toMatch(/^\d{4}$/);
		expect(codes.registration).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
	});
}
