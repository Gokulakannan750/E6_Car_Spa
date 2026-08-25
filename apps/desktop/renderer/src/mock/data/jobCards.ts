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

export const mockJobCards: MockJobCard[] = [];

export const jobCardStatuses = [
 { value: 'draft', label: 'Draft' },
 { value: 'in-progress', label: 'In Progress' },
 { value: 'ready-for-delivery', label: 'Ready for Delivery' },
 { value: 'completed', label: 'Completed' },
 { value: 'cancelled', label: 'Cancelled' },
];
