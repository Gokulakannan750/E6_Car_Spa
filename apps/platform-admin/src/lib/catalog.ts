// Names for the feature keys the API uses (Domain/Platform FeatureKeys) and small helpers for plan codes.

export const FEATURE_LABELS: Record<string, string> = {
	'users.max_active': 'Users',
	'whatsapp_automation.enabled': 'WhatsApp automation',
	'outside_jobs.enabled': 'Outside jobs',
	'staff_advances.enabled': 'Staff advances',
	'reports.advanced': 'Advanced reports',
	'audit_trail.enabled': 'Audit trail',
	'showroom.enabled': 'Showroom / B2B',
	'franchise_network.enabled': 'Franchise network',
	'franchise_network.max_branches': 'Franchise branches',
};

/** Feature keys shown as on/off rows, in display order. */
export const BOOLEAN_FEATURES = [
	'whatsapp_automation.enabled',
	'outside_jobs.enabled',
	'staff_advances.enabled',
	'reports.advanced',
	'audit_trail.enabled',
	'showroom.enabled',
	'franchise_network.enabled',
];

export function featureLabel(key: string): string {
	return FEATURE_LABELS[key] ?? key;
}

export function planName(code: string | null | undefined): string {
	if (!code) return '—';
	return code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ');
}

export const SUBSCRIPTION_STATUSES = ['Trialing', 'Active', 'PastDue', 'ReadOnly', 'Suspended', 'Canceled'] as const;
