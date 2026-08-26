// Cleaned: Real service catalogue is loaded exclusively from PostgreSQL via API.
export interface MockService {
	id: string;
	name: string;
	category: string;
	description: string;
	basePrice: number;
	durationMinutes: number;
	status: 'active' | 'inactive';
}

export const mockServices: MockService[] = [];
export const serviceCategories: string[] = [];
export const CATALOGUE_CATEGORIES = [
	'Exterior Detailing',
	'Interior Care',
	'Protection Packages',
	'Others',
] as const;
