import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '../features/auth/auth-context';
import type { AuthUserResponse } from '../lib/api';

export type AuthUser = AuthUserResponse;

/**
 * Creates an isolated QueryClient configured for tests with retries disabled and zero cache retention.
 */
export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
			},
			mutations: {
				retry: false,
			},
		},
	});
}

export interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
	queryClient?: QueryClient;
	initialEntries?: string[];
	authContextValue?: Partial<AuthContextValue>;
	authUser?: AuthUser | null;
}

/**
 * Custom render function that wraps tested components with isolated QueryClientProvider,
 * MemoryRouter, and optional AuthContext for robust UI testing.
 */
export function renderWithProviders(
	ui: ReactElement,
	options: ExtendedRenderOptions = {}
) {
	const {
		queryClient = createTestQueryClient(),
		initialEntries = ['/'],
		authContextValue = {},
		authUser = null,
		...renderOptions
	} = options;

	const effectiveUser = authUser ?? authContextValue.user ?? null;
	const isOwner = effectiveUser?.isOwner ?? authContextValue.isOwner ?? false;
	const permissions = effectiveUser?.permissions ?? [];

	const defaultAuthContext: AuthContextValue = {
		user: effectiveUser,
		token: effectiveUser ? 'test-jwt-token' : null,
		isAuthenticated: !!effectiveUser,
		isOwner,
		isInitialized: true,
		isLoading: false,
		hasPermission: (permissionCode?: string) => {
			if (!permissionCode) return true;
			if (isOwner) return true;
			return permissions.includes(permissionCode) || permissions.includes('*');
		},
		login: async () => {
			throw new Error('Not implemented in mock');
		},
		logout: () => {},
		sessionExpiredMessage: null,
		clearSessionExpiredMessage: () => {},
		refreshAuth: async () => {},
		checkInitialization: async () => true,
		...authContextValue,
	};

	function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<AuthContext.Provider value={defaultAuthContext}>
					<MemoryRouter initialEntries={initialEntries}>
						{children}
					</MemoryRouter>
				</AuthContext.Provider>
			</QueryClientProvider>
		);
	}

	return {
		queryClient,
		...render(ui, { wrapper: Wrapper, ...renderOptions }),
	};
}

// Re-export everything from @testing-library/react for convenient imports
export * from '@testing-library/react';
