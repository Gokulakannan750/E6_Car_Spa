import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	MapPin,
	Phone,
	Users,
	UserPlus,
	Calendar,
	Plus,
	Search,
	Edit2,
	Trash2,
	ArrowLeft,
	Car,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Minus,
	Building2,
	AlertCircle,
	Receipt,
	Clock,
	IndianRupee,
	History,
	TrendingUp,
	Eye,
	Layers,
	Lock,
	Unlock,
	AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useAuth } from '../auth/auth-context';
import {
	getShowrooms,
	createShowroom,
	updateShowroom,
	deleteShowroom,
	toggleShowroomActive,
	getDailyStaff,
	confirmDailyStaffAttendance,
	unlockDailyStaffAttendance,
	assignDailyStaff,
	updateDailyStaffVehicles,
	removeDailyStaff,
	getStaffList,
	getShowroomDailyBill,
	setShowroomDailyBill,
	recordShowroomPayment,
	deleteShowroomPayment,
	getShowroomSummary,
	getShowroomsOutstanding,
	type ShowroomDto,
	type DailyStaffAssignmentDto,
	type StaffDto,
	type ShowroomPaymentDto,
} from '../../lib/api';

// ── Pure Calendar Date Helpers (No Timezone Offset Skipping) ─────────────────
function addDays(dateStr: string, days: number): string {
	if (!dateStr) return getTodayStr();
	const parts = dateStr.split('-').map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) return getTodayStr();
	const [year, month, day] = parts;
	const dt = new Date(year, month - 1, day + days);
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function getTodayStr(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

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

function formatINR(val: number): string {
	return '₹' + (val || 0).toLocaleString('en-IN', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function getPaymentStatusBadge(status: string) {
	switch (status) {
		case 'Paid':
			return (
				<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
					<CheckCircle2 className="w-3 h-3" /> Paid
				</span>
			);
		case 'PartiallyPaid':
			return (
				<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
					<Clock className="w-3 h-3" /> Partially Paid
				</span>
			);
		case 'Unpaid':
		default:
			return (
				<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
					<AlertCircle className="w-3 h-3" /> Unpaid
				</span>
			);
	}
}

type DateRangePreset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom';

function getDatePresetBounds(
	preset: DateRangePreset,
	customStart: string,
	customEnd: string
): { start: string; end: string } {
	const now = new Date();
	const y = now.getFullYear();
	const m = now.getMonth();

	if (preset === 'today') {
		const today = getTodayStr();
		return { start: today, end: today };
	}
	if (preset === 'this_week') {
		const dayOfWeek = now.getDay();
		const mondayDiff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
		const monday = new Date(now.getFullYear(), now.getMonth(), mondayDiff);
		const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
		const fmt = (dt: Date) =>
			`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
		return { start: fmt(monday), end: fmt(sunday) };
	}
	if (preset === 'this_month') {
		const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
		const lastDate = new Date(y, m + 1, 0).getDate();
		const lastDay = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
		return { start: firstDay, end: lastDay };
	}
	if (preset === 'last_month') {
		const prevMonth = m === 0 ? 11 : m - 1;
		const prevYear = m === 0 ? y - 1 : y;
		const firstDay = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
		const lastDate = new Date(prevYear, prevMonth + 1, 0).getDate();
		const lastDay = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
		return { start: firstDay, end: lastDay };
	}
	return { start: customStart || getTodayStr(), end: customEnd || getTodayStr() };
}

export function ShowroomPage() {
	const qc = useQueryClient();

	// ── Master Level Navigation ───────────────────────────────────────────────
	const [masterTab, setMasterTab] = useState<'directory' | 'outstanding'>('directory');
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const [selectedShowroom, setSelectedShowroom] = useState<ShowroomDto | null>(null);

	// ── Detail Workspace Tabs ─────────────────────────────────────────────────
	const [activeDetailTab, setActiveDetailTab] = useState<'daily' | 'history' | 'staff'>('daily');

	// Daily date (YYYY-MM-DD)
	const [selectedDate, setSelectedDate] = useState<string>(getTodayStr);

	// ── History Range Filters ─────────────────────────────────────────────────
	const [historyPreset, setHistoryPreset] = useState<DateRangePreset>('this_month');
	const [customStart, setCustomStart] = useState<string>(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
	});
	const [customEnd, setCustomEnd] = useState<string>(getTodayStr);

	const historyBounds = useMemo(
		() => getDatePresetBounds(historyPreset, customStart, customEnd),
		[historyPreset, customStart, customEnd]
	);

	// Showroom modal state (Create / Edit)
	const [showShowroomModal, setShowShowroomModal] = useState(false);
	const [editingShowroom, setEditingShowroom] = useState<ShowroomDto | null>(null);
	const [formName, setFormName] = useState('');
	const [formAddress, setFormAddress] = useState('');
	const [formPhone, setFormPhone] = useState('');
	const [formIsActive, setFormIsActive] = useState(true);
	const [showroomFormError, setShowroomFormError] = useState('');

	// Delete Showroom confirmation modal state
	const [deletingShowroom, setDeletingShowroom] = useState<ShowroomDto | null>(null);

	// Add Daily Staff modal state
	const [showAddStaffModal, setShowAddStaffModal] = useState(false);
	const [selectedStaffId, setSelectedStaffId] = useState<string>('');
	const [staffVehiclesInput, setStaffVehiclesInput] = useState<number>(0);
	const [staffSearchTerm, setStaffSearchTerm] = useState('');
	const [addStaffError, setAddStaffError] = useState('');

	// Remove Daily Staff confirmation modal state
	const [deletingAssignment, setDeletingAssignment] = useState<DailyStaffAssignmentDto | null>(null);

	// Local optimistic vehicles count cache
	const [localVehicleCounts, setLocalVehicleCounts] = useState<Record<string, number>>({});

	// Attendance Confirmation & Locking states
	const { isOwner, hasPermission } = useAuth();
	const [showUnlockModal, setShowUnlockModal] = useState(false);
	const [isCorrectionMode, setIsCorrectionMode] = useState(false);

	// Reset local cache & correction mode on selection change
	useEffect(() => {
		setLocalVehicleCounts({});
		setIsCorrectionMode(false);
	}, [selectedShowroom?.id, selectedDate]);

	// Daily Showroom Billing & Payment States
	const [showSetBillModal, setShowSetBillModal] = useState(false);
	const [billAmountInput, setBillAmountInput] = useState('');
	const [billNotesInput, setBillNotesInput] = useState('');
	const [setBillError, setSetBillError] = useState('');

	const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
	const [paymentAmountInput, setPaymentAmountInput] = useState('');
	const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'BankTransfer'>('Cash');
	const [paymentReference, setPaymentReference] = useState('');
	const [paymentNotes, setPaymentNotes] = useState('');
	const [recordPaymentError, setRecordPaymentError] = useState('');

	const [deletingPayment, setDeletingPayment] = useState<ShowroomPaymentDto | null>(null);

	// ── Queries ───────────────────────────────────────────────────────────────
	const { data: showrooms = [], isLoading: showroomsLoading } = useQuery({
		queryKey: ['showrooms', search, statusFilter],
		queryFn: () =>
			getShowrooms({
				search: search || undefined,
				isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
			}),
	});

	const { data: dailyStaffData, isLoading: dailyStaffLoading } = useQuery({
		queryKey: ['daily-staff', selectedShowroom?.id, selectedDate],
		queryFn: () => {
			if (!selectedShowroom) return null;
			return getDailyStaff(selectedShowroom.id, selectedDate);
		},
		enabled: !!selectedShowroom,
	});

	const { data: dailyBillData, isLoading: dailyBillLoading } = useQuery({
		queryKey: ['showroomDailyBill', selectedShowroom?.id, selectedDate],
		queryFn: () => {
			if (!selectedShowroom) return null;
			return getShowroomDailyBill(selectedShowroom.id, selectedDate);
		},
		enabled: !!selectedShowroom,
	});

	// Step 3: Showroom History & Summary Query
	const { data: summaryData, isLoading: summaryLoading } = useQuery({
		queryKey: ['showroomSummary', selectedShowroom?.id, historyBounds.start, historyBounds.end],
		queryFn: () => {
			if (!selectedShowroom) return null;
			return getShowroomSummary(selectedShowroom.id, historyBounds.start, historyBounds.end);
		},
		enabled: !!selectedShowroom && (activeDetailTab === 'history' || activeDetailTab === 'staff'),
	});

	// Step 3: Outstanding Showrooms Overview Query
	const { data: outstandingList = [], isLoading: outstandingLoading } = useQuery({
		queryKey: ['showroomsOutstanding'],
		queryFn: () => getShowroomsOutstanding(),
		enabled: masterTab === 'outstanding',
	});

	const { data: staffDirectory = [] } = useQuery({
		queryKey: ['staffDirectory'],
		queryFn: () => getStaffList(),
	});

	// Reset local cache on selection change
	useEffect(() => {
		setLocalVehicleCounts({});
	}, [selectedShowroom?.id, selectedDate]);

	// Filtered staff list for the Add Staff modal
	const availableStaff = useMemo(() => {
		let list = (staffDirectory as StaffDto[]).filter((s) => s.isActive);
		if (staffSearchTerm.trim()) {
			const term = staffSearchTerm.toLowerCase();
			list = list.filter(
				(s) => s.name.toLowerCase().includes(term) || (s.phoneNumber && s.phoneNumber.includes(term))
			);
		}
		return list;
	}, [staffDirectory, staffSearchTerm]);

	// Calculated total vehicles attended (optimistic)
	const liveTotalVehicles = useMemo(() => {
		if (!dailyStaffData?.staffAssignments) return 0;
		return dailyStaffData.staffAssignments.reduce((sum, a) => {
			const count = localVehicleCounts[a.id] !== undefined ? localVehicleCounts[a.id] : a.vehiclesAttended;
			return sum + (count || 0);
		}, 0);
	}, [dailyStaffData, localVehicleCounts]);

	// ── Mutations ─────────────────────────────────────────────────────────────

	// 1. Create Showroom
	const createShowroomMutation = useMutation({
		mutationFn: (data: { name: string; address: string; phone?: string; isActive?: boolean }) =>
			createShowroom(data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
			setShowShowroomModal(false);
			resetShowroomForm();
		},
		onError: (err: any) => {
			setShowroomFormError(err.message || 'Failed to create showroom.');
		},
	});

	// 2. Update Showroom
	const updateShowroomMutation = useMutation({
		mutationFn: ({ id, data }: { id: string; data: { name?: string; address?: string; phone?: string; isActive?: boolean } }) =>
			updateShowroom(id, data),
		onSuccess: (updated) => {
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
			if (selectedShowroom?.id === updated.id) {
				setSelectedShowroom(updated);
			}
			setShowShowroomModal(false);
			resetShowroomForm();
		},
		onError: (err: any) => {
			setShowroomFormError(err.message || 'Failed to update showroom.');
		},
	});

	// 3. Delete Showroom
	const deleteShowroomMutation = useMutation({
		mutationFn: (id: string) => deleteShowroom(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
			if (selectedShowroom && deletingShowroom?.id === selectedShowroom.id) {
				setSelectedShowroom(null);
			}
			setDeletingShowroom(null);
		},
	});

	// 4. Toggle Active Showroom
	const toggleActiveMutation = useMutation({
		mutationFn: (id: string) => toggleShowroomActive(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
		},
	});

	// 5. Assign Daily Staff
	const assignStaffMutation = useMutation({
		mutationFn: (data: { staffId: string; date: string; vehiclesAttended: number }) => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return assignDailyStaff(selectedShowroom.id, data);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setShowAddStaffModal(false);
			setSelectedStaffId('');
			setStaffVehiclesInput(0);
			setAddStaffError('');
		},
		onError: (err: any) => {
			setAddStaffError(err.message || 'Staff member is already assigned on this date or could not be assigned.');
		},
	});

	// 6. Update Daily Staff Vehicles
	const updateVehiclesMutation = useMutation({
		mutationFn: ({ assignmentId, count }: { assignmentId: string; count: number }) =>
			updateDailyStaffVehicles(assignmentId, count),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
		},
	});

	// 7. Remove Daily Staff Assignment
	const removeAssignmentMutation = useMutation({
		mutationFn: (assignmentId: string) => removeDailyStaff(assignmentId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setDeletingAssignment(null);
		},
	});

	// 7.1 Confirm Daily Staff Attendance
	const confirmAttendanceMutation = useMutation({
		mutationFn: () => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return confirmDailyStaffAttendance(selectedShowroom.id, selectedDate);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setIsCorrectionMode(false);
		},
		onError: (err: any) => {
			alert(err.message || 'Failed to confirm attendance.');
		},
	});

	// 7.2 Unlock Daily Staff Attendance (Owner Correction)
	const unlockAttendanceMutation = useMutation({
		mutationFn: () => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return unlockDailyStaffAttendance(selectedShowroom.id, selectedDate);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setShowUnlockModal(false);
			setIsCorrectionMode(true);
		},
		onError: (err: any) => {
			alert(err.message || 'Failed to unlock attendance for correction.');
		},
	});

	// 8. Set / Edit Daily Showroom Bill
	const setDailyBillMutation = useMutation({
		mutationFn: (data: { amount: number; notes?: string }) => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return setShowroomDailyBill(selectedShowroom.id, selectedDate, data);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showroomDailyBill', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
			setShowSetBillModal(false);
			setSetBillError('');
		},
		onError: (err: any) => {
			setSetBillError(err.message || 'Failed to set showroom daily bill.');
		},
	});

	// 9. Record Showroom Payment
	const recordPaymentMutation = useMutation({
		mutationFn: (data: { amount: number; paymentMethod: string; reference?: string; notes?: string }) => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return recordShowroomPayment(selectedShowroom.id, selectedDate, data);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showroomDailyBill', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
			setShowRecordPaymentModal(false);
			setRecordPaymentError('');
		},
		onError: (err: any) => {
			setRecordPaymentError(err.message || 'Failed to record showroom payment.');
		},
	});

	// 10. Delete Showroom Payment
	const deletePaymentMutation = useMutation({
		mutationFn: (paymentId: string) => deleteShowroomPayment(paymentId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showroomDailyBill', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
			setDeletingPayment(null);
		},
	});

	// ── Handlers ──────────────────────────────────────────────────────────────

	const resetShowroomForm = () => {
		setEditingShowroom(null);
		setFormName('');
		setFormAddress('');
		setFormPhone('');
		setFormIsActive(true);
		setShowroomFormError('');
	};

	const openCreateShowroomModal = () => {
		resetShowroomForm();
		setShowShowroomModal(true);
	};

	const openEditShowroomModal = (sr: ShowroomDto) => {
		setEditingShowroom(sr);
		setFormName(sr.name);
		setFormAddress(sr.address);
		setFormPhone(sr.phone || '');
		setFormIsActive(sr.isActive);
		setShowroomFormError('');
		setShowShowroomModal(true);
	};

	const handleShowroomFormSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!formName.trim()) {
			setShowroomFormError('Showroom name is required.');
			return;
		}
		if (!formAddress.trim()) {
			setShowroomFormError('Showroom address is required.');
			return;
		}

		const cleanPhone = formPhone.replace(/\D/g, '').slice(0, 10);
		if (cleanPhone && cleanPhone.length !== 10) {
			setShowroomFormError('Phone number must be exactly 10 digits without country code.');
			return;
		}

		if (editingShowroom) {
			updateShowroomMutation.mutate({
				id: editingShowroom.id,
				data: {
					name: formName.trim(),
					address: formAddress.trim(),
					phone: cleanPhone || undefined,
					isActive: formIsActive,
				},
			});
		} else {
			createShowroomMutation.mutate({
				name: formName.trim(),
				address: formAddress.trim(),
				phone: cleanPhone || undefined,
				isActive: formIsActive,
			});
		}
	};

	const openAddStaffModal = () => {
		setSelectedStaffId('');
		setStaffVehiclesInput(0);
		setStaffSearchTerm('');
		setAddStaffError('');
		setShowAddStaffModal(true);
	};

	const handleAssignStaffSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedStaffId) {
			setAddStaffError('Please select a staff member.');
			return;
		}

		assignStaffMutation.mutate({
			staffId: selectedStaffId,
			date: selectedDate,
			vehiclesAttended: Math.max(0, staffVehiclesInput),
		});
	};

	const handleVehiclesChange = (assignmentId: string, newCount: number) => {
		const safeCount = Math.max(0, newCount);
		setLocalVehicleCounts((prev) => ({ ...prev, [assignmentId]: safeCount }));
		updateVehiclesMutation.mutate({ assignmentId, count: safeCount });
	};

	const shiftDate = (days: number) => {
		setSelectedDate((prev) => addDays(prev, days));
	};

	const jumpToDateWorkspace = (dateStr: string) => {
		const cleanDate = dateStr.split('T')[0];
		setSelectedDate(cleanDate);
		setActiveDetailTab('daily');
	};

	// Daily Bill handlers
	const openSetBillModal = () => {
		setBillAmountInput(dailyBillData && dailyBillData.amount > 0 ? String(dailyBillData.amount) : '');
		setBillNotesInput(dailyBillData?.notes || '');
		setSetBillError('');
		setShowSetBillModal(true);
	};

	const handleSetBillSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const amount = parseFloat(billAmountInput);
		if (isNaN(amount) || amount < 0) {
			setSetBillError('Please enter a valid bill amount (₹0 or greater).');
			return;
		}

		const received = dailyBillData?.amountReceived ?? 0;
		if (amount < received) {
			setSetBillError(`Bill amount cannot be less than already received payments (${formatINR(received)}).`);
			return;
		}

		setDailyBillMutation.mutate({
			amount,
			notes: billNotesInput.trim() || undefined,
		});
	};

	// Payment handlers
	const openRecordPaymentModal = () => {
		const balance = dailyBillData?.balanceAmount ?? 0;
		setPaymentAmountInput(balance > 0 ? String(balance) : '');
		setPaymentMethod('Cash');
		setPaymentReference('');
		setPaymentNotes('');
		setRecordPaymentError('');
		setShowRecordPaymentModal(true);
	};

	const handleRecordPaymentSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const amount = parseFloat(paymentAmountInput);
		if (isNaN(amount) || amount <= 0) {
			setRecordPaymentError('Please enter a valid payment amount greater than ₹0.');
			return;
		}

		const remaining = dailyBillData?.balanceAmount ?? 0;
		if (amount > remaining) {
			setRecordPaymentError(`Payment amount (${formatINR(amount)}) cannot exceed remaining balance (${formatINR(remaining)}).`);
			return;
		}

		recordPaymentMutation.mutate({
			amount,
			paymentMethod,
			reference: paymentReference.trim() || undefined,
			notes: paymentNotes.trim() || undefined,
		});
	};

	// ── VIEW 1: Showrooms Directory & Outstanding Overview ───────────────────
	if (!selectedShowroom) {
		return (
			<div className="space-y-6">
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-semibold text-on-surface tracking-tight flex items-center gap-2.5">
							<Building2 className="w-6 h-6 text-secondary" />
							Showrooms Master &amp; Operations
						</h1>
						<p className="text-sm text-on-surface-variant mt-0.5">
							Manage customer showroom master records, daily staff rosters, vehicle attendance, history, and billing
						</p>
					</div>

					<div className="flex items-center gap-2">
						{/* Master Tabs */}
						<div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant/60">
							<button
								type="button"
								onClick={() => setMasterTab('directory')}
								className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
									masterTab === 'directory'
										? 'bg-secondary text-white shadow-xs font-semibold'
										: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
								}`}
							>
								<Layers className="w-3.5 h-3.5" />
								Showroom Directory
							</button>
							<button
								type="button"
								onClick={() => setMasterTab('outstanding')}
								className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
									masterTab === 'outstanding'
										? 'bg-secondary text-white shadow-xs font-semibold'
										: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
								}`}
							>
								<TrendingUp className="w-3.5 h-3.5" />
								Outstanding Summary
							</button>
						</div>

						<Button
							variant="primary"
							icon={<Plus className="w-4 h-4" />}
							onClick={openCreateShowroomModal}
							className="shadow-xs cursor-pointer shrink-0"
						>
							Add Showroom
						</Button>
					</div>
				</div>

				{/* ── TAB 1: SHOWROOM DIRECTORY ───────────────────────────────────────── */}
				{masterTab === 'directory' && (
					<>
						{/* Filter Toolbar */}
						<div className="flex flex-col sm:flex-row items-center gap-3">
							<div className="w-full sm:w-72">
								<SearchInput
									placeholder="Search by showroom name, address, or phone..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
								/>
							</div>

							<div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/60">
								{(['all', 'active', 'inactive'] as const).map((filter) => (
									<button
										key={filter}
										onClick={() => setStatusFilter(filter)}
										className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize cursor-pointer ${
											statusFilter === filter
												? 'bg-secondary text-white shadow-xs font-semibold'
												: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
										}`}
									>
										{filter}
									</button>
								))}
							</div>
						</div>

						{/* Showrooms Master Table */}
						<div className="app-card overflow-hidden">
							<div className="overflow-x-auto">
								<table className="app-table">
									<thead>
										<tr>
											<th>Showroom Name</th>
											<th>Address</th>
											<th>Contact Phone</th>
											<th>Status</th>
											<th className="text-center">Staff Today</th>
											<th className="text-center">Vehicles Today</th>
											<th className="text-right">Actions</th>
										</tr>
									</thead>
									<tbody>
										{showroomsLoading && (
											<tr>
												<td colSpan={7} className="py-12 text-center text-on-surface-variant">
													Loading showrooms...
												</td>
											</tr>
										)}

										{!showroomsLoading && showrooms.length === 0 && (
											<tr>
												<td colSpan={7} className="py-16 text-center">
													<div className="max-w-xs mx-auto text-center space-y-3">
														<Building2 className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
														<div>
															<p className="text-sm font-medium text-on-surface">No showrooms found</p>
															<p className="text-xs text-on-surface-variant mt-0.5">
																{search
																	? 'No showrooms match your search filter.'
																	: 'Get started by creating your first showroom master record.'}
															</p>
														</div>
														{!search && (
															<Button
																variant="primary"
																icon={<Plus className="w-4 h-4" />}
																onClick={openCreateShowroomModal}
															>
																Create Showroom
															</Button>
														)}
													</div>
												</td>
											</tr>
										)}

										{!showroomsLoading &&
											showrooms.map((sr) => (
												<tr
													key={sr.id}
													className="hover:bg-surface-container/40 transition-colors cursor-pointer group"
													onClick={() => {
														setSelectedShowroom(sr);
														setActiveDetailTab('daily');
													}}
												>
													{/* Name */}
													<td className="font-semibold text-on-surface text-sm">
														<div className="flex items-center gap-2">
															<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs shrink-0">
																{sr.name.slice(0, 2).toUpperCase()}
															</div>
															<div>
																<p className="font-semibold text-on-surface group-hover:text-secondary transition-colors">
																	{sr.name}
																</p>
																<span className="text-[11px] text-on-surface-variant">
																	Click to open workspace &amp; history
																</span>
															</div>
														</div>
													</td>

													{/* Address */}
													<td className="text-on-surface-variant text-xs max-w-xs truncate">
														<div className="flex items-center gap-1.5">
															<MapPin className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0" />
															<span className="truncate">{sr.address}</span>
														</div>
													</td>

													{/* Phone */}
													<td className="text-on-surface-variant text-xs font-mono">
														{sr.phone ? (
															<div className="flex items-center gap-1.5">
																<Phone className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0" />
																<span>{sr.phone}</span>
															</div>
														) : (
															'—'
														)}
													</td>

													{/* Status */}
													<td>
														<span
															onClick={(e) => {
																e.stopPropagation();
																toggleActiveMutation.mutate(sr.id);
															}}
															className="cursor-pointer"
															title="Click to toggle active/inactive"
														>
															<StatusBadge
																status={sr.isActive ? 'Active' : 'Inactive'}
															/>
														</span>
													</td>

													{/* Staff Today */}
													<td className="text-center">
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
															<Users className="w-3 h-3" />
															{sr.activeStaffCountToday}
														</span>
													</td>

													{/* Vehicles Today */}
													<td className="text-center">
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
															<Car className="w-3 h-3" />
															{sr.totalVehiclesToday}
														</span>
													</td>

													{/* Actions */}
													<td className="text-right" onClick={(e) => e.stopPropagation()}>
														<div className="flex items-center justify-end gap-1.5">
															<button
																type="button"
																onClick={() => {
																	setSelectedShowroom(sr);
																	setActiveDetailTab('daily');
																}}
																className="text-secondary hover:text-secondary/80 hover:bg-secondary/10 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
																title="Open daily workspace"
															>
																Workspace
															</button>
															<button
																type="button"
																onClick={() => openEditShowroomModal(sr)}
																className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container p-1.5 rounded transition-colors cursor-pointer"
																title="Edit showroom master"
															>
																<Edit2 className="w-3.5 h-3.5" />
															</button>
															<button
																type="button"
																onClick={() => setDeletingShowroom(sr)}
																className="text-error hover:text-error/80 hover:bg-error/10 p-1.5 rounded transition-colors cursor-pointer"
																title="Delete showroom"
															>
																<Trash2 className="w-3.5 h-3.5" />
															</button>
														</div>
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						</div>
					</>
				)}

				{/* ── TAB 2: OVERALL SHOWROOMS OUTSTANDING OVERVIEW ────────────────────── */}
				{masterTab === 'outstanding' && (
					<div className="space-y-4">
						<div className="app-card p-4 bg-surface-container-low/40 border border-outline-variant/60 flex items-center justify-between">
							<div>
								<h2 className="text-base font-semibold text-on-surface">Overall Showroom Outstanding Balances</h2>
								<p className="text-xs text-on-surface-variant mt-0.5">
									Management summary tracking billed amounts, collections received, and pending balances across all active showrooms
								</p>
							</div>
							<div className="text-right">
								<span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
									Total Outstanding Across All Showrooms:
								</span>
								<p className="text-xl font-bold text-amber-700 font-mono mt-0.5">
									{formatINR(outstandingList.reduce((s, o) => s + (o.outstandingAmount || 0), 0))}
								</p>
							</div>
						</div>

						<div className="app-card overflow-hidden">
							<div className="overflow-x-auto">
								<table className="app-table">
									<thead>
										<tr>
											<th>Showroom Name</th>
											<th>Address</th>
											<th>Phone</th>
											<th className="text-right">Total Billed</th>
											<th className="text-right">Total Received</th>
											<th className="text-right">Outstanding Balance</th>
											<th className="text-center">Unpaid Days</th>
											<th className="text-right">Action</th>
										</tr>
									</thead>
									<tbody>
										{outstandingLoading && (
											<tr>
												<td colSpan={8} className="py-12 text-center text-on-surface-variant">
													Loading outstanding summary...
												</td>
											</tr>
										)}

										{!outstandingLoading && outstandingList.length === 0 && (
											<tr>
												<td colSpan={8} className="py-16 text-center text-on-surface-variant">
													No active showrooms found.
												</td>
											</tr>
										)}

										{!outstandingLoading &&
											outstandingList.map((item) => (
												<tr key={item.showroomId} className="hover:bg-surface-container/30 transition-colors">
													<td className="font-semibold text-sm text-on-surface">
														{item.showroomName}
													</td>
													<td className="text-xs text-on-surface-variant max-w-xs truncate">
														{item.address}
													</td>
													<td className="text-xs font-mono text-on-surface-variant">
														{item.phone || '—'}
													</td>
													<td className="text-right text-xs font-mono font-medium text-on-surface">
														{formatINR(item.totalBilled)}
													</td>
													<td className="text-right text-xs font-mono font-medium text-emerald-700">
														{formatINR(item.totalReceived)}
													</td>
													<td className="text-right text-xs font-mono font-bold">
														<span
															className={
																item.outstandingAmount > 0 ? 'text-amber-700 font-bold' : 'text-on-surface-variant'
															}
														>
															{formatINR(item.outstandingAmount)}
														</span>
													</td>
													<td className="text-center">
														{item.unpaidDaysCount > 0 ? (
															<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
																{item.unpaidDaysCount} days
															</span>
														) : (
															<span className="text-xs text-emerald-700 font-medium">All Settled</span>
														)}
													</td>
													<td className="text-right">
														<button
															type="button"
															onClick={() => {
																const sr = showrooms.find((s) => s.id === item.showroomId);
																if (sr) {
																	setSelectedShowroom(sr);
																	setActiveDetailTab('history');
																}
															}}
															className="text-secondary hover:text-secondary/80 hover:bg-secondary/10 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
														>
															View History
														</button>
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* ── MODAL: CREATE / EDIT SHOWROOM ────────────────────────────── */}
				{showShowroomModal && (
					<Dialog
						open={showShowroomModal}
						onOpenChange={(open) => {
							if (!open && !createShowroomMutation.isPending && !updateShowroomMutation.isPending) {
								setShowShowroomModal(false);
							}
						}}
						title={editingShowroom ? 'Edit Showroom Master' : 'Add New Showroom'}
						description="Permanent customer showroom master record. Daily staff assignments and bills attach to this showroom."
						size="md"
					>
						<form onSubmit={handleShowroomFormSubmit} className="space-y-4 pt-2">
							{showroomFormError && (
								<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
									<AlertCircle className="w-4 h-4 shrink-0" />
									<span>{showroomFormError}</span>
								</div>
							)}

							<div className="space-y-1.5">
								<label className="text-xs font-medium text-on-surface">Showroom Name *</label>
								<input
									type="text"
									placeholder="e.g. Erode Showroom"
									value={formName}
									onChange={(e) => setFormName(e.target.value)}
									className="form-input w-full text-xs"
									required
								/>
							</div>

							<div className="space-y-1.5">
								<label className="text-xs font-medium text-on-surface">Full Address *</label>
								<textarea
									placeholder="e.g. 142 Brough Road, Erode, Tamil Nadu 638001"
									value={formAddress}
									onChange={(e) => setFormAddress(e.target.value)}
									className="form-input w-full text-xs min-h-[70px]"
									required
								/>
							</div>

							<div className="space-y-1.5">
								<label className="text-xs font-medium text-on-surface">Contact Phone (Optional)</label>
								<input
									type="tel"
									inputMode="numeric"
									maxLength={10}
									placeholder="e.g. 9876543210"
									value={formPhone}
									onChange={(e) => setFormPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
									className="form-input w-full text-xs font-mono"
								/>
							</div>

							<div className="flex items-center gap-2 pt-1">
								<input
									type="checkbox"
									id="showroomIsActive"
									checked={formIsActive}
									onChange={(e) => setFormIsActive(e.target.checked)}
									className="rounded text-secondary focus:ring-secondary/30"
								/>
								<label htmlFor="showroomIsActive" className="text-xs font-medium text-on-surface cursor-pointer">
									Showroom is Active &amp; operational
								</label>
							</div>

							<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
								<Button
									type="button"
									variant="ghost"
									onClick={() => setShowShowroomModal(false)}
									disabled={createShowroomMutation.isPending || updateShowroomMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="primary"
									loading={createShowroomMutation.isPending || updateShowroomMutation.isPending}
								>
									{editingShowroom ? 'Save Changes' : 'Create Showroom'}
								</Button>
							</div>
						</form>
					</Dialog>
				)}

				{/* ── MODAL: DELETE SHOWROOM CONFIRMATION ──────────────────────── */}
				{deletingShowroom && (
					<Dialog
						open={!!deletingShowroom}
						onOpenChange={(open) => {
							if (!open && !deleteShowroomMutation.isPending) setDeletingShowroom(null);
						}}
						title="Delete Showroom"
						description={`Are you sure you want to delete "${deletingShowroom.name}"? This action can be undone by an administrator.`}
						size="sm"
					>
						<div className="pt-2 space-y-4">
							<div className="p-3 rounded-lg bg-error-container/40 border border-error/20 text-xs text-error flex items-start gap-2.5">
								<AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
								<span>
									All associated daily assignments and payment history for this showroom will also be archived.
								</span>
							</div>

							<div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/60">
								<Button
									type="button"
									variant="ghost"
									onClick={() => setDeletingShowroom(null)}
									disabled={deleteShowroomMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									type="button"
									variant="danger"
									loading={deleteShowroomMutation.isPending}
									onClick={() => deleteShowroomMutation.mutate(deletingShowroom.id)}
								>
									Delete Showroom
								</Button>
							</div>
						</div>
					</Dialog>
				)}
			</div>
		);
	}

	// ── VIEW 2: Showroom Detail (Daily Workspace + History + Staff Productivity)
	return (
		<div className="space-y-6">
			{/* ── Workspace Header ────────────────────────────────────────────────── */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant/60">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setSelectedShowroom(null)}
						className="p-2 rounded-lg bg-white border border-outline-variant/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer shadow-2xs"
						title="Back to Showrooms List"
					>
						<ArrowLeft className="w-4 h-4" />
					</button>

					<div>
						<div className="flex items-center gap-2.5">
							<h1 className="text-xl font-bold text-on-surface tracking-tight">
								{selectedShowroom.name}
							</h1>
							<StatusBadge
								status={selectedShowroom.isActive ? 'Active' : 'Inactive'}
							/>
						</div>
						<p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
							<MapPin className="w-3.5 h-3.5 shrink-0" />
							<span>{selectedShowroom.address}</span>
							{selectedShowroom.phone && (
								<>
									<span className="mx-1">•</span>
									<Phone className="w-3.5 h-3.5 shrink-0" />
									<span className="font-mono">{selectedShowroom.phone}</span>
								</>
							)}
						</p>
					</div>
				</div>

				{/* Detail Workspace View Tabs */}
				<div className="flex items-center bg-white p-1 rounded-xl border border-outline-variant/80 shadow-2xs">
					<button
						type="button"
						onClick={() => setActiveDetailTab('daily')}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
							activeDetailTab === 'daily'
								? 'bg-secondary text-white shadow-xs font-semibold'
								: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
						}`}
					>
						<Calendar className="w-3.5 h-3.5" />
						Daily Workspace
					</button>
					<button
						type="button"
						onClick={() => setActiveDetailTab('history')}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
							activeDetailTab === 'history'
								? 'bg-secondary text-white shadow-xs font-semibold'
								: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
						}`}
					>
						<History className="w-3.5 h-3.5" />
						History &amp; Summary
					</button>
					<button
						type="button"
						onClick={() => setActiveDetailTab('staff')}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
							activeDetailTab === 'staff'
								? 'bg-secondary text-white shadow-xs font-semibold'
								: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
						}`}
					>
						<Users className="w-3.5 h-3.5" />
						Staff Productivity
					</button>
				</div>
			</div>

			{/* ══════════════════════════════════════════════════════════════════════
			    TAB 1: DAILY WORKSPACE (Operations & Billing on Selected Date)
			══════════════════════════════════════════════════════════════════════ */}
			{activeDetailTab === 'daily' && (
				<div className="space-y-6">
					{/* Interactive Date Selector Bar */}
					<div className="flex items-center justify-between bg-surface-container-low/60 p-3 rounded-xl border border-outline-variant/60">
						<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
							Active Date: <strong className="text-on-surface text-sm normal-case">{formatDateHeading(selectedDate)}</strong>
						</span>

						<div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-outline-variant/80 shadow-2xs">
							<button
								type="button"
								onClick={() => shiftDate(-1)}
								className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
								title="Previous day (1 day before)"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>

							<div className="flex items-center gap-1.5 px-2">
								<Calendar className="w-3.5 h-3.5 text-secondary shrink-0" />
								<input
									type="date"
									value={selectedDate}
									onChange={(e) => setSelectedDate(e.target.value)}
									className="text-xs font-semibold text-on-surface bg-transparent border-0 outline-hidden cursor-pointer"
								/>
							</div>

							<button
								type="button"
								onClick={() => shiftDate(1)}
								className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
								title="Next day (1 day after)"
							>
								<ChevronRight className="w-4 h-4" />
							</button>

							<button
								type="button"
								onClick={() => setSelectedDate(getTodayStr())}
								className="ml-1 text-[11px] font-semibold text-secondary hover:underline px-2 py-0.5 rounded hover:bg-secondary/10 transition-colors cursor-pointer"
							>
								Today
							</button>
						</div>
					</div>

					{/* Top Daily Metric Cards (Staff + Financial Summary Banner) */}
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
						{/* 1: Staff Count */}
						<div className="app-card p-3.5 border-l-4 border-l-secondary flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Staff Assigned
								</p>
								<p className="text-xl font-bold text-on-surface mt-0.5">
									{dailyStaffData?.staffAssignments?.length ?? 0}
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
								<Users className="w-4 h-4" />
							</div>
						</div>

						{/* 2: Vehicles Attended */}
						<div className="app-card p-3.5 border-l-4 border-l-blue-600 flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Vehicles Attended
								</p>
								<p className="text-xl font-bold text-blue-600 mt-0.5">{liveTotalVehicles}</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
								<Car className="w-4 h-4" />
							</div>
						</div>

						{/* 3: Showroom Amount Charged */}
						<div className="app-card p-3.5 border-l-4 border-l-purple-600 flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Billed Amount
								</p>
								<p className="text-xl font-bold text-purple-700 mt-0.5">
									{formatINR(dailyBillData?.amount ?? 0)}
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
								<IndianRupee className="w-4 h-4" />
							</div>
						</div>

						{/* 4: Amount Received */}
						<div className="app-card p-3.5 border-l-4 border-l-emerald-600 flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Received
								</p>
								<p className="text-xl font-bold text-emerald-600 mt-0.5">
									{formatINR(dailyBillData?.amountReceived ?? 0)}
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
								<CheckCircle2 className="w-4 h-4" />
							</div>
						</div>

						{/* 5: Balance Remaining */}
						<div className="app-card p-3.5 border-l-4 border-l-amber-600 flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Balance
								</p>
								<p className="text-xl font-bold text-amber-700 mt-0.5">
									{formatINR(dailyBillData?.balanceAmount ?? 0)}
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
								<Clock className="w-4 h-4" />
							</div>
						</div>

						{/* 6: Payment Status */}
						<div className="app-card p-3.5 flex flex-col justify-center">
							<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
								Payment Status
							</p>
							<div>{getPaymentStatusBadge(dailyBillData?.status ?? 'Unpaid')}</div>
						</div>
					</div>

					{/* ── ATTENDANCE CONFIRMATION STATUS BANNER ──────────────────────── */}
					{(() => {
						const isConfirmed = dailyStaffData?.isAttendanceConfirmed ?? false;
						const isLocked = isConfirmed && !isCorrectionMode;

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
												Confirmed by <strong className="font-semibold text-emerald-900">{dailyStaffData?.attendanceConfirmedByName || 'Authorized User'}</strong> • {formatDateTime(dailyStaffData?.attendanceConfirmedAt)}
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
										</div>
									</div>

									<Button
										type="button"
										variant="primary"
										size="sm"
										icon={<CheckCircle2 className="w-3.5 h-3.5" />}
										loading={confirmAttendanceMutation.isPending}
										onClick={() => confirmAttendanceMutation.mutate()}
										className="shrink-0 bg-purple-700 hover:bg-purple-800"
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
											Attendance and vehicle counts can still be edited.
										</p>
									</div>
								</div>

								{(isOwner || hasPermission('showroom.confirm_attendance')) && (
									<Button
										type="button"
										variant="primary"
										size="sm"
										icon={<CheckCircle2 className="w-3.5 h-3.5" />}
										loading={confirmAttendanceMutation.isPending}
										onClick={() => confirmAttendanceMutation.mutate()}
										className="shrink-0"
									>
										Confirm Attendance
									</Button>
								)}
							</div>
						);
					})()}

					{/* ── SECTION 1: DAILY STAFF ASSIGNMENTS TABLE ───────────────────────── */}
					{(() => {
						const isConfirmed = dailyStaffData?.isAttendanceConfirmed ?? false;
						const isLocked = isConfirmed && !isCorrectionMode;

						return (
							<div className="app-card overflow-hidden">
								<div className="p-4 border-b border-outline-variant/60 flex items-center justify-between">
									<div>
										<h2 className="text-base font-semibold text-on-surface">Staff Attendance &amp; Vehicles Attended</h2>
										<p className="text-xs text-on-surface-variant mt-0.5">
											Operational roster for <span className="font-semibold text-on-surface">{formatDateHeading(selectedDate)}</span>
										</p>
									</div>
									<Button
										variant="secondary"
										size="sm"
										icon={<Plus className="w-3.5 h-3.5" />}
										disabled={isLocked}
										onClick={openAddStaffModal}
									>
										Assign Staff
									</Button>
								</div>

								<div className="overflow-x-auto">
									<table className="app-table">
										<thead>
											<tr>
												<th>Staff</th>
												<th>Phone</th>
												<th>Role</th>
												<th className="w-60 text-center">Vehicles Attended</th>
												<th className="text-right">Actions</th>
											</tr>
										</thead>
										<tbody>
											{dailyStaffLoading && (
												<tr>
													<td colSpan={5} className="py-12 text-center text-on-surface-variant">
														Loading staff assignments for {formatDateHeading(selectedDate)}...
													</td>
												</tr>
											)}

											{!dailyStaffLoading && (!dailyStaffData?.staffAssignments || dailyStaffData.staffAssignments.length === 0) && (
												<tr>
													<td colSpan={5} className="py-16 text-center">
														<div className="max-w-xs mx-auto text-center space-y-3">
															<Users className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
															<div>
																<p className="text-sm font-medium text-on-surface">No staff assigned yet</p>
																<p className="text-xs text-on-surface-variant mt-0.5">
																	No staff members have been assigned to {selectedShowroom.name} on {formatDateHeading(selectedDate)}.
																</p>
															</div>
															{!isLocked && (
																<Button
																	variant="primary"
																	icon={<UserPlus className="w-4 h-4" />}
																	onClick={openAddStaffModal}
																>
																	Assign First Staff
																</Button>
															)}
														</div>
													</td>
												</tr>
											)}

											{!dailyStaffLoading &&
												dailyStaffData?.staffAssignments?.map((assignment) => {
													const currentCount =
														localVehicleCounts[assignment.id] !== undefined
															? localVehicleCounts[assignment.id]
															: assignment.vehiclesAttended;

													return (
														<tr key={assignment.id} className="hover:bg-surface-container/30 transition-colors">
															<td>
																<div className="flex items-center gap-3">
																	<div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-bold shrink-0">
																		{assignment.staffName
																			.split(' ')
																			.map((n) => n[0])
																			.slice(0, 2)
																			.join('')
																			.toUpperCase()}
																	</div>
																	<div>
																		<p className="font-semibold text-sm text-on-surface">{assignment.staffName}</p>
																		<p className="text-xs text-on-surface-variant">Staff ID: {assignment.staffId.slice(0, 8)}</p>
																	</div>
																</div>
															</td>

															<td className="text-sm text-on-surface-variant font-mono">
																{assignment.staffPhone || '—'}
															</td>

															<td>
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-container text-on-surface-variant">
																	{assignment.staffRole || 'Technician'}
																</span>
															</td>

															<td className="text-center">
																{isLocked ? (
																	<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container/80 border border-outline-variant/60 text-on-surface">
																		<Lock className="w-3.5 h-3.5 text-slate-400" />
																		<span className="font-bold text-sm font-mono">{currentCount}</span>
																	</div>
																) : (
																	<div className="inline-flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-outline-variant/80">
																		<button
																			type="button"
																			onClick={() => handleVehiclesChange(assignment.id, currentCount - 1)}
																			disabled={currentCount <= 0}
																			className="w-7 h-7 rounded-md bg-white border border-outline-variant/80 flex items-center justify-center text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
																			title="Decrease vehicle count"
																		>
																			<Minus className="w-3.5 h-3.5" />
																		</button>

																		<input
																			type="number"
																			min={0}
																			value={currentCount}
																			onChange={(e) => {
																				const val = parseInt(e.target.value, 10);
																				handleVehiclesChange(assignment.id, isNaN(val) ? 0 : val);
																			}}
																			className="w-14 text-center font-bold text-sm text-on-surface bg-transparent outline-hidden"
																			title="Directly edit vehicle count"
																		/>

																		<button
																			type="button"
																			onClick={() => handleVehiclesChange(assignment.id, currentCount + 1)}
																			className="w-7 h-7 rounded-md bg-white border border-outline-variant/80 flex items-center justify-center text-on-surface hover:bg-surface-container transition-all cursor-pointer"
																			title="Increase vehicle count"
																		>
																			<Plus className="w-3.5 h-3.5" />
																		</button>
																	</div>
																)}
															</td>

															<td className="text-right">
																{isLocked ? (
																	<span className="text-xs text-slate-400 font-medium inline-flex items-center justify-end gap-1">
																		<Lock className="w-3 h-3" /> Locked
																	</span>
																) : (
																	<button
																		type="button"
																		onClick={() => setDeletingAssignment(assignment)}
																		className="text-error hover:text-error/80 hover:bg-error/10 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
																		title="Remove staff assignment"
																	>
																		<Trash2 className="w-3.5 h-3.5" />
																		Remove
																	</button>
																)}
															</td>
														</tr>
													);
												})}
										</tbody>
									</table>
								</div>

								{/* Bottom Staff Summary Bar */}
								{dailyStaffData?.staffAssignments && dailyStaffData.staffAssignments.length > 0 && (
									<div className="p-4 bg-surface-container-low/60 border-t border-outline-variant/60 flex items-center justify-between">
										<span className="text-xs font-medium text-on-surface-variant">
											{dailyStaffData.staffAssignments.length} staff assigned on {formatDateHeading(selectedDate)}
										</span>
										<div className="flex items-center gap-2">
											<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
												Total Vehicles Attended:
											</span>
											<span className="text-base font-bold text-blue-600 bg-blue-50 px-3 py-0.5 rounded-md border border-blue-200">
												{liveTotalVehicles}
											</span>
										</div>
									</div>
								)}
							</div>
						);
					})()}

					{/* ── SECTION 2: SHOWROOM DAILY FINANCIAL BILLING & PAYMENTS ─────────── */}
					<div className="app-card overflow-hidden">
						{/* Financial Section Header */}
						<div className="p-4 border-b border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low/40">
							<div>
								<div className="flex items-center gap-2">
									<Receipt className="w-5 h-5 text-secondary" />
									<h2 className="text-base font-semibold text-on-surface">
										Daily Showroom Bill &amp; Payment Transactions
									</h2>
								</div>
								<p className="text-xs text-on-surface-variant mt-0.5">
									Financial billing and payments belong to <strong className="text-on-surface">{selectedShowroom.name}</strong> for <strong className="text-on-surface">{formatDateHeading(selectedDate)}</strong> as a whole.
								</p>
							</div>

							<div className="flex items-center gap-2">
								<Button
									variant="secondary"
									size="sm"
									icon={<Edit2 className="w-3.5 h-3.5" />}
									onClick={openSetBillModal}
								>
									{dailyBillData && dailyBillData.amount > 0 ? 'Edit Bill Amount' : 'Set Bill Amount'}
								</Button>

								<Button
									variant="primary"
									size="sm"
									icon={<Plus className="w-3.5 h-3.5" />}
									onClick={openRecordPaymentModal}
									disabled={!dailyBillData || dailyBillData.amount <= 0 || dailyBillData.balanceAmount <= 0}
								>
									Record Payment
								</Button>
							</div>
						</div>

						{/* Financial Summary Strip */}
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border-b border-outline-variant/60 bg-white">
							<div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/60 flex items-center justify-between">
								<div>
									<span className="text-xs text-on-surface-variant font-medium">Showroom Amount Charged</span>
									<p className="text-lg font-bold text-on-surface mt-0.5">
										{formatINR(dailyBillData?.amount ?? 0)}
									</p>
								</div>
								<button
									type="button"
									onClick={openSetBillModal}
									className="text-secondary text-xs hover:underline cursor-pointer font-medium"
								>
									Change
								</button>
							</div>

							<div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200/80 flex items-center justify-between">
								<div>
									<span className="text-xs text-emerald-800 font-medium">Amount Received</span>
									<p className="text-lg font-bold text-emerald-700 mt-0.5">
										{formatINR(dailyBillData?.amountReceived ?? 0)}
									</p>
								</div>
								<span className="text-xs text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded font-mono">
									{dailyBillData?.payments?.length ?? 0} {dailyBillData?.payments?.length === 1 ? 'txn' : 'txns'}
								</span>
							</div>

							<div className="p-3.5 rounded-lg bg-amber-50/50 border border-amber-200/80 flex items-center justify-between">
								<div>
									<span className="text-xs text-amber-800 font-medium">Remaining Balance</span>
									<p className="text-lg font-bold text-amber-700 mt-0.5">
										{formatINR(dailyBillData?.balanceAmount ?? 0)}
									</p>
								</div>
								{dailyBillData && dailyBillData.balanceAmount <= 0 && dailyBillData.amount > 0 && (
									<span className="text-xs text-emerald-700 font-medium">Fully Paid</span>
								)}
							</div>

							<div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/60 flex flex-col justify-center">
								<span className="text-xs text-on-surface-variant font-medium mb-1">Current Status</span>
								<div>{getPaymentStatusBadge(dailyBillData?.status ?? 'Unpaid')}</div>
							</div>
						</div>

						{/* Payment Transactions Table */}
						<div className="overflow-x-auto">
							<table className="app-table">
								<thead>
									<tr>
										<th>Payment Date</th>
										<th>Method</th>
										<th>Reference / Txn ID</th>
										<th>Notes</th>
										<th className="text-right">Amount</th>
										<th className="text-right">Actions</th>
									</tr>
								</thead>
								<tbody>
									{dailyBillLoading && (
										<tr>
											<td colSpan={6} className="py-8 text-center text-on-surface-variant text-xs">
												Loading payment history...
											</td>
										</tr>
									)}

									{!dailyBillLoading && (!dailyBillData?.payments || dailyBillData.payments.length === 0) && (
										<tr>
											<td colSpan={6} className="py-12 text-center">
												<div className="max-w-sm mx-auto text-center space-y-2.5">
													<Receipt className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
													<div>
														<p className="text-sm font-medium text-on-surface">No payments recorded for this date</p>
														<p className="text-xs text-on-surface-variant mt-0.5">
															{dailyBillData && dailyBillData.amount > 0
																? `Amount charged is ${formatINR(dailyBillData.amount)}. Click "Record Payment" to log payment installments.`
																: 'Set the daily showroom bill amount first to begin recording payments.'}
														</p>
													</div>
													{dailyBillData && dailyBillData.amount > 0 && dailyBillData.balanceAmount > 0 && (
														<Button
															variant="primary"
															size="sm"
															icon={<Plus className="w-3.5 h-3.5" />}
															onClick={openRecordPaymentModal}
														>
															Record First Payment
														</Button>
													)}
												</div>
											</td>
										</tr>
									)}

									{!dailyBillLoading &&
										dailyBillData?.payments?.map((payment) => (
											<tr key={payment.id} className="hover:bg-surface-container/30 transition-colors">
												<td className="text-xs text-on-surface font-medium">
													{new Date(payment.paymentDate).toLocaleString('en-IN', {
														day: 'numeric',
														month: 'short',
														year: 'numeric',
														hour: '2-digit',
														minute: '2-digit',
													})}
												</td>

												<td>
													<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-secondary/10 text-secondary">
														{payment.paymentMethod}
													</span>
												</td>

												<td className="text-xs font-mono text-on-surface-variant">
													{payment.reference || '—'}
												</td>

												<td className="text-xs text-on-surface-variant max-w-xs truncate">
													{payment.notes || '—'}
												</td>

												<td className="text-right text-xs font-bold text-emerald-700 font-mono">
													{formatINR(payment.amount)}
												</td>

												<td className="text-right">
													<button
														type="button"
														onClick={() => setDeletingPayment(payment)}
														className="text-error hover:text-error/80 hover:bg-error/10 px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
														title="Void payment"
													>
														<Trash2 className="w-3 h-3" />
														Void
													</button>
												</td>
											</tr>
										))}
								</tbody>
							</table>
						</div>

						{/* Bottom Payment Summary Footer */}
						{dailyBillData && dailyBillData.payments && dailyBillData.payments.length > 0 && (
							<div className="p-4 bg-surface-container-low/60 border-t border-outline-variant/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
								<span className="text-on-surface-variant font-medium">
									Total {dailyBillData.payments.length} payment transaction(s) recorded for {formatDateHeading(selectedDate)}
								</span>
								<div className="flex items-center gap-4">
									<div>
										<span className="text-on-surface-variant font-medium mr-1.5">Total Received:</span>
										<span className="font-bold text-emerald-700 font-mono text-sm">
											{formatINR(dailyBillData.amountReceived)}
										</span>
									</div>
									<div>
										<span className="text-on-surface-variant font-medium mr-1.5">Balance:</span>
										<span className="font-bold text-amber-700 font-mono text-sm">
											{formatINR(dailyBillData.balanceAmount)}
										</span>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* ══════════════════════════════════════════════════════════════════════
			    TAB 2: HISTORY & MONTHLY SUMMARY (Multi-day Analysis & Reports)
			══════════════════════════════════════════════════════════════════════ */}
			{activeDetailTab === 'history' && (
				<div className="space-y-6">
					{/* Range Filter Toolbar */}
					<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/60">
						<div>
							<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
								<History className="w-4 h-4 text-secondary" />
								Showroom Activity &amp; Financial History
							</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Performance from <strong className="text-on-surface">{formatDateHeading(historyBounds.start)}</strong> to <strong className="text-on-surface">{formatDateHeading(historyBounds.end)}</strong>
							</p>
						</div>

						{/* Presets */}
						<div className="flex flex-wrap items-center gap-2">
							<div className="flex items-center bg-white p-1 rounded-lg border border-outline-variant/80 shadow-2xs">
								{(
									[
										{ id: 'today', label: 'Today' },
										{ id: 'this_week', label: 'This Week' },
										{ id: 'this_month', label: 'This Month' },
										{ id: 'last_month', label: 'Last Month' },
										{ id: 'custom', label: 'Custom' },
									] as const
								).map((p) => (
									<button
										key={p.id}
										onClick={() => setHistoryPreset(p.id)}
										className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
											historyPreset === p.id
												? 'bg-secondary text-white shadow-xs font-semibold'
												: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
										}`}
									>
										{p.label}
									</button>
								))}
							</div>

							{historyPreset === 'custom' && (
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
						</div>
					</div>

					{/* ── Summary KPI Cards ──────────────────────────────────────────────── */}
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
						{/* Card 1: Active Days */}
						<div className="app-card p-3.5 border-l-4 border-l-secondary flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Active Days
								</p>
								<p className="text-xl font-bold text-on-surface mt-0.5">
									{summaryData?.totalDaysWithActivity ?? 0}
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
								<Calendar className="w-4 h-4" />
							</div>
						</div>

						{/* Card 2: Total Staff Assignments */}
						<div className="app-card p-3.5 border-l-4 border-l-indigo-600 flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Staff Assignments
								</p>
								<p className="text-xl font-bold text-indigo-700 mt-0.5">
									{summaryData?.totalStaffAssignments ?? 0}
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
								<Users className="w-4 h-4" />
							</div>
						</div>

						{/* Card 3: Total Vehicles Attended */}
						<div className="app-card p-3.5 border-l-4 border-l-blue-600 flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Total Vehicles
								</p>
								<p className="text-xl font-bold text-blue-600 mt-0.5">
									{summaryData?.totalVehiclesAttended ?? 0}
								</p>
								<p className="text-[10px] text-on-surface-variant mt-0.5">
									Avg: {summaryData?.averageVehiclesPerDay ?? 0} / day
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
								<Car className="w-4 h-4" />
							</div>
						</div>

						{/* Card 4: Total Billed */}
						<div className="app-card p-3.5 border-l-4 border-l-purple-600 flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Total Billed
								</p>
								<p className="text-xl font-bold text-purple-700 mt-0.5">
									{formatINR(summaryData?.totalBilled ?? 0)}
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
								<IndianRupee className="w-4 h-4" />
							</div>
						</div>

						{/* Card 5: Total Received */}
						<div className="app-card p-3.5 border-l-4 border-l-emerald-600 flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
									Total Received
								</p>
								<p className="text-xl font-bold text-emerald-600 mt-0.5">
									{formatINR(summaryData?.totalReceived ?? 0)}
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
								<CheckCircle2 className="w-4 h-4" />
							</div>
						</div>

						{/* Card 6: Outstanding Balance */}
						<div className="app-card p-3.5 border-l-4 border-l-amber-600 flex items-center justify-between bg-amber-50/20">
							<div>
								<p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
									Outstanding
								</p>
								<p className="text-xl font-bold text-amber-700 mt-0.5">
									{formatINR(summaryData?.outstandingAmount ?? 0)}
								</p>
							</div>
							<div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
								<Clock className="w-4 h-4" />
							</div>
						</div>
					</div>

					{/* Payment Status Days Pill Breakdown */}
					<div className="app-card p-4 flex flex-wrap items-center justify-between gap-4 bg-white">
						<div className="flex items-center gap-2">
							<Receipt className="w-4 h-4 text-on-surface-variant" />
							<span className="text-xs font-semibold text-on-surface">Payment Status Breakdown:</span>
						</div>
						<div className="flex items-center gap-3">
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
								<CheckCircle2 className="w-3.5 h-3.5" />
								Paid: {summaryData?.paidDaysCount ?? 0} days
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
								<Clock className="w-3.5 h-3.5" />
								Partially Paid: {summaryData?.partiallyPaidDaysCount ?? 0} days
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
								<AlertCircle className="w-3.5 h-3.5" />
								Unpaid: {summaryData?.unpaidDaysCount ?? 0} days
							</span>
						</div>
					</div>

					{/* ── Daily History Table ────────────────────────────────────────────── */}
					<div className="app-card overflow-hidden">
						<div className="p-4 border-b border-outline-variant/60 flex items-center justify-between">
							<div>
								<h3 className="text-base font-semibold text-on-surface">Daily Activity &amp; Billing History</h3>
								<p className="text-xs text-on-surface-variant mt-0.5">
									Click &quot;View&quot; on any day to open its operational workspace and manage roster/payments
								</p>
							</div>
						</div>

						<div className="overflow-x-auto">
							<table className="app-table">
								<thead>
									<tr>
										<th>Date</th>
										<th className="text-center">Staff Count</th>
										<th className="text-center">Vehicles Attended</th>
										<th className="text-right">Billed Amount</th>
										<th className="text-right">Received Amount</th>
										<th className="text-right">Balance</th>
										<th className="text-center">Payment Status</th>
										<th className="text-right">Actions</th>
									</tr>
								</thead>
								<tbody>
									{summaryLoading && (
										<tr>
											<td colSpan={8} className="py-12 text-center text-on-surface-variant">
												Loading history records...
											</td>
										</tr>
									)}

									{!summaryLoading && (!summaryData?.dailyHistory || summaryData.dailyHistory.length === 0) && (
										<tr>
											<td colSpan={8} className="py-16 text-center text-on-surface-variant">
												<div className="max-w-xs mx-auto text-center space-y-2">
													<History className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
													<p className="text-sm font-medium text-on-surface">No activity in this date range</p>
													<p className="text-xs text-on-surface-variant">
														No staff assignments or bills were recorded between {formatDateHeading(historyBounds.start)} and {formatDateHeading(historyBounds.end)}.
													</p>
												</div>
											</td>
										</tr>
									)}

									{!summaryLoading &&
										summaryData?.dailyHistory?.map((row) => (
											<tr key={row.date} className="hover:bg-surface-container/30 transition-colors">
												<td className="font-semibold text-xs text-on-surface">
													{formatDateHeading(row.date)}
												</td>
												<td className="text-center">
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-secondary/10 text-secondary">
														<Users className="w-3 h-3" />
														{row.staffCount}
													</span>
												</td>
												<td className="text-center">
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
														<Car className="w-3 h-3" />
														{row.totalVehicles}
													</span>
												</td>
												<td className="text-right font-mono text-xs font-medium text-on-surface">
													{row.hasBill ? formatINR(row.billedAmount) : '—'}
												</td>
												<td className="text-right font-mono text-xs font-medium text-emerald-700">
													{row.hasBill ? formatINR(row.receivedAmount) : '—'}
												</td>
												<td className="text-right font-mono text-xs font-bold">
													{row.hasBill ? (
														<span className={row.balanceAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}>
															{formatINR(row.balanceAmount)}
														</span>
													) : (
														'—'
													)}
												</td>
												<td className="text-center">
													{row.hasBill ? (
														getPaymentStatusBadge(row.status)
													) : (
														<span className="text-[11px] text-on-surface-variant">No Bill</span>
													)}
												</td>
												<td className="text-right">
													<button
														type="button"
														onClick={() => jumpToDateWorkspace(row.date)}
														className="text-secondary hover:text-secondary/80 hover:bg-secondary/10 px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
														title={`Open workspace for ${formatDateHeading(row.date)}`}
													>
														<Eye className="w-3.5 h-3.5" />
														View
													</button>
												</td>
											</tr>
										))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ══════════════════════════════════════════════════════════════════════
			    TAB 3: STAFF PRODUCTIVITY (Vehicles Attended at this Showroom)
			══════════════════════════════════════════════════════════════════════ */}
			{activeDetailTab === 'staff' && (
				<div className="space-y-6">
					<div className="app-card p-4 bg-surface-container-low/40 border border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
								<Users className="w-4 h-4 text-secondary" />
								Staff Attendance &amp; Vehicle Productivity
							</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Operational productivity for <strong className="text-on-surface">{selectedShowroom.name}</strong> ({formatDateHeading(historyBounds.start)} to {formatDateHeading(historyBounds.end)})
							</p>
						</div>

						{/* Quick Presets */}
						<div className="flex items-center bg-white p-1 rounded-lg border border-outline-variant/80 shadow-2xs">
							{(
								[
									{ id: 'this_month', label: 'This Month' },
									{ id: 'last_month', label: 'Last Month' },
								] as const
							).map((p) => (
								<button
									key={p.id}
									onClick={() => setHistoryPreset(p.id)}
									className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
										historyPreset === p.id
											? 'bg-secondary text-white shadow-xs font-semibold'
											: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
									}`}
								>
									{p.label}
								</button>
							))}
						</div>
					</div>

					<div className="app-card overflow-hidden">
						<div className="overflow-x-auto">
							<table className="app-table">
								<thead>
									<tr>
										<th>Staff Member</th>
										<th>Contact Phone</th>
										<th>Role</th>
										<th className="text-center">Days Assigned</th>
										<th className="text-center">Total Vehicles Attended</th>
										<th className="text-right">Daily Average</th>
									</tr>
								</thead>
								<tbody>
									{summaryLoading && (
										<tr>
											<td colSpan={6} className="py-12 text-center text-on-surface-variant">
												Loading staff productivity...
											</td>
										</tr>
									)}

									{!summaryLoading && (!summaryData?.staffProductivity || summaryData.staffProductivity.length === 0) && (
										<tr>
											<td colSpan={6} className="py-16 text-center text-on-surface-variant">
												No staff attendance recorded in this date range.
											</td>
										</tr>
									)}

									{!summaryLoading &&
										summaryData?.staffProductivity?.map((staff) => (
											<tr key={staff.staffId} className="hover:bg-surface-container/30 transition-colors">
												<td>
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-bold shrink-0">
															{staff.staffName
																.split(' ')
																.map((n) => n[0])
																.slice(0, 2)
																.join('')
																.toUpperCase()}
														</div>
														<div>
															<p className="font-semibold text-sm text-on-surface">{staff.staffName}</p>
															<p className="text-xs text-on-surface-variant">ID: {staff.staffId.slice(0, 8)}</p>
														</div>
													</div>
												</td>

												<td className="text-xs font-mono text-on-surface-variant">
													{staff.staffPhone || '—'}
												</td>

												<td>
													<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-container text-on-surface-variant">
														{staff.staffRole || 'Technician'}
													</span>
												</td>

												<td className="text-center">
													<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
														<Calendar className="w-3 h-3" />
														{staff.daysAssigned} {staff.daysAssigned === 1 ? 'day' : 'days'}
													</span>
												</td>

												<td className="text-center">
													<span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
														<Car className="w-3.5 h-3.5" />
														{staff.totalVehiclesAttended} vehicles
													</span>
												</td>

												<td className="text-right text-xs font-mono font-bold text-on-surface">
													{staff.averageVehiclesPerDay} / day
												</td>
											</tr>
										))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ── MODALS (Reused across views) ─────────────────────────────────── */}

			{/* ── MODAL: ASSIGN DAILY STAFF ─────────────────────────────────────── */}
			{showAddStaffModal && (
				<Dialog
					open={showAddStaffModal}
					onOpenChange={(open) => {
						if (!open && !assignStaffMutation.isPending) setShowAddStaffModal(false);
					}}
					title={`Assign Staff — ${selectedShowroom.name}`}
					description={`Assign an existing staff member for ${formatDateHeading(selectedDate)}.`}
					size="md"
				>
					<form onSubmit={handleAssignStaffSubmit} className="space-y-4 pt-2">
						{addStaffError && (
							<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{addStaffError}</span>
							</div>
						)}

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Select Staff Member *</label>
							<div className="relative">
								<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
								<input
									type="text"
									placeholder="Search staff by name or phone..."
									value={staffSearchTerm}
									onChange={(e) => setStaffSearchTerm(e.target.value)}
									className="form-input pl-9 w-full text-xs"
								/>
							</div>

							<div className="max-h-48 overflow-y-auto border border-outline-variant/80 rounded-lg divide-y divide-outline-variant/40 mt-2 bg-white">
								{availableStaff.length > 0 ? (
									availableStaff.map((staff) => {
										const isAlreadyAssigned = dailyStaffData?.staffAssignments.some((a) => a.staffId === staff.id);
										const isSelected = selectedStaffId === staff.id;

										return (
											<div
												key={staff.id}
												onClick={() => {
													if (!isAlreadyAssigned) {
														setSelectedStaffId(staff.id);
														setAddStaffError('');
													}
												}}
												className={`p-2.5 flex items-center justify-between transition-colors cursor-pointer ${
													isAlreadyAssigned
														? 'opacity-40 bg-surface-container-low cursor-not-allowed'
														: isSelected
														? 'bg-secondary/10 border-l-4 border-l-secondary'
														: 'hover:bg-surface-container/40'
												}`}
											>
												<div className="flex items-center gap-2.5">
													<div className="w-7 h-7 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-xs font-bold">
														{staff.name
															.split(' ')
															.map((n) => n[0])
															.slice(0, 2)
															.join('')
															.toUpperCase()}
													</div>
													<div>
														<p className="text-xs font-semibold text-on-surface">{staff.name}</p>
														<p className="text-[11px] text-on-surface-variant font-mono">
															{staff.phoneNumber || 'No phone'}
														</p>
													</div>
												</div>

												{isAlreadyAssigned ? (
													<span className="text-[11px] text-on-surface-variant font-medium bg-surface-container px-2 py-0.5 rounded">
														Already Assigned
													</span>
												) : isSelected ? (
													<CheckCircle2 className="w-4 h-4 text-secondary" />
												) : null}
											</div>
										);
									})
								) : (
									<div className="p-4 text-center text-xs text-on-surface-variant">
										No active staff found.
									</div>
								)}
							</div>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">
								Initial Vehicles Attended (Optional)
							</label>
							<input
								type="number"
								min={0}
								value={staffVehiclesInput}
								onChange={(e) => setStaffVehiclesInput(parseInt(e.target.value, 10) || 0)}
								className="form-input w-full text-xs font-bold font-mono"
								placeholder="0"
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setShowAddStaffModal(false)}
								disabled={assignStaffMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								loading={assignStaffMutation.isPending}
								disabled={!selectedStaffId}
							>
								Assign Staff Member
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* ── MODAL: SET / EDIT DAILY SHOWROOM BILL ─────────────────────────── */}
			{showSetBillModal && (
				<Dialog
					open={showSetBillModal}
					onOpenChange={(open) => {
						if (!open && !setDailyBillMutation.isPending) setShowSetBillModal(false);
					}}
					title={`Set Showroom Daily Bill — ${selectedShowroom.name}`}
					description={`Set the total amount charged to ${selectedShowroom.name} for ${formatDateHeading(selectedDate)}.`}
					size="md"
				>
					<form onSubmit={handleSetBillSubmit} className="space-y-4 pt-2">
						{setBillError && (
							<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{setBillError}</span>
							</div>
						)}

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Showroom Billed Amount (₹) *</label>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant text-sm">
									₹
								</span>
								<input
									type="number"
									step="0.01"
									min="0"
									placeholder="e.g. 8500.00"
									value={billAmountInput}
									onChange={(e) => setBillAmountInput(e.target.value)}
									className="form-input pl-8 w-full text-base font-bold font-mono text-on-surface"
									required
									autoFocus
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Notes / Billing Remarks (Optional)</label>
							<textarea
								placeholder="e.g. Standard daily showroom package, 19 vehicles detailed."
								value={billNotesInput}
								onChange={(e) => setBillNotesInput(e.target.value)}
								className="form-input w-full text-xs min-h-[60px]"
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setShowSetBillModal(false)}
								disabled={setDailyBillMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								loading={setDailyBillMutation.isPending}
							>
								Save Bill Amount
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* ── MODAL: RECORD SHOWROOM PAYMENT ────────────────────────────────── */}
			{showRecordPaymentModal && (
				<Dialog
					open={showRecordPaymentModal}
					onOpenChange={(open) => {
						if (!open && !recordPaymentMutation.isPending) setShowRecordPaymentModal(false);
					}}
					title={`Record Payment — ${selectedShowroom.name}`}
					description={`Record a payment installment against the daily bill for ${formatDateHeading(selectedDate)}.`}
					size="md"
				>
					<form onSubmit={handleRecordPaymentSubmit} className="space-y-4 pt-2">
						{recordPaymentError && (
							<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{recordPaymentError}</span>
							</div>
						)}

						<div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant/60 text-center">
							<div>
								<span className="text-[11px] text-on-surface-variant">Billed</span>
								<p className="font-bold text-xs text-on-surface font-mono">
									{formatINR(dailyBillData?.amount ?? 0)}
								</p>
							</div>
							<div>
								<span className="text-[11px] text-emerald-800">Received</span>
								<p className="font-bold text-xs text-emerald-700 font-mono">
									{formatINR(dailyBillData?.amountReceived ?? 0)}
								</p>
							</div>
							<div>
								<span className="text-[11px] text-amber-800">Remaining</span>
								<p className="font-bold text-xs text-amber-700 font-mono">
									{formatINR(dailyBillData?.balanceAmount ?? 0)}
								</p>
							</div>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Payment Method *</label>
							<div className="grid grid-cols-4 gap-2">
								{(['Cash', 'UPI', 'Card', 'BankTransfer'] as const).map((method) => (
									<button
										key={method}
										type="button"
										onClick={() => {
											setPaymentMethod(method);
											setRecordPaymentError('');
										}}
										className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
											paymentMethod === method
												? 'border-secondary bg-secondary/10 text-secondary font-bold shadow-2xs'
												: 'border-outline-variant/80 bg-white text-on-surface hover:bg-surface-container-low'
										}`}
									>
										{method === 'BankTransfer' ? 'Bank Transfer' : method}
									</button>
								))}
							</div>
						</div>

						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<label className="text-xs font-medium text-on-surface">Payment Amount (₹) *</label>
								{dailyBillData && dailyBillData.balanceAmount > 0 && (
									<button
										type="button"
										onClick={() => setPaymentAmountInput(String(dailyBillData.balanceAmount))}
										className="text-[11px] text-secondary hover:underline cursor-pointer font-medium"
									>
										Pay Full Balance ({formatINR(dailyBillData.balanceAmount)})
									</button>
								)}
							</div>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant text-sm">
									₹
								</span>
								<input
									type="number"
									step="0.01"
									min="0.01"
									max={dailyBillData?.balanceAmount ?? 999999}
									placeholder="0.00"
									value={paymentAmountInput}
									onChange={(e) => setPaymentAmountInput(e.target.value)}
									className="form-input pl-8 w-full text-base font-bold font-mono text-emerald-700"
									required
									autoFocus
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">
								Transaction ID / Reference (Optional)
							</label>
							<input
								type="text"
								placeholder={paymentMethod === 'UPI' ? 'e.g. UPI123456789 (Optional)' : paymentMethod === 'Card' ? 'e.g. AUTH-987654 (Optional)' : 'e.g. NEFT/IMPS Ref Number (Optional)'}
								value={paymentReference}
								onChange={(e) => setPaymentReference(e.target.value)}
								className="form-input w-full text-xs font-mono"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Notes (Optional)</label>
							<input
								type="text"
								placeholder="e.g. Installment paid by showroom manager."
								value={paymentNotes}
								onChange={(e) => setPaymentNotes(e.target.value)}
								className="form-input w-full text-xs"
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setShowRecordPaymentModal(false)}
								disabled={recordPaymentMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								loading={recordPaymentMutation.isPending}
							>
								Record Payment
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* ── MODAL: REMOVE DAILY STAFF CONFIRMATION ────────────────────────── */}
			{deletingAssignment && (
				<Dialog
					open={!!deletingAssignment}
					onOpenChange={(open) => {
						if (!open && !removeAssignmentMutation.isPending) setDeletingAssignment(null);
					}}
					title="Remove Staff Assignment"
					description={`Remove "${deletingAssignment.staffName}" from ${selectedShowroom.name} for ${formatDateHeading(selectedDate)}?`}
					size="sm"
				>
					<div className="pt-2 space-y-4">
						<p className="text-xs text-on-surface-variant">
							This staff member had {deletingAssignment.vehiclesAttended} vehicles logged on this date.
						</p>

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setDeletingAssignment(null)}
								disabled={removeAssignmentMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="danger"
								loading={removeAssignmentMutation.isPending}
								onClick={() => removeAssignmentMutation.mutate(deletingAssignment.id)}
							>
								Remove Staff
							</Button>
						</div>
					</div>
				</Dialog>
			)}

			{/* ── MODAL: VOID SHOWROOM PAYMENT CONFIRMATION ─────────────────────── */}
			{deletingPayment && (
				<Dialog
					open={!!deletingPayment}
					onOpenChange={(open) => {
						if (!open && !deletePaymentMutation.isPending) setDeletingPayment(null);
					}}
					title="Void Payment Transaction"
					description={`Are you sure you want to void the payment of ${formatINR(deletingPayment.amount)} (${deletingPayment.paymentMethod})?`}
					size="sm"
				>
					<div className="pt-2 space-y-4">
						<div className="p-3 rounded-lg bg-error-container/40 border border-error/20 text-xs text-error flex items-start gap-2.5">
							<AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
							<span>
								Voiding this transaction will restore the remaining balance by {formatINR(deletingPayment.amount)}.
							</span>
						</div>

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setDeletingPayment(null)}
								disabled={deletePaymentMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="danger"
								loading={deletePaymentMutation.isPending}
								onClick={() => deletePaymentMutation.mutate(deletingPayment.id)}
							>
								Void Payment
							</Button>
						</div>
					</div>
				</Dialog>
			)}

			{/* ── MODAL: OWNER UNLOCK ATTENDANCE CONFIRMATION ──────────────────── */}
			{showUnlockModal && (
				<Dialog
					open={showUnlockModal}
					onOpenChange={(open) => {
						if (!open && !unlockAttendanceMutation.isPending) {
							setShowUnlockModal(false);
						}
					}}
					title="Unlock Daily Attendance"
					description="Owner administrative correction workflow for confirmed showroom attendance."
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
									Unlocking it will activate <strong>Administrative Correction Mode</strong>, allowing vehicle counts and staff rosters to be modified.
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
		</div>
	);
}
