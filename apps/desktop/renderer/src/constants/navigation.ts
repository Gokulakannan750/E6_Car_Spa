import {
	LayoutDashboard,
	Users,
	ClipboardList,
	FileText,
	Wrench,
	Wallet,
	BarChart3,
	Store,
	Settings,
	Shield,
	History,
	Home,
	LayoutGrid,
	CreditCard,
	Calendar,
	Banknote,
	Clock,
	CalendarCheck,
	Receipt,
	TrendingUp,
	FileSpreadsheet,
	SlidersHorizontal,
	Sliders,
	Building2,
	MessageSquare,
} from 'lucide-react';

import type { NavigationItem } from '../types/app';

export type Workspace =
	| 'launcher'
	| 'billing'
	| 'staff'
	| 'showroom'
	| 'reports'
	| 'settings';

export const WORKSPACE_TITLES: Record<Workspace, string> = {
	launcher: 'Suite Launcher',
	billing: 'E6 Billing',
	staff: 'E6 Staff',
	showroom: 'E6 Showroom',
	reports: 'E6 Reports',
	settings: 'E6 Settings',
};

/**
 * Route-to-workspace mapping
 */
export function getWorkspaceFromPath(pathname: string): Workspace {
	const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

	// LAUNCHER: / or /dashboard or /dashboard/*
	if (path === '' || path === '/' || path === '/dashboard' || path.startsWith('/dashboard/')) {
		return 'launcher';
	}

	// BILLING: /job-cards, /customers, /invoices, /catalogue, /payments
	if (
		path === '/job-cards' ||
		path.startsWith('/job-cards/') ||
		path === '/customers' ||
		path.startsWith('/customers/') ||
		path === '/invoices' ||
		path.startsWith('/invoices/') ||
		path === '/catalogue' ||
		path.startsWith('/catalogue/') ||
		path === '/payments' ||
		path.startsWith('/payments/')
	) {
		return 'billing';
	}

	// STAFF: /staff, /staff-advances, /staff-attendance, /staff-salary
	if (
		path === '/staff' ||
		path.startsWith('/staff/') ||
		path === '/staff-advances' ||
		path.startsWith('/staff-advances/') ||
		path === '/staff-attendance' ||
		path.startsWith('/staff-attendance/') ||
		path === '/staff-salary' ||
		path.startsWith('/staff-salary/') ||
		path === '/attendance' ||
		path.startsWith('/attendance/') ||
		path === '/salary' ||
		path.startsWith('/salary/')
	) {
		return 'staff';
	}

	// SHOWROOM: /showroom
	if (path === '/showroom' || path.startsWith('/showroom/')) {
		return 'showroom';
	}

	// REPORTS: /reports
	if (path === '/reports' || path.startsWith('/reports/')) {
		return 'reports';
	}

	// SETTINGS: /settings, /audit
	if (
		path === '/settings' ||
		path.startsWith('/settings/') ||
		path === '/audit' ||
		path.startsWith('/audit/')
	) {
		return 'settings';
	}

	return 'launcher';
}

/**
 * Global item accessible from every workspace
 */
export const GLOBAL_AUDIT_ITEM: NavigationItem = {
	label: 'Audit Trail',
	path: '/audit',
	icon: 'History',
	requiresPermission: 'audit.view',
};

/**
 * Isolated workspace navigation configuration
 */
