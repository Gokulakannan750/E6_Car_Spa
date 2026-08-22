import type { ReactNode } from 'react';

interface EmptyStateProps {
 icon?: ReactNode;
 title: string;
 description?: string;
 action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
 return (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 {icon && <div className="mb-4">{icon}</div>}
 <h3 className="text-base font-medium text-slate-900">{title}</h3>
 {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
 {action && <div className="mt-6">{action}</div>}
 </div>
 );
}
