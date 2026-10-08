import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { FranchiseDashboardPage } from './FranchiseDashboardPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getFranchiseDashboard: vi.fn() };
});

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
					{ linkId: 'l1', partnerCodeHint: '0••2', partnerName: 'Beta Detailing', financialTotalsAllowed: true, totals: totals() },
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
					{ linkId: 'l1', partnerCodeHint: '0••2', partnerName: 'Beta Detailing', financialTotalsAllowed: true, totals: totals() },
					{ linkId: 'l2', partnerCodeHint: '0••3', partnerName: 'Gamma Wash', financialTotalsAllowed: false, totals: null },
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
});
