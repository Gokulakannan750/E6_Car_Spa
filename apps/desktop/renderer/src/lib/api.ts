/**
 * E6 Car Spa Management - API Client
 * Centralized HTTP client for communicating with the ASP.NET Core backend.
 */

const API_BASE = (() => {
 if (typeof import.meta !== 'undefined' && import.meta.env.VITE_API_URL) {
 return import.meta.env.VITE_API_URL;
 }
 return 'http://localhost:5298';
})();

export const TOKEN_STORAGE_KEY = 'car_spa_token';
export const USER_STORAGE_KEY = 'car_spa_user';

let _inMemoryToken: string | null = (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null);

export function getAuthToken(): string | null {
	return _inMemoryToken;
}

export function setAuthToken(token: string | null) {
	_inMemoryToken = token;
	if (typeof window !== 'undefined' && window.electronAPI?.setAuthToken) {
		window.electronAPI.setAuthToken(token).catch(console.error);
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(TOKEN_STORAGE_KEY);
		}
	} else if (typeof localStorage !== 'undefined') {
		if (token) {
			localStorage.setItem(TOKEN_STORAGE_KEY, token);
		} else {
			localStorage.removeItem(TOKEN_STORAGE_KEY);
		}
	}
}

export async function initAuthToken(): Promise<string | null> {
	if (typeof window !== 'undefined' && window.electronAPI?.getAuthToken) {
		try {
			const safeToken = await window.electronAPI.getAuthToken();
			if (safeToken) {
				_inMemoryToken = safeToken;
				if (typeof localStorage !== 'undefined') {
					localStorage.removeItem(TOKEN_STORAGE_KEY);
				}
				return safeToken;
			}
		} catch (err) {
			console.warn('Failed to read token from safeStorage:', err);
		}

		// Migrate legacy unencrypted token if present
		if (typeof localStorage !== 'undefined') {
			const legacyToken = localStorage.getItem(TOKEN_STORAGE_KEY);
			if (legacyToken) {
				_inMemoryToken = legacyToken;
				if (window.electronAPI.setAuthToken) {
					await window.electronAPI.setAuthToken(legacyToken);
				}
				localStorage.removeItem(TOKEN_STORAGE_KEY);
				return legacyToken;
			}
		}
	} else if (typeof localStorage !== 'undefined') {
		_inMemoryToken = localStorage.getItem(TOKEN_STORAGE_KEY);
	}
	return _inMemoryToken;
}


export type ApiErrorCode =
	| 'PERMISSION_DENIED'
	| 'UNAUTHORIZED'
	| 'ACCOUNT_LOCKED'
	| 'CONFLICT'
	| 'VALIDATION_ERROR'
	| 'NOT_FOUND'
	| 'RATE_LIMITED'
	| 'SERVER_ERROR'
	| 'NETWORK_ERROR'
	| 'UNKNOWN';

export class ApiError extends Error {
	public isPermissionDenied: boolean;
	public remainingLockoutSeconds?: number;
	constructor(
		message: string,
		public status: number,
		public body: unknown,
		public code: ApiErrorCode = 'UNKNOWN',
		public action?: string,
		remainingLockoutSeconds?: number,
	) {
		super(message);
		this.name = 'ApiError';
		this.isPermissionDenied = status === 403 || code === 'PERMISSION_DENIED';
		this.remainingLockoutSeconds = remainingLockoutSeconds;
	}
}

export async function request<T>(
	path: string,
	options: RequestInit = {},
	action?: string,
): Promise<T> {
	const token = getAuthToken();
	const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
	const headers: Record<string, string> = {
		...(isFormData ? {} : { 'Content-Type': 'application/json' }),
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...((options.headers as Record<string, string>) || {}),
	};

	let res: Response;
	try {
		res = await fetch(`${API_BASE}${path}`, {
			...options,
			headers,
		});
	} catch {
		// Network failure / server unreachable / fetch error
		throw new ApiError(
			'Unable to connect to the server. Please try again.',
			0,
			null,
			'NETWORK_ERROR',
			action,
		);
	}

	if (res.status === 204) return undefined as T;

	const normalizedPath = path.toLowerCase();
	const isAuthEndpoint =
		normalizedPath.includes('/auth/login') ||
		normalizedPath.includes('/auth/status') ||
		normalizedPath.includes('/auth/bootstrap');

	if (res.status === 401 && !isAuthEndpoint) {
		setAuthToken(null);
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(USER_STORAGE_KEY);
		}
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('auth:unauthorized'));
		}
	}

	if (!res.ok) {
		let rawDetail: string | null = null;
		let rawBody: unknown = null;
		try {
			const resClone = typeof res.clone === 'function' ? res.clone() : res;
			const errBody = await resClone.json();
			rawBody = errBody;
			if (errBody && typeof errBody === 'object') {
				const rec = errBody as Record<string, unknown>;
				if (typeof rec.detail === 'string' && rec.detail.trim()) rawDetail = rec.detail.trim();
				else if (typeof rec.error === 'string' && rec.error.trim()) rawDetail = rec.error.trim();
				else if (typeof rec.title === 'string' && rec.title.trim()) rawDetail = rec.title.trim();
				else if (typeof rec.message === 'string' && rec.message.trim()) rawDetail = rec.message.trim();
			}
		} catch {
			try {
				const resClone = typeof res.clone === 'function' ? res.clone() : res;
				const text = await resClone.text();
				if (text && typeof text === 'string' && text.trim()) {
					rawDetail = text.trim();
				}
			} catch {
				// Non-JSON and non-text error response
			}
		}

		const isTechnicalError = (msg: string) => {
			return (
				/^HTTP \d+/i.test(msg) ||
				/Exception/i.test(msg) ||
				/Stack trace/i.test(msg) ||
				/SqlException|Npgsql|Postgres|at CarSpaManagement/i.test(msg) ||
				msg === 'Forbidden' ||
				msg === 'Unauthorized' ||
				msg === 'Bad Request' ||
				msg === 'Internal Server Error'
			);
		};

		let code: ApiErrorCode = 'UNKNOWN';
		let friendlyMessage = `HTTP ${res.status} ${res.statusText}`;

		switch (res.status) {
			case 401:
				code = 'UNAUTHORIZED';
				friendlyMessage = isAuthEndpoint
					? 'Invalid username or password.'
					: 'Session expired. Please log in again.';
				break;
			case 403:
				code = 'PERMISSION_DENIED';
				if (rawDetail && !isTechnicalError(rawDetail) && !rawDetail.toLowerCase().includes('http')) {
					friendlyMessage = rawDetail;
				} else if (action) {
					friendlyMessage = `You don't have permission to ${action}.`;
				} else {
					friendlyMessage = "You don't have permission to perform this action.";
				}
				break;
			case 409:
				code = 'CONFLICT';
				friendlyMessage = rawDetail && !isTechnicalError(rawDetail)
					? rawDetail
					: 'This record has a conflict or has already been modified.';
				break;
			case 400:
				code = 'VALIDATION_ERROR';
				friendlyMessage = rawDetail && !isTechnicalError(rawDetail)
					? rawDetail
					: 'Invalid request. Please check the entered data.';
				break;
			case 404:
				code = 'NOT_FOUND';
				friendlyMessage = rawDetail && !isTechnicalError(rawDetail)
					? rawDetail
					: 'The requested record could not be found.';
				break;
			case 423: {
				code = 'ACCOUNT_LOCKED';
				friendlyMessage = 'Account temporarily locked. Please try again later.';
				let remainingSeconds = 300;
				if (rawBody && typeof rawBody === 'object') {
					const b = rawBody as Record<string, unknown>;
					if (typeof b.remainingLockoutSeconds === 'number') remainingSeconds = b.remainingLockoutSeconds;
					else if (typeof b.retryAfter === 'number') remainingSeconds = b.retryAfter;
				}
				throw new ApiError(friendlyMessage, 423, rawBody, 'ACCOUNT_LOCKED', action, remainingSeconds);
			}
			case 429:
				code = 'RATE_LIMITED';
				friendlyMessage = 'Too many attempts. Please try again later.';
				break;
			default:
				if (res.status >= 500) {
					code = 'SERVER_ERROR';
					friendlyMessage = 'Something went wrong. Please try again.';
				} else {
					friendlyMessage = rawDetail && !isTechnicalError(rawDetail) ? rawDetail : `Request failed (status ${res.status}).`;
				}
				break;
		}

		throw new ApiError(friendlyMessage, res.status, rawBody, code, action);
	}

	const body = (() => {
		const ct = res.headers.get('content-type') || '';
		if (ct.includes('application/json')) {
			return res.json();
		}
		return res.text();
	})();

	return body as T;
}

// ============================================================================
// Types
// ============================================================================

export interface CustomerDto {
	id: string;
	name: string;
	phoneNumber: string;
	email: string | null;
	address: string | null;
	createdAt: string;
	vehicleRegistrationNumbers?: string[];
	vehicleCount?: number;
	jobCardCount?: number;
	totalRevenue?: number;
}

export interface CustomerListResponse {
 items: CustomerDto[];
 totalCount: number;
 page: number;
 pageSize: number;
}

export interface CustomerJobCardHistoryItemDto {
	jobCardId: string;
	jobCardNumber: string;
	createdAt: string;
	status: string;
	vehicleNumber?: string | null;
	vehicleModel?: string | null;
	subtotal: number;
	taxAmount: number;
	discountAmount: number;
	totalAmount: number;
	vehicles: { vehicleId: string; vehicleNumber: string; model?: string | null; color?: string | null }[];
	invoiceId?: string | null;
	invoiceNumber?: string | null;
	invoiceStatus?: string | null;
	invoiceTotal?: number | null;
	paidAmount?: number | null;
	outstandingAmount?: number | null;
	paymentStatus?: string | null;
}

export interface CustomerHistoryResponse {
	customerId: string;
	customerName: string;
	phoneNumber: string;
	totalJobCards: number;
	totalVehicles: number;
	jobCards: CustomerJobCardHistoryItemDto[];
	totalOutstandingAmount: number;
	totalPaidAmount: number;
	totalInvoicedAmount: number;
}

