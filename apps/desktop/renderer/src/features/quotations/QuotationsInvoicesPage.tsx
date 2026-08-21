import { useState, useMemo } from 'react';
import { MoreHorizontal, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { mockInvoices } from '../../mock/data/invoices';
import { mockJobCards } from '../../mock/data/jobCards';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';

export function QuotationsInvoicesPage() {
 const [tab, setTab] = useState<'quotations' | 'invoices'>('quotations');
 const [search, setSearch] = useState('');

 const mockQuotationsData = useMemo(() => {
 return mockJobCards.filter(jc => jc.status !== 'draft').map(jc => ({
 id: jc.id,
 number: `QT-2026-${jc.id.slice(-3).toUpperCase()}`,
 jobCardId: jc.id,
 customerName: jc.customerName,
 registrationNumber: jc.registrationNumber,
 vehicleMake: jc.make,
 vehicleModel: jc.model,
 services: jc.services,
 subtotal: jc.subtotal,
 discount: jc.discount,
 tax: jc.tax,
 totalAmount: jc.totalAmount,
 status: jc.status === 'completed' ? 'accepted' : jc.status === 'cancelled' ? 'rejected' : 'sent',
 createdAt: jc.createdAt,
 validUntil: new Date(new Date(jc.createdAt).getTime() + 7 * 86400000).toISOString().split('T')[0],
 }));
 }, []);

 const filteredQuotations = useMemo(() => {
 return mockQuotationsData.filter(q => {
 if (search && !q.number.toLowerCase().includes(search.toLowerCase()) && !q.customerName.toLowerCase().includes(search.toLowerCase())) return false;
 return true;
 });
 }, [search, mockQuotationsData]);

 const filteredInvoices = useMemo(() => {
 return mockInvoices.filter(inv => {
 if (search && !inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) && !inv.customerName.toLowerCase().includes(search.toLowerCase())) return false;
 return true;
 });
 }, [search]);

 return (
 <div className="space-y-5 animate-fade-in">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold tracking-tight text-headline-lg font-semibold text-on-surface tracking-tight">Quotations &amp; Invoices</h1>
 <p className="text-sm text-on-surface-variant mt-1">Manage quotations and invoices</p>
 </div>
 <div className="flex gap-2">
 <Link to="/quotations/new"><Button variant="secondary" icon={<FileText className="w-4 h-4" />}>New Quotation</Button></Link>
 <Link to="/invoices/new"><Button icon={<FileText className="w-4 h-4" />}>New Invoice</Button></Link>
 </div>
 </div>

 <div className="app-card p-0 overflow-hidden">
 <div className="flex border-b border-outline-variant">
 <button onClick={() => setTab('quotations')} className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${tab === 'quotations' ? 'text-secondary border-b-2 border-secondary bg-surface-container-low' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'}`}>
 Quotations ({mockQuotationsData.length})
 </button>
 <button onClick={() => setTab('invoices')} className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${tab === 'invoices' ? 'text-secondary border-b-2 border-secondary bg-surface-container-low' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'}`}>
 Invoices ({mockInvoices.length})
 </button>
 </div>

 <div className="p-4">
 <SearchInput placeholder={`Search ${tab}...`} value={search} onChange={e => setSearch(e.target.value)} />
 </div>

 <div className="overflow-x-auto">
 {tab === 'quotations' ? (
 <table className="app-table">
 <thead>
 <tr>
 <th>Quotation</th>
 <th>Customer</th>
 <th>Vehicle</th>
 <th>Amount</th>
 <th>Valid Until</th>
 <th>Status</th>
 <th className="w-10"></th>
 </tr>
 </thead>
 <tbody>
 {filteredQuotations.map(q => (
 <tr key={q.id}>
 <td><Link to={`/quotations/${q.id}`} className="font-medium text-sm text-secondary font-medium hover:underline">{q.number}</Link></td>
 <td><p className="font-medium text-sm text-on-surface font-medium">{q.customerName}</p></td>
 <td className="text-sm">{q.registrationNumber} · {q.vehicleMake} {q.vehicleModel}</td>
 <td className="font-medium text-sm text-on-surface font-medium">₹{q.totalAmount.toLocaleString()}</td>
 <td className="text-sm text-on-surface-variant">{q.validUntil}</td>
 <td><StatusBadge status={q.status} /></td>
 <td><button className="p-1.5 rounded-md hover:bg-surface-container transition-colors"><MoreHorizontal className="w-4 h-4 text-on-surface-variant" /></button></td>
 </tr>
 ))}
 </tbody>
 </table>
 ) : (
 <table className="app-table">
 <thead>
 <tr>
 <th>Invoice</th>
 <th>Customer</th>
 <th>Vehicle</th>
 <th>Total</th>
 <th>Paid</th>
 <th>Balance</th>
 <th>Status</th>
 <th className="w-10"></th>
 </tr>
 </thead>
 <tbody>
 {filteredInvoices.map(inv => (
 <tr key={inv.id}>
 <td><Link to={`/invoices/${inv.id}`} className="font-medium text-sm text-secondary font-medium hover:underline">{inv.invoiceNumber}</Link></td>
 <td><p className="font-medium text-sm text-on-surface font-medium">{inv.customerName}</p></td>
 <td className="text-sm">{inv.vehicleRegistration} · {inv.vehicleMake} {inv.vehicleModel}</td>
 <td className="font-medium text-sm text-on-surface font-medium">₹{inv.totalAmount.toLocaleString()}</td>
 <td className="text-sm text-success">{inv.paidAmount > 0 ? `₹${inv.paidAmount.toLocaleString()}` : '—'}</td>
 <td className={`text-sm font-medium ${inv.balance > 0 ? 'text-error' : 'text-success'}`}>{inv.balance > 0 ? `₹${inv.balance.toLocaleString()}` : '—'}</td>
 <td><StatusBadge status={inv.status} /></td>
 <td><button className="p-1.5 rounded-md hover:bg-surface-container transition-colors"><MoreHorizontal className="w-4 h-4 text-on-surface-variant" /></button></td>
 </tr>
 ))}
 </tbody>
 </table>
 )}

 {(tab === 'quotations' ? filteredQuotations : filteredInvoices).length === 0 && (
 <div className="py-12 text-center">
 <p className="text-sm text-on-surface-variant">No {tab} found matching your search.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