export const WORKSPACE_NAVIGATION: Record<Workspace, NavigationItem[]> = {
	launcher: [
		{
			label: 'Suite Home',
			path: '/dashboard',
			icon: 'Home',
		},
		{
			label: 'Applications',
			path: '/dashboard#applications',
			icon: 'LayoutGrid',
			anchor: true,
		},
		{
			label: 'Settings',
			path: '/settings',
			icon: 'Settings',
			requiresPermission: 'settings.view',
		},
	],
	billing: [
		{
			label: 'Suite Home',
			path: '/dashboard',
			icon: 'Home',
		},
		{
			label: 'Customers',
			path: '/customers',
			icon: 'Users',
			requiresPermission: 'customers.view',
		},
		{
			label: 'Job Cards',
			path: '/job-cards',
			icon: 'ClipboardList',
			requiresPermission: 'jobcards.view',
		},
		{
			label: 'Invoices',
			path: '/invoices',
			icon: 'FileText',
			requiresPermission: 'invoices.view',
		},
		{
			label: 'Catalogue',
			path: '/catalogue',
			icon: 'Wrench',
			requiresPermission: 'catalogue.view',
		},
	],
	staff: [
		{
			label: 'Suite Home',
			path: '/dashboard',
			icon: 'Home',
		},
		{
			label: 'Staff Directory',
			path: '/staff',
			icon: 'Users',
			requiresPermission: 'staff_advances.view',
		},
		{
			label: 'Staff Advances',
			path: '/staff-advances',
			icon: 'Wallet',
			requiresPermission: 'staff_advances.view',
		},
		{
			label: 'Attendance',
			path: '/staff-attendance',
			icon: 'Calendar',
			requiresPermission: 'staff_advances.view',
		},
		{
			label: 'Salary',
			path: '/staff-salary',
			icon: 'Banknote',
			requiresPermission: 'staff_advances.view',
		},
	],
	showroom: [
		{
			label: 'Suite Home',
			path: '/dashboard',
			icon: 'Home',
		},
		{
			label: 'Showrooms',
			path: '/showroom',
			icon: 'Store',
			requiresPermission: 'showroom.view',
		},
		{
			label: 'Showroom Attendance',
			path: '/showroom/attendance',
			icon: 'CalendarCheck',
			requiresPermission: 'showroom.view',
		},
		{
			label: 'Showroom Operations',
			path: '/showroom/operations',
			icon: 'ClipboardList',
			requiresPermission: 'showroom.view',
		},
		{
			label: 'Showroom Bill',
			path: '/showroom/bill',
			icon: 'Receipt',
			requiresPermission: 'showroom.view',
		},
	],
	reports: [
		{
			label: 'Suite Home',
			path: '/dashboard',
			icon: 'Home',
		},
		{
			label: 'Business Reports',
			path: '/reports/business',
			icon: 'TrendingUp',
			requiresPermission: 'reports.view',
		},
		{
			label: 'Billing Reports',
			path: '/reports/billing',
			icon: 'FileSpreadsheet',
			requiresPermission: 'reports.view',
		},
		{
			label: 'Staff Reports',
			path: '/reports/staff',
			icon: 'Users',
			requiresPermission: 'reports.view',
		},
		{
			label: 'Showroom Reports',
			path: '/reports/showroom',
			icon: 'Store',
			requiresPermission: 'reports.view',
		},
		{
			label: 'Custom Reports',
			path: '/reports/custom',
			icon: 'SlidersHorizontal',
			requiresPermission: 'reports.view',
		},
	],
	settings: [
		{
			label: 'Suite Home',
			path: '/dashboard',
			icon: 'Home',
		},
		{
			label: 'Company Settings',
			path: '/settings',
			icon: 'Building2',
			requiresPermission: 'settings.view',
		},
		{
			label: 'WhatsApp Settings',
			path: '/settings/whatsapp',
			icon: 'MessageSquare',
			requiresPermission: 'settings.view',
		},
		{
			label: 'Users & Access',
			path: '/settings/users',
			icon: 'Shield',
			requiresPermission: 'users.view',
		},
		{
			label: 'System Preferences',
			path: '/settings/system',
			icon: 'Sliders',
			requiresPermission: 'settings.view',
		},
	],
};

/**
 * Determine if a navigation item is currently active based on pathname, search, and hash.
 */
