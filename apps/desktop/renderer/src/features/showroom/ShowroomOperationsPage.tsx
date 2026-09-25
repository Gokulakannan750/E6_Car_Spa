import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	Building2,
	Calendar,
	Users,
	UserPlus,
	Clock,
	ChevronLeft,
	ChevronRight,
	ChevronDown,
	ChevronUp,
	AlertCircle,
	ArrowLeft,
	MapPin,
	CalendarCheck,
	Plus,
	Edit2,
	Wrench,
	Car,
	ClipboardList,
	FileSpreadsheet,
	Activity,
	ArrowRightLeft,
	LogOut,
	Receipt,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { SearchInput } from '../../components/ui/SearchInput';
import { useAuth } from '../auth/auth-context';
import {
	getShowrooms,
	getStaffList,
	getDailyStaff,
	getShowroomVehicleTypes,
	getShowroomWorkTypes,
	getShowroomWorkSessions,
	getShowroomVehicleWorks,
	getShowroomOperationsSummary,
	createBatchShowroomVehicleWork,
	updateShowroomVehicleWork,
	createShowroomWorkSession,
	updateShowroomWorkSession,
	closeShowroomWorkSession,
	type StaffDto,
	type ShowroomStaffWorkSessionDto,
	type ShowroomVehicleWorkDto,
	type ShowroomStaffSessionType,
} from '../../lib/api';

// ── Date Formatting Utilities ───────────────────────────────────────────────

