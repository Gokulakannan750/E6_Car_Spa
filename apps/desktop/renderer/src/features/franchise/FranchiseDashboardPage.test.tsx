import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { FranchiseDashboardPage } from './FranchiseDashboardPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';
import * as franchiseExcel from './excelFranchiseGenerator';
import * as billingExcel from '../reports/excelMonthlyBillingGenerator';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getFranchiseDashboard: vi.fn(), getFranchiseBillingReport: vi.fn() };
});

vi.mock('./excelFranchiseGenerator', () => ({
	downloadNetworkSummary: vi.fn().mockResolvedValue('network.xlsx'),
	downloadCompanyTotals: vi.fn().mockResolvedValue('totals.xlsx'),
}));

vi.mock('../reports/excelMonthlyBillingGenerator', () => ({
	generateAndDownloadMonthlyBillingReport: vi.fn().mockResolvedValue('billing.xlsx'),
}));

// The chart needs a real layout engine; the figures are what matter here.
vi.mock('recharts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('recharts')>();
	return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

const owner: api.AuthUserResponse = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };

const totals = (over: Partial<api.FranchiseFinancialTotalsDto> = {}): api.FranchiseFinancialTotalsDto => ({
	invoiceCount: 3,
	invoicedAmount: 1300,
	collectedAmount: 700,
	outstandingAmount: 600,
	jobCardCount: 5,
	daily: [{ date: '2026-10-08', invoiced: 1300, collected: 700 }],
	...over,
});

function dashboard(over: Partial<api.FranchiseDashboardDto> = {}): api.FranchiseDashboardDto {
	return { from: '2026-09-09', to: '2026-10-08', network: totals(), franchisees: [], ...over };
}

