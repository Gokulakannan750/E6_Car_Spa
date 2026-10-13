import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { PlanChangeCard } from './PlanChangeCard';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getPlanChange: vi.fn(), approvePlanChange: vi.fn(), declinePlanChange: vi.fn() };
});

const owner: api.AuthUserResponse = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };
const manager: api.AuthUserResponse = { ...owner, id: 'u2', role: 'Manager', isOwner: false, permissions: ['settings.view'] };

const upgrade: api.PlanChangeProposalDto = {
	id: 'p1',
	status: 'Pending',
	timing: 'NowWithCharge',
	from: { planName: 'Starter', interval: 'Year', androidLicences: 0, windowsLicences: 0, bothLicences: 1, addOns: [] },
	to: { planName: 'Professional', interval: 'Year', androidLicences: 0, windowsLicences: 0, bothLicences: 1, addOns: ['Showroom / B2B module'] },
	currentPeriodPriceMinor: 999_000,
	newPeriodPriceMinor: 1_499_000,
	amountNowMinor: 250_000,
	currency: 'INR',
	effectiveAt: '2026-10-14T00:00:00Z',
	expiresAt: '2026-10-21T00:00:00Z',
	reason: 'Owner asked on the phone',
};

describe('PlanChangeCard', () => {
	beforeEach(() => vi.clearAllMocks());

	it('shows nothing when there is no proposal', async () => {
		vi.mocked(api.getPlanChange).mockResolvedValue(null);
		const { container } = renderWithProviders(<PlanChangeCard />, { authUser: owner, authContextValue: { isOwner: true } });
		await waitFor(() => expect(api.getPlanChange).toHaveBeenCalled());
		expect(container.querySelector('section')).toBeNull();
	});

	it('shows the change and what it costs now, and the Owner approves it', async () => {
		vi.mocked(api.getPlanChange).mockResolvedValueOnce(upgrade).mockResolvedValue(null);
		vi.mocked(api.approvePlanChange).mockResolvedValue(null);
		renderWithProviders(<PlanChangeCard />, { authUser: owner, authContextValue: { isOwner: true } });

		expect(await screen.findByText('Trovo has proposed a change to your plan')).toBeInTheDocument();
		expect(screen.getByText('Professional')).toBeInTheDocument();
		expect(screen.getByText(/invoice for ₹2,500/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Approve change/ }));
		await waitFor(() => expect(api.approvePlanChange).toHaveBeenCalledWith('p1'));
		expect(await screen.findByText('Approved. Your new plan is in effect.')).toBeInTheDocument();
	});

	it('explains a downgrade starts at the period end, and only the Owner can answer', async () => {
		vi.mocked(api.getPlanChange).mockResolvedValue({ ...upgrade, timing: 'AtPeriodEnd', amountNowMinor: 0, effectiveAt: '2027-04-13T00:00:00Z' });
		renderWithProviders(<PlanChangeCard />, { authUser: manager, authContextValue: { isOwner: false } });

		expect(await screen.findByText(/when your paid period ends. Nothing is refunded/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Approve change/ })).toBeNull();
		expect(screen.getByText('Only the Owner can approve or decline this.')).toBeInTheDocument();
	});
});
