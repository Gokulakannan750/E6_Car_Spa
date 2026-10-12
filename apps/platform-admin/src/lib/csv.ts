// CSV export for list screens. Values that start with = + - @ are prefixed so spreadsheets do not run them as formulas.

export type CsvValue = string | number | boolean | null | undefined;

function cell(value: CsvValue): string {
	if (value === null || value === undefined) return '';
	let text = String(value);
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
	return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

export function downloadCsv(fileName: string, headers: string[], rows: CsvValue[][]): void {
	// The BOM makes Excel read ₹ and other non-ASCII text correctly.
	const blob = new Blob(['﻿', toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Amounts in a CSV are plain rupees with two decimals (no symbol, no grouping) so spreadsheets can add them up. */
export function csvRupees(minor: number | null | undefined): string {
	if (minor === null || minor === undefined) return '';
	return (minor / 100).toFixed(2);
}

/** Dates in a CSV are ISO (yyyy-mm-dd, India time) so they sort and import cleanly. */
export function csvDate(value: string | null | undefined): string {
	if (!value) return '';
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

export function todayStamp(): string {
	return csvDate(new Date().toISOString());
}
