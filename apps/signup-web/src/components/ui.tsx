import { forwardRef, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { AlertCircle, Check, Copy, Info, Loader2, Minus, Plus } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost';

const variants: Record<Variant, string> = {
	primary: 'bg-brand text-white shadow-[0_8px_24px_rgba(45,107,255,0.3)] hover:brightness-110',
	secondary: 'border border-border-subtle bg-surface-card text-text-heading hover:bg-surface-raised',
	ghost: 'text-text-secondary hover:text-text-heading',
};

export function Button({
	variant = 'secondary',
	loading,
	icon,
	className = '',
	children,
	type = 'button',
	disabled,
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; icon?: ReactNode }) {
	return (
		<button
			type={type}
			disabled={disabled || loading}
			className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-body font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
			{...rest}
		>
			{loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
			{children}
			{!loading && icon}
		</button>
	);
}

function Message({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
	if (error) {
		return (
			<p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-label text-danger">
				<AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
			</p>
		);
	}
	return hint ? (
		<p id={id} className="mt-1.5 flex items-center gap-1.5 text-label text-text-muted">
			<Info className="size-3.5 shrink-0" aria-hidden /> {hint}
		</p>
	) : null;
}

const control =
	'w-full rounded-md border bg-surface-alt text-body text-text-heading placeholder:text-text-muted focus:border-action focus:ring-1 focus:ring-action focus:outline-none';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode; required?: boolean; prefix?: ReactNode; optional?: boolean };

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField({ label, error, hint, prefix, optional, className = '', ...rest }, ref) {
	const id = useId();
	return (
		<div>
			<label htmlFor={id} className="mb-1.5 block text-body font-medium text-text-heading">
				{label}
				{rest.required && <span className="ml-0.5 text-danger" aria-hidden> *</span>}
				{optional && <span className="ml-1 text-label font-normal text-text-muted">(optional)</span>}
			</label>
			<div className="relative flex">
				{prefix && (
					<span className="flex items-center rounded-l-md border border-r-0 border-border-subtle bg-surface-alt px-3 text-body text-text-secondary">{prefix}</span>
				)}
				<input
					ref={ref}
					id={id}
					aria-invalid={error ? true : undefined}
					aria-describedby={error || hint ? `${id}-msg` : undefined}
					className={`${control} h-12 px-4 ${prefix ? 'rounded-l-none' : ''} ${error ? 'border-danger' : 'border-border-subtle'} ${className}`}
					{...rest}
				/>
			</div>
			<Message id={`${id}-msg`} error={error} hint={hint} />
		</div>
	);
});

export function SelectField({ label, error, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
	const id = useId();
	return (
		<div>
			<label htmlFor={id} className="mb-1.5 block text-body font-medium text-text-heading">
				{label}
				{rest.required && <span className="ml-0.5 text-danger" aria-hidden> *</span>}
			</label>
			<select
				id={id}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? `${id}-msg` : undefined}
				className={`${control} h-12 px-4 ${error ? 'border-danger' : 'border-border-subtle'}`}
				{...rest}
			>
				{children}
			</select>
			<Message id={`${id}-msg`} error={error} />
		</div>
	);
}

export function Quantity({ label, value, onChange, min = 0, max = 500 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
	return (
		<div className="flex items-center gap-1 rounded-md border border-border-subtle bg-canvas p-1">
			<button
				type="button"
				aria-label={`Fewer ${label}`}
				disabled={value <= min}
				onClick={() => onChange(value - 1)}
				className="inline-flex size-9 items-center justify-center rounded text-text-secondary hover:bg-surface-raised hover:text-text-heading disabled:opacity-30"
			>
				<Minus className="size-4" />
			</button>
			<input
				aria-label={label}
				inputMode="numeric"
				value={value}
				onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value.replace(/\D/g, '') || '0'))))}
				className="tabular h-9 w-12 bg-transparent text-center text-body font-semibold text-text-heading focus:outline-none"
			/>
			<button
				type="button"
				aria-label={`More ${label}`}
				disabled={value >= max}
				onClick={() => onChange(value + 1)}
				className="inline-flex size-9 items-center justify-center rounded text-text-secondary hover:bg-surface-raised hover:text-text-heading disabled:opacity-30"
			>
				<Plus className="size-4" />
			</button>
		</div>
	);
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
	return <section className={`rounded-lg border border-border-subtle bg-surface-card ${className}`}>{children}</section>;
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success' | 'warning'; children: ReactNode }) {
	const tones = {
		error: 'border-danger-strong/40 bg-danger-strong/10 text-text-primary',
		info: 'border-action/40 bg-action/10 text-text-primary',
		success: 'border-active/30 bg-active-bg text-text-primary',
		warning: 'border-pastdue/40 bg-pastdue-bg text-text-primary',
	};
	return (
		<div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-4 py-3 text-body ${tones[tone]}`}>
			{children}
		</div>
	);
}

/** A code shown once (company code, registration code): big, monospaced, with a copy button. */
export function CodeBox({ label, value, note }: { label: string; value: string; note?: string }) {
	const [copied, setCopied] = useState(false);
	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			// The value is selectable; copying by hand still works.
		}
	}
	return (
		<div className="rounded-lg border border-border-subtle bg-canvas p-4">
			<div className="flex items-center justify-between gap-2 text-micro font-semibold tracking-wider text-text-muted uppercase">
				<span>{label}</span>
				{note && <span className="normal-case tracking-normal text-pastdue">{note}</span>}
			</div>
			<div className="mt-2 flex items-center justify-between gap-3">
				<code className="tabular font-mono text-[22px] leading-9 font-semibold tracking-wide whitespace-nowrap text-text-heading select-all sm:text-[24px]">{value}</code>
				<button
					type="button"
					onClick={copy}
					className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-label font-medium text-text-heading hover:bg-surface-raised"
				>
					{copied ? <Check className="size-3.5 text-active" /> : <Copy className="size-3.5" />}
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>
	);
}
