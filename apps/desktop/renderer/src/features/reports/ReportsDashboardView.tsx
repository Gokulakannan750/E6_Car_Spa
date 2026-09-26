import { useNavigate } from 'react-router-dom';
import {
	BarChart3,
	TrendingUp,
	IndianRupee,
	Receipt,
	CheckCircle2,
	Clock,
	Users,
	Store,
	SlidersHorizontal,
	FileSpreadsheet,
	ArrowRight,
	History,
	Sparkles,
} from 'lucide-react';
import type { DashboardSummaryDto } from '../../lib/api';
import { Button } from '../../components/ui/Button';

interface ReportsDashboardViewProps {
	data: DashboardSummaryDto | undefined;
	isLoading: boolean;
	bounds: { start: Date; end: Date; startStr: string; endStr: string; label: string };
	formatINR: (val?: number | null) => string;
}

export function ReportsDashboardView({ data, isLoading, bounds, formatINR }: ReportsDashboardViewProps) {
	const navigate = useNavigate();

	const billedRevenue = data?.sales?.netSales ?? data?.invoiceKpis?.totalInvoicedAmount ?? 0;
	const collected = data?.paymentCollection?.totalReceived ?? 0;
	const totalOutstanding = data?.outstanding?.totalOutstandingCombined ?? 0;
	const completedJobs = data?.jobCardKpis?.completedJobCards ?? 0;
	const invoicesCount =
		(data?.invoiceKpis?.generatedCount ?? 0) +
		(data?.invoiceKpis?.partiallyPaidCount ?? 0) +
		(data?.invoiceKpis?.paidCount ?? 0);

	const topServices = (data?.topServices || []).slice(0, 5);
	const recentAdvances = (data?.recentAdvances || []).slice(0, 5);
	const timeline = data?.revenueTimeline || [];
	const maxTimelineVal = Math.max(...timeline.map((t) => Math.max(t.revenue, t.collected)), 1);

	return (
		<div className="space-y-6 animate-fade-in" data-testid="reports-dashboard-view">
			{/* ── Executive KPI Summary Grid ─────────────────────────────────── */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{/* 1. Billed Revenue */}
				<div className="app-card p-4.5 border-l-4 border-l-secondary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Billed Revenue
						</span>
						<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
							<IndianRupee className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2 font-mono">
						{isLoading ? '...' : formatINR(billedRevenue)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<Receipt className="w-3.5 h-3.5 text-secondary" />
						<span>{invoicesCount} finalized invoices</span>
					</div>
				</div>

				{/* 2. Collections Received */}
				<div className="app-card p-4.5 border-l-4 border-l-success transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Collections Received
						</span>
						<div className="w-8 h-8 rounded-lg bg-success-container text-success flex items-center justify-center">
							<TrendingUp className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-success mt-2 font-mono">
						{isLoading ? '...' : formatINR(collected)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<CheckCircle2 className="w-3.5 h-3.5 text-success" />
						<span>
							{billedRevenue > 0 ? `${((collected / billedRevenue) * 100).toFixed(1)}% recovery rate` : '0%'}
						</span>
					</div>
				</div>

				{/* 3. Combined Total Outstanding */}
				<div className="app-card p-4.5 border-l-4 border-l-error transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Total Outstanding
						</span>
						<div className="w-8 h-8 rounded-lg bg-error-container text-error flex items-center justify-center">
							<Clock className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-error mt-2 font-mono">
						{isLoading ? '...' : formatINR(totalOutstanding)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>Invoices + Showrooms + Advances</span>
					</div>
				</div>

				{/* 4. Completed Job Cards */}
				<div className="app-card p-4.5 border-l-4 border-l-primary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Job Cards Completed
						</span>
						<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
							<Sparkles className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2 font-mono">
						{isLoading ? '...' : completedJobs}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>{data?.vehicleActivity?.totalServicesCompleted ?? 0} services performed</span>
					</div>
				</div>
			</div>

			{/* ── Quick Navigation to Report Modules ───────────────────────────── */}
			<div>
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider">
						Report Workspaces &amp; Detailed Analytics
					</h2>
					<span className="text-xs text-on-surface-variant">Click to navigate to dedicated report page</span>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{/* Business Reports Card */}
					<div
						onClick={() => navigate('/reports/business')}
						className="app-card p-4 transition-all hover:shadow-elevation-2 hover:border-secondary cursor-pointer group flex flex-col justify-between"
					>
						<div>
							<div className="flex items-center justify-between">
								<div className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
									<TrendingUp className="w-5 h-5" />
								</div>
								<ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-secondary group-hover:translate-x-1 transition-all" />
							</div>
							<h3 className="text-sm font-bold text-on-surface mt-3 group-hover:text-secondary transition-colors">
								Business Reports
							</h3>
							<p className="text-xs text-on-surface-variant mt-1">
								Net sales performance, discounts, GST tax breakdown, ticket sizes, and top revenue services.
							</p>
						</div>
						<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between text-xs">
							<span className="text-on-surface-variant font-medium">Net Sales</span>
							<span className="font-mono font-bold text-secondary">{formatINR(billedRevenue)}</span>
						</div>
					</div>

					{/* Billing Reports Card */}
					<div
						onClick={() => navigate('/reports/billing')}
						className="app-card p-4 transition-all hover:shadow-elevation-2 hover:border-secondary cursor-pointer group flex flex-col justify-between"
					>
						<div>
							<div className="flex items-center justify-between">
								<div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
									<FileSpreadsheet className="w-5 h-5" />
								</div>
								<ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
							</div>
							<h3 className="text-sm font-bold text-on-surface mt-3 group-hover:text-emerald-600 transition-colors">
								Billing Reports
							</h3>
							<p className="text-xs text-on-surface-variant mt-1">
								Invoices lifecycle status breakdown, payment modes (UPI, Cash, Card), and receivables tracking.
							</p>
						</div>
						<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between text-xs">
							<span className="text-on-surface-variant font-medium">Collections Inflow</span>
							<span className="font-mono font-bold text-emerald-600">{formatINR(collected)}</span>
						</div>
					</div>

					{/* Staff Reports Card */}
					<div
						onClick={() => navigate('/reports/staff')}
						className="app-card p-4 transition-all hover:shadow-elevation-2 hover:border-secondary cursor-pointer group flex flex-col justify-between"
					>
						<div>
							<div className="flex items-center justify-between">
								<div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
									<Users className="w-5 h-5" />
								</div>
								<ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
							</div>
							<h3 className="text-sm font-bold text-on-surface mt-3 group-hover:text-blue-600 transition-colors">
								Staff Reports
							</h3>
							<p className="text-xs text-on-surface-variant mt-1">
								Technician shift assignments, vehicles attended, and staff advance requests &amp; recovery audits.
							</p>
						</div>
						<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between text-xs">
							<span className="text-on-surface-variant font-medium">Active Advances</span>
							<span className="font-mono font-bold text-error">
								{formatINR(data?.staffAdvances?.outstandingAmount)}
							</span>
						</div>
					</div>

					{/* Showroom Reports Card */}
					<div
						onClick={() => navigate('/reports/showroom')}
						className="app-card p-4 transition-all hover:shadow-elevation-2 hover:border-secondary cursor-pointer group flex flex-col justify-between"
					>
						<div>
							<div className="flex items-center justify-between">
								<div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
									<Store className="w-5 h-5" />
								</div>
								<ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
							</div>
							<h3 className="text-sm font-bold text-on-surface mt-3 group-hover:text-amber-600 transition-colors">
								Showroom Reports
							</h3>
							<p className="text-xs text-on-surface-variant mt-1">
								B2B dealership operations, daily bill compliance, showroom vehicle counts, and settlement tracking.
							</p>
						</div>
						<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between text-xs">
							<span className="text-on-surface-variant font-medium">Showrooms Billed</span>
							<span className="font-mono font-bold text-amber-600">
								{formatINR(data?.showroom?.totalBilled)}
							</span>
						</div>
					</div>

					{/* Custom Reports Card */}
					<div
						onClick={() => navigate('/reports/custom')}
						className="app-card p-4 transition-all hover:shadow-elevation-2 hover:border-secondary cursor-pointer group flex flex-col justify-between"
					>
						<div>
							<div className="flex items-center justify-between">
								<div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
									<SlidersHorizontal className="w-5 h-5" />
								</div>
								<ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
							</div>
							<h3 className="text-sm font-bold text-on-surface mt-3 group-hover:text-purple-600 transition-colors">
								Custom Reports
							</h3>
							<p className="text-xs text-on-surface-variant mt-1">
								Flexible report builder with multi-sheet Excel spreadsheet generation across custom date ranges.
							</p>
						</div>
						<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between text-xs">
							<span className="text-on-surface-variant font-medium">Report Builder</span>
							<span className="text-purple-600 font-semibold">Multi-Dataset Export</span>
						</div>
					</div>

					{/* Global Audit Trail Card */}
					<div
						onClick={() => navigate('/audit')}
						className="app-card p-4 transition-all hover:shadow-elevation-2 hover:border-secondary cursor-pointer group flex flex-col justify-between"
					>
						<div>
							<div className="flex items-center justify-between">
								<div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
									<History className="w-5 h-5" />
								</div>
								<ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
							</div>
							<h3 className="text-sm font-bold text-on-surface mt-3 group-hover:text-rose-600 transition-colors">
								Audit Trail
							</h3>
							<p className="text-xs text-on-surface-variant mt-1">
								Complete system audit log tracking security events, invoices finalized, staff updates, and permissions.
							</p>
						</div>
						<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between text-xs">
							<span className="text-on-surface-variant font-medium">System Compliance</span>
							<span className="text-rose-600 font-semibold">Audit Logs</span>
						</div>
					</div>
				</div>
			</div>

			{/* ── Revenue vs Collections Timeline Chart ───────────────────────── */}
			<div className="app-card p-5 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
							<BarChart3 className="w-4 h-4 text-secondary" />
							Revenue vs Collections Timeline
						</h2>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Billed Revenue (by Invoice Date) vs Cash Inflow (by Payment Date)
						</p>
					</div>
					<div className="flex items-center gap-3 text-xs">
						<div className="flex items-center gap-1.5">
							<span className="w-3 h-3 rounded-xs bg-[#0453cd]" />
							<span className="text-on-surface-variant">Billed</span>
						</div>
						<div className="flex items-center gap-1.5">
							<span className="w-3 h-3 rounded-xs bg-[#2e7d32]" />
							<span className="text-on-surface-variant">Collected</span>
						</div>
					</div>
				</div>

				{timeline.length === 0 ? (
					<div className="py-12 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant rounded-lg">
						No daily transactions recorded for {bounds.label}.
					</div>
				) : (
					<div className="space-y-2 pt-2">
						{timeline.map((point) => {
							const revPct = Math.min(100, Math.round((point.revenue / maxTimelineVal) * 100));
							const colPct = Math.min(100, Math.round((point.collected / maxTimelineVal) * 100));

							return (
								<div key={point.key} className="space-y-1">
									<div className="flex items-center justify-between text-xs">
										<span className="font-medium text-on-surface">{point.label}</span>
										<div className="flex items-center gap-3 font-mono text-[11px]">
											<span className="text-[#0453cd]">Billed: {formatINR(point.revenue)}</span>
											<span className="text-[#2e7d32]">Paid: {formatINR(point.collected)}</span>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-2 h-3 bg-surface-container-high rounded-full overflow-hidden p-0.5">
										<div
											className="h-full bg-[#0453cd] rounded-full transition-all duration-500"
											style={{ width: `${revPct}%` }}
										/>
										<div
											className="h-full bg-[#2e7d32] rounded-full transition-all duration-500"
											style={{ width: `${colPct}%` }}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* ── Summary Tables (Top Services Preview & Recent Staff Advances) ─── */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Top Services Preview */}
				<div className="app-card overflow-hidden">
					<div className="p-4 border-b border-outline-variant flex items-center justify-between">
						<div>
							<h3 className="text-sm font-semibold text-on-surface">Top Revenue Services</h3>
							<p className="text-[11px] text-on-surface-variant">Top performing services in period</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate('/reports/business')}
							className="text-xs text-secondary hover:text-secondary-hover"
						>
							View All
						</Button>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs border-collapse">
							<thead className="bg-surface-container-high text-on-surface-variant font-semibold border-b border-outline-variant">
								<tr>
									<th className="py-2.5 px-4">Service</th>
									<th className="py-2.5 px-4 text-center">Bookings</th>
									<th className="py-2.5 px-4 text-right">Revenue (INR)</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-outline-variant">
								{topServices.length === 0 ? (
									<tr>
										<td colSpan={3} className="py-6 text-center text-on-surface-variant">
											No services recorded
										</td>
									</tr>
								) : (
									topServices.map((s, idx) => (
										<tr key={s.name + idx} className="hover:bg-surface-container/30">
											<td className="py-2 px-4 font-medium text-on-surface">{s.name}</td>
											<td className="py-2 px-4 text-center font-bold text-on-surface">{s.count}</td>
											<td className="py-2 px-4 text-right font-mono font-bold text-secondary">
												{formatINR(s.revenue)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Recent Staff Advances Preview */}
				<div className="app-card overflow-hidden">
					<div className="p-4 border-b border-outline-variant flex items-center justify-between">
						<div>
							<h3 className="text-sm font-semibold text-on-surface">Staff Advances Log</h3>
							<p className="text-[11px] text-on-surface-variant">Recent advance requests &amp; settlements</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate('/reports/staff')}
							className="text-xs text-secondary hover:text-secondary-hover"
						>
							View All
						</Button>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs border-collapse">
							<thead className="bg-surface-container-high text-on-surface-variant font-semibold border-b border-outline-variant">
								<tr>
									<th className="py-2.5 px-4">Staff</th>
									<th className="py-2.5 px-4">Reason</th>
									<th className="py-2.5 px-4 text-right">Amount (INR)</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-outline-variant">
								{recentAdvances.length === 0 ? (
									<tr>
										<td colSpan={3} className="py-6 text-center text-on-surface-variant">
											No advance records
										</td>
									</tr>
								) : (
									recentAdvances.map((adv) => (
										<tr key={adv.id} className="hover:bg-surface-container/30">
											<td className="py-2 px-4 font-medium text-on-surface">{adv.staffName}</td>
											<td className="py-2 px-4 text-on-surface-variant truncate max-w-[120px]">
												{adv.reason || '—'}
											</td>
											<td className="py-2 px-4 text-right font-mono font-bold text-error">
												{formatINR(adv.amount)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
