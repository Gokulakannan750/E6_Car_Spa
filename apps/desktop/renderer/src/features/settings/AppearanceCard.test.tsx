import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { AppearanceCard } from './AppearanceCard';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getBusinessProfile: vi.fn(), updateAppearance: vi.fn() };
});

const profile = {
	id: 'biz-1',
	businessName: 'Sunrise',
	appColor: '#0F766E',
	sidebarColor: null,
	brandColor: '#A11A1A',
} as api.BusinessProfileDto;

describe('AppearanceCard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.setItem(api.BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(profile));
		vi.mocked(api.getBusinessProfile).mockResolvedValue(profile);
	});

	it('shows the saved colours and previews a new app colour straight away', async () => {
		renderWithProviders(<AppearanceCard canEdit />);

		const appCode = (await screen.findByLabelText('App colour code')) as HTMLInputElement;
		await waitFor(() => expect(appCode.value).toBe('#0F766E'));
		expect((screen.getByLabelText('Invoices and job cards code') as HTMLInputElement).value).toBe('#A11A1A');

		fireEvent.change(appCode, { target: { value: '#7C3AED' } });
		expect(document.documentElement.style.getPropertyValue('--app-600')).toBe('#7C3AED');
	});

	it('saves all three colours', async () => {
		vi.mocked(api.updateAppearance).mockResolvedValue({ ...profile, sidebarColor: '#112233' });
		renderWithProviders(<AppearanceCard canEdit />);

		const side = (await screen.findByLabelText('Sidebar and login page code')) as HTMLInputElement;
		await waitFor(() => expect((screen.getByLabelText('App colour code') as HTMLInputElement).value).toBe('#0F766E'));
		fireEvent.change(side, { target: { value: '#112233' } });
		fireEvent.click(screen.getByRole('button', { name: /save colours/i }));

		await waitFor(() =>
			expect(api.updateAppearance).toHaveBeenCalledWith({
				appColor: '#0F766E',
				sidebarColor: '#112233',
				brandColor: '#A11A1A',
			})
		);
		expect(await screen.findByText(/colours saved/i)).toBeInTheDocument();
	});

	it('does not allow saving an invalid colour code', async () => {
		renderWithProviders(<AppearanceCard canEdit />);
		const side = (await screen.findByLabelText('Sidebar and login page code')) as HTMLInputElement;
		fireEvent.change(side, { target: { value: '#12' } });

		expect(screen.getByText(/enter a colour code/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /save colours/i })).toBeDisabled();
	});

	it('is read-only for people who cannot change company settings', async () => {
		renderWithProviders(<AppearanceCard canEdit={false} />);
		expect(await screen.findByText(/only an owner or administrator/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /save colours/i })).toBeNull();
		expect(screen.getByLabelText('App colour code')).toBeDisabled();
	});

	it('repaints the live preview as colours are chosen', async () => {
		renderWithProviders(<AppearanceCard canEdit />);
		await waitFor(() => expect((screen.getByLabelText('App colour code') as HTMLInputElement).value).toBe('#0F766E'));

		const rgb = (hex: string) => {
			const n = parseInt(hex.slice(1), 16);
			return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
		};

		expect(screen.getByTestId('preview-button')).toHaveStyle({ backgroundColor: rgb('#0F766E') });
		expect(screen.getByTestId('preview-invoice-rule')).toHaveStyle({ backgroundColor: rgb('#A11A1A') });

		fireEvent.change(screen.getByLabelText('App colour code'), { target: { value: '#7C3AED' } });
		fireEvent.change(screen.getByLabelText('Sidebar and login page code'), { target: { value: '#BE185D' } });
		fireEvent.change(screen.getByLabelText('Invoices and job cards code'), { target: { value: '#0E7490' } });

		expect(screen.getByTestId('preview-button')).toHaveStyle({ backgroundColor: rgb('#7C3AED') });
		expect(screen.getByTestId('preview-signin')).toHaveStyle({ backgroundColor: rgb('#BE185D') });
		expect(screen.getByTestId('preview-invoice-rule')).toHaveStyle({ backgroundColor: rgb('#0E7490') });
		expect(screen.getByTestId('preview-invoice-title')).toHaveStyle({ color: rgb('#0E7490') });
	});

	it('shows the company name in the invoice preview', async () => {
		renderWithProviders(<AppearanceCard canEdit />);
		expect(await screen.findByTestId('preview-invoice-title')).toHaveTextContent('Sunrise');
	});
});
