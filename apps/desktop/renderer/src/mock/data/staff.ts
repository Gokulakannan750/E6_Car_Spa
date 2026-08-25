// Cleaned: Real staff records are loaded exclusively from PostgreSQL via API.
export interface MockStaff {
	id: string;
	name: string;
	role: string;
	department: string;
	phone: string;
	email: string;
	status: 'active' | 'inactive';
}

export const mockStaff: MockStaff[] = [];
