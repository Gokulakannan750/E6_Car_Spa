import { beforeEach, describe, expect, it } from 'vitest';
import {
	DEFAULT_SYSTEM_PREFERENCES,
	SYSTEM_PREFERENCES_STORAGE_KEY,
	getStoredPreferences,
	saveStoredPreferences,
} from './system-preferences';
import { formatCurrency } from './format';
import { getSystemRefreshIntervalMs } from './query-client';

beforeEach(() => localStorage.clear());

describe('shared preferences cache', () => {
	it('preserves supported preferences', () => {
		const prefs = { ...DEFAULT_SYSTEM_PREFERENCES, decimalPrecision: 0, refreshInterval: 0, defaultPrintCopies: 3 };
		saveStoredPreferences(prefs);
		expect(getStoredPreferences()).toEqual(prefs);
	});

	it.each(['null', '[]', '"invalid"', '{invalid'])('falls back for corrupt storage: %s', (raw) => {
		localStorage.setItem(SYSTEM_PREFERENCES_STORAGE_KEY, raw);
		expect(getStoredPreferences()).toEqual(DEFAULT_SYSTEM_PREFERENCES);
	});

	it('invalid values cannot crash money formatting or cause rapid polling', () => {
		localStorage.setItem(SYSTEM_PREFERENCES_STORAGE_KEY, JSON.stringify({
			decimalPrecision: 100, refreshInterval: -1, defaultPrintCopies: 999,
			autoPrintReceipt: 'false', dateFormat: 'unknown', timeFormat: 'unknown', currencySymbol: '$',
		}));
		expect(getStoredPreferences()).toEqual(DEFAULT_SYSTEM_PREFERENCES);
		expect(formatCurrency(1234.5)).toBe('₹1,234.50');
		expect(getSystemRefreshIntervalMs()).toBe(30000);
	});

	it('callers cannot mutate the shared defaults', () => {
		getStoredPreferences().refreshInterval = 0;
		expect(getStoredPreferences().refreshInterval).toBe(30);
	});
});
