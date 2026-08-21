import { useState, useContext, createContext, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { navItems, footerNavItems, type NavItem } from './types';

interface SidebarContextValue {
 isExpanded: boolean;
 toggle: () => void;
}

export const SidebarContext = createContext<SidebarContextValue>({
 isExpanded: true,
 toggle: () => {},
});

export function useSidebar(): SidebarContextValue {
 return useContext(SidebarContext);
}

function SidebarNav({ items }: { items: NavItem[] }) {
 const { isExpanded } = useSidebar();

 return (
 <nav className="flex-1 overflow-y-auto px-3 py-2">
 <ul className="flex flex-col gap-0.5">
 {items.map(item => (
 <li key={item.path}>
 <NavLink
 to={item.path}
 className={({ isActive }) =>
 `sidebar-item ${isActive ? 'active' : 'text-on-primary-container opacity-70'}`
 }
 title={!isExpanded ? item.label : undefined}
 >
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
 {item.icon}
 </span>
 {isExpanded && <span className="text-xs font-medium leading-tight">{item.label}</span>}
 </NavLink>
 </li>
 ))}
 </ul>
 </nav>
 );
}

export default function Sidebar({ children }: { children?: ReactNode }) {
 const [isExpanded, setIsExpanded] = useState(true);

 return (
 <SidebarContext.Provider value={{ isExpanded, toggle: () => setIsExpanded(e => !e) }}>
 <aside
 className={`h-screen bg-primary-container border-r border-outline-variant flex-col transition-all duration-300 overflow-hidden
 ${isExpanded ? 'w-64' : 'w-20'}`}
 >
 {/* Brand Header */}
 <div className="h-16 flex items-center gap-3 px-4 border-b border-outline-variant flex-shrink-0">
 <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0 shadow-sm">
 <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>
 directions_car
 </span>
 </div>
 {isExpanded && (
 <div className="overflow-hidden whitespace-nowrap">
 <h1 className="text-sm text-headline-sm font-bold text-on-primary-container tracking-tight">
 CAR SPA
 </h1>
 <p className="font-label-sm text-label-sm text-on-primary-container opacity-70 mt-0.5 uppercase">
 Management Suite
 </p>
 </div>
 )}
 </div>

 {/* Main Navigation */}
 <SidebarNav items={navItems} />

 {/* Footer: Settings + Profile */}
 <div className="mt-auto w-full flex flex-col gap-0.5 pt-3 border-t border-outline-variant pb-2">
 <SidebarNav items={footerNavItems} />
 {isExpanded && (
 <div className="px-4 py-2">
 <p className="text-[10px] text-on-primary-container opacity-50 uppercase tracking-widest text-center">
 Car Spa v1.0
 </p>
 </div>
 )}
 </div>
 </aside>
 {children}
 </SidebarContext.Provider>
 );
}
