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
	Users,
	Edit2,
	Phone,
	Mail,
	MapPin,
	Eye,
	EyeOff,
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
	getStaffList,
	getStaffAdvanceHistory,
	createStaffMember,
	updateStaffMember,
	revealStaffAadhaar,
	deleteStaffAadhaarDocument,
	downloadStaffAadhaarDocument,
	type StaffDto,
	type StaffAdvanceHistoryDto,
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

type StaffStatusFilter = 'all' | 'active' | 'inactive';

export function StaffDirectoryPage() {
	const qc = useQueryClient();
	const { hasPermission } = useAuth();

	const canManageStaff = hasPermission('staff.create') || hasPermission('staff.edit');
	const canViewSensitive = hasPermission('staff.view_sensitive') || hasPermission('staff.view');

	// ── Staff Directory State ────────────────────────────────────────────────
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

	// Staff Advance History Modal State
	const [viewingHistoryStaffId, setViewingHistoryStaffId] = useState<string | null>(null);

	// ── Queries ─────────────────────────────────────────────────────────────
	const { data: staffList = [], isLoading: staffLoading } = useQuery({
		queryKey: ['staff-list'],
		queryFn: async () => {
			try {
				return await getStaffList();
			} catch {
				return [];
			}
		},
	});

	const { data: staffHistoryData, isLoading: historyLoading } = useQuery({
		queryKey: ['staff-advance-history', viewingHistoryStaffId],
		queryFn: () => getStaffAdvanceHistory(viewingHistoryStaffId!),
		enabled: !!viewingHistoryStaffId,
	});

	// ── Mutations ───────────────────────────────────────────────────────────
	const staffMutation = useMutation({
		mutationFn: async (payload: {
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
				return updateStaffMember(editingStaff.id, payload);
			} else {
				return createStaffMember({
					name: payload.name,
					phoneNumber: payload.phoneNumber,
					aadhaarNumber: payload.aadhaarNumber || '',
					email: payload.email,
					address: payload.address,
					role: payload.role,
					isActive: payload.isActive,
					aadhaarFile: payload.aadhaarFile,
				});
			}
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			setShowStaffModal(false);
			setEditingStaff(null);
			resetStaffForm();
		},
		onError: (err: Error) => {
			setStaffFormError(err.message || 'Failed to save staff member');
		},
	});

	const deleteDocMutation = useMutation({
		mutationFn: (staffId: string) => deleteStaffAadhaarDocument(staffId),
		onSuccess: (updatedStaff) => {
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			if (viewingDetailsStaff && viewingDetailsStaff.id === updatedStaff.id) {
				setViewingDetailsStaff(updatedStaff);
			}
			if (editingStaff && editingStaff.id === updatedStaff.id) {
				setEditingStaff(updatedStaff);
			}
		},
		onError: (err: Error) => {
			setDocError(err.message || 'Failed to delete Aadhaar document');
		},
	});

	// ── Form Reset Helpers ──────────────────────────────────────────────────
	const resetStaffForm = () => {
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

	const openEditStaffModal = (staff: StaffDto) => {
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
		setStaffFormIsEditingAadhaar(false);
		setStaffFormError('');
		setShowStaffModal(true);
	};

	const handleStaffFormSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setStaffFormError('');

		const trimmedName = staffFormName.trim();
		const trimmedPhone = staffFormPhone.replace(/\D/g, '');

		if (!trimmedName) {
			setStaffFormError('Staff name is required.');
			return;
		}
		if (trimmedPhone.length !== 10) {
			setStaffFormError('Phone number must be exactly 10 digits.');
			return;
		}

		// Aadhaar validation:
		if (!editingStaff) {
			// Adding new staff: Aadhaar is mandatory
			const normalized = normalizeAadhaar(staffFormAadhaar);
			if (!normalized) {
				setStaffFormError('Aadhaar number is mandatory for new staff.');
				return;
			}
			if (!/^\d{12}$/.test(normalized)) {
				setStaffFormError('Aadhaar number must be exactly 12 digits.');
				return;
			}
		} else if (staffFormIsEditingAadhaar) {
			// Editing staff and opted to update Aadhaar:
			const normalized = normalizeAadhaar(staffFormAadhaar);
			if (normalized && !/^\d{12}$/.test(normalized)) {
				setStaffFormError('New Aadhaar number must be exactly 12 digits.');
				return;
			}
		}

		const payload: {
			name: string;
			phoneNumber: string;
			email?: string | null;
			address?: string | null;
			role?: string | null;
			isActive?: boolean;
			aadhaarNumber?: string;
			aadhaarFile?: File | null;
			removeAadhaarDocument?: boolean;
		} = {
			name: trimmedName,
			phoneNumber: trimmedPhone,
			email: staffFormEmail.trim() || null,
			address: staffFormAddress.trim() || null,
			role: staffFormRole.trim() || 'Technician',
			isActive: staffFormIsActive,
		};

		if (!editingStaff) {
			payload.aadhaarNumber = normalizeAadhaar(staffFormAadhaar);
			payload.aadhaarFile = staffFormAadhaarFile;
		} else {
			if (staffFormIsEditingAadhaar && staffFormAadhaar.trim()) {
				payload.aadhaarNumber = normalizeAadhaar(staffFormAadhaar);
			}
			if (staffFormAadhaarFile) {
				payload.aadhaarFile = staffFormAadhaarFile;
			}
			if (staffFormRemoveDocument) {
				payload.removeAadhaarDocument = true;
			}
		}

		staffMutation.mutate(payload);
	};

	const handleRevealAadhaar = async (staffId: string) => {
		try {
			setIsRevealingAadhaar(true);
			setRevealError(null);
			const res = await revealStaffAadhaar(staffId);
			setRevealedAadhaar(res.aadhaarNumber);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to reveal Aadhaar';
			setRevealError(msg);
		} finally {
			setIsRevealingAadhaar(false);
		}
	};

	const handleDownloadDocument = async (staffId: string) => {
		try {
			setIsDownloadingDoc(true);
			setDocError(null);
			const { blob, fileName } = await downloadStaffAadhaarDocument(staffId);
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName || 'aadhaar_document';
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to download document';
			setDocError(msg);
		} finally {
			setIsDownloadingDoc(false);
		}
	};

	// Filter staff
	const filteredStaffList = useMemo(() => {
		return staffList.filter((staff) => {
			if (staffStatusFilter === 'active' && !staff.isActive) return false;
			if (staffStatusFilter === 'inactive' && staff.isActive) return false;

			if (staffSearch.trim()) {
				const q = staffSearch.toLowerCase();
				const matchName = staff.name.toLowerCase().includes(q);
				const matchPhone = staff.phoneNumber.includes(q);
				const matchRole = (staff.role || '').toLowerCase().includes(q);
				const matchEmail = (staff.email || '').toLowerCase().includes(q);
				if (!matchName && !matchPhone && !matchRole && !matchEmail) return false;
			}
			return true;
		});
	}, [staffList, staffStatusFilter, staffSearch]);

	const totalStaff = staffList.length;
	const activeStaff = staffList.filter((s) => s.isActive).length;
	const inactiveStaff = totalStaff - activeStaff;

	return (
		<div className="space-y-6 animate-fade-in pb-12">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-on-surface tracking-tight">
						Staff Directory
					</h1>
					<p className="text-sm text-on-surface-variant mt-1">
						Manage staff members and employee information
					</p>
				</div>
				<div className="flex items-center gap-2.5">
					{canManageStaff && (
						<Button
							icon={<UserPlus className="w-4 h-4" />}
							onClick={() => {
								resetStaffForm();
								setEditingStaff(null);
								setShowStaffModal(true);
							}}
						>
							Add Staff Member
						</Button>
					)}
				</div>
			</div>

			{/* KPI Summary Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<div className="p-5 rounded-2xl bg-white border border-outline-variant shadow-xs">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Staff</span>
						<span className="p-2 rounded-xl bg-blue-50 text-blue-600">
							<Users className="w-5 h-5" />
						</span>
					</div>
					<p className="text-2xl font-bold text-on-surface mt-2 font-mono">{totalStaff}</p>
					<p className="text-xs text-on-surface-variant mt-1">All registered staff members</p>
				</div>

				<div className="p-5 rounded-2xl bg-white border border-outline-variant shadow-xs">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active Staff</span>
						<span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
							<CheckCircle2 className="w-5 h-5" />
						</span>
					</div>
					<p className="text-2xl font-bold text-emerald-700 mt-2 font-mono">{activeStaff}</p>
					<p className="text-xs text-on-surface-variant mt-1">Currently active employees</p>
				</div>

				<div className="p-5 rounded-2xl bg-white border border-outline-variant shadow-xs">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inactive Staff</span>
						<span className="p-2 rounded-xl bg-slate-100 text-slate-500">
							<User className="w-5 h-5" />
						</span>
					</div>
					<p className="text-2xl font-bold text-slate-700 mt-2 font-mono">{inactiveStaff}</p>
					<p className="text-xs text-on-surface-variant mt-1">Deactivated or former staff</p>
				</div>
			</div>

			{/* Search & Filters */}
			<div className="p-4 rounded-2xl bg-white border border-outline-variant shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
				<div className="relative w-full sm:w-80">
					<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						value={staffSearch}
						onChange={(e) => setStaffSearch(e.target.value)}
						placeholder="Search by name, phone, role, email..."
						className="form-input w-full pl-9 text-xs bg-slate-50/50"
					/>
					{staffSearch && (
						<button
							onClick={() => setStaffSearch('')}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					)}
				</div>

				<div className="flex items-center gap-2 w-full sm:w-auto">
					<span className="text-xs text-slate-500 font-medium">Status:</span>
					<div className="inline-flex rounded-xl bg-slate-100 p-1">
						{(['all', 'active', 'inactive'] as StaffStatusFilter[]).map((status) => (
							<button
								key={status}
								onClick={() => setStaffStatusFilter(status)}
								className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-all cursor-pointer ${
									staffStatusFilter === status
										? 'bg-white text-slate-900 shadow-xs font-semibold'
										: 'text-slate-600 hover:text-slate-900'
								}`}
							>
								{status}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Staff Grid */}
			{staffLoading ? (
				<div className="py-20 text-center text-on-surface-variant">
					<div className="inline-flex items-center gap-2">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
						<span>Loading staff directory...</span>
					</div>
				</div>
			) : filteredStaffList.length === 0 ? (
				<div className="py-20 text-center bg-white border border-outline-variant rounded-2xl p-8">
					<Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
					<h3 className="text-base font-bold text-on-surface">No staff members found</h3>
					<p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
						{staffSearch || staffStatusFilter !== 'all'
							? 'No staff match your current search or filter criteria. Try resetting filters.'
							: 'Get started by adding your first employee to the directory.'}
					</p>
					{canManageStaff && (
						<Button
							variant="secondary"
							className="mt-4"
							icon={<UserPlus className="w-4 h-4" />}
							onClick={() => {
								resetStaffForm();
								setEditingStaff(null);
								setShowStaffModal(true);
							}}
						>
							Add Staff Member
						</Button>
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredStaffList.map((staff) => (
						<div
							key={staff.id}
							className="p-5 rounded-2xl bg-white border border-outline-variant shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
						>
							<div>
								{/* Header & Status */}
								<div className="flex items-start justify-between gap-2">
									<div className="flex items-center gap-3">
										<div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-xs">
											{staff.name
												.split(' ')
												.map((n) => n[0])
												.join('')
												.slice(0, 2)
												.toUpperCase()}
										</div>
										<div>
											<h3 className="font-bold text-sm text-on-surface leading-tight">
												{staff.name}
											</h3>
											<span className="text-xs text-blue-600 font-medium">
												{staff.role || 'Staff Member'}
											</span>
										</div>
									</div>

									<span
										className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
											staff.isActive
												? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
												: 'bg-slate-100 text-slate-600 border border-slate-200'
										}`}
									>
										{staff.isActive ? 'Active' : 'Inactive'}
									</span>
								</div>

								{/* Contact details */}
								<div className="mt-4 space-y-1.5 text-xs text-slate-600">
									<div className="flex items-center gap-2">
										<Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
										<span className="font-mono">{staff.phoneNumber}</span>
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
								</div>

								{/* Aadhaar Details Card */}
								<div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
									<div className="flex items-center justify-between text-xs">
										<span className="text-slate-500 font-medium flex items-center gap-1">
											<ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
											Aadhaar:
										</span>
										<span className="font-mono font-semibold text-slate-800">
											{staff.aadhaarMasked ? (
												staff.aadhaarMasked
											) : (
												<em className="text-slate-400 font-sans font-normal text-[11px]">Not Added</em>
											)}
										</span>
									</div>

									{staff.hasAadhaarDocument && (
										<div className="flex items-center justify-between text-[11px] text-blue-700 bg-blue-50/60 px-2 py-1 rounded-lg">
											<span className="flex items-center gap-1 truncate font-medium">
												<FileCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
												<span className="truncate">{staff.aadhaarDocumentFileName || 'Aadhaar Copy'}</span>
											</span>
											<span className="text-[10px] text-blue-600 font-semibold bg-blue-100/80 px-1.5 py-0.5 rounded shrink-0">
												Attached
											</span>
										</div>
									)}
								</div>
							</div>

							{/* Actions */}
							<div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
								<div className="flex items-center gap-1.5">
									<button
										type="button"
										onClick={() => {
											setRevealedAadhaar(null);
											setRevealError(null);
											setDocError(null);
											setViewingDetailsStaff(staff);
										}}
										className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-all cursor-pointer flex items-center gap-1"
										title="View Staff Profile & Details"
									>
										<Info className="w-3.5 h-3.5 text-slate-500" />
										Details
									</button>

									{canManageStaff && (
										<button
											type="button"
											onClick={() => openEditStaffModal(staff)}
											className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-all cursor-pointer flex items-center gap-1"
											title="Edit Staff Member"
										>
											<Edit2 className="w-3.5 h-3.5 text-slate-500" />
											Edit
										</button>
									)}
								</div>

								<button
									type="button"
									onClick={() => setViewingHistoryStaffId(staff.id)}
									className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer flex items-center gap-1"
									title="View Advance History"
								>
									<History className="w-3.5 h-3.5 text-slate-500" />
									History
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* ── MODAL: STAFF DETAILS ── */}
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
				title="Staff Member Profile"
				description="Employee contact information and verified identity records."
			>
				{viewingDetailsStaff && (
					<div className="space-y-4 pt-1 text-xs">
						{docError && (
							<div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
								<AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
								<span>{docError}</span>
							</div>
						)}

						{/* Profile Card */}
						<div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3.5">
							<div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0">
								{viewingDetailsStaff.name
									.split(' ')
									.map((n) => n[0])
									.join('')
									.slice(0, 2)
									.toUpperCase()}
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center justify-between">
									<h4 className="font-bold text-sm text-slate-900 truncate">
										{viewingDetailsStaff.name}
									</h4>
									<span
										className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
											viewingDetailsStaff.isActive
												? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
												: 'bg-slate-200 text-slate-700'
										}`}
									>
										{viewingDetailsStaff.isActive ? 'Active' : 'Inactive'}
									</span>
								</div>
								<p className="text-blue-600 font-medium text-xs mt-0.5">
									{viewingDetailsStaff.role || 'Staff Member'}
								</p>
							</div>
						</div>

						{/* Contact Grid */}
						<div className="grid grid-cols-2 gap-3 p-3 bg-white border border-slate-200 rounded-xl">
							<div>
								<span className="text-[11px] text-slate-500 font-medium">Phone</span>
								<p className="font-semibold text-slate-800 font-mono mt-0.5">
									{viewingDetailsStaff.phoneNumber}
								</p>
							</div>
							<div>
								<span className="text-[11px] text-slate-500 font-medium">Email</span>
								<p className="font-semibold text-slate-800 truncate mt-0.5">
									{viewingDetailsStaff.email || '—'}
								</p>
							</div>
							<div className="col-span-2">
								<span className="text-[11px] text-slate-500 font-medium">Address</span>
								<p className="text-slate-800 mt-0.5">
									{viewingDetailsStaff.address || '—'}
								</p>
							</div>
						</div>

						{/* Aadhaar Information with Reveal */}
						<div className="p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-xl space-y-2">
							<div className="flex items-center justify-between">
								<span className="font-bold text-blue-950 flex items-center gap-1.5">
									<ShieldCheck className="w-4 h-4 text-blue-600" />
									Aadhaar Identification
								</span>
								{canViewSensitive && viewingDetailsStaff.aadhaarMasked && (
									<button
										type="button"
										onClick={() => {
											if (revealedAadhaar) {
												setRevealedAadhaar(null);
											} else {
												handleRevealAadhaar(viewingDetailsStaff.id);
											}
										}}
										disabled={isRevealingAadhaar}
										className="text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer flex items-center gap-1"
									>
										{isRevealingAadhaar ? (
											<div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
										) : revealedAadhaar ? (
											<>
												<EyeOff className="w-3.5 h-3.5" />
												Hide
											</>
										) : (
											<>
												<Eye className="w-3.5 h-3.5" />
												Reveal
											</>
										)}
									</button>
								)}
							</div>

							<div className="p-2.5 bg-white border border-blue-100 rounded-lg flex items-center justify-between">
								<span className="text-slate-600 font-medium">Number:</span>
								<span className="font-mono font-bold text-slate-900 text-sm tracking-wider">
									{revealedAadhaar ? (
										formatAadhaarInput(revealedAadhaar)
									) : viewingDetailsStaff.aadhaarMasked ? (
										viewingDetailsStaff.aadhaarMasked
									) : (
										<em className="text-slate-400 font-sans font-normal text-xs">Not Added</em>
									)}
								</span>
							</div>

							{revealError && (
								<p className="text-[11px] text-red-600">{revealError}</p>
							)}

							{/* Document Actions */}
							{viewingDetailsStaff.hasAadhaarDocument && (
								<div className="p-2.5 bg-white border border-blue-100 rounded-lg flex items-center justify-between gap-2">
									<div className="flex items-center gap-2 min-w-0">
										<FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
										<span className="font-medium text-slate-800 truncate">
											{viewingDetailsStaff.aadhaarDocumentFileName || 'Aadhaar Document'}
										</span>
									</div>
									<div className="flex items-center gap-1 shrink-0">
										<button
											type="button"
											onClick={() => handleDownloadDocument(viewingDetailsStaff.id)}
											disabled={isDownloadingDoc}
											className="px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded transition-all cursor-pointer flex items-center gap-1"
										>
											<Download className="w-3.5 h-3.5" />
											Download
										</button>
										{canManageStaff && (
											<button
												type="button"
												onClick={() => {
													if (window.confirm('Delete this Aadhaar document file?')) {
														deleteDocMutation.mutate(viewingDetailsStaff.id);
													}
												}}
												disabled={deleteDocMutation.isPending}
												className="p-1 text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
												title="Delete Document"
											>
												<Trash2 className="w-3.5 h-3.5" />
											</button>
										)}
									</div>
								</div>
							)}
						</div>

						<div className="flex justify-end pt-2">
							<Button variant="secondary" onClick={() => setViewingDetailsStaff(null)}>
								Close
							</Button>
						</div>
					</div>
				)}
			</Dialog>

			{/* ── MODAL: ADD / EDIT STAFF ── */}
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
												Current document file on record
											</p>
										</div>
									</div>
									<button
										type="button"
										onClick={() => setStaffFormRemoveDocument(true)}
										className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer shrink-0"
									>
										Replace / Remove
									</button>
								</div>
							) : (
								<div className="space-y-1.5">
									<input
										type="file"
										accept=".pdf,.png,.jpg,.jpeg"
										onChange={(e) => {
											const file = e.target.files?.[0] || null;
											setStaffFormAadhaarFile(file);
										}}
										className="form-input w-full text-xs bg-white file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
									/>
									<p className="text-[11px] text-slate-500">
										PDF, PNG, or JPG (max 5MB)
									</p>
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
							icon={editingStaff ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
						>
							{editingStaff ? 'Save Changes' : 'Add Staff Member'}
						</Button>
					</div>
				</form>
			</Dialog>

			{/* ── MODAL: STAFF ADVANCE HISTORY ── */}
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
												<span
													className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
														adv.status === 'Settled'
															? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
															: adv.status === 'Obsolete'
																? 'bg-slate-100 text-slate-600 border border-slate-200'
																: 'bg-amber-50 text-amber-700 border border-amber-200'
													}`}
												>
													{adv.status}
												</span>
											</div>
											<p className="text-slate-700 font-medium mt-1">{adv.reason}</p>
											<p className="text-[11px] text-slate-500">
												Issued on {formatDate(adv.advanceDate)}
												{adv.status === 'Settled' && adv.settledAt && ` · Settled on ${formatDate(adv.settledAt)}`}
												{adv.status === 'Obsolete' && adv.obsoleteReason && ` · Obsolete: "${adv.obsoleteReason}"`}
											</p>
										</div>
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
		</div>
	);
}

export default StaffDirectoryPage;
