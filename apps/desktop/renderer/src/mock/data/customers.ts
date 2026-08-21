export interface MockCustomer {
 id: string;
 name: string;
 phone: string;
 email: string;
 address: string;
 totalVehicles: number;
 totalVisits: number;
 outstandingBalance: number;
 lastVisit: string;
 status: 'active' | 'inactive';
 createdAt: string;
}

export const mockCustomers: MockCustomer[] = [
 { id: 'c1', name: 'Gokulakannan S', phone: '9876543210', email: 'gokul@email.com', address: '123, Anna Nagar, Chennai', totalVehicles: 2, totalVisits: 12, outstandingBalance: 0, lastVisit: '2026-08-20', status: 'active', createdAt: '2025-06-15' },
 { id: 'c2', name: 'Ravi Kumar M', phone: '8765432109', email: 'ravi@email.com', address: '45, T Nagar, Chennai', totalVehicles: 1, totalVisits: 8, outstandingBalance: 2500, lastVisit: '2026-08-18', status: 'active', createdAt: '2025-07-22' },
 { id: 'c3', name: 'Priya Devi R', phone: '7654321098', email: 'priya@email.com', address: '78, Velachery, Chennai', totalVehicles: 3, totalVisits: 20, outstandingBalance: 0, lastVisit: '2026-08-19', status: 'active', createdAt: '2025-03-10' },
 { id: 'c4', name: 'Arun Prakash K', phone: '6543210987', email: 'arun@email.com', address: '12, Adyar, Chennai', totalVehicles: 1, totalVisits: 5, outstandingBalance: 1800, lastVisit: '2026-08-15', status: 'active', createdAt: '2025-09-01' },
 { id: 'c5', name: 'Kavitha Rajendran', phone: '5432109876', email: 'kavitha@email.com', address: '90, Nungambakkam, Chennai', totalVehicles: 2, totalVisits: 15, outstandingBalance: 3200, lastVisit: '2026-08-10', status: 'active', createdAt: '2025-04-20' },
 { id: 'c6', name: 'Senthil Nathan V', phone: '4321098765', email: 'senthil@email.com', address: '34, K.K. Nagar, Chennai', totalVehicles: 1, totalVisits: 3, outstandingBalance: 0, lastVisit: '2026-07-25', status: 'inactive', createdAt: '2026-01-05' },
 { id: 'c7', name: 'Meena Lakshmi', phone: '9876512340', email: 'meena@email.com', address: '56, Chromepet, Chennai', totalVehicles: 2, totalVisits: 9, outstandingBalance: 1200, lastVisit: '2026-08-17', status: 'active', createdAt: '2025-08-14' },
 { id: 'c8', name: 'Deepak Chandran', phone: '8765490123', email: 'deepak@email.com', address: '21, Porur, Chennai', totalVehicles: 1, totalVisits: 6, outstandingBalance: 0, lastVisit: '2026-08-21', status: 'active', createdAt: '2025-10-30' },
];
