import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ReportsPage } from './ReportsPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';
import * as XLSX from 'xlsx';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getInvoices: vi.fn(),
		getJobCards: vi.fn(),
		getStaffAdvances: vi.fn(),
	};
});

vi.mock('xlsx', () => ({
	utils: {
		aoa_to_sheet: vi.fn(() => ({})),
		book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
		book_append_sheet: vi.fn(),
	},
	writeFile: vi.fn(),
}));

vi.mock('recharts', () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
	Area: () => null,
	PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
	Pie: () => null,
	Cell: () => null,
	XAxis: () => null,
	YAxis: () => null,
	CartesianGrid: () => null,
	Tooltip: () => null,
}));

describe('ReportsPage Component', () => {
	const todayIso = new Date().toISOString();

	const mockInvoices: api.InvoiceListResponse = {
		items: [
			{
				id: 'inv-1',
				invoiceNumber: 'INV-2026-0001',
				jobCardNumber: 'JC-2026-0001',
				customerName: 'Gokul Sharma',
				customerPhone: '9876543210',
				registrationNumber: 'TN01AB1234',
				vehicle: 'Hyundai Creta',
				invoiceDate: todayIso,
				totalAmount: 5000,
				paidAmount: 4000,
				balanceAmount: 1000,
				status: 'Generated',
				createdAt: todayIso,
			},
			{
				id: 'inv-2',
				invoiceNumber: 'INV-2026-0002',
				jobCardNumber: 'JC-2026-0002',
				customerName: 'Ravi Kumar',
				customerPhone: '9988776655',
				registrationNumber: 'TN02CD5678',
				vehicle: 'Honda City',
				invoiceDate: todayIso,
				totalAmount: 3000,
				paidAmount: 3000,
				balanceAmount: 0,
				status: 'Paid',
				createdAt: todayIso,
			},
		],
		totalCount: 2,
		page: 1,
		pageSize: 1000,
	};

	const mockJobCards: { items: api.JobCardListDto[]; totalCount: number } = {
		items: [
			{
				id: 'jc-1',
				jobCardNumber: 'JC-2026-0001',
				customerName: 'Gokul Sharma',
				customerPhone: '9876543210',
				registrationNumber: 'TN01AB1234',
				make: 'Hyundai',
				model: 'Creta',
				status: 4, // Invoiced / Completed
				totalAmount: 5000,
				createdAt: todayIso,
				invoiceId: 'inv-1',
				invoiceNumber: 'INV-2026-0001',
				invoiceStatus: 'Generated',
			},
			{
				id: 'jc-2',
				jobCardNumber: 'JC-2026-0002',
				customerName: 'Ravi Kumar',
				customerPhone: '9988776655',
				registrationNumber: 'TN02CD5678',
				make: 'Honda',
				model: 'City',
				status: 5, // Paid / Completed
				totalAmount: 3000,
				createdAt: todayIso,
				invoiceId: 'inv-2',
				invoiceNumber: 'INV-2026-0002',
				invoiceStatus: 'Paid',
			},
		],
		totalCount: 2,
	};

	const mockAdvances: api.StaffAdvanceListResponse = {
		items: [
			{
				id: 'adv-1',
				staffId: 'staff-1',
				staffName: 'Murugan',
				staffRole: 'Technician',
				staffPhone: '9876500000',
				amount: 2500,
				advanceDate: todayIso,
				status: 'Outstanding',
				reason: 'Festival Advance',
				notes: null,
				settledAt: null,
				settledByUserId: null,
				createdAt: todayIso,
			},
		],
		totalCount: 1,
		page: 1,
		pageSize: 1000,
		summary: {
			outstandingCount: 1,
			outstandingAmount: 2500,
			settledCount: 0,
			settledAmount: 0,
			totalActiveCount: 1,
			totalActiveAmount: 2500,
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getInvoices).mockResolvedValue(mockInvoices);
		vi.mocked(api.getJobCards).mockResolvedValue(mockJobCards);
		vi.mocked(api.getStaffAdvances).mockResolvedValue(mockAdvances);
	});

	it('renders Reports page header and executive KPI summary cards', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getAllByText('₹8,000.00').length).toBeGreaterThan(0);
			expect(screen.getAllByText('₹7,000.00').length).toBeGreaterThan(0);
			expect(screen.getAllByText('₹1,000.00').length).toBeGreaterThan(0);
		});

		expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
		expect(screen.getAllByText('Billed Revenue').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Collections Received').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Outstanding Balance').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Job Cards Completed').length).toBeGreaterThan(0);
	});



	it('supports switching date presets (e.g. 7D, 30D, This Month, YTD)', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^7D$/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /^7D$/i }));

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^This Month$/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /^This Month$/i }));
		expect(api.getInvoices).toHaveBeenCalled();
	});

	it('triggers Excel export via SheetJS when Export Excel button is clicked', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /export excel/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /export excel/i }));

		await waitFor(() => {
			expect(XLSX.writeFile).toHaveBeenCalled();
		});
	});

	it('renders tables with staff advances log and top performing services', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/reports" element={<ReportsPage />} />
			</Routes>,
			{ initialEntries: ['/reports'] }
		);

		await waitFor(() => {
			expect(screen.getByText('Top Revenue Services')).toBeInTheDocument();
			expect(screen.getByText('Staff Advances Log')).toBeInTheDocument();
			expect(screen.getByText('Murugan')).toBeInTheDocument();
			expect(screen.getByText('Festival Advance')).toBeInTheDocument();
			expect(screen.getByText('₹2,500.00')).toBeInTheDocument();
		});
	});
});
