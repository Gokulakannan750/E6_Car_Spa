import { forwardRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 title: string;
 description?: string;
 children: ReactNode;
 footer?: ReactNode;
 size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md' }: DialogProps) {
 if (!open) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => onOpenChange(false)}>
 <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
 <div
 className={cn('relative bg-surface-container-lowest rounded-xl shadow-elevation-2 w-full mx-4 animate-scale-in max-h-[85vh] flex flex-col', sizes[size])}
 onClick={e => e.stopPropagation()}
 >
 <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
 <div>
 <h2 className="text-xl font-semibold text-headline-md text-on-surface">{title}</h2>
 {description && <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>}
 </div>
 <button onClick={() => onOpenChange(false)} className="p-1 rounded hover:bg-surface-container transition-colors">
 <X className="w-5 h-5 text-on-surface-variant" />
 </button>
 </div>
 <div className="flex-1 overflow-y-auto px-6 py-4">
 {children}
 </div>
 {footer && (
 <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-outline-variant bg-surface-container-low/50 rounded-b-xl">
 {footer}
 </div>
 )}
 </div>
 </div>
 );
}
