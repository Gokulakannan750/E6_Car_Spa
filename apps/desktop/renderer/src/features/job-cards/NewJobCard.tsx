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
	type CustomerDto,
	type VehicleDto,
	type ServiceDto,
} from '../../lib/api';
import { mockCustomers } from '../../mock/data/customers';
import { mockVehicles } from '../../mock/data/vehicles';
import { mockServices } from '../../mock/data/services';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
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
	UserPlus,
	CarFront,
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
	const [infoMessage, setInfoMessage] = useState<string | null>(null);

	// ── New customer form ─────────────────────────────────────────────────────
	const [showNewCustomer, setShowNewCustomer] = useState(false);
	const [newCustomer, setNewCustomer] = useState<NewCustomerForm>({ name: '', phone: '', email: '', address: '' });
	const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

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
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const [isCreatingJobCard, setIsCreatingJobCard] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [success, setSuccess] = useState<{ id: string; number: string; customerName: string; vehicleLabel: string; total: number } | null>(null);

	// ── Derived ───────────────────────────────────────────────────────────────
	const calcSubtotal = services.reduce((s, svc) => s + svc.unitPrice * svc.quantity, 0);
	const calcDiscount = services.reduce((s, svc) => s + svc.discountAmount, 0);
	const calcTax = services.reduce((s, svc) => s + (svc.unitPrice * svc.quantity * svc.taxPercentage) / 100, 0);
	const calcTotal = calcSubtotal - calcDiscount + calcTax;
	const canProceedToServices = customer !== null && selectedVehicle !== null;
	const canCreate = canProceedToServices && services.length > 0 && !isCreatingJobCard;

	// ── Load vehicles for a customer ─────────────────────────────────────────
	const loadCustomerAndVehicles = useCallback(async (cust: CustomerDto) => {
		setCustomer(cust);
		setSelectedVehicle(null);
		setVehicles([]);
		setCustomerError(null);
		setInfoMessage(null);

		try {
			const list = await getVehiclesByCustomer(cust.id);
			if (list && list.length > 0) {
				setVehicles(list);
				if (list.length === 1) setSelectedVehicle(list[0]);
				return;
			}
		} catch {
			// Backend offline or error -> check mock vehicles
		}

		// Fallback check in mock vehicles
		const mockVehs = mockVehicles
			.filter((v) => v.customerId === cust.id || cust.id.includes(v.customerId))
			.map((v) => ({
				id: v.id,
				registrationNumber: v.registrationNumber,
				make: v.make,
				model: v.model,
				variant: v.variant || null,
				color: v.color || null,
				customerId: cust.id,
				customerName: cust.name,
				createdAt: v.createdAt,
			}));

		if (mockVehs.length > 0) {
			setVehicles(mockVehs);
			if (mockVehs.length === 1) setSelectedVehicle(mockVehs[0]);
		} else {
			// No vehicles registered yet -> prompt user to add vehicle
			setShowNewVehicle(true);
		}
	}, []);

	// ── Phone lookup ──────────────────────────────────────────────────────────
	const handlePhoneSearch = useCallback(async () => {
		const rawPhone = phone.trim();
		if (!rawPhone) return;
		setIsSearching(true);
		setCustomerError(null);
		setInfoMessage(null);
		setShowNewCustomer(false);

		const cleanPhone = rawPhone.replace(/\D/g, '');

		// 1. Try Live Backend API
		try {
			const result = await getCustomerByPhone(rawPhone);
			if (result && result.name) {
				await loadCustomerAndVehicles(result);
				setIsSearching(false);
				return;
			}
		} catch {
			// API not reachable or 404
		}

		// 2. Check Mock Customer List
		const foundMock = mockCustomers.find(
			(c) => c.phone.replace(/\D/g, '') === cleanPhone || c.phone.includes(rawPhone) || rawPhone.includes(c.phone)
		);

		if (foundMock) {
			const custDto: CustomerDto = {
				id: foundMock.id,
				name: foundMock.name,
				phoneNumber: foundMock.phone,
				email: foundMock.email || null,
				address: foundMock.address || null,
				createdAt: foundMock.createdAt,
			};
			await loadCustomerAndVehicles(custDto);
			setIsSearching(false);
			return;
		}

		// 3. Customer Not Found -> Prompt to Create Customer
		setIsSearching(false);
		setInfoMessage(`No customer found with phone "${rawPhone}". Please enter customer details below to create a new profile.`);
		setNewCustomer({ name: '', phone: rawPhone, email: '', address: '' });
		setShowNewCustomer(true);
	}, [phone, loadCustomerAndVehicles]);

	// ── Registration lookup ───────────────────────────────────────────────────
	const handleRegSearch = useCallback(async () => {
		const rawReg = regNumber.trim().toUpperCase();
		if (!rawReg) return;
		setIsSearching(true);
		setCustomerError(null);
		setInfoMessage(null);
		setShowNewCustomer(false);

		const cleanReg = rawReg.replace(/\s+/g, '');

		// 1. Try Live Backend API
		try {
			const result = await getVehicleByRegistration(rawReg);
			if (result) {
				const custDto: CustomerDto = {
					id: result.customerId,
					name: result.customerName || 'Customer',
					phoneNumber: phone.trim() || '',
					email: null,
					address: null,
					createdAt: result.createdAt,
				};
				await loadCustomerAndVehicles(custDto);
				setSelectedVehicle(result);
				setIsSearching(false);
				return;
			}
		} catch {
			// API not reachable or 404
		}

		// 2. Check Mock Vehicles
		const foundMockVeh = mockVehicles.find(
			(v) => v.registrationNumber.replace(/\s+/g, '').toUpperCase() === cleanReg
		);

		if (foundMockVeh) {
			const foundCust = mockCustomers.find((c) => c.id === foundMockVeh.customerId);
			const custDto: CustomerDto = {
				id: foundCust?.id || foundMockVeh.customerId,
				name: foundCust?.name || 'Customer',
				phoneNumber: foundCust?.phone || phone.trim() || '9876543210',
				email: foundCust?.email || null,
				address: foundCust?.address || null,
				createdAt: foundMockVeh.createdAt,
			};
			await loadCustomerAndVehicles(custDto);
			const vehDto: VehicleDto = {
				id: foundMockVeh.id,
				registrationNumber: foundMockVeh.registrationNumber,
				make: foundMockVeh.make,
				model: foundMockVeh.model,
				variant: foundMockVeh.variant || null,
				color: foundMockVeh.color || null,
				customerId: custDto.id,
				customerName: custDto.name,
				createdAt: foundMockVeh.createdAt,
			};
			setSelectedVehicle(vehDto);
			setIsSearching(false);
			return;
		}

		// 3. Vehicle Not Found -> Prompt to Create Customer & Vehicle
		setIsSearching(false);
		setInfoMessage(`No vehicle found with registration "${rawReg}". Please create a customer and vehicle record below.`);
		setNewVehicle((prev) => ({ ...prev, registrationNumber: rawReg }));
		if (!customer) {
			setNewCustomer({ name: '', phone: phone.trim(), email: '', address: '' });
			setShowNewCustomer(true);
		} else {
			setShowNewVehicle(true);
		}
	}, [regNumber, phone, customer, loadCustomerAndVehicles]);

	// ── Create customer ───────────────────────────────────────────────────────
	const handleCreateCustomer = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
			setCustomerError('Customer name and phone number are required.');
			return;
		}
		setIsCreatingCustomer(true);
		setCustomerError(null);
		setInfoMessage(null);

		try {
			const created = await createCustomer({
				name: newCustomer.name.trim(),
				phoneNumber: newCustomer.phone.trim(),
				email: newCustomer.email || undefined,
				address: newCustomer.address || undefined,
			});
			await loadCustomerAndVehicles(created);
			setShowNewCustomer(false);
			setShowNewVehicle(true);
		} catch {
			// Backend offline fallback -> create in-memory customer
			const localCustomer: CustomerDto = {
				id: 'cust-' + Date.now(),
				name: newCustomer.name.trim(),
				phoneNumber: newCustomer.phone.trim(),
				email: newCustomer.email || null,
				address: newCustomer.address || null,
				createdAt: new Date().toISOString(),
			};
			setCustomer(localCustomer);
			setShowNewCustomer(false);
			setShowNewVehicle(true);
			setVehicles([]);
		} finally {
			setIsCreatingCustomer(false);
		}
	};

	// ── Create vehicle ────────────────────────────────────────────────────────
	const handleCreateVehicle = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!newVehicle.registrationNumber.trim() || !newVehicle.make.trim() || !newVehicle.model.trim() || !customer) {
			setCustomerError('Vehicle registration number, make, and model are required.');
			return;
		}
		setIsCreatingVehicle(true);
		setCustomerError(null);
		setInfoMessage(null);

		const regUpper = newVehicle.registrationNumber.trim().toUpperCase();

		try {
			const created = await createVehicle({
				registrationNumber: regUpper,
				make: newVehicle.make.trim(),
				model: newVehicle.model.trim(),
				variant: newVehicle.variant || undefined,
				customerId: customer.id,
			});
			setVehicles((prev) => [...prev, created]);
			setSelectedVehicle(created);
			setShowNewVehicle(false);
		} catch {
			// Backend offline fallback -> create in-memory vehicle
			const localVehicle: VehicleDto = {
				id: 'veh-' + Date.now(),
				registrationNumber: regUpper,
				make: newVehicle.make.trim(),
				model: newVehicle.model.trim(),
				variant: newVehicle.variant || null,
				color: null,
				customerId: customer.id,
				customerName: customer.name,
				createdAt: new Date().toISOString(),
			};
			setVehicles((prev) => [...prev, localVehicle]);
			setSelectedVehicle(localVehicle);
			setShowNewVehicle(false);
		} finally {
			setIsCreatingVehicle(false);
		}
	};

	// ── Service search (debounced) ────────────────────────────────────────────
	useEffect(() => {
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		if (!serviceSearch.trim()) {
			setSearchResults([]);
			return;
		}
		searchTimerRef.current = setTimeout(async () => {
			const q = serviceSearch.trim().toLowerCase();
			try {
				const result = await getServices({ page: 1, pageSize: 50, search: serviceSearch.trim() });
				if (result && result.items && result.items.length > 0) {
					setSearchResults(result.items);
					return;
				}
			} catch {
				// Backend offline -> search mock services
			}
			const fallback = mockServices.filter(
				(s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
			);
			setSearchResults(
				fallback.map((m) => ({
					id: m.id,
					name: m.name,
					description: m.description,
					category: m.category,
					price: m.basePrice,
					taxPercentage: 18,
					durationMinutes: m.durationMinutes,
					isActive: m.status === 'active',
					createdAt: '2026-08-20T00:00:00Z',
				}))
			);
		}, 200);
		return () => {
			if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		};
	}, [serviceSearch]);

	// Close search dropdown on Escape
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setSearchResults([]);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	// ── Preselect service from Catalogue ───────────────────────────────────────
	useEffect(() => {
		if (!preselectedServiceId) return;
		let cancelled = false;
		(async () => {
			try {
				let svc: ServiceDto | null = null;
				try {
					svc = await getServiceById(preselectedServiceId);
				} catch {
					const mockSvc = mockServices.find((m) => m.id === preselectedServiceId);
					if (mockSvc) {
						svc = {
							id: mockSvc.id,
							name: mockSvc.name,
							description: mockSvc.description,
							category: mockSvc.category,
							price: mockSvc.basePrice,
							taxPercentage: 18,
							durationMinutes: mockSvc.durationMinutes,
							isActive: mockSvc.status === 'active',
							createdAt: '2026-08-20T00:00:00Z',
						};
					}
				}
				if (!cancelled && svc) {
					setServices((prev) => {
						const existing = prev.find((s) => s.serviceId === svc!.id);
						if (existing) {
							return prev.map((s) =>
								s.serviceId === svc!.id
									? { ...s, quantity: s.quantity + 1, lineTotal: s.unitPrice * (s.quantity + 1) - s.discountAmount }
									: s
							);
						}
						return [
							...prev,
							{
								id: crypto.randomUUID(),
								serviceId: svc!.id,
								name: svc!.name,
								category: svc!.category,
								unitPrice: svc!.price,
								quantity: 1,
								taxPercentage: svc!.taxPercentage,
								discountAmount: 0,
								lineTotal: svc!.price,
							},
						];
					});
					navigate('/job-cards/new', { replace: true, state: {} });
				}
			} catch {
				// Ignore
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [preselectedServiceId, navigate]);

	// ── Add service ───────────────────────────────────────────────────────────
	const handleAddService = (svc: ServiceDto) => {
		const existing = services.find((s) => s.serviceId === svc.id);
		if (existing) {
			setServices((prev) =>
				prev.map((s) =>
					s.serviceId === svc.id
						? { ...s, quantity: s.quantity + 1, lineTotal: s.unitPrice * (s.quantity + 1) - s.discountAmount }
						: s
				)
			);
		} else {
			setServices((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					serviceId: svc.id,
					name: svc.name,
					category: svc.category,
					unitPrice: svc.price,
					quantity: 1,
					taxPercentage: svc.taxPercentage,
					discountAmount: 0,
					lineTotal: svc.price,
				},
			]);
		}
		setServiceSearch('');
		setSearchResults([]);
		searchInputRef.current?.focus();
	};

	// ── Create new service ────────────────────────────────────────────────────
	const handleCreateService = async () => {
		if (!newService.name.trim() || !newService.price) return;
		setIsCreatingService(true);
		try {
			const created = await createService({
				name: newService.name.trim(),
				category: newService.category || 'Exterior Detailing',
				price: parseFloat(newService.price),
				taxPercentage: 18,
				description: newService.description || undefined,
				isActive: newService.isActive,
			});
			handleAddService(created);
		} catch {
			const localSvc: ServiceDto = {
				id: 'svc-' + Date.now(),
				name: newService.name.trim(),
				category: newService.category || 'Exterior Detailing',
				description: newService.description || null,
				price: parseFloat(newService.price),
				taxPercentage: 18,
				durationMinutes: parseInt(newService.durationMinutes) || 60,
				isActive: true,
				createdAt: new Date().toISOString(),
			};
			handleAddService(localSvc);
		} finally {
			setShowNewService(false);
			setNewService({ name: '', category: '', description: '', durationMinutes: '', price: '', isActive: true });
			setIsCreatingService(false);
		}
	};

	// ── Update/remove services ────────────────────────────────────────────────
	const updateQuantity = (id: string, quantity: number) => {
		if (quantity < 1) return;
		setServices((prev) =>
			prev.map((s) => (s.id === id ? { ...s, quantity, lineTotal: s.unitPrice * quantity } : s))
		);
	};

	const removeService = (id: string) => setServices((prev) => prev.filter((s) => s.id !== id));

	// ── Create job card ───────────────────────────────────────────────────────
	const handleCreateJobCard = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!customer || !selectedVehicle || services.length === 0) return;
		setIsCreatingJobCard(true);
		setSubmitError(null);
		try {
			const result = await createJobCard({
				customerId: customer.id,
				vehicleId: selectedVehicle.id,
				services: services.map((s) => ({
					serviceId: s.serviceId,
					quantity: s.quantity,
					discountAmount: s.discountAmount,
				})),
				notes: undefined,
				isGstEnabled: true,
			});
			setSuccess({
				id: result.id,
				number: result.jobCardNumber,
				customerName: customer.name,
				vehicleLabel: `${selectedVehicle.registrationNumber} — ${selectedVehicle.make} ${selectedVehicle.model}`,
				total: result.totalAmount,
			});
		} catch (err) {
			console.warn('Backend unavailable, creating job card locally:', err);
			const localJobCardNumber = `JC-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 900000))}`;
			setSuccess({
				id: 'jc-' + Date.now(),
				number: localJobCardNumber,
				customerName: customer.name,
				vehicleLabel: `${selectedVehicle.registrationNumber} — ${selectedVehicle.make} ${selectedVehicle.model}`,
				total: calcTotal,
			});
		} finally {
			setIsCreatingJobCard(false);
		}
	};

	// ── Reset ─────────────────────────────────────────────────────────────────
	const handleReset = () => {
		setPhone('');
		setRegNumber('');
		setCustomer(null);
		setVehicles([]);
		setSelectedVehicle(null);
		setServices([]);
		setServiceSearch('');
		setSearchResults([]);
		setShowNewCustomer(false);
		setShowNewVehicle(false);
		setShowNewService(false);
		setNewCustomer({ name: '', phone: '', email: '', address: '' });
		setNewVehicle({ registrationNumber: '', make: '', model: '', variant: '' });
		setNewService({ name: '', category: '', description: '', durationMinutes: '', price: '', isActive: true });
		setStep(0);
		setCustomerError(null);
		setInfoMessage(null);
		setSubmitError(null);
		setSuccess(null);
	};

	// ── Step validation ───────────────────────────────────────────────────────
	const validateStep = (): boolean => {
		if (step === 0) {
			if (!customer) {
				setCustomerError('Please search for an existing customer by phone or click "+ Create New Customer".');
				return false;
			}
			if (!selectedVehicle) {
				setCustomerError('Please select or add a vehicle for this customer.');
				return false;
			}
		}
		if (step === 1 && services.length === 0) {
			setCustomerError('Add at least one service to create a job card.');
			return false;
		}
		setCustomerError(null);
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
				<div className="flex-1 flex items-center justify-center p-6">
					<div className="text-center max-w-md w-full app-card p-6 shadow-elevation-2">
						<div className="w-16 h-16 rounded-full bg-success-container flex items-center justify-center mx-auto mb-4">
							<CheckCircle2 className="w-8 h-8 text-success" />
						</div>
						<h2 className="text-xl font-bold text-on-surface mb-1">Job Card Created!</h2>
						<p className="text-sm text-on-surface-variant mb-5">
							Job Card <span className="font-semibold text-secondary font-mono">{success.number}</span> has been generated successfully.
						</p>
						<div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 mb-6 text-left space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-on-surface-variant">Customer</span>
								<span className="font-medium text-on-surface">{success.customerName}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-on-surface-variant">Vehicle</span>
								<span className="font-medium text-on-surface">{success.vehicleLabel}</span>
							</div>
							<div className="flex justify-between pt-2 border-t border-outline-variant/60">
								<span className="text-on-surface-variant font-medium">Total Amount</span>
								<span className="font-bold text-secondary text-base">{formatCurrency(success.total)}</span>
							</div>
						</div>
						<div className="flex gap-3">
							<Button variant="secondary" onClick={() => window.print()} className="flex-1">
								Print
							</Button>
							<Button onClick={() => navigate('/job-cards')} className="flex-1">
								View All Job Cards
							</Button>
						</div>
						<button
							onClick={handleReset}
							className="mt-4 text-sm text-secondary hover:underline font-medium block mx-auto"
						>
							Create Another Job Card
						</button>
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
				<div>
					<button
						type="button"
						onClick={() => navigate('/job-cards')}
						className="inline-flex items-center text-xs font-semibold text-on-surface-variant hover:text-secondary mb-2 transition-colors cursor-pointer"
					>
						<ArrowLeft className="w-3.5 h-3.5 mr-1" />
						Back to Job Cards
					</button>
					<h1 className="text-2xl font-semibold text-on-surface tracking-tight">New Job Card</h1>
					<p className="text-sm text-on-surface-variant mt-0.5">Create a service job card for a customer vehicle</p>
				</div>
			</div>

			{/* ── Stepper ────────────────────────────────────────────────────── */}
			<div className="px-6 pt-5">
				<div className="flex items-center max-w-4xl mx-auto">
					{STEPS.map((label, i) => {
						const isCompleted = step > i;
						const isActive = step === i;
						return (
							<div key={label} className="flex items-center flex-1">
								<div className="flex flex-col items-center">
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
											isCompleted || isActive
												? 'bg-secondary text-white shadow-sm'
												: 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
										}`}
									>
										{isCompleted ? <Check className="w-4 h-4" /> : i + 1}
									</div>
									<span
										className={`text-xs mt-1.5 whitespace-nowrap transition-colors ${
											isCompleted || isActive ? 'text-secondary font-semibold' : 'text-on-surface-variant'
										}`}
									>
										{label}
									</span>
								</div>
								{i < STEPS.length - 1 && (
									<div
										className={`flex-1 h-[2px] mx-3 transition-colors ${
											isCompleted ? 'bg-secondary' : 'bg-outline-variant'
										}`}
									/>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* ── Scrollable Content ─────────────────────────────────────────── */}
			<div className="flex-1 overflow-y-auto px-6 py-5">
				<div className="max-w-4xl mx-auto space-y-5">
					{/* ══════════════════════════════════════════════════════════════ */}
					{/* STEP 1 — Customer & Vehicle */}
					{/* ══════════════════════════════════════════════════════════════ */}
					{step === 0 && (
						<div className="app-card p-6 space-y-5">
							<div className="flex items-center justify-between pb-3 border-b border-outline-variant">
								<div>
									<h3 className="text-base font-semibold text-on-surface">Customer &amp; Vehicle Information</h3>
									<p className="text-xs text-on-surface-variant mt-0.5">
										Search by phone number or vehicle registration number to look up records
									</p>
								</div>
								{!customer && !showNewCustomer && (
									<Button
										variant="secondary"
										size="sm"
										icon={<UserPlus className="w-3.5 h-3.5" />}
										onClick={() => {
											setNewCustomer({ name: '', phone: phone.trim(), email: '', address: '' });
											setShowNewCustomer(true);
											setCustomerError(null);
											setInfoMessage(null);
										}}
									>
										New Customer
									</Button>
								)}
							</div>

							{/* ── Lookup Row ───────────────────────────────────────────── */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Phone lookup */}
								<div>
									<label className="block text-sm font-medium text-on-surface mb-1.5">
										Phone Number <span className="text-error">*</span>
									</label>
									<div className="flex gap-2">
										<div className="flex-1 relative">
											<User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
											<input
												type="tel"
												value={phone}
												onChange={(e) => setPhone(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handlePhoneSearch())}
												placeholder="e.g., 9876543210"
												className="form-input pl-9 w-full"
											/>
										</div>
										<Button
											type="button"
											onClick={handlePhoneSearch}
											disabled={!phone.trim() || isSearching}
											variant="secondary"
										>
											{isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
											Search
										</Button>
									</div>
								</div>

								{/* Registration lookup */}
								<div>
									<label className="block text-sm font-medium text-on-surface mb-1.5">
										Vehicle Registration Number
									</label>
									<div className="flex gap-2">
										<div className="flex-1 relative">
											<Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
											<input
												type="text"
												value={regNumber}
												onChange={(e) => setRegNumber(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRegSearch())}
												placeholder="e.g., TN56P1234"
												className="form-input pl-9 uppercase w-full"
											/>
										</div>
										<Button
											type="button"
											onClick={handleRegSearch}
											disabled={!regNumber.trim() || isSearching}
											variant="secondary"
										>
											<Search className="w-4 h-4" />
											Search
										</Button>
									</div>
								</div>
							</div>

							{/* ── Info / Notice Banner ──────────────────────────────────── */}
							{infoMessage && (
								<div className="bg-secondary/10 border border-secondary/30 rounded-lg p-3 text-secondary text-sm flex items-start gap-2.5">
									<UserPlus className="w-4 h-4 mt-0.5 shrink-0" />
									<div className="flex-1">
										<p className="font-medium">{infoMessage}</p>
									</div>
								</div>
							)}

							{/* ── Error Banner ─────────────────────────────────────────── */}
							{customerError && (
								<div className="bg-error/10 border border-error/30 rounded-lg p-3 text-error text-sm flex items-center gap-2">
									<X className="w-4 h-4 shrink-0" />
									<span>{customerError}</span>
								</div>
							)}

							{/* ── Customer Found / Selected Card ────────────────────────── */}
							{customer && (
								<div className="bg-surface-container-low rounded-lg border border-outline-variant p-4">
									<div className="flex items-start justify-between">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-sm shrink-0">
												{customer.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'CU'}
											</div>
											<div>
												<div className="flex items-center gap-2">
													<p className="font-semibold text-on-surface">{customer.name}</p>
													<span className="text-xs bg-success-container text-success font-medium px-2 py-0.5 rounded">
														Customer Selected
													</span>
												</div>
												<p className="text-sm font-mono text-on-surface-variant mt-0.5">{customer.phoneNumber}</p>
												{customer.email && <p className="text-xs text-on-surface-variant">{customer.email}</p>}
												{customer.address && <p className="text-xs text-on-surface-variant">{customer.address}</p>}
											</div>
										</div>
										<button
											type="button"
											onClick={() => {
												setCustomer(null);
												setSelectedVehicle(null);
												setVehicles([]);
											}}
											className="text-xs text-secondary hover:underline font-medium"
										>
											Change Customer
										</button>
									</div>
								</div>
							)}

							{/* ── New Customer Form (Inline) ────────────────────────────── */}
							{showNewCustomer && (
								<div className="app-card p-5 bg-white border-2 border-secondary/30 rounded-xl space-y-4">
									<div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
										<div className="flex items-center gap-2">
											<UserPlus className="w-4 h-4 text-secondary" />
											<h4 className="text-sm font-semibold text-on-surface">Create New Customer Profile</h4>
										</div>
										<button
											type="button"
											onClick={() => setShowNewCustomer(false)}
											className="text-xs text-on-surface-variant hover:text-on-surface"
										>
											Cancel
										</button>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1">
												Full Name <span className="text-error">*</span>
											</label>
											<input
												required
												value={newCustomer.name}
												onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
												className="form-input w-full"
												placeholder="e.g. Rahul Sharma"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1">
												Phone Number <span className="text-error">*</span>
											</label>
											<input
												required
												value={newCustomer.phone}
												onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
												className="form-input w-full"
												placeholder="e.g. 9876543210"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1">Email Address</label>
											<input
												type="email"
												value={newCustomer.email}
												onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
												className="form-input w-full"
												placeholder="customer@email.com (optional)"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1">Address</label>
											<input
												value={newCustomer.address}
												onChange={(e) => setNewCustomer((p) => ({ ...p, address: e.target.value }))}
												className="form-input w-full"
												placeholder="City or residential address (optional)"
											/>
										</div>
									</div>

									<div className="flex justify-end gap-2 pt-2">
										<Button type="button" variant="secondary" onClick={() => setShowNewCustomer(false)}>
											Cancel
										</Button>
										<Button
											type="button"
											onClick={() => handleCreateCustomer()}
											disabled={isCreatingCustomer || !newCustomer.name.trim() || !newCustomer.phone.trim()}
											loading={isCreatingCustomer}
										>
											Save &amp; Select Customer
										</Button>
									</div>
								</div>
							)}

							{/* ── Vehicle Selection ─────────────────────────────────────── */}
							{customer && (
								<div className="space-y-3 pt-2">
									<div className="flex items-center justify-between">
										<label className="block text-sm font-semibold text-on-surface">
											Select Vehicle <span className="text-error">*</span>
										</label>
										{!showNewVehicle && (
											<button
												type="button"
												onClick={() => setShowNewVehicle(true)}
												className="text-xs text-secondary font-medium flex items-center gap-1 hover:underline"
											>
												<Plus className="w-3.5 h-3.5" />
												Add New Vehicle
											</button>
										)}
									</div>

									{vehicles.length > 0 && (
										<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
											{vehicles.map((v) => (
												<div
													key={v.id}
													onClick={() => setSelectedVehicle(v)}
													className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
														selectedVehicle?.id === v.id
															? 'border-secondary bg-secondary/5 shadow-sm'
															: 'border-outline-variant hover:border-outline bg-surface-container-low'
													}`}
												>
													<div className="flex items-center gap-3">
														<div
															className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
																selectedVehicle?.id === v.id ? 'border-secondary' : 'border-outline'
															}`}
														>
															{selectedVehicle?.id === v.id && (
																<div className="w-2.5 h-2.5 rounded-full bg-secondary" />
															)}
														</div>
														<div>
															<p className="text-sm font-bold text-on-surface font-mono">
																{v.registrationNumber.toUpperCase()}
															</p>
															<p className="text-xs text-on-surface-variant">
																{v.make} {v.model} {v.variant ? `(${v.variant})` : ''}
															</p>
														</div>
													</div>
												</div>
											))}
										</div>
									)}

									{/* ── Add New Vehicle Form (Inline) ────────────────────────── */}
									{showNewVehicle && (
										<div className="app-card p-5 bg-white border-2 border-secondary/30 rounded-xl space-y-4 mt-2">
											<div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
												<div className="flex items-center gap-2">
													<CarFront className="w-4 h-4 text-secondary" />
													<h4 className="text-sm font-semibold text-on-surface">Add Vehicle for {customer.name}</h4>
												</div>
												{vehicles.length > 0 && (
													<button
														type="button"
														onClick={() => setShowNewVehicle(false)}
														className="text-xs text-on-surface-variant hover:text-on-surface"
													>
														Cancel
													</button>
												)}
											</div>

											<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
												<div>
													<label className="block text-sm font-medium text-on-surface mb-1">
														Registration No. <span className="text-error">*</span>
													</label>
													<input
														required
														value={newVehicle.registrationNumber}
														onChange={(e) =>
															setNewVehicle((p) => ({ ...p, registrationNumber: e.target.value.toUpperCase() }))
														}
														className="form-input w-full uppercase font-mono"
														placeholder="e.g. TN56P1234"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-on-surface mb-1">
														Make <span className="text-error">*</span>
													</label>
													<input
														required
														value={newVehicle.make}
														onChange={(e) => setNewVehicle((p) => ({ ...p, make: e.target.value }))}
														className="form-input w-full"
														placeholder="e.g. Maruti / Hyundai"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-on-surface mb-1">
														Model <span className="text-error">*</span>
													</label>
													<input
														required
														value={newVehicle.model}
														onChange={(e) => setNewVehicle((p) => ({ ...p, model: e.target.value }))}
														className="form-input w-full"
														placeholder="e.g. Swift / Creta"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-on-surface mb-1">Variant</label>
													<input
														value={newVehicle.variant}
														onChange={(e) => setNewVehicle((p) => ({ ...p, variant: e.target.value }))}
														className="form-input w-full"
														placeholder="e.g. VXi / SX (optional)"
													/>
												</div>
											</div>

											<div className="flex justify-end gap-2 pt-2">
												{vehicles.length > 0 && (
													<Button type="button" variant="secondary" onClick={() => setShowNewVehicle(false)}>
														Cancel
													</Button>
												)}
												<Button
													type="button"
													onClick={() => handleCreateVehicle()}
													disabled={isCreatingVehicle || !newVehicle.registrationNumber.trim() || !newVehicle.make.trim()}
													loading={isCreatingVehicle}
												>
													Save &amp; Select Vehicle
												</Button>
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					)}

					{/* ══════════════════════════════════════════════════════════════ */}
					{/* STEP 2 — Services */}
					{/* ══════════════════════════════════════════════════════════════ */}
					{step === 1 && (
						<div className="app-card p-6 space-y-5">
							<div className="flex items-center justify-between pb-3 border-b border-outline-variant">
								<div>
									<h3 className="text-base font-semibold text-on-surface">Select Services</h3>
									<p className="text-xs text-on-surface-variant mt-0.5">
										Search and add detailing, washing, and protection services to this job card
									</p>
								</div>
								<Button
									variant="secondary"
									size="sm"
									icon={<Plus className="w-3.5 h-3.5" />}
									onClick={() => setShowNewService(true)}
								>
									Add Custom Service
								</Button>
							</div>

							{/* ── Service Search ────────────────────────────────────────── */}
							<div className="relative">
								<div className="relative">
									<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
									<input
										ref={searchInputRef}
										type="text"
										value={serviceSearch}
										onChange={(e) => setServiceSearch(e.target.value)}
										placeholder="Search services (e.g. Foam Wash, Ceramic Coating, Interior Detail)..."
										className="form-input pl-10 pr-4 py-2.5 w-full bg-white shadow-sm"
									/>
								</div>

								{/* Dropdown Results */}
								{searchResults.length > 0 && (
									<div className="absolute z-20 w-full mt-1.5 bg-white border border-outline-variant rounded-xl shadow-elevation-2 max-h-72 overflow-y-auto">
										{searchResults.map((svc) => (
											<div
												key={svc.id}
												onClick={() => handleAddService(svc)}
												className="px-4 py-3 hover:bg-surface-container-low cursor-pointer border-b border-outline-variant/60 last:border-b-0 flex items-center justify-between transition-colors"
											>
												<div>
													<p className="text-sm font-semibold text-on-surface">{svc.name}</p>
													<p className="text-xs text-on-surface-variant">
														<span className="text-secondary font-medium">{svc.category || 'General'}</span>
														{svc.durationMinutes ? ` · ${svc.durationMinutes} min` : ''}
													</p>
												</div>
												<div className="text-right">
													<span className="text-sm font-bold text-secondary">{formatCurrency(svc.price)}</span>
													<p className="text-[11px] text-on-surface-variant">+ Add</p>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							{/* ── Add Custom Service Dialog Popup ──────────────────────── */}
							<Dialog
								open={showNewService}
								onOpenChange={(open) => {
									setShowNewService(open);
									if (!open) {
										setNewService({ name: '', category: 'Exterior Detailing', description: '', durationMinutes: '60', price: '', isActive: true });
									}
								}}
								title="Add Custom / Quick Service"
								description="Create and add a custom service to this job card"
								size="md"
								footer={
									<>
										<Button
											type="button"
											variant="secondary"
											onClick={() => {
												setShowNewService(false);
												setNewService({ name: '', category: 'Exterior Detailing', description: '', durationMinutes: '60', price: '', isActive: true });
											}}
										>
											Cancel
										</Button>
										<Button
											type="button"
											onClick={() => handleCreateService()}
											disabled={isCreatingService || !newService.name.trim() || !newService.price}
											loading={isCreatingService}
										>
											Add to Selected Services
										</Button>
									</>
								}
							>
								<div className="space-y-4 py-1">
									<div>
										<label className="block text-sm font-medium text-on-surface mb-1">
											Service Name <span className="text-error">*</span>
										</label>
										<input
											required
											value={newService.name}
											onChange={(e) => setNewService((p) => ({ ...p, name: e.target.value }))}
											className="form-input w-full"
											placeholder="e.g. Custom Scratch Removal"
											autoFocus
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-on-surface mb-1">Category</label>
										<select
											value={newService.category || 'Exterior Detailing'}
											onChange={(e) => setNewService((p) => ({ ...p, category: e.target.value }))}
											className="form-input w-full"
										>
											<option value="Exterior Detailing">Exterior Detailing</option>
											<option value="Interior Care">Interior Care</option>
											<option value="Protection Packages">Protection Packages</option>
											<option value="Others">Others</option>
										</select>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1">
												Price (₹) <span className="text-error">*</span>
											</label>
											<input
												required
												type="number"
												step="0.01"
												min="0"
												value={newService.price}
												onChange={(e) => setNewService((p) => ({ ...p, price: e.target.value }))}
												className="form-input w-full"
												placeholder="0.00"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-on-surface mb-1">Duration (min)</label>
											<input
												type="number"
												min="0"
												value={newService.durationMinutes}
												onChange={(e) => setNewService((p) => ({ ...p, durationMinutes: e.target.value }))}
												className="form-input w-full"
												placeholder="60"
											/>
										</div>
									</div>
								</div>
							</Dialog>

							{/* ── Selected Services Table ────────────────────────────────── */}
							{services.length > 0 && (
								<div className="space-y-3 pt-2">
									<div className="flex items-center justify-between">
										<label className="block text-sm font-semibold text-on-surface">
											Selected Services ({services.length})
										</label>
										<span className="text-xs text-on-surface-variant font-medium">
											Subtotal:{' '}
											<strong className="text-secondary font-mono text-sm">
												{formatCurrency(calcSubtotal)}
											</strong>
										</span>
									</div>

									<div className="app-card overflow-hidden">
										<div className="overflow-x-auto">
											<table className="app-table">
												<thead>
													<tr>
														<th className="w-12 text-center">#</th>
														<th>Service</th>
														<th>Category</th>
														<th className="text-right">Unit Price</th>
														<th className="text-center w-36">Quantity</th>
														<th className="text-right">Total</th>
														<th className="text-right w-16">Action</th>
													</tr>
												</thead>
												<tbody>
													{services.map((svc, idx) => (
														<tr key={svc.id} className="hover:bg-surface-container-low/40 transition-colors">
															<td className="py-3.5 px-4 text-xs text-on-surface-variant font-mono text-center">
																{idx + 1}
															</td>
															<td className="py-3.5 px-4">
																<p className="font-semibold text-on-surface">{svc.name}</p>
															</td>
															<td className="py-3.5 px-4 text-xs">
																<span className="inline-block px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant font-medium">
																	{svc.category || 'General'}
																</span>
															</td>
															<td className="py-3.5 px-4 text-right font-medium text-on-surface">
																{formatCurrency(svc.unitPrice)}
															</td>
															<td className="py-3.5 px-4 text-center">
																<div className="inline-flex items-center justify-center gap-1.5 bg-surface-container-low border border-outline-variant rounded-lg p-0.5">
																	<button
																		type="button"
																		onClick={() => updateQuantity(svc.id, Math.max(1, svc.quantity - 1))}
																		className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-container font-semibold text-on-surface transition-colors disabled:opacity-40"
																		disabled={svc.quantity <= 1}
																		title="Decrease"
																	>
																		-
																	</button>
																	<input
																		type="number"
																		min="1"
																		value={svc.quantity}
																		onChange={(e) => updateQuantity(svc.id, parseInt(e.target.value) || 1)}
																		className="w-10 text-center font-bold text-sm bg-transparent border-0 focus:outline-none p-0"
																	/>
																	<button
																		type="button"
																		onClick={() => updateQuantity(svc.id, svc.quantity + 1)}
																		className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-container font-semibold text-on-surface transition-colors"
																		title="Increase"
																	>
																		+
																	</button>
																</div>
															</td>
															<td className="py-3.5 px-4 text-right font-bold text-secondary">
																{formatCurrency(svc.unitPrice * svc.quantity)}
															</td>
															<td className="py-3.5 px-4 text-right">
																<button
																	type="button"
																	onClick={() => removeService(svc.id)}
																	className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors inline-flex items-center justify-center"
																	title="Remove Service"
																>
																	<Trash2 className="w-4 h-4" />
																</button>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							)}

							{services.length === 0 && (
								<div className="text-center py-10 text-on-surface-variant app-card p-6 bg-surface-container-low/50">
									<Plus className="w-8 h-8 mx-auto mb-2 opacity-50 text-secondary" />
									<p className="text-sm font-medium text-on-surface">No services added yet</p>
									<p className="text-xs text-on-surface-variant mt-0.5">Use the search box above to add services</p>
								</div>
							)}
						</div>
					)}

					{/* ══════════════════════════════════════════════════════════════ */}
					{/* STEP 3 — Review & Summary */}
					{/* ══════════════════════════════════════════════════════════════ */}
					{step === 2 && canProceedToServices && (
						<div className="app-card p-6 space-y-5">
							<div className="pb-3 border-b border-outline-variant">
								<h3 className="text-base font-semibold text-on-surface">Review &amp; Summary</h3>
								<p className="text-xs text-on-surface-variant mt-0.5">Verify customer, vehicle, and service charges before creating</p>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
								{/* Customer & Vehicle summary */}
								<div className="app-card p-4 bg-surface-container-low/60">
									<h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
										Customer &amp; Vehicle
									</h4>
									<div className="space-y-2 text-sm">
										<div className="flex justify-between">
											<span className="text-on-surface-variant">Customer:</span>
											<span className="font-semibold text-on-surface">{customer?.name}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-on-surface-variant">Phone:</span>
											<span className="font-mono text-on-surface">{customer?.phoneNumber}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-on-surface-variant">Vehicle Reg:</span>
											<span className="font-mono font-bold text-secondary">{selectedVehicle?.registrationNumber?.toUpperCase()}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-on-surface-variant">Make &amp; Model:</span>
											<span className="font-medium text-on-surface">
												{selectedVehicle?.make} {selectedVehicle?.model}
											</span>
										</div>
									</div>
								</div>

								{/* Services summary */}
								<div className="app-card p-4 bg-surface-container-low/60">
									<h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
										Services ({services.length})
									</h4>
									<div className="space-y-2 max-h-48 overflow-y-auto pr-1">
										{services.map((svc) => (
											<div key={svc.id} className="flex justify-between text-sm">
												<span className="text-on-surface">
													{svc.name} {svc.quantity > 1 ? `(x${svc.quantity})` : ''}
												</span>
												<span className="font-semibold text-on-surface">{formatCurrency(svc.lineTotal)}</span>
											</div>
										))}
									</div>
								</div>
							</div>

							{/* Totals */}
							<div className="app-card p-4 bg-white border-2 border-outline-variant/60">
								<div className="space-y-1.5 text-sm">
									<div className="flex justify-between text-on-surface-variant">
										<span>Items Subtotal ({services.length} items)</span>
										<span>{formatCurrency(calcSubtotal)}</span>
									</div>
									{calcDiscount > 0 && (
										<div className="flex justify-between text-success">
											<span>Discount</span>
											<span>-{formatCurrency(calcDiscount)}</span>
										</div>
									)}
									{calcTax > 0 && (
										<div className="flex justify-between text-on-surface-variant">
											<span>Estimated GST (18%)</span>
											<span>{formatCurrency(calcTax)}</span>
										</div>
									)}
									<div className="flex justify-between text-base font-bold text-secondary pt-2.5 mt-1.5 border-t border-outline-variant">
										<span>Final Total Estimate</span>
										<span>{formatCurrency(calcTotal)}</span>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* ── Error Banner ─────────────────────────────────────────── */}
					{submitError && (
						<div className="bg-error/10 border border-error/30 rounded-lg p-4 text-error text-sm flex items-center gap-2">
							<X className="w-4 h-4 shrink-0" />
							<span>{submitError}</span>
						</div>
					)}

					{/* ── Navigation Buttons ────────────────────────────────────── */}
					<div className="flex justify-between items-center pt-2 pb-6">
						<div>
							{step > 0 && (
								<Button
									type="button"
									variant="secondary"
									onClick={() => {
										setStep((s) => s - 1);
										setCustomerError(null);
									}}
								>
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
								<Button
									type="button"
									onClick={() => {
										if (validateStep()) setStep((s) => s + 1);
									}}
									size="lg"
								>
									Next
									<ArrowRight className="w-4 h-4" />
								</Button>
							) : (
								<Button
									type="button"
									onClick={() => handleCreateJobCard()}
									disabled={!canCreate || isCreatingJobCard}
									loading={isCreatingJobCard}
									size="lg"
								>
									<CheckCircle2 className="w-4 h-4" />
									{isCreatingJobCard ? 'Creating…' : 'Create Job Card'}
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
