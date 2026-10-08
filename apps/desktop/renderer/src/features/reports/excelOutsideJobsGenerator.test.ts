import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedCompanyProfile } from '../../test/seedCompanyProfile';
import {
	createOutsideJobsWorkbook,
	generateAndDownloadOutsideJobsReport,
	generateOutsideJobsExcel,
	formatDurationDisplay,
	ROW_HEIGHTS,
	ARGB,
	NUM_FORMATS,
} from './excelOutsideJobsGenerator';
import type { OutsideJobsReportDto } from '../../lib/api';

beforeEach(() => {
	seedCompanyProfile();
});

describe('excelOutsideJobsGenerator (ExcelJS) — Executive Styling & Workbook Structure', () => {
	const sampleReportData: OutsideJobsReportDto = {
		currentlyOutside: [
			{
				id: 'out-1',
				jobCardId: 'jc-1',
				jobCardNumber: 'JC-2026-1001',
				vehicleId: 'veh-1',
				vehicleRegistration: 'TN 33 AA 1111',
				vehicleModel: 'Toyota Innova Crysta',
				customerId: 'cust-1',
				customerName: 'Suresh Kumar',
				customerPhone: '9876543210',
				vendorId: 'ven-1',
				vendorName: 'Apex Aligners & Wheels',
				vendorPhone: '9876500001',
				serviceName: 'Wheel Alignment & Balancing',
				sentAt: '2026-10-01T09:00:00Z',
				expectedReturnAt: '2026-10-01T14:00:00Z',
				isOverdue: true,
				overdueHours: 4.5,
				vendorCost: 1500,
				notes: 'Check rear wheel camber',
			},
			{
				id: 'out-2',
				jobCardId: 'jc-2',
				jobCardNumber: 'JC-2026-1002',
				vehicleId: 'veh-2',
				vehicleRegistration: 'TN 33 BB 2222',
				vehicleModel: 'Honda City',
				customerId: 'cust-2',
				customerName: 'Anitha Raj',
				customerPhone: '9876543211',
				vendorId: 'ven-2',
				vendorName: 'Royal Dent & Paint Works',
				vendorPhone: '9876500002',
				serviceName: 'Dent Removal Left Fender',
				sentAt: '2026-10-02T10:00:00Z',
				expectedReturnAt: '2026-10-02T18:00:00Z',
				isOverdue: false,
				overdueHours: 0,
				vendorCost: 3500,
				notes: 'Colour code matches NH-797M',
			},
		],
		history: [
			{
				id: 'hist-1',
				jobCardId: 'jc-10',
				jobCardNumber: 'JC-2026-0980',
				vehicleId: 'veh-10',
				vehicleRegistration: 'TN 38 CC 3333',
				vehicleModel: 'Hyundai Creta',
				customerId: 'cust-10',
				customerName: 'Manoj Kumar',
				customerPhone: '9876543220',
				vendorId: 'ven-1',
				vendorName: 'Apex Aligners & Wheels',
				serviceName: 'Front Wheel Alignment',
				status: 2,
				statusName: 'Returned',
				sentAt: '2026-09-28T09:00:00Z',
				returnedAt: '2026-09-28T13:30:00Z',
				expectedReturnAt: '2026-09-28T14:00:00Z',
				durationHours: 4.5,
				vendorCost: 1200,
				sentByUserName: 'Ramesh (Supervisor)',
				returnedByUserName: 'Ramesh (Supervisor)',
				notes: 'Routine alignment',
				returnNotes: 'Alignment verified and test driven',
			},
			{
				id: 'hist-2',
				jobCardId: 'jc-11',
				jobCardNumber: 'JC-2026-0985',
				vehicleId: 'veh-11',
				vehicleRegistration: 'TN 33 DD 4444',
				vehicleModel: 'Mahindra XUV700',
				customerId: 'cust-11',
				customerName: 'Priya Dharshini',
				customerPhone: '9876543221',
				vendorId: 'ven-2',
				vendorName: 'Royal Dent & Paint Works',
				serviceName: 'Bumper Repaint',
				status: 2,
				statusName: 'Returned',
				sentAt: '2026-09-29T10:00:00Z',
				returnedAt: '2026-09-30T16:00:00Z',
				expectedReturnAt: '2026-09-30T15:00:00Z',
				durationHours: 30.0,
				vendorCost: 5500,
				sentByUserName: 'Kumar (Manager)',
				returnedByUserName: 'Kumar (Manager)',
				notes: 'Pearl white finish',
				returnNotes: 'Paint oven baked, perfect match',
			},
			{
				id: 'hist-3',
				jobCardId: 'jc-12',
				jobCardNumber: 'JC-2026-0990',
				vehicleId: 'veh-12',
				vehicleRegistration: 'TN 33 EE 5555',
				vehicleModel: 'Kia Seltos',
				customerId: 'cust-12',
				customerName: 'Karthik S',
				customerPhone: '9876543222',
				vendorId: 'ven-2',
				vendorName: 'Royal Dent & Paint Works',
				serviceName: 'Ceramic Coating Prep',
				status: 3,
				statusName: 'Cancelled',
				sentAt: '2026-09-30T11:00:00Z',
				returnedAt: null,
				expectedReturnAt: '2026-09-30T15:00:00Z',
				durationHours: null,
				vendorCost: 0,
				sentByUserName: 'Kumar (Manager)',
				returnedByUserName: null,
				notes: 'Customer opted for in-house polish',
				returnNotes: 'Cancelled before dispatch',
			},
		],
		vendorSummary: [
			{
				vendorId: 'ven-1',
				vendorName: 'Apex Aligners & Wheels',
				phone: '9876500001',
				totalJobs: 2,
				completedJobs: 1,
				currentlyOutside: 1,
				overdueJobs: 1,
				cancelledJobs: 0,
				totalVendorCost: 2700,
			},
			{
				vendorId: 'ven-2',
				vendorName: 'Royal Dent & Paint Works',
				phone: '9876500002',
				totalJobs: 3,
				completedJobs: 1,
				currentlyOutside: 1,
				overdueJobs: 0,
				cancelledJobs: 1,
				totalVendorCost: 9000,
			},
		],
		totalOutsideCount: 2,
		totalOverdueCount: 1,
		totalActiveCost: 5000,
		totalHistoricalCost: 6700,
	};

	it('creates all 4 standard worksheets with correct names and order', () => {
		const wb = createOutsideJobsWorkbook(sampleReportData, 'September 2026');
		expect(wb.worksheets.length).toBe(4);

		const sheetNames = wb.worksheets.map(w => w.name);
		expect(sheetNames).toEqual([
			'Executive Summary',
			'Currently Outside',
			'Movement History',
			'Vendor Analysis',
		]);
	});

	it('formats Sheet 1 (Executive Summary) with corporate navy title, KPI matrix, and vendor breakdown', () => {
		const wb = createOutsideJobsWorkbook(sampleReportData, 'September 2026');
		const ws = wb.getWorksheet('Executive Summary');
		expect(ws).toBeDefined();

		// Check Title Block
		const r1 = ws!.getRow(1);
		expect(r1.height).toBe(ROW_HEIGHTS.TITLE);
		const cellA1 = ws!.getCell('A1');
		expect(cellA1.value).toContain('SUNRISE DETAILING — OUTSIDE JOBS & EXTERNAL MOVEMENTS REPORT');
		expect(cellA1.fill?.type).toBe('pattern');
		if (cellA1.fill?.type === 'pattern') {
			expect(cellA1.fill.fgColor?.argb).toBe(ARGB.PRIMARY_DARK);
		}

		// Check Subtitle Block
		const r2 = ws!.getRow(2);
		expect(r2.height).toBe(ROW_HEIGHTS.SUBTITLE);
		const cellA2 = ws!.getCell('A2');
		expect(cellA2.value).toContain('September 2026');
		if (cellA2.fill?.type === 'pattern') {
			expect(cellA2.fill.fgColor?.argb).toBe(ARGB.SECONDARY_LIGHT_BLUE);
		}

		// Check KPI section
		const cellKpiHdr = ws!.getCell('A4');
		expect(cellKpiHdr.value).toContain('KEY PERFORMANCE INDICATORS');

		// Check Vendor Summary Table
		const vendorHdrRow = ws!.getRow(11);
		expect(vendorHdrRow).toBeDefined();
	});

	it('formats Sheet 2 (Currently Outside) with 15 columns, overdue badge highlights, and total row', () => {
		const wb = createOutsideJobsWorkbook(sampleReportData, 'September 2026');
		const ws = wb.getWorksheet('Currently Outside');
		expect(ws).toBeDefined();

		// Check row 4 Table Headers
		const r4 = ws!.getRow(4);
		expect(r4.height).toBe(ROW_HEIGHTS.TABLE_HEADER);
		expect(ws!.getCell('A4').value).toBe('S.No');
		expect(ws!.getCell('B4').value).toBe('Status');
		expect(ws!.getCell('C4').value).toBe('Job Card #');
		expect(ws!.getCell('D4').value).toBe('Vehicle Reg #');
		expect(ws!.getCell('N4').value).toBe('Estimated Cost (₹)');

		// First active row (Overdue job)
		const r5 = ws!.getRow(5);
		expect(r5.height).toBe(ROW_HEIGHTS.DATA_ROW);
		const statusCell = ws!.getCell('B5');
		expect(statusCell.value).toBe('OVERDUE');
		if (statusCell.fill?.type === 'pattern') {
			expect(statusCell.fill.fgColor?.argb).toBe(ARGB.DANGER_LIGHT_RED);
		}

		// Second active row (Outside job)
		const r6 = ws!.getRow(6);
		expect(r6.height).toBe(ROW_HEIGHTS.DATA_ROW);
		const statusCell2 = ws!.getCell('B6');
		expect(statusCell2.value).toBe('Outside');
		if (statusCell2.fill?.type === 'pattern') {
			expect(statusCell2.fill.fgColor?.argb).toBe(ARGB.WARNING_LIGHT_ORANGE);
		}

		// Total Row
		const totalRow = ws!.getRow(7);
		expect(totalRow.height).toBe(ROW_HEIGHTS.TOTAL_ROW);
		expect(ws!.getCell('A7').value).toContain('Total Active Outside Vehicles (2)');
		expect(ws!.getCell('N7').value).toBe(5000); // 1500 + 3500
		expect(ws!.getCell('N7').numFmt).toBe(NUM_FORMATS.CURRENCY);
	});

	it('formats Sheet 3 (Movement History) with 17 columns, cost types, duration, and grand total', () => {
		const wb = createOutsideJobsWorkbook(sampleReportData, 'September 2026');
		const ws = wb.getWorksheet('Movement History');
		expect(ws).toBeDefined();

		// Header Row
		expect(ws!.getRow(4).height).toBe(ROW_HEIGHTS.TABLE_HEADER);
		expect(ws!.getCell('A4').value).toBe('S.No');
		expect(ws!.getCell('B4').value).toBe('Status');
		expect(ws!.getCell('L4').value).toBe('Cost Type');
		expect(ws!.getCell('M4').value).toBe('Vendor Cost (₹)');

		// Row 5: Returned job
		const r5 = ws!.getRow(5);
		expect(r5.height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(ws!.getCell('B5').value).toBe('Returned');
		expect(ws!.getCell('L5').value).toBe('Final Cost');
		expect(ws!.getCell('M5').value).toBe(1200);

		// Row 7: Cancelled job
		const r7 = ws!.getRow(7);
		expect(r7.height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(ws!.getCell('B7').value).toBe('Cancelled');
		expect(ws!.getCell('L7').value).toBe('—');
		expect(ws!.getCell('M7').value).toBe(0);

		// Grand Total Row (Row 8)
		const rTot = ws!.getRow(8);
		expect(rTot.height).toBe(ROW_HEIGHTS.TOTAL_ROW);
		expect(ws!.getCell('A8').value).toContain('Total Recorded Movements (3)');
		expect(ws!.getCell('M8').value).toBe(6700); // 1200 + 5500 + 0
	});

	it('formats Sheet 4 (Vendor Analysis) with completion rate %, workload distribution, and cost share %', () => {
		const wb = createOutsideJobsWorkbook(sampleReportData, 'September 2026');
		const ws = wb.getWorksheet('Vendor Analysis');
		expect(ws).toBeDefined();

		// Table Headers
		expect(ws!.getRow(4).height).toBe(ROW_HEIGHTS.TABLE_HEADER);
		expect(ws!.getCell('B4').value).toBe('Vendor Name');
		expect(ws!.getCell('D4').value).toBe('Total Jobs Assigned');
		expect(ws!.getCell('I4').value).toBe('Completion Rate %');
		expect(ws!.getCell('J4').value).toBe('Total Cost (₹)');
		expect(ws!.getCell('K4').value).toBe('Cost Share %');

		// Row 5: Apex Aligners (2 jobs, 1 completed -> 50% rate, cost 2700 / 11700 = ~23.07%)
		const r5 = ws!.getRow(5);
		expect(r5.height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(ws!.getCell('B5').value).toBe('Apex Aligners & Wheels');
		expect(ws!.getCell('D5').value).toBe(2);
		expect(ws!.getCell('I5').value).toBe(0.5);
		expect(ws!.getCell('I5').numFmt).toBe(NUM_FORMATS.PERCENT);
		expect(ws!.getCell('J5').value).toBe(2700);

		// Grand Total Row (Row 7)
		const rTot = ws!.getRow(7);
		expect(rTot.height).toBe(ROW_HEIGHTS.TOTAL_ROW);
		expect(ws!.getCell('A7').value).toBe('Total All Vendors');
		expect(ws!.getCell('D7').value).toBe(5); // 2 + 3
		expect(ws!.getCell('J7').value).toBe(11700); // 2700 + 9000
		expect(ws!.getCell('K7').value).toBe(1.0); // 100.0%
	});

	it('handles empty states cleanly without throwing errors', () => {
		const emptyReportData: OutsideJobsReportDto = {
			currentlyOutside: [],
			history: [],
			vendorSummary: [],
			totalOutsideCount: 0,
			totalOverdueCount: 0,
			totalActiveCost: 0,
			totalHistoricalCost: 0,
		};

		const wb = createOutsideJobsWorkbook(emptyReportData, 'Custom Range');
		expect(wb.worksheets.length).toBe(4);

		const wsActive = wb.getWorksheet('Currently Outside');
		expect(wsActive).toBeDefined();
		const emptyActiveCell = wsActive!.getCell('A5');
		expect(emptyActiveCell.value).toContain('All Vehicles in Showroom');

		const wsHist = wb.getWorksheet('Movement History');
		expect(wsHist).toBeDefined();
		const emptyHistCell = wsHist!.getCell('A5');
		expect(emptyHistCell.value).toContain('No external vehicle movements recorded');

		const wsVendor = wb.getWorksheet('Vendor Analysis');
		expect(wsVendor).toBeDefined();
		const emptyVendorCell = wsVendor!.getCell('A5');
		expect(emptyVendorCell.value).toContain('No vendor operational data available');
	});

	it('formats duration correctly with formatDurationDisplay helper', () => {
		expect(formatDurationDisplay(null)).toBe('—');
		expect(formatDurationDisplay(undefined)).toBe('—');
		expect(formatDurationDisplay(0.5)).toBe('30m');
		expect(formatDurationDisplay(1.0)).toBe('1h');
		expect(formatDurationDisplay(2.5)).toBe('2h 30m');
		expect(formatDurationDisplay(24)).toBe('24h');
	});

	it('exports downloadable workbook buffer via generateAndDownloadOutsideJobsReport and alias', async () => {
		// Mock DOM download APIs
		const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
		const mockRevokeObjectURL = vi.fn();
		window.URL.createObjectURL = mockCreateObjectURL;
		window.URL.revokeObjectURL = mockRevokeObjectURL;

		const appendSpy = vi.spyOn(document.body, 'appendChild');
		const removeSpy = vi.spyOn(document.body, 'removeChild');

		const fileName = await generateAndDownloadOutsideJobsReport(sampleReportData, 'September 2026');
		expect(fileName).toContain('Sunrise_Detailing_Outside_Jobs_Report');
		expect(mockCreateObjectURL).toHaveBeenCalled();
		expect(appendSpy).toHaveBeenCalled();
		expect(removeSpy).toHaveBeenCalled();
		expect(mockRevokeObjectURL).toHaveBeenCalled();

		// Test alias
		const aliasFileName = await generateOutsideJobsExcel(sampleReportData, 'September 2026');
		expect(aliasFileName).toContain('Sunrise_Detailing_Outside_Jobs_Report');
	});
});
