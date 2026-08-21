import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 getCustomerByPhone,
 getCustomerByRegistration,
 createCustomer,
 getVehiclesByCustomer,
 createVehicle,
 getCatalogueServices,
 createJobCard,
 ApiError,
 type CustomerDto,
 type VehicleDto,
 type CreateJobCardInput,
} from '../../lib/api';
import PhoneInput from '../../components/PhoneInput';

interface ServiceItem {
 id: string;
 name: string;
 category: string;
 unitPrice: number;
 quantity: number;
 taxPercentage: number;
 discountAmount: number;
 lineTotal: number;
}

function formatCurrency(amount: number) {
 return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function NewJobCard() {
 const navigate = useNavigate();
 const [phone, setPhone] = useState('');
 const [regNumber, setRegNumber] = useState('');
 const [customer, setCustomer] = useState<CustomerDto | null>(null);
 const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
 const [selectedVehicle, setSelectedVehicle] = useState<VehicleDto | null>(null);
 const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
 const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
 const [customerError, setCustomerError] = useState<string | null>(null);

 const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
 const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
 const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

 const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
 const [newVehicle, setNewVehicle] = useState({ registrationNumber: '', make: '', model: '', color: '' });
 const [isCreatingVehicle, setIsCreatingVehicle] = useState(false);

 const [services, setServices] = useState<ServiceItem[]>([]);
 const [serviceSearch, setServiceSearch] = useState('');
 const [searchResults, setSearchResults] = useState<{ id: string; name: string; category: string; basePrice: number }[]>([]);
 const [isSearchingServices, setIsSearchingServices] = useState(false);
 const [showNewServiceForm, setShowNewServiceForm] = useState(false);
 const [newService, setNewService] = useState({ name: '', category: '', basePrice: 0 });
 const [isCreatingService, setIsCreatingService] = useState(false);
 const [serviceCategories, setServiceCategories] = useState<string[]>([]);
 const [isLoadingCategories, setIsLoadingCategories] = useState(false);

 const [isCreatingJobCard, setIsCreatingJobCard] = useState(false);
 const [isGstEnabled, setIsGstEnabled] = useState(true);
 const [isPrinting, setIsPrinting] = useState(false);
 const [success, setSuccess] = useState<{ id: string; number: string; customer: string; vehicle: string; total: number } | null>(null);
 const [submitError, setSubmitError] = useState<string | null>(null);

 const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const searchInputRef = useRef<HTMLInputElement>(null);

 const calcSubtotal = services.reduce((s, svc) => s + svc.unitPrice * svc.quantity, 0);
 const calcDiscount = services.reduce((s, svc) => s + svc.discountAmount, 0);
 const calcTax = isGstEnabled
 ? services.reduce((s, svc) => s + svc.unitPrice * svc.quantity * svc.taxPercentage / 100, 0)
 : 0;
 const calcTotal = calcSubtotal - calcDiscount + calcTax;

 const canCreate = customer && selectedVehicle && services.length > 0 && !isCreatingJobCard;

 // ── Shared: load customer + vehicles ────────────────────────────────────────
 const loadCustomerAndVehicles = useCallback(async (cust: CustomerDto) => {
 setCustomer(cust);
 setIsLoadingVehicles(true);
 try {
 const vehicleList = await getVehiclesByCustomer(cust.id);
 setVehicles(vehicleList);
 if (vehicleList.length === 1) {
 setSelectedVehicle(vehicleList[0]);
 }
 } catch {
 } finally {
 setIsLoadingVehicles(false);
 }
 }, []);

 // ── Customer Lookup ─────────────────────────────────────────────────────────
 const handlePhoneSearch = useCallback(async () => {
 if (!phone.trim()) return;
 setIsSearchingCustomer(true);
 setCustomerError(null);
 setCustomer(null);
 setSelectedVehicle(null);
 setVehicles([]);
 setShowNewCustomerForm(false);
 setShowNewVehicleForm(false);

 try {
 const result = await getCustomerByPhone(phone.trim());
 await loadCustomerAndVehicles(result);
 setNewCustomer(prev => ({ ...prev, phone: phone.trim() }));
 } catch (err) {
 if (err instanceof ApiError && err.status === 404) {
 setCustomerError('Customer not found. Please create a new customer.');
 setShowNewCustomerForm(true);
 setNewCustomer(prev => ({ ...prev, phone: phone.trim() }));
 } else {
 setCustomerError(err instanceof Error ? err.message : 'Failed to search customer');
 }
 } finally {
 setIsSearchingCustomer(false);
 }
 }, [phone, loadCustomerAndVehicles]);

 const handleRegistrationSearch = useCallback(async () => {
 if (!regNumber.trim()) return;
 setIsSearchingCustomer(true);
 setCustomerError(null);
 setCustomer(null);
 setSelectedVehicle(null);
 setVehicles([]);
 setShowNewCustomerForm(false);
 setShowNewVehicleForm(false);

 try {
 const result = await getCustomerByRegistration(regNumber.trim());
 if (result) {
 await loadCustomerAndVehicles(result);
 }
 } catch (err) {
 setCustomerError(err instanceof Error ? err.message : 'Failed to search by registration number');
 } finally {
 setIsSearchingCustomer(false);
 }
 }, [regNumber, loadCustomerAndVehicles]);

 // ── Create Customer ─────────────────────────────────────────────────────────
 const handleCreateCustomer = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newCustomer.name.trim() || !newCustomer.phone.trim()) return;

 setIsCreatingCustomer(true);
 try {
 const created = await createCustomer({
 name: newCustomer.name,
 phone: newCustomer.phone,
 email: newCustomer.email || undefined,
 address: newCustomer.address || undefined,
 });
 setCustomer(created);
 setShowNewCustomerForm(false);
 setCustomerError(null);
 setVehicles([]);
 setSelectedVehicle(null);
 } catch (err) {
 setCustomerError(err instanceof Error ? err.message : 'Failed to create customer');
 } finally {
 setIsCreatingCustomer(false);
 }
 };

 // ── Create Vehicle ──────────────────────────────────────────────────────────
 const handleCreateVehicle = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newVehicle.registrationNumber.trim() || !newVehicle.make.trim() || !newVehicle.model.trim() || !customer) return;

 setIsCreatingVehicle(true);
 try {
 const created = await createVehicle({
 ...newVehicle,
 customerId: customer.id,
 });
 setSelectedVehicle(created);
 setVehicles(prev => [...prev, created]);
 setShowNewVehicleForm(false);
 } catch (err) {
 setCustomerError(err instanceof Error ? err.message : 'Failed to create vehicle');
 } finally {
 setIsCreatingVehicle(false);
 }
 };

 // Load categories when modal opens
 useEffect(() => {
 if (!showNewServiceForm) return;
 if (serviceCategories.length > 0) return;
 setIsLoadingCategories(true);
 (async () => {
 try {
 const result = await getCatalogueServices({ category: undefined, search: undefined });
 const uniqueCategories = [...new Set(result.map(s => s.category).filter(Boolean))] as string[];
 setServiceCategories(uniqueCategories);
 } catch { /* no categories available yet */ }
 setIsLoadingCategories(false);
 })();
 }, [showNewServiceForm, serviceCategories.length]);

 // ── Service Search (live / debounced) ───────────────────────────────────────
 const doServiceSearch = useCallback(async (query: string) => {
 if (!query.trim()) { setSearchResults([]); return; }
 setIsSearchingServices(true);
 try {
 const result = await getCatalogueServices({ search: query.trim() });
 setSearchResults(result);
 } catch { setSearchResults([]); } finally { setIsSearchingServices(false); }
 }, []);

 useEffect(() => {
 if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
 if (!serviceSearch.trim()) { setSearchResults([]); return; }
 searchTimerRef.current = setTimeout(() => { doServiceSearch(serviceSearch); }, 250);
 return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
 }, [serviceSearch, doServiceSearch]);

 // close dropdown on Escape
 useEffect(() => {
 const onKey = (e: KeyboardEvent) => {
 if (e.key === 'Escape') setSearchResults([]);
 };
 window.addEventListener('keydown', onKey);
 return () => window.removeEventListener('keydown', onKey);
 }, []);

 // ── Add Service ──────────────────────────────────────────────────────────────
 const handleAddService = (svc: { id: string; name: string; category: string; basePrice: number }) => {
 const exists = services.find(s => s.name === svc.name);
 if (exists) {
 setServices(prev => prev.map(s => s.name === svc.name ? { ...s, quantity: s.quantity + 1 } : s));
 } else {
 setServices(prev => [...prev, {
 id: crypto.randomUUID(),
 name: svc.name,
 category: svc.category,
 unitPrice: svc.basePrice,
 quantity: 1,
 taxPercentage: 18,
 discountAmount: 0,
 lineTotal: svc.basePrice,
 }]);
 }
 setServiceSearch('');
 setSearchResults([]);
 searchInputRef.current?.focus();
 };

 // ── Create New Service (modal) ───────────────────────────────────────────────
 const handleCreateService = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newService.name.trim()) return;
 setIsCreatingService(true);
 try {
 const created = await getCatalogueServices({ category: newService.category, search: newService.name }).then(r => r.find(s => s.name === newService.name));
 if (created) {
 handleAddService(created);
 }
 setShowNewServiceForm(false);
 setNewService({ name: '', category: '', basePrice: 0 });
 } catch { /* handled */ } finally { setIsCreatingService(false); }
 };

 // ── Update Quantity / Discount / Remove ─────────────────────────────────────
 const updateQuantity = (id: string, quantity: number) => {
 if (quantity < 1) return;
 setServices(prev => prev.map(s => s.id === id ? { ...s, quantity, lineTotal: s.unitPrice * quantity - s.discountAmount } : s));
 };
 const updateDiscount = (id: string, discountAmount: number) => {
 if (discountAmount < 0) return;
 setServices(prev => prev.map(s => s.id === id ? { ...s, discountAmount, lineTotal: s.unitPrice * s.quantity - discountAmount } : s));
 };
 const removeService = (id: string) => setServices(prev => prev.filter(s => s.id !== id));

 // ── Create Job Card ─────────────────────────────────────────────────────────
 const handleCreateJobCard = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!customer || !selectedVehicle || services.length === 0) return;
 setIsCreatingJobCard(true);
 setSubmitError(null);
 try {
 const result = await createJobCard({
 customerId: customer.id,
 vehicleId: selectedVehicle.id,
 services: services.map(s => ({ name: s.name, category: s.category, price: s.unitPrice, quantity: s.quantity })),
 notes: undefined,
 } as CreateJobCardInput);
 setSuccess({ id: result.id, number: result.jobCardNumber, customer: customer.name, vehicle: `${selectedVehicle.registrationNumber} — ${selectedVehicle.make} ${selectedVehicle.model}`, total: result.totalAmount });
 } catch (err) {
 setSubmitError(err instanceof Error ? err.message : 'Failed to create job card');
 } finally { setIsCreatingJobCard(false); }
 };

 // ── Print ────────────────────────────────────────────────────────────────────
 const handlePrint = () => {
 window.print();
 };

 // ── Reset ───────────────────────────────────────────────────────────────────
 const handleNewJobCard = () => {
 setPhone(''); setRegNumber(''); setCustomer(null); setVehicles([]); setSelectedVehicle(null);
 setServices([]); setServiceSearch(''); setSearchResults([]);
 setShowNewCustomerForm(false); setShowNewVehicleForm(false); setShowNewServiceForm(false);
 setNewCustomer({ name: '', phone: '', email: '', address: '' });
 setNewVehicle({ registrationNumber: '', make: '', model: '', color: '' });
 setNewService({ name: '', category: '', basePrice: 0 });
 setSuccess(null); setSubmitError(null); setCustomerError(null);
 };

 // ═══════════════════════════════════════════════════════════════════════════
 // SUCCESS VIEW
 // ═══════════════════════════════════════════════════════════════════════════
 if (success) {
 return (
 <div className="flex flex-col h-full">
 <div className="px-6 py-4 border-b border-outline-variant">
 <h1 className="font-headline-md">New Job Card</h1>
 </div>
 <div className="flex-1 flex items-center justify-center">
 <div className="text-center max-w-md">
 <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
 <span className="material-symbols-outlined text-green-700 text-3xl">check_circle</span>
 </div>
 <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Job Card Created</h2>
 <p className="font-body-md text-body-md text-on-surface-variant mb-6">
 Job Card <span className="font-semibold text-on-surface">{success.number}</span> has been created successfully.
 </p>
 <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-6 text-left space-y-2">
 <div className="flex justify-between text-body-sm">
 <span className="text-on-surface-variant">Customer</span>
 <span className="font-medium text-on-surface">{success.customer}</span>
 </div>
 <div className="flex justify-between text-body-sm">
 <span className="text-on-surface-variant">Vehicle</span>
 <span className="font-medium text-on-surface">{success.vehicle}</span>
 </div>
 <div className="flex justify-between text-body-sm">
 <span className="text-on-surface-variant">Total Amount</span>
 <span className="font-medium text-on-surface">{formatCurrency(success.total)}</span>
 </div>
 </div>
 <div className="flex gap-3">
 <button
 onClick={handlePrint}
 disabled={isPrinting}
 className="flex-1 flex items-center justify-center gap-1.5 border border-outline-variant text-on-surface font-label-md text-label-md uppercase px-4 py-2.5 rounded hover:bg-surface-variant transition-colors"
 >
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{isPrinting ? 'progress_activity' : 'print'}</span>
 {isPrinting ? 'Printing…' : 'Print'}
 </button>
 <button
 onClick={() => navigate(`/job-cards/${success.id}`)}
 className="flex-1 btn-primary flex items-center justify-center gap-1.5 font-label-md text-label-md uppercase px-4 py-2.5"
 >
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
 View Details
 </button>
 </div>
 <button
 onClick={handleNewJobCard}
 className="mt-4 text-body-sm text-secondary hover:text-secondary/80 font-medium"
 >
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
 <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
 <h1 className="font-headline-md">New Job Card</h1>
 <div className="flex items-center gap-3">
 <label className="flex items-center gap-2 text-body-sm text-on-surface cursor-pointer">
 <input type="checkbox" checked={isGstEnabled} onChange={(e) => setIsGstEnabled(e.target.checked)} className="w-4 h-4 accent-secondary" />
 GST Enabled
 </label>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-6">
 <form onSubmit={handleCreateJobCard} className="max-w-4xl mx-auto space-y-8">
 {/* ── Step 1: Customer Selection ───────────────────────────────────── */}
 <section>
 <h2 className="font-label-lg text-label-lg text-on-surface-variant uppercase mb-4">Step 1: Select Customer</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Phone Number</label>
 <div className="flex gap-2">
 <PhoneInput value={phone} onChange={setPhone} className="flex-1" />
 <button
 type="button"
 onClick={handlePhoneSearch}
 disabled={!phone.trim() || isSearchingCustomer}
 className="border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-2 rounded hover:bg-surface-variant transition-colors whitespace-nowrap disabled:opacity-50"
 >
 {isSearchingCustomer ? 'Searching…' : 'Search'}
 </button>
 </div>
 </div>
 <div>
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Or Search by Vehicle</label>
 <div className="flex gap-2">
 <input
 value={regNumber}
 onChange={(e) => setRegNumber(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRegistrationSearch())}
 placeholder="Registration number"
 className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
 />
 <button
 type="button"
 onClick={handleRegistrationSearch}
 disabled={!regNumber.trim() || isSearchingCustomer}
 className="border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-2 rounded hover:bg-surface-variant transition-colors whitespace-nowrap disabled:opacity-50"
 >
 Search
 </button>
 </div>
 </div>
 </div>
 {customerError && (
 <div className="mt-3 bg-error-container border border-error rounded-lg p-3 text-error font-body-sm">
 {customerError}
 </div>
 )}

 {/* Customer found */}
 {customer && (
 <div className="mt-4 bg-surface-container-low rounded-lg border border-outline-variant p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-body-md text-body-md text-on-surface font-medium">{customer.name}</p>
 <p className="font-body-sm text-body-sm text-on-surface-variant">{customer.phone}</p>
 {customer.email && <p className="font-body-sm text-body-sm text-on-surface-variant">{customer.email}</p>}
 </div>
 {!isLoadingVehicles && vehicles.length > 1 && (
 <select
 value={selectedVehicle?.id ?? ''}
 onChange={(e) => setSelectedVehicle(vehicles.find(v => v.id === e.target.value) ?? null)}
 className="bg-surface border border-outline-variant rounded-lg px-3 py-2 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
 >
 <option value="">Select Vehicle</option>
 {vehicles.map(v => (
 <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>
 ))}
 </select>
 )}
 </div>
 </div>
 )}

 {/* Create new customer (inline) */}
 {showNewCustomerForm && (
 <div className="mt-4 bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
 <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">New Customer</h3>
 <form onSubmit={handleCreateCustomer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Name *</label>
 <input required value={newCustomer.name} onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Phone *</label>
 <input required value={newCustomer.phone} onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Email</label>
 <input value={newCustomer.email} onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Address</label>
 <input value={newCustomer.address} onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="md:col-span-2">
 <button type="submit" disabled={isCreatingCustomer} className="btn-primary">
 {isCreatingCustomer ? 'Creating…' : 'Create Customer'}
 </button>
 </div>
 </form>
 </div>
 )}

 {/* Create new vehicle (inline) */}
 {customer && !selectedVehicle && (
 <div className="mt-4">
 {!showNewVehicleForm ? (
 <button
 type="button"
 onClick={() => setShowNewVehicleForm(true)}
 className="flex items-center gap-1.5 border border-outline-variant text-on-surface font-label-md text-label-md uppercase px-4 py-2 rounded hover:bg-surface-variant transition-colors"
 >
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
 Add Vehicle
 </button>
 ) : (
 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
 <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">New Vehicle</h3>
 <form onSubmit={handleCreateVehicle} className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Registration Number *</label>
 <input required value={newVehicle.registrationNumber} onChange={(e) => setNewVehicle(prev => ({ ...prev, registrationNumber: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Make *</label>
 <input required value={newVehicle.make} onChange={(e) => setNewVehicle(prev => ({ ...prev, make: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Model *</label>
 <input required value={newVehicle.model} onChange={(e) => setNewVehicle(prev => ({ ...prev, model: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Color</label>
 <input value={newVehicle.color} onChange={(e) => setNewVehicle(prev => ({ ...prev, color: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="md:col-span-2">
 <button type="submit" disabled={isCreatingVehicle} className="btn-primary">
 {isCreatingVehicle ? 'Adding…' : 'Add Vehicle'}
 </button>
 </div>
 </form>
 </div>
 )}
 </div>
 )}
 </section>

 {/* ── Step 2: Services ─────────────────────────────────────────────── */}
 <section>
 <h2 className="font-label-lg text-label-lg text-on-surface-variant uppercase mb-4">Step 2: Add Services</h2>

 {/* Service search */}
 <div className="relative mb-4">
 <label className="block font-label-md text-label-md text-on-surface-variant uppercase mb-1">Search Services</label>
 <div className="relative">
 <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: '18px' }}>search</span>
 <input
 ref={searchInputRef}
 value={serviceSearch}
 onChange={(e) => setServiceSearch(e.target.value)}
 placeholder="Type to search services…"
 className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
 />
 </div>

 {/* Search dropdown */}
 {searchResults.length > 0 && (
 <div className="absolute z-10 w-full mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg max-h-60 overflow-y-auto">
 {searchResults.map(svc => (
 <button
 key={svc.id}
 type="button"
 onClick={() => handleAddService(svc)}
 className="w-full text-left px-4 py-3 hover:bg-surface-variant transition-colors border-b border-outline-variant last:border-b-0"
 >
 <p className="font-body-sm text-body-sm text-on-surface">{svc.name}</p>
 <p className="font-label-md text-label-md text-on-surface-variant">{svc.category} — {formatCurrency(svc.basePrice)}</p>
 </button>
 ))}
 </div>
 )}
 </div>

 {/* Services list */}
 {services.length > 0 && (
 <div className="overflow-x-auto rounded-lg border border-outline-variant">
 <table className="w-full text-left border-collapse" style={{ minWidth: '600px' }}>
 <thead>
 <tr className="border-b border-outline-variant" style={{ backgroundColor: '#f8f9fa' }}>
 <th className="py-2 px-3 font-label-md text-label-md text-outline uppercase tracking-wider">Service</th>
 <th className="py-2 px-3 font-label-md text-label-md text-outline uppercase tracking-wider">Qty</th>
 <th className="py-2 px-3 font-label-md text-label-md text-outline uppercase tracking-wider">Price</th>
 <th className="py-2 px-3 font-label-md text-label-md text-outline uppercase tracking-wider">Discount</th>
 <th className="py-2 px-3 font-label-md text-label-md text-outline uppercase tracking-wider">Total</th>
 <th className="py-2 px-3"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-outline-variant">
 {services.map((item) => (
 <tr key={item.id}>
 <td className="py-2 px-3">
 <p className="font-body-sm text-body-sm text-on-surface">{item.name}</p>
 <p className="font-label-md text-label-md text-on-surface-variant">{item.category}</p>
 </td>
 <td className="py-2 px-3">
 <input
 type="number"
 value={item.quantity}
 onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
 min="1"
 className="w-16 bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-body-sm text-center focus:border-secondary focus:ring-1 focus:ring-secondary"
 />
 </td>
 <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{formatCurrency(item.unitPrice)}</td>
 <td className="py-2 px-3">
 <input
 type="number"
 value={item.discountAmount}
 onChange={(e) => updateDiscount(item.id, parseFloat(e.target.value) || 0)}
 min="0"
 step="0.01"
 className="w-24 bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-body-sm text-right focus:border-secondary focus:ring-1 focus:ring-secondary"
 />
 </td>
 <td className="py-2 px-3 font-body-sm text-body-sm font-medium text-on-surface">{formatCurrency(item.lineTotal)}</td>
 <td className="py-2 px-3 text-right">
 <button type="button" onClick={() => removeService(item.id)} className="p-1 text-outline hover:text-error rounded transition-colors">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Add new service inline */}
 <button
 type="button"
 onClick={() => setShowNewServiceForm(!showNewServiceForm)}
 className="mt-3 flex items-center gap-1.5 border border-dashed border-outline-variant text-on-surface-variant font-label-md text-label-md uppercase px-4 py-2 rounded hover:border-secondary hover:text-secondary transition-colors"
 >
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
 Add Custom Service
 </button>
 {showNewServiceForm && (
 <div className="mt-4 bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
 <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">New Service</h3>
 <form onSubmit={handleCreateService} className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Name *</label>
 <input required value={newService.name} onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Category</label>
 <input value={newService.category} onChange={(e) => setNewService(prev => ({ ...prev, category: e.target.value }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="flex flex-col gap-1">
 <label className="font-label-md text-label-md text-on-surface-variant uppercase">Price *</label>
 <input required type="number" step="0.01" min="0" value={newService.basePrice} onChange={(e) => setNewService(prev => ({ ...prev, basePrice: parseFloat(e.target.value) || 0 }))} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 <div className="md:col-span-3">
 <button type="submit" disabled={isCreatingService} className="btn-primary">
 {isCreatingService ? 'Adding…' : 'Add Service'}
 </button>
 </div>
 </form>
 </div>
 )}
 </section>

 {/* ── Step 3: Summary ──────────────────────────────────────────────── */}
 <section>
 <h2 className="font-label-lg text-label-lg text-on-surface-variant uppercase mb-4">Step 3: Summary</h2>
 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
 <div className="space-y-2">
 <div className="flex justify-between text-body-sm text-on-surface-variant">
 <span>Subtotal</span>
 <span>{formatCurrency(calcSubtotal)}</span>
 </div>
 {calcDiscount > 0 && (
 <div className="flex justify-between text-body-sm text-on-surface-variant">
 <span>Discount</span>
 <span>-{formatCurrency(calcDiscount)}</span>
 </div>
 )}
 {isGstEnabled && (
 <div className="flex justify-between text-body-sm text-on-surface-variant">
 <span>GST (18%)</span>
 <span>{formatCurrency(calcTax)}</span>
 </div>
 )}
 <div className="flex justify-between font-headline-sm text-headline-sm text-on-surface border-t border-outline-variant pt-3 mt-3">
 <span>Grand Total</span>
 <span>{formatCurrency(calcTotal)}</span>
 </div>
 </div>
 </div>
 </section>

 {/* Error */}
 {submitError && (
 <div className="bg-error-container border border-error rounded-lg p-4 text-error font-body-sm">
 {submitError}
 </div>
 )}

 {/* Actions */}
 <div className="flex justify-end gap-3 pt-4">
 <button
 type="button"
 onClick={handleNewJobCard}
 className="px-6 py-2.5 border border-outline-variant rounded-lg text-on-surface font-body-sm font-semibold hover:bg-surface-variant transition-colors"
 >
 Reset
 </button>
 <button
 type="submit"
 disabled={!canCreate}
 className="btn-primary px-8 py-2.5 font-body-sm"
 >
 {isCreatingJobCard ? 'Creating…' : 'Create Job Card'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
