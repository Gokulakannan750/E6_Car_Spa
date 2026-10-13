import type { Page, Route } from '@playwright/test';

/** An in-memory stand-in for the public sign-up API (docs/SIGNUP_API.md), with the placeholder prices. */
const plan = (code: string, name: string, monthly: [number, number, number], modules: string[]) => {
	const prices = (k: number) => ({ companyFeeMinor: 0, androidUserPriceMinor: monthly[0] * k, windowsUserPriceMinor: monthly[1] * k, bothUserPriceMinor: monthly[2] * k });
	return { code, name, minimumLicences: 1, modules, monthly: prices(1), yearly: prices(10) };
};

export const catalog = {
	productName: 'Car Spa Management',
	plans: [
		plan('starter', 'Starter', [49_900, 69_900, 99_900], []),
		plan('professional', 'Professional', [79_900, 119_900, 149_900], [
			'audit_trail.enabled', 'outside_jobs.enabled', 'reports.advanced', 'staff_advances.enabled', 'whatsapp_automation.enabled',
		]),
	],
	addOns: [
		{ code: 'showroom', name: 'Showroom / B2B module', featureKey: 'showroom.enabled', isPack: false, perUnit: 1, monthlyPriceMinor: 99_900, yearlyPriceMinor: 999_000 },
		{ code: 'outside_jobs', name: 'Outside jobs & vendors', featureKey: 'outside_jobs.enabled', isPack: false, perUnit: 1, monthlyPriceMinor: 29_900, yearlyPriceMinor: 299_000 },
		{ code: 'whatsapp_automation', name: 'WhatsApp automation', featureKey: 'whatsapp_automation.enabled', isPack: false, perUnit: 1, monthlyPriceMinor: 29_900, yearlyPriceMinor: 299_000 },
	],
	trialDays: 7,
	trialLicences: 3,
	graceDays: 7,
	chargesGst: false,
	gstRatePercent: null,
	testPayments: true,
	sellerName: 'Trovo Tech Solutions',
	sellerPhone: '+91 90426 72148',
	sellerEmail: 'info@trovotechsolutions.in',
};

type Choice = { planCode: string; interval: 'Month' | 'Year'; licences: { android: number; windows: number; both: number }; addOns: Record<string, number> };

function quote(choice: Choice) {
	const p = catalog.plans.find((x) => x.code === choice.planCode)!;
	const prices = choice.interval === 'Year' ? p.yearly : p.monthly;
	const period = choice.interval === 'Year' ? 'yearly' : 'monthly';
	const lines: { description: string; quantity: number; unitPriceMinor: number; amountMinor: number }[] = [];
	for (const [key, label, price] of [
		['both', 'Windows + Android', prices.bothUserPriceMinor],
		['windows', 'Windows', prices.windowsUserPriceMinor],
		['android', 'Android', prices.androidUserPriceMinor],
	] as const) {
		const n = choice.licences[key];
		if (n > 0) lines.push({ description: `${label} user licence, ${p.name} (${period})`, quantity: n, unitPriceMinor: price, amountMinor: price * n });
	}
	for (const [code, qty] of Object.entries(choice.addOns)) {
		const a = catalog.addOns.find((x) => x.code === code)!;
		const price = choice.interval === 'Year' ? a.yearlyPriceMinor : a.monthlyPriceMinor;
		lines.push({ description: `${a.name} (${period})`, quantity: qty, unitPriceMinor: price, amountMinor: price * qty });
	}
	const total = lines.reduce((s, l) => s + l.amountMinor, 0);
	return { planCode: p.code, planName: p.name, interval: choice.interval, lines, subtotalMinor: total, taxMinor: 0, taxRatePercent: null, totalMinor: total, currency: 'INR', cheaper: null };
}

export class FakeSignupApi {
	readonly calls: { method: string; path: string; body: unknown }[] = [];
	paymentFails = false;

	async install(page: Page) {
		await page.route('**/api/public/**', (route) => this.handle(route));
	}

	private async handle(route: Route) {
		const req = route.request();
		const path = new URL(req.url()).pathname.replace('/api/public', '');
		const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
		this.calls.push({ method: req.method(), path, body });
		const json = (status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
		const base = { quote: null, currency: 'INR', expiresAt: new Date(Date.now() + 86_400_000).toISOString(), testPayments: true, registrationCodeExpiresAt: '2026-11-03T00:00:00Z' };

		if (path === '/catalog') return json(200, catalog);
		if (path === '/signup/quote') {
			const total = body.licences.android + body.licences.windows + body.licences.both;
			return total === 0 ? json(400, { error: 'At least 1 user licence is needed.' }) : json(200, quote(body));
		}
		if (path === '/signup' && body.startTrial) {
			return json(201, { ...base, orderId: 't1', orderToken: 'tok', status: 'Completed', start: 'Trial', amountMinor: 0, companyCode: '0008', registrationCode: 'H3TB-8KWQ-2MZD', trialEndsAt: '2026-10-27T00:00:00Z', paidUntil: null, invoiceNumber: null });
		}
		if (path === '/signup') {
			const q = quote(body.plan);
			return json(201, { ...base, orderId: 'o1', orderToken: 'secret-token', status: 'AwaitingPayment', start: 'Paid', quote: q, amountMinor: q.totalMinor, companyCode: null, registrationCode: null, trialEndsAt: null, paidUntil: null, invoiceNumber: null });
		}
		if (path === '/signup/o1/test-payment') {
			if (this.paymentFails) return json(409, { error: 'This order has expired. Please start again.' });
			const placed = this.calls.find((c) => c.path === '/signup' && !(c.body as { startTrial: boolean }).startTrial)!.body as { plan: Choice };
			const q = quote(placed.plan);
			return json(200, { ...base, orderId: 'o1', orderToken: null, status: 'Completed', start: 'Paid', amountMinor: q.totalMinor, companyCode: '0007', registrationCode: 'K7QM-4RTX-9PWD', trialEndsAt: null, paidUntil: '2027-10-19T00:00:00Z', invoiceNumber: 'TROVO/2026-27/0012' });
		}
		return json(404, { error: 'Not found' });
	}
}