export interface CreateCustomerInput {
 name: string;
 phoneNumber: string;
 email?: string | null;
 address?: string | null;
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {
 id: string;
}

export interface VehicleDto {
 id: string;
 customerId: string;
 registrationNumber: string;
 make: string;
 model: string;
 variant: string | null;
 color: string | null;
 customerName: string;
 createdAt: string;
}

export interface CreateVehicleInput {
 customerId: string;
 registrationNumber: string;
 make: string;
 model: string;
 variant?: string | null;
 color?: string | null;
}

export interface UpdateVehicleInput {
	registrationNumber: string;
	make: string;
	model: string;
	variant?: string | null;
	color?: string | null;
}

export interface JobCardDto {
 id: string;
 jobCardNumber: string;
 customer: {
 id: string;
 name: string;
 phoneNumber?: string;
 phone?: string;
 };
 vehicle: {
 id: string;
 registrationNumber: string;
 make: string;
 model: string;
 variant: string | null;
 color: string | null;
 };
 status: number;
 notes: string | null;
 services: JobCardServiceDto[];
 subtotal: number;
 taxAmount: number;
 discountAmount: number;
 totalAmount: number;
 invoiceId?: string | null;
 invoiceNumber?: string | null;
 invoiceStatus?: string | null;
 createdAt: string;
 updatedAt: string | null;
}

export interface JobCardServiceDto {
 id: string;
 serviceId: string;
 serviceName: string;
 unitPrice: number;
 quantity: number;
 taxPercentage: number;
 discountAmount: number;
}

export interface JobCardListDto {
 id: string;
 jobCardNumber: string;
 customerName: string;
 customerPhone: string;
 registrationNumber: string;
 make: string;
 model: string;
 status: number;
 totalAmount: number;
 invoiceId?: string | null;
 invoiceNumber?: string | null;
 invoiceStatus?: string | null;
 createdAt: string;
}

export interface JobCardListResponse {
 items: JobCardListDto[];
 totalCount: number;
 page: number;
 pageSize: number;
}

export interface ServiceItemDto {
 id: string;
 name: string;
 category: string;
 price: number;
 quantity: number;
}

export interface JobCardServiceDto {
 id: string;
 serviceId: string;
 serviceName: string;
 unitPrice: number;
 quantity: number;
 taxPercentage: number;
 discountAmount: number;
 lineTotal?: number;
}

export interface ServiceDto {
 id: string;
 name: string;
 description: string | null;
 category: string | null;
 price: number;
 taxPercentage: number;
 durationMinutes: number | null;
 isActive: boolean;
 createdAt: string;
}

export interface CreateJobCardInput {
 customerId: string;
 vehicleId: string;
 services: { serviceId: string; quantity: number; discountAmount: number }[];
 notes?: string | null;
 isGstEnabled?: boolean;
}

export interface CreateServiceInput {
 name: string;
 category: string;
 price: number;
 taxPercentage?: number;
 durationMinutes?: number | null;
 description?: string | null;
 isActive?: boolean;
}

// Invoice status values matching backend Domain/Enums/InvoiceStatus.cs
export type InvoiceStatus = 'Draft' | 'Generated' | 'PartiallyPaid' | 'Paid' | 'Cancelled' | number;

export interface InvoiceItemDto {
  id: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface PaymentDto {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  paymentDate: string;
  createdAt: string;
}

export interface RecordPaymentInput {
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  paymentDate?: string | null;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string | null;
  jobCardId: string;
  jobCardNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleId: string;
  registrationNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleVariant: string | null;
  vehicleColor: string | null;
  invoiceDate: string;
  subtotal: number;
  discount: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  notes: string | null;
  isGstEnabled: boolean;
  items: InvoiceItemDto[];
  payments?: PaymentDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface InvoiceListDto {
  id: string;
  invoiceNumber: string | null;
  jobCardNumber: string;
  customerName: string;
  customerPhone: string;
  registrationNumber: string;
  vehicle: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  createdAt: string;
}

export interface InvoiceListResponse {
  items: InvoiceListDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface UpdateInvoiceInput {
  discount?: number | null;
  notes?: string | null;
  status?: InvoiceStatus | null;
  isGstEnabled?: boolean | null;
}

export interface InvoicePublicLinkResponse {
  url: string;
  createdAtUtc: string;
  isActive: boolean;
}

export interface InvoicePublicLinkStatusResponse {
  hasActiveLink: boolean;
  createdAtUtc?: string | null;
  accessCount: number;
  lastAccessedAtUtc?: string | null;
}

export interface PublicBusinessDto {
  businessName: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  logoUrl?: string | null;
}

export interface PublicCustomerDto {
  customerName: string;
  vehicleName: string;
  registrationNumber: string;
}

export interface PublicInvoiceItemDto {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  hsnSac?: string | null;
}

export interface PublicFinancialsDto {
  subtotal: number;
  discount: number;
  taxableValue?: number | null;
  cgst?: number | null;
  sgst?: number | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
}

export interface PublicInvoiceDto {
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  isGstEnabled: boolean;
  business: PublicBusinessDto;
  customer: PublicCustomerDto;
  items: PublicInvoiceItemDto[];
  financials: PublicFinancialsDto;
  notes?: string | null;
  termsAndConditions?: string | null;
}

export interface CatalogueServiceDto {
 id: string;
 name: string;
 category: string;
 description: string | null;
 basePrice: number;
 isActive: boolean;
 createdAt: string;
}

export interface CreateCatalogueServiceInput {
 name: string;
 category: string;
 description?: string | null;
 basePrice: number;
 isActive?: boolean;
}

export interface DashboardStats {
 totalCustomers: number;
 activeJobCards: number;
 pendingInvoices: number;
 monthlyRevenue: number;
}

export interface HealthResponse {
 status: string;
 database: string;
 timestamp: string;
}

// ============================================================================
// Customers
// ============================================================================

export async function getCustomers(params?: { page?: number; pageSize?: number; search?: string }) {
	const qs = new URLSearchParams();
	if (params?.page) qs.set('page', String(params.page));
	if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
	if (params?.search) qs.set('search', params.search);
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<CustomerListResponse>('/api/customers' + suffix, {}, 'view customers');
}

export async function getCustomerById(id: string) {
	return request<CustomerDto>(`/api/customers/${encodeURIComponent(id)}`, {}, 'view customers');
}

export async function getCustomerHistory(customerId: string) {
	return request<CustomerHistoryResponse>(`/api/customers/${encodeURIComponent(customerId)}/history`, {}, 'view customer history');
}

export async function getCustomerByPhone(phone: string) {
 return request<CustomerDto>(`/api/customers/by-phone/${encodeURIComponent(phone)}`, {}, 'view customers');
}

export async function getVehicleByRegistration(registrationNumber: string) {
 return request<VehicleDto>(`/api/vehicles/by-registration/${encodeURIComponent(registrationNumber)}`, {}, 'view vehicles');
}

export async function createCustomer(data: CreateCustomerInput) {
 return request<CustomerDto>('/api/customers', {
 method: 'POST',
 body: JSON.stringify(cleanPayload(data)),
 }, 'create customers');
}

export async function updateCustomer(data: UpdateCustomerInput) {
 return request<CustomerDto>(`/api/customers/${encodeURIComponent(data.id)}`, {
 method: 'PUT',
 body: JSON.stringify(cleanPayload(data)),
 }, 'edit customers');
}

export async function deleteCustomer(id: string) {
 return request<void>(`/api/customers/${encodeURIComponent(id)}`, {
 method: 'DELETE',
 }, 'delete customers');
}

// ============================================================================
// Vehicles
// ============================================================================

export async function getVehiclesByCustomer(customerId: string) {
 return request<VehicleDto[]>(`/api/vehicles/by-customer/${encodeURIComponent(customerId)}`, {}, 'view vehicles');
}

export async function createVehicle(data: CreateVehicleInput) {
	return request<VehicleDto>('/api/vehicles', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'create vehicles');
}

export async function updateVehicle(id: string, data: UpdateVehicleInput) {
	return request<VehicleDto>(`/api/vehicles/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'edit vehicles');
}

export async function transferVehicleOwnership(vehicleId: string, newCustomerId: string) {
	return request<VehicleDto>(`/api/vehicles/${encodeURIComponent(vehicleId)}/transfer-ownership`, {
		method: 'POST',
		body: JSON.stringify({ newCustomerId }),
	}, 'edit vehicles');
}


// ============================================================================
// Job Cards
// ============================================================================

export async function getJobCards(params: { page: number; pageSize: number; status?: string; search?: string }) {
	const qs = new URLSearchParams();
	qs.set('page', String(params.page));
	qs.set('pageSize', String(params.pageSize));
	if (params.status) qs.set('status', params.status);
	if (params.search) qs.set('search', params.search);
	return request<{ items: JobCardListDto[]; totalCount: number }>('/api/job-cards?' + qs.toString(), {}, 'view job cards');
}

export async function getJobCardsByCustomer(customerId: string, params?: { page?: number; pageSize?: number }) {
	const qs = new URLSearchParams();
	if (params?.page) qs.set('page', String(params.page));
	if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<JobCardListResponse>(`/api/job-cards/by-customer/${encodeURIComponent(customerId)}${suffix}`, {}, 'view job cards');
}

export async function getJobCardById(id: string) {
 return request<JobCardDto>(`/api/job-cards/${encodeURIComponent(id)}`, {}, 'view job cards');
}

export async function createJobCard(data: CreateJobCardInput) {
 return request<JobCardDto>('/api/job-cards', {
 method: 'POST',
 body: JSON.stringify(data),
 }, 'create job cards');
}

export async function updateJobCardServices(id: string, services: { serviceId: string; quantity: number; discountAmount: number }[]) {
 return request<JobCardDto>(`/api/job-cards/${encodeURIComponent(id)}/services`, {
 method: 'PUT',
 body: JSON.stringify({ services }),
 }, 'edit job cards');
}

export async function deleteJobCard(id: string) {
	return request<void>(`/api/job-cards/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	}, 'delete job cards');
}

export function isJobCardLocked(jc: {
	status?: number | string;
	invoiceId?: string | null;
	invoiceNumber?: string | null;
	invoiceStatus?: string | null;
	isLocked?: boolean;
}): boolean {
	if (jc.isLocked) return true;
	if (jc.status === 4 || jc.status === 5 || jc.status === 6) {
		return true;
	}
	const statusStr = typeof jc.status === 'string' ? jc.status.toLowerCase() : '';
	if (
		statusStr === 'invoiced' ||
		statusStr === 'paid' ||
		statusStr === 'delivered'
	) {
		return true;
	}
	if (jc.invoiceNumber && jc.invoiceNumber.trim() !== '') {
		return true;
	}
	const invStatusStr = typeof jc.invoiceStatus === 'string' ? jc.invoiceStatus.toLowerCase() : '';
	if (jc.invoiceId && invStatusStr && invStatusStr !== 'draft' && invStatusStr !== '0') {
		return true;
	}
	return false;
}

// ============================================================================
// Invoices
// ============================================================================

export async function getInvoices(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: InvoiceStatus;
  fromDate?: string;
  toDate?: string;
}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  if (params.search) qs.set('search', params.search);
  if (params.status !== undefined) qs.set('status', String(params.status));
  if (params.fromDate) qs.set('fromDate', params.fromDate);
  if (params.toDate) qs.set('toDate', params.toDate);
  return request<InvoiceListResponse>('/api/invoices?' + qs.toString(), {}, 'view invoices');
}

export async function getInvoiceById(id: string) {
  return request<InvoiceDto>(`/api/invoices/${encodeURIComponent(id)}`, {}, 'view invoices');
}

export async function getInvoiceByNumber(invoiceNumber: string) {
  return request<InvoiceDto>(`/api/invoices/by-number/${encodeURIComponent(invoiceNumber)}`, {}, 'view invoices');
}

export async function createInvoiceFromJobCard(jobCardId: string) {
  return request<InvoiceDto>(`/api/invoices/from-job-card/${encodeURIComponent(jobCardId)}`, {
    method: 'POST',
  }, 'generate invoices');
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput) {
  return request<InvoiceDto>(`/api/invoices/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(cleanPayload(data)),
  }, 'edit invoices');
}

export async function generateInvoice(id: string) {
  return request<InvoiceDto>(`/api/invoices/${encodeURIComponent(id)}/generate`, {
    method: 'POST',
  }, 'generate invoices');
}

export async function cancelInvoice(id: string, reason?: string) {
  return request<InvoiceDto>(`/api/invoices/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  }, 'cancel invoices');
}

export async function getInvoicePayments(invoiceId: string) {
  return request<PaymentDto[]>(`/api/invoices/${encodeURIComponent(invoiceId)}/payments`, {}, 'view payments');
}

export async function recordPayment(invoiceId: string, data: RecordPaymentInput) {
  return request<PaymentDto>(`/api/invoices/${encodeURIComponent(invoiceId)}/payments`, {
    method: 'POST',
    body: JSON.stringify(cleanPayload(data)),
  }, 'record payments');
}

export async function createPublicInvoiceLink(invoiceId: string) {
  return request<InvoicePublicLinkResponse>(`/api/invoices/${encodeURIComponent(invoiceId)}/public-link`, {
    method: 'POST',
  }, 'share invoices');
}

export async function getPublicInvoiceLinkStatus(invoiceId: string) {
  return request<InvoicePublicLinkStatusResponse>(`/api/invoices/${encodeURIComponent(invoiceId)}/public-link/status`, {}, 'view invoices');
}

export async function revokePublicInvoiceLink(invoiceId: string) {
  return request<{ success: boolean; message: string }>(`/api/invoices/${encodeURIComponent(invoiceId)}/public-link`, {
    method: 'DELETE',
  }, 'share invoices');
}

export async function rotatePublicInvoiceLink(invoiceId: string) {
  return request<InvoicePublicLinkResponse>(`/api/invoices/${encodeURIComponent(invoiceId)}/public-link/rotate`, {
    method: 'POST',
  }, 'share invoices');
}

export async function getPublicInvoice(token: string) {
  const res = await fetch(`${API_BASE}/api/public/invoices/${encodeURIComponent(token)}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new ApiError('Invoice not found or link expired', res.status, null, 'NOT_FOUND');
  }
  return (await res.json()) as PublicInvoiceDto;
}

// ============================================================================
// Services (Catalogue)
// ============================================================================

export async function getServices(params: { page: number; pageSize: number; isActive?: boolean; search?: string; category?: string }) {
 const qs = new URLSearchParams();
 qs.set('page', String(params.page));
 qs.set('pageSize', String(params.pageSize));
 if (params.isActive !== undefined) qs.set('isActive', String(params.isActive));
 if (params.search) qs.set('search', params.search);
 if (params.category) qs.set('category', params.category);
 const suffix = '?' + qs.toString();
 return request<{ items: ServiceDto[]; totalCount: number }>('/api/services' + suffix, {}, 'view catalogue');
}

export async function getServiceById(id: string) {
 return request<ServiceDto>(`/api/services/${encodeURIComponent(id)}`, {}, 'view catalogue');
}

export async function createService(data: CreateServiceInput) {
 return request<ServiceDto>('/api/services', {
 method: 'POST',
 body: JSON.stringify(cleanPayload(data)),
 }, 'create services');
}

export async function updateService(id: string, data: CreateServiceInput) {
 return request<ServiceDto>(`/api/services/${encodeURIComponent(id)}`, {
 method: 'PUT',
 body: JSON.stringify(cleanPayload(data)),
 }, 'edit services');
}

export async function getServiceCategories() {
 return request<string[]>('/api/services/categories', {}, 'view catalogue');
}

export async function getCatalogueServices(params?: { category?: string; search?: string }) {
 const qs = new URLSearchParams();
 if (params?.category) qs.set('category', params.category);
 if (params?.search) qs.set('search', params.search);
 const suffix = qs.toString() ? '?' + qs.toString() : '';
 return request<CatalogueServiceDto[]>('/api/catalogue' + suffix, {}, 'view catalogue');
}

export async function createCatalogueService(data: CreateCatalogueServiceInput) {
 return request<CatalogueServiceDto>('/api/catalogue', {
 method: 'POST',
 body: JSON.stringify(data),
 }, 'create catalogue items');
}

export async function updateCatalogueService(id: string, data: Partial<CreateCatalogueServiceInput>) {
 return request<CatalogueServiceDto>(`/api/catalogue/${encodeURIComponent(id)}`, {
 method: 'PUT',
 body: JSON.stringify(data),
 }, 'edit catalogue items');
}

export async function deleteCatalogueService(id: string) {
 return request<void>(`/api/catalogue/${encodeURIComponent(id)}`, {
 method: 'DELETE',
 }, 'delete catalogue items');
}

// ============================================================================
// Staff Advances
// ============================================================================

export type StaffAdvanceStatus = 'Outstanding' | 'Settled' | 'Obsolete';

export interface StaffAdvanceDto {
	id: string;
	staffId: string;
	staffName: string;
	staffPhone?: string | null;
	staffRole?: string | null;
	amount: number;
	advanceDate: string;
	reason: string;
	notes?: string | null;
	status: StaffAdvanceStatus | string;
	settledAt?: string | null;
	settledByUserId?: string | null;
	settledByName?: string | null;
	obsoletedAt?: string | null;
	obsoletedByUserId?: string | null;
	obsoletedByName?: string | null;
	obsoleteReason?: string | null;
	balanceAmount?: number | null;
	staffSalarySettlementId?: string | null;
	createdAt: string;
	updatedAt?: string | null;
}

export interface StaffDto {
	id: string;
	staffMasterId?: string;
	name: string;
	phoneNumber: string;
	email: string | null;
	address: string | null;
	role: string | null;
	isActive: boolean;
	totalAdvances: number;
	totalAdvanceAmount: number;
	aadhaarMasked?: string | null;
	hasAadhaarDocument?: boolean;
	aadhaarDocumentFileName?: string | null;
	aadhaarDocumentContentType?: string | null;
	aadhaarDocumentSize?: number | null;
	defaultShowroomId?: string | null;
	defaultShowroomMasterId?: string | null;
	defaultShowroomName?: string | null;
}

export interface StaffAadhaarRevealDto {
	staffId: string;
	aadhaarNumber: string;
}

export interface CreateStaffAdvanceInput {
	staffId: string;
	amount: number;
	advanceDate: string;
	reason: string;
	notes?: string | null;
}

export interface ObsoleteStaffAdvanceInput {
	reason: string;
}

export interface StaffAdvanceSummaryDto {
	outstandingCount: number;
	outstandingAmount: number;
	settledCount: number;
	settledAmount: number;
	totalActiveCount: number;
	totalActiveAmount: number;
}

export interface StaffAdvanceListResponse {
	items: StaffAdvanceDto[];
	totalCount: number;
	page: number;
	pageSize: number;
	summary: StaffAdvanceSummaryDto;
}

export interface StaffAdvanceHistoryDto {
	staffId: string;
	staffName: string;
	staffPhone?: string | null;
	staffRole?: string | null;
	totalAdvancesAmount: number;
	outstandingAmount: number;
	settledAmount: number;
	advances: StaffAdvanceDto[];
}

export async function getStaffAdvances(params: { page: number; pageSize: number; staffId?: string; status?: string; fromDate?: string; toDate?: string; search?: string }) {
	const qs = new URLSearchParams();
	qs.set('page', String(params.page));
	qs.set('pageSize', String(params.pageSize));
	if (params.staffId) qs.set('staffId', params.staffId);
	if (params.status) qs.set('status', params.status);
	if (params.fromDate) qs.set('fromDate', params.fromDate);
	if (params.toDate) qs.set('toDate', params.toDate);
	if (params.search) qs.set('search', params.search);
	return request<StaffAdvanceListResponse>('/api/staff-advances?' + qs.toString(), {}, 'view staff advances');
}

export async function getStaffAdvanceById(id: string) {
	return request<StaffAdvanceDto>(`/api/staff-advances/${encodeURIComponent(id)}`, {}, 'view staff advances');
}

export async function createStaffAdvance(data: CreateStaffAdvanceInput) {
	return request<StaffAdvanceDto>('/api/staff-advances', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'create staff advances');
}

export async function settleStaffAdvance(id: string) {
	return request<StaffAdvanceDto>(`/api/staff-advances/${encodeURIComponent(id)}/settle`, {
		method: 'POST',
	}, 'settle staff advances');
}

export async function obsoleteStaffAdvance(id: string, data: ObsoleteStaffAdvanceInput) {
	return request<StaffAdvanceDto>(`/api/staff-advances/${encodeURIComponent(id)}/obsolete`, {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'obsolete staff advances');
}

export async function getStaffAdvanceHistory(staffId: string) {
	return request<StaffAdvanceHistoryDto>(`/api/staff-advances/staff/${encodeURIComponent(staffId)}/history`, {}, 'view staff advances');
}

// ============================================================================
// Staff Salary
// ============================================================================

export type StaffSalaryStatus = 'NotEntered' | 'Ready' | 'Settled';

export interface StaffSalaryItemDto {
	staffId: string;
	staffName: string;
	staffRole?: string | null;
	staffPhoneNumber: string;
	isActive: boolean;
	periodFrom: string;
	periodTo: string;
	enteredSalary?: number | null;
	outstandingAdvance: number;
	advanceDeduction?: number | null;
	finalSalary?: number | null;
	remainingAdvance?: number | null;
	status: StaffSalaryStatus | string;
	settledAt?: string | null;
	settledByName?: string | null;
	notes?: string | null;
	settlementId?: string | null;
}

export interface StaffSalaryRosterResponse {
	periodFrom: string;
	periodTo: string;
	totalStaffCount: number;
	notEnteredCount: number;
	readyCount: number;
	settledCount: number;
	totalEnteredSalary: number;
	totalAdvanceDeductions: number;
	totalFinalSalary: number;
	items: StaffSalaryItemDto[];
}

export interface StaffSalaryPreviewResponse {
	staffId: string;
	staffName: string;
	staffRole?: string | null;
	periodFrom: string;
	periodTo: string;
	enteredSalary: number;
	outstandingAdvance: number;
	advanceDeduction: number;
	finalSalary: number;
	remainingAdvance: number;
	status: StaffSalaryStatus | string;
}

export interface SaveEnteredSalaryInput {
	staffId: string;
	periodFrom: string;
	periodTo: string;
	enteredSalary: number;
	notes?: string | null;
}

export interface SettleStaffSalaryInput {
	staffId: string;
	periodFrom: string;
	periodTo: string;
	enteredSalary: number;
	notes?: string | null;
}

export interface StaffSalarySettlementDto {
	id: string;
	staffId: string;
	staffName: string;
	staffRole?: string | null;
	periodFrom: string;
	periodTo: string;
	enteredSalary: number;
	outstandingAdvanceBeforeSettlement: number;
	advanceDeduction: number;
	remainingAdvanceAfterSettlement: number;
	finalSalary: number;
	status: StaffSalaryStatus | string;
	settledAt?: string | null;
	settledByUserId?: string | null;
	settledByName?: string | null;
	notes?: string | null;
	createdAt: string;
	updatedAt?: string | null;
}

export async function getStaffSalaryRoster(params: {
	fromDate: string;
	toDate: string;
	staffId?: string;
	status?: string;
	search?: string;
}) {
	const qs = new URLSearchParams();
	qs.set('fromDate', params.fromDate);
	qs.set('toDate', params.toDate);
	if (params.staffId) qs.set('staffId', params.staffId);
	if (params.status) qs.set('status', params.status);
	if (params.search) qs.set('search', params.search);
	return request<StaffSalaryRosterResponse>('/api/staff-salary?' + qs.toString(), {}, 'view staff salary');
}

export async function getStaffSalaryPreview(params: {
	staffId: string;
	fromDate: string;
	toDate: string;
	enteredSalary: number;
}) {
	const qs = new URLSearchParams();
	qs.set('staffId', params.staffId);
	qs.set('fromDate', params.fromDate);
	qs.set('toDate', params.toDate);
	qs.set('enteredSalary', String(params.enteredSalary));
	return request<StaffSalaryPreviewResponse>('/api/staff-salary/preview?' + qs.toString(), {}, 'view staff salary preview');
}

export async function saveEnteredSalary(data: SaveEnteredSalaryInput) {
	return request<StaffSalaryItemDto>('/api/staff-salary/enter', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'save staff salary');
}

export async function settleStaffSalary(data: SettleStaffSalaryInput) {
	return request<StaffSalarySettlementDto>('/api/staff-salary/settle', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'settle staff salary');
}

export async function getStaffSalarySettlementHistory(staffId: string) {
	return request<StaffSalarySettlementDto[]>(`/api/staff-salary/settlements/${encodeURIComponent(staffId)}`, {}, 'view staff salary history');
}

export async function getStaffList() {
 return request<StaffDto[]>('/api/staff-advances/staff', {}, 'view staff');
}

export interface CreateStaffInput {
	name: string;
	phoneNumber: string;
	aadhaarNumber: string;
	email?: string | null;
	address?: string | null;
	role?: string | null;
	isActive?: boolean;
	aadhaarFile?: File | null;
}

export interface UpdateStaffInput {
	name?: string;
	phoneNumber?: string;
	aadhaarNumber?: string;
	email?: string | null;
	address?: string | null;
	role?: string | null;
	isActive?: boolean;
	removeAadhaarDocument?: boolean;
	aadhaarFile?: File | null;
}

export async function createStaffMember(data: CreateStaffInput) {
	if (data.aadhaarFile) {
		const formData = new FormData();
		formData.append('name', data.name);
		formData.append('phoneNumber', data.phoneNumber);
		formData.append('aadhaarNumber', data.aadhaarNumber);
		if (data.email) formData.append('email', data.email);
		if (data.address) formData.append('address', data.address);
		if (data.role) formData.append('role', data.role);
		if (data.isActive !== undefined) formData.append('isActive', String(data.isActive));
		formData.append('aadhaarFile', data.aadhaarFile);
		return request<StaffDto>('/api/staff-advances/staff', {
			method: 'POST',
			body: formData,
		}, 'manage staff');
	}
	return request<StaffDto>('/api/staff-advances/staff', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'manage staff');
}

export async function updateStaffMember(id: string, data: UpdateStaffInput) {
	if (data.aadhaarFile || data.removeAadhaarDocument) {
		const formData = new FormData();
		if (data.name !== undefined) formData.append('name', data.name);
		if (data.phoneNumber !== undefined) formData.append('phoneNumber', data.phoneNumber);
		if (data.aadhaarNumber !== undefined) formData.append('aadhaarNumber', data.aadhaarNumber);
		if (data.email !== undefined && data.email !== null) formData.append('email', data.email);
		if (data.address !== undefined && data.address !== null) formData.append('address', data.address);
		if (data.role !== undefined && data.role !== null) formData.append('role', data.role);
		if (data.isActive !== undefined) formData.append('isActive', String(data.isActive));
		if (data.removeAadhaarDocument !== undefined) formData.append('removeAadhaarDocument', String(data.removeAadhaarDocument));
		if (data.aadhaarFile) formData.append('aadhaarFile', data.aadhaarFile);
		return request<StaffDto>(`/api/staff-advances/staff/${encodeURIComponent(id)}`, {
			method: 'PUT',
			body: formData,
		}, 'manage staff');
	}
	return request<StaffDto>(`/api/staff-advances/staff/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'manage staff');
}

export async function revealStaffAadhaar(staffId: string) {
	return request<StaffAadhaarRevealDto>(`/api/staff-advances/staff/${encodeURIComponent(staffId)}/aadhaar`, {}, 'reveal sensitive aadhaar');
}

export async function uploadStaffAadhaarDocument(staffId: string, file: File) {
	const formData = new FormData();
	formData.append('file', file);
	return request<StaffDto>(`/api/staff-advances/staff/${encodeURIComponent(staffId)}/aadhaar-document`, {
		method: 'POST',
		body: formData,
	}, 'upload staff aadhaar document');
}

export async function deleteStaffAadhaarDocument(staffId: string) {
	return request<StaffDto>(`/api/staff-advances/staff/${encodeURIComponent(staffId)}/aadhaar-document`, {
		method: 'DELETE',
	}, 'delete staff aadhaar document');
}

export function getStaffAadhaarDocumentUrl(staffId: string): string {
	return `${API_BASE}/api/staff-advances/staff/${encodeURIComponent(staffId)}/aadhaar-document`;
}

export async function downloadStaffAadhaarDocument(staffId: string): Promise<{ blob: Blob; fileName: string }> {
	const token = getAuthToken();
	const res = await fetch(`${API_BASE}/api/staff-advances/staff/${encodeURIComponent(staffId)}/aadhaar-document`, {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	});
	if (!res.ok) {
		throw new ApiError('Failed to download Aadhaar document', res.status, null);
	}
	const blob = await res.blob();
	const disposition = res.headers.get('content-disposition');
	let fileName = 'aadhaar_document';
	if (disposition && disposition.includes('filename=')) {
		const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
		if (match && match[1]) {
			fileName = match[1].replace(/['"]/g, '');
		}
	}
	return { blob, fileName };
}

export async function deleteStaffMember(id: string) {
	return request<void>(`/api/staff-advances/staff/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	}, 'delete staff');
}

export async function getStaffById(id: string) {
 return request<StaffDto>(`/api/staff-advances/staff/${encodeURIComponent(id)}`, {}, 'view staff');
}

export async function getStaffAdvancesByStaffId(staffId: string) {
	return request<StaffAdvanceDto[]>(`/api/staff-advances/staff/${encodeURIComponent(staffId)}/advances`, {}, 'view staff advances');
}

// ============================================================================
// Staff Attendance
// ============================================================================

export type StaffAttendanceStatus = 'Present' | 'HalfDay' | 'Leave' | 'Unmarked';

export interface StaffAttendanceDto {
	id: string;
	staffId: string;
	staffName: string;
	staffRole?: string | null;
	staffPhoneNumber: string;
	attendanceDate: string;
	status: 'Present' | 'HalfDay' | 'Leave';
	checkInTime?: string | null;
	checkOutTime?: string | null;
	workingHours?: number | null;
	workingHoursFormatted?: string | null;
	notes?: string | null;
	createdAt: string;
	updatedAt?: string | null;
	createdByUserName?: string | null;
	updatedByUserName?: string | null;
}

export interface DailyStaffAttendanceItemDto {
	staffId: string;
	staffName: string;
	staffRole?: string | null;
	staffPhoneNumber: string;
	isActive: boolean;
	attendanceId?: string | null;
	status: StaffAttendanceStatus;
	checkInTime?: string | null;
	checkOutTime?: string | null;
	workingHours?: number | null;
	workingHoursFormatted?: string | null;
	notes?: string | null;
	attendanceDate: string;
}

export interface DailyAttendanceSummaryDto {
	totalActiveStaff: number;
	presentCount: number;
	halfDayCount: number;
	leaveCount: number;
	unmarkedCount: number;
}

export interface DailyAttendanceResponse {
	date: string;
	isAttendanceConfirmed: boolean;
	attendanceConfirmedAt?: string | null;
	attendanceConfirmedByUserId?: string | null;
	attendanceConfirmedByName?: string | null;
	summary: DailyAttendanceSummaryDto;
	staffMembers: DailyStaffAttendanceItemDto[];
}

export interface DateRangeAttendanceResponse {
	fromDate: string;
	toDate: string;
	totalRecords: number;
	presentCount: number;
	halfDayCount: number;
	leaveCount: number;
	records: StaffAttendanceDto[];
}

export interface MonthlyStaffDailyRecordDto {
	date: string;
	day: number;
	dayOfWeek: string;
	status: 'Present' | 'HalfDay' | 'Leave' | 'Unmarked';
	checkInTime?: string | null;
	checkOutTime?: string | null;
	workingHours?: number | null;
	workingHoursFormatted?: string | null;
	notes?: string | null;
}

export interface MonthlyStaffAttendanceItemDto {
	staffId: string;
	name: string;
	role?: string | null;
	phoneNumber: string;
	presentDays: number;
	halfDays: number;
	leaveDays: number;
	unmarkedDays: number;
	attendanceDays: number;
	dailyRecords: MonthlyStaffDailyRecordDto[];
}

export interface MonthlyAttendanceSummaryDto {
	present: number;
	halfDay: number;
	leave: number;
	unmarked: number;
}

export interface MonthlyAttendanceReportResponse {
	year: number;
	month: number;
	fromDate: string;
	toDate: string;
	totalCalendarDays: number;
	staffCount: number;
	summary: MonthlyAttendanceSummaryDto;
	staff: MonthlyStaffAttendanceItemDto[];
}

export interface UpsertStaffAttendanceInput {
	staffId: string;
	attendanceDate: string;
	status: 'Present' | 'HalfDay' | 'Leave';
	checkInTime?: string | null;
	checkOutTime?: string | null;
	notes?: string | null;
}

export async function getDailyAttendance(date?: string) {
	const url = date ? `/api/staff-attendance?date=${encodeURIComponent(date)}` : '/api/staff-attendance';
	return request<DailyAttendanceResponse>(url, {}, 'view staff attendance');
}

export async function getDateRangeAttendance(params: {
	fromDate: string;
	toDate: string;
	staffId?: string;
	status?: string;
	search?: string;
}) {
	const qs = new URLSearchParams();
	qs.append('fromDate', params.fromDate);
	qs.append('toDate', params.toDate);
	if (params.staffId) qs.append('staffId', params.staffId);
	if (params.status && params.status !== 'All') qs.append('status', params.status);
	if (params.search && params.search.trim()) qs.append('search', params.search.trim());

	return request<DateRangeAttendanceResponse>(`/api/staff-attendance/range?${qs.toString()}`, {}, 'view attendance history');
}

export async function getMonthlyAttendanceReport(params: {
	year: number;
	month: number;
	staffId?: string;
	status?: string;
	search?: string;
}) {
	const qs = new URLSearchParams();
	qs.append('year', params.year.toString());
	qs.append('month', params.month.toString());
	if (params.staffId) qs.append('staffId', params.staffId);
	if (params.status && params.status !== 'All') qs.append('status', params.status);
	if (params.search && params.search.trim()) qs.append('search', params.search.trim());

	return request<MonthlyAttendanceReportResponse>(
		`/api/staff-attendance/monthly-report?${qs.toString()}`,
		{},
		'view monthly attendance report'
	);
}

export async function upsertStaffAttendance(data: UpsertStaffAttendanceInput) {
	return request<StaffAttendanceDto>('/api/staff-attendance', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'manage staff attendance');
}

export async function deleteStaffAttendance(id: string) {
	return request<void>(`/api/staff-attendance/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	}, 'delete staff attendance');
}

export async function confirmStaffAttendance(date: string) {
	return request<DailyAttendanceResponse>(`/api/staff-attendance/confirm?date=${encodeURIComponent(date)}`, {
		method: 'POST',
	}, 'confirm staff attendance');
}

export async function unlockStaffAttendance(date: string) {
	return request<DailyAttendanceResponse>(`/api/staff-attendance/unlock?date=${encodeURIComponent(date)}`, {
		method: 'POST',
	}, 'unlock staff attendance');
}

// ============================================================================
// Dashboard
// ============================================================================

export async function getDashboardStats() {
 return request<DashboardStats>('/api/dashboard/stats', {}, 'view dashboard stats');
}

// ============================================================================
// Health
// ============================================================================

export async function getHealth() {
	return request<HealthResponse>('/api/health', {}, 'check system health');
}

// ============================================================================
// Showrooms & Daily Staff Assignments
// ============================================================================

export interface ShowroomDto {
	id: string;
	masterId: string;
	name: string;
	address: string;
	phone?: string | null;
	gstin?: string | null;
	isActive: boolean;
	activeStaffCountToday: number;
	totalVehiclesToday: number;
	createdAt: string;
	updatedAt?: string | null;
}

export interface CreateShowroomInput {
	name: string;
	address: string;
	phone?: string | null;
	gstin?: string | null;
	isActive?: boolean;
}

export interface UpdateShowroomInput {
	name?: string;
	address?: string;
	phone?: string | null;
	gstin?: string | null;
	isActive?: boolean;
}

export interface DailyStaffAssignmentDto {
	id: string;
	showroomId: string;
	showroomName: string;
	staffId: string;
	staffMasterId?: string;
	staffName: string;
	staffPhone: string;
	staffRole?: string | null;
	date: string;
	vehiclesAttended: number;
	createdAt: string;
	startTime?: string | null;
	endTime?: string | null;
	workingHours?: number | null;
	workingHoursFormatted?: string | null;
	status?: string | null;
	assignmentType?: string | null;
	homeShowroomId?: string | null;
	homeShowroomMasterId?: string | null;
	homeShowroomName?: string | null;
	transferReason?: string | null;
	notes?: string | null;
}

export interface DailyStaffResponse {
	showroomId: string;
	showroomName: string;
	date: string;
	totalVehiclesAttended: number;
	isAttendanceConfirmed: boolean;
	attendanceConfirmedAt?: string | null;
	attendanceConfirmedByUserId?: string | null;
	attendanceConfirmedByName?: string | null;
	staffAssignments: DailyStaffAssignmentDto[];
}

export interface CreateDailyStaffAssignmentInput {
	staffId: string;
	date: string;
	vehiclesAttended?: number;
	startTime?: string;
	endTime?: string;
	assignmentType?: string;
	transferReason?: string;
	notes?: string;
}

export async function getShowrooms(params?: { search?: string; isActive?: boolean }) {
	const qs = new URLSearchParams();
	if (params?.search) qs.set('search', params.search);
	if (params?.isActive !== undefined) qs.set('isActive', String(params.isActive));
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<ShowroomDto[]>('/api/showrooms' + suffix, {}, 'view showrooms');
}

export async function getShowroomById(id: string) {
	return request<ShowroomDto>(`/api/showrooms/${encodeURIComponent(id)}`, {}, 'view showrooms');
}

export async function createShowroom(data: CreateShowroomInput) {
	return request<ShowroomDto>('/api/showrooms', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'create showrooms');
}

export async function updateShowroom(id: string, data: UpdateShowroomInput) {
	return request<ShowroomDto>(`/api/showrooms/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'edit showrooms');
}

export async function toggleShowroomActive(id: string) {
	return request<void>(`/api/showrooms/${encodeURIComponent(id)}/toggle-active`, {
		method: 'PATCH',
	}, 'manage showrooms');
}

export async function getDailyStaff(showroomId: string, date: string) {
	const qs = new URLSearchParams({ date });
	return request<DailyStaffResponse>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-staff?` + qs.toString(), {}, 'view showroom staff');
}

export async function confirmDailyStaffAttendance(showroomId: string, date: string) {
	const qs = new URLSearchParams({ date });
	return request<DailyStaffResponse>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-staff/confirm?` + qs.toString(), {
		method: 'POST',
	}, 'confirm attendance');
}

export async function unlockDailyStaffAttendance(showroomId: string, date: string) {
	const qs = new URLSearchParams({ date });
	return request<DailyStaffResponse>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-staff/unlock?` + qs.toString(), {
		method: 'POST',
	}, 'unlock attendance');
}

export async function assignDailyStaff(showroomId: string, data: CreateDailyStaffAssignmentInput) {
	return request<DailyStaffAssignmentDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-staff`, {
		method: 'POST',
		body: JSON.stringify(data),
	}, 'assign showroom staff');
}

export interface UpdateDailyStaffAssignmentInput {
	vehiclesAttended?: number;
	startTime?: string;
	endTime?: string;
	status?: string;
	transferReason?: string | null;
	notes?: string | null;
}

export async function updateDailyStaffAssignment(assignmentId: string, data: UpdateDailyStaffAssignmentInput) {
	return request<DailyStaffAssignmentDto>(`/api/showroom-staff-assignments/${encodeURIComponent(assignmentId)}`, {
		method: 'PUT',
		body: JSON.stringify(data),
	}, 'update showroom staff attendance');
}

export async function updateDailyStaffVehicles(assignmentId: string, vehiclesAttended: number) {
	return updateDailyStaffAssignment(assignmentId, { vehiclesAttended });
}

export async function removeDailyStaff(assignmentId: string) {
	return request<void>(`/api/showroom-staff-assignments/${encodeURIComponent(assignmentId)}`, {
		method: 'DELETE',
		body: JSON.stringify({}),
	}, 'remove showroom staff');
}

export interface ShowroomPaymentDto {
	id: string;
	showroomDailyBillId: string;
	amount: number;
	paymentMethod: string;
	reference?: string | null;
	paymentDate: string;
	notes?: string | null;
	createdAt: string;
}

export interface ShowroomDailyBillDto {
	id: string;
	showroomId: string;
	showroomName: string;
	date: string;
	amount: number;
	amountReceived: number;
	balanceAmount: number;
	status: 'Unpaid' | 'PartiallyPaid' | 'Paid';
	notes?: string | null;
	payments: ShowroomPaymentDto[];
	createdAt: string;
	updatedAt?: string | null;
}

export interface SetShowroomDailyBillInput {
	amount: number;
	notes?: string | null;
}

export interface RecordShowroomPaymentInput {
	amount: number;
	paymentMethod: string;
	reference?: string | null;
	paymentDate?: string | null;
	notes?: string | null;
}

export async function getShowroomDailyBill(showroomId: string, date: string) {
	const qs = new URLSearchParams({ date });
	return request<ShowroomDailyBillDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-bill?` + qs.toString(), {}, 'view showroom bills');
}

