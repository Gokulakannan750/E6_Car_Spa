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
 phone: string;
 email: string | null;
 address: string | null;
 gstNumber: string | null;
 createdAt: string;
 updatedAt: string;
}

export interface CustomerListResponse {
 items: CustomerDto[];
 totalCount: number;
 page: number;
 pageSize: number;
}

export interface CreateCustomerInput {
 name: string;
 phone: string;
 email?: string | null;
 address?: string | null;
 gstNumber?: string | null;
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
 year: number | null;
 color: string | null;
 vin: string | null;
 createdAt: string;
}

export interface CreateVehicleInput {
 customerId: string;
 registrationNumber: string;
 make: string;
 model: string;
 year?: number | null;
 color?: string | null;
 vin?: string | null;
}

export interface JobCardDto {
 id: string;
 jobCardNumber: string;
 customerId: string;
 vehicleId: string;
 status: string;
 services: ServiceItemDto[];
 totalAmount: number;
 advancePaid: number;
 balanceDue: number;
 notes: string | null;
 createdAt: string;
 updatedAt: string;
}

export interface ServiceItemDto {
 id: string;
 name: string;
 category: string;
 price: number;
 quantity: number;
}

export interface CreateJobCardInput {
 customerId: string;
 vehicleId: string;
 services: { name: string; category: string; price: number; quantity: number }[];
 notes?: string | null;
}

export interface QuotationDto {
 id: string;
 quotationNumber: string;
 jobCardId: string;
 customerId: string;
 vehicleId: string;
 services: ServiceItemDto[];
 subtotal: number;
 taxAmount: number;
 totalAmount: number;
 status: string;
 validUntil: string;
 createdAt: string;
}

export interface InvoiceDto {
 id: string;
 invoiceNumber: string;
 quotationId: string;
 jobCardId: string;
 customerId: string;
 vehicleId: string;
 services: ServiceItemDto[];
 subtotal: number;
 discount: number;
 taxAmount: number;
 totalAmount: number;
 amountPaid: number;
 balanceDue: number;
 paymentStatus: string;
 paymentMethod: string | null;
 createdAt: string;
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

export interface AdvanceDto {
 id: string;
 staffId: string;
 staffName: string;
 amount: number;
 reason: string | null;
 status: string;
 createdAt: string;
 settledAt: string | null;
}

export interface CreateAdvanceInput {
 staffId: string;
 amount: number;
 reason?: string | null;
}

export interface StaffDto {
 id: string;
 name: string;
 role: string;
 phone: string;
 email: string | null;
 isActive: boolean;
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

export async function getCustomerByRegistration(registrationNumber: string) {
 return request<CustomerDto>(`/api/customers/by-registration/${encodeURIComponent(registrationNumber)}`);
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
 return request<VehicleDto[]>(`/api/customers/${encodeURIComponent(customerId)}/vehicles`);
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
 return request<{ items: JobCardDto[]; totalCount: number }>('/api/jobcards?' + qs.toString());
}

export async function getJobCardById(id: string) {
 return request<JobCardDto>(`/api/jobcards/${encodeURIComponent(id)}`);
}

export async function createJobCard(data: CreateJobCardInput) {
 return request<JobCardDto>('/api/jobcards', {
 method: 'POST',
 body: JSON.stringify(data),
 });
}

export async function updateJobCard(id: string, data: Partial<CreateJobCardInput>) {
 return request<JobCardDto>(`/api/jobcards/${encodeURIComponent(id)}`, {
 method: 'PUT',
 body: JSON.stringify(data),
 });
}

export async function deleteJobCard(id: string) {
 return request<void>(`/api/jobcards/${encodeURIComponent(id)}`, {
 method: 'DELETE',
 });
}

// ============================================================================
// Quotations & Invoices
// ============================================================================

export async function getQuotations(params: { page: number; pageSize: number; search?: string }) {
 const qs = new URLSearchParams();
 qs.set('page', String(params.page));
 qs.set('pageSize', String(params.pageSize));
 if (params.search) qs.set('search', params.search);
 return request<{ items: QuotationDto[]; totalCount: number }>('/api/quotations?' + qs.toString());
}

export async function getQuotationById(id: string) {
 return request<QuotationDto>(`/api/quotations/${encodeURIComponent(id)}`);
}

export async function getInvoices(params: { page: number; pageSize: number; search?: string }) {
 const qs = new URLSearchParams();
 qs.set('page', String(params.page));
 qs.set('pageSize', String(params.pageSize));
 if (params.search) qs.set('search', params.search);
 return request<{ items: InvoiceDto[]; totalCount: number }>('/api/invoices?' + qs.toString());
}

export async function getInvoiceById(id: string) {
 return request<InvoiceDto>(`/api/invoices/${encodeURIComponent(id)}`);
}

export async function createInvoice(data: { quotationId: string; paymentMethod?: string }) {
 return request<InvoiceDto>('/api/invoices', {
 method: 'POST',
 body: JSON.stringify(data),
 });
}

export async function recordPayment(invoiceId: string, data: { amount: number; paymentMethod: string }) {
 return request<InvoiceDto>(`/api/invoices/${encodeURIComponent(invoiceId)}/payment`, {
 method: 'POST',
 body: JSON.stringify(data),
 });
}

// ============================================================================
// Catalogue
// ============================================================================

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

export async function getAdvances(params: { page: number; pageSize: number; search?: string }) {
 const qs = new URLSearchParams();
 qs.set('page', String(params.page));
 qs.set('pageSize', String(params.pageSize));
 if (params.search) qs.set('search', params.search);
 return request<{ items: AdvanceDto[]; totalCount: number }>('/api/advances?' + qs.toString());
}

export async function createAdvance(data: CreateAdvanceInput) {
 return request<AdvanceDto>('/api/advances', {
 method: 'POST',
 body: JSON.stringify(data),
 });
}

export async function settleAdvance(id: string) {
 return request<AdvanceDto>(`/api/advances/${encodeURIComponent(id)}/settle`, {
 method: 'POST',
 });
}

// ============================================================================
// Staff
// ============================================================================

export async function getStaff() {
 return request<StaffDto[]>('/api/staff');
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
