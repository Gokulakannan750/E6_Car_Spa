import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	Building2,
	Calendar,
	Users,
	UserPlus,
	CheckCircle2,
	Unlock,
	Trash2,
	Edit,
	ChevronLeft,
	ChevronRight,
	AlertCircle,
	ArrowLeft,
	MapPin,
	Phone,
	CalendarCheck,
	Clock,
	ArrowRightLeft,
	History,
	Info,
	RotateCcw,
	RefreshCw,
	Lock,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { SearchInput } from '../../components/ui/SearchInput';
import { useAuth } from '../auth/auth-context';
import {
	getShowrooms,
	getDailyStaff,
	assignDailyStaff,
	updateDailyStaffAssignment,
	removeDailyStaff,
	confirmDailyStaffAttendance,
	unlockDailyStaffAttendance,
	getStaffList,
	swapStaff,
	getSwaps,
	getShowroomSwapHistory,
	getSwapById,
	reverseSwap,
	type DailyStaffAssignmentDto,
	type StaffDto,
	type ShowroomStaffSwapDto,
	type CreateStaffSwapInput,
} from '../../lib/api';
import { calculateCoverageDuration } from '../../lib/format';

// ── Date Formatting Utilities ───────────────────────────────────────────────

function getTodayStr(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function normalizeDateStr(dateStr?: string | null): string {
	if (!dateStr || typeof dateStr !== 'string') return getTodayStr();
	const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
	// Format: DD-MM-YYYY or DD/MM/YYYY
	if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(clean)) {
		const parts = clean.split(/[-/]/);
		const d = parts[0].padStart(2, '0');
		const m = parts[1].padStart(2, '0');
		const y = parts[2];
		return `${y}-${m}-${d}`;
	}
	// Format: YYYY-MM-DD or YYYY/MM/DD
	if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(clean)) {
		const parts = clean.split(/[-/]/);
		const y = parts[0];
		const m = parts[1].padStart(2, '0');
		const d = parts[2].padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return clean;
}

