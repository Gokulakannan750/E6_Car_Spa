// Plain-language names for the platform audit actions (the strings the API records).

const ACTIONS: Record<string, string> = {
	'company.created': 'Company created',
	'company.registration_code_issued': 'New registration code issued',
	'company.suspend': 'Company suspended',
	'company.reactivate': 'Company reactivated',
	'subscription.changed': 'Subscription changed',
	'subscription.canceled': 'Subscription canceled',
	'billing_account.updated': 'Billing details updated',
	'invoice.issued': 'Invoice issued',
	'invoice.voided': 'Invoice voided',
	'payment.recorded': 'Payment recorded',
	'plan.version_created': 'New plan price',
	'addon.price_created': 'New add-on price',
	'admin.created': 'Admin added',
	'admin.updated': 'Admin changed',
	'admin.reset': 'Admin sign-in reset',
	'migrations.run': 'Database updates run',
	'platform.signed_in': 'Signed in',
	'platform.password_changed': 'Password changed',
};

export function actionLabel(action: string): string {
	return ACTIONS[action] ?? action;
}

export const AUDIT_ACTIONS = Object.keys(ACTIONS);

/** Pretty-prints stored JSON before/after values; falls back to the raw text. */
export function prettyJson(value: string | null): string {
	if (!value) return '';
	try {
		return JSON.stringify(JSON.parse(value), null, 2);
	} catch {
		return value;
	}
}
