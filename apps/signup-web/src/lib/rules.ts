import type { Business, Interval, LicenceKey, Prices, PublicPlan } from './types';

export const LICENCE_TYPES: { key: LicenceKey; label: string; description: string; price: (p: Prices) => number }[] = [
	{ key: 'both', label: 'Windows + Android', description: 'One person on both apps (counter PC and phone)', price: (p) => p.bothUserPriceMinor },
	{ key: 'windows', label: 'Windows only', description: 'Billing counter and office PCs', price: (p) => p.windowsUserPriceMinor },
	{ key: 'android', label: 'Android only', description: 'Floor staff and supervisors on a phone', price: (p) => p.androidUserPriceMinor },
];

export function pricesFor(plan: PublicPlan, interval: Interval): Prices | null {
	return interval === 'Year' ? plan.yearly : plan.monthly;
}

/** "from ₹… per user" uses the cheapest licence the plan sells. */
export function cheapestLicence(prices: Prices | null): number | null {
	if (!prices) return null;
	const values = [prices.androidUserPriceMinor, prices.windowsUserPriceMinor, prices.bothUserPriceMinor].filter((v) => v > 0);
	return values.length ? Math.min(...values) : null;
}

export const per = (interval: Interval) => (interval === 'Year' ? '/yr' : '/mo');

export const INDIAN_STATES = [
	'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
	'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
	'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
	'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
	'Uttarakhand', 'West Bengal',
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
