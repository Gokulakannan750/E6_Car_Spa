import { describe, it, expect, beforeEach } from 'vitest';
import { formatCurrency, formatDate, formatTime, formatDateTime } from './format';
import {
	SYSTEM_PREFERENCES_STORAGE_KEY,
	DEFAULT_SYSTEM_PREFERENCES,
} from '../features/settings/SystemPreferencesPage';

describe('Format Utilities (format.ts)', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe('formatCurrency', () => {
		it('formats currency with default Indian Rupee and 2 decimals', () => {
			expect(formatCurrency(1250.5)).toBe('₹1,250.50');
			expect(formatCurrency(500)).toBe('₹500.00');
		});

		it('formats currency with custom symbol and 0 decimals', () => {
			localStorage.setItem(
				SYSTEM_PREFERENCES_STORAGE_KEY,
				JSON.stringify({
					...DEFAULT_SYSTEM_PREFERENCES,
					currencySymbol: '$',
					decimalPrecision: 0,
				})
			);
			expect(formatCurrency(1250.5)).toBe('$1,251');
			expect(formatCurrency(500)).toBe('$500');
		});

		it('supports inline preference overrides', () => {
			expect(formatCurrency(1250, { currencySymbol: '€', decimalPrecision: 0 })).toBe('€1,250');
		});
	});

	describe('formatDate', () => {
		it('formats date with default DD/MM/YYYY', () => {
			const d = new Date(2026, 8, 27); // Sept 27, 2026
			expect(formatDate(d)).toBe('27/09/2026');
		});

		it('formats date with MM/DD/YYYY', () => {
			localStorage.setItem(
				SYSTEM_PREFERENCES_STORAGE_KEY,
				JSON.stringify({
					...DEFAULT_SYSTEM_PREFERENCES,
					dateFormat: 'MM/DD/YYYY',
				})
			);
			const d = new Date(2026, 8, 27);
			expect(formatDate(d)).toBe('09/27/2026');
		});

		it('formats date with YYYY-MM-DD', () => {
			localStorage.setItem(
				SYSTEM_PREFERENCES_STORAGE_KEY,
				JSON.stringify({
					...DEFAULT_SYSTEM_PREFERENCES,
					dateFormat: 'YYYY-MM-DD',
				})
			);
			const d = new Date(2026, 8, 27);
			expect(formatDate(d)).toBe('2026-09-27');
		});
	});

	describe('formatTime', () => {
		it('formats time with default 12h format', () => {
			const d = new Date(2026, 8, 27, 14, 30);
			expect(formatTime(d)).toBe('02:30 PM');
		});

		it('formats time with 24h format', () => {
			localStorage.setItem(
				SYSTEM_PREFERENCES_STORAGE_KEY,
				JSON.stringify({
					...DEFAULT_SYSTEM_PREFERENCES,
					timeFormat: '24h',
				})
			);
			const d = new Date(2026, 8, 27, 14, 30);
			expect(formatTime(d)).toBe('14:30');
		});
	});

	describe('formatDateTime', () => {
		it('formats combined date and time', () => {
			const d = new Date(2026, 8, 27, 14, 30);
			expect(formatDateTime(d)).toBe('27/09/2026 02:30 PM');
		});
	});
});
