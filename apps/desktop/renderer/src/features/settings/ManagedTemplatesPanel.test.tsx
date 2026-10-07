import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ManagedTemplatesPanel } from './ManagedTemplatesPanel';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getManagedWhatsAppTemplates: vi.fn(),
		provisionManagedWhatsAppTemplates: vi.fn(),
		activateManagedWhatsAppTemplates: vi.fn(),
	};
});

const INVOICE = 'trovo_invoice_ready_v1';
const PAYMENT = 'trovo_payment_received_v1';

function status(invoice: string, payment: string, opts: Partial<api.ManagedWhatsAppTemplatesResponse> = {}, active = false): api.ManagedWhatsAppTemplatesResponse {
	return {
		isSuccess: true,
		message: 'ok',
		canActivate: invoice === 'APPROVED' && payment === 'APPROVED',
		templates: [
			{ messageType: 'InvoiceFinalized', purpose: 'Invoice ready (with PDF)', name: INVOICE, language: 'en', category: 'UTILITY', status: invoice, rejectedReason: invoice === 'REJECTED' ? 'INVALID_FORMAT' : null, isActive: active },
			{ messageType: 'PaymentCompleted', purpose: 'Payment received', name: PAYMENT, language: 'en', category: 'UTILITY', status: payment, rejectedReason: null, isActive: active },
		],
		...opts,
	};
}

describe('ManagedTemplatesPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows each standard template with its Meta status and rejection reason', async () => {
		vi.mocked(api.getManagedWhatsAppTemplates).mockResolvedValue(status('REJECTED', 'PENDING'));
		renderWithProviders(<ManagedTemplatesPanel canManage />);

		const invoiceRow = await screen.findByTestId(`managed-template-${INVOICE}`);
		expect(within(invoiceRow).getByText('Rejected')).toBeInTheDocument();
		expect(within(invoiceRow).getByText(/INVALID_FORMAT/)).toBeInTheDocument();
		expect(within(screen.getByTestId(`managed-template-${PAYMENT}`)).getByText('Pending')).toBeInTheDocument();
	});

	it('creates the templates and reports per-template failures', async () => {
		vi.mocked(api.getManagedWhatsAppTemplates).mockResolvedValue(status('NOT_CREATED', 'NOT_CREATED'));
		vi.mocked(api.provisionManagedWhatsAppTemplates).mockResolvedValue({
			isSuccess: false,
			message: '1 template(s) could not be created.',
			results: [
				{ name: INVOICE, outcome: 'Failed', error: 'Meta App ID is required to create this template.' },
				{ name: PAYMENT, outcome: 'Created', status: 'PENDING' },
			],
		});
		renderWithProviders(<ManagedTemplatesPanel canManage />);

		fireEvent.click(await screen.findByRole('button', { name: /create standard templates/i }));

		await waitFor(() => expect(api.provisionManagedWhatsAppTemplates).toHaveBeenCalledTimes(1));
		const msg = await screen.findByRole('status');
		expect(msg).toHaveTextContent('1 template(s) could not be created.');
		expect(msg).toHaveTextContent('Meta App ID is required');
		expect(api.getManagedWhatsAppTemplates).toHaveBeenCalledTimes(2); // refreshed after creating
	});

	it('only allows switching once both templates are approved, then notifies the parent', async () => {
		const onActivated = vi.fn();
		vi.mocked(api.getManagedWhatsAppTemplates).mockResolvedValueOnce(status('APPROVED', 'PENDING'));
		const { unmount } = renderWithProviders(<ManagedTemplatesPanel canManage onActivated={onActivated} />);
		expect(await screen.findByRole('button', { name: /use approved templates/i })).toBeDisabled();
		unmount();

		vi.mocked(api.getManagedWhatsAppTemplates)
			.mockResolvedValueOnce(status('APPROVED', 'APPROVED'))
			.mockResolvedValueOnce(status('APPROVED', 'APPROVED', {}, true));
		vi.mocked(api.activateManagedWhatsAppTemplates).mockResolvedValue({ isSuccess: true, message: 'WhatsApp notifications now use the standard templates.' });
		renderWithProviders(<ManagedTemplatesPanel canManage onActivated={onActivated} />);

		const use = await screen.findByRole('button', { name: /use approved templates/i });
		await waitFor(() => expect(use).toBeEnabled());
		fireEvent.click(use);

		await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1));
		await waitFor(() => {
			for (const name of [INVOICE, PAYMENT]) {
				expect(within(screen.getByTestId(`managed-template-${name}`)).getByText('In use')).toBeInTheDocument();
			}
		});
		expect(screen.getByRole('button', { name: /create standard templates/i })).toBeDisabled();
	});

	it('is read-only for users who cannot manage business settings', async () => {
		vi.mocked(api.getManagedWhatsAppTemplates).mockResolvedValue(status('APPROVED', 'APPROVED'));
		renderWithProviders(<ManagedTemplatesPanel canManage={false} />);

		await screen.findByTestId(`managed-template-${INVOICE}`);
		expect(screen.queryByRole('button', { name: /create standard templates/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /use approved templates/i })).not.toBeInTheDocument();
	});
});
