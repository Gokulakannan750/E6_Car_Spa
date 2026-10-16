import { useProducts, ProductBadge } from '@/features/products/ProductProvider';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Printer, Search } from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { Button } from '@/components/Button';
import { DataTable } from '@/components/DataTable';
import { InvoiceStatusBadge } from '@/components/StatusBadge';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/Surface';
import { useAuth, BILLING_ROLES } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { csvDate, csvRupees, downloadCsv, todayStamp } from '@/lib/csv';
import { date, money } from '@/lib/format';
import type { InvoiceListItem } from '@/lib/types';
import { RecordPaymentDialog, type InvoiceRef } from './InvoiceDialogs';

const STATUSES = [
	{ key: '', label: 'All' },
	{ key: 'open', label: 'Open' },
	{ key: 'overdue', label: 'Overdue' },
	{ key: 'paid', label: 'Paid' },
	{ key: 'void', label: 'Void' },
];

export function InvoicesPage() {
	const { key: productKey } = useProducts();
	useBreadcrumbs({ label: 'Invoices' });
	const { can } = useAuth();
	const [params, setParams] = useSearchParams();
	const status = params.get('status') ?? '';
	const search = params.get('search') ?? '';
	const [paying, setPaying] = useState<InvoiceRef | null>(null);
	const billingRole = can(...BILLING_ROLES);

	// Status is filtered by the API (it knows what is overdue); the search box filters the loaded rows.
	const invoices = useQuery({ queryKey: ['invoices', productKey, status], queryFn: () => api.invoices({ status: status || undefined, product: productKey }) });

	function setParam(key: string, value: string) {
		const next = new URLSearchParams(params);
		if (!value) next.delete(key);
		else next.set(key, value);
		setParams(next, { replace: true });
	}

	const rows = useMemo(() => {
		const term = search.trim().toLowerCase();
		const all = invoices.data ?? [];
		return term ? all.filter((i) => i.invoiceNumber.toLowerCase().includes(term) || i.companyCode.toLowerCase().includes(term) || i.companyName.toLowerCase().includes(term)) : all;
	}, [invoices.data, search]);
	const dueTotal = rows.filter((i) => i.status === 'Open').reduce((s, i) => s + i.amountDueMinor, 0);

	const columns = useMemo<ColumnDef<InvoiceListItem, unknown>[]>(
		() => [
			{ accessorKey: 'productKey', header: 'Product', cell: ({ row }) => <ProductBadge productKey={row.original.productKey} /> },
			{
				accessorKey: 'invoiceNumber',
				header: 'Invoice',
				cell: ({ row }) => (
					<span className={`tabular font-mono ${row.original.status === 'Void' ? 'text-text-muted line-through' : 'text-text-heading'}`}>{row.original.invoiceNumber}</span>
				),
			},
			{
				id: 'company',
				accessorFn: (i) => i.companyName,
				header: 'Company',
				cell: ({ row }) => (
					<Link to={`/companies/${row.original.companyId}?tab=invoices`} className="hover:text-action">
						<span className="tabular mr-2 font-mono text-text-muted">{row.original.companyCode}</span>
						<span className="text-text-heading">{row.original.companyName}</span>
					</Link>
				),
			},
			{
				id: 'period',
				accessorFn: (i) => i.periodStart ?? '',
				header: 'Period',
				cell: ({ row }) => (
					<span className="tabular whitespace-nowrap text-text-secondary">
						{row.original.periodStart ? `${date(row.original.periodStart)} – ${date(row.original.periodEnd)}` : '—'}
					</span>
				),
			},
			{ accessorKey: 'issuedAt', header: 'Issued', cell: ({ row }) => <span className="tabular whitespace-nowrap">{date(row.original.issuedAt)}</span> },
			{
				accessorKey: 'dueAt',
				header: 'Due',
				cell: ({ row }) => <span className={`tabular whitespace-nowrap ${row.original.overdue ? 'text-danger' : ''}`}>{date(row.original.dueAt)}</span>,
			},
			{
				accessorKey: 'totalMinor',
				header: 'Amount',
				meta: { align: 'right' },
				cell: ({ row }) => <span className="tabular">{money(row.original.totalMinor, row.original.currency)}</span>,
			},
			{
				accessorKey: 'amountDueMinor',
				header: 'Due now',
				meta: { align: 'right' },
				cell: ({ row }) => (
					<span className={`tabular ${row.original.amountDueMinor > 0 ? 'text-pastdue' : 'text-text-muted'}`}>{money(row.original.amountDueMinor, row.original.currency)}</span>
				),
			},
			{
				id: 'status',
				accessorFn: (i) => (i.overdue ? 'Overdue' : i.status),
				header: 'Status',
				cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} overdue={row.original.overdue} />,
			},
			{
				id: 'actions',
				header: () => <span className="sr-only">Actions</span>,
				enableSorting: false,
				meta: { align: 'right' },
				cell: ({ row }) => {
					const i = row.original;
					return (
						<div className="flex items-center justify-end gap-1">
							{billingRole && i.status === 'Open' && (
								<Button
									size="sm"
									variant="primary"
									onClick={() =>
										setPaying({
											id: i.id,
											invoiceNumber: i.invoiceNumber,
											amountDueMinor: i.amountDueMinor,
											totalMinor: i.totalMinor,
											currency: i.currency,
											companyName: i.companyName,
										})
									}
								>
									Record payment
								</Button>
							)}
							<Link
								to={`/invoices/${i.id}/print`}
								aria-label={`Print ${i.invoiceNumber}`}
								title="Print"
								className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-raised hover:text-text-heading"
							>
								<Printer className="size-4" />
							</Link>
						</div>
					);
				},
			},
		],
		[billingRole],
	);

	function exportCsv() {
		downloadCsv(
			`trovo-invoices-${status || 'all'}-${todayStamp()}.csv`,
			['Invoice', 'Company code', 'Company', 'Status', 'Overdue', 'Period start', 'Period end', 'Issued', 'Due', 'Paid on', 'Currency', 'Amount', 'Due now'],
			rows.map((i) => [
				i.invoiceNumber,
				i.companyCode,
				i.companyName,
				i.status,
				i.overdue ? 'Yes' : 'No',
				csvDate(i.periodStart),
				csvDate(i.periodEnd),
				csvDate(i.issuedAt),
				csvDate(i.dueAt),
				csvDate(i.paidAt),
				i.currency,
				csvRupees(i.totalMinor),
				csvRupees(i.amountDueMinor),
			]),
		);
	}

	return (
		<>
			<PageHeader
				title="Invoices"
				description="Trovo’s invoices to every company. Record bank transfer and UPI payments here."
				actions={
					<Button icon={<Download className="size-4" />} onClick={exportCsv} disabled={rows.length === 0}>
						Export CSV
					</Button>
				}
			/>
			<Card>
				<div className="flex flex-wrap items-center gap-3 border-b border-border-subtle p-4">
					<div role="tablist" aria-label="Filter by status" className="inline-flex rounded-md border border-border-subtle bg-surface-alt p-0.5">
						{STATUSES.map((s) => (
							<button
								key={s.key}
								type="button"
								role="tab"
								aria-selected={status === s.key}
								onClick={() => setParam('status', s.key)}
								className={`h-8 rounded px-3 text-label font-medium ${status === s.key ? 'bg-surface-raised text-text-heading' : 'text-text-secondary hover:text-text-heading'}`}
							>
								{s.label}
							</button>
						))}
					</div>
					<div className="relative min-w-60 flex-1">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
						<input
							type="search"
							aria-label="Filter by invoice number or company"
							placeholder="Invoice number, company code or name…"
							value={search}
							onChange={(e) => setParam('search', e.target.value)}
							className="h-9 w-full rounded-md border border-border-subtle bg-surface-alt pr-3 pl-9 text-body text-text-heading placeholder:text-text-muted focus:border-action focus:ring-1 focus:ring-action focus:outline-none"
						/>
					</div>
					{invoices.data && (
						<span className="tabular text-label text-text-secondary">
							{rows.length} invoice{rows.length === 1 ? '' : 's'} · <span className={dueTotal > 0 ? 'text-pastdue' : ''}>{money(dueTotal)} due</span>
						</span>
					)}
				</div>
				{invoices.isPending ? (
					<LoadingState />
				) : invoices.isError ? (
					<ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
				) : (
					<DataTable
						data={rows}
						columns={columns}
						noun="invoices"
						initialSorting={[{ id: 'issuedAt', desc: true }]}
						empty={<EmptyState title="No invoices" description={status || search ? 'Change the filter or search.' : 'Invoices appear here when they are issued.'} />}
					/>
				)}
			</Card>
			<RecordPaymentDialog invoice={paying} onClose={() => setPaying(null)} />
		</>
	);
}
