import { useState, useCallback, useContext, createContext, useEffect, useRef, type ReactNode } from 'react';
import {
	getAuthStatus,
	getMe,
	loginApi,
	setAuthToken,
	initAuthToken,
	USER_STORAGE_KEY,
	rememberCompanyCode,
	getRememberedCompanyCode,
	setCachedBusinessProfile,
	type AuthUserResponse
} from '../../lib/api';

import { useAppStore } from '../../stores/app';

export type AuthUser = AuthUserResponse;

/** Raised whenever the signed-in person (and so possibly the company) changes or the session ends. */
export const SESSION_CHANGED_EVENT = 'auth:session-changed';

/**
 * Tells the app to forget everything it has loaded. Without this, someone who signs out and in as another company in
 * the same window could briefly see the previous company's data (lists, figures, what the company may do).
 */
function announceSessionChange() {
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
	}
}

export interface AuthContextValue {
	user: AuthUser | null;
	token: string | null;
	isAuthenticated: boolean;
	isOwner: boolean;
	isInitialized: boolean | null;
	isLoading: boolean;
	sessionExpiredMessage: string | null;
	hasPermission: (permissionCode?: string) => boolean;
	login: (username: string, password: string, companyCode?: string) => Promise<AuthUser>;
	logout: () => void;
	clearSessionExpiredMessage: () => void;
	refreshAuth: () => Promise<void>;
	checkInitialization: (isInitialStartup?: boolean, force?: boolean) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue>({
	user: null,
	token: null,
	isAuthenticated: false,
	isOwner: false,
	isInitialized: null,
	isLoading: true,
	sessionExpiredMessage: null,
	hasPermission: () => false,
	login: async () => { throw new Error('AuthContext not initialized'); },
	logout: () => {},
	clearSessionExpiredMessage: () => {},
	refreshAuth: async () => {},
	checkInitialization: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [token, setTokenState] = useState<string | null>(null);
	const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
	const setCurrentUser = useAppStore((s) => s.setCurrentUser);

	const isInitializedRef = useRef<boolean | null>(isInitialized);
	isInitializedRef.current = isInitialized;

	const inFlightCheckRef = useRef<Promise<boolean> | null>(null);
	const lastCheckTimeRef = useRef<number>(0);

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

	const checkInitialization = useCallback((isInitialStartup: boolean = false, force: boolean = false): Promise<boolean> => {
		if (inFlightCheckRef.current) {
			return inFlightCheckRef.current;
		}

		const now = Date.now();
		if (!force && !isInitialStartup && isInitializedRef.current !== null && (now - lastCheckTimeRef.current) < 500) {
			return Promise.resolve(isInitializedRef.current);
		}

		const checkPromise = (async () => {
			try {
				const res = await getAuthStatus();
				lastCheckTimeRef.current = Date.now();
				setIsInitialized(res.initialized);
				if (!res.initialized) {
					// Database has zero users: cleanly wipe local session so app routes to setup
					setAuthToken(null);
					setTokenState(null);
					setUser(null);
					syncAppStoreUser(null);
					if (typeof localStorage !== 'undefined') {
						localStorage.removeItem(USER_STORAGE_KEY);
					}
				}
				return res.initialized;
			} catch (err) {
				console.error('Failed to check auth status:', err);
				// During initial startup when state is unknown, default to true to allow login attempt.
				// If already known, preserve existing state so network errors do not disrupt the screen.
				if (isInitialStartup) {
					setIsInitialized(true);
					return true;
				}
				return isInitializedRef.current ?? false;
			} finally {
				inFlightCheckRef.current = null;
			}
		})();

		inFlightCheckRef.current = checkPromise;
		return checkPromise;
	}, [syncAppStoreUser]);

	const logout = useCallback(async () => {
		announceSessionChange();
		setAuthToken(null);
		setTokenState(null);
		setUser(null);
		syncAppStoreUser(null);
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(USER_STORAGE_KEY);
		}
		try {
			await checkInitialization(false, true);
		} catch {
			// ignore network error
		}
	}, [checkInitialization, syncAppStoreUser]);

	const refreshAuth = useCallback(async () => {
		const storedToken = await initAuthToken();
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

	// Initial load and window lifecycle revalidation
	useEffect(() => {
		let isMounted = true;

		async function init() {
			setIsLoading(true);
			try {
				const initialized = await checkInitialization(true, true);
				if (initialized) {
					const existingToken = await initAuthToken();
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

		const handleRevalidation = async () => {
			if (!isMounted) return;
			try {
				await checkInitialization(false, false);
			} catch {
				// transient failure
			}
		};

		const handleFocus = () => {
			handleRevalidation();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				handleRevalidation();
			}
		};

		const handleUnauthorized = async () => {
			if (!isMounted) return;
			setSessionExpiredMessage('Session expired. Please log in again.');
			announceSessionChange();
			setAuthToken(null);
			setTokenState(null);
			setUser(null);
			syncAppStoreUser(null);
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem(USER_STORAGE_KEY);
			}
			// Case D: Re-check auth initialization state
			try {
				await checkInitialization(false, true);
			} catch {
				// network error, retain existing
			}
		};

		window.addEventListener('focus', handleFocus);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('auth:unauthorized', handleUnauthorized);

		return () => {
			isMounted = false;
			window.removeEventListener('focus', handleFocus);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('auth:unauthorized', handleUnauthorized);
		};
	}, [checkInitialization, logout, syncAppStoreUser]);

	const clearSessionExpiredMessage = useCallback(() => {
		setSessionExpiredMessage(null);
	}, []);

	const login = useCallback(async (username: string, password: string, companyCode?: string) => {
		setSessionExpiredMessage(null);
		const previousCompany = getRememberedCompanyCode();
		const res = await loginApi({ username, password, companyCode: companyCode?.trim() || undefined });
		const signedInTo = res.companyCode || companyCode?.trim() || '';
		// A different company: nothing the previous one loaded (lists, profile, what it may do) may carry over.
		announceSessionChange();
		if (previousCompany && signedInTo && previousCompany.toUpperCase() !== signedInTo.toUpperCase()) {
			setCachedBusinessProfile(null);
		}
		rememberCompanyCode(signedInTo);
		setAuthToken(res.token);
		setTokenState(res.token);
		setUser(res.user);
		localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
		syncAppStoreUser(res.user);
		setIsInitialized(true);
		return res.user;
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
				sessionExpiredMessage,
				hasPermission,
				login,
				logout,
				clearSessionExpiredMessage,
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
