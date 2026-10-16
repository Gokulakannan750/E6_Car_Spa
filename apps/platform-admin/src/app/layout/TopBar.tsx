import { ProductSelector } from '@/features/products/ProductProvider';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { RoleBadge } from '@/components/StatusBadge';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCrumbs } from './Breadcrumbs';

export function TopBar() {
	const { session } = useAuth();
	const crumbs = useCrumbs();
	const navigate = useNavigate();
	const [search, setSearch] = useState('');

	function submit(event: FormEvent) {
		event.preventDefault();
		const text = search.trim();
		navigate(text ? `/companies?search=${encodeURIComponent(text)}` : '/companies');
		setSearch('');
	}

	const admin = session?.admin;
	const initials = (admin?.name || admin?.email || '?')
		.split(/[\s@.]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]!.toUpperCase())
		.join('');

	return (
		<header className="no-print flex h-16 shrink-0 items-center gap-2 border-b border-border-subtle bg-canvas/80 px-3 sm:px-6 backdrop-blur">
			<nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-body">
				{crumbs.map((crumb, index) => {
					const last = index === crumbs.length - 1;
					return (
						<span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
							{index > 0 && <ChevronRight className="size-3.5 shrink-0 text-text-muted" aria-hidden />}
							{crumb.to && !last ? (
								<Link to={crumb.to} className="truncate text-text-muted hover:text-text-heading">
									{crumb.label}
								</Link>
							) : (
								<span className={`truncate ${last ? 'font-medium text-text-heading' : 'text-text-muted'}`} aria-current={last ? 'page' : undefined}>
									{crumb.label}
								</span>
							)}
						</span>
					);
				})}
			</nav>

			<ProductSelector />
			<form role="search" onSubmit={submit} className="relative hidden w-72 md:block">
				<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
				<input
					type="search"
					aria-label="Search companies"
					placeholder="Search company code or name…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="h-9 w-full rounded-md border border-border-subtle bg-surface-alt pr-3 pl-9 text-body text-text-heading placeholder:text-text-muted focus:border-action focus:ring-1 focus:ring-action focus:outline-none"
				/>
			</form>

			{admin && (
				<Link to="/account" className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-surface-raised">
					<span className="flex size-8 items-center justify-center rounded-full bg-surface-container text-label font-semibold text-text-heading">{initials}</span>
					<span className="hidden text-right leading-tight lg:block">
						<span className="block text-body font-medium text-text-heading">{admin.name || admin.email}</span>
						<span className="block text-micro text-text-muted">{admin.email}</span>
					</span>
					<span className="hidden sm:inline">
						<RoleBadge role={admin.role} />
					</span>
				</Link>
			)}
		</header>
	);
}
