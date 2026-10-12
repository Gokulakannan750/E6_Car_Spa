import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterCompanyPage from './RegisterCompanyPage';
import LoginPage from './LoginPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async () => {
	const actual = await vi.importActual('../../lib/api');
	return {
		...actual,
		getAuthStatus: vi.fn(),
		registerCompany: vi.fn(),
		rememberCompanyCode: vi.fn(),
		getPublicBusinessProfile: vi.fn(),
	};
});

function fill(label: RegExp, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValidForm() {
	fill(/company code/i, '0002');
	fill(/registration code/i, 'k7qm-4rtx-9pwd');
	fill(/owner full name/i, 'sunrise owner');
	fill(/^username/i, 'Owner');
	fill(/^password/i, 'Sunrise#2026');
	fill(/confirm password/i, 'Sunrise#2026');
}

describe('RegisterCompanyPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('asks for the company code and registration code from Trovo, and the Owner account', () => {
		renderWithProviders(<RegisterCompanyPage />, { initialEntries: ['/register'] });

		expect(screen.getByText('Register Your Company')).toBeInTheDocument();
		expect(screen.getByLabelText(/company code/i)).toHaveValue('');
		expect(screen.getByLabelText(/registration code/i)).toHaveValue('');
		expect(screen.getByLabelText(/owner full name/i)).toBeInTheDocument();
		expect(screen.getByText(/works only once/i)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /already registered\? sign in/i })).toHaveAttribute('href', '/login');
	});

	it('sends the codes and the Owner account, then remembers the company code', async () => {
		vi.mocked(api.registerCompany).mockResolvedValue({
			id: 'u1', fullName: 'Sunrise Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [], companyCode: '0002',
		} as unknown as Awaited<ReturnType<typeof api.registerCompany>>);
		renderWithProviders(<RegisterCompanyPage />, { initialEntries: ['/register'] });

		fillValidForm();
		fireEvent.click(screen.getByRole('button', { name: /register company/i }));

		await waitFor(() => expect(api.registerCompany).toHaveBeenCalledWith({
			companyCode: '0002',
			registrationCode: 'K7QM-4RTX-9PWD',
			fullName: 'Sunrise owner',
			username: 'owner',
			password: 'Sunrise#2026',
			confirmPassword: 'Sunrise#2026',
		}));
		expect(api.rememberCompanyCode).toHaveBeenCalledWith('0002');
		expect(await screen.findByText(/company 0002 is registered/i)).toBeInTheDocument();
	});

	it('shows the server message when the codes are wrong', async () => {
		vi.mocked(api.registerCompany).mockRejectedValue(new api.ApiError('Invalid company code or registration code.', 400, null));
		renderWithProviders(<RegisterCompanyPage />, { initialEntries: ['/register'] });

		fillValidForm();
		fireEvent.click(screen.getByRole('button', { name: /register company/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent('Invalid company code or registration code.');
		expect(api.rememberCompanyCode).not.toHaveBeenCalled();
	});

	it('does not send anything until both codes are filled in', () => {
		renderWithProviders(<RegisterCompanyPage />, { initialEntries: ['/register'] });

		fillValidForm();
		fill(/registration code/i, '');
		fireEvent.click(screen.getByRole('button', { name: /register company/i }));

		expect(screen.getByRole('alert')).toHaveTextContent('Registration code is required.');
		expect(api.registerCompany).not.toHaveBeenCalled();
	});
});

describe('LoginPage registration link', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getPublicBusinessProfile).mockResolvedValue({ businessName: '', logoPath: null } as unknown as Awaited<ReturnType<typeof api.getPublicBusinessProfile>>);
	});

	it('offers registration on Trovo\'s platform', async () => {
		vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: true, companyRegistration: true });
		renderWithProviders(<LoginPage />, { authContextValue: { isInitialized: true }, initialEntries: ['/login'] });

		expect(await screen.findByRole('link', { name: /register with the codes from trovo/i })).toHaveAttribute('href', '/register');
	});

	it('does not offer registration on a single-company server', async () => {
		vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: true });
		renderWithProviders(<LoginPage />, { authContextValue: { isInitialized: true }, initialEntries: ['/login'] });

		await waitFor(() => expect(api.getAuthStatus).toHaveBeenCalled());
		expect(screen.queryByRole('link', { name: /register with the codes/i })).not.toBeInTheDocument();
	});
});
