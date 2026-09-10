import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { CreateCustomerModal } from './CreateCustomerModal';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		createCustomer: vi.fn(),
		createVehicle: vi.fn(),
		transferVehicleOwnership: vi.fn(),
		getVehicleByRegistration: vi.fn(),
	};
});

describe('CreateCustomerModal Component', () => {
	const mockOnClose = vi.fn();
	const mockOnSuccess = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders modal dialog when open is true', () => {
		renderWithProviders(
			<CreateCustomerModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
		);

		expect(screen.getByRole('heading', { name: /create customer/i })).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/e\.g\. John Doe/i)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/e\.g\. 9876543210/i)).toBeInTheDocument();
	});

	it('validates customer name and 10-digit phone number', async () => {
		renderWithProviders(
			<CreateCustomerModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
		);

		const submitBtn = screen.getByRole('button', { name: /^create customer$/i });
		const nameInput = screen.getByPlaceholderText(/e\.g\. John Doe/i);
		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);

		// 1. Submit with empty name
		fireEvent.click(submitBtn);
		expect(screen.getByText('Customer name is required.')).toBeInTheDocument();

		// 2. Submit with short phone number
		fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
		fireEvent.change(phoneInput, { target: { value: '9876' } });
		fireEvent.click(submitBtn);
		expect(screen.getByText('Phone number must be exactly 10 digits without country code.')).toBeInTheDocument();
	});

	it('validates email format if email is provided', async () => {
		renderWithProviders(
			<CreateCustomerModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
		);

		const submitBtn = screen.getByRole('button', { name: /^create customer$/i });
		const nameInput = screen.getByPlaceholderText(/e\.g\. John Doe/i);
		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);
		const emailInput = screen.getByPlaceholderText(/customer@example\.com/i);

		fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
		fireEvent.change(phoneInput, { target: { value: '9876543210' } });
		fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
		fireEvent.click(submitBtn);

		expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
	});

	it('validates vehicle fields when vehicle section is expanded', async () => {
		renderWithProviders(
			<CreateCustomerModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
		);

		const nameInput = screen.getByPlaceholderText(/e\.g\. John Doe/i);
		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);

		fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
		fireEvent.change(phoneInput, { target: { value: '9876543210' } });

		// Toggle vehicle section
		const toggleVehicleBtn = screen.getByRole('button', { name: /add vehicle details/i });
		fireEvent.click(toggleVehicleBtn);

		expect(screen.getByPlaceholderText(/e\.g\. TN 01 AB 1234/i)).toBeInTheDocument();

		const submitBtn = screen.getByRole('button', { name: /create customer & vehicle/i });
		fireEvent.click(submitBtn);

		expect(screen.getByText('Vehicle registration number is required when adding a vehicle.')).toBeInTheDocument();
	});

	it('successfully creates customer only when vehicle section is omitted', async () => {
		const newCustomer: api.CustomerDto = {
			id: 'cust-100',
			name: 'Priya Mani',
			phoneNumber: '9876543210',
			email: 'priya@example.com',
			address: 'Alwarpet, Chennai',
			createdAt: '2026-02-10T10:00:00Z',
		};

		vi.mocked(api.createCustomer).mockResolvedValue(newCustomer);

		renderWithProviders(
			<CreateCustomerModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
		);

		fireEvent.change(screen.getByPlaceholderText(/e\.g\. John Doe/i), { target: { value: 'Priya Mani' } });
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. 9876543210/i), { target: { value: '9876543210' } });
		fireEvent.change(screen.getByPlaceholderText(/customer@example\.com/i), { target: { value: 'priya@example.com' } });
		fireEvent.change(screen.getByPlaceholderText(/45 Greenways Rd/i), { target: { value: 'Alwarpet, Chennai' } });

		fireEvent.click(screen.getByRole('button', { name: /^create customer$/i }));

		await waitFor(() => {
			expect(api.createCustomer).toHaveBeenCalledWith({
				name: 'Priya Mani',
				phoneNumber: '9876543210',
				email: 'priya@example.com',
				address: 'Alwarpet, Chennai',
			});
			expect(mockOnSuccess).toHaveBeenCalledWith(newCustomer);
		});
	});

	it('successfully creates customer and vehicle when vehicle section is filled', async () => {
		const newCustomer: api.CustomerDto = {
			id: 'cust-200',
			name: 'Karthik Raja',
			phoneNumber: '9876543210',
			email: null,
			address: null,
			createdAt: '2026-02-10T10:00:00Z',
		};

		const newVehicle: api.VehicleDto = {
			id: 'veh-200',
			customerId: 'cust-200',
			registrationNumber: 'TN09AB1234',
			make: 'Hyundai',
			model: 'Creta',
			variant: 'SX',
			color: null,
			customerName: 'Karthik Raja',
			createdAt: '2026-02-10T10:00:00Z',
		};

		vi.mocked(api.createCustomer).mockResolvedValue(newCustomer);
		vi.mocked(api.createVehicle).mockResolvedValue(newVehicle);

		renderWithProviders(
			<CreateCustomerModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
		);

		fireEvent.change(screen.getByPlaceholderText(/e\.g\. John Doe/i), { target: { value: 'Karthik Raja' } });
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. 9876543210/i), { target: { value: '9876543210' } });

		// Open vehicle section
		fireEvent.click(screen.getByRole('button', { name: /add vehicle details/i }));

		fireEvent.change(screen.getByPlaceholderText(/e\.g\. TN 01 AB 1234/i), { target: { value: 'TN09AB1234' } });
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. Hyundai, Toyota/i), { target: { value: 'Hyundai' } });
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. Creta, Fortuner/i), { target: { value: 'Creta' } });
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. SX\(O\) Diesel/i), { target: { value: 'SX' } });

		fireEvent.click(screen.getByRole('button', { name: /create customer & vehicle/i }));

		await waitFor(() => {
			expect(api.createCustomer).toHaveBeenCalledWith({
				name: 'Karthik Raja',
				phoneNumber: '9876543210',
				email: null,
				address: null,
			});
			expect(api.createVehicle).toHaveBeenCalledWith({
				customerId: 'cust-200',
				registrationNumber: 'TN09AB1234',
				make: 'Hyundai',
				model: 'Creta',
				variant: 'SX',
			});
			expect(mockOnSuccess).toHaveBeenCalledWith(newCustomer);
		});
	});

	it('displays API error message when customer creation fails', async () => {
		vi.mocked(api.createCustomer).mockRejectedValue(
			new api.ApiError('A customer with this phone number already exists.', 409, {}, 'CONFLICT')
		);

		renderWithProviders(
			<CreateCustomerModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
		);

		fireEvent.change(screen.getByPlaceholderText(/e\.g\. John Doe/i), { target: { value: 'Duplicate Customer' } });
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. 9876543210/i), { target: { value: '9876543210' } });

		fireEvent.click(screen.getByRole('button', { name: /^create customer$/i }));

		await waitFor(() => {
			expect(screen.getByText('A customer with this phone number already exists.')).toBeInTheDocument();
		});
	});

	it('offers vehicle ownership transfer when vehicle is registered to another customer', async () => {
		const newCustomer: api.CustomerDto = {
			id: 'cust-b',
			name: 'Customer B',
			phoneNumber: '9876543210',
			email: null,
			address: null,
			createdAt: '2026-02-10T10:00:00Z',
		};

		const conflictError = new api.ApiError('Conflict', 409, {
			error: 'Vehicle already exists',
			existingVehicleId: 'veh-v',
			existingCustomerId: 'cust-a',
			existingCustomerName: 'Customer A',
			registrationNumber: 'TN56P3334',
			make: 'Maruti',
			model: 'Baleno',
		}, 'CONFLICT');

		vi.mocked(api.createCustomer).mockResolvedValueOnce(newCustomer);
		vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);
		vi.mocked(api.transferVehicleOwnership).mockResolvedValueOnce({
			id: 'veh-v',
			customerId: 'cust-b',
			registrationNumber: 'TN56P3334',
			make: 'Maruti',
			model: 'Baleno',
			variant: null,
			color: null,
			customerName: 'Customer B',
			createdAt: '2026-01-01T00:00:00Z',
		});

		renderWithProviders(
			<CreateCustomerModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
		);

		fireEvent.change(screen.getByPlaceholderText(/e\.g\. John Doe/i), { target: { value: 'Customer B' } });
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. 9876543210/i), { target: { value: '9876543210' } });

		// Open vehicle section
		fireEvent.click(screen.getByRole('button', { name: /add vehicle details/i }));
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. TN 01 AB 1234/i), { target: { value: 'TN56P3334' } });
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. Hyundai, Toyota/i), { target: { value: 'Maruti' } });
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. Creta, Fortuner/i), { target: { value: 'Baleno' } });

		fireEvent.click(screen.getByRole('button', { name: /create customer & vehicle/i }));

		// 1. Conflict message appears
		await waitFor(() => {
			expect(screen.getByText(/Vehicle TN56P3334 is already registered to Customer A\./i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		// 2. Open confirmation dialog
		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
		expect(screen.getByRole('heading', { name: /transfer vehicle ownership\?/i })).toBeInTheDocument();
		expect(screen.getAllByText('Customer A').length).toBeGreaterThanOrEqual(1);

		// 3. Cancel
		const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i });
		fireEvent.click(cancelButtons[cancelButtons.length - 1]);
		expect(api.transferVehicleOwnership).not.toHaveBeenCalled();

		// 4. Open again and Confirm transfer
		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
		fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

		await waitFor(() => {
			expect(api.transferVehicleOwnership).toHaveBeenCalledWith('veh-v', 'cust-b');
			expect(mockOnSuccess).toHaveBeenCalledWith(newCustomer);
		});
	});
});
