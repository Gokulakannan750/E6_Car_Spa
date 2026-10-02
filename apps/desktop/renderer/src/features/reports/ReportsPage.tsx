import { useState, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
	BarChart3,
	FileSpreadsheet,
	Users,
	Store,
	SlidersHorizontal,
	Calendar,
	RefreshCw,
	AlertCircle,
	Truck,
	History,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getDashboardSummary } from '../../lib/api';
import { BillingReportsView } from './BillingReportsView';
import { StaffReportsView } from './StaffReportsView';
import { ShowroomReportsView } from './ShowroomReportsView';
import { CustomReportsView } from './CustomReportsView';
import { OutsideJobsReportsView } from './OutsideJobsReportsView';

export type ReportType = 'billing' | 'staff' | 'showroom' | 'outside-jobs' | 'custom' | 'audit';
export type DatePreset = 'today' | '7d' | '30d' | 'month' | 'year' | 'custom';

function formatINR(val?: number | null): string {
	if (val === null || val === undefined) return '₹0.00';
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		maximumFractionDigits: 2,
	}).format(val);
}

function formatDateStr(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function getDateBounds(preset: DatePreset, customStart: string, customEnd: string) {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	if (preset === 'today') {
		const str = formatDateStr(today);
		return { start: today, end: today, startStr: str, endStr: str, label: 'Today' };
	}
	if (preset === '7d') {
		const s = new Date(today);
		s.setDate(s.getDate() - 6);
		return { start: s, end: today, startStr: formatDateStr(s), endStr: formatDateStr(today), label: 'Last 7 Days' };
	}
	if (preset === '30d') {
		const s = new Date(today);
		s.setDate(s.getDate() - 29);
		return { start: s, end: today, startStr: formatDateStr(s), endStr: formatDateStr(today), label: 'Last 30 Days' };
	}
	if (preset === 'month') {
		const s = new Date(today.getFullYear(), today.getMonth(), 1);
		const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
		return { start: s, end: e, startStr: formatDateStr(s), endStr: formatDateStr(e), label: 'This Month' };
	}
	if (preset === 'year') {
		const s = new Date(today.getFullYear(), 0, 1);
		const e = new Date(today.getFullYear(), 11, 31);
		return { start: s, end: e, startStr: formatDateStr(s), endStr: formatDateStr(e), label: 'This Year' };
	}

	// Custom
	const start = customStart ? new Date(customStart) : today;
	const cEnd = customEnd ? new Date(customEnd) : today;
	return {
		start,
		end: cEnd,
		startStr: customStart || formatDateStr(start),
		endStr: customEnd || formatDateStr(cEnd),
		label: 'Custom Range',
	};
}

export function ReportsPage() {
	const [searchParams] = useSearchParams();
	const location = useLocation();
	const navigate = useNavigate();

	// Determine active report type from query param or pathname (defaults strictly to billing)
	const activeType: ReportType = useMemo(() => {
		const param = searchParams.get('type');
		if (param === 'staff' || param === 'showroom' || param === 'outside-jobs' || param === 'custom') {
			return param;
		}
		if (location.pathname.endsWith('/staff')) return 'staff';
		if (location.pathname.endsWith('/showroom')) return 'showroom';
		if (location.pathname.endsWith('/outside-jobs')) return 'outside-jobs';
		if (location.pathname.endsWith('/custom')) return 'custom';
		return 'billing';
	}, [searchParams, location.pathname]);

	// ── Date Filter State ─────────────────────────────────────────────────────
	const [preset, setPreset] = useState<DatePreset>('30d');
	const [customStart, setCustomStart] = useState<string>(() => {
		const d = new Date();
		d.setDate(d.getDate() - 29);
		return formatDateStr(d);
	});
	const [customEnd, setCustomEnd] = useState<string>(() => formatDateStr(new Date()));
	const bounds = useMemo(() => getDateBounds(preset, customStart, customEnd), [preset, customStart, customEnd]);

	// ── Live Backend Aggregated Reports Query ────────────────────────────────
	const {
		data: dashboardData,
		isLoading,
		isError,
		error,
		refetch,
	} = useQuery({
		queryKey: ['reports-dashboard-summary', bounds.startStr, bounds.endStr],
		queryFn: () => getDashboardSummary({ fromDate: bounds.startStr, toDate: bounds.endStr }),
	});

	const handleTabSelect = (type: ReportType) => {
		if (type === 'audit') {
			navigate('/audit');
		} else {
			navigate(`/reports/${type}`);
		}
	};

	return (
		<div className="space-y-6 animate-fade-in pb-12">
			{/* ── Main Header ─────────────────────────────────────────────────── */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold text-on-surface tracking-tight flex items-center gap-2.5">
						<BarChart3 className="w-6 h-6 text-secondary" />
						Reports &amp; Business Analytics
					</h1>
					<p className="text-sm text-on-surface-variant mt-0.5">
						Audit-verified financial reporting, collections, workforce, and showroom analytics
					</p>
				</div>

				{/* Date Preset Filter Bar */}
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex items-center bg-surface-container-high rounded-lg p-1 border border-outline-variant text-xs">
						{(['today', '7d', '30d', 'month', 'year', 'custom'] as DatePreset[]).map((p) => {
							const labels: Record<DatePreset, string> = {
								today: 'Today',
								'7d': '7D',
								'30d': '30D',
								month: 'This Month',
								year: 'This Year',
								custom: 'Custom',
							};
							const isActive = preset === p;
							return (
								<button
									key={p}
									type="button"
									onClick={() => setPreset(p)}
									className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
										isActive
											? 'bg-secondary text-white shadow-xs font-semibold'
											: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
									}`}
								>
									{labels[p]}
								</button>
							);
						})}
					</div>

					{preset === 'custom' && (
						<div className="flex items-center gap-1.5 text-xs bg-surface-container p-1 rounded-lg border border-outline-variant">
							<Calendar className="w-3.5 h-3.5 text-on-surface-variant ml-1.5" />
							<input
								type="date"
								value={customStart}
								onChange={(e) => setCustomStart(e.target.value)}
								className="bg-transparent border-0 text-xs text-on-surface font-medium focus:ring-0 px-1 py-0.5"
								aria-label="Start Date"
							/>
							<span className="text-on-surface-variant font-bold">to</span>
							<input
								type="date"
								value={customEnd}
								onChange={(e) => setCustomEnd(e.target.value)}
								className="bg-transparent border-0 text-xs text-on-surface font-medium focus:ring-0 px-1 py-0.5"
								aria-label="End Date"
							/>
						</div>
					)}
				</div>
			</div>

			{/* ── Sub-navigation Tab Bar ───────────────────────────────────────── */}
			<div className="flex items-center gap-2 overflow-x-auto border-b border-outline-variant pb-px">
				<button
					type="button"
					onClick={() => handleTabSelect('billing')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
						activeType === 'billing'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
					}`}
				>
					<FileSpreadsheet className="w-4 h-4" />
					<span>Billing Reports</span>
				</button>

				<button
					type="button"
					onClick={() => handleTabSelect('staff')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
						activeType === 'staff'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
					}`}
				>
					<Users className="w-4 h-4" />
					<span>Staff Reports</span>
				</button>

				<button
					type="button"
					onClick={() => handleTabSelect('showroom')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
						activeType === 'showroom'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
					}`}
				>
					<Store className="w-4 h-4" />
					<span>Showroom Reports</span>
				</button>

				<button
					type="button"
					onClick={() => handleTabSelect('outside-jobs')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
						activeType === 'outside-jobs'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
					}`}
				>
					<Truck className="w-4 h-4" />
					<span>Outside Jobs</span>
				</button>

				<button
					type="button"
					onClick={() => handleTabSelect('custom')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
						activeType === 'custom'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
					}`}
				>
					<SlidersHorizontal className="w-4 h-4" />
					<span>Custom Reports</span>
				</button>

				<button
					type="button"
					onClick={() => handleTabSelect('audit')}
					className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant"
				>
					<History className="w-4 h-4" />
					<span>Audit Trail</span>
				</button>
			</div>

			{/* ── Error Banner State ────────────────────────────────────────────── */}
			{isError && (
				<div className="p-4 rounded-xl bg-error-container/40 border border-error/20 text-xs text-error flex items-center justify-between gap-3 shadow-xs">
					<div className="flex items-center gap-2">
						<AlertCircle className="w-4 h-4 shrink-0" />
						<span>
							Failed to load financial report data: {(error as any)?.message || 'An unexpected error occurred.'}
						</span>
					</div>
					<Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => refetch()}>
						Retry
					</Button>
				</div>
			)}

			{/* ── Render Specific Report Page View ──────────────────────────────── */}
			{activeType === 'billing' && (
				<BillingReportsView
					data={dashboardData}
					isLoading={isLoading}
					bounds={bounds}
					formatINR={formatINR}
				/>
			)}

			{activeType === 'staff' && (
				<StaffReportsView
					data={dashboardData}
					isLoading={isLoading}
					bounds={bounds}
					formatINR={formatINR}
				/>
			)}

			{activeType === 'showroom' && (
				<ShowroomReportsView
					data={dashboardData}
					isLoading={isLoading}
					bounds={bounds}
					formatINR={formatINR}
				/>
			)}

			{activeType === 'outside-jobs' && (
				<OutsideJobsReportsView
					bounds={bounds}
					formatINR={formatINR}
				/>
			)}

			{activeType === 'custom' && (
				<CustomReportsView
					data={dashboardData}
					isLoading={isLoading}
					bounds={bounds}
					formatINR={formatINR}
				/>
			)}
		</div>
	);
}

export default ReportsPage;