describe('FranchiseDashboardPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows the network totals and a row per company that shares its figures', async () => {
		vi.mocked(api.getFranchiseDashboard).mockResolvedValue(
			dashboard({
				franchisees: [
					{ linkId: 'l1', partnerCodeHint: '0••2', partnerName: 'Beta Detailing', financialTotalsAllowed: true, allowedItems: ['financial_totals'], totals: totals() },
				],
			}),
		);

		renderWithProviders(<FranchiseDashboardPage />, { authUser: owner });

		const network = await screen.findByRole('region', { name: 'Network totals' });
		expect(within(network).getByText('₹1,300.00')).toBeInTheDocument(); // invoiced
		expect(within(network).getByText('₹700.00')).toBeInTheDocument(); // collected
		expect(within(network).getByText('₹600.00')).toBeInTheDocument(); // outstanding

		const byCompany = screen.getByRole('region', { name: 'By company' });
		expect(within(byCompany).getByText('Beta Detailing')).toBeInTheDocument();
		expect(within(byCompany).getByText('0••2')).toBeInTheDocument();
	});

	it('lists a company that has not allowed the totals separately, with no figures', async () => {
		vi.mocked(api.getFranchiseDashboard).mockResolvedValue(
			dashboard({
				franchisees: [
					{ linkId: 'l1', partnerCodeHint: '0••2', partnerName: 'Beta Detailing', financialTotalsAllowed: true, allowedItems: ['financial_totals'], totals: totals() },
					{ linkId: 'l2', partnerCodeHint: '0••3', partnerName: 'Gamma Wash', financialTotalsAllowed: false, allowedItems: [], totals: null },
				],
			}),
		);

		renderWithProviders(<FranchiseDashboardPage />, { authUser: owner });

		const notShared = await screen.findByRole('region', { name: 'Not shared' });
		expect(within(notShared).getByText('Gamma Wash')).toBeInTheDocument();
		expect(within(notShared).getByText(/has not allowed the financial totals/i)).toBeInTheDocument();
		const byCompany = screen.getByRole('region', { name: 'By company' });
		expect(within(byCompany).queryByText('Gamma Wash')).not.toBeInTheDocument();
	});

	it('explains what to do when no franchisee is connected', async () => {
		vi.mocked(api.getFranchiseDashboard).mockResolvedValue(dashboard({ franchisees: [] }));

		renderWithProviders(<FranchiseDashboardPage />, { authUser: owner });

		expect(await screen.findByText(/no franchisee is connected yet/i)).toBeInTheDocument();
		expect(screen.queryByRole('region', { name: 'Network totals' })).not.toBeInTheDocument();
	});

	it('asks for the chosen period, and does not ask for an impossible one', async () => {
		vi.mocked(api.getFranchiseDashboard).mockResolvedValue(dashboard());

		renderWithProviders(<FranchiseDashboardPage />, { authUser: owner });
		await waitFor(() => expect(api.getFranchiseDashboard).toHaveBeenCalledTimes(1));

		fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
		await waitFor(() => expect(api.getFranchiseDashboard).toHaveBeenCalledTimes(2));
		const [from, to] = vi.mocked(api.getFranchiseDashboard).mock.calls[1];
		expect(from <= to).toBe(true);

		const calls = vi.mocked(api.getFranchiseDashboard).mock.calls.length;
		fireEvent.change(screen.getByLabelText('From'), { target: { value: '2999-01-01' } });
		expect(await screen.findByText(/start date must not be after the end date/i)).toBeInTheDocument();
		expect(vi.mocked(api.getFranchiseDashboard).mock.calls.length).toBe(calls);
	});

	describe('Excel downloads', () => {
		const withInvoiceList: api.FranchiseeFinancialsDto = {
			linkId: 'l1',
			partnerCodeHint: '0••2',
			partnerName: 'Beta Detailing',
			financialTotalsAllowed: true,
			allowedItems: ['financial_totals', 'invoice_list'],
			totals: totals(),
		};
		const totalsOnly: api.FranchiseeFinancialsDto = {
			linkId: 'l3',
			partnerCodeHint: '0••4',
			partnerName: 'Delta Spa',
			financialTotalsAllowed: true,
			allowedItems: ['financial_totals'],
			totals: totals(),
		};

		it('downloads the full billing report for a company that allowed the invoice list', async () => {
			vi.mocked(api.getFranchiseDashboard).mockResolvedValue(dashboard({ franchisees: [withInvoiceList] }));
			const report = { year: 2026, month: 10 } as api.MonthlyBillingReportResponse;
			vi.mocked(api.getFranchiseBillingReport).mockResolvedValue(report);

			renderWithProviders(<FranchiseDashboardPage />, { authUser: owner });
			fireEvent.change(await screen.findByLabelText('Billing report month'), { target: { value: '2026-09' } });
			fireEvent.click(await screen.findByRole('button', { name: 'Billing report' }));

			await waitFor(() => expect(api.getFranchiseBillingReport).toHaveBeenCalledWith('l1', 2026, 9));
			await waitFor(() => expect(billingExcel.generateAndDownloadMonthlyBillingReport).toHaveBeenCalledWith(report, 'Beta Detailing'));
			expect(franchiseExcel.downloadCompanyTotals).not.toHaveBeenCalled();
		});

		it('downloads only the totals for a company that has not allowed the invoice list, without asking the server for invoices', async () => {
			vi.mocked(api.getFranchiseDashboard).mockResolvedValue(dashboard({ franchisees: [totalsOnly] }));

			renderWithProviders(<FranchiseDashboardPage />, { authUser: owner });
			fireEvent.click(await screen.findByRole('button', { name: 'Totals' }));

			await waitFor(() => expect(franchiseExcel.downloadCompanyTotals).toHaveBeenCalledWith(totalsOnly, '2026-09-09', '2026-10-08'));
			expect(api.getFranchiseBillingReport).not.toHaveBeenCalled();
			expect(billingExcel.generateAndDownloadMonthlyBillingReport).not.toHaveBeenCalled();
		});

		it('downloads the network summary', async () => {
			const data = dashboard({ franchisees: [withInvoiceList] });
			vi.mocked(api.getFranchiseDashboard).mockResolvedValue(data);

			renderWithProviders(<FranchiseDashboardPage />, { authUser: owner });
			fireEvent.click(await screen.findByRole('button', { name: /download network summary/i }));

			await waitFor(() => expect(franchiseExcel.downloadNetworkSummary).toHaveBeenCalledWith(data));
		});

		it('shows the reason when the server refuses the billing report', async () => {
			vi.mocked(api.getFranchiseDashboard).mockResolvedValue(dashboard({ franchisees: [withInvoiceList] }));
			vi.mocked(api.getFranchiseBillingReport).mockRejectedValue(new Error('This company has not allowed you to see its invoice list.'));

			renderWithProviders(<FranchiseDashboardPage />, { authUser: owner });
			fireEvent.click(await screen.findByRole('button', { name: 'Billing report' }));

			expect(await screen.findByRole('alert')).toHaveTextContent('has not allowed you to see its invoice list');
			expect(billingExcel.generateAndDownloadMonthlyBillingReport).not.toHaveBeenCalled();
		});
	});
});
