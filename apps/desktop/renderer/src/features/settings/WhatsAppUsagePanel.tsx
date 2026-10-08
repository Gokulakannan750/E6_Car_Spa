import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { getWhatsAppUsage, type WhatsAppUsageMonthDto } from '../../lib/api';
import { WhatsAppMessageLog, type MessageLogMonth, type MessageLogStatus } from './WhatsAppMessageLog';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(row: WhatsAppUsageMonthDto): string {
	return `${MONTH_NAMES[row.month - 1] ?? row.month} ${row.year}`;
}

/** Messages per month (sent, failed, skipped, waiting), taken from the message records. */
export function WhatsAppUsagePanel() {
	const [rows, setRows] = useState<WhatsAppUsageMonthDto[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [logStatus, setLogStatus] = useState<MessageLogStatus>('all');
	const [logMonth, setLogMonth] = useState<MessageLogMonth | null>(null);

	const showMessages = (status: MessageLogStatus, row: WhatsAppUsageMonthDto) => {
		setLogStatus(status);
		setLogMonth({ year: row.year, month: row.month });
	};

	async function load() {
		try {
			setLoading(true);
			setError(null);
			const result = await getWhatsAppUsage(6);
			setRows(result.months);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Failed to load WhatsApp usage');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void load();
	}, []);

	const hasAnyMessages = (rows ?? []).some((row) => row.total > 0);

	return (
		<div className="space-y-6">
		<div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
				<div className="flex items-center gap-2.5">
					<div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
						<BarChart3 className="w-4 h-4" />
					</div>
					<div>
						<h4 className="text-xs font-bold text-slate-800">Message usage</h4>
						<p className="text-[11px] text-slate-500">Messages per month for the last 6 months.</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => void load()}
					disabled={loading}
					className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
				>
					<RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
					Refresh
				</button>
			</div>

			{error && (
				<p role="alert" className="text-xs text-rose-600">
					{error}
				</p>
			)}

			{!error && loading && !rows && <p className="text-xs text-slate-500">Loading usage…</p>}

			{!error && rows && !hasAnyMessages && (
				<p className="text-xs text-slate-500">No WhatsApp messages have been recorded in the last 6 months.</p>
			)}

			{!error && rows && hasAnyMessages && (
				<div className="overflow-x-auto">
					<table className="w-full text-xs">
						<thead>
							<tr className="text-left text-slate-500 border-b border-slate-100">
								<th className="py-2 pr-4 font-semibold">Month</th>
								<th className="py-2 pr-4 font-semibold text-right">Sent</th>
								<th className="py-2 pr-4 font-semibold text-right">Failed</th>
								<th className="py-2 pr-4 font-semibold text-right">Skipped</th>
								<th className="py-2 pr-4 font-semibold text-right">Waiting</th>
								<th className="py-2 pr-4 font-semibold text-right">Invoice messages</th>
								<th className="py-2 font-semibold text-right">Payment messages</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={`${row.year}-${row.month}`} className="border-b border-slate-50 last:border-0">
									<td className="py-2 pr-4 font-medium text-slate-700">{monthLabel(row)}</td>
									<td className="py-2 pr-4 text-right font-mono text-emerald-700">{row.sent}</td>
									<td className="py-2 pr-4 text-right font-mono text-rose-600">
										{row.failed > 0 ? (
											<button
												type="button"
												onClick={() => showMessages('failed', row)}
												aria-label={`Show ${row.failed} failed messages for ${monthLabel(row)}`}
												className="underline decoration-dotted underline-offset-2 hover:text-rose-800"
											>
												{row.failed}
											</button>
										) : (
											row.failed
										)}
									</td>
									<td className="py-2 pr-4 text-right font-mono text-slate-600">
										{row.skipped > 0 ? (
											<button
												type="button"
												onClick={() => showMessages('skipped', row)}
												aria-label={`Show ${row.skipped} skipped messages for ${monthLabel(row)}`}
												className="underline decoration-dotted underline-offset-2 hover:text-slate-900"
											>
												{row.skipped}
											</button>
										) : (
											row.skipped
										)}
									</td>
									<td className="py-2 pr-4 text-right font-mono text-slate-600">{row.pending}</td>
									<td className="py-2 pr-4 text-right font-mono text-slate-600">{row.invoiceMessagesSent}</td>
									<td className="py-2 text-right font-mono text-slate-600">{row.paymentMessagesSent}</td>
								</tr>
							))}
						</tbody>
					</table>
					<p className="mt-2 text-[10px] text-slate-500">
						Skipped messages were not sent: the customer had no valid phone number, or WhatsApp was switched off.
					</p>
				</div>
			)}
		</div>

		<WhatsAppMessageLog
			status={logStatus}
			onStatusChange={setLogStatus}
			month={logMonth}
			onClearMonth={() => setLogMonth(null)}
		/>
		</div>
	);
}