export async function setShowroomDailyBill(showroomId: string, date: string, data: SetShowroomDailyBillInput) {
	const qs = new URLSearchParams({ date });
	return request<ShowroomDailyBillDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-bill?` + qs.toString(), {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'set showroom bills');
}

export async function recordShowroomPayment(showroomId: string, date: string, data: RecordShowroomPaymentInput) {
	const qs = new URLSearchParams({ date });
	return request<ShowroomDailyBillDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-bill/payments?` + qs.toString(), {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'record showroom payments');
}

export async function deleteShowroomPayment(paymentId: string) {
	return request<void>(`/api/showroom-payments/${encodeURIComponent(paymentId)}`, {
		method: 'DELETE',
	}, 'delete showroom payments');
}

export interface ShowroomDailyHistoryRowDto {
	date: string;
	staffCount: number;
	totalVehicles: number;
	billedAmount: number;
	receivedAmount: number;
	balanceAmount: number;
	status: 'Unpaid' | 'PartiallyPaid' | 'Paid';
	hasBill: boolean;
}

export interface ShowroomStaffProductivityDto {
	staffId: string;
	staffName: string;
	staffPhone: string;
	staffRole?: string | null;
	daysAssigned: number;
	totalVehiclesAttended: number;
	averageVehiclesPerDay: number;
}

