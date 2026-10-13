import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, X } from 'lucide-react';
import { Button, Checkbox, Input } from '../../components/ui';
import {
	cancelFranchiseSignupCode,
	createFranchiseSignupCode,
	getFranchiseSignupCodes,
	type FranchiseSignupCodeStatus,
} from '../../lib/api';
import { Card, errorText, FRANCHISE_QUERY_KEY, FRANCHISE_SCOPE_OPTIONS } from './FranchisePage';

export const FRANCHISE_CODES_QUERY_KEY = ['franchise-signup-codes'] as const;

const CODE_STYLE: Record<FranchiseSignupCodeStatus, string> = {
	Open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
	Reserved: 'bg-amber-50 text-amber-700 border-amber-200',
	Used: 'bg-teal-50 text-teal-700 border-teal-200',
	Expired: 'bg-slate-100 text-slate-600 border-slate-200',
	Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const CODE_LABEL: Record<FranchiseSignupCodeStatus, string> = {
	Open: 'Open',
	Reserved: 'In use (awaiting payment)',
	Used: 'Used',
	Expired: 'Expired',
	Cancelled: 'Withdrawn',
};

function lifetimeText(minutes: number) {
	if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
	if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
	return `${minutes} minutes`;
}

const time = (value: string) => new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Franchise sign-up codes: for a new franchisee that has no Trovo company yet. The franchisor makes a code here and
 * sends it; the franchisee enters it on Trovo's sign-up website, agrees to share the listed items, and is linked as
 * soon as its company is created. Shown only on Trovo's online service.
 */
export function FranchiseSignupCodes({ canManage }: { canManage: boolean }) {
	const queryClient = useQueryClient();
	const codes = useQuery({ queryKey: FRANCHISE_CODES_QUERY_KEY, queryFn: getFranchiseSignupCodes, refetchInterval: 30 * 1000 });
	const [scopes, setScopes] = useState<string[]>(['financial_totals']);
	const [label, setLabel] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [made, setMade] = useState<{ code: string; expiresAt: string } | null>(null);
	const [copied, setCopied] = useState(false);

	if (!codes.data?.available) return null;
	const data = codes.data;

	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: FRANCHISE_CODES_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: FRANCHISE_QUERY_KEY }),
		]);
	const toggle = (scope: string) => setScopes((current) => (current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]));

	async function make() {
		setBusy(true);
		setError(null);
		setCopied(false);
		try {
			const res = await createFranchiseSignupCode({ scopes, label: label.trim() || undefined });
			setMade({ code: res.code, expiresAt: res.item.expiresAt });
			setLabel('');
			await refresh();
		} catch (err) {
			setError(errorText(err));
		} finally {
			setBusy(false);
		}
	}

	async function withdraw(id: string) {
		setError(null);
		try {
			await cancelFranchiseSignupCode(id);
			await refresh();
		} catch (err) {
			setError(errorText(err));
		}
	}

	return (
		<section aria-label="Franchise sign-up codes" className="space-y-3">
			<h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">New franchisee without Trovo yet</h2>
			<Card>
				<p className="text-sm text-slate-700">
					Make a franchise code and send it to the new franchisee. They enter it on Trovo's sign-up website when they buy their own subscription,
					agree to share the items you ask for, and appear in your network as soon as their company is created. A code works once, for{' '}
					{lifetimeText(data.lifetimeMinutes)}.
				</p>

				{canManage && (
					<div className="space-y-3">
						<div className="max-w-xs">
							<Input aria-label="Note for this code" placeholder="Note, e.g. Salem — Ramesh (optional)" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
						</div>
						<fieldset className="space-y-1.5">
							<legend className="mb-1 text-xs font-semibold text-slate-600">What do you want to see?</legend>
							{FRANCHISE_SCOPE_OPTIONS.map((o) => (
								<div key={o.scope}>
									<Checkbox label={o.label} checked={scopes.includes(o.scope)} onChange={() => toggle(o.scope)} />
								</div>
							))}
						</fieldset>
						<Button icon={<KeyRound className="h-4 w-4" />} loading={busy} disabled={scopes.length === 0} onClick={make}>
							Make franchise code
						</Button>
					</div>
				)}

				{error && (
					<p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
						{error}
					</p>
				)}

				{made && (
					<div role="status" className="space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
						<p>Send this code to the new franchisee, for example on WhatsApp. It is not shown again.</p>
						<div className="flex flex-wrap items-center gap-2">
							<code aria-label="Franchise code" className="select-all rounded-md border border-teal-300 bg-white px-3 py-1.5 font-mono text-base font-semibold tracking-wider text-slate-900">
								{made.code}
							</code>
							<Button
								size="sm"
								variant="secondary"
								icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
								onClick={async () => {
									try {
										await navigator.clipboard.writeText(made.code);
										setCopied(true);
									} catch {
										// The code is selectable, so it can still be copied by hand.
									}
								}}
							>
								{copied ? 'Copied' : 'Copy code'}
							</Button>
						</div>
						<p className="text-xs text-teal-800">Valid until {time(made.expiresAt)}, for one sign-up on Trovo's sign-up website.</p>
					</div>
				)}

				{data.codes.length > 0 && (
					<table className="w-full text-sm">
						<thead>
							<tr className="text-left text-xs text-slate-500">
								<th className="py-1 font-semibold">Note</th>
								<th className="py-1 font-semibold">Made</th>
								<th className="py-1 font-semibold">Status</th>
								<th className="py-1 font-semibold">Company</th>
								<th className="py-1" />
							</tr>
						</thead>
						<tbody>
							{data.codes.map((c) => (
								<tr key={c.id} className="border-t border-slate-100">
									<td className="py-1.5 text-slate-800">{c.label ?? '—'}</td>
									<td className="py-1.5 text-slate-600">{time(c.createdAt)}</td>
									<td className="py-1.5">
										<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CODE_STYLE[c.status]}`}>{CODE_LABEL[c.status]}</span>
									</td>
									<td className="py-1.5 text-slate-700">{c.usedByCompanyName ?? ''}</td>
									<td className="py-1.5 text-right">
										{canManage && (c.status === 'Open' || c.status === 'Reserved') && (
											<Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => withdraw(c.id)} aria-label={`Withdraw code ${c.label ?? ''}`.trim()}>
												Withdraw
											</Button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>
		</section>
	);
}
