import { describe, it, expect, beforeEach } from 'vitest';
import { getSystemRefreshIntervalMs, queryClient } from './query-client';
import { saveStoredPreferences, DEFAULT_SYSTEM_PREFERENCES } from '../features/settings/SystemPreferencesPage';

describe('queryClient and getSystemRefreshIntervalMs', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns 30000ms by default (30 seconds)', () => {
		expect(getSystemRefreshIntervalMs()).toBe(30000);
	});

	it('returns 15000ms when refreshInterval is configured to 15s', () => {
		saveStoredPreferences({
			...DEFAULT_SYSTEM_PREFERENCES,
			refreshInterval: 15,
		});
		expect(getSystemRefreshIntervalMs()).toBe(15000);
	});

	it('returns 60000ms when refreshInterval is configured to 60s', () => {
		saveStoredPreferences({
			...DEFAULT_SYSTEM_PREFERENCES,
			refreshInterval: 60,
		});
		expect(getSystemRefreshIntervalMs()).toBe(60000);
	});

	it('returns false when refreshInterval is set to 0 (Manual / Off)', () => {
		saveStoredPreferences({
			...DEFAULT_SYSTEM_PREFERENCES,
			refreshInterval: 0,
		});
		expect(getSystemRefreshIntervalMs()).toBe(false);
	});

	it('queryClient defaultOptions.queries uses dynamic refetchInterval function', () => {
		const defaultOptions = queryClient.getDefaultOptions();
		const refetchInterval = defaultOptions.queries?.refetchInterval;
		expect(typeof refetchInterval).toBe('function');

		saveStoredPreferences({
			...DEFAULT_SYSTEM_PREFERENCES,
			refreshInterval: 15,
		});
		if (typeof refetchInterval === 'function') {
			expect((refetchInterval as any)()).toBe(15000);
		}
	});
});