export interface ShowroomSummaryDto {
	showroomId: string;
	showroomName: string;
	fromDate: string;
	toDate: string;
	totalDaysWithActivity: number;
	totalStaffAssignments: number;
	totalVehiclesAttended: number;
	averageVehiclesPerDay: number;
	totalBilled: number;
	totalReceived: number;
	outstandingAmount: number;
	paidDaysCount: number;
	partiallyPaidDaysCount: number;
	unpaidDaysCount: number;
	dailyHistory: ShowroomDailyHistoryRowDto[];
	staffProductivity: ShowroomStaffProductivityDto[];
}

export interface ShowroomOutstandingOverviewDto {
	showroomId: string;
	showroomName: string;
	address: string;
	phone?: string | null;
	isActive: boolean;
	totalBilled: number;
	totalReceived: number;
	outstandingAmount: number;
	unpaidDaysCount: number;
}

export type ShowroomOutstandingDto = ShowroomOutstandingOverviewDto;

export async function getShowroomSummary(showroomId: string, fromDate?: string, toDate?: string) {
	const qs = new URLSearchParams();
	if (fromDate) qs.set('fromDate', fromDate);
	if (toDate) qs.set('toDate', toDate);
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<ShowroomSummaryDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/summary` + suffix, {}, 'view showroom summary');
}

export async function getShowroomsOutstanding(fromDate?: string, toDate?: string) {
	const qs = new URLSearchParams();
	if (fromDate) qs.set('fromDate', fromDate);
	if (toDate) qs.set('toDate', toDate);
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<ShowroomOutstandingOverviewDto[]>('/api/showrooms/outstanding' + suffix, {}, 'view showroom outstanding');
}

// ============================================================================
// Showroom Operations (Vehicle Types, Work Types, Sessions, Vehicle Works)
// ============================================================================

export interface ShowroomVehicleTypeDto {
	id: string;
	code: string;
	name: string;
	displayOrder: number;
	isActive: boolean;
	createdAt: string;
}

export interface CreateShowroomVehicleTypeRequest {
	code: string;
	name: string;
	displayOrder?: number;
	isActive?: boolean;
}

export interface UpdateShowroomVehicleTypeRequest {
	code?: string;
	name?: string;
	displayOrder?: number;
	isActive?: boolean;
}

export async function getShowroomVehicleTypes(includeInactive = false) {
	const qs = includeInactive ? '?includeInactive=true' : '';
	return request<ShowroomVehicleTypeDto[]>('/api/showroom-vehicle-types' + qs, {}, 'view showroom vehicle types');
}

export async function getShowroomVehicleTypeById(id: string) {
	return request<ShowroomVehicleTypeDto>(`/api/showroom-vehicle-types/${encodeURIComponent(id)}`, {}, 'view showroom vehicle types');
}

export async function createShowroomVehicleType(data: CreateShowroomVehicleTypeRequest) {
	return request<ShowroomVehicleTypeDto>('/api/showroom-vehicle-types', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'create showroom vehicle type');
}

export async function updateShowroomVehicleType(id: string, data: UpdateShowroomVehicleTypeRequest) {
	return request<ShowroomVehicleTypeDto>(`/api/showroom-vehicle-types/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'update showroom vehicle type');
}

