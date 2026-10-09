import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Network, Send, X, Link2Off, Plus, Copy, Check, Link2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Button, Checkbox, Input } from '../../components/ui';
import { useAuth } from '../auth/auth-context';
import {
	cancelFranchiseInvite,
	createFranchiseLink,
	endFranchiseLink,
	getFranchiseNetwork,
	requestFranchiseScopes,
	sendFranchiseInvite,
	type FranchiseLinkDto,
	type FranchiseLinkStatus,
} from '../../lib/api';

export const FRANCHISE_QUERY_KEY = ['franchise-network'] as const;

/** Everything a franchisor can ask for. The first one is the default request. */
export const FRANCHISE_SCOPE_OPTIONS = [
	{ scope: 'financial_totals', label: 'Financial totals (revenue, collections, jobs, invoices)' },
	{ scope: 'invoice_list', label: 'Invoice list' },
	{ scope: 'staff', label: 'Staff and attendance' },
	{ scope: 'customers', label: 'Customers' },
] as const;

export const STATUS_STYLE: Record<FranchiseLinkStatus, string> = {
	Pending: 'bg-amber-50 text-amber-700 border-amber-200',
	Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
	Declined: 'bg-slate-100 text-slate-600 border-slate-200',
	Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
	Expired: 'bg-slate-100 text-slate-600 border-slate-200',
	Ended: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function StatusPill({ status }: { status: FranchiseLinkStatus }) {
	return (
		<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
			{status}
		</span>
	);
}

export function formatDate(value: string | null) {
	return value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

export function errorText(err: unknown) {
	return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export function Card({ children }: { children: React.ReactNode }) {
	return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">{children}</div>;
}

/** The link to pass on to the franchisee, with a copy button. Shown once, right after it is made. */
function LinkBox({ link, expiresAt, intro }: { link: string; expiresAt?: string | null; intro: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div role="status" className="space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
			<p>{intro}</p>
			<div className="flex flex-wrap items-center gap-2">
				<input
					readOnly
					aria-label="Invitation link"
					value={link}
					onFocus={(e) => e.currentTarget.select()}
					className="min-w-0 flex-1 rounded-md border border-teal-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-800"
				/>
				<Button
					size="sm"
					variant="secondary"
					icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(link);
							setCopied(true);
						} catch {
							// The link is selectable above, so it can still be copied by hand.
						}
					}}
				>
					{copied ? 'Copied' : 'Copy link'}
				</Button>
			</div>
			<p className="text-xs text-teal-800">
				Send it to the company. Only the Owner of the invited company can use it, after signing in, and it works once
				{expiresAt ? `, until ${formatDate(expiresAt)}` : ''}. This link is not shown again; you can make a new one if it is lost.
			</p>
		</div>
	);
}

