import { FileText, Clock, TrendingUp, DollarSign, Users, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RevenueChart, type RevenueDataPoint } from '../../components/charts/RevenueChart';
import { JobStatusChart, type JobStatusDataPoint } from '../../components/charts/JobStatusChart';
import { getDashboardSummary, getJobCards, getJobCardStatusLabel } from '../../lib/api';

interface StatCardProps {
	title: string;
	value: string | number;
	change?: string;
	icon: typeof FileText;
	trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ title, value, change, icon: Icon, trend = 'neutral' }: StatCardProps) {
	return (
		<div className="app-card p-5">
			<div className="flex items-start justify-between">
				<div>
					<p className="text-sm font-medium text-on-surface-variant">{title}</p>
					<p className="text-2xl font-semibold text-on-surface mt-1">{value}</p>
					{change && (
						<p
							className={
								'text-xs mt-1 ' +
								(trend === 'up' ? 'text-[#2E7D32]' : '') +
								(trend === 'down' ? 'text-[#C62828]' : '') +
								(trend === 'neutral' ? 'text-on-surface-variant' : '')
							}
						>
							{change}
						</p>
					)}
				</div>
				<div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
					<Icon className="h-5 w-5 text-secondary" />
				</div>
			</div>
		</div>
	);
}

export function DashboardPage() {
	const navigate = useNavigate();

	// 1. Fetch real dashboard KPIs and summary
	const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery({
		queryKey: ['dashboard-summary'],
		queryFn: () => getDashboardSummary(),
	});

	// 2. Fetch real recent job cards
	const { data: recentJobsData, isLoading: isLoadingJobs } = useQuery({
		queryKey: ['dashboard-recent-job-cards'],
		queryFn: () => getJobCards({ page: 1, pageSize: 5 }),
	});
	const recentJobs = recentJobsData?.items ?? [];

	// Compute KPI values from real backend summary
	const totalCustomers = dashboardData?.vehicleActivity?.uniqueVehiclesServiced ?? 0;
	const activeJobs = (dashboardData?.jobCardKpis?.inProgressJobCards ?? 0) + (dashboardData?.jobCardKpis?.newJobCards ?? 0);
	const revenueMtd = dashboardData?.sales?.grossSubtotal ?? 0;
	const completedJobs = dashboardData?.jobCardKpis?.completedJobCards ?? 0;

	// Status chart distribution data
	const jobStatusData: JobStatusDataPoint[] = dashboardData
		? [
				{ name: 'Completed', value: dashboardData.jobCardKpis.completedJobCards, color: '#2E7D32' },
				{ name: 'In Progress', value: dashboardData.jobCardKpis.inProgressJobCards, color: '#6750A4' },
				{ name: 'New/Pending', value: dashboardData.jobCardKpis.newJobCards, color: '#E28743' },
				{ name: 'Cancelled', value: dashboardData.jobCardKpis.cancelledJobCards, color: '#C62828' },
		  ].filter((d) => d.value > 0)
		: [];

	// Revenue chart data
	const currentMonthName = new Date().toLocaleDateString('en-IN', { month: 'short' });
	const revenueChartData: RevenueDataPoint[] = [
		{ month: currentMonthName, revenue: revenueMtd }
	];

	return (
		<div className="space-y-5 animate-fade-in">
			{/* Stats Grid */}
			<div className="grid grid-cols-4 gap-4">
				<StatCard
					title="Total Customers"
					value={isLoadingDashboard ? '...' : String(totalCustomers)}
					change={totalCustomers > 0 ? `${totalCustomers} active customer${totalCustomers !== 1 ? 's' : ''}` : 'No customers yet'}
					icon={Users}
					trend="neutral"
				/>
				<StatCard
					title="Active Jobs"
					value={isLoadingDashboard ? '...' : String(activeJobs)}
					change={activeJobs > 0 ? `${activeJobs} in progress` : 'No active jobs'}
					icon={Clock}
					trend={activeJobs > 0 ? 'up' : 'neutral'}
				/>
				<StatCard
					title="Revenue (MTD)"
					value={isLoadingDashboard ? '...' : `₹${revenueMtd.toLocaleString('en-IN')}`}
					change={revenueMtd > 0 ? 'Real sales revenue' : 'No sales recorded'}
					icon={DollarSign}
					trend={revenueMtd > 0 ? 'up' : 'neutral'}
				/>
				<StatCard
					title="Completed (MTD)"
					value={isLoadingDashboard ? '...' : String(completedJobs)}
					change={completedJobs > 0 ? `${completedJobs} completed/delivered` : 'No completed jobs'}
					icon={TrendingUp}
					trend={completedJobs > 0 ? 'up' : 'neutral'}
				/>
			</div>

			{/* Charts Row */}
			<div className="grid grid-cols-3 gap-4">
				<RevenueChart data={revenueChartData} />
				<JobStatusChart data={jobStatusData} />
			</div>

			{/* Recent Activity */}
			<div className="app-card p-5">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-[15px] font-semibold text-on-surface">Recent Job Activity</h2>
					<Link to="/job-cards" className="text-xs font-semibold text-secondary hover:underline">
						View All
					</Link>
				</div>
				{isLoadingJobs ? (
					<div className="py-8 text-center text-on-surface-variant">
						<RefreshCw className="w-5 h-5 animate-spin mx-auto text-secondary mb-1" />
						<p className="text-xs">Loading recent activity...</p>
					</div>
				) : recentJobs.length > 0 ? (
					<div className="space-y-3">
						{recentJobs.map((jc) => (
							<div
								key={jc.id}
								className="flex items-start gap-3 py-2 border-b border-outline-variant last:border-b-0 cursor-pointer hover:bg-surface-container/40 px-2 rounded transition-colors"
								onClick={() => navigate(`/job-cards/${jc.id}`)}
							>
								<div className="h-2 w-2 rounded-full bg-secondary mt-2 flex-shrink-0" />
								<div className="flex-1 min-w-0">
									<p className="text-sm text-on-surface">
										<span className="font-mono font-semibold text-secondary">{jc.jobCardNumber}</span> — {jc.customerName} ({jc.registrationNumber})
									</p>
									<p className="text-xs text-on-surface-variant mt-0.5">
										{new Date(jc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · Status: {getJobCardStatusLabel(jc.status)} · Total: ₹{jc.totalAmount.toLocaleString('en-IN')}
									</p>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="py-8 text-center text-on-surface-variant">
						<p className="text-sm font-medium">No recent job card activity</p>
						<p className="text-xs text-on-surface-variant/70 mt-1">
							New job cards created will appear in real time here
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
