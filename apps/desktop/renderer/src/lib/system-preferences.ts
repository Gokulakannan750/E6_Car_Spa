export interface SystemPreferences {
	dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
	timeFormat: '12h' | '24h';
	currencySymbol: '₹';
	decimalPrecision: number;
	defaultPrintCopies: number;
	autoPrintReceipt: boolean;
	refreshInterval: number;
}

export const SYSTEM_PREFERENCES_STORAGE_KEY = 'e6_system_preferences';

export const DEFAULT_SYSTEM_PREFERENCES: SystemPreferences = {
	dateFormat: 'DD/MM/YYYY',
	timeFormat: '12h',
	currencySymbol: '₹',
	decimalPrecision: 2,
	defaultPrintCopies: 1,
	autoPrintReceipt: true,
	refreshInterval: 30,
};

export function getStoredPreferences(): SystemPreferences {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_SYSTEM_PREFERENCES };
	try {
		const raw = localStorage.getItem(SYSTEM_PREFERENCES_STORAGE_KEY);
		if (!raw) return { ...DEFAULT_SYSTEM_PREFERENCES };
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_SYSTEM_PREFERENCES };
		return {
			dateFormat: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(parsed.dateFormat)
				? parsed.dateFormat : DEFAULT_SYSTEM_PREFERENCES.dateFormat,
			timeFormat: ['12h', '24h'].includes(parsed.timeFormat) ? parsed.timeFormat : DEFAULT_SYSTEM_PREFERENCES.timeFormat,
			currencySymbol: '₹',
			decimalPrecision: [0, 2].includes(parsed.decimalPrecision)
				? parsed.decimalPrecision : DEFAULT_SYSTEM_PREFERENCES.decimalPrecision,
			defaultPrintCopies: [1, 2, 3].includes(parsed.defaultPrintCopies)
				? parsed.defaultPrintCopies : DEFAULT_SYSTEM_PREFERENCES.defaultPrintCopies,
			autoPrintReceipt: typeof parsed.autoPrintReceipt === 'boolean' ? parsed.autoPrintReceipt : DEFAULT_SYSTEM_PREFERENCES.autoPrintReceipt,
			refreshInterval: [0, 15, 30, 60].includes(parsed.refreshInterval) ? parsed.refreshInterval : DEFAULT_SYSTEM_PREFERENCES.refreshInterval,
		};
	} catch {
		return { ...DEFAULT_SYSTEM_PREFERENCES };
	}
}

export function saveStoredPreferences(prefs: SystemPreferences): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SYSTEM_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Preferences remain usable when storage is unavailable or full.
	}
}
