import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DOCUMENT_ACCENT,
	accentStyle,
	businessInitial,
	cleanTagline,
	fileNamePart,
	formatCityStatePin,
	resolveAccentColour,
	termsLines,
} from './documentBranding';

describe('documentBranding', () => {
	it('uses the company colour when it is a valid #RRGGBB, upper-cased', () => {
		expect(resolveAccentColour('#0f766e')).toBe('#0F766E');
		expect(accentStyle('#0f766e')).toEqual({ '--doc-accent': '#0F766E' });
	});

	it('falls back to the neutral accent when the colour is missing or invalid', () => {
		for (const bad of [undefined, null, '', '   ', 'red', '#123', '#GGGGGG', '0F766E']) {
			expect(resolveAccentColour(bad)).toBe(DEFAULT_DOCUMENT_ACCENT);
		}
	});

	it('formats city, state and PIN, skipping what is missing', () => {
		expect(formatCityStatePin('Pune', 'Maharashtra', '411001')).toBe('Pune, Maharashtra - 411001');
		expect(formatCityStatePin('Pune', null, null)).toBe('Pune');
		expect(formatCityStatePin(null, null, '411001')).toBe('411001');
		expect(formatCityStatePin('', '  ', '')).toBeNull();
	});

	it('splits terms into trimmed non-empty lines', () => {
		expect(termsLines('1. Pay in 7 days.\r\n\r\n 2. No refunds. \n')).toEqual(['1. Pay in 7 days.', '2. No refunds.']);
		expect(termsLines(null)).toEqual([]);
		expect(termsLines('   ')).toEqual([]);
	});

	it('only returns a tagline the company actually set', () => {
		expect(cleanTagline('  Shine every day ')).toBe('Shine every day');
		expect(cleanTagline('   ')).toBeNull();
		expect(cleanTagline(undefined)).toBeNull();
	});

	it('builds a badge letter and file-safe name from the company name', () => {
		expect(businessInitial('sunrise')).toBe('S');
		expect(businessInitial('')).toBe('•');
		expect(fileNamePart('Sunrise Detailing')).toBe('Sunrise_Detailing');
		expect(fileNamePart('  ')).toBe('Report');
	});
});
