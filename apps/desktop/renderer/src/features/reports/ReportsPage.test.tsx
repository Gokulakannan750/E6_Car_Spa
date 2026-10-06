import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ReportsPage } from './ReportsPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getDashboardSummary: vi.fn(),
		getShowrooms: vi.fn(),
		getMonthlyShowroomReport: vi.fn(),
		getOutsideJobsReport: vi.fn(),
		getMonthlyBillingReport: vi.fn(),
	};
});

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
					attendanceRecords: [],
					swaps: [],
					vehicleTypeSummary: [],
					serviceSummary: [],
					staffSummary: [],
				},
			],
		});
		vi.mocked(api.getOutsideJobsReport).mockResolvedValue({
			totalOutsideCount: 0,
			totalOverdueCount: 0,
			totalActiveCost: 0,
			totalHistoricalCost: 0,
			currentlyOutside: [],
			history: [],
			vendorSummary: [],
		});
		vi.mocked(api.getMonthlyBillingReport).mockResolvedValue({
			year: 2026,
			month: 10,
			monthName: 'October 2026',
			fromDate: '2026-10-01T00:00:00Z',
			toDate: '2026-10-31T00:00:00Z',
			daysInMonth: 31,
			summary: {
				monthName: 'October 2026',
				startDate: '2026-10-01T00:00:00Z',
				endDate: '2026-10-31T00:00:00Z',
				generatedAt: '2026-10-31T23:59:59Z',
				totalJobCardsCreated: 10,
				totalJobCardsFinished: 6,
				totalInvoices: 9,
				totalInvoicesPaid: 4,
				totalInvoicesPendingPayment: 4,
				totalInvoicesDraft: 1,
				totalInvoicesCancelled: 0,
				totalInvoiceAmount: 8000,
				totalAmountPaid: 7000,
				totalAmountPending: 1000,
				totalServicesPerformed: 12,
				totalServiceQuantity: 12,
			},
			dailySheets: [],
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
			expect(screen.getAllByText('₹1,000.00').length).toBeGreaterThan(0);
		});

		expect(screen.getByRole('heading', { level: 1, name: /reports & business analytics/i })).toBeInTheDocument();
		expect(screen.getAllByText('Total Invoiced').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Total Payments Collected').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Invoice Receivables').length).toBeGreaterThan(0);

		// Verified Reports sub-tabs
		expect(screen.getByRole('button', { name: /billing reports/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /staff reports/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /showroom reports/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /outside jobs/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /custom reports/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /audit trail/i })).toBeInTheDocument();

		// Obsolete tabs must NOT exist
		expect(screen.queryByRole('button', { name: /dashboard overview/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /business reports/i })).not.toBeInTheDocument();

		// Opens directly into Billing Reports
		expect(screen.getByText('Invoice Status Distribution')).toBeInTheDocument();
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

	it('does not render top-level generic Export Excel button on header bar', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getAllByText('₹8,000.00').length).toBeGreaterThan(0);
		});

		expect(screen.queryByRole('button', { name: /^Export Excel$/i })).not.toBeInTheDocument();
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

	it('renders Outside Jobs Reports view when navigating to ?type=outside-jobs', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports?type=outside-jobs'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Outside Jobs & External Movements')).toBeInTheDocument();
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
			expect(screen.getAllByText('Total Invoiced').length).toBeGreaterThan(0);
		});

		// Switch to Staff tab button
		const staffBtn = screen.getByRole('button', { name: /staff reports/i });
		fireEvent.click(staffBtn);

		await waitFor(() => {
			expect(screen.getByText('Staff Advances & Settlements Log')).toBeInTheDocument();
			expect(screen.getByText('Outstanding Advances')).toBeInTheDocument();
		});

		// Switch to Outside Jobs tab button
		const outsideJobsBtn = screen.getByRole('button', { name: /outside jobs/i });
		fireEvent.click(outsideJobsBtn);

		await waitFor(() => {
			expect(screen.getByText('Outside Jobs & External Movements')).toBeInTheDocument();
		});

		// Switch back to Billing Reports tab button
		const billingBtn = screen.getByRole('button', { name: /billing reports/i });
		fireEvent.click(billingBtn);

		await waitFor(() => {
			expect(screen.getByText('Invoice Status Distribution')).toBeInTheDocument();
			expect(screen.getAllByText('Total Invoiced').length).toBeGreaterThan(0);
		});

		// Assert removed tabs do not exist
		expect(screen.queryByRole('button', { name: /dashboard overview/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /business reports/i })).not.toBeInTheDocument();
	});

	it('gates report tabs based on granular permissions (Phase 2C)', async () => {
		// User with only outsidejobs.view
		const { unmount } = renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{
				initialEntries: ['/reports'],
				authUser: {
					id: 'u-oj',
					username: 'ojuser',
					fullName: 'Outside Jobs User',
					role: 'Staff',
					isOwner: false,
					permissions: ['outsidejobs.view'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^outside jobs$/i })).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /^billing reports$/i })).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /^staff reports$/i })).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /^showroom reports$/i })).not.toBeInTheDocument();
		});

		unmount();

		// User with only reports.invoices
		renderWithProviders(
			<Routes>
				<Route path="/reports/*" element={<ReportsPage />} />
			</Routes>,
			{
				initialEntries: ['/reports'],
				authUser: {
					id: 'u-bill',
					username: 'billuser',
					fullName: 'Billing User',
					role: 'Staff',
					isOwner: false,
					permissions: ['reports.invoices'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^billing reports$/i })).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /^outside jobs$/i })).not.toBeInTheDocument();
		});
	});
});

