import { Bell, Search, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { User } from '../../types/app';

interface HeaderProps {
 pageTitle: string;
 breadcrumbs?: { label: string; href?: string }[];
 actions?: React.ReactNode;
 user?: User | null;
}

export function Header({ pageTitle, breadcrumbs, actions, user }: HeaderProps) {
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
 {!breadcrumbs?.length && (
 <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
 )}
 </div>

 {/* Right: Actions + User */}
 <div className="flex items-center gap-3">
 {actions && <div className="flex items-center gap-2">{actions}</div>}

 {/* Search */}
 <button
 className="sidebar-transition h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
 title="Search"
 >
 <Search className="h-4.5 w-4.5" />
 </button>

 {/* Notifications */}
 <button
 className="sidebar-transition h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 relative"
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
 {user.firstName[0]}{user.lastName[0]}
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