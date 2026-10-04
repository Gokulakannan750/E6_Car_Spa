import { useState, useEffect, useRef } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { getServices, type ServiceDto } from '../../lib/api';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { CreateCustomServiceDialog } from './CreateCustomServiceDialog';

export interface ServicePickerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectService: (service: ServiceDto) => void;
	initialCatalog?: ServiceDto[];
}

function formatCurrency(amount: number): string {
	return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ServicePickerDialog({
	open,
	onOpenChange,
	onSelectService,
	initialCatalog = [],
}: ServicePickerDialogProps) {
	const [searchQuery, setSearchQuery] = useState('');
	const [services, setServices] = useState<ServiceDto[]>(initialCatalog);
	const [isLoading, setIsLoading] = useState(false);
	const [showCreateCustom, setShowCreateCustom] = useState(false);
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Sync initial catalog
	useEffect(() => {
		if (initialCatalog.length > 0 && !searchQuery.trim()) {
			setServices(initialCatalog.filter((s) => s.isActive));
		}
	}, [initialCatalog, searchQuery]);

	// Auto-focus search input when opened
	useEffect(() => {
		if (open) {
			setSearchQuery('');
			const timer = setTimeout(() => {
				searchInputRef.current?.focus();
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [open]);

	// Debounced search
	useEffect(() => {
		if (!open) return;
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

		const query = searchQuery.trim().toLowerCase();
		if (!query) {
			if (initialCatalog.length > 0) {
				setServices(initialCatalog.filter((s) => s.isActive));
				setIsLoading(false);
				return;
			}
			// Fetch active catalogue services
			setIsLoading(true);
			getServices({ page: 1, pageSize: 50, isActive: true })
				.then((res) => {
					setServices(res?.items?.filter((s) => s.isActive) || []);
				})
				.catch((err) => {
					console.warn('Failed to load services:', err);
				})
				.finally(() => {
					setIsLoading(false);
				});
			return;
		}

		setIsLoading(true);
		searchTimerRef.current = setTimeout(async () => {
			try {
				const result = await getServices({ page: 1, pageSize: 50, search: query, isActive: true });
				if (result && result.items) {
					const activeItems = result.items.filter((s) => s.isActive);
					const scored = activeItems
						.map((s) => {
							const name = s.name.toLowerCase();
							const category = (s.category || '').toLowerCase();
							let score = 999;

							if (name.startsWith(query)) {
								score = 1;
							} else if (name.split(/\s+/).some((w) => w.startsWith(query))) {
								score = 2;
							} else if (name.includes(query)) {
								score = 3;
							} else if (category.startsWith(query)) {
								score = 4;
							} else if (category.includes(query)) {
								score = 5;
							} else if (query.length >= 3 && s.description?.toLowerCase().includes(query)) {
								score = 6;
							}

							return { service: s, score };
						})
						.filter((item) => item.score < 999)
						.sort((a, b) => a.score - b.score || a.service.name.localeCompare(b.service.name));

					setServices(scored.map((item) => item.service));
				} else {
					setServices([]);
				}
			} catch (err) {
				console.warn('Failed to search services:', err);
				setServices([]);
			} finally {
				setIsLoading(false);
			}
		}, 150);

		return () => {
			if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		};
	}, [searchQuery, open, initialCatalog]);

	const handleServiceChosen = (svc: ServiceDto) => {
		onSelectService(svc);
		onOpenChange(false);
	};

	const handleCustomCreated = (createdSvc: ServiceDto) => {
		onSelectService(createdSvc);
		setShowCreateCustom(false);
		onOpenChange(false);
	};

	return (
		<>
			<Dialog
				open={open && !showCreateCustom}
				onOpenChange={onOpenChange}
				title="Add Service"
				description="Search existing services or create a custom service"
				size="lg"
				footer={
					<div className="flex items-center justify-between w-full">
						<Button
							type="button"
							variant="secondary"
							size="sm"
							icon={<Plus className="w-3.5 h-3.5" />}
							onClick={() => setShowCreateCustom(true)}
						>
							Create Custom Service
						</Button>
						<Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
					</div>
				}
			>
				<div className="space-y-4 py-1">
					{/* Search input and action */}
					<div className="flex items-center gap-3">
						<div className="relative flex-1">
							<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
							<input
								ref={searchInputRef}
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search services (e.g. Foam Wash, Ceramic Coating)..."
								className="form-input pl-10 pr-9 py-2.5 w-full bg-white shadow-sm"
							/>
							{searchQuery && (
								<button
									type="button"
									onClick={() => setSearchQuery('')}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
									aria-label="Clear search"
								>
									<X className="w-4 h-4" />
								</button>
							)}
						</div>
						<Button
							type="button"
							variant="secondary"
							icon={<Plus className="w-3.5 h-3.5" />}
							onClick={() => setShowCreateCustom(true)}
						>
							Create Custom Service
						</Button>
					</div>

					{/* Service List */}
					<div className="border border-outline-variant rounded-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-outline-variant/60 bg-white">
						{isLoading ? (
							<div className="p-8 text-center text-on-surface-variant flex items-center justify-center gap-2">
								<Loader2 className="w-4 h-4 animate-spin text-secondary" />
								<span className="text-sm">Searching services…</span>
							</div>
						) : services.length === 0 ? (
							<div className="p-8 text-center space-y-3">
								<p className="text-sm text-on-surface-variant">
									{searchQuery.trim()
										? `No services found matching "${searchQuery}"`
										: 'No services available in catalogue.'}
								</p>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									icon={<Plus className="w-3.5 h-3.5" />}
									onClick={() => setShowCreateCustom(true)}
								>
									Create Custom Service
								</Button>
							</div>
						) : (
							services.map((svc) => (
								<div
									key={svc.id}
									onClick={() => handleServiceChosen(svc)}
									className="px-4 py-3 hover:bg-surface-container-low cursor-pointer flex items-center justify-between transition-colors group"
								>
									<div className="space-y-0.5">
										<p className="text-sm font-semibold text-on-surface group-hover:text-secondary transition-colors">
											{svc.name}
										</p>
										<div className="flex items-center gap-2 text-xs text-on-surface-variant">
											<span className="font-medium text-secondary">{svc.category || 'General Services'}</span>
											<span>·</span>
											<span>{svc.taxPercentage}% GST</span>
										</div>
									</div>
									<div className="text-right flex items-center gap-3">
										<span className="text-sm font-bold text-secondary font-mono">
											{formatCurrency(svc.price)}
										</span>
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={(e) => {
												e.stopPropagation();
												handleServiceChosen(svc);
											}}
										>
											Add
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</Dialog>

			{/* Create Custom Service Dialog */}
			<CreateCustomServiceDialog
				open={showCreateCustom}
				onOpenChange={setShowCreateCustom}
				onServiceCreated={handleCustomCreated}
			/>
		</>
	);
}
