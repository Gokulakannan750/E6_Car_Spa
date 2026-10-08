import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, render } from '@testing-library/react';
import { WhatsAppUsagePanel } from './WhatsAppUsagePanel';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getWhatsAppUsage: vi.fn(), getWhatsAppMessageLog: vi.fn() };
});

const months: api.WhatsAppUsageMonthDto[] = [
	{ year: 2026, month: 10, total: 6, sent: 3, failed: 1, skipped: 1, pending: 1, invoiceMessagesSent: 2, paymentMessagesSent: 1 },
	{ year: 2026, month: 9, total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, invoiceMessagesSent: 0, paymentMessagesSent: 0 },
];

const loggedMessage: api.WhatsAppMessageLogItemDto = {
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

describe('WhatsAppUsagePanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getWhatsAppMessageLog).mockResolvedValue({ items: [loggedMessage], totalCount: 1, page: 1, pageSize: 15 });
	});

	it('shows messages per month, newest first', async () => {
		vi.mocked(api.getWhatsAppUsage).mockResolvedValue({ months });

		render(<WhatsAppUsagePanel />);

		expect(await screen.findByText('Oct 2026')).toBeInTheDocument();
		expect(screen.getByText('Sep 2026')).toBeInTheDocument();
		const octoberRow = screen.getByText('Oct 2026').closest('tr') as HTMLElement;
		const cells = Array.from(octoberRow.querySelectorAll('td')).map((cell) => cell.textContent);
		expect(cells).toEqual(['Oct 2026', '3', '1', '1', '1', '2', '1']);
		expect(api.getWhatsAppUsage).toHaveBeenCalledWith(6);
	});

	it('says so plainly when no messages were recorded', async () => {
		vi.mocked(api.getWhatsAppUsage).mockResolvedValue({
			months: months.map((m) => ({ ...m, total: 0, sent: 0, failed: 0, skipped: 0, pending: 0 })),
		});

		vi.mocked(api.getWhatsAppMessageLog).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 15 });

		render(<WhatsAppUsagePanel />);

		expect(await screen.findByText(/no whatsapp messages have been recorded/i)).toBeInTheDocument();
		expect(await screen.findByText(/no failed or skipped messages for this selection/i)).toBeInTheDocument();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});

	it('shows an error and can retry', async () => {
		vi.mocked(api.getWhatsAppUsage).mockRejectedValueOnce(new Error('Server unavailable'));
		vi.mocked(api.getWhatsAppUsage).mockResolvedValueOnce({ months });

		render(<WhatsAppUsagePanel />);

		expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');

		fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

		await waitFor(() => {
			expect(screen.getByText('Oct 2026')).toBeInTheDocument();
		});
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('lets you click a Failed count to see whose messages failed that month', async () => {
		vi.mocked(api.getWhatsAppUsage).mockResolvedValue({ months });

		render(<WhatsAppUsagePanel />);
		await screen.findByText('Oct 2026');
		fireEvent.click(screen.getByRole('button', { name: /show 1 failed messages for oct 2026/i }));

		await waitFor(() => {
			expect(api.getWhatsAppMessageLog).toHaveBeenLastCalledWith(
				expect.objectContaining({ status: 'failed', year: 2026, month: 10 })
			);
		});
		expect(await screen.findByText('Asha Raman')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /clear month filter oct 2026/i })).toBeInTheDocument();
	});

	it('lets you click a Skipped count to see whose messages were skipped', async () => {
		vi.mocked(api.getWhatsAppUsage).mockResolvedValue({ months });

		render(<WhatsAppUsagePanel />);
		await screen.findByText('Oct 2026');
		fireEvent.click(screen.getByRole('button', { name: /show 1 skipped messages for oct 2026/i }));

		await waitFor(() => {
			expect(api.getWhatsAppMessageLog).toHaveBeenLastCalledWith(
				expect.objectContaining({ status: 'skipped', year: 2026, month: 10 })
			);
		});
	});

	it('does not make zero counts clickable', async () => {
		vi.mocked(api.getWhatsAppUsage).mockResolvedValue({
			months: [{ year: 2026, month: 9, total: 3, sent: 3, failed: 0, skipped: 0, pending: 0, invoiceMessagesSent: 2, paymentMessagesSent: 1 }],
		});

		render(<WhatsAppUsagePanel />);
		await screen.findByText('Sep 2026');

		expect(screen.queryByRole('button', { name: /show 0/i })).not.toBeInTheDocument();
	});

	it('shows the failed and skipped list for the last 6 months before any count is clicked', async () => {
		vi.mocked(api.getWhatsAppUsage).mockResolvedValue({ months });

		render(<WhatsAppUsagePanel />);

		expect(await screen.findByText('Asha Raman')).toBeInTheDocument();
		expect(screen.getByText('Last 6 months')).toBeInTheDocument();
		expect(api.getWhatsAppMessageLog).toHaveBeenCalledWith(expect.objectContaining({ status: undefined, year: undefined }));
	});
});
