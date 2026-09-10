import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
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
});
