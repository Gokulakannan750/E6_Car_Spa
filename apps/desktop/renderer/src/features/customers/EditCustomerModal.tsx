import React, { useState, useEffect, useCallback } from 'react';
import { User, Phone, Mail, MapPin, AlertCircle, Save, Car, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import {
	updateCustomer,
	getVehiclesByCustomer,
	updateVehicle,
	createVehicle,
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
			loadVehicles(customer.id);
		} else {
			setVehicles([]);
			setOriginalVehicles([]);
		}
	}, [customer, open, loadVehicles]);

	const handleClose = () => {
		setError('');
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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!customer) return;
		setError('');

		const trimmedName = name.trim();
		const trimmedPhone = phoneNumber.trim().replace(/\D/g, '').slice(0, 10);
		const trimmedEmail = email.trim();
		const trimmedAddress = address.trim();

		if (!trimmedName) {
			setError('Customer name is required.');
			return;
		}

		if (!trimmedPhone) {
			setError('Phone number is required.');
			return;
		}

		if (trimmedPhone.length !== 10) {
			setError('Phone number must be exactly 10 digits without country code.');
			return;
		}

		if (trimmedEmail) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(trimmedEmail)) {
				setError('Please enter a valid email address.');
				return;
			}
		}

		// Validate vehicles
		for (let i = 0; i < vehicles.length; i++) {
			const v = vehicles[i];
			const reg = v.registrationNumber.trim().toUpperCase();
			const mk = v.make.trim();
			const md = v.model.trim();

			// If it's a new empty entry and nothing entered, skip or alert
			if (!v.id && !reg && !mk && !md) {
				continue;
			}

			if (!reg) {
				setError(`Vehicle #${i + 1}: Registration number is required.`);
				return;
			}
			if (!mk) {
				setError(`Vehicle #${i + 1}: Make / Brand is required.`);
				return;
			}
			if (!md) {
				setError(`Vehicle #${i + 1}: Model is required.`);
				return;
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
						await updateVehicle(v.id, {
							registrationNumber: reg,
							make: mk,
							model: md,
							variant: vr,
						});
					}
				} else if (reg && mk && md) {
					// Create new vehicle
					await createVehicle({
						customerId: customer.id,
						registrationNumber: reg,
						make: mk,
						model: md,
						variant: vr,
					});
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
				{error && (
					<div className="flex items-start gap-2.5 p-3 rounded-lg bg-error-container/40 border border-error/30 text-error animate-fade-in text-sm">
						<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
						<span>{error}</span>
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
	);
}
