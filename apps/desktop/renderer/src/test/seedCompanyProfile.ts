import { BUSINESS_PROFILE_STORAGE_KEY } from '../lib/api';

/** Saves a sample company the way Company Settings does, so documents and exports pick up its name. */
export function seedCompanyProfile(businessName = 'Sunrise Detailing'): void {
	localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify({ businessName }));
}

export function clearCompanyProfile(): void {
	localStorage.removeItem(BUSINESS_PROFILE_STORAGE_KEY);
}
