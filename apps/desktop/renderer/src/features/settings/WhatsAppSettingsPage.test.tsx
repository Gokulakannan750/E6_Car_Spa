import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
});
