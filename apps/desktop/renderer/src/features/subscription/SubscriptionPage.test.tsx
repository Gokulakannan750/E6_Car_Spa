import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import SubscriptionPage from './SubscriptionPage';
import { renderWithProviders } from '../../test/test-utils';
import type { AuthUserResponse, SubscriptionStatusDto } from '../../lib/api';

const owner: AuthUserResponse = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };

const professional: SubscriptionStatusDto = {
	managed: true,
	access: 'Full',
	status: 'Active',
	planCode: 'professional',
	planName: 'Professional',
	interval: 'Year',
	features: {
		'outside_jobs.enabled': 'true',
		'staff_advances.enabled': 'true',
		'whatsapp_automation.enabled': 'true',
		'reports.advanced': 'true',
		'audit_trail.enabled': 'true',
		'showroom.enabled': 'true',
	},
	seatsUsed: 1,
	currentPeriodEnd: '2027-10-13T00:00:00Z',
	licences: [
		{ appAccess: 'Both', total: 1, used: 1 },
		{ appAccess: 'Windows', total: 1, used: 0 },
		{ appAccess: 'Android', total: 1, used: 0 },
	],
};

describe('SubscriptionPage', () => {
	it('shows the plan, the paid-until date, the licences in use and which modules are included', () => {
		renderWithProviders(<SubscriptionPage />, { authUser: owner, authContextValue: { subscription: professional } });

		const plan = screen.getByRole('region', { name: 'Plan' });
		expect(within(plan).getByText('Professional')).toBeInTheDocument();
		expect(within(plan).getByText('Yearly')).toBeInTheDocument();
		expect(within(plan).getByText('Active')).toBeInTheDocument();
		expect(within(plan).getByText('Paid until')).toBeInTheDocument();

		const licences = screen.getByRole('region', { name: 'User licences' });
		expect(within(licences).getByText('1 of 1 in use')).toBeInTheDocument();
		expect(within(licences).getAllByText('0 of 1 in use')).toHaveLength(2);

		const modules = screen.getByRole('region', { name: 'Modules' });
		expect(within(modules).getByText('Showroom / B2B module').querySelector('[aria-label]')).toHaveAttribute('aria-label', 'Included');
		expect(within(modules).getByText('Franchise network').querySelector('[aria-label]')).toHaveAttribute('aria-label', 'Not included');
	});

	it('shows the trial end date during a free trial', () => {
		renderWithProviders(<SubscriptionPage />, {
			authUser: owner,
			authContextValue: { subscription: { ...professional, status: 'Trialing', trialEndsAt: '2026-10-20T00:00:00Z' } },
		});
		expect(screen.getByText('Free trial')).toBeInTheDocument();
		expect(screen.getByText('Free trial ends')).toBeInTheDocument();
	});

	it('says so on a server without a Trovo subscription', () => {
		renderWithProviders(<SubscriptionPage />, { authUser: owner, authContextValue: { subscription: null } });
		expect(screen.getByText(/not on a Trovo subscription/)).toBeInTheDocument();
	});
});
