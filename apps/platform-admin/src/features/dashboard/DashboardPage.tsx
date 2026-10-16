import { useProducts, ProductBadge } from '@/features/products/ProductProvider';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Building2, Clock, IndianRupee, Plus, ServerCrash, UserPlus } from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { Button } from '@/components/Button';
import { CompanyStatusBadge } from '@/components/StatusBadge';
import { Card, CardHeader, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/Surface';
import { useAuth, SUPPORT_ROLES } from '@/features/auth/AuthProvider';
import { NewCompanyModal } from '@/features/companies/NewCompanyModal';
import { api } from '@/lib/api';
import { actionLabel } from '@/lib/audit';
import { planName } from '@/lib/catalog';
import { date, dateTime, daysUntil, money } from '@/lib/format';
import type { CompanyListItem, Dashboard } from '@/lib/types';

const DISTRIBUTION: { key: string; label: string; color: string }[] = [
	{ key: 'Active', label: 'Active', color: 'bg-active' },
	{ key: 'Trialing', label: 'In trial', color: 'bg-trial' },
	{ key: 'PastDue', label: 'Past due (grace)', color: 'bg-pastdue' },
	{ key: 'ReadOnly', label: 'Read-only', color: 'bg-readonly' },
	{ key: 'Suspended', label: 'Suspended', color: 'bg-suspended' },
	{ key: 'Canceled', label: 'Canceled', color: 'bg-canceled' },
];

export function DashboardPage() {
	const { key: productKey, products } = useProducts();
	useBreadcrumbs({ label: 'Dashboard' });
	const { can } = useAuth();
	const navigate = useNavigate();
	const [creating, setCreating] = useState(false);
	const dashboard = useQuery({ queryKey: ['dashboard', productKey], queryFn: () => api.dashboard(products.length === 1 ? undefined : productKey) });
	const companies = useQuery({ queryKey: ['companies', productKey], queryFn: () => api.companies(undefined, undefined, productKey) });

	return (
		<>
			<PageHeader
				title="Operations overview"
				description="Subscriptions, money owed and companies that need attention."
				actions={
					can(...SUPPORT_ROLES) && (
						<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
							New company
						</Button>
					)
				}
			/>
			{dashboard.isPending ? (
				<LoadingState />
			) : dashboard.isError ? (
				<ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
			) : (
				<>
					<Kpis data={dashboard.data} />
					<div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
						<div className="xl:col-span-2">
							<Attention companies={companies.data ?? []} loading={companies.isPending} />
						</div>
						<div className="flex flex-col gap-6">
							<Distribution data={dashboard.data} />
							<RecentActivity data={dashboard.data} />
						</div>
					</div>
				</>
			)}
			<NewCompanyModal open={creating} onClose={() => setCreating(false)} onOpenCompany={(id) => navigate(`/companies/${id}`)} />
		</>
	);
}

function Kpi({
	label,
	value,
	detail,
	icon,
	tone = 'text-text-heading',
}: {
	label: string;
	value: React.ReactNode;
	detail?: React.ReactNode;
	icon: React.ReactNode;
	tone?: string;
}) {
	return (
		<Card className="p-5">
			<div className="flex items-start justify-between gap-3">
				<span className="text-label font-semibold tracking-[0.04em] text-text-muted uppercase">{label}</span>
				<span className="text-text-muted">{icon}</span>
			</div>
			<div className={`tabular mt-3 text-display font-bold ${tone}`}>{value}</div>
			{detail && <div className="mt-2 text-label text-text-secondary">{detail}</div>}
		</Card>
	);
}

function Kpis({ data }: { data: Dashboard }) {
	const by = data.subscriptionsByStatus;
	const pastDue = (by.PastDue ?? 0) + (by.ReadOnly ?? 0);
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Kpi
				label="Monthly recurring revenue"
				icon={<IndianRupee className="size-4" />}
				value={money(data.monthlyRecurringRevenueMinor)}
				detail="Paying subscriptions (active and past due); yearly plans counted per month"
			/>
			<Kpi
				label="Companies"
				icon={<Building2 className="size-4" />}
				value={data.companies}
				detail={
					<>
						{by.Active ?? 0} active · {data.awaitingRegistration} awaiting registration
					</>
				}
			/>
			<Kpi
				label="Past due / read-only"
				icon={<AlertTriangle className="size-4" />}
				value={pastDue}
				tone={pastDue > 0 ? 'text-pastdue' : 'text-text-heading'}
				detail={
					<>
						{data.openInvoices} open invoices · {money(data.amountDueMinor)} due
					</>
				}
			/>
			<Kpi
				label="In trial"
				icon={<Clock className="size-4" />}
				value={by.Trialing ?? 0}
				tone="text-trial"
				detail={data.migrationFailures > 0 ? <span className="text-danger">{data.migrationFailures} company databases failed to update</span> : 'Product trial'}
			/>
		</div>
	);
}

