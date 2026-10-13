import { currentToken } from './session';
import type {
	AdminListItem,
	AdminRole,
	AuditEntry,
	BillingAccount,
	Catalog,
	CompanyBilling,
	CompanyDetail,
	CompanyListItem,
	CreateCompanyResponse,
	Dashboard,
	Invoice,
	InvoiceDetail,
	InvoiceListItem,
	Licences,
	LoginResponse,
	MigrationStatus,
	Payment,
	PlanRequest,
	PlanTermsInput,
	PlatformAdmin,
	PlatformSettings,
	RegistrationCodeResponse,
	SignupOrder,
	SessionResponse,
} from './types';

// In development VITE_API_URL is empty and /api goes through the Vite dev server; in production it is the API address.
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
const passwordChangeListeners = new Set<Listener>();

/** Called when the API says the session is no longer valid (401). */
export function onUnauthorized(listener: Listener): () => void {
	unauthorizedListeners.add(listener);
	return () => unauthorizedListeners.delete(listener);
}

/** Called when the API refuses because the admin must change their password first. */
export function onPasswordChangeRequired(listener: Listener): () => void {
	passwordChangeListeners.add(listener);
	return () => passwordChangeListeners.delete(listener);
}

async function readError(response: Response): Promise<ApiError> {
	let message = `Request failed (${response.status}).`;
	let code: string | undefined;
	try {
		const body = await response.json();
		if (typeof body?.error === 'string') message = body.error;
		else if (typeof body?.message === 'string') message = body.message;
		else if (typeof body?.title === 'string') message = body.title;
		if (body?.errors && typeof body.errors === 'object') {
			const first = Object.values(body.errors as Record<string, string[]>)[0]?.[0];
			if (first) message = first;
		}
		if (typeof body?.code === 'string') code = body.code;
	} catch {
		// Not JSON; keep the generic message.
	}
	if (response.status === 403 && !code && message.startsWith('Request failed')) {
		message = 'Your role does not allow this.';
	}
	return new ApiError(message, response.status, code);
}

interface RequestOptions {
	method?: string;
	body?: unknown;
	/** Sign-in calls handle 401 themselves (wrong password) instead of ending the session. */
	anonymous?: boolean;
	token?: string;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (options.body !== undefined) headers['Content-Type'] = 'application/json';
	const token = options.token ?? (options.anonymous ? null : currentToken());
	if (token) headers.Authorization = `Bearer ${token}`;

	let response: Response;
	try {
		response = await fetch(`${BASE_URL}${path}`, {
			method: options.method ?? 'GET',
			headers,
			body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
			credentials: 'omit',
			cache: 'no-store',
		});
	} catch {
		throw new ApiError('Cannot reach the Trovo API. Check your connection.', 0);
	}

	if (!response.ok) {
		const error = await readError(response);
		if (!options.anonymous && response.status === 401) unauthorizedListeners.forEach((l) => l());
		if (error.status === 403 && error.code === 'PASSWORD_CHANGE_REQUIRED') passwordChangeListeners.forEach((l) => l());
		throw error;
	}
	if (response.status === 204) return undefined as T;
	const text = await response.text();
	return (text ? JSON.parse(text) : undefined) as T;
}

function query(params: Record<string, string | number | undefined | null>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
	}
	const text = search.toString();
	return text ? `?${text}` : '';
}

const P = '/api/platform';

