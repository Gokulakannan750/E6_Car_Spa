import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from './auth-context';
import LoginPage from './LoginPage';
import type { AuthContextValue } from './auth-context';
import type { AuthUserResponse } from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getPublicBusinessProfile: async () => ({ businessName: '', logoPath: null, updatedAt: null }) };
});

const user: AuthUserResponse = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner', isOwner: true, permissions: [] };

function renderLogin(state?: unknown) {
	const auth: AuthContextValue = {
		user,
		token: 't',
		isAuthenticated: true,
		isOwner: true,
		isInitialized: true,
		isLoading: false,
		sessionExpiredMessage: null,
		hasPermission: () => true,
		login: async () => user,
		logout: () => {},
		clearSessionExpiredMessage: () => {},
		refreshAuth: async () => {},
		checkInitialization: async () => true,
	};
	return render(
		<AuthContext.Provider value={auth}>
			<MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route path="/dashboard" element={<p>Dashboard page</p>} />
					<Route path="/franchise-invite/:token" element={<p>Invitation page</p>} />
				</Routes>
			</MemoryRouter>
		</AuthContext.Provider>,
	);
}

describe('After signing in, the login page returns to where the person was heading', () => {
	it('goes back to the link that was opened while signed out', async () => {
		renderLogin({ from: { pathname: '/franchise-invite/abc' } });
		expect(await screen.findByText('Invitation page')).toBeInTheDocument();
	});

	it('goes to the dashboard when there was nowhere in particular to go', async () => {
		renderLogin();
		expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
	});
});
