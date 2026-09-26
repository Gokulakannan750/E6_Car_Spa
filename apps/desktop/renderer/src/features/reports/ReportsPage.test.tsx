import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ReportsPage } from './ReportsPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';
import * as XLSX from 'xlsx';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getDashboardSummary: vi.fn(),
		getShowrooms: vi.fn(),
		getMonthlyShowroomReport: vi.fn(),
	};
});

vi.mock('xlsx', () => ({
	utils: {
		aoa_to_sheet: vi.fn(() => ({})),
		book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
		book_append_sheet: vi.fn(),
	},
	writeFile: vi.fn(),
}));

vi.mock('recharts', () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
	Area: () => null,
	BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
	Bar: () => null,
	PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
	Pie: () => null,
	Cell: () => null,
	XAxis: () => null,
	YAxis: () => null,
	CartesianGrid: () => null,
	Tooltip: () => null,
	Legend: () => null,
}));

describe('ReportsPage Component', () => {
	const todayIso = new Date().toISOString();

	const mockDashboardSummary: api.DashboardSummaryDto = {
		dateRange: { fromDate: todayIso, toDate: todayIso },
		jobCardKpis: {
			totalJobCards: 10,
			newJobCards: 1,
			inProgressJobCards: 2,
			completedJobCards: 6,
			cancelledJobCards: 1,
			invoicedJobCards: 6,
		},
		vehicleActivity: {
			vehiclesServiced: 6,
			totalServicesCompleted: 12,
			uniqueVehiclesServiced: 6,
		},
		invoiceKpis: {
			draftCount: 1,
			generatedCount: 2,
			partiallyPaidCount: 2,
			paidCount: 4,
			cancelledCount: 0,
			totalInvoicedAmount: 8000,
			totalPaidAmount: 7000,
			totalOutstandingAmount: 1000,
		},
		sales: {
			grossSubtotal: 7500,
			totalDiscount: 500,
			gstAmount: 1000,
			netSales: 8000,
			paymentCollection: 7000,
			outstanding: 1000,
		},
		paymentCollection: {
			totalReceived: 7000,
			transactionCount: 5,
			breakdownByMethod: [
				{ method: 'UPI', transactionCount: 3, amount: 4500 },
				{ method: 'Cash', transactionCount: 2, amount: 2500 },
			],
		},
		showroom: {
			activeShowroomsCount: 2,
			staffAssignmentsCount: 4,
			vehiclesAttended: 15,
			totalBilled: 20000,
			totalReceived: 20000,
			totalOutstanding: 0,
			paidDaysCount: 5,
			partiallyPaidDaysCount: 0,
			unpaidDaysCount: 0,
		},
		staffAdvances: {
			outstandingCount: 1,
			outstandingAmount: 2500,
			settledCount: 1,
			settledAmount: 1500,
			obsoleteCount: 0,
		},
		outstanding: {
			invoiceOutstanding: 1000,
			showroomOutstanding: 0,
			staffAdvanceOutstanding: 2500,
			totalOutstandingCombined: 3500,
		},
		topServices: [
			{ name: 'Ceramic Coating', category: 'Detailing', count: 4, revenue: 6000 },
			{ name: 'Foam Wash & Wax', category: 'Washing', count: 8, revenue: 2000 },
		],
		revenueTimeline: [
			{ key: '2026-09-01', label: '1 Sep', dateObj: todayIso, revenue: 5000, collected: 4000, outstanding: 1000 },
			{ key: '2026-09-02', label: '2 Sep', dateObj: todayIso, revenue: 3000, collected: 3000, outstanding: 0 },
		],
		recentAdvances: [
			{
				id: 'adv-1',
				staffId: 'staff-1',
				staffName: 'Murugan',
				staffRole: 'Technician',
				advanceDate: todayIso,
				amount: 2500,
				reason: 'Festival Advance',
				status: 'Outstanding',
			},
		],
		recentActivity: [],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getDashboardSummary).mockResolvedValue(mockDashboardSummary);
		vi.mocked(api.getShowrooms).mockResolvedValue([
			{
				id: 'sr-1',
				masterId: 'SHR0001',
				name: 'Honda Dealership',
				address: '123 Main St',
				isActive: true,
				activeStaffCountToday: 3,
				totalVehiclesToday: 10,
				createdAt: todayIso,
			},
		]);
		vi.mocked(api.getMonthlyShowroomReport).mockResolvedValue({
			year: 2026,
			month: 9,
			monthName: 'September 2026',
			fromDate: '2026-09-01T00:00:00Z',
			toDate: '2026-09-30T23:59:59Z',
			overallSummary: {
				totalShowrooms: 1,
				totalVehiclesServiced: 10,
				totalWorkEntries: 5,
				totalServicesPerformed: 15,
				totalBilledAmount: 20000,
				totalCollectedAmount: 20000,
				totalOutstandingAmount: 0,
			},
			showrooms: [
				{
					showroomId: 'sr-1',
					showroomMasterId: 'SHR0001',
					showroomName: 'Honda Dealership',
					showroomAddress: '123 Main St',
					showroomPhone: '9876543210',
					showroomGstin: null,
					summary: {
						totalVehiclesServiced: 10,
						totalWorkEntries: 5,
						totalServicesPerformed: 15,
						totalActiveStaff: 3,
						totalBilledAmount: 20000,
						totalCollectedAmount: 20000,
						totalOutstandingAmount: 0,
						totalBillingDays: 5,
						paidDaysCount: 5,
						partiallyPaidDaysCount: 0,
						unpaidDaysCount: 0,
					},
					vehicleWorks: [
						{
							id: 'w-1',
							date: '2026-09-15T00:00:00Z',
							showroomId: 'sr-1',
							showroomMasterId: 'SHR0001',
							showroomName: 'Honda Dealership',
							staffId: 'st-1',
							staffMasterId: 'ST001A',
							staffName: 'Kavitha',
							staffPhone: '9876543210',
							vehicleTypeId: 'vt-1',
							vehicleTypeCode: 'SEDAN',
							vehicleTypeName: 'Sedan',
							vehicleQuantity: 2,
							servicesSummary: 'Full Body Wash (2)',
							serviceItems: [],
							timeRecorded: '10:00 AM',
							notes: null,
							dailyBilledAmount: 4000,
							dailyCollectedAmount: 4000,
							paymentStatus: 'Paid',
						},
					],
					dailyBills: [],
				},
			],
		});
	});

	it('renders Reports page header and executive KPI summary cards from backend summary on /reports', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getAllByText('₹8,000.00').length).toBeGreaterThan(0);
			expect(screen.getAllByText('₹7,000.00').length).toBeGreaterThan(0);
			expect(screen.getAllByText('₹3,500.00').length).toBeGreaterThan(0);
		});

		expect(screen.getByRole('heading', { level: 1, name: /reports & business analytics/i })).toBeInTheDocument();
		expect(screen.getAllByText('Billed Revenue').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Collections Received').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Total Outstanding').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Job Cards Completed').length).toBeGreaterThan(0);
		expect(screen.getByText('Report Workspaces & Detailed Analytics')).toBeInTheDocument();
	});

	it('supports switching date presets (e.g. 7D, 30D, This Month, YTD) and fetches backend report', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^7D$/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /^7D$/i }));

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^This Month$/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /^This Month$/i }));
		expect(api.getDashboardSummary).toHaveBeenCalled();
	});

	it('triggers Excel export via SheetJS when Export Excel button is clicked', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getAllByText('₹8,000.00').length).toBeGreaterThan(0);
		});

		const exportBtn = screen.getByRole('button', { name: /export excel/i });
		expect(exportBtn).not.toBeDisabled();
		fireEvent.click(exportBtn);

		await waitFor(() => {
			expect(XLSX.writeFile).toHaveBeenCalled();
		});
	});

	it('renders top performing services table in Business Reports view on /reports/business', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports/business'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Top Performing Services')).toBeInTheDocument();
			expect(screen.getByText('Ceramic Coating')).toBeInTheDocument();
			expect(screen.getByText('Foam Wash & Wax')).toBeInTheDocument();
			expect(screen.getByText('₹6,000.00')).toBeInTheDocument();
			expect(screen.getByText('₹2,000.00')).toBeInTheDocument();
		});
	});

	it('renders error banner with retry button on query rejection', async () => {
		vi.mocked(api.getDashboardSummary).mockRejectedValue(new Error('Network error loading reports'));

		renderWithProviders(
			<Routes>
				<Route path="/reports" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getByText(/Failed to load financial report data/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
		});
	});

	it('renders Business Reports view when navigating to ?type=business or /reports/business', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports?type=business'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Revenue vs Collections Timeline')).toBeInTheDocument();
			expect(screen.getByText('Top Performing Services')).toBeInTheDocument();
			expect(screen.getByText('Ceramic Coating')).toBeInTheDocument();
		});
	});

	it('renders Billing Reports view with invoice status and payment methods when navigating to ?type=billing', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports?type=billing'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Invoice Status Distribution')).toBeInTheDocument();
			expect(screen.getByText('Collections by Payment Method')).toBeInTheDocument();
			expect(screen.getByText('Fully Paid Invoices')).toBeInTheDocument();
			expect(screen.getByText('Partially Paid Invoices')).toBeInTheDocument();
			expect(screen.getByText('UPI')).toBeInTheDocument();
			expect(screen.getByText('Cash')).toBeInTheDocument();
		});
	});

	it('renders Staff Reports view with advances breakdown and audit log when navigating to ?type=staff', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports?type=staff'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Staff Advances & Settlements Log')).toBeInTheDocument();
			expect(screen.getByText('Outstanding Advances')).toBeInTheDocument();
			expect(screen.getByText('Settled Advances')).toBeInTheDocument();
			expect(screen.getByText('Murugan')).toBeInTheDocument();
			expect(screen.getByText('Festival Advance')).toBeInTheDocument();
		});
	});

	it('renders Showroom Reports view with monthly showroom report and sub-tab switcher when navigating to ?type=showroom', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports?type=showroom'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Monthly Showroom Report')).toBeInTheDocument();
			expect(screen.getByText('Monthly Showroom Performance Report')).toBeInTheDocument();
			expect(screen.getByText('Report Ready')).toBeInTheDocument();
		});

		// Switch to Network Summary & Settlement tab
		const overviewTab = screen.getByRole('button', { name: /network summary & settlement/i });
		fireEvent.click(overviewTab);

		await waitFor(() => {
			expect(screen.getByText('Showroom Daily Bill Settlement Status')).toBeInTheDocument();
			expect(screen.getByText('Showroom Billed')).toBeInTheDocument();
			expect(screen.getByText('Fully Paid Daily Bills')).toBeInTheDocument();
		});
	});

	it('renders Custom Reports view with export options and interactive dataset toggles when navigating to ?type=custom', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports?type=custom'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Custom Report Builder & Exporter')).toBeInTheDocument();
			expect(screen.getByText('Include Report Modules:')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /export tailored excel/i })).toBeInTheDocument();
		});
	});

	it('switches views dynamically when clicking navigation tabs', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getAllByText('Billed Revenue').length).toBeGreaterThan(0);
		});

		// Switch to Billing tab button
		const billingBtn = screen.getByRole('button', { name: /billing reports/i });
		fireEvent.click(billingBtn);

		await waitFor(() => {
			expect(screen.getByText('Invoice Status Distribution')).toBeInTheDocument();
			expect(screen.getByText('Collections by Payment Method')).toBeInTheDocument();
		});

		// Switch to Staff tab button
		const staffBtn = screen.getByRole('button', { name: /staff reports/i });
		fireEvent.click(staffBtn);

		await waitFor(() => {
			expect(screen.getByText('Staff Advances & Settlements Log')).toBeInTheDocument();
			expect(screen.getByText('Outstanding Advances')).toBeInTheDocument();
		});

		// Switch to Business Reports tab button
		const businessBtn = screen.getByRole('button', { name: /business reports/i });
		fireEvent.click(businessBtn);

		await waitFor(() => {
			expect(screen.getByText('Revenue vs Collections Timeline')).toBeInTheDocument();
			expect(screen.getByText('Top Performing Services')).toBeInTheDocument();
		});

		// Switch back to Dashboard Overview tab button
		const overviewBtn = screen.getByRole('button', { name: /dashboard overview/i });
		fireEvent.click(overviewBtn);

		await waitFor(() => {
			expect(screen.getByText('Report Workspaces & Detailed Analytics')).toBeInTheDocument();
			expect(screen.getAllByText('Billed Revenue').length).toBeGreaterThan(0);
		});
	});
});
