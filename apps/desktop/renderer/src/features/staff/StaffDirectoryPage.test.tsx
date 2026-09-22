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
			id: 'staff-1',
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
			id: 'staff-2',
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

	it('renders Staff Directory header, real KPI cards, and staff cards', async () => {
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

		// KPI Cards from real API data
		expect(screen.getByText('Total Staff')).toBeInTheDocument();
		expect(screen.getByText('Active Staff')).toBeInTheDocument();
		expect(screen.getByText('Inactive Staff')).toBeInTheDocument();

		// Staff Cards
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();
		expect(screen.getByText('9876540001')).toBeInTheDocument();
		expect(screen.getByText('9876540002')).toBeInTheDocument();
		expect(screen.getByText('XXXX XXXX 9012')).toBeInTheDocument();
		expect(screen.getByText('Not Added')).toBeInTheDocument();
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
			expect(api.revealStaffAadhaar).toHaveBeenCalledWith('staff-1');
			expect(screen.getByText('1234 5678 9012')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
		});

		// Click Hide to mask again
		fireEvent.click(screen.getByRole('button', { name: /hide/i }));

		await waitFor(() => {
			expect(screen.getAllByText('XXXX XXXX 9012').length).toBeGreaterThanOrEqual(2);
		});
	});

	it('filters staff list by search query and status filter', async () => {
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

		// Filter by search
		const searchInput = screen.getByPlaceholderText(/search by name, phone, role, email/i);
		fireEvent.change(searchInput, { target: { value: 'Karthik' } });

		expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		expect(screen.queryByText('Senthil Nathan')).not.toBeInTheDocument();

		// Clear search
		fireEvent.change(searchInput, { target: { value: '' } });
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();

		// Filter by status: inactive button
		const inactiveBtn = screen.getByRole('button', { name: /^inactive$/i });
		fireEvent.click(inactiveBtn);

		expect(screen.queryByText('Karthik Raja')).not.toBeInTheDocument();
		expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();
	});
});
