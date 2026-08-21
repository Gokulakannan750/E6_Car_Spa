export interface MockJobCard {
 id: string;
 jobCardNumber: string;
 customerId: string;
 customerName: string;
 customerPhone: string;
 vehicleId: string;
 registrationNumber: string;
 make: string;
 model: string;
 services: MockJobCardService[];
 status: 'draft' | 'in-progress' | 'ready-for-delivery' | 'completed' | 'cancelled';
 subtotal: number;
 discount: number;
 tax: number;
 totalAmount: number;
 createdAt: string;
 updatedAt: string;
 notes?: string;
}

export interface MockJobCardService {
 id: string;
 name: string;
 category: string | null;
 quantity: number;
 unitPrice: number;
 discountAmount: number;
 lineTotal: number;
}

export const mockJobCards: MockJobCard[] = [
 {
 id: 'jc1', jobCardNumber: 'JC-2026-001', customerId: 'c1', customerName: 'Gokulakannan S', customerPhone: '9876543210',
 vehicleId: 'v1', registrationNumber: 'TN56P1234', make: 'Maruti', model: 'Alto 800',
 status: 'in-progress', subtotal: 3000, discount: 0, tax: 540, totalAmount: 3540,
 services: [
 { id: 'js1', name: 'Premium Wash & Wax', category: 'Washing', quantity: 1, unitPrice: 1200, discountAmount: 0, lineTotal: 1200 },
 { id: 'js2', name: 'Full Interior Detail', category: 'Interior', quantity: 1, unitPrice: 2000, discountAmount: 0, lineTotal: 2000 },
 ],
 createdAt: '2026-08-21T09:30:00', updatedAt: '2026-08-21T10:00:00',
 },
 {
 id: 'jc2', jobCardNumber: 'JC-2026-002', customerId: 'c2', customerName: 'Ravi Kumar M', customerPhone: '8765432109',
 vehicleId: 'v3', registrationNumber: 'TN01CD5678', make: 'Toyota', model: 'Innova Crysta',
 status: 'ready-for-delivery', subtotal: 1700, discount: 200, tax: 270, totalAmount: 1770,
 services: [
 { id: 'js3', name: 'Basic Car Wash', category: 'Washing', quantity: 1, unitPrice: 500, discountAmount: 0, lineTotal: 500 },
 { id: 'js4', name: 'Ceramic Coating', category: 'Coating', quantity: 1, unitPrice: 8000, discountAmount: 200, lineTotal: 7800 },
 ],
 createdAt: '2026-08-20T11:00:00', updatedAt: '2026-08-21T08:30:00',
 },
 {
 id: 'jc3', jobCardNumber: 'JC-2026-003', customerId: 'c3', customerName: 'Priya Devi R', customerPhone: '7654321098',
 vehicleId: 'v4', registrationNumber: 'TN22EF9012', make: 'Honda', model: 'City',
 status: 'completed', subtotal: 800, discount: 0, tax: 144, totalAmount: 944,
 services: [
 { id: 'js5', name: 'Interior Vacuuming', category: 'Interior', quantity: 1, unitPrice: 800, discountAmount: 0, lineTotal: 800 },
 ],
 createdAt: '2026-08-19T14:00:00', updatedAt: '2026-08-19T16:00:00',
 },
 {
 id: 'jc4', jobCardNumber: 'JC-2026-004', customerId: 'c4', customerName: 'Arun Prakash K', customerPhone: '6543210987',
 vehicleId: 'v7', registrationNumber: 'TN04LM1234', make: 'Mahindra', model: 'Scorpio',
 status: 'draft', subtotal: 0, discount: 0, tax: 0, totalAmount: 0,
 services: [], createdAt: '2026-08-21T07:00:00', updatedAt: '2026-08-21T07:00:00',
 },
 {
 id: 'jc5', jobCardNumber: 'JC-2026-005', customerId: 'c5', customerName: 'Kavitha Rajendran', customerPhone: '5432109876',
 vehicleId: 'v8', registrationNumber: 'TN09NP5678', make: 'Kia', model: 'Seltos',
 status: 'completed', subtotal: 3500, discount: 500, tax: 540, totalAmount: 3540,
 services: [
 { id: 'js6', name: 'Paint Correction', category: 'Detailing', quantity: 1, unitPrice: 5000, discountAmount: 500, lineTotal: 4500 },
 { id: 'js7', name: 'Tyre Shine & Polish', category: 'Exterior', quantity: 1, unitPrice: 400, discountAmount: 0, lineTotal: 400 },
 ],
 createdAt: '2026-08-18T10:00:00', updatedAt: '2026-08-18T14:00:00',
 },
 {
 id: 'jc6', jobCardNumber: 'JC-2026-006', customerId: 'c7', customerName: 'Meena Lakshmi', customerPhone: '9876512340',
 vehicleId: 'v8', registrationNumber: 'TN09NP5678', make: 'Kia', model: 'Seltos',
 status: 'in-progress', subtotal: 2000, discount: 0, tax: 360, totalAmount: 2360,
 services: [
 { id: 'js8', name: 'AC Vent Cleaning', category: 'Interior', quantity: 1, unitPrice: 1000, discountAmount: 0, lineTotal: 1000 },
 { id: 'js9', name: 'Glass Coating', category: 'Coating', quantity: 1, unitPrice: 2000, discountAmount: 0, lineTotal: 2000 },
 ],
 createdAt: '2026-08-21T08:00:00', updatedAt: '2026-08-21T09:00:00',
 },
];

export const jobCardStatuses = [
 { value: 'draft', label: 'Draft' },
 { value: 'in-progress', label: 'In Progress' },
 { value: 'ready-for-delivery', label: 'Ready for Delivery' },
 { value: 'completed', label: 'Completed' },
 { value: 'cancelled', label: 'Cancelled' },
];
