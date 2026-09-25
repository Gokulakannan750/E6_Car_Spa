import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { StaffDirectoryPage } from './StaffDirectoryPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getStaffList: vi.fn(),
		createStaffMember: vi.fn(),
		updateStaffMember: vi.fn(),
		revealStaffAadhaar: vi.fn(),
		deleteStaffAadhaarDocument: vi.fn(),
		downloadStaffAadhaarDocument: vi.fn(),
		getStaffAdvanceHistory: vi.fn(),
	};
});

describe('StaffDirectoryPage Component (/staff)', () => {
	const mockStaffList: api.StaffDto[] = [
		{
			id: 'staff-guid-1',
			staffMasterId: 'KR001A',
			name: 'Karthik Raja',
			phoneNumber: '9876540001',
			email: 'karthik@e6carspa.com',
			address: '123 Main St, Coimbatore',
			role: 'Technician',
			isActive: true,
			totalAdvances: 1,
			totalAdvanceAmount: 5000,
			aadhaarMasked: 'XXXX XXXX 9012',
			hasAadhaarDocument: true,
			aadhaarDocumentFileName: 'aadhaar_doc.pdf',
			aadhaarDocumentContentType: 'application/pdf',
			aadhaarDocumentSize: 102400,
		},
		{
			id: 'staff-guid-2',
			staffMasterId: 'SN001N',
			name: 'Senthil Nathan',
			phoneNumber: '9876540002',
			email: 'senthil@e6carspa.com',
			address: null,
			role: 'Detailer',
			isActive: false,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
			aadhaarMasked: null,
			hasAadhaarDocument: false,
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getStaffList).mockResolvedValue(mockStaffList);
	});

	it('renders Staff Directory header, real KPI cards, and structured staff table with human-readable Staff IDs', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff" element={<StaffDirectoryPage />} />
			</Routes>,
			{
				initialEntries: ['/staff'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff.create', 'staff.edit', 'staff.view', 'staff.view_sensitive'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Staff Directory')).toBeInTheDocument();
			expect(screen.getByText('Manage staff members and employee information')).toBeInTheDocument();
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		});

		// Header button
		expect(screen.getByRole('button', { name: /add staff member/i })).toBeInTheDocument();

		// KPI Cards from real API data
		expect(screen.getByText('Total Staff')).toBeInTheDocument();
		expect(screen.getByText('Active Staff')).toBeInTheDocument();
		expect(screen.getByText('Inactive Staff')).toBeInTheDocument();

		// Structured Table and Headers
		const table = screen.getByRole('table');
		expect(table).toHaveClass('app-table');
		expect(screen.getByRole('columnheader', { name: /^staff$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^staff id$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^role$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^phone$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^aadhaar$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^status$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^actions$/i })).toBeInTheDocument();

		// Table Rows Content - Staff 1
		expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		expect(screen.getByText('#KR001A')).toBeInTheDocument();
		expect(screen.queryByText('#staff-guid-1')).not.toBeInTheDocument();
		expect(screen.getByText('Technician')).toBeInTheDocument();
		expect(screen.getByText('9876540001')).toBeInTheDocument();
		expect(screen.getByText('XXXX XXXX 9012')).toBeInTheDocument();

		// Table Rows Content - Staff 2
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();
		expect(screen.getByText('#SN001N')).toBeInTheDocument();
		expect(screen.queryByText('#staff-guid-2')).not.toBeInTheDocument();
		expect(screen.getByText('Detailer')).toBeInTheDocument();
		expect(screen.getByText('9876540002')).toBeInTheDocument();
		expect(screen.getByText('Not Added')).toBeInTheDocument();

		// Status Badges (non-interactive)
		expect(screen.getByText('Active')).toBeInTheDocument();
		expect(screen.getByText('Inactive')).toBeInTheDocument();

		// Actions (Details, Edit, History for both rows with proper visible button labels)
		const detailButtons = screen.getAllByRole('button', { name: /^details$/i });
		const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
		const historyButtons = screen.getAllByRole('button', { name: /^history$/i });

		expect(detailButtons).toHaveLength(2);
		expect(editButtons).toHaveLength(2);
		expect(historyButtons).toHaveLength(2);
	});

	it('validates mandatory Aadhaar on new staff creation and submits formatted value', async () => {
		vi.mocked(api.createStaffMember).mockResolvedValue({
			id: 'staff-3',
			name: 'Ramesh Kumar',
			phoneNumber: '9876543210',
			email: null,
			address: null,
			role: 'Technician',
			isActive: true,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
			aadhaarMasked: 'XXXX XXXX 9012',
			hasAadhaarDocument: false,
		});

		renderWithProviders(
			<Routes>
				<Route path="/staff" element={<StaffDirectoryPage />} />
			</Routes>,
			{
				initialEntries: ['/staff'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff.create', 'staff.edit'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		});

		const addStaffButtons = screen.getAllByRole('button', { name: /add staff member/i });
		fireEvent.click(addStaffButtons[0]);

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/e\.g\. ramesh kumar/i)).toBeInTheDocument();
		});

		// Fill in name and phone
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. ramesh kumar/i), {
			target: { value: 'Ramesh Kumar' },
		});
		fireEvent.change(screen.getByPlaceholderText('e.g. 9876543210'), {
			target: { value: '9876543210' },
		});

		// Try to submit with missing Aadhaar (submit button inside modal dialog)
		const submitButtons = screen.getAllByRole('button', { name: /add staff member/i });
		const dialogSubmitBtn = submitButtons[submitButtons.length - 1];
		fireEvent.click(dialogSubmitBtn);

		await waitFor(() => {
			expect(screen.getByText(/aadhaar number is mandatory for new staff/i)).toBeInTheDocument();
		});

		// Enter valid 12-digit Aadhaar
		fireEvent.change(screen.getByPlaceholderText('1234 5678 9012'), {
			target: { value: '1234 5678 9012' },
		});

		fireEvent.click(dialogSubmitBtn);

		await waitFor(() => {
			expect(api.createStaffMember).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Ramesh Kumar',
					phoneNumber: '9876543210',
					aadhaarNumber: '123456789012',
				})
			);
		});
	});

	it('opens staff details modal and reveals Aadhaar on authorized request', async () => {
		vi.mocked(api.revealStaffAadhaar).mockResolvedValue({
			staffId: 'staff-1',
			aadhaarNumber: '123456789012',
		});

		renderWithProviders(
			<Routes>
				<Route path="/staff" element={<StaffDirectoryPage />} />
			</Routes>,
			{
				initialEntries: ['/staff'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff.view', 'staff.view_sensitive'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		});

		// Click Details button
		const detailsBtns = screen.getAllByRole('button', { name: /^details$/i });
		fireEvent.click(detailsBtns[0]);

		await waitFor(() => {
			expect(screen.getByText('Staff Member Profile')).toBeInTheDocument();
			expect(screen.getByText(/Aadhaar Identification/i)).toBeInTheDocument();
			expect(screen.getAllByText('XXXX XXXX 9012').length).toBeGreaterThanOrEqual(1);
			expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument();
		});

		// Click Reveal to reveal
		fireEvent.click(screen.getByRole('button', { name: /reveal/i }));

		await waitFor(() => {
			expect(api.revealStaffAadhaar).toHaveBeenCalledWith('staff-guid-1');
			expect(screen.getByText('1234 5678 9012')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
		});

		// Click Hide to mask again
		fireEvent.click(screen.getByRole('button', { name: /hide/i }));

		await waitFor(() => {
			expect(screen.getAllByText('XXXX XXXX 9012').length).toBeGreaterThanOrEqual(2);
		});
	});

	it('filters staff table by name, phone, role, email, and status filters', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff" element={<StaffDirectoryPage />} />
			</Routes>,
			{
				initialEntries: ['/staff'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff.view'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
			expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText(/search by name, phone, role, email/i);

		// 1. Search by name
		fireEvent.change(searchInput, { target: { value: 'Karthik' } });
		expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		expect(screen.queryByText('Senthil Nathan')).not.toBeInTheDocument();

		// 2. Search by phone
		fireEvent.change(searchInput, { target: { value: '9876540002' } });
		expect(screen.queryByText('Karthik Raja')).not.toBeInTheDocument();
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();

		// 3. Search by role
		fireEvent.change(searchInput, { target: { value: 'Detailer' } });
		expect(screen.queryByText('Karthik Raja')).not.toBeInTheDocument();
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();

		// 4. Search by email
		fireEvent.change(searchInput, { target: { value: 'karthik@' } });
		expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		expect(screen.queryByText('Senthil Nathan')).not.toBeInTheDocument();

		// 5. Search by Staff ID (staffMasterId)
		fireEvent.change(searchInput, { target: { value: 'SN001N' } });
		expect(screen.queryByText('Karthik Raja')).not.toBeInTheDocument();
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();

		// Clear search
		fireEvent.change(searchInput, { target: { value: '' } });
		expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();

		// 6. Status filter: Inactive
		const inactiveBtn = screen.getByRole('button', { name: /^inactive$/i });
		fireEvent.click(inactiveBtn);
		expect(screen.queryByText('Karthik Raja')).not.toBeInTheDocument();
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();

		// 7. Status filter: Active
		const activeBtn = screen.getByRole('button', { name: /^active$/i });
		fireEvent.click(activeBtn);
		expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		expect(screen.queryByText('Senthil Nathan')).not.toBeInTheDocument();

		// 8. Status filter: All
		const allBtn = screen.getByRole('button', { name: /^all$/i });
		fireEvent.click(allBtn);
		expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();
	});

	it('renders fallback #— and NEVER displays raw internal GUID when staffMasterId is empty', async () => {
		vi.mocked(api.getStaffList).mockResolvedValue([
			{
				id: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
				staffMasterId: '',
				name: 'Fallback Staff',
				phoneNumber: '9999999999',
				email: null,
				address: null,
				role: 'Staff',
				isActive: true,
				totalAdvances: 0,
				totalAdvanceAmount: 0,
			},
		]);

		renderWithProviders(
			<Routes>
				<Route path="/staff" element={<StaffDirectoryPage />} />
			</Routes>,
			{
				initialEntries: ['/staff'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff.view'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Fallback Staff')).toBeInTheDocument();
		});

		// Check that #— is rendered and internal GUID is never rendered
		expect(screen.getByText('#—')).toBeInTheDocument();
		expect(screen.queryByText(/c56a4180/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/5fd21dec0538/i)).not.toBeInTheDocument();
	});

	it('supports edit action and allows activating/deactivating staff', async () => {
		vi.mocked(api.updateStaffMember).mockResolvedValue({
			id: 'staff-1',
			name: 'Karthik Raja',
			phoneNumber: '9876540001',
			email: 'karthik@e6carspa.com',
			address: '123 Main St, Coimbatore',
			role: 'Technician',
			isActive: false,
			totalAdvances: 1,
			totalAdvanceAmount: 5000,
			aadhaarMasked: 'XXXX XXXX 9012',
			hasAadhaarDocument: true,
		});

		renderWithProviders(
			<Routes>
				<Route path="/staff" element={<StaffDirectoryPage />} />
			</Routes>,
			{
				initialEntries: ['/staff'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff.create', 'staff.edit'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		});

		// Click Edit on the first staff member
		const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
		fireEvent.click(editButtons[0]);

		// Edit Dialog should open with prefilled fields
		await waitFor(() => {
			expect(screen.getByText('Edit Staff Member')).toBeInTheDocument();
			expect(screen.getByDisplayValue('Karthik Raja')).toBeInTheDocument();
		});

		// Change status from Active to Inactive
		const statusSelect = screen.getByDisplayValue('Active');
		fireEvent.change(statusSelect, { target: { value: 'inactive' } });

		// Click "Save Changes"
		const saveBtn = screen.getByRole('button', { name: /save changes/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(api.updateStaffMember).toHaveBeenCalledWith(
				'staff-guid-1',
				expect.objectContaining({
					name: 'Karthik Raja',
					phoneNumber: '9876540001',
					isActive: false,
				})
			);
		});
	});

	it('opens staff advance history modal when history action is clicked', async () => {
		vi.mocked(api.getStaffAdvanceHistory).mockResolvedValue({
			staffId: 'staff-guid-1',
			staffName: 'Karthik Raja',
			totalAdvancesAmount: 5000,
			outstandingAmount: 2000,
			settledAmount: 3000,
			advances: [
				{
					id: 'adv-1',
					staffId: 'staff-guid-1',
					staffName: 'Karthik Raja',
					amount: 5000,
					advanceDate: '2026-09-01T00:00:00Z',
					reason: 'Medical emergency',
					status: 'Active',
					createdAt: '2026-09-01T00:00:00Z',
				},
			],
		});

		renderWithProviders(
			<Routes>
				<Route path="/staff" element={<StaffDirectoryPage />} />
			</Routes>,
			{
				initialEntries: ['/staff'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff.view'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		});

		// Click History on the first staff row
		const historyButtons = screen.getAllByRole('button', { name: /^history$/i });
		fireEvent.click(historyButtons[0]);

		await waitFor(() => {
			expect(api.getStaffAdvanceHistory).toHaveBeenCalledWith('staff-guid-1');
		});

		await waitFor(() => {
			expect(screen.getByText(/Karthik Raja \(#KR001A\) — Advance History/)).toBeInTheDocument();
			expect(screen.getByText('Medical emergency')).toBeInTheDocument();
		});
	});

	it('strictly enforces 6-character Staff Master ID format [A-Z]{2}[0-9]{3}[A-Z] across directory display', async () => {
		const formattedStaff: api.StaffDto[] = [
			{
				id: 'guid-1',
				staffMasterId: 'GO123L',
				name: 'Gokul Kannan',
				phoneNumber: '9876500001',
				email: 'gokul@e6carspa.com',
				address: null,
				role: 'Owner',
				isActive: true,
				totalAdvances: 0,
				totalAdvanceAmount: 0,
			},
			{
				id: 'guid-2',
				staffMasterId: 'RA001H',
				name: 'Ramesh',
				phoneNumber: '9876500002',
				email: null,
				address: null,
				role: 'Technician',
				isActive: true,
				totalAdvances: 0,
				totalAdvanceAmount: 0,
			},
			{
				id: 'guid-3',
				staffMasterId: 'KU001R',
				name: 'Kumar',
				phoneNumber: '9876500003',
				email: null,
				address: null,
				role: 'Detailer',
				isActive: true,
				totalAdvances: 0,
				totalAdvanceAmount: 0,
			},
		];

		vi.mocked(api.getStaffList).mockResolvedValue(formattedStaff);

		renderWithProviders(
			<Routes>
				<Route path="/staff" element={<StaffDirectoryPage />} />
			</Routes>,
			{
				initialEntries: ['/staff'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff.view'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Gokul Kannan')).toBeInTheDocument();
		});

		// Verify 6-character format regex for all staff master IDs displayed
		const staffMasterIdPattern = /^[A-Z]{2}[0-9]{3}[A-Z]$/;
		formattedStaff.forEach((s) => {
			expect(s.staffMasterId).toMatch(staffMasterIdPattern);
			expect(s.staffMasterId).toHaveLength(6);
			expect(screen.getByText(`#${s.staffMasterId}`)).toBeInTheDocument();
			// Ensure internal GUID is never displayed in UI
			expect(screen.queryByText(s.id)).not.toBeInTheDocument();
		});
	});
});
