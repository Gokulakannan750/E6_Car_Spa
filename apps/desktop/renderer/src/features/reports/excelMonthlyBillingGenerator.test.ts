import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCompanyProfile, seedCompanyProfile } from '../../test/seedCompanyProfile';
import { reportCreator, reportFilePrefix, reportTitle } from '../../lib/documentBranding';
import {
	formatDateDisplay,
	formatDateTimeDisplay,
	createMonthlyBillingWorkbook,
	buildMonthlySummarySheet,
	buildDailySheet,
	generateAndDownloadMonthlyBillingReport,
	ARGB,
} from './excelMonthlyBillingGenerator';
import type { MonthlyBillingReportResponse } from '../../lib/api';
import ExcelJS from 'exceljs';

beforeEach(() => {
	seedCompanyProfile();
});

describe('excelMonthlyBillingGenerator (ExcelJS) — Executive Styling & Workbook Structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('formats date and datetime displays correctly', () => {
		expect(formatDateDisplay('2026-10-15T00:00:00Z')).toBe('15-Oct-2026');
		expect(formatDateTimeDisplay('2026-10-15T14:30:00Z')).toContain('15-Oct-2026');
	});

	it('creates Monthly Summary worksheet with executive styling, title, KPIs, and reconciliation note', () => {
		const mockSummary = {
			monthName: 'October 2026',
			startDate: '2026-10-01T00:00:00Z',
			endDate: '2026-10-31T00:00:00Z',
			generatedAt: '2026-10-31T23:59:59Z',
			totalJobCardsCreated: 45,
			totalJobCardsFinished: 42,
			totalInvoices: 40,
			totalInvoicesPaid: 35,
			totalInvoicesPendingPayment: 5,
			totalInvoicesDraft: 0,
			totalInvoicesCancelled: 0,
			totalInvoiceAmount: 75000,
			totalAmountPaid: 65000,
			totalAmountPending: 10000,
			totalServicesPerformed: 90,
			totalServiceQuantity: 95,
		};

		const workbook = new ExcelJS.Workbook();
		const ws = buildMonthlySummarySheet(workbook, mockSummary, 'October 2026', 31);
		expect(ws).toBeDefined();

		// Title cell A1
		const cellA1 = ws.getCell('A1');
		expect(cellA1.value).toBe('SUNRISE DETAILING — MONTHLY BILLING REPORT');
		expect(cellA1.font?.bold).toBe(true);
		expect(cellA1.font?.color?.argb).toBe(ARGB.WHITE);
		expect(cellA1.fill).toEqual({
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: ARGB.PRIMARY_DARK },
		});
		expect(ws.getRow(1).height).toBe(34);

		// Subtitle cell A2
		const cellA2 = ws.getCell('A2');
		expect(cellA2.value).toBe('MONTHLY EXECUTIVE SUMMARY');
		expect(cellA2.font?.bold).toBe(true);
		expect(cellA2.font?.color?.argb).toBe(ARGB.PRIMARY_DARK);
		expect(cellA2.fill).toEqual({
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: ARGB.SECONDARY_LIGHT_BLUE },
		});

		// Check Page Setup
		expect(ws.pageSetup.orientation).toBe('portrait');
		expect(ws.pageSetup.fitToWidth).toBe(1);
	});

	it('creates empty daily sheet with styled "No billing activity" banner when hasActivity is false', () => {
		const emptyDailySheet = {
			day: 1,
			date: '2026-10-01T00:00:00Z',
			dateFormatted: '01-Oct-2026',
			sheetName: '01-Oct',
			hasActivity: false,
			totals: {
				jobCardTotal: 0,
				invoiceTotal: 0,
				amountPaid: 0,
				amountPending: 0,
				jobCardCount: 0,
				invoiceCount: 0,
				serviceCount: 0,
				serviceTotalQuantity: 0,
			},
			jobCards: [],
			invoices: [],
			services: [],
		};

		const workbook = new ExcelJS.Workbook();
		const ws = buildDailySheet(workbook, emptyDailySheet, 'October 2026');
		expect(ws).toBeDefined();

		// Header checks
		expect(ws.getCell('A1').value).toContain('SUNRISE DETAILING — BILLING ACTIVITY FOR 01-OCT-2026');
		expect(ws.getCell('A7').value).toBe('No billing activity for this date.');
		expect(ws.getCell('A7').fill).toEqual({
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: ARGB.LIGHT_GRAY_FILL },
		});
	});

	it('creates active daily sheet with styled Job Cards, Invoices, and Services sections', () => {
		const activeDailySheet = {
			day: 15,
			date: '2026-10-15T00:00:00Z',
			dateFormatted: '15-Oct-2026',
			sheetName: '15-Oct',
			hasActivity: true,
			totals: {
				jobCardTotal: 5000,
				invoiceTotal: 5000,
				amountPaid: 3500,
				amountPending: 1500,
				jobCardCount: 1,
				invoiceCount: 1,
				serviceCount: 2,
				serviceTotalQuantity: 2,
			},
			jobCards: [
				{
					jobCardId: 'jc-1',
					jobCardNumber: 'JC-101',
					jobCardDate: '2026-10-15T10:00:00Z',
					customerName: 'Alice',
					vehicleRegistration: 'TN01AA1111',
					vehicle: 'Honda City',
					jobCardStatus: 'Ready',
					totalServices: 2,
					jobCardTotal: 5000,
				},
			],
			invoices: [
				{
					invoiceId: 'inv-1',
					invoiceNumber: 'INV-101',
					invoiceDate: '2026-10-15T00:00:00Z',
					jobCardNumber: 'JC-101',
					customerName: 'Alice',
					vehicleRegistration: 'TN01AA1111',
					invoiceStatus: 'PartiallyPaid',
					invoiceTotal: 5000,
					amountPaid: 3500,
					amountPending: 1500,
				},
			],
			services: [
				{
					serviceItemId: 's-1',
					jobCardNumber: 'JC-101',
					invoiceNumber: 'INV-101',
					customerName: 'Alice',
					serviceName: 'Full Wash',
					quantity: 1,
					rate: 2000,
					amount: 2000,
				},
				{
					serviceItemId: 's-2',
					jobCardNumber: 'JC-101',
					invoiceNumber: 'INV-101',
					customerName: 'Alice',
					serviceName: 'Teflon Coating',
					quantity: 1,
					rate: 3000,
					amount: 3000,
				},
			],
		};

		const workbook = new ExcelJS.Workbook();
		const ws = buildDailySheet(workbook, activeDailySheet, 'October 2026');
		expect(ws).toBeDefined();

		// Header checks
		expect(ws.getCell('A1').value).toContain('SUNRISE DETAILING — BILLING ACTIVITY FOR 15-OCT-2026');
		expect(ws.pageSetup.orientation).toBe('landscape');

		// Check all values are present in sheet
		const values: string[] = [];
		ws.eachRow((row) => {
			row.eachCell((cell) => {
				if (cell.value) values.push(String(cell.value));
			});
		});

		expect(values).toContain('SECTION 1: JOB CARDS (1 records)');
		expect(values).toContain('JC-101');
		expect(values).toContain('SECTION 2: INVOICES (1 records)');
		expect(values).toContain('INV-101');
		expect(values).toContain('SECTION 3: SERVICES (2 items)');
		expect(values).toContain('Full Wash');
		expect(values).toContain('Teflon Coating');
		expect(values).toContain('TOTAL JOB CARDS');
		expect(values).toContain('TOTAL INVOICES');
		expect(values).toContain('TOTAL SERVICES');
	});

	it('generates complete workbook with Monthly Summary and 31 daily sheets for October', () => {
		const dailySheets = Array.from({ length: 31 }, (_, i) => {
			const day = i + 1;
			const dayStr = String(day).padStart(2, '0');
			return {
				day,
				date: `2026-10-${dayStr}T00:00:00Z`,
				dateFormatted: `${dayStr}-Oct-2026`,
				sheetName: `${dayStr}-Oct`,
				hasActivity: false,
				totals: {
					jobCardTotal: 0,
					invoiceTotal: 0,
					amountPaid: 0,
					amountPending: 0,
					jobCardCount: 0,
					invoiceCount: 0,
					serviceCount: 0,
					serviceTotalQuantity: 0,
				},
				jobCards: [],
				invoices: [],
				services: [],
			};
		});

		const mockReport: MonthlyBillingReportResponse = {
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
				totalJobCardsCreated: 0,
				totalJobCardsFinished: 0,
				totalInvoices: 0,
				totalInvoicesPaid: 0,
				totalInvoicesPendingPayment: 0,
				totalInvoicesDraft: 0,
				totalInvoicesCancelled: 0,
				totalInvoiceAmount: 0,
				totalAmountPaid: 0,
				totalAmountPending: 0,
				totalServicesPerformed: 0,
				totalServiceQuantity: 0,
			},
			dailySheets,
		};

		const wb = createMonthlyBillingWorkbook(mockReport);
		// Sheet 1: Monthly Summary + 31 daily sheets = 32 sheets total
		expect(wb.worksheets.length).toBe(32);
		expect(wb.worksheets[0].name).toBe('Monthly Summary');
		expect(wb.worksheets[1].name).toBe('01-Oct');
		expect(wb.worksheets[31].name).toBe('31-Oct');
	});

	it('generates workbook buffer and creates downloadable blob in generateAndDownloadMonthlyBillingReport', async () => {
		// Mock DOM URL and createElement
		const mockClick = vi.fn();
		const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
		const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
		window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
		window.URL.revokeObjectURL = vi.fn();

		const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
			click: mockClick,
			setAttribute: vi.fn(),
		} as any);

		const mockReport: MonthlyBillingReportResponse = {
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
				totalJobCardsCreated: 0,
				totalJobCardsFinished: 0,
				totalInvoices: 0,
				totalInvoicesPaid: 0,
				totalInvoicesPendingPayment: 0,
				totalInvoicesDraft: 0,
				totalInvoicesCancelled: 0,
				totalInvoiceAmount: 0,
				totalAmountPaid: 0,
				totalAmountPending: 0,
				totalServicesPerformed: 0,
				totalServiceQuantity: 0,
			},
			dailySheets: [],
		};

		const fileName = await generateAndDownloadMonthlyBillingReport(mockReport);
		expect(fileName).toBe('Sunrise_Detailing_Billing_Report_October_2026.xlsx');
		expect(mockClick).toHaveBeenCalled();

		createElementSpy.mockRestore();
		mockAppendChild.mockRestore();
		mockRemoveChild.mockRestore();
	});
});

describe('report titles without a saved company', () => {
	it('carry no company name and no company prefix on the file', () => {
		clearCompanyProfile();
		expect(reportTitle('MONTHLY BILLING REPORT')).toBe('MONTHLY BILLING REPORT');
		expect(reportFilePrefix()).toBe('');
		expect(reportCreator()).toBe('Management Suite');
	});

	it('use the saved company name, upper-cased in titles and underscored in file names', () => {
		seedCompanyProfile('Blue Wave & Co.');
		expect(reportTitle('MONTHLY BILLING REPORT')).toBe('BLUE WAVE & CO. — MONTHLY BILLING REPORT');
		expect(reportFilePrefix()).toBe('Blue_Wave_Co_');
		expect(reportCreator()).toBe('Blue Wave & Co.');
	});
});
