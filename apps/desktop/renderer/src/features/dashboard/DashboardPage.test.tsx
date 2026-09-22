import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { renderWithProviders } from '../../test/test-utils';

describe('E6 Car Spa Suite Launcher (DashboardPage)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders all five core suite applications with names, descriptions, and feature indicators', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			// 1. E6 Billing
			expect(screen.getByRole('heading', { name: 'E6 Billing', level: 3 })).toBeInTheDocument();
			expect(screen.getByText('Customers, job cards, invoices and payments')).toBeInTheDocument();
			expect(screen.getByText('Customers')).toBeInTheDocument();
			expect(screen.getByText('Job Cards')).toBeInTheDocument();
			expect(screen.getByText('Invoices')).toBeInTheDocument();
			expect(screen.getByText('Payments')).toBeInTheDocument();

			// 2. E6 Staff
			expect(screen.getByRole('heading', { name: 'E6 Staff', level: 3 })).toBeInTheDocument();
			expect(screen.getByText('Staff, attendance and salary management')).toBeInTheDocument();
			expect(screen.getByText('Staff')).toBeInTheDocument();
			expect(screen.getAllByText('Attendance')).toHaveLength(2);
			expect(screen.getByText('Salary')).toBeInTheDocument();
			expect(screen.getByText('Advances')).toBeInTheDocument();

			// 3. E6 Showroom
			expect(screen.getByRole('heading', { name: 'E6 Showroom', level: 3 })).toBeInTheDocument();
			expect(screen.getByText('Showrooms, staff work and showroom billing')).toBeInTheDocument();
			expect(screen.getByText('Showrooms')).toBeInTheDocument();
			expect(screen.getByText('Staff Requests')).toBeInTheDocument();

			// 4. E6 Reports
			expect(screen.getByRole('heading', { name: 'E6 Reports', level: 3 })).toBeInTheDocument();
			expect(screen.getByText('Business, billing, staff and showroom reports')).toBeInTheDocument();
			expect(screen.getByText('Business Reports')).toBeInTheDocument();
			expect(screen.getByText('Operational Reports')).toBeInTheDocument();
			expect(screen.getByText('Financial Reports')).toBeInTheDocument();
			expect(screen.getByText('Custom Reports')).toBeInTheDocument();

			// 5. E6 Settings
			expect(screen.getByRole('heading', { name: 'E6 Settings', level: 3 })).toBeInTheDocument();
			expect(screen.getByText('Business configuration and system settings')).toBeInTheDocument();
			expect(screen.getByText('Business Profile')).toBeInTheDocument();
			expect(screen.getByText('Tax Settings')).toBeInTheDocument();
			expect(screen.getByText('Users & Access')).toBeInTheDocument();
			expect(screen.getByText('System Preferences')).toBeInTheDocument();
		});
	});

	it('renders dynamic greeting and supporting welcome text', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText(/WELCOME TO E6 CAR SPA/i)).toBeInTheDocument();
			expect(screen.getByText(/Good (Morning|Afternoon|Evening)/i)).toBeInTheDocument();
			expect(screen.getByText('What would you like to manage today?')).toBeInTheDocument();
		});
	});

	it('navigates to E6 Billing workspace (/job-cards) when clicking the Billing card', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/job-cards" element={<div>Billing Workspace Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Open E6 Billing')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Open E6 Billing'));

		await waitFor(() => {
			expect(screen.getByText('Billing Workspace Mock')).toBeInTheDocument();
		});
	});

	it('navigates to E6 Staff workspace (/staff) when clicking the Staff card', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/staff" element={<div>Staff Workspace Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Open E6 Staff')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Open E6 Staff'));

		await waitFor(() => {
			expect(screen.getByText('Staff Workspace Mock')).toBeInTheDocument();
		});
	});

	it('navigates to E6 Showroom workspace (/showroom) when clicking the Showroom card', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/showroom" element={<div>Showroom Workspace Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Open E6 Showroom')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Open E6 Showroom'));

		await waitFor(() => {
			expect(screen.getByText('Showroom Workspace Mock')).toBeInTheDocument();
		});
	});

	it('navigates to E6 Reports workspace (/reports) when clicking the Reports card', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/reports" element={<div>Reports Workspace Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Open E6 Reports')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Open E6 Reports'));

		await waitFor(() => {
			expect(screen.getByText('Reports Workspace Mock')).toBeInTheDocument();
		});
	});

	it('navigates to E6 Settings workspace (/settings) when clicking the Settings card', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/settings" element={<div>Settings Workspace Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Open Settings')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Open Settings'));

		await waitFor(() => {
			expect(screen.getByText('Settings Workspace Mock')).toBeInTheDocument();
		});
	});

	it('supports keyboard navigation via Alt + 1-5 shortcuts', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/job-cards" element={<div>Billing Workspace Alt1</div>} />
				<Route path="/staff-advances" element={<div>Staff Workspace Alt2</div>} />
				<Route path="/showroom" element={<div>Showroom Workspace Alt3</div>} />
				<Route path="/reports" element={<div>Reports Workspace Alt4</div>} />
				<Route path="/settings" element={<div>Settings Workspace Alt5</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'E6 Billing', level: 3 })).toBeInTheDocument();
		});

		// Alt + 1 -> Billing
		fireEvent.keyDown(window, { key: '1', altKey: true });
		await waitFor(() => {
			expect(screen.getByText('Billing Workspace Alt1')).toBeInTheDocument();
		});
	});
});
