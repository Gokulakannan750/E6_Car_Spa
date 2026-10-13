import type { Page, Route } from '@playwright/test';

/**
 * An in-memory stand-in for the platform API, just enough for the portal's main flows. It keeps state across
 * requests (companies created, payments recorded) so a test can follow a flow from start to finish.
 */
export interface FakeOptions {
	role?: 'Owner' | 'Billing' | 'Support' | 'ReadOnly';
	firstSignIn?: boolean;
}

const now = Date.now();
const iso = (days: number) => new Date(now + days * 86_400_000).toISOString();

/** Per-user licence prices (Android, Windows, both apps); yearly = 10 × monthly. */
const version = (code: string, interval: 'Month' | 'Year', monthly: [number, number, number]) => {
	const k = interval === 'Year' ? 10 : 1;
	return {
		id: `${code}-${interval}`,
		version: 1,
		interval,
		currency: 'INR',
		priceMinor: 0,
		includedSeats: 1,
		androidUserPriceMinor: monthly[0] * k,
		windowsUserPriceMinor: monthly[1] * k,
		bothUserPriceMinor: monthly[2] * k,
		effectiveFrom: iso(-10),
		effectiveTo: null,
		entitlements: [
			{ featureKey: 'users.max_active', value: '1' },
			{ featureKey: 'whatsapp_automation.enabled', value: code === 'professional' ? 'true' : 'false' },
		],
	};
};

export const catalog = {
	chargesGst: false,
	gstRatePercent: 0,
	plans: [
		{ id: 'p1', code: 'starter', name: 'Starter', isActive: true, versions: [version('starter', 'Month', [49_900, 69_900, 99_900]), version('starter', 'Year', [49_900, 69_900, 99_900])] },
		{
			id: 'p2',
			code: 'professional',
			name: 'Professional',
			isActive: true,
			versions: [version('professional', 'Month', [79_900, 119_900, 149_900]), version('professional', 'Year', [79_900, 119_900, 149_900])],
		},
	],
	addOns: [
		{
			id: 'a1',
			code: 'showroom',
			name: 'Showroom / B2B module',
			featureKey: 'showroom.enabled',
			value: 'true',
			isActive: true,
			prices: [
				{ id: 'a1m', version: 1, interval: 'Month', currency: 'INR', unitPriceMinor: 99_900, effectiveFrom: iso(-10), effectiveTo: null },
				{ id: 'a1y', version: 1, interval: 'Year', currency: 'INR', unitPriceMinor: 999_000, effectiveFrom: iso(-10), effectiveTo: null },
			],
		},
	],
};

interface Company {
	id: string;
	code: string;
	name: string;
	companyStatus: string;
	subscriptionStatus: string;
	plan: string;
	interval: string;
	currentPeriodEnd: string;
	trialEndsAt: string | null;
	migrationFailed: boolean;
	createdAt: string;
	licences: number;
}

interface Invoice {
	id: string;
	invoiceNumber: string;
	companyId: string;
	status: string;
	totalMinor: number;
	amountDueMinor: number;
	issuedAt: string;
	dueAt: string;
	paidAt: string | null;
}

export class FakePlatform {
	readonly requests: { method: string; path: string; body: unknown }[] = [];
	mustChangePassword: boolean;
	companies: Company[] = [
		{
			id: 'c1',
			code: '0001',
			name: 'E6 Car Spa',
			companyStatus: 'Active',
			subscriptionStatus: 'Active',
			plan: 'professional',
			interval: 'Month',
			currentPeriodEnd: iso(20),
			trialEndsAt: null,
			migrationFailed: false,
			createdAt: iso(-30),
			licences: 4,
		},
	];
	invoices: Invoice[] = [
		{ id: 'i1', invoiceNumber: 'TROVO/2026-27/0001', companyId: 'c1', status: 'Open', totalMinor: 199_900, amountDueMinor: 199_900, issuedAt: iso(-8), dueAt: iso(-1), paidAt: null },
	];

	constructor(private readonly options: FakeOptions = {}) {
		this.mustChangePassword = !!options.firstSignIn;
	}

	private admin() {
		return { id: 'a1', email: 'owner@trovo.test', name: 'E2E Owner', role: this.options.role ?? 'Owner', mustChangePassword: this.mustChangePassword };
	}

	private session() {
		return { token: `token-${this.mustChangePassword ? 'limited' : 'full'}`, expiresAt: iso(0.08), admin: this.admin() };
	}

