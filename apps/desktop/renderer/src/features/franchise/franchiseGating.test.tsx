import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { FranchisorGuard } from './FranchisorGuard';
import { Sidebar } from '../../components/shell/Sidebar';
import { renderWithProviders } from '../../test/test-utils';
import type { AuthUserResponse } from '../../lib/api';

const access = { canActAsFranchisor: false, isFranchisee: false, isLoading: false };
vi.mock('./useFranchiseAccess', () => ({
	FRANCHISE_ACCESS_QUERY_KEY: ['franchise-access'],
	useFranchiseAccess: () => access,
}));

vi.mock('../settings/hooks/useBusinessProfile', () => ({
	useBusinessProfile: () => ({ profile: { businessName: 'Test Spa' }, logoUrl: '', hasCustomLogo: false }),
}));

const owner: AuthUserResponse = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };

function setAccess(over: Partial<typeof access>) {
	Object.assign(access, { canActAsFranchisor: false, isFranchisee: false, isLoading: false }, over);
}

describe('Franchise section is only for a company that gives franchises', () => {
	beforeEach(() => setAccess({}));

	it('the franchisor pages are blocked without the add-on, and point a franchisee to its sharing page', () => {
		renderWithProviders(
			<FranchisorGuard>
				<p>Franchisor content</p>
			</FranchisorGuard>,
			{ authUser: owner },
		);

		expect(screen.getByText(/franchise add-on is not active/i)).toBeInTheDocument();
		expect(screen.queryByText('Franchisor content')).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: /settings → franchise sharing/i })).toHaveAttribute('href', '/settings/franchise-sharing');
	});

	it('the franchisor pages open for a company with the add-on', () => {
		setAccess({ canActAsFranchisor: true });
		renderWithProviders(
			<FranchisorGuard>
				<p>Franchisor content</p>
			</FranchisorGuard>,
			{ authUser: owner },
		);

		expect(screen.getByText('Franchisor content')).toBeInTheDocument();
	});

	it('the franchise sidebar items are hidden without the add-on', () => {
		renderWithProviders(<Sidebar />, { authUser: owner, initialEntries: ['/franchise'] });

		expect(screen.queryByText('Franchise Network')).not.toBeInTheDocument();
		expect(screen.queryByText('Franchise Dashboard')).not.toBeInTheDocument();
	});

	it('the franchise sidebar items show with the add-on', () => {
		setAccess({ canActAsFranchisor: true });
		renderWithProviders(<Sidebar />, { authUser: owner, initialEntries: ['/franchise'] });

		expect(screen.getByText('Franchise Network')).toBeInTheDocument();
		expect(screen.getByText('Franchise Dashboard')).toBeInTheDocument();
	});

	it('Franchise Sharing shows in Settings only for a company that is a franchisee', () => {
		renderWithProviders(<Sidebar />, { authUser: owner, initialEntries: ['/settings'] });
		expect(screen.queryByText('Franchise Sharing')).not.toBeInTheDocument();
	});

	it('Franchise Sharing shows in Settings for a franchisee, who does not get the Franchise section', () => {
		setAccess({ isFranchisee: true });
		renderWithProviders(<Sidebar />, { authUser: owner, initialEntries: ['/settings'] });

		expect(screen.getByText('Franchise Sharing')).toBeInTheDocument();
	});
});