function addDays(dateStr: string, days: number): string {
	const normalized = normalizeDateStr(dateStr);
	const parts = normalized.split('-').map(Number);
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
	const normalized = normalizeDateStr(dateStr);
	const parts = normalized.split('-').map(Number);
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

export function ShowroomAttendancePage() {
	const qc = useQueryClient();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { isOwner, hasPermission } = useAuth();

	// Granular Permissions
	const canAssignStaff = Boolean(isOwner || hasPermission('showroom.assign_staff') || hasPermission('showroom.manage'));
	const canEditAttendance = Boolean(isOwner || hasPermission('showroom.edit_attendance') || hasPermission('showroom.assign_staff') || hasPermission('showroom.manage'));
	const canConfirmAttendance = Boolean(isOwner || hasPermission('showroom.confirm_attendance') || hasPermission('showroom.manage'));
	const canUnlockAttendance = Boolean(isOwner);

	// Read selected showroom and date from URL query parameters
	const activeShowroomId = searchParams.get('showroomId') || '';
	const urlDate = searchParams.get('date');

	// Daily date (YYYY-MM-DD)
	const [selectedDate, setSelectedDate] = useState<string>(() => normalizeDateStr(urlDate) || getTodayStr());

	// Sync date state when URL parameter changes
	useEffect(() => {
		if (urlDate) {
			const normalized = normalizeDateStr(urlDate);
			if (normalized !== selectedDate) {
				setSelectedDate(normalized);
			}
		}
	}, [urlDate]);

	// Search filter for Select Showroom landing state
	const [showroomFilter, setShowroomFilter] = useState('');

	// Add Daily Staff modal state
	const [showAddStaffModal, setShowAddStaffModal] = useState(false);
	const [selectedStaffId, setSelectedStaffId] = useState<string>('');
	const [startTime, setStartTime] = useState<string>('09:00');
	const [endTime, setEndTime] = useState<string>('18:00');
	const [assignmentType, setAssignmentType] = useState<'Regular' | 'TemporaryTransfer'>('Regular');
	const [transferReason, setTransferReason] = useState<string>('');
	const [notes, setNotes] = useState<string>('');
	const [addStaffError, setAddStaffError] = useState('');

	// Edit Daily Staff modal state
	const [editingAssignment, setEditingAssignment] = useState<DailyStaffAssignmentDto | null>(null);
	const [editStartTime, setEditStartTime] = useState<string>('09:00');
	const [editEndTime, setEditEndTime] = useState<string>('18:00');
	const [editStatus, setEditStatus] = useState<string>('Present');
	const [editTransferReason, setEditTransferReason] = useState<string>('');
	const [editNotes, setEditNotes] = useState<string>('');
	const [editError, setEditError] = useState<string>('');
	const [successNotification, setSuccessNotification] = useState<string>('');

	// Auto-dismiss success notification
	useEffect(() => {
		if (successNotification) {
			const timer = setTimeout(() => setSuccessNotification(''), 4000);
			return () => clearTimeout(timer);
		}
	}, [successNotification]);

	// Remove Daily Staff confirmation modal state
	const [deletingAssignment, setDeletingAssignment] = useState<DailyStaffAssignmentDto | null>(null);

	// Attendance Confirmation & Locking states
	const [showUnlockModal, setShowUnlockModal] = useState(false);
	const [isCorrectionMode, setIsCorrectionMode] = useState(false);

	// Staff Swap States
	const [showSwapModal, setShowSwapModal] = useState(false);
	const [swapStaffA, setSwapStaffA] = useState<DailyStaffAssignmentDto | null>(null);
	const [swapTargetShowroomId, setSwapTargetShowroomId] = useState<string>('');
	const [swapTargetStaffId, setSwapTargetStaffId] = useState<string>('');
	const [swapCoverageStartTime, setSwapCoverageStartTime] = useState<string>('14:00');
	const [swapCoverageEndTime, setSwapCoverageEndTime] = useState<string>('18:00');
	const [swapReason, setSwapReason] = useState<string>('');
	const [swapNotes, setSwapNotes] = useState<string>('');
	const [swapError, setSwapError] = useState<string>('');

	// Swap Details Modal State
	const [showSwapDetailsModal, setShowSwapDetailsModal] = useState(false);
	const [selectedSwapId, setSelectedSwapId] = useState<string | null>(null);

	// Swap History Modal State
	const [showSwapHistoryModal, setShowSwapHistoryModal] = useState(false);

	// Reverse Swap State
	const [showReverseModal, setShowReverseModal] = useState(false);
	const [reversingSwapId, setReversingSwapId] = useState<string | null>(null);
	const [reverseReason, setReverseReason] = useState<string>('');
	const [reverseError, setReverseError] = useState<string>('');

	// Reset local cache & correction mode on showroom or date change
	useEffect(() => {
		setIsCorrectionMode(false);
		setSuccessNotification('');
	}, [activeShowroomId, selectedDate]);

	// Calculate working hours live for Add modal
	const addWorkingHours = useMemo(() => {
		if (!startTime || !endTime) return null;
		const [startH, startM] = startTime.split(':').map(Number);
		const [endH, endM] = endTime.split(':').map(Number);
		if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return null;
		const startMinutes = startH * 60 + startM;
		const endMinutes = endH * 60 + endM;
		if (endMinutes <= startMinutes) return null;
		const diffMinutes = endMinutes - startMinutes;
		const hours = diffMinutes / 60;
		const wholeHours = Math.floor(hours);
		const remainingMinutes = Math.round((hours - wholeHours) * 60);
		return remainingMinutes > 0 ? `${wholeHours}h ${remainingMinutes}m` : `${wholeHours}h`;
	}, [startTime, endTime]);

	// Calculate working hours live for Edit modal
	const editWorkingHours = useMemo(() => {
		if (!editStartTime || !editEndTime) return null;
		const [startH, startM] = editStartTime.split(':').map(Number);
		const [endH, endM] = editEndTime.split(':').map(Number);
		if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return null;
		const startMinutes = startH * 60 + startM;
		const endMinutes = endH * 60 + endM;
		if (endMinutes <= startMinutes) return null;
		const diffMinutes = endMinutes - startMinutes;
		const hours = diffMinutes / 60;
		const wholeHours = Math.floor(hours);
		const remainingMinutes = Math.round((hours - wholeHours) * 60);
		return remainingMinutes > 0 ? `${wholeHours}h ${remainingMinutes}m` : `${wholeHours}h`;
	}, [editStartTime, editEndTime]);

	// ── Queries ───────────────────────────────────────────────────────────────
	const { data: showrooms = [], isLoading: showroomsLoading } = useQuery({
		queryKey: ['showrooms'],
		queryFn: () => getShowrooms(),
	});

	// Find the selected showroom from the showrooms list
	const selectedShowroom = useMemo(() => {
		if (!activeShowroomId) return null;
		return showrooms.find((s) => s.id === activeShowroomId) || null;
	}, [showrooms, activeShowroomId]);

	const { data: dailyStaffData, isLoading: dailyStaffLoading } = useQuery({
		queryKey: ['daily-staff', selectedShowroom?.id, selectedDate],
		queryFn: () => {
			if (!selectedShowroom) return null;
			return getDailyStaff(selectedShowroom.id, selectedDate);
		},
		enabled: !!selectedShowroom,
	});

	// Target Showroom Daily Staff Query for Swap modal selection
	const { data: targetShowroomDailyStaff, isLoading: targetStaffLoading } = useQuery({
		queryKey: ['daily-staff', swapTargetShowroomId, selectedDate],
		queryFn: () => {
			if (!swapTargetShowroomId) return null;
			return getDailyStaff(swapTargetShowroomId, selectedDate);
		},
		enabled: !!swapTargetShowroomId && showSwapModal,
	});

	// Swap Details Query for Traceability Modal
	const { data: swapDetails, isLoading: swapDetailsLoading, error: swapDetailsError } = useQuery({
		queryKey: ['staff-swap-details', selectedSwapId],
		queryFn: () => {
			if (!selectedSwapId) return null;
			return getSwapById(selectedSwapId);
		},
		enabled: !!selectedSwapId && showSwapDetailsModal,
	});

	// Showroom Swap History Query
	const { data: showroomSwapHistory = [], isLoading: swapHistoryLoading } = useQuery({
		queryKey: ['showroom-swap-history', selectedShowroom?.id, selectedDate],
		queryFn: () => {
			if (!selectedShowroom) return [];
			return getShowroomSwapHistory(selectedShowroom.id, selectedDate);
		},
		enabled: !!selectedShowroom && showSwapHistoryModal,
	});

	const { data: staffDirectory = [] } = useQuery({
		queryKey: ['staffDirectory'],
		queryFn: () => getStaffList(),
	});

	// Filtered staff list for the Add Staff modal (active staff members)
	const availableStaff = useMemo(() => {
		return (staffDirectory as StaffDto[]).filter((s) => s.isActive);
	}, [staffDirectory]);

	// Selected staff object in modal
	const selectedStaffObj = useMemo(() => {
		return availableStaff.find((s) => s.id === selectedStaffId) || null;
	}, [availableStaff, selectedStaffId]);

	// Auto-detect assignment type if staff's home showroom differs from current showroom
	useEffect(() => {
		if (selectedStaffObj && selectedShowroom) {
			if (selectedStaffObj.defaultShowroomId && selectedStaffObj.defaultShowroomId !== selectedShowroom.id) {
				setAssignmentType('TemporaryTransfer');
			}
		}
	}, [selectedStaffObj, selectedShowroom]);

	// ── Mutations ─────────────────────────────────────────────────────────────

	// 1. Assign Daily Staff
	const assignStaffMutation = useMutation({
		mutationFn: (data: {
			staffId: string;
			date: string;
			startTime: string;
			endTime: string;
			assignmentType: string;
			transferReason?: string;
			notes?: string;
		}) => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return assignDailyStaff(selectedShowroom.id, data);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setShowAddStaffModal(false);
			setSelectedStaffId('');
			setStartTime('09:00');
			setEndTime('18:00');
			setAssignmentType('Regular');
			setTransferReason('');
			setNotes('');
			setAddStaffError('');
		},
		onError: (err: any) => {
			setAddStaffError(err.message || 'Staff member could not be assigned.');
		},
	});

	// 2. Remove Daily Staff Assignment
	const removeAssignmentMutation = useMutation({
		mutationFn: (assignmentId: string) => removeDailyStaff(assignmentId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setDeletingAssignment(null);
			setSuccessNotification('Staff assignment removed successfully.');
		},
	});

	// 3. Update Daily Staff Assignment
	const updateAssignmentMutation = useMutation({
		mutationFn: (data: {
			id: string;
			startTime: string;
			endTime: string;
			status: string;
			transferReason?: string | null;
			notes?: string | null;
		}) => {
			return updateDailyStaffAssignment(data.id, {
				startTime: data.startTime,
				endTime: data.endTime,
				status: data.status,
				transferReason: data.transferReason,
				notes: data.notes,
			});
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setEditingAssignment(null);
			setEditError('');
			setSuccessNotification('Attendance record updated successfully.');
		},
		onError: (err: any) => {
			setEditError(err.message || 'Failed to update attendance record.');
		},
	});

	// 4. Confirm Daily Staff Attendance
	const confirmAttendanceMutation = useMutation({
		mutationFn: () => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			const assignedStaffCount = dailyStaffData?.staffAssignments?.length ?? 0;
			if (assignedStaffCount === 0) {
				throw new Error('Please assign at least one staff member before confirming attendance.');
			}
			return confirmDailyStaffAttendance(selectedShowroom.id, selectedDate);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setIsCorrectionMode(false);
		},
		onError: (err: any) => {
			alert(err.message || 'Failed to confirm attendance.');
		},
	});

	// 5. Unlock Daily Staff Attendance (Owner Correction)
	const unlockAttendanceMutation = useMutation({
		mutationFn: () => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return unlockDailyStaffAttendance(selectedShowroom.id, selectedDate);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setShowUnlockModal(false);
			setIsCorrectionMode(true);
		},
		onError: (err: any) => {
			alert(err.message || 'Failed to unlock attendance for correction.');
		},
	});

	// 6. Swap Daily Staff
	const swapStaffMutation = useMutation({
		mutationFn: (data: CreateStaffSwapInput) => swapStaff(data),
		onSuccess: (res) => {
			qc.invalidateQueries({ queryKey: ['daily-staff'] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			qc.invalidateQueries({ queryKey: ['showroom-swap-history'] });
			setShowSwapModal(false);
			setSwapStaffA(null);
			setSwapTargetShowroomId('');
			setSwapTargetStaffId('');
			setSwapReason('');
			setSwapNotes('');
			setSwapError('');
			setSuccessNotification(`Staff swap completed successfully (Swap ID: ${res.swapId}).`);
		},
		onError: (err: any) => {
			setSwapError(err.message || 'Staff swap failed.');
		},
	});

	// 7. Reverse Staff Swap
	const reverseSwapMutation = useMutation({
		mutationFn: (data: { swapId: string; reason?: string }) =>
			reverseSwap(data.swapId, { reason: data.reason }),
		onSuccess: (res) => {
			qc.invalidateQueries({ queryKey: ['daily-staff'] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			qc.invalidateQueries({ queryKey: ['showroom-swap-history'] });
			qc.invalidateQueries({ queryKey: ['staff-swap-details', res.swapId] });
			setShowSwapDetailsModal(false);
			setShowReverseModal(false);
			setReversingSwapId(null);
			setReverseReason('');
			setReverseError('');
			setSuccessNotification(`Staff swap ${res.swapId} has been reversed successfully.`);
		},
		onError: (err: any) => {
			setReverseError(err.message || 'Failed to reverse swap.');
		},
	});

	// ── Handlers ──────────────────────────────────────────────────────────────

	const handleShowroomSelect = (srId: string) => {
		if (srId) {
			setSearchParams({ showroomId: srId, date: selectedDate });
		} else {
			setSearchParams({});
		}
	};

	const handleDateChange = (newDate: string) => {
		setSelectedDate(newDate);
		if (activeShowroomId) {
			setSearchParams({ showroomId: activeShowroomId, date: newDate });
		}
	};

	const openAddStaffModal = () => {
		setSelectedStaffId('');
		setStartTime('09:00');
		setEndTime('18:00');
		setAssignmentType('Regular');
		setTransferReason('');
		setNotes('');
		setAddStaffError('');
		setShowAddStaffModal(true);
	};

	const openHandoverModal = (prev: DailyStaffAssignmentDto) => {
		setSelectedStaffId('');
		setStartTime(prev.endTime || '14:00');
		setEndTime('18:00');
		setAssignmentType('Regular');
		setTransferReason(`Shift replacement after ${prev.staffName}`);
		setNotes('');
		setAddStaffError('');
		setShowAddStaffModal(true);
	};

	const openEditModal = (assignment: DailyStaffAssignmentDto) => {
		setEditingAssignment(assignment);
		setEditStartTime(assignment.startTime || '09:00');
		setEditEndTime(assignment.endTime || '18:00');
		setEditStatus(assignment.status || 'Present');
		setEditTransferReason(assignment.transferReason || '');
		setEditNotes(assignment.notes || '');
		setEditError('');
	};

	const handleEditSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingAssignment) return;
		if (!editStartTime || !editEndTime) {
			setEditError('Start Time and End Time are required.');
			return;
		}
		if (editEndTime <= editStartTime) {
			setEditError('End Time must be later than Start Time.');
			return;
		}

		updateAssignmentMutation.mutate({
			id: editingAssignment.id,
			startTime: editStartTime,
			endTime: editEndTime,
			status: editStatus,
			transferReason: editingAssignment.assignmentType === 'TemporaryTransfer' || (editingAssignment.homeShowroomId && editingAssignment.homeShowroomId !== selectedShowroom?.id)
				? (editTransferReason.trim() || null)
				: null,
			notes: editNotes.trim() || null,
		});
	};

	const handleAddStaffSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedStaffId) {
			setAddStaffError('Please select a staff member to assign.');
			return;
		}
		if (!startTime || !endTime) {
			setAddStaffError('Start Time and End Time are required.');
			return;
		}
		if (endTime <= startTime) {
			setAddStaffError('End Time must be later than Start Time.');
			return;
		}
		if (assignmentType === 'TemporaryTransfer' && !transferReason.trim()) {
			setAddStaffError('Please provide a transfer reason for cross-showroom assignment.');
			return;
		}

		assignStaffMutation.mutate({
			staffId: selectedStaffId,
			date: selectedDate,
			startTime,
			endTime,
			assignmentType,
			transferReason: assignmentType === 'TemporaryTransfer' ? transferReason.trim() : undefined,
			notes: notes.trim() || undefined,
		});
	};

	const openSwapModal = (assignment?: DailyStaffAssignmentDto) => {
		setSwapStaffA(assignment || null);
		setSwapTargetShowroomId('');
		setSwapTargetStaffId('');
		setSwapCoverageStartTime(assignment?.startTime || '14:00');
		setSwapCoverageEndTime(assignment?.endTime || '18:00');
		setSwapReason('');
		setSwapNotes('');
		setSwapError('');
		setShowSwapModal(true);
	};

	const handleSwapSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedShowroom) return;
		if (!swapStaffA) {
			setSwapError('Please select the primary staff member (Staff A) to swap.');
			return;
		}
		if (!swapTargetShowroomId) {
			setSwapError('Please select the target showroom for the swap.');
			return;
		}
		if (swapTargetShowroomId === selectedShowroom.id) {
			setSwapError('Target showroom must be different from current showroom.');
			return;
		}
		if (!swapTargetStaffId) {
			setSwapError('Please select the replacement staff member (Staff B) in the target showroom.');
			return;
		}
		if (swapTargetStaffId === swapStaffA.staffId) {
			setSwapError('Cannot swap a staff member with themselves.');
			return;
		}

		const coverageCalc = calculateCoverageDuration(swapCoverageStartTime, swapCoverageEndTime);
		if (!coverageCalc.valid) {
			setSwapError(coverageCalc.error || 'Invalid coverage period.');
			return;
		}

		swapStaffMutation.mutate({
			date: selectedDate,
			staffAId: swapStaffA.staffId,
			showroomAId: selectedShowroom.id,
			staffBId: swapTargetStaffId,
			showroomBId: swapTargetShowroomId,
			coverageStartTime: swapCoverageStartTime,
			coverageEndTime: swapCoverageEndTime,
			reason: swapReason.trim() || undefined,
			notes: swapNotes.trim() || undefined,
		});
	};

	const openSwapDetails = (swapId: string) => {
		setSelectedSwapId(swapId);
		setShowSwapDetailsModal(true);
	};

	const openReverseModal = (swapId: string) => {
		setReversingSwapId(swapId);
		setReverseReason('');
		setReverseError('');
		setShowReverseModal(true);
	};

	const handleReverseSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!reversingSwapId) return;
		reverseSwapMutation.mutate({
			swapId: reversingSwapId,
			reason: reverseReason.trim() || undefined,
		});
	};

	// Filter showrooms for landing selection
	const filteredShowrooms = useMemo(() => {
		if (!showroomFilter.trim()) return showrooms;
		const term = showroomFilter.toLowerCase();
		return showrooms.filter(
			(sr) =>
				sr.name.toLowerCase().includes(term) ||
				sr.address.toLowerCase().includes(term) ||
				(sr.masterId && sr.masterId.toLowerCase().includes(term))
		);
	}, [showrooms, showroomFilter]);

	// ── STATE 1: No Showroom Selected — Explicit Landing State ─────────────────
	if (!selectedShowroom) {
		return (
			<div className="space-y-6">
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/60">
					<div>
						<h1 className="text-xl font-bold text-on-surface tracking-tight">Showroom Attendance</h1>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Manage daily staff roster, working hours, and cross-showroom temporary assignments
						</p>
					</div>

					<Button
						variant="ghost"
						size="sm"
						icon={<ArrowLeft className="w-4 h-4" />}
						onClick={() => navigate('/showroom')}
					>
						Back to Showrooms
					</Button>
				</div>

				{/* Search Bar */}
				<div className="card p-3">
					<SearchInput
						placeholder="Search by showroom name, address, or Master ID..."
						value={showroomFilter}
						onChange={(e) => setShowroomFilter(e.target.value)}
						className="w-full text-xs"
					/>
				</div>

				{/* Showrooms Directory Table */}
				<div className="card overflow-hidden p-0">
					<div className="overflow-x-auto">
						<table className="app-table">
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
															: 'No showrooms available to open attendance.'}
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
													<div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-secondary group-hover:text-white transition-colors">
														{sr.name.slice(0, 2).toUpperCase()}
													</div>
													<div>
														<p className="font-semibold text-xs text-on-surface group-hover:text-secondary transition-colors">
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
													icon={<CalendarCheck className="w-3.5 h-3.5" />}
													disabled={!sr.isActive}
													title={sr.isActive ? 'Open attendance for this showroom' : 'Showroom is inactive'}
													onClick={() => handleShowroomSelect(sr.id)}
												>
													Open Attendance
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

	// ── STATE 2: Showroom Selected — Full Attendance Workspace ─────────────────
	const isConfirmed = dailyStaffData?.isAttendanceConfirmed ?? false;
	const isLocked = isConfirmed && !isCorrectionMode;

	return (
		<div className="space-y-6">
			{/* ── Attendance Workspace Header ────────────────────────────────────────── */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant/60">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => navigate('/showroom/attendance')}
						className="p-2 rounded-lg bg-white border border-outline-variant/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer shadow-2xs"
						title="Back to Showroom Attendance"
					>
						<ArrowLeft className="w-4 h-4" />
					</button>

					<div>
						<div className="flex items-center gap-2.5 flex-wrap">
							<h1 className="text-xl font-bold text-on-surface tracking-tight">{selectedShowroom.name}</h1>
							<span className="font-mono text-xs font-semibold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant">
								{selectedShowroom.masterId ? `#${selectedShowroom.masterId}` : '—'}
							</span>
							{selectedShowroom.gstin && (
								<span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
									GSTIN: {selectedShowroom.gstin}
								</span>
							)}
							<StatusBadge status={selectedShowroom.isActive ? 'Active' : 'Inactive'} />
						</div>
						<p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5 flex-wrap">
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

				{/* Quick Showroom Switcher & Date Controls */}
				<div className="flex flex-wrap items-center gap-3">
					{/* Quick Showroom Switcher Dropdown */}
					<div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-outline-variant/80 shadow-2xs">
						<Building2 className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
						<select
							aria-label="Quick Switch Showroom"
							value={selectedShowroom.id}
							onChange={(e) => handleShowroomSelect(e.target.value)}
							className="text-xs font-medium text-on-surface bg-transparent border-none focus:outline-none cursor-pointer pr-4"
						>
							{showrooms.map((s) => (
								<option key={s.id} value={s.id}>
									{s.name} ({s.masterId ? `#${s.masterId}` : '—'})
								</option>
							))}
						</select>
					</div>

					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleShowroomSelect('')}
						className="text-xs text-on-surface-variant"
					>
						Change Showroom
					</Button>
				</div>
			</div>

			{/* Date Navigator Bar */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low/70 p-3 rounded-xl border border-outline-variant/50">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => handleDateChange(addDays(selectedDate, -1))}
						className="p-1.5 rounded-lg bg-white border border-outline-variant/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer"
						title="Previous Day"
					>
						<ChevronLeft className="w-4 h-4" />
					</button>

					<button
						type="button"
						onClick={() => handleDateChange(getTodayStr())}
						className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer border ${
							selectedDate === getTodayStr()
								? 'bg-secondary text-white border-secondary'
								: 'bg-white text-on-surface-variant border-outline-variant hover:bg-surface-container'
						}`}
					>
						Today
					</button>

					<button
						type="button"
						onClick={() => handleDateChange(addDays(selectedDate, 1))}
						className="p-1.5 rounded-lg bg-white border border-outline-variant/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer"
						title="Next Day"
					>
						<ChevronRight className="w-4 h-4" />
					</button>

					<span className="text-sm font-semibold text-on-surface ml-2">
						{formatDateHeading(selectedDate)}
					</span>
				</div>

				<div className="flex items-center gap-2">
					<Calendar className="w-4 h-4 text-on-surface-variant" />
					<input
						type="date"
						value={selectedDate}
						onChange={(e) => handleDateChange(e.target.value)}
						className="form-input text-xs py-1 px-2.5 bg-white border-outline-variant rounded-lg"
					/>
				</div>
			</div>

			{/* Success Notification Banner */}
			{successNotification && (
				<div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900 font-medium">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
						<span>{successNotification}</span>
					</div>
					<button
						type="button"
						onClick={() => setSuccessNotification('')}
						className="text-emerald-700 hover:text-emerald-950 text-xs font-semibold cursor-pointer"
					>
						Dismiss
					</button>
				</div>
			)}

			{/* ── Attendance Confirmation & Locking Banner ──────────────────────── */}
			{dailyStaffData && (
				<div>
					{isConfirmed ? (
						<div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
							<div className="flex items-center gap-2.5 text-emerald-800 font-medium">
								<CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
								<div>
									<p className="font-semibold text-emerald-950">
										Attendance Confirmed for {formatDateHeading(selectedDate)}
									</p>
									<p className="text-emerald-700 mt-0.5">
										Confirmed by{' '}
										<strong>{dailyStaffData.attendanceConfirmedByName || 'Manager'}</strong>
										{dailyStaffData.attendanceConfirmedAt && (
											<> at {formatDateTime(dailyStaffData.attendanceConfirmedAt)}</>
										)}
										. Staff roster and working hours are locked.
									</p>
								</div>
							</div>

							{canUnlockAttendance && isLocked && (
								<Button
									variant="secondary"
									size="sm"
									icon={<Unlock className="w-3.5 h-3.5 text-purple-700" />}
									onClick={() => setShowUnlockModal(true)}
									className="shrink-0 bg-white border-purple-200 text-purple-800 hover:bg-purple-50"
								>
									Unlock for Correction
								</Button>
							)}

							{isCorrectionMode && (
								<span className="px-2.5 py-1 rounded bg-amber-100 text-amber-800 border border-amber-300 font-semibold uppercase tracking-wider text-[10px]">
									Correction Mode Active
								</span>
							)}
						</div>
					) : (
						<div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
							<div>
								<p className="font-semibold text-on-surface">Daily Attendance Not Confirmed</p>
								<p className="text-on-surface-variant mt-0.5">
									{dailyStaffData.staffAssignments.length === 0
										? 'Please assign at least one staff member before confirming attendance.'
										: 'Review the staff roster and working hours below, then confirm attendance for the day.'}
								</p>
							</div>

							{canConfirmAttendance && (
								<Button
									variant="primary"
									size="sm"
									icon={<CheckCircle2 className="w-3.5 h-3.5" />}
									onClick={() => confirmAttendanceMutation.mutate()}
									disabled={
										dailyStaffData.staffAssignments.length === 0 || confirmAttendanceMutation.isPending
									}
									loading={confirmAttendanceMutation.isPending}
								>
									Confirm Attendance
								</Button>
							)}
						</div>
					)}
				</div>
			)}


			{/* ── Daily Staff Attendance Table ─────────────────────────────────── */}
			<div className="card space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/60">
					<div>
						<h2 className="text-sm font-semibold text-on-surface flex items-center gap-2">
							<Users className="w-4 h-4 text-secondary" />
							Daily Staff Attendance
						</h2>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Personnel roster, working hours, and attendance records for {formatDateHeading(selectedDate)}
						</p>
					</div>

					<div className="flex items-center gap-2 flex-wrap">
						<Button
							variant="ghost"
							size="sm"
							icon={<History className="w-3.5 h-3.5 text-purple-700" />}
							onClick={() => setShowSwapHistoryModal(true)}
							className="text-xs text-purple-800 hover:bg-purple-50 border border-purple-200"
							title="View swap audit history for this showroom"
						>
							Swap History
						</Button>

						{canAssignStaff && !isLocked && selectedShowroom.isActive && (
							<>
								<Button
									variant="secondary"
									size="sm"
									icon={<ArrowRightLeft className="w-3.5 h-3.5 text-purple-700" />}
									onClick={() => openSwapModal()}
									className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200"
									title="Swap a staff member with another showroom"
								>
									Swap Staff
								</Button>

								<Button
									variant="primary"
									size="sm"
									icon={<UserPlus className="w-3.5 h-3.5" />}
									onClick={openAddStaffModal}
								>
									Assign Staff
								</Button>
							</>
						)}
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left text-xs border-collapse">
						<thead>
							<tr className="border-b border-outline-variant/60 bg-surface-container-low/40">
								<th className="py-2.5 px-3 font-semibold text-on-surface-variant w-28">Staff ID</th>
								<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Staff Name</th>
								<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Role &amp; Contact</th>
								<th className="py-2.5 px-3 font-semibold text-on-surface-variant w-32">Working Time</th>
								<th className="py-2.5 px-3 font-semibold text-on-surface-variant text-center w-28">Working Hours</th>
								<th className="py-2.5 px-3 font-semibold text-on-surface-variant text-center w-32">Status</th>
								<th className="py-2.5 px-3 font-semibold text-on-surface-variant w-44">Home Showroom</th>
								<th className="py-2.5 px-3 font-semibold text-on-surface-variant text-right w-28">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-outline-variant/40">
							{dailyStaffLoading ? (
								<tr>
									<td colSpan={8} className="py-8 text-center text-on-surface-variant">
										Loading staff attendance...
									</td>
								</tr>
							) : dailyStaffData?.staffAssignments?.length === 0 ? (
								<tr>
									<td colSpan={8} className="py-12 text-center">
										<div className="max-w-xs mx-auto text-center space-y-3">
											<Users className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
											<div>
												<p className="text-sm font-medium text-on-surface">No staff attendance recorded for this date.</p>
												<p className="text-xs text-on-surface-variant mt-0.5">
													Assign staff to record working hours and enable showroom operations.
												</p>
											</div>
											{canAssignStaff && !isLocked && selectedShowroom.isActive && (
												<Button
													variant="primary"
													size="sm"
													icon={<UserPlus className="w-4 h-4" />}
													onClick={openAddStaffModal}
												>
													Assign Staff
												</Button>
											)}
										</div>
									</td>
								</tr>
							) : (
								dailyStaffData?.staffAssignments?.map((assignment) => {
									const isTransfer = assignment.assignmentType === 'TemporaryTransfer' || (assignment.homeShowroomId && assignment.homeShowroomId !== selectedShowroom.id);
									const isSwapped = Boolean(assignment.swapId);
									return (
										<tr key={assignment.id} className="hover:bg-surface-container/30 transition-colors">
											{/* Staff ID */}
											<td className="py-2.5 px-3 text-on-surface-variant font-mono text-xs">
												<span
													className="px-2 py-0.5 rounded bg-surface-container font-mono font-medium text-[11px] text-on-surface border border-outline-variant/60"
													title={assignment.staffId}
												>
													{assignment.staffMasterId ? `#${assignment.staffMasterId}` : `#ST-${assignment.staffId.slice(0, 6).toUpperCase()}`}
												</span>
											</td>

											{/* Staff Name */}
											<td className="py-2.5 px-3 font-medium text-on-surface">
												<div className="flex items-center gap-2.5">
													<div className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs shrink-0">
														{assignment.staffName.slice(0, 2).toUpperCase()}
													</div>
													<div className="flex flex-col">
														<span className="font-semibold">{assignment.staffName}</span>
														{isSwapped ? (
															<button
																type="button"
																onClick={() => openSwapDetails(assignment.swapId!)}
																className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-medium text-left transition-colors cursor-pointer group w-fit"
																title={`Swapped with ${assignment.swappedWithStaffName || 'Staff'} (Swap ID: ${assignment.swapId}). Click to view full audit details.`}
															>
																<ArrowRightLeft className="w-2.5 h-2.5 text-purple-700 shrink-0 group-hover:rotate-180 transition-transform duration-300" />
																<span>Swapped with <strong>{assignment.swappedWithStaffName || 'Staff'}</strong></span>
															</button>
														) : isTransfer ? (
															<span className="text-[10px] text-purple-700 font-medium flex items-center gap-1">
																<ArrowRightLeft className="w-3 h-3" /> Transferred In
															</span>
														) : null}
													</div>
												</div>
											</td>

											{/* Role & Contact */}
											<td className="py-2.5 px-3 text-on-surface-variant text-xs">
												<div className="flex flex-col gap-0.5">
													<span className="font-mono text-[11px]">{assignment.staffPhone || '—'}</span>
													{assignment.staffRole && (
														<span className="text-[10px] text-on-surface-variant font-medium">
															{assignment.staffRole}
														</span>
													)}
												</div>
											</td>

											{/* Working Time */}
											<td className="py-2.5 px-3 text-on-surface text-xs font-mono font-medium">
												<div className="flex items-center gap-1.5">
													<Clock className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0" />
													<span>{assignment.startTime || '09:00'} – {assignment.endTime || '18:00'}</span>
												</div>
											</td>

											{/* Working Hours */}
											<td className="py-2.5 px-3 text-center">
												<span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container font-mono text-xs font-bold text-on-surface border border-outline-variant/60">
													{assignment.workingHoursFormatted || `${assignment.workingHours ?? 9}h`}
												</span>
											</td>

											{/* Status */}
											<td className="py-2.5 px-3 text-center">
												{isSwapped ? (
													<button
														type="button"
														onClick={() => openSwapDetails(assignment.swapId!)}
														className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200 transition-colors cursor-pointer"
														title="Swapped staff assignment. Click for details."
													>
														<ArrowRightLeft className="w-2.5 h-2.5" /> Swapped
													</button>
												) : isConfirmed ? (
													<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
														<CheckCircle2 className="w-2.5 h-2.5" /> Confirmed
													</span>
												) : isTransfer ? (
													<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
														<ArrowRightLeft className="w-2.5 h-2.5" /> Temporary Transfer
													</span>
												) : assignment.status === 'HalfDay' ? (
													<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
														Half Day
													</span>
												) : assignment.status === 'Leave' ? (
													<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">
														Leave
													</span>
												) : assignment.status === 'Absent' ? (
													<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-800 border border-red-200">
														Absent
													</span>
												) : (
													<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
														Present
													</span>
												)}
											</td>

											{/* Home / Original Showroom */}
											<td className="py-2.5 px-3 text-xs">
												{isSwapped ? (
													<div className="flex flex-col">
														<span className="font-semibold text-purple-900 truncate max-w-[150px]" title={`Original showroom before swap: ${assignment.originalShowroomName || 'Other'}`}>
															Orig: {assignment.originalShowroomName || 'Other Showroom'}
														</span>
														<span className="text-[10px] text-on-surface-variant truncate max-w-[150px]" title={`Current assignment: ${selectedShowroom.name}`}>
															Now: {selectedShowroom.name}
														</span>
													</div>
												) : isTransfer ? (
													<div className="flex flex-col">
														<span className="font-semibold text-purple-900 truncate max-w-[150px]" title={assignment.homeShowroomName || 'Other'}>
															{assignment.homeShowroomName || 'Other Showroom'}
														</span>
														{assignment.transferReason && (
															<span className="text-[10px] text-on-surface-variant truncate max-w-[150px]" title={assignment.transferReason}>
																{assignment.transferReason}
															</span>
														)}
													</div>
												) : (
													<span className="text-on-surface-variant text-[11px]">
														{assignment.homeShowroomName || selectedShowroom.name}
													</span>
												)}
											</td>

											{/* Actions */}
											<td className="py-2.5 px-3 text-right">
												<div className="flex items-center justify-end gap-1">
													{isSwapped && (
														<button
															type="button"
															onClick={() => openSwapDetails(assignment.swapId!)}
															className="p-1.5 rounded text-purple-700 hover:text-purple-950 hover:bg-purple-50 transition-colors cursor-pointer"
															title="View Swap Details & Traceability"
															aria-label={`View swap details for ${assignment.staffName}`}
														>
															<Info className="w-3.5 h-3.5" />
														</button>
													)}

													{!isLocked && canAssignStaff && (
														<button
															type="button"
															onClick={() => openSwapModal(assignment)}
															className="p-1.5 rounded text-purple-700 hover:text-purple-950 hover:bg-purple-50 transition-colors cursor-pointer"
															title={`Swap ${assignment.staffName} with staff from another showroom`}
															aria-label={`Swap ${assignment.staffName}`}
														>
															<ArrowRightLeft className="w-3.5 h-3.5" />
														</button>
													)}

													{!isLocked && (canEditAttendance || canAssignStaff) && (
														<>
															{canAssignStaff && assignment.endTime && assignment.endTime < '18:00' && (
																<button
																	type="button"
																	onClick={() => openHandoverModal(assignment)}
																	className="p-1.5 rounded text-purple-700 hover:text-purple-900 hover:bg-purple-50 transition-colors cursor-pointer"
																	title={`Assign replacement staff starting at ${assignment.endTime}`}
																	aria-label={`Replace / Handover shift after ${assignment.staffName}`}
																>
																	<ArrowRightLeft className="w-3.5 h-3.5" />
																</button>
															)}
															{canEditAttendance && (
																<button
																	type="button"
																	onClick={() => openEditModal(assignment)}
																	className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
																	title="Edit attendance"
																	aria-label={`Edit ${assignment.staffName} attendance`}
																>
																	<Edit className="w-3.5 h-3.5" />
																</button>
															)}
															{canAssignStaff && (
																<button
																	type="button"
																	onClick={() => setDeletingAssignment(assignment)}
																	className="p-1.5 rounded text-error hover:bg-error-container/40 transition-colors cursor-pointer"
																	title="Remove staff assignment"
																	aria-label={`Remove ${assignment.staffName} assignment`}
																>
																	<Trash2 className="w-3.5 h-3.5" />
																</button>
															)}
														</>
													)}
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* ══════════════════════════════════════════════════════════════════════ */}
			{/* MODALS                                                                 */}
			{/* ══════════════════════════════════════════════════════════════════════ */}

			{/* MODAL 1: ASSIGN DAILY STAFF */}
			{showAddStaffModal && (
				<Dialog
					open={showAddStaffModal}
					onOpenChange={(open) => {
						if (!open && !assignStaffMutation.isPending) setShowAddStaffModal(false);
					}}
					title="Assign Staff to Showroom"
					description={`Assign personnel and scheduled shift timing to ${selectedShowroom.name} for ${formatDateHeading(selectedDate)}`}
				>
					<form onSubmit={handleAddStaffSubmit} className="space-y-4 pt-2">
						{addStaffError && (
							<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{addStaffError}</span>
							</div>
						)}

						{/* Staff Member * */}
						<div className="space-y-1.5">
							<label htmlFor="assign-staff-id" className="text-xs font-medium text-on-surface">Staff Member *</label>
							<select
								id="assign-staff-id"
								aria-label="Staff Member"
								value={selectedStaffId}
								onChange={(e) => setSelectedStaffId(e.target.value)}
								className="form-input w-full text-xs"
								required
							>
								<option value="">-- Choose staff member --</option>
								{availableStaff.map((s) => {
									const existingInCurrentShowroom = dailyStaffData?.staffAssignments.find(
										(a) => a.staffId === s.id
									);
									const statusSuffix = existingInCurrentShowroom
										? ` [Assigned here: ${existingInCurrentShowroom.startTime}–${existingInCurrentShowroom.endTime}]`
										: '';
									return (
										<option key={s.id} value={s.id}>
											{s.name} ({s.staffMasterId ? `#${s.staffMasterId}` : s.phoneNumber || 'Staff'}) — {s.defaultShowroomName ? `Home: ${s.defaultShowroomName}` : s.role || 'Technician'}{statusSuffix}
										</option>
									);
								})}
							</select>
							{availableStaff.length === 0 && (
								<p className="text-[11px] text-on-surface-variant">
									No available active staff members found.
								</p>
							)}
							{selectedStaffObj && dailyStaffData?.staffAssignments.some((a) => a.staffId === selectedStaffObj.id) && (
								<div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
									<span className="font-semibold">Existing shift in this showroom:</span> {dailyStaffData.staffAssignments.filter((a) => a.staffId === selectedStaffObj.id).map((a) => `${a.startTime}–${a.endTime}`).join(', ')}. Additional shift must not overlap with this or any other showroom.
								</div>
							)}
						</div>

						{/* Shift Presets */}
						<div className="space-y-1.5">
							<label className="text-[11px] font-medium text-on-surface-variant">Quick Shift Presets</label>
							<div className="flex flex-wrap gap-1.5">
								<button
									type="button"
									onClick={() => { setStartTime('09:00'); setEndTime('18:00'); }}
									className={`px-2.5 py-1 text-[11px] rounded-md border font-medium cursor-pointer transition-colors ${
										startTime === '09:00' && endTime === '18:00'
											? 'bg-secondary text-white border-secondary'
											: 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
									}`}
								>
									Full Day (09:00 – 18:00)
								</button>
								<button
									type="button"
									onClick={() => { setStartTime('09:00'); setEndTime('14:00'); }}
									className={`px-2.5 py-1 text-[11px] rounded-md border font-medium cursor-pointer transition-colors ${
										startTime === '09:00' && endTime === '14:00'
											? 'bg-secondary text-white border-secondary'
											: 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
									}`}
								>
									Morning (09:00 – 14:00)
								</button>
								<button
									type="button"
									onClick={() => { setStartTime('14:00'); setEndTime('18:00'); }}
									className={`px-2.5 py-1 text-[11px] rounded-md border font-medium cursor-pointer transition-colors ${
										startTime === '14:00' && endTime === '18:00'
											? 'bg-secondary text-white border-secondary'
											: 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
									}`}
								>
									Afternoon (14:00 – 18:00)
								</button>
							</div>
						</div>

						{/* Start Time & End Time */}
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label htmlFor="assign-start-time" className="text-xs font-medium text-on-surface">Start Time *</label>
								<input
									id="assign-start-time"
									aria-label="Start Time"
									type="time"
									value={startTime}
									onChange={(e) => setStartTime(e.target.value)}
									className="form-input w-full text-xs font-mono"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<label htmlFor="assign-end-time" className="text-xs font-medium text-on-surface">End Time *</label>
								<input
									id="assign-end-time"
									aria-label="End Time"
									type="time"
									value={endTime}
									onChange={(e) => setEndTime(e.target.value)}
									className="form-input w-full text-xs font-mono"
									required
								/>
							</div>
						</div>

						{/* Scheduled Duration Preview */}
						<div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/60 text-xs">
							<span className="text-on-surface-variant font-medium">Scheduled Duration:</span>
							<span className={`font-mono font-bold ${addWorkingHours ? 'text-secondary' : 'text-error'}`}>
								{addWorkingHours || 'Invalid Time (End must be after Start)'}
							</span>
						</div>

						{/* Assignment Type */}
						<div className="space-y-2">
							<label className="text-xs font-medium text-on-surface">Assignment Type *</label>
							<div className="grid grid-cols-2 gap-2">
								<label
									className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
										assignmentType === 'Regular'
											? 'border-secondary bg-secondary/5 font-semibold text-secondary'
											: 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
									}`}
								>
									<input
										type="radio"
										name="assignmentType"
										value="Regular"
										checked={assignmentType === 'Regular'}
										onChange={() => setAssignmentType('Regular')}
										className="text-secondary"
									/>
									<span>Regular</span>
								</label>

								<label
									className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
										assignmentType === 'TemporaryTransfer'
											? 'border-purple-600 bg-purple-50 font-semibold text-purple-900'
											: 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
									}`}
								>
									<input
										type="radio"
										name="assignmentType"
										value="TemporaryTransfer"
										checked={assignmentType === 'TemporaryTransfer'}
										onChange={() => setAssignmentType('TemporaryTransfer')}
										className="text-purple-600"
									/>
									<span>Temporary Transfer</span>
								</label>
							</div>
						</div>

						{/* Temporary Transfer specific details */}
						{assignmentType === 'TemporaryTransfer' && (
							<div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
								<div className="space-y-1">
									<label className="text-[11px] font-semibold text-purple-900">Home Showroom</label>
									<div className="p-2 bg-white rounded border border-purple-200 text-xs font-medium text-on-surface">
										{selectedStaffObj?.defaultShowroomName || 'Independent / General Base'}
									</div>
									<p className="text-[10px] text-purple-700">
										The staff member's permanent home showroom will remain unchanged.
									</p>
								</div>

								<div className="space-y-1">
									<label htmlFor="assign-transfer-reason" className="text-[11px] font-semibold text-purple-900">Transfer Reason *</label>
									<input
										id="assign-transfer-reason"
										aria-label="Transfer Reason"
										type="text"
										placeholder="e.g. Covering for Ramesh from 14:00 onward"
										value={transferReason}
										onChange={(e) => setTransferReason(e.target.value)}
										className="form-input w-full text-xs bg-white border-purple-200"
										required
									/>
								</div>
							</div>
						)}

						{/* Notes */}
						<div className="space-y-1.5">
							<label htmlFor="assign-notes" className="text-xs font-medium text-on-surface">Notes (Optional)</label>
							<input
								id="assign-notes"
								aria-label="Notes"
								type="text"
								placeholder="Optional shift notes..."
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								className="form-input w-full text-xs"
								maxLength={500}
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
								disabled={assignStaffMutation.isPending || !selectedStaffId}
								loading={assignStaffMutation.isPending}
							>
								Assign Staff
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* MODAL 2: REMOVE STAFF ASSIGNMENT CONFIRMATION */}
			{deletingAssignment && (
				<Dialog
					open={!!deletingAssignment}
					onOpenChange={(open) => {
						if (!open && !removeAssignmentMutation.isPending) setDeletingAssignment(null);
					}}
					title="Remove Staff Assignment"
					description={`Are you sure you want to remove ${deletingAssignment.staffName} from ${selectedShowroom.name} on ${formatDateHeading(selectedDate)}?`}
				>
					<div className="space-y-4 pt-2">
						<p className="text-xs text-on-surface-variant">
							This will remove the assignment and scheduled shift timing ({deletingAssignment.startTime || '09:00'} – {deletingAssignment.endTime || '18:00'}) for this personnel.
						</p>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
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
								onClick={() => removeAssignmentMutation.mutate(deletingAssignment.id)}
								loading={removeAssignmentMutation.isPending}
							>
								Remove Staff
							</Button>
						</div>
					</div>
				</Dialog>
			)}

			{/* MODAL 3: OWNER ATTENDANCE UNLOCK CONFIRMATION */}
			{showUnlockModal && (
				<Dialog
					open={showUnlockModal}
					onOpenChange={(open) => {
						if (!open && !unlockAttendanceMutation.isPending) setShowUnlockModal(false);
					}}
					title="Unlock Daily Attendance"
					description={`Unlock attendance for ${selectedShowroom.name} on ${formatDateHeading(selectedDate)} for administrative correction.`}
				>
					<div className="space-y-4 pt-2">
						<div className="p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-lg text-xs space-y-1">
							<p className="font-semibold">Owner Correction Mode</p>
							<p className="text-purple-700">
								Unlocking attendance allows modification of working hours and roster personnel for past records. Once corrections are completed, re-confirm attendance to lock the roster again.
							</p>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
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
								onClick={() => unlockAttendanceMutation.mutate()}
								loading={unlockAttendanceMutation.isPending}
								className="bg-purple-700 hover:bg-purple-800 text-white"
							>
								Unlock Attendance
							</Button>
						</div>
					</div>
				</Dialog>
			)}

			{/* MODAL 4: EDIT DAILY STAFF ATTENDANCE */}
			{editingAssignment && (
				<Dialog
					open={!!editingAssignment}
					onOpenChange={(open) => {
						if (!open && !updateAssignmentMutation.isPending) setEditingAssignment(null);
					}}
					title="Edit Attendance"
					description={`Update working time and attendance details for ${editingAssignment.staffName}`}
				>
					<form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
						{editError && (
							<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{editError}</span>
							</div>
						)}

						{/* Read-only Context */}
						<div className="bg-surface-container-low/80 p-3 rounded-xl border border-outline-variant/60 space-y-1.5 text-xs">
							<div className="flex items-center justify-between">
								<span className="text-on-surface-variant font-medium">Staff Member:</span>
								<span className="font-semibold text-on-surface flex items-center gap-1.5">
									{editingAssignment.staffName}
									<span className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[10px] border border-outline-variant/60">
										{editingAssignment.staffMasterId ? `#${editingAssignment.staffMasterId}` : `#ST-${editingAssignment.staffId.slice(0, 6).toUpperCase()}`}
									</span>
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-on-surface-variant font-medium">Showroom &amp; Date:</span>
								<span className="font-medium text-on-surface">
									{selectedShowroom.name} • {formatDateHeading(selectedDate)}
								</span>
							</div>
							{(editingAssignment.assignmentType === 'TemporaryTransfer' || (editingAssignment.homeShowroomId && editingAssignment.homeShowroomId !== selectedShowroom.id)) && (
								<div className="flex items-center justify-between">
									<span className="text-on-surface-variant font-medium">Home Showroom:</span>
									<span className="font-semibold text-purple-900 flex items-center gap-1">
										<ArrowRightLeft className="w-3 h-3 text-purple-600" />
										{editingAssignment.homeShowroomName || 'Other Showroom'}
									</span>
								</div>
							)}
						</div>

						{/* Attendance Status */}
						<div className="space-y-1.5">
							<label htmlFor="edit-attendance-status" className="text-xs font-medium text-on-surface">Attendance Status *</label>
							<select
								id="edit-attendance-status"
								aria-label="Attendance Status"
								value={editStatus}
								onChange={(e) => setEditStatus(e.target.value)}
								className="form-input w-full text-xs"
								required
							>
								<option value="Present">Present</option>
								<option value="HalfDay">Half Day</option>
								<option value="Leave">Leave</option>
								<option value="Absent">Absent</option>
								{(editingAssignment.assignmentType === 'TemporaryTransfer' || (editingAssignment.homeShowroomId && editingAssignment.homeShowroomId !== selectedShowroom.id)) && (
									<option value="TemporaryTransfer">Temporary Transfer</option>
								)}
							</select>
						</div>

						{/* Shift Presets in Edit Modal */}
						<div className="space-y-1.5">
							<label className="text-[11px] font-medium text-on-surface-variant">Quick Shift Presets</label>
							<div className="flex flex-wrap gap-1.5">
								<button
									type="button"
									onClick={() => { setEditStartTime('09:00'); setEditEndTime('18:00'); setEditError(''); }}
									className={`px-2.5 py-1 text-[11px] rounded-md border font-medium cursor-pointer transition-colors ${
										editStartTime === '09:00' && editEndTime === '18:00'
											? 'bg-secondary text-white border-secondary'
											: 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
									}`}
								>
									Full Day (09:00 – 18:00)
								</button>
								<button
									type="button"
									onClick={() => { setEditStartTime('09:00'); setEditEndTime('14:00'); setEditError(''); }}
									className={`px-2.5 py-1 text-[11px] rounded-md border font-medium cursor-pointer transition-colors ${
										editStartTime === '09:00' && editEndTime === '14:00'
											? 'bg-secondary text-white border-secondary'
											: 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
									}`}
								>
									Morning (09:00 – 14:00)
								</button>
								<button
									type="button"
									onClick={() => { setEditStartTime('14:00'); setEditEndTime('18:00'); setEditError(''); }}
									className={`px-2.5 py-1 text-[11px] rounded-md border font-medium cursor-pointer transition-colors ${
										editStartTime === '14:00' && editEndTime === '18:00'
											? 'bg-secondary text-white border-secondary'
											: 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
									}`}
								>
									Afternoon (14:00 – 18:00)
								</button>
							</div>
						</div>

						{/* Start Time & End Time */}
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label htmlFor="edit-start-time" className="text-xs font-medium text-on-surface flex items-center gap-1">
									<Clock className="w-3.5 h-3.5 text-on-surface-variant" />
									Start Time *
								</label>
								<input
									id="edit-start-time"
									aria-label="Start Time"
									type="time"
									value={editStartTime}
									onChange={(e) => {
										setEditStartTime(e.target.value);
										setEditError('');
									}}
									className="form-input w-full text-xs font-mono"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<label htmlFor="edit-end-time" className="text-xs font-medium text-on-surface flex items-center gap-1">
									<Clock className="w-3.5 h-3.5 text-on-surface-variant" />
									End Time *
								</label>
								<input
									id="edit-end-time"
									aria-label="End Time"
									type="time"
									value={editEndTime}
									onChange={(e) => {
										setEditEndTime(e.target.value);
										setEditError('');
									}}
									className="form-input w-full text-xs font-mono"
									required
								/>
							</div>
						</div>

						{/* Working Hours (Read-Only Auto Calculated) */}
						<div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/60 text-xs">
							<span className="text-on-surface-variant font-medium">Calculated Working Hours:</span>
							<span className={`font-mono font-bold ${editWorkingHours ? 'text-secondary' : 'text-error'}`}>
								{editWorkingHours || 'Invalid Time Range'}
							</span>
						</div>

						{/* Transfer Reason (if Temporary Transfer) */}
						{(editingAssignment.assignmentType === 'TemporaryTransfer' || (editingAssignment.homeShowroomId && editingAssignment.homeShowroomId !== selectedShowroom.id)) && (
							<div className="space-y-1.5">
								<label htmlFor="edit-transfer-reason" className="text-xs font-medium text-on-surface">Transfer Reason</label>
								<input
									id="edit-transfer-reason"
									aria-label="Transfer Reason"
									type="text"
									placeholder="e.g. Covering shift"
									value={editTransferReason}
									onChange={(e) => setEditTransferReason(e.target.value)}
									className="form-input w-full text-xs"
								/>
							</div>
						)}

						{/* Notes */}
						<div className="space-y-1.5">
							<label htmlFor="edit-notes" className="text-xs font-medium text-on-surface">Notes (Optional)</label>
							<input
								id="edit-notes"
								aria-label="Notes"
								type="text"
								placeholder="Optional attendance notes..."
								value={editNotes}
								onChange={(e) => setEditNotes(e.target.value)}
								className="form-input w-full text-xs"
								maxLength={500}
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setEditingAssignment(null)}
								disabled={updateAssignmentMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								disabled={updateAssignmentMutation.isPending || !editWorkingHours}
								loading={updateAssignmentMutation.isPending}
							>
								Save Changes
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* MODAL 5: SWAP STAFF MODAL */}
			{showSwapModal && (
				<Dialog
					open={showSwapModal}
					onOpenChange={(open) => {
						if (!open && !swapStaffMutation.isPending) setShowSwapModal(false);
					}}
					title="Swap Staff Assignment"
					description={`Exchange daily roster assignments between two staff members across showrooms for ${formatDateHeading(selectedDate)}`}
				>
					<form onSubmit={handleSwapSubmit} className="space-y-4 pt-2">
						{swapError && (
							<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{swapError}</span>
							</div>
						)}

						{/* Primary Staff Member (Staff A) */}
						<div className="space-y-1.5">
							<label htmlFor="swap-staff-a-select" className="text-xs font-medium text-on-surface">Staff Member (Showroom A: {selectedShowroom.name}) *</label>
							{swapStaffA ? (
								<div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/80 flex items-center justify-between text-xs">
									<div className="flex items-center gap-2">
										<div className="w-6 h-6 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-[11px]">
											{swapStaffA.staffName.slice(0, 2).toUpperCase()}
										</div>
										<div>
											<p className="font-semibold text-on-surface">{swapStaffA.staffName}</p>
											<p className="text-[10px] text-on-surface-variant">
												{swapStaffA.staffMasterId ? `#${swapStaffA.staffMasterId}` : swapStaffA.staffPhone || 'Staff'} • {swapStaffA.startTime}–{swapStaffA.endTime}
											</p>
										</div>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setSwapStaffA(null)}
										className="text-[11px] text-on-surface-variant hover:text-on-surface py-0.5 px-2"
									>
										Change
									</Button>
								</div>
							) : (
								<select
									id="swap-staff-a-select"
									aria-label="Primary Staff Member"
									value={swapStaffA ? (swapStaffA as DailyStaffAssignmentDto).id : ''}
									onChange={(e) => {
										const found = dailyStaffData?.staffAssignments.find((a) => a.id === e.target.value);
										setSwapStaffA(found || null);
									}}
									className="form-input w-full text-xs"
									required
								>
									<option value="">-- Choose staff member from {selectedShowroom.name} --</option>
									{dailyStaffData?.staffAssignments.map((a) => (
										<option key={a.id} value={a.id}>
											{a.staffName} ({a.staffMasterId ? `#${a.staffMasterId}` : a.staffPhone || 'Staff'}) — {a.startTime}–{a.endTime}
										</option>
									))}
								</select>
							)}
						</div>

						{/* Target Showroom (Showroom B) */}
						<div className="space-y-1.5">
							<label htmlFor="swap-target-showroom" className="text-xs font-medium text-on-surface">Target Showroom (Showroom B) *</label>
							<select
								id="swap-target-showroom"
								aria-label="Target Showroom"
								value={swapTargetShowroomId}
								onChange={(e) => {
									setSwapTargetShowroomId(e.target.value);
									setSwapTargetStaffId('');
								}}
								className="form-input w-full text-xs"
								required
							>
								<option value="">-- Select destination showroom --</option>
								{showrooms
									.filter((s) => s.id !== selectedShowroom.id && s.isActive)
									.map((s) => (
										<option key={s.id} value={s.id}>
											{s.name} ({s.masterId ? `#${s.masterId}` : s.address})
										</option>
									))}
							</select>
						</div>

						{/* Replacement Staff Member (Staff B) */}
						{swapTargetShowroomId && (
							<div className="space-y-1.5">
								<label htmlFor="swap-staff-b-select" className="text-xs font-medium text-on-surface">Replacement Staff (Staff B) *</label>
								{targetStaffLoading ? (
									<div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-lg border border-outline-variant/60">
										Loading staff in target showroom...
									</div>
								) : targetShowroomDailyStaff?.staffAssignments && targetShowroomDailyStaff.staffAssignments.length > 0 ? (
									<select
										id="swap-staff-b-select"
										aria-label="Replacement Staff"
										value={swapTargetStaffId}
										onChange={(e) => setSwapTargetStaffId(e.target.value)}
										className="form-input w-full text-xs"
										required
									>
										<option value="">-- Select staff member to swap with --</option>
										{targetShowroomDailyStaff.staffAssignments
											.filter((a) => !swapStaffA || a.staffId !== swapStaffA.staffId)
											.map((a) => (
												<option key={a.id} value={a.staffId}>
													{a.staffName} ({a.staffMasterId ? `#${a.staffMasterId}` : a.staffPhone || 'Staff'}) — {a.startTime}–{a.endTime}
												</option>
											))}
									</select>
								) : (
									<div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs space-y-1">
										<p className="font-semibold">No assigned staff in target showroom</p>
										<p className="text-[11px] text-amber-800">
											The target showroom has no staff assigned on {formatDateHeading(selectedDate)}. Please assign staff there first or choose another showroom.
										</p>
									</div>
								)}
							</div>
						)}

						{/* Swap Coverage Period */}
						<div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/70 space-y-2.5">
							<div className="flex items-center justify-between">
								<label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
									<Clock className="w-3.5 h-3.5 text-purple-700" />
									Swap Coverage Period *
								</label>
								{calculateCoverageDuration(swapCoverageStartTime, swapCoverageEndTime).valid ? (
									<span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
										Duration: {calculateCoverageDuration(swapCoverageStartTime, swapCoverageEndTime).formatted}
									</span>
								) : (
									<span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-error-container text-error">
										Invalid Period
									</span>
								)}
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<label htmlFor="swap-coverage-start-time" className="text-[11px] font-medium text-on-surface-variant">Coverage Start Time *</label>
									<input
										id="swap-coverage-start-time"
										aria-label="Coverage Start Time"
										type="time"
										value={swapCoverageStartTime}
										onChange={(e) => setSwapCoverageStartTime(e.target.value)}
										className="form-input w-full text-xs"
										required
									/>
								</div>
								<div className="space-y-1">
									<label htmlFor="swap-coverage-end-time" className="text-[11px] font-medium text-on-surface-variant">Coverage End Time *</label>
									<input
										id="swap-coverage-end-time"
										aria-label="Coverage End Time"
										type="time"
										value={swapCoverageEndTime}
										onChange={(e) => setSwapCoverageEndTime(e.target.value)}
										className="form-input w-full text-xs"
										required
									/>
								</div>
							</div>
							<p className="text-[10px] text-on-surface-variant italic">
								Temporary coverage only. Normal staff master schedules and working hours remain preserved.
							</p>
						</div>

						{/* Swap Reason */}
						<div className="space-y-1.5">
							<label htmlFor="swap-reason-input" className="text-xs font-medium text-on-surface">Reason for Swap *</label>
							<input
								id="swap-reason-input"
								aria-label="Reason for Swap"
								type="text"
								placeholder="e.g. Specialized ceramic coating coverage / urgent shift trade"
								value={swapReason}
								onChange={(e) => setSwapReason(e.target.value)}
								className="form-input w-full text-xs"
								required
								maxLength={200}
							/>
						</div>

						{/* Notes */}
						<div className="space-y-1.5">
							<label htmlFor="swap-notes-input" className="text-xs font-medium text-on-surface">Additional Notes (Optional)</label>
							<input
								id="swap-notes-input"
								aria-label="Additional Notes"
								type="text"
								placeholder="Optional operational notes..."
								value={swapNotes}
								onChange={(e) => setSwapNotes(e.target.value)}
								className="form-input w-full text-xs"
								maxLength={500}
							/>
						</div>

						{/* Preview of Swap Transaction */}
						{swapStaffA && swapTargetStaffId && swapTargetShowroomId && (
							<div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs space-y-2">
								<p className="font-semibold text-purple-950 flex items-center gap-1.5">
									<ArrowRightLeft className="w-3.5 h-3.5 text-purple-700" />
									Swap Coverage Summary
								</p>
								<div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-purple-200">
									<div>
										<span className="text-purple-800 font-medium block">Original Staff</span>
										<p className="font-bold text-on-surface">{swapStaffA.staffName}</p>
										<p className="text-[10px] text-on-surface-variant">{swapStaffA.startTime} – {swapStaffA.endTime}</p>
									</div>
									<div>
										<span className="text-purple-800 font-medium block">Replacement Staff</span>
										<p className="font-bold text-on-surface">
											{targetShowroomDailyStaff?.staffAssignments.find((a) => a.staffId === swapTargetStaffId)?.staffName || 'Replacement Staff'}
										</p>
										<p className="text-[10px] text-on-surface-variant">
											{targetShowroomDailyStaff?.staffAssignments.find((a) => a.staffId === swapTargetStaffId)?.startTime || '09:00'} – {targetShowroomDailyStaff?.staffAssignments.find((a) => a.staffId === swapTargetStaffId)?.endTime || '18:00'}
										</p>
									</div>
								</div>
								<div className="text-[11px] text-purple-950 flex items-center justify-between pt-1 border-t border-purple-200/60 font-medium">
									<span>Coverage Period: <strong>{swapCoverageStartTime} – {swapCoverageEndTime}</strong></span>
									<span>Duration: <strong>{calculateCoverageDuration(swapCoverageStartTime, swapCoverageEndTime).formatted || '4 hours'}</strong></span>
								</div>
								<p className="text-[10px] text-purple-700">
									Staff B will cover Staff A during {swapCoverageStartTime}–{swapCoverageEndTime}. Master schedules are permanently preserved.
								</p>
							</div>
						)}

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setShowSwapModal(false)}
								disabled={swapStaffMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								disabled={swapStaffMutation.isPending || !swapStaffA || !swapTargetShowroomId || !swapTargetStaffId || !swapReason.trim() || !calculateCoverageDuration(swapCoverageStartTime, swapCoverageEndTime).valid}
								loading={swapStaffMutation.isPending}
								className="bg-purple-700 hover:bg-purple-800 text-white"
							>
								Execute Staff Swap
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* MODAL 6: SWAP DETAILS / TRACEABILITY MODAL */}
			{showSwapDetailsModal && (
				<Dialog
					open={showSwapDetailsModal}
					onOpenChange={(open) => {
						if (!open) {
							setShowSwapDetailsModal(false);
							setSelectedSwapId(null);
						}
					}}
					title="Staff Swap Details & Traceability"
					description={`Transaction and audit trail for Swap ${selectedSwapId ? `#${selectedSwapId}` : ''}`}
				>
					<div className="space-y-4 pt-2">
						{swapDetailsLoading ? (
							<div className="py-12 text-center text-xs text-on-surface-variant">
								Loading swap details...
							</div>
						) : swapDetailsError || !swapDetails ? (
							<div className="p-4 bg-error-container/60 border border-error/30 text-error text-xs rounded-xl flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>Unable to retrieve swap details for Swap ID #{selectedSwapId}.</span>
							</div>
						) : (
							<div className="space-y-4">
								{/* Header Banner */}
								<div className="p-3 rounded-xl bg-purple-50/90 border border-purple-200 flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<div className="w-8 h-8 rounded-lg bg-purple-200 text-purple-900 flex items-center justify-center font-bold text-xs">
											<ArrowRightLeft className="w-4 h-4" />
										</div>
										<div>
											<p className="font-mono font-bold text-xs text-purple-950">
												#{swapDetails.swapId}
											</p>
											<p className="text-[11px] text-purple-800">
												Effective Date: {formatDateHeading(swapDetails.date)}
											</p>
										</div>
									</div>

									<span
										className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
											swapDetails.status === 'Completed'
												? 'bg-emerald-100 text-emerald-800 border-emerald-300'
												: 'bg-amber-100 text-amber-800 border-amber-300'
										}`}
									>
										{swapDetails.status}
									</span>
								</div>

								{/* Coverage Period Banner */}
								<div className="p-2.5 rounded-xl bg-purple-100/70 border border-purple-200 flex items-center justify-between text-xs">
									<div className="flex items-center gap-2">
										<Clock className="w-4 h-4 text-purple-800" />
										<span className="font-semibold text-purple-950">
											Coverage: {swapDetails.coverageStartTime || '09:00'} – {swapDetails.coverageEndTime || '18:00'}
										</span>
									</div>
									<span className="font-bold text-purple-900 bg-white px-2 py-0.5 rounded-md border border-purple-300 text-[11px]">
										Duration: {swapDetails.coverageDurationFormatted || `${swapDetails.coverageDurationHours || 4} hours`}
									</span>
								</div>

								{/* Bidirectional Swap Details Grid */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
									{/* Staff A Card */}
									<div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-2">
										<div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
											<span className="font-semibold text-on-surface flex items-center gap-1.5">
												<span className="w-5 h-5 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-[10px]">A</span>
												{swapDetails.staffAName}
											</span>
											<span className="font-mono text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.2 rounded border border-outline-variant/60">
												#{swapDetails.staffAMasterId}
											</span>
										</div>
										<div className="space-y-1 text-[11px]">
											<div className="flex justify-between">
												<span className="text-on-surface-variant">Original Showroom:</span>
												<span className="font-medium text-on-surface">{swapDetails.showroomAName}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-on-surface-variant">Assigned To:</span>
												<span className="font-semibold text-purple-900">{swapDetails.showroomBName}</span>
											</div>
											{swapDetails.staffARole && (
												<div className="flex justify-between">
													<span className="text-on-surface-variant">Role:</span>
													<span className="text-on-surface">{swapDetails.staffARole}</span>
												</div>
											)}
										</div>
									</div>

									{/* Staff B Card */}
									<div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-2">
										<div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
											<span className="font-semibold text-on-surface flex items-center gap-1.5">
												<span className="w-5 h-5 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-[10px]">B</span>
												{swapDetails.staffBName}
											</span>
											<span className="font-mono text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.2 rounded border border-outline-variant/60">
												#{swapDetails.staffBMasterId}
											</span>
										</div>
										<div className="space-y-1 text-[11px]">
											<div className="flex justify-between">
												<span className="text-on-surface-variant">Original Showroom:</span>
												<span className="font-medium text-on-surface">{swapDetails.showroomBName}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-on-surface-variant">Assigned To:</span>
												<span className="font-semibold text-purple-900">{swapDetails.showroomAName}</span>
											</div>
											{swapDetails.staffBRole && (
												<div className="flex justify-between">
													<span className="text-on-surface-variant">Role:</span>
													<span className="text-on-surface">{swapDetails.staffBRole}</span>
												</div>
											)}
										</div>
									</div>
								</div>

								{/* Audit Trail Metadata */}
								<div className="p-3 rounded-xl bg-surface-container-low/70 border border-outline-variant/60 space-y-2 text-xs">
									<p className="font-semibold text-on-surface text-[11px] uppercase tracking-wider text-on-surface-variant">
										Audit Trail Metadata
									</p>
									<div className="grid grid-cols-2 gap-2 text-[11px]">
										<div>
											<span className="text-on-surface-variant block">Performed By:</span>
											<span className="font-medium text-on-surface">{swapDetails.performedByName || 'Admin'}</span>
										</div>
										<div>
											<span className="text-on-surface-variant block">Timestamp:</span>
											<span className="font-medium text-on-surface">{formatDateTime(swapDetails.createdAt)}</span>
										</div>
									</div>

									{swapDetails.reason && (
										<div className="pt-1 text-[11px]">
											<span className="text-on-surface-variant block font-medium">Reason:</span>
											<p className="text-on-surface mt-0.5 bg-white p-2 rounded border border-outline-variant/40">
												{swapDetails.reason}
											</p>
										</div>
									)}

									{swapDetails.notes && (
										<div className="pt-1 text-[11px]">
											<span className="text-on-surface-variant block font-medium">Notes:</span>
											<p className="text-on-surface mt-0.5 bg-white p-2 rounded border border-outline-variant/40">
												{swapDetails.notes}
											</p>
										</div>
									)}
								</div>

								{/* Footer Actions */}
								<div className="flex items-center justify-between pt-4 border-t border-outline-variant/60">
									<div>
										{swapDetails.status === 'Completed' && !isLocked && canAssignStaff && (
											<Button
												type="button"
												variant="secondary"
												size="sm"
												icon={<RotateCcw className="w-3.5 h-3.5 text-amber-700" />}
												onClick={() => openReverseModal(swapDetails.swapId)}
												className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
											>
												Reverse Swap
											</Button>
										)}
										{swapDetails.status === 'Completed' && isLocked && (
											<span className="text-[11px] text-on-surface-variant flex items-center gap-1.5 italic">
												<Lock className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0" />
												Locked after attendance confirmation. Unlock for Correction before reversing this swap.
											</span>
										)}
									</div>

									<Button
										type="button"
										variant="ghost"
										onClick={() => {
											setShowSwapDetailsModal(false);
											setSelectedSwapId(null);
										}}
									>
										Close
									</Button>
								</div>
							</div>
						)}
					</div>
				</Dialog>
			)}

			{/* MODAL 7: REVERSE SWAP CONFIRMATION MODAL */}
			{showReverseModal && reversingSwapId && (
				<Dialog
					open={showReverseModal}
					onOpenChange={(open) => {
						if (!open && !reverseSwapMutation.isPending) {
							setShowReverseModal(false);
							setReversingSwapId(null);
						}
					}}
					title="Reverse Staff Swap"
					description={`Return both personnel to their original showroom assignments for Swap ID #${reversingSwapId}`}
				>
					<form onSubmit={handleReverseSubmit} className="space-y-4 pt-2">
						{reverseError && (
							<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{reverseError}</span>
							</div>
						)}

						<div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
							<p className="font-semibold">Reversal Confirmation</p>
							<p className="text-[11px] text-amber-800">
								Reversing this swap will restore both Staff A and Staff B to their respective original showroom assignments on {formatDateHeading(selectedDate)}. The transaction will be marked as <strong>Reversed</strong> in the permanent audit trail.
							</p>
						</div>

						<div className="space-y-1.5">
							<label htmlFor="reverse-reason-input" className="text-xs font-medium text-on-surface">Reason for Reversal (Optional)</label>
							<input
								id="reverse-reason-input"
								aria-label="Reason for Reversal"
								type="text"
								placeholder="e.g. Attendance schedule corrected / swap cancelled by manager"
								value={reverseReason}
								onChange={(e) => setReverseReason(e.target.value)}
								className="form-input w-full text-xs"
								maxLength={200}
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									setShowReverseModal(false);
									setReversingSwapId(null);
								}}
								disabled={reverseSwapMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								disabled={reverseSwapMutation.isPending}
								loading={reverseSwapMutation.isPending}
								className="bg-amber-700 hover:bg-amber-800 text-white"
							>
								Confirm Reversal
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* MODAL 8: SHOWROOM SWAP HISTORY MODAL */}
			{showSwapHistoryModal && (
				<Dialog
					open={showSwapHistoryModal}
					onOpenChange={(open) => {
						if (!open) setShowSwapHistoryModal(false);
					}}
					title={`Swap History — ${selectedShowroom.name}`}
					description={`Audit log of all staff swap transactions involving ${selectedShowroom.name} on ${formatDateHeading(selectedDate)}`}
				>
					<div className="space-y-4 pt-2">
						{swapHistoryLoading ? (
							<div className="py-8 text-center text-xs text-on-surface-variant">
								Loading swap history...
							</div>
						) : showroomSwapHistory.length === 0 ? (
							<div className="py-12 text-center space-y-2">
								<ArrowRightLeft className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
								<p className="text-sm font-medium text-on-surface">No staff swaps recorded</p>
								<p className="text-xs text-on-surface-variant">
									No staff swaps have been recorded for {selectedShowroom.name} on {formatDateHeading(selectedDate)}.
								</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="border-b border-outline-variant/60 bg-surface-container-low/40">
											<th className="py-2 px-2.5 font-semibold text-on-surface-variant">Swap ID</th>
											<th className="py-2 px-2.5 font-semibold text-on-surface-variant">Staff Members</th>
											<th className="py-2 px-2.5 font-semibold text-on-surface-variant">Showrooms</th>
											<th className="py-2 px-2.5 font-semibold text-on-surface-variant">Coverage</th>
											<th className="py-2 px-2.5 font-semibold text-on-surface-variant">Status</th>
											<th className="py-2 px-2.5 font-semibold text-on-surface-variant text-right">Details</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-outline-variant/40">
										{showroomSwapHistory.map((swap) => (
											<tr key={swap.id} className="hover:bg-surface-container/30 transition-colors">
												<td className="py-2.5 px-2.5 font-mono text-[11px] font-semibold text-purple-950">
													#{swap.swapId}
												</td>
												<td className="py-2.5 px-2.5">
													<span className="font-semibold">{swap.staffAName}</span>
													<span className="text-purple-700 mx-1">⇄</span>
													<span className="font-semibold">{swap.staffBName}</span>
												</td>
												<td className="py-2.5 px-2.5 text-on-surface-variant text-[11px]">
													<span>{swap.showroomAName}</span>
													<span className="text-purple-700 mx-1">⇄</span>
													<span>{swap.showroomBName}</span>
												</td>
												<td className="py-2.5 px-2.5 text-on-surface-variant text-[11px]">
													<div className="font-medium text-on-surface">
														{swap.coverageStartTime || '09:00'}–{swap.coverageEndTime || '18:00'}
													</div>
													<div className="text-[10px] text-purple-800 font-semibold">
														{swap.coverageDurationFormatted || `${swap.coverageDurationHours || 4} hours`}
													</div>
												</td>
												<td className="py-2.5 px-2.5">
													<span
														className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
															swap.status === 'Completed'
																? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
																: 'bg-amber-50 text-amber-800 border border-amber-200'
														}`}
													>
														{swap.status}
													</span>
												</td>
												<td className="py-2.5 px-2.5 text-right">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														icon={<Info className="w-3.5 h-3.5" />}
														onClick={() => {
															openSwapDetails(swap.swapId);
														}}
														className="text-xs text-purple-800 hover:bg-purple-50"
													>
														View
													</Button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						<div className="flex items-center justify-end pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setShowSwapHistoryModal(false)}
							>
								Close
							</Button>
						</div>
					</div>
				</Dialog>
			)}
		</div>
	);
}
