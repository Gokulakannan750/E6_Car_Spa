import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ShowroomAttendancePage } from './ShowroomAttendancePage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getShowrooms: vi.fn(),
		getDailyStaff: vi.fn(),
		confirmDailyStaffAttendance: vi.fn(),
		unlockDailyStaffAttendance: vi.fn(),
		assignDailyStaff: vi.fn(),
		updateDailyStaffAssignment: vi.fn(),
		updateDailyStaffVehicles: vi.fn(),
		removeDailyStaff: vi.fn(),
		getStaffList: vi.fn(),
	};
});

describe('ShowroomAttendancePage Component (Phase 2A — Dedicated Showroom Attendance)', () => {
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
			activeStaffCountToday: 2,
			totalVehiclesToday: 15,
		},
		{
			id: 'sr-2',
			masterId: 'KU10001',
			name: 'KUN BMW Showroom',
			address: 'OMR, Chennai',
			phone: '9876500002',
			gstin: null,
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: null,
			activeStaffCountToday: 0,
			totalVehiclesToday: 0,
		},
		{
			id: 'sr-3',
			masterId: 'FO10001',
			name: 'Inactive Ford Showroom',
			address: 'GST Road, Chennai',
			phone: '9876500003',
			gstin: null,
			isActive: false,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: null,
			activeStaffCountToday: 0,
			totalVehiclesToday: 0,
		},
		{
			id: 'e6-guid-9999-missing-master',
			masterId: null as any,
			name: 'Missing MasterId Dealership',
			address: 'Velachery, Chennai',
			phone: '9876500004',
			gstin: null,
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: null,
			activeStaffCountToday: 0,
			totalVehiclesToday: 0,
		},
	];

	const mockDailyStaff: api.DailyStaffResponse = {
		showroomId: 'sr-1',
		showroomName: 'Popular Hyundai Showroom',
		date: '2026-09-24',
		totalVehiclesAttended: 0,
		isAttendanceConfirmed: false,
		attendanceConfirmedAt: null,
		attendanceConfirmedByUserId: null,
		attendanceConfirmedByName: null,
		staffAssignments: [
			{
				id: 'assign-1',
				showroomId: 'sr-1',
				showroomName: 'Popular Hyundai Showroom',
				staffId: 'st-1',
				staffMasterId: 'RA101H',
				staffName: 'Ramesh Kumar',
				staffPhone: '9876543210',
				staffRole: 'Detailer',
				date: '2026-09-24',
				startTime: '09:00',
				endTime: '14:00',
				workingHours: 5,
				workingHoursFormatted: '5h',
				status: 'Present',
				assignmentType: 'Regular',
				homeShowroomId: 'sr-1',
				homeShowroomMasterId: 'PO10001',
				homeShowroomName: 'Popular Hyundai Showroom',
				transferReason: null,
				notes: null,
				vehiclesAttended: 0,
				createdAt: '2026-09-24T08:00:00Z',
			},
			{
				id: 'assign-2',
				showroomId: 'sr-1',
				showroomName: 'Popular Hyundai Showroom',
				staffId: 'st-2',
				staffMasterId: 'SU102B',
				staffName: 'Suresh Babu',
				staffPhone: '9876543211',
				staffRole: 'Cleaner',
				date: '2026-09-24',
				startTime: '14:00',
				endTime: '18:00',
				workingHours: 4,
				workingHoursFormatted: '4h',
				status: 'TemporaryTransfer',
				assignmentType: 'TemporaryTransfer',
				homeShowroomId: 'sr-2',
				homeShowroomMasterId: 'KU10001',
				homeShowroomName: 'KUN BMW Showroom',
				transferReason: 'Covering afternoon shift',
				notes: null,
				vehiclesAttended: 0,
				createdAt: '2026-09-24T08:30:00Z',
			},
		],
	};

	const mockStaffDirectory: api.StaffDto[] = [
		{
			id: 'st-1',
			staffMasterId: 'RA101H',
			name: 'Ramesh Kumar',
			phoneNumber: '9876543210',
			role: 'Detailer',
			isActive: true,
			defaultShowroomId: 'sr-1',
			defaultShowroomName: 'Popular Hyundai Showroom',
			email: null,
			address: null,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
		},
		{
			id: 'st-3',
			staffMasterId: 'VI103V',
			name: 'Vijay Verma',
			phoneNumber: '9876543212',
			role: 'Washer',
			isActive: true,
			defaultShowroomId: 'sr-2',
			defaultShowroomName: 'KUN BMW Showroom',
			email: null,
			address: null,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
		},
		{
			id: 'st-4',
			staffMasterId: 'KA104R',
			name: 'Karthik Raja',
			phoneNumber: '9876543213',
			role: 'Technician',
			isActive: true,
			defaultShowroomId: 'sr-1',
			defaultShowroomName: 'Popular Hyundai Showroom',
			email: null,
			address: null,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getShowrooms).mockResolvedValue(mockShowrooms);
		vi.mocked(api.getDailyStaff).mockResolvedValue(mockDailyStaff);
		vi.mocked(api.getStaffList).mockResolvedValue(mockStaffDirectory);
		vi.mocked(api.assignDailyStaff).mockResolvedValue(mockDailyStaff.staffAssignments[0]);
		vi.mocked(api.updateDailyStaffAssignment).mockResolvedValue(mockDailyStaff.staffAssignments[0]);
		vi.mocked(api.removeDailyStaff).mockResolvedValue(undefined as any);
		vi.mocked(api.confirmDailyStaffAttendance).mockResolvedValue({
			...mockDailyStaff,
			isAttendanceConfirmed: true,
			attendanceConfirmedAt: '2026-09-24T17:00:00Z',
			attendanceConfirmedByName: 'Admin User',
		});
		vi.mocked(api.unlockDailyStaffAttendance).mockResolvedValue({
			...mockDailyStaff,
			isAttendanceConfirmed: false,
			attendanceConfirmedAt: null,
			attendanceConfirmedByName: null,
		});
	});

	it('1. renders Showroom Attendance landing directory as a professional table with master details', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance'],
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
		});

		// Header & Subtitle
		expect(screen.getByRole('heading', { name: 'Showroom Attendance' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Back to Showrooms/i })).toBeInTheDocument();

		// Search Input
		expect(
			screen.getByPlaceholderText('Search by showroom name, address, or Master ID...')
		).toBeInTheDocument();

		// Table Headers
		expect(screen.getByRole('columnheader', { name: /Showroom/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /Master ID/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /Address/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /Status/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /Actions/i })).toBeInTheDocument();

		// Showroom Rows Details
		expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		expect(screen.getByText('#PO10001')).toBeInTheDocument();
		expect(screen.getByText('Anna Salai, Chennai')).toBeInTheDocument();

		expect(screen.getByText('KUN BMW Showroom')).toBeInTheDocument();
		expect(screen.getByText('#KU10001')).toBeInTheDocument();
		expect(screen.getByText('OMR, Chennai')).toBeInTheDocument();

		expect(screen.getByText('Inactive Ford Showroom')).toBeInTheDocument();
		expect(screen.getByText('#FO10001')).toBeInTheDocument();
		expect(screen.getByText('GST Road, Chennai')).toBeInTheDocument();

		expect(screen.getByText('Missing MasterId Dealership')).toBeInTheDocument();
		expect(screen.getByText('—')).toBeInTheDocument();
		expect(screen.queryByText(/e6-guid-9999-missing-master/i)).not.toBeInTheDocument();

		// Active & Inactive Status Badges
		const activeBadges = screen.getAllByText('Active');
		expect(activeBadges.length).toBeGreaterThanOrEqual(2);
		expect(screen.getByText('Inactive')).toBeInTheDocument();

		// Open Attendance buttons
		const openButtons = screen.getAllByRole('button', { name: /Open Attendance/i });
		expect(openButtons.length).toBe(4);
		expect(openButtons[0]).not.toBeDisabled(); // sr-1 (active)
		expect(openButtons[1]).not.toBeDisabled(); // sr-2 (active)
		expect(openButtons[2]).toBeDisabled(); // sr-3 (inactive)
		expect(openButtons[3]).not.toBeDisabled(); // sr-4 (active)

		// Operational attendance queries must not be called on landing
		expect(api.getDailyStaff).not.toHaveBeenCalled();
	});

	it('1b. filters directory table by showroom name, address, and Master ID', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance'],
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
		});

		const searchInput = screen.getByPlaceholderText('Search by showroom name, address, or Master ID...');

		// Search by Name
		fireEvent.change(searchInput, { target: { value: 'Hyundai' } });
		expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		expect(screen.queryByText('KUN BMW Showroom')).not.toBeInTheDocument();
		expect(screen.queryByText('Inactive Ford Showroom')).not.toBeInTheDocument();

		// Search by Address
		fireEvent.change(searchInput, { target: { value: 'OMR' } });
		expect(screen.queryByText('Popular Hyundai Showroom')).not.toBeInTheDocument();
		expect(screen.getByText('KUN BMW Showroom')).toBeInTheDocument();
		expect(screen.queryByText('Inactive Ford Showroom')).not.toBeInTheDocument();

		// Search by Master ID
		fireEvent.change(searchInput, { target: { value: 'FO10001' } });
		expect(screen.queryByText('Popular Hyundai Showroom')).not.toBeInTheDocument();
		expect(screen.queryByText('KUN BMW Showroom')).not.toBeInTheDocument();
		expect(screen.getByText('Inactive Ford Showroom')).toBeInTheDocument();
	});

	it('1c. clicking Open Attendance button opens attendance workspace for selected showroom', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance'],
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
		});

		const openButtons = screen.getAllByRole('button', { name: /Open Attendance/i });
		fireEvent.click(openButtons[0]);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
		});

		// Now daily staff query should be called for sr-1
		expect(api.getDailyStaff).toHaveBeenCalledWith('sr-1', expect.any(String));
	});

	it('1d. ensures the internal showroom GUID is NEVER rendered as the Master ID, displaying "—" fallback', async () => {
		// Mock daily staff for sr-4
		vi.mocked(api.getDailyStaff).mockResolvedValueOnce({
			...mockDailyStaff,
			showroomId: 'e6-guid-9999-missing-master',
			showroomName: 'Missing MasterId Dealership',
		});

		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=e6-guid-9999-missing-master'],
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
			expect(screen.getByRole('heading', { name: 'Missing MasterId Dealership' })).toBeInTheDocument();
		});

		// Header context badge should display "—", NOT the GUID
		expect(screen.getByText('—')).toBeInTheDocument();
		expect(screen.queryByText(/e6-guid-9999-missing-master/i)).not.toBeInTheDocument();
		expect(screen.queryByText('#e6-guid-9999-missing-master')).not.toBeInTheDocument();

		// Quick Switcher dropdown should format the option with "—", NOT the GUID
		const switcherOption = screen.getByRole('option', { name: /Missing MasterId Dealership \(—\)/i });
		expect(switcherOption).toBeInTheDocument();
	});

	it('2. selects a showroom and loads dedicated Attendance workspace with correct columns and no vehicles attended', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff', 'showroom.edit_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
		});

		// Header Context
		expect(screen.getByText('#PO10001')).toBeInTheDocument();
		expect(screen.getByText('GSTIN: 33AAAAA0000A1Z5')).toBeInTheDocument();
		expect(screen.getByText('Anna Salai, Chennai')).toBeInTheDocument();
		expect(screen.getByText('9876500001')).toBeInTheDocument();

		// Quick Switcher dropdown
		const switcher = screen.getByLabelText('Quick Switch Showroom');
		expect(switcher).toBeInTheDocument();
		expect(switcher.tagName.toLowerCase()).toBe('select');

		// Table Columns (Phase 12 specification)
		expect(screen.getByRole('columnheader', { name: 'Staff ID' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Staff Name' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /Role & Contact/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Working Time' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Working Hours' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Home Showroom' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();

		// Vehicles Attended column MUST NOT be present
		expect(screen.queryByRole('columnheader', { name: /Vehicles Attended/i })).not.toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
			expect(screen.getByText('Suresh Babu')).toBeInTheDocument();
		});
		expect(screen.getByText('#RA101H')).toBeInTheDocument();
		expect(screen.getByText('#SU102B')).toBeInTheDocument();
		expect(screen.getByText('09:00 – 14:00')).toBeInTheDocument();
		expect(screen.getByText('14:00 – 18:00')).toBeInTheDocument();
		expect(screen.getByText('5h')).toBeInTheDocument();
		expect(screen.getByText('4h')).toBeInTheDocument();
		expect(screen.getByText('Present')).toBeInTheDocument();
		expect(screen.getByText('Temporary Transfer')).toBeInTheDocument();
		expect(screen.getByText('KUN BMW Showroom')).toBeInTheDocument();
	});

	it('3. allows assigning staff member with regular assignment and start/end times', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
		});

		expect(screen.getByText('Assign Staff')).toBeInTheDocument();
		fireEvent.click(screen.getByText('Assign Staff'));

		await waitFor(() => {
			expect(screen.getByText('Assign Staff to Showroom')).toBeInTheDocument();
		});

		// Select Karthik Raja (home showroom sr-1)
		const select = screen.getByLabelText('Staff Member *');
		fireEvent.change(select, { target: { value: 'st-4' } });

		const startTimeInput = screen.getByLabelText('Start Time *');
		fireEvent.change(startTimeInput, { target: { value: '09:00' } });

		const endTimeInput = screen.getByLabelText('End Time *');
		fireEvent.change(endTimeInput, { target: { value: '18:00' } });

		// Confirm assignment
		const dialog = screen.getByRole('dialog');
		const assignBtn = within(dialog).getByRole('button', { name: /^Assign Staff$/i });
		fireEvent.click(assignBtn);

		await waitFor(() => {
			expect(api.assignDailyStaff).toHaveBeenCalledWith('sr-1', {
				staffId: 'st-4',
				date: expect.any(String),
				startTime: '09:00',
				endTime: '18:00',
				assignmentType: 'Regular',
				transferReason: undefined,
				notes: undefined,
			});
		});
	});

	it('4. allows assigning staff member with temporary transfer and transfer reason', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Assign Staff'));

		await waitFor(() => {
			expect(screen.getByText('Assign Staff to Showroom')).toBeInTheDocument();
		});

		// Select Vijay Verma
		const select = screen.getByLabelText('Staff Member *');
		fireEvent.change(select, { target: { value: 'st-3' } });

		// Select Temporary Transfer radio
		const transferRadio = screen.getByRole('radio', { name: /Temporary Transfer/i });
		fireEvent.click(transferRadio);

		// Enter times and transfer reason
		const startTimeInput = screen.getByLabelText('Start Time *');
		fireEvent.change(startTimeInput, { target: { value: '14:00' } });

		const endTimeInput = screen.getByLabelText('End Time *');
		fireEvent.change(endTimeInput, { target: { value: '18:00' } });

		const reasonInput = screen.getByLabelText('Transfer Reason *');
		fireEvent.change(reasonInput, { target: { value: 'Covering Ramesh after 14:00' } });

		// Confirm assignment
		const dialog = screen.getByRole('dialog');
		const assignBtn = within(dialog).getByRole('button', { name: /^Assign Staff$/i });
		fireEvent.click(assignBtn);

		await waitFor(() => {
			expect(api.assignDailyStaff).toHaveBeenCalledWith('sr-1', {
				staffId: 'st-3',
				date: expect.any(String),
				startTime: '14:00',
				endTime: '18:00',
				assignmentType: 'TemporaryTransfer',
				transferReason: 'Covering Ramesh after 14:00',
				notes: undefined,
			});
		});
	});

	it('5. allows removing daily staff assignment with confirmation modal', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
		});

		await waitFor(() => {
			expect(screen.getAllByTitle('Remove staff assignment')[0]).toBeInTheDocument();
		});
		fireEvent.click(screen.getAllByTitle('Remove staff assignment')[0]);

		await waitFor(() => {
			expect(screen.getByText(/Remove Staff Assignment/i)).toBeInTheDocument();
		});

		// Confirm removal
		const dialog = screen.getByRole('dialog');
		const removeBtn = within(dialog).getByRole('button', { name: /^Remove Staff$/i });
		fireEvent.click(removeBtn);

		await waitFor(() => {
			expect(api.removeDailyStaff).toHaveBeenCalledWith('assign-1');
		});
	});

	it('6. confirms daily attendance and locks roster', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.confirm_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Confirm Attendance/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Confirm Attendance/i }));

		await waitFor(() => {
			expect(api.confirmDailyStaffAttendance).toHaveBeenCalledWith('sr-1', expect.any(String));
		});
	});

	it('7. locked confirmed attendance shows emerald banner and allows Owner unlock for correction', async () => {
		vi.mocked(api.getDailyStaff).mockResolvedValueOnce({
			...mockDailyStaff,
			isAttendanceConfirmed: true,
			attendanceConfirmedAt: '2026-09-24T17:00:00Z',
			attendanceConfirmedByName: 'Admin User',
		});

		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
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
			expect(screen.getByText(/Attendance Confirmed for/i)).toBeInTheDocument();
		});

		// Owner sees Unlock for Correction button
		const unlockBtn = screen.getByRole('button', { name: /Unlock for Correction/i });
		expect(unlockBtn).toBeInTheDocument();

		fireEvent.click(unlockBtn);

		await waitFor(() => {
			expect(screen.getByText(/Unlock Daily Attendance/i)).toBeInTheDocument();
		});

		// Confirm unlock
		const dialog = screen.getByRole('dialog');
		const confirmUnlockBtn = within(dialog).getByRole('button', { name: /^Unlock Attendance$/i });
		fireEvent.click(confirmUnlockBtn);

		await waitFor(() => {
			expect(api.unlockDailyStaffAttendance).toHaveBeenCalledWith('sr-1', expect.any(String));
		});
	});

	it('8. non-owner cannot see Unlock for Correction button when attendance is locked', async () => {
		vi.mocked(api.getDailyStaff).mockResolvedValueOnce({
			...mockDailyStaff,
			isAttendanceConfirmed: true,
			attendanceConfirmedAt: '2026-09-24T17:00:00Z',
			attendanceConfirmedByName: 'Admin User',
		});

		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-2',
					fullName: 'Manager User',
					username: 'manager',
					role: 'Manager',
					isOwner: false,
					permissions: ['showroom.view', 'showroom.confirm_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText(/Attendance Confirmed for/i)).toBeInTheDocument();
		});

		expect(screen.queryByRole('button', { name: /Unlock for Correction/i })).not.toBeInTheDocument();
	});

	it('9. supports date navigation (Previous, Today, Next)', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1&date=2026-09-24'],
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
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
		});

		const nextDayBtn = screen.getByTitle('Next Day');
		fireEvent.click(nextDayBtn);

		await waitFor(() => {
			expect(api.getDailyStaff).toHaveBeenCalledWith('sr-1', '2026-09-25');
		});
	});

	it('10. displays clear empty state when no staff attendance exists for date, with Assign Staff action', async () => {
		vi.mocked(api.getDailyStaff).mockResolvedValueOnce({
			...mockDailyStaff,
			staffAssignments: [],
			totalVehiclesAttended: 0,
		});

		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
		});

		await waitFor(() => {
			expect(screen.getByText('No staff attendance recorded for this date.')).toBeInTheDocument();
		});
		expect(
			screen.getByText('Assign staff to record working hours and enable showroom operations.')
		).toBeInTheDocument();

		// Empty state action button
		const assignButtons = screen.getAllByRole('button', { name: /Assign Staff/i });
		expect(assignButtons.length).toBeGreaterThanOrEqual(1);

		fireEvent.click(assignButtons[assignButtons.length - 1]);

		await waitFor(() => {
			expect(screen.getByText('Assign Staff to Showroom')).toBeInTheDocument();
		});
	});

	it('11. when showroom has no GSTIN, does not render GSTIN badge', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-2'],
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
			expect(screen.getByRole('heading', { name: 'KUN BMW Showroom' })).toBeInTheDocument();
		});

		expect(screen.getByText('#KU10001')).toBeInTheDocument();
		expect(screen.queryByText(/GSTIN:/i)).not.toBeInTheDocument();
	});

	it('12. renders Edit button in Actions column for each attendance row', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff', 'showroom.edit_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		// Both Edit and Remove buttons should be present
		expect(screen.getByRole('button', { name: /Edit Ramesh Kumar attendance/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Remove Ramesh Kumar assignment/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Edit Suresh Babu attendance/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Remove Suresh Babu assignment/i })).toBeInTheDocument();
	});

	it('13. clicking Edit opens Edit Attendance modal with pre-populated values', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff', 'showroom.edit_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Edit Ramesh Kumar attendance/i }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Edit Attendance' })).toBeInTheDocument();
		});

		const dialog = screen.getByRole('dialog');

		// Check pre-populated context
		expect(within(dialog).getByText('Update working time and attendance details for Ramesh Kumar')).toBeInTheDocument();
		expect(within(dialog).getByLabelText('Attendance Status')).toHaveValue('Present');
		expect(within(dialog).getByLabelText('Start Time')).toHaveValue('09:00');
		expect(within(dialog).getByLabelText('End Time')).toHaveValue('14:00');
		expect(within(dialog).getByText('5h')).toBeInTheDocument();
	});

	it('14. user can change working time and see working hours update live', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff', 'showroom.edit_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Edit Ramesh Kumar attendance/i }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Edit Attendance' })).toBeInTheDocument();
		});

		const dialog = screen.getByRole('dialog');
		const endTimeInput = within(dialog).getByLabelText('End Time');
		fireEvent.change(endTimeInput, { target: { value: '18:00' } });

		// Working hours should update from 5h to 9h
		expect(within(dialog).getByText('9h')).toBeInTheDocument();
	});

	it('15. user can change attendance status', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff', 'showroom.edit_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Edit Ramesh Kumar attendance/i }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Edit Attendance' })).toBeInTheDocument();
		});

		const dialog = screen.getByRole('dialog');
		const statusSelect = within(dialog).getByLabelText('Attendance Status');
		fireEvent.change(statusSelect, { target: { value: 'HalfDay' } });
		expect(statusSelect).toHaveValue('HalfDay');
	});

	it('16. validation prevents invalid time ranges (end <= start)', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff', 'showroom.edit_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Edit Ramesh Kumar attendance/i }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Edit Attendance' })).toBeInTheDocument();
		});

		const dialog = screen.getByRole('dialog');
		const startTimeInput = within(dialog).getByLabelText('Start Time');
		const endTimeInput = within(dialog).getByLabelText('End Time');
		fireEvent.change(startTimeInput, { target: { value: '18:00' } });
		fireEvent.change(endTimeInput, { target: { value: '09:00' } });

		expect(within(dialog).getByText('Invalid Time Range')).toBeInTheDocument();
		const saveButton = within(dialog).getByRole('button', { name: /Save Changes/i });
		expect(saveButton).toBeDisabled();
	});

	it('17. submitting valid edit calls updateDailyStaffAssignment, displays success notification, and closes modal', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff', 'showroom.edit_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Edit Ramesh Kumar attendance/i }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Edit Attendance' })).toBeInTheDocument();
		});

		fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '18:00' } });
		fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

		await waitFor(() => {
			expect(api.updateDailyStaffAssignment).toHaveBeenCalledWith('assign-1', {
				startTime: '09:00',
				endTime: '18:00',
				status: 'Present',
				transferReason: null,
				notes: null,
			});
		});

		await waitFor(() => {
			expect(screen.queryByRole('heading', { name: 'Edit Attendance' })).not.toBeInTheDocument();
		});

		expect(screen.getByText('Attendance record updated successfully.')).toBeInTheDocument();
	});

	it('18. cancel closes the edit modal without submitting', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff', 'showroom.edit_attendance'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Edit Ramesh Kumar attendance/i }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Edit Attendance' })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

		await waitFor(() => {
			expect(screen.queryByRole('heading', { name: 'Edit Attendance' })).not.toBeInTheDocument();
		});

		expect(api.updateDailyStaffAssignment).not.toHaveBeenCalled();
	});

	it('19. delete action continues to work as expected', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Remove Ramesh Kumar assignment/i }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Remove Staff Assignment' })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: 'Remove Staff' }));

		await waitFor(() => {
			expect(api.removeDailyStaff).toHaveBeenCalledWith('assign-1');
		});
	});

	it('20. attempting to assign staff during overlapping hours across showrooms fails and displays validation message', async () => {
		vi.mocked(api.assignDailyStaff).mockRejectedValueOnce(
			new Error("Staff member 'Ramesh Kumar' already has an active assignment at 'Popular Hyundai Showroom' from 09:00 to 14:00 on 2026-09-24. Overlapping assignments are not allowed.")
		);

		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-2'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'KUN BMW Showroom' })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Assign Staff'));

		await waitFor(() => {
			expect(screen.getByText('Assign Staff to Showroom')).toBeInTheDocument();
		});

		// Select Ramesh Kumar
		const select = screen.getByLabelText('Staff Member *');
		fireEvent.change(select, { target: { value: 'st-1' } });

		// Enter overlapping times 10:00 - 13:00
		const startTimeInput = screen.getByLabelText('Start Time *');
		fireEvent.change(startTimeInput, { target: { value: '10:00' } });

		const endTimeInput = screen.getByLabelText('End Time *');
		fireEvent.change(endTimeInput, { target: { value: '13:00' } });

		const reasonInput = screen.getByLabelText('Transfer Reason *');
		fireEvent.change(reasonInput, { target: { value: 'Inter-showroom overlap test' } });

		const dialog = screen.getByRole('dialog');
		const assignBtn = within(dialog).getByRole('button', { name: /^Assign Staff$/i });
		fireEvent.click(assignBtn);

		await waitFor(() => {
			expect(api.assignDailyStaff).toHaveBeenCalled();
		});

		// Error message is displayed inside the modal
		await waitFor(() => {
			expect(screen.getByText(/already has an active assignment at 'Popular Hyundai Showroom' from 09:00 to 14:00/i)).toBeInTheDocument();
		});

		// Modal remains open
		expect(screen.getByText('Assign Staff to Showroom')).toBeInTheDocument();
	});

	it('21. assigning staff at exact boundary time (14:00-18:00) after prior session (09:00-14:00) succeeds', async () => {
		vi.mocked(api.assignDailyStaff).mockResolvedValueOnce({
			id: 'assign-new',
			showroomId: 'sr-2',
			showroomName: 'KUN BMW Showroom',
			staffId: 'st-1',
			staffMasterId: 'RA101H',
			staffName: 'Ramesh Kumar',
			staffPhone: '9876543210',
			staffRole: 'Detailer',
			date: '2026-09-24',
			startTime: '14:00',
			endTime: '18:00',
			workingHours: 4,
			workingHoursFormatted: '4h',
			status: 'TemporaryTransfer',
			assignmentType: 'TemporaryTransfer',
			homeShowroomId: 'sr-1',
			homeShowroomMasterId: 'PO10001',
			homeShowroomName: 'Popular Hyundai Showroom',
			transferReason: 'Afternoon assist',
			notes: null,
			vehiclesAttended: 0,
			createdAt: '2026-09-24T14:00:00Z',
		});

		renderWithProviders(
			<Routes>
				<Route path="/showroom/attendance" element={<ShowroomAttendancePage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/attendance?showroomId=sr-2'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.assign_staff'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'KUN BMW Showroom' })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Assign Staff'));

		await waitFor(() => {
			expect(screen.getByText('Assign Staff to Showroom')).toBeInTheDocument();
		});

		// Select Ramesh Kumar
		const select = screen.getByLabelText('Staff Member *');
		fireEvent.change(select, { target: { value: 'st-1' } });

		// Enter exact boundary times 14:00 - 18:00
		const startTimeInput = screen.getByLabelText('Start Time *');
		fireEvent.change(startTimeInput, { target: { value: '14:00' } });

		const endTimeInput = screen.getByLabelText('End Time *');
		fireEvent.change(endTimeInput, { target: { value: '18:00' } });

		const reasonInput = screen.getByLabelText('Transfer Reason *');
		fireEvent.change(reasonInput, { target: { value: 'Afternoon assist' } });

		const dialog = screen.getByRole('dialog');
		const assignBtn = within(dialog).getByRole('button', { name: /^Assign Staff$/i });
		fireEvent.click(assignBtn);

		await waitFor(() => {
			expect(api.assignDailyStaff).toHaveBeenCalledWith('sr-2', expect.objectContaining({
				staffId: 'st-1',
				startTime: '14:00',
				endTime: '18:00',
			}));
		});

		// Modal closes upon success
		await waitFor(() => {
			expect(screen.queryByText('Assign Staff to Showroom')).not.toBeInTheDocument();
		});
	});
});
