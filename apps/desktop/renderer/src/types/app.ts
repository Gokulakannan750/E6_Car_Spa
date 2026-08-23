export type UserRoleType = 'Owner' | 'Manager' | 'Staff';

export enum UserRole {
	OWNER = 'Owner',
	MANAGER = 'Manager',
	STAFF = 'Staff',
	// Backwards compatibility aliases if any component references them
	Owner = 'Owner',
	Manager = 'Manager',
	Staff = 'Staff',
	ADMIN = 'Owner',
	admin = 'Owner',
	manager = 'Manager',
	cashier = 'Staff',
	staff = 'Staff',
}

export interface User {
	id: string;
	username?: string;
	fullName?: string;
	firstName?: string;
	lastName?: string;
	email?: string | null;
	role: UserRoleType | string;
	isOwner?: boolean;
	permissions?: string[];
	avatarUrl?: string;
	createdAt?: string;
	updatedAt?: string;
	lastLoginAt?: string | null;
	isActive?: boolean;
}

export interface AuthUser {
	id: string;
	fullName: string;
	username: string;
	email?: string | null;
	role: UserRoleType;
	isOwner: boolean;
	permissions: string[];
}

export interface PermissionDto {
	id: string;
	code: string;
	name: string;
	module: string;
	description?: string | null;
}

export interface PermissionGroupDto {
	module: string;
	permissions: PermissionDto[];
}

export interface UserManagementItem {
	id: string;
	fullName: string;
	username: string;
	email?: string | null;
	role: UserRoleType;
	isActive: boolean;
	lastLoginAt?: string | null;
	createdAt: string;
	permissions: string[];
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
	setCurrentUser: (user: User | null) => void;
	setLoading: (loading: boolean) => void;
	setElectron: (isElectron: boolean) => void;
	setGlobalSearch: (query: string) => void;
}
