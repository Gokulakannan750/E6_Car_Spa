import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth-context';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
	getAuthStatus: vi.fn(),
	getMe: vi.fn(),
	loginApi: vi.fn(),
	setAuthToken: vi.fn(),
	initAuthToken: vi.fn().mockResolvedValue(null),
	USER_STORAGE_KEY: 'test_user_key',
}));

function TestConsumer() {
	const { isAuthenticated, isInitialized, isLoading, sessionExpiredMessage, logout, checkInitialization } = useAuth();
	return (
		<div>
			<span data-testid="is-loading">{isLoading ? 'loading' : 'ready'}</span>
			<span data-testid="is-auth">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
			<span data-testid="is-init">{isInitialized === null ? 'null' : isInitialized ? 'initialized' : 'uninitialized'}</span>
			<span data-testid="session-msg">{sessionExpiredMessage || 'no-message'}</span>
			<button onClick={() => logout()} data-testid="btn-logout">Logout</button>
			<button onClick={() => checkInitialization(false, true)} data-testid="btn-check">Check</button>
		</div>
	);
}

describe('AuthProvider Lifecycle & State Revalidation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('1. initializes and sets uninitialized when getAuthStatus reports initialized: false', async () => {
		vi.mocked(api.getAuthStatus).mockResolvedValueOnce({ initialized: false });

		render(
			<AuthProvider>
				<TestConsumer />
			</AuthProvider>
		);

		expect(screen.getByTestId('is-loading').textContent).toBe('loading');

		await act(async () => {
			await Promise.resolve();
		});

		expect(screen.getByTestId('is-loading').textContent).toBe('ready');
		expect(screen.getByTestId('is-init').textContent).toBe('uninitialized');
		expect(screen.getByTestId('is-auth').textContent).toBe('unauthenticated');
	});

	it('2. revalidates on window focus and transitions from uninitialized to initialized when Owner is created', async () => {
		vi.mocked(api.getAuthStatus)
			.mockResolvedValueOnce({ initialized: false }) // initial startup
			.mockResolvedValueOnce({ initialized: true });  // on window focus

		render(
			<AuthProvider>
				<TestConsumer />
			</AuthProvider>
		);

		await act(async () => {
			await Promise.resolve();
		});
		expect(screen.getByTestId('is-init').textContent).toBe('uninitialized');

		// Wait past throttle threshold before window focus
		await act(async () => {
			await new Promise((r) => setTimeout(r, 600));
		});

		// Simulate window gaining focus
		await act(async () => {
			window.dispatchEvent(new Event('focus'));
			await Promise.resolve();
		});

		expect(screen.getByTestId('is-init').textContent).toBe('initialized');
	});

	it('3. on 401 (auth:unauthorized), clears local session and checks status: if users=0, sets uninitialized', async () => {
		vi.mocked(api.getAuthStatus)
			.mockResolvedValueOnce({ initialized: true }) // initial startup
			.mockResolvedValueOnce({ initialized: false }); // after 401, all users deleted

		render(
			<AuthProvider>
				<TestConsumer />
			</AuthProvider>
		);

		await act(async () => {
			await Promise.resolve();
		});
		expect(screen.getByTestId('is-init').textContent).toBe('initialized');

		// Dispatch 401 unauthorized event
		await act(async () => {
			window.dispatchEvent(new CustomEvent('auth:unauthorized'));
			await Promise.resolve();
		});

		expect(screen.getByTestId('is-init').textContent).toBe('uninitialized');
		expect(screen.getByTestId('is-auth').textContent).toBe('unauthenticated');
		expect(screen.getByTestId('session-msg').textContent).toBe('Session expired. Please log in again.');
	});

	it('4. on 401 (auth:unauthorized), if users exist, retains initialized state for Login screen', async () => {
		vi.mocked(api.getAuthStatus)
			.mockResolvedValueOnce({ initialized: true }) // initial startup
			.mockResolvedValueOnce({ initialized: true });  // after 401, users still exist

		render(
			<AuthProvider>
				<TestConsumer />
			</AuthProvider>
		);

		await act(async () => {
			await Promise.resolve();
		});
		expect(screen.getByTestId('is-init').textContent).toBe('initialized');

		// Dispatch 401 unauthorized event
		await act(async () => {
			window.dispatchEvent(new CustomEvent('auth:unauthorized'));
			await Promise.resolve();
		});

		expect(screen.getByTestId('is-init').textContent).toBe('initialized');
		expect(screen.getByTestId('is-auth').textContent).toBe('unauthenticated');
		expect(screen.getByTestId('session-msg').textContent).toBe('Session expired. Please log in again.');
	});

	it('5. deduplicates simultaneous in-flight checkInitialization calls', async () => {
		let resolveCall!: (val: { initialized: boolean }) => void;
		const delayedPromise = new Promise<{ initialized: boolean }>((res) => {
			resolveCall = res;
		});

		vi.mocked(api.getAuthStatus).mockReturnValue(delayedPromise);

		let authContext!: ReturnType<typeof useAuth>;
		function Consumer() {
			authContext = useAuth();
			return null;
		}

		render(
			<AuthProvider>
				<Consumer />
			</AuthProvider>
		);

		// Trigger two concurrent status checks with force=true
		let p1: Promise<boolean>;
		let p2: Promise<boolean>;
		act(() => {
			p1 = authContext.checkInitialization(false, true);
			p2 = authContext.checkInitialization(false, true);
		});

		// Both promises should be the exact same in-flight instance
		expect(p1!).toBe(p2!);
		expect(api.getAuthStatus).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolveCall({ initialized: true });
			await Promise.resolve();
		});

		const res1 = await p1!;
		const res2 = await p2!;
		expect(res1).toBe(true);
		expect(res2).toBe(true);
	});
});