interface AttentionRow {
	company: CompanyListItem;
	issue: string;
	when: string | null;
}

function attentionRows(companies: CompanyListItem[]): AttentionRow[] {
	const rows: AttentionRow[] = [];
	for (const c of companies) {
		if (c.migrationFailed) rows.push({ company: c, issue: 'Database update failed', when: null });
		else if (c.companyStatus === 'Suspended' || c.subscriptionStatus === 'Suspended') rows.push({ company: c, issue: 'Suspended', when: null });
		else if (c.subscriptionStatus === 'ReadOnly') rows.push({ company: c, issue: 'Grace ended; read-only until paid', when: c.currentPeriodEnd });
		else if (c.subscriptionStatus === 'PastDue') rows.push({ company: c, issue: 'Payment overdue; in grace', when: c.currentPeriodEnd });
		else if (c.subscriptionStatus === 'Trialing') {
			const left = daysUntil(c.trialEndsAt);
			if (left !== null && left <= 3) rows.push({ company: c, issue: left <= 0 ? 'Trial ended' : `Trial ends in ${left} day${left === 1 ? '' : 's'}`, when: c.trialEndsAt });
		} else if (c.companyStatus === 'AwaitingRegistration') {
			rows.push({ company: c, issue: 'Not registered yet', when: null });
		}
	}
	return rows;
}

