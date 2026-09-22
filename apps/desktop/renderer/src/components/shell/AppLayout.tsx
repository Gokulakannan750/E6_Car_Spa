import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../stores/app';
import { cn } from '../../utils/cn';
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from '../../constants/navigation';

export const ROUTE_TITLES: Record<string, string> = {
	'/': 'Dashboard',
	'/dashboard': 'Dashboard',
	'/customers': 'Customers',
	'/job-cards': 'Job Cards',
	'/invoices': 'Invoices',
	'/payments': 'Payments',
	'/catalogue': 'Catalogue',
	'/staff': 'Staff Directory',
	'/staff-advances': 'Staff Advances',
	'/staff-attendance': 'Staff Attendance',
	'/attendance': 'Staff Attendance',
	'/staff-salary': 'Staff Salary',
	'/salary': 'Staff Salary',
	'/reports': 'Reports',
	'/showroom': 'Showroom',
	'/audit': 'Audit Trail',
	'/settings/users': 'Users & Access',
	'/settings': 'Settings',
};

export function getPageTitle(pathname: string): string {
	if (pathname.startsWith('/invoices')) return 'Invoices';
	if (pathname.startsWith('/payments')) return 'Payments';
	if (pathname.startsWith('/job-cards')) return 'Job Cards';
	if (pathname.startsWith('/customers')) return 'Customers';
	if (pathname.startsWith('/audit')) return 'Audit Trail';
	if (pathname.startsWith('/settings/users')) return 'Users & Access';
	if (pathname.startsWith('/settings')) return 'Settings';
	if (pathname.startsWith('/reports')) return 'Reports';
	if (pathname.startsWith('/showroom')) return 'Showroom';
	if (pathname.startsWith('/staff-advances')) return 'Staff Advances';
	if (pathname.startsWith('/staff-attendance') || pathname.startsWith('/attendance')) return 'Staff Attendance';
	if (pathname.startsWith('/staff-salary') || pathname.startsWith('/salary')) return 'Staff Salary';
	if (pathname.startsWith('/staff')) return 'Staff Directory';
	if (pathname.startsWith('/catalogue')) return 'Catalogue';
	return ROUTE_TITLES[pathname] || 'Dashboard';
}

export function AppLayout() {
	const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
	const currentUser = useAppStore((s) => s.currentUser);
	const globalSearch = useAppStore((s) => s.globalSearch);
	const setGlobalSearch = useAppStore((s) => s.setGlobalSearch);
	const location = useLocation();
	const pageTitle = getPageTitle(location.pathname);

	return (
		<div className="flex h-screen w-screen overflow-hidden bg-slate-50">
			<Sidebar collapsed={sidebarCollapsed} />

			<div
				className={cn('flex-1 flex flex-col min-w-0 transition-all duration-200')}
				style={{ marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
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
