import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { StaffReportsView } from './StaffReportsView';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';
import * as excelGen from './excelStaffAdvancesGenerator';

vi.mock('./excelStaffAdvancesGenerator', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./excelStaffAdvancesGenerator')>();
	return {
		...actual,
		generateAndDownloadStaffAdvancesReport: vi.fn(),
	};
});

describe('StaffReportsView Component — UI & Multi-Sheet Excel Export', () => {
	const mockBounds = {
		start: new Date(2026, 9, 1),
		end: new Date(2026, 9, 31),
		startStr: '2026-10-01',
		endStr: '2026-10-31',
		label: 'October 2026',
	};

	const mockDashboardData: api.DashboardSummaryDto = {
		dateRange: { fromDate: '2026-10-01', toDate: '2026-10-31' },
		jobCardKpis: {
			totalJobCards: 10,
			newJobCards: 2,
			inProgressJobCards: 3,
			completedJobCards: 5,
			cancelledJobCards: 0,
			invoicedJobCards: 5,
		},
		vehicleActivity: {
			vehiclesServiced: 8,
			totalServicesCompleted: 15,
			uniqueVehiclesServiced: 8,
		},
		invoiceKpis: {
			draftCount: 1,
			generatedCount: 2,
			partiallyPaidCount: 1,
			paidCount: 4,
			cancelledCount: 0,
			totalInvoicedAmount: 25000,
			totalPaidAmount: 20000,
			totalOutstandingAmount: 5000,
		},
		sales: {
			grossSubtotal: 25000,
			totalDiscount: 1000,
			gstAmount: 4320,
			netSales: 28320,
			paymentCollection: 20000,
			outstanding: 5000,
		},
		paymentCollection: {
			totalReceived: 20000,
			transactionCount: 4,
			breakdownByMethod: [{ method: 'UPI', transactionCount: 4, amount: 20000 }],
		},
		showroom: {
			activeShowroomsCount: 2,
			staffAssignmentsCount: 18,
			vehiclesAttended: 12,
			totalBilled: 15000,
			totalReceived: 12000,
			totalOutstanding: 3000,
			paidDaysCount: 4,
			partiallyPaidDaysCount: 1,
			unpaidDaysCount: 1,
		},
		staffAdvances: {
			outstandingCount: 3,
			outstandingAmount: 12000,
			settledCount: 2,
			settledAmount: 17000,
			obsoleteCount: 0,
		},
		outstanding: {
			invoiceOutstanding: 5000,
			showroomOutstanding: 3000,
			staffAdvanceOutstanding: 12000,
			totalOutstandingCombined: 20000,
		},
		topServices: [],
		revenueTimeline: [],
		recentAdvances: [
			{
				id: 'adv-1',
				staffId: 'staff-ramesh',
				staffName: 'Ramesh Kumar',
				staffRole: 'Detailer',
				advanceDate: '2026-10-05T10:00:00Z',
				amount: 7000,
				reason: 'Medical advance',
				status: 'Settled',
			},
			{
				id: 'adv-2',
				staffId: 'staff-kumar',
				staffName: 'Kumar Swamy',
				staffRole: 'Technician',
				advanceDate: '2026-10-12T10:00:00Z',
				amount: 10000,
				reason: 'Tool purchase',
				status: 'Outstanding',
			},
		],
		recentActivity: [],
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders Staff KPI cards and advances log table correctly', () => {
		renderWithProviders(
			<StaffReportsView
				data={mockDashboardData}
				isLoading={false}
				bounds={mockBounds}
				formatINR={(val) => `₹${(val ?? 0).toLocaleString('en-IN')}`}
			/>
		);

		expect(screen.getByText('Outstanding Advances')).toBeInTheDocument();
		expect(screen.getByText('₹12,000')).toBeInTheDocument();
		expect(screen.getByText('Settled Advances')).toBeInTheDocument();
		expect(screen.getByText('₹17,000')).toBeInTheDocument();
		expect(screen.getByText('Shifts Assigned')).toBeInTheDocument();
		expect(screen.getByText('18')).toBeInTheDocument();
		expect(screen.getByText('Vehicles Serviced')).toBeInTheDocument();
		expect(screen.getByText('12')).toBeInTheDocument();

		// Check Advances Table
		expect(screen.getByText('Staff Advances & Settlements Log')).toBeInTheDocument();
		expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		expect(screen.getByText('Kumar Swamy')).toBeInTheDocument();
	});

	it('renders Export Staff Advances Excel button and triggers report download with bound dates and staff data', async () => {
		renderWithProviders(
			<StaffReportsView
				data={mockDashboardData}
				isLoading={false}
				bounds={mockBounds}
				formatINR={(val) => `₹${(val ?? 0).toLocaleString('en-IN')}`}
			/>
		);

		const exportBtn = screen.getByRole('button', { name: /export staff advances excel/i });
		expect(exportBtn).toBeInTheDocument();
		expect(exportBtn).not.toBeDisabled();

		fireEvent.click(exportBtn);

		await waitFor(() => {
			expect(excelGen.generateAndDownloadStaffAdvancesReport).toHaveBeenCalledWith(
				expect.objectContaining({
					periodLabel: 'October 2026',
					startDate: '2026-10-01',
					endDate: '2026-10-31',
					advances: mockDashboardData.recentAdvances,
					summary: mockDashboardData.staffAdvances,
				})
			);
		});
	});
});
