import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { BillingReportsView } from './BillingReportsView';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';
import * as excelGen from './excelMonthlyBillingGenerator';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getMonthlyBillingReport: vi.fn(),
	};
});

vi.mock('./excelMonthlyBillingGenerator', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./excelMonthlyBillingGenerator')>();
	return {
		...actual,
		generateAndDownloadMonthlyBillingReport: vi.fn(),
	};
});

describe('BillingReportsView Component', () => {
	const mockMonthlyReport: api.MonthlyBillingReportResponse = {
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
			totalJobCardsCreated: 25,
			totalJobCardsFinished: 20,
			totalInvoices: 22,
			totalInvoicesPaid: 18,
			totalInvoicesPendingPayment: 4,
			totalInvoicesDraft: 1,
			totalInvoicesCancelled: 1,
			totalInvoiceAmount: 50000,
			totalAmountPaid: 42000,
			totalAmountPending: 8000,
			totalServicesPerformed: 40,
			totalServiceQuantity: 45,
		},
		dailySheets: [
			{
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
			},
			{
				day: 2,
				date: '2026-10-02T00:00:00Z',
				dateFormatted: '02-Oct-2026',
				sheetName: '02-Oct',
				hasActivity: true,
				totals: {
					jobCardTotal: 5000,
					invoiceTotal: 5000,
					amountPaid: 5000,
					amountPending: 0,
					jobCardCount: 1,
					invoiceCount: 1,
					serviceCount: 2,
					serviceTotalQuantity: 2,
				},
				jobCards: [
					{
						jobCardId: 'jc-1',
						jobCardNumber: 'JC-101',
						jobCardDate: '2026-10-02T10:00:00Z',
						customerName: 'Kavitha',
						vehicleRegistration: 'TN01AA1234',
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
						invoiceDate: '2026-10-02T00:00:00Z',
						jobCardNumber: 'JC-101',
						customerName: 'Kavitha',
						vehicleRegistration: 'TN01AA1234',
						invoiceStatus: 'Paid',
						invoiceTotal: 5000,
						amountPaid: 5000,
						amountPending: 0,
					},
				],
				services: [
					{
						serviceItemId: 's-1',
						jobCardNumber: 'JC-101',
						invoiceNumber: 'INV-101',
						customerName: 'Kavitha',
						serviceName: 'Full Body Wash',
						quantity: 1,
						rate: 2000,
						amount: 2000,
					},
					{
						serviceItemId: 's-2',
						jobCardNumber: 'JC-101',
						invoiceNumber: 'INV-101',
						customerName: 'Kavitha',
						serviceName: 'Interior Detailing',
						quantity: 1,
						rate: 3000,
						amount: 3000,
					},
				],
			},
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getMonthlyBillingReport).mockResolvedValue(mockMonthlyReport);
	});

	it('renders month selector, year selector, and export button', async () => {
		renderWithProviders(
			<BillingReportsView formatINR={(val) => `₹${val ?? 0}`} />
		);

		await waitFor(() => {
			expect(screen.getByText(/reporting month:/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/select reporting month/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /export monthly billing excel/i })).toBeInTheDocument();
		});
	});

	it('renders daily sheets preview with active and empty days', async () => {
		renderWithProviders(
			<BillingReportsView formatINR={(val) => `₹${val ?? 0}`} />
		);

		await waitFor(() => {
			expect(screen.getByText('01-Oct')).toBeInTheDocument();
			expect(screen.getByText('02-Oct')).toBeInTheDocument();
			expect(screen.getByText('No activity')).toBeInTheDocument();
			expect(screen.getByText('Active')).toBeInTheDocument();
		});
	});

	it('triggers Excel download when export button is clicked', async () => {
		renderWithProviders(
			<BillingReportsView formatINR={(val) => `₹${val ?? 0}`} />
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /export monthly billing excel/i })).not.toBeDisabled();
		});

		fireEvent.click(screen.getByRole('button', { name: /export monthly billing excel/i }));

		expect(excelGen.generateAndDownloadMonthlyBillingReport).toHaveBeenCalledWith(mockMonthlyReport);
	});

	it('expands active day to show Job Cards, Invoices, and Services detail tables', async () => {
		renderWithProviders(
			<BillingReportsView formatINR={(val) => `₹${val ?? 0}`} />
		);

		await waitFor(() => {
			expect(screen.getByText('02-Oct')).toBeInTheDocument();
		});

		const expandBtn = screen.getByTitle('View daily details');
		fireEvent.click(expandBtn);

		await waitFor(() => {
			expect(screen.getByText(/Detailed Records for 02-Oct-2026/i)).toBeInTheDocument();
			expect(screen.getAllByText('INV-101').length).toBeGreaterThan(0);
			expect(screen.getAllByText('JC-101').length).toBeGreaterThan(0);
			expect(screen.getByText('Full Body Wash')).toBeInTheDocument();
			expect(screen.getByText('Interior Detailing')).toBeInTheDocument();
		});
	});

	it('changes month and refetches with new month', async () => {
		renderWithProviders(
			<BillingReportsView formatINR={(val) => `₹${val ?? 0}`} />
		);

		await waitFor(() => {
			expect(screen.getByText(/reporting month:/i)).toBeInTheDocument();
		});

		const monthSelect = screen.getByLabelText(/select reporting month/i);
		fireEvent.change(monthSelect, { target: { value: '11' } }); // November

		await waitFor(() => {
			expect(api.getMonthlyBillingReport).toHaveBeenCalledWith(expect.objectContaining({ month: 11 }));
		});
	});
});
