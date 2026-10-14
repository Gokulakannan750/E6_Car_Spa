import { buildScale, SHADES } from '../lib/theme';

/**
 * The product's own branding (Baylior, by Trovo Tech Solutions): shown on the sign-in and registration pages, where
 * the product (not the customer's company) introduces itself. Change it here only. Brand files: design/brand.
 *
 * Name and tagline chosen 14 Oct 2026; colour "Baylior cyan". The left-side picture is still to come.
 */
export const PRODUCT = {
	name: 'Baylior',
	/** The line under the name. */
	tagline: 'One suite. Every detail.',
	/** The software's logo in /public, or null to show the first letter of the name. */
	logo: '/brand/baylior-mark.svg' as string | null,
	/** The picture on the left half of the sign-in page in /public, or null for a plain background. */
	heroImage: null as string | null,
	/** The colour the sign-in and registration pages are built from (a full scale of shades is made from it): Baylior blue. */
	color: '#2D6BFF',
};

/**
 * The product's colour as CSS variables for the `side-*` tokens, so a pre-sign-in page uses Trovo's palette rather
 * than the colours the last company chose for its own sidebar.
 */
export function productPaletteStyle(): React.CSSProperties {
	const scale = buildScale(PRODUCT.color);
	return Object.fromEntries(SHADES.map((shade) => [`--color-side-${shade}`, scale[shade]])) as React.CSSProperties;
}
