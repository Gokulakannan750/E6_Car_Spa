import { useCallback } from 'react';
import { Bell, ChevronRight, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { User } from '../../types/app';

interface HeaderProps {
	pageTitle: string;
	breadcrumbs?: { label: string; href?: string }[];
	actions?: React.ReactNode;
	user?: User | null;
	searchQuery?: string;
	onSearchChange?: (query: string) => void;
}

export function Header({ pageTitle, breadcrumbs, actions, user, searchQuery = '', onSearchChange }: HeaderProps) {
	const handleClear = useCallback(() => {
		onSearchChange?.('');
	}, [onSearchChange]);

	return (
		<header
			className={cn(
				'h-16 bg-white border-b border-slate-200',
				'flex items-center justify-between px-6',
				'flex-shrink-0',
			)}
		>
			{/* Left: Title + Breadcrumbs */}
			<div className="flex items-center gap-3 min-w-0">
				{breadcrumbs && breadcrumbs.length > 0 && (
					<nav className="flex items-center gap-1.5 text-sm">
						{breadcrumbs.map((crumb, index) => (
							<span key={index} className="flex items-center gap-1.5">
								{index > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
								{crumb.href ? (
									<a
										href={crumb.href}
										className="text-slate-500 hover:text-slate-700 transition-colors"
									>
										{crumb.label}
									</a>
								) : (
									<span className="text-slate-900 font-medium">{crumb.label}</span>
								)}
							</span>
						))}
					</nav>
				)}
				{/* Company name - always shown in header */}
				<h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
			</div>

			{/* Right: Search + Actions + User */}
			<div className="flex items-center gap-2">
				{/* Search input */}
				<div className="hidden md:flex items-center">
					<div className="flex items-center bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 w-72 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
						<svg className="h-4 w-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<input
							type="text"
							className="bg-transparent border-none outline-none text-sm w-full p-0 text-slate-900 placeholder:text-slate-400"
							placeholder="Search customers, vehicles, job cards, registration number..."
							value={searchQuery}
							onChange={(e) => onSearchChange?.(e.target.value)}
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={handleClear}
								className="ml-1 text-slate-400 hover:text-slate-600"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
				</div>

				{actions && <div className="flex items-center gap-2">{actions}</div>}

				{/* Notifications */}
				<button
					className={cn(
						'sidebar-transition h-9 w-9 flex items-center justify-center rounded-lg',
						'text-slate-400 hover:text-slate-600 hover:bg-slate-100 relative',
					)}
					title="Notifications"
				>
					<Bell className="h-4.5 w-4.5" />
					<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
				</button>

				{/* User */}
				{user && (
					<div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
						<div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
							<span className="text-white text-xs font-medium">
								{user.firstName[0]}
								{user.lastName[0]}
							</span>
						</div>
						<div className="hidden md:block">
							<p className="text-sm font-medium text-slate-700">
								{user.firstName} {user.lastName}
							</p>
						</div>
					</div>
				)}
			</div>
		</header>
	);
}