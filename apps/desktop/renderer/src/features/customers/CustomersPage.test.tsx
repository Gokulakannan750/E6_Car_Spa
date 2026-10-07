import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { CustomersPage } from './CustomersPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-router-dom')>();
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getCustomers: vi.fn(),
		getVehiclesByCustomer: vi.fn(),
	};
});

describe('CustomersPage Component', () => {
	const mockCustomers: api.CustomerDto[] = [
		{
			id: 'cust-1',
			name: 'Gokul Sharma',
			phoneNumber: '9876543210',
			email: 'gokul@example.com',
			address: '123 Anna Salai, Chennai',
			createdAt: '2026-01-15T10:00:00Z',
			vehicleRegistrationNumbers: ['TN01AB1234', 'TN01CD5678'],
			invoiceCount: 10,
			totalInvoicedAmount: 15000,
			totalPaidAmount: 15000,
			totalOutstandingAmount: 0,
			paymentStatus: 'Paid',
		},
		{
			id: 'cust-2',
			name: 'Anand Kumar',
			phoneNumber: '9123456780',
			email: null,
			address: null,
			createdAt: '2026-02-01T12:00:00Z',
			vehicleRegistrationNumbers: ['KA03XY9999'],
			invoiceCount: 6,
			totalInvoicedAmount: 8500,
			totalPaidAmount: 7000,
			totalOutstandingAmount: 1500,
			paymentStatus: 'Payment Pending',
		},
		{
			id: 'cust-3',
			name: 'Rahul Varma',
			phoneNumber: '9888877770',
			email: 'rahul@example.com',
			address: null,
			createdAt: '2026-02-10T12:00:00Z',
			vehicleRegistrationNumbers: [],
			invoiceCount: 3,
			totalInvoicedAmount: 5000,
			totalPaidAmount: 3000,
			totalOutstandingAmount: 2000,
			paymentStatus: 'Payment Due',
		},
		{
			id: 'cust-4',
			name: 'Suresh Raina',
			phoneNumber: '9777766660',
			email: null,
			address: null,
			createdAt: '2026-02-15T12:00:00Z',
			vehicleRegistrationNumbers: [],
			invoiceCount: 0,
			totalInvoicedAmount: 0,
			totalPaidAmount: 0,
			totalOutstandingAmount: 0,
			paymentStatus: 'No Invoices',
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getCustomers).mockResolvedValue({
			items: mockCustomers,
			totalCount: 4,
			page: 1,
			pageSize: 100,
		});
		vi.mocked(api.getVehiclesByCustomer).mockResolvedValue([]);
	});

	it('marks only customers who agreed to WhatsApp updates', async () => {
		vi.mocked(api.getCustomers).mockResolvedValue({
			items: [
				{ ...mockCustomers[0], whatsAppConsent: true },
				{ ...mockCustomers[1], whatsAppConsent: false },
			],
			totalCount: 2,
			page: 1,
			pageSize: 100,
		});

		renderWithProviders(<CustomersPage />);

		expect(await screen.findByText('Gokul Sharma')).toBeInTheDocument();
		expect(screen.getAllByLabelText('Agreed to WhatsApp updates')).toHaveLength(1);
		const agreedRow = screen.getByText('9876543210').closest('tr') as HTMLElement;
		expect(agreedRow.querySelector('[aria-label="Agreed to WhatsApp updates"]')).not.toBeNull();
		const otherRow = screen.getByText('9123456780').closest('tr') as HTMLElement;
		expect(otherRow.querySelector('[aria-label="Agreed to WhatsApp updates"]')).toBeNull();
	});

	it('renders customer list page and displays customer items with invoices, outstanding, and payment status', async () => {
		renderWithProviders(<CustomersPage />);

		expect(screen.getByRole('heading', { name: /^Customers$/i })).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/search customers/i)).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
			expect(screen.getByText('9876543210')).toBeInTheDocument();
			expect(screen.getByText('Anand Kumar')).toBeInTheDocument();
			expect(screen.getByText('9123456780')).toBeInTheDocument();
			expect(screen.getByText('Rahul Varma')).toBeInTheDocument();
			expect(screen.getByText('Suresh Raina')).toBeInTheDocument();

			// Verify table headers
			expect(screen.getByRole('columnheader', { name: /^Invoices$/i })).toBeInTheDocument();
			expect(screen.getByRole('columnheader', { name: /^Outstanding$/i })).toBeInTheDocument();
			expect(screen.getByRole('columnheader', { name: /^Payment Status$/i })).toBeInTheDocument();

			// Verify status badges (appears in filter chips and table badges)
			expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(2);
			expect(screen.getAllByText('Payment Pending').length).toBeGreaterThanOrEqual(2);
			expect(screen.getAllByText('Payment Due').length).toBeGreaterThanOrEqual(2);
			expect(screen.getAllByText('No Invoices').length).toBeGreaterThanOrEqual(2);

			// Verify outstanding amounts formatted with rupee symbol
			expect(screen.getAllByText('₹0').length).toBe(2);
			expect(screen.getByText('₹1,500')).toBeInTheDocument();
			expect(screen.getByText('₹2,000')).toBeInTheDocument();

			// Verify invoice counts
			expect(screen.getByText('10')).toBeInTheDocument();
			expect(screen.getByText('6')).toBeInTheDocument();
			expect(screen.getByText('3')).toBeInTheDocument();
		});
	});

	it('filters customers by payment status when clicking status chips', async () => {
		renderWithProviders(<CustomersPage />);

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
		});

		// Click "Payment Due" chip
		const paymentDueChip = screen.getByRole('button', { name: 'Payment Due' });
		fireEvent.click(paymentDueChip);

		await waitFor(() => {
			expect(api.getCustomers).toHaveBeenCalledWith(
				expect.objectContaining({ paymentStatus: 'Payment Due' })
			);
		});

		// Click "Paid" chip
		const paidChip = screen.getByRole('button', { name: 'Paid' });
		fireEvent.click(paidChip);

		await waitFor(() => {
			expect(api.getCustomers).toHaveBeenCalledWith(
				expect.objectContaining({ paymentStatus: 'Paid' })
			);
		});
	});

	it('handles search input filter and fetches matching customers', async () => {
		renderWithProviders(<CustomersPage />);

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText(/search customers/i);
		fireEvent.change(searchInput, { target: { value: 'Gokul' } });

		await waitFor(() => {
			expect(api.getCustomers).toHaveBeenCalledWith(
				expect.objectContaining({ search: 'Gokul' })
			);
		});
	});

	it('displays empty state when no customer records exist', async () => {
		vi.mocked(api.getCustomers).mockResolvedValue({
			items: [],
			totalCount: 0,
			page: 1,
			pageSize: 100,
		});

		renderWithProviders(<CustomersPage />);

		await waitFor(() => {
			expect(screen.getByText('No customers found')).toBeInTheDocument();
		});
	});

	it('displays error state and retries fetching on retry button click', async () => {
		vi.mocked(api.getCustomers).mockRejectedValueOnce(new Error('Network failure'));

		renderWithProviders(<CustomersPage />);

		await waitFor(() => {
			expect(screen.getByText('Network failure')).toBeInTheDocument();
		});

		const retryBtn = screen.getByRole('button', { name: /retry/i });
		expect(retryBtn).toBeInTheDocument();

		// Mock success for retry
		vi.mocked(api.getCustomers).mockResolvedValueOnce({
			items: mockCustomers,
			totalCount: 2,
			page: 1,
			pageSize: 100,
		});

		fireEvent.click(retryBtn);

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
		});
	});

	it('navigates to dedicated Customer Details page when clicking a customer row', async () => {
		renderWithProviders(<CustomersPage />);

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
		});

		// Click customer table row
		const row = screen.getByText('Gokul Sharma').closest('tr')!;
		fireEvent.click(row);

		expect(mockNavigate).toHaveBeenCalledWith('/customers/cust-1');
	});

	it('opens Create Customer dialog when clicking Create Customer button', async () => {
		renderWithProviders(<CustomersPage />);

		const createButtons = screen.getAllByRole('button', { name: /create customer/i });
		fireEvent.click(createButtons[0]);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: /create customer/i })).toBeInTheDocument();
			expect(screen.getByPlaceholderText(/e\.g\. John Doe/i)).toBeInTheDocument();
		});
	});

	it('opens Edit Customer modal when clicking the Edit button', async () => {
		renderWithProviders(<CustomersPage />);

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
		});

		const editButtons = screen.getAllByTitle('Edit Customer');
		fireEvent.click(editButtons[0]);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: /edit customer/i })).toBeInTheDocument();
			expect(screen.getByDisplayValue('Gokul Sharma')).toBeInTheDocument();
		});
	});
});
