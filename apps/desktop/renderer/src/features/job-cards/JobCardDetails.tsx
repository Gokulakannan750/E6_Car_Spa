import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Edit2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
	getJobCardById,
	updateJobCardServices,
	getServices,
	type JobCardDto,
	type ServiceDto,
} from '../../lib/api';

// Status colors matching C# enum values
function getJobCardStatusColor(status: number): { bg: string; text: string; border: string } {
	const colors: Record<number, { bg: string; text: string; border: string }> = {
		0: { bg: '#f3f4f5', text: '#44474a', border: '#c5c6ca' },
		1: { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
		2: { bg: '#fca5a5', text: '#991b1b', border: '#fca5a5' },
		3: { bg: '#dcfce7', text: '#047857', border: '#bbf7d0' },
		4: { bg: '#f3f4f5', text: '#44474a', border: '#c5c6ca' },
		5: { bg: '#fef9c3', text: '#b45309', border: '#fde047' },
		6: { bg: '#dcfce7', text: '#047857', border: '#bbf7d0' },
		7: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
	};
	return colors[status] ?? colors[0];
}

function getJobCardStatusLabel(status: number): string {
	return ['Draft', 'In Progress', 'Quality Check', 'Ready', 'Invoiced', 'Paid', 'Delivered', 'Cancelled'][status] ?? `Status ${status}`;
}

function StatusBadge({ status }: { status: number }) {
	const c = getJobCardStatusColor(status);
	return (
		<span
			className="status-badge"
			style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
		>
			{getJobCardStatusLabel(status)}
		</span>
	);
}

function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('en-IN', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatDateOnly(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return dateStr;
	const day = String(d.getDate()).padStart(2, '0');
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const year = d.getFullYear();
	return `${day}-${month}-${year}`;
}

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

interface ServiceRow {
	serviceId: string;
	serviceName: string;
	quantity: number;
	discountAmount: number;
	unitPrice: number;
	taxPercentage: number;
	isNew: boolean;
}

function emptyServiceRow(svc: ServiceDto): ServiceRow {
	return {
		serviceId: svc.id,
		serviceName: svc.name,
		quantity: 1,
		discountAmount: 0,
		unitPrice: svc.price,
		taxPercentage: svc.taxPercentage,
		isNew: true,
	};
}

export default function JobCardDetails() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [isEditing, setIsEditing] = useState(false);
	const [editingServices, setEditingServices] = useState<ServiceRow[]>([]);
	const [editingNotes, setEditingNotes] = useState('');
	const [showServicePicker, setShowServicePicker] = useState(false);
	const [serviceSearch, setServiceSearch] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	const savedServicesRef = useRef<ServiceRow[]>([]);
	const savedNotesRef = useRef<string>('');

	const { data: jobCard, isLoading, isError, error, refetch } = useQuery<JobCardDto>({
		queryKey: ['job-card', id],
		queryFn: () => getJobCardById(id!),
		enabled: !!id,
	});

	const { data: serviceCatalog } = useQuery<{ items: ServiceDto[]; totalCount: number }>({
		queryKey: ['services', { page: 1, pageSize: 50, isActive: true }],
		queryFn: () => getServices({ page: 1, pageSize: 50, isActive: true }),
	});

	// When jobCard loads, initialize editing state
	useEffect(() => {
		if (jobCard && !isEditing) {
			const mapped: ServiceRow[] = jobCard.services.map((s) => ({
				serviceId: s.serviceId,
				serviceName: s.serviceName,
				quantity: s.quantity,
				discountAmount: s.discountAmount,
				unitPrice: s.unitPrice,
				taxPercentage: s.taxPercentage,
				isNew: false,
			}));
			setEditingServices(mapped);
			setEditingNotes(jobCard.notes ?? '');
		}
	}, [jobCard, isEditing]);

	const subtotal = useMemo(
		() => editingServices.reduce((sum, s) => sum + s.unitPrice * s.quantity, 0),
		[editingServices],
	);

	const taxTotal = useMemo(
		() => editingServices.reduce((sum, s) => sum + s.unitPrice * s.quantity * (s.taxPercentage / 100), 0),
		[editingServices],
	);

	const total = subtotal + taxTotal;

	const cancelEditing = useCallback(() => {
		setEditingServices(savedServicesRef.current);
		setEditingNotes(savedNotesRef.current);
		setIsEditing(false);
	}, []);

	const saveChanges = useCallback(async () => {
		if (!id || isSaving) return;
		setIsSaving(true);
		try {
			await updateJobCardServices(id, editingServices.map((s) => ({
				serviceId: s.serviceId,
				quantity: s.quantity,
				discountAmount: 0,
			})));
			await queryClient.invalidateQueries({ queryKey: ['job-card', id] });
			await queryClient.invalidateQueries({ queryKey: ['job-cards'] });
			setIsEditing(false);
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to save changes');
		} finally {
			setIsSaving(false);
		}
	}, [id, isSaving, editingServices, queryClient]);

	const handlePrint = useCallback(() => {
		window.print();
	}, []);

	const addService = useCallback(
		(svc: ServiceDto) => {
			setEditingServices((prev) => [...prev, emptyServiceRow(svc)]);
			setShowServicePicker(false);
			setServiceSearch('');
		},
		[],
	);

	const removeService = useCallback((index: number) => {
		setEditingServices((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const updateServiceQty = useCallback((index: number, qty: number) => {
		setEditingServices((prev) => prev.map((s, i) => (i === index ? { ...s, quantity: Math.max(1, qty) } : s)));
	}, []);

	const filteredServices = useMemo(() => {
		if (!serviceCatalog) return [];
		if (!serviceSearch.trim()) return serviceCatalog.items;
		const lower = serviceSearch.toLowerCase();
		return serviceCatalog.items.filter(
			(s) => (s.category?.toLowerCase().includes(lower) || s.name.toLowerCase().includes(lower)),
		);
	}, [serviceCatalog, serviceSearch]);

	if (!id) return <div className="p-8 text-center text-error">Invalid job card ID</div>;

	if (isLoading) {
		return (
			<div className="p-8 text-center">
				<span className="material-symbols-outlined text-4xl text-outline-variant animate-spin block mb-2">progress_activity</span>
				<p className="font-medium text-on-surface-variant">Loading job card…</p>
			</div>
		);
	}

	if (isError || !jobCard) {
		return (
			<div className="p-8 text-center">
				<span className="material-symbols-outlined text-4xl text-error block mb-2">error</span>
				<p className="font-medium text-on-error-container">Failed to load job card</p>
				<p className="text-sm text-on-error-container opacity-70 mt-1">{(error as Error)?.message}</p>
				<button onClick={() => refetch()} className="mt-3 btn-primary">Retry</button>
			</div>
		);
	}

	return (
		<>
			{/* ═════════════════════════════════════════════════════════════════ */}
			{/* ── INTERACTIVE SCREEN VIEW (Hidden during print) ──────────────── */}
			{/* ═════════════════════════════════════════════════════════════════ */}
			<div className="space-y-6 no-print">
				{/* Page Header */}
				<div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
					<div>
						<button
							type="button"
							onClick={() => navigate('/job-cards')}
							className="inline-flex items-center text-xs font-semibold text-on-surface-variant hover:text-secondary mb-2 transition-colors cursor-pointer"
						>
							<ArrowLeft className="w-3.5 h-3.5 mr-1" />
							Back to Job Cards
						</button>
						<div className="flex items-center gap-3 mb-1">
							<h1 className="font-display-lg text-display-lg md:text-headline-lg font-bold text-on-surface tracking-tight">
								{jobCard.jobCardNumber}
							</h1>
							<StatusBadge status={jobCard.status} />
						</div>
						<p className="font-medium text-sm text-on-surface-variant">
							Created {formatDate(jobCard.createdAt)}
							{jobCard.updatedAt ? ` · Last updated ${formatDate(jobCard.updatedAt)}` : ''}
						</p>
					</div>
					<div className="flex gap-2">
						{!isEditing ? (
							<>
								<button
									onClick={() => setIsEditing(true)}
									className="flex items-center gap-1.5 border border-on-surface text-on-surface font-semibold text-xs uppercase tracking-wider px-4 py-2 rounded hover:bg-surface-variant transition-colors"
								>
									<Edit2 className="w-4 h-4" />
									Edit
								</button>
								<button
									onClick={handlePrint}
									className="flex items-center gap-1.5 bg-secondary text-white font-semibold text-xs uppercase tracking-wider px-4 py-2 rounded hover:opacity-90 transition-opacity shadow-sm"
								>
									<Printer className="w-4 h-4" />
									Print Job Card
								</button>
							</>
						) : (
							<>
								<button
									onClick={cancelEditing}
									className="px-4 py-2 border border-outline-variant rounded text-on-surface text-sm hover:bg-surface-variant transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={saveChanges}
									disabled={isSaving}
									className="bg-secondary text-white px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
								>
									{isSaving ? 'Saving…' : 'Save Changes'}
								</button>
							</>
						)}
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Main Content - Services */}
					<div className="lg:col-span-2 space-y-6">
						<div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden">
							<div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
								<h2 className="text-lg font-semibold text-headline-sm text-on-surface">Services</h2>
								{isEditing && (
									<button
										onClick={() => setShowServicePicker(true)}
										className="flex items-center gap-1 bg-secondary text-white px-3 py-1.5 rounded text-sm hover:opacity-90 transition-opacity"
									>
										<span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
										Add Service
									</button>
								)}
							</div>

							{editingServices.length === 0 ? (
								<div className="p-8 text-center text-on-surface-variant">No services added yet</div>
							) : (
								<div className="overflow-x-auto">
									<table className="app-table">
										<thead>
											<tr>
												<th>Service</th>
												<th>Unit Price</th>
												<th>Qty</th>
												<th>Tax %</th>
												<th>Amount</th>
												<th></th>
											</tr>
										</thead>
										<tbody>
											{editingServices.map((svc, index) => (
												<tr key={index} className="border-b border-outline-variant border-opacity-50">
													<td className="px-4 py-3 text-on-surface">{svc.serviceName}</td>
													<td className="px-4 py-3 text-on-surface-variant">
														{isEditing ? (
															<input
																type="number"
																min={0}
																step={0.01}
																value={svc.unitPrice}
																onChange={(e) => {
																	const val = parseFloat(e.target.value);
																	setEditingServices((prev) => prev.map((s, i) => (i === index ? { ...s, unitPrice: isNaN(val) ? 0 : val } : s)));
																}}
																className="w-24 bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-sm"
															/>
														) : (
															formatCurrency(svc.unitPrice)
														)}
													</td>
													<td className="px-4 py-3 text-on-surface-variant">
														{isEditing ? (
															<input
																type="number"
																min={1}
																value={svc.quantity}
																onChange={(e) => updateServiceQty(index, parseInt(e.target.value) || 1)}
																className="w-16 bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-sm"
															/>
														) : (
															svc.quantity
														)}
													</td>
													<td className="px-4 py-3 text-on-surface-variant">{svc.taxPercentage}%</td>
													<td className="px-4 py-3 text-on-surface font-medium">{formatCurrency(svc.unitPrice * svc.quantity)}</td>
													<td className="px-4 py-3 text-right">
														{isEditing && (
															<button
																onClick={() => removeService(index)}
																className="p-1.5 text-outline hover:text-error hover:bg-error-container/50 rounded transition-colors"
																title="Remove"
															>
																<span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
															</button>
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>

						{/* Notes */}
						<div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
							<h2 className="text-lg font-semibold text-headline-sm text-on-surface mb-3">Notes</h2>
							{isEditing ? (
								<textarea
									value={editingNotes}
									onChange={(e) => setEditingNotes(e.target.value)}
									rows={4}
									className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary resize-none"
									placeholder="Add notes about this job…"
								/>
							) : (
								<p className="text-sm text-on-surface-variant whitespace-pre-wrap">{jobCard.notes ?? 'No notes'}</p>
							)}
						</div>
					</div>

					{/* Sidebar - Summary */}
					<div className="space-y-6">
						{/* Customer Info */}
						<div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
							<h2 className="text-lg font-semibold text-headline-sm text-on-surface mb-3">Customer</h2>
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<span className="material-symbols-outlined text-outline" style={{ fontSize: '18px' }}>person</span>
									<span className="text-sm text-on-surface">{jobCard.customer.name}</span>
								</div>
								{jobCard.vehicle.registrationNumber && (
									<div className="flex items-center gap-2">
										<span className="material-symbols-outlined text-outline" style={{ fontSize: '18px' }}>directions_car</span>
										<span className="text-sm text-on-surface-variant font-mono">{jobCard.vehicle.registrationNumber}</span>
									</div>
								)}
								{jobCard.customer.phone && (
									<div className="flex items-center gap-2">
										<span className="material-symbols-outlined text-outline" style={{ fontSize: '18px' }}>phone</span>
										<span className="text-sm text-on-surface-variant">{jobCard.customer.phone}</span>
									</div>
								)}
							</div>
						</div>

						{/* Financial Summary */}
						<div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6">
							<h2 className="text-lg font-semibold text-headline-sm text-on-surface mb-4">Summary</h2>
							<div className="space-y-3">
								<div className="flex justify-between text-sm">
									<span className="text-on-surface-variant">Subtotal</span>
									<span className="text-on-surface">{formatCurrency(subtotal)}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-on-surface-variant">Tax</span>
									<span className="text-on-surface">{formatCurrency(taxTotal)}</span>
								</div>
								<div className="border-t border-outline-variant pt-3 flex justify-between">
									<span className="font-semibold text-on-surface">Total</span>
									<span className="font-bold text-on-surface">{formatCurrency(total)}</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Service Picker Modal */}
				{showServicePicker && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowServicePicker(false)}>
						<div className="bg-surface rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
							<h3 className="text-lg font-semibold text-headline-sm text-on-surface mb-3">Add Service</h3>
							<div className="relative mb-3">
								<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: '18px' }}>search</span>
								<input
									className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
									placeholder="Search services…"
									value={serviceSearch}
									onChange={(e) => setServiceSearch(e.target.value)}
									autoFocus
								/>
							</div>
							<div className="overflow-y-auto flex-1 border border-outline-variant rounded-lg">
								{filteredServices.length === 0 ? (
									<p className="p-4 text-center text-on-surface-variant text-sm">No services found</p>
								) : (
									filteredServices.map((svc) => (
										<button
											key={svc.id}
											onClick={() => addService(svc)}
											className="w-full text-left px-4 py-3 hover:bg-surface-variant transition-colors border-b border-outline-variant last:border-b-0"
										>
											<div className="text-sm font-medium text-on-surface">{svc.name}</div>
											<div className="flex items-center justify-between mt-1">
												<span className="text-xs text-on-surface-variant">{svc.category}</span>
												<span className="text-sm font-semibold text-secondary">{formatCurrency(svc.price)}</span>
											</div>
										</button>
									))
								)}
							</div>
							<div className="flex justify-end mt-3">
								<button onClick={() => setShowServicePicker(false)} className="px-4 py-2 border border-outline-variant rounded text-on-surface text-sm hover:bg-surface-variant transition-colors">
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* ═════════════════════════════════════════════════════════════════ */}
			{/* ── DEDICATED PRINT JOB CARD VIEW (Shown ONLY during print) ────── */}
			{/* ═════════════════════════════════════════════════════════════════ */}
			<div className="print-only bg-white text-slate-900 font-sans p-6 sm:p-8 max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between">
				<div>
					{/* ── Document Header ───────────────────────────────────────── */}
					<div className="flex items-center justify-between pb-3">
						{/* Left: Branding & Logo */}
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-xl tracking-wider shadow-sm">
								E6
							</div>
							<div>
								<h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase leading-none">
									E6 Car Spa
								</h1>
								<p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
									Automotive Detailing &amp; Care Workshop
								</p>
							</div>
						</div>

						{/* Right: Job Card Title & Ref */}
						<div className="text-right">
							<h2 className="text-2xl font-black tracking-tight text-red-600 uppercase leading-none">
								JOB CARD
							</h2>
							<p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mt-1">
								Workshop Work Order
							</p>
							<p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
								{jobCard.jobCardNumber}
							</p>
						</div>
					</div>

					{/* Red horizontal accent divider */}
					<div className="h-1 bg-red-600 w-full mb-5 rounded-full" />

					{/* ── Customer / Vehicle Info Table ─────────────────────────── */}
					<div className="border border-slate-300 rounded overflow-hidden mb-6 text-xs">
						<div className="grid grid-cols-2 divide-x divide-slate-300">
							{/* Left Column: Date, JC#, Customer, Phone */}
							<div className="divide-y divide-slate-200">
								<div className="flex">
									<span className="w-28 bg-slate-100 px-3 py-2 font-bold text-slate-700">Date</span>
									<span className="flex-1 px-3 py-2 text-slate-900 font-medium">{formatDateOnly(jobCard.createdAt)}</span>
								</div>
								<div className="flex">
									<span className="w-28 bg-slate-100 px-3 py-2 font-bold text-slate-700">Job Card No.</span>
									<span className="flex-1 px-3 py-2 text-slate-900 font-mono font-bold">{jobCard.jobCardNumber}</span>
								</div>
								<div className="flex">
									<span className="w-28 bg-slate-100 px-3 py-2 font-bold text-slate-700">Customer</span>
									<span className="flex-1 px-3 py-2 text-slate-900 font-bold">{jobCard.customer.name}</span>
								</div>
								<div className="flex">
									<span className="w-28 bg-slate-100 px-3 py-2 font-bold text-slate-700">Phone</span>
									<span className="flex-1 px-3 py-2 text-slate-900 font-mono">{jobCard.customer.phone || '—'}</span>
								</div>
							</div>

							{/* Right Column: Vehicle Reg, Make, Model, Color/Status */}
							<div className="divide-y divide-slate-200">
								<div className="flex">
									<span className="w-28 bg-slate-100 px-3 py-2 font-bold text-slate-700">Vehicle No.</span>
									<span className="flex-1 px-3 py-2 text-slate-900 font-mono font-bold">
										{jobCard.vehicle.registrationNumber || '—'}
									</span>
								</div>
								<div className="flex">
									<span className="w-28 bg-slate-100 px-3 py-2 font-bold text-slate-700">Make</span>
									<span className="flex-1 px-3 py-2 text-slate-900 font-medium">{jobCard.vehicle.make || '—'}</span>
								</div>
								<div className="flex">
									<span className="w-28 bg-slate-100 px-3 py-2 font-bold text-slate-700">Model</span>
									<span className="flex-1 px-3 py-2 text-slate-900 font-medium">
										{jobCard.vehicle.model}
										{jobCard.vehicle.variant ? ` (${jobCard.vehicle.variant})` : ''}
									</span>
								</div>
								{jobCard.vehicle.color ? (
									<div className="flex">
										<span className="w-28 bg-slate-100 px-3 py-2 font-bold text-slate-700">Color</span>
										<span className="flex-1 px-3 py-2 text-slate-900">{jobCard.vehicle.color}</span>
									</div>
								) : (
									<div className="flex">
										<span className="w-28 bg-slate-100 px-3 py-2 font-bold text-slate-700">Status</span>
										<span className="flex-1 px-3 py-2 text-slate-900 font-medium">{getJobCardStatusLabel(jobCard.status)}</span>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* ── Jobs To Be Done Section ───────────────────────────────── */}
					<div className="mb-6">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-2 h-3.5 bg-red-600 rounded-xs" />
							<h3 className="text-sm font-bold uppercase tracking-wider text-red-600">
								Jobs to be done
							</h3>
						</div>

						<table className="w-full border-collapse border border-slate-300 text-xs">
							<thead>
								<tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
									<th className="border border-slate-300 py-2.5 px-3 w-12 text-center">#</th>
									<th className="border border-slate-300 py-2.5 px-4 text-left">Service</th>
									<th className="border border-slate-300 py-2.5 px-3 w-20 text-center">Qty</th>
									<th className="border border-slate-300 py-2.5 px-4 w-28 text-center">Done</th>
								</tr>
							</thead>
							<tbody>
								{jobCard.services.length === 0 ? (
									<tr>
										<td colSpan={4} className="py-6 text-center text-slate-400 italic">
											No services specified for this job card.
										</td>
									</tr>
								) : (
									jobCard.services.map((svc, idx) => (
										<tr key={svc.id || idx} className="border-b border-slate-200">
											<td className="border border-slate-300 py-3 px-3 text-center font-mono font-medium text-slate-600">
												{idx + 1}
											</td>
											<td className="border border-slate-300 py-3 px-4 font-bold text-slate-900">
												{svc.serviceName}
											</td>
											<td className="border border-slate-300 py-3 px-3 text-center font-bold text-slate-900">
												{svc.quantity}
											</td>
											<td className="border border-slate-300 py-3 px-4 text-center">
												{/* Blank checkbox area for workshop employee to mark */}
												<div className="w-5 h-5 border-2 border-slate-400 rounded-sm mx-auto" />
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* ── Customer Notes / Instructions ─────────────────────────── */}
					{jobCard.notes && jobCard.notes.trim() && (
						<div className="border border-slate-300 rounded p-3 mb-6 text-xs bg-slate-50">
							<span className="font-bold text-slate-700 block mb-1">
								Customer Notes / Special Instructions:
							</span>
							<p className="text-slate-900 whitespace-pre-wrap font-medium">
								{jobCard.notes}
							</p>
						</div>
					)}
				</div>

				{/* ── Bottom: Signatures & Footer ───────────────────────────── */}
				<div className="pt-8">
					<div className="grid grid-cols-2 gap-12 text-xs">
						<div className="space-y-1.5">
							<div className="border-b border-slate-400 pb-1 w-4/5 min-h-[3.5rem] flex items-end">
								{/* Signature line */}
							</div>
							<p className="font-bold text-slate-800">Customer Signature</p>
							<p className="text-slate-500">Date: ________________________</p>
						</div>

						<div className="space-y-1.5 text-right">
							<div className="border-b border-slate-400 pb-1 w-4/5 min-h-[3.5rem] ml-auto flex items-end justify-end">
								{/* Signature line */}
							</div>
							<p className="font-bold text-slate-800">Authorised Signature</p>
							<p className="text-slate-500">Date: ________________________</p>
						</div>
					</div>

					<div className="pt-6 mt-6 text-center text-[10px] text-slate-400 border-t border-slate-200">
						<p className="font-semibold text-slate-600">E6 Car Spa • Workshop Work Order</p>
					</div>
				</div>
			</div>
		</>
	);
}
