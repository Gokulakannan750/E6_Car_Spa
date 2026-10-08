import type { CSSProperties } from 'react';
import { getCachedBusinessProfile } from './api';

/**
 * Document branding helpers.
 *
 * Documents (invoice, public invoice, job card, reports) show only what the company has entered in Company Settings.
 * A detail that is missing is left off; nothing is filled in on the company's behalf. These helpers mirror the
 * rules the server applies when it builds the invoice PDF, so a printed invoice and a PDF look the same.
 */

/** Neutral dark slate, used until a company picks its own accent colour. Must match the server's default. */
export const DEFAULT_DOCUMENT_ACCENT = '#1E293B';

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

/** The company's accent colour as upper-case #RRGGBB, or the neutral default when none (or an invalid one) is set. */
export function resolveAccentColour(brandColour?: string | null): string {
	const trimmed = brandColour?.trim();
	return trimmed && HEX_COLOUR.test(trimmed) ? trimmed.toUpperCase() : DEFAULT_DOCUMENT_ACCENT;
}

/** Sets the CSS variable the document classes (text-[color:var(--doc-accent)] and friends) read the accent from. */
export function accentStyle(brandColour?: string | null): CSSProperties {
	return { '--doc-accent': resolveAccentColour(brandColour) } as CSSProperties;
}

/** "Pune, Maharashtra - 411001"; any missing part is skipped, and null when there is nothing to show. */
export function formatCityStatePin(city?: string | null, state?: string | null, postalCode?: string | null): string | null {
	const place = [city, state].map((part) => part?.trim()).filter(Boolean).join(', ');
	const pin = postalCode?.trim();
	const result = pin ? (place ? `${place} - ${pin}` : pin) : place;
	return result || null;
}

/** The company's terms as separate non-empty lines, ready to print. */
export function termsLines(terms?: string | null): string[] {
	if (!terms) return [];
	return terms
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/** A tagline only when the company set one. */
export function cleanTagline(tagline?: string | null): string | null {
	const trimmed = tagline?.trim();
	return trimmed ? trimmed : null;
}

/** One letter for small badges, taken from the company name; a neutral dot when there is no name yet. */
export function businessInitial(name?: string | null): string {
	const match = (name ?? '').match(/[A-Za-z0-9]/);
	return match ? match[0].toUpperCase() : '•';
}

/** File-name-safe version of the company name for exported files, e.g. "Sunrise Detailing" -> "Sunrise_Detailing". */
export function fileNamePart(name?: string | null, fallback = 'Report'): string {
	const cleaned = (name ?? '')
		.trim()
		.replace(/[^A-Za-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return cleaned || fallback;
}

// ── Exported spreadsheets ────────────────────────────────────────────────────────────────────────────────────
// Reports are named after the company that exports them, read from the cached Company Settings. With no company
// name saved yet they carry no company prefix at all.

/** The saved company name for report titles, or an empty string. */
export function reportCompanyName(): string {
	return getCachedBusinessProfile()?.businessName?.trim() ?? '';
}

/** "SUNRISE DETAILING — MONTHLY BILLING REPORT", or just the title when no company name is saved. */
export function reportTitle(title: string): string {
	const name = reportCompanyName();
	return name ? `${name.toUpperCase()} — ${title}` : title;
}

/** "Sunrise_Detailing_" to put in front of an exported file name, or an empty string. */
export function reportFilePrefix(): string {
	const name = reportCompanyName();
	return name ? `${fileNamePart(name)}_` : '';
}

/** Value for a workbook's "creator" / "last modified by" property. */
export function reportCreator(): string {
	return reportCompanyName() || 'Management Suite';
}
