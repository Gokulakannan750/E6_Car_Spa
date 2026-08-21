import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
	getCustomerByPhone,
	getVehicleByRegistration,
	createCustomer,
	getVehiclesByCustomer,
	createVehicle,
	getServices,
	createService,
	createJobCard,
	getServiceById,
	ApiError,
	type CustomerDto,
	type VehicleDto,
	type ServiceDto,
} from '../../lib/api';
import { Button } from '../../components/ui/Button';
import {
	Search,
	Plus,
	Trash2,
	CheckCircle2,
	User,
	Car,
	Loader2,
	X,
	Check,
	ArrowRight,
	ArrowLeft,
} from 'lucide-react';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
	return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STEPS = ['Customer & Vehicle', 'Services', 'Review'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewJobCard() {
	const navigate = useNavigate();
	const location = useLocation();
	const preselectedServiceId = (location.state as { preselectedServiceId?: string } | null)?.preselectedServiceId;

	// ── Step tracking ─────────────────────────────────────────────────────────
	const [step, setStep] = useState(0);

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

	// ── Preselect service from Catalogue ───────────────────────────────────────
	useEffect(() => {
		if (!preselectedServiceId) return;
		let cancelled = false;
		(async () => {
			try {
				const svc = await getServiceById(preselectedServiceId);
				if (!cancelled && svc) {
					setServices(prev => {
						const existing = prev.find(s => s.serviceId === svc.id);
						if (existing) {
							return prev.map(s => s.serviceId === svc.id ? { ...s, quantity: s.quantity + 1, lineTotal: s.unitPrice * (s.quantity + 1) - s.discountAmount } : s);
						}
						return [...prev, {
							id: crypto.randomUUID(),
							serviceId: svc.id,
							name: svc.name,
							category: svc.category,
							unitPrice: svc.price,
							quantity: 1,
							taxPercentage: svc.taxPercentage,
							discountAmount: 0,
							lineTotal: svc.price,
						}];
					});
					navigate('/job-cards/new', { replace: true, state: {} });
				}
			} catch {
				// service not found — ignore
			}
		})();
		return () => { cancelled = true; };
	}, [preselectedServiceId]);

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
				isGstEnabled: true,
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

	// ── Step validation ───────────────────────────────────────────────────────
	const validateStep = (): boolean => {
		if (step === 0) {
			if (!customer) {
				setCustomerError('Please enter a phone number and press Enter to look up or create a customer.');
				return false;
			}
			if (!selectedVehicle) {
				setCustomerError('Please select a vehicle.');
				return false;
			}
		}
		if (step === 1 && services.length === 0) {
			setCustomerError('Add at least one service to create a job card.');
			return false;
		}
		return true;
	};

	// ════════════════════════════════════════════════════════════════════════════
	// SUCCESS VIEW
	// ════════════════════════════════════════════════════════════════════════════
	if (success) {
		return (
			<div className="flex flex-col h-full animate-fade-in">
				<div className="px-6 py-4 border-b border-outline-variant">
					<h1 className="text-xl font-semibold text-on-surface">New Job Card</h1>
				</div>
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center max-w-md">
						<div className="w-16 h-16 rounded-full bg-success-container flex items-center justify-center mx-auto mb-4">
							<CheckCircle2 className="w-8 h-8 text-success" />
						</div>
						<h2 className="text-lg font-semibold text-on-surface mb-1">Job Card Created</h2>
						<p className="text-sm text-on-surface-variant mb-4">
							Job Card <span className="font-semibold text-on-surface">{success.number}</span> has been created successfully.
						</p>
						<div className="bg-surface border border-outline-variant rounded-lg p-4 mb-6 text-left space-y-2">
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
							<Button variant="secondary" onClick={() => window.print()} className="flex-1">Print</Button>
							<Button onClick={() => navigate(`/job-cards/${success.id}`)} className="flex-1">View Job Card</Button>
						</div>
						<button onClick={handleReset} className="mt-4 text-sm text-secondary hover:text-secondary/80 font-medium">Create Another Job Card</button>
					</div>
				</div>
			</div>
		);
	}

	// ════════════════════════════════════════════════════════════════════════════
	// FORM VIEW
	// ════════════════════════════════════════════════════════════════════════════
	return (
		<div className="flex flex-col h-full animate-fade-in">
			{/* ── Header ──────────────────────────────────────────────────────── */}
			<div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
				<h1 className="text-xl font-semibold text-on-surface">New Job Card</h1>
			</div>

			{/* ── Stepper ────────────────────────────────────────────────────── */}
			<div className="px-6 pt-5">
				<div className="flex items-center">
					{STEPS.map((label, i) => {
						const isCompleted = step > i;
						const isActive = step === i;
						return (
							<div key={label} className="flex items-center flex-1">
								<div className="flex flex-col items-center">
									<div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
										isCompleted ? 'bg-secondary text-white' :
										isActive ? 'bg-secondary text-white' :
										'bg-surface-container-high text-on-surface-variant border border-outline-variant'
									}`}>
										{isCompleted ? <Check className="w-4 h-4" /> : i + 1}
									</div>
									<span className={`text-xs mt-1 whitespace-nowrap transition-colors ${isCompleted || isActive ? 'text-secondary font-medium' : 'text-on-surface-variant'}`}>{label}</span>
								</div>
								{i < STEPS.length - 1 && <div className={`flex-1 h-[2px] mx-2 transition-colors ${isCompleted ? 'bg-secondary' : 'bg-outline-variant'}`} />}
							</div>
						);
					})}
				</div>
			</div>

			{/* ── Scrollable Content ─────────────────────────────────────────── */}
			<div className="flex-1 overflow-y-auto px-6 py-5">
				{customerError && step === 0 && (
					<div className="max-w-5xl mx-auto mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm flex items-center gap-2">
						<X className="w-4 h-4 shrink-0" />
						<span>{customerError}</span>
					</div>
				)}
				<form onSubmit={handleCreateJobCard} className="max-w-5xl mx-auto space-y-5">

					{/* ══════════════════════════════════════════════════════════════ */}
					{/* STEP 1 — Customer & Vehicle */}
					{/* ══════════════════════════════════════════════════════════════ */}
					{step === 0 && (
						<div className="app-card p-5">
							<h3 className="text-base font-semibold text-on-surface mb-4 pb-3 border-b border-outline-variant">Customer & Vehicle Information</h3>

							{/* ── Lookup Row ───────────────────────────────────────────── */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
								{/* Phone lookup */}
								<div>
									<label className="block text-sm font-medium text-on-surface mb-1.5">Phone Number <span className="text-error">*</span></label>
									<div className="flex gap-2">
										<div className="flex-1 relative">
											<User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
											<input
												type="tel"
												value={phone}
												onChange={(e) => setPhone(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handlePhoneSearch())}
												placeholder="Enter customer phone number"
												className="form-input pl-9"
											/>
										</div>
										<Button type="button" onClick={handlePhoneSearch} disabled={!phone.trim() || isSearching} variant="secondary">
											{isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
											Search
										</Button>
									</div>
								</div>

								{/* Registration lookup */}
								<div>
									<label className="block text-sm font-medium text-on-surface mb-1.5">Vehicle Registration Number</label>
									<div className="flex gap-2">
										<div className="flex-1 relative">
											<Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
											<input
												type="text"
												value={regNumber}
												onChange={(e) => setRegNumber(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRegSearch())}
												placeholder="E.G. TN56P1234"
												className="form-input pl-9 uppercase"
											/>
										</div>
										<Button type="button" onClick={handleRegSearch} disabled={!regNumber.trim() || isSearching} variant="secondary">
											<Search className="w-4 h-4" />
											Search
										</Button>
									</div>
								</div>
							</div>

							{/* ── Error ────────────────────────────────────────────────── */}
							{customerError && (
								<div className="mb-4 bg-error-container border border-error rounded-lg p-3 text-error text-sm flex items-center gap-2">
									<X className="w-4 h-4" />
									{customerError}
								</div>
							)}

							{/* ── Customer Found Card ───────────────────────────────────── */}
							{customer && (
								<div className="mb-4 bg-surface-container-low rounded-lg border border-outline-variant p-4">
									<div className="flex items-center justify-between">
										<div>
											<p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Customer</p>
											<p className="text-sm font-medium text-on-surface">{customer.name}</p>
											<p className="text-sm text-on-surface-variant">{customer.phoneNumber}</p>
											{customer.email && <p className="text-sm text-on-surface-variant">{customer.email}</p>}
											{customer.address && <p className="text-sm text-on-surface-variant">{customer.address}</p>}
										</div>
										{customerCreated && (
											<span className="flex items-center gap-1 text-success text-sm font-medium">
												<CheckCircle2 className="w-4 h-4" />
												Created
											</span>
										)}
									</div>
								</div>
							)}

							{/* ── New Customer Form ────────────────────────────────────── */}
							{showNewCustomer && (
								<div className="mb-4 app-card p-5">
									<h4 className="text-base font-semibold text-on-surface mb-4">New Customer</h4>
									<form onSubmit={handleCreateCustomer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1.5">Name <span className="text-error">*</span></label>
											<input required value={newCustomer.name} onChange={(e) => setNewCustomer(p => ({ ...p, name: e.target.value }))} className="form-input" placeholder="Full name" />
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1.5">Phone <span className="text-error">*</span></label>
											<input required value={newCustomer.phone} onChange={(e) => setNewCustomer(p => ({ ...p, phone: e.target.value }))} className="form-input" placeholder="Phone number" />
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1.5">Email</label>
											<input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer(p => ({ ...p, email: e.target.value }))} className="form-input" placeholder="Email (optional)" />
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1.5">Address</label>
											<input value={newCustomer.address} onChange={(e) => setNewCustomer(p => ({ ...p, address: e.target.value }))} className="form-input" placeholder="Address (optional)" />
										</div>
										<div className="md:col-span-2">
											<Button type="submit" disabled={isCreatingCustomer} loading={isCreatingCustomer}>
												{isCreatingCustomer ? 'Creating…' : 'Create Customer'}
											</Button>
										</div>
									</form>
								</div>
							)}

							{/* ── Vehicle Selection ─────────────────────────────────────── */}
							{vehicles.length > 0 && (
								<div className="mb-4">
									<label className="block text-sm font-medium text-on-surface mb-2">Select Vehicle <span className="text-error">*</span></label>
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
										{vehicles.map(v => (
											<div
												key={v.id}
												onClick={() => setSelectedVehicle(v)}
												className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
													selectedVehicle?.id === v.id
														? 'border-secondary bg-secondary/5'
														: 'border-outline-variant hover:border-outline bg-surface-container-low'
												}`}
											>
												<div className="flex items-center gap-3">
													<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
														selectedVehicle?.id === v.id ? 'border-secondary' : 'border-outline-variant'
													}`}>
														{selectedVehicle?.id === v.id && <div className="w-2.5 h-2.5 rounded-full bg-secondary" />}
													</div>
													<div>
														<p className="text-sm font-semibold text-on-surface">{v.registrationNumber.toUpperCase()}</p>
														<p className="text-xs text-on-surface-variant">{v.make} {v.model}</p>
													</div>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* ── Add New Vehicle ──────────────────────────────────────── */}
							{customer && !selectedVehicle && (
								<div>
									<button type="button" onClick={() => setShowNewVehicle(!showNewVehicle)} className="text-sm text-secondary font-medium flex items-center gap-1 hover:underline">
										<Plus className="w-4 h-4" />
										{showNewVehicle ? 'Cancel' : 'Add New Vehicle'}
									</button>
									{showNewVehicle && (
										<form onSubmit={handleCreateVehicle} className="mt-3 app-card p-5">
											<h4 className="text-base font-semibold text-on-surface mb-4">New Vehicle</h4>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<label className="block text-sm font-medium text-on-surface mb-1.5">Registration Number <span className="text-error">*</span></label>
													<input required value={newVehicle.registrationNumber} onChange={(e) => setNewVehicle(p => ({ ...p, registrationNumber: e.target.value.toUpperCase() }))} className="form-input uppercase" placeholder="TN56P1234" />
												</div>
												<div>
													<label className="block text-sm font-medium text-on-surface mb-1.5">Make <span className="text-error">*</span></label>
													<input required value={newVehicle.make} onChange={(e) => setNewVehicle(p => ({ ...p, make: e.target.value }))} className="form-input" placeholder="Maruti" />
												</div>
												<div>
													<label className="block text-sm font-medium text-on-surface mb-1.5">Model <span className="text-error">*</span></label>
													<input required value={newVehicle.model} onChange={(e) => setNewVehicle(p => ({ ...p, model: e.target.value }))} className="form-input" placeholder="Alto 800" />
												</div>
												<div>
													<label className="block text-sm font-medium text-on-surface mb-1.5">Variant</label>
													<input value={newVehicle.variant} onChange={(e) => setNewVehicle(p => ({ ...p, variant: e.target.value }))} className="form-input" placeholder="VXi (optional)" />
												</div>
												<div className="md:col-span-2">
													<Button type="submit" disabled={isCreatingVehicle} loading={isCreatingVehicle}>
														{isCreatingVehicle ? 'Adding…' : 'Add Vehicle'}
													</Button>
												</div>
											</div>
										</form>
									)}
								</div>
							)}
						</div>
					)}

					{/* ══════════════════════════════════════════════════════════════ */}
					{/* STEP 2 — Services */}
					{/* ══════════════════════════════════════════════════════════════ */}
					{step === 1 && (
						<div className="app-card p-5">
							<h3 className="text-base font-semibold text-on-surface mb-4 pb-3 border-b border-outline-variant">Services</h3>

							{/* ── Service Search ────────────────────────────────────────── */}
							<div className="relative mb-4">
								<label className="block text-sm font-medium text-on-surface mb-1.5">Search Services</label>
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
									<input
										ref={searchInputRef}
										type="text"
										value={serviceSearch}
										onChange={(e) => setServiceSearch(e.target.value)}
										placeholder="Search services..."
										className="form-input pl-9"
									/>
								</div>
								{searchResults.length > 0 && (
									<div className="absolute z-20 w-full mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg max-h-60 overflow-y-auto">
										{searchResults.map(svc => (
											<div
												key={svc.id}
												onClick={() => handleAddService(svc)}
												className="px-4 py-3 hover:bg-surface-container-low cursor-pointer border-b border-outline-variant last:border-b-0"
											>
												<div className="flex items-center justify-between">
													<div>
														<p className="text-sm font-medium text-on-surface">{svc.name}</p>
														<p className="text-xs text-on-surface-variant">{svc.category} {svc.taxPercentage > 0 ? `• ${svc.taxPercentage}% tax` : ''}</p>
													</div>
													<span className="text-sm font-semibold text-on-surface">{formatCurrency(svc.price)}</span>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							{/* ── Add New Service ──────────────────────────────────────── */}
							{!showNewService ? (
								<button type="button" onClick={() => setShowNewService(true)} className="text-sm text-secondary font-medium flex items-center gap-1 hover:underline mb-4">
									<Plus className="w-4 h-4" />
									Create New Service
								</button>
							) : (
								<form onSubmit={handleCreateService} className="mb-4 app-card p-5 space-y-4">
									<h4 className="text-base font-semibold text-on-surface">New Service</h4>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1.5">Service Name <span className="text-error">*</span></label>
											<input required value={newService.name} onChange={(e) => setNewService(p => ({ ...p, name: e.target.value }))} className="form-input" placeholder="e.g. Premium Wash" />
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1.5">Category</label>
											<select value={newService.category} onChange={(e) => setNewService(p => ({ ...p, category: e.target.value }))} className="form-input">
												<option value="">Select category</option>
												{serviceCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1.5">Price (₹) <span className="text-error">*</span></label>
											<input required type="number" step="0.01" min="0" value={newService.price} onChange={(e) => setNewService(p => ({ ...p, price: e.target.value }))} className="form-input" placeholder="0.00" />
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1.5">Tax %</label>
											<input type="number" step="0.01" min="0" max="100" value={newService.price ? "18" : ""} readOnly className="form-input bg-surface-container-high" />
										</div>
									</div>
									<div className="flex justify-end gap-3 pt-2">
										<Button type="button" variant="secondary" onClick={() => setShowNewService(false)}>Cancel</Button>
										<Button type="submit" disabled={isCreatingService} loading={isCreatingService}>
											{isCreatingService ? 'Saving…' : 'Save Service'}
										</Button>
									</div>
								</form>
							)}

							{/* ── Selected Services ─────────────────────────────────────── */}
							{services.length > 0 && (
								<div className="space-y-3">
									{services.map(svc => (
										<div key={svc.id} className="flex items-center gap-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant">
											<div className="flex-1">
												<p className="text-sm font-medium text-on-surface">{svc.name}</p>
												<p className="text-xs text-on-surface-variant">{svc.category} {svc.taxPercentage > 0 ? `• ${svc.taxPercentage}% tax` : ''}</p>
											</div>
											<div className="flex items-center gap-2">
												<label className="text-xs text-on-surface-variant">Qty:</label>
												<input type="number" min="1" value={svc.quantity} onChange={(e) => updateQuantity(svc.id, parseInt(e.target.value) || 1)} className="w-16 form-input text-center text-sm py-1" />
											</div>
											<div className="flex items-center gap-2">
												<label className="text-xs text-on-surface-variant">Discount:</label>
												<input type="number" min="0" step="0.01" value={svc.discountAmount} onChange={(e) => updateDiscount(svc.id, parseFloat(e.target.value) || 0)} className="w-20 form-input text-center text-sm py-1" />
											</div>
											<div className="text-right min-w-[80px]">
												<p className="text-sm font-semibold text-on-surface">{formatCurrency(svc.lineTotal)}</p>
											</div>
											<button type="button" onClick={() => removeService(svc.id)} className="p-1 text-on-surface-variant hover:text-error transition-colors">
												<Trash2 className="w-4 h-4" />
											</button>
										</div>
									))}
								</div>
							)}

							{services.length === 0 && (
								<div className="text-center py-8 text-on-surface-variant">
									<Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
									<p className="text-sm">Search and add services above</p>
								</div>
							)}
						</div>
					)}

					{/* ══════════════════════════════════════════════════════════════ */}
					{/* STEP 3 — Review & Summary */}
					{/* ══════════════════════════════════════════════════════════════ */}
					{step === 2 && canProceedToServices && (
						<div className="app-card p-5">
							<h3 className="text-base font-semibold text-on-surface mb-4 pb-3 border-b border-outline-variant">Review & Summary</h3>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
								{/* Customer & Vehicle summary */}
								<div className="app-card p-4">
									<h4 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Customer & Vehicle</h4>
									<div className="grid grid-cols-2 gap-2 text-sm">
										<div className="text-on-surface-variant">Customer:</div><div className="font-medium text-on-surface">{customer?.name}</div>
										<div className="text-on-surface-variant">Phone:</div><div className="font-medium text-on-surface">{customer?.phoneNumber}</div>
										<div className="text-on-surface-variant">Vehicle:</div><div className="font-medium text-on-surface">{selectedVehicle?.registrationNumber?.toUpperCase()}</div>
										<div className="text-on-surface-variant">Make/Model:</div><div className="font-medium text-on-surface">{selectedVehicle?.make} {selectedVehicle?.model}</div>
									</div>
								</div>

								{/* Services summary */}
								<div className="app-card p-4">
									<h4 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Services ({services.length})</h4>
									<div className="space-y-2 max-h-48 overflow-y-auto">
										{services.map(svc => (
											<div key={svc.id} className="flex justify-between text-sm">
												<span className="text-on-surface">{svc.name} (x{svc.quantity})</span>
												<span className="font-medium text-on-surface">{formatCurrency(svc.lineTotal)}</span>
											</div>
										))}
									</div>
								</div>
							</div>

							{/* Totals */}
							<div className="mt-5 app-card p-4">
								<div className="flex justify-between text-sm text-on-surface-variant">
									<span>Items Subtotal ({services.length})</span>
									<span>{formatCurrency(calcSubtotal)}</span>
								</div>
								{calcDiscount > 0 && (
									<div className="flex justify-between text-sm text-on-surface-variant mt-1">
										<span>Discount</span>
										<span>-{formatCurrency(calcDiscount)}</span>
									</div>
								)}
								<div className="flex justify-between text-sm font-semibold text-secondary pt-2 mt-2 border-t border-outline-variant">
									<span>Final Estimate</span>
									<span>{formatCurrency(calcTotal)}</span>
								</div>
							</div>
						</div>
					)}

					{/* ── Error ────────────────────────────────────────────────────── */}
					{submitError && (
						<div className="bg-error-container border border-error rounded-lg p-4 text-error text-sm flex items-center gap-2">
							<X className="w-4 h-4" />
							{submitError}
						</div>
					)}

					{/* ── Navigation ────────────────────────────────────────────────── */}
					<div className="flex justify-between items-center pt-2 pb-6">
						<div>
							{step > 0 && (
								<Button type="button" variant="secondary" onClick={() => { setStep(s => s - 1); setCustomerError(null); }}>
									<ArrowLeft className="w-4 h-4" />
									Back
								</Button>
							)}
						</div>
						<div className="flex gap-3">
							<Button type="button" variant="secondary" onClick={handleReset}>
								Reset
							</Button>
							{step < 2 ? (
								<Button type="button" onClick={() => { if (validateStep()) setStep(s => s + 1); }} size="lg">
									Next
									<ArrowRight className="w-4 h-4" />
								</Button>
							) : (
								<Button type="submit" disabled={!canCreate} loading={isCreatingJobCard} size="lg">
									<CheckCircle2 className="w-4 h-4" />
									{isCreatingJobCard ? 'Creating…' : 'Create Job Card'}
								</Button>
							)}
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