function getTodayStr(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function getCurrentTimeStr(): string {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
}

function addDays(dateStr: string, days: number): string {
	const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
	const parts = cleanDate.split('-').map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) return getTodayStr();
	const [year, month, day] = parts;
	const dt = new Date(year, month - 1, day + days);
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function formatDateHeading(dateStr: string): string {
	if (!dateStr) return '';
	const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
	const parts = cleanDate.split('-').map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
	const [year, month, day] = parts;
	const dt = new Date(year, month - 1, day);
	return dt.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
}

function formatDisplayTime(timeStr?: string | null): string {
	if (!timeStr) return '—';
	const [hoursStr, minsStr] = timeStr.split(':');
	const hours = parseInt(hoursStr, 10);
	const mins = parseInt(minsStr, 10);
	if (isNaN(hours) || isNaN(mins)) return timeStr;
	const ampm = hours >= 12 ? 'PM' : 'AM';
	const h = hours % 12 || 12;
	return `${h}:${String(mins).padStart(2, '0')} ${ampm}`;
}

export function ShowroomOperationsPage() {
	const qc = useQueryClient();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { isOwner, hasPermission } = useAuth();

	// Granular Permissions
	const canManage = Boolean(
		isOwner ||
		hasPermission('showroom.manage') ||
		hasPermission('showrooms.manage') ||
		hasPermission('showroom.view') ||
		hasPermission('showrooms.view') ||
		hasPermission('*')
	);
	// Read selected showroom, date, and active tab from URL query parameters
	const activeShowroomId = searchParams.get('showroomId') || '';
	const urlDate = searchParams.get('date');
	const activeTab = searchParams.get('tab') || 'vehicle-work'; // 'vehicle-work' | 'sessions' | 'history'

	// Daily date (YYYY-MM-DD)
	const [selectedDate, setSelectedDate] = useState<string>(urlDate || getTodayStr);

	// Sync date state when URL parameter changes
	useEffect(() => {
		if (urlDate && urlDate !== selectedDate) {
			setSelectedDate(urlDate);
		}
	}, [urlDate]);

	// Search filter for Showroom Directory landing state
	const [showroomFilter, setShowroomFilter] = useState('');

	// ── Modal States ──────────────────────────────────────────────────────────
	// 1. Add / Edit Vehicle Work
	const [showVehicleWorkModal, setShowVehicleWorkModal] = useState(false);
	const [editingVehicleWork, setEditingVehicleWork] = useState<ShowroomVehicleWorkDto | null>(null);
	const [vwStaffId, setVwStaffId] = useState('');
	const [vwSessionId, setVwSessionId] = useState('');
	const [vwVehicleCountInput, setVwVehicleCountInput] = useState<string>('1');
	const [vwVehicles, setVwVehicles] = useState<Array<{ vehicleTypeId: string; selectedWorkTypeIds: string[] }>>([
		{ vehicleTypeId: '', selectedWorkTypeIds: [] },
	]);
	const [expandedVehicles, setExpandedVehicles] = useState<Record<number, boolean>>({ 0: true });
	const [vwNotes, setVwNotes] = useState('');
	const [vwFormError, setVwFormError] = useState('');

	const handleVehicleCountChange = (rawVal: string) => {
		// Always update the input's raw string state so the user can freely backspace / type
		setVwVehicleCountInput(rawVal);

		const trimmed = rawVal.trim();
		if (!trimmed) {
			// Empty string: temporarily keep vehicle detail sections rather than destroying data
			return;
		}

		// Only accept positive integers
		if (!/^\d+$/.test(trimmed)) {
			return;
		}

		const count = parseInt(trimmed, 10);
		if (isNaN(count) || count < 1 || count > 9999) {
			return;
		}

		// Synchronize vehicle details with the new valid count
		setVwVehicles((prev) => {
			if (prev.length === count) return prev;
			if (prev.length > count) {
				return prev.slice(0, count);
			}
			const newEntries = [...prev];
			while (newEntries.length < count) {
				newEntries.push({ vehicleTypeId: '', selectedWorkTypeIds: [] });
			}
			return newEntries;
		});

		// Synchronize collapsible states (existing preserved, newly added collapsed)
		setExpandedVehicles((prev) => {
			const next: Record<number, boolean> = {};
			for (let i = 0; i < count; i++) {
				if (i in prev) {
					next[i] = prev[i];
				} else {
					next[i] = i === 0;
				}
			}
			return next;
		});
	};

	const handleToggleVehicleCollapse = (index: number) => {
		setExpandedVehicles((prev) => ({
			...prev,
			[index]: !(prev[index] ?? (index === 0)),
		}));
	};

	const handleVehicleTypeChange = (index: number, vehicleTypeId: string) => {
		setVwVehicles((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], vehicleTypeId };
			return next;
		});
	};

	const handleToggleVehicleService = (vehicleIndex: number, workTypeId: string) => {
		setVwVehicles((prev) => {
			const next = [...prev];
			const currentIds = next[vehicleIndex]?.selectedWorkTypeIds || [];
			const exists = currentIds.includes(workTypeId);
			const updatedIds = exists
				? currentIds.filter((id) => id !== workTypeId)
				: [...currentIds, workTypeId];
			next[vehicleIndex] = { ...next[vehicleIndex], selectedWorkTypeIds: updatedIds };
			return next;
		});
	};

	// 2. Start / Edit Staff Session
	const [showSessionModal, setShowSessionModal] = useState(false);
	const [editingSession, setEditingSession] = useState<ShowroomStaffWorkSessionDto | null>(null);
	const [sessStaffId, setSessStaffId] = useState('');
	const [sessType, setSessType] = useState<ShowroomStaffSessionType>('FullDay');
	const [sessAttendanceStatus, setSessAttendanceStatus] = useState('Present');
	const [sessStartTime, setSessStartTime] = useState('09:00');
	const [sessEndTime, setSessEndTime] = useState('');
	const [sessTransferReason, setSessTransferReason] = useState('');
	const [sessNotes, setSessNotes] = useState('');
	const [sessFormError, setSessFormError] = useState('');

	// 3. Close Session Modal
	const [closingSession, setClosingSession] = useState<ShowroomStaffWorkSessionDto | null>(null);
	const [closeEndTime, setCloseEndTime] = useState(getCurrentTimeStr);
	const [closeNotes, setCloseNotes] = useState('');
	const [closeError, setCloseError] = useState('');

	// Filter state for Vehicle Work table
	const [vwStaffFilter, setVwStaffFilter] = useState<string>('all');
	const [vwVehicleTypeFilter, setVwVehicleTypeFilter] = useState<string>('all');

	// ── Queries ───────────────────────────────────────────────────────────────
	const { data: showrooms = [], isLoading: showroomsLoading } = useQuery({
		queryKey: ['showrooms'],
		queryFn: () => getShowrooms(),
	});

	const selectedShowroom = useMemo(() => {
		if (!activeShowroomId) return null;
		return showrooms.find((s) => s.id === activeShowroomId) || null;
	}, [showrooms, activeShowroomId]);

	const { data: vehicleTypes = [] } = useQuery({
		queryKey: ['showroom-vehicle-types'],
		queryFn: () => getShowroomVehicleTypes(false),
	});

	const { data: workTypes = [], isLoading: workTypesLoading } = useQuery({
		queryKey: ['showroom-work-types'],
		queryFn: () => getShowroomWorkTypes(false),
	});

	const { data: staffList = [] } = useQuery({
		queryKey: ['staff-list'],
		queryFn: () => getStaffList(),
	});

	const activeStaffMembers = useMemo(() => {
		return (staffList as StaffDto[]).filter((s) => s.isActive);
	}, [staffList]);

	// Fetch daily staff attendance for selected showroom and date (source of truth for vehicle work staff)
	const { data: dailyStaffData } = useQuery({
		queryKey: ['daily-staff', selectedShowroom?.id, selectedDate],
		queryFn: () => {
			if (!selectedShowroom) return null;
			return getDailyStaff(selectedShowroom.id, selectedDate);
		},
		enabled: !!selectedShowroom,
	});

	const eligibleAttendanceStaff = useMemo(() => {
		const rawAssignments = dailyStaffData?.staffAssignments || [];
		const isToday = selectedDate === getTodayStr();
		const nowTime = getCurrentTimeStr();

		return rawAssignments.filter((s) => {
			// Exclude staff with non-working status
			if (s.status === 'Leave' || s.status === 'Absent') {
				return false;
			}

			// If viewing today's operational log, filter by active working hours
			if (isToday) {
				if (s.startTime && nowTime < s.startTime) {
					return false;
				}
				if (s.endTime && nowTime >= s.endTime) {
					return false;
				}
			}

			return true;
		});
	}, [dailyStaffData, selectedDate]);

	// List of staff to display in Log / Edit Vehicle Work dropdown
	const displayStaffList = useMemo(() => {
		if (editingVehicleWork && !eligibleAttendanceStaff.some((s) => s.staffId === editingVehicleWork.staffId)) {
			return [
				...eligibleAttendanceStaff,
				{
					id: 'edit-staff',
					showroomId: editingVehicleWork.showroomId,
					showroomName: editingVehicleWork.showroomName,
					staffId: editingVehicleWork.staffId,
					staffMasterId: editingVehicleWork.staffMasterId,
					staffName: editingVehicleWork.staffName,
					staffPhone: '',
					staffRole: 'Technician',
					date: editingVehicleWork.date,
					vehiclesAttended: 0,
					createdAt: '',
				},
			];
		}
		return eligibleAttendanceStaff;
	}, [eligibleAttendanceStaff, editingVehicleWork]);

	// Clear invalid/ineligible staff selection when date or showroom changes
	useEffect(() => {
		if (vwStaffId && !editingVehicleWork) {
			const isStillEligible = eligibleAttendanceStaff.some((s) => s.staffId === vwStaffId);
			if (!isStillEligible) {
				setVwStaffId('');
			}
		}
	}, [eligibleAttendanceStaff, vwStaffId, editingVehicleWork]);

	// Fetch daily vehicle works for selected showroom and date
	const { data: vehicleWorks = [], isLoading: vehicleWorksLoading } = useQuery({
		queryKey: ['showroom-vehicle-works', selectedShowroom?.id, selectedDate],
		queryFn: () => {
			if (!selectedShowroom) return [];
			return getShowroomVehicleWorks(selectedShowroom.id, { date: selectedDate });
		},
		enabled: !!selectedShowroom,
	});

	// Fetch daily staff work sessions for selected showroom and date
	const { data: workSessions = [], isLoading: workSessionsLoading } = useQuery({
		queryKey: ['showroom-work-sessions', selectedShowroom?.id, selectedDate],
		queryFn: () => {
			if (!selectedShowroom) return [];
			return getShowroomWorkSessions(selectedShowroom.id, { date: selectedDate });
		},
		enabled: !!selectedShowroom,
	});

	// Fetch daily operations summary
	const { data: opsSummary, isLoading: summaryLoading } = useQuery({
		queryKey: ['showroom-operations-summary', selectedShowroom?.id, selectedDate],
		queryFn: () => {
			if (!selectedShowroom) return null;
			return getShowroomOperationsSummary(selectedShowroom.id, selectedDate);
		},
		enabled: !!selectedShowroom,
	});

	// ── Mutations ─────────────────────────────────────────────────────────────

	// 1. Create / Update Vehicle Work
	const saveVehicleWorkMutation = useMutation({
		mutationFn: async () => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			if (!vwStaffId) throw new Error('Please select a staff member.');

			const trimmedCount = vwVehicleCountInput.trim();
			if (!trimmedCount) {
				throw new Error('Vehicle Count is required.');
			}

			if (!/^\d+$/.test(trimmedCount)) {
				throw new Error('Vehicle Count must be a valid whole number.');
			}

			const parsedCount = parseInt(trimmedCount, 10);
			if (isNaN(parsedCount) || parsedCount < 1) {
				throw new Error('Vehicle Count must be at least 1.');
			}

			if (parsedCount > 9999) {
				throw new Error('Vehicle Count cannot exceed 9999.');
			}

			if (vwVehicles.length === 0) {
				throw new Error('Vehicle Count must be at least 1.');
			}

			// Validate each individual vehicle and auto-expand first invalid vehicle
			for (let i = 0; i < vwVehicles.length; i++) {
				const v = vwVehicles[i];
				const vehicleNum = i + 1;
				if (!v.vehicleTypeId) {
					setExpandedVehicles((prev) => ({ ...prev, [i]: true }));
					throw new Error(`Vehicle ${vehicleNum}: Vehicle Type is required.`);
				}
				if (!v.selectedWorkTypeIds || v.selectedWorkTypeIds.length === 0) {
					setExpandedVehicles((prev) => ({ ...prev, [i]: true }));
					throw new Error(`Vehicle ${vehicleNum}: Select at least one service / work type.`);
				}
			}

			if (editingVehicleWork) {
				const singleVehicle = vwVehicles[0];
				return updateShowroomVehicleWork(selectedShowroom.id, editingVehicleWork.id, {
					staffId: vwStaffId,
					vehicleTypeId: singleVehicle.vehicleTypeId,
					showroomStaffWorkSessionId: vwSessionId || null,
					vehicleQuantity: 1,
					date: selectedDate,
					timeRecorded: null,
					notes: vwNotes || null,
					serviceItems: singleVehicle.selectedWorkTypeIds.map((workTypeId) => ({
						workTypeId,
						quantity: 1,
					})),
				});
			} else {
				return createBatchShowroomVehicleWork(selectedShowroom.id, {
					staffId: vwStaffId,
					showroomStaffWorkSessionId: vwSessionId || null,
					date: selectedDate,
					timeRecorded: null,
					notes: vwNotes || null,
					vehicles: vwVehicles.map((v) => ({
						vehicleTypeId: v.vehicleTypeId,
						workTypeIds: v.selectedWorkTypeIds,
					})),
				});
			}
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showroom-vehicle-works', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroom-operations-summary', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroom-work-sessions', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			setShowVehicleWorkModal(false);
			resetVehicleWorkForm();
		},
		onError: (err: any) => {
			setVwFormError(err.message || 'Failed to save vehicle work record.');
		},
	});

	// 2. Create / Update Staff Work Session
	const saveSessionMutation = useMutation({
		mutationFn: async () => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			if (!sessStaffId) throw new Error('Please select a staff member.');

			if (editingSession) {
				return updateShowroomWorkSession(selectedShowroom.id, editingSession.id, {
					sessionType: sessType,
					attendanceStatus: sessAttendanceStatus,
					startTime: sessStartTime || null,
					endTime: sessEndTime || null,
					transferReason: sessTransferReason || null,
					notes: sessNotes || null,
				});
			} else {
				const staff = staffList.find((s) => s.id === sessStaffId);
				return createShowroomWorkSession(selectedShowroom.id, {
					staffId: sessStaffId,
					homeShowroomId: staff?.defaultShowroomId || null,
					date: selectedDate,
					sessionType: sessType,
					attendanceStatus: sessAttendanceStatus,
					startTime: sessStartTime || null,
					endTime: sessEndTime || null,
					transferReason: sessTransferReason || null,
					notes: sessNotes || null,
				});
			}
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showroom-work-sessions', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroom-operations-summary', selectedShowroom?.id, selectedDate] });
			setShowSessionModal(false);
			resetSessionForm();
		},
		onError: (err: any) => {
			setSessFormError(err.message || 'Failed to save staff work session.');
		},
	});

	// 3. Close Staff Work Session
	const closeSessionMutation = useMutation({
		mutationFn: async () => {
			if (!selectedShowroom || !closingSession) throw new Error('No session selected');
			return closeShowroomWorkSession(selectedShowroom.id, closingSession.id, {
				endTime: closeEndTime || getCurrentTimeStr(),
				notes: closeNotes || undefined,
			});
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showroom-work-sessions', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroom-operations-summary', selectedShowroom?.id, selectedDate] });
			setClosingSession(null);
			setCloseNotes('');
			setCloseError('');
		},
		onError: (err: any) => {
			setCloseError(err.message || 'Failed to close work session.');
		},
	});

	// ── Form Helpers ──────────────────────────────────────────────────────────

	const resetVehicleWorkForm = () => {
		setEditingVehicleWork(null);
		setVwStaffId('');
		setVwSessionId('');
		setVwVehicleCountInput('1');
		setVwVehicles([{ vehicleTypeId: '', selectedWorkTypeIds: [] }]);
		setExpandedVehicles({ 0: true });
		setVwNotes('');
		setVwFormError('');
	};

	const openAddVehicleWorkModal = () => {
		resetVehicleWorkForm();
		setShowVehicleWorkModal(true);
	};

	const openEditVehicleWorkModal = (work: ShowroomVehicleWorkDto) => {
		setEditingVehicleWork(work);
		setVwStaffId(work.staffId);
		setVwSessionId(work.showroomStaffWorkSessionId || '');
		setVwVehicleCountInput('1');
		setVwVehicles([
			{
				vehicleTypeId: work.vehicleTypeId,
				selectedWorkTypeIds: work.serviceItems.map((si) => si.workTypeId),
			},
		]);
		setExpandedVehicles({ 0: true });
		setVwNotes(work.notes || '');
		setVwFormError('');
		setShowVehicleWorkModal(true);
	};

	const resetSessionForm = () => {
		setEditingSession(null);
		setSessStaffId('');
		setSessType('FullDay');
		setSessAttendanceStatus('Present');
		setSessStartTime('09:00');
		setSessEndTime('');
		setSessTransferReason('');
		setSessNotes('');
		setSessFormError('');
	};

	const openStartSessionModal = () => {
		resetSessionForm();
		setShowSessionModal(true);
	};

	const openEditSessionModal = (session: ShowroomStaffWorkSessionDto) => {
		setEditingSession(session);
		setSessStaffId(session.staffId);
		setSessType(session.sessionType);
		setSessAttendanceStatus(session.attendanceStatus);
		setSessStartTime(session.startTime || '09:00');
		setSessEndTime(session.endTime || '');
		setSessTransferReason(session.transferReason || '');
		setSessNotes(session.notes || '');
		setSessFormError('');
		setShowSessionModal(true);
	};

	// ── Handlers ──────────────────────────────────────────────────────────────

	const handleShowroomSelect = (srId: string) => {
		if (srId) {
			setSearchParams({ showroomId: srId, date: selectedDate, tab: activeTab });
		} else {
			setSearchParams({});
		}
	};

	const handleDateChange = (newDate: string) => {
		setSelectedDate(newDate);
		if (activeShowroomId) {
			setSearchParams({ showroomId: activeShowroomId, date: newDate, tab: activeTab });
		}
	};

	const handleTabChange = (tab: string) => {
		if (activeShowroomId) {
			setSearchParams({ showroomId: activeShowroomId, date: selectedDate, tab });
		}
	};

	// Filtered showrooms for landing state
	const filteredShowrooms = useMemo(() => {
		if (!showroomFilter.trim()) return showrooms;
		const query = showroomFilter.toLowerCase();
		return showrooms.filter(
			(s) =>
				s.name.toLowerCase().includes(query) ||
				(s.masterId && s.masterId.toLowerCase().includes(query)) ||
				s.address.toLowerCase().includes(query)
		);
	}, [showrooms, showroomFilter]);

	// Filtered vehicle works
	const filteredVehicleWorks = useMemo(() => {
		return vehicleWorks.filter((work) => {
			if (vwStaffFilter !== 'all' && work.staffId !== vwStaffFilter) return false;
			if (vwVehicleTypeFilter !== 'all' && work.vehicleTypeId !== vwVehicleTypeFilter) return false;
			return true;
		});
	}, [vehicleWorks, vwStaffFilter, vwVehicleTypeFilter]);

	// ── STATE 1: No Showroom Selected (Showroom Directory Landing) ────────────
	if (!selectedShowroom) {
		return (
			<div className="space-y-6">
				{/* ── Page Header ──────────────────────────────────────────────────────── */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2.5">
							<div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
								<ClipboardList className="w-6 h-6" />
							</div>
							<div>
								<h1 className="text-2xl font-bold tracking-tight text-on-surface">Showroom Operations</h1>
								<p className="text-sm text-on-surface-variant">
									Log vehicle services, track staff work sessions, and review daily showroom operations
								</p>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<Button
							variant="secondary"
							size="sm"
							icon={<CalendarCheck className="w-4 h-4" />}
							onClick={() => navigate('/showroom/attendance')}
						>
							Showroom Attendance
						</Button>
						<Button
							variant="secondary"
							size="sm"
							icon={<Receipt className="w-4 h-4" />}
							onClick={() => navigate('/showroom/bill')}
						>
							Showroom Bill
						</Button>
					</div>
				</div>

				{/* ── Showroom Selection Table Card ────────────────────────────────────── */}
				<div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-xs">
					<div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low/40">
						<div className="flex items-center gap-2">
							<Building2 className="w-4 h-4 text-primary" />
							<h2 className="text-sm font-semibold text-on-surface">Select a Showroom to Open Operations</h2>
							<span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant">
								{showrooms.length} {showrooms.length === 1 ? 'Showroom' : 'Showrooms'}
							</span>
						</div>

						<div className="w-full sm:w-72">
							<SearchInput
								placeholder="Search showrooms by name, ID, address..."
								value={showroomFilter}
								onChange={(e) => setShowroomFilter(e.target.value)}
								onClear={() => setShowroomFilter('')}
							/>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="app-table w-full">
							<thead>
								<tr>
									<th>Showroom</th>
									<th>Master ID</th>
									<th>Address</th>
									<th>Status</th>
									<th className="text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{showroomsLoading && (
									<tr>
										<td colSpan={5} className="py-12 text-center text-xs text-on-surface-variant">
											Loading showrooms...
										</td>
									</tr>
								)}

								{!showroomsLoading && filteredShowrooms.length === 0 && (
									<tr>
										<td colSpan={5} className="py-16 text-center">
											<div className="max-w-xs mx-auto text-center space-y-3">
												<Building2 className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
												<div>
													<p className="text-sm font-medium text-on-surface">No showrooms found</p>
													<p className="text-xs text-on-surface-variant mt-0.5">
														{showroomFilter
															? 'No showrooms match your search query.'
															: 'No showrooms available to open operations.'}
													</p>
												</div>
											</div>
										</td>
									</tr>
								)}

								{!showroomsLoading &&
									filteredShowrooms.map((sr) => (
										<tr
											key={sr.id}
											className={`transition-colors ${
												sr.isActive
													? 'hover:bg-surface-container/40 cursor-pointer group'
													: 'opacity-70 cursor-not-allowed bg-surface-container-lowest'
											}`}
											onClick={() => {
												if (sr.isActive) handleShowroomSelect(sr.id);
											}}
										>
											{/* SHOWROOM */}
											<td className="font-semibold text-on-surface text-sm">
												<div className="flex items-center gap-2.5">
													<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
														{sr.name.slice(0, 2).toUpperCase()}
													</div>
													<div>
														<p className="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors">
															{sr.name}
														</p>
													</div>
												</div>
											</td>

											{/* MASTER ID */}
											<td>
												<span className="font-mono text-xs font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
													{sr.masterId ? `#${sr.masterId}` : '—'}
												</span>
											</td>

											{/* ADDRESS */}
											<td className="text-on-surface-variant text-xs max-w-xs truncate">
												<div className="flex items-center gap-1.5">
													<MapPin className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0" />
													<span className="truncate">{sr.address}</span>
												</div>
											</td>

											{/* STATUS */}
											<td>
												<StatusBadge status={sr.isActive ? 'Active' : 'Inactive'} />
											</td>

											{/* ACTIONS */}
											<td className="text-right" onClick={(e) => e.stopPropagation()}>
												<Button
													variant="primary"
													size="sm"
													icon={<ClipboardList className="w-3.5 h-3.5" />}
													disabled={!sr.isActive}
													title={sr.isActive ? 'Open operations workspace for this showroom' : 'Showroom is inactive'}
													onClick={() => handleShowroomSelect(sr.id)}
												>
													Open Operations
												</Button>
											</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		);
	}

	// ── STATE 2: Showroom Selected — Full Operations Workspace ─────────────────

	return (
		<div className="space-y-6">
			{/* ── Operations Workspace Header ────────────────────────────────────────── */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant/60">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => handleShowroomSelect('')}
						className="p-2 rounded-lg bg-white border border-outline-variant/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer shadow-2xs"
						title="Back to Showrooms List"
					>
						<ArrowLeft className="w-4 h-4" />
					</button>

					<div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
						{selectedShowroom.name.slice(0, 2).toUpperCase()}
					</div>

					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-lg font-bold text-on-surface leading-tight">{selectedShowroom.name}</h1>
							<span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
								{selectedShowroom.masterId ? `#${selectedShowroom.masterId}` : '—'}
							</span>
							<StatusBadge status={selectedShowroom.isActive ? 'Active' : 'Inactive'} />
						</div>
						<p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
							<MapPin className="w-3 h-3 text-on-surface-variant/70 shrink-0" />
							<span className="truncate max-w-md">{selectedShowroom.address}</span>
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 flex-wrap">
					{/* Quick navigation to related Showroom features */}
					<Button
						variant="secondary"
						size="sm"
						icon={<CalendarCheck className="w-3.5 h-3.5" />}
						onClick={() => navigate(`/showroom/attendance?showroomId=${selectedShowroom.id}&date=${selectedDate}`)}
					>
						Attendance
					</Button>
					<Button
						variant="secondary"
						size="sm"
						icon={<Receipt className="w-3.5 h-3.5" />}
						onClick={() => navigate(`/showroom/bill?showroomId=${selectedShowroom.id}&date=${selectedDate}`)}
					>
						Daily Bill
					</Button>

					{canManage && (
						<>
							<Button
								variant="secondary"
								size="sm"
								icon={<Users className="w-3.5 h-3.5" />}
								onClick={openStartSessionModal}
							>
								Start Session
							</Button>
							<Button
								variant="primary"
								size="sm"
								icon={<Plus className="w-3.5 h-3.5" />}
								onClick={openAddVehicleWorkModal}
							>
								Log Vehicle Work
							</Button>
						</>
					)}
				</div>
			</div>

			{/* ── Date Controls Bar ──────────────────────────────────────────────────── */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant shadow-2xs">
				<div className="flex items-center gap-2">
					<div className="flex items-center rounded-lg border border-outline-variant overflow-hidden bg-surface-container-low shadow-2xs">
						<button
							type="button"
							onClick={() => handleDateChange(addDays(selectedDate, -1))}
							className="p-2 hover:bg-surface-container transition-colors text-on-surface-variant hover:text-on-surface cursor-pointer"
							title="Previous Day"
						>
							<ChevronLeft className="w-4 h-4" />
						</button>
						<input
							type="date"
							value={selectedDate}
							onChange={(e) => handleDateChange(e.target.value)}
							className="px-3 py-1.5 text-xs font-semibold bg-transparent border-0 text-on-surface focus:outline-hidden cursor-pointer"
						/>
						<button
							type="button"
							onClick={() => handleDateChange(addDays(selectedDate, 1))}
							className="p-2 hover:bg-surface-container transition-colors text-on-surface-variant hover:text-on-surface cursor-pointer"
							title="Next Day"
						>
							<ChevronRight className="w-4 h-4" />
						</button>
					</div>

					<Button
						variant="secondary"
						size="sm"
						onClick={() => handleDateChange(getTodayStr())}
						className={selectedDate === getTodayStr() ? 'bg-primary/10 border-primary/30 text-primary font-semibold' : ''}
					>
						Today
					</Button>
				</div>

				<div className="flex items-center gap-2">
					<Calendar className="w-4 h-4 text-primary" />
					<span className="text-xs font-bold text-on-surface uppercase tracking-wider">
						{formatDateHeading(selectedDate)}
					</span>
				</div>
			</div>

			{/* ── Daily Operations Summary Widget ────────────────────────────────────── */}
			<div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-2xs space-y-3">
				<div className="flex items-center justify-between border-b border-outline-variant/60 pb-2.5">
					<div className="flex items-center gap-2">
						<Activity className="w-4 h-4 text-primary" />
						<h2 className="text-xs font-bold uppercase tracking-wider text-on-surface">Daily Operations Summary</h2>
					</div>
					<span className="text-xs text-on-surface-variant font-mono">
						{formatDateHeading(selectedDate)}
					</span>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/60 flex items-center gap-3">
						<div className="p-2.5 rounded-lg bg-primary/10 text-primary">
							<Car className="w-5 h-5" />
						</div>
						<div>
							<p className="text-xs text-on-surface-variant font-medium">Vehicles Handled</p>
							<p className="text-xl font-bold text-on-surface">{opsSummary?.totalVehiclesHandled ?? 0}</p>
						</div>
					</div>

					<div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/60 flex items-center gap-3">
						<div className="p-2.5 rounded-lg bg-secondary/10 text-secondary">
							<Wrench className="w-5 h-5" />
						</div>
						<div>
							<p className="text-xs text-on-surface-variant font-medium">Services Completed</p>
							<p className="text-xl font-bold text-on-surface">{opsSummary?.totalServicesPerformed ?? 0}</p>
						</div>
					</div>

					<div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/60 flex items-center gap-3">
						<div className="p-2.5 rounded-lg bg-tertiary/10 text-tertiary">
							<Users className="w-5 h-5" />
						</div>
						<div>
							<p className="text-xs text-on-surface-variant font-medium">Active Staff Sessions</p>
							<p className="text-xl font-bold text-on-surface">{opsSummary?.totalActiveStaffSessions ?? 0}</p>
						</div>
					</div>
				</div>

				{/* Breakdown Strip */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
					{/* Vehicle Type Breakdown */}
					<div className="p-2.5 rounded-lg bg-surface-container-low/40 border border-outline-variant/40 space-y-1.5">
						<p className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
							<Car className="w-3.5 h-3.5 text-primary" />
							Vehicle Type Breakdown
						</p>
						<div className="flex flex-wrap gap-1.5">
							{opsSummary?.vehicleTypeBreakdown && opsSummary.vehicleTypeBreakdown.length > 0 ? (
								opsSummary.vehicleTypeBreakdown.map((vb) => (
									<span
										key={vb.vehicleTypeId}
										className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant text-xs text-on-surface"
									>
										<span className="font-medium">{vb.vehicleTypeName}:</span>
										<span className="font-bold text-primary">{vb.totalVehicles}</span>
									</span>
								))
							) : (
								<span className="text-xs text-on-surface-variant italic">No vehicle work recorded for this date</span>
							)}
						</div>
					</div>

					{/* Work / Service Breakdown */}
					<div className="p-2.5 rounded-lg bg-surface-container-low/40 border border-outline-variant/40 space-y-1.5">
						<p className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
							<Wrench className="w-3.5 h-3.5 text-secondary" />
							Work / Service Breakdown
						</p>
						<div className="flex flex-wrap gap-1.5">
							{opsSummary?.workTypeBreakdown && opsSummary.workTypeBreakdown.length > 0 ? (
								opsSummary.workTypeBreakdown.map((wb) => (
									<span
										key={wb.workTypeId}
										className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant text-xs text-on-surface"
									>
										<span className="font-medium">{wb.workTypeName}:</span>
										<span className="font-bold text-secondary">{wb.totalQuantity}</span>
									</span>
								))
							) : (
								<span className="text-xs text-on-surface-variant italic">No services recorded for this date</span>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* ── Workspace Sub-Tabs Navigation ──────────────────────────────────────── */}
			<div className="border-b border-outline-variant flex items-center gap-4">
				<button
					type="button"
					onClick={() => handleTabChange('vehicle-work')}
					className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
						activeTab === 'vehicle-work'
							? 'border-primary text-primary'
							: 'border-transparent text-on-surface-variant hover:text-on-surface'
					}`}
				>
					<Car className="w-4 h-4" />
					Daily Vehicle Work
					<span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-surface-container border border-outline-variant">
						{vehicleWorks.length}
					</span>
				</button>

				<button
					type="button"
					onClick={() => handleTabChange('sessions')}
					className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
						activeTab === 'sessions'
							? 'border-primary text-primary'
							: 'border-transparent text-on-surface-variant hover:text-on-surface'
					}`}
				>
					<Users className="w-4 h-4" />
					Staff Work Sessions
					<span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-surface-container border border-outline-variant">
						{workSessions.length}
					</span>
				</button>

				<button
					type="button"
					onClick={() => handleTabChange('history')}
					className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
						activeTab === 'history'
							? 'border-primary text-primary'
							: 'border-transparent text-on-surface-variant hover:text-on-surface'
					}`}
				>
					<FileSpreadsheet className="w-4 h-4" />
					Staff Productivity
				</button>
			</div>

			{/* ── TAB 1: Daily Vehicle Work Table ────────────────────────────────────── */}
			{activeTab === 'vehicle-work' && (
				<div className="space-y-4">
					{/* Table Filters & Actions */}
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div className="flex items-center gap-2 flex-wrap">
							{/* Filter by Staff */}
							<select
								value={vwStaffFilter}
								onChange={(e) => setVwStaffFilter(e.target.value)}
								className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary cursor-pointer"
							>
								<option value="all">All Staff Members</option>
								{activeStaffMembers.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name} {s.staffMasterId ? `(${s.staffMasterId})` : ''}
									</option>
								))}
							</select>

							{/* Filter by Vehicle Type */}
							<select
								value={vwVehicleTypeFilter}
								onChange={(e) => setVwVehicleTypeFilter(e.target.value)}
								className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary cursor-pointer"
							>
								<option value="all">All Vehicle Types</option>
								{vehicleTypes.map((vt) => (
									<option key={vt.id} value={vt.id}>
										{vt.name}
									</option>
								))}
							</select>

							{(vwStaffFilter !== 'all' || vwVehicleTypeFilter !== 'all') && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setVwStaffFilter('all');
										setVwVehicleTypeFilter('all');
									}}
								>
									Clear Filters
								</Button>
							)}
						</div>

						{canManage && (
							<Button
								variant="primary"
								size="sm"
								icon={<Plus className="w-3.5 h-3.5" />}
								onClick={openAddVehicleWorkModal}
							>
								Log Vehicle Work
							</Button>
						)}
					</div>

					{/* Primary Vehicle Work Table */}
					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-xs">
						<div className="overflow-x-auto">
							<table className="app-table w-full">
								<thead>
									<tr>
										<th>Time / Date</th>
										<th>Staff Member</th>
										<th>Vehicle Type</th>
										<th>Vehicles</th>
										<th>Work / Services Performed</th>
										<th>Notes</th>
										{canManage && <th className="text-right">Actions</th>}
									</tr>
								</thead>
								<tbody>
									{vehicleWorksLoading && (
										<tr>
											<td colSpan={canManage ? 7 : 6} className="py-12 text-center text-xs text-on-surface-variant">
												Loading vehicle work records...
											</td>
										</tr>
									)}

									{!vehicleWorksLoading && filteredVehicleWorks.length === 0 && (
										<tr>
											<td colSpan={canManage ? 7 : 6} className="py-16 text-center">
												<div className="max-w-xs mx-auto text-center space-y-3">
													<Car className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
													<div>
														<p className="text-sm font-medium text-on-surface">No vehicle work logged</p>
														<p className="text-xs text-on-surface-variant mt-0.5">
															{vwStaffFilter !== 'all' || vwVehicleTypeFilter !== 'all'
																? 'No records match the selected filter.'
																: 'No vehicle work has been recorded for this showroom on this date.'}
														</p>
													</div>
													{canManage && (
														<Button
															variant="secondary"
															size="sm"
															icon={<Plus className="w-3.5 h-3.5" />}
															onClick={openAddVehicleWorkModal}
														>
															Log First Vehicle Work
														</Button>
													)}
												</div>
											</td>
										</tr>
									)}

									{!vehicleWorksLoading &&
										filteredVehicleWorks.map((work) => (
											<tr key={work.id} className="hover:bg-surface-container/30 transition-colors">
												{/* TIME / DATE */}
												<td>
													<div className="space-y-0.5">
														<p className="text-xs font-semibold text-on-surface">
															{formatDisplayTime(work.timeRecorded)}
														</p>
														<p className="text-2xs text-on-surface-variant">
															{formatDateHeading(work.date)}
														</p>
													</div>
												</td>

												{/* STAFF MEMBER */}
												<td>
													<div className="flex items-center gap-2">
														<span className="font-mono text-2xs font-semibold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant">
															{work.staffMasterId ? `#${work.staffMasterId}` : '—'}
														</span>
														<span className="text-xs font-semibold text-on-surface">
															{work.staffName}
														</span>
													</div>
												</td>

												{/* VEHICLE TYPE */}
												<td>
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium text-xs border border-primary/20">
														<Car className="w-3 h-3" />
														{work.vehicleTypeName}
													</span>
												</td>

												{/* VEHICLE COUNT */}
												<td>
													<span className="font-bold text-xs text-on-surface px-2 py-0.5 rounded bg-surface-container border border-outline-variant">
														{work.vehicleQuantity} {work.vehicleQuantity === 1 ? 'vehicle' : 'vehicles'}
													</span>
												</td>

												{/* WORK / SERVICES */}
												<td>
													<div className="flex flex-wrap gap-1">
														{work.serviceItems.map((item) => (
															<span
																key={item.id}
																className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 text-secondary text-2xs font-semibold border border-secondary/20"
															>
																<Wrench className="w-2.5 h-2.5" />
																{item.workTypeName} ({item.quantity})
															</span>
														))}
													</div>
												</td>

												{/* NOTES */}
												<td className="text-xs text-on-surface-variant max-w-xs truncate">
													{work.notes || '—'}
												</td>

												{/* ACTIONS */}
												{canManage && (
													<td className="text-right">
														<Button
															variant="ghost"
															size="sm"
															icon={<Edit2 className="w-3.5 h-3.5" />}
															onClick={() => openEditVehicleWorkModal(work)}
															title="Edit Vehicle Work"
														>
															Edit
														</Button>
													</td>
												)}
											</tr>
										))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ── TAB 2: Staff Work Sessions Table ───────────────────────────────────── */}
			{activeTab === 'sessions' && (
				<div className="space-y-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<h3 className="text-sm font-semibold text-on-surface">Daily Staff Work Sessions</h3>
							<p className="text-xs text-on-surface-variant">
								Track staff shifts, transfers between showrooms, and active operational sessions
							</p>
						</div>

						{canManage && (
							<Button
								variant="primary"
								size="sm"
								icon={<UserPlus className="w-3.5 h-3.5" />}
								onClick={openStartSessionModal}
							>
								Start Staff Session
							</Button>
						)}
					</div>

					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-xs">
						<div className="overflow-x-auto">
							<table className="app-table w-full">
								<thead>
									<tr>
										<th>Staff Member</th>
										<th>Home Showroom</th>
										<th>Session Type</th>
										<th>Status</th>
										<th>Time Range</th>
										<th>Vehicle Works</th>
										<th>Transfer / Notes</th>
										{canManage && <th className="text-right">Actions</th>}
									</tr>
								</thead>
								<tbody>
									{workSessionsLoading && (
										<tr>
											<td colSpan={canManage ? 8 : 7} className="py-12 text-center text-xs text-on-surface-variant">
												Loading staff work sessions...
											</td>
										</tr>
									)}

									{!workSessionsLoading && workSessions.length === 0 && (
										<tr>
											<td colSpan={canManage ? 8 : 7} className="py-16 text-center">
												<div className="max-w-xs mx-auto text-center space-y-3">
													<Users className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
													<div>
														<p className="text-sm font-medium text-on-surface">No staff sessions recorded</p>
														<p className="text-xs text-on-surface-variant mt-0.5">
															No staff work sessions have been opened at this showroom for this date.
														</p>
													</div>
													{canManage && (
														<Button
															variant="secondary"
															size="sm"
															icon={<UserPlus className="w-3.5 h-3.5" />}
															onClick={openStartSessionModal}
														>
															Start First Session
														</Button>
													)}
												</div>
											</td>
										</tr>
									)}

									{!workSessionsLoading &&
										workSessions.map((sess) => {
											const isClosed = Boolean(sess.endTime);
											return (
												<tr key={sess.id} className="hover:bg-surface-container/30 transition-colors">
													{/* STAFF MEMBER */}
													<td>
														<div className="flex items-center gap-2">
															<span className="font-mono text-2xs font-semibold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant">
																{sess.staffMasterId ? `#${sess.staffMasterId}` : '—'}
															</span>
															<div>
																<p className="text-xs font-semibold text-on-surface">{sess.staffName}</p>
																{sess.staffPhone && (
																	<p className="text-2xs text-on-surface-variant">{sess.staffPhone}</p>
																)}
															</div>
														</div>
													</td>

													{/* HOME / DEFAULT SHOWROOM */}
													<td>
														<div className="text-xs text-on-surface-variant">
															{sess.homeShowroomName ? (
																<span className="inline-flex items-center gap-1">
																	<Building2 className="w-3 h-3 text-on-surface-variant/70" />
																	{sess.homeShowroomName}
																</span>
															) : (
																<span className="text-on-surface-variant/60 italic">Freelance / Roaming</span>
															)}
														</div>
													</td>

													{/* SESSION TYPE */}
													<td>
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-xs font-medium text-on-surface border border-outline-variant">
															{sess.sessionType === 'TransferShift' && (
																<ArrowRightLeft className="w-3 h-3 text-tertiary" />
															)}
															{sess.sessionTypeName}
														</span>
													</td>

													{/* STATUS */}
													<td>
														<StatusBadge status={sess.attendanceStatusName || sess.attendanceStatus} />
													</td>

													{/* TIME RANGE */}
													<td>
														<div className="flex items-center gap-1.5 text-xs text-on-surface">
															<Clock className="w-3.5 h-3.5 text-on-surface-variant" />
															<span>{formatDisplayTime(sess.startTime)}</span>
															<span>→</span>
															<span className={isClosed ? 'font-semibold' : 'text-on-surface-variant italic'}>
																{isClosed ? formatDisplayTime(sess.endTime) : 'In Progress'}
															</span>
														</div>
													</td>

													{/* VEHICLE WORKS COUNT */}
													<td>
														<span className="font-bold text-xs text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
															{sess.vehicleWorkCount} {sess.vehicleWorkCount === 1 ? 'work' : 'works'}
														</span>
													</td>

													{/* TRANSFER REASON / NOTES */}
													<td className="text-xs text-on-surface-variant max-w-xs truncate">
														{sess.transferReason ? (
															<span className="text-tertiary font-medium">[{sess.transferReason}] </span>
														) : null}
														{sess.notes || '—'}
													</td>

													{/* ACTIONS */}
													{canManage && (
														<td className="text-right">
															<div className="flex items-center justify-end gap-1">
																{!isClosed && (
																	<Button
																		variant="secondary"
																		size="sm"
																		icon={<LogOut className="w-3 h-3 text-error" />}
																		onClick={() => {
																			setClosingSession(sess);
																			setCloseEndTime(getCurrentTimeStr());
																			setCloseNotes('');
																			setCloseError('');
																		}}
																		title="Close Session"
																	>
																		Close
																	</Button>
																)}
																<Button
																	variant="ghost"
																	size="sm"
																	icon={<Edit2 className="w-3 h-3" />}
																	onClick={() => openEditSessionModal(sess)}
																	title="Edit Session"
																>
																	Edit
																</Button>
															</div>
														</td>
													)}
												</tr>
											);
										})}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ── TAB 3: Staff Productivity & Operations Breakdown ──────────────────── */}
			{activeTab === 'history' && (
				<div className="space-y-4">
					<div>
						<h3 className="text-sm font-semibold text-on-surface">Staff Productivity Summary</h3>
						<p className="text-xs text-on-surface-variant">
							Staff activity breakdown for {selectedShowroom.name} on {formatDateHeading(selectedDate)}
						</p>
					</div>

					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-xs">
						<div className="overflow-x-auto">
							<table className="app-table w-full">
								<thead>
									<tr>
										<th>Staff Member</th>
										<th>Master ID</th>
										<th>Sessions</th>
										<th>Vehicles Handled</th>
										<th>Services Completed</th>
									</tr>
								</thead>
								<tbody>
									{summaryLoading && (
										<tr>
											<td colSpan={5} className="py-12 text-center text-xs text-on-surface-variant">
												Loading staff productivity summary...
											</td>
										</tr>
									)}

									{!summaryLoading && (!opsSummary?.staffProductivityBreakdown || opsSummary.staffProductivityBreakdown.length === 0) && (
										<tr>
											<td colSpan={5} className="py-16 text-center text-xs text-on-surface-variant">
												No staff activity recorded for this showroom on this date.
											</td>
										</tr>
									)}

									{!summaryLoading &&
										opsSummary?.staffProductivityBreakdown?.map((sp) => (
											<tr key={sp.staffId} className="hover:bg-surface-container/30 transition-colors">
												<td className="font-semibold text-xs text-on-surface">{sp.staffName}</td>
												<td>
													<span className="font-mono text-2xs font-semibold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant">
														{sp.staffMasterId ? `#${sp.staffMasterId}` : '—'}
													</span>
												</td>
												<td>
													<span className="font-bold text-xs text-on-surface">{sp.totalSessions}</span>
												</td>
												<td>
													<span className="font-bold text-xs text-primary">{sp.totalVehiclesHandled}</span>
												</td>
												<td>
													<span className="font-bold text-xs text-secondary">{sp.totalServicesPerformed}</span>
												</td>
											</tr>
										))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ── MODAL 1: Add / Edit Vehicle Work ─────────────────────────────────── */}
			{showVehicleWorkModal && (
				<Dialog
					open={showVehicleWorkModal}
					onOpenChange={setShowVehicleWorkModal}
					title={editingVehicleWork ? 'Edit Vehicle Work' : 'Log Vehicle Work'}
				>
					<form
						noValidate
						onSubmit={(e) => {
							e.preventDefault();
							saveVehicleWorkMutation.mutate();
						}}
						className="space-y-4"
					>
						{vwFormError && (
							<div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0 text-error" />
								<span>{vwFormError}</span>
							</div>
						)}

						{/* Staff Member Selection */}
						<div>
							<label htmlFor="vw-staff-id" className="block text-xs font-semibold text-on-surface mb-1">
								Staff Member <span className="text-error">*</span>
							</label>
							<select
								id="vw-staff-id"
								aria-label="Staff Member"
								value={vwStaffId}
								onChange={(e) => {
									const selectedId = e.target.value;
									setVwStaffId(selectedId);
									const matched = displayStaffList.find((s) => s.staffId === selectedId);
									if (matched && matched.id && matched.id !== 'edit-staff') {
										setVwSessionId(matched.id);
									} else {
										setVwSessionId('');
									}
								}}
								disabled={displayStaffList.length === 0}
								className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary disabled:opacity-50"
								required
							>
								{displayStaffList.length === 0 ? (
									<option value="">No staff assigned for this date</option>
								) : (
									<>
										<option value="">Select Staff Member</option>
										{displayStaffList.map((s) => {
											const isTransfer = s.assignmentType === 'TemporaryTransfer' || (s.homeShowroomId && s.homeShowroomId !== activeShowroomId);
											const transferLabel = isTransfer ? ` • Transfer from ${s.homeShowroomName || 'Other Showroom'}` : '';
											const timeLabel = s.startTime && s.endTime ? ` • ${s.startTime} - ${s.endTime}${s.workingHoursFormatted ? ` (${s.workingHoursFormatted})` : ''}` : '';
											return (
												<option key={s.id || s.staffId} value={s.staffId}>
													{s.staffName} {s.staffMasterId ? `(${s.staffMasterId})` : ''} - {s.staffRole || 'Technician'}{transferLabel}{timeLabel}
												</option>
											);
										})}
									</>
								)}
							</select>
						</div>

						{/* Vehicle Count */}
						<div>
							<label htmlFor="vw-vehicle-count" className="block text-xs font-semibold text-on-surface mb-1">
								Vehicle Count <span className="text-error">*</span>
							</label>
							<input
								id="vw-vehicle-count"
								aria-label="Vehicle Count"
								type="number"
								min="1"
								max="9999"
								value={vwVehicleCountInput}
								disabled={!!editingVehicleWork}
								onChange={(e) => handleVehicleCountChange(e.target.value)}
								className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary disabled:opacity-50"
								required
							/>
						</div>

						{/* Individual Vehicle Sections (Collapsible) */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<label className="text-xs font-semibold text-on-surface">
									Individual Vehicle Work Details ({vwVehicles.length}) <span className="text-error">*</span>
								</label>
								<span className="text-2xs text-on-surface-variant">
									Select type & services for each vehicle
								</span>
							</div>

							<div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
								{vwVehicles.map((vehicle, idx) => {
									const isExpanded = expandedVehicles[idx] ?? (idx === 0);
									const isComplete = Boolean(vehicle.vehicleTypeId && vehicle.selectedWorkTypeIds.length > 0);
									const selectedType = vehicleTypes.find((vt) => vt.id === vehicle.vehicleTypeId);

									return (
										<div
											key={idx}
											className="rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden transition-all shadow-2xs"
										>
											{/* Collapsible Header Button */}
											<button
												type="button"
												onClick={() => handleToggleVehicleCollapse(idx)}
												aria-expanded={isExpanded}
												aria-controls={`vw-vehicle-section-${idx}`}
												className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-container/60 transition-colors focus:outline-hidden focus:bg-surface-container"
											>
												<div className="flex items-center gap-2.5 min-w-0">
													{/* Visual Circle Status Indicator */}
													<div
														className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-2xs shrink-0 ${
															isComplete
																? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
																: 'bg-primary/10 text-primary'
														}`}
													>
														{isComplete ? '✓' : idx + 1}
													</div>

													{/* Vehicle Title & Dynamic Summary */}
													<div className="flex items-center gap-1.5 truncate text-xs">
														<span className="font-bold text-on-surface">Vehicle {idx + 1}</span>
														{selectedType ? (
															<span className="text-on-surface-variant font-medium truncate">
																• {selectedType.name}
															</span>
														) : (
															<span className="text-on-surface-variant/70 italic text-2xs">
																• Select vehicle type
															</span>
														)}
														{vehicle.selectedWorkTypeIds.length > 0 && (
															<span className="text-primary font-medium shrink-0 text-2xs">
																• {vehicle.selectedWorkTypeIds.length} service{vehicle.selectedWorkTypeIds.length > 1 ? 's' : ''}
															</span>
														)}
													</div>
												</div>

												<div className="text-on-surface-variant shrink-0 ml-2">
													{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
												</div>
											</button>

											{/* Collapsible Body */}
											{isExpanded && (
												<div
													id={`vw-vehicle-section-${idx}`}
													className="p-3 pt-1 space-y-3 border-t border-outline-variant/60"
												>
													{/* Vehicle Type */}
													<div>
														<label
															htmlFor={`vw-vehicle-type-${idx}`}
															className="block text-2xs font-semibold text-on-surface-variant mb-1"
														>
															Vehicle Type <span className="text-error">*</span>
														</label>
														<select
															id={`vw-vehicle-type-${idx}`}
															aria-label={`Vehicle ${idx + 1} Type`}
															value={vehicle.vehicleTypeId}
															onChange={(e) => handleVehicleTypeChange(idx, e.target.value)}
															className="w-full px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
															required
														>
															<option value="">Select Vehicle Type</option>
															{vehicleTypes.map((vt) => (
																<option key={vt.id} value={vt.id}>
																	{vt.name}
																</option>
															))}
														</select>
													</div>

													{/* Services Checklist */}
													<div className="space-y-1.5">
														<label className="block text-2xs font-semibold text-on-surface-variant">
															Services / Work Performed <span className="text-error">*</span>
														</label>
														<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 rounded-lg bg-surface-container-lowest border border-outline-variant">
															{workTypesLoading && <p className="text-2xs text-on-surface-variant">Loading services...</p>}
															{!workTypesLoading &&
																workTypes.map((wt) => {
																	const isSelected = vehicle.selectedWorkTypeIds.includes(wt.id);
																	return (
																		<label
																			key={wt.id}
																			className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors text-xs font-medium ${
																				isSelected
																					? 'bg-primary/10 text-primary border border-primary/20'
																					: 'hover:bg-surface-container text-on-surface'
																			}`}
																		>
																			<input
																				type="checkbox"
																				id={`vw-service-${idx}-${wt.id}`}
																				aria-label={`Vehicle ${idx + 1} - ${wt.name}`}
																				checked={isSelected}
																				onChange={() => handleToggleVehicleService(idx, wt.id)}
																				className="rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
																			/>
																			<span className="truncate">{wt.name}</span>
																		</label>
																	);
																})}
														</div>
													</div>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>

						{/* Notes */}
						<div>
							<label className="block text-xs font-semibold text-on-surface mb-1">Notes (Optional)</label>
							<textarea
								rows={2}
								value={vwNotes}
								onChange={(e) => setVwNotes(e.target.value)}
								placeholder="e.g. Vehicle registration number, special customer requests..."
								className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
							/>
						</div>

						{/* Form Actions */}
						<div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
							<Button variant="ghost" size="sm" type="button" onClick={() => setShowVehicleWorkModal(false)}>
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								type="submit"
								disabled={saveVehicleWorkMutation.isPending}
							>
								{saveVehicleWorkMutation.isPending ? 'Saving...' : editingVehicleWork ? 'Update Record' : 'Save Record'}
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* ── MODAL 2: Start / Edit Staff Work Session ──────────────────────────── */}
			{showSessionModal && (
				<Dialog
					open={showSessionModal}
					onOpenChange={setShowSessionModal}
					title={editingSession ? 'Edit Staff Session' : 'Start Staff Work Session'}
				>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							saveSessionMutation.mutate();
						}}
						className="space-y-4"
					>
						{sessFormError && (
							<div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0 text-error" />
								<span>{sessFormError}</span>
							</div>
						)}

						{/* Staff Member */}
						<div>
							<label className="block text-xs font-semibold text-on-surface mb-1">
								Staff Member <span className="text-error">*</span>
							</label>
							<select
								value={sessStaffId}
								onChange={(e) => setSessStaffId(e.target.value)}
								disabled={!!editingSession}
								className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
								required
							>
								<option value="">Select Staff Member</option>
								{activeStaffMembers.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name} {s.staffMasterId ? `(${s.staffMasterId})` : ''} - {s.role || 'Technician'}
									</option>
								))}
							</select>
						</div>

						{/* Session Type & Status */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Session Type <span className="text-error">*</span>
								</label>
								<select
									value={sessType}
									onChange={(e) => setSessType(e.target.value as ShowroomStaffSessionType)}
									className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
								>
									<option value="FullDay">Full Day</option>
									<option value="MorningHalf">Morning Half</option>
									<option value="EveningHalf">Evening Half</option>
									<option value="TransferShift">Transfer Shift</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Attendance Status
								</label>
								<select
									value={sessAttendanceStatus}
									onChange={(e) => setSessAttendanceStatus(e.target.value)}
									className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
								>
									<option value="Present">Present</option>
									<option value="HalfDay">Half Day</option>
									<option value="Leave">Leave</option>
									<option value="OnDuty">On Duty</option>
								</select>
							</div>
						</div>

						{/* Times */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">Start Time</label>
								<input
									type="time"
									value={sessStartTime}
									onChange={(e) => setSessStartTime(e.target.value)}
									className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									End Time (Optional)
								</label>
								<input
									type="time"
									value={sessEndTime}
									onChange={(e) => setSessEndTime(e.target.value)}
									className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
								/>
							</div>
						</div>

						{/* Transfer Reason */}
						{sessType === 'TransferShift' && (
							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Transfer Details / Reason
								</label>
								<input
									type="text"
									value={sessTransferReason}
									onChange={(e) => setSessTransferReason(e.target.value)}
									placeholder="e.g. Transferred from Showroom A to handle extra afternoon volume"
									className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
								/>
							</div>
						)}

						{/* Notes */}
						<div>
							<label className="block text-xs font-semibold text-on-surface mb-1">Notes (Optional)</label>
							<textarea
								rows={2}
								value={sessNotes}
								onChange={(e) => setSessNotes(e.target.value)}
								placeholder="Optional session notes..."
								className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
							/>
						</div>

						{/* Form Actions */}
						<div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
							<Button variant="ghost" size="sm" type="button" onClick={() => setShowSessionModal(false)}>
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								type="submit"
								disabled={saveSessionMutation.isPending}
							>
								{saveSessionMutation.isPending ? 'Saving...' : editingSession ? 'Update Session' : 'Start Session'}
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* ── MODAL 3: Close Staff Session ─────────────────────────────────────── */}
			{closingSession && (
				<Dialog
					open={!!closingSession}
					onOpenChange={(open) => {
						if (!open) setClosingSession(null);
					}}
					title="Close Staff Work Session"
				>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							closeSessionMutation.mutate();
						}}
						className="space-y-4"
					>
						{closeError && (
							<div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0 text-error" />
								<span>{closeError}</span>
							</div>
						)}

						<div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant space-y-1">
							<p className="text-xs font-semibold text-on-surface">Staff Member: {closingSession.staffName}</p>
							<p className="text-2xs text-on-surface-variant">
								Session Type: {closingSession.sessionTypeName} | Started:{' '}
								{formatDisplayTime(closingSession.startTime)}
							</p>
						</div>

						<div>
							<label className="block text-xs font-semibold text-on-surface mb-1">
								End Time <span className="text-error">*</span>
							</label>
							<input
								type="time"
								value={closeEndTime}
								onChange={(e) => setCloseEndTime(e.target.value)}
								className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
								required
							/>
						</div>

						<div>
							<label className="block text-xs font-semibold text-on-surface mb-1">Closing Notes (Optional)</label>
							<textarea
								rows={2}
								value={closeNotes}
								onChange={(e) => setCloseNotes(e.target.value)}
								placeholder="Notes on session completion..."
								className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-hidden focus:border-primary"
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
							<Button variant="ghost" size="sm" type="button" onClick={() => setClosingSession(null)}>
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								type="submit"
								disabled={closeSessionMutation.isPending}
							>
								{closeSessionMutation.isPending ? 'Closing...' : 'Confirm Close Session'}
							</Button>
						</div>
					</form>
				</Dialog>
			)}
		</div>
	);
}
