import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Wrench, Edit3, ArrowRight, ChevronDown } from 'lucide-react';
import { getServices, getServiceCategories, createService, updateService, type ServiceDto, type CreateServiceInput } from '../../lib/api';
import { useApiMutation } from '../../lib/hooks';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceFormData {
 name: string;
 category: string;
 description: string;
 price: string;
 durationMinutes: string;
 taxPercentage: string;
 isActive: boolean;
}

const emptyForm: ServiceFormData = {
 name: '',
 category: '',
 description: '',
 price: '',
 durationMinutes: '',
 taxPercentage: '18',
 isActive: true,
};

type SortOption = 'recommended' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
 { value: 'recommended', label: 'Recommended' },
 { value: 'name-asc', label: 'Name A-Z' },
 { value: 'name-desc', label: 'Name Z-A' },
 { value: 'price-asc', label: 'Price: Low to High' },
 { value: 'price-desc', label: 'Price: High to Low' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number | null | undefined): string {
 if (!minutes) return '—';
 if (minutes < 60) return `${minutes} min`;
 const hours = Math.floor(minutes / 60);
 const mins = minutes % 60;
 return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatPrice(price: number): string {
 return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CataloguePage() {
 const navigate = useNavigate();
 const location = useLocation();

 // ── Pre-selected service from navigation ───────────────────────────────────
 const preselectedServiceId = (location.state as { preselectedServiceId?: string } | null)?.preselectedServiceId;

 // ── UI State ───────────────────────────────────────────────────────────────
 const [search, setSearch] = useState('');
 const [activeCategory, setActiveCategory] = useState<string>('all');
 const [sortBy, setSortBy] = useState<SortOption>('recommended');
 const [showCreateDialog, setShowCreateDialog] = useState(false);
 const [editingService, setEditingService] = useState<ServiceDto | null>(null);
 const [form, setForm] = useState<ServiceFormData>(emptyForm);
 const [showSortDropdown, setShowSortDropdown] = useState(false);

 // ── Queries ────────────────────────────────────────────────────────────────
 const { data: servicesData, isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useQuery({
 queryKey: ['services', 'catalogue'],
 queryFn: () => getServices({ page: 1, pageSize: 200 }),
 });

 const { data: categories = [] } = useQuery({
 queryKey: ['service-categories'],
 queryFn: getServiceCategories,
 });

 const services = servicesData?.items ?? [];

 // ── Mutations ──────────────────────────────────────────────────────────────
 const createMutation = useApiMutation<ServiceDto, CreateServiceInput>(
 (data) => createService(data),
 { invalidateKey: ['services', 'catalogue'] }
 );

 const updateMutation = useApiMutation<ServiceDto, { id: string; data: CreateServiceInput }>(
 ({ id, data }) => updateService(id, data),
 { invalidateKey: ['services', 'catalogue'] }
 );

 // ── Preselect from navigation ──────────────────────────────────────────────
 useEffect(() => {
 if (!preselectedServiceId || services.length === 0) return;
 const found = services.find(s => s.id === preselectedServiceId);
 if (found) {
 setSearch(found.name);
 }
 }, [preselectedServiceId, services]);

 // ── Filter & Sort ──────────────────────────────────────────────────────────
 const filteredServices = useMemo(() => {
 let result = [...services];

 if (activeCategory !== 'all') {
 result = result.filter(s => s.category === activeCategory);
 }

 if (search.trim()) {
 const q = search.toLowerCase().trim();
 result = result.filter(s =>
 s.name.toLowerCase().includes(q) ||
 (s.description && s.description.toLowerCase().includes(q)) ||
 (s.category && s.category.toLowerCase().includes(q))
 );
 }

 switch (sortBy) {
 case 'name-asc':
 result.sort((a, b) => a.name.localeCompare(b.name));
 break;
 case 'name-desc':
 result.sort((a, b) => b.name.localeCompare(a.name));
 break;
 case 'price-asc':
 result.sort((a, b) => a.price - b.price);
 break;
 case 'price-desc':
 result.sort((a, b) => b.price - a.price);
 break;
 default:
 break;
 }

 return result;
 }, [services, activeCategory, search, sortBy]);

 // ── Handlers ───────────────────────────────────────────────────────────────
 const openCreateDialog = () => {
 setForm(emptyForm);
 setEditingService(null);
 setShowCreateDialog(true);
 };

 const openEditDialog = (svc: ServiceDto) => {
 setEditingService(svc);
 setForm({
 name: svc.name,
 category: svc.category || '',
 description: svc.description || '',
 price: String(svc.price),
 durationMinutes: String(svc.durationMinutes ?? ''),
 taxPercentage: String(svc.taxPercentage),
 isActive: svc.isActive,
 });
 setShowCreateDialog(true);
 };

 const handleCreateSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 createMutation.mutate({
 name: form.name.trim(),
 category: form.category.trim() || 'General',
 description: form.description.trim() || undefined,
 price: parseFloat(form.price) || 0,
 taxPercentage: parseFloat(form.taxPercentage) || 18,
 durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
 isActive: form.isActive,
 });
 };

 const handleUpdateSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!editingService) return;
 updateMutation.mutate({
 id: editingService.id,
 data: {
 name: form.name.trim(),
 category: form.category.trim() || 'General',
 description: form.description.trim() || undefined,
 price: parseFloat(form.price) || 0,
 taxPercentage: parseFloat(form.taxPercentage) || 18,
 durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
 isActive: form.isActive,
 },
 });
 };

 const handleAddToJobCard = (svc: ServiceDto) => {
 navigate('/job-cards/new', { state: { preselectedServiceId: svc.id } });
 };

 const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Recommended';

 // ── Render ─────────────────────────────────────────────────────────────────
 return (
 <div className="space-y-5 animate-fade-in">
 {/* ── Header ─────────────────────────────────────────────────────────── */}
 <div className="flex items-start justify-between">
 <div>
 <h1 className="text-[28px] font-semibold text-on-surface tracking-tight leading-tight">Menu &amp; Pricing</h1>
 <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
 Browse our complete list of car detailing, protection, maintenance, and other services.
 </p>
 </div>
 <div className="flex items-center gap-3">
 {/* Sort Dropdown */}
 <div className="relative">
 <button
 onClick={() => setShowSortDropdown(!showSortDropdown)}
 className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface hover:bg-surface-container-high transition-colors"
 >
 Sort by: {currentSortLabel}
 <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
 </button>
 {showSortDropdown && (
 <>
 <div className="fixed inset-0 z-40" onClick={() => setShowSortDropdown(false)} />
 <div className="absolute right-0 top-full mt-1 z-50 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-elevation-2 py-1 min-w-[200px]">
 {SORT_OPTIONS.map(opt => (
 <button
 key={opt.value}
 onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
 className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-container-low transition-colors ${sortBy === opt.value ? 'text-secondary font-medium' : 'text-on-surface'}`}
 >
 {opt.label}
 </button>
 ))}
 </div>
 </>
 )}
 </div>
 <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateDialog}>Create Service</Button>
 </div>
 </div>

 {/* ── Search ─────────────────────────────────────────────────────────── */}
 <div className="max-w-xl">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
 <input
 type="text"
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Search services..."
 className="form-input pl-10 pr-4 py-2.5 w-full"
 />
 </div>
 </div>

 {/* ── Category Tabs ──────────────────────────────────────────────────── */}
 <div className="flex items-center gap-1 border-b border-outline-variant -mx-1 px-1">
 <button
 onClick={() => setActiveCategory('all')}
 className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
 activeCategory === 'all' ? 'text-secondary' : 'text-on-surface-variant hover:text-on-surface'
 }`}
 >
 All Services
 {activeCategory === 'all' && <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-secondary rounded-full" />}
 </button>
 {categories.map(cat => (
 <button
 key={cat}
 onClick={() => setActiveCategory(cat)}
 className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
 activeCategory === cat ? 'text-secondary' : 'text-on-surface-variant hover:text-on-surface'
 }`}
 >
 {cat}
 {activeCategory === cat && <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-secondary rounded-full" />}
 </button>
 ))}
 </div>

 {/* ── Service Grid ────────────────────────────────────────────────────── */}
 {servicesLoading ? (
 <div className="flex items-center justify-center py-20">
 <div className="text-center">
 <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
 <p className="text-sm text-on-surface-variant">Loading services…</p>
 </div>
 </div>
 ) : servicesError ? (
 <div className="text-center py-20">
 <p className="text-error text-sm mb-3">Failed to load services. Please try again.</p>
 <Button variant="secondary" onClick={() => refetchServices()}>Retry</Button>
 </div>
 ) : filteredServices.length === 0 ? (
 <div className="text-center py-20">
 <Wrench className="w-12 h-12 text-on-surface-variant/40 mx-auto mb-3" />
 <p className="text-sm text-on-surface-variant mb-1">No services found.</p>
 {search.trim() && <p className="text-xs text-on-surface-variant/70">Try a different search term or category.</p>}
 <Button variant="secondary" onClick={openCreateDialog} className="mt-4">Create Service</Button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
 {filteredServices.map(svc => (
 <div
 key={svc.id}
 className={`bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col transition-shadow hover:shadow-elevation-1 ${!svc.isActive ? 'opacity-70' : ''}`}
 >
 {/* Category + Status */}
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">{svc.category || 'General'}</span>
 <StatusBadge status={svc.isActive ? 'active' : 'cancelled'} />
 </div>

 {/* Name + Description */}
 <h3 className="text-base font-semibold text-on-surface mb-1">{svc.name}</h3>
 {svc.description && (
 <p className="text-sm text-on-surface-variant line-clamp-2 mb-4">{svc.description}</p>
 )}

 {/* Spacer */}
 <div className="flex-1" />

 {/* Duration + Price */}
 <div className="flex items-center justify-between pt-3 border-t border-outline-variant/60">
 <div className="text-sm text-on-surface-variant">
 <span className="font-medium text-on-surface">{formatDuration(svc.durationMinutes)}</span>
 </div>
 <div className="text-base font-semibold text-on-surface">
 {formatPrice(svc.price)}
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2 mt-3">
 <Button
 variant="secondary"
 size="sm"
 className="flex-1"
 disabled={!svc.isActive}
 onClick={() => handleAddToJobCard(svc)}
 >
 <ArrowRight className="w-3.5 h-3.5" />
 Add to Job Card
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => openEditDialog(svc)}
 title="Edit service"
 >
 <Edit3 className="w-4 h-4" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* ── Create / Edit Dialog ────────────────────────────────────────────── */}
 <Dialog
 open={showCreateDialog}
 onOpenChange={(open) => {
 setShowCreateDialog(open);
 if (!open) {
 setEditingService(null);
 setForm(emptyForm);
 }
 }}
 title={editingService ? 'Edit Service' : 'New Service'}
 description={editingService ? 'Update service details and pricing' : 'Create a new service for the catalogue'}
 footer={
 <>
 <Button variant="secondary" onClick={() => { setShowCreateDialog(false); setEditingService(null); setForm(emptyForm); }}>
 Cancel
 </Button>
 <Button onClick={editingService ? handleUpdateSubmit : handleCreateSubmit} loading={editingService ? updateMutation.isPending : createMutation.isPending}>
 {editingService ? 'Save Changes' : 'Create Service'}
 </Button>
 </>
 }
 size="lg"
 >
 <form onSubmit={editingService ? handleUpdateSubmit : handleCreateSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Service Name <span className="text-error">*</span></label>
 <input
 required
 value={form.name}
 onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
 className="form-input"
 placeholder="e.g. Premium Wash"
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Category</label>
 <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="form-input">
 <option value="">Select category</option>
 {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Price (₹) <span className="text-error">*</span></label>
 <input
 required
 type="number"
 step="0.01"
 min="0"
 value={form.price}
 onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
 className="form-input"
 placeholder="0.00"
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Duration (min)</label>
 <input
 type="number"
 min="0"
 value={form.durationMinutes}
 onChange={e => setForm(p => ({ ...p, durationMinutes: e.target.value }))}
 className="form-input"
 placeholder="30"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Tax %</label>
 <input
 type="number"
 step="0.01"
 min="0"
 max="100"
 value={form.taxPercentage}
 onChange={e => setForm(p => ({ ...p, taxPercentage: e.target.value }))}
 className="form-input"
 placeholder="18"
 />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Description</label>
 <textarea
 value={form.description}
 onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
 rows={2}
 className="form-input resize-none"
 placeholder="Brief description of the service…"
 />
 </div>
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="is-active"
 checked={form.isActive}
 onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
 className="w-4 h-4 accent-secondary rounded"
 />
 <label htmlFor="is-active" className="text-sm text-on-surface cursor-pointer">Active — visible in catalogue and job cards</label>
 </div>
 </form>
 </Dialog>
 </div>
 );
}
