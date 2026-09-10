import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import LoginForm from './LoginForm';
import { renderWithProviders } from '../../test/test-utils';

describe('LoginForm Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders login form with username, password, and sign in button', () => {
		renderWithProviders(<LoginForm />);

		expect(screen.getByPlaceholderText(/enter your username/i)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
	});

	it('displays validation error when submitting with empty fields', async () => {
		const mockLogin = vi.fn();

		renderWithProviders(<LoginForm />, {
			authContextValue: { login: mockLogin },
		});

		// Submit button clicked without filling form
		const submitButton = screen.getByRole('button', { name: /sign in/i });
		fireEvent.click(submitButton);

		expect(mockLogin).not.toHaveBeenCalled();
	});

	it('handles successful login submission and invokes login with credentials', async () => {
		const mockLogin = vi.fn().mockResolvedValue({
			id: 'user-1',
			username: 'admin',
			fullName: 'Admin User',
			role: 'Owner',
			isOwner: true,
			permissions: ['*'],
		});

		renderWithProviders(<LoginForm />, {
			authContextValue: { login: mockLogin },
		});

		const usernameInput = screen.getByPlaceholderText(/enter your username/i);
		const passwordInput = screen.getByPlaceholderText(/enter your password/i);
		const submitButton = screen.getByRole('button', { name: /sign in/i });

		fireEvent.change(usernameInput, { target: { value: 'admin' } });
		fireEvent.change(passwordInput, { target: { value: 'SecretPassword123' } });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(mockLogin).toHaveBeenCalledWith('admin', 'SecretPassword123');
		});
	});

	it('displays "Invalid username or password." on failed login (HTTP 401) and keeps form mounted and username populated', async () => {
		const authError = {
			status: 401,
			code: 'UNAUTHORIZED',
			message: 'Invalid username or password.',
		};
		const mockLogin = vi.fn().mockRejectedValue(authError);

		renderWithProviders(<LoginForm />, {
			authContextValue: { login: mockLogin },
		});

		const usernameInput = screen.getByPlaceholderText(/enter your username/i) as HTMLInputElement;
		const passwordInput = screen.getByPlaceholderText(/enter your password/i);
		const submitButton = screen.getByRole('button', { name: /sign in/i });

		fireEvent.change(usernameInput, { target: { value: 'wronguser' } });
		fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(screen.getByText('Invalid username or password.')).toBeInTheDocument();
		});

		// Form remains mounted and username remains intact
		expect(usernameInput.value).toBe('wronguser');
		expect(submitButton).not.toBeDisabled();
	});

	it('handles account lockout (HTTP 423) and displays exact message and lockout timer', async () => {
		const lockoutError = {
			status: 423,
			code: 'ACCOUNT_LOCKED',
			message: 'Account temporarily locked. Please try again later.',
			remainingLockoutSeconds: 300,
		};
		const mockLogin = vi.fn().mockRejectedValue(lockoutError);

		renderWithProviders(<LoginForm />, {
			authContextValue: { login: mockLogin },
		});

		const usernameInput = screen.getByPlaceholderText(/enter your username/i);
		const passwordInput = screen.getByPlaceholderText(/enter your password/i);
		const submitButton = screen.getByRole('button', { name: /sign in/i });

		fireEvent.change(usernameInput, { target: { value: 'lockeduser' } });
		fireEvent.change(passwordInput, { target: { value: 'somepassword' } });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(screen.getByText('Account temporarily locked. Please try again later.')).toBeInTheDocument();
			expect(screen.getByText(/Account Locked \(5m 00s\)/i)).toBeInTheDocument();
		});

		expect(usernameInput).toBeDisabled();
		expect(passwordInput).toBeDisabled();
		expect(submitButton).toBeDisabled();
	});

	it('handles rate limiting (HTTP 429) with exact error message', async () => {
		const rateLimitError = {
			status: 429,
			code: 'RATE_LIMITED',
			message: 'Too many attempts. Please try again later.',
		};
		const mockLogin = vi.fn().mockRejectedValue(rateLimitError);

		renderWithProviders(<LoginForm />, {
			authContextValue: { login: mockLogin },
		});

		const usernameInput = screen.getByPlaceholderText(/enter your username/i);
		const passwordInput = screen.getByPlaceholderText(/enter your password/i);
		const submitButton = screen.getByRole('button', { name: /sign in/i });

		fireEvent.change(usernameInput, { target: { value: 'fastuser' } });
		fireEvent.change(passwordInput, { target: { value: 'password123' } });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
		});
	});

	it('handles network error (status 0) with exact connection error message', async () => {
		const networkError = {
			status: 0,
			code: 'NETWORK_ERROR',
			message: 'Unable to connect to the server. Please try again.',
		};
		const mockLogin = vi.fn().mockRejectedValue(networkError);

		renderWithProviders(<LoginForm />, {
			authContextValue: { login: mockLogin },
		});

		const usernameInput = screen.getByPlaceholderText(/enter your username/i);
		const passwordInput = screen.getByPlaceholderText(/enter your password/i);
		const submitButton = screen.getByRole('button', { name: /sign in/i });

		fireEvent.change(usernameInput, { target: { value: 'offlineuser' } });
		fireEvent.change(passwordInput, { target: { value: 'password123' } });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(screen.getByText('Unable to connect to the server. Please try again.')).toBeInTheDocument();
		});
	});

	it('displays sessionExpiredMessage from AuthContext when an authenticated session expired', async () => {
		const clearMock = vi.fn();

		renderWithProviders(<LoginForm />, {
			authContextValue: {
				sessionExpiredMessage: 'Session expired. Please log in again.',
				clearSessionExpiredMessage: clearMock,
			},
		});

		expect(screen.getByText('Session expired. Please log in again.')).toBeInTheDocument();
		expect(clearMock).toHaveBeenCalled();
	});

	it('does not map arbitrary unexpected errors to "Invalid username or password."', async () => {
		const mockLogin = vi.fn().mockRejectedValue(new Error('Unexpected runtime crash'));

		renderWithProviders(<LoginForm />, {
			authContextValue: { login: mockLogin },
		});

		const usernameInput = screen.getByPlaceholderText(/enter your username/i);
		const passwordInput = screen.getByPlaceholderText(/enter your password/i);
		const submitButton = screen.getByRole('button', { name: /sign in/i });

		fireEvent.change(usernameInput, { target: { value: 'user' } });
		fireEvent.change(passwordInput, { target: { value: 'pass' } });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
			expect(screen.queryByText('Invalid username or password.')).not.toBeInTheDocument();
		});
	});

	it('disables input fields and shows signing in state while submitting', async () => {
		let resolveLogin: (value: unknown) => void = () => {};
		const pendingLoginPromise = new Promise((resolve) => {
			resolveLogin = resolve;
		});
		const mockLogin = vi.fn().mockReturnValue(pendingLoginPromise);

		renderWithProviders(<LoginForm />, {
			authContextValue: { login: mockLogin },
		});

		const usernameInput = screen.getByPlaceholderText(/enter your username/i);
		const passwordInput = screen.getByPlaceholderText(/enter your password/i);
		const submitButton = screen.getByRole('button', { name: /sign in/i });

		fireEvent.change(usernameInput, { target: { value: 'admin' } });
		fireEvent.change(passwordInput, { target: { value: 'password' } });
		fireEvent.click(submitButton);

		expect(screen.getByText(/signing in\.\.\./i)).toBeInTheDocument();
		expect(submitButton).toBeDisabled();
		expect(usernameInput).toBeDisabled();
		expect(passwordInput).toBeDisabled();

		// Cleanup pending promise
		resolveLogin({
			id: 'user-1',
			username: 'admin',
			fullName: 'Admin User',
			role: 'Owner',
			isOwner: true,
			permissions: ['*'],
		});
	});
});
