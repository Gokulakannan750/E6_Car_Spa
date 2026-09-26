import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { MonthlyShowroomReportView } from './MonthlyShowroomReportView';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';
import * as XLSX from 'xlsx';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
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

describe('MonthlyShowroomReportView Component', () => {
	const mockShowrooms: api.ShowroomDto[] = [
		{
			id: 'sr-1',
			masterId: 'SHR0001',
			name: 'Honda Dealership',
			address: '123 Auto St',
			phone: '9876500000',
			gstin: '33AAAAA0000A1Z5',
			isActive: true,
			activeStaffCountToday: 3,
			totalVehiclesToday: 10,
			createdAt: new Date().toISOString(),
		},
		{
			id: 'sr-2',
			masterId: 'SHR0002',
			name: 'Skoda Dealership',
			address: '456 German Rd',
			phone: '9876500001',
			gstin: '33BBBBB0000B1Z6',
			isActive: true,
			activeStaffCountToday: 2,
			totalVehiclesToday: 8,
			createdAt: new Date().toISOString(),
		},
	];

	const mockReportResponse: api.MonthlyShowroomReportResponse = {
		year: 2026,
		month: 9,
		monthName: 'September 2026',
		fromDate: '2026-09-01T00:00:00Z',
		toDate: '2026-09-30T23:59:59Z',
		overallSummary: {
			totalShowrooms: 2,
			totalVehiclesServiced: 25,
			totalWorkEntries: 18,
			totalServicesPerformed: 35,
			totalBilledAmount: 45000,
			totalCollectedAmount: 40000,
			totalOutstandingAmount: 5000,
		},
		showrooms: [
			{
				showroomId: 'sr-1',
				showroomMasterId: 'SHR0001',
				showroomName: 'Honda Dealership',
				showroomAddress: '123 Auto St',
				showroomPhone: '9876500000',
				showroomGstin: '33AAAAA0000A1Z5',
				summary: {
					totalVehiclesServiced: 15,
					totalWorkEntries: 10,
					totalServicesPerformed: 20,
					totalActiveStaff: 3,
					totalBilledAmount: 25000,
					totalCollectedAmount: 25000,
					totalOutstandingAmount: 0,
					totalBillingDays: 10,
					paidDaysCount: 10,
					partiallyPaidDaysCount: 0,
					unpaidDaysCount: 0,
				},
				vehicleWorks: [
					{
						id: 'work-1',
						date: '2026-09-15T00:00:00Z',
						showroomId: 'sr-1',
						showroomMasterId: 'SHR0001',
						showroomName: 'Honda Dealership',
						staffId: 'staff-1',
						staffMasterId: 'ST001A',
						staffName: 'Kavitha',
						staffPhone: '9876543210',
						staffRole: 'Senior Technician',
						vehicleTypeId: 'vt-1',
						vehicleTypeCode: 'SEDAN',
						vehicleTypeName: 'Sedan',
						vehicleQuantity: 2,
						servicesSummary: 'Full Body Wash (2), Interior Vacuum (2)',
						serviceItems: [
							{ workTypeId: 'wt-1', workTypeCode: 'WASH', workTypeName: 'Full Body Wash', quantity: 2, notes: null },
							{ workTypeId: 'wt-2', workTypeCode: 'VACUUM', workTypeName: 'Interior Vacuum', quantity: 2, notes: null },
						],
						timeRecorded: '10:30 AM',
						notes: 'VIP Customer vehicles',
						dailyBilledAmount: 2500,
						dailyCollectedAmount: 2500,
						paymentStatus: 'Paid',
					},
				],
				dailyBills: [
					{
						id: 'bill-1',
						date: '2026-09-15T00:00:00Z',
						amount: 2500,
						paidAmount: 2500,
						balanceAmount: 0,
						status: 'Paid',
						paymentCount: 1,
						notes: 'Settled via Bank Transfer',
					},
				],
			},
			{
				showroomId: 'sr-2',
				showroomMasterId: 'SHR0002',
				showroomName: 'Skoda Dealership',
				showroomAddress: '456 German Rd',
				showroomPhone: '9876500001',
				showroomGstin: '33BBBBB0000B1Z6',
				summary: {
					totalVehiclesServiced: 10,
					totalWorkEntries: 8,
					totalServicesPerformed: 15,
					totalActiveStaff: 2,
					totalBilledAmount: 20000,
					totalCollectedAmount: 15000,
					totalOutstandingAmount: 5000,
					totalBillingDays: 8,
					paidDaysCount: 6,
					partiallyPaidDaysCount: 2,
					unpaidDaysCount: 0,
				},
				vehicleWorks: [
					{
						id: 'work-2',
						date: '2026-09-18T00:00:00Z',
						showroomId: 'sr-2',
						showroomMasterId: 'SHR0002',
						showroomName: 'Skoda Dealership',
						staffId: 'staff-2',
						staffMasterId: 'ST002B',
						staffName: 'Ramesh',
						staffPhone: '9876543211',
						staffRole: 'Detailer',
						vehicleTypeId: 'vt-2',
						vehicleTypeCode: 'SUV',
						vehicleTypeName: 'Compact SUV',
						vehicleQuantity: 1,
						servicesSummary: 'Teflon Polish (1)',
						serviceItems: [
							{ workTypeId: 'wt-3', workTypeCode: 'POLISH', workTypeName: 'Teflon Polish', quantity: 1, notes: null },
						],
						timeRecorded: '02:15 PM',
						notes: null,
						dailyBilledAmount: 3000,
						dailyCollectedAmount: 1500,
						paymentStatus: 'PartiallyPaid',
					},
				],
				dailyBills: [
					{
						id: 'bill-2',
						date: '2026-09-18T00:00:00Z',
						amount: 3000,
						paidAmount: 1500,
						balanceAmount: 1500,
						status: 'PartiallyPaid',
						paymentCount: 1,
						notes: null,
					},
				],
			},
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getShowrooms).mockResolvedValue(mockShowrooms);
		vi.mocked(api.getMonthlyShowroomReport).mockResolvedValue(mockReportResponse);
	});

	it('renders Monthly Showroom Report header, filter toolbar, report ready banner, KPI cards and preview', async () => {
		renderWithProviders(<MonthlyShowroomReportView />);

		await waitFor(() => {
			expect(screen.getByRole('heading', { level: 2, name: /monthly showroom performance report/i })).toBeInTheDocument();
			expect(screen.getByLabelText(/month/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/year/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/showroom/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /generate report/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /export this showroom/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /export all showrooms/i })).toBeInTheDocument();
			expect(screen.getByText('Report Ready')).toBeInTheDocument();
			expect(screen.getByText('25')).toBeInTheDocument(); // total vehicles
			expect(screen.getByText('35')).toBeInTheDocument(); // total services
			expect(screen.getAllByText('₹45,000.00').length).toBeGreaterThan(0); // total billed
			expect(screen.getAllByText('₹40,000.00').length).toBeGreaterThan(0); // total collected
			expect(screen.getAllByText('₹5,000.00').length).toBeGreaterThan(0); // total outstanding
		});
	});

	it('filters by selected showroom via tab navigation', async () => {
		renderWithProviders(<MonthlyShowroomReportView />);

		await waitFor(() => {
			expect(screen.getByText('Report Ready')).toBeInTheDocument();
		});

		// Click on Honda Dealership sub-tab
		const hondaTab = screen.getByRole('button', { name: /honda dealership/i });
		fireEvent.click(hondaTab);

		await waitFor(() => {
			expect(screen.getByText('Honda Dealership')).toBeInTheDocument();
			expect(screen.getByText('SHR0001')).toBeInTheDocument();
		});
	});

	it('triggers Excel export for all showrooms creating multi-sheet workbook', async () => {
		renderWithProviders(<MonthlyShowroomReportView />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /export all showrooms/i })).toBeInTheDocument();
		});

		const exportAllBtn = screen.getByRole('button', { name: /export all showrooms/i });
		fireEvent.click(exportAllBtn);

		expect(XLSX.utils.book_new).toHaveBeenCalled();
		expect(XLSX.utils.book_append_sheet).toHaveBeenCalled();
		expect(XLSX.writeFile).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringMatching(/E6_Car_Spa_Honda_Dealership_Monthly_Report_September_2026\.xlsx/)
		);
		expect(XLSX.writeFile).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringMatching(/E6_Car_Spa_Skoda_Dealership_Monthly_Report_September_2026\.xlsx/)
		);
	});

	it('triggers 7-sheet Excel export for selected showroom', async () => {
		renderWithProviders(<MonthlyShowroomReportView />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /export this showroom/i })).toBeInTheDocument();
		});

		// Select Honda tab
		const hondaTab = screen.getByRole('button', { name: /honda dealership/i });
		fireEvent.click(hondaTab);

		const exportThisBtn = screen.getByRole('button', { name: /export this showroom/i });
		fireEvent.click(exportThisBtn);

		expect(XLSX.utils.book_new).toHaveBeenCalled();
		expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Executive Summary');
		expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Daily Operations');
		expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Staff Performance');
		expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Service Analysis');
		expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Vehicle Analysis');
		expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Detailed Work Log');
		expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Billing & Collections');
		expect(XLSX.writeFile).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringMatching(/E6_Car_Spa_Honda_Dealership_Monthly_Report_September_2026\.xlsx/)
		);
	});

	it('switches between Executive Summary, Daily Operations, Staff Performance, Service Analysis, Vehicle Analysis, Detailed Log, and Billing Ledger', async () => {
		renderWithProviders(<MonthlyShowroomReportView />);

		await waitFor(() => {
			expect(screen.getByText('Report Ready')).toBeInTheDocument();
		});

		// Switch to Daily Operations section
		const dailyBtn = screen.getByRole('button', { name: /2\. daily operations/i });
		fireEvent.click(dailyBtn);

		await waitFor(() => {
			expect(screen.getByText('Daily Operations Summary')).toBeInTheDocument();
		});

		// Switch to Staff Performance section
		const staffBtn = screen.getByRole('button', { name: /3\. staff performance/i });
		fireEvent.click(staffBtn);

		await waitFor(() => {
			expect(screen.getByText('Staff Workload & Performance Analysis')).toBeInTheDocument();
			expect(screen.getByText('Kavitha')).toBeInTheDocument();
			expect(screen.getByText('Ramesh')).toBeInTheDocument();
		});

		// Switch to Service Analysis section
		const servicesBtn = screen.getByRole('button', { name: /4\. service analysis/i });
		fireEvent.click(servicesBtn);

		await waitFor(() => {
			expect(screen.getByText('Service & Work Type Volume Breakdown')).toBeInTheDocument();
			expect(screen.getByText('Full Body Wash')).toBeInTheDocument();
		});

		// Switch to Vehicle Analysis section
		const vehiclesBtn = screen.getByRole('button', { name: /5\. vehicle analysis/i });
		fireEvent.click(vehiclesBtn);

		await waitFor(() => {
			expect(screen.getByText('Vehicle Type Classification Breakdown')).toBeInTheDocument();
			expect(screen.getByText('Sedan')).toBeInTheDocument();
		});

		// Switch to Detailed Work Log section
		const detailBtn = screen.getByRole('button', { name: /6\. detailed work log/i });
		fireEvent.click(detailBtn);

		await waitFor(() => {
			expect(screen.getByText('Detailed Vehicle Service Audit Log')).toBeInTheDocument();
		});

		// Switch to Billing & Collections section
		const billingBtn = screen.getByRole('button', { name: /7\. billing & collections/i });
		fireEvent.click(billingBtn);

		await waitFor(() => {
			expect(screen.getByText('Monthly Billing & Collections Ledger')).toBeInTheDocument();
		});
	});
});
