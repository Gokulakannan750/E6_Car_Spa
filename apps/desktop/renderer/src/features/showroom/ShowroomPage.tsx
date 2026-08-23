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
	XCircle,
	ChevronLeft,
	ChevronRight,
	Minus,
	Save,
	X,
	Building2,
	AlertCircle,
	Receipt,
	Clock,
	IndianRupee,
	CreditCard,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import {
	getShowrooms,
	createShowroom,
	updateShowroom,
	deleteShowroom,
	toggleShowroomActive,
	getDailyStaff,
	assignDailyStaff,
	updateDailyStaffVehicles,
	removeDailyStaff,
	getStaffList,
	getShowroomDailyBill,
	setShowroomDailyBill,
	recordShowroomPayment,
	deleteShowroomPayment,
	type ShowroomDto,
	type DailyStaffAssignmentDto,
	type StaffDto,
	type ShowroomDailyBillDto,
	type ShowroomPaymentDto,
} from '../../lib/api';

// Format helpers
function formatDateHeading(dateStr: string): string {
	const d = new Date(dateStr + 'T00:00:00');
	return d.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
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

export function ShowroomPage() {
	const qc = useQueryClient();

	// ── State ─────────────────────────────────────────────────────────────────
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const [selectedShowroom, setSelectedShowroom] = useState<ShowroomDto | null>(null);

	// Daily staff assignment date (YYYY-MM-DD)
	const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

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

	// Local optimistic vehicles count cache for immediate responsiveness
	const [localVehicleCounts, setLocalVehicleCounts] = useState<Record<string, number>>({});

	// ── STEP 2: Showroom Daily Billing & Payment States ────────────────────────
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

	const { data: staffDirectory = [] } = useQuery({
		queryKey: ['staffDirectory'],
		queryFn: () => getStaffList(),
	});

	// Reset local vehicles cache when selectedShowroom or date changes
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
			qc.invalidateQueries({ queryKey: ['showrooms'] });
		},
	});

	// 7. Remove Daily Staff Assignment
	const removeAssignmentMutation = useMutation({
		mutationFn: (assignmentId: string) => removeDailyStaff(assignmentId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setDeletingAssignment(null);
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

		if (editingShowroom) {
			updateShowroomMutation.mutate({
				id: editingShowroom.id,
				data: {
					name: formName.trim(),
					address: formAddress.trim(),
					phone: formPhone.trim() || undefined,
					isActive: formIsActive,
				},
			});
		} else {
			createShowroomMutation.mutate({
				name: formName.trim(),
				address: formAddress.trim(),
				phone: formPhone.trim() || undefined,
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
		const d = new Date(selectedDate + 'T00:00:00');
		d.setDate(d.getDate() + days);
		setSelectedDate(d.toISOString().split('T')[0]);
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

		if (paymentMethod !== 'Cash' && !paymentReference.trim()) {
			setRecordPaymentError(`Transaction Reference / Txn ID is required for ${paymentMethod} payment.`);
			return;
		}

		recordPaymentMutation.mutate({
			amount,
			paymentMethod,
			reference: paymentReference.trim() || undefined,
			notes: paymentNotes.trim() || undefined,
		});
	};

	// ── VIEW 1: Showroom Directory & Master Table ─────────────────────────────
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
							Manage customer showroom master records, daily staff rosters, vehicle attendance, and daily billing
						</p>
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
											onClick={() => setSelectedShowroom(sr)}
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
															Click to open daily workspace
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
														variant={sr.isActive ? 'success' : 'neutral'}
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
												<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success-container text-success">
													<Car className="w-3 h-3" />
													{sr.totalVehiclesToday}
												</span>
											</td>

											{/* Actions */}
											<td className="text-right" onClick={(e) => e.stopPropagation()}>
												<div className="flex items-center justify-end gap-1.5">
													<button
														type="button"
														onClick={() => setSelectedShowroom(sr)}
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
						description="Permanent customer showroom master record. Daily staff assignments and bills will attach to this showroom."
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
									placeholder="e.g. +91 98765 43210"
									value={formPhone}
									onChange={(e) => setFormPhone(e.target.value)}
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

	// ── VIEW 2: Showroom Daily Workspace (Staff + Daily Financial Billing) ──
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
								variant={selectedShowroom.isActive ? 'success' : 'neutral'}
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

				{/* Interactive Date Selector */}
				<div className="flex items-center gap-2 self-start lg:self-auto bg-white p-1.5 rounded-xl border border-outline-variant/80 shadow-2xs">
					<button
						type="button"
						onClick={() => shiftDate(-1)}
						className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
						title="Previous day"
					>
						<ChevronLeft className="w-4 h-4" />
					</button>

					<div className="flex items-center gap-1.5 px-2">
						<Calendar className="w-4 h-4 text-secondary shrink-0" />
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
						className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
						title="Next day"
					>
						<ChevronRight className="w-4 h-4" />
					</button>

					<button
						type="button"
						onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
						className="ml-1 text-[11px] font-semibold text-secondary hover:underline px-2 py-1 rounded hover:bg-secondary/10 transition-colors cursor-pointer"
					>
						Today
					</button>
				</div>
			</div>

			{/* ── Top Metric Cards (Staff + Financial Summary Banner) ────────────── */}
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

			{/* ── SECTION 1: DAILY STAFF ASSIGNMENTS TABLE ───────────────────────── */}
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
											<Button
												variant="primary"
												icon={<UserPlus className="w-4 h-4" />}
												onClick={openAddStaffModal}
											>
												Assign First Staff
											</Button>
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
											{/* Staff Name */}
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

											{/* Phone */}
											<td className="text-sm text-on-surface-variant font-mono">
												{assignment.staffPhone || '—'}
											</td>

											{/* Role */}
											<td>
												<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-container text-on-surface-variant">
													{assignment.staffRole || 'Technician'}
												</span>
											</td>

											{/* Vehicles Attended (Interactive Stepper + Input) */}
											<td className="text-center">
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
											</td>

											{/* Actions */}
											<td className="text-right">
												<button
													type="button"
													onClick={() => setDeletingAssignment(assignment)}
													className="text-error hover:text-error/80 hover:bg-error/10 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
													title="Remove staff assignment"
												>
													<Trash2 className="w-3.5 h-3.5" />
													Remove
												</button>
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
										{/* Payment Date */}
										<td className="text-xs text-on-surface font-medium">
											{new Date(payment.paymentDate).toLocaleString('en-IN', {
												day: 'numeric',
												month: 'short',
												year: 'numeric',
												hour: '2-digit',
												minute: '2-digit',
											})}
										</td>

										{/* Method */}
										<td>
											<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-secondary/10 text-secondary">
												{payment.paymentMethod}
											</span>
										</td>

										{/* Reference */}
										<td className="text-xs font-mono text-on-surface-variant">
											{payment.reference || '—'}
										</td>

										{/* Notes */}
										<td className="text-xs text-on-surface-variant max-w-xs truncate">
											{payment.notes || '—'}
										</td>

										{/* Amount */}
										<td className="text-right text-xs font-bold text-emerald-700 font-mono">
											{formatINR(payment.amount)}
										</td>

										{/* Actions */}
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

						{/* Staff Search / Selector */}
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

							{/* Staff Radio/Select List */}
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

						{/* Vehicles Attended Input */}
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
							<p className="text-[11px] text-on-surface-variant">
								You can also adjust vehicle counts in real time directly from the table roster.
							</p>
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

						<div className="p-3 rounded-lg bg-secondary/5 border border-secondary/20 text-xs text-on-surface space-y-1">
							<p className="font-semibold text-secondary flex items-center gap-1.5">
								<Receipt className="w-4 h-4" />
								Showroom-Level Billing Notice
							</p>
							<p className="text-on-surface-variant">
								The bill amount is charged to the showroom for the entire day. It is independent of individual staff and is not calculated per vehicle.
							</p>
						</div>

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

						{/* Bill & Balance Header Info */}
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

						{/* Payment Method */}
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

						{/* Payment Amount */}
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

						{/* Reference / Txn ID */}
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">
								Reference / Txn ID {paymentMethod === 'Cash' ? '(Optional)' : '*'}
							</label>
							<input
								type="text"
								placeholder={paymentMethod === 'UPI' ? 'e.g. UPI123456789' : paymentMethod === 'Card' ? 'e.g. AUTH-987654' : 'e.g. NEFT/IMPS Ref Number'}
								value={paymentReference}
								onChange={(e) => setPaymentReference(e.target.value)}
								className="form-input w-full text-xs font-mono"
								required={paymentMethod !== 'Cash'}
							/>
						</div>

						{/* Notes */}
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Notes (Optional)</label>
							<input
								type="text"
								placeholder="e.g. First installment paid via GPay by showroom manager."
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
		</div>
	);
}
