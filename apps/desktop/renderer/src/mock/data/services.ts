// Real service catalogue is loaded exclusively from PostgreSQL via backend API.
// No production services are hardcoded in client data.
export { CATALOGUE_CATEGORIES, type CatalogueCategory } from '../../constants/catalogue';

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
