import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ArrowLeft,
	ArrowLeftRight,
	Ban,
	CheckCircle2,
	CircleSlash,
	FilePlus2,
	KeyRound,
	MoreHorizontal,
	Pencil,
	Printer,
	RotateCcw,
	XCircle,
} from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { Button, IconButton } from '@/components/Button';
import { CompanyStatusBadge, InvoiceStatusBadge } from '@/components/StatusBadge';
import { Card, CardHeader, DetailList, EmptyState, ErrorState, InlineError, LoadingState } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { useAuth, BILLING_ROLES, SUPPORT_ROLES } from '@/features/auth/AuthProvider';
import { RecordPaymentDialog, VoidInvoiceDialog, type InvoiceRef } from '@/features/invoices/InvoiceDialogs';
import { api, ApiError } from '@/lib/api';
import { BOOLEAN_FEATURES, featureLabel } from '@/lib/catalog';
import { date, dateTime, daysUntil, intervalLabel, money, moneyShort, perInterval } from '@/lib/format';
import type { CompanyDetail, Invoice, SubscriptionEvent } from '@/lib/types';
import { BillingAccountDialog, CancelDialog, ChangeSubscriptionDialog, isSuspended, RegistrationCodeDialog, SuspendDialog } from './CompanyDialogs';

type Tab = 'overview' | 'invoices' | 'history';
type Dialog = 'change' | 'suspend' | 'cancel' | 'code' | 'billing' | null;

