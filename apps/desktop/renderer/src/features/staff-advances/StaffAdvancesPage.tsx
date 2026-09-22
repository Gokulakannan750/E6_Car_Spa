import { useState, useMemo } from 'react';
import {
	Plus,
	Search,
	History,
	UserPlus,
	Calendar,
	X,
	CheckCircle2,
	AlertTriangle,
	Ban,
	Clock,
	Users,
	Wallet,
	DollarSign,
	Edit2,
	Phone,
	Mail,
	MapPin,
	RotateCcw,
	Eye,
	EyeOff,
	FileText,
	Upload,
	Trash2,
	Download,
	ShieldCheck,
	FileCheck,
	Info,
	User,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useAuth } from '../auth/auth-context';
import { capitalizeSentence } from '../../utils/text';
import {
	getStaffAdvances,
	getStaffList,
	createStaffAdvance,
	settleStaffAdvance,
	obsoleteStaffAdvance,
	getStaffAdvanceHistory,
	createStaffMember,
	updateStaffMember,
	revealStaffAadhaar,
	deleteStaffAadhaarDocument,
	downloadStaffAadhaarDocument,
	type StaffDto,
	type StaffAdvanceDto,
	type StaffAdvanceStatus,
} from '../../lib/api';

function formatAadhaarInput(val: string): string {
	const cleaned = val.replace(/\D/g, '').slice(0, 12);
	const parts = [];
	for (let i = 0; i < cleaned.length; i += 4) {
		parts.push(cleaned.slice(i, i + 4));
	}
	return parts.join(' ');
}

function normalizeAadhaar(val: string): string {
	return val.replace(/[\s-]/g, '');
}

