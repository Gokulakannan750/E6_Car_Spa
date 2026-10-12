import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
	// The gradient is reserved for the one main action on a screen.
	primary: 'bg-brand text-white shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:brightness-110',
	secondary: 'bg-surface-card text-text-primary border border-border-subtle hover:bg-surface-raised hover:text-text-heading',
	ghost: 'text-text-secondary hover:bg-surface-raised hover:text-text-heading',
	danger: 'bg-danger-strong/15 text-danger border border-danger-strong/40 hover:bg-danger-strong/25',
};

const sizes: Record<Size, string> = {
	sm: 'h-8 px-3 text-label gap-1.5',
	md: 'h-9 px-4 text-body gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
	icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ variant = 'secondary', size = 'md', loading = false, icon, children, className = '', disabled, type = 'button', ...rest },
	ref,
) {
	return (
		<button
			ref={ref}
			type={type}
			disabled={disabled || loading}
			className={`inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
			{...rest}
		>
			{loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
			{children}
		</button>
	);
});

export function IconButton({
	label,
	children,
	className = '',
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			className={`inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-heading disabled:opacity-50 ${className}`}
			{...rest}
		>
			{children}
		</button>
	);
}
