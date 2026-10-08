import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getWhatsAppMessageLog, type WhatsAppMessageLogItemDto } from '../../lib/api';

export type MessageLogStatus = 'all' | 'failed' | 'skipped';
export interface MessageLogMonth {
	year: number;
	month: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE_SIZE = 15;

const STATUS_FILTERS: { id: MessageLogStatus; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'failed', label: 'Failed' },
	{ id: 'skipped', label: 'Skipped' },
];

function formatWhen(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** 919876543210 -> +91 98765 43210; anything else is shown as stored. */
function formatPhone(phone: string): string {
	if (/^91\d{10}$/.test(phone)) return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
	return phone;
}

function messageLabel(type: string): string {
	return type === 'PaymentCompleted' ? 'Payment receipt' : 'Invoice';
}

interface WhatsAppMessageLogProps {
	status: MessageLogStatus;
	onStatusChange: (status: MessageLogStatus) => void;
	month: MessageLogMonth | null;
	onClearMonth: () => void;
}

/** Whose automatic messages failed or were skipped, and why. */
export function WhatsAppMessageLog({ status, onStatusChange, month, onClearMonth }: WhatsAppMessageLogProps) {
	const [page, setPage] = useState(1);
	const [items, setItems] = useState<WhatsAppMessageLogItemDto[] | null>(null);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// A new filter starts from the first page.
	useEffect(() => {
		setPage(1);
	}, [status, month?.year, month?.month]);

	const load = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const result = await getWhatsAppMessageLog({
				status: status === 'all' ? undefined : status,
				year: month?.year,
				month: month?.month,
				page,
				pageSize: PAGE_SIZE,
			});
			setItems(result.items);
			setTotalCount(result.totalCount);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Failed to load the message list');
		} finally {
			setLoading(false);
		}
	}, [status, month?.year, month?.month, page]);

	useEffect(() => {
		void load();
	}, [load]);

	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const firstShown = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const lastShown = Math.min(page * PAGE_SIZE, totalCount);

	return (
		<div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
				<div>
					<h4 className="text-xs font-bold text-slate-800">Messages that were not sent</h4>
					<p className="text-[11px] text-slate-500">
						Who the failed and skipped messages were for, and why. Click a Failed or Skipped number above to jump to a month.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<div role="group" aria-label="Filter by result" className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
						{STATUS_FILTERS.map((filter) => (
							<button
								key={filter.id}
								type="button"
								aria-pressed={status === filter.id}
								onClick={() => onStatusChange(filter.id)}
								className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
									status === filter.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
								}`}
							>
								{filter.label}
							</button>
						))}
					</div>

					{month ? (
						<button
							type="button"
							onClick={onClearMonth}
							aria-label={`Clear month filter ${MONTH_NAMES[month.month - 1]} ${month.year}`}
							className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
						>
							{MONTH_NAMES[month.month - 1]} {month.year}
							<X className="w-3 h-3" />
						</button>
					) : (
						<span className="text-[11px] text-slate-500">Last 6 months</span>
					)}
				</div>
			</div>

			{error && (
				<p role="alert" className="text-xs text-rose-600">
					{error}
				</p>
			)}

			{!error && loading && !items && <p className="text-xs text-slate-500">Loading messages…</p>}

			{!error && items && items.length === 0 && (
				<p className="text-xs text-slate-500">No failed or skipped messages for this selection.</p>
			)}

			{!error && items && items.length > 0 && (
				<>
					<div className="overflow-x-auto">
						<table className="w-full text-xs">
							<thead>
								<tr className="text-left text-slate-500 border-b border-slate-100">
									<th className="py-2 pr-4 font-semibold whitespace-nowrap">When</th>
									<th className="py-2 pr-4 font-semibold">Customer</th>
									<th className="py-2 pr-4 font-semibold whitespace-nowrap">Phone</th>
									<th className="py-2 pr-4 font-semibold">Invoice</th>
									<th className="py-2 pr-4 font-semibold">Message</th>
									<th className="py-2 pr-4 font-semibold">Result</th>
									<th className="py-2 font-semibold">Reason</th>
								</tr>
							</thead>
							<tbody>
								{items.map((item) => (
									<tr key={item.id} className="border-b border-slate-50 last:border-0 align-top">
										<td className="py-2 pr-4 text-slate-600 whitespace-nowrap">{formatWhen(item.createdAtUtc)}</td>
										<td className="py-2 pr-4 font-medium text-slate-800">{item.customerName}</td>
										<td className="py-2 pr-4 font-mono text-slate-600 whitespace-nowrap">{formatPhone(item.recipientPhone)}</td>
										<td className="py-2 pr-4 font-mono text-slate-600">{item.invoiceNumber ?? '—'}</td>
										<td className="py-2 pr-4 text-slate-600">{messageLabel(item.messageType)}</td>
										<td className="py-2 pr-4">
											<span
												className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
													item.status === 'Failed'
														? 'bg-rose-50 text-rose-700 border-rose-200'
														: 'bg-amber-50 text-amber-700 border-amber-200'
												}`}
											>
												{item.status}
											</span>
										</td>
										<td className="py-2 text-slate-600 max-w-xs break-words">{item.reason ?? '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="flex items-center justify-between text-[11px] text-slate-500">
						<span>
							Showing {firstShown}–{lastShown} of {totalCount}
						</span>
						<div className="flex items-center gap-1">
							<button
								type="button"
								aria-label="Previous page"
								disabled={page <= 1 || loading}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
							>
								<ChevronLeft className="w-3.5 h-3.5" />
							</button>
							<span className="px-2">
								Page {page} of {totalPages}
							</span>
							<button
								type="button"
								aria-label="Next page"
								disabled={page >= totalPages || loading}
								onClick={() => setPage((p) => p + 1)}
								className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
							>
								<ChevronRight className="w-3.5 h-3.5" />
							</button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