function formatINR(value: number): string {
	return '₹' + (value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
	if (!dateStr) return '—';
	try {
		return new Date(dateStr).toLocaleDateString('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	} catch {
		return dateStr;
	}
}

type TabType = 'advances' | 'staff';
type StatusFilter = 'active' | 'Outstanding' | 'Settled' | 'Obsolete' | 'all';
type StaffStatusFilter = 'all' | 'active' | 'inactive';

const OBSOLETE_REASON_PRESETS = [
	'Wrongly entered',
	'Wrong staff selected',
	'Incorrect amount',
	'Duplicate advance',
	'Entered by mistake',
];

export function StaffAdvancesPage() {
	const qc = useQueryClient();
	const { hasPermission } = useAuth();

	const canCreate = hasPermission('staff_advances.create');
	const canSettle = hasPermission('staff_advances.settle');
	const canObsolete = hasPermission('staff_advances.obsolete');
	const canManageStaff = hasPermission('staff.create') || hasPermission('staff.edit');
	const canViewSensitive = hasPermission('staff.view_sensitive') || hasPermission('staff.view');

	const [activeTab, setActiveTab] = useState<TabType>('advances');

	// ── Advances Tab State ──────────────────────────────────────────────────
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);
	const [staffFilter, setStaffFilter] = useState('');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');

	// Create Advance Modal state
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [createStaffId, setCreateStaffId] = useState('');
	const [createAmount, setCreateAmount] = useState('');
	const [createDate, setCreateDate] = useState(new Date().toISOString().split('T')[0]);
	const [createReason, setCreateReason] = useState('Personal Advance');
	const [createNotes, setCreateNotes] = useState('');
	const [createError, setCreateError] = useState('');

	// Settle Confirmation Modal State
	const [settlingAdvance, setSettlingAdvance] = useState<StaffAdvanceDto | null>(null);
	const [settleError, setSettleError] = useState('');

	// Obsolete Confirmation Modal State
	const [obsoletingAdvance, setObsoletingAdvance] = useState<StaffAdvanceDto | null>(null);
	const [obsoleteReason, setObsoleteReason] = useState('Wrongly entered');
	const [obsoleteError, setObsoleteError] = useState('');

	// Staff Advance History Modal State
	const [viewingHistoryStaffId, setViewingHistoryStaffId] = useState<string | null>(null);

	// ── Staff Directory Tab State ────────────────────────────────────────────
	const [staffSearch, setStaffSearch] = useState('');
	const [staffStatusFilter, setStaffStatusFilter] = useState<StaffStatusFilter>('all');
	const [showStaffModal, setShowStaffModal] = useState(false);
	const [editingStaff, setEditingStaff] = useState<StaffDto | null>(null);
	const [staffFormName, setStaffFormName] = useState('');
	const [staffFormPhone, setStaffFormPhone] = useState('');
	const [staffFormEmail, setStaffFormEmail] = useState('');
	const [staffFormAddress, setStaffFormAddress] = useState('');
	const [staffFormRole, setStaffFormRole] = useState('Technician');
	const [staffFormIsActive, setStaffFormIsActive] = useState(true);
	const [staffFormAadhaar, setStaffFormAadhaar] = useState('');
	const [staffFormAadhaarFile, setStaffFormAadhaarFile] = useState<File | null>(null);
	const [staffFormRemoveDocument, setStaffFormRemoveDocument] = useState(false);
	const [staffFormIsEditingAadhaar, setStaffFormIsEditingAadhaar] = useState(false);
	const [staffFormError, setStaffFormError] = useState('');

	// Staff Details Modal State
	const [viewingDetailsStaff, setViewingDetailsStaff] = useState<StaffDto | null>(null);
	const [revealedAadhaar, setRevealedAadhaar] = useState<string | null>(null);
	const [isRevealingAadhaar, setIsRevealingAadhaar] = useState(false);
	const [revealError, setRevealError] = useState<string | null>(null);
	const [isDownloadingDoc, setIsDownloadingDoc] = useState(false);
	const [docError, setDocError] = useState<string | null>(null);

	// ── Queries ─────────────────────────────────────────────────────────────
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

	const {
		data: advancesData,
		isLoading: advancesLoading,
		error: advancesError,
	} = useQuery({
		queryKey: ['staff-advances', page, staffFilter, statusFilter, fromDate, toDate, search],
		queryFn: async () => {
			return await getStaffAdvances({
				page,
				pageSize: 20,
				staffId: staffFilter || undefined,
				status: statusFilter,
				fromDate: fromDate || undefined,
				toDate: toDate || undefined,
				search: search || undefined,
			});
		},
	});

	// Query for individual staff advance history
	const { data: staffHistoryData, isLoading: historyLoading } = useQuery({
		queryKey: ['staff-history-advances', viewingHistoryStaffId],
		queryFn: async () => {
			if (!viewingHistoryStaffId) return null;
			return await getStaffAdvanceHistory(viewingHistoryStaffId);
		},
		enabled: !!viewingHistoryStaffId,
	});

	const advances = advancesData?.items ?? [];
	const summary = advancesData?.summary ?? {
		outstandingCount: 0,
		outstandingAmount: 0,
		settledCount: 0,
		settledAmount: 0,
		totalActiveCount: 0,
		totalActiveAmount: 0,
	};
	const totalPages = advancesData ? Math.max(1, Math.ceil(advancesData.totalCount / advancesData.pageSize)) : 1;

	// ── Mutations ───────────────────────────────────────────────────────────
	const createAdvanceMutation = useMutation({
		mutationFn: createStaffAdvance,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['staff-advances'] });
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			if (viewingHistoryStaffId) {
				qc.invalidateQueries({ queryKey: ['staff-history-advances', viewingHistoryStaffId] });
			}
			setShowCreateModal(false);
			resetCreateForm();
		},
		onError: (err: Error) => {
			setCreateError(err.message || 'Failed to record staff advance.');
		},
	});

	const settleAdvanceMutation = useMutation({
		mutationFn: (id: string) => settleStaffAdvance(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['staff-advances'] });
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			if (viewingHistoryStaffId) {
				qc.invalidateQueries({ queryKey: ['staff-history-advances', viewingHistoryStaffId] });
			}
			setSettlingAdvance(null);
			setSettleError('');
		},
		onError: (err: Error) => {
			setSettleError(err.message || 'Failed to settle staff advance.');
		},
	});

	const obsoleteAdvanceMutation = useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) =>
			obsoleteStaffAdvance(id, { reason }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['staff-advances'] });
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			if (viewingHistoryStaffId) {
				qc.invalidateQueries({ queryKey: ['staff-history-advances', viewingHistoryStaffId] });
			}
			setObsoletingAdvance(null);
			setObsoleteError('');
		},
		onError: (err: Error) => {
			setObsoleteError(err.message || 'Failed to mark advance as obsolete.');
		},
	});

	const staffMutation = useMutation({
		mutationFn: async (data: {
			name: string;
			phoneNumber: string;
			email?: string | null;
			address?: string | null;
			role?: string | null;
			isActive?: boolean;
			aadhaarNumber?: string;
			aadhaarFile?: File | null;
			removeAadhaarDocument?: boolean;
		}) => {
			if (editingStaff) {
				return await updateStaffMember(editingStaff.id, data);
			} else {
				return await createStaffMember(data as any);
			}
		},
		onSuccess: (savedStaff) => {
			if (savedStaff) {
				qc.setQueryData<StaffDto[]>(['staff-list'], (old = []) => {
					const exists = old.some((s) => s.id === savedStaff.id);
					if (exists) {
						return old.map((s) => (s.id === savedStaff.id ? savedStaff : s));
					}
					return [savedStaff, ...old];
				});
			}
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			qc.refetchQueries({ queryKey: ['staff-list'] });
			if (viewingDetailsStaff && savedStaff && savedStaff.id === viewingDetailsStaff.id) {
				setViewingDetailsStaff(savedStaff);
			}
			setShowStaffModal(false);
			resetStaffForm();
		},
		onError: (err: Error) => {
			setStaffFormError(err.message || 'Failed to save staff member.');
		},
	});

	// ── Form Resets & Handlers ──────────────────────────────────────────────
	const hasActiveFilters = Boolean(search || staffFilter || statusFilter !== 'active' || fromDate || toDate);

	const resetFilters = () => {
		setSearch('');
		setStaffFilter('');
		setStatusFilter('active');
		setFromDate('');
		setToDate('');
		setPage(1);
	};

	const resetCreateForm = () => {
		setCreateStaffId('');
		setCreateAmount('');
		setCreateDate(new Date().toISOString().split('T')[0]);
		setCreateReason('Personal Advance');
		setCreateNotes('');
		setCreateError('');
	};

	const resetStaffForm = () => {
		setEditingStaff(null);
		setStaffFormName('');
		setStaffFormPhone('');
		setStaffFormEmail('');
		setStaffFormAddress('');
		setStaffFormRole('Technician');
		setStaffFormIsActive(true);
		setStaffFormAadhaar('');
		setStaffFormAadhaarFile(null);
		setStaffFormRemoveDocument(false);
		setStaffFormIsEditingAadhaar(false);
		setStaffFormError('');
	};

	const handleCreateAdvanceSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setCreateError('');

		if (!createStaffId) {
			setCreateError('Please select a staff member.');
			return;
		}

		const amt = parseFloat(createAmount);
		if (isNaN(amt) || amt <= 0) {
			setCreateError('Advance amount must be greater than ₹0.');
			return;
		}

		if (!createReason.trim()) {
			setCreateError('Please enter a reason for the advance.');
			return;
		}

		createAdvanceMutation.mutate({
			staffId: createStaffId,
			amount: amt,
			advanceDate: createDate,
			reason: capitalizeSentence(createReason.trim()),
			notes: createNotes.trim() ? capitalizeSentence(createNotes.trim()) : undefined,
		});
	};

	const handleSettleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!settlingAdvance) return;
		setSettleError('');
		settleAdvanceMutation.mutate(settlingAdvance.id);
	};

	const handleObsoleteSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!obsoletingAdvance) return;
		setObsoleteError('');

		if (!obsoleteReason.trim() || obsoleteReason.trim().length < 3) {
			setObsoleteError('A reason with at least 3 characters is mandatory to mark an advance as obsolete.');
			return;
		}

		obsoleteAdvanceMutation.mutate({
			id: obsoletingAdvance.id,
			reason: obsoleteReason.trim(),
		});
	};

	const handleStaffFormSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setStaffFormError('');

		if (!staffFormName.trim()) {
			setStaffFormError('Staff name is required.');
			return;
		}
		const cleanPhone = staffFormPhone.replace(/\D/g, '').slice(0, 10);
		if (!cleanPhone) {
			setStaffFormError('Phone number is required.');
			return;
		}
		if (cleanPhone.length !== 10) {
			setStaffFormError('Phone number must be exactly 10 digits without country code.');
			return;
		}

		const cleanAadhaar = normalizeAadhaar(staffFormAadhaar);
		if (!editingStaff) {
			if (!cleanAadhaar) {
				setStaffFormError('Aadhaar number is required for new staff members.');
				return;
			}
			if (cleanAadhaar.length !== 12 || !/^\d{12}$/.test(cleanAadhaar)) {
				setStaffFormError('Aadhaar number must be exactly 12 numeric digits.');
				return;
			}
		} else {
			if (staffFormIsEditingAadhaar && cleanAadhaar) {
				if (cleanAadhaar.length !== 12 || !/^\d{12}$/.test(cleanAadhaar)) {
					setStaffFormError('Aadhaar number must be exactly 12 numeric digits.');
					return;
				}
			}
		}

		if (staffFormAadhaarFile) {
			const ext = staffFormAadhaarFile.name.split('.').pop()?.toLowerCase();
			if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
				setStaffFormError('Unsupported file type. Only PDF, JPG, JPEG, and PNG files are allowed.');
				return;
			}
			if (staffFormAadhaarFile.size > 5 * 1024 * 1024) {
				setStaffFormError('Aadhaar document exceeds maximum allowed size of 5 MB.');
				return;
			}
		}

		staffMutation.mutate({
			name: capitalizeSentence(staffFormName.trim()),
			phoneNumber: cleanPhone,
			email: staffFormEmail.trim() || null,
			address: staffFormAddress.trim() ? capitalizeSentence(staffFormAddress.trim()) : null,
			role: staffFormRole.trim() ? capitalizeSentence(staffFormRole.trim()) : null,
			isActive: staffFormIsActive,
			aadhaarNumber: (!editingStaff || staffFormIsEditingAadhaar) && cleanAadhaar ? cleanAadhaar : undefined,
			aadhaarFile: staffFormAadhaarFile,
			removeAadhaarDocument: staffFormRemoveDocument,
		});
	};

	const handleRevealAadhaar = async (staffId: string) => {
		setRevealError(null);
		setIsRevealingAadhaar(true);
		try {
			const res = await revealStaffAadhaar(staffId);
			setRevealedAadhaar(res.aadhaarNumber);
		} catch (err: any) {
			setRevealError(err.message || 'Failed to reveal Aadhaar number.');
		} finally {
			setIsRevealingAadhaar(false);
		}
	};

	const handleDownloadDoc = async (staff: StaffDto) => {
		setDocError(null);
		setIsDownloadingDoc(true);
		try {
			await downloadStaffAadhaarDocument(staff.id, staff.aadhaarDocumentFileName || `${staff.name}-Aadhaar.pdf`);
		} catch (err: any) {
			setDocError(err.message || 'Failed to download document.');
		} finally {
			setIsDownloadingDoc(false);
		}
	};

	// ── Filtered Staff List ─────────────────────────────────────────────────
	const filteredStaff = useMemo(() => {
		let list = staffList;
		if (staffStatusFilter === 'active') list = list.filter((s) => s.isActive);
		if (staffStatusFilter === 'inactive') list = list.filter((s) => !s.isActive);

		if (staffSearch.trim()) {
			const q = staffSearch.trim().toLowerCase();
			list = list.filter(
				(s) =>
					s.name.toLowerCase().includes(q) ||
					s.phoneNumber.includes(q) ||
					(s.role && s.role.toLowerCase().includes(q)) ||
					(s.email && s.email.toLowerCase().includes(q))
			);
		}
		return list;
	}, [staffList, staffStatusFilter, staffSearch]);

	const renderStatusBadge = (status: StaffAdvanceStatus | string) => {
		if (status === 'Outstanding') {
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
					<span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
					Outstanding
				</span>
			);
		}
		if (status === 'Settled') {
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
					<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
					Settled
				</span>
			);
		}
		if (status === 'Obsolete') {
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
					<Ban className="w-3.5 h-3.5 text-slate-400" />
					Obsolete
				</span>
			);
		}
		return (
			<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
				{status}
			</span>
		);
	};

	return (
		<div className="space-y-6 animate-fade-in pb-12">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-on-surface tracking-tight">
						Staff Advances
					</h1>
					<p className="text-sm text-on-surface-variant mt-1">
						Track staff advances and settlement status
					</p>
				</div>
				<div className="flex items-center gap-2.5">
					{canCreate && (
						<Button
							icon={<Plus className="w-4 h-4" />}
							onClick={() => {
								resetCreateForm();
								setShowCreateModal(true);
							}}
						>
							Record Advance
						</Button>
					)}
					{canManageStaff && (
						<Button
							variant="secondary"
							icon={<UserPlus className="w-4 h-4" />}
							onClick={() => {
								resetStaffForm();
								setShowStaffModal(true);
							}}
						>
							Add Staff Member
						</Button>
					)}
				</div>
			</div>

			{/* Main Tab Switcher */}
			<div className="flex items-center gap-2 border-b border-outline-variant pb-px">
				<button
					onClick={() => setActiveTab('advances')}
					className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
						activeTab === 'advances'
							? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-slate-50 rounded-t-lg'
					}`}
				>
					<Wallet className="w-4 h-4" />
					<span>Advance Payments</span>
				</button>
				<button
					onClick={() => setActiveTab('staff')}
					className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
						activeTab === 'staff'
							? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
							: 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-slate-50 rounded-t-lg'
					}`}
				>
					<Users className="w-4 h-4" />
					<span>Staff Directory ({staffList.length})</span>
				</button>
			</div>

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* TAB 1: ADVANCES LIST */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			{activeTab === 'advances' && (
				<div className="space-y-5">
					{/* Summary KPI Cards — Obsolete strictly excluded from active totals */}
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						{/* Outstanding Advances */}
						<div className="app-card p-4.5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-200/60 rounded-2xl shadow-xs">
							<div className="flex items-center justify-between">
								<span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
									Outstanding Advances
								</span>
								<div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
									<Clock className="w-4 h-4" />
								</div>
							</div>
							<p className="text-2xl font-black text-amber-950 mt-2 font-mono">
								{formatINR(summary.outstandingAmount)}
							</p>
							<p className="text-xs text-amber-800/80 mt-1 font-medium">
								{summary.outstandingCount} active {summary.outstandingCount === 1 ? 'advance' : 'advances'} pending recovery
							</p>
						</div>

						{/* Settled Advances */}
						<div className="app-card p-4.5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200/60 rounded-2xl shadow-xs">
							<div className="flex items-center justify-between">
								<span className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
									Settled Amount
								</span>
								<div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center">
									<CheckCircle2 className="w-4 h-4" />
								</div>
							</div>
							<p className="text-2xl font-black text-emerald-950 mt-2 font-mono">
								{formatINR(summary.settledAmount)}
							</p>
							<p className="text-xs text-emerald-800/80 mt-1 font-medium">
								{summary.settledCount} {summary.settledCount === 1 ? 'advance' : 'advances'} recovered from salary
							</p>
						</div>

						{/* Total Active Advances */}
						<div className="app-card p-4.5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-200/60 rounded-2xl shadow-xs">
							<div className="flex items-center justify-between">
								<span className="text-xs font-semibold uppercase tracking-wider text-blue-900">
									Total Active Disbursed
								</span>
								<div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-700 flex items-center justify-center">
									<DollarSign className="w-4 h-4" />
								</div>
							</div>
							<p className="text-2xl font-black text-blue-950 mt-2 font-mono">
								{formatINR(summary.totalActiveAmount)}
							</p>
							<p className="text-xs text-blue-800/80 mt-1 font-medium">
								{summary.totalActiveCount} total active advances
							</p>
						</div>

						{/* Active Staff with Advances */}
						<div className="app-card p-4.5 bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent border-slate-200/60 rounded-2xl shadow-xs">
							<div className="flex items-center justify-between">
								<span className="text-xs font-semibold uppercase tracking-wider text-slate-800">
									Staff with Outstanding
								</span>
								<div className="w-8 h-8 rounded-xl bg-slate-500/20 text-slate-700 flex items-center justify-center">
									<Users className="w-4 h-4" />
								</div>
							</div>
							<p className="text-2xl font-black text-slate-900 mt-2 font-mono">
								{staffList.filter((s) => s.totalAdvances > 0).length}
							</p>
							<p className="text-xs text-slate-600 mt-1 font-medium">
								out of {staffList.length} total staff members
							</p>
						</div>
					</div>

					{/* Advances Search & Filter Bar */}
					<div className="app-card p-4 rounded-2xl shadow-xs">
						<div className="flex items-center gap-3 flex-wrap">
							{/* Text Search */}
							<div className="flex-1 min-w-[220px]">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
									<input
										className="form-input pl-9 pr-4 w-full text-xs"
										placeholder="Search by staff, reason, or notes..."
										value={search}
										onChange={(e) => {
											setSearch(e.target.value);
											setPage(1);
										}}
									/>
								</div>
							</div>

							{/* Staff Selector */}
							<select
								value={staffFilter}
								onChange={(e) => {
									setStaffFilter(e.target.value);
									setPage(1);
								}}
								className="form-input text-xs w-44 bg-white"
							>
								<option value="">All Staff Members</option>
								{staffList.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name}
									</option>
								))}
							</select>

							{/* Status Filter */}
							<select
								value={statusFilter}
								onChange={(e) => {
									setStatusFilter(e.target.value as StatusFilter);
									setPage(1);
								}}
								className="form-input text-xs w-40 bg-white font-medium"
							>
								<option value="active">Active (Default)</option>
								<option value="Outstanding">🟠 Outstanding Only</option>
								<option value="Settled">🟢 Settled Only</option>
								<option value="Obsolete">⚪ Obsolete Only</option>
								<option value="all">All Records</option>
							</select>

							{/* From Date Filter */}
							<div className="relative flex items-center">
								<Calendar className="w-3.5 h-3.5 absolute left-2.5 text-on-surface-variant pointer-events-none" />
								<input
									type="date"
									value={fromDate}
									onChange={(e) => {
										setFromDate(e.target.value);
										setPage(1);
									}}
									className="form-input pl-8 pr-6 py-1.5 text-xs w-36 bg-white"
									title="From date"
								/>
								{fromDate && (
									<button
										type="button"
										onClick={() => {
											setFromDate('');
											setPage(1);
										}}
										className="absolute right-1.5 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
										title="Clear from date"
									>
										<X className="w-3 h-3" />
									</button>
								)}
							</div>

							{/* To Date Filter */}
							<div className="relative flex items-center">
								<Calendar className="w-3.5 h-3.5 absolute left-2.5 text-on-surface-variant pointer-events-none" />
								<input
									type="date"
									value={toDate}
									onChange={(e) => {
										setToDate(e.target.value);
										setPage(1);
									}}
									className="form-input pl-8 pr-6 py-1.5 text-xs w-36 bg-white"
									title="To date"
								/>
								{toDate && (
									<button
										type="button"
										onClick={() => {
											setToDate('');
											setPage(1);
										}}
										className="absolute right-1.5 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
										title="Clear to date"
									>
										<X className="w-3 h-3" />
									</button>
								)}
							</div>

							{/* Reset Filters Button */}
							{hasActiveFilters && (
								<button
									type="button"
									onClick={resetFilters}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
									title="Reset all filters to default"
								>
									<RotateCcw className="w-3.5 h-3.5 text-slate-500" />
									<span>Reset Filters</span>
								</button>
							)}

							<div className="ml-auto text-xs text-on-surface-variant font-medium">
								{advancesData?.totalCount ?? 0} {advancesData?.totalCount === 1 ? 'record' : 'records'}
							</div>
						</div>
					</div>

					{/* Advances Table */}
					<div className="app-card overflow-hidden rounded-2xl shadow-xs">
						<div className="overflow-x-auto">
							<table className="app-table w-full">
								<thead>
									<tr className="border-b border-outline-variant bg-surface-container-lowest text-xs text-on-surface-variant uppercase font-semibold">
										<th className="py-3 px-4 text-left">Staff Member</th>
										<th className="py-3 px-4 text-left">Date</th>
										<th className="py-3 px-4 text-right">Amount</th>
										<th className="py-3 px-4 text-left">Reason / Notes</th>
										<th className="py-3 px-4 text-left">Status</th>
										<th className="py-3 px-4 text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-outline-variant text-xs">
									{advancesLoading && (
										<tr>
											<td colSpan={6} className="py-12 text-center text-on-surface-variant">
												<div className="inline-flex items-center gap-2">
													<div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
													<span>Loading staff advances...</span>
												</div>
											</td>
										</tr>
									)}
									{advancesError && (
										<tr>
											<td colSpan={6} className="py-12 text-center text-red-600 font-medium">
												Failed to load advances. Please try refreshing.
											</td>
										</tr>
									)}
									{!advancesLoading && !advancesError && advances.map((a) => {
										const isOutstanding = a.status === 'Outstanding';
										const isSettled = a.status === 'Settled';
										const isObsolete = a.status === 'Obsolete';

										return (
											<tr
												key={a.id}
												className={`hover:bg-surface-container-low transition-colors ${
													isObsolete ? 'opacity-60 bg-slate-50/50' : ''
												}`}
											>
												{/* Staff Member */}
												<td className="py-3 px-4">
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
															{a.staffName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
														</div>
														<div>
															<button
																type="button"
																onClick={() => setViewingHistoryStaffId(a.staffId)}
																className="font-semibold text-on-surface hover:text-blue-600 text-left cursor-pointer transition-colors"
															>
																{a.staffName}
															</button>
															<p className="text-[11px] text-on-surface-variant font-normal">
																{a.staffRole || 'Staff Member'}
															</p>
														</div>
													</div>
												</td>

												{/* Advance Date */}
												<td className="py-3 px-4 text-on-surface font-medium whitespace-nowrap">
													{formatDate(a.advanceDate)}
												</td>

												{/* Amount */}
												<td className="py-3 px-4 text-right font-bold text-on-surface font-mono text-sm whitespace-nowrap">
													{formatINR(a.amount)}
												</td>

												{/* Reason / Notes */}
												<td className="py-3 px-4">
													<div className="max-w-xs">
														<p className="font-medium text-on-surface truncate">{a.reason}</p>
														{a.notes && (
															<p className="text-[11px] text-on-surface-variant truncate mt-0.5" title={a.notes}>
																{a.notes}
															</p>
														)}
														{isObsolete && a.obsoleteReason && (
															<p className="text-[11px] text-amber-700 font-medium italic mt-0.5 truncate" title={`Obsolete Reason: ${a.obsoleteReason}`}>
																Reason: {a.obsoleteReason}
															</p>
														)}
													</div>
												</td>

												{/* Status */}
												<td className="py-3 px-4 whitespace-nowrap">
													<div>
														{renderStatusBadge(a.status)}
														{isSettled && a.settledAt && (
															<p className="text-[10px] text-on-surface-variant mt-0.5 font-normal">
																Recovered {formatDate(a.settledAt)}
															</p>
														)}
														{isObsolete && a.obsoletedAt && (
															<p className="text-[10px] text-on-surface-variant mt-0.5 font-normal">
																Marked {formatDate(a.obsoletedAt)}
															</p>
														)}
													</div>
												</td>

												{/* Actions */}
												<td className="py-3 px-4 text-right whitespace-nowrap">
													<div className="flex items-center justify-end gap-1.5">
														{isOutstanding && (
															<>
																{canSettle && (
																	<button
																		type="button"
																		onClick={() => {
																			setSettleError('');
																			setSettlingAdvance(a);
																		}}
																		className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200/80 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
																		title="Mark advance as recovered/settled from staff salary"
																	>
																		<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
																		<span>Mark Settled</span>
																	</button>
																)}

																{canObsolete && (
																	<button
																		type="button"
																		onClick={() => {
																			setObsoleteError('');
																			setObsoleteReason('Wrongly entered');
																			setObsoletingAdvance(a);
																		}}
																		className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
																		title="Mark advance as obsolete"
																	>
																		<Ban className="w-3.5 h-3.5 text-slate-500" />
																		<span>Mark Obsolete</span>
																	</button>
																)}
															</>
														)}

														{isSettled && (
															<span className="text-[11px] text-emerald-700 font-medium italic">
																Settled
															</span>
														)}

														{isObsolete && (
															<span className="text-[11px] text-slate-500 font-medium italic">
																Obsolete
															</span>
														)}

														<button
															type="button"
															onClick={() => setViewingHistoryStaffId(a.staffId)}
															className="p-1.5 text-on-surface-variant hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer ml-1"
															title="View staff advance history"
														>
															<History className="w-3.5 h-3.5" />
														</button>
													</div>
												</td>
											</tr>
										);
									})}
									{!advancesLoading && !advancesError && advances.length === 0 && (
										<tr>
											<td colSpan={6} className="py-16 text-center">
												<div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
													<Wallet className="w-6 h-6" />
												</div>
												<p className="text-on-surface font-semibold text-sm">No staff advances found</p>
												<p className="text-on-surface-variant text-xs mt-1">
													{statusFilter === 'Obsolete'
														? 'No obsolete advance records match the current filters.'
														: 'No active staff advances found matching your filter criteria.'}
												</p>
												<div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
													{hasActiveFilters && (
														<Button
															variant="secondary"
															icon={<RotateCcw className="w-3.5 h-3.5" />}
															onClick={resetFilters}
														>
															Reset Filters
														</Button>
													)}
													{canCreate && statusFilter !== 'Obsolete' && (
														<Button
															variant={hasActiveFilters ? 'primary' : 'secondary'}
															onClick={() => {
																resetCreateForm();
																setShowCreateModal(true);
															}}
														>
															Record First Advance
														</Button>
													)}
												</div>
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						{/* Pagination */}
						{totalPages > 1 && (
							<div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant bg-surface-container-lowest">
								<span className="text-xs text-on-surface-variant">
									Page {page} of {totalPages}
								</span>
								<div className="flex gap-2">
									<Button
										variant="secondary"
										size="sm"
										disabled={page <= 1}
										onClick={() => setPage((p) => Math.max(1, p - 1))}
									>
										Previous
									</Button>
									<Button
										variant="secondary"
										size="sm"
										disabled={page >= totalPages}
										onClick={() => setPage((p) => p + 1)}
									>
										Next
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* TAB 2: STAFF DIRECTORY */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			{activeTab === 'staff' && (
				<div className="space-y-5">
					{/* Staff KPI Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<div className="app-card p-4 rounded-2xl shadow-xs">
							<span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
								Total Staff Members
							</span>
							<p className="text-2xl font-black text-on-surface mt-1.5 font-mono">
								{staffList.length}
							</p>
						</div>
						<div className="app-card p-4 rounded-2xl shadow-xs">
							<span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
								Active Employees
							</span>
							<p className="text-2xl font-black text-emerald-600 mt-1.5 font-mono">
								{staffList.filter((s) => s.isActive).length}
							</p>
						</div>
						<div className="app-card p-4 rounded-2xl shadow-xs">
							<span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
								With Outstanding Advances
							</span>
							<p className="text-2xl font-black text-amber-600 mt-1.5 font-mono">
								{staffList.filter((s) => s.totalAdvances > 0).length}
							</p>
						</div>
					</div>

					{/* Search & Filter Bar */}
					<div className="app-card p-4 rounded-2xl shadow-xs">
						<div className="flex items-center gap-3 flex-wrap">
							<div className="flex-1 min-w-[240px]">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
									<input
										className="form-input pl-9 pr-4 w-full text-xs"
										placeholder="Search staff by name, phone, role, email..."
										value={staffSearch}
										onChange={(e) => setStaffSearch(e.target.value)}
									/>
								</div>
							</div>
							<select
								value={staffStatusFilter}
								onChange={(e) => setStaffStatusFilter(e.target.value as StaffStatusFilter)}
								className="form-input text-xs w-36 bg-white"
							>
								<option value="all">All Status</option>
								<option value="active">Active Only</option>
								<option value="inactive">Inactive Only</option>
							</select>
						</div>
					</div>

					{/* Staff Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredStaff.map((staff) => (
							<div
								key={staff.id}
								className="app-card p-4.5 rounded-2xl hover:shadow-md transition-all border border-outline-variant/60 flex flex-col justify-between"
							>
								<div>
									<div className="flex items-start justify-between gap-2">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-700 flex items-center justify-center font-bold text-sm">
												{staff.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
											</div>
											<div>
												<h3 className="font-bold text-sm text-on-surface">{staff.name}</h3>
												<p className="text-xs text-on-surface-variant font-medium">
													{staff.role || 'Staff Member'}
												</p>
											</div>
										</div>
										<span
											className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
												staff.isActive
													? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
													: 'bg-slate-100 text-slate-600 border border-slate-200'
											}`}
										>
											{staff.isActive ? 'Active' : 'Inactive'}
										</span>
									</div>

									<div className="mt-4 space-y-1.5 text-xs text-on-surface-variant">
										<div className="flex items-center gap-2">
											<Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
											<span className="font-mono">{staff.phoneNumber || '—'}</span>
										</div>
										{staff.email && (
											<div className="flex items-center gap-2">
												<Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
												<span className="truncate">{staff.email}</span>
											</div>
										)}
										{staff.address && (
											<div className="flex items-center gap-2">
												<MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
												<span className="truncate">{staff.address}</span>
											</div>
										)}
										<div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
											<div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
												<ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
												<span>{staff.aadhaarMasked ? staff.aadhaarMasked : <em className="text-slate-400 font-sans">Aadhaar: Not Added</em>}</span>
											</div>
											{staff.hasAadhaarDocument && (
												<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200" title={staff.aadhaarDocumentFileName || 'Document uploaded'}>
													<FileCheck className="w-3 h-3" />
													Doc
												</span>
											)}
										</div>
									</div>

									{/* Advances info tag */}
									<div className="mt-3.5 p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between text-xs">
										<span className="text-on-surface-variant font-medium">Outstanding Advance:</span>
										<span className={`font-bold font-mono ${staff.totalAdvances > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
											{formatINR(staff.totalAdvanceAmount || 0)}
										</span>
									</div>
								</div>

								<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => {
												setViewingDetailsStaff(staff);
												setRevealedAadhaar(null);
												setRevealError(null);
												setDocError(null);
											}}
											className="text-xs font-semibold text-slate-700 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
										>
											<User className="w-3.5 h-3.5 text-slate-400" />
											<span>Details</span>
										</button>
										<button
											type="button"
											onClick={() => setViewingHistoryStaffId(staff.id)}
											className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
										>
											<History className="w-3.5 h-3.5" />
											<span>History</span>
										</button>
									</div>

									<div className="flex items-center gap-1">
										{canCreate && (
											<Button
												size="sm"
												variant="secondary"
												icon={<Plus className="w-3.5 h-3.5" />}
												onClick={() => {
													resetCreateForm();
													setCreateStaffId(staff.id);
													setShowCreateModal(true);
												}}
											>
												Advance
											</Button>
										)}
										{canManageStaff && (
											<button
												type="button"
												onClick={() => {
													setEditingStaff(staff);
													setStaffFormName(staff.name);
													setStaffFormPhone(staff.phoneNumber);
													setStaffFormEmail(staff.email || '');
													setStaffFormAddress(staff.address || '');
													setStaffFormRole(staff.role || 'Technician');
													setStaffFormIsActive(staff.isActive);
													setStaffFormAadhaar('');
													setStaffFormAadhaarFile(null);
													setStaffFormRemoveDocument(false);
													setStaffFormIsEditingAadhaar(!staff.aadhaarMasked);
													setShowStaffModal(true);
												}}
												className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
												title="Edit staff details"
											>
												<Edit2 className="w-3.5 h-3.5" />
											</button>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* MODAL 1: RECORD ADVANCE MODAL */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			<Dialog
				open={showCreateModal}
				onOpenChange={(open) => {
					if (!open && !createAdvanceMutation.isPending) setShowCreateModal(false);
				}}
				title="Record Staff Advance"
				description="Issue an advance to an employee. It will be marked as Outstanding until settled via salary recovery."
			>
				<form onSubmit={handleCreateAdvanceSubmit} className="space-y-4 pt-2">
					{createError && (
						<div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
							<AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
							<span>{createError}</span>
						</div>
					)}

					{/* Staff Member Selection */}
					<div>
						<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
							Staff Member *
						</label>
						<select
							value={createStaffId}
							onChange={(e) => setCreateStaffId(e.target.value)}
							required
							className="form-input w-full text-xs bg-white"
						>
							<option value="">Select Staff Member...</option>
							{staffList
								.filter((s) => s.isActive || s.id === createStaffId)
								.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name} {s.role ? `(${s.role})` : ''}
									</option>
								))}
						</select>
					</div>

					{/* Amount and Date */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Advance Amount (₹) *
							</label>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
									₹
								</span>
								<input
									type="number"
									step="0.01"
									min="1"
									max="999999"
									value={createAmount}
									onChange={(e) => setCreateAmount(e.target.value)}
									placeholder="5000"
									required
									className="form-input pl-8 w-full text-xs font-mono font-bold text-slate-800 bg-white"
								/>
							</div>
						</div>

						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Advance Date *
							</label>
							<input
								type="date"
								value={createDate}
								onChange={(e) => setCreateDate(e.target.value)}
								required
								className="form-input w-full text-xs bg-white"
							/>
						</div>
					</div>

					{/* Reason */}
					<div>
						<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
							Reason *
						</label>
						<input
							type="text"
							value={createReason}
							onChange={(e) => setCreateReason(e.target.value)}
							onBlur={() => setCreateReason(capitalizeSentence(createReason))}
							placeholder="e.g. Personal Advance, Emergency, Festival Advance"
							required
							className="form-input w-full text-xs bg-white"
						/>
					</div>

					{/* Notes */}
					<div>
						<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
							Notes (Optional)
						</label>
						<textarea
							rows={2}
							value={createNotes}
							onChange={(e) => setCreateNotes(e.target.value)}
							onBlur={() => setCreateNotes(capitalizeSentence(createNotes))}
							placeholder="Optional additional notes or remarks..."
							className="form-input w-full text-xs bg-white resize-none"
						/>
					</div>

					<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant">
						<Button
							type="button"
							variant="secondary"
							onClick={() => setShowCreateModal(false)}
							disabled={createAdvanceMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							loading={createAdvanceMutation.isPending}
							icon={<Plus className="w-4 h-4" />}
						>
							Record Advance
						</Button>
					</div>
				</form>
			</Dialog>

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* MODAL 2: SETTLE CONFIRMATION MODAL */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			<Dialog
				open={!!settlingAdvance}
				onOpenChange={(open) => {
					if (!open && !settleAdvanceMutation.isPending) setSettlingAdvance(null);
				}}
				title="Mark Advance as Settled?"
				description="This confirms that the advance has been recovered from the staff member's salary."
			>
				{settlingAdvance && (
					<form onSubmit={handleSettleSubmit} className="space-y-4 pt-2">
						{settleError && (
							<div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
								<AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
								<span>{settleError}</span>
							</div>
						)}

						<div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2 text-xs">
							<div className="flex justify-between">
								<span className="text-emerald-900 font-medium">Staff Member:</span>
								<span className="font-bold text-emerald-950">{settlingAdvance.staffName}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-emerald-900 font-medium">Advance Amount:</span>
								<span className="font-bold font-mono text-emerald-950 text-sm">{formatINR(settlingAdvance.amount)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-emerald-900 font-medium">Advance Date:</span>
								<span className="text-emerald-950 font-medium">{formatDate(settlingAdvance.advanceDate)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-emerald-900 font-medium">Reason:</span>
								<span className="text-emerald-950">{settlingAdvance.reason}</span>
							</div>
						</div>

						<p className="text-xs text-on-surface-variant leading-relaxed">
							Marking this advance as settled will update its status to <strong>Settled</strong> and record your user account as the settler.
						</p>

						<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant">
							<Button
								type="button"
								variant="secondary"
								onClick={() => setSettlingAdvance(null)}
								disabled={settleAdvanceMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								loading={settleAdvanceMutation.isPending}
								className="bg-emerald-600 hover:bg-emerald-700 text-white"
								icon={<CheckCircle2 className="w-4 h-4" />}
							>
								Mark Settled
							</Button>
						</div>
					</form>
				)}
			</Dialog>

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* MODAL 3: OBSOLETE CONFIRMATION MODAL */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			<Dialog
				open={!!obsoletingAdvance}
				onOpenChange={(open) => {
					if (!open && !obsoleteAdvanceMutation.isPending) setObsoletingAdvance(null);
				}}
				title="Mark Advance as Obsolete?"
				description="This advance will no longer be included in active outstanding advance calculations."
			>
				{obsoletingAdvance && (
					<form onSubmit={handleObsoleteSubmit} className="space-y-4 pt-2">
						{obsoleteError && (
							<div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
								<AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
								<span>{obsoleteError}</span>
							</div>
						)}

						<div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs">
							<div className="flex justify-between">
								<span className="text-slate-600 font-medium">Staff Member:</span>
								<span className="font-semibold text-slate-900">{obsoletingAdvance.staffName}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-slate-600 font-medium">Amount:</span>
								<span className="font-bold font-mono text-slate-900">{formatINR(obsoletingAdvance.amount)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-slate-600 font-medium">Date:</span>
								<span className="text-slate-800">{formatDate(obsoletingAdvance.advanceDate)}</span>
							</div>
						</div>

						{/* Mandatory Reason */}
						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Reason / Note *
							</label>
							<textarea
								rows={2}
								value={obsoleteReason}
								onChange={(e) => setObsoleteReason(e.target.value)}
								placeholder="e.g. Wrongly entered, duplicate entry..."
								required
								minLength={3}
								className="form-input w-full text-xs bg-white resize-none"
							/>
							<div className="flex flex-wrap gap-1.5 mt-2">
								{OBSOLETE_REASON_PRESETS.map((preset) => (
									<button
										key={preset}
										type="button"
										onClick={() => setObsoleteReason(preset)}
										className={`text-[11px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
											obsoleteReason === preset
												? 'bg-blue-50 text-blue-700 border-blue-300 font-medium'
												: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
										}`}
									>
										{preset}
									</button>
								))}
							</div>
						</div>

						<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant">
							<Button
								type="button"
								variant="secondary"
								onClick={() => setObsoletingAdvance(null)}
								disabled={obsoleteAdvanceMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								loading={obsoleteAdvanceMutation.isPending}
								disabled={!obsoleteReason.trim() || obsoleteReason.trim().length < 3}
								className="bg-amber-600 hover:bg-amber-700 text-white"
								icon={<Ban className="w-4 h-4" />}
							>
								Mark Obsolete
							</Button>
						</div>
					</form>
				)}
			</Dialog>

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* MODAL 4: STAFF ADVANCE HISTORY MODAL */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			<Dialog
				open={!!viewingHistoryStaffId}
				onOpenChange={(open) => {
					if (!open) setViewingHistoryStaffId(null);
				}}
				title={`${staffHistoryData?.staffName || 'Staff'} — Advance History`}
				description="Complete advance tracking and recovery log for this employee."
			>
				{historyLoading && (
					<div className="py-12 text-center text-on-surface-variant">
						<div className="inline-flex items-center gap-2">
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
							<span>Loading advance history...</span>
						</div>
					</div>
				)}

				{!historyLoading && staffHistoryData && (
					<div className="space-y-4 pt-1">
						{/* Mini Summary Cards */}
						<div className="grid grid-cols-3 gap-2.5 text-center">
							<div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
								<span className="text-[10px] font-semibold text-blue-900 uppercase">Total Advances</span>
								<p className="text-sm font-bold text-blue-950 font-mono mt-0.5">
									{formatINR(staffHistoryData.totalAdvancesAmount)}
								</p>
							</div>
							<div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
								<span className="text-[10px] font-semibold text-amber-900 uppercase">Outstanding</span>
								<p className="text-sm font-bold text-amber-950 font-mono mt-0.5">
									{formatINR(staffHistoryData.outstandingAmount)}
								</p>
							</div>
							<div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
								<span className="text-[10px] font-semibold text-emerald-900 uppercase">Settled</span>
								<p className="text-sm font-bold text-emerald-950 font-mono mt-0.5">
									{formatINR(staffHistoryData.settledAmount)}
								</p>
							</div>
						</div>

						{/* Advance History List */}
						<div className="max-h-80 overflow-y-auto space-y-2 pr-1">
							{staffHistoryData.advances.length === 0 ? (
								<p className="py-8 text-center text-xs text-on-surface-variant">
									No advances recorded for this staff member.
								</p>
							) : (
								staffHistoryData.advances.map((adv) => (
									<div
										key={adv.id}
										className={`p-3 rounded-xl border transition-all text-xs flex items-center justify-between gap-3 ${
											adv.status === 'Obsolete'
												? 'bg-slate-50/60 border-slate-200 opacity-60'
												: adv.status === 'Settled'
													? 'bg-emerald-50/30 border-emerald-200/60'
													: 'bg-white border-amber-200/80 shadow-2xs'
										}`}
									>
										<div>
											<div className="flex items-center gap-2">
												<span className="font-bold text-on-surface font-mono text-sm">
													{formatINR(adv.amount)}
												</span>
												{renderStatusBadge(adv.status)}
											</div>
											<p className="text-slate-700 font-medium mt-1">{adv.reason}</p>
											<p className="text-[11px] text-slate-500">
												Issued on {formatDate(adv.advanceDate)}
												{adv.status === 'Settled' && adv.settledAt && ` · Settled on ${formatDate(adv.settledAt)}`}
												{adv.status === 'Obsolete' && adv.obsoleteReason && ` · Obsolete: "${adv.obsoleteReason}"`}
											</p>
										</div>

										{adv.status === 'Outstanding' && canSettle && (
											<button
												type="button"
												onClick={() => {
													setSettleError('');
													setSettlingAdvance(adv);
												}}
												className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shrink-0"
											>
												Mark Settled
											</button>
										)}
									</div>
								))
							)}
						</div>

						<div className="flex justify-end pt-2">
							<Button variant="secondary" size="sm" onClick={() => setViewingHistoryStaffId(null)}>
								Close
							</Button>
						</div>
					</div>
				)}
			</Dialog>

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* MODAL 5: STAFF MEMBER FORM (ADD/EDIT) */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			<Dialog
				open={showStaffModal}
				onOpenChange={(open) => {
					if (!open && !staffMutation.isPending) setShowStaffModal(false);
				}}
				title={editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
				description={
					editingStaff
						? 'Update staff employee profile and details.'
						: 'Add a new employee to the staff directory.'
				}
			>
				<form onSubmit={handleStaffFormSubmit} className="space-y-4 pt-2" noValidate>
					{staffFormError && (
						<div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
							<AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
							<span>{staffFormError}</span>
						</div>
					)}

					<div>
						<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
							Full Name *
						</label>
						<input
							type="text"
							value={staffFormName}
							onChange={(e) => setStaffFormName(e.target.value)}
							onBlur={() => setStaffFormName(capitalizeSentence(staffFormName))}
							placeholder="e.g. Ramesh Kumar"
							required
							className="form-input w-full text-xs bg-white"
						/>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Phone Number *
							</label>
							<input
								type="tel"
								inputMode="numeric"
								maxLength={10}
								value={staffFormPhone}
								onChange={(e) => setStaffFormPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
								placeholder="e.g. 9876543210"
								required
								className="form-input w-full text-xs bg-white font-mono"
							/>
						</div>

						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Role / Designation
							</label>
							<input
								type="text"
								value={staffFormRole}
								onChange={(e) => setStaffFormRole(e.target.value)}
								onBlur={() => setStaffFormRole(capitalizeSentence(staffFormRole))}
								placeholder="e.g. Senior Technician, Detailer, Manager"
								className="form-input w-full text-xs bg-white"
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Email (Optional)
							</label>
							<input
								type="email"
								value={staffFormEmail}
								onChange={(e) => setStaffFormEmail(e.target.value)}
								placeholder="e.g. ramesh@e6carspa.com"
								className="form-input w-full text-xs bg-white"
							/>
						</div>

						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Status
							</label>
							<select
								value={staffFormIsActive ? 'active' : 'inactive'}
								onChange={(e) => setStaffFormIsActive(e.target.value === 'active')}
								className="form-input w-full text-xs bg-white"
							>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
							</select>
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
							Address (Optional)
						</label>
						<input
							type="text"
							value={staffFormAddress}
							onChange={(e) => setStaffFormAddress(e.target.value)}
							onBlur={() => setStaffFormAddress(capitalizeSentence(staffFormAddress))}
							placeholder="e.g. 12, Main Road, Chennai"
							className="form-input w-full text-xs bg-white"
						/>
					</div>

					{/* ── Aadhaar Information Section ── */}
					<div className="pt-2 border-t border-outline-variant space-y-3">
						<div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
							<ShieldCheck className="w-4 h-4 text-blue-600" />
							<span>Aadhaar Identification</span>
						</div>

						{!editingStaff ? (
							/* Add Staff: Mandatory Aadhaar */
							<div>
								<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
									Aadhaar Number *
								</label>
								<input
									type="text"
									inputMode="numeric"
									maxLength={14}
									value={staffFormAadhaar}
									onChange={(e) => setStaffFormAadhaar(formatAadhaarInput(e.target.value))}
									placeholder="1234 5678 9012"
									required
									className="form-input w-full text-xs bg-white font-mono"
								/>
								<p className="text-[11px] text-slate-500 mt-1">
									Enter the 12-digit Aadhaar number
								</p>
							</div>
						) : (
							/* Edit Staff: Masked Aadhaar with change option */
							<div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
								<div className="flex items-center justify-between">
									<div>
										<span className="text-xs text-slate-600">Current Aadhaar:</span>
										<p className="font-mono font-bold text-xs text-slate-800 mt-0.5">
											{editingStaff.aadhaarMasked ? editingStaff.aadhaarMasked : <em className="text-slate-400 font-sans font-normal">Aadhaar: Not Added</em>}
										</p>
									</div>
									<button
										type="button"
										onClick={() => setStaffFormIsEditingAadhaar(!staffFormIsEditingAadhaar)}
										className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
									>
										{staffFormIsEditingAadhaar ? 'Keep Current' : (editingStaff.aadhaarMasked ? 'Change' : 'Add Aadhaar')}
									</button>
								</div>

								{staffFormIsEditingAadhaar && (
									<div className="pt-2 border-t border-slate-200">
										<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
											New Aadhaar Number {editingStaff.aadhaarMasked ? '' : '*'}
										</label>
										<input
											type="text"
											inputMode="numeric"
											maxLength={14}
											value={staffFormAadhaar}
											onChange={(e) => setStaffFormAadhaar(formatAadhaarInput(e.target.value))}
											placeholder="1234 5678 9012"
											className="form-input w-full text-xs bg-white font-mono"
										/>
										<p className="text-[11px] text-slate-500 mt-1">
											Enter the new 12-digit Aadhaar number
										</p>
									</div>
								)}
							</div>
						)}

						{/* Aadhaar Copy / Document Upload */}
						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
								Aadhaar Copy (Optional)
							</label>

							{editingStaff?.hasAadhaarDocument && !staffFormRemoveDocument && !staffFormAadhaarFile ? (
								<div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between gap-2">
									<div className="flex items-center gap-2 min-w-0">
										<FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
										<div className="min-w-0">
											<p className="text-xs font-semibold text-blue-950 truncate">
												✓ Uploaded: {editingStaff.aadhaarDocumentFileName || 'Document'}
											</p>
											<p className="text-[11px] text-blue-700">
												{editingStaff.aadhaarDocumentContentType || 'Document'}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<button
											type="button"
											onClick={() => handleDownloadDoc(editingStaff)}
											className="px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
										>
											<Download className="w-3.5 h-3.5" />
											<span>View</span>
										</button>
										<button
											type="button"
											onClick={() => setStaffFormRemoveDocument(true)}
											className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
										>
											<Trash2 className="w-3.5 h-3.5" />
											<span>Remove</span>
										</button>
									</div>
								</div>
							) : (
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<input
											type="file"
											accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
											onChange={(e) => {
												if (e.target.files && e.target.files[0]) {
													setStaffFormAadhaarFile(e.target.files[0]);
													setStaffFormRemoveDocument(false);
												}
											}}
											className="form-input w-full text-xs bg-white file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
										/>
										{staffFormAadhaarFile && (
											<button
												type="button"
												onClick={() => setStaffFormAadhaarFile(null)}
												className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
												title="Clear file"
											>
												<X className="w-4 h-4" />
											</button>
										)}
									</div>
									<p className="text-[11px] text-slate-500">
										Optional — upload Aadhaar copy<br />
										PDF, JPG, JPEG, PNG • Max 5 MB
									</p>
									{staffFormRemoveDocument && (
										<p className="text-xs text-amber-700 font-medium">
											Existing document will be removed upon saving.
										</p>
									)}
								</div>
							)}
						</div>
					</div>

					<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant">
						<Button
							type="button"
							variant="secondary"
							onClick={() => setShowStaffModal(false)}
							disabled={staffMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							loading={staffMutation.isPending}
						>
							{editingStaff ? 'Save Changes' : 'Add Staff'}
						</Button>
					</div>
				</form>
			</Dialog>

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* MODAL 6: STAFF DETAILS (WITH IDENTIFICATION SECTION) */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			<Dialog
				open={!!viewingDetailsStaff}
				onOpenChange={(open) => {
					if (!open) {
						setViewingDetailsStaff(null);
						setRevealedAadhaar(null);
						setRevealError(null);
						setDocError(null);
					}
				}}
				title={`${viewingDetailsStaff?.name || 'Staff'} — Staff Details`}
				description="Employee identity, contact information, and advance summary."
			>
				{viewingDetailsStaff && (
					<div className="space-y-4 pt-1">
						{/* Top Profile Summary */}
						<div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
							<div className="flex items-center gap-3">
								<div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
									{viewingDetailsStaff.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
								</div>
								<div>
									<h3 className="font-bold text-base text-slate-900">{viewingDetailsStaff.name}</h3>
									<p className="text-xs text-slate-500 font-medium">
										{viewingDetailsStaff.role || 'Technician'}
									</p>
								</div>
							</div>
							<span
								className={`px-2.5 py-1 rounded-full text-xs font-bold ${
									viewingDetailsStaff.isActive
										? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
										: 'bg-slate-100 text-slate-600 border border-slate-200'
								}`}
							>
								{viewingDetailsStaff.isActive ? 'Active' : 'Inactive'}
							</span>
						</div>

						{/* Contact Details */}
						<div className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-2 text-xs">
							<div className="flex justify-between items-center py-1 border-b border-slate-100">
								<span className="text-slate-500 font-medium">Phone Number</span>
								<span className="font-bold font-mono text-slate-900">{viewingDetailsStaff.phoneNumber}</span>
							</div>
							<div className="flex justify-between items-center py-1 border-b border-slate-100">
								<span className="text-slate-500 font-medium">Email Address</span>
								<span className="text-slate-800">{viewingDetailsStaff.email || '—'}</span>
							</div>
							<div className="flex justify-between items-center py-1 border-b border-slate-100">
								<span className="text-slate-500 font-medium">Residential Address</span>
								<span className="text-slate-800 text-right max-w-[60%]">{viewingDetailsStaff.address || '—'}</span>
							</div>
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-500 font-medium">Outstanding Advance</span>
								<span className={`font-bold font-mono ${viewingDetailsStaff.totalAdvances > 0 ? 'text-amber-700 text-sm' : 'text-slate-700'}`}>
									{formatINR(viewingDetailsStaff.totalAdvanceAmount || 0)}
								</span>
							</div>
						</div>

						{/* ── IDENTIFICATION SECTION ── */}
						<div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/40 space-y-3">
							<div className="flex items-center gap-2 text-xs font-bold text-blue-950 uppercase tracking-wider">
								<ShieldCheck className="w-4 h-4 text-blue-600" />
								<span>Identification</span>
							</div>

							{revealError && (
								<div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
									<AlertTriangle className="w-3.5 h-3.5 shrink-0" />
									<span>{revealError}</span>
								</div>
							)}

							{docError && (
								<div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
									<AlertTriangle className="w-3.5 h-3.5 shrink-0" />
									<span>{docError}</span>
								</div>
							)}

							{/* Aadhaar Number */}
							<div className="p-3 bg-white border border-blue-100 rounded-xl flex items-center justify-between gap-3">
								<div>
									<span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
										Aadhaar Number
									</span>
									<div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
										{revealedAadhaar ? (
											<span className="text-emerald-700 tracking-wider">{formatAadhaarInput(revealedAadhaar)}</span>
										) : viewingDetailsStaff.aadhaarMasked ? (
											<span className="text-slate-700 tracking-wider">{viewingDetailsStaff.aadhaarMasked}</span>
										) : (
											<span className="text-slate-400 font-normal font-sans text-xs">Not Added</span>
										)}
									</div>
								</div>

								{viewingDetailsStaff.aadhaarMasked && (
									<div>
										{revealedAadhaar ? (
											<button
												type="button"
												onClick={() => setRevealedAadhaar(null)}
												className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
											>
												<EyeOff className="w-3.5 h-3.5" />
												<span>Hide</span>
											</button>
										) : (
											<button
												type="button"
												onClick={() => handleRevealAadhaar(viewingDetailsStaff.id)}
												disabled={isRevealingAadhaar}
												className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
											>
												<Eye className="w-3.5 h-3.5" />
												<span>{isRevealingAadhaar ? 'Revealing...' : 'Show'}</span>
											</button>
										)}
									</div>
								)}
							</div>

							{/* Aadhaar Document */}
							<div className="p-3 bg-white border border-blue-100 rounded-xl flex items-center justify-between gap-3">
								<div className="min-w-0">
									<span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
										Aadhaar Copy
									</span>
									<div className="text-xs text-slate-800 font-medium mt-0.5 truncate">
										{viewingDetailsStaff.hasAadhaarDocument ? (
											<span className="text-slate-900 font-semibold truncate flex items-center gap-1">
												<FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
												<span className="truncate">{viewingDetailsStaff.aadhaarDocumentFileName || 'Document'}</span>
											</span>
										) : (
											<span className="text-slate-400 font-normal">Not uploaded</span>
										)}
									</div>
								</div>

								{viewingDetailsStaff.hasAadhaarDocument && (
									<Button
										size="sm"
										variant="secondary"
										icon={<Download className="w-3.5 h-3.5" />}
										loading={isDownloadingDoc}
										onClick={() => handleDownloadDoc(viewingDetailsStaff)}
									>
										View Document
									</Button>
								)}
							</div>
						</div>

						{/* Footer Actions */}
						<div className="flex items-center justify-between pt-2 border-t border-outline-variant">
							<Button
								variant="secondary"
								size="sm"
								onClick={() => {
									setViewingDetailsStaff(null);
									setRevealedAadhaar(null);
								}}
							>
								Close
							</Button>

							{canManageStaff && (
								<Button
									size="sm"
									icon={<Edit2 className="w-3.5 h-3.5" />}
									onClick={() => {
										const target = viewingDetailsStaff;
										setViewingDetailsStaff(null);
										setRevealedAadhaar(null);
										setEditingStaff(target);
										setStaffFormName(target.name);
										setStaffFormPhone(target.phoneNumber);
										setStaffFormEmail(target.email || '');
										setStaffFormAddress(target.address || '');
										setStaffFormRole(target.role || 'Technician');
										setStaffFormIsActive(target.isActive);
										setStaffFormAadhaar('');
										setStaffFormAadhaarFile(null);
										setStaffFormRemoveDocument(false);
										setStaffFormIsEditingAadhaar(!target.aadhaarMasked);
										setShowStaffModal(true);
									}}
								>
									Edit Staff
								</Button>
							)}
						</div>
					</div>
				)}
			</Dialog>
		</div>
	);
}

export default StaffAdvancesPage;
