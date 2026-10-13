import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useAuth, SUBSCRIPTION_QUERY_KEY } from '../auth/auth-context';
import { approvePlanChange, declinePlanChange, getPlanChange, type PlanChangeProposalDto, type PlanTermsSummaryDto } from '../../lib/api';
import { Button } from '../../components/ui';

export const PLAN_CHANGE_QUERY_KEY = ['plan-change'] as const;

const money = (minor: number, currency = 'INR') =>
	new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(minor / 100);

const date = (value: string) => new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

function licencesText(t: PlanTermsSummaryDto) {
	const parts = [
		t.bothLicences ? `${t.bothLicences} Windows + Android` : null,
		t.windowsLicences ? `${t.windowsLicences} Windows only` : null,
		t.androidLicences ? `${t.androidLicences} Android only` : null,
	].filter(Boolean);
	return parts.length ? parts.join(', ') : 'No user licences';
}

function Terms({ title, terms, price, currency }: { title: string; terms: PlanTermsSummaryDto; price: number; currency: string }) {
	return (
		<div className="flex-1 rounded-lg border border-slate-200 bg-white p-3">
			<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
			<p className="mt-1 text-sm font-bold text-slate-900">
				{terms.planName} <span className="font-medium text-slate-500">{terms.interval === 'Year' ? 'yearly' : 'monthly'}</span>
			</p>
			<p className="text-xs text-slate-600">{licencesText(terms)}</p>
			<p className="text-xs text-slate-600">{terms.addOns.length ? `Add-ons: ${terms.addOns.join(', ')}` : 'No add-ons'}</p>
			<p className="mt-1 text-xs font-semibold text-slate-800">
				{money(price, currency)} per {terms.interval === 'Year' ? 'year' : 'month'}
			</p>
		</div>
	);
}

/** What approving means for the company, in plain words. */
function WhatHappens({ change }: { change: PlanChangeProposalDto }) {
	if (change.status === 'Scheduled') {
		return (
			<p className="flex items-start gap-2 text-sm text-slate-700">
				<CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
				Approved. It starts on {date(change.effectiveAt)}, when your paid period ends. Until then nothing changes, and the renewal invoice uses
				the new price.
			</p>
		);
	}
	const text =
		change.timing === 'NowWithCharge'
			? `It starts as soon as you approve. You will get an invoice for ${money(change.amountNowMinor, change.currency)}: the price difference for the rest of your paid period.`
			: change.timing === 'AtPeriodEnd'
				? `It starts on ${date(change.effectiveAt)}, when your paid period ends. Nothing is refunded; the renewal invoice uses the new price.`
				: 'It starts as soon as you approve. Nothing to pay now; your next invoice uses the new price.';
	return (
		<p className="flex items-start gap-2 text-sm text-slate-700">
			<Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
			{text}
		</p>
	);
}

/**
 * A change to the plan that Trovo proposed. Everyone allowed to see the subscription sees it; only the Owner can
 * approve or decline it, because it changes what the company pays.
 */
export function PlanChangeCard() {
	const { isOwner } = useAuth();
	const queryClient = useQueryClient();
	const change = useQuery({ queryKey: PLAN_CHANGE_QUERY_KEY, queryFn: getPlanChange });
	const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
	const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

	const data = change.data;
	if (!data) return message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message.text}</p> : null;

	async function answer(kind: 'approve' | 'decline') {
		if (!data) return;
		setBusy(kind);
		setMessage(null);
		try {
			if (kind === 'approve') {
				const waiting = await approvePlanChange(data.id);
				setMessage({
					ok: true,
					text: waiting ? `Approved. The change starts on ${date(waiting.effectiveAt)}.` : 'Approved. Your new plan is in effect.',
				});
			} else {
				await declinePlanChange(data.id);
				setMessage({ ok: true, text: 'Declined. Your plan stays as it is.' });
			}
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: PLAN_CHANGE_QUERY_KEY }),
				queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY }),
			]);
		} catch (err) {
			setMessage({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
		} finally {
			setBusy(null);
		}
	}

	return (
		<section aria-label="Plan change" className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm">
			<h2 className="text-sm font-bold text-slate-900">
				{data.status === 'Pending' ? 'Trovo has proposed a change to your plan' : 'Your plan will change'}
			</h2>
			{data.reason && data.status === 'Pending' && <p className="mt-0.5 text-xs text-slate-600">Reason: {data.reason}</p>}
			<div className="mt-4 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
				<Terms title="Now" terms={data.from} price={data.currentPeriodPriceMinor} currency={data.currency} />
				<ArrowRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-slate-400 md:rotate-0" aria-hidden="true" />
				<Terms title="New" terms={data.to} price={data.newPeriodPriceMinor} currency={data.currency} />
			</div>
			<div className="mt-4">
				<WhatHappens change={data} />
			</div>
			{data.status === 'Pending' &&
				(isOwner ? (
					<div className="mt-4 flex flex-wrap items-center gap-2">
						<Button icon={<CheckCircle2 className="h-4 w-4" />} loading={busy === 'approve'} disabled={busy !== null} onClick={() => answer('approve')}>
							Approve change
						</Button>
						<Button variant="secondary" icon={<XCircle className="h-4 w-4" />} loading={busy === 'decline'} disabled={busy !== null} onClick={() => answer('decline')}>
							Decline
						</Button>
						<span className="text-xs text-slate-500">Open until {date(data.expiresAt)}</span>
					</div>
				) : (
					<p className="mt-4 text-xs text-slate-600">Only the Owner can approve or decline this.</p>
				))}
			{message && (
				<p role={message.ok ? 'status' : 'alert'} className={`mt-3 text-sm ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>
					{message.text}
				</p>
			)}
		</section>
	);
}
