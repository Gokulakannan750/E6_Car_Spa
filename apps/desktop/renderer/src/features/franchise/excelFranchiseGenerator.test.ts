import { describe, it, expect } from 'vitest';
import type ExcelJS from 'exceljs';
import { createCompanyTotalsWorkbook, createNetworkSummaryWorkbook } from './excelFranchiseGenerator';
import { createMonthlyBillingWorkbook } from '../reports/excelMonthlyBillingGenerator';
import type { FranchiseDashboardDto, FranchiseeFinancialsDto, FranchiseFinancialTotalsDto, MonthlyBillingReportResponse } from '../../lib/api';

const totals = (over: Partial<FranchiseFinancialTotalsDto> = {}): FranchiseFinancialTotalsDto => ({
	invoiceCount: 3,
	invoicedAmount: 1000,
	collectedAmount: 600,
	outstandingAmount: 400,
	jobCardCount: 4,
	daily: [
		{ date: '2026-10-01', invoiced: 600, collected: 300 },
		{ date: '2026-10-02', invoiced: 400, collected: 300 },
	],
	...over,
});

const beta: FranchiseeFinancialsDto = {
	linkId: 'l1',
	partnerCodeHint: '0••2',
	partnerName: 'Beta Detailing',
	financialTotalsAllowed: true,
	allowedItems: ['financial_totals'],
	totals: totals(),
};

const gamma: FranchiseeFinancialsDto = {
	linkId: 'l2',
	partnerCodeHint: '0••3',
	partnerName: 'Gamma Wash',
	financialTotalsAllowed: false,
	allowedItems: [],
	totals: null,
};

const dashboard: FranchiseDashboardDto = {
	from: '2026-10-01',
	to: '2026-10-07',
	network: totals(),
	franchisees: [beta, gamma],
};

function cellTexts(ws: ExcelJS.Worksheet): string[] {
	const out: string[] = [];
	ws.eachRow((row) => row.eachCell((cell) => out.push(String(typeof cell.value === 'object' && cell.value && 'result' in cell.value ? cell.value.result : cell.value ?? ''))));
	return out;
}

describe('Franchise Excel exports', () => {
	it('the network summary has a summary sheet and a daily totals sheet', () => {
		const wb = createNetworkSummaryWorkbook(dashboard);
		expect(wb.worksheets.map((w) => w.name)).toEqual(['Network Summary', 'Daily Totals']);
	});

	it('the network summary lists each company that shares, and names the ones that do not', () => {
		const ws = createNetworkSummaryWorkbook(dashboard).getWorksheet('Network Summary')!;
		const texts = cellTexts(ws);

		expect(texts).toContain('Beta Detailing (0••2)');
		expect(texts.some((t) => t.includes('Gamma Wash') && t.includes('has not allowed the financial totals'))).toBe(true);
		expect(texts).toContain('PERIOD: 2026-10-01 TO 2026-10-07');
		// No figures for the company that has not allowed them.
		expect(texts).not.toContain('Gamma Wash (0••3)');
	});

	it('the network totals add up in the summary and the daily sheet', () => {
		const wb = createNetworkSummaryWorkbook(dashboard);
		const summary = cellTexts(wb.getWorksheet('Network Summary')!);
		expect(summary).toContain('1000'); // total invoiced
		expect(summary).toContain('600'); // total collected
		expect(summary).toContain('400'); // outstanding

		const daily = wb.getWorksheet('Daily Totals')!;
		expect(daily.getCell('A5').value).toBe('2026-10-01');
		expect(daily.getCell('B5').value).toBe(600);
		expect(daily.getCell('A6').value).toBe('2026-10-02');
		const total = daily.getCell('B7').value as { formula: string; result: number };
		expect(total.formula).toBe('SUM(B5:B6)');
		expect(total.result).toBe(1000);
	});

	it('a company workbook has its own totals and is titled with the franchisee, not the exporter', () => {
		const wb = createCompanyTotalsWorkbook(beta, '2026-10-01', '2026-10-07');
		expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', 'Daily Totals']);
		expect(String(wb.getWorksheet('Summary')!.getCell('A1').value)).toContain('BETA DETAILING');
		expect(cellTexts(wb.getWorksheet('Summary')!)).toContain('1000');
	});

	it('refuses to build figures for a company that has not allowed them', () => {
		expect(() => createCompanyTotalsWorkbook(gamma, '2026-10-01', '2026-10-07')).toThrow(/has not allowed/);
	});

	it('an empty period still produces a readable daily sheet', () => {
		const empty = createCompanyTotalsWorkbook({ ...beta, totals: totals({ daily: [], invoiceCount: 0, invoicedAmount: 0 }) }, '2026-10-01', '2026-10-07');
		expect(cellTexts(empty.getWorksheet('Daily Totals')!)).toContain('No invoices or payments in this period.');
	});
});

describe('The billing workbook for a franchisee', () => {
	const report: MonthlyBillingReportResponse = {
		year: 2026,
		month: 10,
		monthName: 'October 2026',
		fromDate: '2026-10-01',
		toDate: '2026-10-31',
		daysInMonth: 31,
		summary: {
			monthName: 'October 2026',
			startDate: '2026-10-01',
			endDate: '2026-10-31',
			generatedAt: '2026-10-09T10:00:00Z',
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

	it('is titled with the franchisee, and the exporter name is not used', () => {
		const wb = createMonthlyBillingWorkbook(report, 'Beta Detailing');
		expect(String(wb.getWorksheet('Monthly Summary')!.getCell('A1').value)).toBe('BETA DETAILING — MONTHLY BILLING REPORT');
	});

	it('is unchanged for a company exporting its own report', () => {
		const wb = createMonthlyBillingWorkbook(report);
		expect(String(wb.getWorksheet('Monthly Summary')!.getCell('A1').value)).toContain('MONTHLY BILLING REPORT');
	});
});
