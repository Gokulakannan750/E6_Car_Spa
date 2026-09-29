import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import JobCardDetails from './JobCardDetails';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getJobCardById: vi.fn(),
		updateJobCardServices: vi.fn(),
		getServices: vi.fn(),
		createService: vi.fn(),
		getOutsideJobsByJobCardId: vi.fn(),
		getVendors: vi.fn(),
		createOutsideJob: vi.fn(),
		markOutsideJobReturned: vi.fn(),
	};
});

describe('JobCardDetails Component & Lifecycle States', () => {
	const mockJobCard: api.JobCardDto = {
		id: 'jc-1',
		jobCardNumber: 'JC-2026-0001',
		customer: {
			id: 'cust-1',
			name: 'Gokul Sharma',
			phoneNumber: '9876543210',
		},
		vehicle: {
			id: 'veh-1',
			registrationNumber: 'TN01AB1234',
			make: 'Hyundai',
			model: 'Creta',
			variant: 'SX(O)',
			color: 'White',
		},
		status: 1, // In Progress (unlocked)
		notes: 'Special care for ceramic coating',
		services: [
			{
				id: 'jcs-1',
				serviceId: 'svc-1',
				serviceName: 'Full Body Foam Wash',
				unitPrice: 800,
				quantity: 1,
				taxPercentage: 18,
				discountAmount: 0,
			},
			{
				id: 'jcs-2',
				serviceId: 'svc-2',
				serviceName: 'Interior Deep Clean',
				unitPrice: 1500,
				quantity: 1,
				taxPercentage: 18,
				discountAmount: 0,
			},
		],
		subtotal: 2300,
		taxAmount: 414,
		discountAmount: 0,
		totalAmount: 2714,
		invoiceId: null,
		invoiceNumber: null,
		invoiceStatus: null,
		createdAt: '2026-02-01T10:00:00Z',
		updatedAt: null,
	};

	const mockCatalogServices: api.ServiceDto[] = [
		{
			id: 'svc-3',
			name: 'Windshield Polishing',
			category: 'Glass Care',
			price: 600,
			taxPercentage: 18,
			durationMinutes: 30,
			description: 'Clear water spot removal',
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getJobCardById).mockResolvedValue(mockJobCard);
		vi.mocked(api.getServices).mockResolvedValue({
			items: mockCatalogServices,
			totalCount: 1,
		});
		vi.mocked(api.updateJobCardServices).mockResolvedValue({
			...mockJobCard,
			subtotal: 3100,
		});
		vi.mocked(api.getOutsideJobsByJobCardId).mockResolvedValue([]);
		vi.mocked(api.getVendors).mockResolvedValue([]);
	});

	it('renders job card details with customer, vehicle, and line items', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByText('JC-2026-0001')).toBeInTheDocument();
			expect(screen.getByText('In Progress')).toBeInTheDocument();
			expect(screen.getAllByText('Gokul Sharma')[0]).toBeInTheDocument();
			expect(screen.getAllByText('TN01AB1234')[0]).toBeInTheDocument();
			expect(screen.getAllByText('Full Body Foam Wash')[0]).toBeInTheDocument();
			expect(screen.getAllByText('Interior Deep Clean')[0]).toBeInTheDocument();
		});
	});

	it('allows entering edit mode, modifying service items, and saving changes', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});

		// Enter edit mode
		fireEvent.click(screen.getByRole('button', { name: /edit/i }));

		expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

		// Save changes
		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(api.updateJobCardServices).toHaveBeenCalledWith(
				'jc-1',
				expect.arrayContaining([
					expect.objectContaining({ serviceId: 'svc-1', quantity: 1 }),
					expect.objectContaining({ serviceId: 'svc-2', quantity: 1 }),
				])
			);
		});
	});

	it('disables edit button and indicates locked state when invoice is generated', async () => {
		const lockedJobCard: api.JobCardDto = {
			...mockJobCard,
			status: 4, // Invoiced
			invoiceId: 'inv-100',
			invoiceNumber: 'INV-2026-0001',
			invoiceStatus: 'Generated',
		};

		vi.mocked(api.getJobCardById).mockResolvedValue(lockedJobCard);

		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Invoiced')).toBeInTheDocument();
			expect(screen.getByText(/locked — invoice generated/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /view invoice/i })).toBeInTheDocument();
		});

		expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
		expect(screen.getByTestId('btn-add-outside-job')).toBeDisabled();
		expect(screen.getByTestId('btn-vehicle-location-send-outside')).toBeDisabled();
	});

	it('allows adding a service from catalog and updating quantity in edit mode', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /edit/i }));

		// Click Add Service to open picker
		fireEvent.click(screen.getByText('Add Service'));

		await waitFor(() => {
			expect(screen.getByText('Windshield Polishing')).toBeInTheDocument();
		});

		// Select service from picker
		fireEvent.click(screen.getByText('Windshield Polishing'));

		await waitFor(() => {
			expect(screen.getAllByText('Windshield Polishing').length).toBeGreaterThan(0);
		});

		// Update quantity for newly added service (the 3rd number input)
		const qtyInputs = screen.getAllByRole('spinbutton');
		expect(qtyInputs.length).toBe(3);
		fireEvent.change(qtyInputs[2], { target: { value: '2' } });

		// Save changes
		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(api.updateJobCardServices).toHaveBeenCalledWith(
				'jc-1',
				expect.arrayContaining([
					expect.objectContaining({ serviceId: 'svc-3', quantity: 2 }),
				])
			);
		});
	});

	it('allows removing a service row in edit mode', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /edit/i }));

		// Find delete buttons in table
		const deleteButtons = screen.getAllByTitle('Remove');
		expect(deleteButtons.length).toBe(2);

		// Remove first item
		fireEvent.click(deleteButtons[0]);

		// Save changes
		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(api.updateJobCardServices).toHaveBeenCalledWith(
				'jc-1',
				[expect.objectContaining({ serviceId: 'svc-2', quantity: 1 })]
			);
		});
	});

	it('handles save error when job card has become locked and recovers safely', async () => {
		vi.spyOn(window, 'alert').mockImplementation(() => {});
		vi.mocked(api.updateJobCardServices).mockRejectedValueOnce(
			new Error('Job card is locked because an invoice has already been generated')
		);

		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /edit/i }));
		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(window.alert).toHaveBeenCalledWith(
				expect.stringContaining('Job card is locked because an invoice has already been generated')
			);
		});
	});

	it('opens in-app A4 print preview modal', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /print job card/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /print job card/i }));

		await waitFor(() => {
			expect(screen.getByText(/Print Preview — JC-2026-0001/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
		});

		// Close preview
		fireEvent.click(screen.getByRole('button', { name: /close/i }));
		expect(screen.queryByText(/Print Preview — JC-2026-0001/i)).not.toBeInTheDocument();
	});

	it('handles error state and provides retry action', async () => {
		vi.mocked(api.getJobCardById).mockRejectedValueOnce(new Error('Job card not found'));

		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Failed to load job card')).toBeInTheDocument();
			expect(screen.getByText('Job card not found')).toBeInTheDocument();
		});

		vi.mocked(api.getJobCardById).mockResolvedValueOnce(mockJobCard);
		fireEvent.click(screen.getByRole('button', { name: /retry/i }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'JC-2026-0001' })).toBeInTheDocument();
		});
	});

	it('displays vehicle location badge and Send Vehicle Outside action when vehicle is at showroom', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getAllByText('At Showroom').length).toBeGreaterThan(0);
			expect(screen.getByTestId('header-btn-send-outside')).toBeInTheDocument();
			expect(screen.getByTestId('outside-jobs-section')).toBeInTheDocument();
		});
	});

	it('displays Outside Shop badge, overdue indicator, and Mark Vehicle Returned action when vehicle is outside', async () => {
		const outsideJobCard: api.JobCardDto = {
			...mockJobCard,
			vehicleLocation: {
				location: 'At Outside Shop',
				isOutside: true,
				activeOutsideJobId: 'out-1',
				vendorId: 'ven-1',
				vendorName: 'Sri Lakshmi Auto Works',
				serviceName: 'Denting & Painting',
				sentAt: '2026-02-01T10:00:00Z',
				expectedReturnAt: '2026-02-01T15:00:00Z',
				isOverdue: true,
			},
		};

		vi.mocked(api.getJobCardById).mockResolvedValue(outsideJobCard);

		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{
				initialEntries: ['/job-cards/jc-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getAllByText(/At Outside Shop/i).length).toBeGreaterThan(0);
			expect(screen.getAllByText(/OVERDUE/i).length).toBeGreaterThan(0);
			expect(screen.getByTestId('header-btn-mark-returned')).toBeInTheDocument();
		});
	});
});

