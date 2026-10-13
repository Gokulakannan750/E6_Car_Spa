import { describe, expect, it } from 'vitest';
import { cheapestLicence, isBusinessComplete, validateBusiness } from './rules';
import type { Business } from './types';

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
		expect(cheapestLicence({ companyFeeMinor: 0, androidUserPriceMinor: 0, windowsUserPriceMinor: 69_900, bothUserPriceMinor: 99_900 })).toBe(69_900);
		expect(cheapestLicence(null)).toBeNull();
	});
});
