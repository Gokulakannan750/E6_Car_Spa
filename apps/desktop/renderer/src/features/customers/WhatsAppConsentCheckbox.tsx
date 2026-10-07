import { MessageCircle } from 'lucide-react';

interface WhatsAppConsentCheckboxProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** When the consent was last changed, shown as a small note. */
	recordedAt?: string | null;
	disabled?: boolean;
}

function formatRecordedDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Records that the customer agreed to automatic WhatsApp updates (invoice and payment messages). */
export function WhatsAppConsentCheckbox({ checked, onChange, recordedAt, disabled }: WhatsAppConsentCheckboxProps) {
	const recordedDate = recordedAt ? formatRecordedDate(recordedAt) : '';

	return (
		<label className="flex items-start gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3 cursor-pointer">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				disabled={disabled}
				className="mt-0.5 h-4 w-4 accent-primary"
			/>
			<span className="text-xs">
				<span className="flex items-center gap-1.5 font-medium text-on-surface">
					<MessageCircle className="w-3.5 h-3.5 text-secondary" />
					Customer agrees to receive WhatsApp updates
				</span>
				<span className="block text-on-surface-variant mt-0.5">
					Invoice and payment messages. Tick only if the customer has agreed. The change is recorded with the date and who made it.
				</span>
				{recordedDate && (
					<span className="block text-on-surface-variant mt-0.5">Last changed on {recordedDate}</span>
				)}
			</span>
		</label>
	);
}
