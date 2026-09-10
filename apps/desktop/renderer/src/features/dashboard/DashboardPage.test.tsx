import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getDashboardSummary: vi.fn(),
		getJobCards: vi.fn(),
	};
});

vi.mock('../../components/charts/RevenueChart', () => ({
	RevenueChart: () => <div data-testid="revenue-chart">Revenue Chart Mock</div>,
}));

vi.mock('../../components/charts/JobStatusChart', () => ({
	JobStatusChart: () => <div data-testid="job-status-chart">Job Status Chart Mock</div>,
}));

describe('DashboardPage Component', () => {
	const mockDashboardSummary: api.DashboardSummaryDto = {
		dateRange: { fromDate: '2026-02-01', toDate: '2026-02-01' },
		sales: {
			grossSubtotal: 45000,
			totalDiscount: 2000,
			gstAmount: 7740,
			netSales: 43000,
			paymentCollection: 38000,
			outstanding: 12740,
		},
		jobCardKpis: {
			totalJobCards: 25,
			inProgressJobCards: 4,
			newJobCards: 2,
			completedJobCards: 18,
			cancelledJobCards: 1,
			invoicedJobCards: 0,
		},
		vehicleActivity: {
			uniqueVehiclesServiced: 22,
			vehiclesServiced: 22,
			totalServicesCompleted: 25,
		},
		invoiceKpis: {
			draftCount: 2,
			generatedCount: 5,
			partiallyPaidCount: 3,
			paidCount: 15,
			cancelledCount: 0,
			totalInvoicedAmount: 50740,
			totalPaidAmount: 38000,
			totalOutstandingAmount: 12740,
		},
		paymentCollection: {
			totalCollected: 38000,
			cash: 10000,
			upi: 20000,
			card: 5000,
			bankTransfer: 3000,
		},
		recentActivity: [],
	};

	const mockRecentJobCards: { items: api.JobCardListDto[]; totalCount: number } = {
		items: [
			{
				id: 'jc-101',
				jobCardNumber: 'JC-2026-0101',
				customerName: 'Aravind Swamy',
				customerPhone: '9876543210',
				registrationNumber: 'TN09AZ9999',
				make: 'BMW',
				model: '3 Series',
				status: 1, // In Progress
				totalAmount: 3500,
				createdAt: '2026-02-01T10:00:00Z',
				invoiceId: null,
				invoiceNumber: null,
				invoiceStatus: null,
			},
			{
				id: 'jc-102',
				jobCardNumber: 'JC-2026-0102',
				customerName: 'Meena Kumari',
				customerPhone: '9123456780',
				registrationNumber: 'TN02BB5678',
				make: 'Honda',
				model: 'City',
				status: 4, // Invoiced
				totalAmount: 1800,
				createdAt: '2026-02-01T11:30:00Z',
				invoiceId: 'inv-102',
				invoiceNumber: 'INV-2026-0102',
				invoiceStatus: 'Generated',
			},
		],
		totalCount: 2,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getDashboardSummary).mockResolvedValue(mockDashboardSummary);
		vi.mocked(api.getJobCards).mockResolvedValue(mockRecentJobCards);
	});

	it('renders KPI stat cards with data from getDashboardSummary API', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			// Total Customers = 22
			expect(screen.getByText('Total Customers')).toBeInTheDocument();
			expect(screen.getByText('22')).toBeInTheDocument();
			expect(screen.getByText('22 active customers')).toBeInTheDocument();

			// Active Jobs = 4 (In Progress) + 2 (New) = 6
			expect(screen.getByText('Active Jobs')).toBeInTheDocument();
			expect(screen.getByText('6')).toBeInTheDocument();
			expect(screen.getByText('6 in progress')).toBeInTheDocument();

			// Revenue (MTD) = ₹45,000
			expect(screen.getByText('Revenue (MTD)')).toBeInTheDocument();
			expect(screen.getByText('₹45,000')).toBeInTheDocument();

			// Completed (MTD) = 18
			expect(screen.getByText('Completed (MTD)')).toBeInTheDocument();
			expect(screen.getByText('18')).toBeInTheDocument();
			expect(screen.getByText('18 completed/delivered')).toBeInTheDocument();
		});
	});

	it('renders recent job activity items with vehicle and customer details', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Recent Job Activity')).toBeInTheDocument();
			expect(screen.getByText('JC-2026-0101')).toBeInTheDocument();
			expect(screen.getByText(/Aravind Swamy/)).toBeInTheDocument();
			expect(screen.getByText(/TN09AZ9999/)).toBeInTheDocument();

			expect(screen.getByText('JC-2026-0102')).toBeInTheDocument();
			expect(screen.getByText(/Meena Kumari/)).toBeInTheDocument();
			expect(screen.getByText(/TN02BB5678/)).toBeInTheDocument();
		});
	});

	it('navigates to job card details when recent job card item is clicked', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/job-cards/:id" element={<div>Job Card Detail Route Mock</div>} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('JC-2026-0101')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('JC-2026-0101'));

		await waitFor(() => {
			expect(screen.getByText('Job Card Detail Route Mock')).toBeInTheDocument();
		});
	});

	it('renders empty recent activity state when no recent job cards exist', async () => {
		vi.mocked(api.getJobCards).mockResolvedValue({ items: [], totalCount: 0 });

		renderWithProviders(
			<Routes>
				<Route path="/dashboard" element={<DashboardPage />} />
			</Routes>,
			{ initialEntries: ['/dashboard'] }
		);

		await waitFor(() => {
			expect(screen.getByText('No recent job card activity')).toBeInTheDocument();
			expect(screen.getByText(/New job cards created will appear in real time here/i)).toBeInTheDocument();
		});
	});
});