	private invoiceRow(i: Invoice) {
		const c = this.companies.find((x) => x.id === i.companyId)!;
		return {
			...i,
			companyCode: c.code,
			companyName: c.name,
			currency: 'INR',
			overdue: i.status === 'Open' && new Date(i.dueAt).getTime() < Date.now(),
			periodStart: iso(0),
			periodEnd: iso(30),
		};
	}

	async install(page: Page): Promise<void> {
		await page.route('**/api/platform/**', (route) => this.handle(route));
	}

	private async handle(route: Route) {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname.replace('/api/platform', '');
		const method = request.method();
		const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
		this.requests.push({ method, path, body });
		const json = (status: number, data?: unknown) =>
			route.fulfill({ status, contentType: 'application/json', body: data === undefined ? '' : JSON.stringify(data) });

		if (method === 'POST' && path === '/auth/login') {
			if (body.password !== 'correct horse battery') return json(401, { error: 'Invalid email or password.' });
			return this.options.firstSignIn
				? json(200, { stage: 'totp-setup', challengeToken: 'ch', totpSecret: 'JBSWY3DPEHPK3PXP', authenticatorUri: 'otpauth://totp/Trovo:owner?secret=JBSWY3DPEHPK3PXP&issuer=Trovo' })
				: json(200, { stage: 'totp', challengeToken: 'ch', totpSecret: null, authenticatorUri: null });
		}
		if (method === 'POST' && path === '/auth/verify') {
			return body.code === '123456' ? json(200, this.session()) : json(401, { error: 'That code is not right. Try the current one.' });
		}
		if (method === 'POST' && path === '/auth/change-password') {
			this.mustChangePassword = false;
			return json(200, this.session());
		}
		if (this.mustChangePassword) return json(403, { error: 'Change your password first.', code: 'PASSWORD_CHANGE_REQUIRED' });

		if (method === 'GET' && path === '/dashboard') {
			const by: Record<string, number> = {};
			for (const c of this.companies) by[c.subscriptionStatus] = (by[c.subscriptionStatus] ?? 0) + 1;
			const open = this.invoices.filter((i) => i.status === 'Open');
			return json(200, {
				companies: this.companies.length,
				subscriptionsByStatus: by,
				monthlyRecurringRevenueMinor: 199_900,
				openInvoices: open.length,
				amountDueMinor: open.reduce((s, i) => s + i.amountDueMinor, 0),
				awaitingRegistration: this.companies.filter((c) => c.companyStatus === 'AwaitingRegistration').length,
				migrationFailures: 0,
				recentActivity: [],
			});
		}
		if (method === 'GET' && path === '/companies') return json(200, this.companies);
		if (method === 'POST' && path === '/companies') {
			const code = String(this.companies.length + 1).padStart(4, '0');
			const company: Company = {
				id: `c${this.companies.length + 1}`,
				code,
				name: body.name,
				companyStatus: 'AwaitingRegistration',
				subscriptionStatus: body.plan ? 'Active' : 'Trialing',
				plan: body.plan?.planCode ?? 'professional',
				interval: body.plan?.interval ?? 'Month',
				currentPeriodEnd: body.plan?.paidUntil ?? iso(7),
				trialEndsAt: body.plan ? null : iso(7),
				migrationFailed: false,
				createdAt: iso(0),
				licences: body.plan ? body.plan.licences.android + body.plan.licences.windows + body.plan.licences.both : 3,
			};
			this.companies.push(company);
			return json(201, { id: company.id, code, name: company.name, registrationCode: 'K7QM-4RTX-9PWD', registrationCodeExpiresAt: iso(7), databaseName: `carspa_t_${code}` });
		}
		if (method === 'GET' && path === '/plans') return json(200, catalog);
		if (method === 'GET' && path === '/invoices') {
			const status = url.searchParams.get('status');
			const rows = this.invoices.map((i) => this.invoiceRow(i)).filter((i) => !status || i.status.toLowerCase() === status || (status === 'overdue' && i.overdue));
			return json(200, rows);
		}
		const pay = path.match(/^\/invoices\/([^/]+)\/payments$/);
		if (method === 'POST' && pay) {
			const invoice = this.invoices.find((i) => i.id === pay[1])!;
			invoice.amountDueMinor -= body.amountMinor;
			if (invoice.amountDueMinor === 0) {
				invoice.status = 'Paid';
				invoice.paidAt = new Date().toISOString();
			}
			return json(201, { id: 'p1' });
		}
		return json(404, { error: `Fake API has no ${method} ${path}` });
	}
}
