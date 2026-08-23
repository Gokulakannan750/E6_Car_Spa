export interface MockService {
	id: string;
	name: string;
	category: string;
	description: string;
	basePrice: number;
	durationMinutes: number;
	duration: string;
	status: 'active' | 'inactive';
}

export const CATALOGUE_CATEGORIES = [
	'Exterior Detailing',
	'Interior Care',
	'Protection Packages',
	'Others',
] as const;

export const mockServices: MockService[] = [
	// ── Exterior Detailing ──────────────────────────────────────────────────
	{
		id: 's1',
		name: 'Level 3 Paint Correction',
		category: 'Exterior Detailing',
		description: 'Multi-stage machine compounding and polishing to remove 85-95% of deep scratches, swirl marks, and oxidation. Restores showroom clarity to heavily damaged clear coats.',
		basePrice: 5000,
		durationMinutes: 180,
		duration: '3 hours',
		status: 'active',
	},
	{
		id: 's2',
		name: 'Wheels-Off Decontamination',
		category: 'Exterior Detailing',
		description: 'Complete removal of wheels for deep cleaning of inner barrels, brake calipers, and suspension components with iron fallout remover and wheel sealant.',
		basePrice: 1500,
		durationMinutes: 60,
		duration: '1 hour',
		status: 'active',
	},
	{
		id: 's3',
		name: 'Premium Foam Wash & Wax',
		category: 'Exterior Detailing',
		description: 'pH-neutral snow foam pre-wash, two-bucket hand wash, clay bar decontamination, and high-gloss carnauba wax seal.',
		basePrice: 1200,
		durationMinutes: 60,
		duration: '1 hour',
		status: 'active',
	},
	{
		id: 's4',
		name: 'Headlight Restoration',
		category: 'Exterior Detailing',
		description: 'Multi-step wet sanding and compound polishing to eliminate haze, yellowing, and oxidation with long-lasting UV sealant protection.',
		basePrice: 1500,
		durationMinutes: 45,
		duration: '45 min',
		status: 'active',
	},
	{
		id: 's5',
		name: 'Engine Bay Detailing',
		category: 'Exterior Detailing',
		description: 'Under-bonnet steam cleaning, degreasing, safe electrical component masking, and satin matte dressing.',
		basePrice: 1500,
		durationMinutes: 45,
		duration: '45 min',
		status: 'active',
	},
	{
		id: 's6',
		name: 'Tyre Shine & Rim Polish',
		category: 'Exterior Detailing',
		description: 'Deep chemical wheel cleaning, brake dust removal, and ultra-durable hydrophobic tyre gloss coating.',
		basePrice: 400,
		durationMinutes: 20,
		duration: '20 min',
		status: 'active',
	},

	// ── Interior Care ───────────────────────────────────────────────────────
	{
		id: 's7',
		name: 'Full Interior Deep Detail',
		category: 'Interior Care',
		description: 'Dashboard, console, door panels, steam extraction of upholstery and carpets, stain removal, and UV trim conditioning.',
		basePrice: 2500,
		durationMinutes: 120,
		duration: '2 hours',
		status: 'active',
	},
	{
		id: 's8',
		name: 'Leather Conditioning Treatment',
		category: 'Interior Care',
		description: 'Deep pH-balanced leather cleaning followed by rich conditioner to prevent cracking, fading, and dry leather aging.',
		basePrice: 1800,
		durationMinutes: 60,
		duration: '1 hour',
		status: 'active',
	},
	{
		id: 's9',
		name: 'AC Vent Cleaning & Sanitization',
		category: 'Interior Care',
		description: 'High-temperature steam sterilization of air conditioning ducts and vents, eliminating bacteria, mold, and unpleasant odours.',
		basePrice: 1000,
		durationMinutes: 30,
		duration: '30 min',
		status: 'active',
	},
	{
		id: 's10',
		name: 'Interior Vacuuming & Wipe',
		category: 'Interior Care',
		description: 'Comprehensive cabin vacuuming, boot cleaning, door jamb wipe-down, and streak-free interior glass cleaning.',
		basePrice: 800,
		durationMinutes: 45,
		duration: '45 min',
		status: 'active',
	},

	// ── Protection Packages ─────────────────────────────────────────────────
	{
		id: 's11',
		name: 'Signature Ceramic Coating (9H)',
		category: 'Protection Packages',
		description: 'Application of a 9H hardness professional-grade ceramic layer. Provides up to 5 years of extreme gloss, UV protection, and intense hydrophobic properties.',
		basePrice: 15000,
		durationMinutes: 240,
		duration: '4 hours',
		status: 'active',
	},
	{
		id: 's12',
		name: 'Graphene Matrix Coating (10H)',
		category: 'Protection Packages',
		description: 'Next-generation graphene oxide coating with exceptional heat dissipation, anti-water spotting, and 7-year surface durability.',
		basePrice: 22000,
		durationMinutes: 300,
		duration: '5 hours',
		status: 'active',
	},
	{
		id: 's13',
		name: 'Paint Protection Film (PPF) - Front End',
		category: 'Protection Packages',
		description: 'Self-healing TPU film installed on front bumper, full bonnet, front fenders, and mirrors against rock chips and road debris.',
		basePrice: 28000,
		durationMinutes: 360,
		duration: '6 hours',
		status: 'active',
	},
	{
		id: 's14',
		name: 'Underbody Anti-Rust Coating',
		category: 'Protection Packages',
		description: 'Thick bitumen-based rubberized undercarriage spray protecting the vehicle chassis against corrosion, moisture, and road salt.',
		basePrice: 3500,
		durationMinutes: 90,
		duration: '1.5 hours',
		status: 'active',
	},
	{
		id: 's15',
		name: 'Hydrophobic Glass Coating',
		category: 'Protection Packages',
		description: 'Long-lasting hydrophobic glass coating improving wet-weather visibility, water beading, and smooth wiper glide.',
		basePrice: 2000,
		durationMinutes: 60,
		duration: '1 hour',
		status: 'active',
	},

	// ── Others ──────────────────────────────────────────────────────────────
	{
		id: 's16',
		name: 'Odour Removal & Ozone Treatment',
		category: 'Others',
		description: 'High-output ozone generator treatment to permanently eliminate stubborn smoke, food, pet, and mildew smells from cabin fabric.',
		basePrice: 1200,
		durationMinutes: 45,
		duration: '45 min',
		status: 'active',
	},
	{
		id: 's17',
		name: 'Rat Repellent Under-Bonnet Spray',
		category: 'Others',
		description: 'Specialized non-toxic coating applied to engine bay wiring and rubber hoses to deter rodents and pests.',
		basePrice: 800,
		durationMinutes: 30,
		duration: '30 min',
		status: 'active',
	},
	{
		id: 's18',
		name: 'Wiper Blade Installation & Fluid Refill',
		category: 'Others',
		description: 'Pair of all-weather aerodynamic silicone wiper blades installed with anti-smear windshield washer reservoir refill.',
		basePrice: 600,
		durationMinutes: 15,
		duration: '15 min',
		status: 'active',
	},
];

export const serviceCategories = Array.from(new Set(mockServices.map((s) => s.category)));
