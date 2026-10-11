import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../../lib/api';
import {
	buildFinancialSheet,
	collectionsSheet,
	fetchAllRows,
	gstSheet,
	invoiceStatusLabel,
	jobCardsSheet,
	outstandingSheet,
	salesSheet,
} from './financialReports';
import { financialReportFileName, createFinancialWorkbook } from './excelFinancialReportGenerator';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getSalesReport: vi.fn(),
		getPaymentCollectionReport: vi.fn(),
		getOutstandingInvoicesReport: vi.fn(),
		getGstReport: vi.fn(),
		getJobCardReport: vi.fn(),
	};
});

const period = { fromDate: '2026-10-01', toDate: '2026-10-31', label: 'This Month' };

const salesRow = (n: number): api.SalesReportRowDto => ({
	invoiceId: `i${n}`,
	invoiceNumber: `INV-${n}`,
	invoiceDate: '2026-10-05T10:00:00Z',
	customerName: 'Priya Sharma',
	customerPhone: '9840123456',
	registrationNumber: 'TN01AB1234',
	subtotal: 1000,
	discount: 100,
	gst: 162,
	totalAmount: 1062,
	paidAmount: 500,
	balanceAmount: 562,
	status: 3,
});

const salesSummary: api.SalesReportSummaryDto = {
	totalSubtotal: 2000,
	totalDiscount: 200,
	totalGst: 324,
	totalAmount: 2124,
	totalPaid: 1000,
	totalBalance: 1124,
	invoiceCount: 2,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('invoiceStatusLabel', () => {
	it('reads the numbers the server sends', () => {
		expect(invoiceStatusLabel(0)).toBe('Draft');
		expect(invoiceStatusLabel(2)).toBe('Paid');
		expect(invoiceStatusLabel(3)).toBe('Partially Paid');
		expect(invoiceStatusLabel(6)).toBe('Payment Pending');
	});

	it('reads names, numeric text and missing values', () => {
		expect(invoiceStatusLabel('Generated')).toBe('Payment Pending');
		expect(invoiceStatusLabel('PartiallyPaid')).toBe('Partially Paid');
		expect(invoiceStatusLabel('4' as unknown as api.InvoiceStatus)).toBe('Cancelled');
		expect(invoiceStatusLabel(null)).toBe('—');
		expect(invoiceStatusLabel(99)).toBe('Status 99');
	});
});

describe('fetchAllRows', () => {
	it('keeps asking for pages until it has every row', async () => {
		const pages = [
			{ items: [1, 2], totalCount: 5, page: 1, pageSize: 100, summary: 'a' },
			{ items: [3, 4], totalCount: 5, page: 2, pageSize: 100, summary: 'b' },
			{ items: [5], totalCount: 5, page: 3, pageSize: 100, summary: 'c' },
		];
		const asked: number[] = [];
		const result = await fetchAllRows(async (page, size) => {
			asked.push(page);
			expect(size).toBe(100);
			return pages[page - 1];
		});

		expect(asked).toEqual([1, 2, 3]);
		expect(result.rows).toEqual([1, 2, 3, 4, 5]);
		expect(result.summary).toBe('c');
	});

	it('stops at once for an empty report', async () => {
		const fetchPage = vi.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 100, summary: 's' }));
		const result = await fetchAllRows(fetchPage);
		expect(fetchPage).toHaveBeenCalledTimes(1);
		expect(result.rows).toEqual([]);
	});

	it('does not loop forever if the server keeps saying there is more', async () => {
		const fetchPage = vi.fn(async () => ({ items: [], totalCount: 999, page: 1, pageSize: 100, summary: 's' }));
		await fetchAllRows(fetchPage);
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});
});

