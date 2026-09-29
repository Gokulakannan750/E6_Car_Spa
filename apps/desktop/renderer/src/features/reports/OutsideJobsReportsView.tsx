import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
	Truck,
	Clock,
	AlertTriangle,
	CheckCircle2,
	DollarSign,
	Download,
	RefreshCw,
	Car,
	ExternalLink,
	Building2,
	History,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getOutsideJobsReport, type OutsideJobsReportDto } from '../../lib/api';
import { generateOutsideJobsExcel } from './excelOutsideJobsGenerator';

interface OutsideJobsReportsViewProps {
	bounds: {
		startStr: string;
		endStr: string;
		label: string;
	};
	formatINR: (val?: number | null) => string;
}

type SubTab = 'currently-outside' | 'history' | 'vendors';

export function OutsideJobsReportsView({ bounds, formatINR }: OutsideJobsReportsViewProps) {
	const [activeSubTab, setActiveSubTab] = useState<SubTab>('currently-outside');

	const {
		data: reportData,
		isLoading,
		isError,
		error,
		refetch,
	} = useQuery<OutsideJobsReportDto>({
		queryKey: ['reports-outside-jobs', bounds.startStr, bounds.endStr],
		queryFn: () => getOutsideJobsReport({ fromDate: bounds.startStr, toDate: bounds.endStr }),
	});

	const summary = {
		totalOutsideJobs: (reportData?.totalOutsideCount ?? 0) + (reportData?.history?.length ?? 0),
		currentlyOutside: reportData?.totalOutsideCount ?? 0,
		overdue: reportData?.totalOverdueCount ?? 0,
		completed: reportData?.history?.filter(h => h.status === 2 || h.statusName === 'Returned').length ?? 0,
		totalExternalCost: (reportData?.totalActiveCost ?? 0) + (reportData?.totalHistoricalCost ?? 0),
	};

	const formatDateTime = (iso?: string | null) => {
		if (!iso) return '—';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
		});
	};

	const formatDuration = (hours?: number | null) => {
		if (hours === null || hours === undefined) return '—';
		if (hours < 1) {
			const m = Math.round(hours * 60);
			return `${m}m`;
		}
		const h = Math.floor(hours);
		const m = Math.round((hours - h) * 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	};

	return (
		<div className="space-y-6">
			{/* Top bar with quick export */}
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-container/40 p-4 rounded-xl border border-outline-variant/60">
				<div>
					<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
						<Truck className="w-5 h-5 text-secondary" />
						Outside Jobs & External Movements
					</h2>
					<p className="text-xs text-on-surface-variant mt-0.5">
						Track vehicles sent to external workshops, vendor workloads, turnaround times, and internal costs
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="secondary"
						size="sm"
						icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
						onClick={() => refetch()}
						disabled={isLoading}
					>
						Refresh
					</Button>
					<Button
						size="sm"
						icon={<Download className="w-3.5 h-3.5" />}
						onClick={() => reportData && generateOutsideJobsExcel(reportData, bounds.label)}
						disabled={isLoading || !reportData}
					>
						Export Outside Jobs Excel
					</Button>
				</div>
			</div>

			{/* KPI Summary Cards */}
			<div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
				<div className="app-card p-4 flex flex-col justify-between">
					<div className="flex items-center justify-between text-on-surface-variant">
						<span className="text-xs font-medium">Total Movements</span>
						<Truck className="w-4 h-4 text-secondary" />
					</div>
					<div className="mt-2">
						<span className="text-2xl font-bold text-on-surface tracking-tight font-mono">
							{summary.totalOutsideJobs}
						</span>
						<p className="text-[11px] text-on-surface-variant mt-0.5">In selected period</p>
					</div>
				</div>

				<div className="app-card p-4 flex flex-col justify-between border-amber-500/30 bg-amber-500/5">
					<div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
						<span className="text-xs font-semibold">Currently Outside</span>
						<Clock className="w-4 h-4" />
					</div>
					<div className="mt-2">
						<span className="text-2xl font-bold text-amber-700 dark:text-amber-400 tracking-tight font-mono">
							{summary.currentlyOutside}
						</span>
						<p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">At external shops</p>
					</div>
				</div>

				<div className={`app-card p-4 flex flex-col justify-between ${summary.overdue > 0 ? 'border-red-500/40 bg-red-500/10' : ''}`}>
					<div className="flex items-center justify-between text-red-600 dark:text-red-400">
						<span className="text-xs font-semibold">Overdue Outside</span>
						<AlertTriangle className="w-4 h-4" />
					</div>
					<div className="mt-2">
						<span className="text-2xl font-bold text-red-600 dark:text-red-400 tracking-tight font-mono">
							{summary.overdue}
						</span>
						<p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">Past expected return</p>
					</div>
				</div>

				<div className="app-card p-4 flex flex-col justify-between border-emerald-500/30 bg-emerald-500/5">
					<div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
						<span className="text-xs font-semibold">Returned</span>
						<CheckCircle2 className="w-4 h-4" />
					</div>
					<div className="mt-2">
						<span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight font-mono">
							{summary.completed}
						</span>
						<p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">Back in showroom</p>
					</div>
				</div>

				<div className="app-card p-4 flex flex-col justify-between col-span-2 md:col-span-1">
					<div className="flex items-center justify-between text-on-surface-variant">
						<span className="text-xs font-medium">Total Vendor Cost</span>
						<DollarSign className="w-4 h-4 text-secondary" />
					</div>
					<div className="mt-2">
						<span className="text-xl font-bold text-on-surface tracking-tight font-mono">
							{formatINR(summary.totalExternalCost)}
						</span>
						<p className="text-[11px] text-on-surface-variant mt-0.5">Internal operational cost</p>
					</div>
				</div>
			</div>

			{/* Sub tabs */}
			<div className="flex items-center gap-2 border-b border-outline-variant">
				<button
					type="button"
					onClick={() => setActiveSubTab('currently-outside')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
						activeSubTab === 'currently-outside'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface'
					}`}
				>
					<Clock className="w-3.5 h-3.5" />
					<span>Currently Outside ({summary.currentlyOutside})</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveSubTab('history')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
						activeSubTab === 'history'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface'
					}`}
				>
					<History className="w-3.5 h-3.5" />
					<span>Movement History ({reportData?.history?.length ?? 0})</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveSubTab('vendors')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
						activeSubTab === 'vendors'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface'
					}`}
				>
					<Building2 className="w-3.5 h-3.5" />
					<span>Vendor Summary ({reportData?.vendorSummary?.length ?? 0})</span>
				</button>
			</div>

			{/* Error State */}
			{isError && (
				<div className="p-4 rounded-xl bg-error-container/30 border border-error/20 text-xs text-error">
					Failed to load outside jobs data: {(error as any)?.message || 'Unknown error'}
				</div>
			)}

			{/* Table: Currently Outside */}
			{activeSubTab === 'currently-outside' && (
				<div className="app-card overflow-hidden">
					<div className="overflow-x-auto">
						<table className="app-table">
							<thead>
								<tr>
									<th>Status</th>
									<th>Vehicle</th>
									<th>Customer</th>
									<th>Job Card</th>
									<th>Vendor</th>
									<th>Service</th>
									<th>Sent Date/Time</th>
									<th>Expected Return</th>
									<th>Vendor Cost</th>
									<th className="text-right">Action</th>
								</tr>
							</thead>
							<tbody>
								{isLoading && (
									<tr>
										<td colSpan={10} className="py-12 text-center text-on-surface-variant">
											<RefreshCw className="w-5 h-5 animate-spin mx-auto text-secondary mb-2" />
											<p className="text-xs">Loading external vehicles...</p>
										</td>
									</tr>
								)}

								{!isLoading && (reportData?.currentlyOutside?.length ?? 0) === 0 && (
									<tr>
										<td colSpan={10} className="py-12 text-center text-on-surface-variant">
											<CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
											<p className="text-sm font-medium text-on-surface">All Vehicles in Showroom</p>
											<p className="text-xs mt-1">No vehicles are currently sent to external vendors.</p>
										</td>
									</tr>
								)}

								{!isLoading &&
									(reportData?.currentlyOutside ?? []).map((job) => (
										<tr key={job.id} className="hover:bg-surface-container/50">
											<td>
												{job.isOverdue ? (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
														<span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
														Overdue
													</span>
												) : (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
														<span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
														Outside
													</span>
												)}
											</td>
											<td>
												<div className="flex items-center gap-1.5">
													<Car className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
													<span className="font-medium text-on-surface">{job.vehicleRegistration}</span>
												</div>
												<p className="text-xs text-on-surface-variant">
													{job.vehicleModel}
												</p>
											</td>
											<td>
												<p className="font-medium text-on-surface">{job.customerName}</p>
												<p className="text-xs text-on-surface-variant font-mono">{job.customerPhone}</p>
											</td>
											<td>
												<Link
													to={`/job-cards/${job.jobCardId}`}
													className="text-secondary hover:underline font-mono text-xs font-semibold"
												>
													{job.jobCardNumber}
												</Link>
											</td>
											<td>
												<span className="font-medium text-on-surface">{job.vendorName}</span>
											</td>
											<td>
												<span className="text-xs font-medium text-on-surface bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
													{job.serviceName}
												</span>
											</td>
											<td className="text-xs text-on-surface-variant whitespace-nowrap">
												{formatDateTime(job.sentAt)}
											</td>
											<td className="text-xs font-medium whitespace-nowrap">
												<span className={job.isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-on-surface'}>
													{formatDateTime(job.expectedReturnAt)}
												</span>
											</td>
											<td className="text-xs font-mono font-medium text-on-surface">
												{job.vendorCost ? formatINR(job.vendorCost) : '—'}
											</td>
											<td className="text-right">
												<Link to={`/job-cards/${job.jobCardId}`}>
													<Button size="sm" variant="secondary" icon={<ExternalLink className="w-3 h-3" />}>
														Open Job Card
													</Button>
												</Link>
											</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Table: Movement History */}
			{activeSubTab === 'history' && (
				<div className="app-card overflow-hidden">
					<div className="overflow-x-auto">
						<table className="app-table">
							<thead>
								<tr>
									<th>Status</th>
									<th>Vehicle</th>
									<th>Customer</th>
									<th>Job Card</th>
									<th>Vendor</th>
									<th>Service</th>
									<th>Sent</th>
									<th>Returned</th>
									<th>Duration</th>
									<th>Cost</th>
									<th className="text-right">Action</th>
								</tr>
							</thead>
							<tbody>
								{isLoading && (
									<tr>
										<td colSpan={11} className="py-12 text-center text-on-surface-variant">
											<RefreshCw className="w-5 h-5 animate-spin mx-auto text-secondary mb-2" />
											<p className="text-xs">Loading movement history...</p>
										</td>
									</tr>
								)}

								{!isLoading && (reportData?.history?.length ?? 0) === 0 && (
									<tr>
										<td colSpan={11} className="py-12 text-center text-on-surface-variant">
											<p className="text-sm font-medium text-on-surface">No History Records</p>
											<p className="text-xs mt-1">No outside movements recorded in this period.</p>
										</td>
									</tr>
								)}

								{!isLoading &&
									(reportData?.history ?? []).map((job) => (
										<tr key={job.id} className="hover:bg-surface-container/50">
											<td>
												{job.status === 2 ? (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
														<CheckCircle2 className="w-3 h-3" />
														Returned
													</span>
												) : job.status === 3 ? (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-container text-on-surface-variant border border-outline-variant">
														Cancelled
													</span>
												) : (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary/15 text-secondary border border-secondary/30">
														{job.statusName}
													</span>
												)}
											</td>
											<td>
												<span className="font-medium text-on-surface">{job.vehicleRegistration}</span>
												<p className="text-xs text-on-surface-variant">
													{job.vehicleModel}
												</p>
											</td>
											<td>
												<p className="font-medium text-on-surface">{job.customerName}</p>
											</td>
											<td>
												<Link
													to={`/job-cards/${job.jobCardId}`}
													className="text-secondary hover:underline font-mono text-xs font-semibold"
												>
													{job.jobCardNumber}
												</Link>
											</td>
											<td>
												<span className="font-medium text-on-surface">{job.vendorName}</span>
											</td>
											<td>
												<span className="text-xs font-medium text-on-surface">{job.serviceName}</span>
											</td>
											<td className="text-xs text-on-surface-variant whitespace-nowrap">
												{formatDateTime(job.sentAt)}
											</td>
											<td className="text-xs text-on-surface-variant whitespace-nowrap">
												{formatDateTime(job.returnedAt)}
											</td>
											<td className="text-xs font-mono font-medium text-on-surface">
												{formatDuration(job.durationHours)}
											</td>
											<td className="text-xs font-mono font-medium text-on-surface">
												{job.vendorCost ? formatINR(job.vendorCost) : '—'}
											</td>
											<td className="text-right">
												<Link to={`/job-cards/${job.jobCardId}`}>
													<Button size="sm" variant="secondary" icon={<ExternalLink className="w-3 h-3" />}>
														Open
													</Button>
												</Link>
											</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Table: Vendor Summary */}
			{activeSubTab === 'vendors' && (
				<div className="app-card overflow-hidden">
					<div className="overflow-x-auto">
						<table className="app-table">
							<thead>
								<tr>
									<th>Vendor Name</th>
									<th>Total Jobs</th>
									<th>Currently Outside</th>
									<th>Overdue</th>
									<th>Completed</th>
									<th>Total External Cost</th>
								</tr>
							</thead>
							<tbody>
								{isLoading && (
									<tr>
										<td colSpan={6} className="py-12 text-center text-on-surface-variant">
											<RefreshCw className="w-5 h-5 animate-spin mx-auto text-secondary mb-2" />
											<p className="text-xs">Loading vendor statistics...</p>
										</td>
									</tr>
								)}

								{!isLoading && (reportData?.vendorSummary?.length ?? 0) === 0 && (
									<tr>
										<td colSpan={6} className="py-12 text-center text-on-surface-variant">
											<p className="text-sm font-medium text-on-surface">No Vendor Data</p>
											<p className="text-xs mt-1">No vendor activity recorded in this period.</p>
										</td>
									</tr>
								)}

								{!isLoading &&
									(reportData?.vendorSummary ?? []).map((v) => (
										<tr key={v.vendorId} className="hover:bg-surface-container/50">
											<td>
												<div className="flex items-center gap-2">
													<Building2 className="w-4 h-4 text-secondary shrink-0" />
													<span className="font-semibold text-on-surface">{v.vendorName}</span>
												</div>
											</td>
											<td className="font-mono text-xs font-semibold text-on-surface">{v.totalJobs}</td>
											<td>
												{v.currentlyOutside > 0 ? (
													<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono">
														{v.currentlyOutside}
													</span>
												) : (
													<span className="text-xs text-on-surface-variant font-mono">0</span>
												)}
											</td>
											<td>
												{v.overdueJobs > 0 ? (
													<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 font-mono">
														{v.overdueJobs}
													</span>
												) : (
													<span className="text-xs text-on-surface-variant font-mono">0</span>
												)}
											</td>
											<td className="font-mono text-xs text-emerald-700 dark:text-emerald-400 font-medium">
												{v.completedJobs}
											</td>
											<td className="font-mono text-sm font-bold text-on-surface">
												{formatINR(v.totalVendorCost)}
											</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}
