import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WhatsAppMessageLog } from './WhatsAppMessageLog';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getWhatsAppMessageLog: vi.fn() };
});

const failedItem: api.WhatsAppMessageLogItemDto = {
	id: 'm-1',
	createdAtUtc: '2026-10-05T09:30:00Z',
	messageType: 'InvoiceFinalized',
	status: 'Failed',
	customerId: 'c-1',
	customerName: 'Asha Raman',
	recipientPhone: '919000000001',
	invoiceId: 'i-1',
	invoiceNumber: 'GST/0007',
	reason: 'Meta rejected the message',
	attemptCount: 3,
};

const skippedItem: api.WhatsAppMessageLogItemDto = {
	id: 'm-2',
	createdAtUtc: '2026-10-04T09:30:00Z',
	messageType: 'PaymentCompleted',
	status: 'Skipped',
	customerId: 'c-2',
	customerName: 'Ben Thomas',
	recipientPhone: '12345',
	invoiceId: 'i-2',
	invoiceNumber: null,
	reason: 'Customer phone number unavailable or invalid.',
	attemptCount: 0,
};

function respond(items: api.WhatsAppMessageLogItemDto[], totalCount = items.length) {
	vi.mocked(api.getWhatsAppMessageLog).mockResolvedValue({ items, totalCount, page: 1, pageSize: 15 });
}

const noop = () => {};

describe('WhatsAppMessageLog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('lists who each failed or skipped message was for, and why', async () => {
		respond([failedItem, skippedItem]);

		render(<WhatsAppMessageLog status="all" onStatusChange={noop} month={null} onClearMonth={noop} />);

		expect(await screen.findByText('Asha Raman')).toBeInTheDocument();
		const failedRow = screen.getByText('Asha Raman').closest('tr') as HTMLElement;
		expect(failedRow).toHaveTextContent('+91 90000 00001');
		expect(failedRow).toHaveTextContent('GST/0007');
		expect(failedRow).toHaveTextContent('Invoice');
		expect(failedRow).toHaveTextContent('Failed');
		expect(failedRow).toHaveTextContent('Meta rejected the message');

		const skippedRow = screen.getByText('Ben Thomas').closest('tr') as HTMLElement;
		expect(skippedRow).toHaveTextContent('12345');
		expect(skippedRow).toHaveTextContent('Payment receipt');
		expect(skippedRow).toHaveTextContent('Skipped');
		expect(skippedRow).toHaveTextContent('Customer phone number unavailable or invalid.');
		expect(screen.getByText(/showing 1–2 of 2/i)).toBeInTheDocument();
	});

	it('asks for the chosen result and month', async () => {
		respond([failedItem]);

		render(<WhatsAppMessageLog status="failed" onStatusChange={noop} month={{ year: 2026, month: 10 }} onClearMonth={noop} />);

		await screen.findByText('Asha Raman');
		expect(api.getWhatsAppMessageLog).toHaveBeenCalledWith({ status: 'failed', year: 2026, month: 10, page: 1, pageSize: 15 });
		expect(screen.getByRole('button', { name: /Failed/ })).toHaveAttribute('aria-pressed', 'true');
	});

	it('asks for everything in the last 6 months when no result or month is chosen', async () => {
		respond([failedItem]);

		render(<WhatsAppMessageLog status="all" onStatusChange={noop} month={null} onClearMonth={noop} />);

		await screen.findByText('Asha Raman');
		expect(api.getWhatsAppMessageLog).toHaveBeenCalledWith({ status: undefined, year: undefined, month: undefined, page: 1, pageSize: 15 });
		expect(screen.getByText('Last 6 months')).toBeInTheDocument();
	});

	it('reports filter and month changes', async () => {
		respond([failedItem]);
		const onStatusChange = vi.fn();
		const onClearMonth = vi.fn();

		render(<WhatsAppMessageLog status="all" onStatusChange={onStatusChange} month={{ year: 2026, month: 9 }} onClearMonth={onClearMonth} />);
		await screen.findByText('Asha Raman');

		fireEvent.click(screen.getByRole('button', { name: 'Skipped' }));
		fireEvent.click(screen.getByRole('button', { name: /clear month filter sep 2026/i }));

		expect(onStatusChange).toHaveBeenCalledWith('skipped');
		expect(onClearMonth).toHaveBeenCalled();
	});

	it('moves between pages', async () => {
		respond([failedItem], 40);

		render(<WhatsAppMessageLog status="all" onStatusChange={noop} month={null} onClearMonth={noop} />);
		await screen.findByText('Asha Raman');
		expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

		fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

		await waitFor(() => {
			expect(api.getWhatsAppMessageLog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
		});
	});

	it('says so when there is nothing to show', async () => {
		respond([]);

		render(<WhatsAppMessageLog status="all" onStatusChange={noop} month={null} onClearMonth={noop} />);

		expect(await screen.findByText(/no failed or skipped messages for this selection/i)).toBeInTheDocument();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});

	it('shows an error without exposing a table', async () => {
		vi.mocked(api.getWhatsAppMessageLog).mockRejectedValue(new Error('Viewing who a message was for requires the customers.view permission.'));

		render(<WhatsAppMessageLog status="all" onStatusChange={noop} month={null} onClearMonth={noop} />);

		expect(await screen.findByRole('alert')).toHaveTextContent(/customers\.view/);
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});
});
