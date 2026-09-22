import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
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
	};
});

describe('Staff Attendance & Salary UI Shells', () => {
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
	});

	describe('AttendancePage (/staff-attendance)', () => {
		it('renders clean attendance UI shell with date selector and no fake attendance data', async () => {
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
				expect(screen.getByText('Track daily staff attendance and attendance history')).toBeInTheDocument();
				expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument();
			});

			// Verify preparation notice is present
			expect(
				screen.getByText(/attendance records and daily staff check-in management will be available once the staff attendance backend is enabled/i)
			).toBeInTheDocument();

			// Verify that fake attendance metrics (e.g., Present / Absent / Check-in time) are NOT fabricated
			expect(screen.queryByText(/present count/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/absent count/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/attendance rate/i)).not.toBeInTheDocument();
		});

		it('allows date navigation with Previous and Next day buttons', async () => {
			renderWithProviders(
				<Routes>
					<Route path="/staff-attendance" element={<AttendancePage />} />
				</Routes>,
				{
					initialEntries: ['/staff-attendance'],
				}
			);

			const prevBtn = screen.getByTitle('Previous Day');
			const nextBtn = screen.getByTitle('Next Day');
			expect(prevBtn).toBeInTheDocument();
			expect(nextBtn).toBeInTheDocument();

			fireEvent.click(prevBtn);
			fireEvent.click(nextBtn);
		});
	});

	describe('SalaryPage (/staff-salary)', () => {
		it('renders clean salary UI shell with period selector and no fake payroll calculations', async () => {
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
				expect(screen.getByText('Manage staff salary and payroll information')).toBeInTheDocument();
			});

			// Verify future visual modules exist
			expect(screen.getAllByText('Salary Period').length).toBeGreaterThanOrEqual(1);
			expect(screen.getByText('Staff Payroll')).toBeInTheDocument();
			expect(screen.getByText('Advance Deductions')).toBeInTheDocument();
			expect(screen.getByText('Salary Payments')).toBeInTheDocument();

			// Verify preparation notice is present
			expect(
				screen.getByText(/payroll calculation and salary processing will be connected when the staff salary backend is introduced/i)
			).toBeInTheDocument();

			// Verify that fake payroll values (e.g. Net Salary ₹, Processed Payroll) are NOT fabricated
			expect(screen.queryByText(/net salary/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/total payroll: ₹/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/processed salary/i)).not.toBeInTheDocument();
		});
	});
});
