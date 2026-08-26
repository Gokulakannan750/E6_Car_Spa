// Cleaned: Real customer records are loaded exclusively from PostgreSQL via API.
export interface MockCustomer {
	id: string;
	name: string;
	phone: string;
	email: string;
	address: string;
	totalVisits: number;
	totalSpent: number;
	lastVisit: string;
	status: 'active' | 'inactive';
	outstandingBalance: number;
}

export const mockCustomers: MockCustomer[] = [];
