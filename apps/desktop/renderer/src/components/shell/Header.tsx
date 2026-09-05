import { useState, useCallback, useEffect } from 'react';
import { ChevronRight, X, LogOut, Shield, KeyRound, User as UserIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { User } from '../../types/app';
import { useAuth } from '../../features/auth/auth-context';
import { useBusinessProfile } from '../../features/settings/hooks/useBusinessProfile';

interface HeaderProps {
	pageTitle: string;
	breadcrumbs?: { label: string; href?: string }[];
	actions?: React.ReactNode;
	user?: User | null;
	searchQuery?: string;
	onSearchChange?: (query: string) => void;
}

export function Header({ pageTitle, breadcrumbs, actions, user, searchQuery = '', onSearchChange }: HeaderProps) {
	const { user: authUser, logout } = useAuth();
	const { profile, logoUrl, hasCustomLogo } = useBusinessProfile();
	const [imgError, setImgError] = useState(false);
	const [userMenuOpen, setUserMenuOpen] = useState(false);

	useEffect(() => {
		setImgError(false);
	}, [logoUrl]);

	const businessName = profile?.businessName || 'E6 Car Spa';
	const showImage = hasCustomLogo && !imgError;

	const handleClear = useCallback(() => {
		onSearchChange?.('');
	}, [onSearchChange]);

	const currentUser = authUser || user;

	const userInitials = currentUser?.fullName
		? currentUser.fullName
				.split(' ')
				.map((n) => n[0])
				.join('')
				.slice(0, 2)
				.toUpperCase()
		: currentUser?.username
		? currentUser.username.slice(0, 2).toUpperCase()
		: 'U';

	const getRoleIcon = (role?: string) => {
		switch (role) {
			case 'Owner':
				return <Shield className="w-3 h-3 text-purple-600" />;
			case 'Manager':
				return <KeyRound className="w-3 h-3 text-blue-600" />;
			default:
				return <UserIcon className="w-3 h-3 text-slate-500" />;
		}
	};

	return (
		<header
			className={cn(
				'h-16 bg-white border-b border-slate-200',
				'flex items-center justify-between px-6',
				'flex-shrink-0 relative z-30',
			)}
		>
			{/* Left: Company Branding & Title + Breadcrumbs */}
			<div className="flex items-center gap-3.5 min-w-0">
				<div className="flex items-center gap-2.5 pr-3.5 border-r border-slate-200">
					{showImage ? (
						<img
							src={logoUrl}
							alt={businessName}
							className="h-8 max-h-8 w-auto max-w-[130px] object-contain flex-shrink-0"
							onError={() => setImgError(true)}
						/>
					) : (
						<div className="h-8 w-8 rounded-lg bg-blue-600/10 text-blue-600 border border-blue-200/50 flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0">
							E6
						</div>
					)}
					<span className="font-bold text-sm text-slate-900 tracking-tight whitespace-nowrap">
						{businessName}
					</span>
				</div>

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
				{/* Show page title only when no breadcrumbs */}
				{(!breadcrumbs || breadcrumbs.length === 0) && (
					<h1 className="text-sm font-semibold text-slate-600">{pageTitle}</h1>
				)}
			</div>

			{/* Right: Search + Actions + User Profile */}
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
							placeholder="Search customers, vehicles, job cards..."
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

				{/* User Profile & Logout */}
				{currentUser && (
					<div className="relative pl-3 border-l border-slate-200">
						<button
							onClick={() => setUserMenuOpen(!userMenuOpen)}
							className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
						>
							<div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
								{userInitials}
							</div>
							<div className="hidden md:block text-left">
								<p className="text-xs font-semibold text-slate-800 leading-tight">
									{currentUser.fullName || currentUser.username}
								</p>
								<div className="flex items-center gap-1 text-[11px] text-slate-500 capitalize">
									{getRoleIcon(currentUser.role)}
									<span>{currentUser.role}</span>
								</div>
							</div>
						</button>

						{/* Dropdown Menu */}
						{userMenuOpen && (
							<>
								<div
									className="fixed inset-0 z-40"
									onClick={() => setUserMenuOpen(false)}
								/>
								<div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
									<div className="px-4 py-2 border-b border-slate-100">
										<p className="text-xs font-bold text-slate-900">
											{currentUser.fullName || currentUser.username}
										</p>
										{currentUser.email && (
											<p className="text-[11px] text-slate-400 truncate mt-0.5">
												{currentUser.email}
											</p>
										)}
										<div className="mt-1.5">
											<span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
												{currentUser.role}
											</span>
										</div>
									</div>

									<button
										onClick={() => {
											setUserMenuOpen(false);
											logout();
										}}
										className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
									>
										<LogOut className="w-4 h-4" />
										Sign Out
									</button>
								</div>
							</>
						)}
					</div>
				)}
			</div>
		</header>
	);
}