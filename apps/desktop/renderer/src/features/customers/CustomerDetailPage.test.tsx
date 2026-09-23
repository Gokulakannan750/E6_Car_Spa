import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { CustomerDetailPage } from './CustomerDetailPage';
import { renderWithProviders, createTestQueryClient } from '../../test/test-utils';
import * as api from '../../lib/api';

const mockNavigate = vi.fn();
let mockParams = { id: 'cust-1' };

vi.mock('react-router-dom', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-router-dom')>();
	return {
		...actual,
		useParams: () => mockParams,
		useNavigate: () => mockNavigate,
	};
});

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getCustomerById: vi.fn(),
		getVehiclesByCustomer: vi.fn(),
		getCustomerHistory: vi.fn(),
	};
});

describe('CustomerDetailPage Component', () => {
	const mockCustomer: api.CustomerDto = {
		id: 'cust-1',
		name: 'Rahul Dravid',
		phoneNumber: '9876543210',
		email: 'rahul@example.com',
		address: '742 Evergreen Terrace, Bengaluru',
		createdAt: '2026-01-15T10:00:00Z',
		vehicleRegistrationNumbers: ['KA01AB1234'],
	};

	const mockVehicles: api.VehicleDto[] = [
		{
			id: 'veh-1',
			customerId: 'cust-1',
			registrationNumber: 'KA01AB1234',
			make: 'Maruti Suzuki',
			model: 'Swift',
			variant: 'ZXi',
			color: 'Red',
			customerName: 'Rahul Dravid',
			createdAt: '2026-01-15T10:00:00Z',
		},
	];

	// Invoice-centric history (JobCards without invoice are NOT present in financial history)
	const mockHistory: api.CustomerHistoryResponse = {
		customerId: 'cust-1',
		customerName: 'Rahul Dravid',
		phoneNumber: '9876543210',
		totalJobCards: 3,
		totalVehicles: 1,
		totalOutstandingAmount: 12938.8,
		totalPaidAmount: 9852.9,
		totalInvoicedAmount: 22791.7,
		jobCards: [
			{
				jobCardId: 'jc-1',
				jobCardNumber: 'JC-2026-000028',
				createdAt: '2026-09-21T10:00:00Z',
				status: 'PartiallyPaid',
				vehicleNumber: 'KA01AB1234',
				vehicleModel: 'Maruti Suzuki Swift',
				subtotal: 6000,
				taxAmount: 1085.9,
				discountAmount: 0,
				totalAmount: 7085.9,
				vehicles: [],
				invoiceId: 'inv-1',
				invoiceNumber: 'INV-2026-000028',
				invoiceStatus: 'PartiallyPaid',
				invoiceTotal: 7085.9,
				paidAmount: 2000,
				outstandingAmount: 5085.9,
				paymentStatus: 'Partially Paid',
			},
			{
				jobCardId: 'jc-2',
				jobCardNumber: 'JC-2026-000015',
				createdAt: '2026-09-20T10:00:00Z',
				status: 'Paid',
				vehicleNumber: 'KA01AB1234',
				vehicleModel: 'Maruti Suzuki Swift',
				subtotal: 7000,
				taxAmount: 852.9,
				discountAmount: 0,
				totalAmount: 7852.9,
				vehicles: [],
				invoiceId: 'inv-2',
				invoiceNumber: 'INV-2026-000015',
				invoiceStatus: 'Paid',
				invoiceTotal: 7852.9,
				paidAmount: 7852.9,
				outstandingAmount: 0,
				paymentStatus: 'Paid',
			},
			{
				jobCardId: 'jc-3',
				jobCardNumber: 'JC-2026-000005',
				createdAt: '2026-09-19T10:00:00Z',
				status: 'Generated',
				vehicleNumber: 'KA01AB1234',
				vehicleModel: 'Maruti Suzuki Swift',
				subtotal: 7000,
				taxAmount: 852.9,
				discountAmount: 0,
				totalAmount: 7852.9,
				vehicles: [],
				invoiceId: 'inv-3',
				invoiceNumber: 'INV-2026-000005',
				invoiceStatus: 'Generated',
				invoiceTotal: 7852.9,
				paidAmount: 0,
				outstandingAmount: 7852.9,
				paymentStatus: 'Payment Pending',
			},
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockParams = { id: 'cust-1' };
		vi.mocked(api.getCustomerById).mockResolvedValue(mockCustomer);
		vi.mocked(api.getVehiclesByCustomer).mockResolvedValue(mockVehicles);
		vi.mocked(api.getCustomerHistory).mockResolvedValue(mockHistory);
	});

	it('1. Customer Details page loads correctly with customer profile, vehicles, and history', async () => {
		renderWithProviders(<CustomerDetailPage />, { queryClient: createTestQueryClient() });

		await waitFor(() => {
			expect(screen.getByText('Rahul Dravid')).toBeInTheDocument();
			expect(screen.getAllByText('9876543210').length).toBeGreaterThanOrEqual(1);
			expect(screen.getByText('rahul@example.com')).toBeInTheDocument();
			expect(screen.getByText('742 Evergreen Terrace, Bengaluru')).toBeInTheDocument();
			expect(screen.getByText('KA01AB1234')).toBeInTheDocument();
			expect(screen.getByText('Maruti Suzuki Swift (ZXi) · Red')).toBeInTheDocument();
		});
	});

	it('2. Fully paid invoice displays invoice number as primary heading, [Paid] badge, and navigates on click', async () => {
		renderWithProviders(<CustomerDetailPage />, { queryClient: createTestQueryClient() });

		await waitFor(() => {
			expect(screen.getByText('INV-2026-000015')).toBeInTheDocument();
		});

		const inv15Card = screen.getByText('INV-2026-000015').closest<HTMLElement>('div.group')!;
		expect(inv15Card).toBeInTheDocument();

		// Badge is "Paid"
		expect(within(inv15Card).getByText('Paid')).toBeInTheDocument();
		// Secondary job card badge is present
		expect(within(inv15Card).getByText('JC-2026-000015')).toBeInTheDocument();

		// Clicking invoice number navigates to invoice detail page
		fireEvent.click(screen.getByText('INV-2026-000015'));
		expect(mockNavigate).toHaveBeenCalledWith('/invoices/inv-2');
	});

	it('3. Partially paid invoice displays [Partially Paid] badge with financial breakdown', async () => {
		renderWithProviders(<CustomerDetailPage />, { queryClient: createTestQueryClient() });

		await waitFor(() => {
			expect(screen.getByText('INV-2026-000028')).toBeInTheDocument();
		});

		const inv28Card = screen.getByText('INV-2026-000028').closest<HTMLElement>('div.group')!;
		expect(inv28Card).toBeInTheDocument();

		expect(within(inv28Card).getByText('Partially Paid')).toBeInTheDocument();
		expect(inv28Card.textContent).toContain('Total:');
		expect(inv28Card.textContent).toContain('7,085.90');
		expect(inv28Card.textContent).toContain('Paid:');
		expect(inv28Card.textContent).toContain('2,000.00');
		expect(inv28Card.textContent).toContain('Pending:');
		expect(inv28Card.textContent).toContain('5,085.90');
	});

	it('4. Invoices only: No fake Not Invoiced cards are displayed', async () => {
		renderWithProviders(<CustomerDetailPage />, { queryClient: createTestQueryClient() });

		await waitFor(() => {
			expect(screen.getByText('INV-2026-000028')).toBeInTheDocument();
		});

		expect(screen.queryByText('Not Invoiced')).not.toBeInTheDocument();
		expect(screen.queryByText('JC-2026-000014')).not.toBeInTheDocument();
	});

	it('5. Displays correct filter counts based on invoices (All: 3, Paid: 1, Payment Pending: 1, Partially Paid: 1)', async () => {
		renderWithProviders(<CustomerDetailPage />, { queryClient: createTestQueryClient() });

		await waitFor(() => {
			expect(screen.getByText('Recent Activity')).toBeInTheDocument();
		});

		expect(screen.getByRole('button', { name: /^All 3/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^Paid 1/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^Payment Pending 1/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^Partially Paid 1/i })).toBeInTheDocument();
	});

	it('6. Switching filter pills updates displayed invoice activity records', async () => {
		renderWithProviders(<CustomerDetailPage />, { queryClient: createTestQueryClient() });

		await waitFor(() => {
			expect(screen.getByText('INV-2026-000028')).toBeInTheDocument();
		});

		// Click "Paid" filter
		fireEvent.click(screen.getByRole('button', { name: /^Paid 1/i }));
		await waitFor(() => {
			expect(screen.getByText('INV-2026-000015')).toBeInTheDocument();
			expect(screen.queryByText('INV-2026-000028')).not.toBeInTheDocument();
			expect(screen.queryByText('INV-2026-000005')).not.toBeInTheDocument();
		});

		// Click "Payment Pending" filter
		fireEvent.click(screen.getByRole('button', { name: /^Payment Pending 1/i }));
		await waitFor(() => {
			expect(screen.getByText('INV-2026-000005')).toBeInTheDocument();
			expect(screen.queryByText('INV-2026-000015')).not.toBeInTheDocument();
			expect(screen.queryByText('INV-2026-000028')).not.toBeInTheDocument();
		});

		// Click "Partially Paid" filter
		fireEvent.click(screen.getByRole('button', { name: /^Partially Paid 1/i }));
		await waitFor(() => {
			expect(screen.getByText('INV-2026-000028')).toBeInTheDocument();
			expect(screen.queryByText('INV-2026-000015')).not.toBeInTheDocument();
			expect(screen.queryByText('INV-2026-000005')).not.toBeInTheDocument();
		});
	});

	it('7. Displays customer outstanding total when balance > 0', async () => {
		renderWithProviders(<CustomerDetailPage />, { queryClient: createTestQueryClient() });

		await waitFor(() => {
			expect(screen.getByText('Total Customer Balance')).toBeInTheDocument();
			expect(screen.getByText('Outstanding Balance')).toBeInTheDocument();
		});
		expect(screen.getAllByText(/12,938\.80/).length).toBeGreaterThanOrEqual(1);
	});

	it('8. Displays [All Settled] when total outstanding balance = 0', async () => {
		vi.mocked(api.getCustomerHistory).mockResolvedValue({
			...mockHistory,
			totalOutstandingAmount: 0,
		});

		renderWithProviders(<CustomerDetailPage />, { queryClient: createTestQueryClient() });

		await waitFor(() => {
			expect(screen.getByText('Total Customer Balance')).toBeInTheDocument();
			expect(screen.getByText('All Settled')).toBeInTheDocument();
		});
		expect(screen.getAllByText(/0\.00/).length).toBeGreaterThanOrEqual(1);
	});

	it('9. Back to Customers button navigates back to /customers', async () => {
		renderWithProviders(<CustomerDetailPage />, { queryClient: createTestQueryClient() });

		await waitFor(() => {
			expect(screen.getByText('Rahul Dravid')).toBeInTheDocument();
		});

		const backBtn = screen.getByRole('button', { name: /back to customers/i });
		fireEvent.click(backBtn);

		expect(mockNavigate).toHaveBeenCalledWith('/customers');
	});
});
