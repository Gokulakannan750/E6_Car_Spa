export interface MockInvoice {
 id: string;
 invoiceNumber: string;
 jobCardId: string;
 customerId: string;
 customerName: string;
 vehicleRegistration: string;
 vehicleMake: string;
 vehicleModel: string;
 items: { name: string; quantity: number; unitPrice: number; total: number }[];
 subtotal: number;
 discount: number;
 tax: number;
 totalAmount: number;
 paidAmount: number;
 balance: number;
 status: 'draft' | 'unpaid' | 'partially-paid' | 'paid' | 'cancelled';
 createdAt: string;
 dueDate: string;
}

export const mockInvoices: MockInvoice[] = [
 { id: 'inv1', invoiceNumber: 'INV-2026-001', jobCardId: 'jc2', customerId: 'c2', customerName: 'Ravi Kumar M', vehicleRegistration: 'TN01CD5678', vehicleMake: 'Toyota', vehicleModel: 'Innova Crysta', items: [{ name: 'Basic Car Wash', quantity: 1, unitPrice: 500, total: 500 }, { name: 'Ceramic Coating', quantity: 1, unitPrice: 8000, total: 8000 }], subtotal: 8500, discount: 200, tax: 1485, totalAmount: 9785, paidAmount: 0, balance: 9785, status: 'unpaid', createdAt: '2026-08-20', dueDate: '2026-08-27' },
 { id: 'inv2', invoiceNumber: 'INV-2026-002', jobCardId: 'jc3', customerId: 'c3', customerName: 'Priya Devi R', vehicleRegistration: 'TN22EF9012', vehicleMake: 'Honda', vehicleModel: 'City', items: [{ name: 'Interior Vacuuming', quantity: 1, unitPrice: 800, total: 800 }], subtotal: 800, discount: 0, tax: 144, totalAmount: 944, paidAmount: 944, balance: 0, status: 'paid', createdAt: '2026-08-19', dueDate: '2026-08-26' },
 { id: 'inv3', invoiceNumber: 'INV-2026-003', jobCardId: 'jc1', customerId: 'c1', customerName: 'Gokulakannan S', vehicleRegistration: 'TN56P1234', vehicleMake: 'Maruti', vehicleModel: 'Alto 800', items: [{ name: 'Premium Wash & Wax', quantity: 1, unitPrice: 1200, total: 1200 }, { name: 'Full Interior Detail', quantity: 1, unitPrice: 2000, total: 2000 }], subtotal: 3200, discount: 0, tax: 576, totalAmount: 3776, paidAmount: 1500, balance: 2276, status: 'partially-paid', createdAt: '2026-08-21', dueDate: '2026-08-28' },
 { id: 'inv4', invoiceNumber: 'INV-2026-004', jobCardId: 'jc5', customerId: 'c5', customerName: 'Kavitha Rajendran', vehicleRegistration: 'TN09NP5678', vehicleMake: 'Kia', vehicleModel: 'Seltos', items: [{ name: 'Paint Correction', quantity: 1, unitPrice: 5000, total: 5000 }, { name: 'Tyre Shine & Polish', quantity: 1, unitPrice: 400, total: 400 }], subtotal: 5400, discount: 500, tax: 882, totalAmount: 5782, paidAmount: 5782, balance: 0, status: 'paid', createdAt: '2026-08-18', dueDate: '2026-08-25' },
];
