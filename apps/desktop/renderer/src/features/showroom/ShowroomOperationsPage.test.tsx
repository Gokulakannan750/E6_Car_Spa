import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ShowroomOperationsPage } from './ShowroomOperationsPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getShowrooms: vi.fn(),
		getStaffList: vi.fn(),
		getDailyStaff: vi.fn(),
		getShowroomVehicleTypes: vi.fn(),
		getShowroomWorkTypes: vi.fn(),
		getShowroomVehicleWorks: vi.fn(),
		getShowroomWorkSessions: vi.fn(),
		getShowroomOperationsSummary: vi.fn(),
		createShowroomVehicleWork: vi.fn(),
		createBatchShowroomVehicleWork: vi.fn(),
		updateShowroomVehicleWork: vi.fn(),
		createShowroomWorkSession: vi.fn(),
		updateShowroomWorkSession: vi.fn(),
		closeShowroomWorkSession: vi.fn(),
	};
});

const mockOwnerUser = {
	id: 'usr-owner-1',
	fullName: 'Admin User',
	username: 'admin',
	role: 'Owner' as const,
	isOwner: true,
	permissions: ['*'],
};

const mockShowrooms: api.ShowroomDto[] = [
	{
		id: '11111111-1111-1111-1111-111111111111',
		masterId: 'PO10001',
		name: 'Popular Hyundai',
		address: 'Anna Salai, Chennai',
		phone: '9876543210',
		gstin: '33AAAAA0000A1Z5',
		isActive: true,
		activeStaffCountToday: 2,
		totalVehiclesToday: 15,
		createdAt: '2026-01-01T00:00:00Z',
	},
	{
		id: '22222222-2222-2222-2222-222222222222',
		masterId: 'KU10001',
		name: 'KUN BMW',
		address: 'OMR Road, Chennai',
		phone: '9876543211',
		gstin: '33BBBBB0000B1Z6',
		isActive: false,
		activeStaffCountToday: 0,
		totalVehiclesToday: 0,
		createdAt: '2026-01-02T00:00:00Z',
	},
];

const mockStaffList: api.StaffDto[] = [
	{
		id: '33333333-3333-3333-3333-333333333333',
		staffMasterId: 'GO123L',
		name: 'Gokul Kannan',
		phoneNumber: '9876500001',
		email: 'gokul@carspa.com',
		address: 'Chennai',
		role: 'Detailer',
		isActive: true,
		totalAdvances: 0,
		totalAdvanceAmount: 0,
		defaultShowroomId: '11111111-1111-1111-1111-111111111111',
		defaultShowroomMasterId: 'PO10001',
		defaultShowroomName: 'Popular Hyundai',
	},
	{
		id: '44444444-4444-4444-4444-444444444444',
		staffMasterId: 'KU456R',
		name: 'Kumar Raja',
		phoneNumber: '9876500002',
		email: 'kumar@carspa.com',
		address: 'Chennai',
		role: 'Technician',
		isActive: true,
		totalAdvances: 0,
		totalAdvanceAmount: 0,
		defaultShowroomId: null,
	},
];

