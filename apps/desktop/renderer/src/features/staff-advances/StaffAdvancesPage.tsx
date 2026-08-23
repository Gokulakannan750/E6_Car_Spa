import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit2, History, UserPlus, Phone, Mail, MapPin } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import {
	getStaffAdvances,
	getStaffList,
	createStaffAdvance,
	createStaffMember,
	updateStaffMember,
	getStaffAdvancesByStaffId,
	type StaffDto,

} from '../../lib/api';

function formatINR(value: number): string {
	return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type TabType = 'advances' | 'staff';
type StatusFilter = 'all' | 'Pending' | 'Paid' | 'Partially Paid';
type StaffStatusFilter = 'all' | 'active' | 'inactive';

const defaultMockStaff: StaffDto[] = [
	{ id: 'st1', name: 'Gokulakannan S', phoneNumber: '9876543210', email: 'gokul@e6carspa.com', address: '123, Anna Nagar, Chennai', role: 'Manager', isActive: true, totalAdvances: 1, totalAdvanceAmount: 5000 },
	{ id: 'st2', name: 'Ravi Kumar M', phoneNumber: '8765432109', email: 'ravi@e6carspa.com', address: '45, T Nagar, Chennai', role: 'Senior Technician', isActive: true, totalAdvances: 2, totalAdvanceAmount: 3500 },
	{ id: 'st3', name: 'Priya Devi R', phoneNumber: '7654321098', email: 'priya@e6carspa.com', address: '78, Velachery, Chennai', role: 'Cashier', isActive: true, totalAdvances: 0, totalAdvanceAmount: 0 },
	{ id: 'st4', name: 'Senthil Nathan V', phoneNumber: '4321098765', email: 'senthil@e6carspa.com', address: '34, K.K. Nagar, Chennai', role: 'Detailer', isActive: true, totalAdvances: 1, totalAdvanceAmount: 2000 },
];

export function StaffAdvancesPage() {
	const qc = useQueryClient();
	const [activeTab, setActiveTab] = useState<TabType>('staff');

	// ── Advances Tab State ──────────────────────────────────────────────────
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);
	const [staffFilter, setStaffFilter] = useState('');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
	const [showAdvanceModal, setShowAdvanceModal] = useState(false);

	// Advance Form state
	const [formStaffName, setFormStaffName] = useState('');
	const [formStaffRole, setFormStaffRole] = useState('');
	const [formAdvanceType, setFormAdvanceType] = useState('Emergency');
	const [formDescription, setFormDescription] = useState('');
	const [formAmount, setFormAmount] = useState('');
	const [formAdvanceDate, setFormAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
	const [formPaymentMethod, setFormPaymentMethod] = useState('Cash');
	const [formNotes, setFormNotes] = useState('');
	const [formAdvanceError, setFormAdvanceError] = useState('');

	// ── Staff Directory Tab State ────────────────────────────────────────────
	const [staffSearch, setStaffSearch] = useState('');
	const [staffStatusFilter, setStaffStatusFilter] = useState<StaffStatusFilter>('all');
	const [showStaffModal, setShowStaffModal] = useState(false);
	const [editingStaff, setEditingStaff] = useState<StaffDto | null>(null);

	// Staff Member Form state
	const [staffFormName, setStaffFormName] = useState('');
	const [staffFormPhone, setStaffFormPhone] = useState('');
	const [staffFormEmail, setStaffFormEmail] = useState('');
	const [staffFormAddress, setStaffFormAddress] = useState('');
	const [staffFormRole, setStaffFormRole] = useState('Technician');
	const [staffFormIsActive, setStaffFormIsActive] = useState(true);
	const [staffFormError, setStaffFormError] = useState('');

	// Staff Advance History Modal
	const [selectedStaffHistory, setSelectedStaffHistory] = useState<StaffDto | null>(null);

	// ── Queries ─────────────────────────────────────────────────────────────
	const { data: staffList = defaultMockStaff } = useQuery({
		queryKey: ['staff-list'],
		queryFn: async () => {
			try {
				const res = await getStaffList();
				return res && res.length > 0 ? res : defaultMockStaff;
			} catch {
				return defaultMockStaff;
			}
		},
	});

	const { data: advancesData, isLoading: advancesLoading, error: advancesError } = useQuery({
		queryKey: ['staff-advances', page, staffFilter, statusFilter, search],
		queryFn: async () => {
			try {
				return await getStaffAdvances({
					page,
					pageSize: 20,
					staffId: staffFilter || undefined,
					status: statusFilter === 'all' ? undefined : statusFilter,
					search: search || undefined,
				});
			} catch (err) {
				console.warn('Could not fetch advances, showing local state:', err);
				return { items: [], totalCount: 0, page: 1, pageSize: 20 };
			}
		},
	});

	// Query for individual staff advance history
	const { data: staffHistoryAdvances = [], isLoading: historyLoading } = useQuery({
		queryKey: ['staff-history-advances', selectedStaffHistory?.id],
		queryFn: async () => {
			if (!selectedStaffHistory) return [];
			try {
				return await getStaffAdvancesByStaffId(selectedStaffHistory.id);
			} catch {
				return [];
			}
		},
		enabled: !!selectedStaffHistory,
	});

	const advances = advancesData?.items ?? [];
	const totalPages = advancesData ? Math.max(1, Math.ceil(advancesData.totalCount / advancesData.pageSize)) : 1;

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

	// ── Mutations ───────────────────────────────────────────────────────────
	const createAdvanceMutation = useMutation({
		mutationFn: createStaffAdvance,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['staff-advances'] });
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			setShowAdvanceModal(false);
			resetAdvanceForm();
		},
	});

	const createStaffMutation = useMutation({
		mutationFn: createStaffMember,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			setShowStaffModal(false);
			resetStaffForm();
		},
	});

	const updateStaffMutation = useMutation({
		mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateStaffMember>[1] }) =>
			updateStaffMember(id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['staff-list'] });
			setShowStaffModal(false);
			resetStaffForm();
		},
	});

	// Reset page on filter change
	useEffect(() => {
		setPage(1);
	}, [staffFilter, statusFilter, search]);

	// ── Form Handlers ───────────────────────────────────────────────────────
	const resetAdvanceForm = () => {
		setFormStaffName('');
		setFormStaffRole('');
		setFormAdvanceType('Emergency');
		setFormDescription('');
		setFormAmount('');
		setFormAdvanceDate(new Date().toISOString().split('T')[0]);
		setFormPaymentMethod('Cash');
		setFormNotes('');
		setFormAdvanceError('');
	};

	const resetStaffForm = () => {
		setEditingStaff(null);
		setStaffFormName('');
		setStaffFormPhone('');
		setStaffFormEmail('');
		setStaffFormAddress('');
		setStaffFormRole('Technician');
		setStaffFormIsActive(true);
		setStaffFormError('');
	};

	const handleAdvanceSubmit = async () => {
		setFormAdvanceError('');
		if (!formStaffName.trim()) {
			setFormAdvanceError('Staff name is required.');
			return;
		}
		if (!formAdvanceType.trim()) {
			setFormAdvanceError('Advance type is required.');
			return;
		}
		const amt = parseFloat(formAmount);
		if (isNaN(amt) || amt <= 0) {
			setFormAdvanceError('Amount must be greater than zero.');
			return;
		}
		if (!formAdvanceDate) {
			setFormAdvanceError('Date is required.');
			return;
		}

		try {
			await createAdvanceMutation.mutateAsync({
				staffName: formStaffName.trim(),
				staffRole: formStaffRole.trim() || undefined,
				advanceType: formAdvanceType.trim(),
				description: formDescription.trim() || undefined,
				amount: amt,
				advanceDate: formAdvanceDate,
				paymentMethod: formPaymentMethod || undefined,
				notes: formNotes.trim() || undefined,
			});
		} catch (err: any) {
			setFormAdvanceError(err?.message || 'Failed to save advance.');
		}
	};

	const handleStaffSubmit = async () => {
		setStaffFormError('');
		if (!staffFormName.trim()) {
			setStaffFormError('Staff name is required.');
			return;
		}
		if (!staffFormPhone.trim()) {
			setStaffFormError('Phone number is required.');
			return;
		}

		try {
			if (editingStaff) {
				await updateStaffMutation.mutateAsync({
					id: editingStaff.id,
					data: {
						name: staffFormName.trim(),
						phoneNumber: staffFormPhone.trim(),
						email: staffFormEmail.trim() || null,
						address: staffFormAddress.trim() || null,
						role: staffFormRole.trim() || null,
						isActive: staffFormIsActive,
					},
				});
			} else {
				await createStaffMutation.mutateAsync({
					name: staffFormName.trim(),
					phoneNumber: staffFormPhone.trim(),
					email: staffFormEmail.trim() || null,
					address: staffFormAddress.trim() || null,
					role: staffFormRole.trim() || null,
					isActive: staffFormIsActive,
				});
			}
		} catch (err: any) {
			setStaffFormError(err?.message || 'Failed to save staff member.');
		}
	};

	const openEditStaffModal = (staff: StaffDto) => {
		setEditingStaff(staff);
		setStaffFormName(staff.name);
		setStaffFormPhone(staff.phoneNumber);
		setStaffFormEmail(staff.email || '');
		setStaffFormAddress(staff.address || '');
		setStaffFormRole(staff.role || 'Technician');
		setStaffFormIsActive(staff.isActive);
		setStaffFormError('');
		setShowStaffModal(true);
	};

	const openQuickAdvanceModal = (staff: StaffDto) => {
		resetAdvanceForm();
		setFormStaffName(staff.name);
		setFormStaffRole(staff.role || '');
		setShowAdvanceModal(true);
	};

	return (
		<div className="space-y-5 animate-fade-in">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-on-surface tracking-tight">
						{activeTab === 'staff' ? 'Staff Directory' : 'Advance Payments'}
					</h1>
					<p className="text-sm text-on-surface-variant mt-1">
						{activeTab === 'staff'
							? 'Maintain staff records, designations, and contact details'
							: 'Manage employee salary advances, loans and repayments'}
					</p>
				</div>
				<div className="flex items-center gap-2">
					{activeTab === 'staff' ? (
						<Button icon={<UserPlus className="w-4 h-4" />} onClick={() => { resetStaffForm(); setShowStaffModal(true); }}>
							Add Staff Member
						</Button>
					) : (
						<Button icon={<Plus className="w-4 h-4" />} onClick={() => { resetAdvanceForm(); setShowAdvanceModal(true); }}>
							Record Advance
						</Button>
					)}
				</div>
			</div>

			{/* Main Tab Switcher */}
			<div className="flex items-center gap-1 border-b border-outline-variant pb-px">
				<button
					onClick={() => setActiveTab('staff')}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
						activeTab === 'staff'
							? 'border-secondary text-secondary font-semibold'
							: 'border-transparent text-on-surface-variant hover:text-on-surface'
					}`}
				>
					Staff Directory ({staffList.length})
				</button>
				<button
					onClick={() => setActiveTab('advances')}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
						activeTab === 'advances'
							? 'border-secondary text-secondary font-semibold'
							: 'border-transparent text-on-surface-variant hover:text-on-surface'
					}`}
				>
					Advance Payments
				</button>
			</div>

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* TAB 1: ADVANCES LIST */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			{activeTab === 'advances' && (
				<div className="space-y-5 animate-fade-in">
					{/* KPI Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
						<KpiCard label="Total Advances" value={advancesData ? formatINR(advancesData.items.reduce((s, a) => s + a.amount, 0)) : '₹0.00'} />
						<KpiCard label="Outstanding" value={advancesData ? formatINR(advancesData.items.filter((a) => a.status === 'Pending').reduce((s, a) => s + a.amount, 0)) : '₹0.00'} />
						<KpiCard label="Staff with Advances" value={String(new Set(advancesData?.items.map((a) => a.staffId) ?? []).size)} />
						<KpiCard label="Transactions" value={String(advancesData?.totalCount ?? 0)} />
					</div>

					{/* Advances Filters */}
					<div className="app-card p-4">
						<div className="flex items-center gap-3 flex-wrap">
							<div className="flex-1 min-w-[240px] max-w-md">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
									<input
										className="form-input pl-9 pr-4 w-full"
										placeholder="Search advances..."
										value={search}
										onChange={(e) => setSearch(e.target.value)}
									/>
								</div>
							</div>
							<select
								value={staffFilter}
								onChange={(e) => setStaffFilter(e.target.value)}
								className="form-input w-48"
							>
								<option value="">All Staff</option>
								{staffList?.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name}
									</option>
								))}
							</select>
							<select
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
								className="form-input w-40"
							>
								<option value="all">All Status</option>
								<option value="Pending">Pending</option>
								<option value="Paid">Paid</option>
								<option value="Partially Paid">Partially Paid</option>
							</select>
							<div className="ml-auto text-sm text-on-surface-variant">
								{advancesData?.totalCount ?? 0} record{(advancesData?.totalCount ?? 0) !== 1 ? 's' : ''}
							</div>
						</div>
					</div>

					{/* Advances Table */}
					<div className="app-card overflow-hidden">
						<div className="overflow-x-auto">
							<table className="app-table">
								<thead>
									<tr>
										<th>Employee</th>
										<th>Date</th>
										<th>Type</th>
										<th>Amount</th>
										<th>Payment Method</th>
										<th>Status</th>
										<th className="text-right">Actions</th>
									</tr>
								</thead>
								<tbody>
									{advancesLoading && (
										<tr>
											<td colSpan={7} className="py-12 text-center text-on-surface-variant">
												Loading advances...
											</td>
										</tr>
									)}
									{advancesError && (
										<tr>
											<td colSpan={7} className="py-12 text-center text-error">
												Failed to load advances.
											</td>
										</tr>
									)}
									{!advancesLoading && !advancesError && advances.map((a) => (
										<tr key={a.id}>
											<td>
												<div className="flex items-center gap-3">
													<div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-sm font-semibold shrink-0">
														{a.staffName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
													</div>
													<div>
														<p className="font-medium text-sm text-on-surface">{a.staffName}</p>
														<p className="text-xs text-on-surface-variant">{a.staffRole ?? 'Staff'}</p>
													</div>
												</div>
											</td>
											<td className="text-sm text-on-surface-variant">{new Date(a.advanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
											<td className="text-sm">{a.advanceType}</td>
											<td className="text-sm font-semibold text-on-surface">{formatINR(a.amount)}</td>
											<td className="text-sm text-on-surface-variant">{a.paymentMethod ?? '—'}</td>
											<td>
												<StatusBadge status={a.status === 'Paid' ? 'active' : a.status === 'Pending' ? 'inactive' : 'warning'} />
											</td>
											<td className="text-right">
												<button
													className="text-secondary hover:underline text-sm font-medium"
													onClick={() => {
														const foundStaff = staffList.find((s) => s.id === a.staffId || s.name === a.staffName);
														if (foundStaff) setSelectedStaffHistory(foundStaff);
													}}
												>
													View History
												</button>
											</td>
										</tr>
									))}
									{!advancesLoading && !advancesError && advances.length === 0 && (
										<tr>
											<td colSpan={7} className="py-16 text-center">
												<p className="text-on-surface-variant text-sm">No staff advances found.</p>
												<Button variant="secondary" className="mt-3" onClick={() => { resetAdvanceForm(); setShowAdvanceModal(true); }}>
													Record First Advance
												</Button>
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						{/* Pagination */}
						{totalPages > 1 && (
							<div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
								<span className="text-sm text-on-surface-variant">
									Page {page} of {totalPages}
								</span>
								<div className="flex gap-2">
									<Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
										Previous
									</Button>
									<Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
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
				<div className="space-y-5 animate-fade-in">
					{/* Staff KPI Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
						<KpiCard label="Total Staff Members" value={String(staffList.length)} />
						<KpiCard label="Active Employees" value={String(staffList.filter((s) => s.isActive).length)} />
						<KpiCard label="Total Disbursed" value={formatINR(staffList.reduce((sum, s) => sum + (s.totalAdvanceAmount || 0), 0))} />
						<KpiCard label="With Active Advances" value={String(staffList.filter((s) => s.totalAdvances > 0).length)} />
					</div>

					{/* Staff Search & Filter Bar */}
					<div className="app-card p-4">
						<div className="flex items-center gap-3 flex-wrap">
							<div className="flex-1 min-w-[240px] max-w-md">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
									<input
										className="form-input pl-9 pr-4 w-full"
										placeholder="Search staff by name, phone, role..."
										value={staffSearch}
										onChange={(e) => setStaffSearch(e.target.value)}
									/>
								</div>
							</div>

							<div className="flex items-center gap-1">
								{(['all', 'active', 'inactive'] as StaffStatusFilter[]).map((st) => (
									<button
										key={st}
										onClick={() => setStaffStatusFilter(st)}
										className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
											staffStatusFilter === st
												? 'bg-secondary text-white'
												: 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
										}`}
									>
										{st === 'all' ? 'All Staff' : st.charAt(0).toUpperCase() + st.slice(1)}
									</button>
								))}
							</div>

							<div className="ml-auto text-sm text-on-surface-variant">
								{filteredStaff.length} employee{filteredStaff.length !== 1 ? 's' : ''}
							</div>
						</div>
					</div>

					{/* Staff Directory Table */}
					<div className="app-card overflow-hidden">
						<div className="overflow-x-auto">
							<table className="app-table">
								<thead>
									<tr>
										<th>Employee</th>
										<th>Role</th>
										<th>Phone</th>
										<th>Email &amp; Location</th>
										<th>Advances Taken</th>
										<th>Status</th>
										<th className="text-right">Actions</th>
									</tr>
								</thead>
								<tbody>
									{filteredStaff.map((staff) => (
										<tr key={staff.id}>
											<td>
												<div className="flex items-center gap-3">
													<div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-sm font-semibold shrink-0">
														{staff.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
													</div>
													<div>
														<p className="font-medium text-sm text-on-surface">{staff.name}</p>
														<span className="text-xs text-on-surface-variant">ID: {staff.id.slice(0, 8)}</span>
													</div>
												</div>
											</td>
											<td>
												<span className="bg-surface-container text-on-surface-variant px-2.5 py-1 rounded text-xs font-medium">
													{staff.role || 'Staff'}
												</span>
											</td>
											<td>
												<span className="font-mono text-sm text-on-surface flex items-center gap-1.5">
													<Phone className="w-3.5 h-3.5 text-on-surface-variant" />
													{staff.phoneNumber}
												</span>
											</td>
											<td>
												<div className="space-y-0.5 text-xs text-on-surface-variant">
													{staff.email && (
														<p className="flex items-center gap-1">
															<Mail className="w-3 h-3 text-outline" />
															{staff.email}
														</p>
													)}
													{staff.address && (
														<p className="flex items-center gap-1 truncate max-w-[200px]" title={staff.address}>
															<MapPin className="w-3 h-3 text-outline" />
															{staff.address}
														</p>
													)}
													{!staff.email && !staff.address && <span>—</span>}
												</div>
											</td>
											<td>
												<div>
													<p className="text-sm font-semibold text-on-surface">
														{formatINR(staff.totalAdvanceAmount || 0)}
													</p>
													<p className="text-xs text-on-surface-variant">
														{staff.totalAdvances || 0} advance{(staff.totalAdvances || 0) !== 1 ? 's' : ''}
													</p>
												</div>
											</td>
											<td>
												<StatusBadge status={staff.isActive ? 'active' : 'inactive'} />
											</td>
											<td className="text-right">
												<div className="flex items-center justify-end gap-1.5">
													<Button
														variant="secondary"
														size="sm"
														icon={<History className="w-3.5 h-3.5" />}
														title="View Advance History"
														onClick={() => setSelectedStaffHistory(staff)}
													>
														History
													</Button>
													<Button
														variant="secondary"
														size="sm"
														icon={<Edit2 className="w-3.5 h-3.5" />}
														title="Edit Staff Member"
														onClick={() => openEditStaffModal(staff)}
													>
														Edit
													</Button>
													<Button
														variant="primary"
														size="sm"
														icon={<Plus className="w-3.5 h-3.5" />}
														title="Record Advance for this staff member"
														onClick={() => openQuickAdvanceModal(staff)}
													>
														Advance
													</Button>
												</div>
											</td>
										</tr>
									))}

									{filteredStaff.length === 0 && (
										<tr>
											<td colSpan={7} className="py-16 text-center">
												<p className="text-on-surface-variant text-sm">No staff members found matching your search.</p>
												<Button
													variant="secondary"
													className="mt-3"
													icon={<UserPlus className="w-4 h-4" />}
													onClick={() => { resetStaffForm(); setShowStaffModal(true); }}
												>
													Add Staff Member
												</Button>
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* MODAL 1: RECORD ADVANCE */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			{showAdvanceModal && (
				<Dialog
					open={showAdvanceModal}
					onOpenChange={(open) => {
						if (!open) { resetAdvanceForm(); setShowAdvanceModal(false); }
					}}
					title="Record New Advance"
					description="Create a new staff advance entry"
					footer={
						<>
							<Button variant="secondary" onClick={() => { resetAdvanceForm(); setShowAdvanceModal(false); }}>
								Cancel
							</Button>
							<Button onClick={handleAdvanceSubmit} loading={createAdvanceMutation.isPending}>
								Save Advance
							</Button>
						</>
					}
					size="lg"
				>
					<NewAdvanceFormFields
						staffName={formStaffName}
						setStaffName={setFormStaffName}
						staffRole={formStaffRole}
						setStaffRole={setFormStaffRole}
						advanceType={formAdvanceType}
						setAdvanceType={setFormAdvanceType}
						description={formDescription}
						setDescription={setFormDescription}
						amount={formAmount}
						setAmount={setFormAmount}
						advanceDate={formAdvanceDate}
						setAdvanceDate={setFormAdvanceDate}
						paymentMethod={formPaymentMethod}
						setPaymentMethod={setFormPaymentMethod}
						notes={formNotes}
						setNotes={setFormNotes}
						formError={formAdvanceError}
						staffList={staffList}
					/>
				</Dialog>
			)}

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* MODAL 2: ADD / EDIT STAFF MEMBER */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			{showStaffModal && (
				<Dialog
					open={showStaffModal}
					onOpenChange={(open) => {
						if (!open) { resetStaffForm(); setShowStaffModal(false); }
					}}
					title={editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
					description={editingStaff ? `Update details for ${editingStaff.name}` : 'Enter the employee details below to add them to the staff directory'}
					footer={
						<>
							<Button variant="secondary" onClick={() => { resetStaffForm(); setShowStaffModal(false); }}>
								Cancel
							</Button>
							<Button
								onClick={handleStaffSubmit}
								loading={createStaffMutation.isPending || updateStaffMutation.isPending}
							>
								{editingStaff ? 'Update Staff Member' : 'Add Staff Member'}
							</Button>
						</>
					}
					size="lg"
				>
					<div className="space-y-4">
						{staffFormError && (
							<div className="flex items-center gap-2 bg-error/10 text-error text-sm rounded-lg px-4 py-2.5">
								<span className="font-medium">{staffFormError}</span>
							</div>
						)}

						<div className="grid grid-cols-2 gap-4">
							<div className="col-span-2 sm:col-span-1">
								<label className="block text-sm font-medium text-on-surface mb-1">
									Full Name <span className="text-error">*</span>
								</label>
								<input
									className="form-input w-full"
									value={staffFormName}
									onChange={(e) => setStaffFormName(e.target.value)}
									placeholder="e.g., Rajesh Kumar"
								/>
							</div>

							<div className="col-span-2 sm:col-span-1">
								<label className="block text-sm font-medium text-on-surface mb-1">
									Phone Number <span className="text-error">*</span>
								</label>
								<input
									className="form-input w-full"
									value={staffFormPhone}
									onChange={(e) => setStaffFormPhone(e.target.value)}
									placeholder="e.g., 9876543210"
								/>
							</div>

							<div className="col-span-2 sm:col-span-1">
								<label className="block text-sm font-medium text-on-surface mb-1">Role / Designation</label>
								<select
									className="form-input w-full"
									value={staffFormRole}
									onChange={(e) => setStaffFormRole(e.target.value)}
								>
									<option value="Senior Technician">Senior Technician</option>
									<option value="Technician">Technician</option>
									<option value="Detailer">Detailer</option>
									<option value="Car Washer">Car Washer</option>
									<option value="Supervisor">Supervisor</option>
									<option value="Manager">Manager</option>
									<option value="Cashier">Cashier</option>
									<option value="Driver">Driver</option>
									<option value="Other">Other</option>
								</select>
							</div>

							<div className="col-span-2 sm:col-span-1">
								<label className="block text-sm font-medium text-on-surface mb-1">Email Address</label>
								<input
									type="email"
									className="form-input w-full"
									value={staffFormEmail}
									onChange={(e) => setStaffFormEmail(e.target.value)}
									placeholder="e.g., employee@e6carspa.com"
								/>
							</div>

							<div className="col-span-2">
								<label className="block text-sm font-medium text-on-surface mb-1">Address</label>
								<textarea
									className="form-input w-full resize-none"
									value={staffFormAddress}
									onChange={(e) => setStaffFormAddress(e.target.value)}
									rows={2}
									placeholder="Residential address..."
								/>
							</div>

							<div className="col-span-2 flex items-center gap-2 pt-1">
								<input
									type="checkbox"
									id="staff-is-active"
									checked={staffFormIsActive}
									onChange={(e) => setStaffFormIsActive(e.target.checked)}
									className="rounded border-outline text-secondary focus:ring-secondary/20 h-4 w-4"
								/>
								<label htmlFor="staff-is-active" className="text-sm font-medium text-on-surface cursor-pointer">
									Active Employee (eligible for job card assignments and salary advances)
								</label>
							</div>
						</div>
					</div>
				</Dialog>
			)}

			{/* ─────────────────────────────────────────────────────────────────── */}
			{/* MODAL 3: STAFF ADVANCE HISTORY */}
			{/* ─────────────────────────────────────────────────────────────────── */}
			{selectedStaffHistory && (
				<Dialog
					open={!!selectedStaffHistory}
					onOpenChange={(open) => {
						if (!open) setSelectedStaffHistory(null);
					}}
					title={`${selectedStaffHistory.name} — Advance History`}
					description={`Role: ${selectedStaffHistory.role || 'Staff'} · Phone: ${selectedStaffHistory.phoneNumber}`}
					footer={
						<>
							<Button variant="secondary" onClick={() => setSelectedStaffHistory(null)}>
								Close
							</Button>
							<Button
								icon={<Plus className="w-4 h-4" />}
								onClick={() => {
									const st = selectedStaffHistory;
									setSelectedStaffHistory(null);
									openQuickAdvanceModal(st);
								}}
							>
								Record New Advance
							</Button>
						</>
					}
					size="lg"
				>
					<div className="space-y-4">
						{/* Summary info box */}
						<div className="grid grid-cols-2 gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant text-sm">
							<div>
								<span className="text-xs text-on-surface-variant block">Total Advances Taken</span>
								<span className="font-semibold text-on-surface text-base">
									{formatINR(selectedStaffHistory.totalAdvanceAmount || 0)}
								</span>
							</div>
							<div>
								<span className="text-xs text-on-surface-variant block">Total Transactions</span>
								<span className="font-semibold text-on-surface text-base">
									{selectedStaffHistory.totalAdvances || 0}
								</span>
							</div>
						</div>

						{/* Advance rows */}
						{historyLoading && (
							<p className="text-sm text-center py-6 text-on-surface-variant">Loading transaction history...</p>
						)}

						{!historyLoading && staffHistoryAdvances.length > 0 && (
							<div className="space-y-2 max-h-72 overflow-y-auto pr-1">
								{staffHistoryAdvances.map((adv) => (
									<div
										key={adv.id}
										className="flex items-center justify-between p-3 bg-white rounded-lg border border-outline-variant/70 text-sm"
									>
										<div>
											<p className="font-medium text-on-surface">{adv.advanceType}</p>
											<p className="text-xs text-on-surface-variant">
												{new Date(adv.advanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
												{adv.paymentMethod ? ` · ${adv.paymentMethod}` : ''}
												{adv.description ? ` · ${adv.description}` : ''}
											</p>
										</div>
										<div className="text-right">
											<p className="font-semibold text-on-surface">{formatINR(adv.amount)}</p>
											<StatusBadge status={adv.status === 'Paid' ? 'active' : adv.status === 'Pending' ? 'inactive' : 'warning'} />
										</div>
									</div>
								))}
							</div>
						)}

						{!historyLoading && staffHistoryAdvances.length === 0 && (
							<div className="text-center py-8">
								<p className="text-sm text-on-surface-variant">No advances recorded for this staff member yet.</p>
							</div>
						)}
					</div>
				</Dialog>
			)}
		</div>
	);
}

function KpiCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="app-card p-4">
			<p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
			<p className="text-xl font-semibold text-on-surface">{value}</p>
		</div>
	);
}

interface AdvanceFormProps {
	staffName: string;
	setStaffName: (v: string) => void;
	staffRole: string;
	setStaffRole: (v: string) => void;
	advanceType: string;
	setAdvanceType: (v: string) => void;
	description: string;
	setDescription: (v: string) => void;
	amount: string;
	setAmount: (v: string) => void;
	advanceDate: string;
	setAdvanceDate: (v: string) => void;
	paymentMethod: string;
	setPaymentMethod: (v: string) => void;
	notes: string;
	setNotes: (v: string) => void;
	formError: string;
	staffList: StaffDto[];
}

function NewAdvanceFormFields({
	staffName,
	setStaffName,
	staffRole,
	setStaffRole,
	advanceType,
	setAdvanceType,
	description,
	setDescription,
	amount,
	setAmount,
	advanceDate,
	setAdvanceDate,
	paymentMethod,
	setPaymentMethod,
	notes,
	setNotes,
	formError,
	staffList,
}: AdvanceFormProps) {
	return (
		<div className="space-y-4">
			{formError && (
				<div className="flex items-center gap-2 bg-error/10 text-error text-sm rounded-lg px-4 py-2.5">
					<span className="font-medium">{formError}</span>
				</div>
			)}

			<div className="grid grid-cols-2 gap-4">
				<div className="col-span-2 sm:col-span-1">
					<label className="block text-sm font-medium text-on-surface mb-1">
						Select or Enter Staff Name <span className="text-error">*</span>
					</label>
					<input
						list="staff-names-list"
						className="form-input w-full"
						value={staffName}
						onChange={(e) => {
							const val = e.target.value;
							setStaffName(val);
							const matched = staffList.find((s) => s.name.toLowerCase() === val.toLowerCase());
							if (matched && matched.role) {
								setStaffRole(matched.role);
							}
						}}
						placeholder="Enter or select staff name"
					/>
					<datalist id="staff-names-list">
						{staffList.map((s) => (
							<option key={s.id} value={s.name}>
								{s.role ? `${s.name} (${s.role})` : s.name}
							</option>
						))}
					</datalist>
				</div>

				<div className="col-span-2 sm:col-span-1">
					<label className="block text-sm font-medium text-on-surface mb-1">Role / Designation</label>
					<input
						className="form-input w-full"
						value={staffRole}
						onChange={(e) => setStaffRole(e.target.value)}
						placeholder="e.g., Senior Technician"
					/>
				</div>

				<div className="col-span-2 sm:col-span-1">
					<label className="block text-sm font-medium text-on-surface mb-1">
						Advance Type <span className="text-error">*</span>
					</label>
					<select className="form-input w-full" value={advanceType} onChange={(e) => setAdvanceType(e.target.value)}>
						<option value="Emergency">Emergency</option>
						<option value="Salary Advance">Salary Advance</option>
						<option value="Festival">Festival</option>
						<option value="Medical">Medical</option>
						<option value="Other">Other</option>
					</select>
				</div>

				<div className="col-span-2 sm:col-span-1">
					<label className="block text-sm font-medium text-on-surface mb-1">
						Amount (INR) <span className="text-error">*</span>
					</label>
					<input
						type="number"
						className="form-input w-full"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						placeholder="0.00"
						min="0.01"
						step="0.01"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-on-surface mb-1">
						Date <span className="text-error">*</span>
					</label>
					<input
						type="date"
						className="form-input w-full"
						value={advanceDate}
						onChange={(e) => setAdvanceDate(e.target.value)}
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-on-surface mb-1">Payment Method</label>
					<select className="form-input w-full" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
						<option value="Cash">Cash</option>
						<option value="Bank Transfer">Bank Transfer</option>
						<option value="UPI">UPI</option>
						<option value="Cheque">Cheque</option>
					</select>
				</div>

				<div className="col-span-2">
					<label className="block text-sm font-medium text-on-surface mb-1">Description</label>
					<textarea
						className="form-input w-full resize-none"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={2}
						placeholder="Reason for advance..."
					/>
				</div>

				<div className="col-span-2">
					<label className="block text-sm font-medium text-on-surface mb-1">Notes</label>
					<textarea
						className="form-input w-full resize-none"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						rows={2}
						placeholder="Additional notes..."
					/>
				</div>
			</div>
		</div>
	);
}
