import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { AttendancePage } from './AttendancePage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getStaffList: vi.fn(),
		getDailyAttendance: vi.fn(),
		getDateRangeAttendance: vi.fn(),
		getMonthlyAttendanceReport: vi.fn(),
	};
});

describe('Staff Monthly Attendance Report', () => {
	const mockDailyResponse: api.DailyAttendanceResponse = {
		date: '2026-09-22',
		isAttendanceConfirmed: false,
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
				attendanceDate: '2026-09-22',
			},
		],
	};

	const mockStaffList: api.StaffDto[] = [
		{
			id: 'staff-1',
			name: 'Karthik Raja',
			phoneNumber: '9876540001',
			email: null,
			address: null,
			role: 'Technician',
			isActive: true,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
			aadhaarMasked: 'XXXX XXXX 1234',
			hasAadhaarDocument: false,
		},
		{
			id: 'staff-2',
			name: 'Ramesh Sundaram',
			phoneNumber: '9876540002',
			email: null,
			address: null,
			role: 'Senior Detailer',
			isActive: true,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
			aadhaarMasked: 'XXXX XXXX 5678',
			hasAadhaarDocument: false,
		},
	];

	const mockMonthlyResponseSept: api.MonthlyAttendanceReportResponse = {
		year: 2026,
		month: 9,
		fromDate: '2026-09-01',
		toDate: '2026-09-30',
		totalCalendarDays: 30,
		staffCount: 2,
		summary: {
			present: 43,
			halfDay: 3,
			leave: 4,
			unmarked: 10,
		},
		staff: [
			{
				staffId: 'staff-1',
				name: 'Karthik Raja',
				role: 'Technician',
				phoneNumber: '9876540001',
				presentDays: 23,
				halfDays: 2,
				leaveDays: 2,
				unmarkedDays: 3,
				attendanceDays: 25,
				dailyRecords: [
					{
						date: '2026-09-01',
						day: 1,
						dayOfWeek: 'Tue',
						status: 'Present',
						checkInTime: '09:00',
						checkOutTime: '18:00',
						workingHours: 9,
						workingHoursFormatted: '9h',
						notes: 'On time',
					},
					{
						date: '2026-09-02',
						day: 2,
						dayOfWeek: 'Wed',
						status: 'HalfDay',
						checkInTime: '09:00',
						checkOutTime: '13:30',
						workingHours: 4.5,
						workingHoursFormatted: '4h 30m',
						notes: 'Half day shift',
					},
					{
						date: '2026-09-03',
						day: 3,
						dayOfWeek: 'Thu',
						status: 'Leave',
						checkInTime: null,
						checkOutTime: null,
						workingHours: null,
						workingHoursFormatted: null,
						notes: 'Medical leave',
					},
					{
						date: '2026-09-04',
						day: 4,
						dayOfWeek: 'Fri',
						status: 'Unmarked',
						checkInTime: null,
						checkOutTime: null,
						workingHours: null,
						workingHoursFormatted: null,
						notes: null,
					},
				],
			},
			{
				staffId: 'staff-2',
				name: 'Ramesh Sundaram',
				role: 'Senior Detailer',
				phoneNumber: '9876540002',
				presentDays: 20,
				halfDays: 1,
				leaveDays: 2,
				unmarkedDays: 7,
				attendanceDays: 21,
				dailyRecords: [],
			},
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getDailyAttendance).mockResolvedValue(mockDailyResponse);
		vi.mocked(api.getStaffList).mockResolvedValue(mockStaffList);
		vi.mocked(api.getMonthlyAttendanceReport).mockResolvedValue(mockMonthlyResponseSept);
	});

	it('1. Renders tab switcher with "Daily Attendance" and "Monthly Report"', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff-attendance" element={<AttendancePage />} />
			</Routes>,
			{ initialEntries: ['/staff-attendance'] }
		);

		expect(screen.getByRole('tab', { name: /daily attendance/i })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: /monthly report/i })).toBeInTheDocument();
	});

	it('2. Switching to "Monthly Report" tab loads monthly data and displays KPI cards', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff-attendance" element={<AttendancePage />} />
			</Routes>,
			{ initialEntries: ['/staff-attendance'] }
		);

		// Click on Monthly Report tab
		const monthlyTab = screen.getByRole('tab', { name: /monthly report/i });
		fireEvent.click(monthlyTab);

		await waitFor(() => {
			expect(api.getMonthlyAttendanceReport).toHaveBeenCalled();
			expect(screen.getByText('43')).toBeInTheDocument(); // Present records
		});

		// Verify 4 KPI Summary Cards
		expect(screen.getByText('Staff Members')).toBeInTheDocument();
		expect(screen.getByText('Present Records')).toBeInTheDocument();
		expect(screen.getByText('Half Day Records')).toBeInTheDocument();
		expect(screen.getByText('Leave Records')).toBeInTheDocument();

		const halfDayCard = screen.getByText('Half Day Records').closest('.app-card') as HTMLElement;
		expect(within(halfDayCard).getByText('3')).toBeInTheDocument();

		const leaveCard = screen.getByText('Leave Records').closest('.app-card') as HTMLElement;
		expect(within(leaveCard).getByText('4')).toBeInTheDocument();
	});

	it('3. Renders monthly staff attendance table with correct columns and counts', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff-attendance" element={<AttendancePage />} />
			</Routes>,
			{ initialEntries: ['/staff-attendance'] }
		);

		fireEvent.click(screen.getByRole('tab', { name: /monthly report/i }));

		await waitFor(() => {
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
			expect(screen.getByText('Ramesh Sundaram')).toBeInTheDocument();
		});

		// Check table headers
		expect(screen.getByRole('columnheader', { name: /staff member/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /role/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^present$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^half day$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^leave$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /^unmarked$/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /attendance days/i })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();

		// Check Karthik Raja's row data
		expect(screen.getByText('23')).toBeInTheDocument(); // Present days
		expect(screen.getByText('25')).toBeInTheDocument(); // Attendance days (23 + 2)
	});

	it('4. Month navigation buttons change month and query corresponding report', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff-attendance" element={<AttendancePage />} />
			</Routes>,
			{ initialEntries: ['/staff-attendance'] }
		);

		fireEvent.click(screen.getByRole('tab', { name: /monthly report/i }));

		await waitFor(() => {
			expect(api.getMonthlyAttendanceReport).toHaveBeenCalled();
		});

		const nextBtn = screen.getByRole('button', { name: /next month/i });
		fireEvent.click(nextBtn);

		await waitFor(() => {
			expect(api.getMonthlyAttendanceReport).toHaveBeenCalledWith(
				expect.objectContaining({
					month: 10,
				})
			);
		});

		const prevBtn = screen.getByRole('button', { name: /previous month/i });
		fireEvent.click(prevBtn);

		await waitFor(() => {
			expect(api.getMonthlyAttendanceReport).toHaveBeenCalledWith(
				expect.objectContaining({
					month: 9,
				})
			);
		});
	});

	it('5. Filters by search query, staff dropdown, and status dropdown', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff-attendance" element={<AttendancePage />} />
			</Routes>,
			{ initialEntries: ['/staff-attendance'] }
		);

		fireEvent.click(screen.getByRole('tab', { name: /monthly report/i }));

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/search staff by name or role/i)).toBeInTheDocument();
		});

		// Search input
		const searchInput = screen.getByPlaceholderText(/search staff by name or role/i);
		fireEvent.change(searchInput, { target: { value: 'Karthik' } });

		await waitFor(() => {
			expect(api.getMonthlyAttendanceReport).toHaveBeenCalledWith(
				expect.objectContaining({
					search: 'Karthik',
				})
			);
		});

		// Staff select
		const staffSelect = screen.getByLabelText(/filter by staff member/i);
		fireEvent.change(staffSelect, { target: { value: 'staff-1' } });

		await waitFor(() => {
			expect(api.getMonthlyAttendanceReport).toHaveBeenCalledWith(
				expect.objectContaining({
					staffId: 'staff-1',
				})
			);
		});

		// Status select
		const statusSelect = screen.getByLabelText(/filter by status/i);
		fireEvent.change(statusSelect, { target: { value: 'Unmarked' } });

		await waitFor(() => {
			expect(api.getMonthlyAttendanceReport).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 'Unmarked',
				})
			);
		});
	});

	it('6. Clicking "View Details" opens modal with summary metrics and daily breakdown', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff-attendance" element={<AttendancePage />} />
			</Routes>,
			{ initialEntries: ['/staff-attendance'] }
		);

		fireEvent.click(screen.getByRole('tab', { name: /monthly report/i }));

		await waitFor(() => {
			expect(screen.getAllByRole('button', { name: /view details/i }).length).toBeGreaterThan(0);
		});

		// Click View Details on first staff
		fireEvent.click(screen.getAllByRole('button', { name: /view details/i })[0]);

		// Verify dialog opened
		await waitFor(() => {
			expect(screen.getByText('Staff Monthly Attendance Details')).toBeInTheDocument();
		});

		const dialog = screen.getByRole('dialog');
		expect(within(dialog).getByText(/Karthik Raja/i)).toBeInTheDocument();
		expect(within(dialog).getByText(/23 days/i)).toBeInTheDocument(); // Present days
		expect(within(dialog).getByText(/25 days/i)).toBeInTheDocument(); // Attendance days

		// Check daily breakdown cards
		expect(within(dialog).getByText('Day 1')).toBeInTheDocument();
		expect(within(dialog).getByText('Day 2')).toBeInTheDocument();
		expect(within(dialog).getByText('Day 3')).toBeInTheDocument();
		expect(within(dialog).getByText('Day 4')).toBeInTheDocument();

		// Check letter badges (P, H, L, U)
		expect(within(dialog).getAllByText('P').length).toBeGreaterThan(0);
		expect(within(dialog).getAllByText('H').length).toBeGreaterThan(0);
		expect(within(dialog).getAllByText('L').length).toBeGreaterThan(0);
		expect(within(dialog).getAllByText('U').length).toBeGreaterThan(0);

		// Close dialog
		fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
		await waitFor(() => {
			expect(screen.queryByText('Staff Monthly Attendance Details')).not.toBeInTheDocument();
		});
	});

	it('7. Guarantees no salary, wage, or advance calculations are performed', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/staff-attendance" element={<AttendancePage />} />
			</Routes>,
			{ initialEntries: ['/staff-attendance'] }
		);

		fireEvent.click(screen.getByRole('tab', { name: /monthly report/i }));

		await waitFor(() => {
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
		});

		// No salary columns or text
		expect(screen.queryByText(/paid days/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/gross salary/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/deduction/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/payable/i)).not.toBeInTheDocument();
	});
});