export async function toggleShowroomVehicleTypeActive(id: string) {
	return request<void>(`/api/showroom-vehicle-types/${encodeURIComponent(id)}/toggle-status`, {
		method: 'PATCH',
	}, 'manage showroom vehicle types');
}

export interface ShowroomWorkTypeDto {
	id: string;
	code: string;
	name: string;
	description?: string | null;
	displayOrder: number;
	isActive: boolean;
	createdAt: string;
}

export interface CreateShowroomWorkTypeRequest {
	code: string;
	name: string;
	description?: string | null;
	displayOrder?: number;
	isActive?: boolean;
}

export interface UpdateShowroomWorkTypeRequest {
	code?: string;
	name?: string;
	description?: string | null;
	displayOrder?: number;
	isActive?: boolean;
}

export async function getShowroomWorkTypes(includeInactive = false) {
	const qs = includeInactive ? '?includeInactive=true' : '';
	return request<ShowroomWorkTypeDto[]>('/api/showroom-work-types' + qs, {}, 'view showroom work types');
}

export async function getShowroomWorkTypeById(id: string) {
	return request<ShowroomWorkTypeDto>(`/api/showroom-work-types/${encodeURIComponent(id)}`, {}, 'view showroom work types');
}

export async function createShowroomWorkType(data: CreateShowroomWorkTypeRequest) {
	return request<ShowroomWorkTypeDto>('/api/showroom-work-types', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'create showroom work type');
}

