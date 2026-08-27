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

export function getAuthToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string | null) {
	if (typeof localStorage === 'undefined') return;
	if (token) {
		localStorage.setItem(TOKEN_STORAGE_KEY, token);
	} else {
		localStorage.removeItem(TOKEN_STORAGE_KEY);
	}
}

export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
		public body: unknown,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

async function request<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const token = getAuthToken();
	const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
	const headers: Record<string, string> = {
		...(isFormData ? {} : { 'Content-Type': 'application/json' }),
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...((options.headers as Record<string, string>) || {}),
	};

	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers,
	});

	if (res.status === 204) return undefined as T;

	if (res.status === 401 && !path.includes('/api/auth/login')) {
		setAuthToken(null);
		localStorage.removeItem(USER_STORAGE_KEY);
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('auth:unauthorized'));
		}
	}

	if (!res.ok) {
		let errorMessage = `HTTP ${res.status} ${res.statusText}`;
		try {
			const errBody = await res.clone().json();
			if (errBody && typeof errBody === 'object') {
				const rec = errBody as Record<string, unknown>;
				if (typeof rec.detail === 'string' && rec.detail.trim()) errorMessage = rec.detail;
				else if (typeof rec.error === 'string' && rec.error.trim()) errorMessage = rec.error;
				else if (typeof rec.title === 'string' && rec.title.trim()) errorMessage = rec.title;
				else if (typeof rec.message === 'string' && rec.message.trim()) errorMessage = rec.message;
			}
		} catch {
			// Non-JSON error response
		}
		throw new ApiError(errorMessage, res.status, null);
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
	return request<CustomerListResponse>('/api/customers' + suffix);
}

export async function getCustomerById(id: string) {
	return request<CustomerDto>(`/api/customers/${encodeURIComponent(id)}`);
}

export async function getCustomerByPhone(phone: string) {
 return request<CustomerDto>(`/api/customers/by-phone/${encodeURIComponent(phone)}`);
}

export async function getVehicleByRegistration(registrationNumber: string) {
 return request<VehicleDto>(`/api/vehicles/by-registration/${encodeURIComponent(registrationNumber)}`);
}

export async function createCustomer(data: CreateCustomerInput) {
 return request<CustomerDto>('/api/customers', {
 method: 'POST',
 body: JSON.stringify(cleanPayload(data)),
 });
}

export async function updateCustomer(data: UpdateCustomerInput) {
 return request<CustomerDto>(`/api/customers/${encodeURIComponent(data.id)}`, {
 method: 'PUT',
 body: JSON.stringify(cleanPayload(data)),
 });
}

export async function deleteCustomer(id: string) {
 return request<void>(`/api/customers/${encodeURIComponent(id)}`, {
 method: 'DELETE',
 });
}

// ============================================================================
// Vehicles
// ============================================================================

export async function getVehiclesByCustomer(customerId: string) {
 return request<VehicleDto[]>(`/api/vehicles/by-customer/${encodeURIComponent(customerId)}`);
}

