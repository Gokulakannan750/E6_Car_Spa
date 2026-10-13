import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { OwnerBillingPanel } from './OwnerBillingPanel';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getOwnerSubscription: vi.fn(),
		getOwnerInvoices: vi.fn(),
		previewOwnerChange: vi.fn(),
		changeOwnerPlan: vi.fn(),
		payOwnerInvoice: vi.fn(),
		cancelOwnerSubscription: vi.fn(),
		getPlanChange: vi.fn().mockResolvedValue(null),
	};
});

const owner: api.AuthUserResponse = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };
const prices = (both: number, windows: number, android: number): api.CatalogPrices => ({
	companyFeeMinor: 0,
	bothUserPriceMinor: both,
	windowsUserPriceMinor: windows,
	androidUserPriceMinor: android,
});

const subscription: api.OwnerSubscriptionDto = {
	catalog: {
		plans: [
			{ code: 'starter', name: 'Starter', minimumLicences: 1, modules: [], monthly: prices(99_900, 69_900, 49_900), yearly: prices(999_000, 699_000, 499_000) },
			{
				code: 'professional', name: 'Professional', minimumLicences: 1, modules: ['outside_jobs.enabled'],
				monthly: prices(149_900, 119_900, 79_900), yearly: prices(1_499_000, 1_199_000, 799_000),
			},
		],
		addOns: [
			{ code: 'outside_jobs', name: 'Outside jobs & vendors', featureKey: 'outside_jobs.enabled', isPack: false, perUnit: 1, monthlyPriceMinor: 29_900, yearlyPriceMinor: 299_000 },
		],
		chargesGst: false,
		gstRatePercent: null,
	},
	current: { planCode: 'starter', interval: 'Year', licences: { android: 0, windows: 0, both: 1 }, addOns: {} },
	licencesInUse: { android: 0, windows: 0, both: 1 },
	status: 'Active',
	currentPeriodEnd: '2027-10-13T00:00:00Z',
	cancelAtPeriodEnd: false,
	canPayOnline: true,
	testPayments: true,
};

const openInvoice: api.OwnerInvoiceDto = {
	id: 'inv1', invoiceNumber: 'TROVO/2026-27/0011', kind: 'Adjustment', status: 'Open', issuedAt: '2026-10-13T00:00:00Z', dueAt: '2026-10-20T00:00:00Z',
	periodStart: null, periodEnd: null, subtotalMinor: 350_000, taxMinor: 0, totalMinor: 350_000, amountDueMinor: 350_000, currency: 'INR', paidAt: null, lines: [],
};

describe('OwnerBillingPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getOwnerSubscription).mockResolvedValue(subscription);
		vi.mocked(api.getOwnerInvoices).mockResolvedValue([openInvoice]);
	});

	it('adds a Windows licence: shows the price to pay now, then makes the change', async () => {
		vi.mocked(api.previewOwnerChange).mockResolvedValue({
			timing: 'NowWithCharge', currentPeriodPriceMinor: 999_000, newPeriodPriceMinor: 1_698_000, amountNowMinor: 349_500, currency: 'INR',
			effectiveAt: '2026-10-13T00:00:00Z',
		});
		vi.mocked(api.changeOwnerPlan).mockResolvedValue({
			status: 'Applied', timing: 'NowWithCharge', effectiveAt: '2026-10-13T00:00:00Z', amountNowMinor: 349_500, invoiceId: 'inv1', invoiceNumber: 'TROVO/2026-27/0011',
		});
		renderWithProviders(<OwnerBillingPanel />, { authUser: owner, authContextValue: { isOwner: true } });

		fireEvent.click(await screen.findByRole('button', { name: 'Change plan' }));
		const dialog = screen.getByRole('dialog');
		// The Owner's own licence is in use, so Windows + Android cannot go below 1.
		expect(within(dialog).getByRole('button', { name: 'Fewer Windows + Android licences' })).toBeDisabled();
		fireEvent.click(within(dialog).getByRole('button', { name: 'More Windows only licences' }));

		expect(await within(dialog).findByText(/You pay ₹3,495.00 today/)).toBeInTheDocument();
		await waitFor(() =>
			expect(api.previewOwnerChange).toHaveBeenLastCalledWith({ planCode: 'starter', interval: 'Year', licences: { android: 0, windows: 1, both: 1 }, addOns: {} }),
		);
		fireEvent.click(within(dialog).getByRole('button', { name: /Upgrade and pay ₹3,495.00/ }));
		expect(await screen.findByText(/Invoice TROVO\/2026-27\/0011 for ₹3,495.00 is below/)).toBeInTheDocument();
	});

	it('does not sell an add-on the chosen plan already includes', async () => {
		renderWithProviders(<OwnerBillingPanel />, { authUser: owner, authContextValue: { isOwner: true } });
		fireEvent.click(await screen.findByRole('button', { name: 'Change plan' }));
		const dialog = screen.getByRole('dialog');
		expect(within(dialog).getByRole('checkbox', { name: 'Outside jobs & vendors' })).toBeInTheDocument();
		fireEvent.click(within(dialog).getByRole('radio', { name: /Professional/ }));
		expect(within(dialog).getByText('Included in Professional')).toBeInTheDocument();
		expect(within(dialog).queryByRole('checkbox', { name: 'Outside jobs & vendors' })).toBeNull();
	});

	it('pays an open invoice (test payment) and cancels at the period end', async () => {
		vi.mocked(api.payOwnerInvoice).mockResolvedValue({ ...openInvoice, status: 'Paid', amountDueMinor: 0 });
		vi.mocked(api.cancelOwnerSubscription).mockResolvedValue(undefined);
		renderWithProviders(<OwnerBillingPanel />, { authUser: owner, authContextValue: { isOwner: true } });

		fireEvent.click(await screen.findByRole('button', { name: /Pay \(test\)/ }));
		await waitFor(() => expect(api.payOwnerInvoice).toHaveBeenCalledWith('inv1'));
		expect(await screen.findByText(/Paid. Thank you!/)).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /Cancel subscription/ }));
		fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel at period end' }));
		await waitFor(() => expect(api.cancelOwnerSubscription).toHaveBeenCalled());
	});

	it('without online payment, says to call Trovo instead of a Pay button', async () => {
		vi.mocked(api.getOwnerSubscription).mockResolvedValue({ ...subscription, canPayOnline: false, testPayments: false });
		renderWithProviders(<OwnerBillingPanel />, { authUser: owner, authContextValue: { isOwner: true } });
		expect(await screen.findByText('Call Trovo to pay')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Pay/ })).toBeNull();
	});
});
