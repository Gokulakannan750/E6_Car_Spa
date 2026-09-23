import { useState, useCallback, useMemo, useEffect } from 'react';
import {
	Calendar,
	Search,
	Clock,
	Users,
	ChevronLeft,
	ChevronRight,
	CheckCircle2,
	AlertCircle,
	AlertTriangle,
	CalendarDays,
	Loader2,
	StickyNote,
	Filter,
	ArrowUpDown,
	X,
	Lock,
	Unlock,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useAuth } from '../auth/auth-context';
import { MonthlyAttendanceReportTab } from './MonthlyAttendanceReportTab';
import {
	getDailyAttendance,
	getDateRangeAttendance,
	upsertStaffAttendance,
	deleteStaffAttendance,
	confirmStaffAttendance,
	unlockStaffAttendance,
	type DailyStaffAttendanceItemDto,
	type StaffAttendanceStatus,
	type DailyAttendanceSummaryDto,
	type StaffAttendanceDto,
} from '../../lib/api';

// ── Status Config ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
	Present: { label: 'Present', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
	HalfDay: { label: 'Half Day', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
	Leave: { label: 'Leave', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: CalendarDays },
	Unmarked: { label: 'Unmarked', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
	const config = STATUS_CONFIG[status] || STATUS_CONFIG.Unmarked;
	const Icon = config.icon;
	return (
		<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.color}`}>
			<Icon className="w-3.5 h-3.5" />
			{config.label}
		</span>
	);
}

// ── Date Formatting Helpers (Showroom pattern) ──────────────────────────────
function formatDateHeading(dateStr: string): string {
	if (!dateStr) return '';
	const parts = dateStr.split('-').map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
	const [year, month, day] = parts;
	const dt = new Date(year, month - 1, day);
	return dt.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
}

function formatDateTime(dateStr?: string | null): string {
	if (!dateStr) return '';
	const dt = new Date(dateStr);
	if (isNaN(dt.getTime())) return dateStr;
	return dt.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

// ── Summary Card ────────────────────────────────────────────────────────────
function SummaryCard({ label, count, total, color }: { label: string; count: number | string; total?: number; color: string }) {
	const numericCount = typeof count === 'number' ? count : 0;
	const pct = total && total > 0 ? Math.round((numericCount / total) * 100) : 0;
	return (
		<div className="app-card p-4 rounded-xl shadow-xs flex flex-col gap-1">
			<span className="text-xs text-on-surface-variant font-medium">{label}</span>
			<div className="flex items-end gap-2">
				<span className={`text-2xl font-bold ${color}`}>{count}</span>
				{total !== undefined && <span className="text-xs text-on-surface-variant mb-0.5">/ {total}</span>}
			</div>
			{total !== undefined && (
				<div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
					<div className={`h-1.5 rounded-full ${color.replace('text-', 'bg-')} transition-all duration-300`} style={{ width: `${pct}%` }} />
				</div>
			)}
		</div>
	);
}

// ── Inline Attendance Action Buttons ────────────────────────────────────────
function AttendanceActions({
	staffId,
	attendanceDate,
	currentStatus,
	onMark,
	isMarking,
	isLocked,
}: {
	staffId: string;
	attendanceDate: string;
	currentStatus: StaffAttendanceStatus;
	onMark: (staffId: string, date: string, status: 'Present' | 'HalfDay' | 'Leave') => void;
	isMarking: boolean;
	isLocked?: boolean;
}) {
	const statuses: Array<'Present' | 'HalfDay' | 'Leave'> = ['Present', 'HalfDay', 'Leave'];
	return (
		<div className="flex items-center justify-end gap-1">
			{statuses.map((s) => {
				const config = STATUS_CONFIG[s];
				const isActive = currentStatus === s;
				return (
					<button
						key={s}
						type="button"
						disabled={isMarking || isLocked}
						onClick={() => onMark(staffId, attendanceDate, s)}
						className={`px-2.5 py-1 text-xs rounded-lg border transition-all font-medium
							${isActive
								? `${config.bg} ${config.color} ring-1 ring-current`
								: 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
							} ${isLocked ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer'} disabled:opacity-50 disabled:cursor-not-allowed`}
						title={isLocked ? 'Attendance is confirmed and locked' : `Mark as ${config.label}`}
					>
						{config.label}
					</button>
				);
			})}
		</div>
	);
}

