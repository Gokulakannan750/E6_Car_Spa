import { useState } from 'react';
import {
	Store,
	Receipt,
	TrendingUp,
	Clock,
	CheckCircle2,
	AlertCircle,
	Car,
	Building2,
} from 'lucide-react';
import type { DashboardSummaryDto } from '../../lib/api';
import { MonthlyShowroomReportView } from './MonthlyShowroomReportView';

interface ShowroomReportsViewProps {
	data: DashboardSummaryDto | undefined;
	isLoading: boolean;
	bounds: { start: Date; end: Date; startStr: string; endStr: string; label: string };
	formatINR: (val?: number | null) => string;
}

export function ShowroomReportsView({ data, isLoading, bounds, formatINR }: ShowroomReportsViewProps) {
	const [activeSubView, setActiveSubView] = useState<'monthly' | 'overview'>('monthly');
	const showroom = data?.showroom;

	return (
		<div className="space-y-6 animate-fade-in" data-testid="showroom-reports-view">
			{/* ── Sub-view Switcher Tabs ──────────────────────────────────── */}
			<div className="flex items-center gap-2 border-b border-outline-variant pb-px">
				<button
					type="button"
					onClick={() => setActiveSubView('monthly')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
						activeSubView === 'monthly'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-t-lg'
					}`}
				>
					<Building2 className="w-4 h-4" />
					Monthly Showroom Report
				</button>
				<button
					type="button"
					onClick={() => setActiveSubView('overview')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
						activeSubView === 'overview'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-t-lg'
					}`}
				>
					<Store className="w-4 h-4" />
					Network Summary & Settlement
				</button>
			</div>

			{activeSubView === 'monthly' ? (
				<MonthlyShowroomReportView />
			) : (
				<div className="space-y-6">
					{/* ── Showroom Network Metrics ──────────────────────────────────── */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{/* 1. Total Showroom Billed */}
				<div className="app-card p-4.5 border-l-4 border-l-secondary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Showroom Billed
						</span>
						<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
							<Store className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2">
						{isLoading ? '...' : formatINR(showroom?.totalBilled)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>Across {showroom?.activeShowroomsCount ?? 0} active showrooms</span>
					</div>
				</div>

				{/* 2. Total Showroom Received */}
				<div className="app-card p-4.5 border-l-4 border-l-success transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Showroom Collections
						</span>
						<div className="w-8 h-8 rounded-lg bg-success-container text-success flex items-center justify-center">
							<TrendingUp className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-success mt-2">
						{isLoading ? '...' : formatINR(showroom?.totalReceived)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>
							{(showroom?.totalBilled ?? 0) > 0
								? `${(((showroom?.totalReceived ?? 0) / (showroom?.totalBilled ?? 1)) * 100).toFixed(1)}% recovery`
								: '0% recovery'}
						</span>
					</div>
				</div>

				{/* 3. Showroom Outstanding Balance */}
				<div className="app-card p-4.5 border-l-4 border-l-error transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Showroom Outstanding
						</span>
						<div className="w-8 h-8 rounded-lg bg-error-container text-error flex items-center justify-center">
							<Clock className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-error mt-2">
						{isLoading ? '...' : formatINR(showroom?.totalOutstanding)}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>Unpaid showroom dues</span>
					</div>
				</div>

				{/* 4. Vehicles Attended */}
				<div className="app-card p-4.5 border-l-4 border-l-primary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Vehicles Serviced
						</span>
						<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
							<Car className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2">
						{isLoading ? '...' : showroom?.vehiclesAttended ?? 0}
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>{showroom?.staffAssignmentsCount ?? 0} staff assignments</span>
					</div>
				</div>
			</div>

			{/* ── Daily Bill Settlement Status Breakdown ────────────────────── */}
			<div className="app-card p-5 space-y-4">
				<div>
					<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
						<Receipt className="w-4 h-4 text-secondary" />
						Showroom Daily Bill Settlement Status
					</h2>
					<p className="text-xs text-on-surface-variant mt-0.5">
						Daily billing compliance across all showrooms between {bounds.label}
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
					<div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-emerald-800">Fully Paid Daily Bills</span>
							<CheckCircle2 className="w-4 h-4 text-emerald-700" />
						</div>
						<div className="text-3xl font-bold text-emerald-800 font-mono">
							{showroom?.paidDaysCount ?? 0}
						</div>
						<p className="text-[11px] text-emerald-700">Days with 100% payments settled</p>
					</div>

					<div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-amber-800">Partially Paid Bills</span>
							<Clock className="w-4 h-4 text-amber-700" />
						</div>
						<div className="text-3xl font-bold text-amber-800 font-mono">
							{showroom?.partiallyPaidDaysCount ?? 0}
						</div>
						<p className="text-[11px] text-amber-700">Days with partial payment recorded</p>
					</div>

					<div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-rose-800">Unpaid Daily Bills</span>
							<AlertCircle className="w-4 h-4 text-rose-700" />
						</div>
						<div className="text-3xl font-bold text-rose-800 font-mono">
							{showroom?.unpaidDaysCount ?? 0}
						</div>
						<p className="text-[11px] text-rose-700">Days with no payment recorded</p>
					</div>
				</div>
			</div>
		</div>
	)}
</div>
	);
}
