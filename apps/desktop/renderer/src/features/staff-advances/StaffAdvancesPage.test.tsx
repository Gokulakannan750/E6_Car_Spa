import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { StaffAdvancesPage } from './StaffAdvancesPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getStaffAdvances: vi.fn(),
		getStaffList: vi.fn(),
		createStaffAdvance: vi.fn(),
		settleStaffAdvance: vi.fn(),
		obsoleteStaffAdvance: vi.fn(),
		getStaffAdvanceHistory: vi.fn(),
		createStaffMember: vi.fn(),
		updateStaffMember: vi.fn(),
		revealStaffAadhaar: vi.fn(),
		deleteStaffAadhaarDocument: vi.fn(),
		downloadStaffAadhaarDocument: vi.fn(),
	};
});

describe('StaffAdvancesPage Component', () => {
	const mockStaffList: api.StaffDto[] = [
		{
			id: 'staff-1',
			name: 'Karthik Raja',
			phoneNumber: '9876540001',
			email: 'karthik@e6carspa.com',
			address: null,
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
			isActive: true,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
			aadhaarMasked: null,
			hasAadhaarDocument: false,
		},
	];

	const mockAdvancesResponse: api.StaffAdvanceListResponse = {
		items: [
			{
				id: 'adv-1',
				staffId: 'staff-1',
				staffName: 'Karthik Raja',
				staffRole: 'Technician',
				amount: 5000,
				advanceDate: '2026-03-01T00:00:00Z',
				reason: 'Medical Emergency',
				notes: 'Approved by manager',
				status: 'Outstanding',
				settledAt: null,
				settledByUserId: null,
				obsoletedAt: null,
				obsoletedByUserId: null,
				obsoleteReason: null,
				createdAt: '2026-03-01T10:00:00Z',
			},
			{
				id: 'adv-2',
				staffId: 'staff-2',
				staffName: 'Senthil Nathan',
				staffRole: 'Detailer',
				amount: 2000,
				advanceDate: '2026-02-15T00:00:00Z',
				reason: 'Festival Advance',
				notes: 'Salary deduction',
				status: 'Settled',
				settledAt: '2026-02-28T00:00:00Z',
				settledByUserId: 'usr-1',
				obsoletedAt: null,
				obsoletedByUserId: null,
				obsoleteReason: null,
				createdAt: '2026-02-15T10:00:00Z',
			},
		],
		totalCount: 2,
		page: 1,
		pageSize: 20,
		summary: {
			outstandingCount: 1,
			outstandingAmount: 5000,
			settledCount: 1,
			settledAmount: 2000,
			totalActiveCount: 2,
			totalActiveAmount: 7000,
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getStaffList).mockResolvedValue(mockStaffList);
		vi.mocked(api.getStaffAdvances).mockResolvedValue(mockAdvancesResponse as any);
	});

	it('renders KPI summary cards and advance payments table', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff-advances" element={<StaffAdvancesPage />} />
			</Routes>,
			{
				initialEntries: ['/staff-advances'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff_advances.create', 'staff_advances.settle', 'staff_advances.obsolete', 'staff.create', 'staff.edit'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Staff Advances')).toBeInTheDocument();
			expect(screen.getByText('Medical Emergency')).toBeInTheDocument();
			expect(screen.getByText('Festival Advance')).toBeInTheDocument();
		});

		// Verify KPI metric cards
		expect(screen.getAllByText('₹5,000.00').length).toBeGreaterThan(0);
		expect(screen.getAllByText('₹2,000.00').length).toBeGreaterThan(0);
		expect(screen.getAllByText('₹7,000.00').length).toBeGreaterThan(0);
		expect(screen.getByText('1 active advance pending recovery')).toBeInTheDocument();
	});

	it('opens record advance modal and submits valid advance payment', async () => {
		vi.mocked(api.createStaffAdvance).mockResolvedValue(mockAdvancesResponse.items[0]);

		renderWithProviders(
			<Routes>
				<Route path="/staff-advances" element={<StaffAdvancesPage />} />
			</Routes>,
			{
				initialEntries: ['/staff-advances'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff_advances.create', 'staff_advances.settle', 'staff_advances.obsolete', 'staff.create', 'staff.edit'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /record advance/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /record advance/i }));

		await waitFor(() => {
			expect(screen.getByText('Record Staff Advance')).toBeInTheDocument();
		});

		// Fill out advance form
		const staffSelect = screen.getByText('Select Staff Member...').closest('select')!;
		fireEvent.change(staffSelect, {
			target: { value: 'staff-1' },
		});
		fireEvent.change(screen.getByPlaceholderText('5000'), {
			target: { value: '3500' },
		});
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. personal advance/i), {
			target: { value: 'Bike Repair' },
		});

		const submitBtns = screen.getAllByRole('button', { name: /record advance/i });
		fireEvent.click(submitBtns[submitBtns.length - 1]);

		await waitFor(() => {
			expect(api.createStaffAdvance).toHaveBeenCalledWith(
				expect.objectContaining({
					staffId: 'staff-1',
					amount: 3500,
					reason: 'Bike Repair',
				}),
				expect.anything()
			);
		});
	});

	it('opens settle modal and submits mark settled', async () => {
		vi.mocked(api.settleStaffAdvance).mockResolvedValue({
			...mockAdvancesResponse.items[0],
			status: 'Settled',
		});

		renderWithProviders(
			<Routes>
				<Route path="/staff-advances" element={<StaffAdvancesPage />} />
			</Routes>,
			{
				initialEntries: ['/staff-advances'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff_advances.create', 'staff_advances.settle', 'staff_advances.obsolete', 'staff.create', 'staff.edit'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /mark settled/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /mark settled/i }));

		await waitFor(() => {
			expect(screen.getByText('Mark Advance as Settled?')).toBeInTheDocument();
		});

		const confirmBtns = screen.getAllByRole('button', { name: /mark settled/i });
		fireEvent.click(confirmBtns[confirmBtns.length - 1]);

		await waitFor(() => {
			expect(api.settleStaffAdvance).toHaveBeenCalledWith('adv-1');
		});
	});

	it('opens mark obsolete modal and requires mandatory reason', async () => {
		vi.mocked(api.obsoleteStaffAdvance).mockResolvedValue({
			...mockAdvancesResponse.items[0],
			status: 'Obsolete',
		});

		renderWithProviders(
			<Routes>
				<Route path="/staff-advances" element={<StaffAdvancesPage />} />
			</Routes>,
			{
				initialEntries: ['/staff-advances'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff_advances.create', 'staff_advances.settle', 'staff_advances.obsolete', 'staff.create', 'staff.edit'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /mark obsolete/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /mark obsolete/i }));

		await waitFor(() => {
			expect(screen.getByText('Mark Advance as Obsolete?')).toBeInTheDocument();
		});

		// Confirm with preset reason
		const confirmBtns = screen.getAllByRole('button', { name: /mark obsolete/i });
		fireEvent.click(confirmBtns[confirmBtns.length - 1]);

		await waitFor(() => {
			expect(api.obsoleteStaffAdvance).toHaveBeenCalledWith('adv-1', {
				reason: 'Wrongly entered',
			});
		});
	});

	it('switches to Staff Directory tab and renders staff list with masked Aadhaar', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff-advances" element={<StaffAdvancesPage />} />
			</Routes>,
			{
				initialEntries: ['/staff-advances'],
				authUser: {
					id: 'usr-admin',
					fullName: 'Admin User',
					username: 'admin',
					email: 'admin@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['staff.create', 'staff.edit', 'staff.view_sensitive'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /staff directory/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /staff directory/i }));

		await waitFor(() => {
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
			expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();
			expect(screen.getByText('9876540001')).toBeInTheDocument();
			expect(screen.getByText('9876540002')).toBeInTheDocument();
			expect(screen.getByText('XXXX XXXX 9012')).toBeInTheDocument();
			expect(screen.getByText(/not added/i)).toBeInTheDocument();
		});
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
				<Route path="/staff-advances" element={<StaffAdvancesPage />} />
			</Routes>,
			{
				initialEntries: ['/staff-advances'],
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
			expect(screen.getByRole('button', { name: /add staff member/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /add staff member/i }));

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

		// Try to submit with missing Aadhaar
		const submitBtn = screen.getByRole('button', { name: /^add staff$/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(screen.getByText(/aadhaar number is required/i)).toBeInTheDocument();
		});

		// Enter valid 12-digit Aadhaar
		fireEvent.change(screen.getByPlaceholderText('1234 5678 9012'), {
			target: { value: '1234 5678 9012' },
		});

		fireEvent.click(submitBtn);

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
				<Route path="/staff-advances" element={<StaffAdvancesPage />} />
			</Routes>,
			{
				initialEntries: ['/staff-advances'],
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

		fireEvent.click(screen.getByRole('button', { name: /staff directory/i }));

		await waitFor(() => {
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		});

		// Click Details button
		const detailsBtns = screen.getAllByRole('button', { name: /^details$/i });
		fireEvent.click(detailsBtns[0]);

		await waitFor(() => {
			expect(screen.getByText(/Karthik Raja.*Staff Details/i)).toBeInTheDocument();
			expect(screen.getByText(/Identification/i)).toBeInTheDocument();
			expect(screen.getAllByText('XXXX XXXX 9012').length).toBeGreaterThanOrEqual(1);
			expect(screen.getByRole('button', { name: /show/i })).toBeInTheDocument();
		});

		// Click Show to reveal
		fireEvent.click(screen.getByRole('button', { name: /show/i }));

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
});