describe('sheets', () => {
	it('sales: one line for each invoice, a totals line, and money as numbers', () => {
		const sheet = salesSheet({ rows: [salesRow(1), salesRow(2)], summary: salesSummary }, period);

		expect(sheet.sheetName).toBe('Sales');
		expect(sheet.headers).toHaveLength(12);
		expect(sheet.rows).toHaveLength(2);
		expect(sheet.rows[0][0]).toBe('INV-1');
		expect(sheet.rows[0][5]).toBe(1000);
		expect(sheet.rows[0][11]).toBe('Partially Paid');
		expect(sheet.totals?.[8]).toBe(2124);
		expect(sheet.subtitle).toContain('This Month');
		expect(sheet.subtitle).toContain('2026-10-01 to 2026-10-31');
	});

	it('collections: marks voided payments and totals the collected amount', () => {
		const sheet = collectionsSheet(
			{
				rows: [
					{ paymentId: 'p1', invoiceId: 'i1', invoiceNumber: 'INV-1', customerName: 'A', paymentDate: '2026-10-02T00:00:00Z', paymentMethod: 'UPI', reference: 'TXN1', amount: 500, isVoided: false },
					{ paymentId: 'p2', invoiceId: 'i2', invoiceNumber: null, customerName: 'B', paymentDate: '2026-10-03T00:00:00Z', paymentMethod: 'Cash', amount: 200, isVoided: true },
				],
				summary: { totalCollected: 500, transactionCount: 1, cashAmount: 0, upiAmount: 500, cardAmount: 0, bankTransferAmount: 0, voidedTransactionCount: 1, voidedAmount: 200 },
			},
			period,
		);
		expect(sheet.rows[0][6]).toBe('');
		expect(sheet.rows[1][6]).toBe('Voided');
		expect(sheet.rows[1][1]).toBe('—');
		expect(sheet.totals?.[5]).toBe(500);
		expect(sheet.subtitle).toContain('UPI 500.00');
	});

	it('outstanding: shows the age and the balance still due', () => {
		const sheet = outstandingSheet(
			{
				rows: [{ invoiceId: 'i', invoiceNumber: 'INV-9', invoiceDate: '2026-09-01T00:00:00Z', customerName: 'C', customerPhone: '1', vehicleRegistration: 'X', totalAmount: 1000, paidAmount: 400, balanceAmount: 600, status: 3, ageInDays: 40 }],
				summary: { totalOutstandingAmount: 600, totalInvoiceAmount: 1000, totalPaidAmount: 400, invoiceCount: 1 },
			},
			period,
		);
		expect(sheet.rows[0][7]).toBe(600);
		expect(sheet.rows[0][8]).toBe(40);
		expect(sheet.totals?.[7]).toBe(600);
	});

	it('gst: separates the tax and says which invoices carry it', () => {
		const sheet = gstSheet(
			{
				invoiceCount: 2,
				grossSubtotal: 2000,
				totalDiscount: 0,
				taxableBase: 2000,
				cgstAmount: 90,
				sgstAmount: 90,
				totalGstAmount: 180,
				totalAmount: 2180,
				invoices: [
					{ invoiceId: 'a', invoiceNumber: 'INV-1', invoiceDate: '2026-10-01T00:00:00Z', customerName: 'A', registrationNumber: 'R1', isGstEnabled: true, taxableAmount: 1000, gstAmount: 180, totalAmount: 1180 },
					{ invoiceId: 'b', invoiceNumber: 'INV-2', invoiceDate: '2026-10-02T00:00:00Z', customerName: 'B', registrationNumber: 'R2', isGstEnabled: false, taxableAmount: 1000, gstAmount: 0, totalAmount: 1000 },
				],
			},
			period,
		);
		expect(sheet.rows.map((r) => r[4])).toEqual(['Yes', 'No']);
		expect(sheet.totals?.[6]).toBe(180);
		expect(sheet.subtitle).toContain('CGST 90.00');
	});

	it('job cards: names the status and the invoice it became', () => {
		const sheet = jobCardsSheet(
			{
				rows: [{ jobCardId: 'j', jobCardNumber: 'JC-1', date: '2026-10-01T00:00:00Z', customerName: 'A', customerPhone: '1', vehicleRegistration: 'R', vehicleDetails: 'Honda City', status: 4, totalAmount: 1180, invoiceNumber: 'INV-1', invoiceStatus: 2 }],
				summary: { totalCount: 1, draftCount: 0, inProgressCount: 0, completedCount: 0, cancelledCount: 0, invoicedCount: 1, totalRevenue: 1180 },
			},
			period,
		);
		expect(sheet.rows[0][6]).toBe('Invoiced');
		expect(sheet.rows[0][9]).toBe('Paid');
		expect(sheet.totals?.[7]).toBe(1180);
	});
});

describe('buildFinancialSheet', () => {
	it('fetches every page of the sales report for the chosen period', async () => {
		vi.mocked(api.getSalesReport)
			.mockResolvedValueOnce({ items: [salesRow(1)], totalCount: 2, page: 1, pageSize: 100, summary: salesSummary })
			.mockResolvedValueOnce({ items: [salesRow(2)], totalCount: 2, page: 2, pageSize: 100, summary: salesSummary });

		const sheet = await buildFinancialSheet('sales', '2026-10-01', '2026-10-31', 'This Month');

		expect(api.getSalesReport).toHaveBeenNthCalledWith(1, { fromDate: '2026-10-01', toDate: '2026-10-31', page: 1, pageSize: 100 });
		expect(api.getSalesReport).toHaveBeenNthCalledWith(2, { fromDate: '2026-10-01', toDate: '2026-10-31', page: 2, pageSize: 100 });
		expect(sheet.rows).toHaveLength(2);
	});

	it('asks for the GST report once, with no paging', async () => {
		vi.mocked(api.getGstReport).mockResolvedValue({
			invoiceCount: 0, grossSubtotal: 0, totalDiscount: 0, taxableBase: 0, cgstAmount: 0, sgstAmount: 0, totalGstAmount: 0, totalAmount: 0, invoices: [],
		});
		const sheet = await buildFinancialSheet('gst', '2026-10-01', '2026-10-31', 'This Month');
		expect(api.getGstReport).toHaveBeenCalledWith({ fromDate: '2026-10-01', toDate: '2026-10-31' });
		expect(sheet.sheetName).toBe('GST Summary');
	});
});

describe('workbook', () => {
	it('lays out a title, headers, the rows and a totals line', () => {
		const spec = salesSheet({ rows: [salesRow(1), salesRow(2)], summary: salesSummary }, period);
		const wb = createFinancialWorkbook(spec);
		const ws = wb.getWorksheet('Sales')!;

		expect(String(ws.getCell('A1').value)).toMatch(/SALES REPORT$/);
		expect(ws.getCell('A4').value).toBe('Invoice No.');
		expect(ws.getCell('A5').value).toBe('INV-1');
		expect(ws.getCell('F5').value).toBe(1000);
		expect(ws.getCell('F5').numFmt).toContain('₹');
		expect(ws.getCell('A7').value).toBe('Total');
		expect(ws.getCell('I7').value).toBe(2124);
	});

	it('names the file with the company and the period', () => {
		const spec = gstSheet(
			{ invoiceCount: 0, grossSubtotal: 0, totalDiscount: 0, taxableBase: 0, cgstAmount: 0, sgstAmount: 0, totalGstAmount: 0, totalAmount: 0, invoices: [] },
			period,
		);
		expect(financialReportFileName(spec, '2026-10-01', '2026-10-31')).toMatch(/GST_Summary_Report_2026-10-01_to_2026-10-31\.xlsx$/);
	});
});
