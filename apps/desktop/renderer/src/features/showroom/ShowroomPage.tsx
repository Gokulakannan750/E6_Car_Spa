import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	Building2,
	Plus,
	Search,
	MapPin,
	Phone,
	Edit,
	ArrowLeft,
	AlertCircle,
	Eye,
	FileText,
	CalendarCheck,
	Receipt,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useAuth } from '../auth/auth-context';
import {
	getShowrooms,
	createShowroom,
	updateShowroom,
	type ShowroomDto,
	type CreateShowroomInput,
	type UpdateShowroomInput,
} from '../../lib/api';

function capitalizeSentence(str: string): string {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1);
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

export function ShowroomPage() {
	const qc = useQueryClient();
	const navigate = useNavigate();
	const { isOwner, hasPermission } = useAuth();
	const canManage = Boolean(isOwner || hasPermission('showroom.manage'));

	// ── Master State ──────────────────────────────────────────────────────────
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const [selectedShowroom, setSelectedShowroom] = useState<ShowroomDto | null>(null);

	// ── Showroom Modal (Create / Edit) ────────────────────────────────────────
	const [showShowroomModal, setShowShowroomModal] = useState(false);
	const [editingShowroom, setEditingShowroom] = useState<ShowroomDto | null>(null);
	const [formName, setFormName] = useState('');
	const [formAddress, setFormAddress] = useState('');
	const [formPhone, setFormPhone] = useState('');
	const [formGstin, setFormGstin] = useState('');
	const [formIsActive, setFormIsActive] = useState(true);
	const [showroomFormError, setShowroomFormError] = useState('');

	// ── Queries ───────────────────────────────────────────────────────────────
	const { data: showrooms = [], isLoading: showroomsLoading } = useQuery({
		queryKey: ['showrooms', search, statusFilter],
		queryFn: () =>
			getShowrooms({
				search: search || undefined,
				isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
			}),
	});

	// ── Mutations ─────────────────────────────────────────────────────────────
	const createShowroomMutation = useMutation({
		mutationFn: (data: CreateShowroomInput) => createShowroom(data),
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
		mutationFn: ({ id, data }: { id: string; data: UpdateShowroomInput }) =>
			updateShowroom(id, data),
		onSuccess: (updated) => {
			qc.invalidateQueries({ queryKey: ['showrooms'] });
			setShowShowroomModal(false);
			setEditingShowroom(null);
			if (selectedShowroom?.id === updated.id) {
				setSelectedShowroom(updated);
			}
		},
		onError: (err: any) => {
			setShowroomFormError(err.message || 'Failed to update showroom.');
		},
	});

	// ── Modal Handlers ────────────────────────────────────────────────────────
	const resetShowroomForm = () => {
		setEditingShowroom(null);
		setFormName('');
		setFormAddress('');
		setFormPhone('');
		setFormGstin('');
		setFormIsActive(true);
		setShowroomFormError('');
	};

	const openCreateShowroomModal = () => {
		resetShowroomForm();
		setShowShowroomModal(true);
	};

	const openEditModal = (sr: ShowroomDto) => {
		setEditingShowroom(sr);
		setFormName(sr.name);
		setFormAddress(sr.address);
		setFormPhone(sr.phone || '');
		setFormGstin(sr.gstin || '');
		setFormIsActive(sr.isActive);
		setShowroomFormError('');
		setShowShowroomModal(true);
	};

	const handleShowroomFormSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setShowroomFormError('');

		if (!formName.trim()) {
			setShowroomFormError('Showroom name is required.');
			return;
		}

		if (!formAddress.trim()) {
			setShowroomFormError('Showroom address is required.');
			return;
		}

		const cleanPhone = formPhone.trim().replace(/[\s-]/g, '');
		if (cleanPhone && !/^\d{10}$/.test(cleanPhone)) {
			setShowroomFormError('Phone number must be exactly 10 digits.');
			return;
		}

		const cleanGstin = formGstin.trim().toUpperCase();
		if (cleanGstin) {
			const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
			if (!gstinRegex.test(cleanGstin)) {
				setShowroomFormError('Invalid Indian GSTIN structure. Expected 15-character format (e.g., 33AAAAA0000A1Z5).');
				return;
			}
		}

		if (editingShowroom) {
			updateShowroomMutation.mutate({
				id: editingShowroom.id,
				data: {
					name: capitalizeSentence(formName.trim()),
					address: capitalizeSentence(formAddress.trim()),
					phone: cleanPhone || undefined,
					gstin: cleanGstin || null,
					isActive: formIsActive,
				},
			});
		} else {
			createShowroomMutation.mutate({
				name: capitalizeSentence(formName.trim()),
				address: capitalizeSentence(formAddress.trim()),
				phone: cleanPhone || undefined,
				gstin: cleanGstin || undefined,
				isActive: formIsActive,
			});
		}
	};

	return (
		<div className="space-y-6">
			{/* ══════════════════════════════════════════════════════════════════════ */}
			{/* VIEW 1: Showroom Details (Single Showroom Master Profile)              */}
			{/* ══════════════════════════════════════════════════════════════════════ */}
			{selectedShowroom ? (
				<div className="space-y-6">
					{/* Header with Navigation and Profile Actions */}
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline-variant/60">
						<div className="flex items-start gap-3">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setSelectedShowroom(null)}
								className="mt-0.5 text-on-surface-variant hover:text-on-surface"
								title="Back to Showrooms List"
							>
								<ArrowLeft className="w-4 h-4 mr-1" />
								Back
							</Button>

							<div>
								<div className="flex items-center gap-2.5 flex-wrap">
									<h1 className="text-xl font-bold text-on-surface tracking-tight">
										{selectedShowroom.name}
									</h1>
									<span className="font-mono text-xs font-semibold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant">
										#{selectedShowroom.masterId || '—'}
									</span>
									<StatusBadge
										status={selectedShowroom.isActive ? 'Active' : 'Inactive'}
									/>
								</div>
								<p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-1 flex-wrap">
									<MapPin className="w-3.5 h-3.5 shrink-0" />
									<span>{selectedShowroom.address}</span>
									{selectedShowroom.phone && (
										<>
											<span className="mx-1">•</span>
											<Phone className="w-3.5 h-3.5 shrink-0" />
											<span className="font-mono">{selectedShowroom.phone}</span>
										</>
									)}
									{selectedShowroom.gstin && (
										<>
											<span className="mx-1">•</span>
											<span className="font-mono text-[11px] bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/60 font-semibold text-on-surface">
												GSTIN: {selectedShowroom.gstin}
											</span>
										</>
									)}
								</p>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex items-center gap-2">
							<Button
								variant="primary"
								size="sm"
								icon={<CalendarCheck className="w-3.5 h-3.5" />}
								onClick={() => navigate(`/showroom/attendance?showroomId=${selectedShowroom.id}`)}
							>
								Attendance
							</Button>
							<Button
								variant="secondary"
								size="sm"
								icon={<Receipt className="w-3.5 h-3.5" />}
								onClick={() => navigate(`/showroom/bill?showroomId=${selectedShowroom.id}`)}
							>
								Bill
							</Button>
							{canManage && (
								<Button
									variant="secondary"
									size="sm"
									icon={<Edit className="w-3.5 h-3.5" />}
									onClick={() => openEditModal(selectedShowroom)}
								>
									Edit Showroom
								</Button>
							)}
						</div>
					</div>

					{/* Showroom Master Information Cards */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Dealership Profile Details */}
						<div className="card space-y-4">
							<div className="flex items-center gap-2 pb-3 border-b border-outline-variant/60">
								<Building2 className="w-4 h-4 text-secondary" />
								<h2 className="text-sm font-semibold text-on-surface">Dealership Profile</h2>
							</div>

							<div className="space-y-3 text-xs">
								<div className="flex justify-between py-1 border-b border-outline-variant/40">
									<span className="text-on-surface-variant font-medium">Showroom Name</span>
									<span className="text-on-surface font-semibold">{selectedShowroom.name}</span>
								</div>
								<div className="flex justify-between py-1 border-b border-outline-variant/40">
									<span className="text-on-surface-variant font-medium">Operating Status</span>
									<StatusBadge status={selectedShowroom.isActive ? 'Active' : 'Inactive'} />
								</div>
								<div className="flex justify-between py-1 border-b border-outline-variant/40">
									<span className="text-on-surface-variant font-medium">Street Address</span>
									<span className="text-on-surface text-right max-w-xs">{selectedShowroom.address}</span>
								</div>
								<div className="flex justify-between py-1 border-b border-outline-variant/40">
									<span className="text-on-surface-variant font-medium">Contact Phone</span>
									<span className="font-mono text-on-surface">{selectedShowroom.phone || '—'}</span>
								</div>
								<div className="flex justify-between py-1">
									<span className="text-on-surface-variant font-medium">GSTIN (Tax ID)</span>
									<span className="font-mono font-semibold text-on-surface">
										{selectedShowroom.gstin || 'Not Provided'}
									</span>
								</div>
							</div>
						</div>

						{/* System & Registration Metadata */}
						<div className="card space-y-4">
							<div className="flex items-center gap-2 pb-3 border-b border-outline-variant/60">
								<FileText className="w-4 h-4 text-secondary" />
								<h2 className="text-sm font-semibold text-on-surface">System &amp; Registration Metadata</h2>
							</div>

							<div className="space-y-3 text-xs">
								<div className="flex justify-between py-1 border-b border-outline-variant/40">
									<span className="text-on-surface-variant font-medium">Master ID</span>
									<span className="font-mono text-xs font-semibold text-on-surface select-all">
										{selectedShowroom.masterId || '—'}
									</span>
								</div>
								<div className="flex justify-between py-1 border-b border-outline-variant/40">
									<span className="text-on-surface-variant font-medium">Created On</span>
									<span className="text-on-surface">{formatDateTime(selectedShowroom.createdAt)}</span>
								</div>
								<div className="flex justify-between py-1 border-b border-outline-variant/40">
									<span className="text-on-surface-variant font-medium">Last Modified</span>
									<span className="text-on-surface">
										{selectedShowroom.updatedAt ? formatDateTime(selectedShowroom.updatedAt) : 'Never modified'}
									</span>
								</div>
								<div className="flex justify-between py-1">
									<span className="text-on-surface-variant font-medium">Tax Status</span>
									<span className="text-on-surface">
										{selectedShowroom.gstin ? 'Registered GST Dealership' : 'Unregistered / Standard'}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				/* ══════════════════════════════════════════════════════════════════ */
				/* VIEW 2: Showroom Master Directory (List, Search, Filter, CRUD)     */
				/* ══════════════════════════════════════════════════════════════════ */
				<div className="space-y-6">
					{/* Header */}
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<h1 className="text-xl font-bold text-on-surface tracking-tight">Showrooms</h1>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Master directory of dealerships, contact information, and operating status
							</p>
						</div>

						{canManage && (
							<Button
								variant="primary"
								size="sm"
								icon={<Plus className="w-4 h-4" />}
								onClick={openCreateShowroomModal}
							>
								Add Showroom
							</Button>
						)}
					</div>

					{/* Search & Filter Bar */}
					<div className="card p-3">
						<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
								<input
									type="text"
									placeholder="Search by showroom name, address, or phone..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="form-input pl-9 w-full text-xs"
								/>
							</div>

							<div className="flex items-center gap-2">
								<select
									value={statusFilter}
									onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
									className="form-select text-xs"
								>
									<option value="all">All Statuses</option>
									<option value="active">Active Only</option>
									<option value="inactive">Inactive Only</option>
								</select>
							</div>
						</div>
					</div>

					{/* Showrooms Master Table */}
					<div className="card overflow-hidden p-0">
						<div className="overflow-x-auto">
							<table className="app-table">
								<thead>
									<tr>
										<th>Showroom Name</th>
										<th>Address</th>
										<th>Contact Phone</th>
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
															{search || statusFilter !== 'all'
																? 'No showrooms match your search or filter criteria.'
																: 'Get started by creating your first showroom master record.'}
														</p>
													</div>
													{!search && statusFilter === 'all' && canManage && (
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
																Click to view showroom profile
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

												{/* Status (Read-Only) */}
												<td>
													<StatusBadge
														status={sr.isActive ? 'Active' : 'Inactive'}
													/>
												</td>

												{/* Actions */}
												<td className="text-right" onClick={(e) => e.stopPropagation()}>
													<div className="flex items-center justify-end gap-1.5">
														<button
															type="button"
															onClick={() => navigate(`/showroom/attendance?showroomId=${sr.id}`)}
															className="text-primary hover:text-primary/80 hover:bg-primary/10 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
															title="Open showroom attendance"
														>
															<CalendarCheck className="w-3.5 h-3.5" />
															Attendance
														</button>

														<button
															type="button"
															onClick={() => navigate(`/showroom/bill?showroomId=${sr.id}`)}
															className="text-secondary hover:text-secondary/80 hover:bg-secondary/10 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
															title="Open showroom bill"
														>
															<Receipt className="w-3.5 h-3.5" />
															Bill
														</button>

														<button
															type="button"
															onClick={() => setSelectedShowroom(sr)}
															className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
															title="View showroom details"
														>
															<Eye className="w-3.5 h-3.5" />
															View
														</button>

														{canManage && (
															<button
																type="button"
																onClick={() => openEditModal(sr)}
																className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container p-1.5 rounded transition-colors cursor-pointer"
																title="Edit showroom master"
															>
																<Edit className="w-3.5 h-3.5" />
															</button>
														)}
													</div>
												</td>
											</tr>
										))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ══════════════════════════════════════════════════════════════════════ */}
			{/* MODAL 1: Create / Edit Showroom Master                                 */}
			{/* ══════════════════════════════════════════════════════════════════════ */}
			{showShowroomModal && (
				<Dialog
					open={showShowroomModal}
					onOpenChange={(open) => {
						if (!open) {
							setShowShowroomModal(false);
							resetShowroomForm();
						}
					}}
					title={editingShowroom ? 'Edit Showroom' : 'Add New Showroom'}
					description={
						editingShowroom
							? 'Update dealership profile details, contact information, and status.'
							: 'Add a new car showroom dealership to master records.'
					}
				>
					<form onSubmit={handleShowroomFormSubmit} className="space-y-4 pt-2">
						{showroomFormError && (
							<div className="p-3 rounded-lg bg-error-container text-error text-xs flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{showroomFormError}</span>
							</div>
						)}

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Showroom Name *</label>
							<input
								type="text"
								placeholder="e.g. Popular Hyundai Showroom"
								value={formName}
								onChange={(e) => setFormName(e.target.value)}
								className="form-input w-full text-xs"
								required
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Address *</label>
							<textarea
								placeholder="e.g. 142 Brough Road, Erode, Tamil Nadu"
								value={formAddress}
								onChange={(e) => setFormAddress(e.target.value)}
								className="form-input w-full text-xs resize-none"
								rows={2}
								required
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Phone Number (10 digits)</label>
							<input
								type="tel"
								maxLength={10}
								placeholder="e.g. 9876543210"
								value={formPhone}
								onChange={(e) => setFormPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
								className="form-input w-full text-xs font-mono"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">GSTIN (Optional)</label>
							<input
								type="text"
								maxLength={15}
								placeholder="e.g. 33AAAAA0000A1Z5"
								value={formGstin}
								onChange={(e) => setFormGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))}
								className="form-input w-full text-xs font-mono uppercase"
							/>
							<p className="text-[10px] text-on-surface-variant">
								15-character Indian Goods &amp; Services Tax Identification Number
							</p>
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
								onClick={() => {
									setShowShowroomModal(false);
									resetShowroomForm();
								}}
								disabled={createShowroomMutation.isPending || updateShowroomMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								disabled={createShowroomMutation.isPending || updateShowroomMutation.isPending}
							>
								{createShowroomMutation.isPending || updateShowroomMutation.isPending
									? 'Saving...'
									: editingShowroom
									? 'Save Changes'
									: 'Create Showroom'}
							</Button>
						</div>
					</form>
				</Dialog>
			)}

		</div>
	);
}
