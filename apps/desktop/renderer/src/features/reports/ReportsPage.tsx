import { useState, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
	BarChart3,
	TrendingUp,
	FileSpreadsheet,
	Users,
	Store,
	SlidersHorizontal,
	Calendar,
	Download,
	RefreshCw,
	AlertCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getDashboardSummary } from '../../lib/api';
import { ReportsDashboardView } from './ReportsDashboardView';
import { BusinessReportsView } from './BusinessReportsView';
import { BillingReportsView } from './BillingReportsView';
import { StaffReportsView } from './StaffReportsView';
import { ShowroomReportsView } from './ShowroomReportsView';
import { CustomReportsView } from './CustomReportsView';
import * as XLSX from 'xlsx';

export type ReportType = 'dashboard' | 'business' | 'billing' | 'staff' | 'showroom' | 'custom';
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

	// Determine active report type from query param or pathname
	const activeType: ReportType = useMemo(() => {
		const param = searchParams.get('type');
		if (param === 'business' || param === 'billing' || param === 'staff' || param === 'showroom' || param === 'custom') {
			return param;
		}
		if (location.pathname.endsWith('/business')) return 'business';
		if (location.pathname.endsWith('/billing')) return 'billing';
		if (location.pathname.endsWith('/staff')) return 'staff';
		if (location.pathname.endsWith('/showroom')) return 'showroom';
		if (location.pathname.endsWith('/custom')) return 'custom';
		return 'dashboard';
	}, [searchParams, location.pathname]);

	// ── Date Filter State ─────────────────────────────────────────────────────
	const [preset, setPreset] = useState<DatePreset>('30d');
	const [customStart, setCustomStart] = useState<string>(() => {
		const d = new Date();
		d.setDate(d.getDate() - 29);
		return formatDateStr(d);
	});
	const [customEnd, setCustomEnd] = useState<string>(() => formatDateStr(new Date()));
	const [isExporting, setIsExporting] = useState(false);

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
		if (type === 'dashboard') {
			navigate('/reports');
		} else {
			navigate(`/reports/${type}`);
		}
	};

	// ── Excel Export Handler ─────────────────────────────────────────────────
	const handleExportExcel = () => {
		if (!dashboardData) return;
		setIsExporting(true);

		try {
			const wb = XLSX.utils.book_new();

			// Sheet 1: Executive Summary
			const summaryData = [
				['E6 Car Spa Management Suite - Comprehensive Financial Report', ''],
				['Report Period', `${bounds.startStr} to ${bounds.endStr} (${bounds.label})`],
				['Generated At', new Date().toLocaleString('en-IN')],
				['', ''],
				['EXECUTIVE FINANCIAL METRICS', 'AMOUNT (INR)'],
				['Gross Subtotal', dashboardData.sales.grossSubtotal],
				['Total Discount', dashboardData.sales.totalDiscount],
				['GST Amount', dashboardData.sales.gstAmount],
				['Net Billed Revenue', dashboardData.sales.netSales],
				['Total Cash Collections Received', dashboardData.paymentCollection.totalReceived],
				['Total Invoice Outstanding Balance', dashboardData.invoiceKpis.totalOutstandingAmount],
				['Total Staff Advance Outstanding', dashboardData.staffAdvances.outstandingAmount],
				['Combined Total Outstanding Liability', dashboardData.outstanding.totalOutstandingCombined],
				['', ''],
				['OPERATIONAL METRICS', 'COUNT'],
				['Total Job Cards', dashboardData.jobCardKpis.totalJobCards],
				['Completed Job Cards', dashboardData.jobCardKpis.completedJobCards],
				['Active Showrooms', dashboardData.showroom.activeShowroomsCount],
				['Total Showroom Billed', dashboardData.showroom.totalBilled],
				['Total Showroom Received', dashboardData.showroom.totalReceived],
				['Total Showroom Outstanding', dashboardData.showroom.totalOutstanding],
				['Vehicles Attended at Showrooms', dashboardData.showroom.vehiclesAttended],
			];
			const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
			wsSummary['!cols'] = [{ wch: 38 }, { wch: 25 }];
			XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

			// Sheet 2: Top Performing Services
			const sHeaders = ['Service Name', 'Category', 'Quantity / Bookings', 'Total Revenue Generated (INR)'];
			const sRows = (dashboardData.topServices || []).map((s) => [s.name, s.category || 'General Services', s.count, s.revenue]);
			const wsServices = XLSX.utils.aoa_to_sheet([sHeaders, ...sRows]);
			wsServices['!cols'] = [{ wch: 35 }, { wch: 22 }, { wch: 22 }, { wch: 28 }];
			XLSX.utils.book_append_sheet(wb, wsServices, 'Top Services');

			// Sheet 3: Payment Collections Breakdown
			const pHeaders = ['Payment Method', 'Transaction Count', 'Total Collected (INR)'];
			const pRows = (dashboardData.paymentCollection.breakdownByMethod || []).map((m) => [
				m.method,
				m.transactionCount,
				m.amount,
			]);
			const wsPayments = XLSX.utils.aoa_to_sheet([pHeaders, ...pRows]);
			wsPayments['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 25 }];
			XLSX.utils.book_append_sheet(wb, wsPayments, 'Payment Methods');

			// Sheet 4: Staff Advances Log
			const advHeaders = ['Date', 'Employee Name', 'Role', 'Amount (INR)', 'Reason', 'Status'];
			const advRows = (dashboardData.recentAdvances || []).map((a) => [
				new Date(a.advanceDate).toLocaleDateString('en-IN'),
				a.staffName,
				a.staffRole || 'Staff',
				a.amount,
				a.reason || '',
				a.status || 'Outstanding',
			]);
			const wsAdvances = XLSX.utils.aoa_to_sheet([advHeaders, ...advRows]);
			wsAdvances['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 16 }];
			XLSX.utils.book_append_sheet(wb, wsAdvances, 'Staff Advances');

			// Save file
			const fileName = `E6_Car_Spa_Report_${bounds.startStr}_to_${bounds.endStr}.xlsx`;
			XLSX.writeFile(wb, fileName);
		} catch (err) {
			console.error('Failed to export Excel report:', err);
		} finally {
			setIsExporting(false);
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

				{/* Date Preset Filter Bar & Export */}
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

					<Button
						variant="secondary"
						size="sm"
						icon={<Download className="w-4 h-4" />}
						onClick={handleExportExcel}
						disabled={isLoading || isExporting || !dashboardData}
						title="Export Excel Report"
					>
						{isExporting ? 'Exporting...' : 'Export Excel'}
					</Button>
				</div>
			</div>

			{/* ── Sub-navigation Tab Bar ───────────────────────────────────────── */}
			<div className="flex items-center gap-2 overflow-x-auto border-b border-outline-variant pb-px">
				<button
					type="button"
					onClick={() => handleTabSelect('dashboard')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
						activeType === 'dashboard'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
					}`}
				>
					<BarChart3 className="w-4 h-4" />
					<span>Dashboard Overview</span>
				</button>

				<button
					type="button"
					onClick={() => handleTabSelect('business')}
					className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
						activeType === 'business'
							? 'border-secondary text-secondary bg-secondary/5 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
					}`}
				>
					<TrendingUp className="w-4 h-4" />
					<span>Business Reports</span>
				</button>

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
			{activeType === 'dashboard' && (
				<ReportsDashboardView
					data={dashboardData}
					isLoading={isLoading}
					bounds={bounds}
					formatINR={formatINR}
				/>
			)}

			{activeType === 'business' && (
				<BusinessReportsView
					data={dashboardData}
					isLoading={isLoading}
					bounds={bounds}
					formatINR={formatINR}
				/>
			)}

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