function Attention({ companies, loading }: { companies: CompanyListItem[]; loading: boolean }) {
	const rows = useMemo(() => attentionRows(companies), [companies]);
	const navigate = useNavigate();
	return (
		<Card>
			<CardHeader
				title="Needs attention"
				subtitle="Overdue, read-only, suspended, trials ending within 3 days, and companies not yet registered"
				actions={
					<Link to="/companies" className="inline-flex items-center gap-1 text-label text-action hover:text-action-hover">
						All companies <ArrowRight className="size-3.5" />
					</Link>
				}
			/>
			{loading ? (
				<LoadingState />
			) : rows.length === 0 ? (
				<EmptyState title="Nothing needs attention" description="Every company is active or in a trial with time left." />
			) : (
				<table className="w-full text-table">
					<thead>
						<tr className="border-b border-border-subtle text-left text-label font-semibold tracking-[0.04em] text-text-muted uppercase">
							<th className="h-10 px-4">Product</th>
							<th className="h-10 px-5">Company</th>
							<th className="h-10 px-4">Status</th>
							<th className="h-10 px-4">Issue</th>
							<th className="h-10 px-5 text-right">Date</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(({ company, issue, when }) => (
							<tr
								key={company.id}
								tabIndex={0}
								onClick={() => navigate(`/companies/${company.id}`)}
								onKeyDown={(e) => e.key === 'Enter' && navigate(`/companies/${company.id}`)}
								className="h-11 cursor-pointer border-b border-border-hairline last:border-b-0 hover:bg-surface-raised/60"
							>
								<td className="px-4 py-2">
									<ProductBadge productKey={company.productKey} />
								</td>
								<td className="px-5 py-2">
									<div className="font-medium text-text-heading">{company.name}</div>
									<div className="tabular font-mono text-micro text-text-muted">
										{company.code} · {planName(company.plan)}
									</div>
								</td>
								<td className="px-4 py-2">
									<CompanyStatusBadge companyStatus={company.companyStatus} subscriptionStatus={company.subscriptionStatus} />
								</td>
								<td className="px-4 py-2 text-text-secondary">{issue}</td>
								<td className="tabular px-5 py-2 text-right text-text-secondary">{date(when)}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</Card>
	);
}

function Distribution({ data }: { data: Dashboard }) {
	const total = DISTRIBUTION.reduce((sum, d) => sum + (data.subscriptionsByStatus[d.key] ?? 0), 0);
	return (
		<Card>
			<CardHeader title="Subscriptions by status" subtitle={`${total} subscriptions · ${data.awaitingRegistration} awaiting registration`} />
			<div className="px-5 py-4">
				<div className="flex h-2 overflow-hidden rounded-full bg-surface-container" aria-hidden>
					{total > 0 &&
						DISTRIBUTION.map((d) => {
							const n = data.subscriptionsByStatus[d.key] ?? 0;
							return n > 0 ? <div key={d.key} className={d.color} style={{ width: `${(n / total) * 100}%` }} /> : null;
						})}
				</div>
				<ul className="mt-4 flex flex-col gap-2.5">
					{DISTRIBUTION.map((d) => {
						const n = data.subscriptionsByStatus[d.key] ?? 0;
						return (
							<li key={d.key} className="flex items-center justify-between text-label">
								<span className="flex items-center gap-2 text-text-primary">
									<span className={`size-2 rounded-full ${d.color}`} aria-hidden />
									{d.label}
								</span>
								<span className="tabular text-text-secondary">
									<span className="font-semibold text-text-heading">{n}</span>
									{total > 0 && <span className="ml-1.5 text-text-muted">({Math.round((n / total) * 100)}%)</span>}
								</span>
							</li>
						);
					})}
				</ul>
				{data.awaitingRegistration > 0 && (
					<p className="mt-3 flex items-center gap-2 text-label text-registration">
						<UserPlus className="size-3.5" /> {data.awaitingRegistration} companies have not registered yet
					</p>
				)}
				{data.migrationFailures > 0 && (
					<p className="mt-2 flex items-center gap-2 text-label text-danger">
						<ServerCrash className="size-3.5" /> {data.migrationFailures} database updates failed
					</p>
				)}
			</div>
		</Card>
	);
}

function RecentActivity({ data }: { data: Dashboard }) {
	const { can } = useAuth();
	return (
		<Card>
			<CardHeader
				title="Recent activity"
				actions={
					can('Owner') && (
						<Link to="/audit-log" className="inline-flex items-center gap-1 text-label text-action hover:text-action-hover">
							Audit log <ArrowRight className="size-3.5" />
						</Link>
					)
				}
			/>
			{data.recentActivity.length === 0 ? (
				<EmptyState title="No activity yet" />
			) : (
				<ol className="flex flex-col px-5 py-3">
					{data.recentActivity.map((entry) => (
						<li key={entry.id} className="relative border-l border-border-subtle py-2 pl-4">
							<span className="absolute top-3.5 -left-[4.5px] size-2 rounded-full bg-action" aria-hidden />
							<div className="text-label font-medium text-text-heading">
								{actionLabel(entry.action)} <ProductBadge productKey={entry.productKey} />
							</div>
							<div className="text-micro text-text-muted">
								{entry.administratorEmail ?? 'System'} · {dateTime(entry.createdAt)}
							</div>
							{entry.reason && <div className="mt-0.5 text-micro text-text-secondary">“{entry.reason}”</div>}
						</li>
					))}
				</ol>
			)}
		</Card>
	);
}
