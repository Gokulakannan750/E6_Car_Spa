import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { FinancialReportsView } from './FinancialReportsView';
import * as api from '../../lib/api';
import * as generator from './excelFinancialReportGenerator';

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

vi.mock('./excelFinancialReportGenerator', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./excelFinancialReportGenerator')>();
	return { ...actual, downloadFinancialReport: vi.fn().mockResolvedValue('file.xlsx') };
});

const bounds = { startStr: '2026-10-01', endStr: '2026-10-31', label: 'This Month' };
const formatINR = (v?: number | null) => `₹${(v ?? 0).toFixed(2)}`;

const owner = {
	id: 'u1',
	fullName: 'Owner',
	username: 'owner',
	role: 'Owner',
	isOwner: true,
	permissions: [],
} as unknown as api.AuthUserResponse;

const staffWith = (permissions: string[]) =>
	({ id: 'u2', fullName: 'Staff', username: 'staff', role: 'Staff', isOwner: false, permissions }) as unknown as api.AuthUserResponse;

const salesRow = (n: number): api.SalesReportRowDto => ({
	invoiceId: `i${n}`,
	invoiceNumber: `INV-${n}`,
	invoiceDate: '2026-10-05T10:00:00Z',
	customerName: `Customer ${n}`,
	customerPhone: '9840123456',
	registrationNumber: 'TN01AB1234',
	subtotal: 1000,
	discount: 0,
	gst: 180,
	totalAmount: 1180,
	paidAmount: 0,
	balanceAmount: 1180,
	status: 6,
});

const salesPage = (items: api.SalesReportRowDto[], totalCount: number, page = 1): api.SalesReportResponse => ({
	items,
	totalCount,
	page,
	pageSize: 25,
	summary: { totalSubtotal: 1000, totalDiscount: 0, totalGst: 180, totalAmount: 1180, totalPaid: 0, totalBalance: 1180, invoiceCount: totalCount },
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(api.getSalesReport).mockResolvedValue(salesPage([salesRow(1)], 1));
});

describe('FinancialReportsView', () => {
	it('shows the sales report first, with its totals and rows', async () => {
		renderWithProviders(<FinancialReportsView bounds={bounds} formatINR={formatINR} />, { authUser: owner });

		expect(await screen.findByText('INV-1')).toBeInTheDocument();
		expect(screen.getByText('Customer 1')).toBeInTheDocument();
		expect(screen.getByText('Payment Pending')).toBeInTheDocument();
		expect(within(screen.getByTestId('financial-report-kpis')).getByText('Net sales')).toBeInTheDocument();
		expect(api.getSalesReport).toHaveBeenCalledWith({ fromDate: '2026-10-01', toDate: '2026-10-31', page: 1, pageSize: 25 });
	});

	it('offers only the reports the person is allowed to see', async () => {
		renderWithProviders(<FinancialReportsView bounds={bounds} formatINR={formatINR} />, {
			authUser: staffWith(['reports.gst', 'reports.payments']),
		});

		const tabs = await screen.findAllByRole('tab');
		expect(tabs.map((t) => t.textContent)).toEqual(['Collections', 'GST Summary']);
		expect(api.getSalesReport).not.toHaveBeenCalled();
	});

	it('says so when nothing is allowed', () => {
		renderWithProviders(<FinancialReportsView bounds={bounds} formatINR={formatINR} />, { authUser: staffWith(['invoices.view']) });
		expect(screen.getByTestId('financial-reports-none')).toBeInTheDocument();
	});

	it('moves through pages', async () => {
		vi.mocked(api.getSalesReport).mockImplementation(async (params) =>
			params?.page === 2 ? salesPage([salesRow(2)], 30, 2) : salesPage([salesRow(1)], 30, 1),
		);
		renderWithProviders(<FinancialReportsView bounds={bounds} formatINR={formatINR} />, { authUser: owner });

		expect(await screen.findByText('INV-1')).toBeInTheDocument();
		expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /next page/i }));
		expect(await screen.findByText('INV-2')).toBeInTheDocument();
		expect(api.getSalesReport).toHaveBeenLastCalledWith({ fromDate: '2026-10-01', toDate: '2026-10-31', page: 2, pageSize: 25 });
	});

	it('shows a plain message for an empty period', async () => {
		vi.mocked(api.getSalesReport).mockResolvedValue(salesPage([], 0));
		renderWithProviders(<FinancialReportsView bounds={bounds} formatINR={formatINR} />, { authUser: owner });

		expect(await screen.findByTestId('financial-report-empty')).toHaveTextContent('No invoices in this period.');
	});

	it('shows the reason when the server refuses', async () => {
		vi.mocked(api.getSalesReport).mockRejectedValue(new Error('You do not have permission to view the sales report.'));
		renderWithProviders(<FinancialReportsView bounds={bounds} formatINR={formatINR} />, { authUser: owner });

		expect(await screen.findByRole('alert')).toHaveTextContent('permission to view the sales report');
	});

	it('switches to the GST summary and lists every invoice with the tax split', async () => {
		vi.mocked(api.getGstReport).mockResolvedValue({
			invoiceCount: 1,
			grossSubtotal: 1000,
			totalDiscount: 0,
			taxableBase: 1000,
			cgstAmount: 90,
			sgstAmount: 90,
			totalGstAmount: 180,
			totalAmount: 1180,
			invoices: [{ invoiceId: 'g1', invoiceNumber: 'INV-77', invoiceDate: '2026-10-02T00:00:00Z', customerName: 'Meera', registrationNumber: 'KA05', isGstEnabled: true, taxableAmount: 1000, gstAmount: 180, totalAmount: 1180 }],
		});
		renderWithProviders(<FinancialReportsView bounds={bounds} formatINR={formatINR} />, { authUser: owner });

		fireEvent.click(await screen.findByRole('tab', { name: 'GST Summary' }));

		expect(await screen.findByText('INV-77')).toBeInTheDocument();
		expect(within(screen.getByTestId('financial-report-kpis')).getByText('CGST')).toBeInTheDocument();
		expect(within(screen.getByTestId('financial-report-kpis')).getAllByText('₹90.00')).toHaveLength(2);
		expect(api.getGstReport).toHaveBeenCalledWith({ fromDate: '2026-10-01', toDate: '2026-10-31' });
	});

	it('exports the whole report for the period to Excel', async () => {
		vi.mocked(api.getSalesReport).mockResolvedValue(salesPage([salesRow(1)], 1));
		renderWithProviders(<FinancialReportsView bounds={bounds} formatINR={formatINR} />, { authUser: owner });

		await screen.findByText('INV-1');
		fireEvent.click(screen.getByTestId('financial-report-export'));

		await waitFor(() => expect(generator.downloadFinancialReport).toHaveBeenCalled());
		const [spec, from, to] = vi.mocked(generator.downloadFinancialReport).mock.calls[0];
		expect(spec.sheetName).toBe('Sales');
		expect(spec.rows).toHaveLength(1);
		expect(from).toBe('2026-10-01');
		expect(to).toBe('2026-10-31');
	});

	it('tells the person when the Excel file could not be made', async () => {
		vi.mocked(generator.downloadFinancialReport).mockRejectedValueOnce(new Error('Disk is full'));
		renderWithProviders(<FinancialReportsView bounds={bounds} formatINR={formatINR} />, { authUser: owner });

		await screen.findByText('INV-1');
		fireEvent.click(screen.getByTestId('financial-report-export'));

		expect(await screen.findByText('Disk is full')).toBeInTheDocument();
	});
});
