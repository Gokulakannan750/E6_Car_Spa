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

describe('BillingReportsView Component — Clean UI & Excel Export', () => {
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
		dailySheets: [],
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

	it('does not render the removed preview table structure in the UI', async () => {
		renderWithProviders(
			<BillingReportsView formatINR={(val) => `₹${val ?? 0}`} />
		);

		await waitFor(() => {
			expect(screen.getByText(/reporting month:/i)).toBeInTheDocument();
		});

		expect(screen.queryByText('Monthly Billing Excel Structure Preview')).not.toBeInTheDocument();
	});
});
