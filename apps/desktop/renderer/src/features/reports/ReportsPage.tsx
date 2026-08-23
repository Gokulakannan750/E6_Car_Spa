import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	Download,
	TrendingUp,
	TrendingDown,
	IndianRupee,
	Wrench,
	Calendar,
	CreditCard,
	Receipt,
	Sparkles,
	PieChart as PieIcon,
	BarChart3,
	Layers,
	FileSpreadsheet,
	Filter,
	ArrowUpRight,
	Car,
	CheckCircle2,
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
import * as XLSX from 'xlsx';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import {
	getInvoices,
	getJobCards,
	getStaffAdvances,
	getServices,
	type InvoiceListDto,
	type JobCardListDto,
	type StaffAdvanceDto,
} from '../../lib/api';

// ─── Currency and Date Helpers ────────────────────────────────────────────────
function formatINR(value: number): string {
	return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatINRK(value: number): string {
	if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
	if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
	return `₹${value}`;
}

type DatePreset = '7d' | '30d' | 'this_month' | 'last_month' | 'ytd' | 'custom';

interface DateBounds {
	start: Date;
	end: Date;
	label: string;
}

function getDateBounds(preset: DatePreset, customStart?: string, customEnd?: string): DateBounds {
	const now = new Date();
	const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

	if (preset === '7d') {
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
		return { start, end, label: 'Last 7 Days' };
	}
	if (preset === '30d') {
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
		return { start, end, label: 'Last 30 Days' };
	}
	if (preset === 'this_month') {
		const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
		return { start, end, label: 'This Month' };
	}
	if (preset === 'last_month') {
		const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
		const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
		return { start, end: lastMonthEnd, label: 'Last Month' };
	}
	if (preset === 'ytd') {
		const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
		return { start, end, label: 'Year to Date' };
	}

	// Custom
	const start = customStart ? new Date(customStart + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
	const cEnd = customEnd ? new Date(customEnd + 'T23:59:59') : end;
	return { start, end: cEnd, label: 'Custom Range' };
}

// ─── Status normalization helper ─────────────────────────────────────────────
function normalizeInvoiceStatus(status: unknown): string {
	if (typeof status === 'number') {
		if (status === 0) return 'Draft';
		if (status === 2) return 'Paid';
		if (status === 3) return 'PartiallyPaid';
		if (status === 4) return 'Cancelled';
		if (status === 6) return 'Generated';
	}
	if (typeof status === 'string') {
		const s = status.trim().toLowerCase();
		if (s === 'draft' || s === '0') return 'Draft';
		if (s === 'paid' || s === '2') return 'Paid';
		if (s === 'partiallypaid' || s === 'partially paid' || s === 'partially-paid' || s === '3') return 'PartiallyPaid';
		if (s === 'cancelled' || s === 'canceled' || s === '4') return 'Cancelled';
		if (s === 'generated' || s === '6') return 'Generated';
	}
	return 'Draft';
}

const JOB_STATUS_COLORS: Record<string, string> = {
	'In Progress': '#0453cd',
	'Ready / Delivered': '#2e7d32',
	'Draft / Pending': '#f57c00',
	Cancelled: '#ba1a1a',
	Completed: '#1976d2',
};

const PAYMENT_METHOD_COLORS = ['#0453cd', '#2e7d32', '#f57c00', '#7b1fa2', '#0097a7'];

export function ReportsPage() {
	// ── Filter State ──────────────────────────────────────────────────────────
	const [preset, setPreset] = useState<DatePreset>('30d');
	const [customStart, setCustomStart] = useState<string>(() => {
		const d = new Date();
		d.setDate(d.getDate() - 29);
		return d.toISOString().split('T')[0];
	});
	const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);
	const [isExporting, setIsExporting] = useState(false);

	const bounds = useMemo(() => getDateBounds(preset, customStart, customEnd), [preset, customStart, customEnd]);

	// ── Live Data Queries ─────────────────────────────────────────────────────
	const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
		queryKey: ['reports-invoices'],
		queryFn: () => getInvoices({ page: 1, pageSize: 1000 }),
	});

	const { data: jobCardsData, isLoading: jobsLoading } = useQuery({
		queryKey: ['reports-job-cards'],
		queryFn: () => getJobCards({ page: 1, pageSize: 1000 }),
	});

	const { data: advancesData, isLoading: advancesLoading } = useQuery({
		queryKey: ['reports-advances'],
		queryFn: () => getStaffAdvances({ page: 1, pageSize: 1000 }),
	});

	const { data: servicesData } = useQuery({
		queryKey: ['reports-services'],
		queryFn: () => getServices({ page: 1, pageSize: 200 }),
	});

	const allInvoices: InvoiceListDto[] = invoicesData?.items ?? [];
	const allJobCards: JobCardListDto[] = jobCardsData?.items ?? [];
	const allAdvances: StaffAdvanceDto[] = advancesData?.items ?? [];

	// ── Filtered Datasets by Date Range ───────────────────────────────────────
	const filteredInvoices = useMemo(() => {
		return allInvoices.filter((i) => {
			const d = new Date(i.invoiceDate);
			return d >= bounds.start && d <= bounds.end;
		});
	}, [allInvoices, bounds]);

	const filteredJobCards = useMemo(() => {
		return allJobCards.filter((j) => {
			const d = new Date(j.createdAt);
			return d >= bounds.start && d <= bounds.end;
		});
	}, [allJobCards, bounds]);

	const filteredAdvances = useMemo(() => {
		return allAdvances.filter((a) => {
			const d = new Date(a.advanceDate);
			return d >= bounds.start && d <= bounds.end;
		});
	}, [allAdvances, bounds]);

	// ── Executive KPI Aggregations ───────────────────────────────────────────
	const kpis = useMemo(() => {
		const nonCancelledInvoices = filteredInvoices.filter((i) => normalizeInvoiceStatus(i.status) !== 'Cancelled');
		const billedRevenue = nonCancelledInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
		const collected = nonCancelledInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
		const outstanding = nonCancelledInvoices.reduce((s, i) => s + (i.balanceAmount || 0), 0);
		const invoicesCount = nonCancelledInvoices.length;
		const jobCardsCount = filteredJobCards.length;
		const completedJobs = filteredJobCards.filter((j) => j.status === 3 || j.status === 6 || j.status === 2).length;
		const avgTicket = invoicesCount > 0 ? billedRevenue / invoicesCount : 0;
		const advancesTotal = filteredAdvances.reduce((s, a) => s + (a.amount || 0), 0);

		return {
			billedRevenue,
			collected,
			outstanding,
			invoicesCount,
			jobCardsCount,
			completedJobs,
			avgTicket,
			advancesTotal,
		};
	}, [filteredInvoices, filteredJobCards, filteredAdvances]);

	// ── Chart 1: Revenue vs Collections Timeline ─────────────────────────────
	const timelineData = useMemo(() => {
		const map: Record<string, { label: string; dateObj: Date; revenue: number; collected: number; outstanding: number }> = {};
		const diffDays = Math.ceil((bounds.end.getTime() - bounds.start.getTime()) / (1000 * 60 * 60 * 24));
		const isMonthly = diffDays > 35;

		filteredInvoices.forEach((inv) => {
			if (normalizeInvoiceStatus(inv.status) === 'Cancelled') return;
			const d = new Date(inv.invoiceDate);
			const key = isMonthly
				? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
				: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

			const label = isMonthly
				? d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
				: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

			if (!map[key]) {
				map[key] = { label, dateObj: d, revenue: 0, collected: 0, outstanding: 0 };
			}
			map[key].revenue += inv.totalAmount || 0;
			map[key].collected += inv.paidAmount || 0;
			map[key].outstanding += inv.balanceAmount || 0;
		});

		const result = Object.values(map).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

		// If less than 2 items, provide at least start and end anchors for nice visuals
		if (result.length === 0) {
			return [
				{ label: bounds.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), revenue: 0, collected: 0, outstanding: 0 },
				{ label: bounds.end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), revenue: 0, collected: 0, outstanding: 0 },
			];
		}
		return result;
	}, [filteredInvoices, bounds]);

	// ── Chart 2: Job Card Status Distribution ────────────────────────────────
	const jobStatusData = useMemo(() => {
		const counts: Record<string, number> = {
			'In Progress': 0,
			'Ready / Delivered': 0,
			'Draft / Pending': 0,
			Cancelled: 0,
		};

		filteredJobCards.forEach((j) => {
			if (j.status === 1) counts['In Progress']++;
			else if (j.status === 3 || j.status === 6) counts['Ready / Delivered']++;
			else if (j.status === 0) counts['Draft / Pending']++;
			else if (j.status === 4) counts['Cancelled']++;
			else counts['In Progress']++;
		});

		return Object.entries(counts)
			.filter(([_, count]) => count > 0)
			.map(([name, value]) => ({ name, value }));
	}, [filteredJobCards]);

	// ── Chart 3: Payment Modes Breakdown ─────────────────────────────────────
	const paymentModesData = useMemo(() => {
		const modes: Record<string, number> = {
			Cash: 0,
			UPI: 0,
			Card: 0,
			'Bank Transfer': 0,
		};

		filteredInvoices.forEach((inv) => {
			if (inv.paidAmount > 0) {
				// Default assumption if not itemized: Cash or UPI based on general trends
				modes['Cash'] = (modes['Cash'] || 0) + inv.paidAmount;
			}
		});

		return Object.entries(modes)
			.filter(([_, val]) => val > 0)
			.map(([name, amount]) => ({ name, amount }));
	}, [filteredInvoices]);

	// ── Top Services Ranking ─────────────────────────────────────────────────
	const topServices = useMemo(() => {
		const serviceMap: Record<string, { name: string; category: string; count: number; revenue: number }> = {};

		filteredJobCards.forEach((jc) => {
			const jcServices = (jc as any).jobCardServices ?? (jc as any).services ?? [];
			if (Array.isArray(jcServices) && jcServices.length > 0) {
				jcServices.forEach((s: any) => {
					const name = s.serviceName || s.name || 'Custom Service';
					const cat = s.category || 'General';
					const rev = s.lineTotal || (s.unitPrice ? s.unitPrice * (s.quantity || 1) : 0);
					if (!serviceMap[name]) serviceMap[name] = { name, category: cat, count: 0, revenue: 0 };
					serviceMap[name].count += s.quantity || 1;
					serviceMap[name].revenue += rev;
				});
			} else {
				// Attribute by total amount if services array is flat
				const name = 'Car Spa Service Package';
				if (!serviceMap[name]) serviceMap[name] = { name, category: 'General', count: 0, revenue: 0 };
				serviceMap[name].count += 1;
				serviceMap[name].revenue += jc.totalAmount || 0;
			}
		});

		return Object.values(serviceMap)
			.sort((a, b) => b.revenue - a.revenue)
			.slice(0, 5);
	}, [filteredJobCards]);

	// ── Excel Export Handler ─────────────────────────────────────────────────
	const handleExportExcel = () => {
		setIsExporting(true);
		try {
			const wb = XLSX.utils.book_new();

			// ── Sheet 1: Executive Summary
			const summaryData = [
				['E6 CAR SPA MANAGEMENT - EXECUTIVE BUSINESS REPORT'],
				['Generated On', new Date().toLocaleString('en-IN')],
				['Reporting Period', bounds.label],
				['From Date', bounds.start.toLocaleDateString('en-IN')],
				['To Date', bounds.end.toLocaleDateString('en-IN')],
				[],
				['FINANCIAL METRICS', 'AMOUNT (INR)'],
				['Total Billed Revenue', kpis.billedRevenue],
				['Total Collected Payments', kpis.collected],
				['Total Outstanding Receivables', kpis.outstanding],
				['Average Invoice Value (AIV)', Math.round(kpis.avgTicket)],
				['Staff Advances Disbursed', kpis.advancesTotal],
				[],
				['OPERATIONAL METRICS', 'COUNT'],
				['Total Invoices Issued', kpis.invoicesCount],
				['Total Job Cards Created', kpis.jobCardsCount],
				['Completed / Delivered Job Cards', kpis.completedJobs],
			];
			const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
			wsSummary['!cols'] = [{ wch: 35 }, { wch: 25 }];
			XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

			// ── Sheet 2: Invoices Detailed
			const invoiceHeaders = [
				'Invoice #',
				'Job Card #',
				'Date',
				'Customer Name',
				'Customer Phone',
				'Vehicle',
				'Registration #',
				'Total Amount (INR)',
				'Paid Amount (INR)',
				'Balance Amount (INR)',
				'Status',
			];
			const invoiceRows = filteredInvoices.map((inv) => [
				inv.invoiceNumber || 'Draft',
				inv.jobCardNumber,
				new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
				inv.customerName,
				inv.customerPhone,
				inv.vehicle,
				inv.registrationNumber,
				inv.totalAmount,
				inv.paidAmount,
				inv.balanceAmount,
				normalizeInvoiceStatus(inv.status),
			]);
			const wsInvoices = XLSX.utils.aoa_to_sheet([invoiceHeaders, ...invoiceRows]);
			wsInvoices['!cols'] = [
				{ wch: 18 },
				{ wch: 16 },
				{ wch: 14 },
				{ wch: 22 },
				{ wch: 16 },
				{ wch: 20 },
				{ wch: 16 },
				{ wch: 18 },
				{ wch: 18 },
				{ wch: 18 },
				{ wch: 14 },
			];
			XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

			// ── Sheet 3: Job Cards Detailed
			const jcHeaders = [
				'Job Card #',
				'Created Date',
				'Customer Name',
				'Phone',
				'Vehicle Make & Model',
				'Registration #',
				'Status',
				'Total Amount (INR)',
				'Linked Invoice',
			];
			const jcRows = filteredJobCards.map((j) => [
				j.jobCardNumber,
				new Date(j.createdAt).toLocaleDateString('en-IN'),
				j.customerName,
				j.customerPhone,
				`${j.make} ${j.model}`.trim(),
				j.registrationNumber,
				j.status === 0 ? 'Draft' : j.status === 1 ? 'In Progress' : j.status === 3 ? 'Ready' : j.status === 6 ? 'Delivered' : 'Other',
				j.totalAmount,
				j.invoiceNumber || (j.invoiceId ? 'Draft Invoice' : 'None'),
			]);
			const wsJobCards = XLSX.utils.aoa_to_sheet([jcHeaders, ...jcRows]);
			wsJobCards['!cols'] = [
				{ wch: 18 },
				{ wch: 14 },
				{ wch: 22 },
				{ wch: 16 },
				{ wch: 22 },
				{ wch: 16 },
				{ wch: 16 },
				{ wch: 18 },
				{ wch: 18 },
			];
			XLSX.utils.book_append_sheet(wb, wsJobCards, 'Job Cards');

			// ── Sheet 4: Top Services
			const sHeaders = ['Service Name', 'Category', 'Bookings / Quantity', 'Total Revenue Generated (INR)'];
			const sRows = topServices.map((s) => [s.name, s.category || 'General', s.count, s.revenue]);
			const wsServices = XLSX.utils.aoa_to_sheet([sHeaders, ...sRows]);
			wsServices['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 22 }, { wch: 26 }];
			XLSX.utils.book_append_sheet(wb, wsServices, 'Top Services');

			// ── Sheet 5: Staff Advances
			const advHeaders = ['Date', 'Employee Name', 'Role', 'Advance Type', 'Amount (INR)', 'Payment Method', 'Status', 'Notes'];
			const advRows = filteredAdvances.map((a) => [
				new Date(a.advanceDate).toLocaleDateString('en-IN'),
				a.staffName,
				a.staffRole || 'Staff',
				a.advanceType,
				a.amount,
				a.paymentMethod || 'Cash',
				a.status || 'Pending',
				a.notes || '',
			]);
			const wsAdvances = XLSX.utils.aoa_to_sheet([advHeaders, ...advRows]);
			wsAdvances['!cols'] = [
				{ wch: 14 },
				{ wch: 22 },
				{ wch: 18 },
				{ wch: 18 },
				{ wch: 16 },
				{ wch: 16 },
				{ wch: 14 },
				{ wch: 25 },
			];
			XLSX.utils.book_append_sheet(wb, wsAdvances, 'Staff Advances');

			// Save file
			const fileName = `E6_Car_Spa_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
			XLSX.writeFile(wb, fileName);
		} catch (err) {
			console.error('Failed to export Excel report:', err);
		} finally {
			setIsExporting(false);
		}
	};

	const isLoading = invoicesLoading || jobsLoading || advancesLoading;

	return (
		<div className="space-y-6 animate-fade-in pb-12">
			{/* ── Header & Range Bar ────────────────────────────────────────────── */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold text-on-surface tracking-tight flex items-center gap-2.5">
						<BarChart3 className="w-6 h-6 text-secondary" />
						Reports &amp; Business Analytics
					</h1>
					<p className="text-sm text-on-surface-variant mt-0.5">
						Track financial performance, revenue trends, service popularity, and operational metrics
					</p>
				</div>

				{/* Date Filter & Export Toolbar */}
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant/60">
						{(
							[
								{ id: '7d', label: '7D' },
								{ id: '30d', label: '30D' },
								{ id: 'this_month', label: 'This Month' },
								{ id: 'last_month', label: 'Last Month' },
								{ id: 'ytd', label: 'YTD' },
								{ id: 'custom', label: 'Custom' },
							] as const
						).map((p) => (
							<button
								key={p.id}
								onClick={() => setPreset(p.id)}
								className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
									preset === p.id
										? 'bg-secondary text-white shadow-xs font-semibold'
										: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
								}`}
							>
								{p.label}
							</button>
						))}
					</div>

					{preset === 'custom' && (
						<div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-outline-variant/80 shadow-2xs">
							<Calendar className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
							<input
								type="date"
								value={customStart}
								onChange={(e) => setCustomStart(e.target.value)}
								className="text-xs text-on-surface outline-hidden bg-transparent"
							/>
							<span className="text-xs text-on-surface-variant">to</span>
							<input
								type="date"
								value={customEnd}
								onChange={(e) => setCustomEnd(e.target.value)}
								className="text-xs text-on-surface outline-hidden bg-transparent"
							/>
						</div>
					)}

					<Button
						variant="primary"
						icon={<FileSpreadsheet className="w-4 h-4" />}
						onClick={handleExportExcel}
						loading={isExporting}
						className="shadow-xs cursor-pointer"
					>
						Export Excel (.xlsx)
					</Button>
				</div>
			</div>

			{/* ── Key Financial & Operational KPI Cards ─────────────────────────── */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{/* 1. Total Billed Revenue */}
				<div className="app-card p-4.5 border-l-4 border-l-secondary transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Billed Revenue
						</span>
						<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
							<IndianRupee className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2">{formatINR(kpis.billedRevenue)}</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<Receipt className="w-3.5 h-3.5 text-secondary" />
						<span>{kpis.invoicesCount} invoices in period</span>
					</div>
				</div>

				{/* 2. Total Collected */}
				<div className="app-card p-4.5 border-l-4 border-l-success transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Collections Received
						</span>
						<div className="w-8 h-8 rounded-lg bg-success-container text-success flex items-center justify-center">
							<TrendingUp className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-success mt-2">{formatINR(kpis.collected)}</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<CheckCircle2 className="w-3.5 h-3.5 text-success" />
						<span>
							{kpis.billedRevenue > 0 ? `${((kpis.collected / kpis.billedRevenue) * 100).toFixed(1)}% collection rate` : '0%'}
						</span>
					</div>
				</div>

				{/* 3. Outstanding Balance */}
				<div className="app-card p-4.5 border-l-4 border-l-warning transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Outstanding Balance
						</span>
						<div className="w-8 h-8 rounded-lg bg-warning-container text-warning flex items-center justify-center">
							<TrendingDown className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-warning mt-2">{formatINR(kpis.outstanding)}</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>Pending client settlements</span>
					</div>
				</div>

				{/* 4. Operations & Job Cards */}
				<div className="app-card p-4.5 border-l-4 border-l-info transition-all hover:shadow-elevation-1">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Job Cards Completed
						</span>
						<div className="w-8 h-8 rounded-lg bg-info-container text-info flex items-center justify-center">
							<Car className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-on-surface mt-2">
						{kpis.completedJobs} <span className="text-sm font-normal text-on-surface-variant">/ {kpis.jobCardsCount}</span>
					</div>
					<div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
						<span>Avg Ticket: {formatINR(kpis.avgTicket)}</span>
					</div>
				</div>
			</div>

			{/* ── Charts Row 1: Revenue & Collections Timeline + Job Status Donut ─ */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
				{/* Timeline Area Chart */}
				<div className="lg:col-span-2 app-card p-5">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h2 className="text-base font-semibold text-on-surface">Revenue &amp; Collections Trend</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Billed revenue vs actual collections over {bounds.label.toLowerCase()}
							</p>
						</div>
						<div className="flex items-center gap-4 text-xs font-medium">
							<div className="flex items-center gap-1.5">
								<span className="w-3 h-3 rounded-xs bg-[#0453cd]" />
								<span>Billed Revenue</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="w-3 h-3 rounded-xs bg-[#2e7d32]" />
								<span>Collected</span>
							</div>
						</div>
					</div>

					<div className="h-[280px] w-full">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
								<defs>
									<linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#0453cd" stopOpacity={0.25} />
										<stop offset="95%" stopColor="#0453cd" stopOpacity={0.0} />
									</linearGradient>
									<linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#2e7d32" stopOpacity={0.25} />
										<stop offset="95%" stopColor="#2e7d32" stopOpacity={0.0} />
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" stroke="#e1e3e4" vertical={false} />
								<XAxis
									dataKey="label"
									stroke="#75777a"
									fontSize={11}
									tickLine={false}
									axisLine={{ stroke: '#e1e3e4' }}
									dy={5}
								/>
								<YAxis
									stroke="#75777a"
									fontSize={11}
									tickLine={false}
									axisLine={false}
									tickFormatter={(v) => formatINRK(v)}
								/>
								<Tooltip
									content={({ active, payload, label }) => {
										if (!active || !payload?.length) return null;
										return (
											<div className="bg-white border border-outline-variant rounded-lg p-3 shadow-xl text-xs space-y-1.5 min-w-[150px]">
												<p className="font-semibold text-on-surface border-b border-outline-variant/60 pb-1">{label}</p>
												{payload.map((entry: any, i: number) => (
													<div key={i} className="flex items-center justify-between gap-3">
														<span className="text-on-surface-variant flex items-center gap-1.5">
															<span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
															{entry.name}:
														</span>
														<span className="font-semibold text-on-surface">{formatINR(entry.value)}</span>
													</div>
												))}
											</div>
										);
									}}
								/>
								<Area
									type="monotone"
									dataKey="revenue"
									name="Billed Revenue"
									stroke="#0453cd"
									strokeWidth={2.5}
									fillOpacity={1}
									fill="url(#colorRevenue)"
								/>
								<Area
									type="monotone"
									dataKey="collected"
									name="Collected"
									stroke="#2e7d32"
									strokeWidth={2.5}
									fillOpacity={1}
									fill="url(#colorCollected)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>

				{/* Job Cards Status Donut */}
				<div className="app-card p-5 flex flex-col justify-between">
					<div>
						<h2 className="text-base font-semibold text-on-surface">Job Card Status</h2>
						<p className="text-xs text-on-surface-variant mt-0.5">Distribution across lifecycle stages</p>
					</div>

					<div className="h-[210px] relative flex items-center justify-center">
						{jobStatusData.length > 0 ? (
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={jobStatusData}
										cx="50%"
										cy="50%"
										innerRadius={55}
										outerRadius={80}
										paddingAngle={4}
										dataKey="value"
									>
										{jobStatusData.map((entry, index) => (
											<Cell
												key={`cell-${index}`}
												fill={JOB_STATUS_COLORS[entry.name] || PAYMENT_METHOD_COLORS[index % PAYMENT_METHOD_COLORS.length]}
											/>
										))}
									</Pie>
									<Tooltip
										content={({ active, payload }) => {
											if (!active || !payload?.length) return null;
											const item = payload[0];
											return (
												<div className="bg-white border border-outline-variant rounded-lg px-3 py-1.5 shadow-lg text-xs">
													<span className="font-semibold text-on-surface">{item.name}: </span>
													<span>{item.value} jobs</span>
												</div>
											);
										}}
									/>
								</PieChart>
							</ResponsiveContainer>
						) : (
							<div className="text-center text-xs text-on-surface-variant">No job cards in this period</div>
						)}
					</div>

					{/* Donut Legend */}
					<div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/60">
						{Object.entries(JOB_STATUS_COLORS).map(([statusName, color]) => {
							const count = filteredJobCards.filter((j) => {
								if (statusName === 'In Progress') return j.status === 1;
								if (statusName === 'Ready / Delivered') return j.status === 3 || j.status === 6;
								if (statusName === 'Draft / Pending') return j.status === 0;
								if (statusName === 'Cancelled') return j.status === 4;
								return false;
							}).length;
							return (
								<div key={statusName} className="flex items-center justify-between text-xs">
									<div className="flex items-center gap-1.5 truncate">
										<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
										<span className="text-on-surface-variant truncate">{statusName}</span>
									</div>
									<span className="font-semibold text-on-surface">{count}</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* ── Section 2: Top Performing Services & Recent Revenue Log ───────── */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
				{/* Top Services Ranking */}
				<div className="app-card p-5 space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-base font-semibold text-on-surface">Top Revenue Services</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">Most profitable service packages in period</p>
						</div>
						<Sparkles className="w-4 h-4 text-secondary" />
					</div>

					{topServices.length > 0 ? (
						<div className="space-y-3">
							{topServices.map((s, idx) => {
								const percentage = kpis.billedRevenue > 0 ? Math.round((s.revenue / kpis.billedRevenue) * 100) : 0;
								return (
									<div key={s.name} className="space-y-1.5">
										<div className="flex items-center justify-between text-xs">
											<div className="flex items-center gap-2">
												<span className="w-5 h-5 rounded-full bg-surface-container font-mono text-[11px] font-bold text-on-surface-variant flex items-center justify-center">
													{idx + 1}
												</span>
												<span className="font-medium text-on-surface">{s.name}</span>
												<span className="text-[11px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
													{s.category}
												</span>
											</div>
											<div className="text-right">
												<span className="font-semibold text-on-surface">{formatINR(s.revenue)}</span>
												<span className="text-on-surface-variant ml-1.5">({s.count} bookings)</span>
											</div>
										</div>
										<div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
											<div
												className="h-full bg-secondary rounded-full transition-all duration-300"
												style={{ width: `${Math.max(4, Math.min(100, percentage))}%` }}
											/>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="py-12 text-center text-xs text-on-surface-variant">
							No service bookings recorded in this timeframe
						</div>
					)}
				</div>

				{/* Period Advances Summary & Staff Disbursals */}
				<div className="app-card p-5 space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-base font-semibold text-on-surface">Staff Advances Log</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">Employee advances issued in this period</p>
						</div>
						<span className="text-xs font-semibold text-warning bg-warning-container px-2.5 py-1 rounded-md">
							Total: {formatINR(kpis.advancesTotal)}
						</span>
					</div>

					{filteredAdvances.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="app-table text-xs">
								<thead>
									<tr>
										<th>Employee</th>
										<th>Date</th>
										<th>Type</th>
										<th className="text-right">Amount</th>
									</tr>
								</thead>
								<tbody>
									{filteredAdvances.slice(0, 5).map((a) => (
										<tr key={a.id}>
											<td>
												<p className="font-medium text-on-surface">{a.staffName}</p>
												<p className="text-[11px] text-on-surface-variant">{a.staffRole || 'Staff'}</p>
											</td>
											<td className="text-on-surface-variant whitespace-nowrap">
												{new Date(a.advanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
											</td>
											<td>{a.advanceType}</td>
											<td className="text-right font-semibold text-on-surface">{formatINR(a.amount)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="py-12 text-center text-xs text-on-surface-variant">
							No staff advances recorded in this period
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
export default ReportsPage;
