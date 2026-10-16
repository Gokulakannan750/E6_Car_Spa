// Shapes of the public sign-up API (docs/SIGNUP_API.md). Money is in paise.

export type Interval = 'Month' | 'Year';
export interface SeatType {
	code: string;
	name: string;
	sortOrder: number;
	defaultSeat: boolean;
}
export interface Seat {
	code: string;
	name: string;
	quantity: number;
	priceMinor: number;
}
export interface StartingPrice {
	amountMinor: number;
	interval: 'Month' | 'Year' | string;
	currency: string;
	perSeat: boolean;
}

export interface PublicProduct {
	key: string;
	name: string;
	seatModel: 'None' | 'Counted' | 'PerType';
	capabilities: string[];
	publicTagline?: string | null;
	publicDescription?: string | null;
	learnMoreUrl?: string | null;
	startingPrice?: StartingPrice | null;
	hasTrial?: boolean;
}
export interface Prices {
	companyFeeMinor: number;
	seats: Seat[];
}

export interface PublicPlan {
	code: string;
	name: string;
	minimumLicences: number;
	modules: string[];
	monthly: Prices | null;
	yearly: Prices | null;
}

export interface PublicAddOn {
	code: string;
	name: string;
	featureKey: string;
	isPack: boolean;
	perUnit: number;
	monthlyPriceMinor: number | null;
	yearlyPriceMinor: number | null;
}

export interface PublicCatalog {
	productKey: string;
	seatModel: PublicProduct['seatModel'];
	seatTypes: SeatType[];
	features: { key: string; label: string; type: string }[];
	capabilities: string[];
	trialPlanCode: string;
	productName: string;
	plans: PublicPlan[];
	addOns: PublicAddOn[];
	trialDays: number;
	trialLicences: number;
	graceDays: number;
	chargesGst: boolean;
	gstRatePercent: number | null;
	testPayments: boolean;
	sellerName: string;
	sellerPhone: string;
	sellerEmail: string;
}

export interface PlanChoice {
	planCode: string;
	interval: Interval;
	seats: Record<string, number>;
	addOns: Record<string, number>;
}

export interface QuoteLine {
	description: string;
	quantity: number;
	unitPriceMinor: number;
	amountMinor: number;
}

export interface Quote {
	planCode: string;
	planName: string;
	interval: Interval;
	lines: QuoteLine[];
	subtotalMinor: number;
	taxMinor: number;
	taxRatePercent: number | null;
	totalMinor: number;
	currency: string;
	cheaper: { planCode: string; planName: string; totalMinor: number } | null;
}

export interface Business {
	name: string;
	ownerName: string;
	mobile: string;
	email: string;
	city: string;
	state: string;
	gstin: string;
}

export type OrderStatus = 'AwaitingPayment' | 'Completed' | 'Expired' | 'NeedsAttention' | 'Processing';

export interface SignupResult {
	orderId: string;
	orderToken: string | null;
	status: OrderStatus;
	start: 'Trial' | 'Paid';
	quote: Quote | null;
	amountMinor: number;
	currency: string;
	expiresAt: string;
	testPayments: boolean;
	companyCode: string | null;
	registrationCode: string | null;
	registrationCodeExpiresAt: string | null;
	trialEndsAt: string | null;
	paidUntil: string | null;
	invoiceNumber: string | null;
	franchisorName?: string | null;
	franchiseLinked?: boolean;
	franchiseProblem?: string | null;
}

/** How the business joins: its own car spa, a franchise outlet (with the franchisor's code) or a branch (in the app). */
export type JoiningKind = 'own' | 'franchise' | 'branch';

export interface FranchiseCodeCheck {
	franchisorName: string;
	scopes: { scope: string; label: string }[];
	expiresAt: string;
}

export interface Joining {
	kind: JoiningKind;
	code: string;
	/** The checked code's franchisor and requested items, or null until checked. */
	check: FranchiseCodeCheck | null;
	consent: boolean;
}
