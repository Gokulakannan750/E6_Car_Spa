import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../auth/auth-context';
import {
	getGstReport,
	getJobCardReport,
	getJobCardStatusLabel,
	getOutstandingInvoicesReport,
	getPaymentCollectionReport,
	getSalesReport,
	type PagedReport,
} from '../../lib/api';
import { downloadFinancialReport } from './excelFinancialReportGenerator';
import {
	FINANCIAL_REPORTS,
	buildFinancialSheet,
	formatReportDate,
	invoiceStatusLabel,
	type FinancialReportId,
} from './financialReports';

interface FinancialReportsViewProps {
	bounds: { startStr: string; endStr: string; label: string };
	formatINR: (val?: number | null) => string;
}

const PAGE_SIZE = 25;

interface Column<TRow> {
	header: string;
	render: (row: TRow) => ReactNode;
	align?: 'right';
	mono?: boolean;
}

interface Kpi {
	label: string;
	value: string;
	tone?: 'warn' | 'good';
}

interface PanelProps<TRow, TSummary> {
	id: FinancialReportId;
	bounds: FinancialReportsViewProps['bounds'];
	fetchPage: (page: number, pageSize: number) => Promise<PagedReport<TRow, TSummary>>;
	columns: Column<TRow>[];
	rowKey: (row: TRow) => string;
	kpis: (summary: TSummary) => Kpi[];
	emptyText: string;
	extraKey?: string;
}

