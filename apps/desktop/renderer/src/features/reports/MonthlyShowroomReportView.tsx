import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	Building2,
	Download,
	Layers,
	Car,
	Wrench,
	Users,
	IndianRupee,
	RefreshCw,
	AlertCircle,
	CheckCircle2,
	FileSpreadsheet,
	TrendingUp,
	PieChart as PieChartIcon,
	BarChart3,
	Eye,
} from 'lucide-react';
import {
	ResponsiveContainer,
	AreaChart,
	Area,
	BarChart,
	Bar,
	PieChart,
	Pie,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
} from 'recharts';
import { Button } from '../../components/ui/Button';
import {
	getMonthlyShowroomReport,
	getShowrooms,
	type MonthlyShowroomReportResponse,
	type MonthlyShowroomDetailDto,
	type MonthlyShowroomVehicleWorkRowDto,
	type MonthlyShowroomServiceItemDto,
	type ShowroomDto,
} from '../../lib/api';
import {
	generateAndDownloadMonthlyShowroomReport,
} from './excelMonthlyShowroomGenerator';

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

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];

function formatCurrency(val?: number | null): string {
	if (val === undefined || val === null) return '₹0.00';
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		maximumFractionDigits: 2,
	}).format(val);
}

function formatDateStr(dStr: string): string {
	const d = new Date(dStr);
	if (isNaN(d.getTime())) return dStr;
	const day = String(d.getDate()).padStart(2, '0');
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const month = months[d.getMonth()];
	const year = d.getFullYear();
	return `${day}-${month}-${year}`;
}

