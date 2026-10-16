import type { PublicCatalog } from './types';
const site = 'https://trovotechsolutions.in';
export interface ProductBrand {
	name: string;
	headline: string;
	intro: string;
	ownBusiness: string;
	logo: string | null;
	product: string;
	terms: string;
	refund: string;
	privacy: string;
	contact: string;
	downloadHelp: string;
	downloads: { name: string; url: string }[];
}
const generic = {
	product: site,
	downloads: [] as ProductBrand['downloads'],
	downloadHelp: 'Open the product page for access and setup instructions.',
	terms: `${site}/terms/`,
	refund: `${site}/refund-policy/`,
	privacy: `${site}/privacy-policy/`,
	contact: `${site}/contact.html`,
};
const baylior = {
	name: 'Baylior',
	headline: 'Run your car spa on Baylior',
	intro: 'Billing, job cards, invoices, staff and WhatsApp in one place — on Windows and Android.',
	ownBusiness: 'My own car spa',
	logo: '/brand/baylior-lockup-on-dark.svg',
	product: `${site}/products/baylior/`,
	downloadHelp: 'Call +91 90426 72148 and Trovo sends you the installers.',
};
// Deployment-specific runtime keys can alias Baylior without putting product assumptions into controls.
const definitions: Record<string, Partial<ProductBrand>> = { carspa: baylior, baylior, [import.meta.env.VITE_BAYLIOR_PRODUCT_KEY || 'carspa']: baylior };
export function branding(catalog?: PublicCatalog): ProductBrand {
	const overrides = JSON.parse(import.meta.env.VITE_PRODUCT_CONFIG || '{}') as Record<string, Partial<ProductBrand>>;
	const key = catalog?.productKey ?? '';
	const configured = { ...definitions[key], ...overrides[key] };
	const name = configured.name || catalog?.productName || 'Trovo';
	return {
		name,
		headline: `Run your business with ${name}`,
		intro: 'Choose the plan that fits your business.',
		ownBusiness: 'My own business',
		logo: null as string | null,
		...generic,
		...configured,
		product: import.meta.env.VITE_PRODUCT_URL || configured.product || generic.product,
		downloads:
			configured.downloads ??
			(definitions[key]
				? [
						...(import.meta.env.VITE_WINDOWS_DOWNLOAD_URL ? [{ name: 'Download for Windows', url: import.meta.env.VITE_WINDOWS_DOWNLOAD_URL }] : []),
						...(import.meta.env.VITE_ANDROID_DOWNLOAD_URL ? [{ name: 'Get it on Android', url: import.meta.env.VITE_ANDROID_DOWNLOAD_URL }] : []),
					]
				: []),
		terms: import.meta.env.VITE_TERMS_URL || configured.terms || generic.terms,
		refund: import.meta.env.VITE_REFUND_URL || configured.refund || generic.refund,
		privacy: import.meta.env.VITE_PRIVACY_URL || configured.privacy || generic.privacy,
	};
}
