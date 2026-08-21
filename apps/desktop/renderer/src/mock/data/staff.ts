export interface MockStaff {
 id: string;
 name: string;
 role: string;
 phone: string;
 email: string;
 status: 'active' | 'inactive';
}

export const mockStaff: MockStaff[] = [
 { id: 'st1', name: 'Rajesh M', role: 'Senior Technician', phone: '9876500001', email: 'rajesh@carspa.com', status: 'active' },
 { id: 'st2', name: 'Vikram S', role: 'Detailer', phone: '9876500002', email: 'vikram@carspa.com', status: 'active' },
 { id: 'st3', name: 'Anita K', role: 'Manager', phone: '9876500003', email: 'anita@carspa.com', status: 'active' },
 { id: 'st4', name: 'Karthik R', role: 'Junior Technician', phone: '9876500004', email: 'karthik@carspa.com', status: 'active' },
 { id: 'st5', name: 'Deepa V', role: 'Receptionist', phone: '9876500005', email: 'deepa@carspa.com', status: 'active' },
 { id: 'st6', name: 'Manoj P', role: 'Detailer', phone: '9876500006', email: 'manoj@carspa.com', status: 'inactive' },
];
