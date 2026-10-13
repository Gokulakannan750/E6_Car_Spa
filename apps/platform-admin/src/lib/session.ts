import type { PlatformAdmin, SessionResponse } from './types';

// The session lives in memory and in this browser tab's sessionStorage (so a reload keeps it, a closed tab ends it).
// Nothing goes to localStorage. Sessions end when the token expires or after 30 minutes without activity.

const STORAGE_KEY = 'trovo.platform.session';
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

export interface Session {
	token: string;
	expiresAt: string;
	admin: PlatformAdmin;
	lastActivityAt: number;
}

let current: Session | null = null;

function storage(): Storage | null {
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}

function persist(session: Session | null): void {
	const store = storage();
	if (!store) return;
	try {
		if (session) store.setItem(STORAGE_KEY, JSON.stringify(session));
		else store.removeItem(STORAGE_KEY);
	} catch {
		// Storage can be unavailable (private mode); the in-memory session still works.
	}
}

export function isExpired(session: Session, now = Date.now()): boolean {
	const expiresAt = new Date(session.expiresAt).getTime();
	return !Number.isFinite(expiresAt)
		|| !Number.isFinite(session.lastActivityAt)
		|| session.lastActivityAt > now
		|| expiresAt <= now
		|| now - session.lastActivityAt >= IDLE_LIMIT_MS;
}

export function loadSession(now = Date.now()): Session | null {
	if (current) return isExpired(current, now) ? clearSession() : current;
	const store = storage();
	if (!store) return null;
	try {
		const raw = store.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Session;
		if (!parsed || typeof parsed.token !== 'string' || !parsed.token.trim()
			|| !parsed.admin || typeof parsed.admin !== 'object'
			|| typeof parsed.expiresAt !== 'string' || isExpired(parsed, now)) return clearSession();
		current = parsed;
		return current;
	} catch {
		return clearSession();
	}
}

export function saveSession(response: SessionResponse, now = Date.now()): Session {
	current = { token: response.token, expiresAt: response.expiresAt, admin: response.admin, lastActivityAt: now };
	persist(current);
	return current;
}

/** Records user activity; stored at most once a minute so typing does not hammer storage. */
export function touchSession(now = Date.now()): void {
	if (!current) return;
	if (isExpired(current, now)) {
		clearSession();
		return;
	}
	if (now - current.lastActivityAt < 60_000) return;
	current = { ...current, lastActivityAt: now };
	persist(current);
}

export function clearSession(): null {
	current = null;
	persist(null);
	return null;
}

export function currentToken(): string | null {
	return loadSession()?.token ?? null;
}
