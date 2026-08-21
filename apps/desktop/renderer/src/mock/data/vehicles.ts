export interface MockVehicle {
 id: string;
 customerId: string;
 registrationNumber: string;
 make: string;
 model: string;
 variant?: string;
 color?: string;
 createdAt: string;
}

export const mockVehicles: MockVehicle[] = [
 { id: 'v1', customerId: 'c1', registrationNumber: 'TN56P1234', make: 'Maruti', model: 'Alto 800', color: 'White', createdAt: '2025-06-15' },
 { id: 'v2', customerId: 'c1', registrationNumber: 'TN38AB4567', make: 'Hyundai', model: 'Creta', color: 'Black', createdAt: '2025-08-20' },
 { id: 'v3', customerId: 'c2', registrationNumber: 'TN01CD5678', make: 'Toyota', model: 'Innova Crysta', color: 'Silver', createdAt: '2025-07-22' },
 { id: 'v4', customerId: 'c3', registrationNumber: 'TN22EF9012', make: 'Honda', model: 'City', color: 'Red', createdAt: '2025-03-10' },
 { id: 'v5', customerId: 'c3', registrationNumber: 'TN10GH3456', make: 'Maruti', model: 'Swift', color: 'Blue', createdAt: '2025-05-15' },
 { id: 'v6', customerId: 'c3', registrationNumber: 'TN07JK7890', make: 'Tata', model: 'Nexon', color: 'Orange', createdAt: '2026-01-20' },
 { id: 'v7', customerId: 'c4', registrationNumber: 'TN04LM1234', make: 'Mahindra', model: 'Scorpio', color: 'Black', createdAt: '2025-09-01' },
 { id: 'v8', customerId: 'c5', registrationNumber: 'TN09NP5678', make: 'Kia', model: 'Seltos', color: 'Grey', createdAt: '2025-04-20' },
];
