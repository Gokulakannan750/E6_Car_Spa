import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { LoginImageCard } from './LoginImageCard';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getBusinessProfile: vi.fn(), uploadLoginImage: vi.fn(), removeLoginImage: vi.fn() };
});

const withoutPicture = { id: 'biz-1', businessName: 'Sunrise', loginImagePath: null, updatedAt: null } as api.BusinessProfileDto;
const withPicture = { ...withoutPicture, loginImagePath: '/uploads/login/login_abc.png' } as api.BusinessProfileDto;

function pick(file: File) {
	const input = screen.getByLabelText('Choose login page picture') as HTMLInputElement;
	fireEvent.change(input, { target: { files: [file] } });
}

describe('LoginImageCard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.setItem(api.BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(withoutPicture));
		vi.mocked(api.getBusinessProfile).mockResolvedValue(withoutPicture);
	});

	it('invites the company to upload a picture when it has none', async () => {
		renderWithProviders(<LoginImageCard canEdit />);
		expect(await screen.findByText('No picture')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /upload picture/i })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
	});

	it('uploads the chosen picture', async () => {
		vi.mocked(api.uploadLoginImage).mockResolvedValue({ imageUrl: withPicture.loginImagePath!, profile: withPicture });
		renderWithProviders(<LoginImageCard canEdit />);

		const file = new File(['png-bytes'], 'banner.png', { type: 'image/png' });
		pick(file);

		await waitFor(() => expect(api.uploadLoginImage).toHaveBeenCalledWith(file));
		expect(await screen.findByText('Login page picture updated.')).toBeInTheDocument();
	});

	it('refuses a file that is not a PNG, JPEG or WebP, or is over 5 MB, without calling the server', async () => {
		renderWithProviders(<LoginImageCard canEdit />);

		pick(new File(['x'], 'notes.txt', { type: 'text/plain' }));
		expect(await screen.findByText('Please choose a PNG, JPEG or WebP picture.')).toBeInTheDocument();

		const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
		pick(big);
		expect(await screen.findByText('The picture cannot be larger than 5 MB.')).toBeInTheDocument();

		expect(api.uploadLoginImage).not.toHaveBeenCalled();
	});

	it('shows the current picture and lets the company remove it', async () => {
		localStorage.setItem(api.BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(withPicture));
		vi.mocked(api.getBusinessProfile).mockResolvedValue(withPicture);
		vi.mocked(api.removeLoginImage).mockResolvedValue(withoutPicture);
		renderWithProviders(<LoginImageCard canEdit />);

		const img = (await screen.findByAltText('Login page')) as HTMLImageElement;
		expect(img.src).toContain('/uploads/login/login_abc.png');

		fireEvent.click(screen.getByRole('button', { name: /remove/i }));

		await waitFor(() => expect(api.removeLoginImage).toHaveBeenCalled());
		expect(await screen.findByText('Login page picture removed.')).toBeInTheDocument();
	});

	it('shows a server error instead of failing silently', async () => {
		vi.mocked(api.uploadLoginImage).mockRejectedValue(new Error('The uploaded file signature does not match a valid image.'));
		renderWithProviders(<LoginImageCard canEdit />);

		pick(new File(['x'], 'a.png', { type: 'image/png' }));

		expect(await screen.findByText(/signature does not match/)).toBeInTheDocument();
	});

	it('is read-only for people who cannot change company settings', async () => {
		renderWithProviders(<LoginImageCard canEdit={false} />);
		expect(await screen.findByText(/only an owner or administrator/i)).toBeInTheDocument();
		expect(screen.queryByLabelText('Choose login page picture')).toBeNull();
	});
});
