import {
	Users,
	Wallet,
	CheckCircle2,
	Calendar,
	History,
} from 'lucide-react';
import type { DashboardSummaryDto } from '../../lib/api';

interface StaffReportsViewProps {
	data: DashboardSummaryDto | undefined;
	isLoading: boolean;
	bounds: { start: Date; end: Date; startStr: string; endStr: string; label: string };
	formatINR: (val?: number | null) => string;
}

export function StaffReportsView({ data, isLoading, bounds: _bounds, formatINR }: StaffReportsViewProps) {
	const staffAdvances = data?.staffAdvances;
	const recentAdvances = data?.recentAdvances || [];
	const staffAssignmentsCount = data?.showroom?.staffAssignmentsCount ?? 0;
	const vehiclesAttended = data?.showroom?.vehiclesAttended ?? 0;

	return (
		<div className="space-y-6 animate-fade-in" data-testid="staff-reports-view">
			{/* ── Staff & Advances Metrics ──────────────────────────────────── */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{/* 1. Outstanding Advances Balance */}
				<div className="app-card p-4.5 border-l-4 border-l-error transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Outstanding Advances
						</span>
						<div className="w-8 h-8 rounded-lg bg-error-container text-error flex items-center justify-center">
							<Wallet className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-error mt-2">
						{isLoading ? '...' : formatINR(staffAdvances?.outstandingAmount)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>{staffAdvances?.outstandingCount ?? 0} active unpaid advances</span>
					</div>
				</div>

				{/* 2. Settled Advances Recovered */}
				<div className="app-card p-4.5 border-l-4 border-l-success transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Settled Advances
						</span>
						<div className="w-8 h-8 rounded-lg bg-success-container text-success flex items-center justify-center">
							<CheckCircle2 className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-success mt-2">
						{isLoading ? '...' : formatINR(staffAdvances?.settledAmount)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>{staffAdvances?.settledCount ?? 0} advances settled in full</span>
					</div>
				</div>

				{/* 3. Total Staff Shifts Assigned */}
				<div className="app-card p-4.5 border-l-4 border-l-secondary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Shifts Assigned
						</span>
						<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
							<Users className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2">
						{isLoading ? '...' : staffAssignmentsCount}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>Technician shifts in period</span>
					</div>
				</div>

				{/* 4. Total Vehicles Serviced */}
				<div className="app-card p-4.5 border-l-4 border-l-primary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Vehicles Serviced
						</span>
						<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
							<Calendar className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2">
						{isLoading ? '...' : vehiclesAttended}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>Across showrooms & workshop</span>
					</div>
				</div>
			</div>

			{/* ── Recent Staff Advances Log Table ───────────────────────────── */}
			<div className="app-card overflow-hidden">
				<div className="p-4 border-b border-outline-variant flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
							<History className="w-4 h-4 text-secondary" />
							Staff Advances &amp; Settlements Log
						</h2>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Audit log of staff advance requests, recoveries, and statuses
						</p>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left text-xs border-collapse">
						<thead className="bg-surface-container-high text-on-surface-variant font-semibold border-b border-outline-variant">
							<tr>
								<th className="py-2.5 px-4">Date</th>
								<th className="py-2.5 px-4">Employee Name</th>
								<th className="py-2.5 px-4">Role</th>
								<th className="py-2.5 px-4">Reason / Notes</th>
								<th className="py-2.5 px-4 text-center">Status</th>
								<th className="py-2.5 px-4 text-right">Advance Amount (INR)</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-outline-variant">
							{recentAdvances.length === 0 ? (
								<tr>
									<td colSpan={6} className="py-8 text-center text-on-surface-variant">
										No staff advance records found.
									</td>
								</tr>
							) : (
								recentAdvances.map((adv) => (
									<tr key={adv.id} className="hover:bg-surface-container/30 transition-colors">
										<td className="py-2.5 px-4 font-mono text-on-surface">
											{new Date(adv.advanceDate).toLocaleDateString('en-IN', {
												day: 'numeric',
												month: 'short',
												year: 'numeric',
											})}
										</td>
										<td className="py-2.5 px-4 font-semibold text-on-surface">{adv.staffName}</td>
										<td className="py-2.5 px-4 text-on-surface-variant">{adv.staffRole || 'Staff'}</td>
										<td className="py-2.5 px-4 text-on-surface-variant max-w-[200px] truncate" title={adv.reason}>
											{adv.reason || '—'}
										</td>
										<td className="py-2.5 px-4 text-center">
											<span
												className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
													adv.status === 'Outstanding'
														? 'bg-rose-50 text-rose-700 border-rose-200'
														: adv.status === 'Settled'
														? 'bg-emerald-50 text-emerald-700 border-emerald-200'
														: 'bg-gray-100 text-gray-700 border-gray-200'
												}`}
											>
												{adv.status}
											</span>
										</td>
										<td className="py-2.5 px-4 text-right font-mono font-bold text-on-surface">
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
	);
}
