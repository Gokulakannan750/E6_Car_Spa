import { describe, expect, it } from 'vitest';
import { cheapestLicence, freeMonthsLabel, isBusinessComplete, validateBusiness, yearlyFreeMonths } from './rules';
import type { Business, Prices, PublicCatalog } from './types';

const prices = (android: number, windows: number, both: number): Prices => ({
	companyFeeMinor: 0,
	seats: [
		{ code: 'android', name: 'Android', quantity: 0, priceMinor: android },
		{ code: 'windows', name: 'Windows', quantity: 0, priceMinor: windows },
		{ code: 'both', name: 'Both', quantity: 0, priceMinor: both },
	],
});

const good: Business = { name: 'Sunrise Detailing', ownerName: 'Arun Kumar', mobile: '98765 43210', email: 'arun@sunrise.in', city: 'Erode', state: 'Tamil Nadu', gstin: '' };

describe('validateBusiness', () => {
	it('accepts a complete business, with or without +91', () => {
		expect(validateBusiness(good)).toEqual({});
		expect(isBusinessComplete({ ...good, mobile: '+91 98765 43210' })).toBe(true);
	});

	it('names each missing or wrong field', () => {
		const errors = validateBusiness({ ...good, name: ' ', mobile: '12345', email: 'arun@', state: '', gstin: 'ABC' });
		expect(Object.keys(errors).sort()).toEqual(['email', 'gstin', 'mobile', 'name', 'state']);
	});

	it('refuses mobiles that cannot be Indian mobiles and accepts a valid GSTIN', () => {
		expect(validateBusiness({ ...good, mobile: '5876543210' }).mobile).toBeDefined();
		expect(validateBusiness({ ...good, gstin: '33abcde1234f1z5' })).toEqual({});
	});
});

describe('cheapestLicence', () => {
	it('ignores licence types that are not sold (price 0)', () => {
		expect(cheapestLicence(prices(0, 69_900, 99_900))).toBe(69_900);
		expect(cheapestLicence(null)).toBeNull();
	});
});

describe('yearlyFreeMonths', () => {
	const catalog = (plans: { monthly: Prices | null; yearly: Prices | null }[]) =>
		({ plans: plans.map((p, i) => ({ code: `p${i}`, name: `P${i}`, minimumLicences: 1, modules: [], ...p })) }) as unknown as PublicCatalog;

	it('reads the saving from the live prices', () => {
		expect(yearlyFreeMonths(catalog([{ monthly: prices(100, 200, 300), yearly: prices(1000, 2000, 3000) }]))).toBe(2);
	});

	it('uses the smallest saving across plans and licences', () => {
		const plans = [
			{ monthly: prices(100, 200, 300), yearly: prices(1000, 2000, 3000) },
			{ monthly: prices(100, 200, 300), yearly: prices(1000, 2200, 3000) },
		];
		expect(yearlyFreeMonths(catalog(plans))).toBe(1);
		expect(freeMonthsLabel(1)).toBe('1 month free');
	});

	it('shows no badge when yearly saves less than a month or a price is missing', () => {
		expect(yearlyFreeMonths(catalog([{ monthly: prices(100, 200, 300), yearly: prices(1200, 2400, 3500) }]))).toBe(0);
		expect(yearlyFreeMonths(catalog([{ monthly: prices(100, 200, 300), yearly: null }]))).toBe(0);
	});
});
