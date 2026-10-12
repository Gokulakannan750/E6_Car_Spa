import { Outlet } from 'react-router-dom';
import { BreadcrumbProvider } from './Breadcrumbs';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
	return (
		<BreadcrumbProvider>
			<div className="flex h-full overflow-hidden">
				<Sidebar />
				<div className="flex min-w-0 flex-1 flex-col">
					<TopBar />
					<main className="flex-1 overflow-y-auto">
						<div className="mx-auto w-full max-w-[1600px] px-6 py-6">
							<Outlet />
						</div>
					</main>
				</div>
			</div>
		</BreadcrumbProvider>
	);
}
