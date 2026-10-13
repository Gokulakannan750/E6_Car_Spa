import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, RefreshCcw, Repeat, XCircle } from 'lucide-react';
import { Button, Dialog, Textarea } from '../../components/ui';
import { SUBSCRIPTION_QUERY_KEY } from '../auth/auth-context';
import {
	cancelOwnerSubscription,
	getOwnerInvoices,
	getOwnerSubscription,
	payOwnerInvoice,
	renewOwnerSubscription,
	resumeOwnerSubscription,
	type OwnerChangeResultDto,
	type OwnerInvoiceDto,
} from '../../lib/api';
import { cn } from '../../utils/cn';
import { ChangePlanDialog, money, shortDate } from './ChangePlanDialog';
import { PLAN_CHANGE_QUERY_KEY } from './PlanChangeCard';

const OWNER_KEY = ['owner-subscription'] as const;
const INVOICES_KEY = ['owner-invoices'] as const;

const STATUS_STYLE: Record<string, string> = {
	Open: 'bg-amber-50 text-amber-700 border-amber-200',
	Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
	Void: 'bg-slate-100 text-slate-500 border-slate-200',
};

/**
 * The Owner's own subscription management: change plan and licences, renew early, pay invoices, cancel at the
 * period end. Until online payment is connected, "Pay" works on test servers only; otherwise it says to call Trovo.
 */
