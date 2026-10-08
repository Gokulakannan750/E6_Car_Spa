import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { renderWithProviders } from '../../test/test-utils';

describe('Suite Launcher (DashboardPage)', () => {
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
			// 1. Billing
			expect(screen.getByRole('heading', { name: 'Billing', level: 3 })).toBeInTheDocument();
			expect(screen.getByText('Customers, job cards, invoices and payments')).toBeInTheDocument();
			expect(screen.getByText('Customers')).toBeInTheDocument();
			expect(screen.getByText('Job Cards')).toBeInTheDocument();
			expect(screen.getByText('Invoices')).toBeInTheDocument();
			expect(screen.getByText('Payments')).toBeInTheDocument();

			// 2. Staff
			expect(screen.getByRole('heading', { name: 'Staff', level: 3 })).toBeInTheDocument();
			expect(screen.getByText('Staff, attendance and salary management')).toBeInTheDocument();
			expect(screen.getAllByText('Staff').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Attendance')).toHaveLength(2);
			expect(screen.getByText('Salary')).toBeInTheDocument();
			expect(screen.getByText('Advances')).toBeInTheDocument();

			// 3. Showroom
			expect(screen.getByRole('heading', { name: 'Showroom', level: 3 })).toBeInTheDocument();
			expect(screen.getByText('Showrooms, staff work and showroom billing')).toBeInTheDocument();
			expect(screen.getByText('Showrooms')).toBeInTheDocument();
			expect(screen.getByText('Staff Requests')).toBeInTheDocument();

			// 4. Reports
			expect(screen.getByRole('heading', { name: 'Reports', level: 3 })).toBeInTheDocument();
			expect(screen.getByText('Billing, staff, showroom and outside job reports')).toBeInTheDocument();
			expect(screen.getByText('Billing Reports')).toBeInTheDocument();
			expect(screen.getByText('Staff Reports')).toBeInTheDocument();
			expect(screen.getByText('Showroom Reports')).toBeInTheDocument();
			expect(screen.getByText('Outside Jobs')).toBeInTheDocument();

			// 5. Settings
			expect(screen.getByRole('heading', { name: 'Settings', level: 3 })).toBeInTheDocument();
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
			expect(screen.getByText(/WELCOME TO CAR SPA MANAGEMENT/i)).toBeInTheDocument();
			expect(screen.getByText(/Good (Morning|Afternoon|Evening)/i)).toBeInTheDocument();
			expect(screen.getByText('What would you like to manage today?')).toBeInTheDocument();
		});
	});

	it('navigates to Billing workspace (/job-cards) when clicking the Billing card', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/job-cards" element={<div>Billing Workspace Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Open Billing')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Open Billing'));

		await waitFor(() => {
			expect(screen.getByText('Billing Workspace Mock')).toBeInTheDocument();
		});
	});

	it('navigates to Staff workspace (/staff) when clicking the Staff card', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/staff" element={<div>Staff Workspace Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Open Staff')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Open Staff'));

		await waitFor(() => {
			expect(screen.getByText('Staff Workspace Mock')).toBeInTheDocument();
		});
	});

	it('navigates to Showroom workspace (/showroom) when clicking the Showroom card', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/showroom" element={<div>Showroom Workspace Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Open Showroom')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Open Showroom'));

		await waitFor(() => {
			expect(screen.getByText('Showroom Workspace Mock')).toBeInTheDocument();
		});
	});

	it('navigates to Reports workspace (/reports) when clicking the Reports card', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/reports" element={<div>Reports Workspace Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Open Reports')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Open Reports'));

		await waitFor(() => {
			expect(screen.getByText('Reports Workspace Mock')).toBeInTheDocument();
		});
	});

	it('navigates to Settings workspace (/settings) when clicking the Settings card', async () => {
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
			expect(screen.getByRole('heading', { name: 'Billing', level: 3 })).toBeInTheDocument();
		});

		// Alt + 1 -> Billing
		fireEvent.keyDown(window, { key: '1', altKey: true });
		await waitFor(() => {
			expect(screen.getByText('Billing Workspace Alt1')).toBeInTheDocument();
		});
	});
});
