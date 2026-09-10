import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { WhatsAppSettingsSection } from './WhatsAppSettingsSection';
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

describe('WhatsAppSettingsSection Component & Security Boundary', () => {
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

	const mockTemplates: api.MetaWhatsAppTemplateDto[] = [
		{
			id: 'tpl-1',
			name: 'e6_carspa_invoice_generated',
			language: 'en_US',
			status: 'APPROVED',
			category: 'UTILITY',
			components: [
				{
					type: 'BODY',
					text: 'Hello {{1}}, your invoice for {{2}} is ready: {{3}}',
					variables: ['{{1}}', '{{2}}', '{{3}}'],
					examples: ['Gokul', '₹944', 'https://carspa.app/inv/1'],
				},
			],
		},
		{
			id: 'tpl-2',
			name: 'e6_carspa_payment_completed',
			language: 'en_US',
			status: 'APPROVED',
			category: 'UTILITY',
			components: [
				{
					type: 'BODY',
					text: 'Thank you {{1}} for paying {{2}} for vehicle {{3}}.',
					variables: ['{{1}}', '{{2}}', '{{3}}'],
					examples: ['Gokul', '₹500', 'TN01AB1234'],
				},
			],
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getWhatsAppConfig).mockResolvedValue(mockConfig);
		vi.mocked(api.getWhatsAppTemplates).mockResolvedValue({
			isSuccess: true,
			templates: mockTemplates,
			totalCount: 2,
			message: '',
		});
		vi.mocked(api.updateWhatsAppConfig).mockImplementation(async (payload) => ({
			...mockConfig,
			...payload,
			hasAccessToken: true,
		}));
		vi.mocked(api.testWhatsAppConnection).mockResolvedValue({
			isSuccess: true,
			message: 'WhatsApp Cloud API connection test successful.',
			details: 'WABA ID verified. Phone number status: CONNECTED.',
		});
	});

	it('renders configured WhatsApp integration state with masked token indicator and healthy status', async () => {
		renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

		await waitFor(() => {
			expect(screen.getByText('WhatsApp Business Integration')).toBeInTheDocument();
			expect(screen.getByText('Connected')).toBeInTheDocument();
			expect(screen.getByText('Encrypted at rest')).toBeInTheDocument();
			expect(screen.getByDisplayValue('109876543210987')).toBeInTheDocument();
			expect(screen.getByDisplayValue('209876543210987')).toBeInTheDocument();
		});

		// Plaintext token must NEVER appear anywhere in the DOM
		const secretToken = 'TEST_SECRET_WHATSAPP_TOKEN_123456';
		expect(document.body.textContent).not.toContain(secretToken);
	});

	it('renders not configured state when integration has no credentials', async () => {
		vi.mocked(api.getWhatsAppConfig).mockResolvedValue({
			...mockConfig,
			isEnabled: false,
			phoneNumberId: '',
			businessAccountId: '',
			hasAccessToken: false,
			healthStatus: 'NotConfigured',
		});

		renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

		await waitFor(() => {
			expect(screen.getByText('Not Configured')).toBeInTheDocument();
			expect(screen.queryByText('Encrypted at rest')).not.toBeInTheDocument();
			expect(screen.getByPlaceholderText('Enter Meta Permanent Access Token')).toBeInTheDocument();
		});
	});

	it('saves updated WhatsApp credentials and templates configuration', async () => {
		renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

		await waitFor(() => {
			expect(screen.getByDisplayValue('109876543210987')).toBeInTheDocument();
		});

		const tokenInput = screen.getByPlaceholderText(/Configured — enter new token to update/i);
		fireEvent.change(tokenInput, { target: { value: 'EAABwz...' } });

		const saveBtn = screen.getByRole('button', { name: /save whatsapp settings/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(api.updateWhatsAppConfig).toHaveBeenCalledWith(
				expect.objectContaining({
					phoneNumberId: '109876543210987',
					businessAccountId: '209876543210987',
					accessToken: 'EAABwz...',
					invoiceNotificationsEnabled: true,
					paymentCompletedNotificationsEnabled: true,
				})
			);
			expect(screen.getByText('WhatsApp settings saved successfully.')).toBeInTheDocument();
		});
	});

	it('triggers test connection and displays positive verification feedback', async () => {
		renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /test connection/i }));

		await waitFor(() => {
			expect(api.testWhatsAppConnection).toHaveBeenCalledWith(
				expect.objectContaining({
					phoneNumberId: '109876543210987',
					businessAccountId: '209876543210987',
				})
			);
			expect(screen.getByText('WhatsApp Cloud API connection test successful.')).toBeInTheDocument();
			expect(screen.getByText(/WABA ID verified\. Phone number status: CONNECTED\./i)).toBeInTheDocument();
		});
	});

	it('displays test connection failure details gracefully', async () => {
		vi.mocked(api.testWhatsAppConnection).mockResolvedValue({
			isSuccess: false,
			message: 'Meta API authentication failed.',
			details: 'OAuthException: Error validating access token: Session has expired.',
		});

		renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /test connection/i }));

		await waitFor(() => {
			expect(screen.getByText('Meta API authentication failed.')).toBeInTheDocument();
			expect(screen.getByText(/OAuthException: Error validating access token/i)).toBeInTheDocument();
		});
	});

	describe('Health Monitoring States', () => {
		it('renders AuthenticationFailed state with actionable guidance', async () => {
			vi.mocked(api.getWhatsAppConfig).mockResolvedValue({
				...mockConfig,
				healthStatus: 'AuthenticationFailed',
				lastErrorMessage: 'Token expired',
			});

			renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

			await waitFor(() => {
				expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
				expect(screen.getByText('Please update the WhatsApp access token')).toBeInTheDocument();
			});
		});

		it('renders ConfigurationInvalid state with actionable guidance', async () => {
			vi.mocked(api.getWhatsAppConfig).mockResolvedValue({
				...mockConfig,
				healthStatus: 'ConfigurationInvalid',
				lastErrorMessage: 'Phone Number ID does not match WABA',
			});

			renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

			await waitFor(() => {
				expect(screen.getByText('Configuration Invalid')).toBeInTheDocument();
				expect(screen.getByText('Check Phone Number ID / Business Account ID')).toBeInTheDocument();
			});
		});

		it('renders TemporarilyUnavailable state with actionable guidance', async () => {
			vi.mocked(api.getWhatsAppConfig).mockResolvedValue({
				...mockConfig,
				healthStatus: 'TemporarilyUnavailable',
				lastErrorMessage: 'Meta server error 500',
			});

			renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

			await waitFor(() => {
				expect(screen.getByText('Temporarily Unavailable')).toBeInTheDocument();
				expect(screen.getByText('Meta/WhatsApp service could not be reached')).toBeInTheDocument();
			});
		});
	});

	it('renders discovered message templates and allows expanding components', async () => {
		renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

		// Wait for template list item button to render
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^e6_carspa_invoice_generated/ })).toBeInTheDocument();
		});

		// Click template expand button in Section 2
		const expandBtn = screen.getByRole('button', { name: /^e6_carspa_invoice_generated/ });
		fireEvent.click(expandBtn);

		await waitFor(() => {
			expect(screen.getByText('Body Text')).toBeInTheDocument();
			expect(screen.getByText(/Variables: \{\{1\}\}/)).toBeInTheDocument();
		});
	});

	it('handles template fetch error and provides expired token remediation banner', async () => {
		vi.mocked(api.getWhatsAppTemplates).mockResolvedValue({
			isSuccess: false,
			templates: [],
			totalCount: 0,
			message: 'Meta Access Token Expired (code 190)',
		});

		renderWithProviders(<WhatsAppSettingsSection canManage={true} />);

		await waitFor(() => {
			expect(screen.getByText('Meta Access Token Expired (code 190)')).toBeInTheDocument();
			expect(screen.getByText(/Meta Access Token Expired \(Action Required\)/i)).toBeInTheDocument();
		});
	});
});
