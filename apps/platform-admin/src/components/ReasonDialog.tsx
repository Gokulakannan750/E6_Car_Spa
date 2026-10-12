import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { TextareaField } from './Field';
import { Modal } from './Modal';
import { InlineError } from './Surface';

interface ReasonDialogProps {
	open: boolean;
	title: ReactNode;
	description?: ReactNode;
	/** What happens, in plain words, shown above the reason. */
	children?: ReactNode;
	confirmLabel: string;
	tone?: 'danger' | 'primary';
	quickReasons?: string[];
	placeholder?: string;
	busy?: boolean;
	error?: string | null;
	onConfirm: (reason: string) => void;
	onClose: () => void;
}

/** Every change to a company asks why; the reason goes into the audit log. */
export function ReasonDialog({
	open,
	title,
	description,
	children,
	confirmLabel,
	tone = 'primary',
	quickReasons = [],
	placeholder,
	busy,
	error,
	onConfirm,
	onClose,
}: ReasonDialogProps) {
	const [reason, setReason] = useState('');
	const [missing, setMissing] = useState(false);

	useEffect(() => {
		if (open) {
			setReason('');
			setMissing(false);
		}
	}, [open]);

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!reason.trim()) {
			setMissing(true);
			return;
		}
		onConfirm(reason.trim());
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={title}
			description={description}
			width="sm"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="reason-dialog" variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy}>
						{confirmLabel}
					</Button>
				</>
			}
		>
			<form id="reason-dialog" onSubmit={submit} className="flex flex-col gap-4" noValidate>
				{children}
				<TextareaField
					label="Reason (recorded in the audit log)"
					placeholder={placeholder}
					value={reason}
					maxLength={500}
					onChange={(e) => {
						setReason(e.target.value);
						if (e.target.value.trim()) setMissing(false);
					}}
					error={missing ? 'A reason is required.' : undefined}
				/>
				{quickReasons.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{quickReasons.map((q) => (
							<button
								key={q}
								type="button"
								onClick={() => {
									setReason(q);
									setMissing(false);
								}}
								className="rounded-md border border-border-subtle bg-surface-alt px-2.5 py-1 text-label text-text-secondary hover:text-text-heading"
							>
								{q}
							</button>
						))}
					</div>
				)}
				<InlineError message={error} />
			</form>
		</Modal>
	);
}
