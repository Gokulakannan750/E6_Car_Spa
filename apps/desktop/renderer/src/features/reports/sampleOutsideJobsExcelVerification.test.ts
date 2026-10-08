import { describe, it, expect, beforeEach } from 'vitest';
import { seedCompanyProfile } from '../../test/seedCompanyProfile';
import {
	createOutsideJobsWorkbook,
	ROW_HEIGHTS,
} from './excelOutsideJobsGenerator';
import type { OutsideJobsReportDto } from '../../lib/api';
import ExcelJS from 'exceljs';

beforeEach(() => {
	seedCompanyProfile();
});

describe('Sample Outside Jobs Excel Verification (ExcelJS)', () => {
	it('generates a real 4-sheet Excel file and verifies professional formatting integrity', async () => {
		const sampleData: OutsideJobsReportDto = {
			currentlyOutside: [
				{
					id: 'oj-active-1',
					jobCardId: 'jc-01',
					jobCardNumber: 'JC-2026-0801',
					vehicleId: 'veh-01',
					vehicleRegistration: 'TN 33 AA 9999',
					vehicleModel: 'Toyota Fortuner GR-S',
					customerId: 'cust-01',
					customerName: 'Karthik Raja',
					customerPhone: '9876543210',
					vendorId: 'ven-01',
					vendorName: 'Apex Aligners & Wheel Balancing',
					vendorPhone: '9876500001',
					serviceName: 'Laser Alignment & Road Force Balance',
					sentAt: '2026-10-01T09:30:00Z',
					expectedReturnAt: '2026-10-01T13:00:00Z',
					isOverdue: true,
					overdueHours: 3.5,
					vendorCost: 1800,
					notes: 'High speed steering vibration check',
				},
				{
					id: 'oj-active-2',
					jobCardId: 'jc-02',
					jobCardNumber: 'JC-2026-0805',
					vehicleId: 'veh-02',
					vehicleRegistration: 'TN 33 BB 8888',
					vehicleModel: 'BMW 530d M Sport',
					customerId: 'cust-02',
					customerName: 'Anand Kumar',
					customerPhone: '9876543211',
					vendorId: 'ven-02',
					vendorName: 'Royal Denting & Painting Works',
					vendorPhone: '9876500002',
					serviceName: 'Left Rear Door Paintless Dent Removal',
					sentAt: '2026-10-02T10:00:00Z',
					expectedReturnAt: '2026-10-02T18:00:00Z',
					isOverdue: false,
					overdueHours: 0,
					vendorCost: 4500,
					notes: 'Maintain factory paint warranty',
				},
			],
			history: [
				{
					id: 'oj-hist-1',
					jobCardId: 'jc-10',
					jobCardNumber: 'JC-2026-0750',
					vehicleId: 'veh-10',
					vehicleRegistration: 'TN 38 CC 7777',
					vehicleModel: 'Mercedes-Benz E220d',
					customerId: 'cust-10',
					customerName: 'Dr. Subramanian',
					customerPhone: '9876543220',
					vendorId: 'ven-01',
					vendorName: 'Apex Aligners & Wheel Balancing',
					serviceName: 'Complete 3D Computer Alignment',
					status: 2,
					statusName: 'Returned',
					sentAt: '2026-09-25T09:00:00Z',
					returnedAt: '2026-09-25T12:45:00Z',
					expectedReturnAt: '2026-09-25T13:00:00Z',
					durationHours: 3.75,
					vendorCost: 1500,
					sentByUserName: 'Ramesh (Supervisor)',
					returnedByUserName: 'Ramesh (Supervisor)',
					notes: 'After suspension bushing replacement',
					returnNotes: 'Alignment report attached to job card',
				},
				{
					id: 'oj-hist-2',
					jobCardId: 'jc-11',
					jobCardNumber: 'JC-2026-0760',
					vehicleId: 'veh-11',
					vehicleRegistration: 'TN 33 DD 6666',
					vehicleModel: 'Audi Q7 55 TFSI',
					customerId: 'cust-11',
					customerName: 'Vikram Seth',
					customerPhone: '9876543221',
					vendorId: 'ven-02',
					vendorName: 'Royal Denting & Painting Works',
					serviceName: 'Front Bumper Dual Tone Paint Refinish',
					status: 2,
					statusName: 'Returned',
					sentAt: '2026-09-26T10:00:00Z',
					returnedAt: '2026-09-28T15:00:00Z',
					expectedReturnAt: '2026-09-28T14:00:00Z',
					durationHours: 53.0,
					vendorCost: 7500,
					sentByUserName: 'Kumar (Manager)',
					returnedByUserName: 'Kumar (Manager)',
					notes: 'Mythos Black metallic shade match',
					returnNotes: 'Oven baked finish, paint meter reading 110 microns',
				},
				{
					id: 'oj-hist-3',
					jobCardId: 'jc-12',
					jobCardNumber: 'JC-2026-0770',
					vehicleId: 'veh-12',
					vehicleRegistration: 'TN 33 EE 5555',
					vehicleModel: 'Tata Safari Dark Edition',
					customerId: 'cust-12',
					customerName: 'Meenakshi Sundaram',
					customerPhone: '9876543222',
					vendorId: 'ven-03',
					vendorName: 'Precision Windshield & Glass',
					serviceName: 'Front Windshield OEM Replacement',
					status: 3,
					statusName: 'Cancelled',
					sentAt: '2026-09-29T11:00:00Z',
					returnedAt: null,
					expectedReturnAt: '2026-09-29T16:00:00Z',
					durationHours: null,
					vendorCost: 0,
					sentByUserName: 'Kumar (Manager)',
					returnedByUserName: null,
					notes: 'Insurance claim cancelled by client',
					returnNotes: 'Vehicle retained in spa bay',
				},
			],
			vendorSummary: [
				{
					vendorId: 'ven-01',
					vendorName: 'Apex Aligners & Wheel Balancing',
					phone: '9876500001',
					totalJobs: 2,
					completedJobs: 1,
					currentlyOutside: 1,
					overdueJobs: 1,
					cancelledJobs: 0,
					totalVendorCost: 3300,
				},
				{
					vendorId: 'ven-02',
					vendorName: 'Royal Denting & Painting Works',
					phone: '9876500002',
					totalJobs: 2,
					completedJobs: 1,
					currentlyOutside: 1,
					overdueJobs: 0,
					cancelledJobs: 0,
					totalVendorCost: 12000,
				},
				{
					vendorId: 'ven-03',
					vendorName: 'Precision Windshield & Glass',
					phone: '9876500003',
					totalJobs: 1,
					completedJobs: 0,
					currentlyOutside: 0,
					overdueJobs: 0,
					cancelledJobs: 1,
					totalVendorCost: 0,
				},
			],
			totalOutsideCount: 2,
			totalOverdueCount: 1,
			totalActiveCost: 6300,
			totalHistoricalCost: 9000,
		};

		const workbook = createOutsideJobsWorkbook(sampleData, 'October 2026');

		// Verify 4 Worksheets
		expect(workbook.worksheets.length).toBe(4);
		const sheetNames = workbook.worksheets.map(w => w.name);
		expect(sheetNames).toEqual([
			'Executive Summary',
			'Currently Outside',
			'Movement History',
			'Vendor Analysis',
		]);

		// 1. Executive Summary Verification
		const wsSummary = workbook.getWorksheet('Executive Summary')!;
		expect(wsSummary).toBeDefined();
		expect(wsSummary.getRow(1).height).toBe(ROW_HEIGHTS.TITLE);
		expect(wsSummary.getRow(2).height).toBe(ROW_HEIGHTS.SUBTITLE);
		expect(wsSummary.getCell('A1').value).toContain('SUNRISE DETAILING');
		expect(wsSummary.views[0].state).toBe('frozen');

		// 2. Currently Outside Verification
		const wsActive = workbook.getWorksheet('Currently Outside')!;
		expect(wsActive).toBeDefined();
		expect(wsActive.getRow(4).height).toBe(ROW_HEIGHTS.TABLE_HEADER);
		expect(wsActive.getRow(5).height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(wsActive.getRow(6).height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(wsActive.getRow(7).height).toBe(ROW_HEIGHTS.TOTAL_ROW);

		// Check Statuses
		expect(wsActive.getCell('B5').value).toBe('OVERDUE');
		expect(wsActive.getCell('B6').value).toBe('Outside');

		// 3. Movement History Verification
		const wsHist = workbook.getWorksheet('Movement History')!;
		expect(wsHist).toBeDefined();
		expect(wsHist.getRow(4).height).toBe(ROW_HEIGHTS.TABLE_HEADER);
		expect(wsHist.getRow(5).height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(wsHist.getRow(6).height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(wsHist.getRow(7).height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(wsHist.getRow(8).height).toBe(ROW_HEIGHTS.TOTAL_ROW);

		// Check Cost Types
		expect(wsHist.getCell('L5').value).toBe('Final Cost');
		expect(wsHist.getCell('L6').value).toBe('Final Cost');
		expect(wsHist.getCell('L7').value).toBe('—');

		// 4. Vendor Analysis Verification
		const wsVendor = workbook.getWorksheet('Vendor Analysis')!;
		expect(wsVendor).toBeDefined();
		expect(wsVendor.getRow(4).height).toBe(ROW_HEIGHTS.TABLE_HEADER);
		expect(wsVendor.getRow(5).height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(wsVendor.getRow(6).height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(wsVendor.getRow(7).height).toBe(ROW_HEIGHTS.DATA_ROW);
		expect(wsVendor.getRow(8).height).toBe(ROW_HEIGHTS.TOTAL_ROW);

		// Write to temporary buffer and verify file integrity
		const buffer = await workbook.xlsx.writeBuffer();
		expect(buffer.byteLength).toBeGreaterThan(5000);

		// Read back with ExcelJS to ensure file is completely valid and parseable
		const readBackWb = new ExcelJS.Workbook();
		// Convert buffer to Uint8Array for ExcelJS compatibility
		const uint8Array = new Uint8Array(buffer as ArrayBuffer);
		await readBackWb.xlsx.load(uint8Array as any);
		expect(readBackWb.worksheets.length).toBe(4);
	});
});
