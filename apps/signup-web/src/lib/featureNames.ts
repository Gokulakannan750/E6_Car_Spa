// Plain names for the server's feature keys (Domain/Platform FeatureKeys) and short descriptions for the website.

export const FEATURES: Record<string, { name: string; description: string }> = {
	'whatsapp_automation.enabled': { name: 'WhatsApp automation', description: 'Invoice and payment messages to your customers on WhatsApp.' },
	'outside_jobs.enabled': { name: 'Outside jobs & vendors', description: 'Send work to outside vendors and track their cost and your margin.' },
	'staff_advances.enabled': { name: 'Staff advances & salary', description: 'Advances, monthly salary with overtime and advance recovery.' },
	'reports.advanced': { name: 'Advanced reports', description: 'GST report, staff productivity, job turnaround and margins.' },
	'audit_trail.enabled': { name: 'Audit trail', description: 'A record of discounts, cancellations and important changes.' },
	'showroom.enabled': { name: 'Showroom / B2B module', description: 'Staff at dealership showrooms, daily vehicle logs and dealer billing.' },
	'franchise_network.enabled': { name: 'Franchise network', description: 'See approved totals from your franchise branches in one place.' },
	'franchise_network.max_branches': { name: 'More franchise branches', description: 'Adds franchise branches to your network.' },
};

export function featureName(key: string): string {
	return FEATURES[key]?.name ?? key;
}

/** What every plan includes (the core of the software). */
export const CORE_FEATURES = [
	'Customers & vehicles',
	'Job cards',
	'GST and cash invoices',
	'Payments (cash, UPI, card, bank)',
	'Staff and attendance',
	'Basic reports',
	'Excel / CSV export',
];

/** Short lines for the plans the catalog starts with; a plan Trovo adds later shows its name and modules only. */
export const PLAN_TAGLINES: Record<string, string> = {
	starter: 'For washing and detailing centres',
	professional: 'For full detailing studios',
};

/** The Professional modules, in the order the website lists them. */
export const MODULE_ORDER = [
	'whatsapp_automation.enabled',
	'outside_jobs.enabled',
	'staff_advances.enabled',
	'reports.advanced',
	'audit_trail.enabled',
];
