import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getJobCardById, getCustomerById, getVehiclesByCustomer, type JobCardServiceDto, type CustomerDto, type VehicleDto } from '../../lib/api';

export default function InvoiceEditor() {
 const { id: jobCardId } = useParams<{ id: string }>();

 const { data: jobCard, isLoading: jobCardLoading } = useQuery({
 queryKey: ['job-card', jobCardId],
 queryFn: async () => {
 if (!jobCardId) return null;
 return getJobCardById(jobCardId);
 },
 enabled: !!jobCardId,
 });

 const customerQuery = useQuery({
 queryKey: ['customer', jobCard?.customer?.id],
 queryFn: async () => {
 if (!jobCard?.customer?.id) return null;
 return getCustomerById(jobCard.customer.id);
 },
 enabled: !!jobCard?.customer?.id,
 });

 const vehicleQuery = useQuery({
 queryKey: ['vehicles', jobCard?.customer?.id],
 queryFn: async () => {
 if (!jobCard?.customer?.id) return [];
 return getVehiclesByCustomer(jobCard.customer.id);
 },
 enabled: !!jobCard?.customer?.id,
 });

 if (!jobCardId) return <div className="p-8 text-center text-error">Invalid job card ID</div>;

 const customer: CustomerDto | undefined = customerQuery.data ?? undefined;
 const vehicle: VehicleDto | undefined = vehicleQuery.data ? vehicleQuery.data.find(v => v.id === (jobCard as any)?.vehicle?.id) : undefined;
 const services: JobCardServiceDto[] = jobCard ? (jobCard.services ?? []) : [];
 const subtotal = services.reduce((sum, s) => sum + s.unitPrice * s.quantity, 0);
 const grandTotal = jobCard ? jobCard.totalAmount : subtotal;

 return (
 <div className="space-y-6 max-w-4xl">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <div>
 <h1 className="font-display-lg text-display-lg md:text-headline-lg font-bold text-on-surface tracking-tight">Invoice Editor</h1>
 <p className="font-medium text-sm text-on-surface-variant">Create and edit invoices from job cards</p>
 </div>
 <div className="flex gap-2">
 <button className="flex items-center justify-center gap-1 bg-secondary text-white font-semibold text-xs uppercase tracking-wider text-label-md uppercase px-4 py-2 rounded hover:opacity-90 shadow-sm transition-opacity">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
 Save
 </button>
 <button className="flex items-center justify-center gap-1 border border-on-surface text-on-surface font-semibold text-xs uppercase tracking-wider text-label-md uppercase px-4 py-2 rounded hover:bg-surface-variant transition-colors">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span>
 Print
 </button>
 <button className="flex items-center justify-center gap-1 border border-on-surface text-on-surface font-semibold text-xs uppercase tracking-wider text-label-md uppercase px-4 py-2 rounded hover:bg-surface-variant transition-colors">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>picture_as_pdf</span>
 PDF
 </button>
 </div>
 </div>

 {/* Invoice Form */}
 <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-6 space-y-6">
 {/* Invoice Header */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <h3 className="font-semibold text-xs uppercase tracking-wider text-label-md text-on-surface-variant uppercase mb-2">Invoice To</h3>
 <div className="space-y-2">
 {jobCard && customer ? (
 <>
 <p className="font-medium text-sm text-on-surface">{customer.name}</p>
 <p className="text-sm text-sm text-on-surface-variant">{customer.phoneNumber}</p>
 {customer.address && <p className="text-sm text-sm text-on-surface-variant">{customer.address}</p>}
 {vehicle && (
 <p className="text-sm text-sm text-on-surface-variant">
 {vehicle.make} {vehicle.model} - {vehicle.registrationNumber}
 </p>
 )}
 </>
 ) : (
 <>
 <p className="text-sm text-sm text-on-surface-variant">-</p>
 </>
 )}
 </div>
 </div>
 <div className="space-y-2">
 <div>
 <label className="font-semibold text-xs uppercase tracking-wider text-label-md text-on-surface-variant uppercase block mb-1">Invoice Number</label>
 <input className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" defaultValue={jobCard ? `INV-${jobCard.jobCardNumber}` : '-'} readOnly />
 </div>
 <div>
 <label className="font-semibold text-xs uppercase tracking-wider text-label-md text-on-surface-variant uppercase block mb-1">Date</label>
 <input type="date" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" defaultValue={new Date().toISOString().split('T')[0]} />
 </div>
 <div>
 <label className="font-semibold text-xs uppercase tracking-wider text-label-md text-on-surface-variant uppercase block mb-1">Due Date</label>
 <input type="date" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" />
 </div>
 </div>
 </div>

 {/* Line Items Table */}
 {jobCardLoading ? (
 <div className="text-center py-8">
 <span className="material-symbols-outlined text-4xl text-outline-variant animate-spin block mb-2">progress_activity</span>
 <p className="font-medium text-on-surface-variant">Loading invoice…</p>
 </div>
 ) : !jobCard ? (
 <div className="text-center py-8">
 <p className="font-medium text-on-surface-variant">No job card selected.</p>
 </div>
 ) : (
 <div>
 <h3 className="font-semibold text-xs uppercase tracking-wider text-label-md text-on-surface-variant uppercase mb-3">Line Items</h3>
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse" style={{ minWidth: '600px' }}>
 <thead>
 <tr className="border-b border-outline-variant" style={{ backgroundColor: '#f8f9fa' }}>
 {['Service', 'Qty', 'Unit Price (₹)', 'Total (₹)', ''].map((h) => (
 <th key={h} className="py-2 px-3 font-semibold text-xs uppercase tracking-wider text-label-md text-outline uppercase tracking-wider whitespace-nowrap">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-outline-variant divide-opacity-50 text-sm text-sm">
 {services.map((item) => (
 <tr key={item.id}>
 <td className="py-2 px-3 text-on-surface">{item.serviceName}</td>
 <td className="py-2 px-3 text-on-surface">{item.quantity}</td>
 <td className="py-2 px-3 text-on-surface">₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
 <td className="py-2 px-3 text-on-surface font-medium">₹{(item.unitPrice * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
 <td className="py-2 px-3 text-right">
 <button className="p-1 text-outline hover:text-error rounded transition-colors">
 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Notes */}
 <div>
 <h3 className="font-semibold text-xs uppercase tracking-wider text-label-md text-on-surface-variant uppercase mb-2">Notes</h3>
 <textarea
 className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary resize-none"
 rows={3}
 placeholder="Add notes or terms..."
 defaultValue="Payment due within 15 days. Thank you for your business!"
 />
 </div>

 {/* Totals */}
 <div className="flex justify-end">
 <div className="w-full max-w-xs space-y-2">
 <div className="flex justify-between text-sm text-on-surface-variant">
 <span>Subtotal</span>
 <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
 </div>
 <div className="flex justify-between text-lg font-semibold text-headline-sm text-on-surface border-t border-outline-variant pt-2">
 <span>Grand Total</span>
 <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
