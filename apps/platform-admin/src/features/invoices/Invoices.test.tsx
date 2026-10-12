import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as csv from '@/lib/csv';
import type { InvoiceListItem } from '@/lib/types';
import { adminWith, fakeApi, renderApp, signIn } from '@/test/utils';

const invoice: InvoiceListItem = {
	id: 'inv-1',
	invoiceNumber: 'TROVO/2026-27/0007',
	companyId: 'c2',
	companyCode: '0002',
	companyName: 'Sunrise Detailing',
	status: 'Open',
	overdue: true,
	currency: 'INR',
	totalMinor: 299_800,
	amountDueMinor: 299_800,
	issuedAt: '2026-10-05T00:00:00Z',
	dueAt: '2026-10-10T00:00:00Z',
	paidAt: null,
	periodStart: '2026-10-12T00:00:00Z',
	periodEnd: '2026-11-11T00:00:00Z',
};

describe('invoices', () => {
	it('records a bank payment with its reference, after checking the amount', async () => {
		signIn(adminWith('Billing'));
		const api = fakeApi([
			{ path: '/api/platform/invoices', body: [invoice] },
			{ method: 'POST', path: '/api/platform/invoices/inv-1/payments', status: 201, body: { id: 'p1' } },
		]);
		const user = userEvent.setup();
		renderApp('/invoices');

		await screen.findByText('TROVO/2026-27/0007');
		expect(within(screen.getAllByRole('row')[1]!).getByText('Overdue')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Record payment' }));
		const dialog = screen.getByRole('dialog');
		expect(within(dialog).getByLabelText('Amount received (₹)')).toHaveValue('2998.00');

		await user.clear(screen.getByLabelText('Amount received (₹)'));
		await user.type(screen.getByLabelText('Amount received (₹)'), '5000');
		await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
		expect(await screen.findByText(/More than the/)).toBeInTheDocument();
		expect(screen.getByText('Enter the UTR, UPI reference or cheque number.')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Full amount' }));
		await user.selectOptions(screen.getByLabelText('Paid by'), 'Bank transfer');
		await user.type(screen.getByLabelText('Reference'), 'UTR123456');
		await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));

		await screen.findByText(/is paid/);
		const post = api.calls.find((c) => c.method === 'POST');
		expect(post?.body).toMatchObject({ amountMinor: 299_800, reference: 'Bank transfer: UTR123456' });
	});

	it('exports the invoices shown, with plain rupee amounts', async () => {
		signIn(adminWith('ReadOnly'));
		fakeApi([{ path: '/api/platform/invoices', body: [invoice] }]);
		const download = vi.spyOn(csv, 'downloadCsv').mockImplementation(() => {});
		const user = userEvent.setup();
		renderApp('/invoices');

		await screen.findByText('TROVO/2026-27/0007');
		expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Export CSV' }));
		const [, , rows] = download.mock.calls[0]!;
		expect(rows[0]).toEqual(['TROVO/2026-27/0007', '0002', 'Sunrise Detailing', 'Open', 'Yes', '2026-10-12', '2026-11-11', '2026-10-05', '2026-10-10', '', 'INR', '2998.00', '2998.00']);
	});
});
