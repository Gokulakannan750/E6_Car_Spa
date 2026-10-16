import { ProductProvider, useProducts } from '@/features/products/ProductProvider';
import { Outlet } from 'react-router-dom';
import { BreadcrumbProvider } from './Breadcrumbs';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
	return (
		<ProductProvider>
			<BreadcrumbProvider>
				<div className="flex h-full overflow-hidden">
					<Sidebar />
					<div className="flex min-w-0 flex-1 flex-col">
						<TopBar />
						<main className="flex-1 overflow-y-auto">
							<div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6">
								<ProductOutlet />
							</div>
						</main>
					</div>
				</div>
			</BreadcrumbProvider>
		</ProductProvider>
	);
}

function ProductOutlet() {
	const { key } = useProducts();
	return (
		<div key={key ?? 'all'}>
			<Outlet />
		</div>
	);
}
