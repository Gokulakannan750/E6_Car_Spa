import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onPasswordChangeRequired, onUnauthorized } from '@/lib/api';
import { clearSession, IDLE_LIMIT_MS, loadSession, saveSession, touchSession, type Session } from '@/lib/session';
import type { AdminRole, SessionResponse } from '@/lib/types';

interface AuthContextValue {
	session: Session | null;
	signedIn: (response: SessionResponse) => void;
	signOut: (reason?: string) => void;
	/** Why the last session ended (shown on the sign-in page). */
	endReason: string | null;
	can: (...roles: AdminRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const [session, setSession] = useState<Session | null>(() => loadSession());
	const [endReason, setEndReason] = useState<string | null>(null);

	const signOut = useCallback(
		(reason?: string) => {
			clearSession();
			queryClient.clear();
			setSession(null);
			setEndReason(reason ?? null);
		},
		[queryClient],
	);

	const signedIn = useCallback((response: SessionResponse) => {
		setSession(saveSession(response));
		setEndReason(null);
	}, []);

	// The API ends the session (expired token, admin switched off).
	useEffect(() => onUnauthorized(() => signOut('Your session ended. Please sign in again.')), [signOut]);

	// The API insists on a password change first: reflect it so the router shows the change-password page.
	useEffect(
		() =>
			onPasswordChangeRequired(() =>
				setSession((s) => (s && !s.admin.mustChangePassword ? { ...s, admin: { ...s.admin, mustChangePassword: true } } : s)),
			),
		[],
	);

	// Idle and expiry: 30 minutes without activity, or the token's own expiry, signs out.
	useEffect(() => {
		if (!session) return;
		const onActivity = () => touchSession();
		ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
		const timer = window.setInterval(() => {
			if (!loadSession()) signOut('You were signed out after 30 minutes without activity, or your session expired.');
		}, Math.min(60_000, IDLE_LIMIT_MS));
		return () => {
			ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
			window.clearInterval(timer);
		};
	}, [session, signOut]);

	const can = useCallback((...roles: AdminRole[]) => !!session && roles.includes(session.admin.role), [session]);

	const value = useMemo(() => ({ session, signedIn, signOut, endReason, can }), [session, signedIn, signOut, endReason, can]);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
	return ctx;
}

/** Role groups matching the API's policies (Platform.Support / Billing / Owner). */
export const SUPPORT_ROLES: AdminRole[] = ['Owner', 'Support'];
export const BILLING_ROLES: AdminRole[] = ['Owner', 'Billing'];
export const OWNER_ROLES: AdminRole[] = ['Owner'];
