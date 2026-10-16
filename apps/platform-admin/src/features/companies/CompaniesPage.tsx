import { useProducts, ProductBadge } from '@/features/products/ProductProvider';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Plus, Search } from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { Button } from '@/components/Button';
import { DataTable } from '@/components/DataTable';
import { SelectField } from '@/components/Field';
import { CompanyStatusBadge } from '@/components/StatusBadge';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/Surface';
import { useAuth, SUPPORT_ROLES } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { planName, seatQuantities, totalSeats } from '@/lib/catalog';
import { csvDate, downloadCsv, todayStamp } from '@/lib/csv';
import { date, daysUntil, intervalLabel } from '@/lib/format';
import type { CompanyListItem } from '@/lib/types';
import { NewCompanyModal } from './NewCompanyModal';

/** The filter chips: subscription statuses plus "awaiting registration" (a company state). */
const FILTERS: { key: string; label: string; dot: string; match: (c: CompanyListItem) => boolean }[] = [
	{ key: 'all', label: 'All', dot: 'bg-text-primary', match: () => true },
	{ key: 'Trialing', label: 'Trial', dot: 'bg-trial', match: (c) => c.subscriptionStatus === 'Trialing' && c.companyStatus !== 'AwaitingRegistration' },
	{ key: 'Active', label: 'Active', dot: 'bg-active', match: (c) => c.subscriptionStatus === 'Active' && c.companyStatus === 'Active' },
	{ key: 'PastDue', label: 'Past due', dot: 'bg-pastdue', match: (c) => c.subscriptionStatus === 'PastDue' },
	{ key: 'ReadOnly', label: 'Read-only', dot: 'bg-readonly', match: (c) => c.subscriptionStatus === 'ReadOnly' },
	{ key: 'Suspended', label: 'Suspended', dot: 'bg-suspended', match: (c) => c.companyStatus === 'Suspended' || c.subscriptionStatus === 'Suspended' },
	{ key: 'AwaitingRegistration', label: 'Awaiting registration', dot: 'bg-registration', match: (c) => c.companyStatus === 'AwaitingRegistration' },
	{ key: 'Canceled', label: 'Canceled', dot: 'bg-canceled', match: (c) => c.subscriptionStatus === 'Canceled' },
];

function statusText(c: CompanyListItem): string {
	if (c.companyStatus === 'AwaitingRegistration') return 'Awaiting registration';
	if (c.companyStatus === 'Suspended') return 'Suspended';
	return c.subscriptionStatus ?? 'No subscription';
}

