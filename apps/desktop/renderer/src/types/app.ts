export interface User {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: UserRole;
	avatarUrl?: string;
	createdAt: string;
	updatedAt: string;
}

export enum UserRole {
	ADMIN = 'admin',
	MANAGER = 'manager',
	CASHIER = 'cashier',
	STAFF = 'staff',
}

export interface AppSettings {
	id: string;
	companyName: string;
	companyLogo?: string;
	companyAddress: string;
	companyPhone: string;
	companyEmail: string;
	currency: string;
	currencySymbol: string;
	taxRate: number;
	jobCardPrefix: string;
	fiscalYearStart: string;
	createdAt: string;
	updatedAt: string;
}

export interface NavigationItem {
	label: string;
	path: string;
	icon: string;
	children?: NavigationItem[];
	badge?: string | number;
	requiresPermission?: string;
}

export type SidebarCollapsed = 'expanded' | 'collapsed';

export interface AppState {
	sidebarCollapsed: boolean;
	settings: AppSettings | null;
	currentUser: User | null;
	isLoading: boolean;
	isElectron: boolean;
	globalSearch: string;
}

export interface AppActions {
	toggleSidebar: () => void;
	setSidebarCollapsed: (collapsed: boolean) => void;
	setSettings: (settings: AppSettings) => void;
	setCurrentUser: (user: User) => void;
	setLoading: (loading: boolean) => void;
	setElectron: (isElectron: boolean) => void;
	setGlobalSearch: (query: string) => void;
}
