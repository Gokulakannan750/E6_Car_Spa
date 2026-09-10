import React, { useState, useEffect, useCallback } from 'react';
import { User, Phone, Mail, MapPin, AlertCircle, CheckCircle2, Save, Car, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import {
	updateCustomer,
	getVehiclesByCustomer,
	updateVehicle,
	createVehicle,
	getVehicleByRegistration,
	transferVehicleOwnership,
	type CustomerDto,
	type VehicleDto,
	ApiError,
} from '../../lib/api';

interface EditCustomerModalProps {
	open: boolean;
	customer: CustomerDto | null;
	onClose: () => void;
	onSuccess: (updated: CustomerDto) => void;
}

interface EditableVehicle {
	id?: string; // present if existing vehicle
	tempId?: string; // present if newly added in this session
	registrationNumber: string;
	make: string;
	model: string;
	variant: string;
	isOriginal?: boolean;
}

export interface VehicleConflictInfo {
	vehicleId: string;
	registrationNumber: string;
	make: string;
	model: string;
	variant?: string | null;
	currentCustomerId: string;
	currentCustomerName: string;
}

export function EditCustomerModal({ open, customer, onClose, onSuccess }: EditCustomerModalProps) {
	const [name, setName] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [email, setEmail] = useState('');
	const [address, setAddress] = useState('');

	// Vehicles state
	const [vehicles, setVehicles] = useState<EditableVehicle[]>([]);
	const [originalVehicles, setOriginalVehicles] = useState<VehicleDto[]>([]);
	const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);

	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [successFeedback, setSuccessFeedback] = useState('');

	// Ownership transfer conflict state
	const [vehicleConflict, setVehicleConflict] = useState<VehicleConflictInfo | null>(null);
	const [showTransferConfirm, setShowTransferConfirm] = useState(false);
	const [isTransferring, setIsTransferring] = useState(false);
	const [transferError, setTransferError] = useState('');

	const loadVehicles = useCallback(async (customerId: string) => {
		setIsLoadingVehicles(true);
		try {
			const list = await getVehiclesByCustomer(customerId);
			setOriginalVehicles(list || []);
			setVehicles(
				(list || []).map((v) => ({
					id: v.id,
					registrationNumber: v.registrationNumber,
					make: v.make,
					model: v.model,
					variant: v.variant || '',
					isOriginal: true,
				})),
			);
		} catch (err) {
			console.warn('Failed to load customer vehicles:', err);
		} finally {
			setIsLoadingVehicles(false);
		}
	}, []);

	useEffect(() => {
		if (customer && open) {
			setName(customer.name || '');
			setPhoneNumber(customer.phoneNumber || '');
			setEmail(customer.email || '');
			setAddress(customer.address || '');
			setError('');
			setSuccessFeedback('');
			setTransferError('');
			setVehicleConflict(null);
			setShowTransferConfirm(false);
			loadVehicles(customer.id);
		} else {
			setVehicles([]);
			setOriginalVehicles([]);
			setTransferError('');
			setVehicleConflict(null);
			setShowTransferConfirm(false);
		}
	}, [customer, open, loadVehicles]);

	const handleClose = () => {
		setError('');
		setSuccessFeedback('');
		setTransferError('');
		setVehicleConflict(null);
		setShowTransferConfirm(false);
		onClose();
	};

	const handleAddVehicle = () => {
		setVehicles((prev) => [
			...prev,
			{
				tempId: `temp_${Date.now()}`,
				registrationNumber: '',
				make: '',
				model: '',
				variant: '',
				isOriginal: false,
			},
		]);
	};

	const handleRemoveNewVehicle = (index: number) => {
		setVehicles((prev) => prev.filter((_, i) => i !== index));
	};

	const handleVehicleChange = (index: number, field: keyof EditableVehicle, value: string) => {
		setVehicles((prev) => {
			const updated = [...prev];
			updated[index] = { ...updated[index], [field]: value };
			return updated;
		});
	};

	const handleConfirmTransfer = async () => {
		if (!vehicleConflict || !customer) return;
		setIsTransferring(true);
		setTransferError('');
		setError('');
		try {
			const transferred = await transferVehicleOwnership(vehicleConflict.vehicleId, customer.id);
			setVehicles((prev) => {
				const filtered = prev.filter(
					(v) => v.registrationNumber.trim().toUpperCase() !== transferred.registrationNumber,
				);
				return [
					...filtered,
					{
						id: transferred.id,
						registrationNumber: transferred.registrationNumber,
						make: transferred.make,
						model: transferred.model,
						variant: transferred.variant || '',
						isOriginal: true,
					},
				];
			});
			setOriginalVehicles((prev) => [...prev, transferred]);
			setVehicleConflict(null);
			setTransferError('');
			setError('');
			setShowTransferConfirm(false);
			setSuccessFeedback(`Vehicle ${transferred.registrationNumber} ownership transferred to ${customer.name}.`);
		} catch (err: unknown) {
			const msg =
				err instanceof ApiError
					? err.message || 'Failed to transfer vehicle ownership.'
					: err instanceof Error
						? err.message
						: 'An error occurred while transferring vehicle ownership.';
			setTransferError(msg);
			setShowTransferConfirm(false);
			// Note: vehicleConflict is intentionally preserved on failure so the user can retry
		} finally {
			setIsTransferring(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!customer) return;
		setError('');
		setSuccessFeedback('');
		setTransferError('');

		const trimmedName = name.trim();
		const trimmedPhone = phoneNumber.trim().replace(/\D/g, '').slice(0, 10);
		const trimmedEmail = email.trim();
		const trimmedAddress = address.trim();

		// Validation
		if (!trimmedName) {
			setError('Customer name is required.');
			return;
		}

		if (!trimmedPhone) {
			setError('Phone number is required.');
			return;
		}

		if (trimmedPhone.length !== 10) {
			setError('Phone number must be exactly 10 digits.');
			return;
		}

		// Vehicle validations
		for (let i = 0; i < vehicles.length; i++) {
			const v = vehicles[i];
			const reg = v.registrationNumber.trim();
			const mk = v.make.trim();
			const md = v.model.trim();

			// If any field in a newly added vehicle is filled, require all key fields
			if (!v.id && (reg || mk || md)) {
				if (!reg) {
					setError(`Vehicle #${i + 1}: Registration number is required.`);
					return;
				}
				if (!mk) {
					setError(`Vehicle #${i + 1}: Make is required.`);
					return;
				}
				if (!md) {
					setError(`Vehicle #${i + 1}: Model is required.`);
					return;
				}
			} else if (v.id) {
				if (!reg) {
					setError(`Vehicle #${i + 1}: Registration number is required.`);
					return;
				}
				if (!mk) {
					setError(`Vehicle #${i + 1}: Make is required.`);
					return;
				}
				if (!md) {
					setError(`Vehicle #${i + 1}: Model is required.`);
					return;
				}
			}
		}

		setIsSubmitting(true);

		try {
			// 1. Update customer profile
			const updated = await updateCustomer({
				id: customer.id,
				name: trimmedName,
				phoneNumber: trimmedPhone,
				email: trimmedEmail || null,
				address: trimmedAddress || null,
			});

			// 2. Process vehicle updates and creations
			for (const v of vehicles) {
				const reg = v.registrationNumber.trim().toUpperCase();
				const mk = v.make.trim();
				const md = v.model.trim();
				const vr = v.variant.trim() || null;

				if (v.id) {
					// Check if existing vehicle changed
					const original = originalVehicles.find((ov) => ov.id === v.id);
					const hasChanged =
						!original ||
						original.registrationNumber !== reg ||
						original.make !== mk ||
						original.model !== md ||
						(original.variant || '') !== (vr || '');

					if (hasChanged) {
						try {
							await updateVehicle(v.id, {
								registrationNumber: reg,
								make: mk,
								model: md,
								variant: vr,
							});
						} catch (vehErr: unknown) {
							if (vehErr instanceof ApiError && vehErr.status === 409) {
								const body = (vehErr.body && typeof vehErr.body === 'object' ? vehErr.body : {}) as Record<string, any>;
								let existingCustId = body.existingCustomerId || body.customerId;
								let existingCustName = body.existingCustomerName || body.customerName;
								let existingVehId = body.existingVehicleId || body.vehicleId;
								let existingMake = body.make || mk;
								let existingModel = body.model || md;
								let existingVariant = body.variant ?? vr;

								if (!existingCustId || !existingVehId) {
									try {
										const existing = await getVehicleByRegistration(reg);
										if (existing) {
											existingCustId = existing.customerId;
											existingCustName = existing.customerName;
											existingVehId = existing.id;
											existingMake = existing.make;
											existingModel = existing.model;
											existingVariant = existing.variant;
										}
									} catch {
										// Fallback lookup failed
									}
								}

								if (existingCustId && existingVehId && existingCustId !== customer.id) {
									setError('');
									setTransferError('');
									setVehicleConflict({
										vehicleId: existingVehId,
										registrationNumber: reg,
										make: existingMake,
										model: existingModel,
										variant: existingVariant,
										currentCustomerId: existingCustId,
										currentCustomerName: existingCustName || 'Another Customer',
									});
									return; // Stop processing further vehicles to let user resolve conflict
								} else if (existingCustId && existingCustId === customer.id) {
									setVehicleConflict(null);
									setTransferError('');
									setError(`A vehicle with registration number '${reg}' is already registered to this customer.`);
									return;
								} else {
									setVehicleConflict(null);
									setTransferError('');
									setError(vehErr.message || `A vehicle with registration number '${reg}' already exists.`);
									return;
								}
							}
							throw vehErr;
						}
					}
				} else if (reg && mk && md) {
					// Create new vehicle
					try {
						await createVehicle({
							customerId: customer.id,
							registrationNumber: reg,
							make: mk,
							model: md,
							variant: vr,
						});
					} catch (vehErr: unknown) {
						if (vehErr instanceof ApiError && vehErr.status === 409) {
							const body = (vehErr.body && typeof vehErr.body === 'object' ? vehErr.body : {}) as Record<string, any>;
							let existingCustId = body.existingCustomerId || body.customerId;
							let existingCustName = body.existingCustomerName || body.customerName;
							let existingVehId = body.existingVehicleId || body.vehicleId;
							let existingMake = body.make || mk;
							let existingModel = body.model || md;
							let existingVariant = body.variant ?? vr;

							if (!existingCustId || !existingVehId) {
								try {
									const existing = await getVehicleByRegistration(reg);
									if (existing) {
										existingCustId = existing.customerId;
										existingCustName = existing.customerName;
										existingVehId = existing.id;
										existingMake = existing.make;
										existingModel = existing.model;
										existingVariant = existing.variant;
									}
								} catch {
									// Fallback lookup failed
								}
							}

							if (existingCustId && existingVehId && existingCustId !== customer.id) {
								setError('');
								setTransferError('');
								setVehicleConflict({
									vehicleId: existingVehId,
									registrationNumber: reg,
									make: existingMake,
									model: existingModel,
									variant: existingVariant,
									currentCustomerId: existingCustId,
									currentCustomerName: existingCustName || 'Another Customer',
								});
								return; // Stop processing further vehicles to let user resolve conflict
							} else if (existingCustId && existingCustId === customer.id) {
								setVehicleConflict(null);
								setTransferError('');
								setError(`A vehicle with registration number '${reg}' is already registered to this customer.`);
								return;
							} else {
								setVehicleConflict(null);
								setTransferError('');
								setError(vehErr.message || `A vehicle with registration number '${reg}' already exists.`);
								return;
							}
						}
						throw vehErr;
					}
				}
			}

			onSuccess(updated);
		} catch (err: unknown) {
			if (err instanceof ApiError) {
				setError(err.message || 'Failed to update customer details.');
			} else if (err instanceof Error) {
				setError(err.message);
			} else {
				setError('An unexpected error occurred while updating details.');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
		<Dialog
			open={open && !!customer}
			onOpenChange={(isOpen) => {
				if (!isOpen) handleClose();
			}}
			title="Edit Customer & Vehicle Details"
			description="Update customer contact profile and vehicle registrations"
			size="lg"
			footer={
				<>
					<Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={handleSubmit}
						loading={isSubmitting}
						icon={<Save className="w-4 h-4" />}
					>
						Save Changes
					</Button>
				</>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
				{error && !vehicleConflict && (
					<div className="flex items-start gap-2.5 p-3 rounded-lg bg-error-container/40 border border-error/30 text-error animate-fade-in text-sm">
						<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
						<span>{error}</span>
					</div>
				)}

				{successFeedback && (
					<div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 animate-fade-in text-sm">
						<CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
						<span>{successFeedback}</span>
					</div>
				)}

				{vehicleConflict && (
					<div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-on-surface space-y-3 animate-fade-in">
						<div className="flex items-start gap-3">
							<AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
							<div className="space-y-1 text-sm">
								<p className="font-semibold text-amber-600 dark:text-amber-400">
									Vehicle Already Registered
								</p>
								<p className="text-xs text-on-surface-variant">
									Vehicle <span className="font-mono font-bold text-on-surface">{vehicleConflict.registrationNumber}</span> is already registered to <span className="font-semibold text-on-surface">{vehicleConflict.currentCustomerName}</span>.
								</p>
								<p className="text-xs text-on-surface-variant">
									This will transfer this vehicle to the new customer. Existing service history, invoices and payments will remain unchanged.
								</p>
								{transferError && (
									<div className="flex items-start gap-2 p-2.5 mt-2 rounded bg-error-container/40 border border-error/30 text-error text-xs">
										<AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
										<span>Transfer failed: {transferError}</span>
									</div>
								)}
							</div>
						</div>
						<div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => {
									setVehicleConflict(null);
									setTransferError('');
									setError('');
								}}
							>
								Dismiss
							</Button>
							<Button
								type="button"
								variant="primary"
								size="sm"
								onClick={() => setShowTransferConfirm(true)}
							>
								Transfer Vehicle
							</Button>
						</div>
					</div>
				)}

				{/* ── Section 1: Customer Contact Information ────────────────── */}
				<div className="space-y-3.5">
					<h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider text-secondary">
						Customer Information
					</h3>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
						<div>
							<label className="block text-xs font-medium text-on-surface mb-1">
								Full Name <span className="text-error">*</span>
							</label>
							<div className="relative">
								<input
									type="text"
									required
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g. John Doe"
									className="form-input w-full pl-9"
									autoFocus
								/>
								<User className="w-4 h-4 text-on-surface-variant/60 absolute left-3 top-1/2 -translate-y-1/2" />
							</div>
						</div>

						<div>
							<label className="block text-xs font-medium text-on-surface mb-1">
								Phone Number <span className="text-error">*</span>
							</label>
							<div className="relative">
								<input
									type="tel"
									inputMode="numeric"
									maxLength={10}
									required
									value={phoneNumber}
									onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
									placeholder="e.g. 9876543210"
									className="form-input w-full pl-9 font-mono"
								/>
								<Phone className="w-4 h-4 text-on-surface-variant/60 absolute left-3 top-1/2 -translate-y-1/2" />
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
						<div>
							<label className="block text-xs font-medium text-on-surface mb-1">
								Email Address <span className="text-on-surface-variant font-normal">(Optional)</span>
							</label>
							<div className="relative">
								<input
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="e.g. customer@example.com"
									className="form-input w-full pl-9"
								/>
								<Mail className="w-4 h-4 text-on-surface-variant/60 absolute left-3 top-1/2 -translate-y-1/2" />
							</div>
						</div>

						<div>
							<label className="block text-xs font-medium text-on-surface mb-1">
								Address / City <span className="text-on-surface-variant font-normal">(Optional)</span>
							</label>
							<div className="relative">
								<input
									type="text"
									value={address}
									onChange={(e) => setAddress(e.target.value)}
									placeholder="e.g. 45 Greenways Rd, Chennai"
									className="form-input w-full pl-9"
								/>
								<MapPin className="w-4 h-4 text-on-surface-variant/60 absolute left-3 top-1/2 -translate-y-1/2" />
							</div>
						</div>
					</div>
				</div>

				{/* ── Section 2: Customer Vehicles ───────────────────────────── */}
				<div className="pt-2 border-t border-outline-variant/60 space-y-3.5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Car className="w-4 h-4 text-secondary" />
							<h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider text-secondary">
								Registered Vehicles ({vehicles.length})
							</h3>
						</div>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							icon={<Plus className="w-3.5 h-3.5" />}
							onClick={handleAddVehicle}
						>
							Add Vehicle
						</Button>
					</div>

					{isLoadingVehicles ? (
						<div className="py-6 text-center text-on-surface-variant">
							<RefreshCw className="w-4 h-4 animate-spin mx-auto text-secondary mb-1" />
							<p className="text-xs">Loading vehicles...</p>
						</div>
					) : vehicles.length === 0 ? (
						<div className="p-4 rounded-lg bg-surface-container-low border border-dashed border-outline-variant text-center space-y-2">
							<Car className="w-6 h-6 text-on-surface-variant/50 mx-auto" />
							<p className="text-xs text-on-surface-variant">No vehicles registered for this customer yet.</p>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								icon={<Plus className="w-3.5 h-3.5" />}
								onClick={handleAddVehicle}
							>
								Add First Vehicle
							</Button>
						</div>
					) : (
						<div className="space-y-3">
							{vehicles.map((veh, idx) => (
								<div
									key={veh.id || veh.tempId || idx}
									className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant space-y-3"
								>
									<div className="flex items-center justify-between pb-1 border-b border-outline-variant/40">
										<span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
											<Car className="w-3.5 h-3.5 text-secondary" />
											Vehicle #{idx + 1}
											{veh.id && (
												<span className="text-[10px] bg-secondary/10 text-secondary font-mono px-1.5 py-0.2 rounded">
													Existing
												</span>
											)}
											{!veh.id && (
												<span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-medium">
													New
												</span>
											)}
										</span>
										{!veh.id && (
											<button
												type="button"
												onClick={() => handleRemoveNewVehicle(idx)}
												className="text-xs text-error hover:text-error/80 flex items-center gap-1"
												title="Remove vehicle entry"
											>
												<Trash2 className="w-3.5 h-3.5" />
												Remove
											</button>
										)}
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div>
											<label className="block text-xs font-medium text-on-surface mb-1">
												Registration Number <span className="text-error">*</span>
											</label>
											<input
												type="text"
												required
												value={veh.registrationNumber}
												onChange={(e) =>
													handleVehicleChange(idx, 'registrationNumber', e.target.value.toUpperCase())
												}
												placeholder="e.g. TN56P3334"
												className="form-input w-full font-mono uppercase text-xs"
											/>
										</div>

										<div>
											<label className="block text-xs font-medium text-on-surface mb-1">
												Make / Brand <span className="text-error">*</span>
											</label>
											<input
												type="text"
												required
												value={veh.make}
												onChange={(e) => handleVehicleChange(idx, 'make', e.target.value)}
												placeholder="e.g. Maruti, Hyundai, Toyota"
												className="form-input w-full text-xs"
											/>
										</div>

										<div>
											<label className="block text-xs font-medium text-on-surface mb-1">
												Model <span className="text-error">*</span>
											</label>
											<input
												type="text"
												required
												value={veh.model}
												onChange={(e) => handleVehicleChange(idx, 'model', e.target.value)}
												placeholder="e.g. Baleno, Creta, Fortuner"
												className="form-input w-full text-xs"
											/>
										</div>

										<div>
											<label className="block text-xs font-medium text-on-surface mb-1">
												Variant <span className="text-on-surface-variant font-normal">(Optional)</span>
											</label>
											<input
												type="text"
												value={veh.variant}
												onChange={(e) => handleVehicleChange(idx, 'variant', e.target.value)}
												placeholder="e.g. Zeta, SX(O)"
												className="form-input w-full text-xs"
											/>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</form>
		</Dialog>

		{/* Transfer Vehicle Confirmation Dialog */}
		<Dialog
			open={open && showTransferConfirm && !!vehicleConflict}
			onOpenChange={(isOpen) => {
				if (!isOpen && !isTransferring) setShowTransferConfirm(false);
			}}
			title="Transfer Vehicle Ownership?"
			description="Confirm vehicle transfer to this customer"
			size="md"
			footer={
				<>
					<Button
						type="button"
						variant="secondary"
						onClick={() => setShowTransferConfirm(false)}
						disabled={isTransferring}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="primary"
						onClick={handleConfirmTransfer}
						loading={isTransferring}
					>
						Transfer Ownership
					</Button>
				</>
			}
		>
			{vehicleConflict && (
				<div className="space-y-4 text-sm text-on-surface">
					<div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant space-y-2">
						<div className="flex justify-between">
							<span className="text-xs text-on-surface-variant">Vehicle:</span>
							<span className="font-mono font-bold text-on-surface">{vehicleConflict.registrationNumber}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-xs text-on-surface-variant">Make / Model:</span>
							<span className="font-medium text-on-surface">
								{vehicleConflict.make} {vehicleConflict.model} {vehicleConflict.variant ? `(${vehicleConflict.variant})` : ''}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-xs text-on-surface-variant">Current Owner:</span>
							<span className="font-medium text-error">{vehicleConflict.currentCustomerName}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-xs text-on-surface-variant">New Owner:</span>
							<span className="font-medium text-primary">{customer?.name}</span>
						</div>
					</div>

					<p className="text-xs text-on-surface-variant leading-relaxed">
						Existing service history, job cards, invoices and payments will not be deleted or changed.
					</p>
				</div>
			)}
		</Dialog>
		</>
	);
}
