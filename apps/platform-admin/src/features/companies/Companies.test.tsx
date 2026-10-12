import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as csv from '@/lib/csv';
import type { Catalog, CompanyListItem } from '@/lib/types';
import { adminWith, emptyDashboard, fakeApi, renderApp, signIn } from '@/test/utils';

const company = (over: Partial<CompanyListItem>): CompanyListItem => ({
	id: crypto.randomUUID(),
	code: '0001',
	name: 'Company',
	companyStatus: 'Active',
	subscriptionStatus: 'Active',
	plan: 'professional',
	interval: 'Month',
	currentPeriodEnd: '2026-11-12T00:00:00Z',
	trialEndsAt: null,
	migrationFailed: false,
	createdAt: '2026-10-01T00:00:00Z',
	...over,
});

const companies = [
	company({ code: '0001', name: 'E6 Car Spa' }),
	company({ code: '0002', name: 'Sunrise Detailing', subscriptionStatus: 'Trialing', trialEndsAt: '2026-10-19T00:00:00Z' }),
	company({ code: '0003', name: 'Moonlight Wash', subscriptionStatus: 'PastDue', plan: 'starter' }),
	company({ code: '0004', name: 'New Shine', companyStatus: 'AwaitingRegistration', subscriptionStatus: 'Trialing' }),
];

const catalog: Catalog = {
	chargesGst: false,
	gstRatePercent: 0,
	plans: ['starter', 'professional'].map((code, index) => ({
		id: code,
		code,
		name: code === 'starter' ? 'Starter' : 'Professional',
		isActive: true,
		versions: [
			{ id: `${code}-m`, version: 1, interval: 'Month', currency: 'INR', priceMinor: index ? 199_900 : 99_900, includedSeats: index ? 10 : 3, effectiveFrom: '2026-10-01T00:00:00Z', effectiveTo: null, entitlements: [] },
			{ id: `${code}-y`, version: 1, interval: 'Year', currency: 'INR', priceMinor: index ? 1_999_000 : 999_000, includedSeats: index ? 10 : 3, effectiveFrom: '2026-10-01T00:00:00Z', effectiveTo: null, entitlements: [] },
		],
	})),
	addOns: [
		{
			id: 'showroom',
			code: 'showroom',
			name: 'Showroom / B2B module',
			featureKey: 'showroom.enabled',
			value: 'true',
			isActive: true,
			prices: [
				{ id: 's-m', version: 1, interval: 'Month', currency: 'INR', unitPriceMinor: 99_900, effectiveFrom: '2026-10-01T00:00:00Z', effectiveTo: null },
				{ id: 's-y', version: 1, interval: 'Year', currency: 'INR', unitPriceMinor: 999_000, effectiveFrom: '2026-10-01T00:00:00Z', effectiveTo: null },
			],
		},
	],
};

