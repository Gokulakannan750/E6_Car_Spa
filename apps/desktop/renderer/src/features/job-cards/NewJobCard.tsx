import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	getCustomerByPhone,
	getVehicleByRegistration,
	createCustomer,
	getVehiclesByCustomer,
	createVehicle,
	getServices,
	createService,
	createJobCard,
	ApiError,
	type CustomerDto,
	type VehicleDto,
	type ServiceDto,
} from '../../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceItem {
	id: string;
	serviceId: string;
	name: string;
	category: string | null;
	unitPrice: number;
	quantity: number;
	taxPercentage: number;
	discountAmount: number;
	lineTotal: number;
}

interface NewCustomerForm {
	name: string;
	phone: string;
	email: string;
	address: string;
}

interface NewVehicleForm {
	registrationNumber: string;
	make: string;
	model: string;
	variant: string;
}

interface NewServiceForm {
	name: string;
	category: string;
	description: string;
	durationMinutes: string;
	price: string;
	isActive: boolean;
}

// The API returns durationMinutes on ServiceDto; we show it in search results
// but the backend CreateServiceInput doesn't accept it (editable only in backend/admin).
// Store it in the form state for display purposes only.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
	return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STEP_LABELS = ['Customer & Vehicle', 'Services', 'Review'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewJobCard() {
	const navigate = useNavigate();

	// ── Step tracking ─────────────────────────────────────────────────────────
	const [step, setStep] = useState(0); // 0 = customer/vehicle, 1 = services, 2 = review

	// ── Customer lookup ───────────────────────────────────────────────────────
	const [phone, setPhone] = useState('');
	const [regNumber, setRegNumber] = useState('');
	const [customer, setCustomer] = useState<CustomerDto | null>(null);
	const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
	const [selectedVehicle, setSelectedVehicle] = useState<VehicleDto | null>(null);
	const [isSearching, setIsSearching] = useState(false);
	const [customerError, setCustomerError] = useState<string | null>(null);

	// ── New customer form ─────────────────────────────────────────────────────
	const [showNewCustomer, setShowNewCustomer] = useState(false);
	const [newCustomer, setNewCustomer] = useState<NewCustomerForm>({ name: '', phone: '', email: '', address: '' });
	const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
	const [customerCreated, setCustomerCreated] = useState(false);

	// ── New vehicle form ──────────────────────────────────────────────────────
	const [showNewVehicle, setShowNewVehicle] = useState(false);
	const [newVehicle, setNewVehicle] = useState<NewVehicleForm>({ registrationNumber: '', make: '', model: '', variant: '' });
	const [isCreatingVehicle, setIsCreatingVehicle] = useState(false);

	// ── Services ──────────────────────────────────────────────────────────────
	const [services, setServices] = useState<ServiceItem[]>([]);
	const [serviceSearch, setServiceSearch] = useState('');
	const [searchResults, setSearchResults] = useState<ServiceDto[]>([]);
	const [showNewService, setShowNewService] = useState(false);
	const [newService, setNewService] = useState<NewServiceForm>({ name: '', category: '', description: '', durationMinutes: '', price: '', isActive: true });
	const [isCreatingService, setIsCreatingService] = useState(false);
	const [serviceCategories, setServiceCategories] = useState<string[]>([]);
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const [isCreatingJobCard, setIsCreatingJobCard] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [success, setSuccess] = useState<{ id: string; number: string; customerName: string; vehicleLabel: string; total: number } | null>(null);

	// ── Derived ───────────────────────────────────────────────────────────────
	const calcSubtotal = services.reduce((s, svc) => s + svc.unitPrice * svc.quantity, 0);
	const calcDiscount = services.reduce((s, svc) => s + svc.discountAmount, 0);
	const calcTax = services.reduce((s, svc) => s + svc.unitPrice * svc.quantity * svc.taxPercentage / 100, 0);
	const calcTotal = calcSubtotal - calcDiscount + calcTax;
	const canProceedToServices = customer !== null && selectedVehicle !== null;
	const canCreate = canProceedToServices && services.length > 0 && !isCreatingJobCard;

	// ── Load vehicles for a customer ─────────────────────────────────────────
	const loadCustomerAndVehicles = useCallback(async (cust: CustomerDto) => {
		setCustomer(cust);
		setSelectedVehicle(null);
		setVehicles([]);
		setCustomerError(null);
		try {
			const list = await getVehiclesByCustomer(cust.id);
			setVehicles(list);
			if (list.length === 1) setSelectedVehicle(list[0]);
		} catch {
			// vehicles will be empty — user can add one
		}
	}, []);

	// ── Phone lookup ──────────────────────────────────────────────────────────
	const handlePhoneSearch = useCallback(async () => {
		if (!phone.trim()) return;
		setIsSearching(true);
		setCustomerError(null);
		setShowNewCustomer(false);
		setCustomerCreated(false);
		try {
			const result = await getCustomerByPhone(phone.trim());
			await loadCustomerAndVehicles(result);
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) {
				setCustomerError('Customer not found. Create a new customer to continue.');
				setShowNewCustomer(true);
			} else {
				setCustomerError(err instanceof Error ? err.message : 'Failed to search customer');
			}
		} finally {
			setIsSearching(false);
		}
	}, [phone, loadCustomerAndVehicles]);

	// ── Registration lookup ───────────────────────────────────────────────────
	const handleRegSearch = useCallback(async () => {
		if (!regNumber.trim()) return;
		setIsSearching(true);
		setCustomerError(null);
		setShowNewCustomer(false);
		setCustomerCreated(false);
		try {
			const result = await getVehicleByRegistration(regNumber.trim());
			if (result) {
				// Cross-validate if phone also entered
				if (phone.trim()) {
					try {
						const custFromPhone = await getCustomerByPhone(phone.trim());
						if (custFromPhone.id !== result.customerId) {
							setCustomerError('This vehicle does not belong to the customer matching the phone number entered.');
							setIsSearching(false);
							return;
						}
						await loadCustomerAndVehicles(custFromPhone);
						setSelectedVehicle(result);
					} catch {
						// Phone not found — use vehicle's customer
						await loadCustomerAndVehicles({ id: result.customerId, name: result.customerName, phoneNumber: result.customerName, email: null, address: null, createdAt: result.createdAt } as CustomerDto);
						setSelectedVehicle(result);
					}
				} else {
					await loadCustomerAndVehicles({ id: result.customerId, name: result.customerName, phoneNumber: result.customerName, email: null, address: null, createdAt: result.createdAt } as CustomerDto);
					setSelectedVehicle(result);
				}
			} else {
				setCustomerError('Vehicle not found. Create a new customer and vehicle to continue.');
				setShowNewCustomer(true);
			}
		} catch (err) {
			setCustomerError(err instanceof Error ? err.message : 'Failed to search by registration number');
		} finally {
			setIsSearching(false);
		}
	}, [regNumber, phone, loadCustomerAndVehicles]);

	// ── Create customer ───────────────────────────────────────────────────────
	const handleCreateCustomer = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newCustomer.name.trim() || !newCustomer.phone.trim()) return;
		setIsCreatingCustomer(true);
		try {
			const created = await createCustomer({
				name: newCustomer.name.trim(),
				phoneNumber: newCustomer.phone.trim(),
				email: newCustomer.email || undefined,
				address: newCustomer.address || undefined,
			});
			await loadCustomerAndVehicles(created);
			setShowNewCustomer(false);
			setCustomerCreated(true);
			setCustomerError(null);
		} catch (err) {
			setCustomerError(err instanceof Error ? err.message : 'Failed to create customer');
		} finally {
			setIsCreatingCustomer(false);
		}
	};

	// ── Create vehicle ────────────────────────────────────────────────────────
	const handleCreateVehicle = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newVehicle.registrationNumber.trim() || !newVehicle.make.trim() || !newVehicle.model.trim() || !customer) return;
		setIsCreatingVehicle(true);
		try {
			const created = await createVehicle({
				registrationNumber: newVehicle.registrationNumber.trim(),
				make: newVehicle.make.trim(),
				model: newVehicle.model.trim(),
				variant: newVehicle.variant || undefined,
				customerId: customer.id,
			});
			setVehicles(prev => [...prev, created]);
			setSelectedVehicle(created);
			setShowNewVehicle(false);
		} catch (err) {
			setCustomerError(err instanceof Error ? err.message : 'Failed to create vehicle');
		} finally {
			setIsCreatingVehicle(false);
		}
	};

	// ── Service search (debounced) ────────────────────────────────────────────
	useEffect(() => {
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		if (!serviceSearch.trim()) { setSearchResults([]); return; }
		searchTimerRef.current = setTimeout(async () => {
			try {
				const result = await getServices({ page: 1, pageSize: 50, search: serviceSearch.trim() });
				setSearchResults(result.items);
			} catch {
				setSearchResults([]);
			}
		}, 250);
		return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
	}, [serviceSearch]);

	// Load categories when new-service modal opens
	useEffect(() => {
		if (!showNewService || serviceCategories.length > 0) return;
		(async () => {
			try {
				const result = await getServices({ page: 1, pageSize: 200, isActive: true });
				const cats = [...new Set(result.items.map(s => s.category).filter(Boolean))] as string[];
				setServiceCategories(cats);
			} catch { /* ignore */ }
		})();
	}, [showNewService, serviceCategories.length]);

	// Close search dropdown on Escape
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSearchResults([]); };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	// ── Add service ───────────────────────────────────────────────────────────
	const handleAddService = (svc: ServiceDto) => {
		const existing = services.find(s => s.serviceId === svc.id);
		if (existing) {
			setServices(prev => prev.map(s => s.serviceId === svc.id ? { ...s, quantity: s.quantity + 1, lineTotal: s.unitPrice * (s.quantity + 1) - s.discountAmount } : s));
		} else {
			setServices(prev => [...prev, {
				id: crypto.randomUUID(),
				serviceId: svc.id,
				name: svc.name,
				category: svc.category,
				unitPrice: svc.price,
				quantity: 1,
				taxPercentage: svc.taxPercentage,
				discountAmount: 0,
				lineTotal: svc.price,
			}]);
		}
		setServiceSearch('');
		setSearchResults([]);
		searchInputRef.current?.focus();
	};

	// ── Create new service ────────────────────────────────────────────────────
	const handleCreateService = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newService.name.trim() || !newService.price) return;
		setIsCreatingService(true);
		try {
			const existing = await getServices({ page: 1, pageSize: 1, search: newService.name.trim() }).then(r => r.items.find(s => s.name.toLowerCase() === newService.name.trim().toLowerCase()));
			if (existing) {
				handleAddService(existing);
			} else {
				const created = await createService({
					name: newService.name.trim(),
					category: newService.category || 'General',
					price: parseFloat(newService.price),
					taxPercentage: 18,
					description: newService.description || undefined,
					isActive: newService.isActive,
				});
				handleAddService(created);
			}
			setShowNewService(false);
			setNewService({ name: '', category: '', description: '', durationMinutes: '', price: '', isActive: true });
		} catch {
			// error handled silently
		} finally {
			setIsCreatingService(false);
		}
	};

	// ── Update/remove services ────────────────────────────────────────────────
	const updateQuantity = (id: string, quantity: number) => {
		if (quantity < 1) return;
		setServices(prev => prev.map(s => s.id === id ? { ...s, quantity, lineTotal: s.unitPrice * quantity - s.discountAmount } : s));
	};
	const updateDiscount = (id: string, discountAmount: number) => {
		if (discountAmount < 0) return;
		setServices(prev => prev.map(s => s.id === id ? { ...s, discountAmount, lineTotal: s.unitPrice * s.quantity - discountAmount } : s));
	};
	const removeService = (id: string) => setServices(prev => prev.filter(s => s.id !== id));

	// ── Create job card ───────────────────────────────────────────────────────
	const handleCreateJobCard = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!customer || !selectedVehicle || services.length === 0) return;
		setIsCreatingJobCard(true);
		setSubmitError(null);
		try {
			const result = await createJobCard({
				customerId: customer.id,
				vehicleId: selectedVehicle.id,
				services: services.map(s => ({ serviceId: s.serviceId, quantity: s.quantity, discountAmount: s.discountAmount })),
				notes: undefined,
			});
			setSuccess({ id: result.id, number: result.jobCardNumber, customerName: customer.name, vehicleLabel: `${selectedVehicle.registrationNumber} — ${selectedVehicle.make} ${selectedVehicle.model}`, total: result.totalAmount });
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : 'Failed to create job card');
		} finally {
			setIsCreatingJobCard(false);
		}
	};

	// ── Reset ─────────────────────────────────────────────────────────────────
	const handleReset = () => {
		setPhone(''); setRegNumber(''); setCustomer(null); setVehicles([]); setSelectedVehicle(null);
		setServices([]); setServiceSearch(''); setSearchResults([]);
		setShowNewCustomer(false); setShowNewVehicle(false); setShowNewService(false);
		setNewCustomer({ name: '', phone: '', email: '', address: '' });
		setNewVehicle({ registrationNumber: '', make: '', model: '', variant: '' });
		setNewService({ name: '', category: '', description: '', durationMinutes: '', price: '', isActive: true });
		setStep(0); setCustomerError(null); setSubmitError(null); setSuccess(null); setCustomerCreated(false);
	};

	// ═══════════════════════════════════════════════════════════════════════════
	// SUCCESS VIEW
	// ═══════════════════════════════════════════════════════════════════════════
	if (success) {
		return (
			<div className="flex flex-col h-full">
				<div className="px-6 py-4 border-b border-outline-variant">
					<h1 className="text-xl font-semibold">New Job Card</h1>
				</div>
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center max-w-md">
						<div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
							<span className="material-symbols-outlined text-green-700 text-3xl">check_circle</span>
						</div>
						<h2 className="text-lg font-semibold text-headline-sm text-on-surface mb-1">Job Card Created</h2>
						<p className="font-medium text-sm text-on-surface-variant mb-1">
							Job Card <span className="font-semibold text-on-surface">{success.number}</span> has been created successfully.
						</p>
						<div className="bg-surface border border-outline-variant rounded-xl p-4 mb-6 text-left space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-on-surface-variant">Customer</span>
								<span className="font-medium text-on-surface">{success.customerName}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-on-surface-variant">Vehicle</span>
								<span className="font-medium text-on-surface">{success.vehicleLabel}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-on-surface-variant">Total Amount</span>
								<span className="font-medium text-on-surface">{formatCurrency(success.total)}</span>
							</div>
						</div>
						<div className="flex gap-3">
							<button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-1.5 border border-outline-variant text-on-surface font-semibold text-xs uppercase tracking-wider text-label-md uppercase px-4 py-2.5 rounded hover:bg-surface-variant transition-colors">
								<span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span>
								Print
							</button>
							<button onClick={() => navigate(`/job-cards/${success.id}`)} className="flex-1 btn-primary flex items-center justify-center gap-1.5 font-semibold text-xs uppercase tracking-wider text-label-md uppercase px-4 py-2.5">
								<span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
								View Job Card
							</button>
						</div>
						<button onClick={handleReset} className="mt-4 text-sm text-secondary hover:text-secondary/80 font-medium">
							Create Another Job Card
						</button>
					</div>
				</div>
			</div>
		);
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// FORM VIEW
	// ═══════════════════════════════════════════════════════════════════════════
	return (
		<div className="flex flex-col h-full">
			{/* ── Header ──────────────────────────────────────────────────────── */}
			<div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
				<h1 className="text-xl font-semibold">New Job Card</h1>
			</div>

			{/* ── Stepper ────────────────────────────────────────────────────── */}
			<div className="px-6 pt-4">
				<div className="flex items-center">
					{STEP_LABELS.map((label, i) => (
						<div key={label} className="flex items-center">
							<div className="flex flex-col items-center">
								<div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md mb-xs shadow-sm ${i <= step ? 'bg-secondary text-on-secondary' : 'bg-surface-container-highest text-on-surface-variant border border-outline-variant'}`}>
									{i + 1}
								</div>
								<span className={`font-label-md text-label-md whitespace-nowrap ${i <= step ? 'text-secondary' : 'text-on-surface-variant'}`}>{label}</span>
							</div>
							{i < STEP_LABELS.length - 1 && <div className="w-12 md:w-24 h-[2px] bg-outline-variant mx-sm -mt-6" />}
						</div>
					))}
				</div>
			</div>

			{/* ── Scrollable Content ─────────────────────────────────────────── */}
			<div className="flex-1 overflow-y-auto px-6 py-4">
				<form onSubmit={handleCreateJobCard} className="max-w-5xl mx-auto space-y-6">

					{/* ══════════════════════════════════════════════════════════════ */}
					{/* STEP 1 — Customer & Vehicle */}
					{/* ══════════════════════════════════════════════════════════════ */}
					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-lg">
						<h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-lg pb-sm border-b border-surface-variant">Customer &amp; Vehicle Information</h3>

						{/* ── Lookup Row ───────────────────────────────────────────── */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-lg">
							{/* Phone lookup */}
							<div className="space-y-sm">
								<label className="block font-label-md text-label-md text-on-surface">Phone Number <span className="text-error">*</span></label>
								<div className="flex gap-2">
									<input
										type="tel"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handlePhoneSearch())}
										placeholder="Enter customer phone number"
										className="flex-1 bg-surface border border-outline-variant rounded-lg py-2 px-sm text-body-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
									/>
									<button type="button" onClick={handlePhoneSearch} disabled={!phone.trim() || isSearching} className="border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-surface-container-highest transition-colors whitespace-nowrap disabled:opacity-50">
										{isSearching ? 'Searching…' : 'Search'}
									</button>
								</div>
							</div>

							{/* Registration lookup */}
							<div className="space-y-sm">
								<label className="block font-label-md text-label-md text-on-surface">Vehicle Registration Number</label>
								<div className="flex gap-2">
									<input
										type="text"
										value={regNumber}
										onChange={(e) => setRegNumber(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRegSearch())}
										placeholder="e.g. TN56P1234"
										className="flex-1 bg-surface border border-outline-variant rounded-lg py-2 px-sm text-body-md uppercase focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
									/>
									<button type="button" onClick={handleRegSearch} disabled={!regNumber.trim() || isSearching} className="border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-surface-container-highest transition-colors whitespace-nowrap disabled:opacity-50">
										Search
									</button>
								</div>
							</div>
						</div>

						{/* ── Error ────────────────────────────────────────────────── */}
						{customerError && (
							<div className="mb-4 bg-error-container border border-error rounded-lg p-3 text-error text-sm flex items-center gap-2">
								<span className="material-symbols-outlined text-[18px]">error</span>
								{customerError}
							</div>
						)}

						{/* ── Customer Found Card ───────────────────────────────────── */}
						{customer && (
							<div className="mb-4 bg-surface-container-low rounded-lg border border-outline-variant p-md">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-xs">Customer</p>
										<p className="font-body-md text-body-md font-medium text-on-surface">{customer.name}</p>
										<p className="font-body-sm text-body-sm text-on-surface-variant">{customer.phoneNumber}</p>
										{customer.email && <p className="font-body-sm text-body-sm text-on-surface-variant">{customer.email}</p>}
										{customer.address && <p className="font-body-sm text-body-sm text-on-surface-variant">{customer.address}</p>}
									</div>
									{customerCreated && (
										<span className="flex items-center gap-1 text-success text-sm font-medium">
											<span className="material-symbols-outlined text-[18px]">check_circle</span>
											Created
										</span>
									)}
								</div>
							</div>
						)}

						{/* ── New Customer Form ────────────────────────────────────── */}
						{showNewCustomer && (
							<div className="mb-4 bg-surface rounded-xl border border-outline-variant shadow-sm p-lg">
								<h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-4">New Customer</h4>
								<form onSubmit={handleCreateCustomer} className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
									<div className="space-y-sm">
										<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Name <span className="text-error">*</span></label>
										<input required value={newCustomer.name} onChange={(e) => setNewCustomer(p => ({ ...p, name: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="Full name" />
									</div>
									<div className="space-y-sm">
										<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Phone <span className="text-error">*</span></label>
										<input required value={newCustomer.phone} onChange={(e) => setNewCustomer(p => ({ ...p, phone: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="Phone number" />
									</div>
									<div className="space-y-sm">
										<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Email</label>
										<input value={newCustomer.email} onChange={(e) => setNewCustomer(p => ({ ...p, email: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="email@example.com" />
									</div>
									<div className="space-y-sm">
										<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Address</label>
										<input value={newCustomer.address} onChange={(e) => setNewCustomer(p => ({ ...p, address: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="Address" />
									</div>
									<div className="md:col-span-2">
										<button type="submit" disabled={isCreatingCustomer} className="btn-primary">
											{isCreatingCustomer ? 'Creating…' : 'Create Customer'}
										</button>
									</div>
								</form>
							</div>
						)}

						{/* ── Vehicle Section ──────────────────────────────────────── */}
						{customer && (
							<div className="border-t border-surface-variant pt-lg">
								<h4 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">Vehicle</h4>

								{/* Existing vehicles */}
								{vehicles.length > 0 && (
									<div className="space-y-sm mb-4">
										{vehicles.map(v => (
											<label key={v.id} className={`flex items-center gap-3 p-md rounded-lg border cursor-pointer transition-colors ${selectedVehicle?.id === v.id ? 'border-secondary bg-secondary/5' : 'border-outline-variant hover:bg-surface-container-low'}`}>
												<input
													type="radio"
													name="vehicle"
													checked={selectedVehicle?.id === v.id}
													onChange={() => setSelectedVehicle(v)}
													className="accent-secondary"
												/>
												<div>
													<p className="font-body-sm text-body-sm font-medium text-on-surface">{v.registrationNumber}</p>
													<p className="font-body-sm text-body-sm text-on-surface-variant">{v.make} {v.model}{v.variant ? ` — ${v.variant}` : ''}</p>
												</div>
											</label>
										))}
									</div>
								)}

								{/* Add new vehicle button / form */}
								{!showNewVehicle ? (
									<button type="button" onClick={() => setShowNewVehicle(true)} className="flex items-center gap-1.5 border border-dashed border-outline-variant text-on-surface-variant font-label-md text-label-md px-4 py-2 rounded-lg hover:border-secondary hover:text-secondary transition-colors">
										<span className="material-symbols-outlined text-[18px]">add</span>
										Add New Vehicle
									</button>
								) : (
									<div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-lg">
										<h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-4">New Vehicle</h4>
										<form onSubmit={handleCreateVehicle} className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
											<div className="space-y-sm">
												<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Registration Number <span className="text-error">*</span></label>
												<input required value={newVehicle.registrationNumber} onChange={(e) => setNewVehicle(p => ({ ...p, registrationNumber: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary uppercase" placeholder="TN56P1234" />
											</div>
											<div className="space-y-sm">
												<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Make <span className="text-error">*</span></label>
												<input required value={newVehicle.make} onChange={(e) => setNewVehicle(p => ({ ...p, make: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="Maruti" />
											</div>
											<div className="space-y-sm">
												<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Model <span className="text-error">*</span></label>
												<input required value={newVehicle.model} onChange={(e) => setNewVehicle(p => ({ ...p, model: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="Alto 800" />
											</div>
											<div className="space-y-sm">
												<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Variant</label>
												<input value={newVehicle.variant} onChange={(e) => setNewVehicle(p => ({ ...p, variant: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="Variant" />
											</div>
											<div className="md:col-span-2 flex gap-3">
												<button type="submit" disabled={isCreatingVehicle} className="btn-primary">
													{isCreatingVehicle ? 'Adding…' : 'Add Vehicle'}
												</button>
												<button type="button" onClick={() => setShowNewVehicle(false)} className="border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-surface-container-highest transition-colors">
													Cancel
												</button>
											</div>
										</form>
									</div>
								)}
							</div>
						)}
					</div>

					{/* ══════════════════════════════════════════════════════════════ */}
					{/* STEP 2 — Services */}
					{/* ══════════════════════════════════════════════════════════════ */}
					<div className={`bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-lg ${!canProceedToServices ? 'opacity-50 pointer-events-none' : ''}`}>
						<h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-lg pb-sm border-b border-surface-variant">Services</h3>

						{!canProceedToServices && (
							<p className="text-sm text-on-surface-variant mb-4">Select a customer and vehicle first to add services.</p>
						)}

						{canProceedToServices && (
							<>
								{/* Search + Add button */}
								<div className="flex items-center gap-md mb-4">
									<div className="relative flex-1 max-w-md">
										<span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
										<input
											ref={searchInputRef}
											type="text"
											value={serviceSearch}
											onChange={(e) => setServiceSearch(e.target.value)}
											placeholder="Search services..."
											className="w-full bg-surface border border-outline-variant rounded-lg py-2 pl-10 pr-4 text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
										/>
									</div>
									<button type="button" onClick={() => setShowNewService(true)} className="flex items-center justify-center gap-1 bg-secondary text-on-secondary font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-secondary-container transition-colors shadow-sm whitespace-nowrap">
										<span className="material-symbols-outlined text-[18px]">add</span>
										Add Service
									</button>
								</div>

								{/* Search dropdown */}
								{searchResults.length > 0 && (
									<div className="absolute z-20 w-full max-w-md mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg max-h-60 overflow-y-auto">
										{searchResults.map(svc => (
											<div key={svc.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-variant transition-colors border-b border-outline-variant last:border-b-0">
												<div>
													<p className="text-sm text-on-surface font-medium">{svc.name}</p>
													<p className="text-xs text-on-surface-variant">{svc.category} — {formatCurrency(svc.price)}{svc.durationMinutes ? ` — ${svc.durationMinutes} min` : ''}</p>
												</div>
												<button type="button" onClick={() => handleAddService(svc)} className="text-secondary hover:text-secondary-container font-label-md text-label-md whitespace-nowrap">+ Add</button>
											</div>
										))}
									</div>
								)}

								{/* Services table */}
								{services.length > 0 && (
									<div className="overflow-x-auto rounded-lg border border-outline-variant mb-4">
										<table className="w-full text-left border-collapse">
											<thead>
												<tr className="bg-surface-container-high border-b border-outline-variant">
													<th className="p-sm font-label-md text-label-md text-on-surface-variant">Service</th>
													<th className="p-sm font-label-md text-label-md text-on-surface-variant text-right">Qty</th>
													<th className="p-sm font-label-md text-label-md text-on-surface-variant text-right">Rate</th>
													<th className="p-sm font-label-md text-label-md text-on-surface-variant text-right">Discount</th>
													<th className="p-sm font-label-md text-label-md text-on-surface-variant text-right">Total</th>
													<th className="p-sm w-10"></th>
												</tr>
											</thead>
											<tbody className="divide-y divide-outline-variant">
												{services.map(item => (
													<tr key={item.id} className="hover:bg-surface transition-colors">
														<td className="p-sm">
															<p className="text-sm text-on-surface font-medium">{item.name}</p>
															<p className="text-xs text-on-surface-variant">{item.category}</p>
														</td>
														<td className="p-sm text-right">
															<input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)} min="1" className="w-16 bg-surface-container-low border border-outline-variant rounded p-1 text-right text-sm focus:ring-1 focus:ring-secondary focus:border-secondary" />
														</td>
														<td className="p-sm text-sm text-on-surface-variant text-right">{formatCurrency(item.unitPrice)}</td>
														<td className="p-sm text-right">
															<input type="number" value={item.discountAmount} onChange={(e) => updateDiscount(item.id, parseFloat(e.target.value) || 0)} min="0" step="0.01" className="w-24 bg-surface-container-low border border-outline-variant rounded p-1 text-right text-sm focus:ring-1 focus:ring-secondary focus:border-secondary" />
														</td>
														<td className="p-sm text-sm text-on-surface font-medium text-right">{formatCurrency(item.lineTotal)}</td>
														<td className="p-sm text-center">
															<button type="button" onClick={() => removeService(item.id)} className="text-error hover:text-on-error-container transition-colors">
																<span className="material-symbols-outlined text-[18px]">delete</span>
															</button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}

								{/* Financial summary inline */}
								{services.length > 0 && (
									<div className="flex justify-end">
										<div className="w-full md:w-64 space-y-xs">
											<div className="flex justify-between font-body-sm text-on-surface-variant">
												<span>Subtotal</span>
												<span>{formatCurrency(calcSubtotal)}</span>
											</div>
											{calcDiscount > 0 && (
												<div className="flex justify-between font-body-sm text-on-surface-variant">
													<span>Discount</span>
													<span>-{formatCurrency(calcDiscount)}</span>
												</div>
											)}
											<div className="flex justify-between font-headline-sm font-bold text-on-surface pt-xs border-t border-outline-variant mt-xs">
												<span>Total</span>
												<span>{formatCurrency(calcTotal)}</span>
											</div>
										</div>
									</div>
								)}
							</>
						)}
					</div>

					{/* ══════════════════════════════════════════════════════════════ */}
					{/* Add Service Modal */}
					{/* ══════════════════════════════════════════════════════════════ */}
					{showNewService && (
						<div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowNewService(false)}>
							<div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
							<div className="relative bg-surface-container-lowest rounded-xl shadow-elevation-2 w-full mx-4 max-w-lg" onClick={(e) => e.stopPropagation()}>
								<div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
									<h2 className="text-lg font-semibold text-headline-sm text-on-surface">New Service</h2>
									<button type="button" onClick={() => setShowNewService(false)} className="p-1 rounded hover:bg-surface-container transition-colors">
										<span className="material-symbols-outlined text-on-surface-variant">close</span>
									</button>
								</div>
								<form onSubmit={handleCreateService} className="px-6 py-4 space-y-4">
									<div className="space-y-sm">
										<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Service Name <span className="text-error">*</span></label>
										<input required value={newService.name} onChange={(e) => setNewService(p => ({ ...p, name: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="e.g. Premium Wash" />
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-sm">
											<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Category</label>
											<input value={newService.category} onChange={(e) => setNewService(p => ({ ...p, category: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="e.g. Washing" />
										</div>
										<div className="space-y-sm">
											<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Price (₹) <span className="text-error">*</span></label>
											<input required type="number" step="0.01" min="0" value={newService.price} onChange={(e) => setNewService(p => ({ ...p, price: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="0.00" />
										</div>
									</div>
									<div className="space-y-sm">
										<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Description</label>
										<textarea value={newService.description} onChange={(e) => setNewService(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary resize-none" placeholder="Service description..." />
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-sm">
											<label className="block font-label-md text-label-md text-on-surface-variant uppercase">Duration (min)</label>
											<input type="number" min="0" value={newService.durationMinutes} onChange={(e) => setNewService(p => ({ ...p, durationMinutes: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="30" />
										</div>
										<div className="space-y-sm">
											<label className="flex items-center gap-2 mt-7 cursor-pointer">
												<input type="checkbox" checked={newService.isActive} onChange={(e) => setNewService(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 accent-secondary" />
												<span className="text-sm text-on-surface">Active</span>
											</label>
										</div>
									</div>
									<div className="flex justify-end gap-3 pt-2">
										<button type="button" onClick={() => setShowNewService(false)} className="border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-surface-container-highest transition-colors">
											Cancel
										</button>
										<button type="submit" disabled={isCreatingService} className="btn-primary">
											{isCreatingService ? 'Saving…' : 'Save Service'}
										</button>
									</div>
								</form>
							</div>
						</div>
					)}

					{/* ══════════════════════════════════════════════════════════════ */}
					{/* STEP 3 — Review & Summary */}
					{/* ══════════════════════════════════════════════════════════════ */}
					{canProceedToServices && (
						<div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-lg">
							<h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-lg pb-sm border-b border-surface-variant">Review &amp; Summary</h3>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
								{/* Customer & Vehicle summary */}
								<div className="space-y-lg">
									<div className="bg-surface p-md rounded-lg border border-outline-variant">
										<h4 className="font-label-md text-label-md font-bold text-on-surface-variant mb-sm uppercase tracking-wider">Customer &amp; Vehicle</h4>
										<div className="grid grid-cols-2 gap-sm text-body-sm">
											<div className="text-on-surface-variant">Customer:</div><div className="font-medium text-on-surface">{customer?.name}</div>
											<div className="text-on-surface-variant">Phone:</div><div className="font-medium text-on-surface">{customer?.phoneNumber}</div>
											<div className="text-on-surface-variant">Registration:</div><div className="font-medium text-on-surface">{selectedVehicle?.registrationNumber}</div>
											<div className="text-on-surface-variant">Make / Model:</div><div className="font-medium text-on-surface">{selectedVehicle?.make} {selectedVehicle?.model}{selectedVehicle?.variant ? ` — ${selectedVehicle.variant}` : ''}</div>
										</div>
									</div>
								</div>

								{/* Financial summary */}
								<div className="bg-surface p-md rounded-lg border border-outline-variant h-fit">
									<h4 className="font-label-md text-label-md font-bold text-on-surface-variant mb-md uppercase tracking-wider">Services Summary</h4>
									<div className="space-y-sm text-body-sm mb-lg">
										{services.map(s => (
											<div key={s.id} className="flex justify-between">
												<span className="text-on-surface">{s.name} (x{s.quantity})</span>
												<span className="font-medium text-on-surface">{formatCurrency(s.lineTotal)}</span>
											</div>
										))}
									</div>
									<div className="border-t border-outline-variant pt-sm space-y-xs">
										<div className="flex justify-between text-on-surface-variant text-body-sm">
											<span>Items Subtotal ({services.length})</span>
											<span>{formatCurrency(calcSubtotal)}</span>
										</div>
										{calcDiscount > 0 && (
											<div className="flex justify-between text-on-surface-variant text-body-sm">
												<span>Discount</span>
												<span>-{formatCurrency(calcDiscount)}</span>
											</div>
										)}
										<div className="flex justify-between font-headline-sm font-bold text-secondary pt-sm border-t border-outline-variant mt-sm">
											<span>Final Estimate</span>
											<span>{formatCurrency(calcTotal)}</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* ── Error ────────────────────────────────────────────────────── */}
					{submitError && (
						<div className="bg-error-container border border-error rounded-lg p-4 text-error text-sm flex items-center gap-2">
							<span className="material-symbols-outlined text-[18px]">error</span>
							{submitError}
						</div>
					)}

					{/* ── Action Buttons ───────────────────────────────────────────── */}
					<div className="flex justify-between items-center pt-4">
						<button type="button" onClick={handleReset} className="px-lg py-2 border border-outline text-on-surface-variant font-label-md text-label-md rounded-lg hover:bg-surface-container-highest transition-colors">
							Reset
						</button>
						<div className="flex gap-md">
							<button type="submit" disabled={!canCreate} className="btn-primary flex items-center gap-1">
								<span className="material-symbols-outlined text-[18px]">check_circle</span>
								{isCreatingJobCard ? 'Creating…' : 'Create Job Card'}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
