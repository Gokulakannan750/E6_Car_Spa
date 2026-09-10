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
		deleteShowroom: vi.fn(),
		toggleShowroomActive: vi.fn(),
		getDailyStaff: vi.fn(),
		confirmDailyStaffAttendance: vi.fn(),
		unlockDailyStaffAttendance: vi.fn(),
		assignDailyStaff: vi.fn(),
		updateDailyStaffVehicles: vi.fn(),
		removeDailyStaff: vi.fn(),
		getStaffList: vi.fn(),
		getShowroomDailyBill: vi.fn(),
		setShowroomDailyBill: vi.fn(),
		recordShowroomPayment: vi.fn(),
		deleteShowroomPayment: vi.fn(),
		getShowroomSummary: vi.fn(),
		getShowroomsOutstanding: vi.fn(),
	};
});

describe('ShowroomPage Component (Daily Operations & Billing)', () => {
	const todayStr = (() => {
		const now = new Date();
		const y = now.getFullYear();
		const m = String(now.getMonth() + 1).padStart(2, '0');
		const d = String(now.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	})();

	const mockShowrooms: api.ShowroomDto[] = [
		{
			id: 'sr-1',
			name: 'Popular Hyundai Showroom',
			address: 'Anna Salai, Chennai',
			phone: '9876500001',
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: null,
			activeStaffCountToday: 2,
			totalVehiclesToday: 8,
		},
		{
			id: 'sr-2',
			name: 'KUN BMW Showroom',
			address: 'OMR, Chennai',
			phone: '9876500002',
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: null,
			activeStaffCountToday: 0,
			totalVehiclesToday: 0,
		},
	];

	const mockStaffList: api.StaffDto[] = [
		{
			id: 'staff-1',
			name: 'Karthik Raja',
			phoneNumber: '9876540001',
			email: 'karthik@e6carspa.com',
			address: null,
			role: 'Technician',
			isActive: true,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
		},
		{
			id: 'staff-2',
			name: 'Senthil Nathan',
			phoneNumber: '9876540002',
			email: 'senthil@e6carspa.com',
			address: null,
			role: 'Technician',
			isActive: true,
			totalAdvances: 0,
			totalAdvanceAmount: 0,
		},
	];

	const mockDailyStaffResponse: api.DailyStaffResponse = {
		showroomId: 'sr-1',
		showroomName: 'Popular Hyundai Showroom',
		date: todayStr,
		totalVehiclesAttended: 8,
		isAttendanceConfirmed: false,
		attendanceConfirmedAt: null,
		attendanceConfirmedByUserId: null,
		attendanceConfirmedByName: null,
		staffAssignments: [
			{
				id: 'assign-1',
				showroomId: 'sr-1',
				showroomName: 'Popular Hyundai Showroom',
				staffId: 'staff-1',
				staffName: 'Karthik Raja',
				staffPhone: '9876540001',
				staffRole: 'Technician',
				date: todayStr,
				vehiclesAttended: 5,
				createdAt: `${todayStr}T08:00:00Z`,
			},
			{
				id: 'assign-2',
				showroomId: 'sr-1',
				showroomName: 'Popular Hyundai Showroom',
				staffId: 'staff-2',
				staffName: 'Senthil Nathan',
				staffPhone: '9876540002',
				staffRole: 'Technician',
				date: todayStr,
				vehiclesAttended: 3,
				createdAt: `${todayStr}T08:00:00Z`,
			},
		],
	};

	const mockDailyBill: api.ShowroomDailyBillDto = {
		id: 'bill-1',
		showroomId: 'sr-1',
		showroomName: 'Popular Hyundai Showroom',
		date: todayStr,
		amount: 3200,
		amountReceived: 2000,
		balanceAmount: 1200,
		status: 'PartiallyPaid',
		notes: 'Daily billing for 8 cars',
		payments: [
			{
				id: 'pay-1',
				showroomDailyBillId: 'bill-1',
				amount: 2000,
				paymentMethod: 'UPI',
				reference: 'UPI-987654',
				paymentDate: `${todayStr}T17:00:00Z`,
				notes: 'Initial UPI transfer',
				createdAt: `${todayStr}T17:00:00Z`,
			},
		],
		createdAt: `${todayStr}T16:00:00Z`,
		updatedAt: null,
	};

	const mockOutstanding: api.ShowroomOutstandingOverviewDto[] = [
		{
			showroomId: 'sr-1',
			showroomName: 'Popular Hyundai Showroom',
			address: 'Anna Salai, Chennai',
			phone: '9876500001',
			isActive: true,
			totalBilled: 50000,
			totalReceived: 42000,
			outstandingAmount: 8000,
			unpaidDaysCount: 3,
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getShowrooms).mockResolvedValue(mockShowrooms);
		vi.mocked(api.getStaffList).mockResolvedValue(mockStaffList);
		vi.mocked(api.getDailyStaff).mockResolvedValue(mockDailyStaffResponse);
		vi.mocked(api.getShowroomDailyBill).mockResolvedValue(mockDailyBill);
		vi.mocked(api.getShowroomsOutstanding).mockResolvedValue(mockOutstanding);
		vi.mocked(api.createShowroom).mockResolvedValue(mockShowrooms[0]);
		vi.mocked(api.assignDailyStaff).mockResolvedValue(mockDailyStaffResponse.staffAssignments[0]);
		vi.mocked(api.updateDailyStaffVehicles).mockResolvedValue({
			...mockDailyStaffResponse.staffAssignments[0],
			vehiclesAttended: 6,
		});
		vi.mocked(api.setShowroomDailyBill).mockResolvedValue(mockDailyBill);
		vi.mocked(api.recordShowroomPayment).mockResolvedValue(mockDailyBill);
	});

	it('renders Showroom directory with list of showrooms and search filter', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{ initialEntries: ['/showroom'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
			expect(screen.getByText('KUN BMW Showroom')).toBeInTheDocument();
			expect(screen.getByText('Anna Salai, Chennai')).toBeInTheDocument();
		});

		// Search filter test
		const searchInput = screen.getByPlaceholderText(/search by showroom/i);
		fireEvent.change(searchInput, { target: { value: 'Hyundai' } });

		await waitFor(() => {
			expect(api.getShowrooms).toHaveBeenCalledWith(
				expect.objectContaining({ search: 'Hyundai' })
			);
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});
	});

	it('opens create showroom dialog and submits valid showroom', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{ initialEntries: ['/showroom'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /add showroom/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /add showroom/i }));

		await waitFor(() => {
			expect(screen.getByText('Add New Showroom')).toBeInTheDocument();
		});

		// Fill showroom fields
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. erode showroom/i), {
			target: { value: 'Maruti TrueValue' },
		});
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. 142 brough road/i), {
			target: { value: 'Guindy, Chennai' },
		});

		const saveBtn = screen.getByRole('button', { name: /^create showroom$/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(api.createShowroom).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Maruti TrueValue',
					address: 'Guindy, Chennai',
				})
			);
		});
	});

	it('enters showroom workspace, manages daily staff assignments and updates vehicle counts', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{ initialEntries: ['/showroom'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		// Click showroom row to enter Workspace
		fireEvent.click(screen.getByText('Popular Hyundai Showroom'));

		await waitFor(() => {
			expect(screen.getByTitle('Back to Showrooms List')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /daily workspace/i })).toBeInTheDocument();
			expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
			expect(screen.getByText('Senthil Nathan')).toBeInTheDocument();
		});

		// Verify vehicles count inputs
		expect(screen.getByDisplayValue('5')).toBeInTheDocument();
		expect(screen.getByDisplayValue('3')).toBeInTheDocument();

		// Increment vehicle count for first staff
		const incrementButtons = screen.getAllByTitle('Increase vehicle count');
		fireEvent.click(incrementButtons[0]);

		await waitFor(() => {
			expect(api.updateDailyStaffVehicles).toHaveBeenCalledWith('assign-1', 6);
		});
	});

	it('displays daily billing details in workspace view', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{ initialEntries: ['/showroom'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Popular Hyundai Showroom'));

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /daily workspace/i })).toBeInTheDocument();
			expect(screen.getAllByText('₹3,200.00').length).toBeGreaterThan(0);
			expect(screen.getAllByText('₹2,000.00').length).toBeGreaterThan(0);
			expect(screen.getAllByText('₹1,200.00').length).toBeGreaterThan(0);
		});
	});

	it('switches to Outstanding Summary tab and displays showroom balances', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom" element={<ShowroomPage />} />
			</Routes>,
			{ initialEntries: ['/showroom'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /outstanding summary/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /outstanding summary/i }));

		await waitFor(() => {
			expect(api.getShowroomsOutstanding).toHaveBeenCalled();
			expect(screen.getByText('Popular Hyundai Showroom')).toBeInTheDocument();
			expect(screen.getAllByText('₹8,000.00').length).toBeGreaterThan(0);
		});
	});
});
