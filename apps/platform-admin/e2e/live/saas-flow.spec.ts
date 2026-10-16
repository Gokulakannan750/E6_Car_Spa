import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { authBudget, assumeBudgetUsed, companyLogin, liveConfig, signIn, signOut, stamp } from './helpers';

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
	assumeBudgetUsed(); // A bootstrap or previous run may have used the server’s authentication window.
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
	if (await page.getByRole('combobox', { name: 'Product', exact: true }).count())
		await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption(process.env.PLATFORM_E2E_PRODUCT_KEY ?? 'carspa');
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
	await authBudget(2); // Registration and deliberate code-reuse attempt both count.
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
	// One person on both apps (the owner) and one Android-only user, plus the Outside jobs module.
	await change.getByLabel('Windows + Android licences', { exact: true }).fill('1');
	await change.getByLabel('Windows only licences', { exact: true }).fill('0');
	await change.getByLabel('Android only licences', { exact: true }).fill('1');
	await change.getByRole('checkbox', { name: 'Include Outside jobs & vendors' }).check();
	await expect(change.getByText('₹17,970.00')).toBeVisible(); // ₹9,990 + ₹4,990 + ₹2,990 (placeholder prices)
	await change.getByLabel('Reason (recorded in the audit log)').fill('E2E: customer chose Starter yearly');
	await change.getByRole('button', { name: 'Send for approval' }).click();
	await expect(page.getByText('Sent to the customer. Their Owner approves it in the app.')).toBeVisible();
	const ownerLogin = await companyLogin(request, config.api, companyCode, customer.username, customer.password);
	expect(ownerLogin.status(), await ownerLogin.text()).toBe(200);
	const ownerHeaders = { Authorization: `Bearer ${(await ownerLogin.json()).token}` };
	const proposalResponse = await request.get(`${config.api}/api/subscription/plan-change`, { headers: ownerHeaders });
	expect(proposalResponse.status(), await proposalResponse.text()).toBe(200);
	const proposal = await proposalResponse.json();
	expect(proposal.to.planName).toBe('Starter');
	const approval = await request.post(`${config.api}/api/subscription/plan-change/${proposal.id}/approve`, { headers: ownerHeaders });
	expect(approval.status(), await approval.text()).toBe(204);
	await page.reload();
	await expect(page.getByText('Starter', { exact: true }).first()).toBeVisible();

	await page.getByRole('tab', { name: /Invoices/ }).click();
	await page.getByRole('button', { name: 'Issue next invoice' }).click();
	const issued = page.getByText(/^Invoice TROVO\/\S+ issued for/);
	await expect(issued).toBeVisible();
	invoiceNumber = (await issued.textContent())!.match(/TROVO\/\S+/)![0];

	const row = page.getByRole('row', { name: new RegExp(invoiceNumber.replace(/\//g, '\\/')) });
	await expect(row.getByText('₹17,970.00').first()).toBeVisible();
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
	expect(status.features['outside_jobs.enabled']).toBe('true');
	expect(status.features['staff_advances.enabled']).toBe('false');
});

test('a user with an Android licence signs in only from Android', async ({ request }) => {
	const owner = await companyLogin(request, config.api, companyCode, customer.username, customer.password);
	const ownerToken = (await owner.json()).token as string;
	const field = { username: 'field', password: `E2e#Field${run}` };
	const created = await request.post(`${config.api}/api/users`, {
		headers: { Authorization: `Bearer ${ownerToken}` },
		data: { fullName: 'Field Staff', ...field, confirmPassword: field.password, role: 'Staff', appAccess: 'Android', permissionCodes: [] },
	});
	expect(created.status(), await created.text()).toBe(201);

	// Both licences are now taken: a second Android user is refused.
	const second = await request.post(`${config.api}/api/users`, {
		headers: { Authorization: `Bearer ${ownerToken}` },
		data: { fullName: 'Second', username: 'second', password: field.password, confirmPassword: field.password, role: 'Staff', appAccess: 'Android' },
	});
	expect(second.status()).toBe(400);

	const fromWindows = await companyLogin(request, config.api, companyCode, field.username, field.password, 'windows');
	expect(fromWindows.status()).toBe(403);
	expect((await fromWindows.json()).error).toContain('Android app only');
	const fromAndroid = await companyLogin(request, config.api, companyCode, field.username, field.password, 'android');
	expect(fromAndroid.status(), await fromAndroid.text()).toBe(200);

	// The portal sees the licences in use.
	await openCompany();
	const licences = page.getByRole('table').filter({ hasText: 'Seat type' });
	await expect(licences.getByRole('row', { name: /Android only 1 1/ })).toBeVisible();
});

test('the invoice prints with Trovo’s details', async () => {
	await openCompany();
	await page.getByRole('tab', { name: /Invoices/ }).click();
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
	expect(await readFile((await (await download).path())!, 'utf8')).toContain(`${companyCode},${companyName},Active,Active,Starter,Yearly,2,`);

	await page.goto(`/invoices?search=${encodeURIComponent(invoiceNumber)}`);
	download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export CSV' }).click();
	expect(await readFile((await (await download).path())!, 'utf8')).toContain(`${invoiceNumber},${companyCode},${companyName},Paid,No`);
});

test('the audit log shows every step with its reason', async () => {
	await page.goto('/audit-log');
	await page.getByLabel('Company').selectOption({ label: `${companyCode} · ${companyName}` });
	for (const action of ['Company created', 'Plan change proposed', 'Invoice issued', 'Payment recorded', 'Company suspended', 'Company reactivated']) {
		await expect(page.getByRole('cell', { name: action, exact: true }).first()).toBeVisible();
	}
	await page.getByRole('cell', { name: 'Plan change proposed', exact: true }).first().click();
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
	await authBudget(1);
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
