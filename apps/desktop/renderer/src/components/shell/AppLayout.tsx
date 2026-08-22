import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../stores/app';
import { cn } from '../../utils/cn';

const pageConfig: Record<string, { title: string; breadcrumbs?: { label: string; href?: string }[] }> = {
	'/dashboard': { title: 'Dashboard', breadcrumbs: [] },
	'/customers': { title: 'Customers', breadcrumbs: [] },
	'/job-cards': { title: 'Job Cards', breadcrumbs: [] },
	'/job-cards/new': { title: 'Job Cards', breadcrumbs: [{ label: 'Job Cards', href: '/job-cards' }, { label: 'New' }] },
	'/job-cards/:id': { title: 'Job Cards', breadcrumbs: [{ label: 'Job Cards', href: '/job-cards' }] },
	'/invoices': { title: 'Invoices', breadcrumbs: [] },
	'/catalogue': { title: 'Catalogue', breadcrumbs: [] },
	'/staff-advances': { title: 'Staff Advances', breadcrumbs: [] },
	'/reports': { title: 'Reports', breadcrumbs: [] },
	'/showroom': { title: 'Showroom', breadcrumbs: [] },
	'/settings': { title: 'Settings', breadcrumbs: [] },
};

function matchRoute(pathname: string): { title: string; breadcrumbs?: { label: string; href?: string }[] } {
	if (pageConfig[pathname]) return pageConfig[pathname];
	for (const [pattern, config] of Object.entries(pageConfig)) {
		if (pattern.includes(':')) {
			const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
			if (regex.test(pathname)) return config;
		}
	}
	return { title: 'Car Spa Management' };
}

export function AppLayout() {
	const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
	const currentUser = useAppStore((s) => s.currentUser);
	const globalSearch = useAppStore((s) => s.globalSearch);
	const setGlobalSearch = useAppStore((s) => s.setGlobalSearch);
	const { title, breadcrumbs } = matchRoute(window.location.pathname);

	return (
		<div className="flex h-screen w-screen overflow-hidden bg-slate-50">
			<Sidebar collapsed={sidebarCollapsed} />

			<div
				className={cn('flex-1 flex flex-col min-w-0 transition-all duration-200')}
				style={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
			>
				<Header
					pageTitle={title}
					breadcrumbs={breadcrumbs}
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
