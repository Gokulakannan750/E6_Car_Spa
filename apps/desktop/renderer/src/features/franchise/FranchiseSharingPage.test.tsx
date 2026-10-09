import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { FranchiseSharingPage } from './FranchiseSharingPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getFranchiseNetwork: vi.fn(), decideFranchiseScope: vi.fn(), endFranchiseLink: vi.fn() };
});

const owner: api.AuthUserResponse = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };
const viewer: api.AuthUserResponse = { ...owner, id: 'u2', role: 'Staff', isOwner: false, permissions: ['franchise.view'] };

const scope = (s: string, label: string, status: api.FranchiseScopeStatus): api.FranchiseScopeDto => ({ scope: s, label, status });
const TOTALS = 'Financial totals (revenue, collections, jobs, invoices)';

function link(over: Partial<api.FranchiseLinkDto> = {}): api.FranchiseLinkDto {
	return {
		id: 'l1',
		role: 'Franchisee',
		partnerCodeHint: '0••1',
		partnerName: 'Alpha Car Spa',
		status: 'Active',
		invitedAt: '2026-10-08T10:00:00Z',
		expiresAt: '2026-10-15T10:00:00Z',
		respondedAt: '2026-10-08T11:00:00Z',
		endedAt: null,
		scopes: [scope('financial_totals', TOTALS, 'Granted'), scope('invoice_list', 'Invoice list', 'Denied')],
		...over,
	};
}

const network = (franchisors: api.FranchiseLinkDto[]): api.FranchiseNetworkDto => ({
	franchiseEnabled: false,
	franchisees: [],
	franchisors,
	pendingInvitations: franchisors.filter((l) => l.status === 'Pending').length,
});

describe('FranchiseSharingPage (the franchisee)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows who sees what, with the allowed items switched on', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network([link()]));

		renderWithProviders(<FranchiseSharingPage />, { authUser: owner });

		expect(await screen.findByText('Alpha Car Spa')).toBeInTheDocument();
		expect(screen.getByLabelText(TOTALS)).toBeChecked();
		expect(screen.getByLabelText('Invoice list')).not.toBeChecked();
	});

	it('switches an item off', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network([link()]));
		vi.mocked(api.decideFranchiseScope).mockResolvedValue(link());

		renderWithProviders(<FranchiseSharingPage />, { authUser: owner });
		fireEvent.click(await screen.findByLabelText(TOTALS));

		await waitFor(() => expect(api.decideFranchiseScope).toHaveBeenCalledWith('l1', 'financial_totals', false));
	});

	it('ends the link after confirming', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network([link()]));
		vi.mocked(api.endFranchiseLink).mockResolvedValue(link({ status: 'Ended' }));
		vi.spyOn(window, 'confirm').mockReturnValue(true);

		renderWithProviders(<FranchiseSharingPage />, { authUser: owner });
		fireEvent.click(await screen.findByRole('button', { name: /end link/i }));

		await waitFor(() => expect(api.endFranchiseLink).toHaveBeenCalledWith('l1'));
	});

	it('does not end the link when the confirmation is refused', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network([link()]));
		vi.spyOn(window, 'confirm').mockReturnValue(false);

		renderWithProviders(<FranchiseSharingPage />, { authUser: owner });
		fireEvent.click(await screen.findByRole('button', { name: /end link/i }));

		expect(api.endFranchiseLink).not.toHaveBeenCalled();
	});

	it('shows a new request as waiting for an answer through the link, not as a switch to flip', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(
			network([link({ scopes: [scope('financial_totals', TOTALS, 'Granted'), scope('staff', 'Staff and attendance', 'Requested')] })]),
		);

		renderWithProviders(<FranchiseSharingPage />, { authUser: owner });

		expect(await screen.findByText(/open the link you were sent to answer/i)).toBeInTheDocument();
		expect(screen.getByLabelText('Staff and attendance')).toBeDisabled();
	});

	it('says so when nobody franchises the company, and mentions a waiting invitation', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network([link({ status: 'Pending' })]));

		renderWithProviders(<FranchiseSharingPage />, { authUser: owner });

		expect(await screen.findByText(/no company franchises you at the moment/i)).toBeInTheDocument();
		expect(screen.getByText(/invitation waiting/i)).toBeInTheDocument();
	});

	it('is read-only for someone who can only view', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network([link()]));

		renderWithProviders(<FranchiseSharingPage />, { authUser: viewer });

		expect(await screen.findByLabelText(TOTALS)).toBeDisabled();
		expect(screen.queryByRole('button', { name: /end link/i })).not.toBeInTheDocument();
	});
});