export function OwnerBillingPanel() {
	const queryClient = useQueryClient();
	const subscription = useQuery({ queryKey: OWNER_KEY, queryFn: getOwnerSubscription });
	const invoices = useQuery({ queryKey: INVOICES_KEY, queryFn: getOwnerInvoices });
	const [changing, setChanging] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState<string | null>(null);
	const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: OWNER_KEY }),
			queryClient.invalidateQueries({ queryKey: INVOICES_KEY }),
			queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: PLAN_CHANGE_QUERY_KEY }),
		]);

	async function run(key: string, action: () => Promise<unknown>, success: string) {
		setBusy(key);
		setNotice(null);
		try {
			await action();
			await refresh();
			setNotice({ ok: true, text: success });
		} catch (err) {
			setNotice({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
		} finally {
			setBusy(null);
		}
	}

	const data = subscription.data;
	if (subscription.isLoading) return <p className="text-sm text-slate-500">Loading your subscription…</p>;
	if (subscription.isError || !data) return null;

	const payable = (invoice: OwnerInvoiceDto) => invoice.status === 'Open' && invoice.amountDueMinor > 0;
	const onChanged = async (result: OwnerChangeResultDto) => {
		setChanging(false);
		await refresh();
		setNotice({
			ok: true,
			text:
				result.status === 'Scheduled'
					? `Done. Your new plan starts on ${shortDate(result.effectiveAt)}.`
					: result.invoiceNumber
						? `Done. Your new plan is in effect. Invoice ${result.invoiceNumber} for ${money(result.amountNowMinor)} is below.`
						: 'Done. Your new plan is in effect.',
		});
	};

	return (
		<section aria-label="Manage subscription" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-sm font-bold text-slate-800">Manage your subscription</h2>
					<p className="text-xs text-slate-500">Only the Owner sees this.</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button icon={<Repeat className="h-4 w-4" />} onClick={() => setChanging(true)} disabled={data.cancelAtPeriodEnd}>
						Change plan
					</Button>
					{data.status === 'Active' && !data.cancelAtPeriodEnd && (
						<Button variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} loading={busy === 'renew'}
							onClick={() => run('renew', renewOwnerSubscription, 'Your renewal invoice is ready below.')}>
							Renew now
						</Button>
					)}
				</div>
			</div>

			{data.cancelAtPeriodEnd && (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					<span>Your subscription ends on {shortDate(data.currentPeriodEnd)} and will not renew.</span>
					<Button size="sm" variant="secondary" loading={busy === 'resume'}
						onClick={() => run('resume', resumeOwnerSubscription, 'Your subscription will renew as usual.')}>
						Keep my subscription
					</Button>
				</div>
			)}

			{notice && (
				<p role={notice.ok ? 'status' : 'alert'}
					className={cn('rounded-lg border px-4 py-3 text-sm', notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700')}>
					{notice.text}
				</p>
			)}

			<div>
				<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Invoices from Trovo</h3>
				{invoices.data && invoices.data.length > 0 ? (
					<table className="w-full text-sm">
						<thead>
							<tr className="text-left text-xs text-slate-500">
								<th className="py-1 font-semibold">Invoice</th>
								<th className="py-1 font-semibold">For</th>
								<th className="py-1 font-semibold">Issued</th>
								<th className="py-1 text-right font-semibold">Amount</th>
								<th className="py-1 font-semibold">Status</th>
								<th className="py-1" />
							</tr>
						</thead>
						<tbody>
							{invoices.data.map((invoice) => (
								<tr key={invoice.id} className="border-t border-slate-100">
									<td className="py-1.5 font-mono text-xs text-slate-800">{invoice.invoiceNumber}</td>
									<td className="py-1.5 text-slate-600">
										{invoice.kind === 'Adjustment'
											? 'Upgrade (rest of period)'
											: invoice.periodStart && invoice.periodEnd
												? `${shortDate(invoice.periodStart)} – ${shortDate(invoice.periodEnd)}`
												: 'Subscription'}
									</td>
									<td className="py-1.5 text-slate-600">{shortDate(invoice.issuedAt)}</td>
									<td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">{money(invoice.totalMinor, invoice.currency)}</td>
									<td className="py-1.5">
										<span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLE[invoice.status] ?? STATUS_STYLE.Void)}>
											{invoice.status === 'Open' ? `Due ${shortDate(invoice.dueAt)}` : invoice.status}
										</span>
									</td>
									<td className="py-1.5 text-right">
										{payable(invoice) &&
											(data.canPayOnline ? (
												<Button size="sm" icon={<CreditCard className="h-4 w-4" />} loading={busy === invoice.id}
													onClick={() => run(invoice.id, () => payOwnerInvoice(invoice.id), `Paid. Thank you! Invoice ${invoice.invoiceNumber} is settled.`)}>
													{data.testPayments ? 'Pay (test)' : 'Pay'}
												</Button>
											) : (
												<span className="text-xs text-slate-500">Call Trovo to pay</span>
											))}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<p className="text-sm text-slate-500">{invoices.isLoading ? 'Loading…' : 'No invoices yet.'}</p>
				)}
				{!data.canPayOnline && <p className="mt-2 text-xs text-slate-500">Online payment is coming soon. To pay now, call Trovo on +91 90426 72148.</p>}
			</div>

			{(data.status === 'Active' || data.status === 'PastDue') && !data.cancelAtPeriodEnd && (
				<div className="border-t border-slate-100 pt-3">
					<button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline" onClick={() => setCancelling(true)}>
						<XCircle className="h-3.5 w-3.5" /> Cancel subscription
					</button>
				</div>
			)}

			<ChangePlanDialog open={changing} onClose={() => setChanging(false)} data={data} onChanged={onChanged} />

			<Dialog
				open={cancelling}
				onOpenChange={(o) => !o && setCancelling(false)}
				title="Cancel subscription?"
				description={`You keep full use until ${shortDate(data.currentPeriodEnd)}. Then the software becomes read-only for 90 days so you can export your data. Nothing is refunded.`}
				footer={
					<div className="flex w-full justify-end gap-2">
						<Button variant="secondary" onClick={() => setCancelling(false)}>
							Keep subscription
						</Button>
						<Button
							variant="danger"
							loading={busy === 'cancel'}
							onClick={async () => {
								await run('cancel', () => cancelOwnerSubscription(reason.trim() || undefined), 'Cancelled. It ends at the end of your paid period.');
								setCancelling(false);
								setReason('');
							}}
						>
							Cancel at period end
						</Button>
					</div>
				}
			>
				<Textarea aria-label="Why are you cancelling? (optional)" placeholder="Why are you cancelling? (optional)" value={reason} maxLength={300}
					onChange={(e) => setReason(e.target.value)} />
			</Dialog>
		</section>
	);
}
