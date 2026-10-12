import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { companyLogin, liveConfig, signIn, signOut, stamp } from './helpers';

/**
 * The whole SaaS flow against a running API and PostgreSQL, through the real portal:
 * Trovo creates a company → the customer registers with the codes → Trovo changes the plan, issues an invoice and
 * records the payment → the customer's subscription is active → suspend blocks the customer's sign-in and
 * reactivate restores it → CSV exports and the audit log show it all → a new admin is onboarded and switched off.
 *
 * Creates a company (and its database) on every run: point it only at a throwaway catalog.
 */
const config = liveConfig();
test.describe.configure({ mode: 'serial' });
test.skip(config.missing.length > 0, `Set ${config.missing.join(', ')} to run the live tests (see e2e/live/README.md).`);

const run = stamp();
const companyName = `E2E Spa ${run}`;
const customer = { username: 'owner', password: `E2e#Owner${run}`, fullName: 'E2E Owner' };
let companyCode = '';
let registrationCode = '';
let invoiceNumber = '';

let page: Page;

test.beforeAll(async ({ browser }) => {
	page = await browser.newPage();
});

test.afterAll(async () => {
	await page.close();
});

async function openCompany() {
	await page.goto(`/companies?search=${encodeURIComponent(companyCode)}`);
	await page.getByRole('row', { name: new RegExp(`Open ${companyCode} `) }).click();
	await expect(page.getByRole('heading', { name: new RegExp(companyName) })).toBeVisible();
}

test('Trovo creates a company on a free trial and gets its codes', async () => {
	await signIn(page, config.owner.email, config.owner.password, config.owner.totpSecret);
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Companies' }).click();
	await page.getByRole('button', { name: 'New company' }).click();

	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Company name').fill(companyName);
	await dialog.getByRole('button', { name: 'Create company' }).click();
	await expect(dialog.getByText(`${companyName} is ready`)).toBeVisible({ timeout: 60_000 });

	companyCode = (await dialog.locator('code').nth(0).textContent())!.trim();
	registrationCode = (await dialog.locator('code').nth(1).textContent())!.trim();
	expect(companyCode).toMatch(/^\d{4}$/);
	expect(registrationCode.length).toBeGreaterThan(8);
	await dialog.getByRole('button', { name: 'Done' }).click();

	await expect(page.getByRole('row', { name: new RegExp(`Open ${companyCode} `) }).getByText('Awaiting registration')).toBeVisible();
});

test('the customer registers with the two codes and signs in on a trial', async ({ request }) => {
	const registered = await request.post(`${config.api}/api/auth/register`, {
		data: { companyCode, registrationCode, ...customer, confirmPassword: customer.password },
	});
	expect(registered.status(), await registered.text()).toBe(201);

	const again = await request.post(`${config.api}/api/auth/register`, {
		data: { companyCode, registrationCode, ...customer, username: 'someone', confirmPassword: customer.password },
	});
	expect(again.ok(), 'a registration code works only once').toBe(false);

	const login = await companyLogin(request, config.api, companyCode, customer.username, customer.password);
	expect(login.status(), await login.text()).toBe(200);
	const token = (await login.json()).token as string;
	const status = await (await request.get(`${config.api}/api/subscription/status`, { headers: { Authorization: `Bearer ${token}` } })).json();
	expect(status.status).toBe('Trialing');
});

