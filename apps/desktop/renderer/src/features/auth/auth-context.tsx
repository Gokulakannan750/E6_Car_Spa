import { useState, useCallback, useContext, createContext, useEffect, type ReactNode } from 'react';
import {
	getAuthStatus,
	getMe,
	loginApi,
	getAuthToken,
	setAuthToken,
	USER_STORAGE_KEY,
	type AuthUserResponse
} from '../../lib/api';
import { useAppStore } from '../../stores/app';

export type AuthUser = AuthUserResponse;

export interface AuthContextValue {
	user: AuthUser | null;
	token: string | null;
	isAuthenticated: boolean;
	isOwner: boolean;
	isInitialized: boolean | null;
	isLoading: boolean;
	hasPermission: (permissionCode?: string) => boolean;
	login: (username: string, password: string) => Promise<AuthUser>;
	logout: () => void;
	refreshAuth: () => Promise<void>;
	checkInitialization: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue>({
	user: null,
	token: null,
	isAuthenticated: false,
	isOwner: false,
	isInitialized: null,
	isLoading: true,
	hasPermission: () => false,
	login: async () => { throw new Error('AuthContext not initialized'); },
	logout: () => {},
	refreshAuth: async () => {},
	checkInitialization: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [token, setTokenState] = useState<string | null>(null);
	const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const setCurrentUser = useAppStore((s) => s.setCurrentUser);

	const syncAppStoreUser = useCallback((u: AuthUser | null) => {
		if (!u) {
			setCurrentUser(null);
			return;
		}
		const nameParts = u.fullName.split(' ');
		setCurrentUser({
			id: u.id,
			username: u.username,
			fullName: u.fullName,
			firstName: nameParts[0] || u.fullName,
			lastName: nameParts.slice(1).join(' ') || '',
			email: u.email,
			role: u.role,
			isOwner: u.isOwner,
			permissions: u.permissions,
		});
	}, [setCurrentUser]);

	const checkInitialization = useCallback(async () => {
		try {
			const res = await getAuthStatus();
			setIsInitialized(res.initialized);
			return res.initialized;
		} catch (err) {
			console.error('Failed to check auth status:', err);
			setIsInitialized(true); // default to true on error to allow login attempt
			return true;
		}
	}, []);

	const logout = useCallback(() => {
		setAuthToken(null);
		setTokenState(null);
		setUser(null);
		syncAppStoreUser(null);
	}, [syncAppStoreUser]);

	const refreshAuth = useCallback(async () => {
		const storedToken = getAuthToken();
		if (!storedToken) {
			setUser(null);
			setTokenState(null);
			syncAppStoreUser(null);
			return;
		}

		try {
			setTokenState(storedToken);
			const me = await getMe();
			setUser(me);
			localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
			syncAppStoreUser(me);
		} catch (err) {
			console.warn('Failed to validate existing token:', err);
			logout();
		}
	}, [logout, syncAppStoreUser]);

	// Initial load: check auth status and existing token
	useEffect(() => {
		let isMounted = true;

		async function init() {
			setIsLoading(true);
			try {
				const initialized = await checkInitialization();
				if (initialized) {
					const existingToken = getAuthToken();
					if (existingToken) {
						setTokenState(existingToken);
						try {
							const me = await getMe();
							if (isMounted) {
								setUser(me);
								localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
								syncAppStoreUser(me);
							}
						} catch {
							if (isMounted) {
								logout();
							}
						}
					}
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		init();

		const handleUnauthorized = () => {
			if (isMounted) {
				logout();
			}
		};

		window.addEventListener('auth:unauthorized', handleUnauthorized);
		return () => {
			isMounted = false;
			window.removeEventListener('auth:unauthorized', handleUnauthorized);
		};
	}, [checkInitialization, logout, syncAppStoreUser]);

	const login = useCallback(async (username: string, password: string) => {
		setIsLoading(true);
		try {
			const res = await loginApi({ username, password });
			setAuthToken(res.token);
			setTokenState(res.token);
			setUser(res.user);
			localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
			syncAppStoreUser(res.user);
			setIsInitialized(true);
			return res.user;
		} finally {
			setIsLoading(false);
		}
	}, [syncAppStoreUser]);

	const hasPermission = useCallback((permissionCode?: string): boolean => {
		if (!user) return false;
		// OWNER RULE: Owner has unrestricted access to all current and future permissions!
		if (user.isOwner || user.role === 'Owner') {
			return true;
		}
		if (!permissionCode) {
			return true;
		}
		return user.permissions?.includes(permissionCode) ?? false;
	}, [user]);

	const isOwner = !!(user && (user.isOwner || user.role === 'Owner'));
	const isAuthenticated = !!(user && token);

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				isAuthenticated,
				isOwner,
				isInitialized,
				isLoading,
				hasPermission,
				login,
				logout,
				refreshAuth,
				checkInitialization,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextValue {
	return useContext(AuthContext);
}
export type { AuthUserResponse as User };