export function CompaniesPage() {
	const { key: productKey, products } = useProducts();
	useBreadcrumbs({ label: 'Companies' });
	const { can } = useAuth();
	const navigate = useNavigate();
	const [params, setParams] = useSearchParams();
	const search = params.get('search') ?? '';
	const filter = params.get('status') ?? 'all';
	const plan = params.get('plan') ?? 'all';
	const [creating, setCreating] = useState(false);

	// The whole list is small (one row per customer), so it is loaded once and filtered here.
	const companies = useQuery({ queryKey: ['companies', productKey], queryFn: () => api.companies(undefined, undefined, productKey) });

	function setParam(key: string, value: string, empty: string) {
		const next = new URLSearchParams(params);
		if (value === empty) next.delete(key);
		else next.set(key, value);
		setParams(next, { replace: true });
	}

	const all = companies.data ?? [];
	const plans = useMemo(() => Array.from(new Set(all.map((c) => c.plan).filter((p): p is string => !!p))).sort(), [all]);
	const searched = useMemo(() => {
		const term = search.trim().toLowerCase();
		return all.filter((c) => (!term || c.code.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)) && (plan === 'all' || c.plan === plan));
	}, [all, search, plan]);
	const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]!;
	const rows = useMemo(() => searched.filter(activeFilter.match), [searched, activeFilter]);

	const columns = useMemo<ColumnDef<CompanyListItem, unknown>[]>(
		() => [
			{ accessorKey: 'productKey', header: 'Product', cell: ({ row }) => <ProductBadge productKey={row.original.productKey} /> },
			{
				accessorKey: 'code',
				header: 'Code',
				cell: ({ row }) => <span className="tabular font-mono text-text-secondary">{row.original.code}</span>,
			},
			{
				accessorKey: 'name',
				header: 'Company',
				cell: ({ row }) => (
					<span className="flex items-center gap-2">
						<span className="font-medium text-text-heading">{row.original.name}</span>
						{row.original.migrationFailed && <span className="text-micro text-danger">DB update failed</span>}
					</span>
				),
			},
			{
				id: 'plan',
				accessorFn: (c) => c.plan ?? '',
				header: 'Plan',
				cell: ({ row }) =>
					row.original.plan ? (
						<span>
							<span className="text-text-heading">{planName(row.original.plan)}</span>
							<span className="ml-2 text-label text-text-muted">{row.original.subscriptionStatus === 'Trialing' ? 'Trial' : intervalLabel(row.original.interval)}</span>
						</span>
					) : (
						<span className="text-text-muted">—</span>
					),
			},
			{
				id: 'seats',
				header: 'Seats',
				meta: { align: 'right' },
				cell: ({ row }) => (
					<span className="tabular text-text-secondary">
						{products.find((p) => p.key === row.original.productKey)?.seatModel === 'None' ? 'Unlimited' : totalSeats(seatQuantities(row.original.seats))}
					</span>
				),
			},
			{
				id: 'status',
				accessorFn: statusText,
				header: 'Status',
				cell: ({ row }) => <CompanyStatusBadge companyStatus={row.original.companyStatus} subscriptionStatus={row.original.subscriptionStatus} />,
			},
			{
				id: 'renews',
				accessorFn: (c) => (c.subscriptionStatus === 'Trialing' ? '' : (c.currentPeriodEnd ?? '')),
				header: 'Renews / ends',
				cell: ({ row }) => {
					const c = row.original;
					if (c.subscriptionStatus === 'Trialing' || !c.currentPeriodEnd) return <span className="text-text-muted">—</span>;
					const late = c.subscriptionStatus === 'PastDue' || c.subscriptionStatus === 'ReadOnly';
					return <span className={`tabular ${late ? 'text-pastdue' : ''}`}>{date(c.currentPeriodEnd)}</span>;
				},
			},
			{
				id: 'trial',
				accessorFn: (c) => (c.subscriptionStatus === 'Trialing' ? (c.trialEndsAt ?? '') : ''),
				header: 'Trial ends',
				cell: ({ row }) => {
					const c = row.original;
					if (c.subscriptionStatus !== 'Trialing' || !c.trialEndsAt) return <span className="text-text-muted">—</span>;
					const left = daysUntil(c.trialEndsAt) ?? 0;
					return <span className={`tabular ${left <= 2 ? 'text-pastdue' : 'text-trial'}`}>{date(c.trialEndsAt)}</span>;
				},
			},
			{
				accessorKey: 'createdAt',
				header: 'Created',
				cell: ({ row }) => <span className="tabular text-text-secondary">{date(row.original.createdAt)}</span>,
			},
		],
		[products],
	);

	function exportCsv() {
		downloadCsv(
			`trovo-companies-${todayStamp()}.csv`,
			['Code', 'Company', 'Company status', 'Subscription status', 'Plan', 'Billing', 'Seats', 'Renews / ends', 'Trial ends', 'Created', 'Database update failed', 'Product'],
			rows.map((c) => [
				c.code,
				c.name,
				c.companyStatus,
				c.subscriptionStatus ?? '',
				c.plan ? planName(c.plan) : '',
				c.interval ? intervalLabel(c.interval) : '',
				products.find((p) => p.key === c.productKey)?.seatModel === 'None' ? 'Unlimited' : totalSeats(seatQuantities(c.seats)),
				csvDate(c.currentPeriodEnd),
				csvDate(c.trialEndsAt),
				csvDate(c.createdAt),
				c.migrationFailed ? 'Yes' : 'No',
				c.productKey,
			]),
		);
	}

	return (
		<>
			<PageHeader
				title="Companies"
				description={companies.data ? `${all.length} companies on Trovo` : 'Companies on Trovo'}
				actions={
					<>
						<Button icon={<Download className="size-4" />} onClick={exportCsv} disabled={rows.length === 0}>
							Export CSV
						</Button>
						{can(...SUPPORT_ROLES) && (
							<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
								New company
							</Button>
						)}
					</>
				}
			/>

			<div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
				{FILTERS.map((f) => {
					const count = searched.filter(f.match).length;
					const selected = f.key === activeFilter.key;
					return (
						<button
							key={f.key}
							type="button"
							role="tab"
							aria-selected={selected}
							onClick={() => setParam('status', f.key, 'all')}
							className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-label font-medium transition-colors ${
								selected ? 'border-border-strong bg-surface-raised text-text-heading' : 'border-border-subtle bg-surface-card text-text-secondary hover:text-text-heading'
							}`}
						>
							<span className={`size-1.5 rounded-full ${f.dot}`} aria-hidden />
							{f.label}
							<span className="tabular rounded bg-surface-container px-1.5 text-micro text-text-secondary">{count}</span>
						</button>
					);
				})}
			</div>

			<Card>
				<div className="flex flex-wrap items-end gap-3 border-b border-border-subtle p-4">
					<div className="relative min-w-60 flex-1">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
						<input
							type="search"
							aria-label="Filter by code or name"
							placeholder="Filter by code or name (e.g. 0002, Sunrise)…"
							value={search}
							onChange={(e) => setParam('search', e.target.value, '')}
							className="h-9 w-full rounded-md border border-border-subtle bg-surface-alt pr-3 pl-9 text-body text-text-heading placeholder:text-text-muted focus:border-action focus:ring-1 focus:ring-action focus:outline-none"
						/>
					</div>
					<SelectField aria-label="Plan" value={plan} onChange={(e) => setParam('plan', e.target.value, 'all')} containerClassName="w-48">
						<option value="all">All plans</option>
						{plans.map((p) => (
							<option key={p} value={p}>
								{planName(p)}
							</option>
						))}
					</SelectField>
				</div>
				{companies.isPending ? (
					<LoadingState />
				) : companies.isError ? (
					<ErrorState error={companies.error} onRetry={() => companies.refetch()} />
				) : (
					<DataTable
						data={rows}
						columns={columns}
						noun="companies"
						onRowClick={(c) => navigate(`/companies/${c.id}`)}
						rowLabel={(c) => `Open ${c.code} ${c.name}`}
						empty={
							<EmptyState
								title={all.length === 0 ? 'No companies yet' : 'No companies match'}
								description={all.length === 0 ? 'Create the first company to give a customer their registration code.' : 'Change the search or the status filter.'}
							/>
						}
					/>
				)}
			</Card>

			<NewCompanyModal open={creating} onClose={() => setCreating(false)} onOpenCompany={(id) => navigate(`/companies/${id}`)} />
		</>
	);
}
