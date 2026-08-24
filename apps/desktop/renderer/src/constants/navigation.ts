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
} from 'lucide-react';

import type { NavigationItem } from '../types/app';

export const NAVIGATION_ITEMS: NavigationItem[] = [
	{
		label: 'Dashboard',
		path: '/dashboard',
		icon: 'LayoutDashboard',
		requiresPermission: 'dashboard.view',
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
		requiresPermission: 'jobcards.view',
	},
	{
		label: 'Staff Advances',
		path: '/staff-advances',
		icon: 'Wallet',
		requiresPermission: 'staff.advances',
	},
	{
		label: 'Reports',
		path: '/reports',
		icon: 'BarChart3',
		requiresPermission: 'reports.view',
	},
	{
		label: 'Showroom',
		path: '/showroom',
		icon: 'Store',
		requiresPermission: 'showroom.view',
	},
	{
		label: 'Audit Trail',
		path: '/audit',
		icon: 'History',
		requiresPermission: 'audit.view',
	},
];

export const BOTTOM_NAVIGATION_ITEMS: NavigationItem[] = [
	{
		label: 'Users & Access',
		path: '/settings/users',
		icon: 'Shield',
		requiresPermission: 'users.view',
	},
	{
		label: 'Settings',
		path: '/settings',
		icon: 'Settings',
		requiresPermission: 'settings.view',
	},
];

export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const SIDEBAR_EXPANDED_WIDTH = 240;

export const ICON_MAP: Record<string, React.ForwardRefExoticComponent<React.RefAttributes<SVGSVGElement> & Record<string, unknown>>> = {
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
};
