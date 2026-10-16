import type { Business, Interval, Prices, PublicCatalog, PublicPlan } from './types';

export function pricesFor(plan: PublicPlan, interval: Interval): Prices | null {
	return interval === 'Year' ? plan.yearly : plan.monthly;
}

/** "from ₹… per user" uses the cheapest licence the plan sells. */
export function cheapestLicence(prices: Prices | null): number | null {
	if (!prices) return null;
	const values = prices.seats.map((s) => s.priceMinor).filter((v) => v > 0);
	return values.length ? Math.min(...values) : null;
}

export const per = (interval: Interval) => (interval === 'Year' ? '/yr' : '/mo');

/**
 * Whole months saved by paying yearly, from the live prices (Trovo can change them in the admin portal).
 * Takes the smallest saving across every plan and licence, so the badge never promises more than a real price gives.
 */
export function yearlyFreeMonths(catalog: PublicCatalog): number {
	let months = Infinity;
	for (const plan of catalog.plans) {
		if (!plan.monthly || !plan.yearly) continue;
		for (const code of [...plan.monthly.seats.map((s) => s.code), '__company_fee']) {
			const monthly = code === '__company_fee' ? plan.monthly.companyFeeMinor : (plan.monthly.seats.find((s) => s.code === code)?.priceMinor ?? 0);
			const yearly = code === '__company_fee' ? plan.yearly.companyFeeMinor : (plan.yearly.seats.find((s) => s.code === code)?.priceMinor ?? 0);
			if (monthly > 0 && yearly > 0) months = Math.min(months, Math.floor(12 - yearly / monthly + 1e-9));
		}
	}
	return Number.isFinite(months) && months > 0 ? months : 0;
}

export const freeMonthsLabel = (months: number) => (months === 1 ? '1 month free' : `${months} months free`);

export const INDIAN_STATES = [
	'Andaman and Nicobar Islands',
	'Andhra Pradesh',
	'Arunachal Pradesh',
	'Assam',
	'Bihar',
	'Chandigarh',
	'Chhattisgarh',
	'Dadra and Nagar Haveli and Daman and Diu',
	'Delhi',
	'Goa',
	'Gujarat',
	'Haryana',
	'Himachal Pradesh',
	'Jammu and Kashmir',
	'Jharkhand',
	'Karnataka',
	'Kerala',
	'Ladakh',
	'Lakshadweep',
	'Madhya Pradesh',
	'Maharashtra',
	'Manipur',
	'Meghalaya',
	'Mizoram',
	'Nagaland',
	'Odisha',
	'Puducherry',
	'Punjab',
	'Rajasthan',
	'Sikkim',
	'Tamil Nadu',
	'Telangana',
	'Tripura',
	'Uttar Pradesh',
	'Uttarakhand',
	'West Bengal',
];

/** The same checks as the server (SignupService.Clean), so mistakes show at once under the field. */
export function validateBusiness(b: Business): Partial<Record<keyof Business, string>> {
	const errors: Partial<Record<keyof Business, string>> = {};
	const len = (v: string) => v.trim().replace(/\s+/g, ' ').length;
	if (len(b.name) < 2 || len(b.name) > 150) errors.name = 'Enter your business name.';
	if (len(b.ownerName) < 2 || len(b.ownerName) > 150) errors.ownerName = 'Enter your name.';
	let digits = b.mobile.replace(/\D/g, '');
	if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
	if (digits.length !== 10 || digits[0]! < '6') errors.mobile = 'Enter a 10-digit mobile number.';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email.trim()) || b.email.trim().length > 150) errors.email = 'Enter a valid email address.';
	if (len(b.city) < 2 || len(b.city) > 80) errors.city = 'Enter your city.';
	if (!b.state) errors.state = 'Choose your state.';
	const gstin = b.gstin.trim().toUpperCase();
	if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) errors.gstin = 'A GSTIN has 15 characters, like 33ABCDE1234F1Z5.';
	return errors;
}

export const isBusinessComplete = (b: Business) => Object.keys(validateBusiness(b)).length === 0;

export const totalSeats = (seats: Record<string, number>) => Object.values(seats).reduce((a, b) => a + b, 0);
export function defaultChoice(catalog: PublicCatalog) {
	const plan = catalog.plans.find((p) => p.code === catalog.trialPlanCode) ?? catalog.plans[0];
	const type = catalog.seatModel === 'Counted' ? catalog.seatTypes[0] : catalog.seatTypes.find((t) => t.defaultSeat);
	return {
		planCode: plan?.code ?? '',
		interval: (plan?.yearly ? 'Year' : 'Month') as Interval,
		seats: catalog.seatModel === 'None' ? {} : Object.fromEntries(catalog.seatTypes.map((t) => [t.code, t.code === type?.code ? Math.max(1, plan?.minimumLicences ?? 1) : 0])),
		addOns: {},
	};
}
export const seatMinimum = (catalog: PublicCatalog, planCode: string) =>
	catalog.seatModel === 'None' ? 0 : Math.max(1, catalog.plans.find((p) => p.code === planCode)?.minimumLicences ?? 1);
