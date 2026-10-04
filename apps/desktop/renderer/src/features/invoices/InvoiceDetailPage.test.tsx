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
		previewInvoice: vi.fn(),
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
			// The confirmed (stored, server-calculated) total is sent so the server cannot issue a different amount.
			expect(api.generateInvoice).toHaveBeenCalledWith('inv-1', 944);
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

	describe('Phase 1: GST shown is always the server calculation', () => {
		// ₹10,000 @ 18% + ₹10,000 @ 5% + ₹5,000 @ 0% (server values; a flat 18% would give ₹29,500).
		const mixedDraft: api.InvoiceDto = {
			...mockDraftInvoice,
			items: [
				{ id: 'a', serviceId: 's18', description: 'Ceramic Coating', quantity: 1, unitPrice: 10000, discount: 0, taxableAmount: 10000, taxAmount: 1800, totalAmount: 11800, taxRatePercent: 18, cgstAmount: 900, sgstAmount: 900 },
				{ id: 'b', serviceId: 's5', description: 'Wax Polish', quantity: 1, unitPrice: 10000, discount: 0, taxableAmount: 10000, taxAmount: 500, totalAmount: 10500, taxRatePercent: 5, cgstAmount: 250, sgstAmount: 250 },
				{ id: 'c', serviceId: 's0', description: 'Exempt Service', quantity: 1, unitPrice: 5000, discount: 0, taxableAmount: 5000, taxAmount: 0, totalAmount: 5000, taxRatePercent: 0, cgstAmount: 0, sgstAmount: 0 },
			],
			subtotal: 25000,
			discount: 0,
			taxableAmount: 25000,
			gstAmount: 2300,
			cgstAmount: 1150,
			sgstAmount: 1150,
			totalAmount: 27300,
			balanceAmount: 27300,
			taxBreakdown: [
				{ ratePercent: 18, taxableAmount: 10000, cgstAmount: 900, sgstAmount: 900, taxAmount: 1800 },
				{ ratePercent: 5, taxableAmount: 10000, cgstAmount: 250, sgstAmount: 250, taxAmount: 500 },
				{ ratePercent: 0, taxableAmount: 5000, cgstAmount: 0, sgstAmount: 0, taxAmount: 0 },
			],
		};
		// Server preview for a ₹1,000 discount.
		const mixedWithDiscount: api.InvoiceDto = {
			...mixedDraft,
			discount: 1000,
			taxableAmount: 24000,
			gstAmount: 2208,
			cgstAmount: 1104,
			sgstAmount: 1104,
			totalAmount: 26208,
			balanceAmount: 26208,
			taxBreakdown: [
				{ ratePercent: 18, taxableAmount: 9600, cgstAmount: 864, sgstAmount: 864, taxAmount: 1728 },
				{ ratePercent: 5, taxableAmount: 9600, cgstAmount: 240, sgstAmount: 240, taxAmount: 480 },
				{ ratePercent: 0, taxableAmount: 4800, cgstAmount: 0, sgstAmount: 0, taxAmount: 0 },
			],
		};

		const renderPage = () =>
			renderWithProviders(
				<Routes>
					<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
				</Routes>,
				{ initialEntries: ['/invoices/inv-1'] },
			);

		it('mixed 18% / 5% / 0% draft shows each rate from the server, never a flat 9% + 9%', async () => {
			vi.mocked(api.getInvoiceById).mockResolvedValue(mixedDraft);
			renderPage();

			await waitFor(() => expect(screen.getByTestId('grand-total')).toHaveTextContent('27,300.00'));
			const rows = screen.getAllByTestId('tax-row').map((r) => r.textContent ?? '');
			expect(rows.some((t) => t.startsWith('CGST @ 9%') && t.includes('900.00'))).toBe(true);
			expect(rows.some((t) => t.startsWith('SGST @ 2.5%') && t.includes('250.00'))).toBe(true);
			expect(rows.some((t) => t.startsWith('GST @ 0%'))).toBe(true);
			expect(screen.queryByText(/\(9%\)/)).not.toBeInTheDocument();
			expect(screen.getAllByTestId('line-gst-rate').map((c) => c.textContent)).toEqual(['18%', '5%', '0%']);
			expect(api.previewInvoice).not.toHaveBeenCalled();
		});

		it('an unsaved discount is priced by the server preview, not by the client', async () => {
			vi.mocked(api.getInvoiceById).mockResolvedValue(mixedDraft);
			vi.mocked(api.previewInvoice).mockResolvedValue(mixedWithDiscount);
			renderPage();
			await waitFor(() => expect(screen.getByTestId('grand-total')).toHaveTextContent('27,300.00'));

			fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1000' } });

			await waitFor(() => expect(api.previewInvoice).toHaveBeenCalledWith('inv-1', { discount: 1000, isGstEnabled: true }));
			// Flat 18% on ₹24,000 would show ₹28,320; the server's per-line result is ₹26,208.
			await waitFor(() => expect(screen.getByTestId('grand-total')).toHaveTextContent('26,208.00'));
			expect(screen.queryByText(/28,320/)).not.toBeInTheDocument();
		});

		it('confirmation shows the saved server total and generation sends exactly that amount', async () => {
			vi.mocked(api.getInvoiceById).mockResolvedValue(mixedDraft);
			vi.mocked(api.previewInvoice).mockResolvedValue(mixedWithDiscount);
			vi.mocked(api.updateInvoice).mockResolvedValue(mixedWithDiscount);
			vi.mocked(api.generateInvoice).mockResolvedValue({ ...mixedWithDiscount, invoiceNumber: 'GST/0001', status: 'Generated' });
			renderPage();
			await waitFor(() => expect(screen.getByTestId('grand-total')).toHaveTextContent('27,300.00'));

			fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1000' } });
			await waitFor(() => expect(screen.getByTestId('grand-total')).toHaveTextContent('26,208.00'));

			fireEvent.click(screen.getByRole('button', { name: /generate invoice/i }));

			// Unsaved changes are saved first; the dialog shows the stored server result.
			await waitFor(() => expect(screen.getByText('Generate Invoice?')).toBeInTheDocument());
			expect(api.updateInvoice).toHaveBeenCalledWith('inv-1', expect.objectContaining({ discount: 1000, isGstEnabled: true }));
			expect(screen.getByTestId('confirm-grand-total')).toHaveTextContent('26,208.00');
			expect(screen.getByText('GST 18% + 5% + 0%')).toBeInTheDocument();

			const buttons = screen.getAllByRole('button', { name: /generate invoice/i });
			fireEvent.click(buttons[buttons.length - 1]);
			await waitFor(() => expect(api.generateInvoice).toHaveBeenCalledWith('inv-1', 26208));
		});
	});
});
