import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getBusinessProfile: vi.fn(),
		updateBusinessProfile: vi.fn(),
		uploadBusinessLogo: vi.fn(),
		removeBusinessLogo: vi.fn(),
		getWhatsAppConfig: vi.fn(),
		getWhatsAppTemplates: vi.fn(),
	};
});

describe('SettingsPage Component & Business Profile Boundary', () => {
	const mockProfile: api.BusinessProfileDto = {
		id: 'biz-1',
		businessName: 'E6 Car Spa',
		addressLine1: '36, Geetha Nagar Main Road',
		addressLine2: 'Behind Sakthi Mahal, Perundurai Road',
		city: 'Erode',
		state: 'Tamil Nadu',
		postalCode: '638011',
		phone: '9578749449',
		email: 'e6carspaerd@gmail.com',
		gstin: '33AAAAA0000A1Z5',
		invoicePrefix: 'INV',
		logoPath: '/uploads/logo.png',
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-02-01T10:00:00Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getBusinessProfile).mockResolvedValue(mockProfile);
		vi.mocked(api.updateBusinessProfile).mockImplementation(async (payload) => ({
			...mockProfile,
			...payload,
			invoicePrefix: payload.invoicePrefix ?? mockProfile.invoicePrefix ?? 'INV',
			updatedAt: new Date().toISOString(),
		}));
		vi.mocked(api.uploadBusinessLogo).mockResolvedValue({
			profile: { ...mockProfile, logoPath: '/uploads/new-logo.png' },
			logoUrl: '/uploads/new-logo.png',
		});
		vi.mocked(api.removeBusinessLogo).mockResolvedValue({
			...mockProfile,
			logoPath: null,
		});
		vi.mocked(api.getWhatsAppConfig).mockResolvedValue({
			isEnabled: false,
			phoneNumberId: '',
			businessAccountId: '',
			graphApiVersion: 'v25.0',
			hasAccessToken: false,
			invoiceNotificationsEnabled: true,
			paymentCompletedNotificationsEnabled: true,
			invoiceTemplateName: 'e6_carspa_invoice_generated',
			invoiceTemplateLanguage: 'en_US',
			paymentCompletedTemplateName: 'e6_carspa_payment_completed',
			paymentCompletedTemplateLanguage: 'en_US',
			healthStatus: 'NotConfigured',
			lastCheckedAtUtc: null,
			lastErrorMessage: null,
		});
		vi.mocked(api.getWhatsAppTemplates).mockResolvedValue({
			isSuccess: true,
			templates: [],
			totalCount: 0,
			message: '',
		});
	});

	it('loads and renders company settings profile fields', async () => {
		renderWithProviders(<SettingsPage />, {
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.business', 'users.view'],
			},
		});

		await waitFor(() => {
			expect(screen.getByDisplayValue('E6 Car Spa')).toBeInTheDocument();
			expect(screen.getByDisplayValue('36, Geetha Nagar Main Road')).toBeInTheDocument();
			expect(screen.getByDisplayValue('Erode')).toBeInTheDocument();
			expect(screen.getByDisplayValue('Tamil Nadu')).toBeInTheDocument();
			expect(screen.getByDisplayValue('638011')).toBeInTheDocument();
			expect(screen.getByDisplayValue('9578749449')).toBeInTheDocument();
			expect(screen.getByDisplayValue('e6carspaerd@gmail.com')).toBeInTheDocument();
			expect(screen.getByDisplayValue('33AAAAA0000A1Z5')).toBeInTheDocument();
			expect(screen.getByDisplayValue('INV')).toBeInTheDocument();
		});
	});

	it('validates 10-digit phone number and required fields before saving', async () => {
		renderWithProviders(<SettingsPage />, {
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.business'],
			},
		});

		await waitFor(() => {
			expect(screen.getByDisplayValue('E6 Car Spa')).toBeInTheDocument();
		});

		// Set invalid phone number (<10 digits)
		const phoneInput = screen.getByDisplayValue('9578749449');
		fireEvent.change(phoneInput, { target: { value: '95787' } });

		const saveButtons = screen.getAllByRole('button', { name: /save/i });
		fireEvent.click(saveButtons[0]);

		await waitFor(() => {
			expect(screen.getByText('Phone number must be exactly 10 digits without country code.')).toBeInTheDocument();
			expect(api.updateBusinessProfile).not.toHaveBeenCalled();
		});
	});

	it('validates GSTIN format on save and rejects malformed GSTIN', async () => {
		renderWithProviders(<SettingsPage />, {
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.business'],
			},
		});

		await waitFor(() => {
			expect(screen.getByDisplayValue('33AAAAA0000A1Z5')).toBeInTheDocument();
		});

		const gstinInput = screen.getByDisplayValue('33AAAAA0000A1Z5');
		fireEvent.change(gstinInput, { target: { value: 'INVALID_GST_123' } });

		const saveButtons = screen.getAllByRole('button', { name: /save/i });
		fireEvent.click(saveButtons[0]);

		await waitFor(() => {
			expect(screen.getByText(/Invalid GSTIN format\. Expected 15-character format/i)).toBeInTheDocument();
			expect(api.updateBusinessProfile).not.toHaveBeenCalled();
		});
	});

	it('submits updated company profile successfully and shows confirmation', async () => {
		renderWithProviders(<SettingsPage />, {
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.business'],
			},
		});

		await waitFor(() => {
			expect(screen.getByDisplayValue('E6 Car Spa')).toBeInTheDocument();
		});

		const cityInput = screen.getByDisplayValue('Erode');
		fireEvent.change(cityInput, { target: { value: 'Coimbatore' } });

		const saveButtons = screen.getAllByRole('button', { name: /save/i });
		fireEvent.click(saveButtons[0]);

		await waitFor(() => {
			expect(api.updateBusinessProfile).toHaveBeenCalledWith(
				expect.objectContaining({
					city: 'Coimbatore',
					phone: '9578749449',
					businessName: 'E6 Car Spa',
				})
			);
			expect(screen.getByText('Business profile and invoice settings saved successfully.')).toBeInTheDocument();
		});
	});

	it('handles logo file upload and rejects files over 5MB', async () => {
		renderWithProviders(<SettingsPage />, {
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.business'],
			},
		});

		await waitFor(() => {
			expect(screen.getByText('Change Logo')).toBeInTheDocument();
		});

		const largeFile = new File(['a'.repeat(6 * 1024 * 1024)], 'large-logo.png', { type: 'image/png' });
		Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 });

		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
		fireEvent.change(fileInput, { target: { files: [largeFile] } });

		await waitFor(() => {
			expect(screen.getByText('Logo file size cannot exceed 5 MB.')).toBeInTheDocument();
			expect(api.uploadBusinessLogo).not.toHaveBeenCalled();
		});
	});

	it('removes logo after user confirmation', async () => {
		vi.spyOn(window, 'confirm').mockReturnValue(true);

		renderWithProviders(<SettingsPage />, {
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.business'],
			},
		});

		await waitFor(() => {
			expect(screen.getByText('Remove')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Remove'));

		await waitFor(() => {
			expect(api.removeBusinessLogo).toHaveBeenCalled();
			expect(screen.getByText('Logo removed successfully.')).toBeInTheDocument();
		});
	});

	it('renders Company Settings cleanly without duplicate WhatsApp tab bar', async () => {
		renderWithProviders(<SettingsPage />, {
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.business', 'users.view'],
			},
		});

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Company Settings', level: 1 })).toBeInTheDocument();
		});

		// Verify that WhatsApp tab is NOT rendered inside Company Settings
		expect(screen.queryByText('WhatsApp Business Integration')).not.toBeInTheDocument();
		expect(screen.queryByText('Cloud API Architecture')).not.toBeInTheDocument();
	});

	it('redirects legacy /settings?tab=whatsapp to /settings/whatsapp for backward compatibility', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/settings" element={<SettingsPage />} />
				<Route path="/settings/whatsapp" element={<div>WhatsApp Target Page</div>} />
			</Routes>,
			{
				initialEntries: ['/settings?tab=whatsapp'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['settings.business'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('WhatsApp Target Page')).toBeInTheDocument();
		});
	});

	it('redirects legacy /settings?tab=system to /settings/system for backward compatibility', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/settings" element={<SettingsPage />} />
				<Route path="/settings/system" element={<div>System Target Page</div>} />
			</Routes>,
			{
				initialEntries: ['/settings?tab=system'],
				authUser: {
					id: 'usr-1',
					fullName: 'Admin User',
					username: 'admin',
					role: 'Owner',
					isOwner: true,
					permissions: ['settings.business'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('System Target Page')).toBeInTheDocument();
		});
	});
});
