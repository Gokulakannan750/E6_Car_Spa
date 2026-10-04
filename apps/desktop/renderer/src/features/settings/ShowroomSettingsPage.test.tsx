import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import ShowroomSettingsPage from './ShowroomSettingsPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getShowroomVehicleTypes: vi.fn(),
		createShowroomVehicleType: vi.fn(),
		updateShowroomVehicleType: vi.fn(),
		toggleShowroomVehicleTypeActive: vi.fn(),
		getShowroomWorkTypes: vi.fn(),
		createShowroomWorkType: vi.fn(),
		updateShowroomWorkType: vi.fn(),
		toggleShowroomWorkTypeActive: vi.fn(),
	};
});

describe('ShowroomSettingsPage Component', () => {
	const mockVehicleTypes: api.ShowroomVehicleTypeDto[] = [
		{
			id: 'vt-1',
			code: 'HATCHBACK',
			name: 'Hatchback',
			displayOrder: 1,
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
		},
		{
			id: 'vt-2',
			code: 'SEDAN',
			name: 'Sedan',
			displayOrder: 2,
			isActive: false,
			createdAt: '2026-01-01T00:00:00Z',
		},
	];

	const mockWorkTypes: api.ShowroomWorkTypeDto[] = [
		{
			id: 'wt-1',
			code: 'BODY_WASH',
			name: 'Body Wash',
			description: 'Exterior cleaning and rinse',
			displayOrder: 1,
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
		},
		{
			id: 'wt-2',
			code: 'OTHER',
			name: 'Other',
			description: 'Custom work',
			displayOrder: 2,
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getShowroomVehicleTypes).mockResolvedValue(mockVehicleTypes);
		vi.mocked(api.getShowroomWorkTypes).mockResolvedValue(mockWorkTypes);
		vi.mocked(api.createShowroomVehicleType).mockResolvedValue(mockVehicleTypes[0]);
		vi.mocked(api.updateShowroomVehicleType).mockResolvedValue(mockVehicleTypes[0]);
		vi.mocked(api.toggleShowroomVehicleTypeActive).mockResolvedValue(mockVehicleTypes[0]);
		vi.mocked(api.createShowroomWorkType).mockResolvedValue(mockWorkTypes[0]);
		vi.mocked(api.updateShowroomWorkType).mockResolvedValue(mockWorkTypes[0]);
		vi.mocked(api.toggleShowroomWorkTypeActive).mockResolvedValue(mockWorkTypes[0]);
	});

	it('renders Showroom Configuration page with Vehicle Types and Work Types', async () => {
		renderWithProviders(<ShowroomSettingsPage />, {
			initialEntries: ['/settings/showroom'],
			authUser: {
				id: 'usr-1',
				fullName: 'Owner User',
				username: 'owner',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view'],
			},
		});

		expect(screen.getByText('Showroom Configuration')).toBeInTheDocument();
		expect(await screen.findByText('Hatchback')).toBeInTheDocument();
		expect(screen.getByText('Sedan')).toBeInTheDocument();
		expect(screen.getByText('Body Wash')).toBeInTheDocument();
		expect(screen.getByText('Other')).toBeInTheDocument();

		// Owner sees Add buttons
		expect(screen.getByRole('button', { name: /Add Vehicle Type/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Add Work Type/i })).toBeInTheDocument();
	});

	it('renders read-only mode for non-owners without management controls', async () => {
		renderWithProviders(<ShowroomSettingsPage />, {
			initialEntries: ['/settings/showroom'],
			authUser: {
				id: 'usr-2',
				fullName: 'Manager User',
				username: 'manager',
				role: 'Manager',
				isOwner: false,
				permissions: ['settings.view'],
			},
		});

		// Banner is visible
		expect(await screen.findByText(/Owner-Only Management/i)).toBeInTheDocument();

		// Add buttons are not visible
		expect(screen.queryByRole('button', { name: /Add Vehicle Type/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Add Work Type/i })).not.toBeInTheDocument();

		// Edit buttons are not visible
		expect(screen.queryByRole('button', { name: /Edit Vehicle Type/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Edit Work Type/i })).not.toBeInTheDocument();
	});

	it('allows Owner to add a new Vehicle Type', async () => {
		renderWithProviders(<ShowroomSettingsPage />, {
			initialEntries: ['/settings/showroom'],
			authUser: {
				id: 'usr-1',
				fullName: 'Owner User',
				username: 'owner',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view'],
			},
		});

		const addBtn = await screen.findByRole('button', { name: /Add Vehicle Type/i });
		fireEvent.click(addBtn);

		const nameInput = screen.getByLabelText(/Vehicle Type Name/i);
		fireEvent.change(nameInput, { target: { value: 'SUV / Luxury' } });

		const saveBtn = screen.getByRole('button', { name: /Save Vehicle Type/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(api.createShowroomVehicleType).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'SUV / Luxury',
				})
			);
		});
	});

	it('allows Owner to toggle vehicle type active status', async () => {
		renderWithProviders(<ShowroomSettingsPage />, {
			initialEntries: ['/settings/showroom'],
			authUser: {
				id: 'usr-1',
				fullName: 'Owner User',
				username: 'owner',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view'],
			},
		});

		// The second vehicle type (Sedan) is inactive, so its button is "Activate"
		const activateBtn = await screen.findByRole('button', { name: 'Activate' });
		fireEvent.click(activateBtn);

		await waitFor(() => {
			expect(api.toggleShowroomVehicleTypeActive).toHaveBeenCalledWith('vt-2');
		});
	});

	it('allows Owner to add a new Work Type', async () => {
		renderWithProviders(<ShowroomSettingsPage />, {
			initialEntries: ['/settings/showroom'],
			authUser: {
				id: 'usr-1',
				fullName: 'Owner User',
				username: 'owner',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view'],
			},
		});

		const addBtn = await screen.findByRole('button', { name: /Add Work Type/i });
		fireEvent.click(addBtn);

		const nameInput = screen.getByLabelText(/Work Type Name/i);
		fireEvent.change(nameInput, { target: { value: 'Teflon Coating' } });

		const descInput = screen.getByLabelText(/Description/i);
		fireEvent.change(descInput, { target: { value: 'Protective polymer coating' } });

		const saveBtn = screen.getByRole('button', { name: /Save Work Type/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(api.createShowroomWorkType).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Teflon Coating',
					description: 'Protective polymer coating',
				})
			);
		});
	});
});
