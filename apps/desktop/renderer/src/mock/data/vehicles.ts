// Cleaned: Real vehicle records are loaded exclusively from PostgreSQL via API.
export interface MockVehicle {
	id: string;
	customerId: string;
	registrationNumber: string;
	make: string;
	model: string;
	year: number;
	color: string;
	fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid';
	lastServiceDate: string;
}

export const mockVehicles: MockVehicle[] = [];
