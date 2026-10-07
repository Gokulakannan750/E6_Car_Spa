import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, render } from '@testing-library/react';
import { WhatsAppUsagePanel } from './WhatsAppUsagePanel';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getWhatsAppUsage: vi.fn() };
});

const months: api.WhatsAppUsageMonthDto[] = [
	{ year: 2026, month: 10, total: 6, sent: 3, failed: 1, skipped: 1, pending: 1, invoiceMessagesSent: 2, paymentMessagesSent: 1 },
	{ year: 2026, month: 9, total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, invoiceMessagesSent: 0, paymentMessagesSent: 0 },
];

describe('WhatsAppUsagePanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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

		render(<WhatsAppUsagePanel />);

		expect(await screen.findByText(/no whatsapp messages have been recorded/i)).toBeInTheDocument();
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
});
