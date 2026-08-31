import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
	Plus,
	Search,
	FileText,
	RefreshCw,
	Car,
	Calendar,
	PenLine,
	Check,
} from 'lucide-react';
import { useAppStore } from '../../stores/app';
import { Button } from '../../components/ui/Button';
import { getJobCards, createInvoiceFromJobCard } from '../../lib/api';
import type { JobCardListDto } from '../../lib/api';

export function JobCardsPage() {
	const navigate = useNavigate();
	const globalSearch = useAppStore((s) => s.globalSearch);
	const [search, setSearch] = useState('');
	const [items, setItems] = useState<JobCardListDto[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [convertingId, setConvertingId] = useState<string | null>(null);
	const [convertError, setConvertError] = useState<string | null>(null);
	const pageSize = 10;

	const effectiveSearch = search.trim() || globalSearch.trim();

	const loadJobCards = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await getJobCards({
				page,
				pageSize,
				search: effectiveSearch || undefined,
			});
			setItems(response.items || []);
			setTotalCount(response.totalCount || 0);
		} catch (err: unknown) {
			console.error('Failed to load job cards from backend:', err);
			setItems([]);
			setTotalCount(0);
			const userMsg = err instanceof Error ? err.message : 'Unable to load Job Cards. Please try again.';
			setError(userMsg);
		} finally {
			setLoading(false);
		}
	}, [page, pageSize, effectiveSearch]);

	useEffect(() => {
		loadJobCards();
	}, [loadJobCards]);

	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);

	const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN')}`;

	const formatDate = (iso: string) => {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	};

	const handleConvertToInvoice = async (jobCard: JobCardListDto) => {
		if (convertingId) return;
		setConvertingId(jobCard.id);
		setConvertError(null);
		try {
			const invoice = await createInvoiceFromJobCard(jobCard.id);
			if (invoice && invoice.id) {
				navigate(`/invoices/${invoice.id}`);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to convert job card to invoice';
			console.warn('Convert to invoice error:', msg);
			setConvertError(msg);
			// Duplicate invoice protection: if an invoice already exists, refresh job cards to get current invoice state
			if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('conflict')) {
				loadJobCards();
			}
		} finally {
			setConvertingId(null);
		}
	};

	return (
		<div className="space-y-5 animate-fade-in">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-on-surface tracking-tight">Job Cards</h1>
					<p className="text-sm text-on-surface-variant mt-1">Track and manage all service job cards</p>
				</div>
				<Link to="/job-cards/new">
					<Button icon={<Plus className="w-4 h-4" />}>New Job Card</Button>
				</Link>
			</div>

			{/* Error State (only shown if both API and fallback fail) */}
			{error && (
				<div className="flex items-start gap-3 rounded-lg border border-error/30 bg-error/10 p-4">
					<FileText className="mt-0.5 h-5 w-5 shrink-0 text-error" />
					<div className="flex-1">
						<p className="text-sm font-medium text-error">Failed to load job cards</p>
						<p className="mt-0.5 text-sm text-on-surface-variant">{error}</p>
					</div>
					<Button
						variant="secondary"
						size="sm"
						icon={<RefreshCw className="w-3.5 h-3.5" />}
						onClick={loadJobCards}
					>
						Retry
					</Button>
				</div>
			)}

			{/* Convert to Invoice Error Banner */}
			{convertError && (
				<div className="flex items-start gap-3 rounded-lg border border-error/30 bg-error/10 p-4">
					<FileText className="mt-0.5 h-5 w-5 shrink-0 text-error" />
					<div className="flex-1">
						<p className="text-sm font-medium text-error">Conversion Failed</p>
						<p className="mt-0.5 text-sm text-on-surface-variant">{convertError}</p>
					</div>
					<button
						type="button"
						onClick={() => setConvertError(null)}
						className="text-xs text-on-surface-variant hover:text-on-surface font-medium"
					>
						Dismiss
					</button>
				</div>
			)}

			{/* Filters Bar */}
			<div className="app-card p-4">
				<div className="flex items-center gap-3">
					<div className="flex-1 max-w-md">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
							<input
								type="text"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								placeholder="Search by job card, customer or vehicle..."
								className="form-input pl-9 pr-4 w-full"
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
						{totalCount} job card{totalCount !== 1 ? 's' : ''}
					</div>
				</div>
			</div>

			{/* Job Cards Table */}
			<div className="app-card overflow-hidden">
				<div className="overflow-x-auto">
					<table className="app-table">
						<thead>
							<tr>
								<th>Job Card</th>
								<th>Customer</th>
								<th>Vehicle</th>
								<th>Total</th>
								<th>Date</th>
								<th className="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{loading && items.length === 0 && (
								<tr>
									<td colSpan={6} className="py-16 text-center text-on-surface-variant">
										<RefreshCw className="w-6 h-6 animate-spin mx-auto text-secondary mb-2" />
										<p className="text-sm">Loading job cards...</p>
									</td>
								</tr>
							)}

							{!loading && items.length === 0 && !error && (
								<tr>
									<td colSpan={6} className="py-16 text-center">
										<p className="text-sm text-on-surface-variant">No job cards found matching your search.</p>
										<Link to="/job-cards/new" className="inline-block mt-3">
											<Button icon={<Plus className="w-4 h-4" />}>Create First Job Card</Button>
										</Link>
									</td>
								</tr>
							)}

							{items.map((jc) => (
								<tr
									key={jc.id}
									className="cursor-pointer"
									onClick={() => navigate(`/job-cards/${jc.id}`)}
								>
									<td>
										<Link
											to={`/job-cards/${jc.id}`}
											onClick={(e) => e.stopPropagation()}
											className="font-medium text-secondary hover:underline font-mono text-sm"
										>
											{jc.jobCardNumber}
										</Link>
									</td>
									<td>
										<div className="flex items-center gap-3">
											<div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-semibold shrink-0">
												{jc.customerName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'CU'}
											</div>
											<div>
												<p className="font-medium text-on-surface">{jc.customerName}</p>
												<p className="text-sm text-on-surface-variant font-mono">{jc.customerPhone}</p>
											</div>
										</div>
									</td>
									<td>
										<div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
											<Car className="w-3.5 h-3.5 shrink-0" />
											<span className="text-on-surface font-medium">{jc.make} {jc.model}</span>
											{jc.registrationNumber && (
												<span className="bg-surface-container px-1.5 py-0.5 rounded text-xs font-medium text-on-surface-variant">
													{jc.registrationNumber}
												</span>
											)}
										</div>
									</td>
									<td>
										<span className="font-medium text-on-surface">
											{formatCurrency(jc.totalAmount)}
										</span>
									</td>
									<td className="text-sm text-on-surface-variant whitespace-nowrap">
										<div className="flex items-center gap-1">
											<Calendar className="w-3.5 h-3.5 shrink-0" />
											{formatDate(jc.createdAt)}
										</div>
									</td>
									<td className="text-right" onClick={(e) => e.stopPropagation()}>
										{(() => {
											// State A — No Invoice
											if (!jc.invoiceId) {
												return (
													<Button
														variant="primary"
														size="sm"
														icon={<FileText className="w-3.5 h-3.5" />}
														onClick={() => handleConvertToInvoice(jc)}
														disabled={convertingId !== null}
														loading={convertingId === jc.id}
													>
														{convertingId === jc.id ? 'Converting…' : 'Convert to Invoice'}
													</Button>
												);
											}

											// State B — Invoice Drafted (invoice exists, unfinalized / Draft)
											const statusStr = typeof jc.invoiceStatus === 'string' ? jc.invoiceStatus.toLowerCase() : '';
											const isDraft =
												(statusStr === 'draft' || jc.invoiceStatus === '0') &&
												(!jc.invoiceNumber || jc.invoiceNumber.trim() === '');

											if (isDraft) {
												return (
													<Button
														size="sm"
														className="bg-amber-500 hover:bg-amber-600 text-white border-transparent shadow-xs cursor-pointer"
														icon={<PenLine className="w-3.5 h-3.5" />}
														onClick={() => navigate(`/invoices/${jc.invoiceId}`)}
													>
														Invoice Drafted
													</Button>
												);
											}

											// State C — Invoice Generated (finalized)
											return (
												<Button
													size="sm"
													className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-xs cursor-pointer"
													icon={<Check className="w-3.5 h-3.5" />}
													onClick={() => navigate(`/invoices/${jc.invoiceId}`)}
												>
													Invoice Generated
												</Button>
											);
										})()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				{totalCount > pageSize && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
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
