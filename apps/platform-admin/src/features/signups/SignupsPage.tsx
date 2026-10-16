import { seatQuantities, totalSeats } from '@/lib/catalog';
import { useProducts, ProductBadge } from '@/features/products/ProductProvider';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { DataTable } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/StatusBadge';
import { Card, DetailList, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/Surface';
import { api } from '@/lib/api';
import { planName } from '@/lib/catalog';
import { dateTime, intervalLabel, money } from '@/lib/format';
import type { SignupOrder, SignupStatus } from '@/lib/types';

const FILTERS: { key: '' | SignupStatus; label: string }[] = [
	{ key: '', label: 'All' },
	{ key: 'NeedsAttention', label: 'Needs attention' },
	{ key: 'AwaitingPayment', label: 'Awaiting payment' },
	{ key: 'Completed', label: 'Completed' },
	{ key: 'Expired', label: 'Expired' },
];

function StatusBadge({ status }: { status: SignupStatus }) {
	switch (status) {
		case 'Completed':
			return <Badge tone="active">Completed</Badge>;
		case 'AwaitingPayment':
			return <Badge tone="pastdue">Awaiting payment</Badge>;
		case 'NeedsAttention':
			return <Badge tone="suspended">Needs attention</Badge>;
		case 'Processing':
			return <Badge tone="trial">Processing</Badge>;
		default:
			return <Badge tone="canceled">Expired</Badge>;
	}
}

/** Orders placed on the public sign-up website: free trials and paid orders, with what happened to each. */
export function SignupsPage() {
	const { key: productKey, products } = useProducts();
	useBreadcrumbs({ label: 'Sign-ups' });
	const [params, setParams] = useSearchParams();
	const status = (params.get('status') ?? '') as '' | SignupStatus;
	const [selected, setSelected] = useState<SignupOrder | null>(null);
	const orders = useQuery({ queryKey: ['signups', productKey, status], queryFn: () => api.signups(status || undefined, productKey) });
	const attention = useQuery({ queryKey: ['signups', productKey, 'NeedsAttention'], queryFn: () => api.signups('NeedsAttention', productKey) });

	const columns = useMemo<ColumnDef<SignupOrder, unknown>[]>(
		() => [
			{ accessorKey: 'productKey', header: 'Product', cell: ({ row }) => <ProductBadge productKey={row.original.productKey} /> },
			{ accessorKey: 'createdAt', header: 'When', cell: ({ row }) => <span className="tabular whitespace-nowrap text-text-secondary">{dateTime(row.original.createdAt)}</span> },
			{
				accessorKey: 'businessName',
				header: 'Business',
				cell: ({ row }) => (
					<div>
						<div className="font-medium text-text-heading">{row.original.businessName}</div>
						<div className="text-micro text-text-muted">
							{row.original.ownerName} · {row.original.city}
						</div>
					</div>
				),
			},
			{
				id: 'choice',
				accessorFn: (o) => o.planCode ?? '',
				header: 'Choice',
				cell: ({ row }) =>
					row.original.start === 'Trial' ? (
						<Badge tone="trial" dot={false}>
							Free trial
						</Badge>
					) : (
						<span>
							{planName(row.original.planCode)} · {intervalLabel(row.original.interval)} ·{' '}
							{products.find((p) => p.key === row.original.productKey)?.seatModel === 'None' ? 'Unlimited seats' : `${totalSeats(seatQuantities(row.original.seats))} seats`}
						</span>
					),
			},
			{
				accessorKey: 'amountMinor',
				header: 'Amount',
				meta: { align: 'right' },
				cell: ({ row }) => <span className="tabular">{row.original.start === 'Trial' ? '—' : money(row.original.amountMinor, row.original.currency)}</span>,
			},
			{ accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
			{
				id: 'company',
				accessorFn: (o) => o.companyCode ?? '',
				header: 'Company',
				cell: ({ row }) =>
					row.original.companyId ? (
						<Link to={`/companies/${row.original.companyId}`} onClick={(e) => e.stopPropagation()} className="tabular font-mono text-action hover:text-action-hover">
							{row.original.companyCode}
						</Link>
					) : (
						<span className="text-text-muted">—</span>
					),
			},
		],
		[products],
	);

	const attentionCount = attention.data?.length ?? 0;

	return (
		<>
			<PageHeader title="Sign-ups" description="Businesses that signed up on the public website. A company is created when a trial starts or a payment arrives." />
			{attentionCount > 0 && (
				<div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-danger-strong/40 bg-danger-strong/10 px-4 py-3 text-body text-text-primary">
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
					<span>
						{attentionCount} paid order{attentionCount === 1 ? '' : 's'} could not create the company. Create it with <strong>New company → Already paid</strong> using the order's
						choices, send the customer the codes, and call them.
					</span>
				</div>
			)}
			<Card>
				<div className="flex flex-wrap items-center gap-3 border-b border-border-subtle p-4">
					<div role="tablist" aria-label="Filter by status" className="inline-flex rounded-md border border-border-subtle bg-surface-alt p-0.5">
						{FILTERS.map((f) => (
							<button
								key={f.key}
								type="button"
								role="tab"
								aria-selected={status === f.key}
								onClick={() => setParams(f.key ? { status: f.key } : {}, { replace: true })}
								className={`h-8 rounded px-3 text-label font-medium ${status === f.key ? 'bg-surface-raised text-text-heading' : 'text-text-secondary hover:text-text-heading'}`}
							>
								{f.label}
							</button>
						))}
					</div>
				</div>
				{orders.isPending ? (
					<LoadingState />
				) : orders.isError ? (
					<ErrorState error={orders.error} onRetry={() => orders.refetch()} />
				) : (
					<DataTable
						data={orders.data}
						columns={columns}
						noun="orders"
						onRowClick={setSelected}
						rowLabel={(o) => `Open order from ${o.businessName}`}
						empty={<EmptyState title="No sign-ups" description={status ? 'Change the filter.' : 'Orders from the sign-up website appear here.'} />}
					/>
				)}
			</Card>

			<Modal
				open={selected !== null}
				onClose={() => setSelected(null)}
				width="md"
				title={selected?.businessName ?? ''}
				description={selected ? dateTime(selected.createdAt) : undefined}
			>
				{selected && (
					<div className="flex flex-col gap-4">
						<DetailList
							items={[
								{ label: 'Owner', value: selected.ownerName },
								{ label: 'Mobile', value: <span className="tabular">+91 {selected.mobile}</span> },
								{ label: 'Email', value: selected.email },
								{ label: 'Place', value: `${selected.city}, ${selected.state}` },
								{ label: 'Choice', value: selected.start === 'Trial' ? 'Free trial' : `${planName(selected.planCode)} · ${intervalLabel(selected.interval)}` },
								{ label: 'Seats', value: products.find((p) => p.key === selected.productKey)?.seatModel === 'None' ? 'Unlimited' : totalSeats(seatQuantities(selected.seats)) },
								{ label: 'Amount', value: selected.start === 'Trial' ? '—' : money(selected.amountMinor, selected.currency) },
								{ label: 'Status', value: <StatusBadge status={selected.status} /> },
								{ label: 'Payment', value: selected.paymentProvider ? `${selected.paymentProvider} · ${selected.paymentReference ?? ''}` : '—' },
								{ label: 'Company', value: selected.companyCode ?? '—' },
								...(selected.franchisorCode
									? [
											{
												label: 'Franchise',
												value: selected.franchiseLinked
													? `Linked to ${selected.franchisorCode} (franchise code)`
													: `Franchise code of ${selected.franchisorCode}${selected.completedAt ? ' — not linked' : ''}`,
											},
										]
									: []),
							]}
						/>
						{selected.franchiseProblem && (
							<p className="rounded-md border border-pastdue/40 bg-pastdue-bg px-3 py-2 text-label text-text-primary">Franchise link not made: {selected.franchiseProblem}</p>
						)}
						{selected.failureReason && (
							<p className="rounded-md border border-danger-strong/40 bg-danger-strong/10 px-3 py-2 text-label text-danger">What went wrong: {selected.failureReason}</p>
						)}
					</div>
				)}
			</Modal>
		</>
	);
}