export async function updateShowroomWorkType(id: string, data: UpdateShowroomWorkTypeRequest) {
	return request<ShowroomWorkTypeDto>(`/api/showroom-work-types/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'update showroom work type');
}

export async function toggleShowroomWorkTypeActive(id: string) {
	return request<void>(`/api/showroom-work-types/${encodeURIComponent(id)}/toggle-status`, {
		method: 'PATCH',
	}, 'manage showroom work types');
}

export type ShowroomStaffSessionType = 'FullDay' | 'MorningHalf' | 'EveningHalf' | 'TransferShift';

export interface ShowroomStaffWorkSessionDto {
	id: string;
	staffId: string;
	staffMasterId: string;
	staffName: string;
	staffPhone?: string | null;
	staffRole?: string | null;
	homeShowroomId: string;
	homeShowroomMasterId: string;
	homeShowroomName: string;
	workingShowroomId: string;
	workingShowroomMasterId: string;
	workingShowroomName: string;
	date: string;
	sessionType: ShowroomStaffSessionType;
	sessionTypeName: string;
	attendanceStatus: string;
	attendanceStatusName: string;
	startTime?: string | null;
	endTime?: string | null;
	transferReason?: string | null;
	notes?: string | null;
	vehicleWorkCount: number;
	createdAt: string;
	updatedAt?: string | null;
}

export interface CreateShowroomStaffWorkSessionRequest {
	staffId: string;
	homeShowroomId?: string | null;
	date: string;
	sessionType?: ShowroomStaffSessionType;
	attendanceStatus?: string;
	startTime?: string | null;
	endTime?: string | null;
	transferReason?: string | null;
	notes?: string | null;
}

export interface UpdateShowroomStaffWorkSessionRequest {
	sessionType?: ShowroomStaffSessionType;
	attendanceStatus?: string;
	startTime?: string | null;
	endTime?: string | null;
	transferReason?: string | null;
	notes?: string | null;
}

export async function getShowroomWorkSessions(showroomId: string, params?: { date?: string; staffId?: string }) {
	const qs = new URLSearchParams();
	if (params?.date) qs.set('date', params.date);
	if (params?.staffId) qs.set('staffId', params.staffId);
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<ShowroomStaffWorkSessionDto[]>(`/api/showrooms/${encodeURIComponent(showroomId)}/work-sessions` + suffix, {}, 'view showroom work sessions');
}

export async function getShowroomWorkSessionById(showroomId: string, sessionId: string) {
	return request<ShowroomStaffWorkSessionDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/work-sessions/${encodeURIComponent(sessionId)}`, {}, 'view showroom work sessions');
}

export async function createShowroomWorkSession(showroomId: string, data: CreateShowroomStaffWorkSessionRequest) {
	return request<ShowroomStaffWorkSessionDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/work-sessions`, {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'create showroom work session');
}

export async function updateShowroomWorkSession(showroomId: string, sessionId: string, data: UpdateShowroomStaffWorkSessionRequest) {
	return request<ShowroomStaffWorkSessionDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/work-sessions/${encodeURIComponent(sessionId)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'update showroom work session');
}

export async function closeShowroomWorkSession(showroomId: string, sessionId: string, data?: { endTime?: string; notes?: string }) {
	return request<ShowroomStaffWorkSessionDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/work-sessions/${encodeURIComponent(sessionId)}/close`, {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data ?? {})),
	}, 'close showroom work session');
}

export interface ShowroomVehicleWorkItemDto {
	id: string;
	showroomVehicleWorkId: string;
	workTypeId: string;
	workTypeCode: string;
	workTypeName: string;
	quantity: number;
	notes?: string | null;
	createdAt: string;
}

export interface ShowroomVehicleWorkItemRequest {
	workTypeId: string;
	quantity: number;
	notes?: string | null;
}

export interface ShowroomVehicleWorkDto {
	id: string;
	showroomId: string;
	showroomMasterId: string;
	showroomName: string;
	staffId: string;
	staffMasterId: string;
	staffName: string;
	vehicleTypeId: string;
	vehicleTypeCode: string;
	vehicleTypeName: string;
	showroomStaffWorkSessionId?: string | null;
	vehicleQuantity: number;
	date: string;
	timeRecorded?: string | null;
	notes?: string | null;
	serviceItems: ShowroomVehicleWorkItemDto[];
	createdAt: string;
	updatedAt?: string | null;
}

export interface CreateShowroomVehicleWorkRequest {
	staffId: string;
	vehicleTypeId: string;
	showroomStaffWorkSessionId?: string | null;
	vehicleQuantity: number;
	date: string;
	timeRecorded?: string | null;
	notes?: string | null;
	serviceItems?: ShowroomVehicleWorkItemRequest[];
}

