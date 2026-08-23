import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../features/dashboard/Sidebar';

const PAGE_TITLES: Record<string, string> = {
	'/': 'Dashboard',
	'/dashboard': 'Dashboard',
	'/customers': 'Customers',
	'/job-cards': 'Job Cards',
	'/job-cards/new': 'Job Cards',
	'/job-cards/:id': 'Job Cards',
	'/invoices': 'Invoices',
	'/catalogue': 'Catalogue',
	'/staff-advances': 'Staff Advances',
	'/reports': 'Reports',
	'/showroom': 'Showroom',
	'/settings': 'Settings',
};

export default function Shell() {
	return (
		<div className="flex h-screen overflow-hidden bg-background">
			<Sidebar />
			<div className="flex-1 flex flex-col min-w-0 ml-0">
				<GlobalHeader />
				<main className="flex-1 overflow-y-auto p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}

function GlobalHeader() {
	const location = useLocation();
	const title = PAGE_TITLES[location.pathname] || 'Dashboard';
	return (
		<header className="h-16 bg-surface border-b border-outline-variant shadow-sm flex items-center justify-between px-6 shrink-0">
			<div className="flex items-center gap-3.5">
				<div className="flex items-center gap-2.5 pr-3.5 border-r border-outline-variant">
					<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs">
						E6
					</div>
					<span className="font-bold text-sm text-on-surface tracking-tight whitespace-nowrap">
						E6 Car Spa
					</span>
				</div>
				<h2 className="text-base font-semibold tracking-tight text-on-surface uppercase">{title}</h2>
			</div>
		</header>
	);
}
