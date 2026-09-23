import { useState, useMemo } from 'react';
import {
	AlertCircle,
	AlertTriangle,
	Banknote,
	Calendar,
	CheckCircle2,
	Edit3,
	Eye,
	Receipt,
	RotateCcw,
	Search,
	Users,
	X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	getStaffList,
	getStaffSalaryRoster,
	getStaffSalaryPreview,
	saveEnteredSalary,
	settleStaffSalary,
	type StaffSalaryItemDto,
} from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../auth/auth-context';

function formatINR(val?: number | null): string {
	if (val === undefined || val === null || isNaN(val)) return '₹0';
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		maximumFractionDigits: 0,
	}).format(val);
}

function formatDateDisplay(dateStr?: string | null): string {
	if (!dateStr) return '';
	const parts = dateStr.split('T')[0].split('-').map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
	const [year, month, day] = parts;
	const dt = new Date(year, month - 1, day);
	return dt.toLocaleDateString('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	});
}

function formatDateTimeDisplay(dateStr?: string | null): string {
	if (!dateStr) return '—';
	try {
		return new Date(dateStr).toLocaleString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return dateStr;
	}
}

const MONTHS = [
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

function getMonthDates(year: number, month: number) {
	const y = String(year);
	const m = String(month).padStart(2, '0');
	const lastDay = new Date(year, month, 0).getDate();
	const d = String(lastDay).padStart(2, '0');
	return {
		from: `${y}-${m}-01`,
		to: `${y}-${m}-${d}`,
	};
}

function getInitials(name?: string | null): string {
	if (!name) return 'S';
	const parts = name.trim().split(/\s+/);
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SalaryPage() {
	const qc = useQueryClient();
	const { hasPermission, isOwner, user } = useAuth();
	const canManage = !user || isOwner || hasPermission('staff_salary.manage') || hasPermission('staff.edit');
	const canSettle = !user || isOwner || hasPermission('staff_salary.settle') || hasPermission('staff.edit');

	const currentYear = new Date().getFullYear();
	const currentMonth = new Date().getMonth() + 1;

	// Period month/year cycle
	const [selectedYear, setSelectedYear] = useState<number>(currentYear);
	const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

	const initialDates = useMemo(() => getMonthDates(currentYear, currentMonth), [currentYear, currentMonth]);

	// Integrated Filters
	const [search, setSearch] = useState('');
	const [staffFilter, setStaffFilter] = useState('');
	const [statusFilter, setStatusFilter] = useState<string>('all');
	const [fromDate, setFromDate] = useState(initialDates.from);
	const [toDate, setToDate] = useState(initialDates.to);

	// Unsaved salary drafts / user-entered salaries decoupled from date filter changes
	const [salaryDrafts, setSalaryDrafts] = useState<Record<string, { enteredSalary: number; notes?: string }>>({});

	// Enter / Edit Salary Dialog State
	const [editingItem, setEditingItem] = useState<StaffSalaryItemDto | null>(null);
	const [salaryInput, setSalaryInput] = useState('');
	const [notesInput, setNotesInput] = useState('');
	const [modalFromDate, setModalFromDate] = useState<string>('');
	const [modalToDate, setModalToDate] = useState<string>('');
	const [formError, setFormError] = useState('');

	// Settle Confirmation Dialog State
	const [settlingItem, setSettlingItem] = useState<{
		item: StaffSalaryItemDto;
		enteredSalary: number;
		advanceDeduction: number;
		finalSalary: number;
		remainingAdvance: number;
		notes?: string;
	} | null>(null);
	const [settleError, setSettleError] = useState('');

	// View Details Dialog State (Settlement receipt / info)
	const [viewingDetailsItem, setViewingDetailsItem] = useState<StaffSalaryItemDto | null>(null);

	// Date Range Validation
	const isInvalidDateRange = Boolean(fromDate && toDate && fromDate > toDate);

	// Query staff list for dropdown
	const { data: staffList = [] } = useQuery({
		queryKey: ['staff-list'],
		queryFn: async () => {
			try {
				return await getStaffList();
			} catch {
				return [];
			}
		},
	});

	// Query staff salary roster for the selected period
	const {
		data: rosterData,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ['staff-salary-roster', fromDate, toDate, staffFilter, statusFilter, search],
		queryFn: async () => {
			return await getStaffSalaryRoster({
				fromDate,
				toDate,
				staffId: staffFilter || undefined,
				status: statusFilter !== 'all' ? statusFilter : undefined,
				search: search || undefined,
			});
		},
		enabled: Boolean(fromDate && toDate && !isInvalidDateRange),
	});

	// Mutations
	const saveSalaryMutation = useMutation({
		mutationFn: saveEnteredSalary,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['staff-salary-roster'] });
			if (editingItem) {
				const numVal = parseFloat(salaryInput);
				if (!isNaN(numVal)) {
					setSalaryDrafts((prev) => ({
						...prev,
						[editingItem.staffId]: {
							enteredSalary: numVal,
							notes: notesInput.trim() || undefined,
						},
					}));
				}
			}
			setEditingItem(null);
			setFormError('');
		},
		onError: (err: Error) => {
			setFormError(err.message || 'Failed to save entered salary.');
		},
	});

	const settleSalaryMutation = useMutation({
		mutationFn: settleStaffSalary,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['staff-salary-roster'] });
			qc.invalidateQueries({ queryKey: ['staff-advances'] });
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			if (settlingItem) {
				setSalaryDrafts((prev) => {
					const next = { ...prev };
					delete next[settlingItem.item.staffId];
					return next;
				});
			}
			setSettlingItem(null);
			setSettleError('');
		},
		onError: (err: Error) => {
			setSettleError(err.message || 'Failed to settle staff salary.');
		},
	});

	// Determine active period label
	const periodLabel = useMemo(() => {
		if (fromDate && toDate) {
			return `${formatDateDisplay(fromDate)} — ${formatDateDisplay(toDate)}`;
		}
		if (fromDate) {
			return `From ${formatDateDisplay(fromDate)}`;
		}
		if (toDate) {
			return `Up to ${formatDateDisplay(toDate)}`;
		}
		return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
	}, [fromDate, toDate, selectedMonth, selectedYear]);

	const handleMonthChange = (month: number) => {
		setSelectedMonth(month);
		const dates = getMonthDates(selectedYear, month);
		setFromDate(dates.from);
		setToDate(dates.to);
	};

	const handleYearChange = (year: number) => {
		setSelectedYear(year);
		const dates = getMonthDates(year, selectedMonth);
		setFromDate(dates.from);
		setToDate(dates.to);
	};

	const hasActiveFilters = Boolean(
		search ||
			staffFilter ||
			statusFilter !== 'all' ||
			fromDate !== initialDates.from ||
			toDate !== initialDates.to
	);

	const handleResetFilters = () => {
		setSearch('');
		setStaffFilter('');
		setStatusFilter('all');
		const dates = getMonthDates(currentYear, currentMonth);
		setSelectedYear(currentYear);
		setSelectedMonth(currentMonth);
		setFromDate(dates.from);
		setToDate(dates.to);
	};

	// Open Enter Salary Dialog
	const handleOpenEnterSalary = (item: StaffSalaryItemDto) => {
		setEditingItem(item);
		const draft = salaryDrafts[item.staffId];
		if (draft !== undefined && draft.enteredSalary != null) {
			setSalaryInput(String(draft.enteredSalary));
			setNotesInput(draft.notes || '');
		} else if (item.enteredSalary != null) {
			setSalaryInput(String(item.enteredSalary));
			setNotesInput(item.notes || '');
		} else {
			setSalaryInput('');
			setNotesInput('');
		}
		setModalFromDate(fromDate || item.periodFrom || initialDates.from);
		setModalToDate(toDate || item.periodTo || initialDates.to);
		setFormError('');
	};

	// Live preview calculations for Enter Salary modal
	const parsedSalary = parseFloat(salaryInput);
	const isValidSalaryInput = !isNaN(parsedSalary) && parsedSalary >= 0;

	// Query live preview when modal dates change
	const { data: modalPreviewData } = useQuery({
		queryKey: ['staff-salary-modal-preview', editingItem?.staffId, modalFromDate, modalToDate],
		queryFn: async () => {
			if (!editingItem || !modalFromDate || !modalToDate || modalFromDate > modalToDate) return null;
			const res = await getStaffSalaryPreview({
				staffId: editingItem.staffId,
				fromDate: modalFromDate,
				toDate: modalToDate,
				enteredSalary: isValidSalaryInput ? parsedSalary : 0,
			});
			return res ?? null;
		},
		enabled: Boolean(editingItem && modalFromDate && modalToDate && modalFromDate <= modalToDate),
	});

	const currentOutstandingAdvance = modalPreviewData?.outstandingAdvance ?? editingItem?.outstandingAdvance ?? 0;
	const liveDeduction = isValidSalaryInput ? Math.min(currentOutstandingAdvance, parsedSalary) : 0;
	const liveFinalSalary = isValidSalaryInput ? Math.max(0, parsedSalary - liveDeduction) : 0;
	const liveRemainingAdvance = isValidSalaryInput ? Math.max(0, currentOutstandingAdvance - liveDeduction) : currentOutstandingAdvance;

	// Submit Save Salary (READY)
	const handleSaveSalary = (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingItem) return;
		if (!isValidSalaryInput) {
			setFormError('Please enter a valid salary amount (₹0 or greater).');
			return;
		}

		if (modalFromDate && modalToDate && modalFromDate > modalToDate) {
			setFormError('From Date cannot be later than To Date.');
			return;
		}

		saveSalaryMutation.mutate({
			staffId: editingItem.staffId,
			periodFrom: modalFromDate || fromDate,
			periodTo: modalToDate || toDate,
			enteredSalary: parsedSalary,
			notes: notesInput.trim() || undefined,
		});
	};

	// Open Settle Confirmation from Enter Dialog or table row
	const handleProceedToSettle = (item: StaffSalaryItemDto, salaryVal?: number, notesVal?: string) => {
		const enteredVal = salaryVal !== undefined ? salaryVal : item.enteredSalary;
		if (enteredVal === undefined || enteredVal === null || isNaN(enteredVal) || enteredVal < 0) {
			setFormError('Please enter a valid salary amount before settling.');
			return;
		}

		const deduction = Math.min(item.outstandingAdvance, enteredVal);
		const finalSal = Math.max(0, enteredVal - deduction);
		const remAdv = Math.max(0, item.outstandingAdvance - deduction);

		setSettlingItem({
			item,
			enteredSalary: enteredVal,
			advanceDeduction: deduction,
			finalSalary: finalSal,
			remainingAdvance: remAdv,
			notes: notesVal !== undefined ? notesVal : item.notes || undefined,
		});
		setSettleError('');
		setEditingItem(null);
	};

	// Confirm Settlement
	const handleConfirmSettlement = () => {
		if (!settlingItem) return;
		settleSalaryMutation.mutate({
			staffId: settlingItem.item.staffId,
			periodFrom: fromDate || settlingItem.item.periodFrom,
			periodTo: toDate || settlingItem.item.periodTo,
			enteredSalary: settlingItem.enteredSalary,
			notes: settlingItem.notes,
		});
	};

	// Map roster items preserving active entered salary drafts
	const items = useMemo(() => {
		const rawItems = rosterData?.items ?? [];
		return rawItems.map((item) => {
			// A. If settled for this exact period, historical settled snapshot is authoritative
			if (item.status === 'Settled') {
				return item;
			}

			// B. If user has an active local salary draft (unsaved or entered)
			const draft = salaryDrafts[item.staffId];
			if (draft !== undefined && draft.enteredSalary != null) {
				const enteredSalary = draft.enteredSalary;
				const applicableAdvance = item.outstandingAdvance;
				const advanceDeduction = Math.min(applicableAdvance, enteredSalary);
				const finalSalary = Math.max(0, enteredSalary - advanceDeduction);
				const remainingAdvance = Math.max(0, applicableAdvance - advanceDeduction);

				return {
					...item,
					enteredSalary,
					notes: draft.notes ?? item.notes,
					outstandingAdvance: applicableAdvance,
					advanceDeduction,
					finalSalary,
					remainingAdvance,
					status: 'Ready' as const,
				};
			}

			return item;
		});
	}, [rosterData, salaryDrafts]);

	const summaryStats = useMemo(() => {
		const totalEntered = items.reduce((sum, x) => sum + (x.enteredSalary ?? 0), 0);
		const totalDeductions = items.reduce((sum, x) => sum + (x.advanceDeduction ?? 0), 0);
		const totalFinal = items.reduce((sum, x) => sum + (x.finalSalary ?? 0), 0);
		const settledCount = items.filter((x) => x.status === 'Settled').length;
		const readyCount = items.filter((x) => x.status === 'Ready').length;
		const notEnteredCount = items.filter((x) => x.status === 'NotEntered').length;
		return {
			totalStaffCount: items.length,
			settledCount,
			readyCount,
			notEnteredCount,
			totalEnteredSalary: totalEntered,
			totalAdvanceDeductions: totalDeductions,
			totalFinalSalary: totalFinal,
		};
	}, [items]);

	return (
		<div className="space-y-6 animate-fade-in pb-12 w-full">
			{/* ─── PAGE HEADER ─── */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-on-surface tracking-tight">
						Staff Salary
					</h1>
					<p className="text-sm text-on-surface-variant mt-1">
						Enter custom period salaries, preview advance recoveries, and settle payroll
					</p>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
						<Calendar className="w-3.5 h-3.5" />
						Period: {periodLabel}
					</span>
				</div>
			</div>

			{/* ─── PERIOD SELECTOR BAR ─── */}
			<div className="app-card p-4 rounded-2xl shadow-xs">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
							<Calendar className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
								Salary Period
							</h3>
							<p className="text-sm font-bold text-on-surface">
								{periodLabel}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						{/* Month Selector */}
						<select
							aria-label="Salary Month"
							value={selectedMonth}
							onChange={(e) => handleMonthChange(Number(e.target.value))}
							className="form-input text-xs w-36 bg-white cursor-pointer font-medium"
						>
							{MONTHS.map((m, idx) => (
								<option key={m} value={idx + 1}>
									{m}
								</option>
							))}
						</select>

						{/* Year Selector */}
						<select
							aria-label="Salary Year"
							value={selectedYear}
							onChange={(e) => handleYearChange(Number(e.target.value))}
							className="form-input text-xs w-28 bg-white cursor-pointer font-medium"
						>
							{[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
								<option key={yr} value={yr}>
									{yr}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			{/* ─── SUMMARY KPI CARDS ─── */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* 1. Salary Period Overview */}
				<div className="app-card p-4.5 rounded-2xl shadow-xs border border-slate-200/80 bg-white">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Salary Period
						</span>
						<div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
							<Calendar className="w-4 h-4" />
						</div>
					</div>
					<p className="text-xl font-bold text-slate-900 mt-2 truncate" title={periodLabel}>
						{periodLabel}
					</p>
					<p className="text-xs text-slate-500 mt-1">
						{summaryStats.totalStaffCount} staff members in period
					</p>
				</div>

				{/* 2. Payroll Status Breakdown */}
				<div className="app-card p-4.5 rounded-2xl shadow-xs border border-slate-200/80 bg-white">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Payroll Status
						</span>
						<div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
							<Users className="w-4 h-4" />
						</div>
					</div>
					<p className="text-xl font-bold text-slate-900 mt-2 font-mono">
						<span className="text-emerald-700">{summaryStats.settledCount}</span>
						<span className="text-slate-400 font-normal text-sm"> / {summaryStats.totalStaffCount} Settled</span>
					</p>
					<p className="text-xs text-slate-500 mt-1">
						{summaryStats.readyCount} Ready · {summaryStats.notEnteredCount} Not Entered
					</p>
				</div>

				{/* 3. Total Entered Gross Salary */}
				<div className="app-card p-4.5 rounded-2xl shadow-xs border border-slate-200/80 bg-white">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Entered Salary
						</span>
						<div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
							<Banknote className="w-4 h-4" />
						</div>
					</div>
					<p className="text-xl font-bold text-blue-950 mt-2 font-mono">
						{formatINR(summaryStats.totalEnteredSalary)}
					</p>
					<p className="text-xs text-slate-500 mt-1">Gross entered across staff</p>
				</div>

				{/* 4. Total Final Net Payout */}
				<div className="app-card p-4.5 rounded-2xl shadow-xs border border-slate-200/80 bg-white">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Net Final Payout
						</span>
						<div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
							<Receipt className="w-4 h-4" />
						</div>
					</div>
					<p className="text-xl font-bold text-purple-950 mt-2 font-mono">
						{formatINR(summaryStats.totalFinalSalary)}
					</p>
					<p className="text-xs text-slate-500 mt-1">
						After {formatINR(summaryStats.totalAdvanceDeductions)} advance deductions
					</p>
				</div>
			</div>

			{/* ─── INTEGRATED SALARY FILTER BAR ─── */}
			<div className="app-card p-4 rounded-2xl shadow-xs space-y-3">
				<div className="flex items-center gap-3 flex-wrap">
					{/* 1. Search Staff */}
					<div className="flex-1 min-w-[200px] sm:min-w-[240px]">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
							<input
								type="text"
								aria-label="Search staff"
								placeholder="Search by staff name or role..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="form-input pl-9 pr-4 w-full text-xs"
							/>
						</div>
					</div>

					{/* 2. Staff Filter Dropdown */}
					<select
						aria-label="Filter by staff"
						value={staffFilter}
						onChange={(e) => setStaffFilter(e.target.value)}
						className="form-input text-xs w-44 bg-white cursor-pointer"
					>
						<option value="">All Staff Members</option>
						{staffList.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name}
							</option>
						))}
					</select>

					{/* 3. Status Filter */}
					<select
						aria-label="Salary Status"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="form-input text-xs w-44 bg-white font-medium cursor-pointer"
					>
						<option value="all">All Payroll Status</option>
						<option value="Ready">Ready</option>
						<option value="Settled">Settled</option>
						<option value="NotEntered">Not Entered</option>
					</select>

					{/* 4. From Date Filter */}
					<div className="relative flex items-center">
						<Calendar className="w-3.5 h-3.5 absolute left-2.5 text-on-surface-variant pointer-events-none" />
						<input
							type="date"
							aria-label="From Date"
							title="From date"
							value={fromDate}
							onChange={(e) => setFromDate(e.target.value)}
							className="form-input pl-8 pr-6 py-1.5 text-xs w-36 bg-white cursor-pointer"
						/>
						{fromDate && (
							<button
								type="button"
								onClick={() => setFromDate('')}
								className="absolute right-1.5 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
								title="Clear from date"
							>
								<X className="w-3 h-3" />
							</button>
						)}
					</div>

					{/* 5. To Date Filter */}
					<div className="relative flex items-center">
						<Calendar className="w-3.5 h-3.5 absolute left-2.5 text-on-surface-variant pointer-events-none" />
						<input
							type="date"
							aria-label="To Date"
							title="To date"
							value={toDate}
							onChange={(e) => setToDate(e.target.value)}
							className="form-input pl-8 pr-6 py-1.5 text-xs w-36 bg-white cursor-pointer"
						/>
						{toDate && (
							<button
								type="button"
								onClick={() => setToDate('')}
								className="absolute right-1.5 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
								title="Clear to date"
							>
								<X className="w-3 h-3" />
							</button>
						)}
					</div>

					{/* Reset Filters */}
					{hasActiveFilters && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							icon={<RotateCcw className="w-3.5 h-3.5" />}
							onClick={handleResetFilters}
							className="text-xs text-on-surface-variant hover:text-on-surface"
						>
							Reset
						</Button>
					)}
				</div>

				{/* Validation message if fromDate > toDate */}
				{isInvalidDateRange && (
					<div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
						<AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
						<span>Invalid date range: From Date cannot be later than To Date.</span>
					</div>
				)}
			</div>

			{/* ─── API ERROR STATE ─── */}
			{isError && (
				<div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3 text-red-700">
					<div className="flex items-center gap-2.5 text-xs font-medium">
						<AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
						<span>Failed to load staff salary records for the selected period.</span>
					</div>
					<Button
						variant="secondary"
						size="sm"
						onClick={() => refetch()}
						className="border-red-200 hover:bg-red-100 text-red-800"
					>
						Retry
					</Button>
				</div>
			)}

			{/* ─── STAFF SALARY TABLE ─── */}
			<div className="app-card rounded-2xl shadow-xs overflow-hidden border border-slate-200/80">
				<div className="overflow-x-auto">
					<table className="w-full text-left border-collapse text-xs">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
								<th className="py-3 px-4 min-w-[160px]">Staff Member</th>
								<th className="py-3 px-4 min-w-[110px]">Role</th>
								<th className="py-3 px-4 min-w-[160px]">Salary Period</th>
								<th className="py-3 px-4 text-right min-w-[120px]">Entered Salary</th>
								<th className="py-3 px-4 text-right min-w-[140px]">Outstanding Advance</th>
								<th className="py-3 px-4 text-right min-w-[110px]">Salary</th>
								<th className="py-3 px-4 min-w-[120px]">Payroll Status</th>
								<th className="py-3 px-4 text-center min-w-[260px]">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{isLoading ? (
								<tr>
									<td colSpan={8} className="py-12 text-center text-slate-500">
										<div className="flex items-center justify-center gap-2">
											<div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
											<span>Loading salary roster...</span>
										</div>
									</td>
								</tr>
							) : items.length === 0 ? (
								<tr>
									<td colSpan={8} className="py-12 text-center">
										<EmptyState
											icon={<Users className="w-8 h-8 text-slate-300 mx-auto" />}
											title="No salary records found"
											description={
												hasActiveFilters
													? 'Try adjusting your search query, staff filter, or period dates.'
													: 'No staff members have been found for this salary period.'
											}
											action={
												hasActiveFilters ? (
													<Button variant="secondary" size="sm" onClick={handleResetFilters}>
														Clear Filters
													</Button>
												) : undefined
											}
										/>
									</td>
								</tr>
							) : (
								items.map((item) => {
									const isNotEntered = item.status === 'NotEntered';
									const isReady = item.status === 'Ready';
									const isSettled = item.status === 'Settled';

									return (
										<tr
											key={item.staffId}
											className={`hover:bg-slate-50/70 transition-colors ${
												isSettled ? 'bg-emerald-50/20' : ''
											}`}
										>
											{/* 1. Staff Member */}
											<td className="py-3.5 px-4 font-medium text-slate-900">
												<div className="flex items-center gap-2">
													<div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
														{getInitials(item.staffName)}
													</div>
													<div className="truncate max-w-[180px]">
														<div className="font-semibold text-slate-900 truncate">
															{item.staffName}
														</div>
														<div className="text-[11px] text-slate-500 font-normal">
															{item.staffPhoneNumber || '—'}
														</div>
													</div>
												</div>
											</td>

											{/* 2. Role */}
											<td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
												<span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 font-medium text-slate-700">
													{item.staffRole || 'Staff'}
												</span>
											</td>

											{/* 3. Salary Period */}
											<td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
												<div className="text-xs text-slate-800">
													{formatDateDisplay(item.periodFrom)} — {formatDateDisplay(item.periodTo)}
												</div>
											</td>

											{/* 4. Entered Salary */}
											<td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
												{item.enteredSalary != null ? (
													<span className="font-semibold text-slate-900">
														{formatINR(item.enteredSalary)}
													</span>
												) : (
													<span className="text-slate-400 italic">Not set</span>
												)}
											</td>

											{/* 5. Outstanding Advance */}
											<td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
												{item.outstandingAdvance > 0 ? (
													<span className="font-medium text-amber-800">
														{formatINR(item.outstandingAdvance)}
													</span>
												) : (
													<span className="text-slate-400">₹0</span>
												)}
												{isSettled && (
													<div className="text-[10px] text-slate-400 font-sans">
														(Before Settlement)
													</div>
												)}
											</td>

											{/* 6. Salary (Payable after advance recovery) */}
											<td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
												{item.finalSalary != null ? (
													<span className="text-emerald-700 text-sm">
														{formatINR(item.finalSalary)}
													</span>
												) : (
													<span className="text-slate-400 font-normal">—</span>
												)}
											</td>

											{/* 7. Payroll Status */}
											<td className="py-3.5 px-4 whitespace-nowrap">
												{isSettled && (
													<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
														<CheckCircle2 className="w-3 h-3 text-emerald-600" />
														Settled
													</span>
												)}
												{isReady && (
													<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
														Ready
													</span>
												)}
												{isNotEntered && (
													<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
														Not Entered
													</span>
												)}
											</td>

											{/* 8. Actions (Centered) */}
											<td className="py-3.5 px-4 text-center whitespace-nowrap min-w-[260px]">
												<div className="flex items-center justify-center gap-1.5">
													{isNotEntered && canManage && (
														<Button
															type="button"
															variant="primary"
															size="sm"
															icon={<Banknote className="w-3.5 h-3.5" />}
															onClick={() => handleOpenEnterSalary(item)}
															className="text-xs py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white"
														>
															Enter Salary
														</Button>
													)}

													{isReady && (
														<>
															{canManage && (
																<Button
																	type="button"
																	variant="secondary"
																	size="sm"
																	icon={<Edit3 className="w-3.5 h-3.5" />}
																	onClick={() => handleOpenEnterSalary(item)}
																	className="text-xs py-1 px-2.5"
																>
																	Edit
																</Button>
															)}

															{canSettle && (
																<Button
																	type="button"
																	size="sm"
																	icon={<CheckCircle2 className="w-3.5 h-3.5" />}
																	onClick={() => handleProceedToSettle(item)}
																	className="text-xs py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
																>
																	Settle Salary
																</Button>
															)}
														</>
													)}

													<Button
														type="button"
														variant="ghost"
														size="sm"
														icon={<Eye className="w-3.5 h-3.5" />}
														onClick={() => setViewingDetailsItem(item)}
														className="text-xs py-1 px-2 text-slate-700 hover:bg-slate-100"
														title="View salary details and calculation"
													>
														View Details
													</Button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Table Footer Summary */}
				{!isLoading && items.length > 0 && (
					<div className="py-3 px-4 bg-slate-50/75 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
						<span>
							Showing <strong>{items.length}</strong> staff members for period <strong>{periodLabel}</strong>
						</span>
						<div className="flex items-center gap-4 font-mono font-medium">
							<span>Gross Salary: {formatINR(summaryStats.totalEnteredSalary)}</span>
							<span className="text-amber-700">Advance Recovery: {formatINR(summaryStats.totalAdvanceDeductions)}</span>
							<span className="text-emerald-700 font-bold">Salary Payable: {formatINR(summaryStats.totalFinalSalary)}</span>
						</div>
					</div>
				)}
			</div>

			{/* ─── ENTER / EDIT SALARY DIALOG ─── */}
			<Dialog
				open={!!editingItem}
				onOpenChange={(isOpen) => {
					if (!isOpen && !saveSalaryMutation.isPending) setEditingItem(null);
				}}
				title={editingItem?.status === 'Ready' ? 'Edit Staff Salary' : 'Enter Staff Salary'}
				description={`Set the salary for ${editingItem?.staffName || 'Staff'}. Changing the calculation period recalculates the applicable advance recovery.`}
			>
				{editingItem && (
					<form onSubmit={handleSaveSalary} noValidate className="space-y-4 pt-2">
						{formError && (
							<div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
								<AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
								<span>{formError}</span>
							</div>
						)}

						{/* Staff Profile Header */}
						<div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
							<div>
								<h4 className="font-bold text-slate-900 text-sm">{editingItem.staffName}</h4>
								<p className="text-slate-500 mt-0.5">
									{editingItem.staffRole || 'Staff Member'} · {editingItem.staffPhoneNumber}
								</p>
							</div>
							<div className="text-right">
								<span className="text-[10px] uppercase font-semibold text-slate-400 block">Calculation Period</span>
								<span className="font-semibold text-slate-800 text-xs">
									{modalFromDate && modalToDate ? `${formatDateDisplay(modalFromDate)} — ${formatDateDisplay(modalToDate)}` : periodLabel}
								</span>
							</div>
						</div>

						{/* Salary Period Range Controls inside Modal */}
						<div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-xs font-semibold text-slate-700">Salary Calculation Period</span>
								<span className="text-[11px] text-slate-500 font-mono">
									{modalFromDate && modalToDate ? `${formatDateDisplay(modalFromDate)} — ${formatDateDisplay(modalToDate)}` : periodLabel}
								</span>
							</div>
							<div className="grid grid-cols-2 gap-3 pt-1">
								<div className="space-y-1">
									<label htmlFor="modalFromDateInput" className="text-[11px] font-medium text-slate-600 block">
										From Date
									</label>
									<input
										id="modalFromDateInput"
										type="date"
										aria-label="Modal From Date"
										value={modalFromDate}
										onChange={(e) => setModalFromDate(e.target.value)}
										className="form-input text-xs w-full py-1.5 bg-white cursor-pointer"
									/>
								</div>
								<div className="space-y-1">
									<label htmlFor="modalToDateInput" className="text-[11px] font-medium text-slate-600 block">
										To Date
									</label>
									<input
										id="modalToDateInput"
										type="date"
										aria-label="Modal To Date"
										value={modalToDate}
										onChange={(e) => setModalToDate(e.target.value)}
										className="form-input text-xs w-full py-1.5 bg-white cursor-pointer"
									/>
								</div>
							</div>
							<p className="text-[11px] text-slate-500">
								Changing calculation period recalculates applicable advance recovery. It does not alter entered salary.
							</p>
						</div>

						{/* Salary Input */}
						<div className="space-y-1.5">
							<label htmlFor="enteredSalaryInput" className="text-xs font-semibold text-slate-700 block">
								Entered Salary Amount <span className="text-red-500">*</span>
							</label>
							<div className="relative">
								<span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
									₹
								</span>
								<input
									id="enteredSalaryInput"
									type="number"
									step="any"
									min="0"
									autoFocus
									required
									placeholder="e.g. 20000"
									value={salaryInput}
									onChange={(e) => {
										setSalaryInput(e.target.value);
										if (formError) setFormError('');
									}}
									className="form-input pl-8 pr-4 w-full text-base font-bold font-mono text-slate-900"
								/>
							</div>
							<p className="text-[11px] text-slate-500">
								Manual salary entry for this specific settlement period. Does not affect staff profile.
							</p>
						</div>

						{/* Optional Notes Input */}
						<div className="space-y-1.5">
							<label htmlFor="salaryNotesInput" className="text-xs font-semibold text-slate-700 block">
								Payroll Notes <span className="text-slate-400 font-normal">(Optional)</span>
							</label>
							<input
								id="salaryNotesInput"
								type="text"
								placeholder="e.g. Regular monthly payout with advance recovery"
								value={notesInput}
								onChange={(e) => setNotesInput(e.target.value)}
								className="form-input w-full text-xs"
								maxLength={500}
							/>
						</div>

						{/* Live Calculation Preview Card */}
						<div className="p-4 bg-slate-50/90 border border-slate-200/90 rounded-2xl space-y-2.5 text-xs">
							<div className="flex items-center justify-between pb-2 border-b border-slate-200 text-slate-600 font-medium">
								<span>Live Advance Deduction Preview</span>
								<span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
									FIFO Recovery
								</span>
							</div>

							<div className="flex justify-between items-center">
								<span className="text-slate-600">Entered Salary:</span>
								<span className="font-bold font-mono text-slate-900 text-sm">
									{formatINR(isValidSalaryInput ? parsedSalary : 0)}
								</span>
							</div>

							<div className="flex justify-between items-center">
								<span className="text-slate-600">Current Outstanding Advance:</span>
								<span className="font-medium font-mono text-amber-800">
									{formatINR(currentOutstandingAdvance)}
								</span>
							</div>

							<div className="flex justify-between items-center text-amber-800">
								<span className="font-medium">Advance Deduction:</span>
								<span className="font-bold font-mono">
									-{formatINR(liveDeduction)}
								</span>
							</div>

							<div className="flex justify-between items-center pt-2 border-t border-slate-200">
								<span className="font-bold text-slate-900">Net Final Salary:</span>
								<span className="font-extrabold font-mono text-emerald-700 text-base">
									{formatINR(liveFinalSalary)}
								</span>
							</div>

							<div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
								<span>Remaining Advance Balance After Settlement:</span>
								<span className="font-mono font-medium text-slate-700">
									{formatINR(liveRemainingAdvance)}
								</span>
							</div>
						</div>

						{/* Modal Actions */}
						<div className="flex items-center justify-between pt-2 border-t border-slate-200">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => setEditingItem(null)}
								disabled={saveSalaryMutation.isPending}
							>
								Cancel
							</Button>

							<div className="flex items-center gap-2">
								<Button
									type="submit"
									variant="secondary"
									size="sm"
									loading={saveSalaryMutation.isPending}
									className="border-blue-200 text-blue-700 hover:bg-blue-50"
								>
									Save Salary
								</Button>

								{canSettle && (
									<Button
										type="button"
										size="sm"
										onClick={() => handleProceedToSettle(editingItem, isValidSalaryInput ? parsedSalary : undefined, notesInput)}
										disabled={!isValidSalaryInput || saveSalaryMutation.isPending}
										className="bg-emerald-600 hover:bg-emerald-700 text-white"
										icon={<CheckCircle2 className="w-3.5 h-3.5" />}
									>
										Proceed to Settle
									</Button>
								)}
							</div>
						</div>
					</form>
				)}
			</Dialog>

			{/* ─── SETTLE SALARY CONFIRMATION DIALOG ─── */}
			<Dialog
				open={!!settlingItem}
				onOpenChange={(isOpen) => {
					if (!isOpen && !settleSalaryMutation.isPending) setSettlingItem(null);
				}}
				title="Confirm Staff Salary Settlement"
				description="This operation is irreversible and will atomically recover outstanding staff advances in FIFO order."
			>
				{settlingItem && (
					<div className="space-y-4 pt-2">
						{settleError && (
							<div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
								<AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
								<span>{settleError}</span>
							</div>
						)}

						{/* Financial Snapshot Summary */}
						<div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2.5 text-xs">
							<div className="flex justify-between items-center">
								<span className="text-emerald-950 font-semibold">Staff Member:</span>
								<span className="font-bold text-emerald-950 text-sm">{settlingItem.item.staffName}</span>
							</div>

							<div className="flex justify-between items-center">
								<span className="text-emerald-900 font-medium">Salary Period:</span>
								<span className="font-semibold text-emerald-950">{periodLabel}</span>
							</div>

							<div className="flex justify-between items-center pt-2 border-t border-emerald-200/80">
								<span className="text-emerald-900">Entered Gross Salary:</span>
								<span className="font-bold font-mono text-emerald-950 text-sm">
									{formatINR(settlingItem.enteredSalary)}
								</span>
							</div>

							<div className="flex justify-between items-center text-amber-900">
								<span>Outstanding Advance Before Settlement:</span>
								<span className="font-medium font-mono">
									{formatINR(settlingItem.item.outstandingAdvance)}
								</span>
							</div>

							<div className="flex justify-between items-center text-amber-900 font-semibold">
								<span>Advance Deduction Recovered (FIFO):</span>
								<span className="font-bold font-mono">
									-{formatINR(settlingItem.advanceDeduction)}
								</span>
							</div>

							<div className="flex justify-between items-center pt-2 border-t border-emerald-200/80">
								<span className="font-bold text-emerald-950 text-sm">Final Salary Payout:</span>
								<span className="font-extrabold font-mono text-emerald-800 text-lg">
									{formatINR(settlingItem.finalSalary)}
								</span>
							</div>

							<div className="flex justify-between items-center text-[11px] text-emerald-800 pt-1">
								<span>Remaining Advance Balance:</span>
								<span className="font-mono font-medium">
									{formatINR(settlingItem.remainingAdvance)}
								</span>
							</div>
						</div>

						<p className="text-xs text-slate-600 leading-relaxed">
							Confirming will lock this payroll period permanently as <strong>Settled</strong> and record the exact financial snapshot for historical reporting.
						</p>

						<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => setSettlingItem(null)}
								disabled={settleSalaryMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="button"
								size="sm"
								loading={settleSalaryMutation.isPending}
								onClick={handleConfirmSettlement}
								className="bg-emerald-600 hover:bg-emerald-700 text-white"
								icon={<CheckCircle2 className="w-4 h-4" />}
							>
								Confirm & Settle Salary
							</Button>
						</div>
					</div>
				)}
			</Dialog>

			{/* ─── SALARY DETAILS / RECEIPT DIALOG ─── */}
			<Dialog
				open={!!viewingDetailsItem}
				onOpenChange={(isOpen) => {
					if (!isOpen) setViewingDetailsItem(null);
				}}
				title={viewingDetailsItem?.status === 'Settled' ? 'Salary Settlement Receipt' : 'Salary Details'}
				description="Complete payroll and advance breakdown for this period."
			>
				{viewingDetailsItem && (
					<div className="space-y-4 pt-2">
						{/* Staff Info */}
						<div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
							<div className="flex items-center justify-between">
								<h4 className="text-sm font-bold text-slate-900">{viewingDetailsItem.staffName}</h4>
								<span
									className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
										viewingDetailsItem.status === 'Settled'
											? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
											: viewingDetailsItem.status === 'Ready'
											? 'bg-blue-50 text-blue-700 border border-blue-200'
											: 'bg-slate-100 text-slate-600 border border-slate-200'
									}`}
								>
									{viewingDetailsItem.status === 'Settled' ? 'Settled' : viewingDetailsItem.status === 'Ready' ? 'Ready' : 'Not Entered'}
								</span>
							</div>
							<p className="text-slate-600">
								Role: <strong className="text-slate-800 font-medium">{viewingDetailsItem.staffRole || 'Staff Member'}</strong> · Phone:{' '}
								<strong className="text-slate-800 font-medium">{viewingDetailsItem.staffPhoneNumber}</strong>
							</p>
						</div>

						{/* Settlement Financial Receipt Snapshot */}
						<div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
							<div className="flex justify-between items-center pb-2 border-b border-slate-200 font-medium text-slate-600">
								<span>Salary Period</span>
								<span className="font-bold text-slate-900">
									{formatDateDisplay(viewingDetailsItem.periodFrom)} — {formatDateDisplay(viewingDetailsItem.periodTo)}
								</span>
							</div>

							<div className="flex justify-between items-center">
								<span className="text-slate-600">Entered Salary:</span>
								<span className="font-bold font-mono text-slate-900 text-sm">
									{viewingDetailsItem.enteredSalary != null ? formatINR(viewingDetailsItem.enteredSalary) : '—'}
								</span>
							</div>

							<div className="flex justify-between items-center text-slate-600">
								<span>Outstanding Advance Before Settlement:</span>
								<span className="font-medium font-mono text-slate-800">
									{formatINR(viewingDetailsItem.outstandingAdvance)}
								</span>
							</div>

							<div className="flex justify-between items-center text-amber-800">
								<span className="font-medium">Advance Recovery:</span>
								<span className="font-bold font-mono">
									{viewingDetailsItem.advanceDeduction != null ? formatINR(viewingDetailsItem.advanceDeduction) : '—'}
								</span>
							</div>

							<div className="flex justify-between items-center pt-2 border-t border-slate-200">
								<span className="font-bold text-slate-900 text-sm">Salary Payable:</span>
								<span className="font-extrabold font-mono text-emerald-700 text-base">
									{viewingDetailsItem.finalSalary != null ? formatINR(viewingDetailsItem.finalSalary) : '—'}
								</span>
							</div>

							<div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
								<span>Remaining Advance Balance:</span>
								<span className="font-mono font-medium text-slate-700">
									{viewingDetailsItem.remainingAdvance != null ? formatINR(viewingDetailsItem.remainingAdvance) : '—'}
								</span>
							</div>
						</div>

						{/* Audit / Settlement Metadata if Settled */}
						{viewingDetailsItem.status === 'Settled' && (
							<div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs text-emerald-900 space-y-1">
								<div className="flex items-center gap-1.5 font-semibold">
									<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
									<span>Historical Settlement Snapshot</span>
								</div>
								<p className="text-[11px] text-emerald-800">
									Settled on <strong>{formatDateTimeDisplay(viewingDetailsItem.settledAt)}</strong>
									{viewingDetailsItem.settledByName && ` by ${viewingDetailsItem.settledByName}`}.
								</p>
							</div>
						)}

						{/* Notes */}
						{viewingDetailsItem.notes && (
							<div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-600">
								<span className="font-semibold text-slate-700 block mb-0.5">Notes:</span>
								<p className="italic">{viewingDetailsItem.notes}</p>
							</div>
						)}

						<div className="flex justify-end pt-2">
							<Button variant="secondary" size="sm" onClick={() => setViewingDetailsItem(null)}>
								Close
							</Button>
						</div>
					</div>
				)}
			</Dialog>
		</div>
	);
}

export default SalaryPage;
