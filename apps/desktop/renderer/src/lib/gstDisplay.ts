import type { TaxBreakdownDto } from './api';

/**
 * Presentation of server-calculated GST. Nothing here calculates tax: every amount comes from the
 * backend (invoice tax breakdown or job-card estimate). Labels follow the server PDF so every
 * representation of an invoice reads the same.
 */

/** 18 → "18%", 2.5 → "2.5%". */
export function formatRate(ratePercent: number): string {
	return `${Number(ratePercent.toFixed(2))}%`;
}

export interface TaxRow {
	key: string;
	label: string;
	/** Taxable value the row applies to; shown when an invoice has more than one rate. */
	taxableAmount: number | null;
	amount: number;
}

/**
 * Summary rows for a tax breakdown: "CGST @ 9%" / "SGST @ 9%" per rate actually charged, "GST @ 0%" for 0% lines,
 * and plain "CGST" / "SGST" when a legacy line's rate is unknown.
 */
export function taxRows(breakdown: TaxBreakdownDto[] | null | undefined): TaxRow[] {
	const groups = breakdown ?? [];
	const showBase = groups.length > 1;
	const rows: TaxRow[] = [];
	for (const g of groups) {
		const base = showBase ? g.taxableAmount : null;
		const id = g.ratePercent ?? 'unknown';
		if (g.ratePercent === null) {
			rows.push({ key: `cgst-${id}`, label: 'CGST', taxableAmount: base, amount: g.cgstAmount });
			rows.push({ key: `sgst-${id}`, label: 'SGST', taxableAmount: base, amount: g.sgstAmount });
		} else if (g.ratePercent === 0) {
			rows.push({ key: 'gst-0', label: 'GST @ 0%', taxableAmount: base, amount: 0 });
		} else {
			const half = formatRate(g.ratePercent / 2);
			rows.push({ key: `cgst-${id}`, label: `CGST @ ${half}`, taxableAmount: base, amount: g.cgstAmount });
			rows.push({ key: `sgst-${id}`, label: `SGST @ ${half}`, taxableAmount: base, amount: g.sgstAmount });
		}
	}
	return rows;
}

/** Short description of the rates on an invoice, e.g. "GST 18%" or "GST 18% + 5% + 0%". */
export function ratesSummary(breakdown: TaxBreakdownDto[] | null | undefined): string {
	const rates = (breakdown ?? []).filter((g) => g.ratePercent !== null).map((g) => formatRate(g.ratePercent as number));
	return rates.length === 0 ? 'GST' : `GST ${rates.join(' + ')}`;
}

/** Amount column of an invoice line: qty × rate − line discount (before invoice discount and tax). Sums to Subtotal. */
export function lineAmount(item: { unitPrice: number; quantity: number; discount?: number | null }): number {
	return Math.round(item.unitPrice * item.quantity * 100) / 100 - (item.discount ?? 0);
}
