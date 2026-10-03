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
		getBusinessProfile: vi.fn(),
		getInvoiceWhatsAppStatus: vi.fn(),
		updateInvoiceNumber: vi.fn(),
	};
});

const owner = { id: 'usr-owner', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };
const manager = {
	id: 'usr-mgr',
	fullName: 'Manager',
	username: 'manager',
	role: 'Manager',
	isOwner: false,
	permissions: ['invoices.view', 'invoices.generate', 'invoices.edit_draft', 'invoices.cancel', 'payments.record'],
};

const paidGstInvoice: api.InvoiceDto = {
	id: 'inv-9',
	invoiceNumber: 'INV-2026-000125',
	jobCardId: 'jc-9',
	jobCardNumber: 'JC-2026-000125',
	customerId: 'cust-9',
	customerName: 'Gokul Sharma',
	customerPhone: '9876543210',
	vehicleId: 'veh-9',
	registrationNumber: 'TN01AB1234',
	vehicleMake: 'Hyundai',
	vehicleModel: 'Creta',
	vehicleVariant: null,
	vehicleColor: null,
	items: [
		{ id: 'item-9', serviceId: 'svc-9', description: 'Foam Wash', quantity: 1, unitPrice: 1000, discount: 0, taxableAmount: 1000, taxAmount: 180, totalAmount: 1180 },
	],
	subtotal: 1000,
	discount: 0,
	taxableAmount: 1000,
	gstAmount: 180,
	totalAmount: 1180,
	paidAmount: 1180,
	balanceAmount: 0,
	status: 'Paid',
	isGstEnabled: true,
	notes: null,
	invoiceDate: '2026-10-01T10:00:00Z',
	createdAt: '2026-10-01T10:00:00Z',
	updatedAt: null,
	payments: [],
} as unknown as api.InvoiceDto;

function renderPage(invoice: api.InvoiceDto, authUser: typeof owner | typeof manager) {
	vi.mocked(api.getInvoiceById).mockResolvedValue(invoice);
	return renderWithProviders(
		<Routes>
			<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
		</Routes>,
		{ initialEntries: [`/invoices/${invoice.id}`], authUser }
	);
}

async function waitForHeader(number: string) {
	await waitFor(() => expect(screen.getByRole('heading', { name: `#${number}` })).toBeInTheDocument());
}

describe('GST invoice number editing (desktop)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getBusinessProfile).mockResolvedValue({ businessName: 'E6 Car Spa' } as api.BusinessProfileDto);
		vi.mocked(api.getInvoiceWhatsAppStatus).mockResolvedValue([]);
	});

	it('1. Owner sees the edit action on a fully paid GST invoice and can save a new number', async () => {
		vi.mocked(api.updateInvoiceNumber).mockResolvedValue({ ...paidGstInvoice, invoiceNumber: 'E6/INV/00125' });
		renderPage(paidGstInvoice, owner);
		await waitForHeader('INV-2026-000125');

		fireEvent.click(screen.getByRole('button', { name: /edit invoice number/i }));
		const input = await screen.findByLabelText('New invoice number');
		fireEvent.change(input, { target: { value: '  E6/INV/00125 ' } });
		fireEvent.click(screen.getByRole('button', { name: /save number/i }));

		await waitFor(() => expect(api.updateInvoiceNumber).toHaveBeenCalledWith('inv-9', 'E6/INV/00125'));
		await waitForHeader('E6/INV/00125');
	});

	it('2. Manager (even with invoice permissions) does not see the edit action', async () => {
		renderPage(paidGstInvoice, manager);
		await waitForHeader('INV-2026-000125');
		expect(screen.queryByRole('button', { name: /edit invoice number/i })).not.toBeInTheDocument();
	});

	it('3. Owner does not see the edit action on a non-GST invoice', async () => {
		renderPage({ ...paidGstInvoice, isGstEnabled: false, gstAmount: 0, totalAmount: 1000, paidAmount: 1000 }, owner);
		await waitForHeader('INV-2026-000125');
		expect(screen.queryByRole('button', { name: /edit invoice number/i })).not.toBeInTheDocument();
	});

	it.each([
		['Generated', 0],
		['PartiallyPaid', 500],
		['Cancelled', 0],
	])('4. Owner does not see the edit action when the GST invoice is %s', async (status, paid) => {
		renderPage({ ...paidGstInvoice, status: status as api.InvoiceDto['status'], paidAmount: paid, balanceAmount: 1180 - paid }, owner);
		await waitForHeader('INV-2026-000125');
		expect(screen.queryByRole('button', { name: /edit invoice number/i })).not.toBeInTheDocument();
	});

	it('5. Invalid format disables saving and explains the rule', async () => {
		renderPage(paidGstInvoice, owner);
		await waitForHeader('INV-2026-000125');
		fireEvent.click(screen.getByRole('button', { name: /edit invoice number/i }));

		const input = await screen.findByLabelText('New invoice number');
		fireEvent.change(input, { target: { value: 'BAD #1' } });

		expect(screen.getByText(/invalid format/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /save number/i })).toBeDisabled();
		expect(api.updateInvoiceNumber).not.toHaveBeenCalled();
	});

	it('6. Server rejection (e.g. duplicate number) is shown and the old number is kept', async () => {
		vi.mocked(api.updateInvoiceNumber).mockRejectedValue(new Error("Invoice number 'E6/INV/00001' is already used by another invoice."));
		renderPage(paidGstInvoice, owner);
		await waitForHeader('INV-2026-000125');
		fireEvent.click(screen.getByRole('button', { name: /edit invoice number/i }));

		fireEvent.change(await screen.findByLabelText('New invoice number'), { target: { value: 'E6/INV/00001' } });
		fireEvent.click(screen.getByRole('button', { name: /save number/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent(/already used by another invoice/i);
		expect(screen.getByRole('heading', { name: '#INV-2026-000125' })).toBeInTheDocument();
	});
});
