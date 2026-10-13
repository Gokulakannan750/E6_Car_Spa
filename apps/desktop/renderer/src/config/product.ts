import { buildScale, SHADES } from '../lib/theme';

/**
 * Trovo's own branding for this software: shown on the sign-in and registration pages, where the product (not the
 * customer's company) introduces itself. Change it here only.
 *
 * Placeholders until the owner decides (13 Oct 2026): the name, the logo, the left-side picture and the colour.
 */
export const PRODUCT = {
	/** The software's name. Placeholder. */
	name: 'Trovo Car Spa',
	/** The line under the name. */
	tagline: 'Car spa & detailing management',
	/** The software's logo in /public (e.g. '/product/logo.svg'), or null to show the first letter of the name. */
	logo: null as string | null,
	/** The picture on the left half of the sign-in page in /public, or null for a plain background. */
	heroImage: null as string | null,
	/** The colour the sign-in and registration pages are built from (a full scale of shades is made from it). */
	color: '#1E293B',
};

/**
 * The product's colour as CSS variables for the `side-*` tokens, so a pre-sign-in page uses Trovo's palette rather
 * than the colours the last company chose for its own sidebar.
 */
export function productPaletteStyle(): React.CSSProperties {
	const scale = buildScale(PRODUCT.color);
	return Object.fromEntries(SHADES.map((shade) => [`--color-side-${shade}`, scale[shade]])) as React.CSSProperties;
}
