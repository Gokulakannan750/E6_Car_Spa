import { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	Truck,
	Clock,
	AlertTriangle,
	CheckCircle2,
	XCircle,
	Plus,
	Phone,
	X,
	Lock,
} from 'lucide-react';
import {
	getOutsideJobsByJobCardId,
	getVendors,
	getStaffList,
	createOutsideJob,
	markOutsideJobReturned,
	cancelOutsideJob,
	createVendor,
	type OutsideJobDto,
	type CreateOutsideJobRequest,
	type MarkOutsideJobReturnedRequest,
} from '../../lib/api';

export interface OutsideJobsSectionHandle {
	openSendModal: () => void;
	openReturnModal: () => void;
}

export interface OutsideJobsSectionProps {
	jobCardId: string;
	vehicleRegistration: string;
	vehicleModel: string;
	isLocked?: boolean;
	onUpdated?: () => void;
}

export const OutsideJobsSection = forwardRef<OutsideJobsSectionHandle, OutsideJobsSectionProps>(
	function OutsideJobsSection(
		{ jobCardId, vehicleRegistration, vehicleModel, isLocked = false, onUpdated },
		ref
	) {
	const queryClient = useQueryClient();

	const [showAddModal, setShowAddModal] = useState(false);
	const [showReturnModal, setShowReturnModal] = useState<OutsideJobDto | null>(null);
	const [showCancelModal, setShowCancelModal] = useState<OutsideJobDto | null>(null);
	const [showNewVendorModal, setShowNewVendorModal] = useState(false);

	// Add Form State
	const [selectedVendorId, setSelectedVendorId] = useState('');
	const [serviceName, setServiceName] = useState('');
	const [sentAt, setSentAt] = useState(() => {
		const now = new Date();
		now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
		return now.toISOString().slice(0, 16);
	});
	const [sentByType, setSentByType] = useState<'Owner' | 'Staff'>('Owner');
	const [sentByStaffId, setSentByStaffId] = useState('');
	const [notes, setNotes] = useState('');
	const [addError, setAddError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Return Form State
	const [returnAt, setReturnAt] = useState(() => {
		const now = new Date();
		now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
		return now.toISOString().slice(0, 16);
	});
	const [finalCost, setFinalCost] = useState('');
	const [returnNotes, setReturnNotes] = useState('');
	const [returnError, setReturnError] = useState<string | null>(null);

	// Cancel Form State
	const [cancelReason, setCancelReason] = useState('');
	const [cancelError, setCancelError] = useState<string | null>(null);

	// New Vendor Form State
	const [newVendorName, setNewVendorName] = useState('');
	const [newVendorPhone, setNewVendorPhone] = useState('');
	const [newVendorContact, setNewVendorContact] = useState('');
	const [newVendorAddress, setNewVendorAddress] = useState('');
	const [newVendorSpecialty, setNewVendorSpecialty] = useState('');
	const [vendorCreateError, setVendorCreateError] = useState<string | null>(null);

	// Fetch Outside Jobs for this job card
	const { data: outsideJobs = [], isLoading, refetch } = useQuery({
		queryKey: ['outsideJobs', jobCardId],
		queryFn: () => getOutsideJobsByJobCardId(jobCardId),
		enabled: Boolean(jobCardId),
	});

	// Fetch Vendors
	const { data: vendors = [], refetch: refetchVendors } = useQuery({
		queryKey: ['vendors'],
		queryFn: () => getVendors(true),
	});

	// Fetch Staff List
	const { data: staffList = [] } = useQuery({
		queryKey: ['staffList'],
		queryFn: () => getStaffList(),
	});

	// Derived states
	const activeJob = useMemo(
		() => outsideJobs.find((j) => j.status === 1), // 1 = Outside
		[outsideJobs]
	);

	const historicalJobs = useMemo(
		() => outsideJobs.filter((j) => j.status !== 1),
		[outsideJobs]
	);

	const isVehicleOutside = Boolean(activeJob);

	useImperativeHandle(ref, () => ({
		openSendModal: () => {
			if (isLocked) return;
			setShowAddModal(true);
			setAddError(null);
		},
		openReturnModal: () => {
			if (activeJob) {
				setShowReturnModal(activeJob);
				setFinalCost(activeJob.vendorCost ? String(activeJob.vendorCost) : '');
				setReturnError(null);
			} else {
				if (isLocked) return;
				setShowAddModal(true);
			}
		},
	}));

	const handleSendOutside = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isLocked) {
			setAddError('Job Card is locked because an invoice has been generated.');
			return;
		}
		if (!serviceName.trim()) {
			setAddError('Outside service is required.');
			return;
		}
		if (!selectedVendorId) {
			setAddError('Outside shop / vendor is required.');
			return;
		}
		if (!sentAt) {
			setAddError('Sent date & time is required.');
			return;
		}
		if (sentByType === 'Staff' && !sentByStaffId) {
			setAddError('Please select which staff member authorized/sent the vehicle.');
			return;
		}

		setIsSubmitting(true);
		setAddError(null);
		try {
			const selectedStaff = staffList.find((s) => s.id === sentByStaffId);
			const req: CreateOutsideJobRequest = {
				vendorId: selectedVendorId,
				serviceName: serviceName.trim(),
				sentAt: new Date(sentAt).toISOString(),
				sentByType,
				sentByStaffId: sentByType === 'Staff' ? sentByStaffId : undefined,
				sentByStaffName: sentByType === 'Staff' ? selectedStaff?.name : undefined,
				notes: notes.trim() || undefined,
			};
			await createOutsideJob(jobCardId, req);
			setShowAddModal(false);
			// Reset form
			setServiceName('');
			setSelectedVendorId('');
			setSentByType('Owner');
			setSentByStaffId('');
			setNotes('');
			refetch();
			queryClient.invalidateQueries({ queryKey: ['jobCard', jobCardId] });
			queryClient.invalidateQueries({ queryKey: ['jobCards'] });
			queryClient.invalidateQueries({ queryKey: ['vehicleLocation'] });
			onUpdated?.();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to send vehicle outside.';
			setAddError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleConfirmReturn = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!showReturnModal) return;

		setIsSubmitting(true);
		setReturnError(null);
		try {
			const req: MarkOutsideJobReturnedRequest = {
				returnedAt: returnAt ? new Date(returnAt).toISOString() : new Date().toISOString(),
				vendorCost: finalCost ? parseFloat(finalCost) : undefined,
				returnNotes: returnNotes.trim() ? returnNotes.trim() : undefined,
			};
			await markOutsideJobReturned(showReturnModal.id, req);
			setShowReturnModal(null);
			setReturnNotes('');
			setFinalCost('');
			refetch();
			queryClient.invalidateQueries({ queryKey: ['jobCard', jobCardId] });
			queryClient.invalidateQueries({ queryKey: ['jobCards'] });
			onUpdated?.();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to mark vehicle returned.';
			setReturnError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleConfirmCancel = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!showCancelModal) return;
		if (!cancelReason.trim()) {
			setCancelError('Please specify a cancellation reason.');
			return;
		}

		setIsSubmitting(true);
		setCancelError(null);
		try {
			await cancelOutsideJob(showCancelModal.id, { reason: cancelReason.trim() });
			setShowCancelModal(null);
			setCancelReason('');
			refetch();
			queryClient.invalidateQueries({ queryKey: ['jobCard', jobCardId] });
			queryClient.invalidateQueries({ queryKey: ['jobCards'] });
			onUpdated?.();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to cancel outside job.';
			setCancelError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCreateNewVendor = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newVendorName.trim()) {
			setVendorCreateError('Vendor name is required.');
			return;
		}
		setIsSubmitting(true);
		setVendorCreateError(null);
		try {
			const created = await createVendor({
				name: newVendorName.trim(),
				phone: newVendorPhone.trim() || undefined,
				contactPerson: newVendorContact.trim() || undefined,
				address: newVendorAddress.trim() || undefined,
				serviceSpecialty: newVendorSpecialty.trim() || undefined,
			});
			await refetchVendors();
			setSelectedVendorId(created.id);
			setShowNewVendorModal(false);
			setNewVendorName('');
			setNewVendorPhone('');
			setNewVendorContact('');
			setNewVendorAddress('');
			setNewVendorSpecialty('');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to create vendor.';
			setVendorCreateError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const formatDateTime = (iso?: string | null) => {
		if (!iso) return '-';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return iso;
		return d.toLocaleString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
		});
	};

	const formatCurrency = (amt?: number | null) => {
		if (amt === undefined || amt === null) return '-';
		return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
	};

	return (
		<div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden" data-testid="outside-jobs-section">
			{/* Section Header */}
			<div className="px-6 py-4 border-b border-outline-variant flex flex-wrap justify-between items-center gap-3 bg-surface-container-low">
				<div className="flex items-center gap-3">
					<div className="p-2 rounded-lg bg-surface-variant text-on-surface-variant">
						<Truck className="w-5 h-5" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h2 className="text-lg font-semibold text-headline-sm text-on-surface">Outside Jobs & Vehicle Movement</h2>
							{/* Location Status Badge */}
							{isVehicleOutside ? (
								<span
									className="px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border bg-amber-500/10 text-amber-800 border-amber-500/30"
									data-testid="location-badge-outside"
								>
									<span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
									At Outside Shop
								</span>
							) : (
								<span
									className="px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border bg-emerald-500/10 text-emerald-800 border-emerald-500/30"
									data-testid="location-badge-showroom"
								>
									<span className="w-2 h-2 rounded-full bg-emerald-500" />
									At Showroom
								</span>
							)}
						</div>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Track external vendor jobs (denting, painting, lathe, alignment) and vehicle transfer lifecycle
						</p>
					</div>
				</div>

				<div>
					{!isVehicleOutside ? (
						<button
							type="button"
							disabled={isLocked}
							onClick={() => {
								if (isLocked) return;
								setShowAddModal(true);
								setAddError(null);
							}}
							className={`text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
								isLocked
									? 'bg-surface-variant text-on-surface-variant/50 border border-outline-variant cursor-not-allowed opacity-60'
									: 'bg-secondary text-white hover:opacity-90 shadow-sm cursor-pointer'
							}`}
							title={isLocked ? 'Job Card is locked because an invoice has been generated.' : undefined}
							data-testid="btn-add-outside-job"
						>
							{isLocked ? <Lock className="w-4 h-4 text-on-surface-variant/50" /> : <Plus className="w-4 h-4" />}
							Send Vehicle Outside
						</button>
					) : (
						<div className="text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
							<Clock className="w-3.5 h-3.5" />
							Vehicle currently outside shop
						</div>
					)}
				</div>
			</div>

			<div className="p-6 space-y-6">
				{isLoading ? (
					<div className="py-8 text-center text-on-surface-variant">
						<span className="material-symbols-outlined text-3xl animate-spin block mb-2 text-outline-variant">progress_activity</span>
						<p className="text-xs font-medium">Loading outside jobs…</p>
					</div>
				) : (
					<>
						{/* ── ACTIVE OUTSIDE JOB CARD ─────────────────────────────────── */}
				{activeJob ? (
					<div
						className={`rounded-xl border p-5 ${
							activeJob.isOverdue
								? 'bg-red-500/5 border-red-500/40 shadow-sm'
								: 'bg-amber-500/5 border-amber-500/30 shadow-sm'
						}`}
						data-testid="active-outside-job-card"
					>
						<div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-outline-variant/50">
							<div>
								<div className="flex items-center gap-2">
									<h3 className="text-base font-bold text-on-surface flex items-center gap-2">
										<Truck className="w-4 h-4 text-amber-600" />
										{activeJob.serviceName}
									</h3>
									<span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
										🟠 At Outside Shop
									</span>
									{activeJob.isOverdue && (
										<span
											className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white flex items-center gap-1 animate-pulse"
											data-testid="badge-overdue"
										>
											<AlertTriangle className="w-3 h-3" />
											OVERDUE
										</span>
									)}
								</div>
								<div className="text-sm font-semibold text-on-surface mt-1 flex items-center gap-2">
									<span>Vendor: {activeJob.vendorName}</span>
									{activeJob.vendorPhone && (
										<span className="text-xs font-normal text-on-surface-variant flex items-center gap-1">
											<Phone className="w-3 h-3" />
											{activeJob.vendorPhone}
										</span>
									)}
								</div>
							</div>

							<div className="flex items-center gap-2">
								<button
									onClick={() => {
										setShowReturnModal(activeJob);
										setFinalCost(activeJob.vendorCost ? String(activeJob.vendorCost) : '');
										setReturnError(null);
									}}
									className="bg-emerald-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm transition-all"
									data-testid="btn-mark-returned"
								>
									<CheckCircle2 className="w-4 h-4" />
									Mark Vehicle Returned
								</button>
								<button
									onClick={() => {
										setShowCancelModal(activeJob);
										setCancelError(null);
									}}
									className="border border-outline-variant text-on-surface-variant hover:text-error hover:border-error/40 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
									data-testid="btn-cancel-outside-job"
								>
									Cancel Job
								</button>
							</div>
						</div>

						{/* Active Job Meta Grid */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
							<div>
								<span className="text-on-surface-variant block mb-0.5 font-medium">Sent At</span>
								<span className="font-semibold text-on-surface">{formatDateTime(activeJob.sentAt)}</span>
							</div>
							<div>
								<span className="text-on-surface-variant block mb-0.5 font-medium">Expected Return</span>
								<span
									className={`font-semibold ${
										activeJob.isOverdue ? 'text-red-700 font-bold' : 'text-on-surface'
									}`}
								>
									{formatDateTime(activeJob.expectedReturnAt)}
								</span>
							</div>
							<div>
								<span className="text-on-surface-variant block mb-0.5 font-medium">Est. Vendor Cost</span>
								<span className="font-semibold text-on-surface">
									{activeJob.vendorCost ? formatCurrency(activeJob.vendorCost) : 'Not specified'}
								</span>
								<span className="text-[10px] text-on-surface-variant block">(internal cost)</span>
							</div>
							<div>
								<span className="text-on-surface-variant block mb-0.5 font-medium">Sent By</span>
								<span className="font-semibold text-on-surface">{activeJob.sentByUserName || 'Staff'}</span>
							</div>
						</div>

						{activeJob.notes && (
							<div className="mt-3 pt-3 border-t border-outline-variant/30 text-xs">
								<span className="text-on-surface-variant font-medium">Notes: </span>
								<span className="text-on-surface">{activeJob.notes}</span>
							</div>
						)}
					</div>
				) : null}

				{/* ── OUTSIDE JOBS HISTORY TABLE ──────────────────────────────── */}
				<div>
					<h3 className="text-sm font-semibold text-on-surface uppercase tracking-wider mb-3">
						Movement History ({historicalJobs.length})
					</h3>

					{historicalJobs.length === 0 && !activeJob ? (
						<div className="text-center py-8 border border-dashed border-outline-variant rounded-xl bg-surface-container-lowest text-on-surface-variant text-sm">
							<Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
							<p className="font-medium">No external jobs recorded for this vehicle.</p>
							<p className="text-xs text-on-surface-variant mt-1">
								Click "Send Vehicle Outside" if the vehicle needs outside denting, painting, lathe, or alignment work.
							</p>
						</div>
					) : historicalJobs.length === 0 ? (
						<div className="text-xs text-on-surface-variant italic py-2">
							No previous historical movements completed yet.
						</div>
					) : (
						<div className="overflow-x-auto rounded-xl border border-outline-variant">
							<table className="w-full text-left text-xs" data-testid="outside-jobs-history-table">
								<thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase tracking-wider font-semibold">
									<tr>
										<th className="px-4 py-2.5">Service</th>
										<th className="px-4 py-2.5">Vendor</th>
										<th className="px-4 py-2.5">Sent</th>
										<th className="px-4 py-2.5">Returned</th>
										<th className="px-4 py-2.5">Vendor Cost</th>
										<th className="px-4 py-2.5 text-center">Status</th>
										<th className="px-4 py-2.5">Notes</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-outline-variant">
									{historicalJobs.map((j) => (
										<tr key={j.id} className="hover:bg-surface-container-lowest">
											<td className="px-4 py-3 font-medium text-on-surface">
												{j.serviceName}
											</td>
											<td className="px-4 py-3 text-on-surface">
												{j.vendorName}
												{j.vendorPhone && (
													<span className="block text-[11px] text-on-surface-variant">{j.vendorPhone}</span>
												)}
											</td>
											<td className="px-4 py-3 text-on-surface-variant">{formatDateTime(j.sentAt)}</td>
											<td className="px-4 py-3 text-on-surface-variant">
												{j.status === 2 ? formatDateTime(j.returnedAt) : '-'}
											</td>
											<td className="px-4 py-3 font-medium text-on-surface">
												{j.vendorCost ? formatCurrency(j.vendorCost) : '-'}
											</td>
											<td className="px-4 py-3 text-center">
												{j.status === 2 ? (
													<span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
														<CheckCircle2 className="w-3 h-3 text-emerald-600" />
														Returned
													</span>
												) : j.status === 3 ? (
													<span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-300 inline-flex items-center gap-1">
														<XCircle className="w-3 h-3 text-gray-500" />
														Cancelled
													</span>
												) : (
													<span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
														{j.statusName}
													</span>
												)}
											</td>
											<td className="px-4 py-3 text-on-surface-variant max-w-xs truncate">
												{j.returnNotes || j.notes || j.cancellationReason || '-'}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
					</>
				)}
			</div>

			{/* ── MODAL: SEND VEHICLE OUTSIDE ─────────────────────────────────── */}
			{showAddModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" data-testid="modal-send-outside">
					<div className="bg-surface rounded-2xl max-w-lg w-full border border-outline-variant shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
						<div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
							<div>
								<h3 className="text-base font-bold text-on-surface flex items-center gap-2">
									<Truck className="w-5 h-5 text-secondary" />
									Send Vehicle Outside
								</h3>
								<p className="text-xs text-on-surface-variant mt-0.5">
									{vehicleRegistration} • {vehicleModel}
								</p>
							</div>
							<button
								onClick={() => setShowAddModal(false)}
								className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<form onSubmit={handleSendOutside} className="p-6 space-y-4 overflow-y-auto">
							{addError && (
								<div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-800 flex items-start gap-2">
									<AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
									<span>{addError}</span>
								</div>
							)}

							{/* A. Outside Service */}
							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Outside Service <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									required
									value={serviceName}
									onChange={(e) => setServiceName(e.target.value)}
									placeholder="e.g. Denting & Painting, Wheel Alignment"
									className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
									data-testid="input-service-name"
								/>
							</div>

							{/* B. Outside Shop / Vendor */}
							<div>
								<div className="flex justify-between items-center mb-1">
									<label className="block text-xs font-semibold text-on-surface">
										Outside Shop / Vendor <span className="text-red-500">*</span>
									</label>
									<button
										type="button"
										onClick={() => setShowNewVendorModal(true)}
										className="text-xs text-secondary hover:underline flex items-center gap-1 font-semibold"
									>
										<Plus className="w-3 h-3" />
										New Vendor
									</button>
								</div>
								<select
									required
									value={selectedVendorId}
									onChange={(e) => setSelectedVendorId(e.target.value)}
									className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary bg-surface text-on-surface"
									data-testid="select-vendor"
								>
									<option value="">-- Select Vendor / Workshop --</option>
									{vendors.map((v) => (
										<option key={v.id} value={v.id}>
											{v.name} {v.serviceSpecialty ? `(${v.serviceSpecialty})` : ''}
										</option>
									))}
								</select>
							</div>

							{/* C. Sent Date & Time */}
							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Sent Date & Time <span className="text-red-500">*</span>
								</label>
								<input
									type="datetime-local"
									required
									value={sentAt}
									onChange={(e) => setSentAt(e.target.value)}
									className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
									data-testid="input-sent-at"
								/>
							</div>

							{/* D. Sent By */}
							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Sent By <span className="text-red-500">*</span>
								</label>
								<div className="grid grid-cols-2 gap-2 mb-2">
									<button
										type="button"
										onClick={() => {
											setSentByType('Owner');
											setSentByStaffId('');
										}}
										className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
											sentByType === 'Owner'
												? 'bg-secondary/10 border-secondary text-secondary font-bold'
												: 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
										}`}
										data-testid="btn-sentby-owner"
									>
										Owner
									</button>
									<button
										type="button"
										onClick={() => setSentByType('Staff')}
										className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
											sentByType === 'Staff'
												? 'bg-secondary/10 border-secondary text-secondary font-bold'
												: 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
										}`}
										data-testid="btn-sentby-staff"
									>
										Staff
									</button>
								</div>

								{sentByType === 'Staff' && (
									<div className="mt-2">
										<label className="block text-[11px] font-medium text-on-surface-variant mb-1">
											Select Staff Member <span className="text-red-500">*</span>
										</label>
										<select
											required={sentByType === 'Staff'}
											value={sentByStaffId}
											onChange={(e) => setSentByStaffId(e.target.value)}
											className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary bg-surface text-on-surface"
											data-testid="select-sent-by-staff"
										>
											<option value="">-- Select Staff Member --</option>
											{staffList
												.filter((s) => s.isActive !== false)
												.map((s) => (
													<option key={s.id} value={s.id}>
														{s.name} {s.role ? `(${s.role})` : ''}
													</option>
												))}
										</select>
									</div>
								)}
							</div>

							{/* E. Notes */}
							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">Notes</label>
								<textarea
									rows={3}
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="e.g. Specific work requested, customer instructions, etc."
									className="w-full border border-outline-variant rounded-lg p-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
									data-testid="input-notes"
								/>
							</div>

							<div className="pt-2 flex justify-end gap-2 border-t border-outline-variant">
								<button
									type="button"
									onClick={() => setShowAddModal(false)}
									className="px-4 py-2 border border-outline-variant rounded-lg text-sm text-on-surface hover:bg-surface-variant transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isSubmitting}
									className="bg-secondary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
									data-testid="btn-submit-send-outside"
								>
									{isSubmitting ? 'Sending…' : 'Send Outside'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ── MODAL: MARK VEHICLE RETURNED ───────────────────────────────── */}
			{showReturnModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" data-testid="modal-mark-returned">
					<div className="bg-surface rounded-2xl max-w-md w-full border border-outline-variant shadow-2xl overflow-hidden">
						<div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
							<div>
								<h3 className="text-base font-bold text-on-surface flex items-center gap-2">
									<CheckCircle2 className="w-5 h-5 text-emerald-600" />
									Mark Vehicle Returned
								</h3>
								<p className="text-xs text-on-surface-variant mt-0.5">
									{showReturnModal.serviceName} • {showReturnModal.vendorName}
								</p>
							</div>
							<button
								onClick={() => setShowReturnModal(null)}
								className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<form onSubmit={handleConfirmReturn} className="p-6 space-y-4">
							{returnError && (
								<div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-800">
									{returnError}
								</div>
							)}

							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Returned Date & Time <span className="text-red-500">*</span>
								</label>
								<input
									type="datetime-local"
									required
									value={returnAt}
									onChange={(e) => setReturnAt(e.target.value)}
									className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
									data-testid="input-return-at"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Final Vendor Cost (₹)
								</label>
								<input
									type="number"
									min="0"
									step="0.01"
									value={finalCost}
									onChange={(e) => setFinalCost(e.target.value)}
									placeholder="Final bill amount from outside shop"
									className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
									data-testid="input-final-cost"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Inspection / Return Notes
								</label>
								<textarea
									rows={2}
									value={returnNotes}
									onChange={(e) => setReturnNotes(e.target.value)}
									placeholder="e.g. Work inspected, dent cleared, quality ok."
									className="w-full border border-outline-variant rounded-lg p-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
									data-testid="input-return-notes"
								/>
							</div>

							<div className="pt-2 flex justify-end gap-2 border-t border-outline-variant">
								<button
									type="button"
									onClick={() => setShowReturnModal(null)}
									className="px-4 py-2 border border-outline-variant rounded-lg text-sm text-on-surface hover:bg-surface-variant transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isSubmitting}
									className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
									data-testid="btn-confirm-return"
								>
									{isSubmitting ? 'Recording…' : 'Confirm Vehicle Returned'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ── MODAL: CANCEL OUTSIDE JOB ───────────────────────────────────── */}
			{showCancelModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" data-testid="modal-cancel-outside">
					<div className="bg-surface rounded-2xl max-w-md w-full border border-outline-variant shadow-2xl overflow-hidden">
						<div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
							<div>
								<h3 className="text-base font-bold text-error flex items-center gap-2">
									<AlertTriangle className="w-5 h-5 text-error" />
									Cancel Outside Job
								</h3>
								<p className="text-xs text-on-surface-variant mt-0.5">
									{showCancelModal.serviceName} • {showCancelModal.vendorName}
								</p>
							</div>
							<button
								onClick={() => setShowCancelModal(null)}
								className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<form onSubmit={handleConfirmCancel} className="p-6 space-y-4">
							{cancelError && (
								<div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-800">
									{cancelError}
								</div>
							)}

							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Cancellation Reason <span className="text-red-500">*</span>
								</label>
								<textarea
									required
									rows={3}
									value={cancelReason}
									onChange={(e) => setCancelReason(e.target.value)}
									placeholder="Reason for cancelling this outside job record…"
									className="w-full border border-outline-variant rounded-lg p-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
								/>
							</div>

							<div className="pt-2 flex justify-end gap-2 border-t border-outline-variant">
								<button
									type="button"
									onClick={() => setShowCancelModal(null)}
									className="px-4 py-2 border border-outline-variant rounded-lg text-sm text-on-surface hover:bg-surface-variant transition-colors"
								>
									Dismiss
								</button>
								<button
									type="submit"
									disabled={isSubmitting}
									className="bg-error text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
								>
									{isSubmitting ? 'Cancelling…' : 'Confirm Cancel'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ── MODAL: QUICK ADD VENDOR ────────────────────────────────────── */}
			{showNewVendorModal && (
				<div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" data-testid="modal-quick-add-vendor">
					<div className="bg-surface rounded-2xl max-w-md w-full border border-outline-variant shadow-2xl overflow-hidden">
						<div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
							<h3 className="text-base font-bold text-on-surface flex items-center gap-2">
								<Plus className="w-4 h-4 text-secondary" />
								Add New Outside Vendor
							</h3>
							<button
								onClick={() => setShowNewVendorModal(false)}
								className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<form onSubmit={handleCreateNewVendor} className="p-6 space-y-3 text-xs">
							{vendorCreateError && (
								<div className="p-2.5 rounded bg-red-50 text-red-700 border border-red-200">
									{vendorCreateError}
								</div>
							)}

							<div>
								<label className="block font-semibold text-on-surface mb-1">
									Vendor / Shop Name <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									required
									value={newVendorName}
									onChange={(e) => setNewVendorName(e.target.value)}
									placeholder="e.g. Sri Lakshmi Auto Works"
									className="w-full border border-outline-variant rounded px-2.5 py-1.5 text-sm"
								/>
							</div>

							<div>
								<label className="block font-semibold text-on-surface mb-1">Contact Person</label>
								<input
									type="text"
									value={newVendorContact}
									onChange={(e) => setNewVendorContact(e.target.value)}
									placeholder="e.g. Ramesh"
									className="w-full border border-outline-variant rounded px-2.5 py-1.5 text-sm"
								/>
							</div>

							<div className="grid grid-cols-2 gap-2">
								<div>
									<label className="block font-semibold text-on-surface mb-1">Phone</label>
									<input
										type="text"
										value={newVendorPhone}
										onChange={(e) => setNewVendorPhone(e.target.value)}
										placeholder="e.g. 9842712345"
										className="w-full border border-outline-variant rounded px-2.5 py-1.5 text-sm"
									/>
								</div>
								<div>
									<label className="block font-semibold text-on-surface mb-1">Specialty</label>
									<input
										type="text"
										value={newVendorSpecialty}
										onChange={(e) => setNewVendorSpecialty(e.target.value)}
										placeholder="e.g. Denting, Alignment"
										className="w-full border border-outline-variant rounded px-2.5 py-1.5 text-sm"
									/>
								</div>
							</div>

							<div>
								<label className="block font-semibold text-on-surface mb-1">Address</label>
								<input
									type="text"
									value={newVendorAddress}
									onChange={(e) => setNewVendorAddress(e.target.value)}
									placeholder="e.g. Perundurai Road, Erode"
									className="w-full border border-outline-variant rounded px-2.5 py-1.5 text-sm"
								/>
							</div>

							<div className="pt-3 flex justify-end gap-2 border-t border-outline-variant">
								<button
									type="button"
									onClick={() => setShowNewVendorModal(false)}
									className="px-3 py-1.5 border border-outline-variant rounded text-on-surface hover:bg-surface-variant"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isSubmitting}
									className="bg-secondary text-white px-4 py-1.5 rounded font-semibold hover:opacity-90 disabled:opacity-50"
								>
									{isSubmitting ? 'Saving…' : 'Save Vendor'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
});
