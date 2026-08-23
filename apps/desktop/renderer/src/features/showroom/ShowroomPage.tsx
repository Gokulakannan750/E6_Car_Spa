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
	type ShowroomDto,
	type DailyStaffAssignmentDto,
	type StaffDto,
} from '../../lib/api';

// Format helper
function formatDateHeading(dateStr: string): string {
	const d = new Date(dateStr + 'T00:00:00');
	return d.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
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

	const { data: staffDirectory = [] } = useQuery({
		queryKey: ['staff-list'],
		queryFn: () => getStaffList(),
	});

	// Keep local vehicle counts in sync when server returns new data
	useEffect(() => {
		if (dailyStaffData?.staffAssignments) {
			const initial: Record<string, number> = {};
			dailyStaffData.staffAssignments.forEach((a) => {
				initial[a.id] = a.vehiclesAttended;
			});
			setLocalVehicleCounts(initial);
		}
	}, [dailyStaffData]);

	// ── Mutations ─────────────────────────────────────────────────────────────
	const createShowroomMutation = useMutation({
		mutationFn: createShowroom,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setShowShowroomModal(false);
			resetShowroomForm();
		},
		onError: (err: any) => {
			setShowroomFormError(err.message || 'Failed to create showroom.');
		},
	});

	const updateShowroomMutation = useMutation({
		mutationFn: (data: { id: string; payload: any }) => updateShowroom(data.id, data.payload),
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

	const deleteShowroomMutation = useMutation({
		mutationFn: deleteShowroom,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			if (selectedShowroom?.id === deletingShowroom?.id) {
				setSelectedShowroom(null);
			}
			setDeletingShowroom(null);
		},
	});

	const toggleActiveMutation = useMutation({
		mutationFn: toggleShowroomActive,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showrooms'] });
		},
	});

	const assignStaffMutation = useMutation({
		mutationFn: (data: { showroomId: string; staffId: string; date: string; vehiclesAttended: number }) =>
			assignDailyStaff(data.showroomId, {
				staffId: data.staffId,
				date: data.date,
				vehiclesAttended: data.vehiclesAttended,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setShowAddStaffModal(false);
			resetAddStaffForm();
		},
		onError: (err: any) => {
			setAddStaffError(err.message || 'Failed to assign staff.');
		},
	});

	const updateVehiclesMutation = useMutation({
		mutationFn: (data: { assignmentId: string; count: number }) =>
			updateDailyStaffVehicles(data.assignmentId, data.count),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
		},
	});

	const removeStaffMutation = useMutation({
		mutationFn: removeDailyStaff,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['daily-staff', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setDeletingAssignment(null);
		},
	});

	// ── Form Helpers ──────────────────────────────────────────────────────────
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

	const handleSaveShowroom = (e: React.FormEvent) => {
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
				payload: {
					name: formName.trim(),
					address: formAddress.trim(),
					phone: formPhone.trim() || null,
					isActive: formIsActive,
				},
			});
		} else {
			createShowroomMutation.mutate({
				name: formName.trim(),
				address: formAddress.trim(),
				phone: formPhone.trim() || null,
				isActive: formIsActive,
			});
		}
	};

	const resetAddStaffForm = () => {
		setSelectedStaffId('');
		setStaffVehiclesInput(0);
		setStaffSearchTerm('');
		setAddStaffError('');
	};

	const openAddStaffModal = () => {
		resetAddStaffForm();
		setShowAddStaffModal(true);
	};

	const handleAssignStaffSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedStaffId) {
			setAddStaffError('Please select a staff member.');
			return;
		}
		if (!selectedShowroom) return;

		// Check if already assigned in current table
		const isAlreadyAssigned = dailyStaffData?.staffAssignments.some((a) => a.staffId === selectedStaffId);
		if (isAlreadyAssigned) {
			setAddStaffError('This staff member is already assigned to this showroom on this date.');
			return;
		}

		assignStaffMutation.mutate({
			showroomId: selectedShowroom.id,
			staffId: selectedStaffId,
			date: selectedDate,
			vehiclesAttended: Math.max(0, staffVehiclesInput),
		});
	};

	const handleVehiclesChange = (assignmentId: string, newValue: number) => {
		const clamped = Math.max(0, newValue);
		setLocalVehicleCounts((prev) => ({ ...prev, [assignmentId]: clamped }));
		updateVehiclesMutation.mutate({ assignmentId, count: clamped });
	};

	// Date Navigation Helpers
	const shiftDate = (days: number) => {
		const current = new Date(selectedDate + 'T00:00:00');
		current.setDate(current.getDate() + days);
		setSelectedDate(current.toISOString().split('T')[0]);
	};

	const setToday = () => {
		setSelectedDate(new Date().toISOString().split('T')[0]);
	};

	// Filter staff list for add modal
	const availableStaff = useMemo(() => {
		const assignedIds = new Set(dailyStaffData?.staffAssignments.map((a) => a.staffId) ?? []);
		return staffDirectory.filter((s) => {
			const matchesSearch =
				staffSearchTerm === '' ||
				s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
				s.phoneNumber.includes(staffSearchTerm);
			return matchesSearch;
		});
	}, [staffDirectory, dailyStaffData, staffSearchTerm]);

	// Live Total Vehicles attended calculation
	const liveTotalVehicles = useMemo(() => {
		if (!dailyStaffData?.staffAssignments) return 0;
		return dailyStaffData.staffAssignments.reduce((sum, a) => {
			const count = localVehicleCounts[a.id] !== undefined ? localVehicleCounts[a.id] : a.vehiclesAttended;
			return sum + count;
		}, 0);
	}, [dailyStaffData, localVehicleCounts]);

	// ─────────────────────────────────────────────────────────────────────────
	// VIEW 2: SHOWROOM DAILY STAFF WORKSPACE
	// ─────────────────────────────────────────────────────────────────────────
	if (selectedShowroom) {
		return (
			<div className="space-y-6 animate-fade-in pb-12">
				{/* Workspace Header & Back Navigation */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => setSelectedShowroom(null)}
							className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
							title="Back to all showrooms"
						>
							<ArrowLeft className="w-5 h-5" />
						</button>
						<div>
							<div className="flex items-center gap-2.5">
								<h1 className="text-2xl font-bold text-on-surface tracking-tight">{selectedShowroom.name}</h1>
								<StatusBadge status={selectedShowroom.isActive ? 'active' : 'inactive'} />
							</div>
							<div className="flex items-center gap-4 text-xs text-on-surface-variant mt-1">
								<span className="flex items-center gap-1">
									<MapPin className="w-3.5 h-3.5 text-secondary" />
									{selectedShowroom.address}
								</span>
								{selectedShowroom.phone && (
									<span className="flex items-center gap-1">
										<Phone className="w-3.5 h-3.5 text-secondary" />
										{selectedShowroom.phone}
									</span>
								)}
							</div>
						</div>
					</div>

					{/* Date Navigator */}
					<div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/80 shadow-2xs">
						<button
							type="button"
							onClick={() => shiftDate(-1)}
							className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
							title="Previous day"
						>
							<ChevronLeft className="w-4 h-4" />
						</button>

						<div className="flex items-center gap-2 px-2">
							<Calendar className="w-4 h-4 text-secondary shrink-0" />
							<input
								type="date"
								value={selectedDate}
								onChange={(e) => setSelectedDate(e.target.value)}
								className="text-xs font-semibold text-on-surface bg-transparent outline-hidden cursor-pointer"
							/>
						</div>

						<button
							type="button"
							onClick={() => shiftDate(1)}
							className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
							title="Next day"
						>
							<ChevronRight className="w-4 h-4" />
						</button>

						<button
							type="button"
							onClick={setToday}
							className="px-2.5 py-1 text-xs font-medium rounded-md bg-white border border-outline-variant/80 hover:bg-surface-container text-on-surface transition-colors cursor-pointer ml-1"
						>
							Today
						</button>
					</div>
				</div>

				{/* Summary Metrics Bar */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					{/* Assigned Staff Count */}
					<div className="app-card p-4 border-l-4 border-l-secondary flex items-center justify-between">
						<div>
							<p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
								Staff Assigned ({formatDateHeading(selectedDate)})
							</p>
							<p className="text-2xl font-bold text-on-surface mt-1">
								{dailyStaffData?.staffAssignments?.length ?? 0}
							</p>
						</div>
						<div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
							<Users className="w-5 h-5" />
						</div>
					</div>

					{/* Total Vehicles Attended */}
					<div className="app-card p-4 border-l-4 border-l-success flex items-center justify-between">
						<div>
							<p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
								Total Vehicles Attended
							</p>
							<p className="text-2xl font-bold text-success mt-1">{liveTotalVehicles}</p>
						</div>
						<div className="w-10 h-10 rounded-xl bg-success-container text-success flex items-center justify-center">
							<Car className="w-5 h-5" />
						</div>
					</div>

					{/* Add Staff Quick Action */}
					<div className="app-card p-4 flex items-center justify-between bg-secondary/5 border-secondary/20">
						<div>
							<p className="text-xs font-semibold text-secondary uppercase tracking-wider">Daily Roster</p>
							<p className="text-xs text-on-surface-variant mt-1">Assign staff &amp; log attendance</p>
						</div>
						<Button
							variant="primary"
							icon={<UserPlus className="w-4 h-4" />}
							onClick={openAddStaffModal}
							className="shadow-xs cursor-pointer"
						>
							+ Add Staff
						</Button>
					</div>
				</div>

				{/* Daily Staff Assignments Table */}
				<div className="app-card overflow-hidden">
					<div className="p-4 border-b border-outline-variant/60 flex items-center justify-between">
						<div>
							<h2 className="text-base font-semibold text-on-surface">Staff Attendance &amp; Vehicle Counts</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Date: <span className="font-semibold text-on-surface">{formatDateHeading(selectedDate)}</span>
							</p>
						</div>
						<Button
							variant="secondary"
							size="sm"
							icon={<Plus className="w-3.5 h-3.5" />}
							onClick={openAddStaffModal}
						>
							Add Staff
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

					{/* Bottom Summary Bar */}
					{dailyStaffData?.staffAssignments && dailyStaffData.staffAssignments.length > 0 && (
						<div className="p-4 bg-surface-container-low/60 border-t border-outline-variant/60 flex items-center justify-between">
							<span className="text-xs font-medium text-on-surface-variant">
								{dailyStaffData.staffAssignments.length} staff assigned on {formatDateHeading(selectedDate)}
							</span>
							<div className="flex items-center gap-2">
								<span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
									Total Vehicles Attended:
								</span>
								<span className="text-base font-bold text-success bg-success-container px-3 py-0.5 rounded-md">
									{liveTotalVehicles}
								</span>
							</div>
						</div>
					)}
				</div>

				{/* ── MODAL: ADD DAILY STAFF ────────────────────────────────────── */}
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
																{staff.phoneNumber} • {staff.role || 'Staff'}
															</p>
														</div>
													</div>

													{isAlreadyAssigned ? (
														<span className="text-[10px] font-medium text-warning bg-warning-container px-2 py-0.5 rounded">
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
											No staff members found matching "{staffSearchTerm}".
										</div>
									)}
								</div>
							</div>

							{/* Initial Vehicles Attended */}
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-on-surface">Initial Vehicles Attended (Default: 0)</label>
								<input
									type="number"
									min={0}
									value={staffVehiclesInput}
									onChange={(e) => setStaffVehiclesInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
									className="form-input w-full text-sm"
								/>
								<p className="text-[11px] text-on-surface-variant">
									You can also update this count directly from the daily table at any time.
								</p>
							</div>

							{/* Footer */}
							<div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/60">
								<Button
									type="button"
									variant="secondary"
									disabled={assignStaffMutation.isPending}
									onClick={() => setShowAddStaffModal(false)}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="primary"
									loading={assignStaffMutation.isPending}
									disabled={!selectedStaffId}
								>
									Confirm Assignment
								</Button>
							</div>
						</form>
					</Dialog>
				)}

				{/* ── MODAL: REMOVE DAILY STAFF CONFIRMATION ────────────────────── */}
				{deletingAssignment && (
					<Dialog
						open={!!deletingAssignment}
						onOpenChange={(open) => {
							if (!open && !removeStaffMutation.isPending) setDeletingAssignment(null);
						}}
						title="Remove Staff Assignment"
						description={`Are you sure you want to remove ${deletingAssignment.staffName} from ${selectedShowroom.name} on ${formatDateHeading(selectedDate)}?`}
						size="sm"
						footer={
							<>
								<Button
									variant="secondary"
									disabled={removeStaffMutation.isPending}
									onClick={() => setDeletingAssignment(null)}
								>
									Cancel
								</Button>
								<Button
									variant="danger"
									loading={removeStaffMutation.isPending}
									onClick={() => removeStaffMutation.mutate(deletingAssignment.id)}
								>
									Remove Assignment
								</Button>
							</>
						}
					>
						<p className="text-xs text-on-surface-variant">
							This will remove their vehicle attendance record for this day. This action cannot be undone.
						</p>
					</Dialog>
				)}
			</div>
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// VIEW 1: SHOWROOMS MASTER LIST DIRECTORY
	// ─────────────────────────────────────────────────────────────────────────
	return (
		<div className="space-y-6 animate-fade-in pb-12">
			{/* Master Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2.5">
						<Building2 className="w-6 h-6 text-secondary" />
						Showrooms
					</h1>
					<p className="text-sm text-on-surface-variant mt-0.5">
						Manage permanent showrooms and daily staff assignments
					</p>
				</div>

				<Button
					variant="primary"
					icon={<Plus className="w-4 h-4" />}
					onClick={openCreateShowroomModal}
					className="shadow-xs cursor-pointer"
				>
					+ New Showroom
				</Button>
			</div>

			{/* Search & Status Filters */}
			<div className="app-card p-4">
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex-1 min-w-[240px]">
						<SearchInput
							placeholder="Search by showroom name, address or phone..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>

					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value as any)}
						className="form-input w-36 text-sm"
					>
						<option value="all">All Status</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>

					<div className="ml-auto text-xs text-on-surface-variant">
						{showrooms.length} showroom{showrooms.length !== 1 ? 's' : ''}
					</div>
				</div>
			</div>

			{/* Showrooms Master Table */}
			<div className="app-card overflow-hidden">
				<div className="overflow-x-auto">
					<table className="app-table">
						<thead>
							<tr>
								<th>Showroom</th>
								<th>Address</th>
								<th>Phone</th>
								<th>Status</th>
								<th className="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{showroomsLoading && (
								<tr>
									<td colSpan={5} className="py-12 text-center text-on-surface-variant">
										Loading showrooms...
									</td>
								</tr>
							)}

							{!showroomsLoading && showrooms.length === 0 && (
								<tr>
									<td colSpan={5} className="py-16 text-center">
										<div className="max-w-xs mx-auto text-center space-y-3">
											<Building2 className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
											<div>
												<p className="text-sm font-medium text-on-surface">No showrooms found</p>
												<p className="text-xs text-on-surface-variant mt-0.5">
													{search ? 'Try adjusting your search criteria.' : 'Create your first showroom master record.'}
												</p>
											</div>
											<Button
												variant="primary"
												icon={<Plus className="w-4 h-4" />}
												onClick={openCreateShowroomModal}
											>
												Create First Showroom
											</Button>
										</div>
									</td>
								</tr>
							)}

							{!showroomsLoading &&
								showrooms.map((sr) => (
									<tr key={sr.id} className="hover:bg-surface-container/30 transition-colors">
										{/* Showroom Name & Quick Info */}
										<td>
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
													<Building2 className="w-5 h-5" />
												</div>
												<div>
													<button
														type="button"
														onClick={() => setSelectedShowroom(sr)}
														className="font-bold text-sm text-on-surface hover:text-secondary text-left transition-colors cursor-pointer"
													>
														{sr.name}
													</button>
													<p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
														<Users className="w-3 h-3 text-secondary" />
														<span>
															{sr.activeStaffCountToday} staff today • {sr.totalVehiclesToday} vehicles
														</span>
													</p>
												</div>
											</div>
										</td>

										{/* Address */}
										<td className="text-sm text-on-surface-variant max-w-xs truncate">
											<span className="flex items-center gap-1.5" title={sr.address}>
												<MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
												<span className="truncate">{sr.address}</span>
											</span>
										</td>

										{/* Phone */}
										<td className="text-sm text-on-surface-variant font-mono">
											{sr.phone ? (
												<span className="flex items-center gap-1.5">
													<Phone className="w-3.5 h-3.5 text-secondary shrink-0" />
													{sr.phone}
												</span>
											) : (
												'—'
											)}
										</td>

										{/* Status */}
										<td>
											<StatusBadge status={sr.isActive ? 'active' : 'inactive'} />
										</td>

										{/* Actions */}
										<td className="text-right">
											<div className="flex items-center justify-end gap-1.5">
												<Button
													variant="secondary"
													size="sm"
													icon={<Users className="w-3.5 h-3.5" />}
													onClick={() => setSelectedShowroom(sr)}
													title="Manage daily staff assignments"
												>
													View / Staff
												</Button>

												<button
													type="button"
													onClick={() => openEditShowroomModal(sr)}
													className="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
													title="Edit showroom"
												>
													<Edit2 className="w-4 h-4" />
												</button>

												<button
													type="button"
													onClick={() => toggleActiveMutation.mutate(sr.id)}
													className="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
													title={sr.isActive ? 'Deactivate showroom' : 'Activate showroom'}
												>
													{sr.isActive ? (
														<XCircle className="w-4 h-4 text-warning" />
													) : (
														<CheckCircle2 className="w-4 h-4 text-success" />
													)}
												</button>

												<button
													type="button"
													onClick={() => setDeletingShowroom(sr)}
													className="p-1.5 rounded-md hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
													title="Delete showroom"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</div>
										</td>
									</tr>
								))}
						</tbody>
					</table>
				</div>
			</div>

			{/* ── MODAL: CREATE / EDIT SHOWROOM ─────────────────────────────── */}
			{showShowroomModal && (
				<Dialog
					open={showShowroomModal}
					onOpenChange={(open) => {
						if (!open && !createShowroomMutation.isPending && !updateShowroomMutation.isPending) {
							setShowShowroomModal(false);
						}
					}}
					title={editingShowroom ? 'Edit Showroom' : 'New Showroom'}
					description={
						editingShowroom
							? 'Update showroom master details and contact information.'
							: 'Add a new permanent customer showroom to manage daily staff assignments.'
					}
					size="md"
				>
					<form onSubmit={handleSaveShowroom} className="space-y-4 pt-2">
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
								className="form-input w-full text-sm"
								required
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Address *</label>
							<textarea
								placeholder="e.g. 12, Main Road, Erode, Tamil Nadu"
								value={formAddress}
								onChange={(e) => setFormAddress(e.target.value)}
								rows={3}
								className="form-input w-full text-sm resize-none"
								required
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Contact Phone (Optional)</label>
							<input
								type="text"
								placeholder="e.g. 0424-2223344 or 9876543210"
								value={formPhone}
								onChange={(e) => setFormPhone(e.target.value)}
								className="form-input w-full text-sm"
							/>
						</div>

						<div className="flex items-center gap-2 pt-1">
							<input
								type="checkbox"
								id="srIsActive"
								checked={formIsActive}
								onChange={(e) => setFormIsActive(e.target.checked)}
								className="w-4 h-4 rounded text-secondary accent-secondary cursor-pointer"
							/>
							<label htmlFor="srIsActive" className="text-xs font-medium text-on-surface cursor-pointer">
								Active Showroom (Available for daily staff assignments)
							</label>
						</div>

						{/* Footer */}
						<div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="secondary"
								disabled={createShowroomMutation.isPending || updateShowroomMutation.isPending}
								onClick={() => setShowShowroomModal(false)}
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

			{/* ── MODAL: DELETE SHOWROOM CONFIRMATION ───────────────────────── */}
			{deletingShowroom && (
				<Dialog
					open={!!deletingShowroom}
					onOpenChange={(open) => {
						if (!open && !deleteShowroomMutation.isPending) setDeletingShowroom(null);
					}}
					title="Delete Showroom"
					description={`Are you sure you want to delete ${deletingShowroom.name}?`}
					size="sm"
					footer={
						<>
							<Button
								variant="secondary"
								disabled={deleteShowroomMutation.isPending}
								onClick={() => setDeletingShowroom(null)}
							>
								Cancel
							</Button>
							<Button
								variant="danger"
								loading={deleteShowroomMutation.isPending}
								onClick={() => deleteShowroomMutation.mutate(deletingShowroom.id)}
							>
								Delete Showroom
							</Button>
						</>
					}
				>
					<p className="text-xs text-on-surface-variant">
						This will permanently remove the showroom and all associated daily staff assignment records. This action cannot be undone.
					</p>
				</Dialog>
			)}
		</div>
	);
}
export default ShowroomPage;
