import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { CustomersPage } from './CustomersPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getCustomers: vi.fn(),
		getVehiclesByCustomer: vi.fn(),
		getJobCardsByCustomer: vi.fn(),
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
		},
		{
			id: 'cust-2',
			name: 'Anand Kumar',
			phoneNumber: '9123456780',
			email: null,
			address: null,
			createdAt: '2026-02-01T12:00:00Z',
			vehicleRegistrationNumbers: ['KA03XY9999'],
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getCustomers).mockResolvedValue({
			items: mockCustomers,
			totalCount: 2,
			page: 1,
			pageSize: 100,
		});
		vi.mocked(api.getVehiclesByCustomer).mockResolvedValue([]);
		vi.mocked(api.getJobCardsByCustomer).mockResolvedValue({
			items: [],
			totalCount: 0,
			page: 1,
			pageSize: 50,
		});
	});

	it('renders customer list page and displays customer items', async () => {
		renderWithProviders(<CustomersPage />);

		expect(screen.getByRole('heading', { name: /^Customers$/i })).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/search customers/i)).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
			expect(screen.getByText('9876543210')).toBeInTheDocument();
			expect(screen.getByText('Anand Kumar')).toBeInTheDocument();
			expect(screen.getByText('9123456780')).toBeInTheDocument();
			expect(screen.getByText('TN01AB1234')).toBeInTheDocument();
			expect(screen.getByText('TN01CD5678')).toBeInTheDocument();
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

	it('opens Customer Details modal when clicking a customer row', async () => {
		const mockVehicles: api.VehicleDto[] = [
			{
				id: 'veh-1',
				customerId: 'cust-1',
				registrationNumber: 'TN01AB1234',
				make: 'Hyundai',
				model: 'Creta',
				variant: 'SX(O)',
				color: 'White',
				customerName: 'Gokul Sharma',
				createdAt: '2026-01-15T10:00:00Z',
			},
		];

		vi.mocked(api.getVehiclesByCustomer).mockResolvedValue(mockVehicles);

		renderWithProviders(<CustomersPage />);

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
		});

		// Click customer table row
		const row = screen.getByText('Gokul Sharma').closest('tr')!;
		fireEvent.click(row);

		await waitFor(() => {
			expect(screen.getByText('123 Anna Salai, Chennai')).toBeInTheDocument();
			expect(screen.getByText(/Hyundai Creta/i)).toBeInTheDocument();
		});
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