export const api = {
	// Sign-in
	login: (email: string, password: string) =>
		request<LoginResponse>(`${P}/auth/login`, { method: 'POST', body: { email, password }, anonymous: true }),
	verify: (challengeToken: string, code: string) =>
		request<SessionResponse>(`${P}/auth/verify`, { method: 'POST', body: { challengeToken, code }, anonymous: true }),
	me: () => request<PlatformAdmin>(`${P}/auth/me`),
	changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
		request<SessionResponse>(`${P}/auth/change-password`, {
			method: 'POST',
			body: { currentPassword, newPassword, confirmPassword },
		}),

	dashboard: () => request<Dashboard>(`${P}/dashboard`),

	// Companies
	companies: (search?: string, status?: string) => request<CompanyListItem[]>(`${P}/companies${query({ search, status })}`),
	company: (id: string) => request<CompanyDetail>(`${P}/companies/${id}`),
	createCompany: (name: string, plan: PlanRequest | null) =>
		request<CreateCompanyResponse>(`${P}/companies`, { method: 'POST', body: { name, plan } }),
	newRegistrationCode: (id: string) =>
		request<RegistrationCodeResponse>(`${P}/companies/${id}/registration-code`, { method: 'POST' }),
	setCompanyStatus: (id: string, action: 'suspend' | 'reactivate', reason: string) =>
		request<void>(`${P}/companies/${id}/status`, { method: 'PUT', body: { action, reason } }),
	changeSubscription: (
		id: string,
		body: {
			planCode?: string | null;
			interval?: string | null;
			addOns?: Record<string, number> | null;
			extendTrialDays?: number | null;
			licences?: Licences | null;
			reason: string;
		},
	) => request<void>(`${P}/companies/${id}/subscription`, { method: 'PUT', body }),
	cancelSubscription: (id: string, atPeriodEnd: boolean, reason: string) =>
		request<void>(`${P}/companies/${id}/cancel`, { method: 'POST', body: { atPeriodEnd, reason } }),
	updateBillingAccount: (id: string, body: BillingAccount) =>
		request<void>(`${P}/companies/${id}/billing-account`, { method: 'PUT', body }),
	companyBilling: (id: string) => request<CompanyBilling>(`${P}/companies/${id}/billing`),
	issueInvoice: (id: string) => request<Invoice>(`${P}/companies/${id}/invoices`, { method: 'POST' }),

	// Invoices
	invoices: (filters: { status?: string; companyId?: string; search?: string } = {}) =>
		request<InvoiceListItem[]>(`${P}/invoices${query(filters)}`),
	invoice: (id: string) => request<InvoiceDetail>(`${P}/invoices/${id}`),
	recordPayment: (id: string, amountMinor: number, reference: string, paidAt: string | null) =>
		request<Payment>(`${P}/invoices/${id}/payments`, { method: 'POST', body: { amountMinor, reference, paidAt } }),
	voidInvoice: (id: string, reason: string) => request<void>(`${P}/invoices/${id}/void`, { method: 'POST', body: { reason } }),

	// Plans and prices
	plans: () => request<Catalog>(`${P}/plans`),
	newPlanVersion: (
		code: string,
		body: {
			interval: string;
			priceMinor: number;
			includedSeats: number;
			androidUserPriceMinor: number;
			windowsUserPriceMinor: number;
			bothUserPriceMinor: number;
			entitlements: Record<string, string>;
			reason: string;
		},
	) => request<void>(`${P}/plans/${code}/versions`, { method: 'POST', body }),
	createPlan: (body: {
		code: string;
		name: string;
		minimumLicences: number;
		monthly: PlanTermsInput;
		yearly: PlanTermsInput;
		features: Record<string, string>;
		reason: string;
	}) => request<void>(`${P}/plans`, { method: 'POST', body }),
	updatePlan: (code: string, body: { name?: string; isActive?: boolean; reason: string }) =>
		request<void>(`${P}/plans/${code}`, { method: 'PUT', body }),
	createAddOn: (body: {
		code: string;
		name: string;
		featureKey: string;
		value: string;
		monthlyPriceMinor: number;
		yearlyPriceMinor: number;
		reason: string;
	}) => request<void>(`${P}/addons`, { method: 'POST', body }),
	updateAddOn: (code: string, body: { name?: string; isActive?: boolean; reason: string }) =>
		request<void>(`${P}/addons/${code}`, { method: 'PUT', body }),
	signups: (status?: string) => request<SignupOrder[]>(`${P}/signups${query({ status })}`),
	settings: () => request<PlatformSettings>(`${P}/settings`),
	updateSettings: (body: Partial<PlatformSettings> & { reason: string }) =>
		request<PlatformSettings>(`${P}/settings`, { method: 'PUT', body }),
	newAddOnPrice: (code: string, body: { interval: string; unitPriceMinor: number; reason: string }) =>
		request<void>(`${P}/addons/${code}/prices`, { method: 'POST', body }),

	// Owner only
	auditLogs: (companyId?: string, page = 1) => request<AuditEntry[]>(`${P}/audit-logs${query({ companyId, page })}`),
	admins: () => request<AdminListItem[]>(`${P}/admins`),
	createAdmin: (email: string, name: string, role: AdminRole) =>
		request<{ admin: AdminListItem; oneTimePassword: string }>(`${P}/admins`, { method: 'POST', body: { email, name, role } }),
	updateAdmin: (id: string, body: { role?: AdminRole; isActive?: boolean; reason: string }) =>
		request<AdminListItem>(`${P}/admins/${id}`, { method: 'PUT', body }),
	resetAdmin: (id: string, reason: string) =>
		request<{ oneTimePassword: string }>(`${P}/admins/${id}/reset`, { method: 'POST', body: { reason } }),
	migrations: () => request<MigrationStatus[]>(`${P}/migrations`),
	runMigrations: () => request<MigrationStatus[]>(`${P}/migrations/run`, { method: 'POST' }),
};
