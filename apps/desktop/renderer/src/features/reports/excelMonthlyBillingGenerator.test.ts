import { describe, it, expect, vi, beforeEach } from 'vitest';
import XLSX from 'xlsx-js-style';
import {
	formatDateDisplay,
	formatDateTimeDisplay,
	generateMonthlySummaryWorksheet,
	generateDailySheetWorksheet,
	generateMonthlyBillingWorkbook,
	generateAndDownloadMonthlyBillingReport,
} from './excelMonthlyBillingGenerator';
import type { MonthlyBillingReportResponse } from '../../lib/api';

vi.mock('xlsx-js-style', async (importOriginal) => {
	const actual = await importOriginal<any>();
	return {
		...actual,
		writeFile: vi.fn(),
	};
});

describe('excelMonthlyBillingGenerator — Professional Styling & Workbook Structure', () => {
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

		const ws = generateMonthlySummaryWorksheet(mockSummary, 'October 2026', 31);
		expect(ws).toBeDefined();

		// Title cell A1
		expect(ws['A1']).toBeDefined();
		expect(ws['A1'].v).toBe('E6 CAR SPA — MONTHLY BILLING REPORT');
		expect(ws['A1'].s?.fill?.fgColor?.rgb).toBe('0B3A6E');
		expect(ws['A1'].s?.font?.color?.rgb).toBe('FFFFFF');
		expect(ws['A1'].s?.font?.sz).toBe(16);

		// Subtitle cell A2
		expect(ws['A2']).toBeDefined();
		expect(ws['A2'].v).toBe('MONTHLY EXECUTIVE SUMMARY');
		expect(ws['A2'].s?.fill?.fgColor?.rgb).toBe('EAF2FF');

		// Merges and formatting
		expect(ws['!merges']).toBeDefined();
		expect(ws['!merges']?.length).toBeGreaterThan(5);
		expect(ws['!rows']).toBeDefined();
		expect(ws['!cols']).toBeDefined();
		expect(ws['!pageSetup']?.orientation).toBe('portrait');
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

		const ws = generateDailySheetWorksheet(emptyDailySheet, 'October 2026');
		expect(ws).toBeDefined();
		expect(ws['A1']?.v).toContain('E6 CAR SPA — BILLING ACTIVITY FOR 01-OCT-2026');
		expect(ws['A7']?.v).toBe('No billing activity for this date.');
		expect(ws['A7']?.s?.fill?.fgColor?.rgb).toBe('F3F4F6');
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

		const ws = generateDailySheetWorksheet(activeDailySheet, 'October 2026');
		expect(ws).toBeDefined();

		// Header checks
		expect(ws['A1']?.v).toContain('E6 CAR SPA — BILLING ACTIVITY FOR 15-OCT-2026');
		expect(ws['!pageSetup']?.orientation).toBe('landscape');

		// Check values exist across the sheet cells
		const cellValues = Object.keys(ws)
			.filter((k) => !k.startsWith('!'))
			.map((k) => ws[k].v);

		expect(cellValues).toContain('SECTION 1: JOB CARDS (1 records)');
		expect(cellValues).toContain('JC-101');
		expect(cellValues).toContain('SECTION 2: INVOICES (1 records)');
		expect(cellValues).toContain('INV-101');
		expect(cellValues).toContain('SECTION 3: SERVICES (2 items)');
		expect(cellValues).toContain('Full Wash');
		expect(cellValues).toContain('Teflon Coating');
		expect(cellValues).toContain('TOTAL JOB CARDS');
		expect(cellValues).toContain('TOTAL INVOICES');
		expect(cellValues).toContain('TOTAL SERVICES');
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

		const wb = generateMonthlyBillingWorkbook(mockReport);
		// Sheet 1: Monthly Summary + 31 daily sheets = 32 sheets total
		expect(wb.SheetNames.length).toBe(32);
		expect(wb.SheetNames[0]).toBe('Monthly Summary');
		expect(wb.SheetNames[1]).toBe('01-Oct');
		expect(wb.SheetNames[31]).toBe('31-Oct');
	});

	it('triggers XLSX.writeFile with correct file name in generateAndDownloadMonthlyBillingReport', () => {
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

		const fileName = generateAndDownloadMonthlyBillingReport(mockReport);
		expect(fileName).toBe('E6_Car_Spa_Billing_Report_October_2026.xlsx');
		expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'E6_Car_Spa_Billing_Report_October_2026.xlsx');
	});
});

