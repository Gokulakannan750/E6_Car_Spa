import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { FranchisePage } from './FranchisePage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getFranchiseNetwork: vi.fn(),
		sendFranchiseInvite: vi.fn(),
		respondToFranchiseInvite: vi.fn(),
		cancelFranchiseInvite: vi.fn(),
		endFranchiseLink: vi.fn(),
		requestFranchiseScopes: vi.fn(),
		decideFranchiseScope: vi.fn(),
	};
});

const owner: api.AuthUserResponse = {
	id: 'u1',
	fullName: 'Owner',
	username: 'owner',
	role: 'Owner',
	isOwner: true,
	permissions: [],
};

const viewer: api.AuthUserResponse = { ...owner, id: 'u2', role: 'Staff', isOwner: false, permissions: ['franchise.view'] };

const scope = (s: string, label: string, status: api.FranchiseScopeStatus): api.FranchiseScopeDto => ({ scope: s, label, status });

function link(over: Partial<api.FranchiseLinkDto>): api.FranchiseLinkDto {
	return {
		id: 'l1',
		role: 'Franchisor',
		partnerCodeHint: '0••2',
		partnerName: 'Beta Detailing',
		status: 'Pending',
		invitedAt: '2026-10-08T10:00:00Z',
		expiresAt: '2026-10-15T10:00:00Z',
		respondedAt: null,
		endedAt: null,
		scopes: [scope('financial_totals', 'Financial totals (revenue, collections, jobs, invoices)', 'Requested')],
		...over,
	};
}

function network(over: Partial<api.FranchiseNetworkDto> = {}): api.FranchiseNetworkDto {
	return { franchiseEnabled: true, franchisees: [], franchisors: [], pendingInvitations: 0, ...over };
}

describe('FranchisePage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows an invitation and accepts it with the items the company allows', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(
			network({
				pendingInvitations: 1,
				franchisors: [
					link({
						role: 'Franchisee',
						partnerName: 'Alpha Car Spa',
						partnerCodeHint: '0••1',
						scopes: [
							scope('financial_totals', 'Financial totals (revenue, collections, jobs, invoices)', 'Requested'),
							scope('staff', 'Staff and attendance', 'Requested'),
						],
					}),
				],
			}),
		);
		vi.mocked(api.respondToFranchiseInvite).mockResolvedValue(link({ status: 'Active' }));

		renderWithProviders(<FranchisePage />, { authUser: owner });

		expect(await screen.findByText(/invites you to join their franchise network/i)).toBeInTheDocument();
		expect(screen.getByText('Alpha Car Spa', { selector: 'p' })).toBeInTheDocument();

		// Allow only the financial totals.
		const invitations = screen.getByRole('region', { name: 'Invitations for you' });
		fireEvent.click(within(invitations).getByLabelText('Staff and attendance'));
		fireEvent.click(within(invitations).getByRole('button', { name: /accept/i }));

		await waitFor(() => {
			expect(api.respondToFranchiseInvite).toHaveBeenCalledWith('l1', { accept: true, grantedScopes: ['financial_totals'] });
		});
	});

	it('declines an invitation', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(
			network({ pendingInvitations: 1, franchisors: [link({ role: 'Franchisee', partnerName: 'Alpha Car Spa' })] }),
		);
		vi.mocked(api.respondToFranchiseInvite).mockResolvedValue(link({ status: 'Declined' }));

		renderWithProviders(<FranchisePage />, { authUser: owner });

		fireEvent.click(await screen.findByRole('button', { name: /decline/i }));
		await waitFor(() => {
			expect(api.respondToFranchiseInvite).toHaveBeenCalledWith('l1', { accept: false });
		});
	});

	it('sends an invitation with the chosen items and shows the answer', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network());
		vi.mocked(api.sendFranchiseInvite).mockResolvedValue({ message: 'If that code belongs to an active company, your invitation has been sent.' });

		renderWithProviders(<FranchisePage />, { authUser: owner });

		fireEvent.change(await screen.findByLabelText('Company code to invite'), { target: { value: '0002' } });
		fireEvent.click(screen.getByLabelText('Invoice list'));
		fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

		await waitFor(() => {
			expect(api.sendFranchiseInvite).toHaveBeenCalledWith({ franchiseeCode: '0002', scopes: ['financial_totals', 'invoice_list'] });
		});
		expect(await screen.findByText(/your invitation has been sent/i)).toBeInTheDocument();
	});

	it('shows the status of invited companies and lets the franchisor withdraw a pending invitation', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network({ franchisees: [link({})] }));
		vi.mocked(api.cancelFranchiseInvite).mockResolvedValue(link({ status: 'Cancelled' }));

		renderWithProviders(<FranchisePage />, { authUser: owner });

		expect(await screen.findByText('Beta Detailing')).toBeInTheDocument();
		expect(screen.getByText('Pending')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /withdraw invitation/i }));
		await waitFor(() => expect(api.cancelFranchiseInvite).toHaveBeenCalledWith('l1'));
	});

	it('lets the franchisee switch an item off', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(
			network({
				franchisors: [
					link({
						role: 'Franchisee',
						status: 'Active',
						partnerName: 'Alpha Car Spa',
						scopes: [scope('financial_totals', 'Financial totals (revenue, collections, jobs, invoices)', 'Granted')],
					}),
				],
			}),
		);
		vi.mocked(api.decideFranchiseScope).mockResolvedValue(link({ status: 'Active' }));

		renderWithProviders(<FranchisePage />, { authUser: owner });

		await screen.findByText('Alpha Car Spa');
		const yours = screen.getByRole('region', { name: 'Companies that franchise you' });
		fireEvent.click(within(yours).getByLabelText('Financial totals (revenue, collections, jobs, invoices)'));
		await waitFor(() => expect(api.decideFranchiseScope).toHaveBeenCalledWith('l1', 'financial_totals', false));
	});

	it('hides the invite form and the answer buttons from someone who can only view', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(
			network({ pendingInvitations: 1, franchisors: [link({ role: 'Franchisee', partnerName: 'Alpha Car Spa' })] }),
		);

		renderWithProviders(<FranchisePage />, { authUser: viewer });

		expect(await screen.findByText(/invites you to join/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Company code to invite')).not.toBeInTheDocument();
	});

	it('explains when the Franchise add-on is not active', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network({ franchiseEnabled: false }));

		renderWithProviders(<FranchisePage />, { authUser: owner });

		expect(await screen.findByText(/franchise add-on is not active/i)).toBeInTheDocument();
		expect(screen.queryByLabelText('Company code to invite')).not.toBeInTheDocument();
	});
});
