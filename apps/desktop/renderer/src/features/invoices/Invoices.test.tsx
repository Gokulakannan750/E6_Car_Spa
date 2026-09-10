import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Invoices, getInvoiceDisplayStatus } from './Invoices';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getInvoices: vi.fn(),
	};
});

describe('Invoices List Component & Status Display', () => {
	const mockDraftItem: api.InvoiceListDto = {
		id: 'inv-draft-1',
		invoiceNumber: null,
		jobCardNumber: 'JC-2026-000001',
		customerName: 'Aarav Kumar',
		customerPhone: '9876543210',
		registrationNumber: 'TN01AB1111',
		vehicle: 'Hyundai i20',
		invoiceDate: '2026-09-01T10:00:00Z',
		totalAmount: 1000,
		paidAmount: 0,
		balanceAmount: 1000,
		status: 0, // Draft numeric enum
		createdAt: '2026-09-01T10:00:00Z',
	};

	const mockGeneratedItem: api.InvoiceListDto = {
		id: 'inv-gen-1',
		invoiceNumber: 'INV-2026-000019',
		jobCardNumber: 'JC-2026-000029',
		customerName: 'Rohan Verma',
		customerPhone: '9876543211',
		registrationNumber: 'TN02CD2222',
		vehicle: 'Tata Nexon',
		invoiceDate: '2026-09-02T10:00:00Z',
		totalAmount: 2500,
		paidAmount: 0,
		balanceAmount: 2500,
		status: 6, // Generated numeric enum from backend Domain/Enums/InvoiceStatus.cs
		createdAt: '2026-09-02T10:00:00Z',
	};

	const mockPartiallyPaidItem: api.InvoiceListDto = {
		id: 'inv-partial-1',
		invoiceNumber: 'INV-2026-000020',
		jobCardNumber: 'JC-2026-000030',
		customerName: 'Neha Gupta',
		customerPhone: '9876543212',
		registrationNumber: 'TN03EF3333',
		vehicle: 'Kia Seltos',
		invoiceDate: '2026-09-03T10:00:00Z',
		totalAmount: 3000,
		paidAmount: 1500,
		balanceAmount: 1500,
		status: 3, // PartiallyPaid numeric enum
		createdAt: '2026-09-03T10:00:00Z',
	};

	const mockPaidItem: api.InvoiceListDto = {
		id: 'inv-paid-1',
		invoiceNumber: 'INV-2026-000021',
		jobCardNumber: 'JC-2026-000031',
		customerName: 'Suresh Raina',
		customerPhone: '9876543213',
		registrationNumber: 'TN04GH4444',
		vehicle: 'Honda City',
		invoiceDate: '2026-09-04T10:00:00Z',
		totalAmount: 4000,
		paidAmount: 4000,
		balanceAmount: 0,
		status: 2, // Paid numeric enum
		createdAt: '2026-09-04T10:00:00Z',
	};

	const mockCancelledItem: api.InvoiceListDto = {
		id: 'inv-canc-1',
		invoiceNumber: 'INV-2026-000022',
		jobCardNumber: 'JC-2026-000032',
		customerName: 'Vikram Singh',
		customerPhone: '9876543214',
		registrationNumber: 'TN05IJ5555',
		vehicle: 'Toyota Fortuner',
		invoiceDate: '2026-09-05T10:00:00Z',
		totalAmount: 5000,
		paidAmount: 0,
		balanceAmount: 5000,
		status: 4, // Cancelled numeric enum
		createdAt: '2026-09-05T10:00:00Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('correctly maps all invoice status variants in getInvoiceDisplayStatus helper', () => {
		// 1. Draft
		expect(getInvoiceDisplayStatus(mockDraftItem)).toBe('Draft');
		expect(getInvoiceDisplayStatus({ ...mockDraftItem, status: 'Draft' })).toBe('Draft');

		// 2. Generated / Finalized (numeric 6 and string 'Generated')
		expect(getInvoiceDisplayStatus(mockGeneratedItem)).toBe('Generated');
		expect(getInvoiceDisplayStatus({ ...mockGeneratedItem, status: 'Generated' })).toBe('Generated');
		expect(getInvoiceDisplayStatus({ ...mockGeneratedItem, status: '6' as unknown as api.InvoiceStatus })).toBe('Generated');

		// 3. Generated invoice with invoice number but status defaulted to 0 or null
		expect(getInvoiceDisplayStatus({ ...mockGeneratedItem, status: 0 })).toBe('Generated');
		expect(getInvoiceDisplayStatus({ ...mockGeneratedItem, status: 'Draft' })).toBe('Generated');

		// 4. Partially Paid (numeric 3 and string 'PartiallyPaid')
		expect(getInvoiceDisplayStatus(mockPartiallyPaidItem)).toBe('PartiallyPaid');
		expect(getInvoiceDisplayStatus({ ...mockPartiallyPaidItem, status: 'PartiallyPaid' })).toBe('PartiallyPaid');

		// 5. Paid (numeric 2 and string 'Paid')
		expect(getInvoiceDisplayStatus(mockPaidItem)).toBe('Paid');
		expect(getInvoiceDisplayStatus({ ...mockPaidItem, status: 'Paid' })).toBe('Paid');

		// 6. Cancelled (numeric 4 and string 'Cancelled')
		expect(getInvoiceDisplayStatus(mockCancelledItem)).toBe('Cancelled');
		expect(getInvoiceDisplayStatus({ ...mockCancelledItem, status: 'Cancelled' })).toBe('Cancelled');
	});

	it('renders Draft, Generated, Partially Paid, Paid, and Cancelled invoices in the list table', async () => {
		vi.mocked(api.getInvoices).mockResolvedValue({
			items: [mockDraftItem, mockGeneratedItem, mockPartiallyPaidItem, mockPaidItem, mockCancelledItem],
			totalCount: 5,
			page: 1,
			pageSize: 20,
		});

		renderWithProviders(<Invoices />);

		await waitFor(() => {
			// Check table rows are rendered
			expect(screen.getByText('JC-2026-000001')).toBeInTheDocument();
			expect(screen.getByText('INV-2026-000019')).toBeInTheDocument();
			expect(screen.getByText('INV-2026-000020')).toBeInTheDocument();
			expect(screen.getByText('INV-2026-000021')).toBeInTheDocument();
			expect(screen.getByText('INV-2026-000022')).toBeInTheDocument();
		});

		// Check status badges in table
		// Draft displays 'Draft'
		expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1);

		// Generated/finalized invoice displays 'Generated'
		expect(screen.getAllByText('Generated').length).toBeGreaterThanOrEqual(1);

		// Partially Paid displays 'Partially Paid'
		expect(screen.getAllByText('Partially Paid').length).toBeGreaterThanOrEqual(1);

		// Paid displays 'Paid'
		expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(1);

		// Cancelled displays 'Cancelled'
		expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1);
	});

	it('Generated invoice does NOT display Draft badge in its table row', async () => {
		vi.mocked(api.getInvoices).mockResolvedValue({
			items: [mockGeneratedItem],
			totalCount: 1,
			page: 1,
			pageSize: 20,
		});

		renderWithProviders(<Invoices />);

		await waitFor(() => {
			expect(screen.getByText('INV-2026-000019')).toBeInTheDocument();
		});

		// The row must contain 'Generated', and NOT contain a 'Draft' badge
		const row = screen.getByText('INV-2026-000019').closest('tr');
		expect(row).toBeInTheDocument();
		expect(row).toHaveTextContent('Generated');
		expect(row).not.toHaveTextContent('Draft');
	});

	it('filters invoices when clicking the Generated filter tab', async () => {
		vi.mocked(api.getInvoices).mockResolvedValue({
			items: [mockGeneratedItem],
			totalCount: 1,
			page: 1,
			pageSize: 20,
		});

		renderWithProviders(<Invoices />);

		await waitFor(() => {
			expect(screen.getByText('INV-2026-000019')).toBeInTheDocument();
		});

		// Find the Generated status filter button among filter tabs
		const generatedFilterBtn = screen.getByRole('button', { name: 'Generated' });
		fireEvent.click(generatedFilterBtn);

		await waitFor(() => {
			expect(api.getInvoices).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 'Generated',
				})
			);
		});
	});

	describe('Invoice Search Enhancements (Job Card Number Support)', () => {
		it('forwards Job Card Number to getInvoices search parameter and renders matching invoice', async () => {
			vi.mocked(api.getInvoices).mockResolvedValue({
				items: [mockDraftItem],
				totalCount: 1,
				page: 1,
				pageSize: 20,
			});

			renderWithProviders(<Invoices />);

			const searchInput = screen.getByPlaceholderText(/search invoices/i);
			fireEvent.change(searchInput, { target: { value: 'JC-2026-000001' } });

			await waitFor(() => {
				expect(api.getInvoices).toHaveBeenCalledWith(
					expect.objectContaining({
						search: 'JC-2026-000001',
					})
				);
				expect(screen.getByText('JC-2026-000001')).toBeInTheDocument();
				expect(screen.getByText('Aarav Kumar')).toBeInTheDocument();
			});
		});

		it('forwards Invoice Number search to getInvoices and renders matching invoice', async () => {
			vi.mocked(api.getInvoices).mockResolvedValue({
				items: [mockGeneratedItem],
				totalCount: 1,
				page: 1,
				pageSize: 20,
			});

			renderWithProviders(<Invoices />);

			const searchInput = screen.getByPlaceholderText(/search invoices/i);
			fireEvent.change(searchInput, { target: { value: 'INV-2026-000019' } });

			await waitFor(() => {
				expect(api.getInvoices).toHaveBeenCalledWith(
					expect.objectContaining({
						search: 'INV-2026-000019',
					})
				);
				expect(screen.getByText('INV-2026-000019')).toBeInTheDocument();
			});
		});

		it('forwards Customer Name search to getInvoices and renders matching invoice', async () => {
			vi.mocked(api.getInvoices).mockResolvedValue({
				items: [mockPaidItem],
				totalCount: 1,
				page: 1,
				pageSize: 20,
			});

			renderWithProviders(<Invoices />);

			const searchInput = screen.getByPlaceholderText(/search invoices/i);
			fireEvent.change(searchInput, { target: { value: 'Suresh Raina' } });

			await waitFor(() => {
				expect(api.getInvoices).toHaveBeenCalledWith(
					expect.objectContaining({
						search: 'Suresh Raina',
					})
				);
				expect(screen.getByText('Suresh Raina')).toBeInTheDocument();
			});
		});

		it('forwards Vehicle Registration search to getInvoices and renders matching invoice', async () => {
			vi.mocked(api.getInvoices).mockResolvedValue({
				items: [mockPartiallyPaidItem],
				totalCount: 1,
				page: 1,
				pageSize: 20,
			});

			renderWithProviders(<Invoices />);

			const searchInput = screen.getByPlaceholderText(/search invoices/i);
			fireEvent.change(searchInput, { target: { value: 'TN03EF3333' } });

			await waitFor(() => {
				expect(api.getInvoices).toHaveBeenCalledWith(
					expect.objectContaining({
						search: 'TN03EF3333',
					})
				);
				expect(screen.getByText('TN03EF3333')).toBeInTheDocument();
			});
		});

		it('displays empty state when search returns no matching invoices', async () => {
			vi.mocked(api.getInvoices).mockResolvedValue({
				items: [],
				totalCount: 0,
				page: 1,
				pageSize: 20,
			});

			renderWithProviders(<Invoices />);

			const searchInput = screen.getByPlaceholderText(/search invoices/i);
			fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });

			await waitFor(() => {
				expect(screen.getByText('No invoices found')).toBeInTheDocument();
				expect(screen.getByText(/try adjusting your search or filters/i)).toBeInTheDocument();
			});
		});

		it('renders each matching invoice exactly once without duplicate rows', async () => {
			vi.mocked(api.getInvoices).mockResolvedValue({
				items: [mockGeneratedItem],
				totalCount: 1,
				page: 1,
				pageSize: 20,
			});

			renderWithProviders(<Invoices />);

			await waitFor(() => {
				expect(screen.getByText('INV-2026-000019')).toBeInTheDocument();
			});

			// Verify only a single table row exists for this invoice
			const matchingRows = screen.getAllByRole('row').filter((r) => r.textContent?.includes('INV-2026-000019'));
			expect(matchingRows).toHaveLength(1);
		});
	});
});
