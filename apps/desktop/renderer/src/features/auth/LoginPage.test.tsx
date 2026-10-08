import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getPublicBusinessProfile: vi.fn() };
});

function bannerImages(container: HTMLElement) {
	return Array.from(container.querySelectorAll('img')).filter((img) => img.className.includes('object-cover'));
}

describe('LoginPage background picture', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	it('uses a plain colour background when the company has not uploaded a picture', async () => {
		vi.mocked(api.getPublicBusinessProfile).mockResolvedValue({
			businessName: 'Sunrise Detailing',
			logoPath: null,
			updatedAt: null,
			loginImagePath: null,
		});
		const { container } = renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

		expect((await screen.findAllByText('Sunrise Detailing')).length).toBeGreaterThan(0);
		expect(bannerImages(container)).toHaveLength(0);
	});

	it('shows the company\'s own picture when it has uploaded one', async () => {
		vi.mocked(api.getPublicBusinessProfile).mockResolvedValue({
			businessName: 'Sunrise Detailing',
			logoPath: null,
			updatedAt: '2026-10-08T10:00:00Z',
			loginImagePath: '/uploads/login/login_abc.png',
		});
		const { container } = renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

		await waitFor(() => expect(bannerImages(container)).toHaveLength(1));
		expect(bannerImages(container)[0].src).toContain('/uploads/login/login_abc.png');
	});

	it('does not ship any built-in photo', async () => {
		vi.mocked(api.getPublicBusinessProfile).mockResolvedValue({ businessName: '', logoPath: null, updatedAt: null });
		const { container } = renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

		await screen.findAllByText('Car Spa Management');
		expect(container.innerHTML).not.toMatch(/login-banner/);
	});
});
