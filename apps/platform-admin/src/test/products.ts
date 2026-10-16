import type { Product } from '@/lib/types';
export const carSpa: Product = {
	key: 'carspa',
	name: 'Car Spa',
	seatModel: 'PerType',
	trialPlanCode: 'professional',
	databasePrefix: 'carspa',
	isActive: true,
	seatTypes: [
		{ code: 'android', name: 'Android only', sortOrder: 1, isActive: true },
		{ code: 'windows', name: 'Windows only', sortOrder: 2, isActive: true },
		{ code: 'both', name: 'Windows + Android', sortOrder: 3, isActive: true, defaultSeat: true },
	],
	features: [
		{ key: 'whatsapp_automation.enabled', label: 'WhatsApp automation', type: 'Bool', sortOrder: 1 },
		{ key: 'showroom.enabled', label: 'Showroom / B2B', type: 'Bool', sortOrder: 2 },
	],
	capabilities: ['franchise'],
};
export const demo: Product = {
	key: 'demo',
	name: 'Demo',
	seatModel: 'None',
	trialPlanCode: 'basic',
	databasePrefix: 'demo',
	isActive: true,
	seatTypes: [],
	features: [{ key: 'demo.enabled', label: 'Project workspace', type: 'Bool', sortOrder: 1 }],
	capabilities: [],
};
