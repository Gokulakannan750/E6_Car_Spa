/**
 * The plan features the server knows (see FeatureKeys on the backend). The server enforces them; the app only uses
 * them to hide what the company's plan does not include.
 */
export const FEATURES = {
	showroom: 'showroom.enabled',
	whatsApp: 'whatsapp_automation.enabled',
	franchiseNetwork: 'franchise_network.enabled',
	outsideJobs: 'outside_jobs.enabled',
	staffAdvances: 'staff_advances.enabled',
	advancedReports: 'reports.advanced',
	auditTrail: 'audit_trail.enabled',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * The plan feature a permission belongs to, or null when every plan includes it. Pages and buttons that check a
 * permission are then hidden automatically when the plan lacks the module.
 */
export function featureForPermission(permission: string): FeatureKey | null {
	if (permission.startsWith('showroom.') || permission === 'reports.showrooms') return FEATURES.showroom;
	if (permission.startsWith('staff_advances.') || permission.startsWith('staff_salary.') || permission === 'reports.staff_advances') {
		return FEATURES.staffAdvances;
	}
	if (permission.startsWith('outsidejobs.') || permission.startsWith('vendors.')) return FEATURES.outsideJobs;
	if (permission.startsWith('audit.')) return FEATURES.auditTrail;
	if (permission === 'reports.gst' || permission === 'reports.job_cards' || permission === 'reports.staff_productivity') {
		return FEATURES.advancedReports;
	}
	return null;
}

/** Whether a feature is on. Until the subscription is known, or on a single-company server, everything is on. */
export function isFeatureOn(features: Record<string, string> | undefined, managed: boolean | undefined, key: string): boolean {
	if (!managed || !features) return true;
	return features[key]?.toLowerCase() === 'true';
}
