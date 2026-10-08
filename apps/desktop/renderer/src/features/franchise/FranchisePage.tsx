import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Network, Send, Check, X, Link2Off, Plus } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Button, Checkbox, Input, Switch } from '../../components/ui';
import { useAuth } from '../auth/auth-context';
import {
	cancelFranchiseInvite,
	decideFranchiseScope,
	endFranchiseLink,
	getFranchiseNetwork,
	requestFranchiseScopes,
	respondToFranchiseInvite,
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

const STATUS_STYLE: Record<FranchiseLinkStatus, string> = {
	Pending: 'bg-amber-50 text-amber-700 border-amber-200',
	Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
	Declined: 'bg-slate-100 text-slate-600 border-slate-200',
	Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
	Expired: 'bg-slate-100 text-slate-600 border-slate-200',
	Ended: 'bg-slate-100 text-slate-600 border-slate-200',
};

function StatusPill({ status }: { status: FranchiseLinkStatus }) {
	return (
		<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
			{status}
		</span>
	);
}

function formatDate(value: string | null) {
	return value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

function errorText(err: unknown) {
	return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export function FranchisePage() {
	const { hasPermission } = useAuth();
	const canManage = hasPermission('franchise.manage');
	const queryClient = useQueryClient();
	const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

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
	const invitations = (data?.franchisors ?? []).filter((l) => l.status === 'Pending');
	const myFranchisors = (data?.franchisors ?? []).filter((l) => l.status !== 'Pending');
	const myFranchisees = data?.franchisees ?? [];

	return (
		<div className="space-y-6 max-w-5xl mx-auto">
			<PageHeader
				title="Franchise Network"
				description="Connect with the companies you franchise, or the company that franchises you. Nothing is shared until the invited company agrees."
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
				<>
					{invitations.length > 0 && (
						<section aria-label="Invitations for you" className="space-y-3">
							<h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Invitations for you</h2>
							{invitations.map((link) => (
								<InvitationCard
									key={link.id}
									link={link}
									canManage={canManage}
									onAccept={(scopes) =>
										run(() => respondToFranchiseInvite(link.id, { accept: true, grantedScopes: scopes }), 'Invitation accepted.')
									}
									onDecline={() => run(() => respondToFranchiseInvite(link.id, { accept: false }), 'Invitation declined.')}
								/>
							))}
						</section>
					)}

					<section aria-label="Companies you franchise" className="space-y-3">
						<h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Companies you franchise</h2>
						{data.franchiseEnabled ? (
							canManage && (
								<InviteForm
									onSend={async (code, scopes) => {
										setNotice(null);
										try {
											const res = await sendFranchiseInvite({ franchiseeCode: code, scopes });
											await refresh();
											setNotice({ kind: 'ok', text: res.message });
											return true;
										} catch (err) {
											setNotice({ kind: 'error', text: errorText(err) });
											return false;
										}
									}}
								/>
							)
						) : (
							<p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
								The Franchise add-on is not active for your company, so you cannot invite other companies. You can still answer an invitation.
							</p>
						)}

						{myFranchisees.length === 0 ? (
							<p className="text-sm text-slate-500">You have not invited any company yet.</p>
						) : (
							myFranchisees.map((link) => (
								<FranchiseeCard
									key={link.id}
									link={link}
									canManage={canManage && data.franchiseEnabled}
									onCancel={() => run(() => cancelFranchiseInvite(link.id), 'Invitation withdrawn.')}
									onEnd={() => {
										if (confirm(`End the franchise link with ${link.partnerName}? You will stop seeing their figures at once.`)) {
											return run(() => endFranchiseLink(link.id), 'Franchise link ended.');
										}
									}}
									onAskMore={(scopes) => run(() => requestFranchiseScopes(link.id, scopes), 'Your request was sent.')}
								/>
							))
						)}
					</section>

					{myFranchisors.length > 0 && (
						<section aria-label="Companies that franchise you" className="space-y-3">
							<h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Companies that franchise you</h2>
							{myFranchisors.map((link) => (
								<FranchisorCard
									key={link.id}
									link={link}
									canManage={canManage}
									onToggle={(scope, grant) => run(() => decideFranchiseScope(link.id, scope, grant))}
									onEnd={() => {
										if (confirm(`End the franchise link with ${link.partnerName}? They will stop seeing your figures at once.`)) {
											return run(() => endFranchiseLink(link.id), 'Franchise link ended.');
										}
									}}
								/>
							))}
						</section>
					)}
				</>
			)}
		</div>
	);
}

// ── Pieces ──────────────────────────────────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
	return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">{children}</div>;
}

