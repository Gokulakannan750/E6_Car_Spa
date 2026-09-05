import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Edit3, ChevronDown, Clock, PlusCircle, Info, Wrench } from 'lucide-react';
import { getServices, getServiceCategories, createService, updateService, type ServiceDto, type CreateServiceInput } from '../../lib/api';
import { useApiMutation } from '../../lib/hooks';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { Combobox } from '../../components/ui/Combobox';
import { useAuth } from '../auth/auth-context';

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceFormData {
	name: string;
	category: string;
	description: string;
	price: string;
	durationMinutes: string;
	isActive: boolean;
}

const emptyForm: ServiceFormData = {
	name: '',
	category: '',
	description: '',
	price: '',
	durationMinutes: '60',
	isActive: true,
};


type SortOption = 'recommended' | 'price-asc' | 'price-desc' | 'duration-asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
	{ value: 'recommended', label: 'Sort by: Recommended' },
	{ value: 'price-asc', label: 'Price: Low to High' },
	{ value: 'price-desc', label: 'Price: High to Low' },
	{ value: 'duration-asc', label: 'Duration: Shortest First' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number | null | undefined): string {
	if (!minutes) return '—';
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
}

function formatPrice(price: number): string {
	return `₹${price.toLocaleString('en-IN')}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CataloguePage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { hasPermission } = useAuth();

	const canCreate = hasPermission('catalogue.create');
	const canEdit = hasPermission('catalogue.edit');

	// ── Pre-selected service from navigation ───────────────────────────────────
	const preselectedServiceId = (location.state as { preselectedServiceId?: string } | null)?.preselectedServiceId;

	// ── UI State ───────────────────────────────────────────────────────────────
	const [search, setSearch] = useState('');
	const [activeCategory, setActiveCategory] = useState<string>('all');
	const [sortBy, setSortBy] = useState<SortOption>('recommended');
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [editingService, setEditingService] = useState<ServiceDto | null>(null);
	const [viewingService, setViewingService] = useState<ServiceDto | null>(null);
	const [form, setForm] = useState<ServiceFormData>(emptyForm);
	const [showSortDropdown, setShowSortDropdown] = useState(false);

	// ── Queries ────────────────────────────────────────────────────────────────
	const {
		data: servicesData,
		isLoading: servicesLoading,
		error: servicesError,
		refetch: refetchServices,
	} = useQuery({
		queryKey: ['services', 'catalogue'],
		queryFn: () => getServices({ page: 1, pageSize: 200 }),
	});

	const { data: backendCategories = [] } = useQuery({
		queryKey: ['services', 'categories'],
		queryFn: () => getServiceCategories(),
	});

	const services = servicesData?.items ?? [];

	// ── Authoritative Categories from backend GET /api/services/categories + loaded services ──
	const dynamicCategories = useMemo(() => {
		const set = new Set<string>(backendCategories);
		services.forEach((s) => {
			if (s.category && s.category.trim()) set.add(s.category.trim());
		});
		return Array.from(set).sort();
	}, [backendCategories, services]);

	// ── Available Categories for Combobox (uses same authoritative source) ────
	const categoryOptions = dynamicCategories;

	// ── Mutations ──────────────────────────────────────────────────────────────
	const createMutation = useApiMutation<ServiceDto, CreateServiceInput>(
		(data) => createService(data),
		{ invalidateKey: ['services'] }
	);

	const updateMutation = useApiMutation<ServiceDto, { id: string; data: CreateServiceInput }>(
		({ id, data }) => updateService(id, data),
		{ invalidateKey: ['services'] }
	);

	// ── Preselect from navigation ──────────────────────────────────────────────
	useEffect(() => {
		if (!preselectedServiceId || services.length === 0) return;
		const found = services.find((s) => s.id === preselectedServiceId);
		if (found) {
			setSearch(found.name);
		}
	}, [preselectedServiceId, services]);

	// ── Filter & Sort ──────────────────────────────────────────────────────────
	const filteredServices = useMemo(() => {
		let result = [...services];

		if (activeCategory !== 'all') {
			result = result.filter((s) => s.category === activeCategory);
		}

		if (search.trim()) {
			const q = search.toLowerCase().trim();
			result = result.filter(
				(s) =>
					s.name.toLowerCase().includes(q) ||
					(s.category && s.category.toLowerCase().includes(q)) ||
					(q.length >= 3 && s.description && s.description.toLowerCase().includes(q))
			);
		}

		switch (sortBy) {
			case 'price-asc':
				result.sort((a, b) => a.price - b.price);
				break;
			case 'price-desc':
				result.sort((a, b) => b.price - a.price);
				break;
			case 'duration-asc':
				result.sort((a, b) => (a.durationMinutes ?? 0) - (b.durationMinutes ?? 0));
				break;
			case 'recommended':
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
			durationMinutes: String(svc.durationMinutes ?? '60'),
			isActive: svc.isActive,
		});
		setShowCreateDialog(true);
	};

	const handleCreateSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		createMutation.mutate(
			{
				name: form.name.trim(),
				category: form.category.trim() || 'General',
				description: form.description.trim() || undefined,
				price: parseFloat(form.price) || 0,
				taxPercentage: 18,
				durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
				isActive: form.isActive,
			},
			{
				onSuccess: () => {
					setShowCreateDialog(false);
					setForm(emptyForm);
				},
			}
		);
	};

	const handleUpdateSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingService) return;
		updateMutation.mutate(
			{
				id: editingService.id,
				data: {
					name: form.name.trim(),
					category: form.category.trim() || 'General',
					description: form.description.trim() || undefined,
					price: parseFloat(form.price) || 0,
					taxPercentage: editingService.taxPercentage ?? 18,
					durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
					isActive: form.isActive,
				},
			},
			{
				onSuccess: () => {
					setShowCreateDialog(false);
					setEditingService(null);
					setForm(emptyForm);
				},
			}
		);
	};

	const handleAddToJobCard = (svc: ServiceDto) => {
		navigate('/job-cards/new', { state: { preselectedServiceId: svc.id } });
	};

	const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort by: Recommended';

	// ── Render ─────────────────────────────────────────────────────────────────
	return (
		<div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto pb-10">
			{/* ── Page Header & Actions ────────────────────────────────────────── */}
			<div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-on-surface">Menu &amp; Pricing</h1>
					<p className="text-base text-on-surface-variant max-w-2xl mt-1">
						Browse our comprehensive list of premium detailing, protection, and reconditioning services.
					</p>
				</div>
				<div className="flex items-center gap-3 w-full md:w-auto">
					{/* Sort Dropdown */}
					<div className="relative w-full md:w-56">
						<button
							onClick={() => setShowSortDropdown(!showSortDropdown)}
							className="w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface hover:bg-surface-container-low transition-colors shadow-sm"
						>
							<span className="truncate">{currentSortLabel}</span>
							<ChevronDown
								className={`w-4 h-4 text-on-surface-variant transition-transform shrink-0 ${
									showSortDropdown ? 'rotate-180' : ''
								}`}
							/>
						</button>
						{showSortDropdown && (
							<>
								<div className="fixed inset-0 z-40" onClick={() => setShowSortDropdown(false)} />
								<div className="absolute right-0 top-full mt-1 z-50 bg-white border border-outline-variant rounded-lg shadow-elevation-2 py-1 min-w-[220px]">
									{SORT_OPTIONS.map((opt) => (
										<button
											key={opt.value}
											onClick={() => {
												setSortBy(opt.value);
												setShowSortDropdown(false);
											}}
											className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-container-low transition-colors ${
												sortBy === opt.value ? 'text-secondary font-medium' : 'text-on-surface'
											}`}
										>
											{opt.label}
										</button>
									))}
								</div>
							</>
						)}
					</div>

					{canCreate && (
						<Button icon={<Plus className="w-4 h-4" />} onClick={openCreateDialog}>
							Create Service
						</Button>
					)}
				</div>
			</div>

			{/* ── Search Input ─────────────────────────────────────────────────── */}
			<div className="max-w-xl">
				<div className="relative">
					<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search services..."
						className="form-input pl-10 pr-4 py-2.5 w-full bg-white shadow-sm"
					/>
				</div>
			</div>

			{/* ── Category Tabs ── */}
			{dynamicCategories.length > 0 && (
				<div className="border-b border-outline-variant flex overflow-x-auto gap-1">
					<button
						onClick={() => setActiveCategory('all')}
						className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
							activeCategory === 'all'
								? 'border-secondary text-secondary'
								: 'border-transparent text-on-surface-variant hover:text-on-surface'
						}`}
					>
						All Services ({services.length})
					</button>
					{dynamicCategories.map((cat) => (
						<button
							key={cat}
							onClick={() => setActiveCategory(cat)}
							className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
								activeCategory === cat
									? 'border-secondary text-secondary'
									: 'border-transparent text-on-surface-variant hover:text-on-surface'
							}`}
						>
							{cat} ({services.filter((s) => s.category === cat).length})
						</button>
					))}
				</div>
			)}

			{/* ── Service Grid (Bento/Card Layout without images) ─────────────── */}
			{servicesLoading ? (
				<div className="flex items-center justify-center py-20">
					<div className="text-center">
						<div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
						<p className="text-sm text-on-surface-variant">Loading services…</p>
					</div>
				</div>
			) : servicesError && services.length === 0 ? (
				<div className="text-center py-20">
					<p className="text-error text-sm mb-3">Failed to load services. Please try again.</p>
					<Button variant="secondary" onClick={() => refetchServices()}>
						Retry
					</Button>
				</div>
			) : filteredServices.length === 0 ? (
				<div className="text-center py-20 app-card p-12">
					<Wrench className="w-12 h-12 text-on-surface-variant/40 mx-auto mb-3" />
					<p className="text-base font-medium text-on-surface mb-1">No services found.</p>
					<p className="text-sm text-on-surface-variant">Try a different search query or category filter.</p>
					{canCreate && (
						<Button variant="secondary" onClick={openCreateDialog} className="mt-4">
							Create Service
						</Button>
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredServices.map((svc) => (
						<div
							key={svc.id}
							className={`bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] flex flex-col group hover:shadow-[0px_12px_24px_rgba(0,0,0,0.1)] transition-all duration-300 ${
								!svc.isActive ? 'opacity-70' : ''
							}`}
						>
							{/* Top: Category Tag & Status / Badges */}
							<div className="flex items-center justify-between mb-2">
								<span className="text-xs font-semibold uppercase tracking-wider text-secondary bg-secondary/10 px-2.5 py-0.5 rounded">
									{svc.category || 'Exterior Detailing'}
								</span>
								<StatusBadge status={svc.isActive ? 'active' : 'inactive'} />
							</div>

							{/* Title */}
							<h3 className="font-headline-sm text-lg font-bold text-primary group-hover:text-secondary transition-colors mb-1.5">
								{svc.name}
							</h3>

							{/* Description */}
							<p className="font-body-sm text-sm text-on-surface-variant mb-4 flex-1 line-clamp-3 leading-relaxed">
								{svc.description || 'Professional car detailing and protection service provided by our certified specialists.'}
							</p>

							{/* Middle Info Box (Duration & Starting Price) */}
							<div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-surface-container-low rounded-lg border border-outline-variant/50">
								<div>
									<span className="block font-label-md text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
										Duration
									</span>
									<span className="flex items-center gap-1 text-sm text-on-surface font-medium">
										<Clock className="w-4 h-4 text-outline shrink-0" />
										{formatDuration(svc.durationMinutes)}
									</span>
								</div>
								<div>
									<span className="block font-label-md text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
										Starting Price
									</span>
									<span className="font-headline-sm text-lg font-bold text-secondary tracking-tight">
										From {formatPrice(svc.price)}
									</span>
								</div>
							</div>

							{/* Bottom Row: Add to Job Card & Details / Edit */}
							<div className="flex items-center gap-2 mt-auto">
								<Button
									variant="primary"
									size="md"
									className="flex-1 font-semibold"
									disabled={!svc.isActive}
									icon={<PlusCircle className="w-4 h-4" />}
									onClick={() => handleAddToJobCard(svc)}
								>
									Add to Job Card
								</Button>
								<button
									className="p-2 border border-outline-variant rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
									title="View Details"
									onClick={() => setViewingService(svc)}
								>
									<Info className="w-5 h-5" />
								</button>
								{canEdit && (
									<button
										className="p-2 border border-outline-variant rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
										title="Edit Service"
										onClick={() => openEditDialog(svc)}
									>
										<Edit3 className="w-4 h-4" />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{/* ── Create / Edit Dialog ────────────────────────────────────────── */}
			{showCreateDialog && (
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
					description={
						editingService
							? 'Update service pricing, category, and specifications'
							: 'Create a new detailing or protection service for the catalogue'
					}
					footer={
						<>
							<Button
								variant="secondary"
								onClick={() => {
									setShowCreateDialog(false);
									setEditingService(null);
									setForm(emptyForm);
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={editingService ? handleUpdateSubmit : handleCreateSubmit}
								loading={editingService ? updateMutation.isPending : createMutation.isPending}
							>
								{editingService ? 'Save Changes' : 'Create Service'}
							</Button>
						</>
					}
					size="md"
				>
					<form onSubmit={editingService ? handleUpdateSubmit : handleCreateSubmit} className="space-y-3">
						<div>
							<label className="block text-xs font-semibold text-on-surface mb-1">
								Service Name <span className="text-error">*</span>
							</label>
							<input
								required
								value={form.name}
								onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
								className="form-input w-full text-sm py-1.5"
								placeholder="e.g. Level 3 Paint Correction"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<Combobox
								label="Category"
								required
								value={form.category}
								onChange={(val) => setForm((p) => ({ ...p, category: val }))}
								options={categoryOptions}
								placeholder="e.g. Exterior Detailing, Protection"
							/>
							<div>
								<label className="block text-xs font-semibold text-on-surface mb-1">
									Price (INR) <span className="text-error">*</span>
								</label>
								<input
									required
									type="number"
									step="0.01"
									min="0"
									value={form.price}
									onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
									className="form-input w-full text-sm py-1.5"
									placeholder="0.00"
								/>
							</div>
						</div>

						<div>
							<label className="block text-xs font-semibold text-on-surface mb-1">Duration (Minutes)</label>
							<input
								type="number"
								min="0"
								value={form.durationMinutes}
								onChange={(e) => setForm((p) => ({ ...p, durationMinutes: e.target.value }))}
								className="form-input w-full text-sm py-1.5"
								placeholder="60"
							/>
						</div>

						<div>
							<label className="block text-xs font-semibold text-on-surface mb-1">Description</label>
							<textarea
								value={form.description}
								onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
								rows={2}
								className="form-input w-full text-sm py-1.5 resize-none"
								placeholder="Detailed description of the service process, materials used, and warranty..."
							/>
						</div>

						<div className="flex items-center gap-2 pt-0.5">
							<input
								type="checkbox"
								id="is-active"
								checked={form.isActive}
								onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
								className="w-4 h-4 accent-secondary rounded cursor-pointer"
							/>
							<label htmlFor="is-active" className="text-xs font-medium text-on-surface cursor-pointer select-none">
								Active — available in catalogue and job card selection
							</label>
						</div>
					</form>
				</Dialog>
			)}

			{/* ── View Details Dialog ─────────────────────────────────────────── */}
			{viewingService && (
				<Dialog
					open={!!viewingService}
					onOpenChange={(open) => !open && setViewingService(null)}
					title={viewingService.name}
					description={`Category: ${viewingService.category || 'General'}`}
					footer={
						<>
							<Button variant="secondary" onClick={() => setViewingService(null)}>
								Close
							</Button>
							<Button
								variant="primary"
								icon={<PlusCircle className="w-4 h-4" />}
								onClick={() => {
									const s = viewingService;
									setViewingService(null);
									handleAddToJobCard(s);
								}}
							>
								Add to Job Card
							</Button>
						</>
					}
					size="lg"
				>
					<div className="space-y-4 text-sm">
						<p className="text-on-surface leading-relaxed">{viewingService.description || 'No detailed description available.'}</p>

						<div className="grid grid-cols-3 gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/60">
							<div>
								<span className="text-xs text-on-surface-variant block uppercase font-semibold">Duration</span>
								<span className="font-medium text-on-surface flex items-center gap-1.5 mt-0.5">
									<Clock className="w-4 h-4 text-secondary" />
									{formatDuration(viewingService.durationMinutes)}
								</span>
							</div>
							<div>
								<span className="text-xs text-on-surface-variant block uppercase font-semibold">Starting Price</span>
								<span className="font-bold text-secondary text-base block mt-0.5">
									{formatPrice(viewingService.price)}
								</span>
							</div>
							<div>
								<span className="text-xs text-on-surface-variant block uppercase font-semibold">Status</span>
								<div className="mt-0.5">
									<StatusBadge status={viewingService.isActive ? 'active' : 'inactive'} />
								</div>
							</div>
						</div>
					</div>
				</Dialog>
			)}
		</div>
	);
}