describe('companies', () => {
	it('filters by status and search, and exports what is shown', async () => {
		signIn(adminWith('Owner'));
		fakeApi([{ path: '/api/platform/companies', body: companies }]);
		const download = vi.spyOn(csv, 'downloadCsv').mockImplementation(() => {});
		const user = userEvent.setup();
		renderApp('/companies');

		expect(await screen.findByText('Sunrise Detailing')).toBeInTheDocument();
		expect(screen.getAllByRole('row')).toHaveLength(5);

		await user.click(screen.getByRole('tab', { name: /Past due/ }));
		expect(screen.getAllByRole('row')).toHaveLength(2);
		expect(screen.getByText('Moonlight Wash')).toBeInTheDocument();

		await user.click(screen.getByRole('tab', { name: /^All/ }));
		await user.type(screen.getByLabelText('Filter by code or name'), '0004');
		expect(screen.getAllByRole('row')).toHaveLength(2);
		expect(within(screen.getAllByRole('row')[1]!).getByText('Awaiting registration')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Export CSV' }));
		expect(download).toHaveBeenCalledTimes(1);
		const [, headers, rows] = download.mock.calls[0]!;
		expect(headers[0]).toBe('Code');
		expect(rows).toEqual([expect.arrayContaining(['0004', 'New Shine', 'AwaitingRegistration'])]);
	});

	it('creates a company on a trial and shows both codes once', async () => {
		signIn(adminWith('Support'));
		const api = fakeApi([
			{ path: '/api/platform/companies', body: [] },
			{
				method: 'POST',
				path: '/api/platform/companies',
				status: 201,
				body: { id: 'new-id', code: '0005', name: 'Glow Spa', registrationCode: 'K7QM-4RTX-9PWD', registrationCodeExpiresAt: '2026-10-19T00:00:00Z', databaseName: 'carspa_t_0005' },
			},
		]);
		const user = userEvent.setup();
		renderApp('/companies');

		await user.click(await screen.findByRole('button', { name: 'New company' }));
		await user.click(screen.getByRole('button', { name: 'Create company' }));
		expect(await screen.findByText('Enter the company name.')).toBeInTheDocument();

		await user.type(screen.getByLabelText('Company name'), 'Glow Spa');
		await user.click(screen.getByRole('button', { name: 'Create company' }));

		expect(await screen.findByText('Glow Spa is ready')).toBeInTheDocument();
		expect(screen.getByText('0005')).toBeInTheDocument();
		expect(screen.getByText('K7QM-4RTX-9PWD')).toBeInTheDocument();
		expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Glow Spa', plan: null });
		// The codes must not vanish on Escape.
		await user.keyboard('{Escape}');
		expect(screen.getByText('K7QM-4RTX-9PWD')).toBeInTheDocument();
	});

	it('creates an already-paid company with its plan, add-ons and paid-until date', async () => {
		signIn(adminWith('Owner'));
		const api = fakeApi([
			{ path: '/api/platform/companies', body: [] },
			{ path: '/api/platform/plans', body: catalog },
			{
				method: 'POST',
				path: '/api/platform/companies',
				status: 201,
				body: { id: 'n', code: '0006', name: 'Paid Spa', registrationCode: 'AAAA-BBBB-CCCC', registrationCodeExpiresAt: '2026-10-19T00:00:00Z', databaseName: 'x' },
			},
		]);
		const user = userEvent.setup();
		renderApp('/companies');

		await user.click(await screen.findByRole('button', { name: 'New company' }));
		await user.type(screen.getByLabelText('Company name'), 'Paid Spa');
		await user.click(screen.getByRole('radio', { name: /Already paid/ }));
		await user.click(await screen.findByRole('radio', { name: 'Yearly' }));
		await user.click(screen.getByRole('radio', { name: /Starter/ }));
		await user.click(screen.getByRole('checkbox'));
		expect(screen.getByText('₹19,980.00')).toBeInTheDocument(); // ₹9,990 + ₹9,990 showroom
		await user.click(screen.getByRole('button', { name: 'Create company' }));

		await screen.findByText('Paid Spa is ready');
		const body = api.calls.find((c) => c.method === 'POST')?.body as { plan: Record<string, unknown> };
		expect(body.plan).toMatchObject({ planCode: 'starter', interval: 'Year', addOns: { showroom: 1 } });
		expect(new Date(String(body.plan.paidUntil)).getTime()).toBeGreaterThan(Date.now() + 300 * 86_400_000);
	});

	it('hides changes a role may not make', async () => {
		signIn(adminWith('ReadOnly'));
		fakeApi([
			{ path: '/api/platform/dashboard', body: emptyDashboard },
			{ path: '/api/platform/companies', body: companies },
		]);
		renderApp('/dashboard');
		await screen.findByRole('heading', { name: 'Operations overview' });
		expect(screen.queryByRole('button', { name: 'New company' })).not.toBeInTheDocument();
		const nav = screen.getByRole('navigation', { name: 'Main' });
		expect(within(nav).queryByText('Audit Log')).not.toBeInTheDocument();
		expect(within(nav).queryByText('Admins')).not.toBeInTheDocument();
		await waitFor(() => expect(screen.getByText('Moonlight Wash')).toBeInTheDocument());
	});

	it('refuses an owner page by address for other roles', async () => {
		signIn(adminWith('Billing'));
		fakeApi([]);
		renderApp('/admins');
		expect(await screen.findByText('Not available for your role')).toBeInTheDocument();
	});
});
