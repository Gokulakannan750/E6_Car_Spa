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
	RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
	getMonthlyBillingReport,
	type DashboardSummaryDto,
	type MonthlyBillingReportResponse,
} from '../../lib/api';
import { generateAndDownloadMonthlyBillingReport } from './excelMonthlyBillingGenerator';

export const MONTH_NAMES = [
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
] as const;

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

	// Authoritative Monthly Billing Query for Excel Generation
	const {
		data: monthlyReport,
		isLoading: isMonthlyLoading,
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
		</div>
	);
}
