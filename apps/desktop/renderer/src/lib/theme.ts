/**
 * Company colour theme.
 *
 * Each company picks up to three colours in System Preferences:
 *   - app accent       buttons, links and highlights across the app (Tailwind's `blue-*` and `secondary` tokens)
 *   - sidebar & login  the sidebar menu and the login / first-time-setup pages (the `side-*` tokens)
 *   - documents        invoice and job card PDFs (handled separately, see documentBranding.ts)
 *
 * A single colour is expanded into a full 50–950 scale of shades and written to CSS variables on <html>;
 * globals.css points the Tailwind colour tokens at those variables, so every existing class follows the theme.
 * The last applied theme is remembered locally so the login page and the first paint already use it.
 */

/** Tailwind's blue-600; used until a company picks its own app colour. */
export const DEFAULT_APP_COLOR = '#2563EB';
/** Deep slate; used until a company picks its own sidebar and login colour. */
export const DEFAULT_SIDEBAR_COLOR = '#1E293B';

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Shade = (typeof SHADES)[number];

const HEX = /^#[0-9a-fA-F]{6}$/;

export interface ThemeColors {
	appColor?: string | null;
	sidebarColor?: string | null;
}

/** Ready-made colours offered next to the free colour picker, grouped by family. */
export const COLOR_PRESETS: { name: string; hex: string }[] = [
	// Blues
	{ name: 'Sky', hex: '#0284C7' },
	{ name: 'Royal Blue', hex: '#2563EB' },
	{ name: 'Indigo', hex: '#4F46E5' },
	{ name: 'Navy', hex: '#1E3A8A' },
	// Greens and teals
	{ name: 'Cyan', hex: '#0E7490' },
	{ name: 'Teal', hex: '#0F766E' },
	{ name: 'Emerald', hex: '#059669' },
	{ name: 'Forest', hex: '#15803D' },
	{ name: 'Olive', hex: '#4D7C0F' },
	// Warm
	{ name: 'Gold', hex: '#A16207' },
	{ name: 'Amber', hex: '#B45309' },
	{ name: 'Orange', hex: '#C2410C' },
	{ name: 'Red', hex: '#DC2626' },
	{ name: 'Crimson', hex: '#A11A1A' },
	{ name: 'Maroon', hex: '#7F1D1D' },
	{ name: 'Rose', hex: '#BE123C' },
	{ name: 'Pink', hex: '#BE185D' },
	// Purples
	{ name: 'Violet', hex: '#7C3AED' },
	{ name: 'Purple', hex: '#9333EA' },
	{ name: 'Plum', hex: '#86198F' },
	// Neutrals
	{ name: 'Brown', hex: '#78350F' },
	{ name: 'Slate', hex: '#1E293B' },
	{ name: 'Graphite', hex: '#374151' },
	{ name: 'Black', hex: '#111111' },
];

/** Ready-made looks that set the app, sidebar/login and document colours together. */
export const COLOR_THEMES: { name: string; app: string; sidebar: string; document: string }[] = [
	{ name: 'Midnight', app: '#2563EB', sidebar: '#1E293B', document: '#1E293B' },
	{ name: 'Ocean', app: '#0284C7', sidebar: '#0C4A6E', document: '#0369A1' },
	{ name: 'Teal', app: '#0F766E', sidebar: '#134E4A', document: '#0F766E' },
	{ name: 'Forest', app: '#15803D', sidebar: '#14532D', document: '#166534' },
	{ name: 'Royal', app: '#7C3AED', sidebar: '#4C1D95', document: '#6D28D9' },
	{ name: 'Berry', app: '#BE185D', sidebar: '#831843', document: '#9D174D' },
	{ name: 'Crimson', app: '#B91C1C', sidebar: '#A11A1A', document: '#A11A1A' },
	{ name: 'Sunset', app: '#C2410C', sidebar: '#7C2D12', document: '#C2410C' },
	{ name: 'Gold', app: '#B45309', sidebar: '#451A03', document: '#92400E' },
	{ name: 'Graphite', app: '#374151', sidebar: '#111111', document: '#111111' },
];

export function isValidColor(value?: string | null): value is string {
	return typeof value === 'string' && HEX.test(value.trim());
}

function toRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
	return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function mix(rgb: [number, number, number], target: number, amount: number): [number, number, number] {
	return rgb.map((v) => v + (target - v) * amount) as [number, number, number];
}

/** How far each shade is pulled toward white (positive) or black (negative) from the chosen colour, which is the 600. */
const SHADE_MIX: Record<Shade, number> = {
	50: 0.94,
	100: 0.86,
	200: 0.7,
	300: 0.5,
	400: 0.28,
	500: 0.12,
	600: 0,
	700: -0.18,
	800: -0.34,
	900: -0.5,
	950: -0.66,
};

/** The full scale for one colour; shade 600 is the colour itself. */
export function buildScale(hex: string): Record<Shade, string> {
	const rgb = toRgb(hex.trim());
	const scale = {} as Record<Shade, string>;
	for (const shade of SHADES) {
		const amount = SHADE_MIX[shade];
		scale[shade] = toHex(amount >= 0 ? mix(rgb, 255, amount) : mix(rgb, 0, -amount));
	}
	return scale;
}

function luminance(hex: string): number {
	const [r, g, b] = toRgb(hex).map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of white text on this colour (WCAG). 4.5+ is comfortable for buttons; below 3 is hard to read. */
export function contrastWithWhite(hex: string): number {
	return 1.05 / (luminance(hex.trim()) + 0.05);
}

const STORAGE_KEY = 'car_spa_theme';

function writeVars(prefix: string, color: string, root: HTMLElement) {
	const scale = buildScale(color);
	for (const shade of SHADES) {
		root.style.setProperty(`--${prefix}-${shade}`, scale[shade]);
	}
}

/** Applies the company's colours to the whole document. A missing or invalid colour uses the neutral default. */
export function applyTheme(colors: ThemeColors | null | undefined): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	const app = isValidColor(colors?.appColor) ? colors!.appColor!.trim().toUpperCase() : null;
	const side = isValidColor(colors?.sidebarColor) ? colors!.sidebarColor!.trim().toUpperCase() : null;

	writeVars('app', app ?? DEFAULT_APP_COLOR, root);
	writeVars('side', side ?? DEFAULT_SIDEBAR_COLOR, root);

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ appColor: app, sidebarColor: side }));
	} catch {
		// Storage can be unavailable; the theme still applies for this session.
	}
}

/** Re-applies the last theme the app used (or the neutral defaults), before anything is drawn. */
export function applyStoredTheme(): void {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		applyTheme(raw ? (JSON.parse(raw) as ThemeColors) : null);
	} catch {
		applyTheme(null);
	}
}
