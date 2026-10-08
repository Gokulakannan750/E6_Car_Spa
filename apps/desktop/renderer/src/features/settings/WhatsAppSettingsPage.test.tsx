import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import WhatsAppSettingsPage from './WhatsAppSettingsPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getWhatsAppConfig: vi.fn(),
		updateWhatsAppConfig: vi.fn(),
		testWhatsAppConnection: vi.fn(),
		getWhatsAppTemplates: vi.fn(),
		getWhatsAppUsage: vi.fn(),
		sendTestWhatsAppMessage: vi.fn(),
	};
});

describe('WhatsAppSettingsPage Component', () => {
	const mockConfig: api.WhatsAppConfigDto = {
		isEnabled: true,
		phoneNumberId: '109876543210987',
		businessAccountId: '209876543210987',
		graphApiVersion: 'v25.0',
		hasAccessToken: true,
		invoiceNotificationsEnabled: true,
		paymentCompletedNotificationsEnabled: true,
		invoiceTemplateName: 'e6_carspa_invoice_generated',
		invoiceTemplateLanguage: 'en_US',
		paymentCompletedTemplateName: 'e6_carspa_payment_completed',
		paymentCompletedTemplateLanguage: 'en_US',
		healthStatus: 'Healthy',
		lastCheckedAtUtc: '2026-02-01T12:00:00Z',
		lastErrorMessage: null,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getWhatsAppConfig).mockResolvedValue(mockConfig);
		vi.mocked(api.getWhatsAppUsage).mockResolvedValue({
			months: [
				{ year: 2026, month: 10, total: 10, sent: 8, failed: 1, skipped: 1, pending: 0, invoiceMessagesSent: 5, paymentMessagesSent: 3 },
			],
		});
		vi.mocked(api.getWhatsAppTemplates).mockResolvedValue({
			isSuccess: true,
			templates: [],
			totalCount: 0,
			message: '',
		});
	});

	it('renders canonical WhatsApp Settings page with dedicated header', async () => {
		renderWithProviders(<WhatsAppSettingsPage />, {
			initialEntries: ['/settings/whatsapp'],
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view', 'settings.business'],
			},
		});

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'WhatsApp Settings', level: 1 })).toBeInTheDocument();
			expect(
				screen.getByText('Configure Meta WhatsApp Cloud API credentials, utility notification templates, and automated delivery')
			).toBeInTheDocument();
		});

		// Verify Cloud API Architecture card
		expect(screen.getByText('Cloud API Architecture')).toBeInTheDocument();
		expect(screen.getByText('Meta Graph API v25.0')).toBeInTheDocument();
		expect(screen.getByText('Production Triggers')).toBeInTheDocument();
		expect(screen.getByText('Durable Fault Isolation')).toBeInTheDocument();

		// Verify WhatsApp integration section
		expect(screen.getByText('WhatsApp Business Integration')).toBeInTheDocument();
	});

	const ownerUser = {
		id: 'usr-1',
		fullName: 'Admin User',
		username: 'admin',
		role: 'Owner' as const,
		isOwner: true,
		permissions: ['settings.view', 'settings.business'],
	};

	it('opens on the Settings tab and does not load usage until the Usage tab is chosen', async () => {
		renderWithProviders(<WhatsAppSettingsPage />, { initialEntries: ['/settings/whatsapp'], authUser: ownerUser });

		expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'Usage' })).toHaveAttribute('aria-selected', 'false');
		expect(screen.getByTestId('whatsapp-settings-tab')).not.toHaveClass('hidden');
		await waitFor(() => expect(api.getWhatsAppConfig).toHaveBeenCalled());
		expect(api.getWhatsAppUsage).not.toHaveBeenCalled();
	});

	it('shows the monthly usage table on the Usage tab', async () => {
		renderWithProviders(<WhatsAppSettingsPage />, { initialEntries: ['/settings/whatsapp'], authUser: ownerUser });

		fireEvent.click(screen.getByRole('tab', { name: 'Usage' }));

		expect(await screen.findByText('Oct 2026')).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Usage' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByTestId('whatsapp-settings-tab')).toHaveClass('hidden');
		expect(api.getWhatsAppUsage).toHaveBeenCalledWith(6);
	});

	it('keeps unsaved settings when switching to Usage and back', async () => {
		renderWithProviders(<WhatsAppSettingsPage />, { initialEntries: ['/settings/whatsapp'], authUser: ownerUser });

		const phoneInput = await screen.findByDisplayValue('109876543210987');
		fireEvent.change(phoneInput, { target: { value: '111222333444555' } });

		fireEvent.click(screen.getByRole('tab', { name: 'Usage' }));
		await screen.findByText('Oct 2026');
		fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));

		expect(screen.getByDisplayValue('111222333444555')).toBeInTheDocument();
		expect(screen.queryByText('Oct 2026')).not.toBeInTheDocument();
	});

	it('opens straight on the Usage tab from a link', async () => {
		renderWithProviders(<WhatsAppSettingsPage />, { initialEntries: ['/settings/whatsapp?tab=usage'], authUser: ownerUser });

		expect(await screen.findByText('Oct 2026')).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Usage' })).toHaveAttribute('aria-selected', 'true');
	});
});
