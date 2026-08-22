import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface BreadcrumbItem {
 label: string;
 to?: string;
}

interface PageHeaderProps {
 title: string;
 description?: string;
 breadcrumb?: BreadcrumbItem[];
 actions?: ReactNode;
}

export function PageHeader({ title, description, breadcrumb, actions }: PageHeaderProps) {
 return (
 <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
 <div className="space-y-0.5">
 {breadcrumb && breadcrumb.length > 0 && (
 <nav className="flex items-center gap-1.5 text-xs text-slate-400">
 {breadcrumb.map((item, index) => (
 <span key={index} className="flex items-center gap-1.5">
 {index > 0 && <ChevronRight className="h-3 w-3" />}
 {item.to ? (
 <Link to={item.to} className="hover:text-slate-600 transition-colors">
 {item.label}
 </Link>
 ) : (
 <span className="text-slate-600">{item.label}</span>
 )}
 </span>
 ))}
 </nav>
 )}
 <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
 {description && <p className="text-sm text-slate-500">{description}</p>}
 </div>
 {actions && <div className="flex items-center gap-2">{actions}</div>}
 </div>
 );
}
