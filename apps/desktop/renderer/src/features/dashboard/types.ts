export interface NavItem {
 path: string;
 label: string;
 icon: string;
}

export const navItems: NavItem[] = [
 { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
 { path: '/customers', label: 'Customers', icon: 'group' },
 { path: '/job-cards', label: 'Job Cards', icon: 'assignment' },
 { path: '/quotations-invoices', label: 'Quotations & Invoices', icon: 'receipt_long' },
 { path: '/catalogue', label: 'Catalogue', icon: 'inventory_2' },
 { path: '/staff-advances', label: 'Staff Advances', icon: 'payments' },
 { path: '/reports', label: 'Reports', icon: 'analytics' },
 { path: '/showroom', label: 'Showroom', icon: 'directions_car' },
];

export const footerNavItems: NavItem[] = [
 { path: '/settings', label: 'Settings', icon: 'settings' },
 { path: '/profile', label: 'Profile', icon: 'account_circle' },
];
