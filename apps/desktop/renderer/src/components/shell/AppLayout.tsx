import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../stores/app';
import { cn } from '../../utils/cn';

const ROUTE_TITLES: Record<string, string> = {
	'/dashboard': 'Dashboard',
	'/customers': 'Customers',
	'/job-cards': 'Job Cards',
	'/quotations-invoices': 'Quotations & Invoices',
	'/catalogue': 'Catalogue',
	'/staff-advances': 'Staff Advances',
	'/reports': 'Reports',
	'/showroom': 'Showroom',
	'/settings': 'Settings',
};

export function AppLayout() {
	const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
	const currentUser = useAppStore((s) => s.currentUser);
	const globalSearch = useAppStore((s) => s.globalSearch);
	const setGlobalSearch = useAppStore((s) => s.setGlobalSearch);
	const location = useLocation();
	const pageTitle = ROUTE_TITLES[location.pathname] || 'Dashboard';

	return (
		<div className="flex h-screen w-screen overflow-hidden bg-slate-50">
			<Sidebar collapsed={sidebarCollapsed} />

			<div
				className={cn('flex-1 flex flex-col min-w-0 transition-all duration-200')}
				style={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
			>
				<Header
					pageTitle={pageTitle}
					user={currentUser}
					searchQuery={globalSearch}
					onSearchChange={setGlobalSearch}
				/>
				<main className="flex-1 overflow-y-auto p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