const mockVehicleTypes: api.ShowroomVehicleTypeDto[] = [
	{ id: 'vt-1', code: 'HATCHBACK', name: 'Hatchback', displayOrder: 1, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
	{ id: 'vt-2', code: 'SEDAN', name: 'Sedan', displayOrder: 2, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
	{ id: 'vt-3', code: 'SUV_MUV', name: 'SUV / MUV', displayOrder: 3, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
];

const mockWorkTypes: api.ShowroomWorkTypeDto[] = [
	{ id: 'wt-1', code: 'BODYWASH', name: 'Body Wash', description: 'Exterior Wash', displayOrder: 1, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
	{ id: 'wt-2', code: 'INTERIOR', name: 'Interior Cleaning', description: 'Vacuum & Wipe', displayOrder: 2, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
	{ id: 'wt-3', code: 'TEFLON', name: 'Teflon Coating', description: 'Teflon Polish', displayOrder: 3, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
];

const mockVehicleWorks: api.ShowroomVehicleWorkDto[] = [
	{
		id: 'vw-101',
		showroomId: '11111111-1111-1111-1111-111111111111',
		showroomMasterId: 'PO10001',
		showroomName: 'Popular Hyundai',
		staffId: '33333333-3333-3333-3333-333333333333',
		staffMasterId: 'GO123L',
		staffName: 'Gokul Kannan',
		vehicleTypeId: 'vt-2',
		vehicleTypeCode: 'SEDAN',
		vehicleTypeName: 'Sedan',
		showroomStaffWorkSessionId: null,
		vehicleQuantity: 2,
		date: '2026-09-25T00:00:00Z',
		timeRecorded: '10:30',
		notes: 'Special clean request',
		serviceItems: [
			{ id: 'item-1', showroomVehicleWorkId: 'vw-101', workTypeId: 'wt-1', workTypeCode: 'BODYWASH', workTypeName: 'Body Wash', quantity: 2, createdAt: '2026-09-25T00:00:00Z' },
			{ id: 'item-2', showroomVehicleWorkId: 'vw-101', workTypeId: 'wt-2', workTypeCode: 'INTERIOR', workTypeName: 'Interior Cleaning', quantity: 2, createdAt: '2026-09-25T00:00:00Z' },
		],
		createdAt: '2026-09-25T00:00:00Z',
		updatedAt: null,
	},
];

const mockWorkSessions: api.ShowroomStaffWorkSessionDto[] = [
	{
		id: 'sess-201',
		staffId: '33333333-3333-3333-3333-333333333333',
		staffMasterId: 'GO123L',
		staffName: 'Gokul Kannan',
		staffPhone: '9876500001',
		staffRole: 'Detailer',
		homeShowroomId: '11111111-1111-1111-1111-111111111111',
		homeShowroomMasterId: 'PO10001',
		homeShowroomName: 'Popular Hyundai',
		workingShowroomId: '11111111-1111-1111-1111-111111111111',
		workingShowroomMasterId: 'PO10001',
		workingShowroomName: 'Popular Hyundai',
		date: '2026-09-25T00:00:00Z',
		sessionType: 'FullDay',
		sessionTypeName: 'Full Day',
		attendanceStatus: 'Present',
		attendanceStatusName: 'Present',
		startTime: '09:00',
		endTime: null,
		transferReason: null,
		notes: 'Regular shift',
		vehicleWorkCount: 1,
		createdAt: '2026-09-25T00:00:00Z',
		updatedAt: null,
	},
];

const mockOperationsSummary: api.ShowroomOperationsSummaryDto = {
	showroomId: '11111111-1111-1111-1111-111111111111',
	showroomMasterId: 'PO10001',
	showroomName: 'Popular Hyundai',
	fromDate: '2026-09-25T00:00:00Z',
	toDate: '2026-09-25T00:00:00Z',
	totalVehiclesHandled: 2,
	totalServicesPerformed: 4,
	totalActiveStaffSessions: 1,
	vehicleTypeBreakdown: [
		{ vehicleTypeId: 'vt-2', vehicleTypeCode: 'SEDAN', vehicleTypeName: 'Sedan', totalVehicles: 2 },
	],
	workTypeBreakdown: [
		{ workTypeId: 'wt-1', workTypeCode: 'BODYWASH', workTypeName: 'Body Wash', totalQuantity: 2 },
		{ workTypeId: 'wt-2', workTypeCode: 'INTERIOR', workTypeName: 'Interior Cleaning', totalQuantity: 2 },
	],
	staffProductivityBreakdown: [
		{
			staffId: '33333333-3333-3333-3333-333333333333',
			staffMasterId: 'GO123L',
			staffName: 'Gokul Kannan',
			totalSessions: 1,
			totalVehiclesHandled: 2,
			totalServicesPerformed: 4,
		},
	],
};

const mockDailyStaff: api.DailyStaffResponse = {
	showroomId: '11111111-1111-1111-1111-111111111111',
	showroomName: 'Popular Hyundai',
	date: '2026-09-25T00:00:00Z',
	totalVehiclesAttended: 2,
	isAttendanceConfirmed: true,
	attendanceConfirmedAt: '2026-09-25T17:00:00Z',
	attendanceConfirmedByUserId: 'usr-owner-1',
	attendanceConfirmedByName: 'Admin User',
	staffAssignments: [
		{
			id: 'assign-1',
			showroomId: '11111111-1111-1111-1111-111111111111',
			showroomName: 'Popular Hyundai',
			staffId: '33333333-3333-3333-3333-333333333333',
			staffMasterId: 'GO123L',
			staffName: 'Gokul Kannan',
			staffPhone: '9876500001',
			staffRole: 'Detailer',
			date: '2026-09-25T00:00:00Z',
			vehiclesAttended: 2,
			createdAt: '2026-09-25T00:00:00Z',
		},
	],
};

function renderOperations(initialRoute = '/showroom/operations') {
	return renderWithProviders(
		<Routes>
			<Route path="/showroom/operations" element={<ShowroomOperationsPage />} />
		</Routes>,
		{
			initialEntries: [initialRoute],
			authUser: mockOwnerUser,
		}
	);
}

describe('ShowroomOperationsPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getShowrooms).mockResolvedValue(mockShowrooms);
		vi.mocked(api.getStaffList).mockResolvedValue(mockStaffList);
		vi.mocked(api.getDailyStaff).mockResolvedValue(mockDailyStaff);
		vi.mocked(api.getShowroomVehicleTypes).mockResolvedValue(mockVehicleTypes);
		vi.mocked(api.getShowroomWorkTypes).mockResolvedValue(mockWorkTypes);
		vi.mocked(api.getShowroomVehicleWorks).mockResolvedValue(mockVehicleWorks);
		vi.mocked(api.getShowroomWorkSessions).mockResolvedValue(mockWorkSessions);
		vi.mocked(api.getShowroomOperationsSummary).mockResolvedValue(mockOperationsSummary);
	});

	// ── 1. Landing Table & Showroom Display ────────────────────────────────────
	it('1. renders Showroom Operations landing table with showroom directory', async () => {
		renderOperations('/showroom/operations');

		expect(await screen.findByText('Popular Hyundai')).toBeInTheDocument();
		expect(screen.getByText('KUN BMW')).toBeInTheDocument();
		expect(screen.getByText('#PO10001')).toBeInTheDocument();
		expect(screen.getByText('#KU10001')).toBeInTheDocument();
	});

	// ── 2. Active / Inactive Showroom Display ──────────────────────────────────
	it('2. displays active and inactive showroom statuses correctly', async () => {
		renderOperations('/showroom/operations');

		await screen.findByText('Popular Hyundai');
		expect(screen.getByText('Active')).toBeInTheDocument();
		expect(screen.getByText('Inactive')).toBeInTheDocument();
	});

	// ── 3. Inactive Showroom Disabled ─────────────────────────────────────────
	it('3. disables Open Operations button for inactive showrooms', async () => {
		renderOperations('/showroom/operations');

		await screen.findByText('KUN BMW');
		const openButtons = screen.getAllByRole('button', { name: /Open Operations/i });
		expect(openButtons[0]).not.toBeDisabled();
		expect(openButtons[1]).toBeDisabled();
	});

	// ── 4. Date Selection & Navigation ────────────────────────────────────────
	it('4. allows date selection and navigation', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		expect(await screen.findByText('Popular Hyundai')).toBeInTheDocument();
		expect(screen.getByTitle('Previous Day')).toBeInTheDocument();
		expect(screen.getByTitle('Next Day')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
	});

	// ── 5. Daily Summary Rendering ────────────────────────────────────
	it('5. renders daily operations summary with vehicle counts and breakdown', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		expect(await screen.findByText('Daily Operations Summary')).toBeInTheDocument();
		expect(screen.getByText('Vehicles Handled')).toBeInTheDocument();
		expect(screen.getByText('Services Completed')).toBeInTheDocument();
		expect(screen.getByText('Active Staff Sessions')).toBeInTheDocument();
	});

	// ── 6. Vehicle Work Table ─────────────────────────────────────────────────
	it('6. displays vehicle works in a structured table without raw Guids', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		expect(await screen.findByText('Gokul Kannan')).toBeInTheDocument();
		expect(screen.getByText('#GO123L')).toBeInTheDocument();
		expect(screen.getAllByText('Sedan').length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText('2 vehicles')).toBeInTheDocument();
		expect(screen.getByText('Body Wash (2)')).toBeInTheDocument();
		expect(screen.getByText('Interior Cleaning (2)')).toBeInTheDocument();
		expect(screen.getByText('Special clean request')).toBeInTheDocument();

		// Ensure raw database GUID is NEVER visible in document
		expect(screen.queryByText('11111111-1111-1111-1111-111111111111')).not.toBeInTheDocument();
		expect(screen.queryByText('33333333-3333-3333-3333-333333333333')).not.toBeInTheDocument();
	});

	// ── 7. Log Vehicle Work Modal: Time Recorded removed & Vehicle 1 expanded by default ──
	it('7. opens Log Vehicle Work modal without Time Recorded field and with Vehicle 1 expanded by default', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		// Staff and Count inputs
		expect(await screen.findByLabelText(/Staff Member/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Vehicle Count/i)).toHaveValue(1);

		// Time Recorded must NOT be in the document
		expect(screen.queryByLabelText(/Time Recorded/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Time Recorded/i)).not.toBeInTheDocument();

		// Vehicle 1 should be expanded
		expect(screen.getByText('Vehicle 1')).toBeInTheDocument();
		expect(screen.getByLabelText('Vehicle 1 Type')).toBeInTheDocument();
		expect(screen.getByLabelText('Vehicle 1 - Body Wash')).toBeInTheDocument();
	});

	// ── 8. Collapsible Vehicles: Default states and Expand/Collapse toggle ──────
	it('8. handles collapsible vehicle sections: Vehicle 1 expanded, 2+ collapsed, and toggles expansion independently', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const countInput = await screen.findByLabelText(/Vehicle Count/i);
		fireEvent.change(countInput, { target: { value: '3' } });

		// Vehicle 1 should be expanded (visible fields)
		expect(screen.getByLabelText('Vehicle 1 Type')).toBeInTheDocument();

		// Vehicles 2 & 3 headers exist, but form fields are collapsed
		expect(screen.getByText('Vehicle 2')).toBeInTheDocument();
		expect(screen.getByText('Vehicle 3')).toBeInTheDocument();
		expect(screen.queryByLabelText('Vehicle 2 Type')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Vehicle 3 Type')).not.toBeInTheDocument();

		// Click Vehicle 2 header to expand it
		const v2Header = screen.getByRole('button', { name: /Vehicle 2/i });
		fireEvent.click(v2Header);
		expect(screen.getByLabelText('Vehicle 2 Type')).toBeInTheDocument();

		// Click Vehicle 1 header to collapse it
		const v1Header = screen.getByRole('button', { name: /Vehicle 1/i });
		fireEvent.click(v1Header);
		expect(screen.queryByLabelText('Vehicle 1 Type')).not.toBeInTheDocument();

		// Vehicle 2 remains expanded
		expect(screen.getByLabelText('Vehicle 2 Type')).toBeInTheDocument();
	});

	// ── 9. Collapsing Preserves Selected Data & Shows Header Summary ────────────
	it('9. preserves vehicle type and service selections when collapsed and updates header summary', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		// Configure Vehicle 1
		fireEvent.change(screen.getByLabelText('Vehicle 1 Type'), { target: { value: 'vt-1' } });
		fireEvent.click(screen.getByLabelText('Vehicle 1 - Body Wash'));
		fireEvent.click(screen.getByLabelText('Vehicle 1 - Interior Cleaning'));

		// Header displays dynamic summary
		expect(screen.getByText(/• Hatchback/i)).toBeInTheDocument();
		expect(screen.getByText(/• 2 services/i)).toBeInTheDocument();

		// Collapse Vehicle 1
		const v1Header = screen.getByRole('button', { name: /Vehicle 1/i });
		fireEvent.click(v1Header);
		expect(screen.queryByLabelText('Vehicle 1 Type')).not.toBeInTheDocument();

		// Re-expand Vehicle 1
		fireEvent.click(v1Header);
		expect(screen.getByLabelText('Vehicle 1 Type')).toHaveValue('vt-1');
		expect(screen.getByLabelText('Vehicle 1 - Body Wash')).toBeChecked();
		expect(screen.getByLabelText('Vehicle 1 - Interior Cleaning')).toBeChecked();
	});

	// ── 10. Resizing Vehicle Count: Newly Added Vehicles Start Collapsed ────────
	it('10. preserves selections across resize (3 -> 5 and 5 -> 2) and starts newly added vehicles collapsed', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const countInput = await screen.findByLabelText(/Vehicle Count/i);
		fireEvent.change(countInput, { target: { value: '3' } });

		// Configure Vehicle 1
		fireEvent.change(screen.getByLabelText('Vehicle 1 Type'), { target: { value: 'vt-1' } });
		fireEvent.click(screen.getByLabelText('Vehicle 1 - Body Wash'));

		// Expand & configure Vehicle 2
		fireEvent.click(screen.getByRole('button', { name: /Vehicle 2/i }));
		fireEvent.change(screen.getByLabelText('Vehicle 2 Type'), { target: { value: 'vt-2' } });
		fireEvent.click(screen.getByLabelText('Vehicle 2 - Interior Cleaning'));

		// Resize 3 -> 5
		fireEvent.change(countInput, { target: { value: '5' } });
		expect(screen.getByText('Vehicle 4')).toBeInTheDocument();
		expect(screen.getByText('Vehicle 5')).toBeInTheDocument();
		// 4 and 5 must be collapsed
		expect(screen.queryByLabelText('Vehicle 4 Type')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Vehicle 5 Type')).not.toBeInTheDocument();

		// Vehicle 1 & 2 selections preserved
		expect(screen.getByLabelText('Vehicle 1 Type')).toHaveValue('vt-1');
		expect(screen.getByLabelText('Vehicle 2 Type')).toHaveValue('vt-2');

		// Resize 5 -> 2
		fireEvent.change(countInput, { target: { value: '2' } });
		expect(screen.getByLabelText('Vehicle 1 Type')).toHaveValue('vt-1');
		expect(screen.getByLabelText('Vehicle 2 Type')).toHaveValue('vt-2');
		expect(screen.queryByText('Vehicle 3')).not.toBeInTheDocument();
		expect(screen.queryByText('Vehicle 4')).not.toBeInTheDocument();
	});

	// ── 11. Auto-expansion of Invalid Collapsed Vehicle on Save ─────────────────
	it('11. auto-expands the invalid collapsed vehicle and displays specific validation error on submit', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = await screen.findByLabelText(/Staff Member/i);
		const form = staffSelect.closest('form')!;

		// Set staff and count = 2
		fireEvent.change(staffSelect, { target: { value: '33333333-3333-3333-3333-333333333333' } });
		fireEvent.change(screen.getByLabelText(/Vehicle Count/i), { target: { value: '2' } });

		// Vehicle 1 is valid
		fireEvent.change(screen.getByLabelText('Vehicle 1 Type'), { target: { value: 'vt-1' } });
		fireEvent.click(screen.getByLabelText('Vehicle 1 - Body Wash'));

		// Vehicle 2 is collapsed and missing type
		expect(screen.queryByLabelText('Vehicle 2 Type')).not.toBeInTheDocument();

		// Submit form
		fireEvent.submit(form);

		// Vehicle 2 should auto-expand and show validation error
		expect(await screen.findByText(/Vehicle 2: Vehicle Type is required/i)).toBeInTheDocument();
		expect(screen.getByLabelText('Vehicle 2 Type')).toBeInTheDocument();

		// Select type for Vehicle 2, but leave services empty
		fireEvent.change(screen.getByLabelText('Vehicle 2 Type'), { target: { value: 'vt-2' } });
		fireEvent.submit(form);
		expect(await screen.findByText(/Vehicle 2: Select at least one service/i)).toBeInTheDocument();
	});

	// ── 12. Batch Vehicle Work Submission ─────────────────────────────────────
	it('12. submits batch vehicle work payload for multiple vehicles', async () => {
		vi.mocked(api.createBatchShowroomVehicleWork).mockResolvedValue([
			{ ...mockVehicleWorks[0], id: 'vw-batch-1' },
			{ ...mockVehicleWorks[0], id: 'vw-batch-2' },
		]);

		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = await screen.findByLabelText(/Staff Member/i);
		fireEvent.change(staffSelect, { target: { value: '33333333-3333-3333-3333-333333333333' } });
		fireEvent.change(screen.getByLabelText(/Vehicle Count/i), { target: { value: '2' } });

		// Vehicle 1: Hatchback + Body Wash & Interior
		fireEvent.change(screen.getByLabelText('Vehicle 1 Type'), { target: { value: 'vt-1' } });
		fireEvent.click(screen.getByLabelText('Vehicle 1 - Body Wash'));
		fireEvent.click(screen.getByLabelText('Vehicle 1 - Interior Cleaning'));

		// Expand Vehicle 2
		fireEvent.click(screen.getByRole('button', { name: /Vehicle 2/i }));

		// Vehicle 2: SUV/MUV + Teflon Coating
		fireEvent.change(screen.getByLabelText('Vehicle 2 Type'), { target: { value: 'vt-3' } });
		fireEvent.click(screen.getByLabelText('Vehicle 2 - Teflon Coating'));

		// Submit
		const form = staffSelect.closest('form')!;
		fireEvent.submit(form);

		await waitFor(() => {
			expect(api.createBatchShowroomVehicleWork).toHaveBeenCalledWith(
				'11111111-1111-1111-1111-111111111111',
				expect.objectContaining({
					staffId: '33333333-3333-3333-3333-333333333333',
					date: '2026-09-25',
					vehicles: [
						{
							vehicleTypeId: 'vt-1',
							workTypeIds: ['wt-1', 'wt-2'],
						},
						{
							vehicleTypeId: 'vt-3',
							workTypeIds: ['wt-3'],
						},
					],
				})
			);
		});
	});

	// ── 13. Edit Vehicle Work ─────────────────────────────────────────────────
	it('13. opens Edit Vehicle Work modal with existing values populated and updates record', async () => {
		vi.mocked(api.updateShowroomVehicleWork).mockResolvedValue({
			...mockVehicleWorks[0],
		});

		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const editBtn = await screen.findByRole('button', { name: /Edit/i });
		fireEvent.click(editBtn);

		expect(await screen.findByText('Edit Vehicle Work')).toBeInTheDocument();
		expect(screen.getByLabelText('Vehicle 1 Type')).toHaveValue('vt-2');
		expect(screen.getByLabelText('Vehicle 1 - Body Wash')).toBeChecked();
		expect(screen.getByLabelText('Vehicle 1 - Interior Cleaning')).toBeChecked();

		// Submit update
		const updateBtn = screen.getByRole('button', { name: /Update Record/i });
		fireEvent.click(updateBtn);

		await waitFor(() => {
			expect(api.updateShowroomVehicleWork).toHaveBeenCalledWith(
				'11111111-1111-1111-1111-111111111111',
				'vw-101',
				expect.objectContaining({
					vehicleTypeId: 'vt-2',
					serviceItems: expect.arrayContaining([
						expect.objectContaining({ workTypeId: 'wt-1', quantity: 1 }),
						expect.objectContaining({ workTypeId: 'wt-2', quantity: 1 }),
					]),
				})
			);
		});
	});

	// ── 14. Staff Work Sessions Tab ───────────────────────────────────────────
	it('14. switches to Staff Work Sessions tab and displays session details', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const sessionsTabBtn = screen.getByRole('button', { name: /Staff Work Sessions/i });
		fireEvent.click(sessionsTabBtn);

		expect(await screen.findByText('Daily Staff Work Sessions')).toBeInTheDocument();
		expect(screen.getByText('Full Day')).toBeInTheDocument();
		expect(screen.getByText('1 work')).toBeInTheDocument();
	});

	// ── 15. Staff Can Work Without Permanent Assignment ───────────────────────
	it('15. allows roaming/freelance staff to work without permanent assignment', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const startSessBtn = screen.getByRole('button', { name: /Start Session/i });
		fireEvent.click(startSessBtn);

		expect(await screen.findByText('Start Staff Work Session')).toBeInTheDocument();
		expect(screen.getAllByText(/Kumar Raja \(KU456R\)/i).length).toBeGreaterThanOrEqual(1);
	});

	// ── 16. Staff Productivity Summary ────────────────────────────────────────
	it('16. displays staff productivity breakdown in history tab', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25&tab=history');

		expect(await screen.findByText('Staff Productivity Summary')).toBeInTheDocument();
		expect(await screen.findByText('Gokul Kannan')).toBeInTheDocument();
		expect(screen.getByText('#GO123L')).toBeInTheDocument();
	});

	// ── 17. Search Filter in Showroom Directory ───────────────────────────────
	it('17. filters showroom directory by search term', async () => {
		renderOperations('/showroom/operations');

		expect(await screen.findByText('Popular Hyundai')).toBeInTheDocument();
		expect(screen.getByText('KUN BMW')).toBeInTheDocument();

		const searchInput = screen.getByPlaceholderText(/Search showrooms/i);
		fireEvent.change(searchInput, { target: { value: 'BMW' } });

		expect(screen.queryByText('Popular Hyundai')).not.toBeInTheDocument();
		expect(screen.getByText('KUN BMW')).toBeInTheDocument();
	});

	// ── 18. Vehicle Count Input: Clearing, Temporary Empty State & Typing 5 ────
	it('18. allows completely clearing Vehicle Count, preserves data during temporary empty string, and updates to 5 vehicles on typing 5', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const countInput = await screen.findByLabelText(/Vehicle Count/i);
		expect(countInput).toHaveValue(1);

		// Select type and service for Vehicle 1
		fireEvent.change(screen.getByLabelText('Vehicle 1 Type'), { target: { value: 'vt-1' } });
		fireEvent.click(screen.getByLabelText('Vehicle 1 - Body Wash'));
		expect(screen.getByLabelText('Vehicle 1 Type')).toHaveValue('vt-1');

		// 1 -> Backspace (clear completely)
		fireEvent.change(countInput, { target: { value: '' } });

		// Input is empty, does NOT force 1 back immediately
		expect(countInput).toHaveValue(null);
		expect(countInput).toHaveAttribute('value', '');

		// During empty state, Vehicle 1 is preserved and not destroyed
		expect(screen.getByText('Vehicle 1')).toBeInTheDocument();
		expect(screen.getByLabelText('Vehicle 1 Type')).toHaveValue('vt-1');
		expect(screen.getByLabelText('Vehicle 1 - Body Wash')).toBeChecked();

		// Type 5
		fireEvent.change(countInput, { target: { value: '5' } });
		expect(countInput).toHaveValue(5);

		// Produces 5 vehicle sections
		expect(screen.getByText('Vehicle 1')).toBeInTheDocument();
		expect(screen.getByText('Vehicle 2')).toBeInTheDocument();
		expect(screen.getByText('Vehicle 3')).toBeInTheDocument();
		expect(screen.getByText('Vehicle 4')).toBeInTheDocument();
		expect(screen.getByText('Vehicle 5')).toBeInTheDocument();

		// Vehicle 1 selections are preserved
		expect(screen.getByLabelText('Vehicle 1 Type')).toHaveValue('vt-1');
		expect(screen.getByLabelText('Vehicle 1 - Body Wash')).toBeChecked();

		// Vehicles 2+ are collapsed by default
		expect(screen.queryByLabelText('Vehicle 2 Type')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Vehicle 5 Type')).not.toBeInTheDocument();
	});

	// ── 19. Reducing Count (5 -> 2) Removes Only Vehicles 3–5 ─────────────────
	it('19. reducing count from 5 to 2 preserves Vehicles 1 and 2 and removes Vehicles 3-5', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const countInput = await screen.findByLabelText(/Vehicle Count/i);

		// Set count to 5
		fireEvent.change(countInput, { target: { value: '5' } });

		// Configure Vehicle 1 & Vehicle 2
		fireEvent.change(screen.getByLabelText('Vehicle 1 Type'), { target: { value: 'vt-1' } });
		fireEvent.click(screen.getByRole('button', { name: /Vehicle 2/i }));
		fireEvent.change(screen.getByLabelText('Vehicle 2 Type'), { target: { value: 'vt-2' } });

		// Reduce 5 -> 2
		fireEvent.change(countInput, { target: { value: '2' } });
		expect(countInput).toHaveValue(2);

		// Vehicles 1 and 2 exist and preserve selections
		expect(screen.getByLabelText('Vehicle 1 Type')).toHaveValue('vt-1');
		expect(screen.getByLabelText('Vehicle 2 Type')).toHaveValue('vt-2');

		// Vehicles 3, 4, 5 are removed
		expect(screen.queryByText('Vehicle 3')).not.toBeInTheDocument();
		expect(screen.queryByText('Vehicle 4')).not.toBeInTheDocument();
		expect(screen.queryByText('Vehicle 5')).not.toBeInTheDocument();
	});

	// ── 20. Validation: Empty Vehicle Count on Save ───────────────────────────
	it('20. shows validation error "Vehicle Count is required." when saving with empty count', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = await screen.findByLabelText(/Staff Member/i);
		fireEvent.change(staffSelect, { target: { value: '33333333-3333-3333-3333-333333333333' } });

		const countInput = screen.getByLabelText(/Vehicle Count/i);
		fireEvent.change(countInput, { target: { value: '' } });

		const form = staffSelect.closest('form')!;
		fireEvent.submit(form);

		expect(await screen.findByText('Vehicle Count is required.')).toBeInTheDocument();
		expect(api.createBatchShowroomVehicleWork).not.toHaveBeenCalled();
	});

	// ── 21. Validation: 0, Negative, Non-numeric and Decimal Values ────────────
	it('21. rejects count of 0, negative, decimal, and non-numeric values with appropriate validation error', async () => {
		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = await screen.findByLabelText(/Staff Member/i);
		fireEvent.change(staffSelect, { target: { value: '33333333-3333-3333-3333-333333333333' } });

		const countInput = screen.getByLabelText(/Vehicle Count/i);
		const form = staffSelect.closest('form')!;

		// Test 0
		fireEvent.change(countInput, { target: { value: '0' } });
		fireEvent.submit(form);
		expect(await screen.findByText('Vehicle Count must be at least 1.')).toBeInTheDocument();

		// Test decimal e.g. 2.5
		fireEvent.change(countInput, { target: { value: '2.5' } });
		fireEvent.submit(form);
		expect(await screen.findByText('Vehicle Count must be a valid whole number.')).toBeInTheDocument();

		// Test non-numeric / negative string
		fireEvent.change(countInput, { target: { value: '-3' } });
		fireEvent.submit(form);
		expect(await screen.findByText('Vehicle Count must be a valid whole number.')).toBeInTheDocument();

		expect(api.createBatchShowroomVehicleWork).not.toHaveBeenCalled();
	});

	// ── 22. Restrict Staff Member Dropdown to Daily Attendance (Single Staff) ─
	it('22. displays only staff assigned in daily attendance and excludes unassigned directory staff', async () => {
		// Mock attendance where only Gokul is assigned (Kumar is in staff directory but NOT in attendance)
		vi.mocked(api.getDailyStaff).mockResolvedValue({
			...mockDailyStaff,
			staffAssignments: [
				{
					id: 'assign-1',
					showroomId: '11111111-1111-1111-1111-111111111111',
					showroomName: 'Popular Hyundai',
					staffId: '33333333-3333-3333-3333-333333333333',
					staffMasterId: 'GO123L',
					staffName: 'Gokul Kannan',
					staffPhone: '9876500001',
					staffRole: 'Detailer',
					date: '2026-09-25T00:00:00Z',
					vehiclesAttended: 2,
					createdAt: '2026-09-25T00:00:00Z',
				},
			],
		});

		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = await screen.findByLabelText(/Staff Member/i);

		// Assigned staff (Gokul) must be present in the dropdown
		expect(within(staffSelect).getByRole('option', { name: /Gokul Kannan \(GO123L\) - Detailer/i })).toBeInTheDocument();

		// Unassigned staff (Kumar) must NOT be present in the modal dropdown
		expect(within(staffSelect).queryByRole('option', { name: /Kumar Raja/i })).not.toBeInTheDocument();
	});

	// ── 23. Multiple Staff Assigned in Attendance ─────────────────────────────
	it('23. displays exactly the assigned staff members when multiple staff are in attendance', async () => {
		vi.mocked(api.getDailyStaff).mockResolvedValue({
			...mockDailyStaff,
			staffAssignments: [
				{
					id: 'assign-1',
					showroomId: '11111111-1111-1111-1111-111111111111',
					showroomName: 'Popular Hyundai',
					staffId: '33333333-3333-3333-3333-333333333333',
					staffMasterId: 'GO123L',
					staffName: 'Gokul Kannan',
					staffPhone: '9876500001',
					staffRole: 'Detailer',
					date: '2026-09-25T00:00:00Z',
					vehiclesAttended: 2,
					createdAt: '2026-09-25T00:00:00Z',
				},
				{
					id: 'assign-2',
					showroomId: '11111111-1111-1111-1111-111111111111',
					showroomName: 'Popular Hyundai',
					staffId: '44444444-4444-4444-4444-444444444444',
					staffMasterId: 'KU456R',
					staffName: 'Kumar Raja',
					staffPhone: '9876500002',
					staffRole: 'Technician',
					date: '2026-09-25T00:00:00Z',
					vehiclesAttended: 0,
					createdAt: '2026-09-25T00:00:00Z',
				},
			],
		});

		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = await screen.findByLabelText(/Staff Member/i);
		expect(within(staffSelect).getByRole('option', { name: /Gokul Kannan \(GO123L\) - Detailer/i })).toBeInTheDocument();
		expect(within(staffSelect).getByRole('option', { name: /Kumar Raja \(KU456R\) - Technician/i })).toBeInTheDocument();
	});

	// ── 24. Empty Attendance State (Disabled Dropdown) ────────────────────────
	it('24. shows disabled dropdown with "No staff assigned for this date" when no attendance is recorded', async () => {
		vi.mocked(api.getDailyStaff).mockResolvedValue({
			...mockDailyStaff,
			staffAssignments: [],
		});

		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = await screen.findByLabelText(/Staff Member/i);
		expect(staffSelect).toBeDisabled();
		expect(within(staffSelect).getByRole('option', { name: 'No staff assigned for this date' })).toBeInTheDocument();
		expect(within(staffSelect).queryByRole('option', { name: /Gokul Kannan/i })).not.toBeInTheDocument();
	});

	// ── 25. Date Change Updates Attendance Staff Dropdown ─────────────────────
	it('25. re-fetches and updates staff dropdown when operation date changes', async () => {
		vi.mocked(api.getDailyStaff).mockImplementation(async (showroomId, date) => {
			if (date === '2026-09-25') {
				return {
					...mockDailyStaff,
					date: '2026-09-25T00:00:00Z',
					staffAssignments: [
						{
							id: 'assign-1',
							showroomId,
							showroomName: 'Popular Hyundai',
							staffId: '33333333-3333-3333-3333-333333333333',
							staffMasterId: 'GO123L',
							staffName: 'Gokul Kannan',
							staffPhone: '9876500001',
							staffRole: 'Detailer',
							date: '2026-09-25T00:00:00Z',
							vehiclesAttended: 2,
							createdAt: '2026-09-25T00:00:00Z',
						},
					],
				};
			} else {
				return {
					...mockDailyStaff,
					date: '2026-09-26T00:00:00Z',
					staffAssignments: [
						{
							id: 'assign-2',
							showroomId,
							showroomName: 'Popular Hyundai',
							staffId: '44444444-4444-4444-4444-444444444444',
							staffMasterId: 'KU456R',
							staffName: 'Kumar Raja',
							staffPhone: '9876500002',
							staffRole: 'Technician',
							date: '2026-09-26T00:00:00Z',
							vehiclesAttended: 0,
							createdAt: '2026-09-26T00:00:00Z',
						},
					],
				};
			}
		});

		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');

		// Click Next Day (changes date to 2026-09-26)
		const nextDayBtn = screen.getByTitle('Next Day');
		fireEvent.click(nextDayBtn);

		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = await screen.findByLabelText(/Staff Member/i);

		// Now Kumar Raja is shown for the new date, not Gokul Kannan
		await waitFor(() => {
			expect(within(staffSelect).getByRole('option', { name: /Kumar Raja \(KU456R\) - Technician/i })).toBeInTheDocument();
		});
		expect(within(staffSelect).queryByRole('option', { name: /Gokul Kannan/i })).not.toBeInTheDocument();
	});

	// ── 26. Staff Assigned to Another Showroom Does Not Appear ────────────────
	it('26. does not include staff members who are assigned only to a different showroom in daily attendance', async () => {
		vi.mocked(api.getDailyStaff).mockImplementation(async (showroomId) => {
			if (showroomId === '11111111-1111-1111-1111-111111111111') {
				return {
					...mockDailyStaff,
					showroomId,
					staffAssignments: [
						{
							id: 'assign-1',
							showroomId,
							showroomName: 'Popular Hyundai',
							staffId: '33333333-3333-3333-3333-333333333333',
							staffMasterId: 'GO123L',
							staffName: 'Gokul Kannan',
							staffPhone: '9876500001',
							staffRole: 'Detailer',
							date: '2026-09-25T00:00:00Z',
							vehiclesAttended: 2,
							createdAt: '2026-09-25T00:00:00Z',
						},
					],
				};
			} else {
				return {
					...mockDailyStaff,
					showroomId,
					staffAssignments: [
						{
							id: 'assign-2',
							showroomId,
							showroomName: 'KUN BMW',
							staffId: '44444444-4444-4444-4444-444444444444',
							staffMasterId: 'KU456R',
							staffName: 'Kumar Raja',
							staffPhone: '9876500002',
							staffRole: 'Technician',
							date: '2026-09-25T00:00:00Z',
							vehiclesAttended: 0,
							createdAt: '2026-09-25T00:00:00Z',
						},
					],
				};
			}
		});

		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');

		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = await screen.findByLabelText(/Staff Member/i);

		// Hyundai only displays Gokul, not Kumar
		expect(within(staffSelect).getByRole('option', { name: /Gokul Kannan/i })).toBeInTheDocument();
		expect(within(staffSelect).queryByRole('option', { name: /Kumar Raja/i })).not.toBeInTheDocument();
	});

	// ── 27. Ineligible Staff Selection Cleared on Date Change ─────────────────
	it('27. clears previously selected staff member if date changes to one where they are not in attendance', async () => {
		vi.mocked(api.getDailyStaff).mockImplementation(async (showroomId, date) => {
			if (date === '2026-09-25') {
				return {
					...mockDailyStaff,
					date: '2026-09-25T00:00:00Z',
					staffAssignments: [
						{
							id: 'assign-1',
							showroomId,
							showroomName: 'Popular Hyundai',
							staffId: '33333333-3333-3333-3333-333333333333',
							staffMasterId: 'GO123L',
							staffName: 'Gokul Kannan',
							staffPhone: '9876500001',
							staffRole: 'Detailer',
							date: '2026-09-25T00:00:00Z',
							vehiclesAttended: 2,
							createdAt: '2026-09-25T00:00:00Z',
						},
					],
				};
			} else {
				return {
					...mockDailyStaff,
					date: '2026-09-26T00:00:00Z',
					staffAssignments: [],
				};
			}
		});

		renderOperations('/showroom/operations?showroomId=11111111-1111-1111-1111-111111111111&date=2026-09-25');
		await screen.findByText('Popular Hyundai');
		const logBtn = screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0];
		fireEvent.click(logBtn);

		const staffSelect = (await screen.findByLabelText(/Staff Member/i)) as HTMLSelectElement;
		fireEvent.change(staffSelect, { target: { value: '33333333-3333-3333-3333-333333333333' } });
		expect(staffSelect.value).toBe('33333333-3333-3333-3333-333333333333');

		// Close modal and navigate to next date
		const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
		fireEvent.click(cancelBtn);

		const nextDayBtn = screen.getByTitle('Next Day');
		fireEvent.click(nextDayBtn);

		// Reopen modal on the new date
		fireEvent.click(screen.getAllByRole('button', { name: /Log Vehicle Work/i })[0]);
		const newStaffSelect = (await screen.findByLabelText(/Staff Member/i)) as HTMLSelectElement;
		expect(newStaffSelect.value).toBe('');
		expect(newStaffSelect).toBeDisabled();
	});
});
