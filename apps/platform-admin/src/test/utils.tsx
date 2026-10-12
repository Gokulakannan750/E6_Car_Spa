import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { App, createQueryClient } from '@/app/App';
import { clearSession, saveSession } from '@/lib/session';
import type { AdminRole, PlatformAdmin } from '@/lib/types';

export interface FakeRoute {
	method?: string;
	path: string | RegExp;
	status?: number;
	body?: unknown;
	/** Called with the parsed request body; return a body to override `body`. */
	handle?: (body: unknown, url: string) => unknown;
}

export interface FakeApi {
	calls: { method: string; url: string; body: unknown; auth: string | null }[];
}

/** Replaces fetch with a small route table. Unmatched requests fail the test loudly. */
export function fakeApi(routes: FakeRoute[]): FakeApi {
	const api: FakeApi = { calls: [] };
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		const method = (init?.method ?? 'GET').toUpperCase();
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		const headers = (init?.headers ?? {}) as Record<string, string>;
		api.calls.push({ method, url, body, auth: headers.Authorization ?? null });
		const path = url.split('?')[0]!;
		const route = routes.find(
			(r) => (r.method ?? 'GET') === method && (typeof r.path === 'string' ? r.path === path : r.path.test(path)),
		);
		if (!route) throw new Error(`Unexpected request ${method} ${url}`);
		const result = route.handle ? route.handle(body, url) : route.body;
		const status = route.status ?? 200;
		return new Response(status === 204 ? null : JSON.stringify(result ?? {}), {
			status,
			headers: { 'Content-Type': 'application/json' },
		});
	});
	return api;
}

export function adminWith(role: AdminRole, extra: Partial<PlatformAdmin> = {}): PlatformAdmin {
	return { id: 'a1', email: 'owner@trovo.test', name: 'Test Owner', role, mustChangePassword: false, ...extra };
}

export function signIn(admin: PlatformAdmin) {
	saveSession({ token: 'test-token', expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(), admin });
}

export function renderApp(path: string) {
	window.history.pushState({}, '', path);
	return render(<App queryClient={createQueryClient()} />);
}

export function resetSession() {
	clearSession();
}

export const emptyDashboard = {
	companies: 0,
	subscriptionsByStatus: {},
	monthlyRecurringRevenueMinor: 0,
	openInvoices: 0,
	amountDueMinor: 0,
	awaitingRegistration: 0,
	migrationFailures: 0,
	recentActivity: [],
};
