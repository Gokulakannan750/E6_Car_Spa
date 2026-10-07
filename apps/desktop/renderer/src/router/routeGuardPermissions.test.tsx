import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/test-utils';
import { RouteGuard } from '../components/auth/RouteGuard';
import { SalaryPage } from '../features/staff/SalaryPage';
import { ShowroomOperationsPage } from '../features/showroom/ShowroomOperationsPage';
import * as api from '../lib/api';

vi.mock('../features/settings/hooks/useBusinessProfile', () => ({
	useBusinessProfile: () => ({
		profile: { businessName: 'E6 Car Spa' },
		logoUrl: '',
		hasCustomLogo: false,
	}),
}));

vi.mock('../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../lib/api')>();
	return {
		...actual,
		getStaffList: vi.fn(),
		getStaffSalaryRoster: vi.fn(),
		getShowrooms: vi.fn(),
		getDailyStaff: vi.fn(),
		getShowroomVehicleTypes: vi.fn(),
		getShowroomWorkTypes: vi.fn(),
		getShowroomVehicleWorks: vi.fn(),
		getShowroomWorkSessions: vi.fn(),
		getShowroomOperationsSummary: vi.fn(),
	};
});

const sampleStaffList: api.StaffDto[] = [
	{
		id: 'staff-1',
		staffMasterId: 'ST-001',
		name: 'John Technician',
		phoneNumber: '9876543210',
		email: null,
		address: null,
		role: 'Detailer',
		isActive: true,
		totalAdvances: 0,
		totalAdvanceAmount: 0,
		defaultShowroomId: null,
	},
];

const sampleSalaryRoster: api.StaffSalaryRosterResponse = {
	periodFrom: '2026-03-01',
	periodTo: '2026-03-31',
	totalStaffCount: 1,
	notEnteredCount: 1,
	readyCount: 0,
	settledCount: 0,
	totalEnteredSalary: 0,
	totalAdvanceDeductions: 0,
	totalFinalSalary: 0,
	items: [
		{
			staffId: 'staff-1',
			staffName: 'John Technician',
			staffRole: 'Detailer',
			staffPhoneNumber: '9876543210',
			periodFrom: '2026-03-01',
			periodTo: '2026-03-31',
			enteredSalary: null,
			advanceDeduction: 0,
			finalSalary: null,
			status: 'NotEntered',
			outstandingAdvance: 0,
			isActive: true,
			notes: null,
		},
	],
};

const sampleShowrooms: api.ShowroomDto[] = [
	{
		id: 'sh-1',
		masterId: 'SH-001',
		name: 'Popular Hyundai',
		address: 'Chennai',
		phone: '9876543210',
		isActive: true,
		activeStaffCountToday: 0,
		totalVehiclesToday: 0,
		createdAt: '2026-01-01T00:00:00Z',
	},
];

