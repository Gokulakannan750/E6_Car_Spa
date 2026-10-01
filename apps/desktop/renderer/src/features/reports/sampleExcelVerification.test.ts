import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx-js-style';
import {
	generateMonthlyBillingWorkbook,
} from './excelMonthlyBillingGenerator';
import type { MonthlyBillingReportResponse } from '../../lib/api';

describe('Sample Excel Workbook Generation Verification', () => {
	it('generates a real September 2026 Excel file and verifies formatting integrity', () => {
		const dailySheets = Array.from({ length: 30 }, (_, i) => {
			const day = i + 1;
			const dayStr = String(day).padStart(2, '0');
			const hasActivity = day === 1 || day === 15 || day === 30;

			return {
				day,
				date: `2026-09-${dayStr}T00:00:00Z`,
				dateFormatted: `${dayStr}-Sep-2026`,
				sheetName: `${dayStr}-Sep`,
				hasActivity,
				totals: {
					jobCardTotal: hasActivity ? 12500 : 0,
					invoiceTotal: hasActivity ? 12500 : 0,
					amountPaid: hasActivity ? 10000 : 0,
					amountPending: hasActivity ? 2500 : 0,
					jobCardCount: hasActivity ? 2 : 0,
					invoiceCount: hasActivity ? 2 : 0,
					serviceCount: hasActivity ? 4 : 0,
					serviceTotalQuantity: hasActivity ? 4 : 0,
				},
				jobCards: hasActivity
					? [
							{
								jobCardId: `jc-${day}-1`,
								jobCardNumber: `JC-202609${dayStr}01`,
								jobCardDate: `2026-09-${dayStr}T09:30:00Z`,
								customerName: 'Suresh Kumar',
								vehicleRegistration: 'TN09CD5678',
								vehicle: 'Hyundai Creta',
								jobCardStatus: 'Ready',
								totalServices: 2,
								jobCardTotal: 6500,
							},
							{
								jobCardId: `jc-${day}-2`,
								jobCardNumber: `JC-202609${dayStr}02`,
								jobCardDate: `2026-09-${dayStr}T14:15:00Z`,
								customerName: 'Priya Raman',
								vehicleRegistration: 'TN02EF9012',
								vehicle: 'Toyota Fortuner',
								jobCardStatus: 'In Progress',
								totalServices: 2,
								jobCardTotal: 6000,
							},
					  ]
					: [],
				invoices: hasActivity
					? [
							{
								invoiceId: `inv-${day}-1`,
								invoiceNumber: `INV-202609${dayStr}01`,
								invoiceDate: `2026-09-${dayStr}T00:00:00Z`,
								jobCardNumber: `JC-202609${dayStr}01`,
								customerName: 'Suresh Kumar',
								vehicleRegistration: 'TN09CD5678',
								invoiceStatus: 'Paid',
								invoiceTotal: 6500,
								amountPaid: 6500,
								amountPending: 0,
							},
							{
								invoiceId: `inv-${day}-2`,
								invoiceNumber: `INV-202609${dayStr}02`,
								invoiceDate: `2026-09-${dayStr}T00:00:00Z`,
								jobCardNumber: `JC-202609${dayStr}02`,
								customerName: 'Priya Raman',
								vehicleRegistration: 'TN02EF9012',
								invoiceStatus: 'PartiallyPaid',
								invoiceTotal: 6000,
								amountPaid: 3500,
								amountPending: 2500,
							},
					  ]
					: [],
				services: hasActivity
					? [
							{
								serviceItemId: `s-${day}-1`,
								jobCardNumber: `JC-202609${dayStr}01`,
								invoiceNumber: `INV-202609${dayStr}01`,
								customerName: 'Suresh Kumar',
								serviceName: 'Full Exterior Foam Wash',
								quantity: 1,
								rate: 2500,
								amount: 2500,
							},
							{
								serviceItemId: `s-${day}-2`,
								jobCardNumber: `JC-202609${dayStr}01`,
								invoiceNumber: `INV-202609${dayStr}01`,
								customerName: 'Suresh Kumar',
								serviceName: 'Ceramic Booster Coat',
								quantity: 1,
								rate: 4000,
								amount: 4000,
							},
							{
								serviceItemId: `s-${day}-3`,
								jobCardNumber: `JC-202609${dayStr}02`,
								invoiceNumber: `INV-202609${dayStr}02`,
								customerName: 'Priya Raman',
								serviceName: 'Interior Deep Clean',
								quantity: 1,
								rate: 3500,
								amount: 3500,
							},
							{
								serviceItemId: `s-${day}-4`,
								jobCardNumber: `JC-202609${dayStr}02`,
								invoiceNumber: `INV-202609${dayStr}02`,
								customerName: 'Priya Raman',
								serviceName: 'Underbody Anti-Rust Coating',
								quantity: 1,
								rate: 2500,
								amount: 2500,
							},
					  ]
					: [],
			};
		});

		const sampleReport: MonthlyBillingReportResponse = {
			year: 2026,
			month: 9,
			monthName: 'September 2026',
			fromDate: '2026-09-01T00:00:00Z',
			toDate: '2026-09-30T00:00:00Z',
			daysInMonth: 30,
			summary: {
				monthName: 'September 2026',
				startDate: '2026-09-01T00:00:00Z',
				endDate: '2026-09-30T00:00:00Z',
				generatedAt: '2026-10-01T22:52:00Z',
				totalJobCardsCreated: 6,
				totalJobCardsFinished: 3,
				totalInvoices: 6,
				totalInvoicesPaid: 3,
				totalInvoicesPendingPayment: 3,
				totalInvoicesDraft: 0,
				totalInvoicesCancelled: 0,
				totalInvoiceAmount: 37500,
				totalAmountPaid: 30000,
				totalAmountPending: 7500,
				totalServicesPerformed: 12,
				totalServiceQuantity: 12,
			},
			dailySheets,
		};

		const wb = generateMonthlyBillingWorkbook(sampleReport);

		// Verify Sheet Count: Monthly Summary + 30 daily sheets = 31 sheets
		expect(wb.SheetNames.length).toBe(31);
		expect(wb.SheetNames[0]).toBe('Monthly Summary');
		expect(wb.SheetNames[1]).toBe('01-Sep');
		expect(wb.SheetNames[30]).toBe('30-Sep');

		// Verify Monthly Summary cells & styles
		const summaryWs = wb.Sheets['Monthly Summary'];
		expect(summaryWs['A1'].v).toBe('E6 CAR SPA — MONTHLY BILLING REPORT');
		expect(summaryWs['A1'].s?.fill?.fgColor?.rgb).toBe('0B3A6E');
		expect(summaryWs['A2'].v).toBe('MONTHLY EXECUTIVE SUMMARY');

		// Verify buffer writing without disk pollution
		const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
		expect(buf).toBeDefined();
		expect(buf.length).toBeGreaterThan(5000);
	});
});
