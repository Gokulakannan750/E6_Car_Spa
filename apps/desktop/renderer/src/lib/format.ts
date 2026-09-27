import { getStoredPreferences, type SystemPreferences } from '../features/settings/SystemPreferencesPage';

export function formatCurrency(value: number, prefs?: Partial<SystemPreferences>): string {
	const currentPrefs = prefs ? { ...getStoredPreferences(), ...prefs } : getStoredPreferences();
	const symbol = currentPrefs.currencySymbol || '₹';
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