export function isItemActive(
	item: NavigationItem,
	pathname: string,
	search = '',
	hash = ''
): boolean {
	const normPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

	// Suite Home (/dashboard or /)
	if (item.path === '/dashboard') {
		return normPath === '/dashboard' || normPath === '/' || normPath === '';
	}

	// Hash-based items (e.g. /dashboard#applications, /staff-advances#attendance)
	if (item.path.includes('#')) {
		const [targetPath, targetHash] = item.path.split('#');
		return normPath === targetPath && hash === `#${targetHash}`;
	}

	// Query-param-based items (e.g. /staff-advances?tab=staff, /reports?type=billing)
	if (item.path.includes('?')) {
		const [targetPath, targetQuery] = item.path.split('?');
		if (normPath === targetPath && search === `?${targetQuery}`) {
			return true;
		}
		if (item.path.startsWith('/reports?type=')) {
			const typeVal = item.path.split('=')[1];
			if (normPath === `/reports/${typeVal}`) {
				return true;
			}
		}
		return false;
	}

	// Specific checks for base items that have query-param siblings or sub-routes:
	if (item.path === '/settings') {
		// Company Settings is active if on /settings without competing tab
		return (
			normPath === '/settings' &&
			(!search || search === '?tab=company' || (!search.includes('tab=whatsapp') && !search.includes('tab=system')))
		);
	}

	if (item.path === '/settings/whatsapp') {
		return normPath === '/settings/whatsapp' || (normPath === '/settings' && search.includes('tab=whatsapp'));
	}

	if (item.path === '/settings/system') {
		return normPath === '/settings/system' || (normPath === '/settings' && search.includes('tab=system'));
	}

	if (item.path === '/settings/users') {
		return normPath === '/settings/users' || normPath.startsWith('/settings/users/');
	}

	if (item.path === '/staff') {
		return normPath === '/staff' || normPath.startsWith('/staff/');
	}

	if (item.path === '/staff-advances') {
		// Staff Advances is active if on /staff-advances without tab=staff
		return (
			(normPath === '/staff-advances' || normPath.startsWith('/staff-advances/')) &&
			(!search || !search.includes('tab=staff'))
		);
	}

	if (item.path === '/staff-advances?tab=staff') {
		return (
			(normPath === '/staff-advances' && search.includes('tab=staff')) ||
			normPath === '/staff' ||
			normPath.startsWith('/staff/')
		);
	}

	if (item.path === '/staff-attendance') {
		return (
			normPath === '/staff-attendance' ||
			normPath.startsWith('/staff-attendance/') ||
			normPath === '/attendance' ||
			(normPath === '/staff-advances' && hash === '#attendance')
		);
	}

	if (item.path === '/staff-salary') {
		return (
			normPath === '/staff-salary' ||
			normPath.startsWith('/staff-salary/') ||
			normPath === '/salary' ||
			(normPath === '/staff-advances' && hash === '#salary')
		);
	}

	if (item.path === '/reports') {
		// Reports Dashboard is active on /reports without competing sub-routes or queries
		return normPath === '/reports' && (!search || !search.includes('type='));
	}

	if (item.path === '/reports/business') {
		return (
			normPath === '/reports/business' ||
			(normPath === '/reports' && search.includes('type=business'))
		);
	}

	if (item.path === '/reports/billing') {
		return (
			normPath === '/reports/billing' ||
			(normPath === '/reports' && search.includes('type=billing'))
		);
	}

	if (item.path === '/reports/staff') {
		return (
			normPath === '/reports/staff' ||
			(normPath === '/reports' && search.includes('type=staff'))
		);
	}

	if (item.path === '/reports/showroom') {
		return (
			normPath === '/reports/showroom' ||
			(normPath === '/reports' && search.includes('type=showroom'))
		);
	}

	if (item.path === '/reports/custom') {
		return (
			normPath === '/reports/custom' ||
			(normPath === '/reports' && search.includes('type=custom'))
		);
	}

	if (item.path === '/showroom') {
		return normPath === '/showroom';
	}

	if (item.path === '/showroom/attendance') {
		return normPath === '/showroom/attendance' || normPath.startsWith('/showroom/attendance/');
	}

	if (item.path === '/showroom/bill') {
		return (
			normPath === '/showroom/bill' ||
			normPath.startsWith('/showroom/bill/') ||
			normPath === '/showroom/billing' ||
			normPath.startsWith('/showroom/billing/')
		);
	}

	if (item.path === '/showroom/operations') {
		return normPath === '/showroom/operations' || normPath.startsWith('/showroom/operations/');
	}

	// Exact match
	if (normPath === item.path) {
		return true;
	}

	// Nested subroutes (e.g. /job-cards/new or /customers/123)
	// Guard against /settings matching /settings/users, or /showroom matching /showroom/operations
	if (
		item.path !== '/' &&
		item.path !== '/dashboard' &&
		item.path !== '/settings' &&
		item.path !== '/reports' &&
		item.path !== '/showroom' &&
		item.path !== '/showroom/attendance' &&
		item.path !== '/showroom/bill' &&
		item.path !== '/showroom/operations' &&
		normPath.startsWith(`${item.path}/`)
	) {
		return true;
	}

	return false;
}

// Backwards compatibility exports
export const NAVIGATION_ITEMS: NavigationItem[] = WORKSPACE_NAVIGATION.launcher;
export const BOTTOM_NAVIGATION_ITEMS: NavigationItem[] = [];

export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const SIDEBAR_EXPANDED_WIDTH = 256;

export const ICON_MAP: Record<
	string,
	React.ForwardRefExoticComponent<React.RefAttributes<SVGSVGElement> & Record<string, unknown>>
> = {
	LayoutDashboard,
	Users,
	ClipboardList,
	FileText,
	Wrench,
	Wallet,
	BarChart3,
	Store,
	Settings,
	Shield,
	History,
	Home,
	LayoutGrid,
	CreditCard,
	Calendar,
	Banknote,
	Clock,
	CalendarCheck,
	Receipt,
	TrendingUp,
	FileSpreadsheet,
	SlidersHorizontal,
	Sliders,
	Building2,
	MessageSquare,
};
