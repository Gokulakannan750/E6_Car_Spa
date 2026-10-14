import { useMemo } from 'react';
import { useAuth } from '../auth/auth-context';
import { useFranchiseAccess } from '../franchise/useFranchiseAccess';

export interface SuiteShortcut {
	id: string;
	name: string;
	/** Where Alt + number goes. */
	route: string;
	/** 1-based; Alt + this number. */
	number: number;
	label: string;
}

const SUITE_ORDER: { id: string; name: string; route: string }[] = [
	{ id: 'billing', name: 'Billing', route: '/job-cards' },
	{ id: 'staff', name: 'Staff', route: '/staff-advances' },
	{ id: 'showroom', name: 'Showroom', route: '/showroom' },
	{ id: 'reports', name: 'Reports', route: '/reports' },
	{ id: 'settings', name: 'Settings', route: '/settings' },
	{ id: 'franchise', name: 'Franchise', route: '/franchise' },
];

/**
 * The suite launcher's workspaces the company can see, numbered in order, so Alt + 1, 2, 3 … stay
 * consecutive when a workspace is not in the plan (no Showroom → Reports is Alt + 3).
 */
export function useSuiteShortcuts(): { shortcuts: SuiteShortcut[]; showShowroom: boolean; showFranchise: boolean } {
	const { hasPermission, hasFeature } = useAuth();
	const showShowroom = hasFeature ? hasFeature('showroom.enabled') : true;
	const franchiseAccess = useFranchiseAccess();
	const showFranchise = franchiseAccess.canActAsFranchisor && hasPermission('franchise.view');

	const shortcuts = useMemo(
		() =>
			SUITE_ORDER.filter((app) => (app.id !== 'showroom' || showShowroom) && (app.id !== 'franchise' || showFranchise)).map(
				(app, index) => ({ ...app, number: index + 1, label: `Alt + ${index + 1}` }),
			),
		[showShowroom, showFranchise],
	);
	return { shortcuts, showShowroom, showFranchise };
}
