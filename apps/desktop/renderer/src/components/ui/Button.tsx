import { forwardRef, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

const base = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

const variants = {
 primary: `${base} bg-secondary text-white hover:bg-secondary/90 shadow-sm active:scale-[0.98]`,
 secondary: `${base} bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high active:scale-[0.98]`,
 danger: `${base} bg-error text-white hover:bg-error/90 shadow-sm active:scale-[0.98]`,
 ghost: `${base} text-on-surface-variant hover:bg-surface-container-low active:scale-[0.98]`,
};

const sizes = {
 sm: 'px-3 py-1.5 text-xs',
 md: 'px-4 py-2 text-sm',
 lg: 'px-5 py-2.5 text-sm',
};

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: Variant;
 size?: Size;
 loading?: boolean;
 icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
 ({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }, ref) => {
 return (
 <button ref={ref} disabled={disabled || loading} className={cn(variants[variant], sizes[size], className)} {...props}>
 {loading && <Loader2 className="w-4 h-4 animate-spin" />}
 {!loading && icon}
 {children}
 </button>
 );
 }
);
Button.displayName = 'Button';
