import { useState, useMemo } from 'react';
import {
	Calendar,
	Search,
	Users,
	ChevronLeft,
	ChevronRight,
	Clock,
	Eye,
	X,
	Loader2,
	StickyNote,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import {
	getMonthlyAttendanceReport,
	getStaffList,
	type MonthlyStaffAttendanceItemDto,
} from '../../lib/api';

function SummaryCard({ label, count, color }: { label: string; count: number | string; color: string }) {
	return (
		<div className="app-card p-4 rounded-xl shadow-xs flex flex-col gap-1">
			<span className="text-xs text-on-surface-variant font-medium">{label}</span>
			<div className="flex items-end gap-2">
				<span className={`text-2xl font-bold ${color}`}>{count}</span>
			</div>
		</div>
	);
}

const STATUS_PILL_CONFIG: Record<string, { label: string; code: string; color: string; bg: string; border: string }> = {
	Present: { label: 'Present', code: 'P', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
	HalfDay: { label: 'Half Day', code: 'H', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' },
	Leave: { label: 'Leave', code: 'L', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' },
	Unmarked: { label: 'Unmarked', code: 'U', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-300' },
};

export function MonthlyAttendanceReportTab() {
	// Date state: month and year
	const [reportYear, setReportYear] = useState(() => new Date().getFullYear());
	const [reportMonth, setReportMonth] = useState(() => new Date().getMonth() + 1);

	// Filters
	const [monthlySearch, setMonthlySearch] = useState('');
	const [monthlyStaffFilter, setMonthlyStaffFilter] = useState('');
	const [monthlyStatusFilter, setMonthlyStatusFilter] = useState('All');

	// Staff Details Dialog
	const [selectedDetailStaff, setSelectedDetailStaff] = useState<MonthlyStaffAttendanceItemDto | null>(null);

	const monthName = useMemo(() => {
		const dt = new Date(reportYear, reportMonth - 1, 1);
		return dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
	}, [reportYear, reportMonth]);

	const handlePrevMonth = () => {
		if (reportMonth === 1) {
			setReportMonth(12);
			setReportYear((y) => y - 1);
		} else {
			setReportMonth((m) => m - 1);
		}
	};

	const handleNextMonth = () => {
		if (reportMonth === 12) {
			setReportMonth(1);
			setReportYear((y) => y + 1);
		} else {
			setReportMonth((m) => m + 1);
		}
	};

	// Query active staff list for dropdown
	const { data: staffList = [] } = useQuery({
		queryKey: ['staff-list-options'],
		queryFn: async () => {
			try {
				return await getStaffList();
			} catch {
				return [];
			}
		},
	});

	// Query monthly report
	const {
		data: reportData,
		isLoading,
		isError,
		error,
		refetch,
	} = useQuery({
		queryKey: ['staff-attendance-monthly', reportYear, reportMonth, monthlyStaffFilter, monthlyStatusFilter, monthlySearch],
		queryFn: () =>
			getMonthlyAttendanceReport({
				year: reportYear,
				month: reportMonth,
				staffId: monthlyStaffFilter || undefined,
				status: monthlyStatusFilter !== 'All' ? monthlyStatusFilter : undefined,
				search: monthlySearch.trim() || undefined,
			}),
	});

	const staffItems = reportData?.staff ?? [];

	return (
		<div className="space-y-6 w-full animate-fade-in">
			{/* ─── KPI SUMMARY CARDS ─── */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
				<SummaryCard
					label="Staff Members"
					count={reportData?.staffCount ?? 0}
					color="text-slate-700"
				/>
				<SummaryCard
					label="Present Records"
					count={reportData?.summary.present ?? 0}
					color="text-emerald-600"
				/>
				<SummaryCard
					label="Half Day Records"
					count={reportData?.summary.halfDay ?? 0}
					color="text-amber-600"
				/>
				<SummaryCard
					label="Leave Records"
					count={reportData?.summary.leave ?? 0}
					color="text-red-600"
				/>
			</div>

			{/* ─── FILTER BAR ─── */}
			<div className="app-card p-4 rounded-2xl shadow-xs w-full">
				<div className="flex flex-wrap items-end gap-3.5">
					{/* 1. Month Selector */}
					<div>
						<label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
							Salary / Report Month
						</label>
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								aria-label="Previous Month"
								onClick={handlePrevMonth}
								className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low text-on-surface-variant transition-colors cursor-pointer"
								title="Previous Month"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>

							<div className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest">
								<Calendar className="w-4 h-4 text-blue-600 pointer-events-none" />
								<span className="text-xs font-semibold text-on-surface min-w-[130px] text-center select-none">
									{monthName}
								</span>
								<input
									type="month"
									aria-label="Select Month and Year"
									value={`${reportYear}-${String(reportMonth).padStart(2, '0')}`}
									onChange={(e) => {
										if (!e.target.value) return;
										const [y, m] = e.target.value.split('-').map(Number);
										if (y && m) {
											setReportYear(y);
											setReportMonth(m);
										}
									}}
									className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
									title="Click to select month and year"
								/>
							</div>

							<button
								type="button"
								aria-label="Next Month"
								onClick={handleNextMonth}
								className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low text-on-surface-variant transition-colors cursor-pointer"
								title="Next Month"
							>
								<ChevronRight className="w-4 h-4" />
							</button>
						</div>
					</div>

					{/* 2. Search */}
					<div className="flex-1 min-w-[200px]">
						<label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
							Search
						</label>
						<div className="relative">
							<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
							<input
								type="text"
								placeholder="Search staff by name or role..."
								value={monthlySearch}
								onChange={(e) => setMonthlySearch(e.target.value)}
								className="form-input pl-9 text-xs w-full py-1.5"
							/>
							{monthlySearch && (
								<button
									type="button"
									onClick={() => setMonthlySearch('')}
									className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer"
								>
									<X className="w-3.5 h-3.5" />
								</button>
							)}
						</div>
					</div>

					{/* 3. Staff Dropdown */}
					<div className="min-w-[180px]">
						<label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
							Staff Member
						</label>
						<select
							aria-label="Filter by Staff Member"
							value={monthlyStaffFilter}
							onChange={(e) => setMonthlyStaffFilter(e.target.value)}
							className="form-select text-xs w-full py-1.5"
						>
							<option value="">All Staff Members</option>
							{staffList
								.filter((s) => s.isActive)
								.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name} ({s.role || 'Staff'})
									</option>
								))}
						</select>
					</div>

					{/* 4. Status Dropdown */}
					<div className="min-w-[140px]">
						<label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
							Status
						</label>
						<select
							aria-label="Filter by Status"
							value={monthlyStatusFilter}
							onChange={(e) => setMonthlyStatusFilter(e.target.value)}
							className="form-select text-xs w-full py-1.5"
						>
							<option value="All">All Status</option>
							<option value="Present">Present</option>
							<option value="HalfDay">Half Day</option>
							<option value="Leave">Leave</option>
							<option value="Unmarked">Unmarked</option>
						</select>
					</div>
				</div>
			</div>

			{/* ─── LOADING / ERROR / TABLE ─── */}
			{isLoading ? (
				<div className="app-card p-12 rounded-2xl shadow-xs text-center">
					<Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
					<p className="text-sm font-medium text-on-surface">Loading monthly attendance report...</p>
					<p className="text-xs text-on-surface-variant mt-1">Calculating attendance totals for {monthName}</p>
				</div>
			) : isError ? (
				<div className="app-card p-8 rounded-2xl shadow-xs text-center border-red-200 bg-red-50/50">
					<p className="text-sm font-semibold text-red-700">Failed to load monthly attendance report.</p>
					<p className="text-xs text-red-600 mt-1">{(error as Error)?.message || 'An unexpected error occurred.'}</p>
					<Button variant="secondary" size="sm" onClick={() => refetch()} className="mt-4">
						Try Again
					</Button>
				</div>
			) : staffItems.length === 0 ? (
				<div className="app-card p-12 rounded-2xl shadow-xs text-center">
					<Users className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-3" />
					<p className="text-sm font-medium text-on-surface">No staff attendance records found</p>
					<p className="text-xs text-on-surface-variant mt-1">
						No active staff members match the selected filters for {monthName}.
					</p>
				</div>
			) : (
				<div className="app-card rounded-2xl shadow-xs overflow-hidden border border-outline-variant/60">
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse text-xs">
							<thead>
								<tr className="border-b border-outline-variant/80 bg-surface-container-low/60 text-on-surface-variant font-semibold">
									<th className="py-3 px-4">Staff Member</th>
									<th className="py-3 px-4">Role</th>
									<th className="py-3 px-4 text-center">Present</th>
									<th className="py-3 px-4 text-center">Half Day</th>
									<th className="py-3 px-4 text-center">Leave</th>
									<th className="py-3 px-4 text-center">Unmarked</th>
									<th className="py-3 px-4 text-center">Attendance Days</th>
									<th className="py-3 px-4 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-outline-variant/40">
								{staffItems.map((item) => {
									const initials = item.name
										.split(' ')
										.map((n) => n[0])
										.join('')
										.substring(0, 2)
										.toUpperCase();

									return (
										<tr
											key={item.staffId}
											className="hover:bg-surface-container-low/40 transition-colors"
										>
											{/* 1. Staff Member */}
											<td className="py-3.5 px-4">
												<div className="flex items-center gap-3">
													<div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200">
														{initials}
													</div>
													<div>
														<div className="font-semibold text-on-surface text-sm">{item.name}</div>
														<div className="text-xs text-on-surface-variant">{item.phoneNumber}</div>
													</div>
												</div>
											</td>

											{/* 2. Role */}
											<td className="py-3.5 px-4 text-on-surface">
												<span className="px-2 py-0.5 rounded-md bg-surface-container text-xs font-medium text-on-surface-variant">
													{item.role || 'Staff'}
												</span>
											</td>

											{/* 3. Present */}
											<td className="py-3.5 px-4 text-center">
												<span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
													{item.presentDays}
												</span>
											</td>

											{/* 4. Half Day */}
											<td className="py-3.5 px-4 text-center">
												<span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
													{item.halfDays}
												</span>
											</td>

											{/* 5. Leave */}
											<td className="py-3.5 px-4 text-center">
												<span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
													{item.leaveDays}
												</span>
											</td>

											{/* 6. Unmarked */}
											<td className="py-3.5 px-4 text-center">
												<span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
													{item.unmarkedDays}
												</span>
											</td>

											{/* 7. Attendance Days (Present + Half Day) */}
											<td className="py-3.5 px-4 text-center font-bold text-sm text-on-surface">
												<span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
													{item.attendanceDays}
												</span>
											</td>

											{/* 8. Actions */}
											<td className="py-3.5 px-4 text-right">
												<Button
													variant="secondary"
													size="sm"
													onClick={() => setSelectedDetailStaff(item)}
													icon={<Eye className="w-3.5 h-3.5" />}
												>
													View Details
												</Button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{/* Table Footer */}
					<div className="px-4 py-3 border-t border-outline-variant/50 bg-surface-container-lowest/30 flex items-center justify-between text-xs text-on-surface-variant">
						<span>
							Showing {staffItems.length} staff member(s) for {monthName}
						</span>
						<span className="text-[11px] text-on-surface-variant/80">
							Total calendar days in month: {reportData?.totalCalendarDays ?? 0}
						</span>
					</div>
				</div>
			)}

			{/* ─── STAFF DETAIL DIALOG ─── */}
			{selectedDetailStaff && (
				<Dialog
					open={Boolean(selectedDetailStaff)}
					onOpenChange={(open) => {
						if (!open) setSelectedDetailStaff(null);
					}}
					title="Staff Monthly Attendance Details"
					description={`${selectedDetailStaff.name} • ${selectedDetailStaff.role || 'Staff'} • ${monthName}`}
					size="xl"
				>
					<div className="space-y-5 pt-2">
						{/* Summary Stats Row */}
						<div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
							<div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col items-center justify-center text-center">
								<span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Present</span>
								<span className="text-xl font-bold text-emerald-700 mt-0.5">{selectedDetailStaff.presentDays} days</span>
							</div>
							<div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col items-center justify-center text-center">
								<span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Half Day</span>
								<span className="text-xl font-bold text-amber-700 mt-0.5">{selectedDetailStaff.halfDays} days</span>
							</div>
							<div className="p-3 rounded-xl bg-red-50/70 border border-red-200 flex flex-col items-center justify-center text-center">
								<span className="text-[11px] font-semibold text-red-800 uppercase tracking-wider">Leave</span>
								<span className="text-xl font-bold text-red-700 mt-0.5">{selectedDetailStaff.leaveDays} days</span>
							</div>
							<div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center">
								<span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Unmarked</span>
								<span className="text-xl font-bold text-slate-600 mt-0.5">{selectedDetailStaff.unmarkedDays} days</span>
							</div>
							<div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col items-center justify-center text-center">
								<span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Attendance Days</span>
								<span className="text-xl font-bold text-blue-700 mt-0.5">{selectedDetailStaff.attendanceDays} days</span>
							</div>
						</div>

						{/* Legend */}
						<div className="flex items-center gap-4 text-xs text-on-surface-variant px-1 border-b border-outline-variant/60 pb-3">
							<span className="font-semibold text-on-surface">Legend:</span>
							<span className="flex items-center gap-1.5">
								<span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] border border-emerald-300">
									P
								</span>
								Present
							</span>
							<span className="flex items-center gap-1.5">
								<span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px] border border-amber-300">
									H
								</span>
								Half Day
							</span>
							<span className="flex items-center gap-1.5">
								<span className="w-5 h-5 rounded-md bg-red-100 text-red-800 font-bold flex items-center justify-center text-[10px] border border-red-300">
									L
								</span>
								Leave
							</span>
							<span className="flex items-center gap-1.5">
								<span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px] border border-slate-300">
									U
								</span>
								Unmarked
							</span>
						</div>

						{/* Daily Calendar / Grid for the month */}
						<div>
							<h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider mb-2.5">
								Daily Attendance Breakdown ({monthName})
							</h3>
							<div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2">
								{selectedDetailStaff.dailyRecords.map((dayRec) => {
									const pill = STATUS_PILL_CONFIG[dayRec.status] || STATUS_PILL_CONFIG.Unmarked;
									return (
										<div
											key={dayRec.date}
											className={`p-2 rounded-xl border flex flex-col justify-between transition-all ${pill.bg} ${pill.border}`}
										>
											<div className="flex items-center justify-between mb-1">
												<span className="font-bold text-xs text-on-surface">Day {dayRec.day}</span>
												<span className="text-[10px] font-medium text-on-surface-variant uppercase">{dayRec.dayOfWeek}</span>
											</div>

											{/* Explicit letter code and label for color-independent accessibility */}
											<div className="flex items-center gap-1.5 mt-1">
												<span
													className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] border ${pill.bg} ${pill.color} ${pill.border}`}
												>
													{pill.code}
												</span>
												<span className={`text-[11px] font-semibold ${pill.color}`}>
													{pill.label}
												</span>
											</div>

											{/* Time or Notes if recorded */}
											{(dayRec.checkInTime || dayRec.checkOutTime || dayRec.notes) && (
												<div className="mt-1.5 pt-1.5 border-t border-black/5 text-[10px] text-on-surface-variant flex flex-col gap-0.5">
													{dayRec.checkInTime && (
														<span className="flex items-center gap-1">
															<Clock className="w-2.5 h-2.5" />
															{dayRec.checkInTime} {dayRec.checkOutTime ? `- ${dayRec.checkOutTime}` : ''}
														</span>
													)}
													{dayRec.notes && (
														<span className="flex items-center gap-1 truncate" title={dayRec.notes}>
															<StickyNote className="w-2.5 h-2.5" />
															{dayRec.notes}
														</span>
													)}
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>

						{/* Dialog Footer */}
						<div className="flex items-center justify-end pt-3 border-t border-outline-variant/60">
							<Button variant="secondary" onClick={() => setSelectedDetailStaff(null)}>
								Close
							</Button>
						</div>
					</div>
				</Dialog>
			)}
		</div>
	);
}