describe('Edit Job Card — Add Service & Create Custom Service Workflow', () => {
	const mockJobCard: api.JobCardDto = {
		id: 'jc-100',
		jobCardNumber: 'JC-2026-0100',
		customer: {
			id: 'cust-1',
			name: 'Priya Rajan',
			phoneNumber: '9840123456',
		},
		vehicle: {
			id: 'veh-1',
			registrationNumber: 'TN38AB5678',
			make: 'Honda',
			model: 'City',
			variant: 'ZX',
			color: 'Black',
		},
		status: 1, // In Progress (editable)
		notes: 'Special requests',
		services: [
			{
				id: 'jcs-1',
				serviceId: 'svc-1',
				serviceName: 'Full Body Foam Wash',
				unitPrice: 1000,
				quantity: 1,
				taxPercentage: 18,
				discountAmount: 0,
			},
		],
		subtotal: 1000,
		taxAmount: 180,
		discountAmount: 0,
		totalAmount: 1180,
		invoiceId: null,
		invoiceNumber: null,
		invoiceStatus: null,
		createdAt: '2026-02-01T10:00:00Z',
		updatedAt: null,
	};

	const mockCatalogServices: api.ServiceDto[] = [
		{
			id: 'svc-2',
			name: 'Ceramic Coating Top-up',
			category: 'Protection',
			price: 5000,
			taxPercentage: 18,
			durationMinutes: 60,
			description: 'Quarterly hydrophobic booster',
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
		},
		{
			id: 'svc-3',
			name: 'Engine Bay Cleaning',
			category: 'Detailing',
			price: 1500,
			taxPercentage: 18,
			durationMinutes: 45,
			description: 'Safe engine degrease and dressing',
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getJobCardById).mockResolvedValue(mockJobCard);
		vi.mocked(api.getServices).mockResolvedValue({
			items: mockCatalogServices,
			totalCount: mockCatalogServices.length,
		});
		vi.mocked(api.updateJobCardServices).mockResolvedValue({
			...mockJobCard,
		});
		vi.mocked(api.getOutsideJobsByJobCardId).mockResolvedValue([]);
		vi.mocked(api.getVendors).mockResolvedValue([]);
	});

	it('1. displays Add Service button when editable and in edit mode', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{ initialEntries: ['/job-cards/jc-100'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});

		// Before edit mode: Add Service button is not visible
		expect(screen.queryByTestId('btn-add-service-bottom')).not.toBeInTheDocument();

		// Enter edit mode
		fireEvent.click(screen.getByRole('button', { name: /edit/i }));

		// Add Service buttons are displayed
		expect(screen.getByTestId('btn-add-service-bottom')).toBeInTheDocument();
		expect(screen.getByTestId('header-btn-add-service')).toBeInTheDocument();
	});

	it('2. locked job card does not show Add Service or Edit button', async () => {
		const lockedCard: api.JobCardDto = {
			...mockJobCard,
			status: 4, // Invoiced
			invoiceId: 'inv-999',
			invoiceNumber: 'INV-2026-0999',
			invoiceStatus: 'Paid',
		};
		vi.mocked(api.getJobCardById).mockResolvedValue(lockedCard);

		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{ initialEntries: ['/job-cards/jc-100'] }
		);

		await waitFor(() => {
			expect(screen.getByText(/Locked — Invoice Generated/i)).toBeInTheDocument();
		});

		expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
		expect(screen.queryByTestId('btn-add-service-bottom')).not.toBeInTheDocument();
		expect(screen.queryByTestId('header-btn-add-service')).not.toBeInTheDocument();
	});

	it('3. clicking Add Service opens ServicePickerDialog with search and Create Custom Service action', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{ initialEntries: ['/job-cards/jc-100'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /edit/i }));

		// Open picker
		fireEvent.click(screen.getByTestId('btn-add-service-bottom'));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Add Service' })).toBeInTheDocument();
			expect(screen.getByPlaceholderText(/search services/i)).toBeInTheDocument();
			expect(screen.getAllByRole('button', { name: /create custom service/i }).length).toBeGreaterThan(0);
		});
	});

	it('4. existing service can be searched, added, and increments quantity if already present', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{ initialEntries: ['/job-cards/jc-100'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /edit/i }));

		// Open picker
		fireEvent.click(screen.getByTestId('btn-add-service-bottom'));

		await waitFor(() => {
			expect(screen.getByText('Ceramic Coating Top-up')).toBeInTheDocument();
		});

		// Add Ceramic Coating Top-up
		fireEvent.click(screen.getByText('Ceramic Coating Top-up'));

		// Should appear in table rows
		await waitFor(() => {
			expect(screen.getAllByText('Ceramic Coating Top-up').length).toBeGreaterThan(0);
		});

		// Open picker again and add Ceramic Coating Top-up a second time
		fireEvent.click(screen.getByTestId('btn-add-service-bottom'));
		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Add Service' })).toBeInTheDocument();
		});
		const dialog = screen.getByRole('dialog');
		const addBtns = within(dialog).getAllByRole('button', { name: /^add$/i });
		fireEvent.click(addBtns[0]);

		// Quantity input for Ceramic Coating Top-up should now be 2
		const qtyInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
		expect(qtyInputs.length).toBe(2);
		expect(qtyInputs[1].value).toBe('2');
	});

	it('5. Create Custom Service dialog opens, validates inputs, and disables creation if invalid', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{ initialEntries: ['/job-cards/jc-100'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /edit/i }));
		fireEvent.click(screen.getByTestId('btn-add-service-bottom'));

		// Click Create Custom Service
		const createCustomBtn = screen.getAllByRole('button', { name: /create custom service/i })[0];
		fireEvent.click(createCustomBtn);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Create Custom Service' })).toBeInTheDocument();
			expect(screen.getByPlaceholderText(/e\.g\. Custom Scratch Removal/i)).toBeInTheDocument();
			expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
		});

		const submitBtn = screen.getByRole('button', { name: /create service/i });
		expect(submitBtn).toBeDisabled();
	});

	it('6. creates custom service via api.createService and automatically adds to current job card editing list', async () => {
		const createdCustomService: api.ServiceDto = {
			id: 'custom-svc-new-guid',
			name: 'Underbody Anti-Rust Coating',
			category: 'Protection',
			price: 2500,
			taxPercentage: 18,
			durationMinutes: 45,
			description: 'Underbody protective sealant',
			isActive: true,
			createdAt: '2026-02-01T10:00:00Z',
		};

		vi.mocked(api.createService).mockResolvedValue(createdCustomService);

		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{ initialEntries: ['/job-cards/jc-100'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /edit/i }));
		fireEvent.click(screen.getByTestId('btn-add-service-bottom'));

		// Click Create Custom Service
		fireEvent.click(screen.getAllByRole('button', { name: /create custom service/i })[0]);

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/e\.g\. Custom Scratch Removal/i)).toBeInTheDocument();
		});

		// Fill custom service form
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. Custom Scratch Removal/i), {
			target: { value: 'Underbody Anti-Rust Coating' },
		});
		fireEvent.change(screen.getByPlaceholderText('0.00'), {
			target: { value: '2500' },
		});

		// Click Create Service
		const submitBtn = screen.getByRole('button', { name: /create service/i });
		expect(submitBtn).not.toBeDisabled();
		fireEvent.click(submitBtn);

		// Verified api.createService was called with correct payload
		await waitFor(() => {
			expect(api.createService).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Underbody Anti-Rust Coating',
					price: 2500,
					isActive: true,
					taxPercentage: 18,
				})
			);
		});

		// Verified the newly created custom service was automatically added to job card table without manual search!
		await waitFor(() => {
			expect(screen.getByText('Underbody Anti-Rust Coating')).toBeInTheDocument();
			expect(screen.getAllByText('₹2,500.00').length).toBeGreaterThan(0);
		});
	});

	it('7. recalculates subtotal, tax, and total accurately and persists complete list on save', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/job-cards/:id" element={<JobCardDetails />} />
			</Routes>,
			{ initialEntries: ['/job-cards/jc-100'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /edit/i }));

		// Initial: 1x 1000 = 1000 subtotal, 180 tax, 1180 total
		expect(screen.getAllByText('₹1,000.00').length).toBeGreaterThan(0);
		expect(screen.getByText('₹180.00')).toBeInTheDocument();
		expect(screen.getByText('₹1,180.00')).toBeInTheDocument();

		// Add new service
		fireEvent.click(screen.getByTestId('btn-add-service-bottom'));
		await waitFor(() => {
			expect(screen.getByText('Ceramic Coating Top-up')).toBeInTheDocument();
		});
		fireEvent.click(screen.getByText('Ceramic Coating Top-up')); // + ₹5,000

		// Update quantity of initial item (svc-1) from 1 to 2 (+ ₹1,000)
		const qtyInputs = screen.getAllByRole('spinbutton');
		fireEvent.change(qtyInputs[0], { target: { value: '2' } });

		// Expected new Subtotal: (1000 * 2) + (5000 * 1) = 7000
		// Expected Tax (18%): 7000 * 0.18 = 1260
		// Expected Total: 7000 + 1260 = 8260
		await waitFor(() => {
			expect(screen.getByText('₹7,000.00')).toBeInTheDocument();
			expect(screen.getByText('₹1,260.00')).toBeInTheDocument();
			expect(screen.getByText('₹8,260.00')).toBeInTheDocument();
		});

		// Save changes
		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(api.updateJobCardServices).toHaveBeenCalledWith(
				'jc-100',
				[
					expect.objectContaining({ serviceId: 'svc-1', quantity: 2, discountAmount: 0 }),
					expect.objectContaining({ serviceId: 'svc-2', quantity: 1, discountAmount: 0 }),
				]
			);
		});
	});
});
