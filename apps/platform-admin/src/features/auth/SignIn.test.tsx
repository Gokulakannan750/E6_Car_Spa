import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { adminWith, emptyDashboard, fakeApi, renderApp, signIn } from '@/test/utils';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));

const session = (mustChangePassword = false) => ({
	token: 'session-token',
	expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
	admin: adminWith('Owner', { mustChangePassword }),
});

const dashboardRoutes = [
	{ path: '/api/platform/dashboard', body: emptyDashboard },
	{ path: '/api/platform/companies', body: [] },
];

describe('sign-in', () => {
	it('asks for the password, then the authenticator code, then opens the dashboard', async () => {
		const api = fakeApi([
			{ method: 'POST', path: '/api/platform/auth/login', body: { stage: 'totp', challengeToken: 'challenge', totpSecret: null, authenticatorUri: null } },
			{ method: 'POST', path: '/api/platform/auth/verify', body: session() },
			...dashboardRoutes,
		]);
		const user = userEvent.setup();
		renderApp('/dashboard');

		await user.type(await screen.findByLabelText('Staff email'), 'owner@trovo.test');
		await user.type(screen.getByLabelText('Password'), 'correct horse battery');
		await user.click(screen.getByRole('button', { name: /continue/i }));

		await user.type(await screen.findByLabelText('Authentication code'), '123456');
		await user.click(screen.getByRole('button', { name: 'Verify' }));

		expect(await screen.findByRole('heading', { name: 'Operations overview' })).toBeInTheDocument();
		expect(api.calls.find((c) => c.url.endsWith('/auth/verify'))?.body).toEqual({ challengeToken: 'challenge', code: '123456' });
		await waitFor(() => expect(api.calls.find((c) => c.url.endsWith('/dashboard'))?.auth).toBe('Bearer session-token'));
	});

	it('shows the QR code and key the first time, to set up the authenticator', async () => {
		fakeApi([
			{
				method: 'POST',
				path: '/api/platform/auth/login',
				body: { stage: 'totp-setup', challengeToken: 'c', totpSecret: 'JBSWY3DPEHPK3PXP', authenticatorUri: 'otpauth://totp/Trovo:owner?secret=JBSWY3DPEHPK3PXP' },
			},
		]);
		const user = userEvent.setup();
		renderApp('/sign-in');
		await user.type(await screen.findByLabelText('Staff email'), 'owner@trovo.test');
		await user.type(screen.getByLabelText('Password'), 'pw');
		await user.click(screen.getByRole('button', { name: /continue/i }));

		expect(await screen.findByRole('heading', { name: 'Set up your authenticator' })).toBeInTheDocument();
		expect(await screen.findByAltText('Authenticator QR code')).toHaveAttribute('src', 'data:image/png;base64,QR');
		expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
	});

	it('shows the server message for a wrong password and clears the password', async () => {
		fakeApi([{ method: 'POST', path: '/api/platform/auth/login', status: 401, body: { error: 'Invalid email or password.' } }]);
		const user = userEvent.setup();
		renderApp('/sign-in');
		await user.type(await screen.findByLabelText('Staff email'), 'owner@trovo.test');
		await user.type(screen.getByLabelText('Password'), 'wrong');
		await user.click(screen.getByRole('button', { name: /continue/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
		expect(screen.getByLabelText('Password')).toHaveValue('');
	});

	it('refuses everything until a one-time password is replaced', async () => {
		fakeApi([
			{ method: 'POST', path: '/api/platform/auth/login', body: { stage: 'totp', challengeToken: 'c', totpSecret: null, authenticatorUri: null } },
			{ method: 'POST', path: '/api/platform/auth/verify', body: session(true) },
			{
				method: 'POST',
				path: '/api/platform/auth/change-password',
				handle: () => session(false),
			},
			...dashboardRoutes,
		]);
		const user = userEvent.setup();
		renderApp('/companies');
		await user.type(await screen.findByLabelText('Staff email'), 'owner@trovo.test');
		await user.type(screen.getByLabelText('Password'), 'one-time-pass');
		await user.click(screen.getByRole('button', { name: /continue/i }));
		await user.type(await screen.findByLabelText('Authentication code'), '654321');
		await user.click(screen.getByRole('button', { name: 'Verify' }));

		expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
		await user.type(screen.getByLabelText('Current password'), 'one-time-pass');
		await user.type(screen.getByLabelText('New password'), 'short');
		await user.type(screen.getByLabelText('Confirm new password'), 'short');
		await user.click(screen.getByRole('button', { name: 'Save and continue' }));
		expect(await screen.findByText('Use at least 12 characters.')).toBeInTheDocument();

		await user.clear(screen.getByLabelText('New password'));
		await user.type(screen.getByLabelText('New password'), 'a much longer pass');
		await user.clear(screen.getByLabelText('Confirm new password'));
		await user.type(screen.getByLabelText('Confirm new password'), 'a much longer pass');
		await user.click(screen.getByRole('button', { name: 'Save and continue' }));

		expect(await screen.findByRole('heading', { name: 'Operations overview' })).toBeInTheDocument();
	});

	it('goes back to sign-in when the API ends the session', async () => {
		signIn(adminWith('Owner'));
		fakeApi([
			{ path: '/api/platform/dashboard', status: 401, body: {} },
			{ path: '/api/platform/companies', status: 401, body: {} },
		]);
		renderApp('/dashboard');
		expect(await screen.findByText('Your session ended. Please sign in again.')).toBeInTheDocument();
		await waitFor(() => expect(window.sessionStorage.length).toBe(0));
	});
});
