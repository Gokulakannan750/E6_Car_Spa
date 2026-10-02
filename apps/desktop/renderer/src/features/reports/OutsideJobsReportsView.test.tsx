import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { OutsideJobsReportsView } from './OutsideJobsReportsView';
import * as api from '../../lib/api';
import * as excelGen from './excelOutsideJobsGenerator';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getOutsideJobsReport: vi.fn(),
	};
});

vi.mock('./excelOutsideJobsGenerator', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./excelOutsideJobsGenerator')>();
	return {
		...actual,
		generateOutsideJobsExcel: vi.fn(),
	};
});

describe('OutsideJobsReportsView Component', () => {
	const mockReportData: api.OutsideJobsReportDto = {
		currentlyOutside: [
			{
				id: 'out-1',
				jobCardId: 'jc-1',
				jobCardNumber: 'JC-2026-1001',
				vehicleId: 'veh-1',
				vehicleRegistration: 'TN 33 AA 1111',
				vehicleModel: 'Toyota Innova Crysta',
				customerId: 'cust-1',
				customerName: 'Suresh Kumar',
				customerPhone: '9876543210',
				vendorId: 'ven-1',
				vendorName: 'Apex Aligners & Wheels',
				vendorPhone: '9876500001',
				serviceName: 'Wheel Alignment & Balancing',
				sentAt: '2026-10-01T09:00:00Z',
				expectedReturnAt: '2026-10-01T14:00:00Z',
				isOverdue: true,
				overdueHours: 4.5,
				vendorCost: 1500,
				notes: 'Check rear wheel camber',
			},
		],
		history: [
			{
				id: 'hist-1',
				jobCardId: 'jc-10',
				jobCardNumber: 'JC-2026-0980',
				vehicleId: 'veh-10',
				vehicleRegistration: 'TN 38 CC 3333',
				vehicleModel: 'Hyundai Creta',
				customerId: 'cust-10',
				customerName: 'Manoj Kumar',
				customerPhone: '9876543220',
				vendorId: 'ven-1',
				vendorName: 'Apex Aligners & Wheels',
				serviceName: 'Front Wheel Alignment',
				status: 2,
				statusName: 'Returned',
				sentAt: '2026-09-28T09:00:00Z',
				returnedAt: '2026-09-28T13:30:00Z',
				expectedReturnAt: '2026-09-28T14:00:00Z',
				durationHours: 4.5,
				vendorCost: 1200,
				sentByUserName: 'Ramesh (Supervisor)',
				returnedByUserName: 'Ramesh (Supervisor)',
				notes: 'Routine alignment',
				returnNotes: 'Alignment verified and test driven',
			},
		],
		vendorSummary: [
			{
				vendorId: 'ven-1',
				vendorName: 'Apex Aligners & Wheels',
				phone: '9876500001',
				totalJobs: 2,
				completedJobs: 1,
				currentlyOutside: 1,
				overdueJobs: 1,
				cancelledJobs: 0,
				totalVendorCost: 2700,
			},
		],
		totalOutsideCount: 1,
		totalOverdueCount: 1,
		totalActiveCost: 1500,
		totalHistoricalCost: 1200,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getOutsideJobsReport).mockResolvedValue(mockReportData);
	});

	it('renders header, KPI summary cards, and Currently Outside table', async () => {
		renderWithProviders(
			<OutsideJobsReportsView
				bounds={{
					startStr: '2026-10-01',
					endStr: '2026-10-31',
					label: 'This Month',
				}}
				formatINR={(val) => `₹${(val ?? 0).toLocaleString('en-IN')}`}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Outside Jobs & External Movements')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /export outside jobs excel/i })).toBeInTheDocument();
			expect(screen.getByText('TN 33 AA 1111')).toBeInTheDocument();
			expect(screen.getByText('Toyota Innova Crysta')).toBeInTheDocument();
			expect(screen.getByText('Apex Aligners & Wheels')).toBeInTheDocument();
			expect(screen.getByText('JC-2026-1001')).toBeInTheDocument();
			expect(screen.getByText('Overdue')).toBeInTheDocument();
		});
	});

	it('switches to Movement History sub-tab and displays historical movements', async () => {
		renderWithProviders(
			<OutsideJobsReportsView
				bounds={{
					startStr: '2026-10-01',
					endStr: '2026-10-31',
					label: 'This Month',
				}}
				formatINR={(val) => `₹${(val ?? 0).toLocaleString('en-IN')}`}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('TN 33 AA 1111')).toBeInTheDocument();
		});

		const historyBtn = screen.getByText(/Movement History/i).closest('button');
		expect(historyBtn).not.toBeNull();
		fireEvent.click(historyBtn!);

		await waitFor(() => {
			expect(screen.getByText('TN 38 CC 3333')).toBeInTheDocument();
			expect(screen.getByText('JC-2026-0980')).toBeInTheDocument();
			expect(screen.getByText('Front Wheel Alignment')).toBeInTheDocument();
			expect(screen.getAllByText('Returned').length).toBeGreaterThanOrEqual(1);
		});
	});

	it('switches to Vendor Summary sub-tab and displays vendor statistics', async () => {
		renderWithProviders(
			<OutsideJobsReportsView
				bounds={{
					startStr: '2026-10-01',
					endStr: '2026-10-31',
					label: 'This Month',
				}}
				formatINR={(val) => `₹${(val ?? 0).toLocaleString('en-IN')}`}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('TN 33 AA 1111')).toBeInTheDocument();
		});

		const vendorBtn = screen.getByText(/Vendor Summary/i).closest('button');
		expect(vendorBtn).not.toBeNull();
		fireEvent.click(vendorBtn!);

		await waitFor(() => {
			expect(screen.getByText('Vendor Name')).toBeInTheDocument();
			expect(screen.getByText('Apex Aligners & Wheels')).toBeInTheDocument();
		});
	});

	it('triggers Excel export generator when clicking Export Outside Jobs Excel button', async () => {
		renderWithProviders(
			<OutsideJobsReportsView
				bounds={{
					startStr: '2026-10-01',
					endStr: '2026-10-31',
					label: 'This Month',
				}}
				formatINR={(val) => `₹${(val ?? 0).toLocaleString('en-IN')}`}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('TN 33 AA 1111')).toBeInTheDocument();
		});

		const exportBtn = screen.getByRole('button', { name: /export outside jobs excel/i });
		fireEvent.click(exportBtn);

		expect(excelGen.generateOutsideJobsExcel).toHaveBeenCalledWith(
			mockReportData,
			'This Month'
		);
	});
});