test('Trovo moves it to Starter yearly, invoices it and records the bank payment', async ({ request }) => {
	await openCompany();
	await expect(page.getByText(/Registered \d/)).toBeVisible();

	await page.getByRole('button', { name: 'Change plan' }).click();
	const change = page.getByRole('dialog');
	await change.getByRole('radio', { name: 'Yearly' }).click();
	await change.getByRole('radio', { name: /Starter/ }).click();
	await change.getByLabel('Reason (recorded in the audit log)').fill('E2E: customer chose Starter yearly');
	await change.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByText('Subscription updated.')).toBeVisible();
	await expect(page.getByText('Starter', { exact: true }).first()).toBeVisible();

	await page.getByRole('tab', { name: /Invoices/ }).click();
	await page.getByRole('button', { name: 'Issue next invoice' }).click();
	const issued = page.getByText(/^Invoice TROVO\/\S+ issued for/);
	await expect(issued).toBeVisible();
	invoiceNumber = (await issued.textContent())!.match(/TROVO\/\S+/)![0];

	const row = page.getByRole('row', { name: new RegExp(invoiceNumber.replace(/\//g, '\\/')) });
	await expect(row.getByText('₹9,990.00').first()).toBeVisible();
	await row.getByRole('button', { name: 'Record payment' }).click();
	const pay = page.getByRole('dialog');
	await pay.getByLabel('Paid by').selectOption('Bank transfer');
	await pay.getByLabel('Reference').fill(`E2E-UTR-${run}`);
	await pay.getByRole('button', { name: 'Record payment' }).click();
	await expect(page.getByText(`${invoiceNumber} is paid. The subscription is renewed.`)).toBeVisible();
	await expect(row.getByText('Paid', { exact: true })).toBeVisible();

	const login = await companyLogin(request, config.api, companyCode, customer.username, customer.password);
	const token = (await login.json()).token as string;
	const status = await (await request.get(`${config.api}/api/subscription/status`, { headers: { Authorization: `Bearer ${token}` } })).json();
	expect(status.status).toBe('Active');
	expect(status.planCode).toBe('starter');
});

test('the invoice prints with Trovo’s details', async () => {
	await page.getByRole('link', { name: `Print ${invoiceNumber}` }).click();
	await expect(page.getByRole('heading', { name: 'Invoice' })).toBeVisible();
	await expect(page.getByText(invoiceNumber, { exact: true })).toBeVisible();
	await expect(page.getByText('Trovo Tech Solutions')).toBeVisible();
	await expect(page.getByText('Private Limited')).toHaveCount(0);
	await page.getByRole('button', { name: 'Back' }).click();
});

test('suspending blocks the customer’s sign-in; reactivating restores it', async ({ request }) => {
	await openCompany();
	await page.getByRole('button', { name: 'Suspend' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Customer request' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Suspend' }).click();
	await expect(page.getByText(`${companyName} suspended.`)).toBeVisible();

	const blocked = await companyLogin(request, config.api, companyCode, customer.username, customer.password);
	expect(blocked.ok(), 'a suspended company cannot sign in').toBe(false);

	await page.getByRole('button', { name: 'Reactivate' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Payment received' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Reactivate' }).click();
	await expect(page.getByText(`${companyName} reactivated.`)).toBeVisible();

	const back = await companyLogin(request, config.api, companyCode, customer.username, customer.password);
	expect(back.status(), await back.text()).toBe(200);
});

test('CSV exports include the company and its paid invoice', async () => {
	await page.goto(`/companies?search=${companyCode}`);
	let download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export CSV' }).click();
	expect(await readFile((await (await download).path())!, 'utf8')).toContain(`${companyCode},${companyName},Active,Active,Starter,Yearly`);

	await page.goto(`/invoices?search=${encodeURIComponent(invoiceNumber)}`);
	download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export CSV' }).click();
	expect(await readFile((await (await download).path())!, 'utf8')).toContain(`${invoiceNumber},${companyCode},${companyName},Paid,No`);
});

test('the audit log shows every step with its reason', async () => {
	await page.goto('/audit-log');
	await page.getByLabel('Company').selectOption({ label: `${companyCode} · ${companyName}` });
	for (const action of ['Company created', 'Subscription changed', 'Invoice issued', 'Payment recorded', 'Company suspended', 'Company reactivated']) {
		await expect(page.getByRole('cell', { name: action, exact: true }).first()).toBeVisible();
	}
	await page.getByRole('cell', { name: 'Subscription changed', exact: true }).first().click();
	await expect(page.getByRole('dialog').getByText('E2E: customer chose Starter yearly')).toBeVisible();
	await page.keyboard.press('Escape');
});

test('a new Support admin signs in for the first time, and is switched off', async () => {
	const email = `support-${run}@trovo.test`;
	await page.goto('/admins');
	await page.getByRole('button', { name: 'Add admin' }).click();
	const add = page.getByRole('dialog');
	await add.getByLabel('Name').fill('E2E Support');
	await add.getByLabel('Email').fill(email);
	await add.getByLabel('Role').selectOption('Support');
	await add.getByRole('button', { name: 'Add admin' }).click();
	await expect(page.getByRole('dialog').getByText('Admin added')).toBeVisible();
	const oneTime = (await page.getByRole('dialog').locator('code').nth(1).textContent())!.trim();
	await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
	await signOut(page);

	await signIn(page, email, oneTime);
	await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
	await page.getByLabel('Current password').fill(oneTime);
	await page.getByLabel('New password', { exact: true }).fill(`Support pass ${run}`);
	await page.getByLabel('Confirm new password').fill(`Support pass ${run}`);
	await page.getByRole('button', { name: 'Save and continue' }).click();
	await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admins' })).toHaveCount(0);
	await signOut(page);

	await signIn(page, config.owner.email, config.owner.password, config.owner.totpSecret);
	await page.goto('/admins');
	await page.getByRole('button', { name: `Switch off ${email}` }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Left Trovo' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Switch off' }).click();
	await expect(page.getByRole('row', { name: new RegExp(email) }).getByText('Switched off')).toBeVisible();
});