export function FranchisePage() {
	const { hasPermission } = useAuth();
	const canManage = hasPermission('franchise.manage');
	const queryClient = useQueryClient();
	const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
	/** Links shown once after they were made, by the link they belong to ("invite" for the form above the list). */
	const [links, setLinks] = useState<Record<string, { link: string; expiresAt?: string | null; intro: string }>>({});

	const network = useQuery({
		queryKey: FRANCHISE_QUERY_KEY,
		queryFn: getFranchiseNetwork,
		refetchInterval: 30 * 1000,
		refetchOnWindowFocus: true,
	});

	const refresh = () => queryClient.invalidateQueries({ queryKey: FRANCHISE_QUERY_KEY });
	const run = async (action: () => Promise<unknown>, success?: string) => {
		setNotice(null);
		try {
			await action();
			await refresh();
			if (success) setNotice({ kind: 'ok', text: success });
		} catch (err) {
			setNotice({ kind: 'error', text: errorText(err) });
		}
	};

	const data = network.data;
	const myFranchisees = data?.franchisees ?? [];

	return (
		<div className="space-y-6 max-w-5xl mx-auto">
			<PageHeader
				title="Franchise Network"
				description="Invite the companies you franchise. They answer through a link you send, and nothing is shared until they agree."
			/>

			{notice && (
				<div
					role={notice.kind === 'error' ? 'alert' : 'status'}
					className={`rounded-lg border px-4 py-3 text-sm ${
						notice.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
					}`}
				>
					{notice.text}
				</div>
			)}

			{network.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
			{network.isError && <p className="text-sm text-red-600">{errorText(network.error)}</p>}

			{data && (
				<section aria-label="Companies you franchise" className="space-y-3">
					<h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Companies you franchise</h2>

					{canManage && (
						<InviteForm
							onSend={async (code, scopes) => {
								setNotice(null);
								try {
									const res = await sendFranchiseInvite({ franchiseeCode: code, scopes });
									await refresh();
									setNotice({ kind: 'ok', text: res.message });
									setLinks((current) => ({
										...current,
										invite: {
											link: res.inviteLink,
											intro: 'Send this link to the company you invited, for example on WhatsApp or by email.',
										},
									}));
									return true;
								} catch (err) {
									setNotice({ kind: 'error', text: errorText(err) });
									return false;
								}
							}}
						/>
					)}

					{links.invite && <LinkBox {...links.invite} />}

					{myFranchisees.length === 0 ? (
						<p className="text-sm text-slate-500">You have not invited any company yet.</p>
					) : (
						myFranchisees.map((link) => (
							<FranchiseeCard
								key={link.id}
								link={link}
								canManage={canManage}
								shownLink={links[link.id]}
								onCancel={() => run(() => cancelFranchiseInvite(link.id), 'Invitation withdrawn.')}
								onNewLink={() =>
									run(async () => {
										const res = await createFranchiseLink(link.id);
										setLinks((current) => ({
											...current,
											[link.id]: {
												link: res.accessLink ?? '',
												expiresAt: res.accessLinkExpiresAt,
												intro: 'A new link was made. The earlier link no longer works.',
											},
										}));
									})
								}
								onEnd={() => {
									if (confirm(`End the franchise link with ${link.partnerName}? You will stop seeing their figures at once.`)) {
										return run(() => endFranchiseLink(link.id), 'Franchise link ended.');
									}
								}}
								onAskMore={(scopes) =>
									run(async () => {
										const res = await requestFranchiseScopes(link.id, scopes);
										if (res.accessLink) {
											setLinks((current) => ({
												...current,
												[link.id]: {
													link: res.accessLink!,
													expiresAt: res.accessLinkExpiresAt,
													intro: 'Send this link to the company so they can answer your request.',
												},
											}));
										}
									}, 'Your request was made.')
								}
							/>
						))
					)}
				</section>
			)}
		</div>
	);
}

// ── Pieces ──────────────────────────────────────────────────────────────────────────────────────────────

export function PartnerHeader({ link }: { link: FranchiseLinkDto }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
					<Network className="h-5 w-5" />
				</div>
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold text-slate-900">{link.partnerName}</p>
					<p className="text-xs text-slate-500">Company code {link.partnerCodeHint}</p>
				</div>
			</div>
			<StatusPill status={link.status} />
		</div>
	);
}

function InviteForm({ onSend }: { onSend: (code: string, scopes: string[]) => Promise<boolean> }) {
	const [code, setCode] = useState('');
	const [scopes, setScopes] = useState<string[]>(['financial_totals']);
	const [sending, setSending] = useState(false);

	const toggle = (scope: string) =>
		setScopes((current) => (current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]));

	return (
		<Card>
			<form
				className="space-y-3"
				onSubmit={async (e) => {
					e.preventDefault();
					if (!code.trim() || scopes.length === 0) return;
					setSending(true);
					const sent = await onSend(code.trim(), scopes);
					setSending(false);
					if (sent) setCode('');
				}}
			>
				<p className="text-sm font-semibold text-slate-800">Invite a company</p>
				<div className="max-w-xs">
					<Input
						aria-label="Company code to invite"
						placeholder="Enter their company code"
						value={code}
						maxLength={20}
						onChange={(e) => setCode(e.target.value)}
					/>
				</div>
				<fieldset className="space-y-1.5">
					<legend className="text-xs font-semibold text-slate-600 mb-1">What do you want to see?</legend>
					{FRANCHISE_SCOPE_OPTIONS.map((o) => (
						<div key={o.scope}>
							<Checkbox label={o.label} checked={scopes.includes(o.scope)} onChange={() => toggle(o.scope)} />
						</div>
					))}
				</fieldset>
				<Button type="submit" icon={<Send className="h-4 w-4" />} loading={sending} disabled={!code.trim() || scopes.length === 0}>
					Send invitation
				</Button>
			</form>
		</Card>
	);
}

