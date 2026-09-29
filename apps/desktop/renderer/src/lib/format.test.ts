import { describe, it, expect, beforeEach } from 'vitest';
import { formatCurrency, formatDate, formatTime, calculateCoverageDuration } from './format';
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

		it('formats currency with 0 decimals precision', () => {
			localStorage.setItem(
				SYSTEM_PREFERENCES_STORAGE_KEY,
				JSON.stringify({
					...DEFAULT_SYSTEM_PREFERENCES,
					decimalPrecision: 0,
				})
			);
			expect(formatCurrency(1250.5)).toBe('₹1,251');
			expect(formatCurrency(500)).toBe('₹500');
		});

		it('supports inline preference overrides for decimals', () => {
			expect(formatCurrency(1250, { decimalPrecision: 0 })).toBe('₹1,250');
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

	describe('calculateCoverageDuration', () => {
		it('calculates integer duration correctly (e.g. 14:00 to 18:00 -> 4 hours)', () => {
			const res = calculateCoverageDuration('14:00', '18:00');
			expect(res.valid).toBe(true);
			expect(res.durationHours).toBe(4);
			expect(res.formatted).toBe('4 hours');
			expect(res.error).toBeNull();
		});

		it('calculates 1 hour duration with singular phrasing', () => {
			const res = calculateCoverageDuration('14:00', '15:00');
			expect(res.valid).toBe(true);
			expect(res.durationHours).toBe(1);
			expect(res.formatted).toBe('1 hour');
		});

		it('calculates fractional duration correctly (e.g. 10:00 to 15:30 -> 5.5 hours)', () => {
			const res = calculateCoverageDuration('10:00', '15:30');
			expect(res.valid).toBe(true);
			expect(res.durationHours).toBe(5.5);
			expect(res.formatted).toBe('5.5 hours');
		});

		it('rejects end time earlier than start time (e.g. 18:00 to 14:00)', () => {
			const res = calculateCoverageDuration('18:00', '14:00');
			expect(res.valid).toBe(false);
			expect(res.durationHours).toBeNull();
			expect(res.error).toContain('End time must be after start time');
		});

		it('rejects identical start and end time (e.g. 14:00 to 14:00)', () => {
			const res = calculateCoverageDuration('14:00', '14:00');
			expect(res.valid).toBe(false);
			expect(res.error).toContain('End time must be after start time');
		});

		it('rejects empty or null inputs', () => {
			const res = calculateCoverageDuration('', '18:00');
			expect(res.valid).toBe(false);
			expect(res.error).toContain('Start and end times are required');
		});
	});
});