export function CompanyDetailPage() {
	const { id = '' } = useParams();
	const [params, setParams] = useSearchParams();
	const tab = (params.get('tab') as Tab) || 'overview';
	const { can } = useAuth();
	const [dialog, setDialog] = useState<Dialog>(null);
	const company = useQuery({ queryKey: ['company', id], queryFn: () => api.company(id) });
	const billing = useQuery({ queryKey: ['company-billing', id], queryFn: () => api.companyBilling(id) });

	useBreadcrumbs({ label: 'Companies', to: '/companies' }, { label: company.data ? `${company.data.code} · ${company.data.name}` : 'Company' });

	if (company.isPending) return <LoadingState />;
	if (company.isError) {
		const notFound = company.error instanceof ApiError && company.error.status === 404;
		return notFound ? (
			<EmptyState title="Company not found" description="It may have been typed wrongly." action={<Link to="/companies" className="text-action">Back to companies</Link>} />
		) : (
			<ErrorState error={company.error} onRetry={() => company.refetch()} />
		);
	}

	const c = company.data;
	const suspended = isSuspended(c);
	const awaiting = c.companyStatus === 'AwaitingRegistration';
	const canceled = c.subscription?.status === 'Canceled';
	const openInvoices = billing.data?.invoices.filter((i) => i.status === 'Open').length ?? 0;

	function setTab(next: Tab) {
		const p = new URLSearchParams(params);
		if (next === 'overview') p.delete('tab');
		else p.set('tab', next);
		setParams(p, { replace: true });
	}

	const menu: MenuItem[] = [];
	if (awaiting && can(...SUPPORT_ROLES)) menu.push({ label: 'New registration code', icon: <KeyRound className="size-4" />, onSelect: () => setDialog('code') });
	if (can(...BILLING_ROLES)) menu.push({ label: 'Edit billing details', icon: <Pencil className="size-4" />, onSelect: () => setDialog('billing') });
	if (c.subscription && !canceled && can(...BILLING_ROLES)) {
		menu.push({ label: 'Cancel subscription', icon: <XCircle className="size-4" />, danger: true, onSelect: () => setDialog('cancel') });
	}

	return (
		<>
			<Link to="/companies" className="mb-3 inline-flex items-center gap-1.5 text-label text-text-muted hover:text-text-heading">
				<ArrowLeft className="size-3.5" /> Companies
			</Link>
			<div className="mb-5 flex flex-wrap items-start justify-between gap-4">
				<div className="flex min-w-0 items-center gap-4">
					<span className="tabular flex size-12 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-card font-mono text-title font-semibold text-text-heading">
						{c.code.slice(-2)}
					</span>
					<div className="min-w-0">
						<h1 className="flex flex-wrap items-center gap-3 text-headline font-semibold text-text-heading">
							<span className="tabular font-mono">{c.code}</span>
							<span className="text-text-muted">·</span>
							<span className="truncate">{c.name}</span>
						</h1>
						<div className="mt-1 flex flex-wrap items-center gap-2 text-label text-text-muted">
							<CompanyStatusBadge companyStatus={c.companyStatus} subscriptionStatus={c.subscription?.status ?? null} />
							<span>Created {date(c.createdAt)}</span>
							{c.registeredAt && <span>· Registered {date(c.registeredAt)}</span>}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{c.subscription && !canceled && can(...BILLING_ROLES) && (
						<Button icon={<ArrowLeftRight className="size-4" />} onClick={() => setDialog('change')}>
							Change plan
						</Button>
					)}
					{c.subscription && can(...SUPPORT_ROLES) &&
						(suspended ? (
							<Button variant="primary" icon={<RotateCcw className="size-4" />} onClick={() => setDialog('suspend')}>
								Reactivate
							</Button>
						) : (
							!canceled && (
								<Button variant="danger" icon={<Ban className="size-4" />} onClick={() => setDialog('suspend')}>
									Suspend
								</Button>
							)
						))}
					{menu.length > 0 && <ActionsMenu items={menu} />}
				</div>
			</div>

			<div role="tablist" aria-label="Company sections" className="mb-5 flex gap-1 border-b border-border-subtle">
				{(
					[
						['overview', 'Overview'],
						['invoices', `Invoices${billing.data ? ` (${billing.data.invoices.length})` : ''}`],
						['history', 'History'],
					] as [Tab, string][]
				).map(([key, label]) => (
					<button
						key={key}
						type="button"
						role="tab"
						aria-selected={tab === key}
						onClick={() => setTab(key)}
						className={`-mb-px h-10 border-b-2 px-4 text-body font-medium transition-colors ${tab === key ? 'border-action text-text-heading' : 'border-transparent text-text-secondary hover:text-text-heading'}`}
					>
						{label}
						{key === 'invoices' && openInvoices > 0 && <span className="ml-2 rounded-full bg-pastdue-bg px-1.5 text-micro text-pastdue">{openInvoices} open</span>}
					</button>
				))}
			</div>

			{tab === 'overview' && <Overview company={c} onEditBilling={can(...BILLING_ROLES) ? () => setDialog('billing') : undefined} />}
			{tab === 'invoices' && <InvoicesTab company={c} invoices={billing.data?.invoices} loading={billing.isPending} error={billing.error} />}
			{tab === 'history' && <HistoryTab events={billing.data?.events} loading={billing.isPending} error={billing.error} />}

			<ChangeSubscriptionDialog company={c} open={dialog === 'change'} onClose={() => setDialog(null)} />
			<SuspendDialog company={c} open={dialog === 'suspend'} onClose={() => setDialog(null)} />
			<CancelDialog company={c} open={dialog === 'cancel'} onClose={() => setDialog(null)} />
			<RegistrationCodeDialog company={c} open={dialog === 'code'} onClose={() => setDialog(null)} />
			<BillingAccountDialog company={c} open={dialog === 'billing'} onClose={() => setDialog(null)} />
		</>
	);
}

interface MenuItem {
	label: string;
	icon: React.ReactNode;
	danger?: boolean;
	onSelect: () => void;
}