function ReportPanel<TRow, TSummary>({ id, bounds, fetchPage, columns, rowKey, kpis, emptyText, extraKey }: PanelProps<TRow, TSummary>) {
	const [page, setPage] = useState(1);
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState<string | null>(null);

	useEffect(() => {
		setPage(1);
	}, [bounds.startStr, bounds.endStr, id, extraKey]);

	const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
		queryKey: ['financial-report', id, bounds.startStr, bounds.endStr, page, extraKey ?? ''],
		queryFn: () => fetchPage(page, PAGE_SIZE),
	});

	const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / (data.pageSize || PAGE_SIZE))) : 1;
	const { user } = useAuth();

	const handleExport = async () => {
		setExporting(true);
		setExportError(null);
		try {
			const spec = await buildFinancialSheet(id, bounds.startStr, bounds.endStr, bounds.label);
			await downloadFinancialReport(spec, bounds.startStr, bounds.endStr);
		} catch (err) {
			setExportError(err instanceof Error ? err.message : 'Could not create the Excel file.');
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs text-on-surface-variant">
					{bounds.label}: {bounds.startStr} to {bounds.endStr}
				</p>
				<div className="flex items-center gap-2">
					<Button
						variant="secondary"
						size="sm"
						icon={<RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
						onClick={() => refetch()}
						disabled={isFetching}
					>
						Refresh
					</Button>
					<Button
						size="sm"
						icon={<Download className="w-3.5 h-3.5" />}
						onClick={handleExport}
						disabled={exporting || isLoading || !data || !user}
						data-testid="financial-report-export"
					>
						{exporting ? 'Preparing…' : 'Export Excel'}
					</Button>
				</div>
			</div>

			{exportError && (
				<div role="alert" className="p-3 rounded-lg bg-error-container/40 border border-error/20 text-xs text-error">
					{exportError}
				</div>
			)}

			{isError && (
				<div role="alert" className="p-4 rounded-xl bg-error-container/40 border border-error/20 text-xs text-error flex items-center gap-2">
					<AlertCircle className="w-4 h-4 shrink-0" />
					<span>{error instanceof Error ? error.message : 'Could not load this report.'}</span>
				</div>
			)}

			{data && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="financial-report-kpis">
					{kpis(data.summary).map((k) => (
						<div
							key={k.label}
							className={`app-card p-4 ${k.tone === 'warn' ? 'border-amber-500/30 bg-amber-500/5' : k.tone === 'good' ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}
						>
							<span className="text-xs font-medium text-on-surface-variant">{k.label}</span>
							<div className="mt-1 text-lg font-bold text-on-surface font-mono tracking-tight">{k.value}</div>
						</div>
					))}
				</div>
			)}

			<div className="app-card overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-xs">
						<thead className="bg-surface-container-high text-on-surface-variant">
							<tr>
								{columns.map((c) => (
									<th key={c.header} className={`px-3 py-2.5 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
										{c.header}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{isLoading && (
								<tr>
									<td colSpan={columns.length} className="px-3 py-10 text-center text-on-surface-variant">
										Loading…
									</td>
								</tr>
							)}
							{!isLoading && data && data.items.length === 0 && (
								<tr>
									<td colSpan={columns.length} className="px-3 py-10 text-center text-on-surface-variant" data-testid="financial-report-empty">
										{emptyText}
									</td>
								</tr>
							)}
							{data?.items.map((row) => (
								<tr key={rowKey(row)} className="border-t border-outline-variant/50 hover:bg-surface-container/40">
									{columns.map((c) => (
										<td
											key={c.header}
											className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : ''} ${c.mono ? 'font-mono' : ''}`}
										>
											{c.render(row)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{data && totalPages > 1 && (
					<div className="flex items-center justify-between px-3 py-2 border-t border-outline-variant text-xs">
						<span className="text-on-surface-variant">
							Page {page} of {totalPages} · {data.totalCount} records
						</span>
						<div className="flex items-center gap-1">
							<Button variant="secondary" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5" />} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
								Prev
							</Button>
							<Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
								Next <ChevronRight className="w-3.5 h-3.5 inline" />
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export function FinancialReportsView({ bounds, formatINR }: FinancialReportsViewProps) {
	const { user, hasPermission } = useAuth();
	const allowed = useMemo(
		() => FINANCIAL_REPORTS.filter((r) => !user || hasPermission(r.permission)),
		[user, hasPermission],
	);
	const [active, setActive] = useState<FinancialReportId | null>(null);
	const current = allowed.find((r) => r.id === active) ?? allowed[0];
	const range = { fromDate: bounds.startStr, toDate: bounds.endStr };

	if (!current) {
		return (
			<div className="app-card p-8 text-center text-sm text-on-surface-variant" data-testid="financial-reports-none">
				You do not have permission to view the financial reports.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-1 overflow-x-auto border-b border-outline-variant" role="tablist" aria-label="Financial reports">
				{allowed.map((r) => (
					<button
						key={r.id}
						type="button"
						role="tab"
						aria-selected={current.id === r.id}
						title={r.description}
						onClick={() => setActive(r.id)}
						className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
							current.id === r.id
								? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
								: 'border-transparent text-on-surface-variant hover:text-on-surface'
						}`}
					>
						{r.label}
					</button>
				))}
			</div>

			{current.id === 'sales' && (
				<ReportPanel
					id="sales"
					bounds={bounds}
					fetchPage={(page, pageSize) => getSalesReport({ ...range, page, pageSize })}
					rowKey={(r) => r.invoiceId}
					emptyText="No invoices in this period."
					kpis={(s) => [
						{ label: 'Invoices', value: String(s.invoiceCount) },
						{ label: 'Net sales', value: formatINR(s.totalAmount) },
						{ label: 'GST', value: formatINR(s.totalGst) },
						{ label: 'Discounts', value: formatINR(s.totalDiscount) },
						{ label: 'Collected', value: formatINR(s.totalPaid), tone: 'good' },
						{ label: 'Balance due', value: formatINR(s.totalBalance), tone: s.totalBalance > 0 ? 'warn' : undefined },
					]}
					columns={[
						{ header: 'Invoice', render: (r) => r.invoiceNumber ?? '—', mono: true },
						{ header: 'Date', render: (r) => formatReportDate(r.invoiceDate) },
						{ header: 'Customer', render: (r) => r.customerName },
						{ header: 'Vehicle', render: (r) => r.registrationNumber },
						{ header: 'Subtotal', render: (r) => formatINR(r.subtotal), align: 'right' },
						{ header: 'Discount', render: (r) => formatINR(r.discount), align: 'right' },
						{ header: 'GST', render: (r) => formatINR(r.gst), align: 'right' },
						{ header: 'Total', render: (r) => formatINR(r.totalAmount), align: 'right' },
						{ header: 'Balance', render: (r) => formatINR(r.balanceAmount), align: 'right' },
						{ header: 'Status', render: (r) => invoiceStatusLabel(r.status) },
					]}
				/>
			)}

			{current.id === 'collections' && (
				<ReportPanel
					id="collections"
					bounds={bounds}
					fetchPage={(page, pageSize) => getPaymentCollectionReport({ ...range, page, pageSize })}
					rowKey={(r) => r.paymentId}
					emptyText="No payments in this period."
					kpis={(s) => [
						{ label: 'Collected', value: formatINR(s.totalCollected), tone: 'good' },
						{ label: 'Payments', value: String(s.transactionCount) },
						{ label: 'Cash', value: formatINR(s.cashAmount) },
						{ label: 'UPI', value: formatINR(s.upiAmount) },
						{ label: 'Card', value: formatINR(s.cardAmount) },
						{ label: 'Bank transfer', value: formatINR(s.bankTransferAmount) },
					]}
					columns={[
						{ header: 'Date', render: (r) => formatReportDate(r.paymentDate) },
						{ header: 'Invoice', render: (r) => r.invoiceNumber ?? '—', mono: true },
						{ header: 'Customer', render: (r) => r.customerName },
						{ header: 'Method', render: (r) => r.paymentMethod },
						{ header: 'Reference', render: (r) => r.reference ?? '' },
						{ header: 'Amount', render: (r) => formatINR(r.amount), align: 'right' },
					]}
				/>
			)}

			{current.id === 'outstanding' && (
				<ReportPanel
					id="outstanding"
					bounds={bounds}
					fetchPage={(page, pageSize) => getOutstandingInvoicesReport({ ...range, page, pageSize })}
					rowKey={(r) => r.invoiceId}
					emptyText="Nothing is outstanding in this period."
					kpis={(s) => [
						{ label: 'Outstanding', value: formatINR(s.totalOutstandingAmount), tone: s.totalOutstandingAmount > 0 ? 'warn' : 'good' },
						{ label: 'Invoices', value: String(s.invoiceCount) },
						{ label: 'Invoiced', value: formatINR(s.totalInvoiceAmount) },
						{ label: 'Paid so far', value: formatINR(s.totalPaidAmount) },
					]}
					columns={[
						{ header: 'Invoice', render: (r) => r.invoiceNumber ?? '—', mono: true },
						{ header: 'Date', render: (r) => formatReportDate(r.invoiceDate) },
						{ header: 'Customer', render: (r) => r.customerName },
						{ header: 'Phone', render: (r) => r.customerPhone },
						{ header: 'Vehicle', render: (r) => r.vehicleRegistration },
						{ header: 'Total', render: (r) => formatINR(r.totalAmount), align: 'right' },
						{ header: 'Paid', render: (r) => formatINR(r.paidAmount), align: 'right' },
						{ header: 'Balance', render: (r) => formatINR(r.balanceAmount), align: 'right' },
						{ header: 'Age (days)', render: (r) => r.ageInDays, align: 'right' },
					]}
				/>
			)}

			{current.id === 'gst' && (
				<ReportPanel
					id="gst"
					bounds={bounds}
					// The GST report is one answer, not pages: show every invoice and keep the totals as the summary.
					fetchPage={async () => {
						const report = await getGstReport(range);
						return { items: report.invoices, totalCount: report.invoices.length, page: 1, pageSize: Math.max(report.invoices.length, 1), summary: report };
					}}
					rowKey={(r) => r.invoiceId}
					emptyText="No GST invoices in this period."
					kpis={(s) => [
						{ label: 'Invoices', value: String(s.invoiceCount) },
						{ label: 'Taxable value', value: formatINR(s.taxableBase) },
						{ label: 'CGST', value: formatINR(s.cgstAmount) },
						{ label: 'SGST', value: formatINR(s.sgstAmount) },
						{ label: 'Total GST', value: formatINR(s.totalGstAmount), tone: 'good' },
						{ label: 'Gross subtotal', value: formatINR(s.grossSubtotal) },
						{ label: 'Discounts', value: formatINR(s.totalDiscount) },
						{ label: 'Invoice total', value: formatINR(s.totalAmount) },
					]}
					columns={[
						{ header: 'Invoice', render: (r) => r.invoiceNumber ?? '—', mono: true },
						{ header: 'Date', render: (r) => formatReportDate(r.invoiceDate) },
						{ header: 'Customer', render: (r) => r.customerName },
						{ header: 'Vehicle', render: (r) => r.registrationNumber },
						{ header: 'GST invoice', render: (r) => (r.isGstEnabled ? 'Yes' : 'No') },
						{ header: 'Taxable', render: (r) => formatINR(r.taxableAmount), align: 'right' },
						{ header: 'GST', render: (r) => formatINR(r.gstAmount), align: 'right' },
						{ header: 'Total', render: (r) => formatINR(r.totalAmount), align: 'right' },
					]}
				/>
			)}

			{current.id === 'job-cards' && (
				<ReportPanel
					id="job-cards"
					bounds={bounds}
					fetchPage={(page, pageSize) => getJobCardReport({ ...range, page, pageSize })}
					rowKey={(r) => r.jobCardId}
					emptyText="No job cards in this period."
					kpis={(s) => [
						{ label: 'Job cards', value: String(s.totalCount) },
						{ label: 'In progress', value: String(s.inProgressCount) },
						{ label: 'Completed', value: String(s.completedCount), tone: 'good' },
						{ label: 'Cancelled', value: String(s.cancelledCount) },
						{ label: 'Invoiced', value: String(s.invoicedCount) },
						{ label: 'Value', value: formatINR(s.totalRevenue) },
					]}
					columns={[
						{ header: 'Job card', render: (r) => r.jobCardNumber, mono: true },
						{ header: 'Date', render: (r) => formatReportDate(r.date) },
						{ header: 'Customer', render: (r) => r.customerName },
						{ header: 'Vehicle', render: (r) => `${r.vehicleRegistration}${r.vehicleDetails ? ` · ${r.vehicleDetails}` : ''}` },
						{ header: 'Status', render: (r) => getJobCardStatusLabel(r.status) },
						{ header: 'Amount', render: (r) => formatINR(r.totalAmount), align: 'right' },
						{ header: 'Invoice', render: (r) => r.invoiceNumber ?? '', mono: true },
					]}
				/>
			)}
		</div>
	);
}
