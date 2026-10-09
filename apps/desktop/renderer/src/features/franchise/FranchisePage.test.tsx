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
		cancelFranchiseInvite: vi.fn(),
		endFranchiseLink: vi.fn(),
		requestFranchiseScopes: vi.fn(),
		createFranchiseLink: vi.fn(),
	};
});

const owner: api.AuthUserResponse = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };
const viewer: api.AuthUserResponse = { ...owner, id: 'u2', role: 'Staff', isOwner: false, permissions: ['franchise.view'] };

const scope = (s: string, label: string, status: api.FranchiseScopeStatus): api.FranchiseScopeDto => ({ scope: s, label, status });
const TOTALS = 'Financial totals (revenue, collections, jobs, invoices)';

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
		scopes: [scope('financial_totals', TOTALS, 'Requested')],
		...over,
	};
}

function network(over: Partial<api.FranchiseNetworkDto> = {}): api.FranchiseNetworkDto {
	return { franchiseEnabled: true, franchisees: [], franchisors: [], pendingInvitations: 0, ...over };
}

const LINK = 'http://localhost:5173/franchise-invite/abc123';

describe('FranchisePage (the franchisor)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('sends an invitation with the chosen items and shows the link to pass on', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network());
		vi.mocked(api.sendFranchiseInvite).mockResolvedValue({
			message: 'If that code belongs to an active company, your invitation has been sent.',
			inviteLink: LINK,
		});

		renderWithProviders(<FranchisePage />, { authUser: owner });

		fireEvent.change(await screen.findByLabelText('Company code to invite'), { target: { value: '0002' } });
		fireEvent.click(screen.getByLabelText('Invoice list'));
		fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

		await waitFor(() => {
			expect(api.sendFranchiseInvite).toHaveBeenCalledWith({ franchiseeCode: '0002', scopes: ['financial_totals', 'invoice_list'] });
		});
		expect(await screen.findByText(/your invitation has been sent/i)).toBeInTheDocument();
		expect(screen.getByLabelText('Invitation link')).toHaveValue(LINK);
		expect(screen.getByText(/only the owner of the invited company can use it/i)).toBeInTheDocument();
	});

	it('shows the status of an invited company, and can withdraw a pending invitation', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network({ franchisees: [link({})] }));
		vi.mocked(api.cancelFranchiseInvite).mockResolvedValue(link({ status: 'Cancelled' }));

		renderWithProviders(<FranchisePage />, { authUser: owner });

		expect(await screen.findByText('Beta Detailing')).toBeInTheDocument();
		expect(screen.getByText('Pending')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /withdraw invitation/i }));
		await waitFor(() => expect(api.cancelFranchiseInvite).toHaveBeenCalledWith('l1'));
	});

	it('makes a new link for a pending invitation', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network({ franchisees: [link({})] }));
		vi.mocked(api.createFranchiseLink).mockResolvedValue({ link: link({}), accessLink: LINK, accessLinkExpiresAt: '2026-10-15T10:00:00Z' });

		renderWithProviders(<FranchisePage />, { authUser: owner });

		fireEvent.click(await screen.findByRole('button', { name: /make a new link/i }));
		await waitFor(() => expect(api.createFranchiseLink).toHaveBeenCalledWith('l1'));
		expect(await screen.findByLabelText('Invitation link')).toHaveValue(LINK);
		expect(screen.getByText(/earlier link no longer works/i)).toBeInTheDocument();
	});

	it('asks to see more on an active link, and shows the link for the franchisee to answer through', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(
			network({ franchisees: [link({ status: 'Active', scopes: [scope('financial_totals', TOTALS, 'Granted')] })] }),
		);
		vi.mocked(api.requestFranchiseScopes).mockResolvedValue({ link: link({ status: 'Active' }), accessLink: LINK, accessLinkExpiresAt: null });

		renderWithProviders(<FranchisePage />, { authUser: owner });

		fireEvent.click(await screen.findByRole('button', { name: /ask to see more/i }));
		const card = screen.getByText('Beta Detailing').closest('div.space-y-3') as HTMLElement;
		fireEvent.click(within(card).getByLabelText('Invoice list'));
		fireEvent.click(screen.getByRole('button', { name: /send request/i }));

		await waitFor(() => expect(api.requestFranchiseScopes).toHaveBeenCalledWith('l1', ['invoice_list']));
		expect(await screen.findByText(/so they can answer your request/i)).toBeInTheDocument();
		expect(screen.getByLabelText('Invitation link')).toHaveValue(LINK);
	});

	it('has no franchisee-side sections: invitations are answered through a link, not here', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(
			network({ franchisors: [link({ role: 'Franchisee', partnerName: 'Alpha Car Spa' })] }),
		);

		renderWithProviders(<FranchisePage />, { authUser: owner });

		await screen.findByLabelText('Company code to invite');
		expect(screen.queryByText(/invitations for you/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/companies that franchise you/i)).not.toBeInTheDocument();
		expect(screen.queryByText('Alpha Car Spa')).not.toBeInTheDocument();
	});

	it('hides the invite form and the buttons from someone who can only view', async () => {
		vi.mocked(api.getFranchiseNetwork).mockResolvedValue(network({ franchisees: [link({})] }));

		renderWithProviders(<FranchisePage />, { authUser: viewer });

		expect(await screen.findByText('Beta Detailing')).toBeInTheDocument();
		expect(screen.queryByLabelText('Company code to invite')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /withdraw invitation/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /make a new link/i })).not.toBeInTheDocument();
	});
});