export interface UpdateShowroomVehicleWorkRequest {
	staffId?: string;
	vehicleTypeId?: string;
	showroomStaffWorkSessionId?: string | null;
	vehicleQuantity?: number;
	date?: string;
	timeRecorded?: string | null;
	notes?: string | null;
	serviceItems?: ShowroomVehicleWorkItemRequest[];
}

export async function getShowroomVehicleWorks(
	showroomId: string,
	params?: { date?: string; staffId?: string; sessionId?: string; vehicleTypeId?: string }
) {
	const qs = new URLSearchParams();
	if (params?.date) qs.set('date', params.date);
	if (params?.staffId) qs.set('staffId', params.staffId);
	if (params?.sessionId) qs.set('sessionId', params.sessionId);
	if (params?.vehicleTypeId) qs.set('vehicleTypeId', params.vehicleTypeId);
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<ShowroomVehicleWorkDto[]>(`/api/showrooms/${encodeURIComponent(showroomId)}/vehicle-works` + suffix, {}, 'view showroom vehicle works');
}

export async function getShowroomVehicleWorkById(showroomId: string, workId: string) {
	return request<ShowroomVehicleWorkDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/vehicle-works/${encodeURIComponent(workId)}`, {}, 'view showroom vehicle works');
}

export interface IndividualVehicleWorkEntry {
	vehicleTypeId: string;
	workTypeIds: string[];
	notes?: string | null;
}

export interface CreateBatchShowroomVehicleWorkRequest {
	staffId: string;
	showroomStaffWorkSessionId?: string | null;
	date: string;
	timeRecorded?: string | null;
	notes?: string | null;
	vehicles: IndividualVehicleWorkEntry[];
}

export async function createShowroomVehicleWork(showroomId: string, data: CreateShowroomVehicleWorkRequest) {
	return request<ShowroomVehicleWorkDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/vehicle-works`, {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'log showroom vehicle work');
}

export async function createBatchShowroomVehicleWork(showroomId: string, data: CreateBatchShowroomVehicleWorkRequest) {
	return request<ShowroomVehicleWorkDto[]>(`/api/showrooms/${encodeURIComponent(showroomId)}/vehicle-works/batch`, {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'log showroom vehicle work batch');
}

export async function updateShowroomVehicleWork(showroomId: string, workId: string, data: UpdateShowroomVehicleWorkRequest) {
	return request<ShowroomVehicleWorkDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/vehicle-works/${encodeURIComponent(workId)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'update showroom vehicle work');
}

export async function deleteShowroomVehicleWork(showroomId: string, workId: string) {
	return request<void>(`/api/showrooms/${encodeURIComponent(showroomId)}/vehicle-works/${encodeURIComponent(workId)}`, {
		method: 'DELETE',
	}, 'delete showroom vehicle work');
}

export interface VehicleTypeWorkSummaryDto {
	vehicleTypeId: string;
	vehicleTypeCode: string;
	vehicleTypeName: string;
	totalVehicles: number;
}

export interface WorkTypeWorkSummaryDto {
	workTypeId: string;
	workTypeCode: string;
	workTypeName: string;
	totalQuantity: number;
}

export interface StaffWorkSummaryDto {
	staffId: string;
	staffMasterId: string;
	staffName: string;
	totalSessions: number;
	totalVehiclesHandled: number;
	totalServicesPerformed: number;
}

export interface ShowroomOperationsSummaryDto {
	showroomId: string;
	showroomMasterId: string;
	showroomName: string;
	fromDate: string;
	toDate: string;
	totalVehiclesHandled: number;
	totalServicesPerformed: number;
	totalActiveStaffSessions: number;
	vehicleTypeBreakdown: VehicleTypeWorkSummaryDto[];
	workTypeBreakdown: WorkTypeWorkSummaryDto[];
	staffProductivityBreakdown: StaffWorkSummaryDto[];
}

export async function getShowroomOperationsSummary(showroomId: string, date: string) {
	const qs = new URLSearchParams({ date });
	return request<ShowroomOperationsSummaryDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/operations-summary?` + qs.toString(), {}, 'view showroom operations summary');
}

export interface StaffDefaultShowroomDto {
	staffId: string;
	staffMasterId: string;
	staffName: string;
	defaultShowroomId?: string | null;
	defaultShowroomMasterId?: string | null;
	defaultShowroomName?: string | null;
}

export async function getStaffDefaultShowroom(staffId: string) {
	return request<StaffDefaultShowroomDto>(`/api/staff/${encodeURIComponent(staffId)}/default-showroom`, {}, 'view staff default showroom');
}

export async function setStaffDefaultShowroom(staffId: string, defaultShowroomId?: string | null) {
	return request<StaffDefaultShowroomDto>(`/api/staff/${encodeURIComponent(staffId)}/default-showroom`, {
		method: 'PUT',
		body: JSON.stringify({ defaultShowroomId }),
	}, 'set staff default showroom');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Recursively walk a parsed JSON payload and convert empty strings on
 * optional-looking string fields to null. ASP.NET Core rejects empty
 * strings for optional [EmailAddress], [Url], etc. validators.
 */
function cleanPayload(obj: unknown): unknown {
 if (typeof obj === 'string') {
 return obj === '' ? null : obj;
 }
 if (Array.isArray(obj)) {
 return obj.map(cleanPayload);
 }
 if (obj && typeof obj === 'object') {
 const out: Record<string, unknown> = {};
 const record = obj as Record<string, unknown>;
 for (const [key, value] of Object.entries(record)) {
 if (typeof value === 'string' && value === '' && /email|address|notes$|description|reference/i.test(key)) {
 out[key] = null;
 } else {
 out[key] = cleanPayload(value);
 }
 }
 return out;
 }
 return obj;
}

export function getJobCardStatusLabel(status: number | string): string {
	if (typeof status === 'string') {
		const parsed = parseInt(status, 10);
		if (isNaN(parsed)) {
			return status.replace(/([a-z])([A-Z])/g, '$1 $2');
		}
		status = parsed;
	}
	const labels: Record<number, string> = { 0: 'Draft', 1: 'In Progress', 2: 'Quality Check', 3: 'Ready', 4: 'Invoiced', 5: 'Paid', 6: 'Delivered', 7: 'Cancelled' };
	return labels[status] ?? `Status ${status}`;
}

// ============================================================================
// Authentication & User Management
// ============================================================================

export interface AuthStatusResponse {
	initialized: boolean;
}

export interface BootstrapOwnerInput {
	fullName: string;
	username: string;
	password: string;
	confirmPassword: string;
}

export interface LoginInput {
	username: string;
	password: string;
}

export interface AuthUserResponse {
	id: string;
	fullName: string;
	username: string;
	email?: string | null;
	role: 'Owner' | 'Manager' | 'Staff';
	isOwner: boolean;
	permissions: string[];
}

export interface LoginResponse {
	token: string;
	user: AuthUserResponse;
}

export interface UserItemDto {
	id: string;
	fullName: string;
	username: string;
	email?: string | null;
	role: 'Owner' | 'Manager' | 'Staff';
	isActive: boolean;
	lastLoginAt?: string | null;
	createdAt: string;
	permissions: string[];
}

export interface CreateUserInput {
	fullName: string;
	username: string;
	email?: string | null;
	password: string;
	confirmPassword: string;
	role: string;
	permissionCodes: string[];
}

export interface UpdateUserInput {
	fullName: string;
	email?: string | null;
	password?: string | null;
	confirmPassword?: string | null;
	role?: string | null;
	permissionCodes?: string[] | null;
}

export interface PermissionDetailDto {
	id: string;
	code: string;
	name: string;
	module: string;
	description?: string | null;
}

export interface PermissionGroupDetailDto {
	module: string;
	permissions: PermissionDetailDto[];
}

export async function getAuthStatus() {
	return request<AuthStatusResponse>('/api/auth/status', {}, 'check authentication status');
}

export async function bootstrapOwner(data: BootstrapOwnerInput) {
	return request<AuthUserResponse>('/api/auth/bootstrap', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'initialize owner account');
}

export async function loginApi(data: LoginInput) {
	return request<LoginResponse>('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'sign in');
}

export async function getMe() {
	return request<AuthUserResponse>('/api/auth/me', {}, 'view user profile');
}

export async function getUsers() {
	return request<UserItemDto[]>('/api/users', {}, 'view users');
}

export async function getUserById(id: string) {
	return request<UserItemDto>(`/api/users/${encodeURIComponent(id)}`, {}, 'view users');
}

export async function createUser(data: CreateUserInput) {
	return request<UserItemDto>('/api/users', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'create users');
}

export async function updateUser(id: string, data: UpdateUserInput) {
	return request<UserItemDto>(`/api/users/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'edit users');
}

export async function toggleUserStatus(id: string) {
	return request<UserItemDto>(`/api/users/${encodeURIComponent(id)}/toggle-status`, {
		method: 'PATCH',
	}, 'edit users');
}

export async function getAvailablePermissions() {
	return request<PermissionGroupDetailDto[]>('/api/users/permissions', {}, 'view permissions');
}

// ── Business Profile & Settings ─────────────────────────────────────────────

export interface BusinessProfileDto {
	id: string;
	businessName: string;
	addressLine1: string;
	addressLine2: string | null;
	city: string;
	state: string;
	postalCode: string;
	phone: string;
	email: string;
	gstin: string | null;
	logoPath: string | null;
	invoicePrefix: string;
	termsAndConditions?: string | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface UpdateBusinessProfileInput {
	businessName: string;
	addressLine1: string;
	addressLine2?: string | null;
	city: string;
	state: string;
	postalCode: string;
	phone: string;
	email: string;
	gstin?: string | null;
	logoPath?: string | null;
	invoicePrefix?: string | null;
	termsAndConditions?: string | null;
}

export interface LogoUploadResponse {
	logoUrl: string;
	profile: BusinessProfileDto;
}

export const BUSINESS_PROFILE_STORAGE_KEY = 'car_spa_business_profile';

export function getCachedBusinessProfile(): BusinessProfileDto | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function setCachedBusinessProfile(profile: BusinessProfileDto | null): void {
	if (typeof localStorage === 'undefined') return;
	try {
		if (profile) {
			localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(profile));
		} else {
			localStorage.removeItem(BUSINESS_PROFILE_STORAGE_KEY);
		}
	} catch {
		// Ignore storage write errors
	}
}

