import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { FranchiseInvitePage } from './FranchiseInvitePage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getFranchiseInviteByToken: vi.fn(), respondToFranchiseInviteByToken: vi.fn() };
});

const owner: api.AuthUserResponse = { id: 'u1', fullName: 'Beta Owner', username: 'beta', role: 'Owner', isOwner: true, permissions: [] };

const scope = (s: string, label: string, status: api.FranchiseScopeStatus): api.FranchiseScopeDto => ({ scope: s, label, status });
const TOTALS = 'Financial totals (revenue, collections, jobs, invoices)';

const invitation: api.FranchiseLinkDto = {
	id: 'l1',
	role: 'Franchisee',
	partnerCodeHint: '0••1',
	partnerName: 'Alpha Car Spa',
	status: 'Pending',
	invitedAt: '2026-10-08T10:00:00Z',
	expiresAt: '2026-10-15T10:00:00Z',
	respondedAt: null,
	endedAt: null,
	scopes: [scope('financial_totals', TOTALS, 'Requested'), scope('staff', 'Staff and attendance', 'Requested')],
};

function open(token = 'tok123') {
	return renderWithProviders(
		<Routes>
			<Route path="/franchise-invite/:token" element={<FranchiseInvitePage />} />
		</Routes>,
		{ authUser: owner, initialEntries: [`/franchise-invite/${token}`] },
	);
}

describe('FranchiseInvitePage (the link the franchisee opens)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows who is asking and what for, and accepts with only the ticked items', async () => {
		vi.mocked(api.getFranchiseInviteByToken).mockResolvedValue(invitation);
		vi.mocked(api.respondToFranchiseInviteByToken).mockResolvedValue({ ...invitation, status: 'Active' });

		open();

		expect(await screen.findByText(/invites you to join their franchise network/i)).toBeInTheDocument();
		expect(screen.getByText(/From Alpha Car Spa \(company code 0••1\)/)).toBeInTheDocument();
		expect(api.getFranchiseInviteByToken).toHaveBeenCalledWith('tok123');

		fireEvent.click(screen.getByLabelText('Staff and attendance')); // do not allow staff
		fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

		await waitFor(() => {
			expect(api.respondToFranchiseInviteByToken).toHaveBeenCalledWith('tok123', { accept: true, grantedScopes: ['financial_totals'] });
		});
		expect(await screen.findByText(/your answer was saved/i)).toBeInTheDocument();
		expect(screen.getByText(/can now see only what you allowed/i)).toBeInTheDocument();
		expect(screen.getByText(/Settings → Franchise Sharing/)).toBeInTheDocument();
	});

	it('cannot be accepted with nothing ticked', async () => {
		vi.mocked(api.getFranchiseInviteByToken).mockResolvedValue(invitation);

		open();
		fireEvent.click(await screen.findByLabelText(TOTALS));
		fireEvent.click(screen.getByLabelText('Staff and attendance'));

		expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
	});

	it('declines the invitation', async () => {
		vi.mocked(api.getFranchiseInviteByToken).mockResolvedValue(invitation);
		vi.mocked(api.respondToFranchiseInviteByToken).mockResolvedValue({ ...invitation, status: 'Declined' });

		open();
		fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));

		await waitFor(() => expect(api.respondToFranchiseInviteByToken).toHaveBeenCalledWith('tok123', { accept: false, grantedScopes: [] }));
		expect(await screen.findByText('You declined')).toBeInTheDocument();
	});

	it('shows only the new requests when the link is a request for more on an active franchise', async () => {
		vi.mocked(api.getFranchiseInviteByToken).mockResolvedValue({
			...invitation,
			status: 'Active',
			scopes: [scope('financial_totals', TOTALS, 'Granted'), scope('invoice_list', 'Invoice list', 'Requested')],
		});
		vi.mocked(api.respondToFranchiseInviteByToken).mockResolvedValue(invitation);

		open();

		expect(await screen.findByText('A request to see more')).toBeInTheDocument();
		expect(screen.getByLabelText('Invoice list')).toBeInTheDocument();
		expect(screen.queryByLabelText(TOTALS)).not.toBeInTheDocument(); // already allowed, not asked again

		fireEvent.click(screen.getByRole('button', { name: 'Allow the ticked items' }));
		await waitFor(() => {
			expect(api.respondToFranchiseInviteByToken).toHaveBeenCalledWith('tok123', { accept: true, grantedScopes: ['invoice_list'] });
		});
	});

	it('explains a link that cannot be opened, and offers to sign in as someone else', async () => {
		vi.mocked(api.getFranchiseInviteByToken).mockRejectedValue(
			new Error('This link is not valid for your company. It may have expired or been used already.'),
		);

		open('wrong');

		expect(await screen.findByText('This link cannot be opened')).toBeInTheDocument();
		expect(screen.getByText(/not valid for your company/i)).toBeInTheDocument();
		expect(screen.getByText(/Owner of the company that was invited/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /sign in as someone else/i })).toBeInTheDocument();
		expect(api.respondToFranchiseInviteByToken).not.toHaveBeenCalled();
	});

	it('shows the reason when the answer is refused', async () => {
		vi.mocked(api.getFranchiseInviteByToken).mockResolvedValue(invitation);
		vi.mocked(api.respondToFranchiseInviteByToken).mockRejectedValue(new Error('This invitation has expired.'));

		open();
		fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('This invitation has expired.');
		expect(screen.queryByText(/your answer was saved/i)).not.toBeInTheDocument();
	});
});
