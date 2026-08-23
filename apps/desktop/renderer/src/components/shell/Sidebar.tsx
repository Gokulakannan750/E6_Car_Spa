import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { NAVIGATION_ITEMS, BOTTOM_NAVIGATION_ITEMS, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH, ICON_MAP } from '../../constants/navigation';
import { useAppStore } from '../../stores/app';
import type { UserRole } from '../../types/app';

const roleLabels: Record<UserRole, string> = {
 admin: 'Administrator',
 manager: 'Manager',
 cashier: 'Cashier',
 staff: 'Staff',
};

interface SidebarProps {
 collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
 const { toggleSidebar, currentUser } = useAppStore();

 const renderNavItem = (item: (typeof NAVIGATION_ITEMS)[number]) => {
 const Icon = ICON_MAP[item.icon];
 if (!Icon) return null;

 return (
 <NavLink
 key={item.path}
 to={item.path}
 className={({ isActive }) =>
 cn(
 'sidebar-transition flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mx-2',
 'text-slate-400 hover:text-white hover:bg-white/5',
 {
 'bg-white/10 text-white': isActive,
 },
 )
 }
 title={collapsed ? item.label : undefined}
 >
 {({ isActive }) => (
 <>
 <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-blue-400')} />
 {!collapsed && <span className="sidebar-transition truncate">{item.label}</span>}
 </>
 )}
 </NavLink>
 );
 };

 const renderBottomNavItem = (item: (typeof BOTTOM_NAVIGATION_ITEMS)[number]) => {
 const Icon = ICON_MAP[item.icon];
 if (!Icon) return null;

 return (
 <NavLink
 key={item.path}
 to={item.path}
 className={({ isActive }) =>
 cn(
 'sidebar-transition flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mx-2',
 'text-slate-400 hover:text-white hover:bg-white/5',
 {
 'bg-white/10 text-white': isActive,
 },
 )
 }
 title={collapsed ? item.label : undefined}
 >
 {({ isActive }) => (
 <>
 <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-blue-400')} />
 {!collapsed && <span className="sidebar-transition truncate">{item.label}</span>}
 </>
 )}
 </NavLink>
 );
 };

 return (
 <aside
 className="h-screen flex flex-col bg-[#0b1228] border-r border-white/8 fixed left-0 top-0 z-40 sidebar-transition"
 style={{
 width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
 }}
 >
 {/* Logo / Brand */}
 <div className={cn('flex items-center h-16 border-b border-white/8', collapsed ? 'justify-center' : 'px-4')}>
 {!collapsed ? (
 <div className="flex items-center gap-2.5 min-w-0">
 <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
 <span className="text-white font-bold text-xs">E6</span>
 </div>
 <div className="sidebar-transition overflow-hidden whitespace-nowrap">
 <span className="text-white font-semibold text-sm">E6 Car Spa</span>
 <span className="text-slate-400 text-xs block -mt-0.5">Management</span>
 </div>
 </div>
 ) : (
 <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
 <span className="text-white font-bold text-xs">E6</span>
 </div>
 )}
 </div>

 {/* Main Navigation */}
 <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1">
 {NAVIGATION_ITEMS.map(renderNavItem)}
 </nav>

 {/* Collapse Toggle */}
 <div className={cn('border-t border-white/8 py-2', collapsed ? 'flex justify-center px-2' : 'px-2')}>
 <button
 onClick={toggleSidebar}
 className={cn(
 'sidebar-transition flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5',
 collapsed ? 'justify-center' : 'w-full',
 )}
 title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
 >
 {collapsed ? (
 <ChevronRight className="h-4 w-4" />
 ) : (
 <>
 <ChevronLeft className="h-4 w-4 flex-shrink-0" />
 <span className="sidebar-transition truncate">Collapse</span>
 </>
 )}
 </button>
 </div>

 {/* Bottom Navigation */}
 <div className="border-t border-white/8 py-2 space-y-1">
 {BOTTOM_NAVIGATION_ITEMS.map(renderBottomNavItem)}
 </div>

 {/* User info at bottom */}
 {currentUser && (
 <div className={cn('border-t border-white/8 p-3', 'flex items-center gap-3')}>
 <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
 <span className="text-white text-xs font-medium">
 {currentUser.firstName[0]}{currentUser.lastName[0]}
 </span>
 </div>
 {!collapsed && (
 <div className="sidebar-transition overflow-hidden whitespace-nowrap min-w-0">
 <p className="text-white text-sm font-medium truncate">
 {currentUser.firstName} {currentUser.lastName}
 </p>
 <p className="text-slate-400 text-xs truncate">
 {roleLabels[currentUser.role] || currentUser.role}
 </p>
 </div>
 )}
 </div>
 )}
 </aside>
 );
}