import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import {
	Workspace,
	WORKSPACE_TITLES,
	WORKSPACE_NAVIGATION,
	GLOBAL_AUDIT_ITEM,
	getWorkspaceFromPath,
	isItemActive,
	SIDEBAR_COLLAPSED_WIDTH,
	SIDEBAR_EXPANDED_WIDTH,
	ICON_MAP,
} from '../../constants/navigation';
import type { NavigationItem } from '../../types/app';
import { useAppStore } from '../../stores/app';
import { useAuth } from '../../features/auth/auth-context';
import { useBusinessProfile } from '../../features/settings/hooks/useBusinessProfile';

export function Sidebar({ collapsed }: { collapsed?: boolean } = {}) {
	const storeCollapsed = useAppStore((s) => s.sidebarCollapsed);
	const toggleSidebar = useAppStore((s) => s.toggleSidebar);
	const isCollapsed = collapsed !== undefined ? collapsed : storeCollapsed;

	const { user: authUser, hasPermission } = useAuth();
	const { profile, logoUrl, hasCustomLogo } = useBusinessProfile();
	const [imgError, setImgError] = useState(false);
	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		setImgError(false);
	}, [logoUrl]);

	const businessName = profile?.businessName || 'E6 Car Spa';
	const showImage = hasCustomLogo && !imgError;

	const currentWorkspace: Workspace = getWorkspaceFromPath(location.pathname);
	const workspaceTitle = WORKSPACE_TITLES[currentWorkspace] || 'Suite Launcher';
	const workspaceNavItems = WORKSPACE_NAVIGATION[currentWorkspace] || [];

	const handleAnchorClick = (e: React.MouseEvent, path: string) => {
		e.preventDefault();
		const [targetPath, hash] = path.split('#');
		if (
			location.pathname === targetPath ||
			(targetPath === '/dashboard' && (location.pathname === '/' || location.pathname === '/dashboard'))
		) {
			const el = document.getElementById(hash);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth' });
				return;
			}
		}
		navigate(path);
	};

	const renderNavItem = (item: NavigationItem, isGlobal = false) => {
		if (item.requiresPermission && !hasPermission(item.requiresPermission)) {
			return null;
		}

		const Icon = ICON_MAP[item.icon];
		if (!Icon) return null;

		const active = isItemActive(item, location.pathname, location.search, location.hash);

		if (item.anchor) {
			return (
				<button
					key={item.path}
					type="button"
					onClick={(e) => handleAnchorClick(e, item.path)}
					className={cn(
						'sidebar-transition w-[calc(100%-16px)] flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mx-2 transition-all cursor-pointer text-left',
						active
							? 'bg-[#831821] text-white font-semibold shadow-sm border border-red-500/30'
							: 'text-red-100/70 hover:text-white hover:bg-white/10'
					)}
					title={isCollapsed ? item.label : undefined}
				>
					<Icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-red-300' : 'text-red-200/60')} />
					{!isCollapsed && <span className="sidebar-transition truncate">{item.label}</span>}
				</button>
			);
		}

		return (
			<NavLink
				key={item.path}
				to={item.path}
				className={cn(
					'sidebar-transition flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mx-2 transition-all',
					active
						? 'bg-[#831821] text-white font-semibold shadow-sm border border-red-500/30'
						: 'text-red-100/70 hover:text-white hover:bg-white/10'
				)}
				title={isCollapsed ? item.label : undefined}
			>
				<Icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-red-300' : 'text-red-200/60')} />
				{!isCollapsed && <span className="sidebar-transition truncate">{item.label}</span>}
			</NavLink>
		);
	};

	const userInitials = authUser?.fullName
		? authUser.fullName
				.split(' ')
				.map((n) => n[0])
				.join('')
				.slice(0, 2)
				.toUpperCase()
		: 'U';

	return (
		<aside
			className="h-screen flex flex-col bg-gradient-to-br from-red-900 via-black to-red-950 border-r border-white/10 fixed left-0 top-0 z-40 sidebar-transition shadow-2xl"
			style={{
				width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
			}}
		>
			{/* Logo / Brand */}
			<div className={cn('flex items-center h-16 border-b border-white/10 shrink-0', isCollapsed ? 'justify-center' : 'px-4')}>
				{!isCollapsed ? (
					<div className="flex items-center gap-3 min-w-0 flex-1">
						{showImage ? (
							<img
								src={logoUrl}
								alt={businessName}
								className="h-8 max-h-8 w-auto max-w-[96px] object-contain flex-shrink-0"
								onError={() => setImgError(true)}
							/>
						) : (
							<div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-950/50">
								<span className="text-white font-bold text-xs">E6</span>
							</div>
						)}
						<div className="sidebar-transition overflow-hidden min-w-0 flex-1">
							<span className="text-white font-semibold text-sm truncate block leading-tight">{businessName}</span>
							<span className="text-red-200/70 text-[11px] font-medium tracking-tight block mt-0.5 whitespace-nowrap pr-1">Management Suite</span>
						</div>
					</div>
				) : showImage ? (
					<img
						src={logoUrl}
						alt={businessName}
						className="h-8 max-h-8 w-auto max-w-[56px] object-contain flex-shrink-0"
						onError={() => setImgError(true)}
					/>
				) : (
					<div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-950/50">
						<span className="text-white font-bold text-xs">E6</span>
					</div>
				)}
			</div>

			{/* Workspace Indicator Pill */}
			{!isCollapsed && (
				<div className="px-3 py-2 border-b border-white/10 bg-black/20 flex items-center justify-between shrink-0">
					<div className="flex items-center gap-2 min-w-0">
						<span
							className={cn(
								'h-2 w-2 rounded-full shrink-0',
								currentWorkspace === 'launcher' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'
							)}
						/>
						<span className="text-xs font-bold text-white tracking-wide truncate">
							{workspaceTitle}
						</span>
					</div>
					<span
						className={cn(
							'text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded border',
							currentWorkspace === 'launcher'
								? 'text-emerald-300/80 bg-emerald-500/10 border-emerald-500/20'
								: 'text-red-300/80 bg-red-500/10 border-red-500/20'
						)}
					>
						{currentWorkspace === 'launcher' ? 'Home' : 'App'}
					</span>
				</div>
			)}

			{/* Workspace Navigation */}
			<nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-1">
				{workspaceNavItems.map((item) => renderNavItem(item))}

				{/* Global Utility: Audit Trail */}
				<div className="border-t border-white/10 pt-2 my-2 space-y-1">
					{!isCollapsed && (
						<div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-300/40">
							Global
						</div>
					)}
					{renderNavItem(GLOBAL_AUDIT_ITEM, true)}
				</div>
			</nav>

			{/* Collapse Toggle */}
			<div className={cn('border-t border-white/10 py-2 shrink-0', isCollapsed ? 'flex justify-center px-2' : 'px-2')}>
				<button
					onClick={toggleSidebar}
					className={cn(
						'sidebar-transition flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-200/70 hover:text-white hover:bg-white/10 cursor-pointer',
						isCollapsed ? 'justify-center' : 'w-full'
					)}
					title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					{isCollapsed ? (
						<ChevronRight className="h-4 w-4" />
					) : (
						<>
							<ChevronLeft className="h-4 w-4 flex-shrink-0" />
							<span className="sidebar-transition truncate">Collapse</span>
						</>
					)}
				</button>
			</div>

			{/* User Profile at Bottom */}
			{authUser && (
				<div className={cn('border-t border-white/10 p-3 shrink-0', 'flex items-center gap-3')}>
					<div className="h-8 w-8 rounded-full bg-gradient-to-tr from-red-600 to-red-900 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-md shadow-red-950/50">
						{userInitials}
					</div>
					{!isCollapsed && (
						<div className="sidebar-transition overflow-hidden whitespace-nowrap min-w-0">
							<p className="text-white text-sm font-medium truncate">
								{authUser.fullName}
							</p>
							<p className="text-red-200/60 text-xs truncate capitalize">
								{authUser.role}
							</p>
						</div>
					)}
				</div>
			)}
		</aside>
	);
}