import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { AttendancePage } from './AttendancePage';
import { SalaryPage } from './SalaryPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getStaffList: vi.fn(),
		getDailyAttendance: vi.fn(),
		getDateRangeAttendance: vi.fn(),
		upsertStaffAttendance: vi.fn(),
		deleteStaffAttendance: vi.fn(),
		confirmStaffAttendance: vi.fn(),
		unlockStaffAttendance: vi.fn(),
		getStaffSalaryRoster: vi.fn(),
		getStaffSalaryPreview: vi.fn(),
		saveEnteredSalary: vi.fn(),
		settleStaffSalary: vi.fn(),
		getStaffSalarySettlementHistory: vi.fn(),
	};
});

describe('Staff Attendance & Salary', () => {
	const mockDailyResponse: api.DailyAttendanceResponse = {
		date: '2026-09-22',
		isAttendanceConfirmed: false,
		attendanceConfirmedAt: null,
		attendanceConfirmedByUserId: null,
		attendanceConfirmedByName: null,
		summary: {
			totalActiveStaff: 2,
			presentCount: 1,
			halfDayCount: 0,
			leaveCount: 0,
			unmarkedCount: 1,
		},
		staffMembers: [
			{
				staffId: 'staff-1',
				staffName: 'Karthik Raja',
				staffRole: 'Technician',
				staffPhoneNumber: '9876540001',
				isActive: true,
				attendanceId: 'att-1',
				status: 'Present',
				checkInTime: '09:00',
				checkOutTime: '18:00',
				workingHours: 9,
				workingHoursFormatted: '9h',
				notes: null,
				attendanceDate: '2026-09-22',
			},
			{
				staffId: 'staff-2',
				staffName: 'Ravi Kumar',
				staffRole: 'Manager',
				staffPhoneNumber: '9876540002',
				isActive: true,
				attendanceId: null,
				status: 'Unmarked',
				checkInTime: null,
				checkOutTime: null,
				workingHours: null,
				workingHoursFormatted: null,
				notes: null,
				attendanceDate: '2026-09-22',
			},
		],
	};

	const mockRangeResponse: api.DateRangeAttendanceResponse = {
		fromDate: '2026-09-01',
		toDate: '2026-09-22',
		totalRecords: 1,
		presentCount: 1,
		halfDayCount: 0,
		leaveCount: 0,
		records: [
			{
				id: 'att-range-1',
				staffId: 'staff-1',
				staffName: 'Karthik Raja',
				staffRole: 'Technician',
				staffPhoneNumber: '9876540001',
				attendanceDate: '2026-09-20',
				status: 'Present',
				checkInTime: '09:30',
				checkOutTime: '18:30',
				workingHours: 9,
				workingHoursFormatted: '9h',
				notes: 'Range work',
				createdAt: '2026-09-20T09:30:00Z',
			},
		],
	};

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
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getStaffList).mockResolvedValue(mockStaffList);
		vi.mocked(api.getDailyAttendance).mockResolvedValue(mockDailyResponse);
		vi.mocked(api.getDateRangeAttendance).mockResolvedValue(mockRangeResponse);
	});

	describe('AttendancePage (/staff-attendance)', () => {
		it('1. Custom Date button is no longer rendered and no Daily View tabs exist', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Staff Attendance')).toBeInTheDocument();
			});

			// No "Custom Date" button or modal trigger
			expect(screen.queryByRole('button', { name: /custom date/i })).not.toBeInTheDocument();
			expect(screen.queryByText(/^custom date$/i)).not.toBeInTheDocument();
			// No "Daily View" button or tab
			expect(screen.queryByRole('button', { name: /daily view/i })).not.toBeInTheDocument();
		});

		it('2. Absent is completely removed from status options, action buttons, and KPI cards', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Staff Attendance')).toBeInTheDocument();
				expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
			});

			// Status options should only have: All Status, Present, Half Day, Leave, Unmarked
			const select = screen.getByRole('combobox');
			const optionTexts = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
			expect(optionTexts).not.toContain('Absent');
			expect(optionTexts).toContain('All Status');
			expect(optionTexts).toContain('Present');
			expect(optionTexts).toContain('Half Day');
			expect(optionTexts).toContain('Leave');
			expect(optionTexts).toContain('Unmarked');

			// Table actions should NOT have "Mark as Absent" button
			expect(screen.queryByTitle('Mark as Absent')).not.toBeInTheDocument();
			expect(screen.getAllByTitle('Mark as Present').length).toBeGreaterThan(0);
			expect(screen.getAllByTitle('Mark as Half Day').length).toBeGreaterThan(0);
			expect(screen.getAllByTitle('Mark as Leave').length).toBeGreaterThan(0);

			// Summary cards and status options should NOT have an Absent entry
			expect(screen.queryByText(/^absent$/i)).not.toBeInTheDocument();
			expect(screen.getByText('Total Staff')).toBeInTheDocument();
			expect(screen.getAllByText('Present').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Half Day').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Leave').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Unmarked').length).toBeGreaterThan(0);
		});

		it('3. From Date and To Date inputs and all filter labels are rendered matching Staff Advances pattern', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Staff Attendance')).toBeInTheDocument();
			});

			// All filter labels placed above controls
			expect(screen.getByText('Date')).toBeInTheDocument();
			expect(screen.getByText('Staff')).toBeInTheDocument();
			expect(screen.getByText('Status')).toBeInTheDocument();
			expect(screen.getByText('From Date')).toBeInTheDocument();
			expect(screen.getByText('To Date')).toBeInTheDocument();

			// Both date inputs rendered
			expect(screen.getByLabelText('From Date')).toBeInTheDocument();
			expect(screen.getByLabelText('To Date')).toBeInTheDocument();
		});

		it('4. Staff search remains functional', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
			});

			const searchInput = screen.getByPlaceholderText('Search staff by name or role...');
			fireEvent.change(searchInput, { target: { value: 'Karthik' } });

			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
			expect(screen.queryByText('Ravi Kumar')).not.toBeInTheDocument();
		});

		it('5. Status filter filters roster by Present, HalfDay, Leave, Unmarked', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
				expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
			});

			const select = screen.getByRole('combobox');
			fireEvent.change(select, { target: { value: 'Present' } });

			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
			expect(screen.queryByText('Ravi Kumar')).not.toBeInTheDocument();
		});

		it('6. Daily date navigation and Today button remain functional', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByTitle('Previous Day')).toBeInTheDocument();
			});

			// Previous Day
			fireEvent.click(screen.getByTitle('Previous Day'));
			expect(api.getDailyAttendance).toHaveBeenCalled();

			// Next Day
			fireEvent.click(screen.getByTitle('Next Day'));
			expect(api.getDailyAttendance).toHaveBeenCalled();

			// Today
			fireEvent.click(screen.getByRole('button', { name: /today/i }));
			expect(api.getDailyAttendance).toHaveBeenCalled();
		});

		it('7. From/To validation prevents invalid ranges (From Date > To Date)', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByLabelText('From Date')).toBeInTheDocument();
			});

			const fromInput = screen.getByLabelText('From Date');
			const toInput = screen.getByLabelText('To Date');

			// Enter an invalid range: From > To
			fireEvent.change(fromInput, { target: { value: '2026-09-25' } });
			vi.mocked(api.getDateRangeAttendance).mockClear();
			fireEvent.change(toInput, { target: { value: '2026-09-20' } });

			// API should NOT be called with invalid dates
			expect(api.getDateRangeAttendance).not.toHaveBeenCalled();

			// Clear validation warning should be displayed
			expect(
				screen.getByText(/From Date cannot be later than To Date/i)
			).toBeInTheDocument();
		});

		it('8. Applying valid From/To date range queries range API, and clearing returns to daily behaviour', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByLabelText('From Date')).toBeInTheDocument();
			});

			const fromInput = screen.getByLabelText('From Date');
			const toInput = screen.getByLabelText('To Date');

			// Enter valid range
			fireEvent.change(fromInput, { target: { value: '2026-09-01' } });
			fireEvent.change(toInput, { target: { value: '2026-09-22' } });

			await waitFor(() => {
				expect(api.getDateRangeAttendance).toHaveBeenCalledWith(
					expect.objectContaining({
						fromDate: '2026-09-01',
						toDate: '2026-09-22',
					})
				);
			});

			// Header shows range history indicator and Return to Daily View button
			expect(screen.getByText(/History: 2026-09-01 to 2026-09-22/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /return to daily view/i })).toBeInTheDocument();

			// Clear range by clicking Return to Daily View
			fireEvent.click(screen.getByRole('button', { name: /return to daily view/i }));

			// Should return to daily attendance
			await waitFor(() => {
				expect(screen.queryByText(/History: 2026-09-01 to 2026-09-22/i)).not.toBeInTheDocument();
				expect(fromInput).toHaveValue('');
				expect(toInput).toHaveValue('');
			});
		});

		it('9. Existing attendance marking functionality (Present, Half Day, Leave) remains functional', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
				expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
			});

			const presentButtons = screen.getAllByTitle('Mark as Present');
			expect(presentButtons.length).toBeGreaterThan(0);

			// Click Present on second staff member
			fireEvent.click(presentButtons[1]);
			await waitFor(() => {
				expect(api.upsertStaffAttendance).toHaveBeenCalled();
				expect(vi.mocked(api.upsertStaffAttendance).mock.calls[0][0]).toMatchObject({
					staffId: 'staff-2',
					status: 'Present',
				});
			});
		});

		it('10. Showroom confirmation banner: shows unconfirmed banner and enables Confirm Attendance when staff marked', async () => {
			vi.mocked(api.confirmStaffAttendance).mockResolvedValue({
				...mockDailyResponse,
				isAttendanceConfirmed: true,
				attendanceConfirmedAt: '2026-09-22T18:00:00Z',
				attendanceConfirmedByName: 'Admin',
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
					authUser: {
						id: 'usr-1',
						fullName: 'Admin User',
						username: 'admin',
						role: 'Owner',
						isOwner: true,
						permissions: ['staff_attendance.manage'],
					},
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
				expect(screen.getByText('Attendance Not Confirmed')).toBeInTheDocument();
				expect(screen.getByText('Open for edits')).toBeInTheDocument();
			});

			const confirmBtn = screen.getByRole('button', { name: /confirm attendance/i });
			expect(confirmBtn).not.toBeDisabled();

			// Click confirm attendance
			fireEvent.click(confirmBtn);

			await waitFor(() => {
				expect(api.confirmStaffAttendance).toHaveBeenCalledWith('2026-09-22');
			});
		});

		it('11. Confirmation validation: disables Confirm Attendance and shows warning when 0 staff marked', async () => {
			vi.mocked(api.getDailyAttendance).mockResolvedValueOnce({
				...mockDailyResponse,
				summary: {
					...mockDailyResponse.summary,
					presentCount: 0,
					unmarkedCount: 2,
				},
				staffMembers: mockDailyResponse.staffMembers.map((s) => ({
					...s,
					status: 'Unmarked',
					attendanceId: null,
				})),
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
					authUser: {
						id: 'usr-1',
						fullName: 'Admin User',
						username: 'admin',
						role: 'Owner',
						isOwner: true,
						permissions: ['staff_attendance.manage'],
					},
				}
			);

			await waitFor(() => {
				expect(
					screen.getByText('Please mark attendance for at least one staff member before confirming attendance.')
				).toBeInTheDocument();
			});

			const confirmBtn = screen.getByRole('button', { name: /confirm attendance/i });
			expect(confirmBtn).toBeDisabled();
		});

		it('12. Confirmed and locked state: displays emerald banner, disables edits, and allows Owner to unlock for correction', async () => {
			vi.mocked(api.getDailyAttendance).mockResolvedValue({
				...mockDailyResponse,
				isAttendanceConfirmed: true,
				attendanceConfirmedAt: '2026-09-22T18:00:00Z',
				attendanceConfirmedByName: 'Manager Gokul',
			});

			vi.mocked(api.unlockStaffAttendance).mockResolvedValue({
				...mockDailyResponse,
				isAttendanceConfirmed: false,
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
					authUser: {
						id: 'usr-1',
						fullName: 'Owner Admin',
						username: 'owner',
						role: 'Owner',
						isOwner: true,
						permissions: ['staff_attendance.manage'],
					},
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Attendance Confirmed')).toBeInTheDocument();
				expect(screen.getByText(/Locked/i)).toBeInTheDocument();
				expect(screen.getByText(/Confirmed by/i)).toBeInTheDocument();
				expect(screen.getByText('Manager Gokul')).toBeInTheDocument();
			});

			// Action buttons are disabled because table is locked
			const markButtons = screen.getAllByTitle(/Attendance is confirmed and locked/i);
			expect(markButtons.length).toBeGreaterThan(0);
			markButtons.forEach((btn) => {
				expect(btn).toBeDisabled();
			});

			// Owner sees "Correct Attendance" button
			const correctBtn = screen.getByRole('button', { name: /correct attendance/i });
			expect(correctBtn).toBeInTheDocument();

			// Click Correct Attendance -> opens Owner Unlock Dialog
			fireEvent.click(correctBtn);

			await waitFor(() => {
				expect(screen.getByText('Unlock Daily Attendance')).toBeInTheDocument();
				expect(screen.getByText(/Owner administrative correction workflow/i)).toBeInTheDocument();
			});

			// Click Unlock Attendance in dialog
			const unlockBtn = screen.getByRole('button', { name: /^unlock attendance$/i });
			fireEvent.click(unlockBtn);

			await waitFor(() => {
				expect(api.unlockStaffAttendance).toHaveBeenCalledWith('2026-09-22');
			});
		});

		it('13. Permission check: non-owner does not see Correct Attendance button when confirmed', async () => {
			vi.mocked(api.getDailyAttendance).mockResolvedValue({
				...mockDailyResponse,
				isAttendanceConfirmed: true,
				attendanceConfirmedAt: '2026-09-22T18:00:00Z',
				attendanceConfirmedByName: 'Manager Gokul',
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
					authUser: {
						id: 'usr-2',
						fullName: 'Staff User',
						username: 'staff',
						role: 'Staff',
						isOwner: false,
						permissions: ['staff_attendance.view'],
					},
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Attendance Confirmed')).toBeInTheDocument();
			});

			// Non-owner must NOT see Correct Attendance
			expect(screen.queryByRole('button', { name: /correct attendance/i })).not.toBeInTheDocument();
		});

		it('14. Existing API loading and error states continue passing', async () => {
			vi.mocked(api.getDailyAttendance).mockRejectedValueOnce(new Error('Network error loading attendance'));

			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText(/Failed to load attendance data/i)).toBeInTheDocument();
				expect(screen.getByText(/Network error loading attendance/i)).toBeInTheDocument();
				expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
			});
		});

		it('15. Leave badge uses red styling, delete button is absent, inactive staff are omitted, and summary cards precede filter bar', async () => {
			vi.mocked(api.getDailyAttendance).mockResolvedValueOnce({
				...mockDailyResponse,
				staffMembers: [
					...mockDailyResponse.staffMembers,
					{
						staffId: 'staff-inactive-99',
						staffName: 'Inactive Worker',
						staffRole: 'Helper',
						staffPhoneNumber: '9999999999',
						isActive: false,
						attendanceId: null,
						status: 'Unmarked',
						checkInTime: null,
						checkOutTime: null,
						workingHours: null,
						workingHoursFormatted: null,
						notes: null,
						attendanceDate: '2026-09-22',
					},
				],
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
			});

			// Inactive staff member should NOT be rendered
			expect(screen.queryByText('Inactive Worker')).not.toBeInTheDocument();

			// Delete button must NOT be present
			expect(screen.queryByTitle(/delete attendance record/i)).not.toBeInTheDocument();

			// Leave buttons should exist
			const leaveButtons = screen.getAllByTitle('Mark as Leave');
			expect(leaveButtons.length).toBeGreaterThan(0);

			// Summary cards (Total Staff, Present, Half Day, Leave, Unmarked) are displayed directly under the header before Date filter
			const totalStaffCard = screen.getByText('Total Staff');
			const dateFilterLabel = screen.getByText('Date');
			expect(totalStaffCard.compareDocumentPosition(dateFilterLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		});

		it('16. Dedicated staff_attendance.confirm permission controls Confirm Attendance visibility for non-owners', async () => {
			vi.mocked(api.getDailyAttendance).mockResolvedValue({
				...mockDailyResponse,
				isAttendanceConfirmed: false,
			});

			// Case A: User has staff_attendance.manage but NOT staff_attendance.confirm -> NO confirm button
			const { unmount } = renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
					authUser: {
						id: 'usr-3',
						fullName: 'Attendance Manager',
						username: 'att_manager',
						role: 'Manager',
						isOwner: false,
						permissions: ['staff_attendance.manage', 'staff_attendance.view'],
					},
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Attendance Not Confirmed')).toBeInTheDocument();
			});

			expect(screen.queryByRole('button', { name: /confirm attendance/i })).not.toBeInTheDocument();
			unmount();

			// Case B: User has dedicated staff_attendance.confirm -> Confirm button IS rendered
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
					authUser: {
						id: 'usr-4',
						fullName: 'Supervising Manager',
						username: 'sup_manager',
						role: 'Manager',
						isOwner: false,
						permissions: ['staff_attendance.confirm', 'staff_attendance.view'],
					},
				}
			);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /confirm attendance/i })).toBeInTheDocument();
			});
		});
	});

	describe('SalaryPage (/staff-salary)', () => {
		const sampleStaffList: api.StaffDto[] = [
			{
				id: 'staff-1',
				name: 'Karthik Raja',
				phoneNumber: '9876540001',
				email: 'karthik@e6carspa.com',
				address: 'Erode',
				role: 'Technician',
				isActive: true,
				totalAdvances: 1,
				totalAdvanceAmount: 5000,
				aadhaarMasked: 'XXXX XXXX 9012',
				hasAadhaarDocument: true,
			},
			{
				id: 'staff-2',
				name: 'Suresh Detailer',
				phoneNumber: '9876540002',
				email: 'suresh@e6carspa.com',
				address: null,
				role: 'Detailer',
				isActive: true,
				totalAdvances: 0,
				totalAdvanceAmount: 0,
				aadhaarMasked: 'XXXX XXXX 3456',
				hasAadhaarDocument: false,
			},
			{
				id: 'staff-3',
				name: 'Former Staff',
				phoneNumber: '9876540003',
				email: null,
				address: null,
				role: 'Washer',
				isActive: false,
				totalAdvances: 0,
				totalAdvanceAmount: 0,
				aadhaarMasked: 'XXXX XXXX 7890',
				hasAadhaarDocument: false,
			},
		];

		const sampleRosterResponse: api.StaffSalaryRosterResponse = {
			periodFrom: '2026-09-01',
			periodTo: '2026-09-30',
			totalStaffCount: 3,
			notEnteredCount: 1,
			readyCount: 1,
			settledCount: 1,
			totalEnteredSalary: 45000,
			totalAdvanceDeductions: 10000,
			totalFinalSalary: 35000,
			items: [
				{
					staffId: 'staff-1',
					staffName: 'Karthik Raja',
					staffRole: 'Technician',
					staffPhoneNumber: '9876540001',
					isActive: true,
					periodFrom: '2026-09-01',
					periodTo: '2026-09-30',
					enteredSalary: 20000,
					outstandingAdvance: 5000,
					advanceDeduction: 5000,
					finalSalary: 15000,
					remainingAdvance: 0,
					status: 'Ready',
					settledAt: null,
					settledByName: null,
					notes: 'Festival advance recovery',
					settlementId: null,
				},
				{
					staffId: 'staff-2',
					staffName: 'Suresh Detailer',
					staffRole: 'Detailer',
					staffPhoneNumber: '9876540002',
					isActive: true,
					periodFrom: '2026-09-01',
					periodTo: '2026-09-30',
					enteredSalary: null,
					outstandingAdvance: 2000,
					advanceDeduction: null,
					finalSalary: null,
					remainingAdvance: null,
					status: 'NotEntered',
					settledAt: null,
					settledByName: null,
					notes: null,
					settlementId: null,
				},
				{
					staffId: 'staff-3',
					staffName: 'Former Staff',
					staffRole: 'Washer',
					staffPhoneNumber: '9876540003',
					isActive: false,
					periodFrom: '2026-09-01',
					periodTo: '2026-09-30',
					enteredSalary: 25000,
					outstandingAdvance: 5000,
					advanceDeduction: 5000,
					finalSalary: 20000,
					remainingAdvance: 0,
					status: 'Settled',
					settledAt: '2026-09-22T14:30:00Z',
					settledByName: 'Admin User',
					notes: 'Historical settlement snapshot',
					settlementId: 'settle-1',
				},
			],
		};

		beforeEach(() => {
			vi.mocked(api.getStaffList).mockResolvedValue(sampleStaffList);
			vi.mocked(api.getStaffSalaryRoster).mockResolvedValue(sampleRosterResponse);
		});

		it('1. Renders Salary roster table with 8 columns, centered actions, and footer summary without Advance Deduction column', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Staff Salary')).toBeInTheDocument();
				expect(within(screen.getByRole('table')).getByText('Karthik Raja')).toBeInTheDocument();
			});

			const table = screen.getByRole('table');

			// 1. Verify required 8 columns in table header
			expect(within(table).getByText('Staff Member')).toBeInTheDocument();
			expect(within(table).getByText('Role')).toBeInTheDocument();
			expect(within(table).getByText('Salary Period')).toBeInTheDocument();
			expect(within(table).getByText('Entered Salary')).toBeInTheDocument();
			expect(within(table).getByText('Outstanding Advance')).toBeInTheDocument();
			expect(within(table).getByText('Salary')).toBeInTheDocument();
			expect(within(table).getByText('Payroll Status')).toBeInTheDocument();
			expect(within(table).getByText('Actions')).toBeInTheDocument();

			// Verify Advance Deduction is NOT in the main table column headers
			expect(within(table).queryByText('Advance Deduction')).not.toBeInTheDocument();
			expect(within(table).queryByText('Final Salary')).not.toBeInTheDocument();

			// 2. Verify Actions column is centered
			const actionsHeader = within(table).getByText('Actions').closest('th');
			expect(actionsHeader).toHaveClass('text-center');

			// 3. Verify staff rows and their workflow states
			expect(within(table).getByText('Karthik Raja')).toBeInTheDocument();
			expect(within(table).getByText('Suresh Detailer')).toBeInTheDocument();
			expect(within(table).getByText('Former Staff')).toBeInTheDocument();

			const rows = within(table).getAllByRole('row');
			// row 0 is header, row 1 is Karthik Raja (Ready), row 2 is Suresh (NotEntered), row 3 is Former Staff (Settled)
			const readyRow = rows[1];
			const notEnteredRow = rows[2];
			const settledRow = rows[3];

			// Ready state shows: Edit + Settle Salary + View Details (all centered)
			expect(within(readyRow).getByRole('button', { name: /edit/i })).toBeInTheDocument();
			expect(within(readyRow).getByRole('button', { name: /settle salary/i })).toBeInTheDocument();
			expect(within(readyRow).getByRole('button', { name: /view details/i })).toBeInTheDocument();
			expect(within(readyRow).queryByRole('button', { name: /enter salary/i })).not.toBeInTheDocument();
			expect(within(readyRow).getByRole('button', { name: /settle salary/i }).closest('div')).toHaveClass('justify-center');

			// Not Entered state shows: Enter Salary + View Details
			expect(within(notEnteredRow).getByRole('button', { name: /enter salary/i })).toBeInTheDocument();
			expect(within(notEnteredRow).getByRole('button', { name: /view details/i })).toBeInTheDocument();
			expect(within(notEnteredRow).queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
			expect(within(notEnteredRow).queryByRole('button', { name: /settle salary/i })).not.toBeInTheDocument();
			expect(within(notEnteredRow).getByRole('button', { name: /enter salary/i }).closest('div')).toHaveClass('justify-center');

			// Settled state shows: View Details only
			expect(within(settledRow).getByRole('button', { name: /view details/i })).toBeInTheDocument();
			expect(within(settledRow).queryByRole('button', { name: /enter salary/i })).not.toBeInTheDocument();
			expect(within(settledRow).queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
			expect(within(settledRow).queryByRole('button', { name: /settle salary/i })).not.toBeInTheDocument();
			expect(within(settledRow).getByRole('button', { name: /view details/i }).closest('div')).toHaveClass('justify-center');

			// 4. Verify financial values in rows (uses FinalSalary from backend calculation)
			expect(within(table).getByText('₹15,000')).toBeInTheDocument();
			expect(within(table).getAllByText('₹5,000').length).toBeGreaterThanOrEqual(1);

			// 5. Verify footer displays Gross Salary, positive Advance Recovery, and Salary Payable
			expect(screen.getByText(/Gross Salary:/i)).toBeInTheDocument();
			expect(screen.getByText(/Advance Recovery:/i)).toBeInTheDocument();
			expect(screen.getByText(/Salary Payable:/i)).toBeInTheDocument();

			// 6. Verify View Details still contains complete financial breakdown including Advance Recovery
			fireEvent.click(within(readyRow).getByRole('button', { name: /view details/i }));

			await waitFor(() => {
				expect(screen.getByText('Salary Details')).toBeInTheDocument();
				expect(screen.getByText('Advance Recovery:')).toBeInTheDocument();
				expect(screen.getByText('Salary Payable:')).toBeInTheDocument();
				expect(screen.getByText('Remaining Advance Balance:')).toBeInTheDocument();
			});
		});

		it('2. Custom From/To filtering and Search/Status/Staff filters drive salary roster query', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(api.getStaffSalaryRoster).toHaveBeenCalled();
			});

			const fromInput = screen.getByTitle('From date');
			const toInput = screen.getByTitle('To date');
			const searchInput = screen.getByPlaceholderText('Search by staff name or role...');

			fireEvent.change(fromInput, { target: { value: '2026-09-01' } });
			fireEvent.change(toInput, { target: { value: '2026-09-25' } });
			fireEvent.change(searchInput, { target: { value: 'Karthik' } });

			await waitFor(() => {
				expect(api.getStaffSalaryRoster).toHaveBeenCalledWith(
					expect.objectContaining({
						fromDate: '2026-09-01',
						toDate: '2026-09-25',
						search: 'Karthik',
					})
				);
			});
		});

		it('3. Opens Enter Salary dialog, validates non-negative amount, and computes live preview', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /enter salary/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /enter salary/i }));

			await waitFor(() => {
				expect(screen.getByText('Enter Staff Salary')).toBeInTheDocument();
				expect(screen.getAllByText('Suresh Detailer').length).toBeGreaterThanOrEqual(1);
			});

			const salaryInput = screen.getByPlaceholderText('e.g. 20000');

			// Try invalid negative salary
			fireEvent.change(salaryInput, { target: { value: '-100' } });
			const saveBtn = screen.getByRole('button', { name: /save salary/i });
			fireEvent.click(saveBtn);

			expect(
				screen.getByText(/Please enter a valid salary amount \(₹0 or greater\)/i)
			).toBeInTheDocument();

			// Enter valid salary ₹20,000 (Advance is ₹2,000)
			fireEvent.change(salaryInput, { target: { value: '20000' } });

			// Check live preview values: MIN(2000, 20000) = 2000 deduction, 18000 final
			expect(screen.getByText('-₹2,000')).toBeInTheDocument();
			expect(screen.getByText('₹18,000')).toBeInTheDocument();
			expect(screen.getAllByText('₹0').length).toBeGreaterThan(0);
		});

		it('4. Saves entered salary as Ready without recovering advances or modifying advance balance', async () => {
			vi.mocked(api.saveEnteredSalary).mockResolvedValue({
				...sampleRosterResponse.items[1],
				enteredSalary: 25000,
				advanceDeduction: 2000,
				finalSalary: 23000,
				remainingAdvance: 0,
				status: 'Ready',
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /enter salary/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /enter salary/i }));

			const salaryInput = screen.getByPlaceholderText('e.g. 20000');
			fireEvent.change(salaryInput, { target: { value: '25000' } });

			const saveBtn = screen.getByRole('button', { name: /save salary/i });
			fireEvent.click(saveBtn);

			await waitFor(() => {
				expect(api.saveEnteredSalary).toHaveBeenCalledWith(
					expect.objectContaining({
						staffId: 'staff-2',
						enteredSalary: 25000,
					}),
					expect.anything()
				);
			});
		});

		it('5. Settle Salary confirmation dialog displays full financial breakdown and executes atomic settlement', async () => {
			vi.mocked(api.settleStaffSalary).mockResolvedValue({
				id: 'settle-1',
				staffId: 'staff-1',
				staffName: 'Karthik Raja',
				staffRole: 'Technician',
				periodFrom: '2026-09-01',
				periodTo: '2026-09-30',
				enteredSalary: 20000,
				outstandingAdvanceBeforeSettlement: 5000,
				advanceDeduction: 5000,
				remainingAdvanceAfterSettlement: 0,
				finalSalary: 15000,
				status: 'Settled',
				settledAt: '2026-09-22T15:00:00Z',
				settledByUserId: 'usr-1',
				settledByName: 'Admin User',
				notes: null,
				createdAt: '2026-09-22T15:00:00Z',
				updatedAt: null,
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /settle salary/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /settle salary/i }));

			await waitFor(() => {
				expect(screen.getByText('Confirm Staff Salary Settlement')).toBeInTheDocument();
				expect(screen.getByText('Entered Gross Salary:')).toBeInTheDocument();
				expect(screen.getByText('Final Salary Payout:')).toBeInTheDocument();
			});

			const confirmBtn = screen.getByRole('button', { name: /confirm & settle salary/i });
			fireEvent.click(confirmBtn);

			await waitFor(() => {
				expect(api.settleStaffSalary).toHaveBeenCalledWith(
					expect.objectContaining({
						staffId: 'staff-1',
						enteredSalary: 20000,
					}),
					expect.anything()
				);
			});
		});

		it('6. Displays historical settled snapshot values for completed settlements without recalculating from live advances', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(within(screen.getByRole('table')).getByText('Former Staff')).toBeInTheDocument();
			});

			// Former staff settled row shows historical entered salary and deduction
			const table = screen.getByRole('table');
			expect(within(table).getByText('₹25,000')).toBeInTheDocument();
			expect(within(table).getByText('Settled')).toBeInTheDocument();

			const viewDetailButtons = screen.getAllByRole('button', { name: /view details/i });
			// Click View Details on Former Staff (the third row action)
			fireEvent.click(viewDetailButtons[viewDetailButtons.length - 1]);

			await waitFor(() => {
				expect(screen.getByText('Salary Settlement Receipt')).toBeInTheDocument();
				expect(screen.getByText('Historical Settlement Snapshot')).toBeInTheDocument();
				expect(screen.getByText(/by Admin User/i)).toBeInTheDocument();
			});
		});

		it('7. Confirms attendance has ZERO effect on salary and advance recovery calculations', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(within(screen.getByRole('table')).getByText('Karthik Raja')).toBeInTheDocument();
			});

			// Final Salary = Entered Salary (20000) - Advance (5000) = 15000 regardless of attendance
			const table = screen.getByRole('table');
			expect(within(table).getByText('₹15,000')).toBeInTheDocument();

			// Attendance calculation formulas or attendance deduction labels must NOT be present
			expect(screen.queryByText(/attendance deduction/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/leave deduction/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/unmarked deduction/i)).not.toBeInTheDocument();
		});

		it('8. Validates date range inline when From Date > To Date', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(screen.getByText('Staff Salary')).toBeInTheDocument();
			});

			const fromInput = screen.getByTitle('From date');
			const toInput = screen.getByTitle('To date');

			fireEvent.change(fromInput, { target: { value: '2026-09-30' } });
			fireEvent.change(toInput, { target: { value: '2026-09-01' } });

			expect(
				screen.getByText('Invalid date range: From Date cannot be later than To Date.')
			).toBeInTheDocument();
		});

		it('9. Resets all filters when Reset button is clicked', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(within(screen.getByRole('table')).getByText('Karthik Raja')).toBeInTheDocument();
			});

			const searchInput = screen.getByPlaceholderText('Search by staff name or role...');
			fireEvent.change(searchInput, { target: { value: 'Karthik' } });

			const resetBtn = screen.getByRole('button', { name: /^reset$/i });
			expect(resetBtn).toBeInTheDocument();

			fireEvent.click(resetBtn);
			expect(searchInput).toHaveValue('');
		});

		it('10. Handles loading spinner and API error retry state', async () => {
			let resolvePromise: (value: api.StaffSalaryRosterResponse) => void = () => {};
			const pendingPromise = new Promise<api.StaffSalaryRosterResponse>((resolve) => {
				resolvePromise = resolve;
			});
			vi.mocked(api.getStaffSalaryRoster).mockReturnValueOnce(pendingPromise);

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			expect(screen.getByText('Loading salary roster...')).toBeInTheDocument();

			resolvePromise(sampleRosterResponse);
			await waitFor(() => {
				const table = screen.getByRole('table');
				expect(within(table).getByText('Karthik Raja')).toBeInTheDocument();
			});
		});

		it('11. Switching period loads period-specific saved salary (Sept ₹20,000 vs Aug ₹18,000) and does not overwrite entered salary', async () => {
			const septemberResponse: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				periodFrom: '2026-09-01',
				periodTo: '2026-09-30',
				items: [
					{
						...sampleRosterResponse.items[0],
						periodFrom: '2026-09-01',
						periodTo: '2026-09-30',
						enteredSalary: 20000,
						outstandingAdvance: 12344,
						advanceDeduction: 12344,
						finalSalary: 7656,
						status: 'Ready',
					},
				],
			};

			const augustResponse: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				periodFrom: '2026-08-01',
				periodTo: '2026-08-31',
				items: [
					{
						...sampleRosterResponse.items[0],
						periodFrom: '2026-08-01',
						periodTo: '2026-08-31',
						enteredSalary: 18000,
						outstandingAdvance: 5000,
						advanceDeduction: 5000,
						finalSalary: 13000,
						status: 'Ready',
					},
				],
			};

			vi.mocked(api.getStaffSalaryRoster).mockImplementation(async (params) => {
				if (params.fromDate === '2026-08-01') {
					return augustResponse;
				}
				return septemberResponse;
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(within(screen.getByRole('table')).getByText('Karthik Raja')).toBeInTheDocument();
				// September has ₹20,000 saved
				expect(within(screen.getByRole('table')).getByText('₹20,000')).toBeInTheDocument();
			});

			const fromInput = screen.getByTitle('From date');
			const toInput = screen.getByTitle('To date');

			// Switch period to August (01-08-2026 to 31-08-2026)
			fireEvent.change(fromInput, { target: { value: '2026-08-01' } });
			fireEvent.change(toInput, { target: { value: '2026-08-31' } });

			await waitFor(() => {
				// August loaded its own saved salary ₹18,000
				expect(within(screen.getByRole('table')).getByText('₹18,000')).toBeInTheDocument();
			});

			// Switch back to September (01-09-2026 to 30-09-2026)
			fireEvent.change(fromInput, { target: { value: '2026-09-01' } });
			fireEvent.change(toInput, { target: { value: '2026-09-30' } });

			await waitFor(() => {
				// September salary ₹20,000 was preserved and restored
				expect(within(screen.getByRole('table')).getByText('₹20,000')).toBeInTheDocument();
			});
		});

		it('12. Switching to new period without saved salary displays Not Entered and does not copy from another period', async () => {
			const julyResponse: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				periodFrom: '2026-07-01',
				periodTo: '2026-07-31',
				items: [
					{
						...sampleRosterResponse.items[0],
						periodFrom: '2026-07-01',
						periodTo: '2026-07-31',
						enteredSalary: null,
						outstandingAdvance: 3000,
						advanceDeduction: null,
						finalSalary: null,
						remainingAdvance: null,
						status: 'NotEntered',
					},
				],
			};

			vi.mocked(api.getStaffSalaryRoster).mockImplementation(async (params) => {
				if (params.fromDate === '2026-07-01') return julyResponse;
				return sampleRosterResponse;
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			const fromInput = screen.getByTitle('From date');
			const toInput = screen.getByTitle('To date');

			fireEvent.change(fromInput, { target: { value: '2026-07-01' } });
			fireEvent.change(toInput, { target: { value: '2026-07-31' } });

			await waitFor(() => {
				const table = screen.getByRole('table');
				expect(within(table).getByText('Not set')).toBeInTheDocument();
				expect(within(table).getByText('Not Entered')).toBeInTheDocument();
				expect(within(table).queryByText('₹20,000')).not.toBeInTheDocument();
			});
		});

		it('13. Advance changes with period: applicable advance updates with selected period', async () => {
			const augustRoster: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				periodFrom: '2026-08-01',
				periodTo: '2026-08-31',
				items: [
					{
						...sampleRosterResponse.items[0],
						enteredSalary: 20000,
						outstandingAdvance: 5000,
						advanceDeduction: 5000,
						finalSalary: 15000,
						status: 'Ready',
					},
				],
			};

			const septemberRoster: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				periodFrom: '2026-09-01',
				periodTo: '2026-09-30',
				items: [
					{
						...sampleRosterResponse.items[0],
						enteredSalary: 20000,
						outstandingAdvance: 12344,
						advanceDeduction: 12344,
						finalSalary: 7656,
						status: 'Ready',
					},
				],
			};

			vi.mocked(api.getStaffSalaryRoster).mockImplementation(async (params) => {
				if (params.fromDate === '2026-08-01') return augustRoster;
				return septemberRoster;
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			const fromInput = screen.getByTitle('From date');
			const toInput = screen.getByTitle('To date');

			// August: applicable advance is ₹5,000, salary payable is ₹15,000
			fireEvent.change(fromInput, { target: { value: '2026-08-01' } });
			fireEvent.change(toInput, { target: { value: '2026-08-31' } });

			await waitFor(() => {
				const table = screen.getByRole('table');
				expect(within(table).getByText('₹5,000')).toBeInTheDocument();
				expect(within(table).getByText('₹15,000')).toBeInTheDocument();
			});

			// September: applicable advance is ₹12,344, salary payable is ₹7,656
			fireEvent.change(fromInput, { target: { value: '2026-09-01' } });
			fireEvent.change(toInput, { target: { value: '2026-09-30' } });

			await waitFor(() => {
				const table = screen.getByRole('table');
				expect(within(table).getByText('₹12,344')).toBeInTheDocument();
				expect(within(table).getByText('₹7,656')).toBeInTheDocument();
			});
		});

		it('14. Salary calculation in Live Preview: Salary = ₹20,000, Advance = ₹12,344 -> Deduction = ₹12,344, Salary Payable = ₹7,656', async () => {
			const customRoster: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				items: [
					{
						...sampleRosterResponse.items[1],
						staffName: 'Suresh Detailer',
						outstandingAdvance: 12344,
						enteredSalary: null,
						status: 'NotEntered',
					},
				],
			};

			vi.mocked(api.getStaffSalaryRoster).mockResolvedValue(customRoster);

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /enter salary/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /enter salary/i }));

			const salaryInput = screen.getByPlaceholderText('e.g. 20000');
			fireEvent.change(salaryInput, { target: { value: '20000' } });

			// Live Preview verification:
			// Deduction = MIN(12344, 20000) = 12344
			// Net Final Salary = 20000 - 12344 = 7656
			expect(screen.getByText('-₹12,344')).toBeInTheDocument();
			expect(screen.getByText('₹7,656')).toBeInTheDocument();
			expect(screen.getAllByText('₹0').length).toBeGreaterThan(0);
		});

		it('15. Salary lower than advance in Live Preview: Salary = ₹10,000, Advance = ₹15,308 -> Deduction = ₹10,000, Payable = ₹0, Remaining = ₹5,308', async () => {
			const customRoster: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				items: [
					{
						...sampleRosterResponse.items[1],
						staffName: 'Suresh Detailer',
						outstandingAdvance: 15308,
						enteredSalary: null,
						status: 'NotEntered',
					},
				],
			};

			vi.mocked(api.getStaffSalaryRoster).mockResolvedValue(customRoster);

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /enter salary/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /enter salary/i }));

			const salaryInput = screen.getByPlaceholderText('e.g. 20000');
			fireEvent.change(salaryInput, { target: { value: '10000' } });

			// Live Preview verification:
			// Deduction = MIN(15308, 10000) = 10000
			// Net Final Salary = 10000 - 10000 = 0
			// Remaining Advance = 15308 - 10000 = 5308
			expect(screen.getByText('-₹10,000')).toBeInTheDocument();
			expect(screen.getByText('₹5,308')).toBeInTheDocument();
			expect(screen.getAllByText('₹0').length).toBeGreaterThan(0);
		});

		it('16. [TEST 1 & 2] Changing period from 30 Sep to 22 Sep maintains entered salary ₹20,000 and recalculates advance and net payout', async () => {
			const sept30Response: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				periodFrom: '2026-09-01',
				periodTo: '2026-09-30',
				items: [
					{
						...sampleRosterResponse.items[0],
						staffId: 'staff-karthik',
						staffName: 'Karthik Raja',
						enteredSalary: 20000,
						outstandingAdvance: 12344,
						advanceDeduction: 12344,
						finalSalary: 7656,
						status: 'Ready',
					},
				],
			};

			const sept22Response: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				periodFrom: '2026-09-01',
				periodTo: '2026-09-22',
				items: [
					{
						...sampleRosterResponse.items[0],
						staffId: 'staff-karthik',
						staffName: 'Karthik Raja',
						enteredSalary: null,
						outstandingAdvance: 7000,
						advanceDeduction: null,
						finalSalary: null,
						status: 'NotEntered',
					},
				],
			};

			vi.mocked(api.getStaffSalaryRoster).mockImplementation(async (params) => {
				if (params.toDate === '2026-09-22') return sept22Response;
				return sept30Response;
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				const table = screen.getByRole('table');
				expect(within(table).getByText('Karthik Raja')).toBeInTheDocument();
				expect(within(table).getByText('₹20,000')).toBeInTheDocument();
				expect(within(table).getByText('₹12,344')).toBeInTheDocument();
				expect(within(table).getByText('₹7,656')).toBeInTheDocument();
			});

			// Now user opens edit salary and enters/confirms ₹20,000
			fireEvent.click(screen.getByRole('button', { name: /edit/i }));
			const salaryInput = screen.getByPlaceholderText('e.g. 20000');
			fireEvent.change(salaryInput, { target: { value: '20000' } });
			fireEvent.click(screen.getByRole('button', { name: /save salary/i }));

			// Now user changes date filter: To Date = 2026-09-22
			const toInput = screen.getByTitle('To date');
			fireEvent.change(toInput, { target: { value: '2026-09-22' } });

			await waitFor(() => {
				const table = screen.getByRole('table');
				// Entered Salary MUST remain ₹20,000 (NOT replaced with null or another amount)
				expect(within(table).getByText('₹20,000')).toBeInTheDocument();
				// Applicable advance changed to ₹7,000
				expect(within(table).getByText('₹7,000')).toBeInTheDocument();
				// Salary payable recalculated: 20000 - 7000 = ₹13,000
				expect(within(table).getByText('₹13,000')).toBeInTheDocument();
			});
		});

		it('17. [TEST 3] In Enter Salary modal: Changing modal dates preserves typed salary ₹20,000 and updates live calculation', async () => {
			vi.mocked(api.getStaffSalaryRoster).mockResolvedValue(sampleRosterResponse);
			vi.mocked(api.getStaffSalaryPreview).mockResolvedValue({
				staffId: 'staff-2',
				staffName: 'Suresh Kumar',
				staffRole: 'Detailer',
				periodFrom: '2026-09-01',
				periodTo: '2026-09-22',
				enteredSalary: 20000,
				outstandingAdvance: 7000,
				advanceDeduction: 7000,
				finalSalary: 13000,
				remainingAdvance: 0,
				status: 'Ready',
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /enter salary/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /enter salary/i }));

			// Enter ₹20,000 in modal
			const salaryInput = screen.getByPlaceholderText('e.g. 20000') as HTMLInputElement;
			fireEvent.change(salaryInput, { target: { value: '20000' } });
			expect(salaryInput.value).toBe('20000');

			// Change To Date inside the modal to 2026-09-22
			const modalToInput = screen.getByLabelText('Modal To Date');
			fireEvent.change(modalToInput, { target: { value: '2026-09-22' } });

			// Salary input MUST still display 20000
			expect(salaryInput.value).toBe('20000');

			// Live preview updates based on preview query
			await waitFor(() => {
				expect(screen.getByText('-₹7,000')).toBeInTheDocument();
				expect(screen.getByText('₹13,000')).toBeInTheDocument();
			});
		});

		it('18. [TEST 4] Settlement uses exact displayed salary ₹20,000, advance ₹7,000, recovery ₹7,000, and final salary ₹13,000', async () => {
			const rosterItem: api.StaffSalaryRosterResponse = {
				...sampleRosterResponse,
				items: [
					{
						...sampleRosterResponse.items[0],
						staffId: 'staff-1',
						staffName: 'Karthik Raja',
						enteredSalary: 20000,
						outstandingAdvance: 7000,
						advanceDeduction: 7000,
						finalSalary: 13000,
						status: 'Ready',
					},
				],
			};

			vi.mocked(api.getStaffSalaryRoster).mockResolvedValue(rosterItem);
			vi.mocked(api.settleStaffSalary).mockResolvedValue({
				id: 'settle-exact',
				staffId: 'staff-1',
				staffName: 'Karthik Raja',
				staffRole: 'Technician',
				periodFrom: '2026-09-01',
				periodTo: '2026-09-22',
				enteredSalary: 20000,
				outstandingAdvanceBeforeSettlement: 7000,
				advanceDeduction: 7000,
				remainingAdvanceAfterSettlement: 0,
				finalSalary: 13000,
				status: 'Settled',
				settledAt: '2026-09-22T16:00:00Z',
				settledByName: 'Owner',
				notes: 'Full settlement',
				createdAt: '2026-09-22T16:00:00Z',
			});

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{
					initialEntries: ['/staff-salary'],
				}
			);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /settle salary/i })).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /settle salary/i }));

			// Confirmation dialog shows exact breakdown
			await waitFor(() => {
				const dialog = screen.getByRole('dialog');
				expect(within(dialog).getByText(/Confirm.*Salary Settlement/i)).toBeInTheDocument();
				expect(within(dialog).getByText('₹20,000')).toBeInTheDocument();
				expect(within(dialog).getByText('-₹7,000')).toBeInTheDocument();
				expect(within(dialog).getByText('₹13,000')).toBeInTheDocument();
			});

			const confirmBtn = screen.getByRole('button', { name: /confirm & settle salary/i });
			fireEvent.click(confirmBtn);

			await waitFor(() => {
				expect(api.settleStaffSalary).toHaveBeenCalledWith(
					expect.objectContaining({
						staffId: 'staff-1',
						enteredSalary: 20000,
					}),
					expect.anything()
				);
			});
		});
	});
});

