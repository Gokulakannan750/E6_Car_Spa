import { create } from 'zustand';

import type { AppState, AppActions, User } from '../types/app';
import { UserRole } from '../types/app';

const mockUser: User = {
	id: '1',
	email: 'admin@carspa.com',
	firstName: 'Admin',
	lastName: 'User',
	role: UserRole.ADMIN,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>((set) => ({
	sidebarCollapsed: false,
	settings: null,
	currentUser: mockUser,
	isLoading: false,
	isElectron: typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).electron,
	globalSearch: '',

	toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
	setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
	setSettings: (settings) => set({ settings }),
	setCurrentUser: (currentUser) => set({ currentUser }),
	setLoading: (isLoading) => set({ isLoading }),
	setElectron: (isElectron) => set({ isElectron }),
	setGlobalSearch: (globalSearch) => set({ globalSearch }),
}));
