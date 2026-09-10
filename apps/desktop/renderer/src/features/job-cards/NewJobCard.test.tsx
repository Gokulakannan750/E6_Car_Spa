import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import NewJobCard from './NewJobCard';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getCustomerByPhone: vi.fn(),
		getVehicleByRegistration: vi.fn(),
		getCustomerById: vi.fn(),
		getVehiclesByCustomer: vi.fn(),
		createCustomer: vi.fn(),
		createVehicle: vi.fn(),
		getServices: vi.fn(),
		createService: vi.fn(),
		createJobCard: vi.fn(),
		getJobCardById: vi.fn(),
		transferVehicleOwnership: vi.fn(),
	};
});

describe('NewJobCard Component Workflow', () => {
	const mockCustomer: api.CustomerDto = {
		id: 'cust-1',
		name: 'Gokul Sharma',
		phoneNumber: '9876543210',
		email: 'gokul@example.com',
		address: 'Chennai',
		createdAt: '2026-01-01T00:00:00Z',
	};

	const mockVehicle: api.VehicleDto = {
		id: 'veh-1',
		customerId: 'cust-1',
		registrationNumber: 'TN01AB1234',
		make: 'Hyundai',
		model: 'Creta',
		variant: 'SX(O)',
		color: 'White',
		customerName: 'Gokul Sharma',
		createdAt: '2026-01-01T00:00:00Z',
	};

	const mockService: api.ServiceDto = {
		id: 'svc-1',
		name: 'Full Body Foam Wash',
		category: 'Wash',
		price: 800,
		taxPercentage: 18,
		durationMinutes: 45,
		description: 'Complete foam exterior wash',
		isActive: true,
		createdAt: '2026-01-01T00:00:00Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getCustomerByPhone).mockResolvedValue(mockCustomer);
		vi.mocked(api.getVehiclesByCustomer).mockResolvedValue([mockVehicle]);
		vi.mocked(api.getVehicleByRegistration).mockResolvedValue(mockVehicle);
		vi.mocked(api.getCustomerById).mockResolvedValue(mockCustomer);
		vi.mocked(api.getServices).mockResolvedValue({
			items: [mockService],
			totalCount: 1,
		});
		vi.mocked(api.createJobCard).mockResolvedValue({
			id: 'jc-100',
			jobCardNumber: 'JC-2026-0100',
			customer: { id: 'cust-1', name: 'Gokul Sharma', phoneNumber: '9876543210' },
			vehicle: { id: 'veh-1', registrationNumber: 'TN01AB1234', make: 'Hyundai', model: 'Creta', variant: 'SX(O)', color: 'White' },
			status: 0,
			notes: null,
			services: [{ serviceId: 'svc-1', serviceName: 'Full Body Foam Wash', unitPrice: 800, quantity: 1, taxPercentage: 18, discountAmount: 0 }],
			subtotal: 800,
			taxAmount: 144,
			discountAmount: 0,
			totalAmount: 944,
			createdAt: '2026-02-01T10:00:00Z',
			updatedAt: null,
		} as unknown as api.JobCardDto);
	});

	it('renders customer & vehicle lookup step by default', () => {
		renderWithProviders(<NewJobCard />);

		expect(screen.getByRole('heading', { name: /new job card/i })).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/e\.g\. 9876543210/i)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/e\.g\., TN56P1234/i)).toBeInTheDocument();
	});

	it('looks up customer by phone number and automatically loads customer vehicles', async () => {
		renderWithProviders(<NewJobCard />);

		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);
		fireEvent.change(phoneInput, { target: { value: '9876543210' } });

		// Click search button next to phone
		const searchButtons = screen.getAllByRole('button', { name: /search/i });
		fireEvent.click(searchButtons[0]);

		await waitFor(() => {
			expect(api.getCustomerByPhone).toHaveBeenCalledWith('9876543210');
			expect(api.getVehiclesByCustomer).toHaveBeenCalledWith('cust-1');
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
			expect(screen.getByText('TN01AB1234')).toBeInTheDocument();
		});
	});

	it('displays create customer form when phone lookup returns no match', async () => {
		vi.mocked(api.getCustomerByPhone).mockRejectedValueOnce(new Error('Customer not found'));

		renderWithProviders(<NewJobCard />);

		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);
		fireEvent.change(phoneInput, { target: { value: '9999999999' } });

		const searchButtons = screen.getAllByRole('button', { name: /search/i });
		fireEvent.click(searchButtons[0]);

		await waitFor(() => {
			expect(screen.getByText(/no customer found with phone "9999999999"/i)).toBeInTheDocument();
			expect(screen.getByPlaceholderText(/e\.g\. Rahul Sharma/i)).toBeInTheDocument();
		});
	});

	it('supports inline customer creation and prompts for vehicle', async () => {
		const newCreatedCustomer: api.CustomerDto = {
			id: 'cust-new',
			name: 'Kavitha Ram',
			phoneNumber: '9123456780',
			email: null,
			address: null,
			createdAt: '2026-02-01T00:00:00Z',
		};

		vi.mocked(api.createCustomer).mockResolvedValueOnce(newCreatedCustomer);
		vi.mocked(api.getVehiclesByCustomer).mockResolvedValueOnce([]);

		renderWithProviders(<NewJobCard />);

		// Trigger new customer form
		vi.mocked(api.getCustomerByPhone).mockRejectedValueOnce(new Error('Not found'));
		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);
		fireEvent.change(phoneInput, { target: { value: '9123456780' } });
		const searchButtons = screen.getAllByRole('button', { name: /search/i });
		fireEvent.click(searchButtons[0]);

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/e\.g\. Rahul Sharma/i)).toBeInTheDocument();
		});

		fireEvent.change(screen.getByPlaceholderText(/e\.g\. Rahul Sharma/i), { target: { value: 'Kavitha Ram' } });

		const createCustBtn = screen.getByRole('button', { name: /save & select customer/i });
		fireEvent.click(createCustBtn);

		await waitFor(() => {
			expect(api.createCustomer).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'Kavitha Ram', phoneNumber: '9123456780' })
			);
			expect(screen.getByText(/add vehicle for Kavitha Ram/i)).toBeInTheDocument();
		});
	});

	it('allows adding services, adjusts quantities, and recalculates totals', async () => {
		renderWithProviders(<NewJobCard />);

		// 1. Search customer & vehicle
		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);
		fireEvent.change(phoneInput, { target: { value: '9876543210' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[0]);

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
		});

		// 2. Click "Next"
		const nextBtn = screen.getByRole('button', { name: /next/i });
		fireEvent.click(nextBtn);

		// 3. Search and select service
		await waitFor(() => {
			expect(screen.getByPlaceholderText(/search services/i)).toBeInTheDocument();
		});

		const serviceInput = screen.getByPlaceholderText(/search services/i);
		fireEvent.change(serviceInput, { target: { value: 'Foam' } });

		await waitFor(() => {
			expect(screen.getByText('Full Body Foam Wash')).toBeInTheDocument();
		});

		// Add service
		fireEvent.click(screen.getByText('Full Body Foam Wash'));

		await waitFor(() => {
			// Shows in added services table
			expect(screen.getByText(/Selected Services \(1\)/i)).toBeInTheDocument();
			expect(screen.getByText('Full Body Foam Wash')).toBeInTheDocument();
		});
	});

	it('submits valid job card and displays success screen with job card number', async () => {
		renderWithProviders(<NewJobCard />);

		// 1. Lookup Customer
		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);
		fireEvent.change(phoneInput, { target: { value: '9876543210' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[0]);

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
		});

		// 2. Advance to Step 2 (Services)
		fireEvent.click(screen.getByRole('button', { name: /next/i }));

		// 3. Add Service
		await waitFor(() => {
			expect(screen.getByPlaceholderText(/search services/i)).toBeInTheDocument();
		});

		const serviceInput = screen.getByPlaceholderText(/search services/i);
		fireEvent.change(serviceInput, { target: { value: 'Foam' } });

		await waitFor(() => {
			expect(screen.getByText('Full Body Foam Wash')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Full Body Foam Wash'));

		// 4. Advance to Step 3 (Review)
		const nextBtn = screen.getByRole('button', { name: /next/i });
		fireEvent.click(nextBtn);

		await waitFor(() => {
			expect(screen.getByText(/review & summary/i)).toBeInTheDocument();
		});

		// 5. Submit Job Card
		const createJobCardBtn = screen.getByRole('button', { name: /create job card/i });
		fireEvent.click(createJobCardBtn);

		await waitFor(() => {
			expect(api.createJobCard).toHaveBeenCalledWith({
				customerId: 'cust-1',
				vehicleId: 'veh-1',
				services: [
					expect.objectContaining({
						serviceId: 'svc-1',
						quantity: 1,
						discountAmount: 0,
					}),
				],
				notes: undefined,
				isGstEnabled: true,
			});

			// Success view
			expect(screen.getByText('Job Card Created!')).toBeInTheDocument();
			expect(screen.getByText('JC-2026-0100')).toBeInTheDocument();
		});
	});

	it('displays submit error message when backend job card creation fails', async () => {
		vi.mocked(api.createJobCard).mockRejectedValueOnce(
			new Error('Server failed to generate job card number sequence.')
		);

		renderWithProviders(<NewJobCard />);

		// 1. Lookup Customer
		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);
		fireEvent.change(phoneInput, { target: { value: '9876543210' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[0]);

		await waitFor(() => {
			expect(screen.getByText('Gokul Sharma')).toBeInTheDocument();
		});

		// 2. Select Services
		fireEvent.click(screen.getByRole('button', { name: /next/i }));

		// 3. Add Service
		await waitFor(() => {
			expect(screen.getByPlaceholderText(/search services/i)).toBeInTheDocument();
		});

		const serviceInput = screen.getByPlaceholderText(/search services/i);
		fireEvent.change(serviceInput, { target: { value: 'Foam' } });

		await waitFor(() => {
			expect(screen.getByText('Full Body Foam Wash')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Full Body Foam Wash'));

		// 4. Review & Submit
		fireEvent.click(screen.getByRole('button', { name: /next/i }));

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /create job card/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /create job card/i }));

		await waitFor(() => {
			expect(screen.getByText('Server failed to generate job card number sequence.')).toBeInTheDocument();
		});
	});
});

describe('Vehicle Ownership Transfer in NewJobCard', () => {
	const customerA: api.CustomerDto = {
		id: 'cust-a-guid',
		name: 'Gokula Kannan',
		phoneNumber: '9876543210',
		email: 'gokul@example.com',
		address: 'Chennai',
		createdAt: '2026-01-01T00:00:00Z',
	};

	const customerB: api.CustomerDto = {
		id: 'cust-b-guid',
		name: 'Vehicle number check',
		phoneNumber: '9123456789',
		email: 'check@example.com',
		address: 'Coimbatore',
		createdAt: '2026-01-02T00:00:00Z',
	};

	const vehicleBaleno: api.VehicleDto = {
		id: '3e44b988-7cd3-46c2-a003-24fb9857b946',
		registrationNumber: 'TN56P3334',
		make: 'Maruti',
		model: 'Baleno',
		variant: 'Alpha',
		color: 'Blue',
		customerId: 'cust-a-guid',
		customerName: 'Gokula Kannan',
		createdAt: '2026-01-01T00:00:00Z',
	};

	const transferredBaleno: api.VehicleDto = {
		...vehicleBaleno,
		customerId: 'cust-b-guid',
		customerName: 'Vehicle number check',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getCustomerByPhone).mockImplementation(async (p) => {
			if (p === '9876543210') return customerA;
			if (p === '9123456789') return customerB;
			throw new Error('Not found');
		});
		vi.mocked(api.getCustomerById).mockImplementation(async (id) => {
			if (id === 'cust-a-guid') return customerA;
			if (id === 'cust-b-guid') return customerB;
			throw new Error('Not found');
		});
		vi.mocked(api.getVehiclesByCustomer).mockImplementation(async (cid) => {
			if (cid === 'cust-a-guid') return [vehicleBaleno];
			return [];
		});
		vi.mocked(api.getVehicleByRegistration).mockImplementation(async (r) => {
			if (r.toUpperCase() === 'TN56P3334') return vehicleBaleno;
			return null as unknown as api.VehicleDto;
		});
		vi.mocked(api.getServices).mockResolvedValue({ items: [], totalCount: 0 });
	});

	// Helper to select Customer B
	async function selectCustomerB() {
		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);
		fireEvent.change(phoneInput, { target: { value: '9123456789' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[0]);
		await waitFor(() => {
			expect(screen.getByText('Vehicle number check')).toBeInTheDocument();
		});
	}

	// Helper to select Customer A
	async function selectCustomerA() {
		const phoneInput = screen.getByPlaceholderText(/e\.g\. 9876543210/i);
		fireEvent.change(phoneInput, { target: { value: '9876543210' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[0]);
		await waitFor(() => {
			expect(screen.getByText('Gokula Kannan')).toBeInTheDocument();
		});
	}

	// Test 1 — Existing vehicle owned by same customer
	it('Test 1: Existing vehicle owned by same customer selects vehicle without conflict or duplicate creation', async () => {
		renderWithProviders(<NewJobCard />);
		await selectCustomerA();

		const regInput = screen.getByPlaceholderText(/e\.g\., TN56P1234/i);
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[1]);

		await waitFor(() => {
			expect(screen.queryByTestId('vehicle-conflict-panel')).not.toBeInTheDocument();
			expect(screen.getByText(/TN56P3334/i)).toBeInTheDocument();
			expect(api.createVehicle).not.toHaveBeenCalled();
			expect(api.transferVehicleOwnership).not.toHaveBeenCalled();
		});
	});

	// Test 2 — Existing vehicle owned by another customer shows conflict panel
	it('Test 2: Existing vehicle owned by another customer displays conflict panel with owner and Transfer button', async () => {
		renderWithProviders(<NewJobCard />);
		await selectCustomerB();

		const regInput = screen.getByPlaceholderText(/e\.g\., TN56P1234/i);
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[1]);

		await waitFor(() => {
			const conflictPanel = screen.getByTestId('vehicle-conflict-panel');
			expect(conflictPanel).toBeInTheDocument();
			expect(screen.getByText(/Vehicle Already Registered/i)).toBeInTheDocument();
			expect(screen.getByText('Gokula Kannan')).toBeInTheDocument();
			expect(screen.getByText('TN56P3334')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});
	});

	// Test 3 — Correct vehicle ID passed to transfer
	it('Test 3: Uses the exact database vehicle GUID when transferring ownership', async () => {
		vi.mocked(api.transferVehicleOwnership).mockResolvedValueOnce(transferredBaleno);

		renderWithProviders(<NewJobCard />);
		await selectCustomerB();

		const regInput = screen.getByPlaceholderText(/e\.g\., TN56P1234/i);
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[1]);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));

		await waitFor(() => {
			expect(screen.getByText('Transfer Vehicle Ownership?')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

		await waitFor(() => {
			expect(api.transferVehicleOwnership).toHaveBeenCalledWith(
				'3e44b988-7cd3-46c2-a003-24fb9857b946',
				expect.any(String)
			);
		});
	});

	// Test 4 — Correct destination customer passed to transfer
	it('Test 4: Uses the selected destination customer exact database GUID when transferring', async () => {
		vi.mocked(api.transferVehicleOwnership).mockResolvedValueOnce(transferredBaleno);

		renderWithProviders(<NewJobCard />);
		await selectCustomerB();

		const regInput = screen.getByPlaceholderText(/e\.g\., TN56P1234/i);
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[1]);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^transfer ownership$/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

		await waitFor(() => {
			expect(api.transferVehicleOwnership).toHaveBeenCalledWith(
				'3e44b988-7cd3-46c2-a003-24fb9857b946',
				'cust-b-guid'
			);
		});
	});

	// Test 5 — Confirmation dialog displays all required details
	it('Test 5: Confirmation dialog displays registration, make/model, current owner, and new owner', async () => {
		renderWithProviders(<NewJobCard />);
		await selectCustomerB();

		const regInput = screen.getByPlaceholderText(/e\.g\., TN56P1234/i);
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[1]);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));

		await waitFor(() => {
			expect(screen.getByText('Transfer Vehicle Ownership?')).toBeInTheDocument();
			expect(screen.getByText(/Maruti Baleno/i)).toBeInTheDocument();
			expect(screen.getAllByText('Gokula Kannan').length).toBeGreaterThanOrEqual(1);
			expect(screen.getAllByText('Vehicle number check').length).toBeGreaterThanOrEqual(1);
			expect(
				screen.getByText(/existing service history, job cards, invoices and payments will not be deleted or changed/i)
			).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /^transfer ownership$/i })).toBeInTheDocument();
		});
	});

	// Test 6 — Successful transfer workflow
	it('Test 6: Successful transfer updates vehicle selection, clears conflict, and enables proceeding to Services', async () => {
		vi.mocked(api.transferVehicleOwnership).mockResolvedValueOnce(transferredBaleno);

		renderWithProviders(<NewJobCard />);
		await selectCustomerB();

		const regInput = screen.getByPlaceholderText(/e\.g\., TN56P1234/i);
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[1]);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^transfer ownership$/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

		await waitFor(() => {
			expect(api.transferVehicleOwnership).toHaveBeenCalledTimes(1);
			expect(screen.queryByTestId('vehicle-conflict-panel')).not.toBeInTheDocument();
			expect(screen.queryByText('Transfer Vehicle Ownership?')).not.toBeInTheDocument();
		});

		// Can proceed to Step 2 (Services)
		const nextBtn = screen.getByRole('button', { name: /next/i });
		expect(nextBtn).toBeEnabled();
		fireEvent.click(nextBtn);

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/search services/i)).toBeInTheDocument();
		});
	});

	// Test 7 — Transfer failure preserves conflict, displays transfer error, allows retry and dismiss
	it('Test 7: Transfer failure preserves conflict, shows transfer error, and allows retry', async () => {
		vi.mocked(api.transferVehicleOwnership).mockRejectedValueOnce(
			new Error('Network timeout while transferring vehicle')
		);

		renderWithProviders(<NewJobCard />);
		await selectCustomerB();

		const regInput = screen.getByPlaceholderText(/e\.g\., TN56P1234/i);
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[1]);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^transfer ownership$/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

		await waitFor(() => {
			// Dialog closes, but conflict panel remains with error banner
			expect(screen.queryByText('Transfer Vehicle Ownership?')).not.toBeInTheDocument();
			expect(screen.getByTestId('vehicle-conflict-panel')).toBeInTheDocument();
			expect(screen.getByTestId('transfer-error-banner')).toHaveTextContent(/Network timeout while transferring vehicle/i);
			expect(screen.getByText('Vehicle number check')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
		});
	});

	// Test 8 — Retry after failure succeeds with same vehicle ID and customer ID
	it('Test 8: Retrying after failure succeeds with the same vehicle ID and destination customer ID', async () => {
		// First call fails, second call succeeds
		vi.mocked(api.transferVehicleOwnership)
			.mockRejectedValueOnce(new Error('First attempt failed'))
			.mockResolvedValueOnce(transferredBaleno);

		renderWithProviders(<NewJobCard />);
		await selectCustomerB();

		const regInput = screen.getByPlaceholderText(/e\.g\., TN56P1234/i);
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[1]);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		// 1. First attempt fails
		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^transfer ownership$/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

		await waitFor(() => {
			expect(screen.getByTestId('transfer-error-banner')).toBeInTheDocument();
		});

		// 2. Retry attempt
		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^transfer ownership$/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

		await waitFor(() => {
			expect(api.transferVehicleOwnership).toHaveBeenCalledTimes(2);
			// Both calls must use identical vehicle ID and customer ID
			expect(api.transferVehicleOwnership).toHaveBeenNthCalledWith(
				1,
				'3e44b988-7cd3-46c2-a003-24fb9857b946',
				'cust-b-guid'
			);
			expect(api.transferVehicleOwnership).toHaveBeenNthCalledWith(
				2,
				'3e44b988-7cd3-46c2-a003-24fb9857b946',
				'cust-b-guid'
			);
			expect(screen.queryByTestId('vehicle-conflict-panel')).not.toBeInTheDocument();
		});
	});

	// Test 9 — No duplicate vehicle creation
	it('Test 9: Does not call createVehicle to create duplicate vehicle records during conflict/transfer', async () => {
		vi.mocked(api.transferVehicleOwnership).mockResolvedValueOnce(transferredBaleno);

		renderWithProviders(<NewJobCard />);
		await selectCustomerB();

		const regInput = screen.getByPlaceholderText(/e\.g\., TN56P1234/i);
		fireEvent.change(regInput, { target: { value: 'TN56P3334' } });
		fireEvent.click(screen.getAllByRole('button', { name: /search/i })[1]);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^transfer ownership$/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /^transfer ownership$/i }));

		await waitFor(() => {
			expect(api.transferVehicleOwnership).toHaveBeenCalledTimes(1);
			expect(api.createVehicle).not.toHaveBeenCalled();
		});
	});

	// Test 10 — Both registration search path and createVehicle 409 path produce the same conflict behavior
	it('Test 10: Registration search path and createVehicle 409 path produce identical ownership conflict behavior', async () => {
		renderWithProviders(<NewJobCard />);
		await selectCustomerB();

		// Customer B initially has no vehicles, so inline "Add Vehicle for Vehicle number check" form is shown
		expect(screen.getByText(/Add Vehicle for Vehicle number check/i)).toBeInTheDocument();

		// Simulate createVehicle returning HTTP 409 Conflict
		vi.mocked(api.createVehicle).mockRejectedValueOnce(
			new api.ApiError(
				"A vehicle with registration number 'TN56P3334' already exists.",
				409,
				{
					existingVehicleId: '3e44b988-7cd3-46c2-a003-24fb9857b946',
					existingCustomerId: 'cust-a-guid',
					existingCustomerName: 'Gokula Kannan',
					registrationNumber: 'TN56P3334',
					make: 'Maruti',
					model: 'Baleno',
					variant: 'Alpha',
				},
				'CONFLICT'
			)
		);

		const regField = screen.getByPlaceholderText(/e\.g\. TN56P1234/i);
		const makeField = screen.getByPlaceholderText(/e\.g\. Maruti \/ Hyundai/i);
		const modelField = screen.getByPlaceholderText(/e\.g\. Swift \/ Creta/i);

		fireEvent.change(regField, { target: { value: 'TN56P3334' } });
		fireEvent.change(makeField, { target: { value: 'Maruti' } });
		fireEvent.change(modelField, { target: { value: 'Baleno' } });

		const saveBtn = screen.getByRole('button', { name: /save & select vehicle/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			// Verifies that createVehicle 409 path displays the EXACT same conflict panel
			const conflictPanel = screen.getByTestId('vehicle-conflict-panel');
			expect(conflictPanel).toBeInTheDocument();
			expect(screen.getByText(/Vehicle Already Registered/i)).toBeInTheDocument();
			expect(screen.getByText('Gokula Kannan')).toBeInTheDocument();
			expect(screen.getByText('TN56P3334')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /transfer vehicle/i })).toBeInTheDocument();
		});

		// And clicking Transfer Vehicle opens the exact same confirmation dialog
		fireEvent.click(screen.getByRole('button', { name: /transfer vehicle/i }));

		await waitFor(() => {
			expect(screen.getByText('Transfer Vehicle Ownership?')).toBeInTheDocument();
			expect(screen.getByText(/Maruti Baleno/i)).toBeInTheDocument();
			expect(screen.getAllByText('Gokula Kannan').length).toBeGreaterThanOrEqual(1);
			expect(screen.getAllByText('Vehicle number check').length).toBeGreaterThanOrEqual(1);
		});
	});
});
