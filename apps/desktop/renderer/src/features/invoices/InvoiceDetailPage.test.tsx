import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { InvoiceDetailPage } from './InvoiceDetailPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getInvoiceById: vi.fn(),
		updateInvoice: vi.fn(),
		generateInvoice: vi.fn(),
		recordPayment: vi.fn(),
		getBusinessProfile: vi.fn(),
		getInvoiceWhatsAppStatus: vi.fn(),
	};
});

describe('InvoiceDetailPage Component & Invoice Boundary', () => {
	const mockDraftInvoice: api.InvoiceDto = {
		id: 'inv-1',
		invoiceNumber: null,
		jobCardId: 'jc-1',
		jobCardNumber: 'JC-2026-0001',
		customerId: 'cust-1',
		customerName: 'Gokul Sharma',
		customerPhone: '9876543210',
		vehicleId: 'veh-1',
		registrationNumber: 'TN01AB1234',
		vehicleMake: 'Hyundai',
		vehicleModel: 'Creta',
		vehicleVariant: 'SX(O)',
		vehicleColor: 'White',
		items: [
			{
				id: 'item-1',
				serviceId: 'svc-1',
				description: 'Full Body Foam Wash',
				quantity: 1,
				unitPrice: 800,
				discount: 0,
				taxableAmount: 800,
				taxAmount: 144,
				totalAmount: 944,
			},
		],
		subtotal: 800,
		discount: 0,
		taxableAmount: 800,
		gstAmount: 144,
		totalAmount: 944,
		paidAmount: 0,
		balanceAmount: 944,
		status: 'Draft',
		isGstEnabled: true,
		notes: 'Sample invoice notes',
		invoiceDate: '2026-02-01T10:00:00Z',
		createdAt: '2026-02-01T10:00:00Z',
		updatedAt: null,
		payments: [],
	};

	const mockFinalizedInvoice: api.InvoiceDto = {
		...mockDraftInvoice,
		invoiceNumber: 'INV-2026-0001',
		status: 'Generated',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getInvoiceById).mockResolvedValue(mockDraftInvoice);
		vi.mocked(api.getBusinessProfile).mockResolvedValue({
			businessName: 'E6 Car Spa',
			addressLine1: 'Chennai',
		} as api.BusinessProfileDto);
		vi.mocked(api.getInvoiceWhatsAppStatus).mockResolvedValue([
			{
				messageType: 'InvoiceFinalized',
				status: 'Sent',
				attemptCount: 1,
				sentAtUtc: '2026-02-01T10:05:00Z',
			},
			{
				messageType: 'PaymentCompleted',
				status: 'Sent',
				attemptCount: 1,
				sentAtUtc: '2026-02-01T10:05:00Z',
			},
		]);
		vi.mocked(api.generateInvoice).mockImplementation(async () => {
			vi.mocked(api.getInvoiceById).mockResolvedValue(mockFinalizedInvoice);
			return mockFinalizedInvoice;
		});
		vi.mocked(api.updateInvoice).mockResolvedValue(mockDraftInvoice);
	});

	it('renders draft invoice details with line items and customer information', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
			</Routes>,
			{
				initialEntries: ['/invoices/inv-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getAllByText('Gokul Sharma').length).toBeGreaterThan(0);
			expect(screen.getAllByText('TN01AB1234').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Full Body Foam Wash').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
			expect(screen.getByRole('button', { name: /generate invoice/i })).toBeInTheDocument();
		});
	});

	it('handles Generate Invoice flow and transitions invoice to finalized state', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
			</Routes>,
			{
				initialEntries: ['/invoices/inv-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /generate invoice/i })).toBeInTheDocument();
		});

		// 1. Click Generate Invoice button in top bar to open confirmation dialog
		const topGenerateBtn = screen.getByRole('button', { name: /generate invoice/i });
		fireEvent.click(topGenerateBtn);

		await waitFor(() => {
			expect(screen.getByText('Generate Invoice?')).toBeInTheDocument();
		});

		// 2. Confirm in dialog (footer button with Generate Invoice name)
		const dialogButtons = screen.getAllByRole('button', { name: /generate invoice/i });
		const dialogConfirmBtn = dialogButtons[dialogButtons.length - 1];
		fireEvent.click(dialogConfirmBtn);

		await waitFor(() => {
			expect(api.generateInvoice).toHaveBeenCalledWith('inv-1');
			expect(screen.getAllByText('#INV-2026-0001').length).toBeGreaterThan(0);
		});
	});

	it('renders finalized invoice in locked state and allows recording payment', async () => {
		vi.mocked(api.getInvoiceById).mockResolvedValue(mockFinalizedInvoice);

		renderWithProviders(
			<Routes>
				<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
			</Routes>,
			{
				initialEntries: ['/invoices/inv-1'],
				authContextValue: {
					hasPermission: (perm) => perm === 'payments.record',
				},
			}
		);

		await waitFor(() => {
			expect(screen.getAllByText('#INV-2026-0001').length).toBeGreaterThan(0);
			expect(screen.getByRole('button', { name: /record payment/i })).toBeInTheDocument();
		});

		expect(screen.queryByRole('button', { name: /^generate invoice$/i })).not.toBeInTheDocument();
	});

	it('handles generation error and displays error message in banner', async () => {
		vi.mocked(api.generateInvoice).mockRejectedValueOnce(
			new Error('Invoice sequence exhausted or locked.')
		);

		renderWithProviders(
			<Routes>
				<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
			</Routes>,
			{
				initialEntries: ['/invoices/inv-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /generate invoice/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /generate invoice/i }));

		await waitFor(() => {
			expect(screen.getByText('Generate Invoice?')).toBeInTheDocument();
		});

		const dialogButtons = screen.getAllByRole('button', { name: /generate invoice/i });
		fireEvent.click(dialogButtons[dialogButtons.length - 1]);

		await waitFor(() => {
			expect(screen.getByText('Invoice sequence exhausted or locked.')).toBeInTheDocument();
		});
	});

	it('submits payment recording and updates invoice balance and feedback message', async () => {
		const partiallyPaidInvoice: api.InvoiceDto = {
			...mockFinalizedInvoice,
			paidAmount: 500,
			balanceAmount: 444,
			status: 'PartiallyPaid',
		};

		vi.mocked(api.getInvoiceById).mockResolvedValue(mockFinalizedInvoice);
		vi.mocked(api.recordPayment).mockImplementation(async () => {
			vi.mocked(api.getInvoiceById).mockResolvedValue(partiallyPaidInvoice);
			return {
				id: 'pay-1',
				amount: 500,
				paymentMethod: 'UPI',
			} as any;
		});

		renderWithProviders(
			<Routes>
				<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
			</Routes>,
			{
				initialEntries: ['/invoices/inv-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['payments.record'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Collect Payment')).toBeInTheDocument();
		});

		// Switch to UPI payment method
		fireEvent.click(screen.getByRole('button', { name: /upi \/ qr/i }));

		// Fill amount & reference
		const amountInput = screen.getByPlaceholderText('944');
		fireEvent.change(amountInput, { target: { value: '500' } });

		const refInput = screen.getByPlaceholderText(/e\.g\. upi ref \/ utr/i);
		fireEvent.change(refInput, { target: { value: 'UPI-98765432' } });

		const submitBtn = screen.getByRole('button', { name: /^record payment$/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(api.recordPayment).toHaveBeenCalledWith('inv-1', {
				amount: 500,
				paymentMethod: 'UPI',
				reference: 'UPI-98765432',
			});
			expect(screen.getByText(/payment of ₹500\.00 recorded successfully via upi/i)).toBeInTheDocument();
		});
	});

	it('validates payment amount and displays error if amount exceeds balance', async () => {
		vi.mocked(api.getInvoiceById).mockResolvedValue(mockFinalizedInvoice);

		renderWithProviders(
			<Routes>
				<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
			</Routes>,
			{
				initialEntries: ['/invoices/inv-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['payments.record'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Collect Payment')).toBeInTheDocument();
		});

		const amountInput = screen.getByPlaceholderText('944');
		fireEvent.change(amountInput, { target: { value: '1500' } });

		const submitBtn = screen.getByRole('button', { name: /^record payment$/i });
		expect(submitBtn).toBeDisabled();
		expect(api.recordPayment).not.toHaveBeenCalled();
	});

	it('displays payment API error message gracefully without losing state', async () => {
		vi.mocked(api.getInvoiceById).mockResolvedValue(mockFinalizedInvoice);
		vi.mocked(api.recordPayment).mockRejectedValueOnce(
			new Error('Payment gateway timeout or invalid transaction.')
		);

		renderWithProviders(
			<Routes>
				<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
			</Routes>,
			{
				initialEntries: ['/invoices/inv-1'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['payments.record'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Collect Payment')).toBeInTheDocument();
		});

		const amountInput = screen.getByPlaceholderText('944');
		fireEvent.change(amountInput, { target: { value: '944' } });

		const submitBtn = screen.getByRole('button', { name: /^record payment$/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(screen.getByText('Payment gateway timeout or invalid transaction.')).toBeInTheDocument();
		});
	});

	it('polls WhatsApp status transition from Pending to Sent and terminates polling', async () => {
		vi.mocked(api.getInvoiceById).mockResolvedValue(mockFinalizedInvoice);
		
		let pollCount = 0;
		vi.mocked(api.getInvoiceWhatsAppStatus).mockImplementation(async () => {
			pollCount++;
			return [
				{
					messageType: 'InvoiceFinalized',
					status: pollCount > 1 ? 'Sent' : 'Pending',
					attemptCount: 1,
				},
			];
		});

		renderWithProviders(
			<Routes>
				<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
			</Routes>,
			{
				initialEntries: ['/invoices/inv-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByText(/whatsapp invoice: sent/i)).toBeInTheDocument();
		});
	});

	it('displays WhatsApp Failed and Skipped notification states', async () => {
		vi.mocked(api.getInvoiceById).mockResolvedValue(mockFinalizedInvoice);
		vi.mocked(api.getInvoiceWhatsAppStatus).mockResolvedValue([
			{
				messageType: 'InvoiceFinalized',
				status: 'Failed',
				attemptCount: 3,
				errorMessage: 'Invalid phone number format',
			},
			{
				messageType: 'PaymentCompleted',
				status: 'Skipped',
				attemptCount: 0,
			},
		]);

		renderWithProviders(
			<Routes>
				<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
			</Routes>,
			{
				initialEntries: ['/invoices/inv-1'],
			}
		);

		await waitFor(() => {
			expect(screen.getByText(/whatsapp invoice: failed/i)).toBeInTheDocument();
			expect(screen.getByText(/whatsapp payment: skipped/i)).toBeInTheDocument();
		});
	});
});

