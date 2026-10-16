import { NavLink } from 'react-router-dom';
import { Building2, FileText, History, LayoutDashboard, LogOut, Server, Tags, UserCircle, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { useAuth, OWNER_ROLES } from '@/features/auth/AuthProvider';
import type { AdminRole } from '@/lib/types';

interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
	roles?: AdminRole[];
}

const NAV: NavItem[] = [
	{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
	{ to: '/companies', label: 'Companies', icon: Building2 },
	{ to: '/signups', label: 'Sign-ups', icon: UserPlus },
	{ to: '/invoices', label: 'Invoices', icon: FileText },
	{ to: '/plans', label: 'Plans & Prices', icon: Tags },
	{ to: '/audit-log', label: 'Audit Log', icon: History, roles: OWNER_ROLES },
	{ to: '/admins', label: 'Admins', icon: Users, roles: OWNER_ROLES },
	{ to: '/system', label: 'System', icon: Server, roles: OWNER_ROLES },
];

function itemClass({ isActive }: { isActive: boolean }) {
	return `relative flex h-9 items-center gap-3 rounded-md px-3 text-body transition-colors ${
		isActive
			? 'bg-surface-raised font-medium text-text-heading before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand'
			: 'text-text-secondary hover:bg-surface-raised/60 hover:text-text-heading'
	}`;
}

export function Sidebar() {
	const { session, signOut } = useAuth();
	const role = session?.admin.role;
	const items = NAV.filter((item) => !item.roles || (role && item.roles.includes(role)));

	return (
		<aside className="no-print flex w-14 sm:w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-alt">
			<div className="flex h-16 items-center gap-3 border-b border-border-subtle px-3 sm:px-4">
				<img src="/trovo-logo.webp" alt="" className="size-8 rounded-md" />
				<div className="hidden sm:block leading-tight">
					<div className="text-body font-semibold text-text-heading">Trovo Platform</div>
					<div className="text-micro font-medium tracking-wider text-text-muted uppercase">Admin console</div>
				</div>
			</div>
			<nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1 sm:p-3">
				{items.map(({ to, label, icon: Icon }) => (
					<NavLink key={to} to={to} className={itemClass} aria-label={label} title={label}>
						<Icon className="size-4 shrink-0" aria-hidden />
						<span className="hidden sm:inline">{label}</span>
					</NavLink>
				))}
			</nav>
			<div className="flex flex-col gap-0.5 border-t border-border-subtle p-1 sm:p-3">
				<NavLink to="/account" className={itemClass} aria-label="My account" title="My account">
					<UserCircle className="size-4 shrink-0" aria-hidden />
					<span className="hidden sm:inline">My account</span>
				</NavLink>
				<button
					type="button"
					aria-label="Sign out"
					title="Sign out"
					onClick={() => signOut()}
					className="flex h-9 items-center gap-3 rounded-md px-3 text-body text-danger transition-colors hover:bg-danger-strong/10"
				>
					<LogOut className="size-4 shrink-0" aria-hidden />
					<span className="hidden sm:inline">Sign out</span>
				</button>
			</div>
		</aside>
	);
}
