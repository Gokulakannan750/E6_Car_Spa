// Display formatting. Money arrives in minor units (paise); dates are shown in India time like "12 Oct 2026".

const TIME_ZONE = 'Asia/Kolkata';

export function money(minor: number | null | undefined, currency = 'INR'): string {
	if (minor === null || minor === undefined) return '—';
	return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);
}

/** Rupees without paise when the amount is whole: plan prices read better as ₹1,499. */
export function moneyShort(minor: number | null | undefined, currency = 'INR'): string {
	if (minor === null || minor === undefined) return '—';
	const whole = minor % 100 === 0;
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency,
		minimumFractionDigits: whole ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(minor / 100);
}

/** Parses a rupee amount typed by a person ("1,499.50") into paise; null when it is not a valid amount. */
export function parseRupees(text: string): number | null {
	const cleaned = text.replace(/[₹,\s]/g, '');
	if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
	const [whole, fraction = ''] = cleaned.split('.');
	return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function date(value: string | null | undefined): string {
	if (!value) return '—';
	return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE }).format(
		new Date(value),
	);
}

export function dateTime(value: string | null | undefined): string {
	if (!value) return '—';
	const d = new Date(value);
	const day = date(value);
	const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE }).format(d);
	return `${day}, ${time}`;
}

/** Whole days from now until the given time (negative when it is in the past). */
export function daysUntil(value: string | null | undefined, now = Date.now()): number | null {
	if (!value) return null;
	return Math.ceil((new Date(value).getTime() - now) / 86_400_000);
}

export function intervalLabel(interval: string | null | undefined): string {
	if (!interval) return '—';
	const lower = interval.toLowerCase();
	if (lower === 'month' || lower === 'monthly') return 'Monthly';
	if (lower === 'year' || lower === 'yearly') return 'Yearly';
	return interval;
}

export function perInterval(interval: string | null | undefined): string {
	const label = intervalLabel(interval);
	return label === 'Monthly' ? '/mo' : label === 'Yearly' ? '/yr' : '';
}
