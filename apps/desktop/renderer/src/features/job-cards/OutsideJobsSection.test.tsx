import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { OutsideJobsSection } from './OutsideJobsSection';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getOutsideJobsByJobCardId: vi.fn(),
		getVendors: vi.fn(),
		getStaffList: vi.fn(),
		createOutsideJob: vi.fn(),
		markOutsideJobReturned: vi.fn(),
		cancelOutsideJob: vi.fn(),
		createVendor: vi.fn(),
		updateOutsideJobCost: vi.fn(),
		deleteOutsideJob: vi.fn(),
	};
});

describe('OutsideJobsSection Component', () => {
	const mockVendors: api.VendorDto[] = [
		{
			id: 'ven-1',
			name: 'Sri Lakshmi Auto Works',
			contactPerson: 'Lakshman',
			phone: '9845012345',
			serviceSpecialty: 'Denting, Painting, Body Shop',
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
		},
		{
			id: 'ven-2',
			name: 'Speedy Windshield Specialists',
			contactPerson: 'John',
			phone: '9845054321',
			serviceSpecialty: 'Glass replacement, Tinting',
			isActive: true,
			createdAt: '2026-01-01T00:00:00Z',
		},
	];

	const mockStaffList = [
		{ id: 'staff-1', name: 'Karthik Raja', phoneNumber: '9876543210', role: 'Floor Manager', isActive: true },
		{ id: 'staff-2', name: 'Suresh Kumar', phoneNumber: '9876543211', role: 'Detailer', isActive: true },
	];

	const renderComponent = (jobCardId: string = 'jc-101') =>
		renderWithProviders(
			<OutsideJobsSection
				jobCardId={jobCardId}
				vehicleRegistration="KA01MJ9999"
				vehicleModel="Honda City"
			/>
		);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getVendors).mockResolvedValue(mockVendors);
		vi.mocked(api.getStaffList).mockResolvedValue(mockStaffList as any);
		vi.mocked(api.getOutsideJobsByJobCardId).mockResolvedValue([]);
	});

	it('renders Outside Jobs section with Add Outside Job button and empty state', async () => {
		renderComponent('jc-test-1');

		await waitFor(() => {
			expect(screen.getByTestId('outside-jobs-section')).toBeInTheDocument();
			expect(screen.getByTestId('btn-add-outside-job')).toBeInTheDocument();
			expect(screen.getByText(/No external jobs recorded for this vehicle/i)).toBeInTheDocument();
			expect(screen.getByTestId('location-badge-showroom')).toBeInTheDocument();
		});
	});

	it('opens Send Vehicle Outside modal and populates vendor list', async () => {
		renderComponent('jc-test-2');

		await waitFor(() => {
			expect(screen.getByTestId('btn-add-outside-job')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('btn-add-outside-job'));

		expect(screen.getByTestId('modal-send-outside')).toBeInTheDocument();
		expect(screen.getByTestId('input-service-name')).toBeInTheDocument();
		expect(screen.getByTestId('select-vendor')).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText(/Sri Lakshmi Auto Works/i)).toBeInTheDocument();
			expect(screen.getByText(/Speedy Windshield Specialists/i)).toBeInTheDocument();
		});
	});

	it('validates required fields when sending vehicle outside', async () => {
		renderComponent('jc-test-3');

		await waitFor(() => {
			expect(screen.getByTestId('btn-add-outside-job')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('btn-add-outside-job'));

		const form = screen.getByTestId('btn-submit-send-outside').closest('form')!;
		fireEvent.submit(form);

		await waitFor(() => {
			expect(screen.getByText(/Outside service is required/i)).toBeInTheDocument();
			expect(api.createOutsideJob).not.toHaveBeenCalled();
		});
	});

	it('successfully sends vehicle outside and calls createOutsideJob API with Owner', async () => {
		const createdJob: api.OutsideJobDto = {
			id: 'oj-1',
			jobCardId: 'jc-test-4',
			jobCardNumber: 'JC-2026-0104',
			vehicleId: 'veh-1',
			vehicleRegistrationNumber: 'KA01MJ9999',
			vehicleMake: 'Honda',
			vehicleModel: 'City',
			customerId: 'cust-1',
			customerName: 'Rahul Sharma',
			customerPhone: '9876543210',
			vendorId: 'ven-1',
			vendorName: 'Sri Lakshmi Auto Works',
			serviceName: 'Denting & Painting',
			status: 1, // Outside
			statusName: 'Outside',
			sentAt: '2026-09-29T10:00:00Z',
			expectedReturnAt: '2026-09-30T17:00:00Z',
			vendorCost: null,
			isOverdue: false,
			createdAt: '2026-09-29T10:00:00Z',
		};

		vi.mocked(api.createOutsideJob).mockResolvedValue(createdJob);

		renderComponent('jc-test-4');

		await waitFor(() => {
			expect(screen.getByTestId('btn-add-outside-job')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('btn-add-outside-job'));

		const serviceInput = screen.getByTestId('input-service-name');
		fireEvent.change(serviceInput, { target: { value: 'Denting & Painting' } });

		const vendorSelect = screen.getByTestId('select-vendor');
		fireEvent.change(vendorSelect, { target: { value: 'ven-1' } });

		const form = screen.getByTestId('btn-submit-send-outside').closest('form')!;
		fireEvent.submit(form);

		await waitFor(() => {
			expect(api.createOutsideJob).toHaveBeenCalledWith(
				'jc-test-4',
				expect.objectContaining({
					vendorId: 'ven-1',
					serviceName: 'Denting & Painting',
					sentByType: 'Owner',
				})
			);
		});
	});

	it('supports selecting Staff and specific staff member when sending outside', async () => {
		const createdJob: api.OutsideJobDto = {
			id: 'oj-staff-1',
			jobCardId: 'jc-test-4b',
			jobCardNumber: 'JC-2026-0104B',
			vehicleId: 'veh-1',
			vehicleRegistrationNumber: 'KA01MJ9999',
			vehicleMake: 'Honda',
			vehicleModel: 'City',
			customerId: 'cust-1',
			customerName: 'Rahul Sharma',
			customerPhone: '9876543210',
			vendorId: 'ven-1',
			vendorName: 'Sri Lakshmi Auto Works',
			serviceName: 'Wheel Alignment',
			status: 1,
			statusName: 'Outside',
			sentAt: '2026-09-29T10:00:00Z',
			expectedReturnAt: '2026-09-30T17:00:00Z',
			vendorCost: null,
			isOverdue: false,
			createdAt: '2026-09-29T10:00:00Z',
		};

		vi.mocked(api.createOutsideJob).mockResolvedValue(createdJob);

		renderComponent('jc-test-4b');

		await waitFor(() => {
			expect(screen.getByTestId('btn-add-outside-job')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('btn-add-outside-job'));

		fireEvent.change(screen.getByTestId('input-service-name'), { target: { value: 'Wheel Alignment' } });
		fireEvent.change(screen.getByTestId('select-vendor'), { target: { value: 'ven-1' } });

		// Click Staff button
		fireEvent.click(screen.getByTestId('btn-sentby-staff'));

		// Select Staff Member
		await waitFor(() => {
			expect(screen.getByTestId('select-sent-by-staff')).toBeInTheDocument();
		});
		fireEvent.change(screen.getByTestId('select-sent-by-staff'), { target: { value: 'staff-1' } });

		const form = screen.getByTestId('btn-submit-send-outside').closest('form')!;
		fireEvent.submit(form);

		await waitFor(() => {
			expect(api.createOutsideJob).toHaveBeenCalledWith(
				'jc-test-4b',
				expect.objectContaining({
					vendorId: 'ven-1',
					serviceName: 'Wheel Alignment',
					sentByType: 'Staff',
					sentByStaffId: 'staff-1',
					sentByStaffName: 'Karthik Raja',
				})
			);
		});
	});

	it('renders active OUTSIDE job card with location indicator and Mark Vehicle Returned button', async () => {
		const activeJob: api.OutsideJobDto = {
			id: 'oj-active-1',
			jobCardId: 'jc-test-5',
			jobCardNumber: 'JC-2026-0105',
			vehicleId: 'veh-1',
			vehicleRegistrationNumber: 'KA01MJ9999',
			vehicleMake: 'Honda',
			vehicleModel: 'City',
			customerId: 'cust-1',
			customerName: 'Rahul Sharma',
			customerPhone: '9876543210',
			vendorId: 'ven-1',
			vendorName: 'Sri Lakshmi Auto Works',
			serviceName: 'Denting & Painting',
			status: 1, // Outside
			statusName: 'Outside',
			sentAt: '2026-09-29T10:00:00Z',
			expectedReturnAt: '2026-09-30T17:00:00Z',
			vendorCost: 4500,
			isOverdue: false,
			createdAt: '2026-09-29T10:00:00Z',
		};

		vi.mocked(api.getOutsideJobsByJobCardId).mockResolvedValue([activeJob]);

		renderComponent('jc-test-5');

		await waitFor(() => {
			expect(screen.getByTestId('location-badge-outside')).toBeInTheDocument();
			expect(screen.getByTestId('active-outside-job-card')).toBeInTheDocument();
			expect(screen.getByText(/Sri Lakshmi Auto Works/i)).toBeInTheDocument();
			expect(screen.getByText(/Denting & Painting/i)).toBeInTheDocument();
			expect(screen.getByTestId('btn-mark-returned')).toBeInTheDocument();
		});
	});

	it('displays OVERDUE badge when outside job is past expected return', async () => {
		const overdueJob: api.OutsideJobDto = {
			id: 'oj-overdue-1',
			jobCardId: 'jc-test-6',
			jobCardNumber: 'JC-2026-0106',
			vehicleId: 'veh-1',
			vehicleRegistrationNumber: 'KA01MJ9999',
			vehicleMake: 'Honda',
			vehicleModel: 'City',
			customerId: 'cust-1',
			customerName: 'Rahul Sharma',
			customerPhone: '9876543210',
			vendorId: 'ven-1',
			vendorName: 'Sri Lakshmi Auto Works',
			serviceName: 'Body Painting',
			status: 1,
			statusName: 'Outside',
			sentAt: '2026-09-25T10:00:00Z',
			expectedReturnAt: '2026-09-26T10:00:00Z',
			isOverdue: true,
			createdAt: '2026-09-25T10:00:00Z',
		};

		vi.mocked(api.getOutsideJobsByJobCardId).mockResolvedValue([overdueJob]);

		renderComponent('jc-test-6');

		await waitFor(() => {
			expect(screen.getByTestId('badge-overdue')).toBeInTheDocument();
			expect(screen.getByText(/OVERDUE/i)).toBeInTheDocument();
		});
	});

	it('opens Mark Vehicle Returned modal with simplified fields and submits', async () => {
		const activeJob: api.OutsideJobDto = {
			id: 'oj-active-1',
			jobCardId: 'jc-test-7',
			jobCardNumber: 'JC-2026-0107',
			vehicleId: 'veh-1',
			vehicleRegistrationNumber: 'KA01MJ9999',
			vehicleMake: 'Honda',
			vehicleModel: 'City',
			customerId: 'cust-1',
			customerName: 'Rahul Sharma',
			customerPhone: '9876543210',
			vendorId: 'ven-1',
			vendorName: 'Sri Lakshmi Auto Works',
			serviceName: 'Denting & Painting',
			status: 1,
			statusName: 'Outside',
			sentAt: '2026-09-29T10:00:00Z',
			expectedReturnAt: '2026-09-30T17:00:00Z',
			isOverdue: false,
			createdAt: '2026-09-29T10:00:00Z',
		};

		vi.mocked(api.getOutsideJobsByJobCardId).mockResolvedValue([activeJob]);
		vi.mocked(api.markOutsideJobReturned).mockResolvedValue({
			...activeJob,
			status: 2,
			statusName: 'Returned',
			returnedAt: '2026-09-30T16:00:00Z',
		});

		renderComponent('jc-test-7');

		await waitFor(() => {
			expect(screen.getByTestId('btn-mark-returned')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('btn-mark-returned'));

		const modal = screen.getByTestId('modal-mark-returned');
		expect(modal).toBeInTheDocument();

		// Verify only the required 3 fields are present:
		expect(within(modal).getByText(/Returned Date & Time/i)).toBeInTheDocument();
		expect(within(modal).getByText(/Final Vendor Cost/i)).toBeInTheDocument();
		expect(within(modal).getByText(/Inspection \/ Return Notes/i)).toBeInTheDocument();

		// Verify "Received By / Inspected By" is completely removed:
		expect(within(modal).queryByText(/Received By/i)).not.toBeInTheDocument();
		expect(within(modal).queryByText(/Inspected By/i)).not.toBeInTheDocument();
		expect(within(modal).queryByTestId('input-received-by-staff')).not.toBeInTheDocument();

		// Enter optional final cost and inspection notes
		fireEvent.change(within(modal).getByTestId('input-final-cost'), { target: { value: '4500' } });
		fireEvent.change(within(modal).getByTestId('input-return-notes'), { target: { value: 'Denting complete, finish ok' } });

		const confirmBtn = screen.getByTestId('btn-confirm-return');
		fireEvent.click(confirmBtn);

		await waitFor(() => {
			expect(api.markOutsideJobReturned).toHaveBeenCalledWith(
				'oj-active-1',
				expect.objectContaining({
					vendorCost: 4500,
					returnNotes: 'Denting complete, finish ok',
				})
			);
		});
	});

	it('renders movement history with returned details and cost', async () => {
		const returnedJob: api.OutsideJobDto = {
			id: 'oj-hist-1',
			jobCardId: 'jc-test-8',
			jobCardNumber: 'JC-2026-0108',
			vehicleId: 'veh-1',
			vehicleRegistrationNumber: 'KA01MJ9999',
			vehicleMake: 'Honda',
			vehicleModel: 'City',
			customerId: 'cust-1',
			customerName: 'Rahul Sharma',
			customerPhone: '9876543210',
			vendorId: 'ven-2',
			vendorName: 'Speedy Windshield Specialists',
			serviceName: 'Front Windshield Replacement',
			status: 2, // Returned
			statusName: 'Returned',
			sentAt: '2026-09-20T09:00:00Z',
			expectedReturnAt: '2026-09-20T17:00:00Z',
			returnedAt: '2026-09-20T15:30:00Z',
			sentByUserName: 'Manager Ravi',
			returnedByUserName: 'Supervisor Kumar',
			vendorCost: 8000,
			isOverdue: false,
			createdAt: '2026-09-20T09:00:00Z',
		};

		vi.mocked(api.getOutsideJobsByJobCardId).mockResolvedValue([returnedJob]);

		renderComponent('jc-test-8');

		await waitFor(() => {
			expect(screen.getByTestId('outside-jobs-history-table')).toBeInTheDocument();
			expect(screen.getByText(/Speedy Windshield Specialists/i)).toBeInTheDocument();
			expect(screen.getByText(/Front Windshield Replacement/i)).toBeInTheDocument();
			expect(screen.getByText(/₹8,000/i)).toBeInTheDocument();
		});
	});

	it('disables Send Vehicle Outside button and prevents modal opening when isLocked is true', async () => {
		renderWithProviders(
			<OutsideJobsSection
				jobCardId="jc-locked"
				vehicleRegistration="KA01MJ9999"
				vehicleModel="Honda City"
				isLocked={true}
			/>
		);

		await waitFor(() => {
			const sendBtn = screen.getByTestId('btn-add-outside-job');
			expect(sendBtn).toBeInTheDocument();
			expect(sendBtn).toBeDisabled();
			expect(sendBtn).toHaveAttribute('title', 'Job Card is locked because an invoice has been generated.');
		});

		fireEvent.click(screen.getByTestId('btn-add-outside-job'));
		expect(screen.queryByTestId('modal-send-outside')).not.toBeInTheDocument();
	});

	it('validates vendor phone number must be exactly 10 digits in new vendor form', async () => {
		renderComponent('jc-test-phone');

		await waitFor(() => {
			expect(screen.getByTestId('btn-add-outside-job')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('btn-add-outside-job'));
		expect(screen.getByTestId('modal-send-outside')).toBeInTheDocument();

		// Click Add New Vendor button
		fireEvent.click(screen.getByTestId('btn-toggle-new-vendor'));

		// Fill invalid 9-digit phone
		fireEvent.change(screen.getByPlaceholderText(/Sri Lakshmi Auto Works/i), { target: { value: 'New Test Vendor' } });
		fireEvent.change(screen.getByPlaceholderText(/9842712345/i), { target: { value: '987654321' } });

		fireEvent.click(screen.getByTestId('btn-save-new-vendor'));

		await waitFor(() => {
			expect(screen.getByText('Phone number must be exactly 10 digits.')).toBeInTheDocument();
			expect(api.createVendor).not.toHaveBeenCalled();
		});
	});

	it('allows editing vendor cost from movement history and calls updateOutsideJobCost', async () => {
		const returnedJob: api.OutsideJobDto = {
			id: 'oj-hist-edit-1',
			jobCardId: 'jc-test-edit',
			jobCardNumber: 'JC-2026-0109',
			vehicleId: 'veh-1',
			vehicleRegistrationNumber: 'KA01MJ9999',
			vehicleMake: 'Honda',
			vehicleModel: 'City',
			customerId: 'cust-1',
			customerName: 'Rahul Sharma',
			customerPhone: '9876543210',
			vendorId: 'ven-1',
			vendorName: 'Sri Lakshmi Auto Works',
			serviceName: 'Denting',
			status: 2, // Returned
			statusName: 'Returned',
			sentAt: '2026-09-20T09:00:00Z',
			expectedReturnAt: '2026-09-20T17:00:00Z',
			returnedAt: '2026-09-20T15:30:00Z',
			vendorCost: 500,
			isOverdue: false,
			createdAt: '2026-09-20T09:00:00Z',
		};

		vi.mocked(api.getOutsideJobsByJobCardId).mockResolvedValue([returnedJob]);
		vi.mocked(api.updateOutsideJobCost).mockResolvedValue({ ...returnedJob, vendorCost: 1500 });

		renderComponent('jc-test-edit');

		await waitFor(() => {
			expect(screen.getByTestId('btn-edit-cost-oj-hist-edit-1')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('btn-edit-cost-oj-hist-edit-1'));
		expect(screen.getByTestId('modal-edit-vendor-cost')).toBeInTheDocument();

		const costInput = screen.getByTestId('input-edit-vendor-cost');
		expect(costInput).toHaveValue(500);

		fireEvent.change(costInput, { target: { value: '1500' } });
		fireEvent.click(screen.getByTestId('btn-save-edited-cost'));

		await waitFor(() => {
			expect(api.updateOutsideJobCost).toHaveBeenCalledWith('oj-hist-edit-1', { vendorCost: 1500 });
		});
	});

	it('allows deleting movement from history with confirmation dialog', async () => {
		const returnedJob: api.OutsideJobDto = {
			id: 'oj-hist-del-1',
			jobCardId: 'jc-test-del',
			jobCardNumber: 'JC-2026-0110',
			vehicleId: 'veh-1',
			vehicleRegistrationNumber: 'KA01MJ9999',
			vehicleMake: 'Honda',
			vehicleModel: 'City',
			customerId: 'cust-1',
			customerName: 'Rahul Sharma',
			customerPhone: '9876543210',
			vendorId: 'ven-1',
			vendorName: 'Sri Lakshmi Auto Works',
			serviceName: 'Mistaken Job',
			status: 2, // Returned
			statusName: 'Returned',
			sentAt: '2026-09-20T09:00:00Z',
			expectedReturnAt: '2026-09-20T17:00:00Z',
			returnedAt: '2026-09-20T15:30:00Z',
			vendorCost: 500,
			isOverdue: false,
			createdAt: '2026-09-20T09:00:00Z',
		};

		vi.mocked(api.getOutsideJobsByJobCardId).mockResolvedValue([returnedJob]);
		vi.mocked(api.deleteOutsideJob).mockResolvedValue(undefined);

		renderComponent('jc-test-del');

		await waitFor(() => {
			expect(screen.getByTestId('btn-delete-movement-oj-hist-del-1')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('btn-delete-movement-oj-hist-del-1'));
		expect(screen.getByTestId('modal-delete-movement')).toBeInTheDocument();
		expect(screen.getByText(/Are you sure you want to remove the outside job record/i)).toBeInTheDocument();

		fireEvent.click(screen.getByTestId('btn-confirm-delete-movement'));

		await waitFor(() => {
			expect(api.deleteOutsideJob).toHaveBeenCalledWith('oj-hist-del-1');
		});
	});
});
