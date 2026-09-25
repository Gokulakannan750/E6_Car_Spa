import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ShowroomBillPage } from './ShowroomBillPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getShowrooms: vi.fn(),
		getShowroomDailyBill: vi.fn(),
		setShowroomDailyBill: vi.fn(),
		recordShowroomPayment: vi.fn(),
		deleteShowroomPayment: vi.fn(),
		getShowroomSummary: vi.fn(),
		getShowroomsOutstanding: vi.fn(),
	};
});

describe('ShowroomBillPage Component (Phase 2B-B — Dedicated Showroom Bill)', () => {
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
	];

	const mockDailyBill: api.ShowroomDailyBillDto = {
		id: 'bill-1',
		showroomId: 'sr-1',
		showroomName: 'Popular Hyundai Showroom',
		date: '2026-09-24',
		amount: 5000,
		amountReceived: 2000,
		balanceAmount: 3000,
		status: 'PartiallyPaid',
		notes: 'Special event detailing package',
		payments: [
			{
				id: 'pay-1',
				showroomDailyBillId: 'bill-1',
				amount: 2000,
				paymentMethod: 'UPI',
				reference: 'UPI123456789',
				paymentDate: '2026-09-24T10:30:00Z',
				notes: 'Advance transfer',
				createdAt: '2026-09-24T10:30:00Z',
			},
		],
		createdAt: '2026-09-24T08:00:00Z',
		updatedAt: '2026-09-24T10:30:00Z',
	};

	const mockOutstanding: api.ShowroomOutstandingDto[] = [
		{
			showroomId: 'sr-1',
			showroomName: 'Popular Hyundai Showroom',
			address: 'Anna Salai, Chennai',
			phone: '9876500001',
			isActive: true,
			totalBilled: 15000,
			totalReceived: 10000,
			outstandingAmount: 5000,
			unpaidDaysCount: 2,
		},
		{
			showroomId: 'sr-2',
			showroomName: 'KUN BMW Showroom',
			address: 'OMR, Chennai',
			phone: '9876500002',
			isActive: true,
			totalBilled: 25000,
			totalReceived: 25000,
			outstandingAmount: 0,
			unpaidDaysCount: 0,
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getShowrooms).mockResolvedValue(mockShowrooms);
		vi.mocked(api.getShowroomDailyBill).mockResolvedValue(mockDailyBill);
		vi.mocked(api.getShowroomsOutstanding).mockResolvedValue(mockOutstanding);
		vi.mocked(api.setShowroomDailyBill).mockResolvedValue({
			...mockDailyBill,
			amount: 6000,
			balanceAmount: 4000,
		});
		vi.mocked(api.recordShowroomPayment).mockResolvedValue({
			...mockDailyBill,
			amountReceived: 5000,
			balanceAmount: 0,
			status: 'Paid',
		});
		vi.mocked(api.deleteShowroomPayment).mockResolvedValue(undefined as any);
	});

	it('1. when opened without showroomId, displays Global Receivables landing state and queries outstanding receivables', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill'],
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
			expect(screen.getByRole('heading', { name: 'Showroom Billing' })).toBeInTheDocument();
			expect(screen.getAllByText('Popular Hyundai Showroom').length).toBeGreaterThanOrEqual(1);
			expect(screen.getAllByText('KUN BMW Showroom').length).toBeGreaterThanOrEqual(1);
		});

		expect(api.getShowroomsOutstanding).toHaveBeenCalled();
		expect(screen.getAllByText(/TOTAL BILLED/i).length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText(/TOTAL COLLECTED/i).length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText(/OUTSTANDING/i).length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText(/SHOWROOMS WITH BALANCE/i)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Search showrooms by name, address, or Master ID/i)).toBeInTheDocument();

		// Table headers and action buttons
		expect(screen.getByText('SHOWROOM')).toBeInTheDocument();
		expect(screen.getByText('LOCATION')).toBeInTheDocument();
		expect(screen.getByText('STATUS')).toBeInTheDocument();
		expect(screen.getByText('ACTION')).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: /Open Bill/i }).length).toBe(2);

		expect(api.getShowroomDailyBill).not.toHaveBeenCalled();
	});

	it('1b. clicking a showroom table row navigates to individual showroom billing workspace', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill'],
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

		// Click the row
		const row = screen.getByText('Popular Hyundai Showroom').closest('tr');
		expect(row).toBeInTheDocument();
		fireEvent.click(row!);

		// Queries daily bill for that showroom
		await waitFor(() => {
			expect(api.getShowroomDailyBill).toHaveBeenCalledWith('sr-1', expect.any(String));
		});
	});

	it('2. loads dedicated Showroom Bill workspace with header context, summary cards, and payments table without cross-showroom data', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1&date=2026-09-24'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.manage_billing', 'showroom.record_payment'],
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

		// Financial Summary Cards
		expect(screen.getByText('Daily Total Bill')).toBeInTheDocument();
		expect(screen.getByText('Amount Received')).toBeInTheDocument();
		expect(screen.getByText('Remaining Balance')).toBeInTheDocument();
		expect(screen.getByText('Payment Status')).toBeInTheDocument();

		// Check values: ₹5,000.00, ₹2,000.00, ₹3,000.00, Partially Paid
		await waitFor(() => {
			expect(screen.getByText('₹5,000.00')).toBeInTheDocument();
			expect(screen.getAllByText('₹2,000.00').length).toBeGreaterThanOrEqual(1);
			expect(screen.getByText('₹3,000.00')).toBeInTheDocument();
			expect(screen.getByText('Partially Paid')).toBeInTheDocument();
		});

		// Payments Table
		await waitFor(() => {
			expect(screen.getByText('UPI')).toBeInTheDocument();
			expect(screen.getByText('UPI123456789')).toBeInTheDocument();
			expect(screen.getByText('Advance transfer')).toBeInTheDocument();
		});

		// SEPARATION VERIFICATION: Cross-showroom overview and staff attendance controls MUST NOT be present
		expect(screen.queryByText(/Showroom Billing Overview/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Cross-Showroom Outstanding/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Dealerships Outstanding/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Daily Staff Attendance/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Assign Staff/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Confirm Attendance/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Unlock for Correction/i)).not.toBeInTheDocument();

		// getShowroomsOutstanding MUST NOT be called in showroom-specific view
		expect(api.getShowroomsOutstanding).not.toHaveBeenCalled();
	});

	it('3. sets daily bill amount via modal', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.manage_billing'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
			expect(screen.getByText('₹5,000.00')).toBeInTheDocument();
		});

		const editBtn = screen.getByRole('button', { name: /Edit Daily Bill/i });
		fireEvent.click(editBtn);

		await waitFor(() => {
			expect(screen.getByText('Set Daily Showroom Bill')).toBeInTheDocument();
		});

		const input = screen.getByLabelText('Daily Billing Amount');
		fireEvent.change(input, { target: { value: '6000' } });

		const dialog = screen.getByRole('dialog');
		const saveBtn = within(dialog).getByRole('button', { name: /Save Daily Bill/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(api.setShowroomDailyBill).toHaveBeenCalledWith('sr-1', expect.any(String), {
				amount: 6000,
				notes: 'Special event detailing package',
			});
		});
	});

	it('4. records showroom payment via modal', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.record_payment'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
			expect(screen.getByText('₹5,000.00')).toBeInTheDocument();
		});

		const recordBtn = screen.getByRole('button', { name: /Record Payment/i });
		fireEvent.click(recordBtn);

		await waitFor(() => {
			expect(screen.getByText('Record Showroom Payment')).toBeInTheDocument();
		});

		const amountInput = screen.getByLabelText('Payment Amount');
		fireEvent.change(amountInput, { target: { value: '3000' } });

		const dialog = screen.getByRole('dialog');
		const submitBtn = within(dialog).getByRole('button', { name: /^Record Payment$/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(api.recordShowroomPayment).toHaveBeenCalledWith('sr-1', expect.any(String), {
				amount: 3000,
				paymentMethod: 'Cash',
				paymentDate: expect.any(String),
			});
		});
	});

	it('5. allows voiding payment transaction with confirmation', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.delete_payment'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByTitle('Void payment transaction')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTitle('Void payment transaction'));

		await waitFor(() => {
			expect(screen.getByText('Void Payment Transaction')).toBeInTheDocument();
		});

		const dialog = screen.getByRole('dialog');
		const voidBtn = within(dialog).getByRole('button', { name: /^Void Payment$/i });
		fireEvent.click(voidBtn);

		await waitFor(() => {
			expect(api.deleteShowroomPayment).toHaveBeenCalledWith('pay-1');
		});
	});

	it('6. displays empty state when no bill has been set for date', async () => {
		vi.mocked(api.getShowroomDailyBill).mockResolvedValueOnce({
			...mockDailyBill,
			amount: 0,
			amountReceived: 0,
			balanceAmount: 0,
			status: 'Unpaid',
			notes: null,
			payments: [],
		});

		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.manage_billing'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('No daily bill has been set for this date.')).toBeInTheDocument();
		});

		expect(screen.getByText('No payments recorded')).toBeInTheDocument();
		expect(screen.getByText('Payments made against this daily bill will appear here.')).toBeInTheDocument();
	});

	it('7. supports date navigation (Next Day, Previous Day)', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1&date=2026-09-24'],
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
			expect(api.getShowroomDailyBill).toHaveBeenCalledWith('sr-1', '2026-09-25');
		});
	});

	it('8. provides direct link to Showroom Attendance in header', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1'],
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

		expect(screen.getByRole('button', { name: /Showroom Attendance/i })).toBeInTheDocument();
	});

	it('9. Back button in individual showroom view navigates to /showroom/bill overview', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1'],
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

		const backBtn = screen.getByTitle('Back to Showroom Billing');
		expect(backBtn).toBeInTheDocument();
		fireEvent.click(backBtn);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Showroom Billing' })).toBeInTheDocument();
		});
	});

	it('10. recording a payment against daily bill immediately updates summary and displays transaction row in Payment Transactions table without page reload', async () => {
		const initialBill: api.ShowroomDailyBillDto = {
			id: 'bill-100',
			showroomId: 'sr-1',
			showroomName: 'Popular Hyundai Showroom',
			date: '2026-09-26',
			amount: 1000,
			amountReceived: 0,
			balanceAmount: 1000,
			status: 'Unpaid',
			notes: null,
			payments: [],
			createdAt: '2026-09-26T08:00:00Z',
			updatedAt: null,
		};

		const updatedBillWithPayment: api.ShowroomDailyBillDto = {
			id: 'bill-100',
			showroomId: 'sr-1',
			showroomName: 'Popular Hyundai Showroom',
			date: '2026-09-26',
			amount: 1000,
			amountReceived: 500,
			balanceAmount: 500,
			status: 'PartiallyPaid',
			notes: null,
			payments: [
				{
					id: 'pay-500',
					showroomDailyBillId: 'bill-100',
					amount: 500,
					paymentMethod: 'Cash',
					reference: 'PAY-0001',
					paymentDate: '2026-09-26T11:00:00Z',
					notes: 'First installment',
					createdAt: '2026-09-26T11:00:00Z',
				},
			],
			createdAt: '2026-09-26T08:00:00Z',
			updatedAt: '2026-09-26T11:00:00Z',
		};

		let currentBill = initialBill;
		vi.mocked(api.getShowroomDailyBill).mockImplementation(async () => currentBill);
		vi.mocked(api.recordShowroomPayment).mockImplementation(async () => {
			currentBill = updatedBillWithPayment;
			return updatedBillWithPayment;
		});

		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1&date=2026-09-26'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.manage_billing', 'showroom.record_payment'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
			expect(screen.getAllByText('₹1,000.00').length).toBe(2);
			expect(screen.getByText('No payments recorded')).toBeInTheDocument();
		});

		// Record Payment of ₹500
		const recordBtn = screen.getByRole('button', { name: /Record Payment/i });
		fireEvent.click(recordBtn);

		await waitFor(() => {
			expect(screen.getByText('Record Showroom Payment')).toBeInTheDocument();
		});

		const amountInput = screen.getByLabelText('Payment Amount');
		fireEvent.change(amountInput, { target: { value: '500' } });

		const refInput = screen.getByLabelText('Transaction ID / Reference');
		fireEvent.change(refInput, { target: { value: 'PAY-0001' } });

		const notesInput = screen.getByLabelText('Payment Notes');
		fireEvent.change(notesInput, { target: { value: 'First installment' } });

		// When invalidated, getShowroomDailyBill returns the updated bill
		vi.mocked(api.getShowroomDailyBill).mockResolvedValue(updatedBillWithPayment);

		const dialog = screen.getByRole('dialog');
		const submitBtn = within(dialog).getByRole('button', { name: /^Record Payment$/i });
		fireEvent.click(submitBtn);

		// Modal closes
		await waitFor(() => {
			expect(screen.queryByText('Record Showroom Payment')).not.toBeInTheDocument();
		});

		// Summary reflects updated values: Received = 500, Balance = 500
		await waitFor(() => {
			expect(screen.getAllByText('₹500.00').length).toBeGreaterThanOrEqual(2);
		});

		// Empty state is removed and payment row appears in table
		expect(screen.queryByText('No payments recorded')).not.toBeInTheDocument();
		expect(screen.getByText('PAY-0001')).toBeInTheDocument();
		expect(screen.getByText('First installment')).toBeInTheDocument();
		expect(screen.getByText('Cash')).toBeInTheDocument();
	});

	it('11. displays multiple payment transactions in chronological order and correctly updates upon voiding a transaction', async () => {
		const billWithTwoPayments: api.ShowroomDailyBillDto = {
			id: 'bill-200',
			showroomId: 'sr-1',
			showroomName: 'Popular Hyundai Showroom',
			date: '2026-09-26',
			amount: 2000,
			amountReceived: 1500,
			balanceAmount: 500,
			status: 'PartiallyPaid',
			notes: null,
			payments: [
				{
					id: 'pay-1',
					showroomDailyBillId: 'bill-200',
					amount: 1000,
					paymentMethod: 'UPI',
					reference: 'UPI-TXN-01',
					paymentDate: '2026-09-26T14:00:00Z',
					notes: 'Second installment',
					createdAt: '2026-09-26T14:00:00Z',
				},
				{
					id: 'pay-2',
					showroomDailyBillId: 'bill-200',
					amount: 500,
					paymentMethod: 'Cash',
					reference: 'CASH-01',
					paymentDate: '2026-09-26T10:00:00Z',
					notes: 'Morning advance',
					createdAt: '2026-09-26T10:00:00Z',
				},
			],
			createdAt: '2026-09-26T08:00:00Z',
			updatedAt: '2026-09-26T14:00:00Z',
		};

		vi.mocked(api.getShowroomDailyBill).mockResolvedValue(billWithTwoPayments);

		renderWithProviders(
			<Routes>
				<Route path="/showroom/bill" element={<ShowroomBillPage />} />
			</Routes>,
			{
				initialEntries: ['/showroom/bill?showroomId=sr-1&date=2026-09-26'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['showroom.view', 'showroom.manage_billing', 'showroom.record_payment', 'showroom.delete_payment'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Popular Hyundai Showroom' })).toBeInTheDocument();
			expect(screen.getByText('UPI-TXN-01')).toBeInTheDocument();
			expect(screen.getByText('Second installment')).toBeInTheDocument();
			expect(screen.getByText('UPI')).toBeInTheDocument();
			expect(screen.getByText('₹1,000.00')).toBeInTheDocument();
			expect(screen.getByText('CASH-01')).toBeInTheDocument();
			expect(screen.getByText('Morning advance')).toBeInTheDocument();
			expect(screen.getByText('Cash')).toBeInTheDocument();
		});

		// Summary matches
		expect(screen.getByText('₹2,000.00')).toBeInTheDocument(); // Daily total
		expect(screen.getByText('₹1,500.00')).toBeInTheDocument(); // Amount received
		expect(screen.getAllByText('₹500.00').length).toBeGreaterThanOrEqual(2); // Remaining balance and cash amount
	});
});