function ActionsMenu({ items }: { items: MenuItem[] }) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent | KeyboardEvent) => {
			if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener('mousedown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('mousedown', close);
			document.removeEventListener('keydown', close);
		};
	}, [open]);
	return (
		<div ref={root} className="relative">
			<IconButton label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="size-9 border border-border-subtle">
				<MoreHorizontal className="size-4" />
			</IconButton>
			{open && (
				<div role="menu" className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-border-strong bg-surface-raised p-1 shadow-xl shadow-black/50">
					{items.map((item) => (
						<button
							key={item.label}
							type="button"
							role="menuitem"
							onClick={() => {
								setOpen(false);
								item.onSelect();
							}}
							className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-body ${item.danger ? 'text-danger hover:bg-danger-strong/10' : 'text-text-primary hover:bg-surface-container'}`}
						>
							{item.icon}
							{item.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function Overview({ company: c, onEditBilling }: { company: CompanyDetail; onEditBilling?: () => void }) {
	const s = c.subscription;
	const seatPercent = c.seatLimit && c.seatsUsed !== null ? Math.min(100, Math.round((c.seatsUsed / c.seatLimit) * 100)) : 0;
	const branches = c.features['franchise_network.max_branches'];

	let periodNote: React.ReactNode = null;
	if (s) {
		if (s.status === 'Trialing' && s.trialEndsAt) {
			const left = daysUntil(s.trialEndsAt) ?? 0;
			periodNote = <span className="text-trial">{left > 0 ? `Trial ends in ${left} day${left === 1 ? '' : 's'}` : 'Trial ended'}</span>;
		} else if (s.status === 'PastDue' && s.graceEndsAt) {
			periodNote = <span className="text-pastdue">Grace ends {date(s.graceEndsAt)}; then read-only</span>;
		} else if (s.status === 'ReadOnly') {
			periodNote = <span className="text-readonly">Read-only until an invoice is paid</span>;
		} else if (s.status === 'Canceled' && s.retainUntil) {
			periodNote = <span className="text-text-secondary">Data kept read-only until {date(s.retainUntil)}</span>;
		} else if (s.cancelAtPeriodEnd) {
			periodNote = <span className="text-pastdue">Ends on {date(s.currentPeriodEnd)} (canceled)</span>;
		} else if (s.status === 'Active') {
			const left = daysUntil(s.currentPeriodEnd) ?? 0;
			periodNote = <span className="text-active">Renews in {left} day{left === 1 ? '' : 's'}</span>;
		}
	}

	return (
		<div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
			<Card>
				<CardHeader title="Subscription and features" />
				{!s ? (
					<EmptyState title="No subscription" />
				) : (
					<div className="flex flex-col gap-5 p-5">
						<div className="grid grid-cols-1 gap-4 rounded-lg border border-border-subtle bg-surface-alt p-4 sm:grid-cols-3">
							<div>
								<div className="text-micro font-medium tracking-wide text-text-muted uppercase">Plan</div>
								<div className="mt-1 text-title font-semibold text-text-heading">{s.planName}</div>
								<div className="tabular text-label text-text-secondary">
									{s.status === 'Trialing' ? 'Free trial' : `${moneyShort(s.priceMinor, s.currency)}${perInterval(s.interval)} · ${intervalLabel(s.interval)}`}
								</div>
							</div>
							<div className="sm:col-span-2">
								<div className="text-micro font-medium tracking-wide text-text-muted uppercase">Current period</div>
								<div className="tabular mt-1 text-body text-text-heading">
									{date(s.currentPeriodStart)} – {date(s.currentPeriodEnd)}
								</div>
								<div className="mt-0.5 text-label">{periodNote}</div>
							</div>
						</div>

						<div>
							<div className="mb-2 text-micro font-medium tracking-wide text-text-muted uppercase">Add-ons</div>
							{s.addOns.length === 0 ? (
								<p className="text-label text-text-muted">None</p>
							) : (
								<div className="flex flex-wrap gap-2">
									{s.addOns.map((a) => (
										<span key={a.code} className="rounded-md border border-border-subtle bg-surface-alt px-2.5 py-1 text-label text-text-primary">
											{a.name}
											{a.quantity > 1 && <span className="ml-1.5 text-text-muted">× {a.quantity}</span>}
										</span>
									))}
								</div>
							)}
						</div>

						{c.seatLimit !== null && (
							<div className="rounded-lg border border-border-subtle bg-surface-alt p-4">
								<div className="flex items-center justify-between text-body">
									<span className="font-medium text-text-heading">Users</span>
									<span className="tabular text-label text-text-secondary">
										{c.seatsUsed ?? '—'} of {c.seatLimit} in use
									</span>
								</div>
								<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container">
									<div className={`h-full rounded-full ${seatPercent >= 100 ? 'bg-pastdue' : 'bg-action'}`} style={{ width: `${seatPercent}%` }} />
								</div>
								{c.seatsUsed === null && (
									<p className="mt-2 text-micro text-text-muted">
										{c.registeredAt ? 'Could not be counted right now (the company’s database did not answer).' : 'Counted after the company registers.'}
									</p>
								)}
							</div>
						)}

						<div>
							<div className="mb-2 text-micro font-medium tracking-wide text-text-muted uppercase">Features</div>
							<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{BOOLEAN_FEATURES.map((key) => {
									const on = c.features[key] === 'true';
									return (
										<li
											key={key}
											className={`flex items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2 text-body ${on ? 'bg-surface-alt text-text-heading' : 'text-text-muted'}`}
										>
											<span className="flex items-center gap-2">
												{on ? <CheckCircle2 className="size-4 text-active" /> : <CircleSlash className="size-4" />}
												{featureLabel(key)}
											</span>
											<span className="text-micro text-text-muted">
												{on ? (key === 'franchise_network.enabled' && branches ? `${branches} branches` : 'On') : 'Not included'}
											</span>
										</li>
									);
								})}
							</ul>
						</div>
					</div>
				)}
			</Card>

			<div className="flex flex-col gap-6">
				<Card>
					<CardHeader title="System" />
					<div className="p-5">
						<DetailList
							items={[
								{ label: 'Company code', value: <span className="tabular font-mono">{c.code}</span> },
								{ label: 'Registered', value: c.registeredAt ? dateTime(c.registeredAt) : c.registrationCodeOpen ? 'Not yet (code issued)' : 'Not yet' },
								{ label: 'Database', value: <span className="font-mono text-label">{c.databaseName}</span> },
								{ label: 'Schema version', value: <span className="font-mono text-label">{c.schemaVersion ?? '—'}</span> },
							]}
						/>
						{c.migrationError && (
							<div className="mt-4">
								<InlineError message={`Last database update failed: ${c.migrationError}`} />
							</div>
						)}
					</div>
				</Card>

				<Card>
					<CardHeader
						title="Billing details"
						actions={
							onEditBilling && (
								<Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={onEditBilling}>
									Edit
								</Button>
							)
						}
					/>
					<div className="p-5">
						{c.billingAccount ? (
							<DetailList
								items={[
									{ label: 'Billing name', value: c.billingAccount.billingName },
									{ label: 'Email', value: c.billingAccount.billingEmail || '—' },
									{ label: 'Phone', value: c.billingAccount.billingPhone || '—' },
									{ label: 'GSTIN', value: c.billingAccount.gstin ? <span className="font-mono">{c.billingAccount.gstin}</span> : '—' },
									{ label: 'Address', value: c.billingAccount.billingAddress || '—' },
									{ label: 'State code', value: c.billingAccount.stateCode || '—' },
								]}
							/>
						) : (
							<p className="text-label text-text-muted">No billing details yet.</p>
						)}
					</div>
				</Card>
			</div>
		</div>
	);
}

function toRef(invoice: Invoice, company: CompanyDetail): InvoiceRef {
	return { id: invoice.id, invoiceNumber: invoice.invoiceNumber, amountDueMinor: invoice.amountDueMinor, totalMinor: invoice.totalMinor, currency: invoice.currency, companyName: company.name };
}

function InvoicesTab({ company, invoices, loading, error }: { company: CompanyDetail; invoices?: Invoice[]; loading: boolean; error: Error | null }) {
	const { can } = useAuth();
	const toast = useToast();
	const queryClient = useQueryClient();
	const [paying, setPaying] = useState<InvoiceRef | null>(null);
	const [voiding, setVoiding] = useState<InvoiceRef | null>(null);
	const billingRole = can(...BILLING_ROLES);
	const issue = useMutation({
		mutationFn: () => api.issueInvoice(company.id),
		onSuccess: (invoice) => {
			queryClient.invalidateQueries({ queryKey: ['company-billing', company.id] });
			queryClient.invalidateQueries({ queryKey: ['invoices'] });
			queryClient.invalidateQueries({ queryKey: ['dashboard'] });
			toast.success(`Invoice ${invoice.invoiceNumber} issued for ${money(invoice.totalMinor, invoice.currency)}.`);
		},
		onError: (e) => toast.error(e.message),
	});

	if (loading) return <LoadingState />;
	if (error) return <ErrorState error={error} />;
	const list = invoices ?? [];
	const paidTotal = list.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.totalMinor, 0);
	const due = list.filter((i) => i.status === 'Open').reduce((s, i) => s + i.amountDueMinor, 0);
	const now = Date.now();

	return (
		<>
			<div className="mb-5 flex flex-wrap items-end justify-between gap-4">
				<div className="grid grid-cols-2 gap-4 sm:w-[480px]">
					<Card className="p-4">
						<div className="text-micro font-semibold tracking-[0.04em] text-text-muted uppercase">Paid in total</div>
						<div className="tabular mt-1 text-headline font-bold text-text-heading">{money(paidTotal)}</div>
					</Card>
					<Card className="p-4">
						<div className="text-micro font-semibold tracking-[0.04em] text-text-muted uppercase">Due now</div>
						<div className={`tabular mt-1 text-headline font-bold ${due > 0 ? 'text-pastdue' : 'text-text-heading'}`}>{money(due)}</div>
					</Card>
				</div>
				{billingRole && company.subscription && company.subscription.status !== 'Canceled' && (
					<Button variant="primary" icon={<FilePlus2 className="size-4" />} loading={issue.isPending} onClick={() => issue.mutate()}>
						Issue next invoice
					</Button>
				)}
			</div>
			<Card>
				{list.length === 0 ? (
					<EmptyState title="No invoices yet" description="Renewal invoices are issued automatically 7 days before the period ends (3 days for a trial)." />
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-table">
							<thead>
								<tr className="border-b border-border-subtle text-left text-label font-semibold tracking-[0.04em] whitespace-nowrap text-text-muted uppercase">
									<th className="h-10 px-4">Invoice</th>
									<th className="h-10 px-4">Period</th>
									<th className="h-10 px-4">Issued</th>
									<th className="h-10 px-4">Due</th>
									<th className="h-10 px-4 text-right">Amount</th>
									<th className="h-10 px-4 text-right">Paid</th>
									<th className="h-10 px-4">Status</th>
									<th className="h-10 px-4 text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{list.map((inv) => {
									const overdue = inv.status === 'Open' && new Date(inv.dueAt).getTime() < now;
									const paid = inv.totalMinor - inv.amountDueMinor;
									const voidable = inv.status === 'Open' && inv.amountDueMinor === inv.totalMinor;
									return (
										<tr key={inv.id} className={`h-11 border-b border-border-hairline last:border-b-0 ${inv.status === 'Void' ? 'text-text-muted' : ''}`}>
											<td className="px-4 py-2">
												<span className={`tabular font-mono ${inv.status === 'Void' ? 'line-through' : 'text-text-heading'}`}>{inv.invoiceNumber}</span>
											</td>
											<td className="tabular px-4 py-2 whitespace-nowrap text-text-secondary">
												{inv.periodStart ? `${date(inv.periodStart)} – ${date(inv.periodEnd)}` : '—'}
											</td>
											<td className="tabular px-4 py-2 whitespace-nowrap">{date(inv.issuedAt)}</td>
											<td className={`tabular px-4 py-2 whitespace-nowrap ${overdue ? 'text-danger' : ''}`}>{date(inv.dueAt)}</td>
											<td className="tabular px-4 py-2 text-right">{money(inv.totalMinor, inv.currency)}</td>
											<td className={`tabular px-4 py-2 text-right ${paid > 0 ? 'text-active' : 'text-text-muted'}`}>{money(paid, inv.currency)}</td>
											<td className="px-4 py-2">
												<InvoiceStatusBadge status={inv.status} overdue={overdue} />
											</td>
											<td className="px-4 py-2">
												<div className="flex items-center justify-end gap-1">
													{billingRole && inv.status === 'Open' && (
														<Button size="sm" variant="primary" onClick={() => setPaying(toRef(inv, company))}>
															Record payment
														</Button>
													)}
													<Link
														to={`/invoices/${inv.id}/print`}
														aria-label={`Print ${inv.invoiceNumber}`}
														title="Print"
														className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-raised hover:text-text-heading"
													>
														<Printer className="size-4" />
													</Link>
													{billingRole && voidable && (
														<IconButton label={`Void ${inv.invoiceNumber}`} onClick={() => setVoiding(toRef(inv, company))}>
															<XCircle className="size-4" />
														</IconButton>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</Card>
			<RecordPaymentDialog invoice={paying} onClose={() => setPaying(null)} />
			<VoidInvoiceDialog invoice={voiding} onClose={() => setVoiding(null)} />
		</>
	);
}

const EVENT_LABELS: Record<string, string> = {
	trial_started: 'Trial started',
	activated: 'Paid and active',
	changed: 'Plan or add-ons changed',
	invoice_issued: 'Invoice issued',
	trial_ended_unpaid: 'Trial ended without payment (grace started)',
	period_ended_unpaid: 'Period ended unpaid (grace started)',
	grace_ended_unpaid: 'Grace ended unpaid (read-only)',
	suspended: 'Suspended',
	reactivated: 'Reactivated',
	cancel_scheduled: 'Cancellation scheduled for the period end',
	canceled: 'Canceled',
};

const ACTORS: Record<string, string> = { Admin: 'a Trovo admin', System: 'the system', Gateway: 'the payment gateway', Owner: 'the company owner' };

function eventLabel(type: string): string {
	return EVENT_LABELS[type] ?? type.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase());
}

function HistoryTab({ events, loading, error }: { events?: SubscriptionEvent[]; loading: boolean; error: Error | null }) {
	if (loading) return <LoadingState />;
	if (error) return <ErrorState error={error} />;
	const list = [...(events ?? [])].sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt));
	return (
		<Card>
			<CardHeader title="Subscription history" subtitle="Every change to this company’s subscription, newest first. This record cannot be edited." />
			{list.length === 0 ? (
				<EmptyState title="No history yet" />
			) : (
				<ol className="flex flex-col px-5 py-3">
					{list.map((e, index) => (
						<li key={`${e.effectiveAt}-${index}`} className="relative border-l border-border-subtle py-2.5 pl-5">
							<span className="absolute top-4 -left-[4.5px] size-2 rounded-full bg-action" aria-hidden />
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<span className="text-body font-medium text-text-heading">{eventLabel(e.eventType)}</span>
								<span className="tabular text-label text-text-muted">{dateTime(e.effectiveAt)}</span>
							</div>
							<div className="text-label text-text-muted">By {ACTORS[e.actorType] ?? e.actorType}</div>
							{e.metadata && <EventDetails metadata={e.metadata} />}
						</li>
					))}
				</ol>
			)}
		</Card>
	);
}

function EventDetails({ metadata }: { metadata: string }) {
	const [open, setOpen] = useState(false);
	let text = metadata;
	try {
		text = JSON.stringify(JSON.parse(metadata), null, 2);
	} catch {
		// keep the raw text
	}
	return (
		<div className="mt-1">
			<button type="button" onClick={() => setOpen((o) => !o)} className="text-micro text-action hover:text-action-hover">
				{open ? 'Hide details' : 'Show details'}
			</button>
			{open && <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border-subtle bg-surface-alt p-3 font-mono text-micro text-text-secondary">{text}</pre>}
		</div>
	);
}
