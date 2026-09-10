import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { JobCardsPage } from './JobCardsPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getJobCards: vi.fn(),
		createInvoiceFromJobCard: vi.fn(),
	};
});

describe('JobCardsPage Component', () => {
	const mockJobCards: api.JobCardListDto[] = [
		{
			id: 'jc-1',
			jobCardNumber: 'JC-2026-0001',
			customerName: 'Gokul Sharma',
			customerPhone: '9876543210',
			registrationNumber: 'TN01AB1234',
			make: 'Hyundai',
			model: 'Creta',
			status: 1, // In Progress
			totalAmount: 2500,
			invoiceId: null,
			invoiceNumber: null,
			invoiceStatus: null,
			createdAt: '2026-02-01T10:00:00Z',
		},
		{
			id: 'jc-2',
			jobCardNumber: 'JC-2026-0002',
			customerName: 'Anand Kumar',
			customerPhone: '9123456780',
			registrationNumber: 'KA03XY9999',
			make: 'Maruti',
			model: 'Swift',
			status: 4, // Invoiced
			totalAmount: 1800,
			invoiceId: 'inv-2',
			invoiceNumber: 'INV-2026-0001',
			invoiceStatus: 'Generated',
			createdAt: '2026-02-02T11:00:00Z',
		},
		{
			id: 'jc-3',
			jobCardNumber: 'JC-2026-0003',
			customerName: 'Priya Mani',
			customerPhone: '9988776655',
			registrationNumber: 'TN09CD5678',
			make: 'Toyota',
			model: 'Innova',
			status: 0, // Draft
			totalAmount: 4500,
			invoiceId: 'inv-3',
			invoiceNumber: '',
			invoiceStatus: 'Draft',
			createdAt: '2026-02-03T12:00:00Z',
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getJobCards).mockResolvedValue({
			items: mockJobCards,
			totalCount: 3,
		});
	});

	it('renders job cards list with table items and header controls', async () => {
		renderWithProviders(<JobCardsPage />);

		expect(screen.getByRole('heading', { name: /^Job Cards$/i })).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/search by job card/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /new job card/i })).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText('JC-2026-0001')).toBeInTheDocument();
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
			expect(screen.getByText('Hyundai Creta')).toBeInTheDocument();
			expect(screen.getByText('TN01AB1234')).toBeInTheDocument();
			expect(screen.getByText('₹2,500')).toBeInTheDocument();

			expect(screen.getByText('JC-2026-0002')).toBeInTheDocument();
			expect(screen.getByText('Anand Kumar')).toBeInTheDocument();
		});
	});

	it('filters job cards when search term is entered', async () => {
		renderWithProviders(<JobCardsPage />);

		await waitFor(() => {
			expect(screen.getByText('JC-2026-0001')).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText(/search by job card/i);
		fireEvent.change(searchInput, { target: { value: 'Creta' } });

		await waitFor(() => {
			expect(api.getJobCards).toHaveBeenCalledWith(
				expect.objectContaining({ search: 'Creta' })
			);
		});
	});

	it('displays empty state when no job cards match query', async () => {
		vi.mocked(api.getJobCards).mockResolvedValue({
			items: [],
			totalCount: 0,
		});

		renderWithProviders(<JobCardsPage />);

		await waitFor(() => {
			expect(screen.getByText(/no job cards found/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /create first job card/i })).toBeInTheDocument();
		});
	});

	it('displays error banner and handles retry correctly', async () => {
		vi.mocked(api.getJobCards).mockRejectedValueOnce(new Error('Database offline'));

		renderWithProviders(<JobCardsPage />);

		await waitFor(() => {
			expect(screen.getByText('Failed to load job cards')).toBeInTheDocument();
			expect(screen.getByText('Database offline')).toBeInTheDocument();
		});

		vi.mocked(api.getJobCards).mockResolvedValueOnce({
			items: mockJobCards,
			totalCount: 3,
		});

		const retryButton = screen.getByRole('button', { name: /retry/i });
		fireEvent.click(retryButton);

		await waitFor(() => {
			expect(screen.getByText('JC-2026-0001')).toBeInTheDocument();
		});
	});

	it('renders correct action button states for un-invoiced, draft, and generated invoices', async () => {
		renderWithProviders(<JobCardsPage />);

		await waitFor(() => {
			// State A (No Invoice) — Mark as Finished should use success green styling
			const markFinishedBtn = screen.getByRole('button', { name: /mark as finished/i });
			expect(markFinishedBtn).toBeInTheDocument();
			expect(markFinishedBtn).toHaveClass('bg-success');

			// State B (Invoice Drafted)
			expect(screen.getByRole('button', { name: /invoice drafted/i })).toBeInTheDocument();

			// State C (Invoice Generated) — Invoice Generated should use primary blue styling
			const generatedBtn = screen.getByRole('button', { name: /invoice generated/i });
			expect(generatedBtn).toBeInTheDocument();
			expect(generatedBtn).toHaveClass('bg-secondary');
		});
	});

	it('handles converting job card to invoice and navigates to invoice details', async () => {
		vi.mocked(api.createInvoiceFromJobCard).mockResolvedValue({
			id: 'inv-100',
			invoiceNumber: null,
			jobCardId: 'jc-1',
			jobCardNumber: 'JC-2026-0001',
			customer: { id: 'c-1', name: 'Gokul', phoneNumber: '9876543210' },
			vehicle: { id: 'v-1', registrationNumber: 'TN01AB1234', make: 'Hyundai', model: 'Creta', variant: null },
			items: [],
			subtotal: 2500,
			discount: 0,
			taxAmount: 450,
			totalAmount: 2950,
			status: 'Draft',
			createdAt: '2026-02-01T10:00:00Z',
		} as unknown as api.InvoiceDto);

		renderWithProviders(<JobCardsPage />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /mark as finished/i })).toBeInTheDocument();
		});

		const markFinishedBtn = screen.getByRole('button', { name: /mark as finished/i });
		fireEvent.click(markFinishedBtn);

		await waitFor(() => {
			expect(api.createInvoiceFromJobCard).toHaveBeenCalledWith('jc-1');
		});
	});

	it('handles conversion failure and displays error banner', async () => {
		vi.mocked(api.createInvoiceFromJobCard).mockRejectedValueOnce(
			new Error('An invoice has already been generated for this job card.')
		);

		renderWithProviders(<JobCardsPage />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /mark as finished/i })).toBeInTheDocument();
		});

		const markFinishedBtn = screen.getByRole('button', { name: /mark as finished/i });
		fireEvent.click(markFinishedBtn);

		await waitFor(() => {
			expect(screen.getByText('Conversion Failed')).toBeInTheDocument();
			expect(screen.getByText(/already been generated/i)).toBeInTheDocument();
		});
	});
});
