import type { PublicCatalog, PlanChoice } from '../../src/lib/types';
import type { Page, Route } from '@playwright/test';

/** An in-memory stand-in for the public sign-up API (docs/SIGNUP_API.md), with the placeholder prices. */
const plan = (code: string, name: string, monthly: [number, number, number], modules: string[]) => {
	const prices = (k: number) => ({
		companyFeeMinor: 0,
		androidUserPriceMinor: monthly[0] * k,
		windowsUserPriceMinor: monthly[1] * k,
		bothUserPriceMinor: monthly[2] * k,
		seats: [
			{ code: 'android', name: 'Android only', quantity: 0, priceMinor: monthly[0] * k },
			{ code: 'windows', name: 'Windows only', quantity: 0, priceMinor: monthly[1] * k },
			{ code: 'both', name: 'Windows + Android', quantity: 0, priceMinor: monthly[2] * k },
		],
	});
	return { code, name, minimumLicences: 1, modules, monthly: prices(1), yearly: prices(10) };
};

export const catalog: PublicCatalog = {
	productName: 'Baylior',
	productKey: 'carspa',
	seatModel: 'PerType',
	trialPlanCode: 'professional',
	seatTypes: [
		{ code: 'android', name: 'Android only', sortOrder: 1, defaultSeat: false },
		{ code: 'windows', name: 'Windows only', sortOrder: 2, defaultSeat: false },
		{ code: 'both', name: 'Windows + Android', sortOrder: 3, defaultSeat: true },
	],
	capabilities: ['franchise'],
	features: [
		{ key: 'outside_jobs.enabled', label: 'Outside jobs & vendors', type: 'Bool' },
		{ key: 'whatsapp_automation.enabled', label: 'WhatsApp automation', type: 'Bool' },
		{ key: 'showroom.enabled', label: 'Showroom / B2B module', type: 'Bool' },
	],
	plans: [
		plan('starter', 'Starter', [49_900, 69_900, 99_900], []),
		plan(
			'professional',
			'Professional',
			[79_900, 119_900, 149_900],
			['audit_trail.enabled', 'outside_jobs.enabled', 'reports.advanced', 'staff_advances.enabled', 'whatsapp_automation.enabled'],
		),
	],
	addOns: [
		{ code: 'showroom', name: 'Showroom / B2B module', featureKey: 'showroom.enabled', isPack: false, perUnit: 1, monthlyPriceMinor: 99_900, yearlyPriceMinor: 999_000 },
		{ code: 'outside_jobs', name: 'Outside jobs & vendors', featureKey: 'outside_jobs.enabled', isPack: false, perUnit: 1, monthlyPriceMinor: 29_900, yearlyPriceMinor: 299_000 },
		{
			code: 'whatsapp_automation',
			name: 'WhatsApp automation',
			featureKey: 'whatsapp_automation.enabled',
			isPack: false,
			perUnit: 1,
			monthlyPriceMinor: 29_900,
			yearlyPriceMinor: 299_000,
		},
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

export const demoCatalog: PublicCatalog = {
	...catalog,
	productKey: 'demo',
	productName: 'Demo',
	seatModel: 'None',
	seatTypes: [],
	capabilities: [],
	trialPlanCode: 'basic',
	trialLicences: 0,
	features: [{ key: 'demo.enabled', label: 'Project workspace', type: 'Bool' }],
	addOns: [],
	plans: [
		{
			code: 'basic',
			name: 'Demo workspace',
			minimumLicences: 0,
			modules: ['demo.enabled'],
			monthly: { companyFeeMinor: 1234, seats: [] },
			yearly: { companyFeeMinor: 12340, seats: [] },
		},
	],
};
export const countedCatalog: PublicCatalog = {
	...demoCatalog,
	productKey: 'counted',
	productName: 'Team',
	seatModel: 'Counted',
	trialLicences: 3,
	seatTypes: [{ code: 'user', name: 'Workspace member', sortOrder: 1, defaultSeat: true }],
	plans: [
		{
			code: 'basic',
			name: 'Team workspace',
			minimumLicences: 2,
			modules: ['demo.enabled'],
			monthly: { companyFeeMinor: 1000, seats: [{ code: 'user', name: 'Workspace member', quantity: 0, priceMinor: 250 }] },
			yearly: { companyFeeMinor: 10000, seats: [{ code: 'user', name: 'Workspace member', quantity: 0, priceMinor: 2500 }] },
		},
	],
};
function quote(catalog: PublicCatalog, choice: PlanChoice) {
	const p = catalog.plans.find((x) => x.code === choice.planCode)!;
	const prices = (choice.interval === 'Year' ? p.yearly : p.monthly)!;
	const period = choice.interval === 'Year' ? 'yearly' : 'monthly';
	const lines = [];
	if (prices.companyFeeMinor) lines.push({ description: `${p.name} (${period})`, quantity: 1, unitPriceMinor: prices.companyFeeMinor, amountMinor: prices.companyFeeMinor });
	for (const seat of prices.seats) {
		const n = choice.seats[seat.code] ?? 0;
		if (n > 0) lines.push({ description: `${seat.name} seat, ${p.name} (${period})`, quantity: n, unitPriceMinor: seat.priceMinor, amountMinor: seat.priceMinor * n });
	}
	for (const [code, qty] of Object.entries(choice.addOns)) {
		const a = catalog.addOns.find((x) => x.code === code)!;
		const price = (choice.interval === 'Year' ? a.yearlyPriceMinor : a.monthlyPriceMinor)!;
		lines.push({ description: `${a.name} (${period})`, quantity: qty, unitPriceMinor: price, amountMinor: price * qty });
	}
	const total = lines.reduce((sum, l) => sum + l.amountMinor, 0);
	return {
		planCode: p.code,
		planName: p.name,
		interval: choice.interval,
		lines,
		subtotalMinor: total,
		taxMinor: 0,
		taxRatePercent: null,
		totalMinor: total,
		currency: 'INR',
		cheaper: null,
	};
}
export class FakeSignupApi {
	readonly calls: { method: string; path: string; body: unknown; product: string | null }[] = [];
	paymentFails = false;
	private orders = new Map<string, any>();
	constructor(readonly catalogs: PublicCatalog[] = [catalog]) {}
	async install(page: Page) {
		await page.route('**/api/public/**', (route) => this.handle(route));
	}
	private async handle(route: Route) {
		const req = route.request();
		const url = new URL(req.url());
		const path = url.pathname.replace('/api/public', '');
		const product = url.searchParams.get('product');
		const body = req.postDataJSON();
		this.calls.push({ method: req.method(), path, body, product });
		const json = (status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
		if (path === '/products')
			return json(
				200,
				this.catalogs.map((c) => {
					let startingPrice = null;
					if (c.plans && c.plans.length > 0) {
						if (c.seatModel === 'None') {
							const fees: { amountMinor: number; interval: 'Month' | 'Year'; currency: string; perSeat: boolean }[] = [];
							for (const p of c.plans) {
								if (p.monthly && p.monthly.companyFeeMinor > 0) {
									fees.push({ amountMinor: p.monthly.companyFeeMinor, interval: 'Month', currency: 'INR', perSeat: false });
								}
								if (p.yearly && p.yearly.companyFeeMinor > 0) {
									fees.push({ amountMinor: p.yearly.companyFeeMinor, interval: 'Year', currency: 'INR', perSeat: false });
								}
							}
							if (fees.length > 0) {
								fees.sort((a, b) => a.amountMinor - b.amountMinor);
								startingPrice = fees[0];
							}
						} else {
							const seats: { amountMinor: number; interval: 'Month' | 'Year'; currency: string; perSeat: boolean }[] = [];
							for (const p of c.plans) {
								if (p.monthly) {
									for (const s of p.monthly.seats) {
										if (s.priceMinor > 0) {
											seats.push({ amountMinor: s.priceMinor, interval: 'Month', currency: 'INR', perSeat: true });
										}
									}
								}
								if (p.yearly) {
									for (const s of p.yearly.seats) {
										if (s.priceMinor > 0) {
											seats.push({ amountMinor: s.priceMinor, interval: 'Year', currency: 'INR', perSeat: true });
										}
									}
								}
							}
							if (seats.length > 0) {
								seats.sort((a, b) => a.amountMinor - b.amountMinor);
								startingPrice = seats[0];
							}
						}
					}
					return {
						key: c.productKey,
						name: c.productName,
						seatModel: c.seatModel,
						capabilities: c.capabilities,
						publicTagline: (c as any).publicTagline ?? (c.productKey === 'carspa' ? 'Car spa management made simple' : c.productKey === 'demo' ? 'Demo product for testing' : null),
						publicDescription: (c as any).publicDescription ?? (c.productKey === 'carspa' ? 'Everything you need to run a detailing and car spa business.' : c.productKey === 'demo' ? 'Try out Trovo platform capabilities.' : null),
						learnMoreUrl: (c as any).learnMoreUrl ?? (c.productKey === 'carspa' ? 'https://trovotechsolutions.in/carspa' : null),
						startingPrice: (c as any).startingPrice !== undefined ? (c as any).startingPrice : startingPrice,
					};
				}),
			);
		const selected = this.catalogs.find((c) => c.productKey === product);
		if (!selected) return json(404, { error: 'Product not found.' });
		if (path === '/catalog') return json(200, selected);
		if (path === '/signup/franchise-code')
			return body.code.toUpperCase() === 'FRAN-4COD-E7XY'
				? json(200, {
						franchisorName: 'E6 Car Spa',
						scopes: [{ scope: 'financial_totals', label: 'Financial totals (revenue, collections, jobs, invoices)' }],
						expiresAt: '2026-10-27T00:00:00Z',
					})
				: json(404, { error: 'This franchise code is not valid. It may have expired or been used. Ask your franchisor for a new code.' });
		const base = { quote: null, currency: 'INR', expiresAt: '2026-10-27T00:00:00Z', testPayments: true, registrationCodeExpiresAt: '2026-10-27T00:00:00Z' };
		if (path === '/signup/quote') {
			const plan = selected.plans.find((p) => p.code === body.planCode);
			if (!plan) return json(400, { error: 'Choose a plan.' });
			if (selected.seatModel !== 'None' && Object.values(body.seats as Record<string, number>).reduce((a, b) => a + b, 0) < plan.minimumLicences)
				return json(400, { error: `At least ${plan.minimumLicences} seats are needed.` });
			return json(200, quote(selected, body));
		}
		if (path === '/signup' && body.startTrial)
			return json(201, {
				...base,
				orderId: 't1',
				orderToken: 'tok',
				status: 'Completed',
				start: 'Trial',
				amountMinor: 0,
				companyCode: '0008',
				registrationCode: 'H3TB-8KWQ-2MZD',
				trialEndsAt: '2026-10-27T00:00:00Z',
				paidUntil: null,
				invoiceNumber: null,
				...(body.franchiseCode ? { franchisorName: 'E6 Car Spa', franchiseLinked: body.franchiseConsent === true, franchiseProblem: null } : {}),
			});
		if (path === '/signup') {
			const q = quote(selected, body.plan);
			const order = {
				...base,
				orderId: 'o1',
				orderToken: 'secret-token',
				status: 'AwaitingPayment',
				start: 'Paid',
				quote: q,
				amountMinor: q.totalMinor,
				companyCode: null,
				registrationCode: null,
				trialEndsAt: null,
				paidUntil: null,
				invoiceNumber: null,
			};
			this.orders.set(product!, order);
			return json(201, order);
		}
		if (path === '/signup/o1/test-payment') {
			if (this.paymentFails) return json(409, { error: 'This order has expired. Please start again.' });
			const order = this.orders.get(product!);
			if (!order) return json(404, { error: 'Order not found.' });
			return json(200, {
				...order,
				orderToken: null,
				status: 'Completed',
				companyCode: '0007',
				registrationCode: 'K7QM-4RTX-9PWD',
				paidUntil: '2027-10-19T00:00:00Z',
				invoiceNumber: 'TROVO/2026-27/0012',
			});
		}
		if (path === '/signup/o1/status') return json(200, this.orders.get(product!));
		return json(404, { error: 'Not found' });
	}
}