function PartnerHeader({ link }: { link: FranchiseLinkDto }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
					<Network className="h-5 w-5" />
				</div>
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold text-slate-900">{link.partnerName}</p>
					<p className="text-xs text-slate-500">Company code {link.partnerCode}</p>
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

function InvitationCard({
	link,
	canManage,
	onAccept,
	onDecline,
}: {
	link: FranchiseLinkDto;
	canManage: boolean;
	onAccept: (scopes: string[]) => void;
	onDecline: () => void;
}) {
	const [allowed, setAllowed] = useState<string[]>(link.scopes.map((s) => s.scope));
	const toggle = (scope: string) =>
		setAllowed((current) => (current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]));

	return (
		<Card>
			<PartnerHeader link={link} />
			<p className="text-sm text-slate-700">
				<strong>{link.partnerName}</strong> invites you to join their franchise network. If you accept, they can see only what you allow
				below. You can switch any of it off later. The invitation expires on {formatDate(link.expiresAt)}.
			</p>
			<fieldset className="space-y-1.5">
				<legend className="text-xs font-semibold text-slate-600 mb-1">They are asking to see:</legend>
				{link.scopes.map((s) => (
					<div key={s.scope}>
						<Checkbox label={s.label} checked={allowed.includes(s.scope)} onChange={() => toggle(s.scope)} disabled={!canManage} />
					</div>
				))}
			</fieldset>
			{canManage ? (
				<div className="flex flex-wrap gap-2">
					<Button icon={<Check className="h-4 w-4" />} disabled={allowed.length === 0} onClick={() => onAccept(allowed)}>
						Accept
					</Button>
					<Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={onDecline}>
						Decline
					</Button>
				</div>
			) : (
				<p className="text-xs text-slate-500">Only a user who can manage the franchise network can answer this invitation.</p>
			)}
		</Card>
	);
}

function FranchiseeCard({
	link,
	canManage,
	onCancel,
	onEnd,
	onAskMore,
}: {
	link: FranchiseLinkDto;
	canManage: boolean;
	onCancel: () => void;
	onEnd: () => void;
	onAskMore: (scopes: string[]) => void;
}) {
	const [asking, setAsking] = useState(false);
	const [more, setMore] = useState<string[]>([]);
	const askable = FRANCHISE_SCOPE_OPTIONS.filter((o) => {
		const existing = link.scopes.find((s) => s.scope === o.scope);
		return !existing || existing.status === 'Denied';
	});

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
			{canManage && link.status === 'Pending' && (
				<Button variant="secondary" size="sm" icon={<X className="h-4 w-4" />} onClick={onCancel}>
					Withdraw invitation
				</Button>
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

function FranchisorCard({
	link,
	canManage,
	onToggle,
	onEnd,
}: {
	link: FranchiseLinkDto;
	canManage: boolean;
	onToggle: (scope: string, grant: boolean) => void;
	onEnd: () => void;
}) {
	const active = link.status === 'Active';
	return (
		<Card>
			<PartnerHeader link={link} />
			{active ? (
				<>
					<p className="text-sm text-slate-600">What {link.partnerName} can see about your company:</p>
					<ul className="space-y-2">
						{link.scopes.map((s) => (
							<li key={s.scope} className="flex items-center justify-between gap-3 text-sm">
								<span className="text-slate-700">
									{s.label}
									{s.status === 'Requested' && <em className="ml-2 text-xs not-italic font-semibold text-amber-700">New request</em>}
								</span>
								<Switch
									aria-label={s.label}
									checked={s.status === 'Granted'}
									disabled={!canManage}
									onChange={(e) => onToggle(s.scope, e.target.checked)}
								/>
							</li>
						))}
					</ul>
					{canManage && (
						<Button variant="ghost" size="sm" icon={<Link2Off className="h-4 w-4" />} onClick={onEnd}>
							End link
						</Button>
					)}
				</>
			) : (
				<p className="text-xs text-slate-500">
					{link.status === 'Ended' ? `Ended on ${formatDate(link.endedAt)}.` : `${link.status}.`}
				</p>
			)}
		</Card>
	);
}

export default FranchisePage;
