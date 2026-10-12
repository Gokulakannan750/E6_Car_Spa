import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/Button';
import { SelectField, TextField } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { ReasonDialog } from '@/components/ReasonDialog';
import { InlineError } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { money, parseRupees } from '@/lib/format';

/** The fields both list shapes (company invoices, all invoices) share. */
export interface InvoiceRef {
	id: string;
	invoiceNumber: string;
	amountDueMinor: number;
	totalMinor: number;
	currency: string;
	companyName?: string;
}

const CHANNELS = ['UPI', 'Bank transfer', 'Cash', 'Cheque'] as const;

function useRefreshBilling() {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({ queryKey: ['invoices'] });
		queryClient.invalidateQueries({ queryKey: ['invoice'] });
		queryClient.invalidateQueries({ queryKey: ['company-billing'] });
		queryClient.invalidateQueries({ queryKey: ['company'] });
		queryClient.invalidateQueries({ queryKey: ['companies'] });
		queryClient.invalidateQueries({ queryKey: ['dashboard'] });
	};
}

function todayInIndia(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function RecordPaymentDialog({ invoice, onClose }: { invoice: InvoiceRef | null; onClose: () => void }) {
	const toast = useToast();
	const refresh = useRefreshBilling();
	const [amount, setAmount] = useState('');
	const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('UPI');
	const [reference, setReference] = useState('');
	const [paidOn, setPaidOn] = useState(todayInIndia());
	const [errors, setErrors] = useState<{ amount?: string; reference?: string; paidOn?: string }>({});

	const mutation = useMutation({
		mutationFn: (v: { amountMinor: number; reference: string; paidAt: string }) => api.recordPayment(invoice!.id, v.amountMinor, v.reference, v.paidAt),
		onSuccess: (_, v) => {
			refresh();
			toast.success(
				v.amountMinor === invoice!.amountDueMinor
					? `${invoice!.invoiceNumber} is paid. The subscription is renewed.`
					: `${money(v.amountMinor, invoice!.currency)} recorded on ${invoice!.invoiceNumber}.`,
			);
			onClose();
		},
	});

	useEffect(() => {
		if (invoice) {
			setAmount((invoice.amountDueMinor / 100).toFixed(2));
			setChannel('UPI');
			setReference('');
			setPaidOn(todayInIndia());
			setErrors({});
			mutation.reset();
		}
	}, [invoice?.id]);

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!invoice) return;
		const next: typeof errors = {};
		const minor = parseRupees(amount);
		if (minor === null || minor <= 0) next.amount = 'Enter the amount received, e.g. 1999 or 1999.50.';
		else if (minor > invoice.amountDueMinor) next.amount = `More than the ${money(invoice.amountDueMinor, invoice.currency)} due.`;
		if (!reference.trim()) next.reference = 'Enter the UTR, UPI reference or cheque number.';
		if (!paidOn) next.paidOn = 'Choose the date the money arrived.';
		else if (paidOn > todayInIndia()) next.paidOn = 'The date cannot be in the future.';
		setErrors(next);
		if (Object.keys(next).length > 0 || minor === null) return;
		mutation.mutate({
			amountMinor: minor,
			reference: `${channel}: ${reference.trim()}`.slice(0, 200),
			// Noon India time on the chosen day, so the stored date never slips to the previous day.
			paidAt: new Date(`${paidOn}T12:00:00+05:30`).toISOString(),
		});
	}

	return (
		<Modal
			open={invoice !== null}
			onClose={onClose}
			width="sm"
			title="Record payment"
			description={invoice ? `${invoice.invoiceNumber}${invoice.companyName ? ` · ${invoice.companyName}` : ''} · ${money(invoice.amountDueMinor, invoice.currency)} due` : undefined}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="record-payment" variant="primary" loading={mutation.isPending}>
						Record payment
					</Button>
				</>
			}
		>
			<form id="record-payment" onSubmit={submit} noValidate className="flex flex-col gap-4">
				<TextField
					label="Amount received (₹)"
					inputMode="decimal"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					error={errors.amount}
					className="tabular"
					labelAside={
						invoice && (
							<button type="button" className="text-label text-action hover:text-action-hover" onClick={() => setAmount((invoice.amountDueMinor / 100).toFixed(2))}>
								Full amount
							</button>
						)
					}
				/>
				<SelectField label="Paid by" value={channel} onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}>
					{CHANNELS.map((c) => (
						<option key={c}>{c}</option>
					))}
				</SelectField>
				<TextField
					label="Reference"
					maxLength={180}
					placeholder="UTR, UPI reference or cheque number"
					value={reference}
					onChange={(e) => setReference(e.target.value)}
					error={errors.reference}
					hint="Each reference can be recorded only once."
				/>
				<TextField label="Received on" type="date" max={todayInIndia()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} error={errors.paidOn} />
				<p className="text-label text-text-muted">When the invoice is fully paid, the company’s subscription is activated or renewed straight away.</p>
				<InlineError message={mutation.error?.message} />
			</form>
		</Modal>
	);
}

export function VoidInvoiceDialog({ invoice, onClose }: { invoice: InvoiceRef | null; onClose: () => void }) {
	const toast = useToast();
	const refresh = useRefreshBilling();
	const mutation = useMutation({
		mutationFn: (reason: string) => api.voidInvoice(invoice!.id, reason),
		onSuccess: () => {
			refresh();
			toast.success(`${invoice!.invoiceNumber} voided.`);
			onClose();
		},
	});
	useEffect(() => {
		if (invoice) mutation.reset();
	}, [invoice?.id]);

	return (
		<ReasonDialog
			open={invoice !== null}
			onClose={onClose}
			tone="danger"
			title={`Void ${invoice?.invoiceNumber ?? 'invoice'}?`}
			confirmLabel="Void invoice"
			quickReasons={['Issued by mistake', 'Wrong plan or amount', 'Customer canceled']}
			busy={mutation.isPending}
			error={mutation.error?.message}
			onConfirm={(reason) => mutation.mutate(reason)}
		>
			<p className="rounded-md border border-border-subtle bg-surface-alt px-3 py-2.5 text-body text-text-secondary">
				The invoice stays in the records, marked void, and nothing more is due on it. Its number is not reused. Only an open invoice with no payments can be
				voided.
			</p>
		</ReasonDialog>
	);
}
