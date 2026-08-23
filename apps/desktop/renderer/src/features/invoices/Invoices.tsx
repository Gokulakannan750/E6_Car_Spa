import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	Receipt,
	Eye,
	Search,
	Calendar,
	Car,
	AlertCircle,
	CircleDollarSign,
	Clock,
	FileText,
	Sparkles,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { useAppStore } from '../../stores/app';
import {
	getInvoices,
	type InvoiceListDto,
	type InvoiceListResponse,
	type InvoiceStatus,
} from '../../lib/api';

// ─── Status filter config (Draft, Generated, Partially Paid, Paid, Cancelled) ──
const STATUS_FILTERS: { label: string; value: InvoiceStatus | 'All' }[] = [
	{ label: 'All', value: 'All' },
	{ label: 'Draft', value: 'Draft' },
	{ label: 'Generated', value: 'Generated' },
	{ label: 'Partially Paid', value: 'PartiallyPaid' },
	{ label: 'Paid', value: 'Paid' },
	{ label: 'Cancelled', value: 'Cancelled' },
];

// ─── KPI card config ─────────────────────────────────────────────────────────
interface KpiConfig {
	label: string;
	status: InvoiceStatus;
	icon: React.ReactNode;
	colorClass: string;
	bgClass: string;
}

const KPI_CARDS: KpiConfig[] = [
	{ label: 'Draft', status: 'Draft', icon: <FileText className="w-5 h-5" />, colorClass: 'text-warning', bgClass: 'bg-warning-container' },
	{ label: 'Generated', status: 'Generated', icon: <Sparkles className="w-5 h-5" />, colorClass: 'text-info', bgClass: 'bg-info-container' },
	{ label: 'Partially Paid', status: 'PartiallyPaid', icon: <Clock className="w-5 h-5" />, colorClass: 'text-warning', bgClass: 'bg-warning-container' },
	{ label: 'Paid', status: 'Paid', icon: <CircleDollarSign className="w-5 h-5" />, colorClass: 'text-success', bgClass: 'bg-success-container' },
	{ label: 'Cancelled', status: 'Cancelled', icon: <AlertCircle className="w-5 h-5" />, colorClass: 'text-error', bgClass: 'bg-error-container' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
export type InvoiceDisplayStatus = 'Draft' | 'Generated' | 'PartiallyPaid' | 'Paid' | 'Cancelled';

const STATUS_ENUM_MAP: Record<number, InvoiceDisplayStatus> = {
	0: 'Draft',
	1: 'Generated',
	2: 'Paid',
	3: 'PartiallyPaid',
	4: 'Cancelled',
	5: 'Generated',
	6: 'Generated',
};

function normalizeInvoiceStatus(status: unknown): InvoiceDisplayStatus {
	if (typeof status === 'number') {
		return STATUS_ENUM_MAP[status] ?? 'Draft';
	}
	if (typeof status === 'string') {
		const num = Number(status);
		if (!isNaN(num) && status.trim() !== '') {
			return STATUS_ENUM_MAP[num] ?? 'Draft';
		}
		const s = status.trim().toLowerCase();
		if (s === 'draft' || s === '0') return 'Draft';
		if (s === 'paid' || s === '2') return 'Paid';
		if (s === 'partiallypaid' || s === 'partially paid' || s === 'partially-paid' || s === '3') return 'PartiallyPaid';
		if (s === 'cancelled' || s === 'canceled' || s === '4') return 'Cancelled';
		if (s === 'generated' || s === '6') return 'Generated';
	}
	return 'Draft';
}

function getInvoiceDisplayStatus(inv: {
	status: unknown;
	invoiceNumber?: string | null;
}): InvoiceDisplayStatus {
	const normalized = normalizeInvoiceStatus(inv.status);

	if (normalized === 'Cancelled') return 'Cancelled';
	if (normalized === 'Paid') return 'Paid';
	if (normalized === 'PartiallyPaid') return 'PartiallyPaid';

	const hasInvoiceNumber = Boolean(inv.invoiceNumber && inv.invoiceNumber.trim() !== '');

	// Condition 1: Draft if status == Draft OR invoiceNumber == null/empty
	if (normalized === 'Draft' || !hasInvoiceNumber) {
		return 'Draft';
	}

	// Condition 2: Generated if status == Generated AND invoiceNumber != null
	if (normalized === 'Generated' && hasInvoiceNumber) {
		return 'Generated';
	}

	return hasInvoiceNumber ? 'Generated' : 'Draft';
}

function getInvoiceStatusSlug(inv: {
	status: unknown;
	invoiceNumber?: string | null;
}): string {
	const displayStatus = getInvoiceDisplayStatus(inv);
	switch (displayStatus) {
		case 'Draft': return 'draft';
		case 'Generated': return 'generated';
		case 'PartiallyPaid': return 'partially-paid';
		case 'Paid': return 'paid';
		case 'Cancelled': return 'cancelled';
		default: return 'draft';
	}
}

function formatCurrency(value: number) {
	return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────
export function Invoices() {
	const navigate = useNavigate();
	const globalSearch = useAppStore((s) => s.globalSearch);

	// State
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'All'>('All');
	const [items, setItems] = useState<InvoiceListDto[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const pageSize = 20;

	const effectiveSearch = search.trim() || globalSearch.trim();

	// ─── Data fetching ───────────────────────────────────────────────────────
	const loadInvoices = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response: InvoiceListResponse = await getInvoices({
				page,
				pageSize,
				search: effectiveSearch || undefined,
				status: statusFilter === 'All' ? undefined : statusFilter,
			});
			setItems(response.items);
			setTotalCount(response.totalCount);
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			console.warn('Failed to load invoices:', msg);
			setError(msg);
			setItems([]);
			setTotalCount(0);
		} finally {
			setLoading(false);
		}
	}, [page, pageSize, effectiveSearch, statusFilter]);

	useEffect(() => {
		loadInvoices();
	}, [loadInvoices]);

	// ─── Pagination ──────────────────────────────────────────────────────────
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);

	// ─── KPI counts (computed from loaded data) ──────────────────────────────
	const statusCounts = useMemo(() => {
		const counts: Record<string, number> = {
			Draft: 0,
			Generated: 0,
			PartiallyPaid: 0,
			Paid: 0,
			Cancelled: 0,
		};
		for (const item of items) {
			const displayStatus = getInvoiceDisplayStatus(item);
			counts[displayStatus] = (counts[displayStatus] || 0) + 1;
		}
		return counts;
	}, [items]);

	return (
		<div className="space-y-5 animate-fade-in">
			{/* ── Page Header ───────────────────────────────────────────────── */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-on-surface tracking-tight">Invoices</h1>
					<p className="text-sm text-on-surface-variant mt-1">Manage invoice lifecycle, drafts, and payments</p>
				</div>
			</div>

			{/* ── KPI Summary Cards (Draft, Generated, Partially Paid, Paid, Cancelled) ── */}
			<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
				{KPI_CARDS.map((kpi) => {
					const count = statusCounts[kpi.status] ?? 0;
					const isActive = statusFilter === kpi.status;
					return (
						<button
							key={kpi.status}
							onClick={() => {
								setStatusFilter(isActive ? 'All' : kpi.status);
								setPage(1);
							}}
							className={`app-card p-3.5 text-left transition-all hover:shadow-elevation-1 ${
								isActive ? 'ring-2 ring-secondary shadow-sm' : ''
							}`}
						>
							<div className="flex items-center justify-between mb-1.5">
								<span className="text-xs font-semibold text-on-surface-variant">{kpi.label}</span>
								<div className={`w-8 h-8 rounded-lg ${kpi.bgClass} ${kpi.colorClass} flex items-center justify-center`}>
									{kpi.icon}
								</div>
							</div>
							<div className="text-xl font-bold text-on-surface">{count}</div>
							<p className="text-[11px] text-on-surface-variant mt-0.5">
								{kpi.status === 'Draft' ? 'Pending generation' : `${kpi.label} invoices`}
							</p>
						</button>
					);
				})}
			</div>

			{/* ── Error Banner ──────────────────────────────────────────────── */}
			{error && (
				<div className="app-card p-4 border-error/30 bg-error/5 flex items-center justify-between gap-3 text-sm text-error">
					<div className="flex items-center gap-2">
						<AlertCircle className="w-5 h-5 shrink-0" />
						<span>{error}</span>
					</div>
					<Button size="sm" variant="secondary" onClick={loadInvoices}>
						Retry
					</Button>
				</div>
			)}

			{/* ── Search & Filter Controls ──────────────────────────────────── */}
			<div className="app-card p-4 space-y-3">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					{/* Search input */}
					<div className="flex items-center gap-2 flex-1 max-w-md">
						<div className="relative flex-1">
							<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
							<input
								type="text"
								placeholder="Search invoices by number, customer, vehicle..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								className="form-input pl-9 pr-3 py-1.5 w-full text-sm"
							/>
						</div>
					</div>

					{/* Global Search Indicator */}
					{globalSearch && (
						<div className="flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-lg px-3 py-1.5">
							<span className="text-sm text-secondary truncate">
								Global: <strong>"{globalSearch}"</strong>
							</span>
						</div>
					)}

					<div className="ml-auto text-sm text-on-surface-variant">
						{totalCount} invoice{totalCount !== 1 ? 's' : ''}
					</div>
				</div>

				{/* Status filter tabs: [ All ] [ Draft ] [ Generated ] [ Partially Paid ] [ Paid ] [ Cancelled ] */}
				<div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-outline-variant/50">
					{STATUS_FILTERS.map((sf) => {
						const isActive = statusFilter === sf.value;
						return (
							<button
								key={sf.value}
								onClick={() => {
									setStatusFilter(sf.value);
									setPage(1);
								}}
								className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
									isActive
										? 'bg-secondary text-white shadow-sm'
										: 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
								}`}
							>
								{sf.label}
							</button>
						);
					})}
				</div>
			</div>

			{/* ── Invoice Table ─────────────────────────────────────────────── */}
			<div className="app-card overflow-hidden">
				<div className="overflow-x-auto">
					<table className="app-table">
						<thead>
							<tr>
								<th>Invoice</th>
								<th>Customer</th>
								<th>Vehicle</th>
								<th>Date</th>
								<th className="text-right">Amount</th>
								<th className="text-center">Status</th>
								<th className="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{items.length === 0 && !loading && (
								<tr>
									<td colSpan={7} className="py-12 text-center text-on-surface-variant">
										<div className="flex flex-col items-center justify-center space-y-2">
											<Receipt className="w-8 h-8 text-on-surface-variant/40" />
											<p className="text-sm font-medium">No invoices found</p>
											<p className="text-xs text-on-surface-variant/70">
												{search || statusFilter !== 'All'
													? 'Try adjusting your search or filters'
													: 'Invoices converted from Job Cards will appear here'}
											</p>
										</div>
									</td>
								</tr>
							)}

							{items.map((inv) => {
								const statusSlug = getInvoiceStatusSlug(inv);
								const isDraft = statusSlug === 'draft';
								return (
									<tr
										key={inv.id}
										className="hover:bg-surface-container-low/40 transition-colors cursor-pointer"
										onClick={() => navigate(`/invoices/${inv.id}`)}
									>
										{/* Invoice # + Job Card */}
										<td>
											<div className="flex items-center gap-3">
												<div className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
													<Receipt className="w-4 h-4" />
												</div>
												<div>
													{inv.invoiceNumber && inv.invoiceNumber.trim() !== '' ? (
														<p className="font-mono font-medium text-sm text-secondary hover:underline">
															{inv.invoiceNumber}
														</p>
													) : (
														<div className="flex items-center gap-1.5">
															<span className="bg-warning-container text-warning px-1.5 py-0.5 rounded text-xs font-medium">
																Draft
															</span>
														</div>
													)}
													<p className="text-xs font-mono text-on-surface-variant">{inv.jobCardNumber}</p>
												</div>
											</div>
										</td>

										{/* Customer */}
										<td>
											<div className="flex items-center gap-3">
												<div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-semibold shrink-0">
													{inv.customerName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'CU'}
												</div>
												<div>
													<p className="font-medium text-on-surface">{inv.customerName}</p>
													<p className="text-sm text-on-surface-variant font-mono">{inv.customerPhone}</p>
												</div>
											</div>
										</td>

										{/* Vehicle */}
										<td>
											<div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
												<Car className="w-3.5 h-3.5 shrink-0" />
												<span className="text-on-surface font-medium">{inv.vehicle}</span>
												{inv.registrationNumber && (
													<span className="bg-surface-container px-1.5 py-0.5 rounded text-xs font-medium text-on-surface-variant font-mono">
														{inv.registrationNumber}
													</span>
												)}
											</div>
										</td>

										{/* Date */}
										<td className="text-sm text-on-surface-variant whitespace-nowrap">
											<div className="flex items-center gap-1">
												<Calendar className="w-3.5 h-3.5 shrink-0" />
												<span>{formatDate(inv.invoiceDate)}</span>
											</div>
										</td>

										{/* Amount */}
										<td className="text-right">
											<p className="font-medium text-on-surface text-sm">
												{formatCurrency(inv.totalAmount)}
											</p>
											{inv.paidAmount > 0 && inv.balanceAmount > 0 && (
												<p className="text-xs text-warning">
													Bal: {formatCurrency(inv.balanceAmount)}
												</p>
											)}
										</td>

										{/* Status (Automatic derived) */}
										<td className="text-center">
											<StatusBadge status={statusSlug} />
										</td>

										{/* Actions */}
										<td className="text-right" onClick={(e) => e.stopPropagation()}>
											<Button
												variant="secondary"
												size="sm"
												icon={<Eye className="w-3.5 h-3.5" />}
												onClick={() => navigate(`/invoices/${inv.id}`)}
											>
												{isDraft ? 'View / Edit' : 'View'}
											</Button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				{/* ── Pagination ──────────────────────────────────────────────── */}
				{totalCount > pageSize && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant bg-surface-container-low/30">
						<span className="text-sm text-on-surface-variant">
							Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
						</span>
						<div className="flex items-center gap-1">
							<Button
								variant="secondary"
								size="sm"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
							>
								Previous
							</Button>
							{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
								<button
									key={p}
									onClick={() => setPage(p)}
									className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
										p === page
											? 'bg-secondary text-white'
											: 'text-on-surface-variant hover:bg-surface-container-low'
									}`}
								>
									{p}
								</button>
							))}
							<Button
								variant="secondary"
								size="sm"
								disabled={page >= totalPages}
								onClick={() => setPage((p) => p + 1)}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
