import { useParams } from 'react-router-dom';
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
 const queryClient = useQueryClient();
 const [isEditing, setIsEditing] = useState(false);
 const [editingServices, setEditingServices] = useState<ServiceRow[]>([]);
 const [editingNotes, setEditingNotes] = useState('');
 const [showServicePicker, setShowServicePicker] = useState(false);
 const [serviceSearch, setServiceSearch] = useState('');
 const [isSaving, setIsSaving] = useState(false);
 const [isPrinting, setIsPrinting] = useState(false);

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

 const discountTotal = useMemo(
 () => editingServices.reduce((sum, s) => sum + s.discountAmount, 0),
 [editingServices],
 );

 const total = subtotal + taxTotal - discountTotal;

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
 discountAmount: s.discountAmount,
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

 const handlePrint = useCallback(async () => {
 if (!id || isPrinting) return;
 setIsPrinting(true);
 try {
 const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5298'}/api/job-cards/${id}/print`, {
 method: 'GET',
 });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 const blob = await res.blob();
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `job-card-${jobCard?.jobCardNumber ?? id}.pdf`;
 a.click();
 URL.revokeObjectURL(url);
 } catch (err) {
 alert(err instanceof Error ? err.message : 'Failed to print job card');
 } finally {
 setIsPrinting(false);
 }
 }, [id, isPrinting, jobCard]);

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
 <div className="space-y-6">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
 <div>
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
 <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 border border-on-surface text-on-surface font-semibold text-xs uppercase tracking-wider text-label-md uppercase px-4 py-2 rounded hover:bg-surface-variant transition-colors">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
 Edit
 </button>
 <button onClick={handlePrint} disabled={isPrinting} className="flex items-center gap-1 border border-on-surface text-on-surface font-semibold text-xs uppercase tracking-wider text-label-md uppercase px-4 py-2 rounded hover:bg-surface-variant transition-colors disabled:opacity-50">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span>
 {isPrinting ? 'Printing…' : 'Print'}
 </button>
 </>
 ) : (
 <>
 <button onClick={cancelEditing} className="px-4 py-2 border border-outline-variant rounded text-on-surface text-sm hover:bg-surface-variant transition-colors">
 Cancel
 </button>
 <button onClick={saveChanges} disabled={isSaving} className="bg-secondary text-white px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
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
 <table className="w-full">
 <thead>
 <tr className="border-b border-outline-variant" style={{ backgroundColor: '#f8f9fa' }}>
 {['Service', 'Unit Price', 'Qty', 'Discount', 'Tax %', 'Amount', ''].map((h) => (
 <th key={h} className="py-2 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
 {h}
 </th>
 ))}
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
 <td className="px-4 py-3 text-on-surface-variant">
 {isEditing ? (
 <input
 type="number"
 min={0}
 step={0.01}
 value={svc.discountAmount}
 onChange={(e) => {
 const val = parseFloat(e.target.value);
 setEditingServices((prev) => prev.map((s, i) => (i === index ? { ...s, discountAmount: isNaN(val) ? 0 : val } : s)));
 }}
 className="w-24 bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-sm"
 />
 ) : (
 svc.discountAmount > 0 ? formatCurrency(svc.discountAmount) : '—'
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
 <div className="flex justify-between text-sm">
 <span className="text-on-surface-variant">Discount</span>
 <span className="text-on-surface">{formatCurrency(discountTotal)}</span>
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
 );
}
