import { create } from 'zustand';
import type { AppState, AppActions } from '../types/app';

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>((set) => ({
	sidebarCollapsed: false,
	settings: null,
	currentUser: null,
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
