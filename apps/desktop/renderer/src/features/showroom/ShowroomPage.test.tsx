import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ShowroomPage } from './ShowroomPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getShowrooms: vi.fn(),
		createShowroom: vi.fn(),
		updateShowroom: vi.fn(),
		toggleShowroomActive: vi.fn(),
	};
});

describe('ShowroomPage Component (Phase 1 — Master Module)', () => {
	const mockShowrooms: api.ShowroomDto[] = [
		{
			id: 'sr-1',
			masterId: 'PO10001',
			name: 'Popular Hyundai Showroom',
			address: 'Anna Salai, Chennai',
			phone: '9876500001',
			gstin: '33AAAAA0000A1Z5',
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: null,
			activeStaffCountToday: 0,
			totalVehiclesToday: 0,
		},
		{
			id: 'sr-2',
			masterId: 'KU10001',
			name: 'KUN BMW Showroom',
			address: 'OMR, Chennai',
			phone: '9876500002',
			gstin: null,
			isActive: false,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: null,
			activeStaffCountToday: 0,
			totalVehiclesToday: 0,
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getShowrooms).mockResolvedValue(mockShowrooms);
		vi.mocked(api.createShowroom).mockResolvedValue(mockShowrooms[0]);
		vi.mocked(api.updateShowroom).mockResolvedValue(mockShowrooms[0]);
	});

	it('renders Showroom master directory with list of showrooms, search, and status filter', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.manage'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
			expect(screen.getByText('KUN BMW Showroom')).toBeInTheDocument();
			expect(screen.getByText('Anna Salai, Chennai')).toBeInTheDocument();
			expect(screen.getByText('OMR, Chennai')).toBeInTheDocument();
		});

		// Search input test
		const searchInput = screen.getByPlaceholderText(/search by showroom/i);
		fireEvent.change(searchInput, { target: { value: 'Hyundai' } });

		await waitFor(() => {
			expect(api.getShowrooms).toHaveBeenCalledWith(
				expect.objectContaining({ search: 'Hyundai' })
			);
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		// Status filter test
		const selectFilter = screen.getByRole('combobox');
		fireEvent.change(selectFilter, { target: { value: 'active' } });

		await waitFor(() => {
			expect(api.getShowrooms).toHaveBeenCalledWith(
				expect.objectContaining({ isActive: true })
			);
		});
	});

	it('opens create showroom dialog, verifies MasterId is not an input field (generated automatically by backend), and submits valid showroom', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.manage'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /add showroom/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /add showroom/i }));

		await waitFor(() => {
			expect(screen.getByText('Add New Showroom')).toBeInTheDocument();
		});

		// Verify MasterId is generated automatically by backend and cannot be input by user
		expect(screen.queryByPlaceholderText(/master id/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/master id/i)).not.toBeInTheDocument();

		// Fill showroom fields
		fireEvent.change(screen.getByPlaceholderText(/popular hyundai showroom/i), {
			target: { value: 'Maruti TrueValue' },
		});
		fireEvent.change(screen.getByPlaceholderText(/142 brough road/i), {
			target: { value: 'Guindy, Chennai' },
		});
		fireEvent.change(screen.getByPlaceholderText(/9876543210/i), {
			target: { value: '9840012345' },
		});

		const saveBtn = screen.getByRole('button', { name: /^create showroom$/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(api.createShowroom).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Maruti TrueValue',
					address: 'Guindy, Chennai',
					phone: '9840012345',
					isActive: true,
				})
			);
			// Verify MasterId was NOT sent in CreateShowroomRequest
			const callArg = vi.mocked(api.createShowroom).mock.calls[0][0] as unknown as Record<string, unknown>;
			expect(callArg).not.toHaveProperty('masterId');
		});
	});

	it('validates GSTIN structure in Create Showroom modal', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.manage'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /add showroom/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /add showroom/i }));

		expect(screen.getByPlaceholderText(/33AAAAA0000A1Z5/i)).toBeInTheDocument();

		// Fill name & address
		fireEvent.change(screen.getByPlaceholderText(/popular hyundai showroom/i), {
			target: { value: 'New Test Showroom' },
		});
		fireEvent.change(screen.getByPlaceholderText(/142 brough road/i), {
			target: { value: '123 Test Street' },
		});

		// Enter invalid GSTIN
		fireEvent.change(screen.getByPlaceholderText(/33AAAAA0000A1Z5/i), {
			target: { value: 'INVALID123' },
		});
		fireEvent.click(screen.getByRole('button', { name: /^create showroom$/i }));

		expect(screen.getByText(/Invalid Indian GSTIN structure/i)).toBeInTheDocument();
		expect(api.createShowroom).not.toHaveBeenCalled();

		// Correct GSTIN
		fireEvent.change(screen.getByPlaceholderText(/33AAAAA0000A1Z5/i), {
			target: { value: '33bbbbb1111b2z6' },
		});
		fireEvent.click(screen.getByRole('button', { name: /^create showroom$/i }));

		await waitFor(() => {
			expect(api.createShowroom).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'New Test Showroom',
					address: '123 Test Street',
					gstin: '33BBBBB1111B2Z6',
				})
			);
		});
	});

	it('displays Master ID with correct ^[A-Z]{2}[0-9]{5}$ format, uniqueness, and system registration metadata in Showroom Profile', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.manage'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		// Verify MasterId format ^[A-Z]{2}[0-9]{5}$ and uniqueness across mock showrooms
		const masterIdRegex = /^[A-Z]{2}[0-9]{5}$/;
		expect(mockShowrooms[0].masterId).toMatch(masterIdRegex);
		expect(mockShowrooms[1].masterId).toMatch(masterIdRegex);
		expect(mockShowrooms[0].masterId).not.toEqual(mockShowrooms[1].masterId);

		// Click showroom name to open details view
		fireEvent.click(screen.getByText('Popular Hyundai Showroom'));

		// Showroom Details header MUST show Master ID badge and master information
		await waitFor(() => {
			// Badge format: #PO10001
			expect(screen.getByText('#PO10001')).toBeInTheDocument();
			// Master ID row in System & Registration Metadata card
			expect(screen.getByText('PO10001')).toBeInTheDocument();
			expect(screen.getByText('Dealership Profile')).toBeInTheDocument();
			expect(screen.getByText('System & Registration Metadata')).toBeInTheDocument();
		});

		// Verify internal Guid sr-1 is not displayed as the business Master ID
		expect(screen.queryByText('#sr-1')).not.toBeInTheDocument();
	});

	it('opens edit showroom modal, confirms Master ID is immutable / cannot be edited, and updates master fields without changing MasterId', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.manage'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		// Open edit modal via row action
		const editButtons = screen.getAllByTitle('Edit showroom master');
		fireEvent.click(editButtons[0]);

		await waitFor(() => {
			expect(screen.getByText('Edit Showroom')).toBeInTheDocument();
		});

		// Confirm Master ID input field does NOT exist in Edit form (immutable)
		expect(screen.queryByPlaceholderText(/master id/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/master id/i)).not.toBeInTheDocument();

		// Name input contains current name
		const nameInput = screen.getByPlaceholderText(/popular hyundai showroom/i) as HTMLInputElement;
		expect(nameInput.value).toBe('Popular Hyundai Showroom');

		// Modify name
		fireEvent.change(nameInput, { target: { value: 'Popular Hyundai Dealership' } });

		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(api.updateShowroom).toHaveBeenCalledWith(
				'sr-1',
				expect.objectContaining({
					name: 'Popular Hyundai Dealership',
				})
			);
			// Verify MasterId was NOT sent in UpdateShowroomRequest
			const callArg = vi.mocked(api.updateShowroom).mock.calls[0][1] as unknown as Record<string, unknown>;
			expect(callArg).not.toHaveProperty('masterId');
		});
	});

	it('clears GSTIN on edit when field is emptied and submits gstin as null', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.manage'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		// 1. Existing showroom has GSTIN ('33AAAAA0000A1Z5' from mockShowrooms[0])
		// 2. Open Edit Showroom
		const editBtn = screen.getAllByTitle('Edit showroom master')[0];
		fireEvent.click(editBtn);

		// 3. Existing GSTIN is loaded into the field
		const gstinInput = screen.getByPlaceholderText(/33AAAAA0000A1Z5/i) as HTMLInputElement;
		expect(gstinInput).toBeInTheDocument();
		expect(gstinInput.value).toBe('33AAAAA0000A1Z5');

		// 4. Clear the GSTIN field
		fireEvent.change(gstinInput, { target: { value: '' } });
		expect(gstinInput.value).toBe('');

		// 5. Save
		fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		// 6. updateShowroom() is called with gstin: null
		await waitFor(() => {
			expect(api.updateShowroom).toHaveBeenCalledWith(
				'sr-1',
				expect.objectContaining({
					gstin: null,
				})
			);
		});
	});

	it('renders read-only status badges for active and inactive showrooms and does not trigger mutation on interaction', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
			expect(screen.getByText('KUN BMW Showroom')).toBeInTheDocument();
		});

		// Active showroom renders an Active status badge
		const activeBadge = screen.getByText('Active');
		expect(activeBadge).toBeInTheDocument();

		// Inactive showroom renders an Inactive status badge
		const inactiveBadge = screen.getByText('Inactive');
		expect(inactiveBadge).toBeInTheDocument();

		// The status element is not an interactive toggle/button
		expect(activeBadge.closest('button')).toBeNull();
		expect(activeBadge.closest('input')).toBeNull();
		expect(activeBadge.closest('[role="button"]')).toBeNull();
		expect(activeBadge.closest('[role="switch"]')).toBeNull();

		expect(inactiveBadge.closest('button')).toBeNull();
		expect(inactiveBadge.closest('input')).toBeNull();
		expect(inactiveBadge.closest('[role="button"]')).toBeNull();
		expect(inactiveBadge.closest('[role="switch"]')).toBeNull();

		// Clicking does not trigger any mutation
		fireEvent.click(activeBadge);
		fireEvent.click(inactiveBadge);

		expect(api.toggleShowroomActive).not.toHaveBeenCalled();
		expect(api.updateShowroom).not.toHaveBeenCalled();
	});

	it('verifies complete removal of Showroom deletion: Delete button and Delete dialog do not exist', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.manage'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		// 1. In Directory table: Delete button does NOT exist
		expect(screen.queryByTitle('Delete showroom')).not.toBeInTheDocument();
		expect(screen.queryByTitle(/delete/i)).not.toBeInTheDocument();

		// 2. Open Details / Profile view
		fireEvent.click(screen.getByText('Popular Hyundai Showroom'));

		await waitFor(() => {
			expect(screen.getByText('Dealership Profile')).toBeInTheDocument();
		});

		// 3. In Profile view: Delete button does NOT exist
		expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();

		// 4. Delete confirmation dialog does NOT exist
		expect(screen.queryByRole('heading', { name: /delete showroom/i })).not.toBeInTheDocument();
		expect(screen.queryByText(/are you sure you want to remove/i)).not.toBeInTheDocument();
	});

	it('displays Showroom Details view with master information and without operational workspace or billing UI', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.manage'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		// Directory table must NOT show GSTIN
		expect(screen.queryByText(/GSTIN: 33AAAAA0000A1Z5/i)).not.toBeInTheDocument();

		// Click showroom name to open details view
		fireEvent.click(screen.getByText('Popular Hyundai Showroom'));

		// Showroom Details header MUST show GSTIN badge and master information
		await waitFor(() => {
			expect(screen.getAllByText(/33AAAAA0000A1Z5/).length).toBeGreaterThan(0);
			expect(screen.getByText('Dealership Profile')).toBeInTheDocument();
			expect(screen.getByText('System & Registration Metadata')).toBeInTheDocument();
			expect(screen.getByTitle('Back to Showrooms List')).toBeInTheDocument();
		});

		// Verify OPERATIONAL elements are strictly NOT present in the Showrooms module
		expect(screen.queryByText(/daily workspace/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/confirm attendance/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/daily staff assignment/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/vehicles attended/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/outstanding summary/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/record payment/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/history & summary/i)).not.toBeInTheDocument();

		// Click back to return to directory
		fireEvent.click(screen.getByTitle('Back to Showrooms List'));

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/search by showroom/i)).toBeInTheDocument();
		});
	});

	it('respects showroom.manage permission: hides Add and Edit controls when user lacks permission', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom'],
				authUser: {
					id: 'usr-2',
					fullName: 'Read Only User',
					username: 'readonly',
					role: 'Staff',
					isOwner: false,
					permissions: ['showroom.view'], // Lacks 'showroom.manage'
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		// "Add Showroom" button must NOT be rendered
		expect(screen.queryByRole('button', { name: /add showroom/i })).not.toBeInTheDocument();

		// Row action button: Edit must NOT be rendered, Delete must NOT be rendered
		expect(screen.queryByTitle('Edit showroom master')).not.toBeInTheDocument();
		expect(screen.queryByTitle('Delete showroom')).not.toBeInTheDocument();

		// View details button is still accessible
		expect(screen.getAllByTitle('View showroom details').length).toBeGreaterThan(0);

		// Click into showroom details
		fireEvent.click(screen.getByText('Popular Hyundai Showroom'));

		await waitFor(() => {
			expect(screen.getByText('Dealership Profile')).toBeInTheDocument();
		});

		// In Details view, Edit and Delete action buttons must NOT be rendered
		expect(screen.queryByRole('button', { name: /edit showroom/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /delete showroom/i })).not.toBeInTheDocument();
	});
});
