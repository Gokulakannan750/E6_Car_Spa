import {
	TrendingUp,
	IndianRupee,
	Receipt,
	CheckCircle2,
	Clock,
	Award,
	Sparkles,
	BarChart3,
} from 'lucide-react';
import type { DashboardSummaryDto } from '../../lib/api';

interface BusinessReportsViewProps {
	data: DashboardSummaryDto | undefined;
	isLoading: boolean;
	bounds: { start: Date; end: Date; startStr: string; endStr: string; label: string };
	formatINR: (val?: number | null) => string;
}

export function BusinessReportsView({ data, isLoading, bounds, formatINR }: BusinessReportsViewProps) {
	const billedRevenue = data?.invoiceKpis?.totalInvoicedAmount ?? data?.sales?.netSales ?? 0;
	const collected = data?.paymentCollection?.totalReceived ?? 0;
	const outstanding = data?.invoiceKpis?.totalOutstandingAmount ?? 0;
	const invoicesCount =
		(data?.invoiceKpis?.generatedCount ?? 0) +
		(data?.invoiceKpis?.partiallyPaidCount ?? 0) +
		(data?.invoiceKpis?.paidCount ?? 0);
	const jobCardsCount = data?.jobCardKpis?.totalJobCards ?? 0;
	const completedJobs = data?.jobCardKpis?.completedJobCards ?? 0;
	const avgTicket = invoicesCount > 0 ? billedRevenue / invoicesCount : 0;
	const topServices = data?.topServices || [];
	const timeline = data?.revenueTimeline || [];

	const maxTimelineVal = Math.max(...timeline.map((t) => Math.max(t.revenue, t.collected)), 1);

	return (
		<div className="space-y-6 animate-fade-in" data-testid="business-reports-view">
			{/* ── Executive KPI Grid ────────────────────────────────────────── */}
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
					<div className="text-2xl font-bold text-on-surface mt-2">
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
					<div className="text-2xl font-bold text-success mt-2">
						{isLoading ? '...' : formatINR(collected)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<CheckCircle2 className="w-3.5 h-3.5 text-success" />
						<span>
							{billedRevenue > 0 ? `${((collected / billedRevenue) * 100).toFixed(1)}% recovery rate` : '0%'}
						</span>
					</div>
				</div>

				{/* 3. Outstanding Receivables */}
				<div className="app-card p-4.5 border-l-4 border-l-error transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Invoice Outstanding
						</span>
						<div className="w-8 h-8 rounded-lg bg-error-container text-error flex items-center justify-center">
							<Clock className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-error mt-2">
						{isLoading ? '...' : formatINR(outstanding)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span className="font-medium text-error">Uncollected balance</span>
					</div>
				</div>

				{/* 4. Average Ticket Size */}
				<div className="app-card p-4.5 border-l-4 border-l-primary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Avg Ticket Size
						</span>
						<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
							<Sparkles className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2">
						{isLoading ? '...' : formatINR(avgTicket)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>{completedJobs} / {jobCardsCount} jobs completed</span>
					</div>
				</div>
			</div>

			{/* ── Revenue vs Collections Timeline Chart & Sales Metrics ───────── */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Timeline Bar / Trend Visual */}
				<div className="lg:col-span-2 app-card p-5 space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
								<BarChart3 className="w-4 h-4 text-secondary" />
								Revenue vs Collections Timeline
							</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Billed Revenue (by InvoiceDate) vs Cash Inflow (by PaymentDate)
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
											<div className="h-full bg-[#0453cd] rounded-full transition-all duration-500" style={{ width: `${revPct}%` }} />
											<div className="h-full bg-[#2e7d32] rounded-full transition-all duration-500" style={{ width: `${colPct}%` }} />
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Sales Breakdown Summary Card */}
				<div className="app-card p-5 space-y-4 flex flex-col justify-between">
					<div>
						<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
							<Receipt className="w-4 h-4 text-primary" />
							Sales Breakdown
						</h2>
						<p className="text-xs text-on-surface-variant mt-0.5">Financial composition for {bounds.label}</p>

						<div className="space-y-3 mt-4 text-xs">
							<div className="flex justify-between py-1.5 border-b border-outline-variant">
								<span className="text-on-surface-variant">Gross Subtotal</span>
								<span className="font-mono font-medium text-on-surface">{formatINR(data?.sales?.grossSubtotal)}</span>
							</div>
							<div className="flex justify-between py-1.5 border-b border-outline-variant">
								<span className="text-on-surface-variant">Total Discounts Given</span>
								<span className="font-mono font-medium text-error">- {formatINR(data?.sales?.totalDiscount)}</span>
							</div>
							<div className="flex justify-between py-1.5 border-b border-outline-variant">
								<span className="text-on-surface-variant">GST / Tax Amount</span>
								<span className="font-mono font-medium text-on-surface">{formatINR(data?.sales?.gstAmount)}</span>
							</div>
							<div className="flex justify-between py-2 border-t-2 border-outline-variant text-sm font-bold">
								<span className="text-on-surface">Net Billed Sales</span>
								<span className="font-mono text-secondary">{formatINR(data?.sales?.netSales)}</span>
							</div>
						</div>
					</div>

					<div className="p-3 bg-surface-container-high rounded-lg text-xs space-y-1">
						<div className="flex justify-between text-on-surface-variant">
							<span>Vehicles Serviced</span>
							<span className="font-bold text-on-surface">{data?.vehicleActivity?.vehiclesServiced ?? 0}</span>
						</div>
						<div className="flex justify-between text-on-surface-variant">
							<span>Services Completed</span>
							<span className="font-bold text-on-surface">{data?.vehicleActivity?.totalServicesCompleted ?? 0}</span>
						</div>
					</div>
				</div>
			</div>

			{/* ── Top Performing Services Table ────────────────────────────── */}
			<div className="app-card overflow-hidden">
				<div className="p-4 border-b border-outline-variant flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
							<Award className="w-4 h-4 text-secondary" />
							Top Performing Services
						</h2>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Ranked by actual Job Card service revenue in period
						</p>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left text-xs border-collapse">
						<thead className="bg-surface-container-high text-on-surface-variant font-semibold border-b border-outline-variant">
							<tr>
								<th className="py-2.5 px-4">#</th>
								<th className="py-2.5 px-4">Service Name</th>
								<th className="py-2.5 px-4">Category</th>
								<th className="py-2.5 px-4 text-center">Bookings / Qty</th>
								<th className="py-2.5 px-4 text-right">Revenue (INR)</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-outline-variant">
							{topServices.length === 0 ? (
								<tr>
									<td colSpan={5} className="py-8 text-center text-on-surface-variant">
										No service bookings found in this date range.
									</td>
								</tr>
							) : (
								topServices.map((svc, idx) => (
									<tr key={svc.name + idx} className="hover:bg-surface-container/30 transition-colors">
										<td className="py-2.5 px-4 font-mono text-on-surface-variant">{idx + 1}</td>
										<td className="py-2.5 px-4 font-medium text-on-surface">{svc.name}</td>
										<td className="py-2.5 px-4 text-on-surface-variant">
											<span className="px-2 py-0.5 bg-surface-container rounded-full text-[11px] border border-outline-variant">
												{svc.category || 'General Services'}
											</span>
										</td>
										<td className="py-2.5 px-4 text-center font-bold text-on-surface">{svc.count}</td>
										<td className="py-2.5 px-4 text-right font-mono font-bold text-secondary">
											{formatINR(svc.revenue)}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
