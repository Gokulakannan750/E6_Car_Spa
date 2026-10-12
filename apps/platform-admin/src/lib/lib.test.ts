import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import { date, money, moneyShort, parseRupees } from './format';
import { IDLE_LIMIT_MS, clearSession, isExpired, loadSession, saveSession, touchSession } from './session';

describe('money', () => {
	it('shows paise as rupees with Indian grouping', () => {
		expect(money(1_234_567_89)).toBe('₹12,34,567.89');
		expect(moneyShort(199_900)).toBe('₹1,999');
		expect(moneyShort(199_950)).toBe('₹1,999.50');
		expect(money(null)).toBe('—');
	});

	it('reads typed rupee amounts into paise', () => {
		expect(parseRupees('1999')).toBe(199_900);
		expect(parseRupees('₹1,999.5')).toBe(199_950);
		expect(parseRupees('0.05')).toBe(5);
		expect(parseRupees('12.345')).toBeNull();
		expect(parseRupees('-5')).toBeNull();
		expect(parseRupees('abc')).toBeNull();
	});

	it('shows dates in India time', () => {
		// 20:00 UTC on 11 Oct is already 12 Oct in India.
		expect(date('2026-10-11T20:00:00Z')).toBe('12 Oct 2026');
	});
});

describe('csv', () => {
	it('quotes commas and quotes, and stops spreadsheet formulas', () => {
		const text = toCsv(['Name', 'Note'], [['Sunrise, Erode', 'He said "hi"'], ['=HYPERLINK("x")', '+91 90000']]);
		expect(text.split('\r\n')).toEqual(['Name,Note', '"Sunrise, Erode","He said ""hi"""', `"'=HYPERLINK(""x"")",'+91 90000`]);
	});
});

describe('session', () => {
	const response = (minutes: number) => ({
		token: 't',
		expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
		admin: { id: '1', email: 'a@trovo.test', name: 'A', role: 'Owner' as const, mustChangePassword: false },
	});

	it('survives a reload of the tab but not expiry', () => {
		saveSession(response(120));
		expect(loadSession()?.token).toBe('t');
		const later = Date.now() + 121 * 60_000;
		expect(loadSession(later)).toBeNull();
		expect(window.sessionStorage.length).toBe(0);
	});

	it('ends after 30 minutes without activity, and activity keeps it alive', () => {
		const start = Date.now();
		const session = saveSession(response(120), start);
		expect(isExpired(session, start + IDLE_LIMIT_MS - 1)).toBe(false);
		expect(isExpired(session, start + IDLE_LIMIT_MS)).toBe(true);

		touchSession(start + 20 * 60_000);
		expect(loadSession(start + 45 * 60_000)).not.toBeNull();
		clearSession();
	});
});
