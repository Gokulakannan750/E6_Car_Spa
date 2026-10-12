import {
	forwardRef,
	useId,
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from 'react';

const control =
	'w-full rounded-md border bg-surface-alt text-text-heading placeholder:text-text-muted transition-colors focus:outline-none focus:border-action focus:ring-1 focus:ring-action disabled:opacity-60';

function borderFor(error?: string) {
	return error ? 'border-danger' : 'border-border-subtle';
}

interface FieldShellProps {
	label?: string;
	hint?: ReactNode;
	error?: string;
	children: (id: string, describedBy: string | undefined) => ReactNode;
	className?: string;
	labelAside?: ReactNode;
}

export function FieldShell({ label, hint, error, children, className = '', labelAside }: FieldShellProps) {
	const id = useId();
	const messageId = `${id}-msg`;
	return (
		<div className={`flex flex-col gap-1.5 ${className}`}>
			{label && (
				<div className="flex items-center justify-between">
					<label htmlFor={id} className="text-label font-medium text-text-primary">
						{label}
					</label>
					{labelAside}
				</div>
			)}
			{children(id, error || hint ? messageId : undefined)}
			{error ? (
				<p id={messageId} role="alert" className="text-label text-danger">
					{error}
				</p>
			) : hint ? (
				<p id={messageId} className="text-label text-text-muted">
					{hint}
				</p>
			) : null}
		</div>
	);
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
	label?: string;
	hint?: ReactNode;
	error?: string;
	leading?: ReactNode;
	trailing?: ReactNode;
	labelAside?: ReactNode;
	containerClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
	{ label, hint, error, leading, trailing, labelAside, containerClassName, className = '', ...rest },
	ref,
) {
	return (
		<FieldShell label={label} hint={hint} error={error} labelAside={labelAside} className={containerClassName}>
			{(id, describedBy) => (
				<div className="relative">
					{leading && (
						<span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-muted">{leading}</span>
					)}
					<input
						ref={ref}
						id={id}
						aria-invalid={error ? true : undefined}
						aria-describedby={describedBy}
						className={`${control} ${borderFor(error)} h-9 text-body ${leading ? 'pl-9' : 'pl-3'} ${trailing ? 'pr-10' : 'pr-3'} ${className}`}
						{...rest}
					/>
					{trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
				</div>
			)}
		</FieldShell>
	);
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: ReactNode; error?: string; containerClassName?: string };

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
	{ label, hint, error, containerClassName, className = '', children, ...rest },
	ref,
) {
	return (
		<FieldShell label={label} hint={hint} error={error} className={containerClassName}>
			{(id, describedBy) => (
				<select
					ref={ref}
					id={id}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy}
					className={`${control} ${borderFor(error)} h-9 px-3 text-body ${className}`}
					{...rest}
				>
					{children}
				</select>
			)}
		</FieldShell>
	);
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode; error?: string; containerClassName?: string };

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextareaField(
	{ label, hint, error, containerClassName, className = '', ...rest },
	ref,
) {
	return (
		<FieldShell label={label} hint={hint} error={error} className={containerClassName}>
			{(id, describedBy) => (
				<textarea
					ref={ref}
					id={id}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy}
					className={`${control} ${borderFor(error)} min-h-20 px-3 py-2 text-body ${className}`}
					{...rest}
				/>
			)}
		</FieldShell>
	);
});