export function MonthlyShowroomReportView() {
	const currentDate = new Date();
	const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
	const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
	const [selectedShowroomId, setSelectedShowroomId] = useState<string>('all');
	const [activeTabShowroomId, setActiveTabShowroomId] = useState<string>('all');
	const [activeSection, setActiveSection] = useState<'summary' | 'daily' | 'staff' | 'services' | 'vehicles' | 'detail' | 'billing'>('summary');
	const [previewOpen, setPreviewOpen] = useState<boolean>(true);

	// Fetch Showrooms for filter dropdown
	const { data: showrooms = [] } = useQuery<ShowroomDto[]>({
		queryKey: ['showrooms-list'],
		queryFn: () => getShowrooms(),
	});

	// Fetch Monthly Report Data from backend
	const {
		data: report,
		isLoading,
		isError,
		error,
		refetch,
		isFetching,
	} = useQuery<MonthlyShowroomReportResponse>({
		queryKey: ['monthly-showroom-report', selectedYear, selectedMonth, selectedShowroomId],
		queryFn: () =>
			getMonthlyShowroomReport({
				year: selectedYear,
				month: selectedMonth,
				showroomId: selectedShowroomId === 'all' ? undefined : selectedShowroomId,
			}),
	});

	// Currently displayed showroom (single or first available)
	const displayShowroom: MonthlyShowroomDetailDto | null = useMemo(() => {
		if (!report || report.showrooms.length === 0) return null;
		if (activeTabShowroomId !== 'all') {
			return report.showrooms.find((s) => s.showroomId === activeTabShowroomId) || null;
		}
		return report.showrooms[0] || null;
	}, [report, activeTabShowroomId]);

	// Flat list of vehicle works depending on whether "all" tab or single showroom is active
	const displayWorks: MonthlyShowroomVehicleWorkRowDto[] = useMemo(() => {
		if (!report) return [];
		if (activeTabShowroomId !== 'all') {
			const found = report.showrooms.find((s) => s.showroomId === activeTabShowroomId);
			return found ? found.vehicleWorks : [];
		}
		return report.showrooms.flatMap((s) => s.vehicleWorks);
	}, [report, activeTabShowroomId]);

	// Flat list of daily bills
	const displayBills = useMemo(() => {
		if (!report) return [];
		if (activeTabShowroomId !== 'all') {
			const found = report.showrooms.find((s) => s.showroomId === activeTabShowroomId);
			return found ? found.dailyBills : [];
		}
		return report.showrooms.flatMap((s) => s.dailyBills);
	}, [report, activeTabShowroomId]);

	// Aggregated / Active Summary
	const activeSummary = useMemo(() => {
		if (!report) return null;
		if (displayShowroom && activeTabShowroomId !== 'all') {
			return {
				totalVehicles: displayShowroom.summary.totalVehiclesServiced,
				totalWorks: displayShowroom.summary.totalWorkEntries,
				totalServices: displayShowroom.summary.totalServicesPerformed,
				totalStaff: displayShowroom.summary.totalActiveStaff,
				totalBilled: displayShowroom.summary.totalBilledAmount,
				totalCollected: displayShowroom.summary.totalCollectedAmount,
				totalOutstanding: displayShowroom.summary.totalOutstandingAmount,
				avgBillPerVehicle:
					displayShowroom.summary.totalVehiclesServiced > 0
						? displayShowroom.summary.totalBilledAmount / displayShowroom.summary.totalVehiclesServiced
						: 0,
				collectionRate:
					displayShowroom.summary.totalBilledAmount > 0
						? (displayShowroom.summary.totalCollectedAmount / displayShowroom.summary.totalBilledAmount) * 100
						: 0,
				totalBillingDays: displayShowroom.summary.totalBillingDays,
				paidDays: displayShowroom.summary.paidDaysCount,
				partiallyPaidDays: displayShowroom.summary.partiallyPaidDaysCount,
				unpaidDays: displayShowroom.summary.unpaidDaysCount,
			};
		}
		// Consolidated Overall
		return {
			totalVehicles: report.overallSummary.totalVehiclesServiced,
			totalWorks: report.overallSummary.totalWorkEntries,
			totalServices: report.overallSummary.totalServicesPerformed,
			totalStaff: report.showrooms.reduce((acc, s) => acc + s.summary.totalActiveStaff, 0),
			totalBilled: report.overallSummary.totalBilledAmount,
			totalCollected: report.overallSummary.totalCollectedAmount,
			totalOutstanding: report.overallSummary.totalOutstandingAmount,
			avgBillPerVehicle:
				report.overallSummary.totalVehiclesServiced > 0
					? report.overallSummary.totalBilledAmount / report.overallSummary.totalVehiclesServiced
					: 0,
			collectionRate:
				report.overallSummary.totalBilledAmount > 0
					? (report.overallSummary.totalCollectedAmount / report.overallSummary.totalBilledAmount) * 100
					: 0,
			totalBillingDays: report.showrooms.reduce((acc, s) => acc + s.summary.totalBillingDays, 0),
			paidDays: report.showrooms.reduce((acc, s) => acc + s.summary.paidDaysCount, 0),
			partiallyPaidDays: report.showrooms.reduce((acc, s) => acc + s.summary.partiallyPaidDaysCount, 0),
			unpaidDays: report.showrooms.reduce((acc, s) => acc + s.summary.unpaidDaysCount, 0),
		};
	}, [report, displayShowroom, activeTabShowroomId]);

	// Service Distribution Data for Chart and Summary Table
	const serviceDistributionData = useMemo(() => {
		const map = new Map<string, { code: string; name: string; entries: number; quantity: number; vehicles: number }>();
		displayWorks.forEach((w) => {
			w.serviceItems.forEach((si: MonthlyShowroomServiceItemDto) => {
				const cur = map.get(si.workTypeId) || {
					code: si.workTypeCode,
					name: si.workTypeName,
					entries: 0,
					quantity: 0,
					vehicles: 0,
				};
				cur.entries += 1;
				cur.quantity += si.quantity;
				cur.vehicles += w.vehicleQuantity;
				map.set(si.workTypeId, cur);
			});
		});
		const list = Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
		const total = Math.max(1, list.reduce((acc, s) => acc + s.quantity, 0));
		return list.map((item, idx) => ({
			rank: idx + 1,
			...item,
			percentage: ((item.quantity / total) * 100).toFixed(1),
		}));
	}, [displayWorks]);

	// Staff Productivity Data for Chart and Summary Table
	const staffProductivityData = useMemo(() => {
		const map = new Map<
			string,
			{
				id: string;
				name: string;
				masterId: string;
				role: string;
				phone: string;
				homeShowroom: string;
				assignmentType: string;
				entries: number;
				vehicles: number;
				services: number;
				workingHours: number;
				days: Set<string>;
			}
		>();
		displayWorks.forEach((w) => {
			const cur = map.get(w.staffId) || {
				id: w.staffId,
				name: w.staffName,
				masterId: w.staffMasterId,
				role: w.staffRole || 'Technician',
				phone: w.staffPhone || '—',
				homeShowroom: w.homeShowroomName || 'Showroom',
				assignmentType: w.assignmentType || 'Regular',
				entries: 0,
				vehicles: 0,
				services: 0,
				workingHours: 0,
				days: new Set<string>(),
			};
			cur.entries += 1;
			cur.vehicles += w.vehicleQuantity;
			cur.services += w.serviceItems.reduce((acc: number, si: MonthlyShowroomServiceItemDto) => acc + si.quantity, 0);
			cur.workingHours += Number(w.workingHours ?? 9);
			cur.days.add(w.date.substring(0, 10));
			map.set(w.staffId, cur);
		});
		const list = Array.from(map.values()).sort((a, b) => b.vehicles - a.vehicles);
		const totalVehicles = Math.max(1, displayWorks.reduce((acc, w) => acc + w.vehicleQuantity, 0));
		return list.map((st, idx) => {
			const activeDaysCount = Math.max(1, st.days.size);
			const avgVehicles = st.vehicles / activeDaysCount;
			const share = ((st.vehicles / totalVehicles) * 100).toFixed(1);
			return {
				rank: idx + 1,
				...st,
				activeDaysCount,
				avgVehicles: avgVehicles.toFixed(1),
				sharePercent: share,
			};
		});
	}, [displayWorks]);

	// Vehicle Type Distribution Data for Chart and Summary Table
	const vehicleTypeData = useMemo(() => {
		const map = new Map<string, { code: string; name: string; entries: number; count: number }>();
		displayWorks.forEach((w) => {
			const cur = map.get(w.vehicleTypeId) || {
				code: w.vehicleTypeCode || 'VEH',
				name: w.vehicleTypeName,
				entries: 0,
				count: 0,
			};
			cur.entries += 1;
			cur.count += w.vehicleQuantity;
			map.set(w.vehicleTypeId, cur);
		});
		const list = Array.from(map.values()).sort((a, b) => b.count - a.count);
		const totalVehicles = Math.max(1, list.reduce((acc, v) => acc + v.count, 0));
		return list.map((item, idx) => ({
			rank: idx + 1,
			...item,
			percentage: ((item.count / totalVehicles) * 100).toFixed(1),
		}));
	}, [displayWorks]);

	// Daily Activity & Revenue Timeline
	const dailyActivityData = useMemo(() => {
		const map = new Map<
			string,
			{
				date: string;
				displayDate: string;
				dayOfWeek: string;
				vehicles: number;
				services: number;
				staffSet: Set<string>;
				billed: number;
				collected: number;
				balance: number;
				status: string;
				paymentCount: number;
				notes: string;
			}
		>();

		displayWorks.forEach((w) => {
			const dStr = w.date.substring(0, 10);
			const cur = map.get(dStr) || {
				date: dStr,
				displayDate: formatDateStr(dStr),
				dayOfWeek: new Date(dStr).toLocaleDateString('en-IN', { weekday: 'short' }),
				vehicles: 0,
				services: 0,
				staffSet: new Set<string>(),
				billed: 0,
				collected: 0,
				balance: 0,
				status: 'NoBill',
				paymentCount: 0,
				notes: '',
			};
			cur.vehicles += w.vehicleQuantity;
			cur.services += w.serviceItems.reduce((acc, si) => acc + si.quantity, 0);
			cur.staffSet.add(w.staffId);
			map.set(dStr, cur);
		});

		displayBills.forEach((b) => {
			const dStr = b.date.substring(0, 10);
			const cur = map.get(dStr) || {
				date: dStr,
				displayDate: formatDateStr(dStr),
				dayOfWeek: new Date(dStr).toLocaleDateString('en-IN', { weekday: 'short' }),
				vehicles: 0,
				services: 0,
				staffSet: new Set<string>(),
				billed: 0,
				collected: 0,
				balance: 0,
				status: 'NoBill',
				paymentCount: 0,
				notes: '',
			};
			cur.billed = b.amount;
			cur.collected = b.paidAmount;
			cur.balance = b.balanceAmount;
			cur.status = b.status;
			cur.paymentCount = b.paymentCount;
			if (b.notes) cur.notes = b.notes;
			map.set(dStr, cur);
		});

		return Array.from(map.values())
			.sort((a, b) => a.date.localeCompare(b.date))
			.map((d) => ({
				...d,
				staffCount: d.staffSet.size,
			}));
	}, [displayWorks, displayBills]);

	const selectedShowroomObj = showrooms.find((s) => s.id === selectedShowroomId);
	const activeShowroomTitle =
		activeTabShowroomId !== 'all'
			? report?.showrooms.find((s) => s.showroomId === activeTabShowroomId)?.showroomName || 'Showroom'
			: 'All Showrooms Network';

	return (
		<div className="space-y-6" data-testid="monthly-showroom-report-view">
			{/* ── 1. REPORT GENERATOR TOOLBAR ─────────────────────────────────── */}
			<div className="app-card p-5 border border-outline-variant bg-surface">
				<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
					<div>
						<div className="flex items-center gap-2 text-secondary">
							<Building2 className="w-5 h-5" />
							<h2 className="text-lg font-bold text-on-surface">Monthly Showroom Performance Report</h2>
						</div>
						<p className="text-xs text-on-surface-variant mt-1">
							Executive management operations and financial audit report for showroom branches.
						</p>
					</div>

					{/* Generation Filter Controls */}
					<div className="flex items-center gap-3 flex-wrap">
						{/* Showroom Selector */}
						<div className="flex flex-col">
							<label htmlFor="showroom-select" className="text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
								Showroom
							</label>
							<select
								id="showroom-select"
								value={selectedShowroomId}
								onChange={(e) => {
									setSelectedShowroomId(e.target.value);
									setActiveTabShowroomId(e.target.value);
								}}
								className="h-9 px-3 text-xs bg-surface-container border border-outline-variant rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary min-w-[170px]"
							>
								<option value="all">All Showrooms (Network)</option>
								{showrooms.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name} ({s.masterId})
									</option>
								))}
							</select>
						</div>

						{/* Month Selector */}
						<div className="flex flex-col">
							<label htmlFor="month-select" className="text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
								Month
							</label>
							<select
								id="month-select"
								value={selectedMonth}
								onChange={(e) => setSelectedMonth(Number(e.target.value))}
								className="h-9 px-3 text-xs bg-surface-container border border-outline-variant rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary min-w-[130px]"
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
							<label htmlFor="year-select" className="text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
								Year
							</label>
							<select
								id="year-select"
								value={selectedYear}
								onChange={(e) => setSelectedYear(Number(e.target.value))}
								className="h-9 px-3 text-xs bg-surface-container border border-outline-variant rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary min-w-[90px]"
							>
								{[2024, 2025, 2026, 2027].map((y) => (
									<option key={y} value={y}>
										{y}
									</option>
								))}
							</select>
						</div>

						{/* Generate Report Action */}
						<div className="flex flex-col justify-end pt-5">
							<Button
								variant="primary"
								size="sm"
								onClick={() => refetch()}
								disabled={isFetching}
								className="h-9 px-4 text-xs font-semibold shadow-xs"
							>
								<RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
								Generate Report
							</Button>
						</div>
					</div>
				</div>

				{/* ── REPORT READY BANNER & ACTION BAR ────────────────────────── */}
				{report && (
					<div className="mt-5 pt-4 border-t border-outline-variant flex flex-col md:flex-row md:items-center md:justify-between gap-4">
						<div className="flex items-center gap-3 flex-wrap">
							<div className="flex items-center gap-1.5 px-2.5 py-1 bg-success-container/30 border border-success/30 rounded-full text-success text-xs font-semibold">
								<CheckCircle2 className="w-3.5 h-3.5" />
								<span>Report Ready</span>
							</div>

							<div className="text-xs font-semibold text-on-surface">
								{selectedShowroomObj ? `${selectedShowroomObj.name} (${selectedShowroomObj.masterId})` : 'All Active Showrooms'} — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
							</div>

							<div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
								<span className="px-2 py-0.5 bg-surface-container rounded-md font-medium">
									{activeSummary?.totalVehicles ?? 0} Vehicles
								</span>
								<span className="px-2 py-0.5 bg-surface-container rounded-md font-medium">
									{activeSummary?.totalServices ?? 0} Services
								</span>
								<span className="px-2 py-0.5 bg-surface-container rounded-md font-medium">
									{activeSummary?.totalStaff ?? 0} Staff
								</span>
								<span className="px-2 py-0.5 bg-secondary/10 text-secondary rounded-md font-semibold">
									{formatCurrency(activeSummary?.totalBilled ?? 0)} Billing
								</span>
							</div>
						</div>

						{/* Actions: Preview & Multi-Sheet Excel Export */}
						<div className="flex items-center gap-2 flex-wrap">
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setPreviewOpen(!previewOpen)}
								className="text-xs font-semibold"
								title="Toggle interactive live preview"
							>
								<Eye className="w-4 h-4 mr-1.5 text-secondary" />
								{previewOpen ? 'Hide Preview' : 'Preview Report'}
							</Button>

							<Button
								variant="secondary"
								size="sm"
								onClick={() =>
									generateAndDownloadMonthlyShowroomReport(
										report,
										'selected',
										activeTabShowroomId !== 'all' ? activeTabShowroomId : undefined
									)
								}
								className="text-xs font-semibold shadow-xs"
								title="Export complete 7-sheet management workbook for selected showroom"
							>
								<Download className="w-4 h-4 mr-1.5 text-secondary" />
								Export This Showroom
							</Button>

							<Button
								variant="primary"
								size="sm"
								onClick={() => generateAndDownloadMonthlyShowroomReport(report, 'all')}
								className="text-xs font-semibold shadow-xs"
								title="Export all showrooms management package"
							>
								<FileSpreadsheet className="w-4 h-4 mr-1.5" />
								Export All Showrooms
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* Loading State */}
			{isLoading && (
				<div className="p-8 text-center bg-surface-container rounded-xl border border-outline-variant animate-pulse space-y-4">
					<RefreshCw className="w-8 h-8 mx-auto text-secondary animate-spin" />
					<p className="text-sm text-on-surface-variant font-medium">
						Compiling monthly showroom data, staff activities, and settlement ledgers...
					</p>
				</div>
			)}

			{/* Error State */}
			{isError && (
				<div className="p-5 bg-error-container/20 border border-error/30 rounded-xl flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<AlertCircle className="w-5 h-5 text-error shrink-0" />
						<div>
							<p className="text-sm font-semibold text-error">Failed to load monthly showroom report</p>
							<p className="text-xs text-on-surface-variant mt-0.5">
								{(error as Error)?.message || 'An unexpected error occurred while querying showroom records.'}
							</p>
						</div>
					</div>
					<Button variant="secondary" size="sm" onClick={() => refetch()} className="text-xs">
						Retry
					</Button>
				</div>
			)}

			{/* ── 2. MANAGEMENT REPORT LIVE PREVIEW ───────────────────────────── */}
			{report && previewOpen && (
				<div className="space-y-6">
					{/* Showroom Tabs if All Showrooms is queried */}
					{report.showrooms.length > 1 && (
						<div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-outline-variant">
							<button
								type="button"
								onClick={() => setActiveTabShowroomId('all')}
								className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
									activeTabShowroomId === 'all'
										? 'bg-secondary text-white shadow-xs'
										: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
								}`}
							>
								Consolidated ({report.showrooms.length} Showrooms)
							</button>
							{report.showrooms.map((sr) => (
								<button
									key={sr.showroomId}
									type="button"
									onClick={() => setActiveTabShowroomId(sr.showroomId)}
									className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
										activeTabShowroomId === sr.showroomId
											? 'bg-secondary text-white shadow-xs'
											: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
									}`}
								>
									{sr.showroomName} ({sr.showroomMasterId})
								</button>
							))}
						</div>
					)}

					{/* Corporate Report Preview Header */}
					<div className="app-card p-5 border-l-4 border-l-secondary bg-surface">
						<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
							<div>
								<span className="text-[11px] font-bold text-secondary uppercase tracking-widest">
									E6 Car Spa Management Report
								</span>
								<h3 className="text-xl font-bold text-on-surface mt-0.5">{activeShowroomTitle}</h3>
								<p className="text-xs text-on-surface-variant mt-0.5">
									Report Period: {report.monthName} | Generated on: {formatDateStr(new Date().toISOString())}
								</p>
							</div>

							{displayShowroom && (
								<div className="text-xs text-on-surface-variant space-y-0.5 text-right">
									<div><span className="font-semibold">Master ID:</span> {displayShowroom.showroomMasterId}</div>
									<div><span className="font-semibold">Address:</span> {displayShowroom.showroomAddress || '—'}</div>
									<div><span className="font-semibold">GSTIN:</span> {displayShowroom.showroomGstin || 'Not Registered'}</div>
								</div>
							)}
						</div>
					</div>

					{/* ── 7 EXECUTIVE KPI CARDS ─────────────────────────────────── */}
					{activeSummary && (
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
							{/* 1. Vehicles Serviced */}
							<div className="app-card p-3.5 border-l-4 border-l-primary transition-all hover:shadow-elevation-1">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
										Vehicles
									</span>
									<Car className="w-3.5 h-3.5 text-primary" />
								</div>
								<div className="text-xl font-bold text-on-surface mt-1.5">{activeSummary.totalVehicles}</div>
								<div className="text-[10px] text-on-surface-variant mt-0.5">{activeSummary.totalWorks} work entries</div>
							</div>

							{/* 2. Services Performed */}
							<div className="app-card p-3.5 border-l-4 border-l-purple-500 transition-all hover:shadow-elevation-1">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
										Services
									</span>
									<Wrench className="w-3.5 h-3.5 text-purple-500" />
								</div>
								<div className="text-xl font-bold text-purple-600 mt-1.5">{activeSummary.totalServices}</div>
								<div className="text-[10px] text-on-surface-variant mt-0.5">Work operations</div>
							</div>

							{/* 3. Staff Assigned */}
							<div className="app-card p-3.5 border-l-4 border-l-amber-500 transition-all hover:shadow-elevation-1">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
										Active Staff
									</span>
									<Users className="w-3.5 h-3.5 text-amber-500" />
								</div>
								<div className="text-xl font-bold text-amber-600 mt-1.5">{activeSummary.totalStaff}</div>
								<div className="text-[10px] text-on-surface-variant mt-0.5">Technicians on duty</div>
							</div>

							{/* 4. Total Billing */}
							<div className="app-card p-3.5 border-l-4 border-l-secondary transition-all hover:shadow-elevation-1">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
										Total Billing
									</span>
									<IndianRupee className="w-3.5 h-3.5 text-secondary" />
								</div>
								<div className="text-lg font-bold text-on-surface mt-1.5">{formatCurrency(activeSummary.totalBilled)}</div>
								<div className="text-[10px] text-on-surface-variant mt-0.5">Billed amount</div>
							</div>

							{/* 5. Collections */}
							<div className="app-card p-3.5 border-l-4 border-l-success transition-all hover:shadow-elevation-1">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
										Collections
									</span>
									<TrendingUp className="w-3.5 h-3.5 text-success" />
								</div>
								<div className="text-lg font-bold text-success mt-1.5">{formatCurrency(activeSummary.totalCollected)}</div>
								<div className="text-[10px] text-success font-medium mt-0.5">{activeSummary.collectionRate.toFixed(1)}% recovery</div>
							</div>

							{/* 6. Outstanding */}
							<div className="app-card p-3.5 border-l-4 border-l-error transition-all hover:shadow-elevation-1">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
										Outstanding
									</span>
									<AlertCircle className="w-3.5 h-3.5 text-error" />
								</div>
								<div className="text-lg font-bold text-error mt-1.5">{formatCurrency(activeSummary.totalOutstanding)}</div>
								<div className="text-[10px] text-on-surface-variant mt-0.5">Balance receivable</div>
							</div>

							{/* 7. Avg Bill / Vehicle */}
							<div className="app-card p-3.5 border-l-4 border-l-blue-600 transition-all hover:shadow-elevation-1">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
										Avg Bill / Veh
									</span>
									<BarChart3 className="w-3.5 h-3.5 text-blue-600" />
								</div>
								<div className="text-lg font-bold text-blue-700 mt-1.5">{formatCurrency(activeSummary.avgBillPerVehicle)}</div>
								<div className="text-[10px] text-on-surface-variant mt-0.5">Throughput average</div>
							</div>
						</div>
					)}

					{/* ── 4 CHARTS GRID ────────────────────────────────────────── */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{/* Chart 1: Daily Vehicle Volume */}
						<div className="app-card p-4 border border-outline-variant">
							<div className="flex items-center justify-between mb-3">
								<h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
									<Car className="w-4 h-4 text-secondary" />
									Daily Vehicle Volume Trend
								</h4>
								<span className="text-[10px] text-on-surface-variant font-medium">Busiest vs slow days</span>
							</div>
							<div className="h-56">
								{dailyActivityData.length > 0 ? (
									<ResponsiveContainer width="100%" height="100%">
										<AreaChart data={dailyActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
											<defs>
												<linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
													<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
													<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
												</linearGradient>
											</defs>
											<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
											<XAxis dataKey="dayOfWeek" tick={{ fontSize: 10 }} />
											<YAxis tick={{ fontSize: 10 }} />
											<Tooltip
												formatter={(val: any) => [`${val ?? 0} vehicles`, 'Volume']}
												labelFormatter={(_label, payload) => payload?.[0]?.payload?.displayDate || ''}
											/>
											<Area type="monotone" dataKey="vehicles" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorVehicles)" />
										</AreaChart>
									</ResponsiveContainer>
								) : (
									<div className="h-full flex items-center justify-center text-xs text-on-surface-variant">
										No daily volume records available.
									</div>
								)}
							</div>
						</div>

						{/* Chart 2: Service Distribution Donut Chart */}
						<div className="app-card p-4 border border-outline-variant">
							<div className="flex items-center justify-between mb-3">
								<h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
									<PieChartIcon className="w-4 h-4 text-purple-600" />
									Service Category & Work Type Distribution
								</h4>
								<span className="text-[10px] text-on-surface-variant font-medium">Share of operations</span>
							</div>
							<div className="h-56">
								{serviceDistributionData.length > 0 ? (
									<ResponsiveContainer width="100%" height="100%">
										<PieChart>
											<Pie
												data={serviceDistributionData}
												cx="50%"
												cy="50%"
												innerRadius={45}
												outerRadius={75}
												paddingAngle={3}
												dataKey="quantity"
												nameKey="name"
											>
												{serviceDistributionData.map((_entry, index) => (
													<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
												))}
											</Pie>
											<Tooltip formatter={(val: any) => [`${val ?? 0} services`, 'Count']} />
											<Legend wrapperStyle={{ fontSize: '10px' }} />
										</PieChart>
									</ResponsiveContainer>
								) : (
									<div className="h-full flex items-center justify-center text-xs text-on-surface-variant">
										No service distribution data available.
									</div>
								)}
							</div>
						</div>

						{/* Chart 3: Vehicle Type Distribution */}
						<div className="app-card p-4 border border-outline-variant">
							<div className="flex items-center justify-between mb-3">
								<h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
									<Layers className="w-4 h-4 text-amber-600" />
									Vehicle Type Fleet Breakdown
								</h4>
								<span className="text-[10px] text-on-surface-variant font-medium">Fleet composition</span>
							</div>
							<div className="h-56">
								{vehicleTypeData.length > 0 ? (
									<ResponsiveContainer width="100%" height="100%">
										<BarChart data={vehicleTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
											<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
											<XAxis dataKey="name" tick={{ fontSize: 10 }} />
											<YAxis tick={{ fontSize: 10 }} />
											<Tooltip formatter={(val: any) => [`${val ?? 0} vehicles`, 'Count']} />
											<Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
										</BarChart>
									</ResponsiveContainer>
								) : (
									<div className="h-full flex items-center justify-center text-xs text-on-surface-variant">
										No vehicle breakdown data available.
									</div>
								)}
							</div>
						</div>

						{/* Chart 4: Staff Workload Distribution */}
						<div className="app-card p-4 border border-outline-variant">
							<div className="flex items-center justify-between mb-3">
								<h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
									<Users className="w-4 h-4 text-success" />
									Staff & Technician Workload
								</h4>
								<span className="text-[10px] text-on-surface-variant font-medium">Vehicles handled</span>
							</div>
							<div className="h-56">
								{staffProductivityData.length > 0 ? (
									<ResponsiveContainer width="100%" height="100%">
										<BarChart
											layout="vertical"
											data={staffProductivityData.slice(0, 6)}
											margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
										>
											<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
											<XAxis type="number" tick={{ fontSize: 10 }} />
											<YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
											<Tooltip formatter={(val: any) => [`${val ?? 0} vehicles`, 'Handled']} />
											<Bar dataKey="vehicles" fill="#10b981" radius={[0, 4, 4, 0]} />
										</BarChart>
									</ResponsiveContainer>
								) : (
									<div className="h-full flex items-center justify-center text-xs text-on-surface-variant">
										No technician workload records available.
									</div>
								)}
							</div>
						</div>
					</div>

					{/* ── SECTION SWITCHER TABS ─────────────────────────────────── */}
					<div className="flex items-center gap-2 border-b border-outline-variant pb-px overflow-x-auto">
						{[
							{ id: 'summary', label: '1. Executive Summary', icon: Building2 },
							{ id: 'daily', label: '2. Daily Operations', icon: TrendingUp },
							{ id: 'staff', label: '3. Staff Performance', icon: Users },
							{ id: 'services', label: '4. Service Analysis', icon: Wrench },
							{ id: 'vehicles', label: '5. Vehicle Analysis', icon: Layers },
							{ id: 'detail', label: '6. Detailed Work Log', icon: FileSpreadsheet },
							{ id: 'billing', label: '7. Billing & Collections', icon: IndianRupee },
						].map((tab) => {
							const Icon = tab.icon;
							const isActive = activeSection === tab.id;
							return (
								<button
									key={tab.id}
									type="button"
									onClick={() => setActiveSection(tab.id as typeof activeSection)}
									className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
										isActive
											? 'border-secondary text-secondary bg-secondary/5 rounded-t-md'
											: 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-t-md'
									}`}
								>
									<Icon className="w-3.5 h-3.5" />
									{tab.label}
								</button>
							);
						})}
					</div>

					{/* ── TAB 1: EXECUTIVE SUMMARY ─────────────────────────────── */}
					{activeSection === 'summary' && (
						<div className="space-y-4">
							<div className="app-card border border-outline-variant overflow-hidden">
								<div className="p-3.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
									<h4 className="text-xs font-bold text-on-surface">Consolidated Executive Management Performance Overview</h4>
									<span className="text-[11px] text-on-surface-variant">{displayWorks.length} total entries</span>
								</div>
								<div className="p-4 space-y-4">
									<p className="text-xs text-on-surface-variant">
										This management report outlines operational throughput, technician assignments, service breakdown, vehicle classifications, and payment settlement records for {activeShowroomTitle} during {report.monthName}.
									</p>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="p-3 bg-surface-container rounded-lg border border-outline-variant">
											<span className="text-[11px] font-bold text-secondary uppercase">Top Workload Driver</span>
											<div className="text-sm font-semibold text-on-surface mt-1">
												{staffProductivityData[0] ? `${staffProductivityData[0].name} (${staffProductivityData[0].vehicles} vehicles)` : 'None'}
											</div>
										</div>
										<div className="p-3 bg-surface-container rounded-lg border border-outline-variant">
											<span className="text-[11px] font-bold text-purple-600 uppercase">Most Demanded Service</span>
											<div className="text-sm font-semibold text-on-surface mt-1">
												{serviceDistributionData[0] ? `${serviceDistributionData[0].name} (${serviceDistributionData[0].quantity} completed)` : 'None'}
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* ── TAB 2: DAILY OPERATIONS ──────────────────────────────── */}
					{activeSection === 'daily' && (
						<div className="app-card border border-outline-variant overflow-hidden">
							<div className="p-3.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
								<h4 className="text-xs font-bold text-on-surface">Daily Operations Summary</h4>
								<span className="text-[11px] text-on-surface-variant">{displayWorks.length} operations</span>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="bg-surface-container border-b border-outline-variant text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
											<th className="py-2.5 px-3">Date</th>
											<th className="py-2.5 px-3">Day</th>
											<th className="py-2.5 px-3">Staff ID</th>
											<th className="py-2.5 px-3">Staff Name</th>
											<th className="py-2.5 px-3">Vehicle Type</th>
											<th className="py-2.5 px-3 text-right">Vehicle Count</th>
											<th className="py-2.5 px-3">Service Performed</th>
											<th className="py-2.5 px-3 text-right">Working Hours</th>
											<th className="py-2.5 px-3 text-right">Billing Amount</th>
											<th className="py-2.5 px-3 text-right">Amount Received</th>
											<th className="py-2.5 px-3 text-right">Outstanding</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-outline-variant">
										{displayWorks.length === 0 ? (
											<tr>
												<td colSpan={11} className="py-6 text-center text-on-surface-variant">
													No daily operational records for this period.
												</td>
											</tr>
										) : (
											displayWorks.map((w) => (
												<tr key={w.id} className="hover:bg-surface-container/50">
													<td className="py-2 px-3 font-semibold text-on-surface">{formatDateStr(w.date)}</td>
													<td className="py-2 px-3 text-on-surface-variant font-medium">{new Date(w.date).toLocaleDateString('en-IN', { weekday: 'short' })}</td>
													<td className="py-2 px-3 font-mono text-secondary font-medium">{w.staffMasterId}</td>
													<td className="py-2 px-3 font-semibold text-on-surface">{w.staffName}</td>
													<td className="py-2 px-3 text-on-surface-variant">{w.vehicleTypeName}</td>
													<td className="py-2 px-3 text-right font-bold text-primary">{w.vehicleQuantity}</td>
													<td className="py-2 px-3 text-on-surface font-medium">{w.servicesSummary}</td>
													<td className="py-2 px-3 text-right font-medium">{w.workingHours ?? 9} hrs</td>
													<td className="py-2 px-3 text-right font-medium">
														{w.dailyBilledAmount !== null && w.dailyBilledAmount !== undefined ? formatCurrency(w.dailyBilledAmount) : '—'}
													</td>
													<td className="py-2 px-3 text-right font-bold text-success">
														{w.dailyCollectedAmount !== null && w.dailyCollectedAmount !== undefined ? formatCurrency(w.dailyCollectedAmount) : '—'}
													</td>
													<td className="py-2 px-3 text-right font-bold text-error">
														{w.dailyBilledAmount !== null && w.dailyCollectedAmount !== null && w.dailyBilledAmount !== undefined && w.dailyCollectedAmount !== undefined
															? formatCurrency(Math.max(0, w.dailyBilledAmount - w.dailyCollectedAmount))
															: '—'}
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{/* ── TAB 3: STAFF PERFORMANCE ─────────────────────────────── */}
					{activeSection === 'staff' && (
						<div className="app-card border border-outline-variant overflow-hidden">
							<div className="p-3.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
								<h4 className="text-xs font-bold text-on-surface">Staff Workload & Performance Analysis</h4>
								<span className="text-[11px] text-on-surface-variant">{staffProductivityData.length} staff members</span>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="bg-surface-container border-b border-outline-variant text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
											<th className="py-2.5 px-3">Rank</th>
											<th className="py-2.5 px-3">Master ID</th>
											<th className="py-2.5 px-3">Technician Name</th>
											<th className="py-2.5 px-3">Role</th>
											<th className="py-2.5 px-3">Home Showroom</th>
											<th className="py-2.5 px-3">Assignment Type</th>
											<th className="py-2.5 px-3 text-right">Active Days</th>
											<th className="py-2.5 px-3 text-right">Working Hours</th>
											<th className="py-2.5 px-3 text-right">Vehicles Handled</th>
											<th className="py-2.5 px-3 text-right">Services Done</th>
											<th className="py-2.5 px-3 text-right">Share (%)</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-outline-variant">
										{staffProductivityData.length === 0 ? (
											<tr>
												<td colSpan={11} className="py-6 text-center text-on-surface-variant">
													No staff workload records for this period.
												</td>
											</tr>
										) : (
											staffProductivityData.map((st) => (
												<tr key={st.id} className="hover:bg-surface-container/50">
													<td className="py-2 px-3 font-semibold text-on-surface-variant">#{st.rank}</td>
													<td className="py-2 px-3 font-mono text-secondary font-medium">{st.masterId}</td>
													<td className="py-2 px-3 font-semibold text-on-surface">{st.name}</td>
													<td className="py-2 px-3 text-on-surface-variant">{st.role}</td>
													<td className="py-2 px-3 text-on-surface-variant">{st.homeShowroom}</td>
													<td className="py-2 px-3">
														<span
															className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
																st.assignmentType === 'Temporary Transfer'
																	? 'bg-amber-100 text-amber-800'
																	: 'bg-surface-container text-on-surface-variant'
															}`}
														>
															{st.assignmentType}
														</span>
													</td>
													<td className="py-2 px-3 text-right font-medium">{st.activeDaysCount}</td>
													<td className="py-2 px-3 text-right font-medium">{st.workingHours} hrs</td>
													<td className="py-2 px-3 text-right font-bold text-primary">{st.vehicles}</td>
													<td className="py-2 px-3 text-right font-semibold text-purple-600">{st.services}</td>
													<td className="py-2 px-3 text-right font-semibold text-secondary">{st.sharePercent}%</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{/* ── TAB 4: SERVICE ANALYSIS ──────────────────────────────── */}
					{activeSection === 'services' && (
						<div className="app-card border border-outline-variant overflow-hidden">
							<div className="p-3.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
								<h4 className="text-xs font-bold text-on-surface">Service & Work Type Volume Breakdown</h4>
								<span className="text-[11px] text-on-surface-variant">{serviceDistributionData.length} work types</span>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="bg-surface-container border-b border-outline-variant text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
											<th className="py-2.5 px-3">Rank</th>
											<th className="py-2.5 px-3">Code</th>
											<th className="py-2.5 px-3">Service / Work Type</th>
											<th className="py-2.5 px-3 text-right">Work Entries</th>
											<th className="py-2.5 px-3 text-right">Total Quantity</th>
											<th className="py-2.5 px-3 text-right">Vehicles Attended</th>
											<th className="py-2.5 px-3 text-right">Share of Total (%)</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-outline-variant">
										{serviceDistributionData.length === 0 ? (
											<tr>
												<td colSpan={7} className="py-6 text-center text-on-surface-variant">
													No service breakdown records for this period.
												</td>
											</tr>
										) : (
											serviceDistributionData.map((sv) => (
												<tr key={sv.code} className="hover:bg-surface-container/50">
													<td className="py-2 px-3 font-semibold text-on-surface-variant">#{sv.rank}</td>
													<td className="py-2 px-3 font-mono text-purple-600 font-medium">{sv.code}</td>
													<td className="py-2 px-3 font-semibold text-on-surface">{sv.name}</td>
													<td className="py-2 px-3 text-right font-medium">{sv.entries}</td>
													<td className="py-2 px-3 text-right font-bold text-purple-700">{sv.quantity}</td>
													<td className="py-2 px-3 text-right font-medium">{sv.vehicles}</td>
													<td className="py-2 px-3 text-right font-semibold text-secondary">{sv.percentage}%</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{/* ── TAB 5: VEHICLE ANALYSIS ──────────────────────────────── */}
					{activeSection === 'vehicles' && (
						<div className="app-card border border-outline-variant overflow-hidden">
							<div className="p-3.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
								<h4 className="text-xs font-bold text-on-surface">Vehicle Type Classification Breakdown</h4>
								<span className="text-[11px] text-on-surface-variant">{vehicleTypeData.length} classifications</span>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="bg-surface-container border-b border-outline-variant text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
											<th className="py-2.5 px-3">Rank</th>
											<th className="py-2.5 px-3">Code</th>
											<th className="py-2.5 px-3">Vehicle Classification</th>
											<th className="py-2.5 px-3 text-right">Work Entries</th>
											<th className="py-2.5 px-3 text-right">Vehicles Serviced</th>
											<th className="py-2.5 px-3 text-right">Fleet Share (%)</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-outline-variant">
										{vehicleTypeData.length === 0 ? (
											<tr>
												<td colSpan={6} className="py-6 text-center text-on-surface-variant">
													No vehicle classification records for this period.
												</td>
											</tr>
										) : (
											vehicleTypeData.map((vh) => (
												<tr key={vh.code} className="hover:bg-surface-container/50">
													<td className="py-2 px-3 font-semibold text-on-surface-variant">#{vh.rank}</td>
													<td className="py-2 px-3 font-mono text-amber-600 font-medium">{vh.code}</td>
													<td className="py-2 px-3 font-semibold text-on-surface">{vh.name}</td>
													<td className="py-2 px-3 text-right font-medium">{vh.entries}</td>
													<td className="py-2 px-3 text-right font-bold text-amber-700">{vh.count}</td>
													<td className="py-2 px-3 text-right font-semibold text-secondary">{vh.percentage}%</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{/* ── TAB 6: DETAILED WORK LOG ─────────────────────────────── */}
					{activeSection === 'detail' && (
						<div className="app-card border border-outline-variant overflow-hidden">
							<div className="p-3.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
								<h4 className="text-xs font-bold text-on-surface">Detailed Vehicle Service Audit Log</h4>
								<span className="text-[11px] text-on-surface-variant">{displayWorks.length} entries</span>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="bg-surface-container border-b border-outline-variant text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
											<th className="py-2.5 px-3">Date</th>
											<th className="py-2.5 px-3">Time</th>
											<th className="py-2.5 px-3">Staff ID</th>
											<th className="py-2.5 px-3">Technician</th>
											<th className="py-2.5 px-3">Home Showroom</th>
											<th className="py-2.5 px-3">Assignment Type</th>
											<th className="py-2.5 px-3">Ref ID</th>
											<th className="py-2.5 px-3">Vehicle Type</th>
											<th className="py-2.5 px-3">Services Done</th>
											<th className="py-2.5 px-3">Session</th>
											<th className="py-2.5 px-3">Notes</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-outline-variant">
										{displayWorks.length === 0 ? (
											<tr>
												<td colSpan={11} className="py-6 text-center text-on-surface-variant">
													No detailed vehicle service records found for this showroom in {report.monthName}.
												</td>
											</tr>
										) : (
											displayWorks.map((w, idx) => (
												<tr key={w.id} className="hover:bg-surface-container/50">
													<td className="py-2 px-3 font-medium text-on-surface">{formatDateStr(w.date)}</td>
													<td className="py-2 px-3 text-on-surface-variant font-mono text-[11px]">{w.timeRecorded || '—'}</td>
													<td className="py-2 px-3 font-mono text-secondary font-medium">{w.staffMasterId}</td>
													<td className="py-2 px-3 font-semibold text-on-surface">{w.staffName}</td>
													<td className="py-2 px-3 text-on-surface-variant">{w.homeShowroomName || 'Showroom'}</td>
													<td className="py-2 px-3">
														<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container text-on-surface-variant">
															{w.assignmentType || 'Regular'}
														</span>
													</td>
													<td className="py-2 px-3 font-mono text-[11px] text-on-surface-variant">REF-{String(idx + 1).padStart(4, '0')}</td>
													<td className="py-2 px-3 text-on-surface-variant">{w.vehicleTypeName}</td>
													<td className="py-2 px-3 font-medium text-purple-700">{w.servicesSummary}</td>
													<td className="py-2 px-3 text-on-surface-variant text-[11px]">{w.sessionType || 'FullDay'}</td>
													<td className="py-2 px-3 text-on-surface-variant text-[11px]">{w.notes || '—'}</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{/* ── TAB 7: BILLING & COLLECTIONS ─────────────────────────── */}
					{activeSection === 'billing' && (
						<div className="space-y-4">
							<div className="app-card border border-outline-variant overflow-hidden">
								<div className="p-3.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
									<h4 className="text-xs font-bold text-on-surface">Monthly Billing & Collections Ledger</h4>
									<span className="text-[11px] text-on-surface-variant">{displayBills.length} billing records</span>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full text-left text-xs border-collapse">
										<thead>
											<tr className="bg-surface-container border-b border-outline-variant text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
												<th className="py-2.5 px-3">Date</th>
												<th className="py-2.5 px-3">Day</th>
												<th className="py-2.5 px-3 text-right">Daily Bill</th>
												<th className="py-2.5 px-3 text-right">Amount Received</th>
												<th className="py-2.5 px-3 text-right">Outstanding</th>
												<th className="py-2.5 px-3 text-center">Status</th>
												<th className="py-2.5 px-3 text-right">Payment Count</th>
												<th className="py-2.5 px-3">Notes</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-outline-variant">
											{displayBills.length === 0 ? (
												<tr>
													<td colSpan={8} className="py-6 text-center text-on-surface-variant">
														No daily billing or settlement records for this showroom in {report.monthName}.
													</td>
												</tr>
											) : (
												displayBills.map((b) => (
													<tr key={b.id} className="hover:bg-surface-container/50">
														<td className="py-2 px-3 font-semibold text-on-surface">{formatDateStr(b.date)}</td>
														<td className="py-2 px-3 text-on-surface-variant font-medium">{new Date(b.date).toLocaleDateString('en-IN', { weekday: 'short' })}</td>
														<td className="py-2 px-3 text-right font-medium">{formatCurrency(b.amount)}</td>
														<td className="py-2 px-3 text-right font-bold text-success">{formatCurrency(b.paidAmount)}</td>
														<td className="py-2 px-3 text-right font-bold text-error">{formatCurrency(b.balanceAmount)}</td>
														<td className="py-2 px-3 text-center">
															<span
																className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
																	b.status === 'Paid'
																		? 'bg-success-container text-success'
																		: b.status === 'PartiallyPaid'
																		? 'bg-amber-100 text-amber-700'
																		: 'bg-error-container text-error'
																}`}
															>
																{b.status}
															</span>
														</td>
														<td className="py-2 px-3 text-right font-medium">{b.paymentCount}</td>
														<td className="py-2 px-3 text-on-surface-variant text-[11px]">{b.notes || '—'}</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</div>

							{/* Financial Totals Summary Block */}
							{activeSummary && (
								<div className="app-card p-4 border border-outline-variant bg-surface-container-low">
									<h5 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-3">
										Monthly Financial Settlement Totals
									</h5>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
										<div className="p-3 bg-surface rounded-lg border border-outline-variant">
											<span className="text-[11px] text-on-surface-variant">Total Billed Revenue</span>
											<div className="text-base font-bold text-on-surface mt-1">{formatCurrency(activeSummary.totalBilled)}</div>
										</div>
										<div className="p-3 bg-surface rounded-lg border border-outline-variant">
											<span className="text-[11px] text-on-surface-variant">Total Collections Received</span>
											<div className="text-base font-bold text-success mt-1">{formatCurrency(activeSummary.totalCollected)}</div>
										</div>
										<div className="p-3 bg-surface rounded-lg border border-outline-variant">
											<span className="text-[11px] text-on-surface-variant">Total Outstanding Balance</span>
											<div className="text-base font-bold text-error mt-1">{formatCurrency(activeSummary.totalOutstanding)}</div>
										</div>
										<div className="p-3 bg-surface rounded-lg border border-outline-variant">
											<span className="text-[11px] text-on-surface-variant">Collection Recovery Rate</span>
											<div className="text-base font-bold text-secondary mt-1">{activeSummary.collectionRate.toFixed(1)}%</div>
										</div>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