export function resolveLogoUrl(logoPath?: string | null, updatedAt?: string | null): string {
	if (!logoPath || !logoPath.trim()) {
		return '/e6-logo.png';
	}
	const trimmed = logoPath.trim();
	const versionParam = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : '';
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed.includes('?') ? trimmed : `${trimmed}${versionParam}`;
	}
	const base = API_BASE.replace(/\/api\/?$/, '').replace(/\/$/, '');
	const pathWithSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
	const fullUrl = `${base}${pathWithSlash}`;
	return fullUrl.includes('?') ? fullUrl : `${fullUrl}${versionParam}`;
}

export interface PublicBusinessProfileDto {
	businessName: string;
	logoPath: string | null;
	updatedAt: string | null;
}

export async function getPublicBusinessProfile(): Promise<PublicBusinessProfileDto> {
	const res = await request<PublicBusinessProfileDto>('/api/public/business-profile', {}, 'view public branding');
	const existing = getCachedBusinessProfile();
	if (existing) {
		setCachedBusinessProfile({
			...existing,
			businessName: res.businessName,
			logoPath: res.logoPath,
			updatedAt: res.updatedAt,
		});
	} else {
		setCachedBusinessProfile({
			id: '',
			businessName: res.businessName,
			addressLine1: '',
			addressLine2: null,
			city: '',
			state: '',
			postalCode: '',
			phone: '',
			email: '',
			gstin: null,
			logoPath: res.logoPath,
			invoicePrefix: 'INV',
			createdAt: '',
			updatedAt: res.updatedAt,
		});
	}
	return res;
}

export async function getBusinessProfile() {
	const res = await request<BusinessProfileDto>('/api/settings/business', {}, 'view business profile');
	setCachedBusinessProfile(res);
	return res;
}

export async function updateBusinessProfile(data: UpdateBusinessProfileInput) {
	return request<BusinessProfileDto>('/api/settings/business', {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'change business settings');
}

export async function uploadBusinessLogo(file: File) {
	const formData = new FormData();
	formData.append('file', file);
	return request<LogoUploadResponse>('/api/settings/business/logo', {
		method: 'POST',
		body: formData,
	}, 'change business settings');
}

export async function removeBusinessLogo() {
	return request<BusinessProfileDto>('/api/settings/business/logo', {
		method: 'DELETE',
	}, 'change business settings');
}

// ── Audit Logs ──────────────────────────────────────────────────────────────

export interface AuditLogDto {
	id: string;
	timestampUtc: string;
	userId: string | null;
	userName: string | null;
	userRole: string | null;
	action: string;
	module: string;
	entityType: string | null;
	entityId: string | null;
	entityReference: string | null;
	description: string;
	oldValues: string | null;
	newValues: string | null;
	metadata: string | null;
	ipAddress: string | null;
	outcome: string;
	createdAt: string;
}

export interface AuditLogQueryParams {
	page?: number;
	pageSize?: number;
	fromDate?: string;
	toDate?: string;
	userId?: string;
	module?: string;
	action?: string;
	entityType?: string;
	outcome?: string;
	search?: string;
}

export interface PagedAuditLogResult {
	items: AuditLogDto[];
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
	hasPreviousPage: boolean;
	hasNextPage: boolean;
}

export async function getAuditLogs(params: AuditLogQueryParams = {}) {
	const query = new URLSearchParams();
	if (params.page) query.set('page', params.page.toString());
	if (params.pageSize) query.set('pageSize', params.pageSize.toString());
	if (params.fromDate) query.set('fromDate', params.fromDate);
	if (params.toDate) query.set('toDate', params.toDate);
	if (params.userId) query.set('userId', params.userId);
	if (params.module) query.set('module', params.module);
	if (params.action) query.set('action', params.action);
	if (params.entityType) query.set('entityType', params.entityType);
	if (params.outcome) query.set('outcome', params.outcome);
	if (params.search) query.set('search', params.search);

	const qs = query.toString();
	return request<PagedAuditLogResult>(`/api/audit-logs${qs ? `?${qs}` : ''}`, {}, 'view audit logs');
}

// ============================================================================
// WhatsApp Integration
// ============================================================================

export interface WhatsAppConfigDto {
	isEnabled: boolean;
	phoneNumberId: string;
	businessAccountId: string;
	graphApiVersion: string;
	hasAccessToken: boolean;
	invoiceNotificationsEnabled: boolean;
	paymentCompletedNotificationsEnabled: boolean;
	invoiceTemplateName: string;
	invoiceTemplateLanguage: string;
	paymentCompletedTemplateName: string;
	paymentCompletedTemplateLanguage: string;
	updatedAt?: string | null;
	healthStatus?: 'NotConfigured' | 'Healthy' | 'AuthenticationFailed' | 'ConfigurationInvalid' | 'TemporarilyUnavailable' | string;
	lastCheckedAtUtc?: string | null;
	lastSuccessAtUtc?: string | null;
	lastFailureAtUtc?: string | null;
	lastErrorMessage?: string | null;
}

export interface WhatsAppHealthDto {
	status: 'NotConfigured' | 'Healthy' | 'AuthenticationFailed' | 'ConfigurationInvalid' | 'TemporarilyUnavailable' | string;
	lastCheckedAtUtc?: string | null;
	lastSuccessAtUtc?: string | null;
	lastFailureAtUtc?: string | null;
	lastErrorMessage?: string | null;
	isConfigured: boolean;
}

export interface UpdateWhatsAppConfigRequest {
	isEnabled: boolean;
	phoneNumberId: string;
	businessAccountId: string;
	graphApiVersion?: string;
	accessToken?: string;
	invoiceNotificationsEnabled: boolean;
	paymentCompletedNotificationsEnabled: boolean;
	invoiceTemplateName?: string;
	invoiceTemplateLanguage?: string;
	paymentCompletedTemplateName?: string;
	paymentCompletedTemplateLanguage?: string;
}

export interface TestWhatsAppConnectionRequest {
	phoneNumberId?: string;
	businessAccountId?: string;
	graphApiVersion?: string;
	accessToken?: string;
}

export interface TestWhatsAppConnectionResponse {
	isSuccess: boolean;
	message: string;
	details?: string | null;
}

export interface InvoiceWhatsAppStatusDto {
	messageType: string;
	status: string;
	metaMessageId?: string | null;
	sentAtUtc?: string | null;
	failedAtUtc?: string | null;
	errorMessage?: string | null;
	attemptCount: number;
}

export interface MetaWhatsAppTemplateButtonDto {
	type: string;
	text?: string | null;
	url?: string | null;
	phoneNumber?: string | null;
	example?: string[] | null;
}

export interface MetaWhatsAppTemplateComponentDto {
	type: string;
	format?: string | null;
	text?: string | null;
	variables?: string[] | null;
	examples?: string[] | null;
	buttons?: MetaWhatsAppTemplateButtonDto[] | null;
}

export interface MetaWhatsAppTemplateDto {
	id: string;
	name: string;
	status: string;
	category: string;
	language: string;
	components: MetaWhatsAppTemplateComponentDto[];
}

export interface MetaWhatsAppTemplatesResponse {
	isSuccess: boolean;
	message: string;
	templates: MetaWhatsAppTemplateDto[];
	totalCount: number;
	details?: string | null;
}

export async function getWhatsAppConfig() {
	return request<WhatsAppConfigDto>('/api/settings/whatsapp', {}, 'view WhatsApp settings');
}

export async function getWhatsAppHealth(probe = false) {
	return request<WhatsAppHealthDto>(`/api/settings/whatsapp/health${probe ? '?probe=true' : ''}`, {}, 'view WhatsApp integration health');
}

export async function updateWhatsAppConfig(data: UpdateWhatsAppConfigRequest) {
	return request<WhatsAppConfigDto>('/api/settings/whatsapp', {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	}, 'change business settings');
}

export async function testWhatsAppConnection(data?: TestWhatsAppConnectionRequest) {
	return request<TestWhatsAppConnectionResponse>('/api/settings/whatsapp/test', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data ?? {})),
	}, 'test WhatsApp connection');
}

export async function getWhatsAppTemplates() {
	return request<MetaWhatsAppTemplatesResponse>('/api/settings/whatsapp/templates', {}, 'view WhatsApp templates');
}

export interface SendTestWhatsAppMessageRequest {
	templateName: string;
	languageCode: string;
	recipientPhoneNumber: string;
	parameters?: string[];
}

export interface SendTestWhatsAppMessageResponse {
	isSuccess: boolean;
	message: string;
	messageId?: string | null;
	details?: string | null;
}

export async function sendTestWhatsAppMessage(data: SendTestWhatsAppMessageRequest) {
	return request<SendTestWhatsAppMessageResponse>('/api/settings/whatsapp/test-message', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	}, 'send test WhatsApp message');
}

export async function getInvoiceWhatsAppStatus(invoiceId: string) {
	return request<InvoiceWhatsAppStatusDto[]>(`/api/invoices/${encodeURIComponent(invoiceId)}/whatsapp-status`, {}, 'view WhatsApp delivery status');
}

// ============================================================================
// Reports & Dashboard
// ============================================================================

export interface DashboardSummaryDto {
	dateRange: { fromDate: string; toDate: string };
	jobCardKpis: {
		totalJobCards: number;
		newJobCards: number;
		inProgressJobCards: number;
		completedJobCards: number;
		cancelledJobCards: number;
		invoicedJobCards: number;
	};
	vehicleActivity: {
		vehiclesServiced: number;
		totalServicesCompleted: number;
		uniqueVehiclesServiced: number;
	};
	invoiceKpis: {
		draftCount: number;
		generatedCount: number;
		partiallyPaidCount: number;
		paidCount: number;
		cancelledCount: number;
		totalInvoicedAmount: number;
		totalPaidAmount: number;
		totalOutstandingAmount: number;
	};
	sales: {
		grossSubtotal: number;
		totalDiscount: number;
		gstAmount: number;
		netSales: number;
		paymentCollection: number;
		outstanding: number;
	};
	paymentCollection: {
		totalCollected: number;
		cash: number;
		upi: number;
		card: number;
		bankTransfer: number;
	};
	recentActivity: {
		activityType: string;
		title: string;
		description: string;
		amount: number | null;
		timestamp: string;
		referenceId: string | null;
		status: string | null;
	}[];
}

export async function getDashboardSummary(params?: { fromDate?: string; toDate?: string }) {
	const qs = new URLSearchParams();
	if (params?.fromDate) qs.set('fromDate', params.fromDate);
	if (params?.toDate) qs.set('toDate', params.toDate);
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<DashboardSummaryDto>('/api/reports/dashboard' + suffix, {}, 'view reports');
}