describe('RBAC Phase 2D: Permission Consistency & Route Guard Verification', () => {
	beforeEach(() => {
		vi.mocked(api.getStaffList).mockResolvedValue(sampleStaffList);
		vi.mocked(api.getStaffSalaryRoster).mockResolvedValue(sampleSalaryRoster);
		vi.mocked(api.getShowrooms).mockResolvedValue(sampleShowrooms);
		vi.mocked(api.getDailyStaff).mockResolvedValue({
			showroomId: 'sh-1',
			showroomName: 'Popular Hyundai',
			date: '2026-03-01',
			totalVehiclesAttended: 0,
			assignedCount: 0,
			unassignedCount: 0,
			staff: [],
		} as unknown as api.DailyStaffResponse);
		vi.mocked(api.getShowroomVehicleTypes).mockResolvedValue([]);
		vi.mocked(api.getShowroomWorkTypes).mockResolvedValue([]);
		vi.mocked(api.getShowroomVehicleWorks).mockResolvedValue([]);
		vi.mocked(api.getShowroomWorkSessions).mockResolvedValue([]);
		vi.mocked(api.getShowroomOperationsSummary).mockResolvedValue({
			showroomId: 'sh-1',
			date: '2026-03-01',
			totalVehiclesLoggedToday: 0,
			totalActiveStaffToday: 0,
			completedSessionsToday: 0,
			inProgressSessionsToday: 0,
			workBreakdown: [],
		} as unknown as api.ShowroomOperationsSummaryDto);
	});

	// ── 1. Staff Route Guard (/staff) ─────────────────────────────────────────
	describe('1. Staff Route Guard (/staff)', () => {
		it('allows access when user has canonical permission staff.view', () => {
			const user = {
				id: 'u-staff-viewer',
				fullName: 'Staff Viewer',
				username: 'staff_viewer',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['staff.view'],
			};

			renderWithProviders(
				<Routes>
					<Route
						path="/staff"
						element={
							<RouteGuard requiredPermission="staff.view">
								<div>Staff Directory Accessible</div>
							</RouteGuard>
						}
					/>
				</Routes>,
				{ initialEntries: ['/staff'], authUser: user }
			);

			expect(screen.getByText('Staff Directory Accessible')).toBeInTheDocument();
			expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
		});

		it('denies access when user lacks staff.view (even if having staff_advances.view)', () => {
			const user = {
				id: 'u-advances-only',
				fullName: 'Advances Only',
				username: 'adv_only',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['staff_advances.view'],
			};

			renderWithProviders(
				<Routes>
					<Route
						path="/staff"
						element={
							<RouteGuard requiredPermission="staff.view">
								<div>Staff Directory Accessible</div>
							</RouteGuard>
						}
					/>
				</Routes>,
				{ initialEntries: ['/staff'], authUser: user }
			);

			expect(screen.getByText('Access Denied')).toBeInTheDocument();
			expect(screen.getByText(/Required: staff\.view/)).toBeInTheDocument();
			expect(screen.queryByText('Staff Directory Accessible')).not.toBeInTheDocument();
		});
	});

	// ── 2. Staff Attendance Route Guard (/staff-attendance) ────────────────────
	describe('2. Staff Attendance Route Guard (/staff-attendance)', () => {
		it('allows access when user has canonical permission staff_attendance.view', () => {
			const user = {
				id: 'u-att-viewer',
				fullName: 'Attendance Viewer',
				username: 'att_viewer',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['staff_attendance.view'],
			};

			renderWithProviders(
				<Routes>
					<Route
						path="/staff-attendance"
						element={
							<RouteGuard requiredPermission="staff_attendance.view">
								<div>Attendance Page Accessible</div>
							</RouteGuard>
						}
					/>
				</Routes>,
				{ initialEntries: ['/staff-attendance'], authUser: user }
			);

			expect(screen.getByText('Attendance Page Accessible')).toBeInTheDocument();
			expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
		});

		it('denies access when user lacks staff_attendance.view (even if having staff_advances.view)', () => {
			const user = {
				id: 'u-advances-only',
				fullName: 'Advances Only',
				username: 'adv_only',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['staff_advances.view'],
			};

			renderWithProviders(
				<Routes>
					<Route
						path="/staff-attendance"
						element={
							<RouteGuard requiredPermission="staff_attendance.view">
								<div>Attendance Page Accessible</div>
							</RouteGuard>
						}
					/>
				</Routes>,
				{ initialEntries: ['/staff-attendance'], authUser: user }
			);

			expect(screen.getByText('Access Denied')).toBeInTheDocument();
			expect(screen.getByText(/Required: staff_attendance\.view/)).toBeInTheDocument();
			expect(screen.queryByText('Attendance Page Accessible')).not.toBeInTheDocument();
		});
	});

	// ── 3. Staff Salary Route Guard (/staff-salary) ───────────────────────────
	describe('3. Staff Salary Route Guard (/staff-salary)', () => {
		it('allows access when user has canonical permission staff_salary.view', () => {
			const user = {
				id: 'u-salary-viewer',
				fullName: 'Salary Viewer',
				username: 'sal_viewer',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['staff_salary.view'],
			};

			renderWithProviders(
				<Routes>
					<Route
						path="/staff-salary"
						element={
							<RouteGuard requiredPermission="staff_salary.view">
								<div>Salary Page Accessible</div>
							</RouteGuard>
						}
					/>
				</Routes>,
				{ initialEntries: ['/staff-salary'], authUser: user }
			);

			expect(screen.getByText('Salary Page Accessible')).toBeInTheDocument();
			expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
		});

		it('denies access when user lacks staff_salary.view (even if having staff_advances.view)', () => {
			const user = {
				id: 'u-advances-only',
				fullName: 'Advances Only',
				username: 'adv_only',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['staff_advances.view'],
			};

			renderWithProviders(
				<Routes>
					<Route
						path="/staff-salary"
						element={
							<RouteGuard requiredPermission="staff_salary.view">
								<div>Salary Page Accessible</div>
							</RouteGuard>
						}
					/>
				</Routes>,
				{ initialEntries: ['/staff-salary'], authUser: user }
			);

			expect(screen.getByText('Access Denied')).toBeInTheDocument();
			expect(screen.getByText(/Required: staff_salary\.view/)).toBeInTheDocument();
			expect(screen.queryByText('Salary Page Accessible')).not.toBeInTheDocument();
		});
	});

	// ── 4. Salary Page: Management Permission & Legacy Alias Removal ─────────
	describe('4. Salary Page Management Permission (staff_salary.manage)', () => {
		it('shows "Enter Salary" button when user has canonical staff_salary.manage', async () => {
			const user = {
				id: 'u-sal-mgr',
				fullName: 'Salary Manager',
				username: 'sal_mgr',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['staff_salary.view', 'staff_salary.manage'],
			};

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{ initialEntries: ['/staff-salary'], authUser: user }
			);

			await waitFor(() => {
				expect(screen.getByText('Staff Salary')).toBeInTheDocument();
			});

			const table = screen.getByRole('table');
			await waitFor(() => {
				expect(within(table).getByRole('button', { name: /enter salary/i })).toBeInTheDocument();
			});
		});

		it('does NOT show "Enter Salary" when user only has legacy staff.edit alias', async () => {
			const user = {
				id: 'u-staff-editor',
				fullName: 'Staff Editor',
				username: 'staff_editor',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['staff_salary.view', 'staff.edit'], // lacks staff_salary.manage
			};

			renderWithProviders(
				<Routes>
					<Route path="/staff-salary" element={<SalaryPage />} />
				</Routes>,
				{ initialEntries: ['/staff-salary'], authUser: user }
			);

			await waitFor(() => {
				expect(screen.getByText('Staff Salary')).toBeInTheDocument();
			});

			const table = screen.getByRole('table');
			await waitFor(() => {
				expect(within(table).getByText('John Technician')).toBeInTheDocument();
			}, { timeout: 3000 });

			// Enter Salary button must NOT be present
			expect(within(table).queryByRole('button', { name: /enter salary/i })).not.toBeInTheDocument();
		});
	});

	// ── 5. Showroom Operations: Canonical Permission showroom.manage ─────────
	describe('5. Showroom Operations Permission (showroom.manage vs showrooms.manage)', () => {
		it('enables management controls when user has canonical showroom.manage', async () => {
			const user = {
				id: 'u-sh-mgr',
				fullName: 'Showroom Manager',
				username: 'sh_mgr',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['showroom.view', 'showroom.manage'],
			};

			renderWithProviders(
				<Routes>
					<Route path="/showroom/operations" element={<ShowroomOperationsPage />} />
				</Routes>,
				{ initialEntries: ['/showroom/operations?showroomId=sh-1'], authUser: user }
			);

			await waitFor(() => {
				expect(screen.getByText('Popular Hyundai')).toBeInTheDocument();
			});

			// "Log Vehicle Work" button is present for managers
			expect(screen.getAllByRole('button', { name: /log vehicle work/i }).length).toBeGreaterThan(0);
		});

		it('does NOT enable management controls when user only has typo showrooms.manage', async () => {
			const user = {
				id: 'u-sh-typo',
				fullName: 'Showroom Typo',
				username: 'sh_typo',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['showroom.view', 'showrooms.manage'], // legacy typo without showroom.manage
			};

			renderWithProviders(
				<Routes>
					<Route path="/showroom/operations" element={<ShowroomOperationsPage />} />
				</Routes>,
				{ initialEntries: ['/showroom/operations?showroomId=sh-1'], authUser: user }
			);

			await waitFor(() => {
				expect(screen.getByText('Popular Hyundai')).toBeInTheDocument();
			});

			// "Log Vehicle Work" button must NOT be present
			expect(screen.queryByRole('button', { name: /log vehicle work/i })).not.toBeInTheDocument();
		});
	});
});
