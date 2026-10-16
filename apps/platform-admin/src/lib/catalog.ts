import type { Product, Seat, SeatQuantities } from './types';

export function featureLabel(key: string, product?: Product): string {
	return product?.features.find((f) => f.key === key)?.label ?? key;
}

export function booleanFeatures(product?: Product): string[] {
	return (product?.features ?? [])
		.filter((f) => f.type === 'Bool')
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((f) => f.key);
}

export function seatTypes(product?: Product) {
	return product?.seatModel === 'None' ? [] : (product?.seatTypes ?? []).filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function seatQuantities(seats: Seat[] | undefined): SeatQuantities {
	return Object.fromEntries((seats ?? []).map((s) => [s.code, s.quantity]));
}

export function totalSeats(seats: SeatQuantities | null | undefined): number {
	return Object.values(seats ?? {}).reduce((sum, n) => sum + n, 0);
}

export function planName(code: string | null | undefined): string {
	if (!code) return '—';

	return code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ');
}

export const SUBSCRIPTION_STATUSES = ['Trialing', 'Active', 'PastDue', 'ReadOnly', 'Suspended', 'Canceled'] as const;
