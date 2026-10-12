import { createHmac } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** Settings for the live run, from environment variables (never from files in the repo). */
export function liveConfig() {
	const portal = process.env.PLATFORM_E2E_PORTAL_URL ?? 'http://localhost:5190';
	// Customer-side calls (registration, company sign-in) go to the API; through the portal's dev proxy by default.
	const api = process.env.PLATFORM_E2E_API_URL ?? portal;
	const owner = {
		email: process.env.PLATFORM_E2E_OWNER_EMAIL ?? '',
		password: process.env.PLATFORM_E2E_OWNER_PASSWORD ?? '',
		totpSecret: process.env.PLATFORM_E2E_OWNER_TOTP_SECRET ?? '',
	};
	const names: Record<keyof typeof owner, string> = {
		email: 'PLATFORM_E2E_OWNER_EMAIL',
		password: 'PLATFORM_E2E_OWNER_PASSWORD',
		totpSecret: 'PLATFORM_E2E_OWNER_TOTP_SECRET',
	};
	const missing = (Object.keys(owner) as (keyof typeof owner)[]).filter((k) => !owner[k]).map((k) => names[k]);
	for (const address of [portal, api]) {
		const host = new URL(address).hostname;
		if (!['localhost', '127.0.0.1', '[::1]'].includes(host) && process.env.PLATFORM_E2E_ALLOW_REMOTE !== '1') {
			throw new Error(`Live tests create real companies and databases; refusing to run against ${address}. Use a local throwaway setup.`);
		}
	}
	return { portal, api, owner, missing };
}

/** RFC 6238 code (SHA-1, 30 s, 6 digits), the same as an authenticator app shows. */
export function totp(secret: string, at = Date.now()): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	const clean = secret.replace(/[\s=]/g, '').toUpperCase();
	let bits = '';
	for (const ch of clean) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
	const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
	const hash = createHmac('sha1', key).update(counter).digest();
	const offset = hash[hash.length - 1]! & 15;
	const code = (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
	return code.toString().padStart(6, '0');
}

/** A code that stays valid for at least 5 more seconds (waits for the next one otherwise). */
export async function freshTotp(secret: string): Promise<string> {
	const left = 30_000 - (Date.now() % 30_000);
	if (left < 5_000) await new Promise((r) => setTimeout(r, left + 500));
	return totp(secret);
}

/**
 * The API allows 5 sign-in requests a minute from one address (platform sign-in, code check, password change and
 * company sign-in all count). The live flow books its requests here and waits instead of being refused.
 */
const used: number[] = [];
export async function authBudget(requests: number): Promise<void> {
	const windowMs = 62_000;
	for (;;) {
		const now = Date.now();
		while (used.length && now - used[0]! > windowMs) used.shift();
		if (used.length + requests <= 5) {
			for (let i = 0; i < requests; i++) used.push(now);
			return;
		}
		await new Promise((r) => setTimeout(r, windowMs - (now - used[0]!) + 250));
	}
}

/** Fills up the record as if the limit were used: when a run starts right after another one. */
export function assumeBudgetUsed(): void {
	const now = Date.now();
	for (let i = 0; i < 5; i++) used.push(now);
}

/**
 * Signs in through the portal. Handles the first-time authenticator setup (reads the key the page shows) and
 * returns the secret, so later sign-ins can make codes.
 */
export async function signIn(page: Page, email: string, password: string, totpSecret?: string): Promise<string> {
	await authBudget(2);
	await page.goto('/sign-in');
	await page.getByLabel('Staff email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: /continue/i }).click();

	const setup = page.getByRole('heading', { name: 'Set up your authenticator' });
	const verify = page.getByRole('heading', { name: 'Verify it’s you' });
	const limited = page.getByText('Too many attempts');
	await expect(setup.or(verify).or(limited)).toBeVisible();
	if (await limited.isVisible()) {
		assumeBudgetUsed();
		return signIn(page, email, password, totpSecret);
	}

	let secret = totpSecret;
	if (await setup.isVisible()) {
		const key = await page.locator('code').first().textContent();
		secret = key!.replace(/\s/g, '');
	}
	const signedIn = page.getByRole('heading', { name: /Operations overview|Choose a new password/ });
	for (let attempt = 0; attempt < 3; attempt++) {
		await page.getByLabel('Authentication code').fill(await freshTotp(secret!));
		await page.getByRole('button', { name: /^(Verify|Confirm and sign in)$/ }).click();
		await expect(signedIn.or(limited)).toBeVisible();
		if (await signedIn.isVisible()) return secret!;
		// Refused by the rate limit (an earlier run used it up): the challenge lasts 5 minutes, so wait and retry.
		assumeBudgetUsed();
		await authBudget(1);
	}
	throw new Error('Sign-in kept being rate limited.');
}

export async function signOut(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page.getByLabel('Staff email')).toBeVisible();
}

/** The customer's side: sign in to their company with the company code (as the desktop and Android apps do). */
export async function companyLogin(request: APIRequestContext, api: string, companyCode: string, username: string, password: string) {
	await authBudget(1);
	return request.post(`${api}/api/auth/login`, { data: { companyCode, username, password } });
}

export function stamp(): string {
	return new Date().toISOString().replace(/\D/g, '').slice(4, 14);
}