export async function createVehicle(data: CreateVehicleInput) {
	return request<VehicleDto>('/api/vehicles', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function updateVehicle(id: string, data: UpdateVehicleInput) {
	return request<VehicleDto>(`/api/vehicles/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	});
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
	return request<{ items: JobCardListDto[]; totalCount: number }>('/api/job-cards?' + qs.toString());
}

export async function getJobCardsByCustomer(customerId: string, params?: { page?: number; pageSize?: number }) {
	const qs = new URLSearchParams();
	if (params?.page) qs.set('page', String(params.page));
	if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<JobCardListResponse>(`/api/job-cards/by-customer/${encodeURIComponent(customerId)}${suffix}`);
}

export async function getJobCardById(id: string) {
 return request<JobCardDto>(`/api/job-cards/${encodeURIComponent(id)}`);
}

export async function createJobCard(data: CreateJobCardInput) {
 return request<JobCardDto>('/api/job-cards', {
 method: 'POST',
 body: JSON.stringify(data),
 });
}

export async function updateJobCardServices(id: string, services: { serviceId: string; quantity: number; discountAmount: number }[]) {
 return request<JobCardDto>(`/api/job-cards/${encodeURIComponent(id)}/services`, {
 method: 'PUT',
 body: JSON.stringify({ services }),
 });
}

export async function deleteJobCard(id: string) {
 return request<void>(`/api/job-cards/${encodeURIComponent(id)}`, {
 method: 'DELETE',
 });
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
  return request<InvoiceListResponse>('/api/invoices?' + qs.toString());
}

export async function getInvoiceById(id: string) {
  return request<InvoiceDto>(`/api/invoices/${encodeURIComponent(id)}`);
}

export async function getInvoiceByNumber(invoiceNumber: string) {
  return request<InvoiceDto>(`/api/invoices/by-number/${encodeURIComponent(invoiceNumber)}`);
}

export async function createInvoiceFromJobCard(jobCardId: string) {
  return request<InvoiceDto>(`/api/invoices/from-job-card/${encodeURIComponent(jobCardId)}`, {
    method: 'POST',
  });
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput) {
  return request<InvoiceDto>(`/api/invoices/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(cleanPayload(data)),
  });
}

export async function generateInvoice(id: string) {
  return request<InvoiceDto>(`/api/invoices/${encodeURIComponent(id)}/generate`, {
    method: 'POST',
  });
}

export async function getInvoicePayments(invoiceId: string) {
  return request<PaymentDto[]>(`/api/invoices/${encodeURIComponent(invoiceId)}/payments`);
}

export async function recordPayment(invoiceId: string, data: RecordPaymentInput) {
  return request<PaymentDto>(`/api/invoices/${encodeURIComponent(invoiceId)}/payments`, {
    method: 'POST',
    body: JSON.stringify(cleanPayload(data)),
  });
}

export async function createPublicInvoiceLink(invoiceId: string) {
  return request<InvoicePublicLinkResponse>(`/api/invoices/${encodeURIComponent(invoiceId)}/public-link`, {
    method: 'POST',
  });
}

export async function getPublicInvoiceLinkStatus(invoiceId: string) {
  return request<InvoicePublicLinkStatusResponse>(`/api/invoices/${encodeURIComponent(invoiceId)}/public-link/status`);
}

export async function revokePublicInvoiceLink(invoiceId: string) {
  return request<{ success: boolean; message: string }>(`/api/invoices/${encodeURIComponent(invoiceId)}/public-link`, {
    method: 'DELETE',
  });
}

export async function rotatePublicInvoiceLink(invoiceId: string) {
  return request<InvoicePublicLinkResponse>(`/api/invoices/${encodeURIComponent(invoiceId)}/public-link/rotate`, {
    method: 'POST',
  });
}

export async function getPublicInvoice(token: string) {
  const res = await fetch(`${API_BASE}/api/public/invoices/${encodeURIComponent(token)}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new ApiError(`Invoice not found or link expired`, res.status, null);
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
 return request<{ items: ServiceDto[]; totalCount: number }>('/api/services' + suffix);
}

export async function getServiceById(id: string) {
 return request<ServiceDto>(`/api/services/${encodeURIComponent(id)}`);
}

export async function createService(data: CreateServiceInput) {
 return request<ServiceDto>('/api/services', {
 method: 'POST',
 body: JSON.stringify(cleanPayload(data)),
 });
}

export async function updateService(id: string, data: CreateServiceInput) {
 return request<ServiceDto>(`/api/services/${encodeURIComponent(id)}`, {
 method: 'PUT',
 body: JSON.stringify(cleanPayload(data)),
 });
}

export async function getServiceCategories() {
 return request<string[]>('/api/services/categories');
}

export async function getCatalogueServices(params?: { category?: string; search?: string }) {
 const qs = new URLSearchParams();
 if (params?.category) qs.set('category', params.category);
 if (params?.search) qs.set('search', params.search);
 const suffix = qs.toString() ? '?' + qs.toString() : '';
 return request<CatalogueServiceDto[]>('/api/catalogue' + suffix);
}

export async function createCatalogueService(data: CreateCatalogueServiceInput) {
 return request<CatalogueServiceDto>('/api/catalogue', {
 method: 'POST',
 body: JSON.stringify(data),
 });
}

export async function updateCatalogueService(id: string, data: Partial<CreateCatalogueServiceInput>) {
 return request<CatalogueServiceDto>(`/api/catalogue/${encodeURIComponent(id)}`, {
 method: 'PUT',
 body: JSON.stringify(data),
 });
}

export async function deleteCatalogueService(id: string) {
 return request<void>(`/api/catalogue/${encodeURIComponent(id)}`, {
 method: 'DELETE',
 });
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
	createdAt: string;
	updatedAt?: string | null;
}

export interface StaffDto {
	id: string;
	name: string;
	phoneNumber: string;
	email: string | null;
	address: string | null;
	role: string | null;
	isActive: boolean;
	totalAdvances: number;
	totalAdvanceAmount: number;
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
	return request<StaffAdvanceListResponse>('/api/staff-advances?' + qs.toString());
}

export async function getStaffAdvanceById(id: string) {
	return request<StaffAdvanceDto>(`/api/staff-advances/${encodeURIComponent(id)}`);
}

export async function createStaffAdvance(data: CreateStaffAdvanceInput) {
	return request<StaffAdvanceDto>('/api/staff-advances', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function settleStaffAdvance(id: string) {
	return request<StaffAdvanceDto>(`/api/staff-advances/${encodeURIComponent(id)}/settle`, {
		method: 'POST',
	});
}

export async function obsoleteStaffAdvance(id: string, data: ObsoleteStaffAdvanceInput) {
	return request<StaffAdvanceDto>(`/api/staff-advances/${encodeURIComponent(id)}/obsolete`, {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function getStaffAdvanceHistory(staffId: string) {
	return request<StaffAdvanceHistoryDto>(`/api/staff-advances/staff/${encodeURIComponent(staffId)}/history`);
}

export async function getStaffList() {
 return request<StaffDto[]>('/api/staff-advances/staff');
}

export interface CreateStaffInput {
	name: string;
	phoneNumber: string;
	email?: string | null;
	address?: string | null;
	role?: string | null;
	isActive?: boolean;
}

export interface UpdateStaffInput {
	name?: string;
	phoneNumber?: string;
	email?: string | null;
	address?: string | null;
	role?: string | null;
	isActive?: boolean;
}

export async function createStaffMember(data: CreateStaffInput) {
	return request<StaffDto>('/api/staff-advances/staff', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function updateStaffMember(id: string, data: UpdateStaffInput) {
	return request<StaffDto>(`/api/staff-advances/staff/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function deleteStaffMember(id: string) {
	return request<void>(`/api/staff-advances/staff/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	});
}

export async function getStaffById(id: string) {
 return request<StaffDto>(`/api/staff-advances/staff/${encodeURIComponent(id)}`);
}

export async function getStaffAdvancesByStaffId(staffId: string) {
 return request<StaffAdvanceDto[]>(`/api/staff-advances/staff/${encodeURIComponent(staffId)}/advances`);
}

// ============================================================================
// Dashboard
// ============================================================================

export async function getDashboardStats() {
 return request<DashboardStats>('/api/dashboard/stats');
}

// ============================================================================
// Health
// ============================================================================

export async function getHealth() {
	return request<HealthResponse>('/api/health');
}

// ============================================================================
// Showrooms & Daily Staff Assignments
// ============================================================================

export interface ShowroomDto {
	id: string;
	name: string;
	address: string;
	phone?: string | null;
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
	isActive?: boolean;
}

export interface UpdateShowroomInput {
	name?: string;
	address?: string;
	phone?: string | null;
	isActive?: boolean;
}

export interface DailyStaffAssignmentDto {
	id: string;
	showroomId: string;
	showroomName: string;
	staffId: string;
	staffName: string;
	staffPhone: string;
	staffRole?: string | null;
	date: string;
	vehiclesAttended: number;
	createdAt: string;
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
}

export async function getShowrooms(params?: { search?: string; isActive?: boolean }) {
	const qs = new URLSearchParams();
	if (params?.search) qs.set('search', params.search);
	if (params?.isActive !== undefined) qs.set('isActive', String(params.isActive));
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<ShowroomDto[]>('/api/showrooms' + suffix);
}

export async function getShowroomById(id: string) {
	return request<ShowroomDto>(`/api/showrooms/${encodeURIComponent(id)}`);
}

export async function createShowroom(data: CreateShowroomInput) {
	return request<ShowroomDto>('/api/showrooms', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function updateShowroom(id: string, data: UpdateShowroomInput) {
	return request<ShowroomDto>(`/api/showrooms/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function deleteShowroom(id: string) {
	return request<void>(`/api/showrooms/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	});
}

export async function toggleShowroomActive(id: string) {
	return request<void>(`/api/showrooms/${encodeURIComponent(id)}/toggle-active`, {
		method: 'PATCH',
	});
}

export async function getDailyStaff(showroomId: string, date: string) {
	const qs = new URLSearchParams({ date });
	return request<DailyStaffResponse>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-staff?` + qs.toString());
}

export async function confirmDailyStaffAttendance(showroomId: string, date: string) {
	const qs = new URLSearchParams({ date });
	return request<DailyStaffResponse>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-staff/confirm?` + qs.toString(), {
		method: 'POST',
	});
}

export async function unlockDailyStaffAttendance(showroomId: string, date: string) {
	const qs = new URLSearchParams({ date });
	return request<DailyStaffResponse>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-staff/unlock?` + qs.toString(), {
		method: 'POST',
	});
}

export async function assignDailyStaff(showroomId: string, data: CreateDailyStaffAssignmentInput) {
	return request<DailyStaffAssignmentDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-staff`, {
		method: 'POST',
		body: JSON.stringify(data),
	});
}

export async function updateDailyStaffVehicles(assignmentId: string, vehiclesAttended: number) {
	return request<DailyStaffAssignmentDto>(`/api/showroom-staff-assignments/${encodeURIComponent(assignmentId)}`, {
		method: 'PUT',
		body: JSON.stringify({ vehiclesAttended }),
	});
}

export async function removeDailyStaff(assignmentId: string) {
	return request<void>(`/api/showroom-staff-assignments/${encodeURIComponent(assignmentId)}`, {
		method: 'DELETE',
	});
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
	return request<ShowroomDailyBillDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-bill?` + qs.toString());
}

export async function setShowroomDailyBill(showroomId: string, date: string, data: SetShowroomDailyBillInput) {
	const qs = new URLSearchParams({ date });
	return request<ShowroomDailyBillDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-bill?` + qs.toString(), {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function recordShowroomPayment(showroomId: string, date: string, data: RecordShowroomPaymentInput) {
	const qs = new URLSearchParams({ date });
	return request<ShowroomDailyBillDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/daily-bill/payments?` + qs.toString(), {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function deleteShowroomPayment(paymentId: string) {
	return request<void>(`/api/showroom-payments/${encodeURIComponent(paymentId)}`, {
		method: 'DELETE',
	});
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

export async function getShowroomSummary(showroomId: string, fromDate?: string, toDate?: string) {
	const qs = new URLSearchParams();
	if (fromDate) qs.set('fromDate', fromDate);
	if (toDate) qs.set('toDate', toDate);
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<ShowroomSummaryDto>(`/api/showrooms/${encodeURIComponent(showroomId)}/summary` + suffix);
}

export async function getShowroomsOutstanding(fromDate?: string, toDate?: string) {
	const qs = new URLSearchParams();
	if (fromDate) qs.set('fromDate', fromDate);
	if (toDate) qs.set('toDate', toDate);
	const suffix = qs.toString() ? '?' + qs.toString() : '';
	return request<ShowroomOutstandingOverviewDto[]>('/api/showrooms/outstanding' + suffix);
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

export function getJobCardStatusLabel(status: number): string {
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
	return request<AuthStatusResponse>('/api/auth/status');
}

export async function bootstrapOwner(data: BootstrapOwnerInput) {
	return request<AuthUserResponse>('/api/auth/bootstrap', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function loginApi(data: LoginInput) {
	return request<LoginResponse>('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function getMe() {
	return request<AuthUserResponse>('/api/auth/me');
}

export async function getUsers() {
	return request<UserItemDto[]>('/api/users');
}

export async function getUserById(id: string) {
	return request<UserItemDto>(`/api/users/${encodeURIComponent(id)}`);
}

export async function createUser(data: CreateUserInput) {
	return request<UserItemDto>('/api/users', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function updateUser(id: string, data: UpdateUserInput) {
	return request<UserItemDto>(`/api/users/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function toggleUserStatus(id: string) {
	return request<UserItemDto>(`/api/users/${encodeURIComponent(id)}/toggle-status`, {
		method: 'PATCH',
	});
}

export async function getAvailablePermissions() {
	return request<PermissionGroupDetailDto[]>('/api/users/permissions');
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

export async function getBusinessProfile() {
	return request<BusinessProfileDto>('/api/settings/business');
}

export async function updateBusinessProfile(data: UpdateBusinessProfileInput) {
	return request<BusinessProfileDto>('/api/settings/business', {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function uploadBusinessLogo(file: File) {
	const formData = new FormData();
	formData.append('file', file);
	return request<LogoUploadResponse>('/api/settings/business/logo', {
		method: 'POST',
		body: formData,
	});
}

export async function removeBusinessLogo() {
	return request<BusinessProfileDto>('/api/settings/business/logo', {
		method: 'DELETE',
	});
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
	return request<PagedAuditLogResult>(`/api/audit-logs${qs ? `?${qs}` : ''}`);
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

export async function getWhatsAppConfig() {
	return request<WhatsAppConfigDto>('/api/settings/whatsapp');
}

export async function updateWhatsAppConfig(data: UpdateWhatsAppConfigRequest) {
	return request<WhatsAppConfigDto>('/api/settings/whatsapp', {
		method: 'PUT',
		body: JSON.stringify(cleanPayload(data)),
	});
}

export async function testWhatsAppConnection(data?: TestWhatsAppConnectionRequest) {
	return request<TestWhatsAppConnectionResponse>('/api/settings/whatsapp/test', {
		method: 'POST',
		body: JSON.stringify(cleanPayload(data ?? {})),
	});
}

export async function getInvoiceWhatsAppStatus(invoiceId: string) {
	return request<InvoiceWhatsAppStatusDto[]>(`/api/invoices/${encodeURIComponent(invoiceId)}/whatsapp-status`);
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
	return request<DashboardSummaryDto>('/api/reports/dashboard' + suffix);
}


