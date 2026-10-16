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

export type SubscriptionStatus = 'Trialing' | 'Active' | 'PastDue' | 'ReadOnly' | 'Suspended' | 'Canceled' | 'Incomplete';

export interface AuditEntry {
	productKey: string | null;
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
	/** Total user licences on the subscription. */
	seats: Seat[];
	productKey: string;
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
	seats: Seat[];
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
	/** Active users per app access in the company's database (null when it could not be read). */
	seatUsage: Seat[] | null;
	productKey: string;
}

/** When an approved plan change takes effect: at once (nothing or the rest of the period to pay) or at the period end. */
export type PlanChangeTiming = 'Now' | 'NowWithCharge' | 'AtPeriodEnd';

export interface PlanChangeBody {
	planCode: string;
	interval: string;
	seats: SeatQuantities;
	addOns: Record<string, number>;
	reason?: string;
}

export interface PlanChangePreview {
	timing: PlanChangeTiming;
	currentPeriodPriceMinor: number;
	newPeriodPriceMinor: number;
	amountNowMinor: number;
	currency: string;
	effectiveAt: string;
}

export type PlanChangeStatus = 'Pending' | 'Scheduled' | 'Applied' | 'Declined' | 'Cancelled' | 'Expired';

/** A change Trovo proposed; the company's Owner approves or declines it in the app. */
export interface PlanChangeRequest extends PlanChangePreview {
	id: string;
	status: PlanChangeStatus;
	planCode: string;
	interval: string;
	seats: Seat[];
	addOns: Record<string, number>;
	expiresAt: string;
	reason: string | null;
	requestedByEmail: string | null;
	createdAt: string;
	decidedAt: string | null;
	decidedByName: string | null;
	adjustmentInvoiceNumber: string | null;
}

export interface PlanRequest {
	planCode: string;
	interval: string;
	addOns?: Record<string, number> | null;
	paidUntil: string;
	seats?: SeatQuantities | null;
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
	productKey: string;
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
	/** Company fee per period (0 when the price is licences only). */
	priceMinor: number;
	/** The fewest user licences a subscription on this version may have. */
	includedSeats: number;
	effectiveFrom: string;
	effectiveTo: string | null;
	entitlements: Entitlement[];
	seats: Seat[];
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
	productKey: string;
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

export interface PlatformSettings {
	trialDays: number;
	graceDays: number;
	trialLicences: number;
	renewalInvoiceDaysBefore: number;
	/** How long a franchise sign-up code works (10 minutes to 7 days). */
	franchiseCodeMinutes: number;
}

export interface PlanTermsInput {
	companyFeeMinor: number;
	seatPrices: Record<string, number>;
}

export type SignupStatus = 'AwaitingPayment' | 'Completed' | 'Expired' | 'NeedsAttention' | 'Processing';

/** An order from the public sign-up website. */
export interface SignupOrder {
	id: string;
	createdAt: string;
	start: 'Trial' | 'Paid';
	status: SignupStatus;
	businessName: string;
	ownerName: string;
	mobile: string;
	email: string;
	city: string;
	state: string;
	planCode: string | null;
	interval: string | null;
	seats: Seat[];
	productKey: string;
	amountMinor: number;
	currency: string;
	companyId: string | null;
	companyCode: string | null;
	paymentProvider: string | null;
	paymentReference: string | null;
	failureReason: string | null;
	completedAt: string | null;
	expiresAt: string;
	/** Company code of the franchisor whose franchise code was used, if any. */
	franchisorCode?: string | null;
	franchiseLinked?: boolean;
	franchiseProblem?: string | null;
}

export type SeatModel = 'None' | 'Counted' | 'PerType';
export type SeatQuantities = Record<string, number>;
export interface Seat {
	code: string;
	name: string;
	quantity: number;
	priceMinor: number;
}
export interface SeatType {
	code: string;
	name: string;
	sortOrder: number;
	isActive: boolean;
	defaultSeat?: boolean;
}
export interface ProductFeature {
	key: string;
	label: string;
	type: string;
	sortOrder: number;
}
export interface Product {
	key: string;
	name: string;
	seatModel: SeatModel;
	trialPlanCode: string;
	databasePrefix: string;
	isActive: boolean;
	seatTypes: SeatType[];
	features: ProductFeature[];
	capabilities: string[];
}
