import { beforeEach, describe, expect, it } from 'vitest';
import {
	DEFAULT_APP_COLOR,
	DEFAULT_SIDEBAR_COLOR,
	SHADES,
	applyStoredTheme,
	applyTheme,
	buildScale,
	contrastWithWhite,
	isValidColor,
} from './theme';

const root = () => document.documentElement;

describe('theme', () => {
	beforeEach(() => {
		localStorage.clear();
		for (const shade of SHADES) {
			root().style.removeProperty(`--app-${shade}`);
			root().style.removeProperty(`--side-${shade}`);
		}
	});

	it('builds a 50-950 scale whose 600 is the chosen colour, light to dark', () => {
		const scale = buildScale('#0f766e');
		expect(scale[600]).toBe('#0F766E');
		expect(Object.keys(scale)).toHaveLength(11);
		const brightness = (hex: string) =>
			parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
		const ordered = SHADES.map((s) => brightness(scale[s]));
		expect([...ordered].sort((a, b) => b - a)).toEqual(ordered);
	});

	it('validates #RRGGBB colours only', () => {
		expect(isValidColor('#0F766E')).toBe(true);
		expect(isValidColor(' #0f766e ')).toBe(true);
		for (const bad of [undefined, null, '', 'red', '#123', '0F766E', '#GGGGGG']) {
			expect(isValidColor(bad)).toBe(false);
		}
	});

	it('applies the company colours to the document and remembers them', () => {
		applyTheme({ appColor: '#7c3aed', sidebarColor: '#a11a1a' });
		expect(root().style.getPropertyValue('--app-600')).toBe('#7C3AED');
		expect(root().style.getPropertyValue('--side-600')).toBe('#A11A1A');

		root().style.removeProperty('--app-600');
		applyStoredTheme();
		expect(root().style.getPropertyValue('--app-600')).toBe('#7C3AED');
	});

	it('uses the neutral defaults when no colour is chosen or the colour is invalid', () => {
		applyTheme({ appColor: 'nope', sidebarColor: null });
		expect(root().style.getPropertyValue('--app-600')).toBe(DEFAULT_APP_COLOR);
		expect(root().style.getPropertyValue('--side-600')).toBe(DEFAULT_SIDEBAR_COLOR);
		applyStoredTheme();
		expect(root().style.getPropertyValue('--app-600')).toBe(DEFAULT_APP_COLOR);
	});

	it('flags colours that white text cannot be read on', () => {
		expect(contrastWithWhite('#FFF9C4')).toBeLessThan(3);
		expect(contrastWithWhite('#1E293B')).toBeGreaterThan(10);
		expect(contrastWithWhite(DEFAULT_APP_COLOR)).toBeGreaterThan(4.5);
	});
});
