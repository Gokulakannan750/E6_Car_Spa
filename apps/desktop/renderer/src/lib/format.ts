import { getStoredPreferences, type SystemPreferences } from '../features/settings/SystemPreferencesPage';

export function formatCurrency(value: number, prefs?: Partial<SystemPreferences>): string {
	const currentPrefs = prefs ? { ...getStoredPreferences(), ...prefs } : getStoredPreferences();
	const symbol = '₹';
	const decimals = currentPrefs.decimalPrecision !== undefined ? currentPrefs.decimalPrecision : 2;

	const formattedNumber = value.toLocaleString('en-IN', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});

	return `${symbol}${formattedNumber}`;
}

export function formatDate(date: string | Date, prefs?: Partial<SystemPreferences>): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';

	const currentPrefs = prefs ? { ...getStoredPreferences(), ...prefs } : getStoredPreferences();
	const format = currentPrefs.dateFormat || 'DD/MM/YYYY';

	const day = String(d.getDate()).padStart(2, '0');
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const year = d.getFullYear();

	switch (format) {
		case 'MM/DD/YYYY':
			return `${month}/${day}/${year}`;
		case 'YYYY-MM-DD':
			return `${year}-${month}-${day}`;
		case 'DD/MM/YYYY':
		default:
			return `${day}/${month}/${year}`;
	}
}

export function formatTime(date: string | Date, prefs?: Partial<SystemPreferences>): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';

	const currentPrefs = prefs ? { ...getStoredPreferences(), ...prefs } : getStoredPreferences();
	const format = currentPrefs.timeFormat || '12h';

	if (format === '24h') {
		const hours = String(d.getHours()).padStart(2, '0');
		const minutes = String(d.getMinutes()).padStart(2, '0');
		return `${hours}:${minutes}`;
	}

	let hours = d.getHours();
	const minutes = String(d.getMinutes()).padStart(2, '0');
	const ampm = hours >= 12 ? 'PM' : 'AM';
	hours = hours % 12;
	hours = hours ? hours : 12;
	const hoursStr = String(hours).padStart(2, '0');
	return `${hoursStr}:${minutes} ${ampm}`;
}

export function formatDateTime(date: string | Date, prefs?: Partial<SystemPreferences>): string {
	return `${formatDate(date, prefs)} ${formatTime(date, prefs)}`;
}

export interface CoverageDurationResult {
	valid: boolean;
	durationHours: number | null;
	formatted: string;
	error: string | null;
}

export function calculateCoverageDuration(startTime?: string | null, endTime?: string | null): CoverageDurationResult {
	if (!startTime || !endTime) {
		return { valid: false, durationHours: null, formatted: '', error: 'Start and end times are required.' };
	}

	const startMatch = startTime.trim().match(/^(\d{1,2}):(\d{2})$/);
	const endMatch = endTime.trim().match(/^(\d{1,2}):(\d{2})$/);

	if (!startMatch || !endMatch) {
		return { valid: false, durationHours: null, formatted: '', error: 'Invalid time format. Use HH:mm.' };
	}

	const startH = parseInt(startMatch[1], 10);
	const startM = parseInt(startMatch[2], 10);
	const endH = parseInt(endMatch[1], 10);
	const endM = parseInt(endMatch[2], 10);

	if (startH < 0 || startH > 23 || startM < 0 || startM > 59 || endH < 0 || endH > 23 || endM < 0 || endM > 59) {
		return { valid: false, durationHours: null, formatted: '', error: 'Time values must be between 00:00 and 23:59.' };
	}

	const startTotal = startH * 60 + startM;
	const endTotal = endH * 60 + endM;

	if (endTotal <= startTotal) {
		return { valid: false, durationHours: null, formatted: '', error: 'End time must be after start time.' };
	}

	const diffMinutes = endTotal - startTotal;
	const durationHours = Math.round((diffMinutes / 60) * 100) / 100;

	let formatted: string;
	if (Math.abs(durationHours - 1.0) < 0.01) {
		formatted = '1 hour';
	} else if (durationHours % 1 === 0) {
		formatted = `${durationHours} hours`;
	} else {
		formatted = `${durationHours} hours`;
	}

	return {
		valid: true,
		durationHours,
		formatted,
		error: null,
	};
}
