export interface MockService {
 id: string;
 name: string;
 category: string;
 description: string;
 basePrice: number;
 duration: string;
 status: 'active' | 'inactive';
}

export const mockServices: MockService[] = [
 { id: 's1', name: 'Basic Car Wash', category: 'Washing', description: 'Exterior wash with foam', basePrice: 500, duration: '30 min', status: 'active' },
 { id: 's2', name: 'Premium Wash & Wax', category: 'Washing', description: 'Full wash with premium wax coating', basePrice: 1200, duration: '60 min', status: 'active' },
 { id: 's3', name: 'Interior Vacuuming', category: 'Interior', description: 'Complete interior vacuum and wipe', basePrice: 800, duration: '45 min', status: 'active' },
 { id: 's4', name: 'Full Interior Detail', category: 'Interior', description: 'Dashboard, seats, mats deep clean', basePrice: 2000, duration: '90 min', status: 'active' },
 { id: 's5', name: 'Ceramic Coating', category: 'Coating', description: '9H ceramic coating for paint protection', basePrice: 8000, duration: '3 hours', status: 'active' },
 { id: 's6', name: 'Paint Correction', category: 'Detailing', description: '3-stage paint correction', basePrice: 5000, duration: '4 hours', status: 'active' },
 { id: 's7', name: 'Headlight Restoration', category: 'Detailing', description: 'Restore cloudy headlights', basePrice: 1500, duration: '45 min', status: 'active' },
 { id: 's8', name: 'AC Vent Cleaning', category: 'Interior', description: 'Deep AC vent and duct cleaning', basePrice: 1000, duration: '30 min', status: 'active' },
 { id: 's9', name: 'Engine Cleaning', category: 'Detailing', description: 'Under-bonnet steam cleaning', basePrice: 1500, duration: '45 min', status: 'inactive' },
 { id: 's10', name: 'Tyre Shine & Polish', category: 'Exterior', description: 'Tyre deep clean and shine', basePrice: 400, duration: '20 min', status: 'active' },
 { id: 's11', name: 'Express Wash', category: 'Washing', description: 'Quick 10-min exterior wash', basePrice: 300, duration: '10 min', status: 'active' },
 { id: 's12', name: 'Glass Coating', category: 'Coating', description: 'Hydrophobic glass coating', basePrice: 2000, duration: '1 hour', status: 'active' },
];

export const serviceCategories = Array.from(new Set(mockServices.map(s => s.category)));
