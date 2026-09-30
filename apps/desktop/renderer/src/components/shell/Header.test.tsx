import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from './Header';
import { renderWithProviders, createTestQueryClient } from '../../test/test-utils';

vi.mock('../../features/settings/hooks/useBusinessProfile', () => ({
	useBusinessProfile: () => ({
		profile: { businessName: 'E6 Car Spa' },
		logoUrl: null,
		hasCustomLogo: false,
	}),
}));

describe('Header Component - Global Refresh', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders Header with global refresh button', () => {
		renderWithProviders(<Header pageTitle="Dashboard" />);

		const refreshBtn = screen.getByTestId('btn-global-refresh');
		expect(refreshBtn).toBeInTheDocument();
		expect(refreshBtn).toHaveTextContent('Refresh');
	});

	it('triggers queryClient.invalidateQueries with active type when refresh button is clicked', async () => {
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

		renderWithProviders(<Header pageTitle="Dashboard" />, { queryClient });

		const refreshBtn = screen.getByTestId('btn-global-refresh');
		fireEvent.click(refreshBtn);

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({ type: 'active' });
		});
	});

	it('handles refresh error gracefully without crashing', async () => {
		const queryClient = createTestQueryClient();
		vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValueOnce(new Error('Network error'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		renderWithProviders(<Header pageTitle="Dashboard" />, { queryClient });

		const refreshBtn = screen.getByTestId('btn-global-refresh');
		fireEvent.click(refreshBtn);

		await waitFor(() => {
			expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh data:', expect.any(Error));
		});

		consoleSpy.mockRestore();
	});
});
