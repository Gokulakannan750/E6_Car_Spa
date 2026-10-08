import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedCompanyProfile } from '../../test/seedCompanyProfile';
import {
	exportSingleShowroomWorkbook,
	generateExecutiveSummaryWorksheet,
	generateAndDownloadMonthlyShowroomReport,
	ROW_HEIGHTS,
	ARGB,
	sanitizeSheetName,
} from './excelMonthlyShowroomGenerator';
import type {
	MonthlyShowroomReportResponse,
	MonthlyShowroomDetailDto,
} from '../../lib/api';
import ExcelJS from 'exceljs';

beforeEach(() => {
	seedCompanyProfile();
});

describe('excelMonthlyShowroomGenerator (ExcelJS) — 7-Sheet Executive Styling & Formatting Parity', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const mockHondaShowroom: MonthlyShowroomDetailDto = {
		showroomId: 'sr-1',
		showroomMasterId: 'SHR0001',
		showroomName: 'Honda Dealership',
		showroomAddress: '123 Auto St, Chennai',
		showroomPhone: '+91 9876543210',
		showroomGstin: '33AAAAA0000A1Z5',
		summary: {
			totalVehiclesServiced: 15,
			totalWorkEntries: 10,
			totalServicesPerformed: 25,
			totalActiveStaff: 3,
			totalBilledAmount: 35000,
			totalCollectedAmount: 30000,
			totalOutstandingAmount: 5000,
			totalBillingDays: 10,
			paidDaysCount: 8,
			partiallyPaidDaysCount: 2,
			unpaidDaysCount: 0,
			totalStaffHours: 90.0,
			totalAttendanceDays: 10,
			totalSwaps: 2,
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
				staffPhone: '+91 9876543210',
				staffRole: 'Senior Technician',
				homeShowroomName: 'Honda Dealership',
				homeShowroomMasterId: 'SHR0001',
				assignmentType: 'Regular',
				sessionType: 'FullDay',
				startTime: '09:00',
				endTime: '18:00',
				workingHours: 9.0,
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
				notes: 'VIP customer cars',
				dailyBilledAmount: 3500,
				dailyCollectedAmount: 3500,
				paymentStatus: 'Paid',
				swapId: undefined,
				originalStaffName: undefined,
				replacementStaffName: undefined,
				serviceCategory: 'Washing',
			},
			{
				id: 'work-2',
				date: '2026-09-16T00:00:00Z',
				showroomId: 'sr-1',
				showroomMasterId: 'SHR0001',
				showroomName: 'Honda Dealership',
				staffId: 'staff-2',
				staffMasterId: 'ST002B',
				staffName: 'Ramesh',
				staffPhone: '+91 9876543211',
				staffRole: 'Detailer',
				homeShowroomName: 'Skoda Dealership',
				homeShowroomMasterId: 'SHR0002',
				assignmentType: 'Swapped',
				sessionType: 'FullDay',
				startTime: '09:00',
				endTime: '18:00',
				workingHours: 9.0,
				vehicleTypeId: 'vt-2',
				vehicleTypeCode: 'SUV',
				vehicleTypeName: 'Compact SUV',
				vehicleQuantity: 1,
				servicesSummary: 'Teflon Polish (1)',
				serviceItems: [
					{ workTypeId: 'wt-3', workTypeCode: 'POLISH', workTypeName: 'Teflon Polish', quantity: 1, notes: null },
				],
				timeRecorded: '02:00 PM',
				notes: 'Coverage for Suresh',
				dailyBilledAmount: 4000,
				dailyCollectedAmount: 2000,
				paymentStatus: 'PartiallyPaid',
				swapId: 'SWP-202609-001',
				originalStaffName: 'Suresh',
				replacementStaffName: 'Ramesh',
				serviceCategory: 'Detailing',
			},
		],
		dailyBills: [
			{
				id: 'bill-1',
				date: '2026-09-15T00:00:00Z',
				amount: 3500,
				paidAmount: 3500,
				balanceAmount: 0,
				status: 'Paid',
				paymentCount: 1,
				notes: 'Settled via Bank Transfer',
			},
			{
				id: 'bill-2',
				date: '2026-09-16T00:00:00Z',
				amount: 4000,
				paidAmount: 2000,
				balanceAmount: 2000,
				status: 'PartiallyPaid',
				paymentCount: 1,
				notes: 'Balance pending',
			},
		],
		attendanceRecords: [
			{
				date: '2026-09-15T00:00:00Z',
				staffId: 'staff-1',
				staffMasterId: 'ST001A',
				staffName: 'Kavitha',
				role: 'Senior Technician',
				homeShowroomName: 'Honda Dealership',
				workingShowroomName: 'Honda Dealership',
				attendanceStatus: 'Present',
				scheduledStart: '09:00',
				scheduledEnd: '18:00',
				scheduledHours: 9.0,
				actualHours: 9.0,
				confirmationStatus: 'Confirmed',
				confirmedByName: 'Branch Manager',
				confirmedAt: '2026-09-15T18:30:00Z',
			},
		],
		swaps: [
			{
				swapId: 'SWP-202609-001',
				date: '2026-09-16T00:00:00Z',
				showroomName: 'Honda Dealership',
				staffAId: 'staff-3',
				staffAMasterId: 'ST003C',
				staffAName: 'Suresh',
				staffBId: 'staff-2',
				staffBMasterId: 'ST002B',
				staffBName: 'Ramesh',
				originalWorkingTime: '09:00–18:00',
				replacementWorkingTime: '09:00–18:00',
				swapStartTime: '09:00',
				swapEndTime: '18:00',
				swapHours: 9.0,
				reason: 'Medical Leave Coverage',
				notes: 'Approved by Regional Ops',
				createdByName: 'Ops Supervisor',
				createdAt: '2026-09-15T16:00:00Z',
				status: 'Active',
				reversedByName: null,
				reversedAt: null,
				reversalReason: null,
			},
		],
		vehicleTypeSummary: [
			{
				vehicleTypeId: 'vt-1',
				vehicleTypeCode: 'SEDAN',
				vehicleTypeName: 'Sedan',
				totalVehicles: 10,
				totalServices: 15,
				totalStaffHours: 60.0,
				sharePercentage: 66.7,
			},
			{
				vehicleTypeId: 'vt-2',
				vehicleTypeCode: 'SUV',
				vehicleTypeName: 'Compact SUV',
				totalVehicles: 5,
				totalServices: 10,
				totalStaffHours: 30.0,
				sharePercentage: 33.3,
			},
		],
		serviceSummary: [
			{
				workTypeId: 'wt-1',
				serviceCategory: 'Washing',
				serviceCode: 'WASH',
				serviceName: 'Full Body Wash',
				totalVehicles: 10,
				totalQuantity: 15,
				totalStaffHours: 7.5,
				sharePercentage: 60.0,
			},
			{
				workTypeId: 'wt-3',
				serviceCategory: 'Detailing',
				serviceCode: 'POLISH',
				serviceName: 'Teflon Polish',
				totalVehicles: 5,
				totalQuantity: 10,
				totalStaffHours: 5.0,
				sharePercentage: 40.0,
			},
		],
		staffSummary: [
			{
				staffId: 'staff-1',
				staffMasterId: 'ST001A',
				staffName: 'Kavitha',
				role: 'Senior Technician',
				homeShowroom: 'Honda Dealership',
				assignmentType: 'Regular',
				totalVehicles: 10,
				totalServices: 15,
				totalHours: 60.0,
				attendanceDays: 7,
				workloadSharePercent: 66.7,
			},
			{
				staffId: 'staff-2',
				staffMasterId: 'ST002B',
				staffName: 'Ramesh',
				role: 'Detailer',
				homeShowroom: 'Skoda Dealership',
				assignmentType: 'Swapped',
				totalVehicles: 5,
				totalServices: 10,
				totalHours: 30.0,
				attendanceDays: 3,
				workloadSharePercent: 33.3,
			},
		],
	};

	const mockReportResponse: MonthlyShowroomReportResponse = {
		year: 2026,
		month: 9,
		monthName: 'September 2026',
		fromDate: '2026-09-01T00:00:00Z',
		toDate: '2026-09-30T23:59:59Z',
		overallSummary: {
			totalShowrooms: 1,
			totalVehiclesServiced: 15,
			totalWorkEntries: 10,
			totalServicesPerformed: 25,
			totalBilledAmount: 35000,
			totalCollectedAmount: 30000,
			totalOutstandingAmount: 5000,
			totalStaffHours: 90.0,
			totalAttendanceDays: 10,
			totalSwaps: 1,
		},
		showrooms: [mockHondaShowroom],
	};

	it('sanitizes sheet names properly', () => {
		const used = new Set<string>();
		expect(sanitizeSheetName('Honda/Dealership:North', used)).toBe('HondaDealershipNorth');
		expect(sanitizeSheetName('Honda/Dealership:North', used)).toBe('HondaDealershipNorth_1');
	});

	it('creates complete 7-sheet workbook with exact sheet names and sequence', () => {
		const wb = exportSingleShowroomWorkbook(mockHondaShowroom, mockReportResponse);
		expect(wb.worksheets).toHaveLength(7);

		const sheetNames = wb.worksheets.map((ws) => ws.name);
		expect(sheetNames).toEqual([
			'Summary',
			'Vehicle Service Details',
			'Staff Productivity',
			'Attendance',
			'Staff Swaps',
			'Vehicle Type Summary',
			'Service Summary',
		]);
	});

	it('applies executive visual formatting parity to Sheet 1: Summary', () => {
		const wb = new ExcelJS.Workbook();
		const ws = generateExecutiveSummaryWorksheet(wb, mockHondaShowroom, 'September 2026', '2026-09-01', '2026-09-30');

		expect(ws.name).toBe('Summary');
		expect(ws.properties.defaultRowHeight).toBe(ROW_HEIGHTS.DATA_ROW);

		// Title formatting
		const titleCell = ws.getCell('A1');
		expect(titleCell.value).toBe('SUNRISE DETAILING — SHOWROOM MANAGEMENT REPORT');
		expect(titleCell.font?.bold).toBe(true);
		expect(titleCell.font?.color?.argb).toBe(ARGB.WHITE);
		expect(titleCell.fill).toEqual({
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: ARGB.PRIMARY_DARK },
		});
		expect(ws.getRow(1).height).toBe(ROW_HEIGHTS.TITLE);

		// Subtitle formatting
		const subCell = ws.getCell('A2');
		expect(subCell.value).toContain('EXECUTIVE SUMMARY: HONDA DEALERSHIP');
		expect(subCell.font?.bold).toBe(true);
		expect(subCell.font?.color?.argb).toBe(ARGB.PRIMARY_DARK);
		expect(ws.getRow(2).height).toBe(ROW_HEIGHTS.SUBTITLE);
	});

	it('enforces standardized row heights consistently across every worksheet and every row', () => {
		const wb = exportSingleShowroomWorkbook(mockHondaShowroom, mockReportResponse);
		const validHeights = new Set<number>([
			ROW_HEIGHTS.TITLE,          // 30
			ROW_HEIGHTS.SUBTITLE,       // 22
			ROW_HEIGHTS.SECTION_HEADER, // 24
			ROW_HEIGHTS.TABLE_HEADER,   // 22
			ROW_HEIGHTS.DATA_ROW,       // 21
			ROW_HEIGHTS.TOTAL_ROW,      // 22
			ROW_HEIGHTS.SPACER,         // 10
		]);

		for (const ws of wb.worksheets) {
			expect(ws.properties.defaultRowHeight).toBe(ROW_HEIGHTS.DATA_ROW);
			expect(ws.getRow(1).height).toBe(ROW_HEIGHTS.TITLE);
			expect(ws.getRow(2).height).toBe(ROW_HEIGHTS.SUBTITLE);

			ws.eachRow((row) => {
				expect(row.height).toBeDefined();
				expect(validHeights.has(row.height!)).toBe(true);
			});
		}
	});

	it('applies freeze panes to granular detail sheets for smooth navigation', () => {
		const wb = exportSingleShowroomWorkbook(mockHondaShowroom, mockReportResponse);

		const detailWs = wb.getWorksheet('Vehicle Service Details')!;
		expect(detailWs.views[0].state).toBe('frozen');
		expect((detailWs.views[0] as ExcelJS.WorksheetViewFrozen).ySplit).toBe(4);

		const staffWs = wb.getWorksheet('Staff Productivity')!;
		expect(staffWs.views[0].state).toBe('frozen');
		expect((staffWs.views[0] as ExcelJS.WorksheetViewFrozen).ySplit).toBe(4);

		const attWs = wb.getWorksheet('Attendance')!;
		expect(attWs.views[0].state).toBe('frozen');
		expect((attWs.views[0] as ExcelJS.WorksheetViewFrozen).ySplit).toBe(4);

		const swapWs = wb.getWorksheet('Staff Swaps')!;
		expect(swapWs.views[0].state).toBe('frozen');
		expect((swapWs.views[0] as ExcelJS.WorksheetViewFrozen).ySplit).toBe(4);
	});

	it('generates real workbook buffer and loads without corruption', async () => {
		const wb = exportSingleShowroomWorkbook(mockHondaShowroom, mockReportResponse);
		const buffer = await wb.xlsx.writeBuffer();

		expect(buffer).toBeDefined();
		expect(buffer.byteLength).toBeGreaterThan(5000);

		// Re-read into fresh ExcelJS Workbook
		const loadedWb = new ExcelJS.Workbook();
		await loadedWb.xlsx.load(buffer as any);

		expect(loadedWb.worksheets).toHaveLength(7);
		expect(loadedWb.worksheets[0].name).toBe('Summary');
		expect(loadedWb.worksheets[1].name).toBe('Vehicle Service Details');
		expect(loadedWb.worksheets[2].name).toBe('Staff Productivity');
		expect(loadedWb.worksheets[3].name).toBe('Attendance');
		expect(loadedWb.worksheets[4].name).toBe('Staff Swaps');
		expect(loadedWb.worksheets[5].name).toBe('Vehicle Type Summary');
		expect(loadedWb.worksheets[6].name).toBe('Service Summary');

		const summaryWs = loadedWb.getWorksheet('Summary')!;
		expect(summaryWs.getCell('A1').value).toBe('SUNRISE DETAILING — SHOWROOM MANAGEMENT REPORT');
	});

	it('handles empty showroom records gracefully across all 7 sheets without crashing', () => {
		const emptyShowroom: MonthlyShowroomDetailDto = {
			showroomId: 'sr-empty',
			showroomMasterId: 'SHR0099',
			showroomName: 'Empty Showroom',
			showroomAddress: 'Nowhere',
			showroomPhone: null,
			showroomGstin: null,
			summary: {
				totalVehiclesServiced: 0,
				totalWorkEntries: 0,
				totalServicesPerformed: 0,
				totalActiveStaff: 0,
				totalBilledAmount: 0,
				totalCollectedAmount: 0,
				totalOutstandingAmount: 0,
				totalBillingDays: 0,
				paidDaysCount: 0,
				partiallyPaidDaysCount: 0,
				unpaidDaysCount: 0,
				totalStaffHours: 0,
				totalAttendanceDays: 0,
				totalSwaps: 0,
			},
			vehicleWorks: [],
			dailyBills: [],
			attendanceRecords: [],
			swaps: [],
			vehicleTypeSummary: [],
			serviceSummary: [],
			staffSummary: [],
		};

		const emptyReport: MonthlyShowroomReportResponse = {
			year: 2026,
			month: 1,
			monthName: 'January 2026',
			fromDate: '2026-01-01T00:00:00Z',
			toDate: '2026-01-31T23:59:59Z',
			overallSummary: {
				totalShowrooms: 1,
				totalVehiclesServiced: 0,
				totalWorkEntries: 0,
				totalServicesPerformed: 0,
				totalBilledAmount: 0,
				totalCollectedAmount: 0,
				totalOutstandingAmount: 0,
				totalStaffHours: 0,
				totalAttendanceDays: 0,
				totalSwaps: 0,
			},
			showrooms: [emptyShowroom],
		};

		const wb = exportSingleShowroomWorkbook(emptyShowroom, emptyReport);
		expect(wb.worksheets).toHaveLength(7);
		for (const ws of wb.worksheets) {
			expect(ws.properties.defaultRowHeight).toBe(ROW_HEIGHTS.DATA_ROW);
		}
	});

	it('triggers browser download in generateAndDownloadMonthlyShowroomReport', async () => {
		const mockClick = vi.fn();
		const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
		const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
		window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
		window.URL.revokeObjectURL = vi.fn();

		const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
			click: mockClick,
			setAttribute: vi.fn(),
		} as any);

		await generateAndDownloadMonthlyShowroomReport(mockReportResponse, 'selected', 'sr-1');

		expect(window.URL.createObjectURL).toHaveBeenCalled();
		expect(mockClick).toHaveBeenCalled();
		expect(mockAppendChild).toHaveBeenCalled();
		expect(mockRemoveChild).toHaveBeenCalled();
		expect(window.URL.revokeObjectURL).toHaveBeenCalled();

		createElementSpy.mockRestore();
		mockAppendChild.mockRestore();
		mockRemoveChild.mockRestore();
	});
});
