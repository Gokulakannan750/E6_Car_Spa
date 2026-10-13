import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { FranchiseSignupCodes } from './FranchiseSignupCodes';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getFranchiseSignupCodes: vi.fn(),
		createFranchiseSignupCode: vi.fn(),
		cancelFranchiseSignupCode: vi.fn(),
	};
});

const owner: api.AuthUserResponse = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };
const TOTALS = 'Financial totals (revenue, collections, jobs, invoices)';

function code(over: Partial<api.FranchiseSignupCodeDto>): api.FranchiseSignupCodeDto {
	return {
		id: 'c1',
		label: 'Salem — Ramesh',
		scopes: [{ scope: 'financial_totals', label: TOTALS, status: 'Requested' }],
		status: 'Open',
		createdAt: '2026-10-13T10:00:00Z',
		expiresAt: '2026-10-13T11:00:00Z',
		usedAt: null,
		usedByCompanyName: null,
		...over,
	};
}

describe('FranchiseSignupCodes', () => {
	beforeEach(() => vi.clearAllMocks());

	it('is hidden on a single-company server', async () => {
		vi.mocked(api.getFranchiseSignupCodes).mockResolvedValue({ available: false, lifetimeMinutes: 0, codes: [] });
		const { container } = renderWithProviders(<FranchiseSignupCodes canManage />, { authUser: owner });
		await waitFor(() => expect(api.getFranchiseSignupCodes).toHaveBeenCalled());
		expect(container.querySelector('section')).toBeNull();
	});

	it('makes a code with the chosen items, shows it once, and lists codes with their status', async () => {
		vi.mocked(api.getFranchiseSignupCodes).mockResolvedValue({
			available: true,
			lifetimeMinutes: 60,
			codes: [code({ id: 'used', status: 'Used', usedByCompanyName: 'E6 Salem' }), code({ id: 'open', label: 'Trichy' })],
		});
		vi.mocked(api.createFranchiseSignupCode).mockResolvedValue({ code: 'K7QM-4RTX-9PWD', item: code({ id: 'new' }) });
		vi.mocked(api.cancelFranchiseSignupCode).mockResolvedValue(code({ id: 'open', status: 'Cancelled' }));

		renderWithProviders(<FranchiseSignupCodes canManage />, { authUser: owner });
		expect(await screen.findByText(/A code works once, for 1 hour/)).toBeInTheDocument();
		expect(screen.getByText('E6 Salem')).toBeInTheDocument();
		expect(screen.getByText('Used')).toBeInTheDocument();

		fireEvent.click(screen.getByLabelText('Invoice list'));
		fireEvent.change(screen.getByLabelText('Note for this code'), { target: { value: 'Erode 2' } });
		fireEvent.click(screen.getByRole('button', { name: /Make franchise code/ }));
		await waitFor(() =>
			expect(api.createFranchiseSignupCode).toHaveBeenCalledWith({ scopes: ['financial_totals', 'invoice_list'], label: 'Erode 2' }),
		);
		expect(await screen.findByLabelText('Franchise code')).toHaveTextContent('K7QM-4RTX-9PWD');

		// Only open (or reserved) codes can be withdrawn.
		expect(screen.getAllByRole('button', { name: /Withdraw/ })).toHaveLength(1);
		fireEvent.click(screen.getByRole('button', { name: 'Withdraw code Trichy' }));
		await waitFor(() => expect(api.cancelFranchiseSignupCode).toHaveBeenCalledWith('open'));
	});

	it('lets a viewer see the codes but not make or withdraw them', async () => {
		vi.mocked(api.getFranchiseSignupCodes).mockResolvedValue({ available: true, lifetimeMinutes: 60, codes: [code({})] });
		renderWithProviders(<FranchiseSignupCodes canManage={false} />, { authUser: owner });
		expect(await screen.findByText('Salem — Ramesh')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Make franchise code/ })).toBeNull();
		expect(screen.queryByRole('button', { name: /Withdraw/ })).toBeNull();
	});
});
