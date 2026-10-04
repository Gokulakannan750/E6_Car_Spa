import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	Car,
	Wrench,
	Plus,
	Edit2,
	AlertCircle,
	Check,
	X,
	Sliders,
	ShieldAlert,
	Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useAuth } from '../auth/auth-context';
import {
	getShowroomVehicleTypes,
	createShowroomVehicleType,
	updateShowroomVehicleType,
	toggleShowroomVehicleTypeActive,
	getShowroomWorkTypes,
	createShowroomWorkType,
	updateShowroomWorkType,
	toggleShowroomWorkTypeActive,
	type ShowroomVehicleTypeDto,
	type ShowroomWorkTypeDto,
} from '../../lib/api';
import { PoweredByTrovo } from '../../components/shared/PoweredByTrovo';

export default function ShowroomSettingsPage() {
	const queryClient = useQueryClient();
	const { isOwner } = useAuth();

	// ── Queries ────────────────────────────────────────────────────────────────
	const {
		data: vehicleTypes = [],
		isLoading: vehicleTypesLoading,
		error: vehicleTypesError,
	} = useQuery({
		queryKey: ['showroom-vehicle-types-all'],
		queryFn: () => getShowroomVehicleTypes(true),
	});

	const {
		data: workTypes = [],
		isLoading: workTypesLoading,
		error: workTypesError,
	} = useQuery({
		queryKey: ['showroom-work-types-all'],
		queryFn: () => getShowroomWorkTypes(true),
	});

	// ── Vehicle Types Modal States ─────────────────────────────────────────────
	const [showVehicleTypeModal, setShowVehicleTypeModal] = useState(false);
	const [editingVehicleType, setEditingVehicleType] = useState<ShowroomVehicleTypeDto | null>(null);
	const [vtName, setVtName] = useState('');
	const [vtDisplayOrder, setVtDisplayOrder] = useState<number>(0);
	const [vtIsActive, setVtIsActive] = useState<boolean>(true);
	const [vtError, setVtError] = useState('');

	// ── Work Types Modal States ────────────────────────────────────────────────
	const [showWorkTypeModal, setShowWorkTypeModal] = useState(false);
	const [editingWorkType, setEditingWorkType] = useState<ShowroomWorkTypeDto | null>(null);
	const [wtName, setWtName] = useState('');
	const [wtDescription, setWtDescription] = useState('');
	const [wtDisplayOrder, setWtDisplayOrder] = useState<number>(0);
	const [wtIsActive, setWtIsActive] = useState<boolean>(true);
	const [wtError, setWtError] = useState('');

	// ── Vehicle Types Mutations ────────────────────────────────────────────────
	const saveVehicleTypeMutation = useMutation({
		mutationFn: async () => {
			if (!vtName.trim()) {
				throw new Error('Vehicle Type name is required.');
			}
			if (editingVehicleType) {
				return updateShowroomVehicleType(editingVehicleType.id, {
					name: vtName.trim(),
					displayOrder: Number(vtDisplayOrder) || 0,
					isActive: vtIsActive,
				});
			} else {
				return createShowroomVehicleType({
					name: vtName.trim(),
					displayOrder: Number(vtDisplayOrder) || 0,
				});
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['showroom-vehicle-types-all'] });
			queryClient.invalidateQueries({ queryKey: ['showroom-vehicle-types'] });
			setShowVehicleTypeModal(false);
			resetVehicleTypeForm();
		},
		onError: (err: any) => {
			setVtError(err.message || 'Failed to save vehicle type.');
		},
	});

	const toggleVehicleTypeMutation = useMutation({
		mutationFn: async (id: string) => {
			return toggleShowroomVehicleTypeActive(id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['showroom-vehicle-types-all'] });
			queryClient.invalidateQueries({ queryKey: ['showroom-vehicle-types'] });
		},
	});

	// ── Work Types Mutations ───────────────────────────────────────────────────
	const saveWorkTypeMutation = useMutation({
		mutationFn: async () => {
			if (!wtName.trim()) {
				throw new Error('Showroom Work Type name is required.');
			}
			if (editingWorkType) {
				return updateShowroomWorkType(editingWorkType.id, {
					name: wtName.trim(),
					description: wtDescription.trim() || null,
					displayOrder: Number(wtDisplayOrder) || 0,
					isActive: wtIsActive,
				});
			} else {
				return createShowroomWorkType({
					name: wtName.trim(),
					description: wtDescription.trim() || null,
					displayOrder: Number(wtDisplayOrder) || 0,
				});
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['showroom-work-types-all'] });
			queryClient.invalidateQueries({ queryKey: ['showroom-work-types'] });
			setShowWorkTypeModal(false);
			resetWorkTypeForm();
		},
		onError: (err: any) => {
			setWtError(err.message || 'Failed to save showroom work type.');
		},
	});

	const toggleWorkTypeMutation = useMutation({
		mutationFn: async (id: string) => {
			return toggleShowroomWorkTypeActive(id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['showroom-work-types-all'] });
			queryClient.invalidateQueries({ queryKey: ['showroom-work-types'] });
		},
	});

	// ── Form Openers ───────────────────────────────────────────────────────────
	const resetVehicleTypeForm = () => {
		setEditingVehicleType(null);
		setVtName('');
		setVtDisplayOrder(vehicleTypes.length + 1);
		setVtIsActive(true);
		setVtError('');
	};

	const openAddVehicleType = () => {
		resetVehicleTypeForm();
		setShowVehicleTypeModal(true);
	};

	const openEditVehicleType = (vt: ShowroomVehicleTypeDto) => {
		setEditingVehicleType(vt);
		setVtName(vt.name);
		setVtDisplayOrder(vt.displayOrder);
		setVtIsActive(vt.isActive);
		setVtError('');
		setShowVehicleTypeModal(true);
	};

	const resetWorkTypeForm = () => {
		setEditingWorkType(null);
		setWtName('');
		setWtDescription('');
		setWtDisplayOrder(workTypes.length + 1);
		setWtIsActive(true);
		setWtError('');
	};

	const openAddWorkType = () => {
		resetWorkTypeForm();
		setShowWorkTypeModal(true);
	};

	const openEditWorkType = (wt: ShowroomWorkTypeDto) => {
		setEditingWorkType(wt);
		setWtName(wt.name);
		setWtDescription(wt.description || '');
		setWtDisplayOrder(wt.displayOrder);
		setWtIsActive(wt.isActive);
		setWtError('');
		setShowWorkTypeModal(true);
	};

	return (
		<div className="space-y-6 w-full pb-10">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
						<Sliders className="w-6 h-6 text-primary" />
						Showroom Configuration
					</h1>
					<p className="text-xs text-slate-500 mt-0.5">
						Configure showroom vehicle types and operational work labels. Only business owners can manage master lists.
					</p>
				</div>
			</div>

			{/* Non-Owner Notice Banner */}
			{!isOwner && (
				<div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-3">
					<ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
					<div>
						<span className="font-bold">Owner-Only Management:</span> You are viewing the configuration in read-only mode. Only business owners can add, edit, or toggle vehicle types and showroom work types.
					</div>
				</div>
			)}

			<div className="space-y-8 animate-in fade-in duration-150">
				{/* ── SECTION 1: VEHICLE TYPES ────────────────────────────────────────── */}
				<div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
					<div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
						<div className="flex items-center gap-3">
							<div className="p-2.5 rounded-xl bg-primary/10 text-primary">
								<Car className="w-5 h-5" />
							</div>
							<div>
								<h2 className="text-sm font-bold text-slate-800">Vehicle Types</h2>
								<p className="text-xs text-slate-500">
									Master list of vehicle categories used in showroom vehicle work operations.
								</p>
							</div>
						</div>

						{isOwner && (
							<Button
								variant="primary"
								size="sm"
								icon={<Plus className="w-4 h-4" />}
								onClick={openAddVehicleType}
							>
								Add Vehicle Type
							</Button>
						)}
					</div>

					<div className="overflow-x-auto">
						<table className="app-table w-full">
							<thead>
								<tr>
									<th className="w-16">Order</th>
									<th>Vehicle Type Name</th>
									<th className="w-28 text-center">Status</th>
									{isOwner && <th className="w-36 text-right">Actions</th>}
								</tr>
							</thead>
							<tbody>
								{vehicleTypesLoading && (
									<tr>
										<td colSpan={isOwner ? 4 : 3} className="py-12 text-center text-xs text-slate-500">
											<div className="flex items-center justify-center gap-2">
												<Loader2 className="w-4 h-4 animate-spin text-primary" />
												<span>Loading vehicle types...</span>
											</div>
										</td>
									</tr>
								)}

								{vehicleTypesError && (
									<tr>
										<td colSpan={isOwner ? 4 : 3} className="py-8 text-center text-xs text-error">
											Failed to load vehicle types.
										</td>
									</tr>
								)}

								{!vehicleTypesLoading && vehicleTypes.length === 0 && (
									<tr>
										<td colSpan={isOwner ? 4 : 3} className="py-10 text-center text-xs text-slate-500">
											No vehicle types found. Click &quot;Add Vehicle Type&quot; to create one.
										</td>
									</tr>
								)}

								{!vehicleTypesLoading &&
									vehicleTypes.map((vt) => (
										<tr key={vt.id} className="hover:bg-slate-50/60 transition-colors">
											<td className="font-mono text-xs text-slate-500 font-semibold">
												{vt.displayOrder}
											</td>
											<td>
												<span className="font-semibold text-xs text-slate-800">{vt.name}</span>
											</td>
											<td className="text-center">
												<StatusBadge status={vt.isActive ? 'active' : 'inactive'} />
											</td>
											{isOwner && (
												<td className="text-right">
													<div className="flex items-center justify-end gap-1.5">
														<Button
															variant="ghost"
															size="sm"
															icon={<Edit2 className="w-3.5 h-3.5" />}
															onClick={() => openEditVehicleType(vt)}
															title="Edit Vehicle Type"
														>
															Edit
														</Button>
														<Button
															variant={vt.isActive ? 'ghost' : 'outline'}
															size="sm"
															onClick={() => toggleVehicleTypeMutation.mutate(vt.id)}
															disabled={toggleVehicleTypeMutation.isPending}
															className={vt.isActive ? 'text-slate-600 hover:text-error hover:bg-error/10' : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'}
															title={vt.isActive ? 'Deactivate' : 'Activate'}
														>
															{vt.isActive ? 'Deactivate' : 'Activate'}
														</Button>
													</div>
												</td>
											)}
										</tr>
									))}
							</tbody>
						</table>
					</div>
				</div>

				{/* ── SECTION 2: SHOWROOM WORK TYPES ──────────────────────────────────── */}
				<div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
					<div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
						<div className="flex items-center gap-3">
							<div className="p-2.5 rounded-xl bg-secondary/10 text-secondary">
								<Wrench className="w-5 h-5" />
							</div>
							<div>
								<h2 className="text-sm font-bold text-slate-800">Showroom Work Types</h2>
								<p className="text-xs text-slate-500">
									Configurable labels for work performed on showroom vehicles (independent of Service Catalogue).
								</p>
							</div>
						</div>

						{isOwner && (
							<Button
								variant="primary"
								size="sm"
								icon={<Plus className="w-4 h-4" />}
								onClick={openAddWorkType}
							>
								Add Work Type
							</Button>
						)}
					</div>

					<div className="overflow-x-auto">
						<table className="app-table w-full">
							<thead>
								<tr>
									<th className="w-16">Order</th>
									<th>Work Type Name</th>
									<th>Description</th>
									<th className="w-28 text-center">Status</th>
									{isOwner && <th className="w-36 text-right">Actions</th>}
								</tr>
							</thead>
							<tbody>
								{workTypesLoading && (
									<tr>
										<td colSpan={isOwner ? 5 : 4} className="py-12 text-center text-xs text-slate-500">
											<div className="flex items-center justify-center gap-2">
												<Loader2 className="w-4 h-4 animate-spin text-primary" />
												<span>Loading showroom work types...</span>
											</div>
										</td>
									</tr>
								)}

								{workTypesError && (
									<tr>
										<td colSpan={isOwner ? 5 : 4} className="py-8 text-center text-xs text-error">
											Failed to load showroom work types.
										</td>
									</tr>
								)}

								{!workTypesLoading && workTypes.length === 0 && (
									<tr>
										<td colSpan={isOwner ? 5 : 4} className="py-10 text-center text-xs text-slate-500">
											No work types found. Click &quot;Add Work Type&quot; to create one.
										</td>
									</tr>
								)}

								{!workTypesLoading &&
									workTypes.map((wt) => (
										<tr key={wt.id} className="hover:bg-slate-50/60 transition-colors">
											<td className="font-mono text-xs text-slate-500 font-semibold">
												{wt.displayOrder}
											</td>
											<td>
												<span className="font-semibold text-xs text-slate-800">{wt.name}</span>
											</td>
											<td className="text-xs text-slate-500 max-w-sm truncate">
												{wt.description || '—'}
											</td>
											<td className="text-center">
												<StatusBadge status={wt.isActive ? 'active' : 'inactive'} />
											</td>
											{isOwner && (
												<td className="text-right">
													<div className="flex items-center justify-end gap-1.5">
														<Button
															variant="ghost"
															size="sm"
															icon={<Edit2 className="w-3.5 h-3.5" />}
															onClick={() => openEditWorkType(wt)}
															title="Edit Work Type"
														>
															Edit
														</Button>
														<Button
															variant={wt.isActive ? 'ghost' : 'outline'}
															size="sm"
															onClick={() => toggleWorkTypeMutation.mutate(wt.id)}
															disabled={toggleWorkTypeMutation.isPending}
															className={wt.isActive ? 'text-slate-600 hover:text-error hover:bg-error/10' : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'}
															title={wt.isActive ? 'Deactivate' : 'Activate'}
														>
															{wt.isActive ? 'Deactivate' : 'Activate'}
														</Button>
													</div>
												</td>
											)}
										</tr>
									))}
							</tbody>
						</table>
					</div>
				</div>

				<div className="text-center pt-2">
					<PoweredByTrovo />
				</div>
			</div>

			{/* ── MODAL 1: ADD / EDIT VEHICLE TYPE ───────────────────────────────────── */}
			{showVehicleTypeModal && (
				<Dialog
					open={showVehicleTypeModal}
					onOpenChange={setShowVehicleTypeModal}
					title={editingVehicleType ? 'Edit Vehicle Type' : 'Add Vehicle Type'}
					description="Configure vehicle category for showroom operations."
				>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							saveVehicleTypeMutation.mutate();
						}}
						className="space-y-4"
					>
						{vtError && (
							<div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
								<AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
								<span>{vtError}</span>
							</div>
						)}

						<div>
							<label htmlFor="vt-name-input" className="block text-xs font-semibold text-slate-800 mb-1">
								Vehicle Type Name <span className="text-red-500">*</span>
							</label>
							<input
								id="vt-name-input"
								type="text"
								value={vtName}
								onChange={(e) => setVtName(e.target.value)}
								placeholder="e.g. Hatchback, Sedan, SUV/MUV, Bike..."
								className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-primary"
								required
								autoFocus
							/>
						</div>

						<div>
							<label htmlFor="vt-order-input" className="block text-xs font-semibold text-slate-800 mb-1">
								Display Order
							</label>
							<input
								id="vt-order-input"
								type="number"
								min="0"
								value={vtDisplayOrder}
								onChange={(e) => setVtDisplayOrder(Number(e.target.value))}
								className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-primary"
							/>
						</div>

						{editingVehicleType && (
							<div className="flex items-center gap-2 pt-1">
								<input
									type="checkbox"
									id="vt-is-active"
									checked={vtIsActive}
									onChange={(e) => setVtIsActive(e.target.checked)}
									className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
								/>
								<label htmlFor="vt-is-active" className="text-xs font-medium text-slate-700 cursor-pointer">
									Active (available for new vehicle work records)
								</label>
							</div>
						)}

						<div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
							<Button
								variant="ghost"
								size="sm"
								type="button"
								onClick={() => setShowVehicleTypeModal(false)}
							>
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								type="submit"
								disabled={saveVehicleTypeMutation.isPending}
							>
								{saveVehicleTypeMutation.isPending
									? 'Saving...'
									: editingVehicleType
									? 'Update Vehicle Type'
									: 'Save Vehicle Type'}
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* ── MODAL 2: ADD / EDIT WORK TYPE ───────────────────────────────────────── */}
			{showWorkTypeModal && (
				<Dialog
					open={showWorkTypeModal}
					onOpenChange={setShowWorkTypeModal}
					title={editingWorkType ? 'Edit Showroom Work Type' : 'Add Showroom Work Type'}
					description="Configure work/service label performed on showroom vehicles."
				>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							saveWorkTypeMutation.mutate();
						}}
						className="space-y-4"
					>
						{wtError && (
							<div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
								<AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
								<span>{wtError}</span>
							</div>
						)}

						<div>
							<label htmlFor="wt-name-input" className="block text-xs font-semibold text-slate-800 mb-1">
								Work Type Name <span className="text-red-500">*</span>
							</label>
							<input
								id="wt-name-input"
								type="text"
								value={wtName}
								onChange={(e) => setWtName(e.target.value)}
								placeholder="e.g. Body Wash, Interior Cleaning, Polishing, Other..."
								className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-primary"
								required
								autoFocus
							/>
						</div>

						<div>
							<label htmlFor="wt-desc-input" className="block text-xs font-semibold text-slate-800 mb-1">
								Description (Optional)
							</label>
							<textarea
								id="wt-desc-input"
								rows={2}
								value={wtDescription}
								onChange={(e) => setWtDescription(e.target.value)}
								placeholder="Brief details about the work performed..."
								className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-primary"
							/>
						</div>

						<div>
							<label htmlFor="wt-order-input" className="block text-xs font-semibold text-slate-800 mb-1">
								Display Order
							</label>
							<input
								id="wt-order-input"
								type="number"
								min="0"
								value={wtDisplayOrder}
								onChange={(e) => setWtDisplayOrder(Number(e.target.value))}
								className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-primary"
							/>
						</div>

						{editingWorkType && (
							<div className="flex items-center gap-2 pt-1">
								<input
									type="checkbox"
									id="wt-is-active"
									checked={wtIsActive}
									onChange={(e) => setWtIsActive(e.target.checked)}
									className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
								/>
								<label htmlFor="wt-is-active" className="text-xs font-medium text-slate-700 cursor-pointer">
									Active (available for new vehicle work records)
								</label>
							</div>
						)}

						<div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
							<Button
								variant="ghost"
								size="sm"
								type="button"
								onClick={() => setShowWorkTypeModal(false)}
							>
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								type="submit"
								disabled={saveWorkTypeMutation.isPending}
							>
								{saveWorkTypeMutation.isPending
									? 'Saving...'
									: editingWorkType
									? 'Update Work Type'
									: 'Save Work Type'}
							</Button>
						</div>
					</form>
				</Dialog>
			)}
		</div>
	);
}
