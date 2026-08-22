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
} from 'lucide-react';

import type { NavigationItem } from '../types/app';

export const NAVIGATION_ITEMS: NavigationItem[] = [
 {
 label: 'Dashboard',
 path: '/dashboard',
 icon: 'LayoutDashboard',
 },
 {
 label: 'Customers',
 path: '/customers',
 icon: 'Users',
 },
 {
 label: 'Job Cards',
 path: '/job-cards',
 icon: 'ClipboardList',
 },
 {
 label: 'Invoices',
 path: '/quotations-invoices',
 icon: 'FileText',
 },
 {
 label: 'Catalogue',
 path: '/catalogue',
 icon: 'Wrench',
 },
 {
 label: 'Staff Advances',
 path: '/staff-advances',
 icon: 'Wallet',
 },
 {
 label: 'Reports',
 path: '/reports',
 icon: 'BarChart3',
 },
 {
 label: 'Showroom',
 path: '/showroom',
 icon: 'Store',
 },
];

export const BOTTOM_NAVIGATION_ITEMS: NavigationItem[] = [
 {
 label: 'Settings',
 path: '/settings',
 icon: 'Settings',
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
};
