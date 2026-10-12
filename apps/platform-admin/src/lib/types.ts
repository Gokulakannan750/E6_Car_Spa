// Shapes returned by the platform API (backend Controllers/Platform). Money is always in minor units (paise).

export type AdminRole = 'Owner' | 'Billing' | 'Support' | 'ReadOnly';

export interface PlatformAdmin {
	id: string;
	email: string;
	name: string;
	role: AdminRole;
	mustChangePassword: boolean;
}

export interface LoginResponse {
	stage: 'totp' | 'totp-setup';
	challengeToken: string;
	totpSecret: string | null;
	authenticatorUri: string | null;
}

export interface SessionResponse {
	token: string;
	expiresAt: string;
	admin: PlatformAdmin;
}

export type SubscriptionStatus =
	| 'Trialing'
	| 'Active'
	| 'PastDue'
	| 'ReadOnly'
	| 'Suspended'
	| 'Canceled'
	| 'Incomplete';

export interface AuditEntry {
	id: string;
	createdAt: string;
	administratorEmail: string | null;
	action: string;
	targetCompanyId: string | null;
	beforeValues: string | null;
	afterValues: string | null;
	reason: string | null;
	ipAddress: string | null;
}

export interface Dashboard {
	companies: number;
	subscriptionsByStatus: Record<string, number>;
	monthlyRecurringRevenueMinor: number;
	openInvoices: number;
	amountDueMinor: number;
	awaitingRegistration: number;
	migrationFailures: number;
	recentActivity: AuditEntry[];
}

export interface CompanyListItem {
	id: string;
	code: string;
	name: string;
	companyStatus: string;
	subscriptionStatus: SubscriptionStatus | null;
	plan: string | null;
	interval: string | null;
	currentPeriodEnd: string | null;
	trialEndsAt: string | null;
	migrationFailed: boolean;
	createdAt: string;
}

export interface AddOnLine {
	code: string;
	name: string;
	quantity: number;
}

export interface Subscription {
	id: string;
	status: SubscriptionStatus;
	plan: string;
	planName: string;
	interval: string;
	priceMinor: number;
	currency: string;
	startedAt: string;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	trialEndsAt: string | null;
	graceEndsAt: string | null;
	cancelAtPeriodEnd: boolean;
	retainUntil: string | null;
	addOns: AddOnLine[];
}

export interface BillingAccount {
	billingName: string;
	billingEmail: string | null;
	billingPhone: string | null;
	gstin: string | null;
	billingAddress: string | null;
	stateCode: string | null;
}

export interface CompanyDetail {
	id: string;
	code: string;
	name: string;
	companyStatus: string;
	databaseName: string;
	schemaVersion: string | null;
	migrationError: string | null;
	createdAt: string;
	registeredAt: string | null;
	registrationCodeOpen: boolean;
	subscription: Subscription | null;
	billingAccount: BillingAccount | null;
	features: Record<string, string>;
	seatLimit: number | null;
	seatsUsed: number | null;
}

export interface PlanRequest {
	planCode: string;
	interval: string;
	addOns?: Record<string, number> | null;
	paidUntil: string;
}

export interface CreateCompanyResponse {
	id: string;
	code: string;
	name: string;
	registrationCode: string;
	registrationCodeExpiresAt: string;
	databaseName: string;
}

export interface RegistrationCodeResponse {
	registrationCode: string;
	expiresAt: string;
}

export interface InvoiceLine {
	description: string;
	quantity: number;
	unitPriceMinor: number;
	amountMinor: number;
}

export interface Payment {
	id: string;
	provider: string;
	amountMinor: number;
	currency: string;
	status: string;
	paidAt: string | null;
	reference: string | null;
	refundedAmountMinor: number;
}

export interface Invoice {
	id: string;
	invoiceNumber: string;
	title: string;
	status: string;
	currency: string;
	subtotalMinor: number;
	taxMinor: number;
	taxRatePercent: number | null;
	totalMinor: number;
	amountDueMinor: number;
	issuedAt: string;
	dueAt: string;
	paidAt: string | null;
	periodStart: string | null;
	periodEnd: string | null;
	billToName: string;
	lines: InvoiceLine[];
	payments: Payment[];
}

export interface SubscriptionEvent {
	eventType: string;
	effectiveAt: string;
	actorType: string;
	metadata: string | null;
}

export interface CompanyBilling {
	invoices: Invoice[];
	events: SubscriptionEvent[];
}

export interface InvoiceListItem {
	id: string;
	invoiceNumber: string;
	companyId: string;
	companyCode: string;
	companyName: string;
	status: string;
	overdue: boolean;
	currency: string;
	totalMinor: number;
	amountDueMinor: number;
	issuedAt: string;
	dueAt: string;
	paidAt: string | null;
	periodStart: string | null;
	periodEnd: string | null;
}

export interface Seller {
	name: string;
	address: string;
	phone: string;
	email: string;
	gstin: string | null;
}

export interface InvoiceDetail {
	invoice: Invoice;
	companyCode: string;
	companyName: string;
	billToAddress: string | null;
	billToGstin: string | null;
	seller: Seller;
}

export interface Entitlement {
	featureKey: string;
	value: string;
}

export interface PlanVersion {
	id: string;
	version: number;
	interval: string;
	currency: string;
	priceMinor: number;
	includedSeats: number;
	effectiveFrom: string;
	effectiveTo: string | null;
	entitlements: Entitlement[];
}

export interface Plan {
	id: string;
	code: string;
	name: string;
	isActive: boolean;
	versions: PlanVersion[];
}

export interface AddOnPrice {
	id: string;
	version: number;
	interval: string;
	currency: string;
	unitPriceMinor: number;
	effectiveFrom: string;
	effectiveTo: string | null;
}

export interface AddOn {
	id: string;
	code: string;
	name: string;
	featureKey: string;
	value: string;
	isActive: boolean;
	prices: AddOnPrice[];
}

export interface Catalog {
	plans: Plan[];
	addOns: AddOn[];
	chargesGst: boolean;
	gstRatePercent: number;
}

export interface MigrationStatus {
	code: string;
	name: string;
	schemaVersion: string | null;
	lastMigratedAt: string | null;
	migrationError: string | null;
}

export interface AdminListItem {
	id: string;
	email: string;
	name: string;
	role: AdminRole;
	isActive: boolean;
	totpConfirmed: boolean;
	mustChangePassword: boolean;
	lastSignInAt: string | null;
	createdAt: string;
}