// ── Time & Notes Row ────────────────────────────────────────────────────────
function TimeAndNotesRow({
	staffId,
	attendanceDate,
	checkInTime,
	checkOutTime,
	notes,
	status,
	onMark,
	isMarking,
	isLocked,
}: {
	staffId: string;
	attendanceDate: string;
	checkInTime?: string | null;
	checkOutTime?: string | null;
	notes?: string | null;
	status: StaffAttendanceStatus;
	onMark: (staffId: string, date: string, status: 'Present' | 'HalfDay' | 'Leave', checkIn?: string, checkOut?: string, notes?: string) => void;
	isMarking: boolean;
	isLocked?: boolean;
}) {
	const [localCheckIn, setLocalCheckIn] = useState(checkInTime || '');
	const [localCheckOut, setLocalCheckOut] = useState(checkOutTime || '');
	const [localNotes, setLocalNotes] = useState(notes || '');
	const [isEditing, setIsEditing] = useState(false);

	if (status === 'Unmarked') return null;

	const handleSave = () => {
		const validStatus = status as 'Present' | 'HalfDay' | 'Leave';
		onMark(staffId, attendanceDate, validStatus, localCheckIn || undefined, localCheckOut || undefined, localNotes || undefined);
		setIsEditing(false);
	};

	if (!isEditing) {
		return (
			<div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
				{checkInTime && (
					<span className="flex items-center gap-1">
						<Clock className="w-3 h-3" /> In: {checkInTime}
					</span>
				)}
				{checkOutTime && (
					<span className="flex items-center gap-1">
						Out: {checkOutTime}
					</span>
				)}
				{notes && (
					<span className="flex items-center gap-1 max-w-[200px] truncate">
						<StickyNote className="w-3 h-3" /> {notes}
					</span>
				)}
				{!isLocked && (
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
					>
						{checkInTime || checkOutTime || notes ? 'Edit' : 'Add details'}
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 mt-2 flex-wrap">
			<div className="flex items-center gap-1">
				<label className="text-xs text-slate-500">In:</label>
				<input
					type="time"
					value={localCheckIn}
					onChange={(e) => setLocalCheckIn(e.target.value)}
					className="form-input py-0.5 px-2 text-xs w-28"
				/>
			</div>
			<div className="flex items-center gap-1">
				<label className="text-xs text-slate-500">Out:</label>
				<input
					type="time"
					value={localCheckOut}
					onChange={(e) => setLocalCheckOut(e.target.value)}
					className="form-input py-0.5 px-2 text-xs w-28"
				/>
			</div>
			<div className="flex items-center gap-1">
				<label className="text-xs text-slate-500">Notes:</label>
				<input
					type="text"
					value={localNotes}
					onChange={(e) => setLocalNotes(e.target.value)}
					placeholder="Optional notes..."
					className="form-input py-0.5 px-2 text-xs w-40"
					maxLength={500}
				/>
			</div>
			<Button size="sm" onClick={handleSave} disabled={isMarking}>
				Save
			</Button>
			<button
				type="button"
				onClick={() => setIsEditing(false)}
				className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
			>
				Cancel
			</button>
		</div>
	);
}

// ── Main Attendance Page ────────────────────────────────────────────────────
export function AttendancePage() {
	const queryClient = useQueryClient();
	const { isOwner, hasPermission } = useAuth();

	// ── Active Tab ('daily' | 'monthly') ──
	const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

	// ── Daily date state ──
	const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

	// ── From / To Date Filter (matches Staff Advances pattern) ──
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');

	// ── Filter & Search states ──
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('All');

	// ── Sorting ──
	const [sortField, setSortField] = useState<'name' | 'status' | 'role' | 'date'>('name');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

	// ── Attendance Confirmation & Correction states (Showroom pattern) ──
	const [showUnlockModal, setShowUnlockModal] = useState(false);
	const [isCorrectionMode, setIsCorrectionMode] = useState(false);

	// Reset correction mode when selected date changes
	useEffect(() => {
		setIsCorrectionMode(false);
	}, [selectedDate]);

	// ── Range validation & resolution ──
	const isInvalidRange = Boolean(fromDate && toDate && fromDate > toDate);

	const effectiveRange = useMemo(() => {
		if (!fromDate && !toDate) return null;
		if (isInvalidRange) return null;

		const today = new Date().toISOString().split('T')[0];

		if (fromDate && toDate) {
			return { from: fromDate, to: toDate };
		}
		if (fromDate && !toDate) {
			return { from: fromDate, to: fromDate > today ? fromDate : today };
		}
		if (!fromDate && toDate) {
			const d = new Date(toDate + 'T00:00:00');
			d.setDate(d.getDate() - 30);
			return { from: d.toISOString().split('T')[0], to: toDate };
		}
		return null;
	}, [fromDate, toDate, isInvalidRange]);

	const isRangeActive = Boolean(effectiveRange);

	// ── Data queries ──
	// Daily query (active when no date range is specified)
	const dailyQuery = useQuery({
		queryKey: ['staff-attendance-daily', selectedDate],
		queryFn: () => getDailyAttendance(selectedDate),
		enabled: !isRangeActive,
		refetchOnWindowFocus: false,
	});

	// Range query (active when From/To date filter is set)
	const rangeQuery = useQuery({
		queryKey: ['staff-attendance-range', effectiveRange?.from, effectiveRange?.to, statusFilter, searchQuery],
		queryFn: () =>
			getDateRangeAttendance({
				fromDate: effectiveRange!.from,
				toDate: effectiveRange!.to,
				status: statusFilter !== 'All' ? statusFilter : undefined,
				search: searchQuery.trim() || undefined,
			}),
		enabled: isRangeActive,
		refetchOnWindowFocus: false,
	});

	// ── Mutations ──
	const upsertMutation = useMutation({
		mutationFn: upsertStaffAttendance,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['staff-attendance-daily'] });
			queryClient.invalidateQueries({ queryKey: ['staff-attendance-range'] });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: deleteStaffAttendance,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['staff-attendance-daily'] });
			queryClient.invalidateQueries({ queryKey: ['staff-attendance-range'] });
		},
	});

	// Confirm Daily Staff Attendance (Showroom pattern)
	const confirmAttendanceMutation = useMutation({
		mutationFn: () => {
			const markedStaffCount = (dailyQuery.data?.staffMembers?.filter((s) => s.status !== 'Unmarked')?.length ?? 0);
			if (markedStaffCount === 0) {
				throw new Error('Please mark attendance for at least one staff member before confirming attendance.');
			}
			return confirmStaffAttendance(selectedDate);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['staff-attendance-daily', selectedDate] });
			setIsCorrectionMode(false);
		},
		onError: (err: any) => {
			alert(err.message || 'Failed to confirm attendance.');
		},
	});

	// Unlock Daily Staff Attendance for Owner Correction (Showroom pattern)
	const unlockAttendanceMutation = useMutation({
		mutationFn: () => {
			return unlockStaffAttendance(selectedDate);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['staff-attendance-daily', selectedDate] });
			setShowUnlockModal(false);
			setIsCorrectionMode(true);
		},
		onError: (err: any) => {
			alert(err.message || 'Failed to unlock attendance for correction.');
		},
	});

	const isMarking = upsertMutation.isPending || deleteMutation.isPending;

	// ── Handlers ──
	const handleMark = useCallback(
		(staffId: string, date: string, status: 'Present' | 'HalfDay' | 'Leave', checkIn?: string, checkOut?: string, notes?: string) => {
			upsertMutation.mutate({
				staffId,
				attendanceDate: date,
				status,
				checkInTime: checkIn || null,
				checkOutTime: checkOut || null,
				notes: notes || null,
			});
		},
		[upsertMutation],
	);

	const handlePrevDay = () => {
		setFromDate('');
		setToDate('');
		const d = new Date(selectedDate);
		d.setDate(d.getDate() - 1);
		setSelectedDate(d.toISOString().split('T')[0]);
	};

	const handleNextDay = () => {
		setFromDate('');
		setToDate('');
		const d = new Date(selectedDate);
		d.setDate(d.getDate() + 1);
		setSelectedDate(d.toISOString().split('T')[0]);
	};

	const handleToday = () => {
		setFromDate('');
		setToDate('');
		setSelectedDate(new Date().toISOString().split('T')[0]);
	};

	const handleClearRange = () => {
		setFromDate('');
		setToDate('');
	};

	const handleSort = (field: 'name' | 'status' | 'role' | 'date') => {
		if (sortField === field) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortField(field);
			setSortDir('asc');
		}
	};

	// ── Computed data ──
	const dailyData = dailyQuery.data;
	const dailySummary: DailyAttendanceSummaryDto | null = dailyData?.summary ?? null;

	const isConfirmed = dailyData?.isAttendanceConfirmed ?? false;
	const isLocked = !isRangeActive && isConfirmed && !isCorrectionMode;

	const filteredDailyStaff = useMemo(() => {
		let list: DailyStaffAttendanceItemDto[] = dailyData?.staffMembers ?? [];

		// If the staffs are inactive they dont need to be inside the attendance
		list = list.filter((s) => s.isActive);

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(s) =>
					s.staffName.toLowerCase().includes(q) ||
					(s.staffRole || '').toLowerCase().includes(q) ||
					s.staffPhoneNumber.includes(q),
			);
		}

		if (statusFilter !== 'All') {
			list = list.filter((s) => s.status === statusFilter);
		}

		list = [...list].sort((a, b) => {
			let cmp = 0;
			if (sortField === 'name') cmp = a.staffName.localeCompare(b.staffName);
			else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
			else if (sortField === 'role') cmp = (a.staffRole || '').localeCompare(b.staffRole || '');
			return sortDir === 'asc' ? cmp : -cmp;
		});

		return list;
	}, [dailyData?.staffMembers, searchQuery, statusFilter, sortField, sortDir]);

	const rangeData = rangeQuery.data;
	const filteredRangeRecords = useMemo(() => {
		let list: StaffAttendanceDto[] = rangeData?.records ?? [];

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(s) =>
					s.staffName.toLowerCase().includes(q) ||
					(s.staffRole || '').toLowerCase().includes(q) ||
					s.staffPhoneNumber.includes(q),
			);
		}

		if (statusFilter !== 'All') {
			list = list.filter((s) => s.status === statusFilter);
		}

		list = [...list].sort((a, b) => {
			let cmp = 0;
			if (sortField === 'name') cmp = a.staffName.localeCompare(b.staffName);
			else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
			else if (sortField === 'role') cmp = (a.staffRole || '').localeCompare(b.staffRole || '');
			else if (sortField === 'date') cmp = a.attendanceDate.localeCompare(b.attendanceDate);
			return sortDir === 'asc' ? cmp : -cmp;
		});

		return list;
	}, [rangeData?.records, searchQuery, statusFilter, sortField, sortDir]);

	const isToday = selectedDate === new Date().toISOString().split('T')[0];
	const isLoading = isRangeActive ? rangeQuery.isLoading : dailyQuery.isLoading;
	const isError = isRangeActive ? rangeQuery.isError : dailyQuery.isError;
	const errorObj = isRangeActive ? rangeQuery.error : dailyQuery.error;
	const refetch = isRangeActive ? rangeQuery.refetch : dailyQuery.refetch;

	const hasMarkedStaff = (dailyData?.staffMembers?.filter((s) => s.status !== 'Unmarked')?.length ?? 0) > 0;

	return (
		<div className="space-y-6 animate-fade-in pb-12 w-full">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-on-surface tracking-tight">
						Staff Attendance
					</h1>
					<p className="text-sm text-on-surface-variant mt-1">
						Track daily staff attendance and attendance history
					</p>
				</div>
				{isRangeActive && (
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
							<CalendarDays className="w-3.5 h-3.5" />
							History: {effectiveRange?.from} to {effectiveRange?.to}
						</span>
						<Button
							variant="secondary"
							size="sm"
							onClick={handleClearRange}
							title="Return to daily view"
						>
							Return to Daily View
						</Button>
					</div>
				)}
			</div>

			{/* ─── TAB NAVIGATION ([ Daily Attendance ] [ Monthly Report ]) ─── */}
			<div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/60 w-fit">
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'daily'}
					onClick={() => setActiveTab('daily')}
					className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
						activeTab === 'daily'
							? 'bg-secondary text-white shadow-xs'
							: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
					}`}
				>
					Daily Attendance
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'monthly'}
					onClick={() => setActiveTab('monthly')}
					className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
						activeTab === 'monthly'
							? 'bg-secondary text-white shadow-xs'
							: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
					}`}
				>
					Monthly Report
				</button>
			</div>

			{activeTab === 'monthly' ? (
				<MonthlyAttendanceReportTab />
			) : (
				<>
					{/* ─── SUMMARY CARDS (Placed directly below header) ─── */}
			{isRangeActive ? (
				rangeData && (
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
						<SummaryCard label="Total Records" count={rangeData.totalRecords} total={rangeData.totalRecords} color="text-slate-700" />
						<SummaryCard label="Present" count={rangeData.presentCount} total={rangeData.totalRecords} color="text-emerald-600" />
						<SummaryCard label="Half Day" count={rangeData.halfDayCount} total={rangeData.totalRecords} color="text-amber-600" />
						<SummaryCard label="Leave" count={rangeData.leaveCount} total={rangeData.totalRecords} color="text-red-600" />
					</div>
				)
			) : (
				dailySummary && (
					<div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full">
						<SummaryCard label="Total Staff" count={dailySummary.totalActiveStaff} total={dailySummary.totalActiveStaff} color="text-slate-700" />
						<SummaryCard label="Present" count={dailySummary.presentCount} total={dailySummary.totalActiveStaff} color="text-emerald-600" />
						<SummaryCard label="Half Day" count={dailySummary.halfDayCount} total={dailySummary.totalActiveStaff} color="text-amber-600" />
						<SummaryCard label="Leave" count={dailySummary.leaveCount} total={dailySummary.totalActiveStaff} color="text-red-600" />
						<SummaryCard label="Unmarked" count={dailySummary.unmarkedCount} total={dailySummary.totalActiveStaff} color="text-slate-500" />
					</div>
				)
			)}

			{/* ─── UNIFIED FILTER BAR (Follows Staff Advances pattern) ─── */}
			<div className="app-card p-4 rounded-2xl shadow-xs w-full">
				<div className="flex flex-wrap items-end gap-3.5">
					{/* 1. DATE */}
					<div>
						<label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
							Date
						</label>
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={handlePrevDay}
								className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low text-on-surface-variant transition-colors cursor-pointer"
								title="Previous Day"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>

							<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest">
								<Calendar className="w-4 h-4 text-blue-600 pointer-events-none" />
								<input
									type="date"
									aria-label="Daily Date"
									value={selectedDate}
									onChange={(e) => {
										setSelectedDate(e.target.value);
										setFromDate('');
										setToDate('');
									}}
									className="text-xs font-semibold text-on-surface bg-transparent border-none focus:outline-none cursor-pointer"
								/>
							</div>

							<button
								type="button"
								onClick={handleNextDay}
								className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low text-on-surface-variant transition-colors cursor-pointer"
								title="Next Day"
							>
								<ChevronRight className="w-4 h-4" />
							</button>

							<Button
								variant="secondary"
								size="sm"
								onClick={handleToday}
								disabled={isToday && !isRangeActive}
							>
								Today
							</Button>
						</div>
					</div>

					{/* 2. STAFF SEARCH */}
					<div className="flex-1 min-w-[200px] sm:min-w-[220px]">
						<label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
							Staff
						</label>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
							<input
								type="text"
								placeholder="Search staff by name or role..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="form-input pl-9 pr-4 py-1.5 w-full text-xs"
							/>
						</div>
					</div>

					{/* 3. STATUS FILTER */}
					<div>
						<label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
							Status
						</label>
						<div className="flex items-center gap-1.5">
							<Filter className="w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
							<select
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
								className="form-input py-1.5 px-2 text-xs min-w-[120px] bg-white font-medium"
							>
								<option value="All">All Status</option>
								<option value="Present">Present</option>
								<option value="HalfDay">Half Day</option>
								<option value="Leave">Leave</option>
								{!isRangeActive && <option value="Unmarked">Unmarked</option>}
							</select>
						</div>
					</div>

					{/* 4. FROM DATE */}
					<div>
						<label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
							From Date
						</label>
						<div className="relative flex items-center">
							<Calendar className="w-3.5 h-3.5 absolute left-2.5 text-on-surface-variant pointer-events-none" />
							<input
								type="date"
								aria-label="From Date"
								title="From date"
								value={fromDate}
								onChange={(e) => setFromDate(e.target.value)}
								className="form-input pl-8 pr-6 py-1.5 text-xs w-36 bg-white"
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
					</div>

					{/* 5. TO DATE */}
					<div>
						<label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
							To Date
						</label>
						<div className="relative flex items-center">
							<Calendar className="w-3.5 h-3.5 absolute left-2.5 text-on-surface-variant pointer-events-none" />
							<input
								type="date"
								aria-label="To Date"
								title="To date"
								value={toDate}
								onChange={(e) => setToDate(e.target.value)}
								className="form-input pl-8 pr-6 py-1.5 text-xs w-36 bg-white"
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
					</div>

					{/* Clear Range Button */}
					{isRangeActive && (
						<div className="pb-0.5">
							<button
								type="button"
								onClick={handleClearRange}
								className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
								title="Clear date range filter"
							>
								<X className="w-3.5 h-3.5" />
								Clear Range
							</button>
						</div>
					)}
				</div>

				{/* Validation Warning when From Date > To Date */}
				{isInvalidRange && (
					<div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700 font-medium">
						<AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
						<span>From Date cannot be later than To Date. Please adjust the dates to view attendance history.</span>
					</div>
				)}
			</div>

			{/* ── ATTENDANCE CONFIRMATION STATUS BANNER (Showroom Pattern) ── */}
			{!isRangeActive && (() => {
				if (isLocked) {
					return (
						<div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
							<div className="flex items-center gap-3">
								<div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
									<CheckCircle2 className="w-5 h-5 text-emerald-600" />
								</div>
								<div>
									<div className="flex items-center gap-2">
										<span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
											Attendance Confirmed
										</span>
										<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
											<Lock className="w-3 h-3" /> Locked
										</span>
									</div>
									<p className="text-xs text-emerald-700 mt-0.5">
										Confirmed by <strong className="font-semibold text-emerald-900">{dailyData?.attendanceConfirmedByName || 'Authorized User'}</strong> • {formatDateTime(dailyData?.attendanceConfirmedAt)}
									</p>
								</div>
							</div>

							{isOwner && (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									icon={<Unlock className="w-3.5 h-3.5 text-purple-600" />}
									onClick={() => setShowUnlockModal(true)}
									className="shrink-0 border-purple-200 hover:bg-purple-50 text-purple-700 font-semibold"
								>
									Correct Attendance
								</Button>
							)}
						</div>
					);
				}

				if (isCorrectionMode) {
					return (
						<div className="p-4 bg-purple-50/90 border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
							<div className="flex items-center gap-3">
								<div className="w-9 h-9 rounded-full bg-purple-500/15 text-purple-700 flex items-center justify-center shrink-0">
									<Unlock className="w-5 h-5 text-purple-600" />
								</div>
								<div>
									<div className="flex items-center gap-2">
										<span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
											Administrative Correction Mode
										</span>
										<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100/80 text-purple-800 border border-purple-200">
											Owner Edit
										</span>
									</div>
									<p className="text-xs text-purple-700 mt-0.5">
										Changes are being made by Owner. Attendance must be confirmed again after updates.
									</p>
									{!hasMarkedStaff && (
										<p className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-1">
											<AlertCircle className="w-3.5 h-3.5 shrink-0" />
											Please mark attendance for at least one staff member before confirming attendance.
										</p>
									)}
								</div>
							</div>

							<Button
								type="button"
								variant="primary"
								size="sm"
								icon={<CheckCircle2 className="w-3.5 h-3.5" />}
								loading={confirmAttendanceMutation.isPending}
								disabled={!hasMarkedStaff || confirmAttendanceMutation.isPending}
								title={!hasMarkedStaff ? 'Please mark attendance for at least one staff member before confirming attendance.' : undefined}
								onClick={() => confirmAttendanceMutation.mutate()}
								className="shrink-0 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Confirm Attendance
							</Button>
						</div>
					);
				}

				return (
					<div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
						<div className="flex items-center gap-3">
							<div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
								<Clock className="w-5 h-5 text-amber-600" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
										Attendance Not Confirmed
									</span>
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100/80 text-amber-800 border border-amber-200">
										Open for edits
									</span>
								</div>
								<p className="text-xs text-amber-700 mt-0.5">
									Attendance and working hours can still be edited.
								</p>
								{!hasMarkedStaff && (
									<p className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-1">
										<AlertCircle className="w-3.5 h-3.5 shrink-0" />
										Please mark attendance for at least one staff member before confirming attendance.
									</p>
								)}
							</div>
						</div>

						{(isOwner || hasPermission('staff_attendance.confirm')) && (
							<Button
								type="button"
								variant="primary"
								size="sm"
								icon={<CheckCircle2 className="w-3.5 h-3.5" />}
								loading={confirmAttendanceMutation.isPending}
								disabled={!hasMarkedStaff || confirmAttendanceMutation.isPending}
								title={!hasMarkedStaff ? 'Please mark attendance for at least one staff member before confirming attendance.' : undefined}
								onClick={() => confirmAttendanceMutation.mutate()}
								className="shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Confirm Attendance
							</Button>
						)}
					</div>
				);
			})()}

			{/* Loading State */}
			{isLoading && (
				<div className="app-card p-12 rounded-2xl shadow-xs text-center w-full">
					<Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
					<p className="text-sm text-on-surface-variant">
						{isRangeActive
							? `Loading attendance history for ${effectiveRange?.from} to ${effectiveRange?.to}...`
							: `Loading attendance for ${selectedDate}...`}
					</p>
				</div>
			)}

			{/* Error State */}
			{isError && (
				<div className="app-card p-8 rounded-2xl shadow-xs border border-red-200 bg-red-50/50 w-full">
					<div className="text-center space-y-2">
						<AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
						<p className="text-sm font-medium text-red-800">Failed to load attendance data</p>
						<p className="text-xs text-red-600">{(errorObj as Error)?.message || 'Unknown error'}</p>
						<Button size="sm" variant="secondary" onClick={() => refetch()}>
							Retry
						</Button>
					</div>
				</div>
			)}

			{/* Mutation Error Toast */}
			{(upsertMutation.isError || deleteMutation.isError) && (
				<div className="app-card p-3 rounded-xl shadow-xs border border-red-200 bg-red-50 flex items-center gap-3 w-full">
					<AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
					<p className="text-xs text-red-800 font-medium">
						{(upsertMutation.error as Error)?.message || (deleteMutation.error as Error)?.message || 'Operation failed'}
					</p>
				</div>
			)}

			{/* ─── UNIFIED ATTENDANCE TABLE ─── */}
			{!isLoading && !isError && (
				<div className="app-card rounded-2xl shadow-xs overflow-hidden w-full">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-outline-variant bg-surface-container-lowest/50">
									{isRangeActive && (
										<th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant">
											<button type="button" onClick={() => handleSort('date')} className="flex items-center gap-1 cursor-pointer hover:text-on-surface">
												Date
												{sortField === 'date' && <ArrowUpDown className="w-3 h-3" />}
											</button>
										</th>
									)}
									<th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant">
										<button type="button" onClick={() => handleSort('name')} className="flex items-center gap-1 cursor-pointer hover:text-on-surface">
											Staff Member
											{sortField === 'name' && <ArrowUpDown className="w-3 h-3" />}
										</button>
									</th>
									<th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant">
										<button type="button" onClick={() => handleSort('role')} className="flex items-center gap-1 cursor-pointer hover:text-on-surface">
											Role
											{sortField === 'role' && <ArrowUpDown className="w-3 h-3" />}
										</button>
									</th>
									<th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant">
										<button type="button" onClick={() => handleSort('status')} className="flex items-center gap-1 cursor-pointer hover:text-on-surface">
											Status
											{sortField === 'status' && <ArrowUpDown className="w-3 h-3" />}
										</button>
									</th>
									<th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant">Working Hours</th>
									<th className="text-right py-3 px-4 text-xs font-semibold text-on-surface-variant">Actions</th>
								</tr>
							</thead>
							<tbody>
								{/* Daily Rows */}
								{!isRangeActive && (
									<>
										{filteredDailyStaff.length === 0 && (
											<tr>
												<td colSpan={5} className="text-center py-12 text-sm text-on-surface-variant">
													<Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
													{searchQuery || statusFilter !== 'All'
														? 'No staff matching the current filters.'
														: 'No staff registered in the directory.'}
												</td>
											</tr>
										)}
										{filteredDailyStaff.map((staff) => (
											<tr key={staff.staffId} className="border-b border-outline-variant/50 hover:bg-surface-container-lowest/30 transition-colors">
												<td className="py-3 px-4">
													<div>
														<div className="font-semibold text-on-surface text-sm">{staff.staffName}</div>
														<div className="text-xs text-on-surface-variant">{staff.staffPhoneNumber}</div>
														<TimeAndNotesRow
															staffId={staff.staffId}
															attendanceDate={staff.attendanceDate}
															checkInTime={staff.checkInTime}
															checkOutTime={staff.checkOutTime}
															notes={staff.notes}
															status={staff.status}
															onMark={handleMark}
															isMarking={isMarking}
															isLocked={isLocked}
														/>
													</div>
												</td>
												<td className="py-3 px-4 text-xs text-on-surface-variant">{staff.staffRole || '—'}</td>
												<td className="py-3 px-4">
													<StatusBadge status={staff.status} />
												</td>
												<td className="py-3 px-4 text-xs text-on-surface-variant">
													{staff.workingHoursFormatted || '—'}
												</td>
												<td className="py-3 px-4 text-right">
													<AttendanceActions
														staffId={staff.staffId}
														attendanceDate={staff.attendanceDate}
														currentStatus={staff.status}
														onMark={(sid, dt, st) => handleMark(sid, dt, st)}
														isMarking={isMarking}
														isLocked={isLocked}
													/>
												</td>
											</tr>
										))}
									</>
								)}

								{/* Range Rows */}
								{isRangeActive && (
									<>
										{filteredRangeRecords.length === 0 && (
											<tr>
												<td colSpan={6} className="text-center py-12 text-sm text-on-surface-variant">
													<CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-300" />
													No attendance records found for this date range.
												</td>
											</tr>
										)}
										{filteredRangeRecords.map((rec) => (
											<tr key={rec.id} className="border-b border-outline-variant/50 hover:bg-surface-container-lowest/30 transition-colors">
												<td className="py-3 px-4 text-xs text-on-surface font-medium whitespace-nowrap">
													{new Date(rec.attendanceDate + 'T00:00:00').toLocaleDateString('en-IN', {
														day: '2-digit',
														month: 'short',
														year: 'numeric',
													})}
												</td>
												<td className="py-3 px-4">
													<div>
														<div className="font-semibold text-on-surface text-sm">{rec.staffName}</div>
														<div className="text-xs text-on-surface-variant">{rec.staffPhoneNumber}</div>
														<TimeAndNotesRow
															staffId={rec.staffId}
															attendanceDate={rec.attendanceDate}
															checkInTime={rec.checkInTime}
															checkOutTime={rec.checkOutTime}
															notes={rec.notes}
															status={rec.status as StaffAttendanceStatus}
															onMark={handleMark}
															isMarking={isMarking}
														/>
													</div>
												</td>
												<td className="py-3 px-4 text-xs text-on-surface-variant">{rec.staffRole || '—'}</td>
												<td className="py-3 px-4">
													<StatusBadge status={rec.status} />
												</td>
												<td className="py-3 px-4 text-xs text-on-surface-variant">
													{rec.workingHoursFormatted || '—'}
												</td>
												<td className="py-3 px-4 text-right">
													<AttendanceActions
														staffId={rec.staffId}
														attendanceDate={rec.attendanceDate}
														currentStatus={rec.status as StaffAttendanceStatus}
														onMark={(sid, dt, st) => handleMark(sid, dt, st)}
														isMarking={isMarking}
													/>
												</td>
											</tr>
										))}
									</>
								)}
							</tbody>
						</table>
					</div>

					{/* Table Footer Summary */}
					<div className="px-4 py-3 border-t border-outline-variant/50 bg-surface-container-lowest/30 flex items-center justify-between text-xs text-on-surface-variant">
						<span>
							{isRangeActive
								? `${filteredRangeRecords.length} of ${rangeData?.totalRecords ?? 0} record(s) from ${effectiveRange?.from} to ${effectiveRange?.to}`
								: `Showing ${filteredDailyStaff.length} of ${dailySummary?.totalActiveStaff ?? 0} staff members`}
						</span>
						{isMarking && (
							<span className="flex items-center gap-1.5 text-blue-600 font-medium">
								<Loader2 className="w-3.5 h-3.5 animate-spin" />
								Saving...
							</span>
						)}
					</div>
				</div>
			)}

			{/* ── MODAL: OWNER UNLOCK ATTENDANCE CONFIRMATION (Showroom pattern) ── */}
			{showUnlockModal && (
				<Dialog
					open={showUnlockModal}
					onOpenChange={(open) => {
						if (!open && !unlockAttendanceMutation.isPending) {
							setShowUnlockModal(false);
						}
					}}
					title="Unlock Daily Attendance"
					description="Owner administrative correction workflow for confirmed staff attendance."
					size="sm"
				>
					<div className="space-y-4 pt-2">
						<div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
							<AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
							<div>
								<p className="font-semibold">
									Attendance is currently confirmed for {formatDateHeading(selectedDate)}.
								</p>
								<p className="text-amber-800 mt-1">
									Unlocking it will activate <strong>Administrative Correction Mode</strong>, allowing attendance statuses, working hours, and notes to be modified.
								</p>
								<p className="text-amber-800 mt-1 font-medium">
									Attendance must be confirmed again once your corrections are complete.
								</p>
							</div>
						</div>

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setShowUnlockModal(false)}
								disabled={unlockAttendanceMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="primary"
								loading={unlockAttendanceMutation.isPending}
								onClick={() => unlockAttendanceMutation.mutate()}
								className="bg-purple-700 hover:bg-purple-800"
								icon={<Unlock className="w-3.5 h-3.5" />}
							>
								Unlock Attendance
							</Button>
						</div>
					</div>
				</Dialog>
			)}
		</>
	)}
</div>
	);
}

export default AttendancePage;
