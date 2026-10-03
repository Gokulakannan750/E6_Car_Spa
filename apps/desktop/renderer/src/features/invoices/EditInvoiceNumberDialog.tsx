import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { updateInvoiceNumber, type InvoiceDto } from '../../lib/api';

// Provisional rule (pending client confirmation) — mirrors backend InvoiceNumberRules.
const INVOICE_NUMBER_PATTERN = /^[A-Za-z0-9/-]{1,16}$/;
const FORMAT_HINT = "1–16 characters: letters, digits, '-' and '/'";

interface EditInvoiceNumberDialogProps {
	open: boolean;
	invoiceId: string;
	currentNumber: string;
	onOpenChange: (open: boolean) => void;
	onUpdated: (invoice: InvoiceDto) => void;
}

export function EditInvoiceNumberDialog({ open, invoiceId, currentNumber, onOpenChange, onUpdated }: EditInvoiceNumberDialogProps) {
	const [value, setValue] = useState(currentNumber);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (open) {
			setValue(currentNumber);
			setError(null);
		}
	}, [open, currentNumber]);

	const trimmed = value.trim();
	const isValid = INVOICE_NUMBER_PATTERN.test(trimmed);
	const isUnchanged = trimmed === currentNumber;

	const handleSave = async () => {
		if (!isValid || isUnchanged || saving) return;
		setSaving(true);
		setError(null);
		try {
			const updated = await updateInvoiceNumber(invoiceId, trimmed);
			onUpdated(updated);
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to change the invoice number.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Change Invoice Number"
			description="Replace the automatically generated number of this paid GST invoice with your own number."
			footer={
				<div className="flex items-center justify-end gap-2">
					<Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!isValid || isUnchanged || saving}>
						{saving ? 'Saving...' : 'Save Number'}
					</Button>
				</div>
			}
		>
			<div className="space-y-3">
				<p className="text-xs text-on-surface-variant">
					Current number: <strong className="font-mono">{currentNumber}</strong>
				</p>
				<Input
					label="New invoice number"
					aria-label="New invoice number"
					value={value}
					maxLength={16}
					autoFocus
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') void handleSave();
					}}
					hint={FORMAT_HINT}
					error={trimmed.length > 0 && !isValid ? `Invalid format. Use ${FORMAT_HINT}.` : undefined}
				/>
				{error && (
					<p role="alert" className="text-xs font-medium text-error">
						{error}
					</p>
				)}
				<p className="text-[11px] text-on-surface-variant">
					The number must be unique. Copies already sent to the customer (WhatsApp, printouts) keep the old number.
				</p>
			</div>
		</Dialog>
	);
}
