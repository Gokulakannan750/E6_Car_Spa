	/**
 * Established application-level catalogue categories for E6 Car Spa.
 *
 * The five category constants define the application's catalogue structure.
 * All actual catalogue services, names, prices, descriptions, durations,
 * and service IDs are loaded exclusively and dynamically from the backend API.
 */
export const CATALOGUE_CATEGORIES = [
	'Exterior Detailing',
	'General Services',
	'Interior Care',
	'Others',
	'Protection Packages',
] as const;

export type CatalogueCategory = (typeof CATALOGUE_CATEGORIES)[number];
