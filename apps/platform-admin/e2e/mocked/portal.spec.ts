import { expect, test, type Page } from '@playwright/test';
import { FakePlatform, type FakeOptions } from './fakePlatform';

/** Records Content-Security-Policy violations and page errors so a test can assert there were none. */
async function watchForProblems(page: Page) {
	const problems: string[] = [];
	page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
	page.on('console', (m) => {
		if (m.type() === 'error' && !m.text().includes('Failed to load resource')) problems.push(`console: ${m.text()}`);
	});
	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP blocked ${e.blockedURI} (${e.violatedDirective})`));
	});
	return problems;
}

async function start(page: Page, options: FakeOptions = {}) {
	const api = new FakePlatform(options);
	await api.install(page);
	const problems = await watchForProblems(page);
	return { api, problems };
}

async function signIn(page: Page) {
	await page.goto('/');
	await page.getByLabel('Staff email').fill('owner@trovo.test');
	await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
	await page.getByRole('button', { name: /continue/i }).click();
	await page.getByLabel('Authentication code').fill('123456');
	await page.getByRole('button', { name: 'Verify' }).click();
	await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
}

test('first sign-in: QR setup, then a new password, then the dashboard', async ({ page }) => {
	const { api, problems } = await start(page, { firstSignIn: true });
	await page.goto('/companies');
	await expect(page).toHaveURL(/\/sign-in$/);

	await page.getByLabel('Staff email').fill('owner@trovo.test');
	await page.getByLabel('Password', { exact: true }).fill('wrong password');
	await page.getByRole('button', { name: /continue/i }).click();
	await expect(page.getByRole('alert')).toContainText('Invalid email or password.');

	await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
	await page.getByRole('button', { name: /continue/i }).click();
	await expect(page.getByRole('heading', { name: 'Set up your authenticator' })).toBeVisible();
	await expect(page.getByAltText('Authenticator QR code')).toBeVisible();
	await expect(page.getByText('JBSW Y3DP EHPK 3PXP')).toBeVisible();

	await page.getByLabel('Authentication code').fill('123456');
	await page.getByRole('button', { name: 'Confirm and sign in' }).click();

	await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
	await page.getByLabel('Current password').fill('correct horse battery');
	await page.getByLabel('New password', { exact: true }).fill('a much longer password');
	await page.getByLabel('Confirm new password').fill('a much longer password');
	await page.getByRole('button', { name: 'Save and continue' }).click();

	await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
	expect(api.requests.some((r) => r.path === '/auth/change-password')).toBe(true);

	// The session survives a reload of the tab.
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
	expect(problems).toEqual([]);
});

test('creates an already-paid company and shows its codes once', async ({ page }) => {
	const { api, problems } = await start(page);
	await signIn(page);
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Companies' }).click();
	await page.getByRole('button', { name: 'New company' }).click();

	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Company name').fill('Sunrise Detailing');
	await dialog.getByRole('radio', { name: /Already paid/ }).click();
	await dialog.getByRole('radio', { name: 'Yearly' }).click();
	await dialog.getByRole('radio', { name: /Starter/ }).click();
	await dialog.getByRole('checkbox', { name: 'Include Showroom / B2B module' }).check();
	await expect(dialog.getByText('₹19,980.00')).toBeVisible(); // 1 × ₹9,990 Windows + Android licence + ₹9,990 showroom
	await dialog.getByRole('button', { name: 'More Android only licences' }).click();
	await expect(dialog.getByText('₹24,970.00')).toBeVisible();
	await dialog.getByRole('button', { name: 'Create company' }).click();

	await expect(dialog.getByText('Sunrise Detailing is ready')).toBeVisible();
	await expect(dialog.getByText('K7QM-4RTX-9PWD')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog.getByText('K7QM-4RTX-9PWD')).toBeVisible();
	await dialog.getByRole('button', { name: 'Done' }).click();

	await expect(page.getByRole('cell', { name: 'Sunrise Detailing' })).toBeVisible();
	const created = api.requests.find((r) => r.method === 'POST' && r.path === '/companies')!.body as { plan: object };
	expect(created.plan).toMatchObject({ planCode: 'starter', interval: 'Year', addOns: { showroom: 1 }, licences: { android: 1, windows: 0, both: 1 } });
	expect(problems).toEqual([]);
});

test('records a payment on an overdue invoice and exports invoices to CSV', async ({ page }) => {
	const { api, problems } = await start(page, { role: 'Billing' });
	await signIn(page);
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Invoices' }).click();

	const row = page.getByRole('row', { name: /TROVO\/2026-27\/0001/ });
	await expect(row.getByText('Overdue')).toBeVisible();
	await row.getByRole('button', { name: 'Record payment' }).click();

	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Reference').fill('UTR998877');
	await dialog.getByRole('button', { name: 'Record payment' }).click();
	await expect(page.getByText('TROVO/2026-27/0001 is paid. The subscription is renewed.')).toBeVisible();
	await expect(row.getByText('Paid')).toBeVisible();
	expect(api.requests.find((r) => r.path.endsWith('/payments'))!.body).toMatchObject({ amountMinor: 199_900, reference: 'UPI: UTR998877' });

	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export CSV' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toMatch(/^trovo-invoices-all-\d{4}-\d{2}-\d{2}\.csv$/);
	const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'));
	expect(text).toContain('TROVO/2026-27/0001,0001,E6 Car Spa,Paid');
	expect(problems).toEqual([]);
});

test('a read-only admin sees no change buttons and no owner pages', async ({ page }) => {
	const { problems } = await start(page, { role: 'ReadOnly' });
	await signIn(page);
	await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'New company' })).toHaveCount(0);
	const nav = page.getByRole('navigation', { name: 'Main' });
	await expect(nav.getByRole('link', { name: 'Admins' })).toHaveCount(0);
	await expect(nav.getByRole('link', { name: 'Audit Log' })).toHaveCount(0);

	await page.goto('/admins');
	await expect(page.getByText('Not available for your role')).toBeVisible();

	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page.getByRole('heading', { name: 'Trovo Platform' })).toBeVisible();
	expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
	expect(problems).toEqual([]);
});
