import type { LucideIcon } from 'lucide-react';

interface ChartCardProps {
 title: string;
 subtitle?: string;
 icon?: LucideIcon;
 children: React.ReactNode;
 className?: string;
 action?: React.ReactNode;
}

export function ChartCard({ title, subtitle, icon: Icon, children, className }: ChartCardProps) {
 return (
 <div className={`app-card p-5 ${className ?? ''}`}>
 <div className="flex items-center justify-between mb-5">
 <div>
 <h2 className="text-[15px] font-semibold text-on-surface">{title}</h2>
 {subtitle && (
 <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>
 )}
 </div>
 {Icon && (
 <div className="h-9 w-9 rounded-lg bg-secondary/10 flex items-center justify-center">
 <Icon className="h-[18px] w-[18px] text-secondary" />
 </div>
 )}
 </div>
 <div className="w-full" style={{ minHeight: 240 }}>
 {children}
 </div>
 </div>
 );
}
