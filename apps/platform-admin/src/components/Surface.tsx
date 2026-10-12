import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { Button } from './Button';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
	return <section className={`rounded-lg border border-border-subtle bg-surface-card ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
	return (
		<header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
			<div className="min-w-0">
				<h2 className="text-title font-semibold text-text-heading">{title}</h2>
				{subtitle && <p className="mt-0.5 text-label text-text-muted">{subtitle}</p>}
			</div>
			{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
		</header>
	);
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
	return (
		<div className="mb-6 flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="text-headline font-semibold tracking-tight text-text-heading">{title}</h1>
				{description && <p className="mt-1 text-body text-text-secondary">{description}</p>}
			</div>
			{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
		</div>
	);
}

/** Label/value pairs in a two-column grid (company details, billing details). */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
	return (
		<dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
			{items.map((item) => (
				<div key={item.label} className="min-w-0">
					<dt className="text-micro font-medium tracking-wide text-text-muted uppercase">{item.label}</dt>
					<dd className="mt-0.5 text-body break-words text-text-primary">{item.value}</dd>
				</div>
			))}
		</dl>
	);
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
	return (
		<div role="status" className="flex items-center justify-center gap-2 py-16 text-body text-text-muted">
			<Loader2 className="size-4 animate-spin" aria-hidden />
			{label}
		</div>
	);
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
	const message = error instanceof Error ? error.message : 'Something went wrong.';
	return (
		<div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
			<AlertTriangle className="size-6 text-danger" aria-hidden />
			<p className="max-w-md text-body text-text-secondary">{message}</p>
			{onRetry && (
				<Button size="sm" onClick={onRetry}>
					Try again
				</Button>
			)}
		</div>
	);
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
			<Inbox className="size-6 text-text-muted" aria-hidden />
			<p className="text-body font-medium text-text-primary">{title}</p>
			{description && <p className="max-w-md text-label text-text-muted">{description}</p>}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}

export function InlineError({ message }: { message: string | null | undefined }) {
	if (!message) return null;
	return (
		<div role="alert" className="flex items-start gap-2 rounded-md border border-danger-strong/40 bg-danger-strong/10 px-3 py-2 text-label text-danger">
			<AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
			<span>{message}</span>
		</div>
	);
}
