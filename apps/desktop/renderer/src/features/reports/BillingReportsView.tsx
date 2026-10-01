import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	Receipt,
	CreditCard,
	FileSpreadsheet,
	CheckCircle2,
	AlertCircle,
	Clock,
	ShieldCheck,
	Banknote,
	Download,
	Calendar,
	ChevronDown,
	ChevronUp,
	RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
	getMonthlyBillingReport,
	type DashboardSummaryDto,
	type MonthlyBillingReportResponse,
} from '../../lib/api';
import { generateAndDownloadMonthlyBillingReport } from './excelMonthlyBillingGenerator';

const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

interface BillingReportsViewProps {
	data?: DashboardSummaryDto;
	isLoading?: boolean;
	bounds?: { start: Date; end: Date; startStr: string; endStr: string; label: string };
	formatINR: (val?: number | null) => string;
}

export function BillingReportsView({ data, isLoading: isParentLoading, bounds, formatINR }: BillingReportsViewProps) {
	const now = new Date();
	const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
	const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
	const [isExporting, setIsExporting] = useState<boolean>(false);
	const [expandedDay, setExpandedDay] = useState<number | null>(null);

	const formatCurrency = (val?: number | null) => {
		if (formatINR) return formatINR(val);
		if (val === undefined || val === null) return '₹0.00';
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			maximumFractionDigits: 2,
		}).format(val);
	};

	const invoiceKpis = data?.invoiceKpis;
	const paymentCollection = data?.paymentCollection;
	const sales = data?.sales;

	const paymentMethods = paymentCollection?.breakdownByMethod || [];
	const totalCollected = paymentCollection?.totalReceived ?? 0;
	const totalTransactions = paymentCollection?.transactionCount ?? 0;

	// Authoritative Monthly Billing Query for Excel Generation and Daily Breakdown
	const {
		data: monthlyReport,
		isLoading: isMonthlyLoading,
		isError: isMonthlyError,
		error: monthlyError,
		refetch: refetchMonthly,
		isFetching: isMonthlyFetching,
	} = useQuery<MonthlyBillingReportResponse>({
		queryKey: ['monthly-billing-report', selectedYear, selectedMonth],
		queryFn: () => getMonthlyBillingReport({ year: selectedYear, month: selectedMonth }),
	});

	const handleExportExcel = () => {
		if (!monthlyReport) return;
		setIsExporting(true);
		try {
			generateAndDownloadMonthlyBillingReport(monthlyReport);
		} catch (err) {
			console.error('Failed to export Monthly Billing Excel:', err);
		} finally {
			setIsExporting(false);
		}
	};

	const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

	return (
		<div className="space-y-6 animate-fade-in" data-testid="billing-reports-view">
			{/* ── Month Selection & Excel Export Action Bar ─────────────────── */}
			<div className="app-card p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-l-secondary">
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex items-center gap-2 text-on-surface font-semibold text-sm">
						<Calendar className="w-4 h-4 text-secondary" />
						<span>Reporting Month:</span>
					</div>

					{/* Month Selector */}
					<div className="flex flex-col">
						<select
							id="billing-month-select"
							aria-label="Select reporting month"
							value={selectedMonth}
							onChange={(e) => setSelectedMonth(Number(e.target.value))}
							className="h-9 px-3 text-xs bg-surface-container border border-outline-variant rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary min-w-[130px] font-medium"
						>
							{MONTH_NAMES.map((name, idx) => (
								<option key={name} value={idx + 1}>
									{name}
								</option>
							))}
						</select>
					</div>

					{/* Year Selector */}
					<div className="flex flex-col">
						<select
							id="billing-year-select"
							aria-label="Select reporting year"
							value={selectedYear}
							onChange={(e) => setSelectedYear(Number(e.target.value))}
							className="h-9 px-3 text-xs bg-surface-container border border-outline-variant rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary min-w-[100px] font-medium"
						>
							{years.map((y) => (
								<option key={y} value={y}>
									{y}
								</option>
							))}
						</select>
					</div>

					<button
						type="button"
						onClick={() => refetchMonthly()}
						disabled={isMonthlyFetching}
						title="Refresh monthly data"
						className="p-2 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
					>
						<RefreshCw className={`w-4 h-4 ${isMonthlyFetching ? 'animate-spin text-secondary' : ''}`} />
					</button>
				</div>

				{/* Export Monthly Excel Button */}
				<div className="flex items-center gap-2.5">
					<Button
						variant="primary"
						size="sm"
						icon={<Download className="w-4 h-4" />}
						onClick={handleExportExcel}
						disabled={!monthlyReport || isMonthlyLoading || isExporting}
						loading={isExporting}
						className="shadow-xs whitespace-nowrap"
					>
						Export Monthly Billing Excel
					</Button>
				</div>
			</div>

			{/* ── Top Billing Metrics ───────────────────────────────────────── */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{/* 1. Total Invoiced Amount */}
				<div className="app-card p-4.5 border-l-4 border-l-secondary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Total Invoiced
						</span>
						<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
							<Receipt className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2 font-mono">
						{isParentLoading ? '...' : formatCurrency(invoiceKpis?.totalInvoicedAmount)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>{(invoiceKpis?.generatedCount ?? 0) + (invoiceKpis?.partiallyPaidCount ?? 0) + (invoiceKpis?.paidCount ?? 0)} finalized bills</span>
					</div>
				</div>

				{/* 2. Total Paid / Collected */}
				<div className="app-card p-4.5 border-l-4 border-l-success transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Total Payments Collected
						</span>
						<div className="w-8 h-8 rounded-lg bg-success-container text-success flex items-center justify-center">
							<CreditCard className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-success mt-2 font-mono">
						{isParentLoading ? '...' : formatCurrency(totalCollected)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>{totalTransactions} payment transactions</span>
					</div>
				</div>

				{/* 3. Outstanding Invoice Receivables */}
				<div className="app-card p-4.5 border-l-4 border-l-error transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Invoice Receivables
						</span>
						<div className="w-8 h-8 rounded-lg bg-error-container text-error flex items-center justify-center">
							<Clock className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-error mt-2 font-mono">
						{isParentLoading ? '...' : formatCurrency(invoiceKpis?.totalOutstandingAmount)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>Uncollected invoice balance</span>
					</div>
				</div>

				{/* 4. Total Tax / GST Collected */}
				<div className="app-card p-4.5 border-l-4 border-l-primary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							GST Tax Collected
						</span>
						<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
							<ShieldCheck className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2 font-mono">
						{isParentLoading ? '...' : formatCurrency(sales?.gstAmount)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>CGST + SGST in period</span>
					</div>
				</div>
			</div>

			{/* ── Invoices Status Distribution & Payment Methods Breakdown ──── */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Invoices Status Breakdown */}
				<div className="app-card p-5 space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
								<Receipt className="w-4 h-4 text-secondary" />
								Invoice Status Distribution
							</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Lifecycle status of invoices issued between {bounds?.label || 'period'}
							</p>
						</div>
					</div>

					<div className="space-y-3 pt-2 text-xs">
						<div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
							<div className="flex items-center gap-2">
								<CheckCircle2 className="w-4 h-4 text-emerald-700" />
								<span className="font-semibold text-emerald-800">Fully Paid Invoices</span>
							</div>
							<div className="text-right font-mono">
								<span className="text-sm font-bold text-emerald-800">{invoiceKpis?.paidCount ?? 0}</span>
								<span className="text-[11px] text-emerald-700 ml-1.5">invoices</span>
							</div>
						</div>

						<div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200">
							<div className="flex items-center gap-2">
								<Clock className="w-4 h-4 text-amber-700" />
								<span className="font-semibold text-amber-800">Partially Paid Invoices</span>
							</div>
							<div className="text-right font-mono">
								<span className="text-sm font-bold text-amber-800">{invoiceKpis?.partiallyPaidCount ?? 0}</span>
								<span className="text-[11px] text-amber-700 ml-1.5">invoices</span>
							</div>
						</div>

						<div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 border border-blue-200">
							<div className="flex items-center gap-2">
								<Receipt className="w-4 h-4 text-blue-700" />
								<span className="font-semibold text-blue-800">Generated / Payment Pending</span>
							</div>
							<div className="text-right font-mono">
								<span className="text-sm font-bold text-blue-800">{invoiceKpis?.generatedCount ?? 0}</span>
								<span className="text-[11px] text-blue-700 ml-1.5">invoices</span>
							</div>
						</div>

						<div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200">
							<div className="flex items-center gap-2">
								<FileSpreadsheet className="w-4 h-4 text-gray-700" />
								<span className="font-semibold text-gray-800">Draft Invoices</span>
							</div>
							<div className="text-right font-mono">
								<span className="text-sm font-bold text-gray-800">{invoiceKpis?.draftCount ?? 0}</span>
								<span className="text-[11px] text-gray-700 ml-1.5">invoices</span>
							</div>
						</div>

						<div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50 border border-rose-200">
							<div className="flex items-center gap-2">
								<AlertCircle className="w-4 h-4 text-rose-700" />
								<span className="font-semibold text-rose-800">Cancelled Invoices</span>
							</div>
							<div className="text-right font-mono">
								<span className="text-sm font-bold text-rose-800">{invoiceKpis?.cancelledCount ?? 0}</span>
								<span className="text-[11px] text-rose-700 ml-1.5">invoices</span>
							</div>
						</div>
					</div>
				</div>

				{/* Collections by Payment Method */}
				<div className="app-card p-5 space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
								<Banknote className="w-4 h-4 text-success" />
								Collections by Payment Method
							</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Cash receipts deposited between {bounds?.label || 'period'}
							</p>
						</div>
					</div>

					<div className="space-y-3 pt-2">
						{paymentMethods.length === 0 ? (
							<div className="py-12 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant rounded-lg">
								No payment collections recorded in this date range.
							</div>
						) : (
							paymentMethods.map((pm) => {
								const pct = totalCollected > 0 ? Math.round((pm.amount / totalCollected) * 100) : 0;

								return (
									<div key={pm.method} className="space-y-1">
										<div className="flex items-center justify-between text-xs">
											<div className="flex items-center gap-2">
												<span className="font-semibold text-on-surface">{pm.method}</span>
												<span className="text-[11px] text-on-surface-variant">({pm.transactionCount} txns)</span>
											</div>
											<div className="flex items-center gap-2 font-mono font-bold text-on-surface">
												<span>{formatINR(pm.amount)}</span>
												<span className="text-[11px] text-on-surface-variant font-normal">({pct}%)</span>
											</div>
										</div>
										<div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
											<div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			</div>

			{/* ── Daily Billing Activity Explorer (Preview & Inspection) ──── */}
			<div className="app-card p-5 space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant pb-3">
					<div>
						<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
							<FileSpreadsheet className="w-4 h-4 text-secondary" />
							Monthly Billing Excel Structure Preview
						</h2>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Calendar days in {monthlyReport?.monthName || `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`} included in the Excel workbook
						</p>
					</div>
					<div className="text-xs text-on-surface-variant font-mono">
						<span>{monthlyReport?.dailySheets.filter((d) => d.hasActivity).length ?? 0} active days</span>
						<span className="mx-2">•</span>
						<span>{monthlyReport?.dailySheets.filter((d) => !d.hasActivity).length ?? 0} empty days</span>
					</div>
				</div>

				{isMonthlyError && (
					<div className="p-3 rounded-lg bg-error-container/30 border border-error/20 text-xs text-error">
						Failed to load daily activity breakdown: {(monthlyError as any)?.message || 'An error occurred'}
					</div>
				)}

				<div className="overflow-x-auto">
					<table className="w-full text-xs text-left">
						<thead className="bg-surface-container-high/60 text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
							<tr>
								<th className="py-2.5 px-3">Sheet Name</th>
								<th className="py-2.5 px-3">Date</th>
								<th className="py-2.5 px-3 text-right">Job Cards</th>
								<th className="py-2.5 px-3 text-right">Invoices</th>
								<th className="py-2.5 px-3 text-right">Invoice Total</th>
								<th className="py-2.5 px-3 text-right">Paid</th>
								<th className="py-2.5 px-3 text-right">Pending</th>
								<th className="py-2.5 px-3 text-right">Services</th>
								<th className="py-2.5 px-3 text-center">Status</th>
								<th className="py-2.5 px-2 text-center w-10"></th>
							</tr>
						</thead>
						<tbody className="divide-y divide-outline-variant">
							{isMonthlyLoading ? (
								<tr>
									<td colSpan={10} className="py-8 text-center text-xs text-on-surface-variant">
										Loading daily billing activity...
									</td>
								</tr>
							) : !monthlyReport || monthlyReport.dailySheets.length === 0 ? (
								<tr>
									<td colSpan={10} className="py-8 text-center text-xs text-on-surface-variant">
										No billing data available for this month.
									</td>
								</tr>
							) : (
								monthlyReport.dailySheets.map((daySheet) => {
									const isExpanded = expandedDay === daySheet.day;
									return (
										<tr
											key={daySheet.day}
											className={`hover:bg-surface-container/50 transition-colors ${
												!daySheet.hasActivity ? 'opacity-60 bg-surface-container-lowest/40' : ''
											}`}
										>
											<td className="py-2 px-3 font-mono font-semibold text-secondary">
												{daySheet.sheetName}
											</td>
											<td className="py-2 px-3 text-on-surface">{daySheet.dateFormatted}</td>
											<td className="py-2 px-3 text-right font-mono text-on-surface">
												{daySheet.totals.jobCardCount}
											</td>
											<td className="py-2 px-3 text-right font-mono text-on-surface">
												{daySheet.totals.invoiceCount}
											</td>
											<td className="py-2 px-3 text-right font-mono font-medium text-on-surface">
												{formatCurrency(daySheet.totals.invoiceTotal)}
											</td>
											<td className="py-2 px-3 text-right font-mono text-success">
												{formatCurrency(daySheet.totals.amountPaid)}
											</td>
											<td className="py-2 px-3 text-right font-mono text-error">
												{formatCurrency(daySheet.totals.amountPending)}
											</td>
											<td className="py-2 px-3 text-right font-mono text-on-surface">
												{daySheet.totals.serviceCount} ({daySheet.totals.serviceTotalQuantity} qty)
											</td>
											<td className="py-2 px-3 text-center">
												{daySheet.hasActivity ? (
													<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
														Active
													</span>
												) : (
													<span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
														No activity
													</span>
												)}
											</td>
											<td className="py-2 px-2 text-center">
												{daySheet.hasActivity && (
													<button
														type="button"
														onClick={() => setExpandedDay(isExpanded ? null : daySheet.day)}
														className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
														title={isExpanded ? 'Hide details' : 'View daily details'}
													>
														{isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
													</button>
												)}
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Expanded Day Details Modal / Card */}
				{expandedDay !== null && monthlyReport && (
					(() => {
						const activeDay = monthlyReport.dailySheets.find((d) => d.day === expandedDay);
						if (!activeDay) return null;

						return (
							<div className="mt-4 p-4 rounded-xl bg-surface-container/60 border border-secondary/20 space-y-4">
								<div className="flex items-center justify-between border-b border-outline-variant pb-2">
									<h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
										<FileSpreadsheet className="w-4 h-4 text-secondary" />
										<span>{`Detailed Records for ${activeDay.dateFormatted} (Sheet: ${activeDay.sheetName})`}</span>
									</h3>
									<button
										type="button"
										onClick={() => setExpandedDay(null)}
										className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
									>
										Close
									</button>
								</div>

								{/* Invoices table */}
								<div className="space-y-1.5">
									<h4 className="text-xs font-semibold text-on-surface uppercase tracking-wider text-[10px]">
										Invoices ({activeDay.invoices.length})
									</h4>
									{activeDay.invoices.length === 0 ? (
										<p className="text-[11px] text-on-surface-variant italic">No invoices issued on this date.</p>
									) : (
										<div className="overflow-x-auto">
											<table className="w-full text-xs text-left bg-surface rounded-lg border border-outline-variant">
												<thead className="bg-surface-container text-on-surface-variant text-[10px]">
													<tr>
														<th className="p-2">Invoice #</th>
														<th className="p-2">Job Card #</th>
														<th className="p-2">Customer</th>
														<th className="p-2">Vehicle</th>
														<th className="p-2">Status</th>
														<th className="p-2 text-right">Total</th>
														<th className="p-2 text-right">Paid</th>
														<th className="p-2 text-right">Pending</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-outline-variant">
													{activeDay.invoices.map((inv) => (
														<tr key={inv.invoiceId}>
															<td className="p-2 font-mono font-medium text-secondary">{inv.invoiceNumber}</td>
															<td className="p-2 font-mono">{inv.jobCardNumber}</td>
															<td className="p-2">{inv.customerName}</td>
															<td className="p-2 font-mono">{inv.vehicleRegistration}</td>
															<td className="p-2">{inv.invoiceStatus}</td>
															<td className="p-2 text-right font-mono font-medium">{formatCurrency(inv.invoiceTotal)}</td>
															<td className="p-2 text-right font-mono text-success">{formatCurrency(inv.amountPaid)}</td>
															<td className="p-2 text-right font-mono text-error">{formatCurrency(inv.amountPending)}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
								</div>

								{/* Job Cards table */}
								<div className="space-y-1.5">
									<h4 className="text-xs font-semibold text-on-surface uppercase tracking-wider text-[10px]">
										Job Cards ({activeDay.jobCards.length})
									</h4>
									{activeDay.jobCards.length === 0 ? (
										<p className="text-[11px] text-on-surface-variant italic">No job cards created on this date.</p>
									) : (
										<div className="overflow-x-auto">
											<table className="w-full text-xs text-left bg-surface rounded-lg border border-outline-variant">
												<thead className="bg-surface-container text-on-surface-variant text-[10px]">
													<tr>
														<th className="p-2">Job Card #</th>
														<th className="p-2">Customer</th>
														<th className="p-2">Vehicle</th>
														<th className="p-2">Status</th>
														<th className="p-2 text-right">Services</th>
														<th className="p-2 text-right">Total Amount</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-outline-variant">
													{activeDay.jobCards.map((jc) => (
														<tr key={jc.jobCardId}>
															<td className="p-2 font-mono font-medium text-secondary">{jc.jobCardNumber}</td>
															<td className="p-2">{jc.customerName}</td>
															<td className="p-2 font-mono">{jc.vehicleRegistration} ({jc.vehicle})</td>
															<td className="p-2">{jc.jobCardStatus}</td>
															<td className="p-2 text-right font-mono">{jc.totalServices}</td>
															<td className="p-2 text-right font-mono font-medium">{formatCurrency(jc.jobCardTotal)}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
								</div>

								{/* Services table */}
								<div className="space-y-1.5">
									<h4 className="text-xs font-semibold text-on-surface uppercase tracking-wider text-[10px]">
										Services Performed ({activeDay.services.length})
									</h4>
									{activeDay.services.length === 0 ? (
										<p className="text-[11px] text-on-surface-variant italic">No services recorded on this date.</p>
									) : (
										<div className="overflow-x-auto">
											<table className="w-full text-xs text-left bg-surface rounded-lg border border-outline-variant">
												<thead className="bg-surface-container text-on-surface-variant text-[10px]">
													<tr>
														<th className="p-2">Job Card #</th>
														<th className="p-2">Invoice #</th>
														<th className="p-2">Customer</th>
														<th className="p-2">Service Name</th>
														<th className="p-2 text-right">Quantity</th>
														<th className="p-2 text-right">Rate</th>
														<th className="p-2 text-right">Amount</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-outline-variant">
													{activeDay.services.map((s) => (
														<tr key={s.serviceItemId}>
															<td className="p-2 font-mono text-secondary">{s.jobCardNumber}</td>
															<td className="p-2 font-mono">{s.invoiceNumber || '—'}</td>
															<td className="p-2">{s.customerName}</td>
															<td className="p-2 font-medium">{s.serviceName}</td>
															<td className="p-2 text-right font-mono">{s.quantity}</td>
															<td className="p-2 text-right font-mono">{formatCurrency(s.rate)}</td>
															<td className="p-2 text-right font-mono font-medium">{formatCurrency(s.amount)}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
								</div>
							</div>
						);
					})()
				)}
			</div>
		</div>
	);
}
