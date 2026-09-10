import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { EditCustomerModal } from './EditCustomerModal';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		updateCustomer: vi.fn(),
		getVehiclesByCustomer: vi.fn(),
		createVehicle: vi.fn(),
		updateVehicle: vi.fn(),
		transferVehicleOwnership: vi.fn(),
		getVehicleByRegistration: vi.fn(),
	};
});

describe('EditCustomerModal Component & Vehicle Uniqueness', () => {
	const mockOnClose = vi.fn();
	const mockOnSuccess = vi.fn();

	const mockCustomer: api.CustomerDto = {
		id: 'cust-1',
		name: 'John Doe',
		phoneNumber: '9876543210',
		email: 'john@example.com',
		address: '45 MG Road, Chennai',
		createdAt: '2026-01-10T10:00:00Z',
	};

	const mockExistingVehicles: api.VehicleDto[] = [
		{
			id: 'veh-1',
			customerId: 'cust-1',
			registrationNumber: 'TN01AB1000',
			make: 'Maruti',
			model: 'Swift',
			variant: 'VXi',
			color: 'Red',
			customerName: 'John Doe',
			createdAt: '2026-01-10T10:00:00Z',
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getVehiclesByCustomer).mockResolvedValue(mockExistingVehicles);
		vi.mocked(api.updateCustomer).mockResolvedValue(mockCustomer);
		vi.mocked(api.createVehicle).mockResolvedValue({
			id: 'veh-2',
			customerId: 'cust-1',
			registrationNumber: 'TN01CD2000',
			make: 'Hyundai',
			model: 'Creta',
			variant: null,
			color: null,
			customerName: 'John Doe',
			createdAt: '2026-02-10T10:00:00Z',
		});
		vi.mocked(api.updateVehicle).mockResolvedValue(mockExistingVehicles[0]);
	});

	it('renders modal with pre-populated customer and vehicle data', async () => {
		renderWithProviders(
			<EditCustomerModal
				open={true}
				customer={mockCustomer}
				onClose={mockOnClose}
				onSuccess={mockOnSuccess}
			/>
		);

		expect(screen.getByRole('heading', { name: /edit customer & vehicle details/i })).toBeInTheDocument();
		expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
		expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
		expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByDisplayValue('TN01AB1000')).toBeInTheDocument();
			expect(screen.getByDisplayValue('Swift')).toBeInTheDocument();
		});
	});

	it('allows adding a new vehicle to an existing customer', async () => {
		renderWithProviders(
			<EditCustomerModal
				open={true}
				customer={mockCustomer}
				onClose={mockOnClose}
				onSuccess={mockOnSuccess}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('TN01AB1000')).toBeInTheDocument();
		});

		const addVehicleBtn = screen.getByRole('button', { name: /add vehicle/i });
		fireEvent.click(addVehicleBtn);

		expect(screen.getByText('Vehicle #2')).toBeInTheDocument();
		expect(screen.getByText('New')).toBeInTheDocument();

		const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
		const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
		const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

		fireEvent.change(regInputs[1], { target: { value: 'TN01CD2000' } });
		fireEvent.change(makeInputs[1], { target: { value: 'Hyundai' } });
		fireEvent.change(modelInputs[1], { target: { value: 'Creta' } });

		const saveBtn = screen.getByRole('button', { name: /save changes/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(api.createVehicle).toHaveBeenCalledWith({
				customerId: 'cust-1',
				registrationNumber: 'TN01CD2000',
				make: 'Hyundai',
				model: 'Creta',
				variant: null,
			});
			expect(mockOnSuccess).toHaveBeenCalled();
		});
	});

	it('handles HTTP 409 Conflict gracefully when duplicate vehicle registration number is submitted', async () => {
		const conflictMessage = "A vehicle with registration number 'TN01CD2000' is already registered to 'Ravi Kumar'.";
		const conflictError = new api.ApiError(conflictMessage, 409, { error: conflictMessage }, 'CONFLICT');

		vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);

		renderWithProviders(
			<EditCustomerModal
				open={true}
				customer={mockCustomer}
				onClose={mockOnClose}
				onSuccess={mockOnSuccess}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('TN01AB1000')).toBeInTheDocument();
		});

		// Add new vehicle with duplicate registration number
		fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

		const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
		const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
		const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

		fireEvent.change(regInputs[1], { target: { value: 'TN01CD2000' } });
		fireEvent.change(makeInputs[1], { target: { value: 'Hyundai' } });
		fireEvent.change(modelInputs[1], { target: { value: 'Creta' } });

		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		// Verify 409 Conflict message is displayed to the user
		await waitFor(() => {
			expect(screen.getByText(conflictMessage)).toBeInTheDocument();
		});

		// Verify modal did not crash and form inputs remain populated
		expect(regInputs[1]).toHaveValue('TN01CD2000');
		expect(mockOnSuccess).not.toHaveBeenCalled();

		// Verify user can correct the registration number and resubmit
		vi.mocked(api.createVehicle).mockResolvedValueOnce({
			id: 'veh-3',
			customerId: 'cust-1',
			registrationNumber: 'TN01CD9999',
			make: 'Hyundai',
			model: 'Creta',
			variant: null,
			color: null,
			customerName: 'John Doe',
			createdAt: '2026-02-10T10:00:00Z',
		});

		fireEvent.change(regInputs[1], { target: { value: 'TN01CD9999' } });
		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(api.createVehicle).toHaveBeenCalledWith(
				expect.objectContaining({ registrationNumber: 'TN01CD9999' })
			);
			expect(mockOnSuccess).toHaveBeenCalled();
		});
	});

	it('validates incomplete vehicle entries before submitting', async () => {
		renderWithProviders(
			<EditCustomerModal
				open={true}
				customer={mockCustomer}
				onClose={mockOnClose}
				onSuccess={mockOnSuccess}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('TN01AB1000')).toBeInTheDocument();
		});

		// Add empty vehicle row
		fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

		// Type make and model but omit registration number
		const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
		fireEvent.change(makeInputs[1], { target: { value: 'Toyota' } });

		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		expect(screen.getByText('Vehicle #2: Registration number is required.')).toBeInTheDocument();
		expect(api.updateCustomer).not.toHaveBeenCalled();
	});

	it('presents vehicle ownership transfer when vehicle is registered to another customer', async () => {
		const conflictError = new api.ApiError('Conflict', 409, {
			error: "Vehicle already exists",
			existingVehicleId: 'veh-99',
			existingCustomerId: 'cust-99',
			existingCustomerName: 'Customer A',
			registrationNumber: 'TN56P3334',
			make: 'Maruti',
			model: 'Baleno',
		}, 'CONFLICT');

		vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);
		vi.mocked(api.transferVehicleOwnership).mockResolvedValueOnce({
			id: 'veh-99',
			customerId: 'cust-1',
			registrationNumber: 'TN56P3334',
			make: 'Maruti',
			model: 'Baleno',
			variant: null,
			color: null,
			customerName: 'John Doe',
			createdAt: '2026-01-01T00:00:00Z',
		});

		renderWithProviders(
			<EditCustomerModal
				open={true}
				customer={mockCustomer}
				onClose={mockOnClose}
				onSuccess={mockOnSuccess}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('TN01AB1000')).toBeInTheDocument();
		});

		// Add vehicle with duplicate registration number belonging to Customer A
		fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

		const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
		const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
		const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

		fireEvent.change(regInputs[1], { target: { value: 'TN56P3334' } });
		fireEvent.change(makeInputs[1], { target: { value: 'Maruti' } });
		fireEvent.change(modelInputs[1], { target: { value: 'Baleno' } });

		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		// 1. Verify conflict alert with existing owner name and Transfer Vehicle action
		await waitFor(() => {
			expect(screen.getByText('Vehicle Already Registered')).toBeInTheDocument();
			expect(screen.getByText('TN56P3334')).toBeInTheDocument();
			expect(screen.getByText('Customer A')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
			expect(screen.queryByText(/the requested record could not be found/i)).not.toBeInTheDocument();
		});

		// 2. Click Transfer Vehicle -> confirmation dialog opens
		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));

		expect(screen.getByRole('heading', { name: /transfer vehicle ownership\?/i })).toBeInTheDocument();
		expect(screen.getAllByText('Customer A').length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText('Existing service history, job cards, invoices and payments will not be deleted or changed.')).toBeInTheDocument();

		// 3. Cancel transfer (second Cancel button is in the confirmation dialog)
		const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i });
		fireEvent.click(cancelButtons[cancelButtons.length - 1]);
		expect(api.transferVehicleOwnership).not.toHaveBeenCalled();

		// 4. Click Transfer Vehicle again and Confirm
		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
		const confirmBtn = screen.getByRole('button', { name: /^transfer ownership$/i });
		fireEvent.click(confirmBtn);

		await waitFor(() => {
			expect(api.transferVehicleOwnership).toHaveBeenCalledWith('veh-99', 'cust-1');
			expect(screen.getByText(/Vehicle TN56P3334 ownership transferred to John Doe\./i)).toBeInTheDocument();
		});
	});

	it('Test 1: vehicle ownership conflict does not show generic "Record Not Found" error', async () => {
		const conflictError = new api.ApiError('Conflict', 409, {
			error: "A vehicle with registration number 'TN56P3334' already exists.",
			existingVehicleId: 'veh-99',
			existingCustomerId: 'cust-99',
			existingCustomerName: 'Gokula Kannan',
			registrationNumber: 'TN56P3334',
			make: 'Maruti',
			model: 'Baleno',
		}, 'CONFLICT');

		vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);

		renderWithProviders(
			<EditCustomerModal
				open={true}
				customer={mockCustomer}
				onClose={mockOnClose}
				onSuccess={mockOnSuccess}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('TN01AB1000')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

		const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
		const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
		const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

		fireEvent.change(regInputs[1], { target: { value: 'TN56P3334' } });
		fireEvent.change(makeInputs[1], { target: { value: 'Maruti' } });
		fireEvent.change(modelInputs[1], { target: { value: 'Baleno' } });

		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(screen.getByText('Vehicle Already Registered')).toBeInTheDocument();
			expect(screen.getByText('Gokula Kannan')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		// The generic error "The requested record could not be found." MUST NOT appear
		expect(screen.queryByText(/the requested record could not be found/i)).not.toBeInTheDocument();
	});

	it('Test 2: vehicle conflict remains actionable and dismissing clears conflict UI while preserving inputs', async () => {
		const conflictError = new api.ApiError('Conflict', 409, {
			error: "A vehicle with registration number 'TN56P3334' already exists.",
			existingVehicleId: 'veh-99',
			existingCustomerId: 'cust-99',
			existingCustomerName: 'Gokula Kannan',
			registrationNumber: 'TN56P3334',
			make: 'Maruti',
			model: 'Baleno',
		}, 'CONFLICT');

		vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);

		renderWithProviders(
			<EditCustomerModal
				open={true}
				customer={mockCustomer}
				onClose={mockOnClose}
				onSuccess={mockOnSuccess}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('TN01AB1000')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

		const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
		const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
		const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

		fireEvent.change(regInputs[1], { target: { value: 'TN56P3334' } });
		fireEvent.change(makeInputs[1], { target: { value: 'Maruti' } });
		fireEvent.change(modelInputs[1], { target: { value: 'Baleno' } });

		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(screen.getByText('Vehicle Already Registered')).toBeInTheDocument();
		});

		// Dismiss works
		const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
		fireEvent.click(dismissBtn);

		// Conflict panel is removed
		expect(screen.queryByText('Vehicle Already Registered')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /transfer vehicle/i })).not.toBeInTheDocument();

		// Form values remain preserved in the inputs
		expect(regInputs[1]).toHaveValue('TN56P3334');
		expect(makeInputs[1]).toHaveValue('Maruti');
		expect(modelInputs[1]).toHaveValue('Baleno');
	});

	it('Test 3: genuine 404 from an unrelated operation still displays its error message', async () => {
		const notFoundError = new api.ApiError(
			'The requested record could not be found.',
			404,
			{ error: 'Customer not found.' },
			'NOT_FOUND'
		);

		vi.mocked(api.updateCustomer).mockRejectedValueOnce(notFoundError);

		renderWithProviders(
			<EditCustomerModal
				open={true}
				customer={mockCustomer}
				onClose={mockOnClose}
				onSuccess={mockOnSuccess}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		// Genuine 404 error banner MUST display
		await waitFor(() => {
			expect(screen.getByText('The requested record could not be found.')).toBeInTheDocument();
		});

		// Conflict panel is NOT displayed
		expect(screen.queryByText('Vehicle Already Registered')).not.toBeInTheDocument();
	});

	it('Test 4: editing an existing vehicle with duplicate registration presents ownership conflict and clears generic error', async () => {
		const conflictError = new api.ApiError('Conflict', 409, {
			error: "A vehicle with registration number 'TN56P3334' already exists.",
			existingVehicleId: 'veh-99',
			existingCustomerId: 'cust-99',
			existingCustomerName: 'Gokula Kannan',
			registrationNumber: 'TN56P3334',
			make: 'Maruti',
			model: 'Baleno',
		}, 'CONFLICT');

		vi.mocked(api.updateVehicle).mockRejectedValueOnce(conflictError);

		renderWithProviders(
			<EditCustomerModal
				open={true}
				customer={mockCustomer}
				onClose={mockOnClose}
				onSuccess={mockOnSuccess}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('TN01AB1000')).toBeInTheDocument();
		});

		// Edit the existing vehicle's registration number
		const regInput = screen.getByDisplayValue('TN01AB1000');
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });

		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(screen.getByText('Vehicle Already Registered')).toBeInTheDocument();
			expect(screen.getByText('Gokula Kannan')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		// Generic error banner MUST NOT be displayed
		expect(screen.queryByText(/the requested record could not be found/i)).not.toBeInTheDocument();
	});

	describe('Vehicle Ownership Transfer Invariants & Regression Tests', () => {
		const customerB: api.CustomerDto = {
			id: 'cust-b',
			name: 'Vehicle number check',
			phoneNumber: '9876543211',
			email: 'check@example.com',
			address: 'Anna Nagar, Chennai',
			createdAt: '2026-02-01T10:00:00Z',
		};

		it('Test 1 — Correct conflict vehicle: 409 for TN56P3334 displays registration and owner Gokula Kannan', async () => {
			const conflictError = new api.ApiError('Conflict', 409, {
				error: "A vehicle with registration number 'TN56P3334' already exists.",
				existingVehicleId: 'veh-99',
				existingCustomerId: 'cust-gokula',
				existingCustomerName: 'Gokula Kannan',
				registrationNumber: 'TN56P3334',
				make: 'Maruti',
				model: 'Baleno',
			}, 'CONFLICT');

			vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);

			renderWithProviders(
				<EditCustomerModal
					open={true}
					customer={customerB}
					onClose={mockOnClose}
					onSuccess={mockOnSuccess}
				/>
			);

			await waitFor(() => {
				expect(screen.getByDisplayValue('Vehicle number check')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

			const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
			const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
			const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

			fireEvent.change(regInputs[regInputs.length - 1], { target: { value: 'TN56P3334' } });
			fireEvent.change(makeInputs[makeInputs.length - 1], { target: { value: 'Maruti' } });
			fireEvent.change(modelInputs[modelInputs.length - 1], { target: { value: 'Baleno' } });

			fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByText('Vehicle Already Registered')).toBeInTheDocument();
				expect(screen.getByText('TN56P3334')).toBeInTheDocument();
				expect(screen.getByText('Gokula Kannan')).toBeInTheDocument();
			});
		});

		it('Test 2 — Confirmation uses same vehicle: confirmation modal displays TN56P3334, Maruti Baleno, Gokula Kannan, and New Owner', async () => {
			const conflictError = new api.ApiError('Conflict', 409, {
				error: "A vehicle with registration number 'TN56P3334' already exists.",
				existingVehicleId: 'veh-99',
				existingCustomerId: 'cust-gokula',
				existingCustomerName: 'Gokula Kannan',
				registrationNumber: 'TN56P3334',
				make: 'Maruti',
				model: 'Baleno',
			}, 'CONFLICT');

			vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);

			renderWithProviders(
				<EditCustomerModal
					open={true}
					customer={customerB}
					onClose={mockOnClose}
					onSuccess={mockOnSuccess}
				/>
			);

			await waitFor(() => {
				expect(screen.getByDisplayValue('Vehicle number check')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

			const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
			const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
			const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

			fireEvent.change(regInputs[regInputs.length - 1], { target: { value: 'TN56P3334' } });
			fireEvent.change(makeInputs[makeInputs.length - 1], { target: { value: 'Maruti' } });
			fireEvent.change(modelInputs[modelInputs.length - 1], { target: { value: 'Baleno' } });

			fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));

			// Check confirmation modal fields
			expect(screen.getByRole('heading', { name: /transfer vehicle ownership\?/i })).toBeInTheDocument();
			const dialog = screen.getByRole('heading', { name: /transfer vehicle ownership\?/i }).closest('.relative');
			expect(dialog).toHaveTextContent('TN56P3334');
			expect(dialog).toHaveTextContent(/Maruti Baleno/i);
			expect(dialog).toHaveTextContent('Gokula Kannan');
			expect(dialog).toHaveTextContent('Vehicle number check');

			// It must NOT show another vehicle
			expect(screen.queryByText('TN11AS1123')).not.toBeInTheDocument();
			expect(screen.queryByText('ads a')).not.toBeInTheDocument();
			expect(screen.queryByText('sync test')).not.toBeInTheDocument();
		});

		it('Test 3 — Correct vehicle ID passed to transfer API: transferVehicleOwnership receives exact ID from 409 conflict', async () => {
			const conflictError = new api.ApiError('Conflict', 409, {
				error: "A vehicle with registration number 'TN56P3334' already exists.",
				existingVehicleId: 'veh-99-exact',
				existingCustomerId: 'cust-gokula',
				existingCustomerName: 'Gokula Kannan',
				registrationNumber: 'TN56P3334',
				make: 'Maruti',
				model: 'Baleno',
			}, 'CONFLICT');

			vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);
			vi.mocked(api.transferVehicleOwnership).mockResolvedValueOnce({
				id: 'veh-99-exact',
				customerId: 'cust-b',
				registrationNumber: 'TN56P3334',
				make: 'Maruti',
				model: 'Baleno',
				variant: null,
				color: null,
				customerName: 'Vehicle number check',
				createdAt: '2026-01-01T00:00:00Z',
			});

			renderWithProviders(
				<EditCustomerModal
					open={true}
					customer={customerB}
					onClose={mockOnClose}
					onSuccess={mockOnSuccess}
				/>
			);

			await waitFor(() => {
				expect(screen.getByDisplayValue('Vehicle number check')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

			const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
			const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
			const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

			fireEvent.change(regInputs[regInputs.length - 1], { target: { value: 'TN56P3334' } });
			fireEvent.change(makeInputs[makeInputs.length - 1], { target: { value: 'Maruti' } });
			fireEvent.change(modelInputs[modelInputs.length - 1], { target: { value: 'Baleno' } });

			fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
			fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

			await waitFor(() => {
				expect(api.transferVehicleOwnership).toHaveBeenCalledWith('veh-99-exact', 'cust-b');
			});
		});

		it('Test 4 — Transfer failure preserves conflict: transfer error is visible, conflict remains actionable, form values intact', async () => {
			const conflictError = new api.ApiError('Conflict', 409, {
				error: "A vehicle with registration number 'TN56P3334' already exists.",
				existingVehicleId: 'veh-99',
				existingCustomerId: 'cust-gokula',
				existingCustomerName: 'Gokula Kannan',
				registrationNumber: 'TN56P3334',
				make: 'Maruti',
				model: 'Baleno',
			}, 'CONFLICT');

			vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);
			vi.mocked(api.transferVehicleOwnership).mockRejectedValueOnce(
				new api.ApiError('Network connection timeout during transfer.', 500, {}, 'SERVER_ERROR')
			);

			renderWithProviders(
				<EditCustomerModal
					open={true}
					customer={customerB}
					onClose={mockOnClose}
					onSuccess={mockOnSuccess}
				/>
			);

			await waitFor(() => {
				expect(screen.getByDisplayValue('Vehicle number check')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

			const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
			const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
			const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

			fireEvent.change(regInputs[regInputs.length - 1], { target: { value: 'TN56P3334' } });
			fireEvent.change(makeInputs[makeInputs.length - 1], { target: { value: 'Maruti' } });
			fireEvent.change(modelInputs[modelInputs.length - 1], { target: { value: 'Baleno' } });

			fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
			fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

			// Verify after failure:
			await waitFor(() => {
				// 1. Conflict card remains available
				expect(screen.getByText('Vehicle Already Registered')).toBeInTheDocument();
				// 2. Transfer error is visibly displayed
				expect(screen.getByText(/Transfer failed: Network connection timeout during transfer\./i)).toBeInTheDocument();
				// 3. Transfer Vehicle button remains available for retry
				expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
			});

			// 4. Form values remain intact
			expect(regInputs[regInputs.length - 1]).toHaveValue('TN56P3334');
			expect(makeInputs[makeInputs.length - 1]).toHaveValue('Maruti');
			expect(modelInputs[modelInputs.length - 1]).toHaveValue('Baleno');

			// 5. No false success state occurs
			expect(screen.queryByText(/ownership transferred/i)).not.toBeInTheDocument();
		});

		it('Test 5 — Transfer retry: first failure preserves conflict, second attempt transfers successfully and clears error', async () => {
			const conflictError = new api.ApiError('Conflict', 409, {
				error: "A vehicle with registration number 'TN56P3334' already exists.",
				existingVehicleId: 'veh-99-retry',
				existingCustomerId: 'cust-gokula',
				existingCustomerName: 'Gokula Kannan',
				registrationNumber: 'TN56P3334',
				make: 'Maruti',
				model: 'Baleno',
			}, 'CONFLICT');

			vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictError);
			// 1st attempt fails, 2nd attempt succeeds
			vi.mocked(api.transferVehicleOwnership)
				.mockRejectedValueOnce(new Error('Temporary server error'))
				.mockResolvedValueOnce({
					id: 'veh-99-retry',
					customerId: 'cust-b',
					registrationNumber: 'TN56P3334',
					make: 'Maruti',
					model: 'Baleno',
					variant: null,
					color: null,
					customerName: 'Vehicle number check',
					createdAt: '2026-01-01T00:00:00Z',
				});

			renderWithProviders(
				<EditCustomerModal
					open={true}
					customer={customerB}
					onClose={mockOnClose}
					onSuccess={mockOnSuccess}
				/>
			);

			await waitFor(() => {
				expect(screen.getByDisplayValue('Vehicle number check')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

			const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
			const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
			const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

			fireEvent.change(regInputs[regInputs.length - 1], { target: { value: 'TN56P3334' } });
			fireEvent.change(makeInputs[makeInputs.length - 1], { target: { value: 'Maruti' } });
			fireEvent.change(modelInputs[modelInputs.length - 1], { target: { value: 'Baleno' } });

			fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
			});

			// Attempt 1 -> Fails
			fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
			fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

			await waitFor(() => {
				expect(screen.getByText(/Transfer failed: Temporary server error/i)).toBeInTheDocument();
				expect(screen.getByText('Vehicle Already Registered')).toBeInTheDocument();
			});

			// Attempt 2 -> Retry succeeds
			fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
			expect(screen.getByRole('heading', { name: /transfer vehicle ownership\?/i })).toBeInTheDocument();
			fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

			await waitFor(() => {
				// Both calls must use the SAME vehicle ID
				expect(api.transferVehicleOwnership).toHaveBeenNthCalledWith(1, 'veh-99-retry', 'cust-b');
				expect(api.transferVehicleOwnership).toHaveBeenNthCalledWith(2, 'veh-99-retry', 'cust-b');

				// Conflict card and transfer error are cleared
				expect(screen.queryByText('Vehicle Already Registered')).not.toBeInTheDocument();
				expect(screen.queryByText(/Transfer failed:/i)).not.toBeInTheDocument();

				// Success feedback is displayed
				expect(screen.getByText(/Vehicle TN56P3334 ownership transferred to Vehicle number check\./i)).toBeInTheDocument();
			});
		});

		it('Test 6 — No unrelated vehicle contamination: with multiple vehicles available, conflict and transfer only target Vehicle B', async () => {
			// Customer B has existing Vehicle A: TN11AS1123, ads, a
			const vehiclesWithA: api.VehicleDto[] = [
				{
					id: 'veh-a-id',
					customerId: 'cust-b',
					registrationNumber: 'TN11AS1123',
					make: 'ads',
					model: 'a',
					variant: null,
					color: null,
					customerName: 'sync test',
					createdAt: '2026-01-01T00:00:00Z',
				},
			];
			vi.mocked(api.getVehiclesByCustomer).mockResolvedValueOnce(vehiclesWithA);

			// Conflict specifically for Vehicle B: TN56P3334, Maruti Baleno, Gokula Kannan
			const conflictErrorB = new api.ApiError('Conflict', 409, {
				error: "A vehicle with registration number 'TN56P3334' already exists.",
				existingVehicleId: 'veh-b-id',
				existingCustomerId: 'cust-gokula',
				existingCustomerName: 'Gokula Kannan',
				registrationNumber: 'TN56P3334',
				make: 'Maruti',
				model: 'Baleno',
			}, 'CONFLICT');

			vi.mocked(api.createVehicle).mockRejectedValueOnce(conflictErrorB);
			vi.mocked(api.transferVehicleOwnership).mockResolvedValueOnce({
				id: 'veh-b-id',
				customerId: 'cust-b',
				registrationNumber: 'TN56P3334',
				make: 'Maruti',
				model: 'Baleno',
				variant: null,
				color: null,
				customerName: 'Vehicle number check',
				createdAt: '2026-01-02T00:00:00Z',
			});

			renderWithProviders(
				<EditCustomerModal
					open={true}
					customer={customerB}
					onClose={mockOnClose}
					onSuccess={mockOnSuccess}
				/>
			);

			// Verify Vehicle A is loaded in the form
			await waitFor(() => {
				expect(screen.getByDisplayValue('TN11AS1123')).toBeInTheDocument();
				expect(screen.getByDisplayValue('ads')).toBeInTheDocument();
			});

			// User adds Vehicle B
			fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

			const regInputs = screen.getAllByPlaceholderText(/e\.g\. TN56P3334/i);
			const makeInputs = screen.getAllByPlaceholderText(/e\.g\. Maruti, Hyundai/i);
			const modelInputs = screen.getAllByPlaceholderText(/e\.g\. Baleno, Creta/i);

			fireEvent.change(regInputs[1], { target: { value: 'TN56P3334' } });
			fireEvent.change(makeInputs[1], { target: { value: 'Maruti' } });
			fireEvent.change(modelInputs[1], { target: { value: 'Baleno' } });

			fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

			// Conflict card specifically targets Vehicle B
			await waitFor(() => {
				expect(screen.getByText('Vehicle Already Registered')).toBeInTheDocument();
				expect(screen.getByText('TN56P3334')).toBeInTheDocument();
				expect(screen.getByText('Gokula Kannan')).toBeInTheDocument();
			});

			// Open confirmation modal
			fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));

			// Verify confirmation modal MUST show Vehicle B, and NOT Vehicle A
			expect(screen.getByRole('heading', { name: /transfer vehicle ownership\?/i })).toBeInTheDocument();
			const dialog = screen.getByRole('heading', { name: /transfer vehicle ownership\?/i }).closest('.relative');
			expect(dialog).toHaveTextContent('TN56P3334');
			expect(dialog).toHaveTextContent(/Maruti Baleno/i);
			expect(dialog).toHaveTextContent('Gokula Kannan');
			expect(dialog).toHaveTextContent('Vehicle number check');

			// Unrelated vehicle contamination assertions:
			// In the confirmation dialog, Vehicle A data must not appear
			expect(dialog).not.toHaveTextContent('TN11AS1123');
			expect(dialog).not.toHaveTextContent('ads a');
			expect(dialog).not.toHaveTextContent('sync test');

			// Confirm transfer
			fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

			await waitFor(() => {
				// Exact vehicle ID for Vehicle B ('veh-b-id') is passed, NOT Vehicle A ('veh-a-id')
				expect(api.transferVehicleOwnership).toHaveBeenCalledWith('veh-b-id', 'cust-b');
				expect(api.transferVehicleOwnership).not.toHaveBeenCalledWith('veh-a-id', expect.anything());
			});
		});
	});
});

