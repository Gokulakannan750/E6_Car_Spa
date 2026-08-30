import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	children: ReactNode;
	footer?: ReactNode;
	size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const sizes = {
	sm: 'max-w-sm',
	md: 'max-w-md',
	lg: 'max-w-lg',
	xl: 'max-w-xl',
	'2xl': 'max-w-2xl',
};

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md' }: DialogProps) {
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => onOpenChange(false)}>
			<div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
			<div
				className={cn(
					'relative bg-surface-container-lowest rounded-xl shadow-elevation-2 w-full animate-scale-in max-h-[85vh] flex flex-col border border-outline-variant/60',
					sizes[size]
				)}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/60">
					<div>
						<h2 className="text-base font-semibold text-on-surface">{title}</h2>
						{description && <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>}
					</div>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
					>
						<X className="w-4 h-4" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto px-5 py-3.5">{children}</div>
				{footer && (
					<div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-outline-variant/60 bg-surface-container-low/40 rounded-b-xl">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