function FranchiseeCard({
	link,
	canManage,
	shownLink,
	onCancel,
	onNewLink,
	onEnd,
	onAskMore,
}: {
	link: FranchiseLinkDto;
	canManage: boolean;
	shownLink?: { link: string; expiresAt?: string | null; intro: string };
	onCancel: () => void;
	onNewLink: () => void;
	onEnd: () => void;
	onAskMore: (scopes: string[]) => void;
}) {
	const [asking, setAsking] = useState(false);
	const [more, setMore] = useState<string[]>([]);
	const askable = FRANCHISE_SCOPE_OPTIONS.filter((o) => {
		const existing = link.scopes.find((s) => s.scope === o.scope);
		return !existing || existing.status === 'Denied';
	});
	const waiting = link.scopes.some((s) => s.status === 'Requested');

	return (
		<Card>
			<PartnerHeader link={link} />
			<ul className="space-y-1 text-sm">
				{link.scopes.map((s) => (
					<li key={s.scope} className="flex items-center justify-between gap-3">
						<span className="text-slate-700">{s.label}</span>
						<span
							className={`text-xs font-semibold ${
								s.status === 'Granted' ? 'text-emerald-700' : s.status === 'Requested' ? 'text-amber-700' : 'text-slate-500'
							}`}
						>
							{s.status === 'Granted' ? 'Allowed' : s.status === 'Requested' ? 'Waiting for their answer' : 'Not allowed'}
						</span>
					</li>
				))}
			</ul>
			{link.status === 'Pending' && <p className="text-xs text-slate-500">Waiting for their answer. Expires on {formatDate(link.expiresAt)}.</p>}
			{shownLink && shownLink.link && <LinkBox {...shownLink} />}
			{canManage && (link.status === 'Pending' || (link.status === 'Active' && waiting)) && (
				<div className="flex flex-wrap gap-2">
					<Button variant="secondary" size="sm" icon={<Link2 className="h-4 w-4" />} onClick={onNewLink}>
						Make a new link
					</Button>
					{link.status === 'Pending' && (
						<Button variant="secondary" size="sm" icon={<X className="h-4 w-4" />} onClick={onCancel}>
							Withdraw invitation
						</Button>
					)}
				</div>
			)}
			{canManage && link.status === 'Active' && (
				<div className="space-y-2">
					<div className="flex flex-wrap gap-2">
						{askable.length > 0 && (
							<Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAsking((v) => !v)}>
								Ask to see more
							</Button>
						)}
						<Button variant="ghost" size="sm" icon={<Link2Off className="h-4 w-4" />} onClick={onEnd}>
							End link
						</Button>
					</div>
					{asking && (
						<div className="space-y-2 rounded-lg bg-slate-50 p-3">
							{askable.map((o) => (
								<div key={o.scope}>
									<Checkbox
										label={o.label}
										checked={more.includes(o.scope)}
										onChange={() =>
											setMore((current) => (current.includes(o.scope) ? current.filter((s) => s !== o.scope) : [...current, o.scope]))
										}
									/>
								</div>
							))}
							<Button
								size="sm"
								disabled={more.length === 0}
								onClick={() => {
									onAskMore(more);
									setMore([]);
									setAsking(false);
								}}
							>
								Send request
							</Button>
						</div>
					)}
				</div>
			)}
		</Card>
	);
}

export default FranchisePage;
