import React, { useState } from 'react';
import { User, Phone, Mail, MapPin, Car, AlertCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import {
	createCustomer,
	createVehicle,
	type CustomerDto,
	ApiError,
} from '../../lib/api';

interface CreateCustomerModalProps {
	open: boolean;
	onClose: () => void;
	onSuccess: (customer: CustomerDto) => void;
}

export function CreateCustomerModal({ open, onClose, onSuccess }: CreateCustomerModalProps) {
	// Customer fields
	const [name, setName] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [email, setEmail] = useState('');
	const [address, setAddress] = useState('');

	// Optional vehicle fields
	const [showVehicleSection, setShowVehicleSection] = useState(false);
	const [regNumber, setRegNumber] = useState('');
	const [make, setMake] = useState('');
	const [model, setModel] = useState('');
	const [variant, setVariant] = useState('');

	// Status & Error handling
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const resetForm = () => {
		setName('');
		setPhoneNumber('');
		setEmail('');
		setAddress('');
		setShowVehicleSection(false);
		setRegNumber('');
		setMake('');
		setModel('');
		setVariant('');
		setError('');
	};

	const handleClose = () => {
		resetForm();
		onClose();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

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

		// Vehicle validation if enabled
		const trimmedRegNumber = regNumber.trim().toUpperCase();
		const trimmedMake = make.trim();
		const trimmedModel = model.trim();

		if (showVehicleSection) {
			if (!trimmedRegNumber) {
				setError('Vehicle registration number is required when adding a vehicle.');
				return;
			}
			if (!trimmedMake) {
				setError('Vehicle make / brand is required.');
				return;
			}
			if (!trimmedModel) {
				setError('Vehicle model is required.');
				return;
			}
		}

		setIsSubmitting(true);

		try {
			// 1. Create customer
			const newCustomer = await createCustomer({
				name: trimmedName,
				phoneNumber: trimmedPhone,
				email: trimmedEmail || null,
				address: trimmedAddress || null,
			});

			// 2. If vehicle details entered, create vehicle
			if (showVehicleSection && trimmedRegNumber && trimmedMake && trimmedModel) {
				try {
					await createVehicle({
						customerId: newCustomer.id,
						registrationNumber: trimmedRegNumber,
						make: trimmedMake,
						model: trimmedModel,
						variant: variant.trim() || null,
					});
				} catch (vehErr: unknown) {
					console.warn('Customer created, but vehicle creation failed:', vehErr);
					// Still proceed as customer was created successfully
				}
			}

			resetForm();
			onSuccess(newCustomer);
		} catch (err: unknown) {
			if (err instanceof ApiError) {
				setError(err.message || 'Failed to create customer.');
			} else if (err instanceof Error) {
				setError(err.message);
			} else {
				setError('An unexpected error occurred while creating customer.');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) handleClose();
			}}
			title="Create Customer"
			description="Register a new customer profile and optional vehicle in the directory"
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
						icon={<Plus className="w-4 h-4" />}
					>
						{showVehicleSection ? 'Create Customer & Vehicle' : 'Create Customer'}
					</Button>
				</>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				{error && (
					<div className="flex items-start gap-2.5 p-3 rounded-lg bg-error-container/40 border border-error/30 text-error animate-fade-in text-sm">
						<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
						<span>{error}</span>
					</div>
				)}

				{/* ── Customer Details Section ────────────────────────────── */}
				<div className="space-y-3.5">
					<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
						<User className="w-3.5 h-3.5 text-secondary" />
						<span>Customer Information</span>
					</div>

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

				{/* ── Vehicle Section Toggle ─────────────────────────────── */}
				<div className="pt-2 border-t border-outline-variant/60">
					<button
						type="button"
						onClick={() => setShowVehicleSection(!showVehicleSection)}
						className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors text-left cursor-pointer"
					>
						<div className="flex items-center gap-2">
							<Car className="w-4 h-4 text-secondary" />
							<span className="text-sm font-medium text-on-surface">
								Add Vehicle Details
							</span>
							<span className="text-xs text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-full">
								Optional
							</span>
						</div>
						{showVehicleSection ? (
							<ChevronUp className="w-4 h-4 text-on-surface-variant" />
						) : (
							<ChevronDown className="w-4 h-4 text-on-surface-variant" />
						)}
					</button>

					{showVehicleSection && (
						<div className="mt-3 p-3.5 rounded-lg border border-outline-variant/70 bg-surface-container-lowest space-y-3.5 animate-slide-in">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
								<div>
									<label className="block text-xs font-medium text-on-surface mb-1">
										Registration Number <span className="text-error">*</span>
									</label>
									<input
										type="text"
										value={regNumber}
										onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
										placeholder="e.g. TN 01 AB 1234"
										className="form-input w-full font-mono uppercase tracking-wider"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-on-surface mb-1">
										Make / Brand <span className="text-error">*</span>
									</label>
									<input
										type="text"
										value={make}
										onChange={(e) => setMake(e.target.value)}
										placeholder="e.g. Hyundai, Toyota, BMW"
										className="form-input w-full"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
								<div>
									<label className="block text-xs font-medium text-on-surface mb-1">
										Model <span className="text-error">*</span>
									</label>
									<input
										type="text"
										value={model}
										onChange={(e) => setModel(e.target.value)}
										placeholder="e.g. Creta, Fortuner, Baleno"
										className="form-input w-full"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-on-surface mb-1">
										Variant <span className="text-on-surface-variant font-normal">(Optional)</span>
									</label>
									<input
										type="text"
										value={variant}
										onChange={(e) => setVariant(e.target.value)}
										placeholder="e.g. SX(O) Diesel, Zeta"
										className="form-input w-full"
									/>
								</div>
							</div>
						</div>
					)}
				</div>
			</form>
		</Dialog>
	);
}
