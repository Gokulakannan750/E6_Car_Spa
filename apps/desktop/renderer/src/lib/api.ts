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
 const res = await fetch(`${API_BASE}${path}`, {
 ...options,
 headers: {
 'Content-Type': 'application/json',
 ...options.headers,
 },
 });

 if (res.status === 204) return undefined as T;

 if (!res.ok) {
 let errorMessage = `HTTP ${res.status} ${res.statusText}`;
 try {
 const errBody = await res.clone().json();
 if (errBody && typeof errBody === 'object') {
 const rec = errBody as Record<string, unknown>;
 if (typeof rec.detail === 'string' && rec.detail.trim()) errorMessage = rec.detail;
 else if (typeof rec.error === 'string' && rec.error.trim()) errorMessage = rec.error;
 else if (typeof rec.title === 'string' && rec.title.trim()) errorMessage = rec.title;
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

export interface JobCardDto {
 id: string;
 jobCardNumber: string;
 customer: {
 id: string;
 name: string;
 phone: string;
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

export async function getCustomers(params: { page: number; pageSize: number; search: string }) {
 const qs = new URLSearchParams();
 qs.set('page', String(params.page));
 qs.set('pageSize', String(params.pageSize));
 if (params.search) qs.set('search', params.search);
 const suffix = '?' + qs.toString();
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

export interface StaffAdvanceDto {
 id: string;
 staffId: string;
 staffName: string;
 staffRole: string | null;
 advanceType: string;
 description: string | null;
 amount: number;
 advanceDate: string;
 paymentMethod: string | null;
 status: string;
 notes: string | null;
 createdAt: string;
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
 staffName: string;
 staffRole?: string | null;
 advanceType: string;
 description?: string | null;
 amount: number;
 advanceDate: string;
 paymentMethod?: string | null;
 notes?: string | null;
}

export interface StaffAdvanceListResponse {
 items: StaffAdvanceDto[];
 totalCount: number;
 page: number;
 pageSize: number;
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

export async function updateStaffAdvance(id: string, data: Partial<CreateStaffAdvanceInput>) {
 return request<StaffAdvanceDto>(`/api/staff-advances/${encodeURIComponent(id)}`, {
 method: 'PUT',
 body: JSON.stringify(cleanPayload(data)),
 });
}

export async function deleteStaffAdvance(id: string) {
 return request<void>(`/api/staff-advances/${encodeURIComponent(id)}`, {
 method: 'DELETE',
 });
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
