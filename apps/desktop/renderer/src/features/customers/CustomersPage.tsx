import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Phone, Car, Calendar, ArrowUpRight } from 'lucide-react';
import { mockCustomers } from '../../mock/data/customers';
import { mockVehicles } from '../../mock/data/vehicles';
import { mockJobCards } from '../../mock/data/jobCards';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';

export function CustomersPage() {
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

 const filtered = useMemo(() => {
 return mockCustomers.filter(c => {
 if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.phone.includes(search)) return false;
 if (statusFilter !== 'all' && c.status !== statusFilter) return false;
 return true;
 });
 }, [search, statusFilter]);

 const getVehicles = (cid: string) => mockVehicles.filter(v => v.customerId === cid);
 const selected = selectedCustomer ? mockCustomers.find(c => c.id === selectedCustomer) : null;

 const footerButtons = (
 <>
 <Button variant="secondary" onClick={() => setSelectedCustomer(null)}>Close</Button>
 <Button icon={<Plus className="w-4 h-4" />}>New Job Card</Button>
 </>
 );

 return (
 <div className="space-y-5 animate-fade-in">
 {/* Page Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Customers</h1>
 <p className="text-sm text-on-surface-variant mt-1">Manage your customer database and vehicle records</p>
 </div>
 <Button icon={<Plus className="w-4 h-4" />}>Add Customer</Button>
 </div>

 {/* Filters Bar */}
 <div className="app-card p-4">
 <div className="flex items-center gap-3">
 <div className="flex-1 max-w-md">
 <SearchInput placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <div className="flex items-center gap-1">
 {['all', 'active', 'inactive'].map(s => (
 <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === s ? 'bg-secondary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
 {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
 </button>
 ))}
 </div>
 <div className="ml-auto text-sm text-on-surface-variant">
 {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
 </div>
 </div>
 </div>

 {/* Customer Table */}
 <div className="app-card overflow-hidden">
 <div className="overflow-x-auto">
 <table className="app-table">
 <thead>
 <tr>
 <th>Customer</th>
 <th>Phone</th>
 <th>Vehicles</th>
 <th>Total Visits</th>
 <th>Outstanding</th>
 <th>Last Visit</th>
 <th>Status</th>
 <th className="w-10"></th>
 </tr>
 </thead>
 <tbody>
 {filtered.map(c => {
 const vehicles = getVehicles(c.id);
 return (
 <tr key={c.id} className="cursor-pointer" onClick={() => setSelectedCustomer(c.id)}>
 <td>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-semibold">
 {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
 </div>
 <div>
 <p className="font-medium text-on-surface">{c.name}</p>
 <p className="text-sm text-on-surface-variant truncate max-w-[200px]">{c.address}</p>
 </div>
 </div>
 </td>
 <td><span className="font-mono text-sm">{c.phone}</span></td>
 <td>
 <div className="flex items-center gap-1 text-sm text-on-surface-variant">
 <Car className="w-3.5 h-3.5" />
 {vehicles.map(v => (
 <span key={v.id} className="bg-surface-container px-1.5 py-0.5 rounded text-xs font-medium">
 {v.registrationNumber}
 </span>
 ))}
 </div>
 </td>
 <td className="text-sm">{c.totalVisits}</td>
 <td>
 <span className={c.outstandingBalance > 0 ? 'text-error font-medium' : 'text-success font-medium'}>
 {c.outstandingBalance > 0 ? `₹${c.outstandingBalance.toLocaleString()}` : '—'}
 </span>
 </td>
 <td className="text-sm text-on-surface-variant">
 <div className="flex items-center gap-1">
 <Calendar className="w-3.5 h-3.5" />
 {new Date(c.lastVisit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
 </div>
 </td>
 <td><StatusBadge status={c.status} /></td>
 <td onClick={e => e.stopPropagation()}>
 <button className="p-1.5 rounded-md hover:bg-surface-container transition-colors">
 <MoreHorizontal className="w-4 h-4 text-on-surface-variant" />
 </button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 {filtered.length === 0 && (
 <div className="py-12 text-center">
 <p className="text-sm text-on-surface-variant">No customers found matching your search.</p>
 </div>
 )}
 </div>

 {/* Customer Detail Dialog */}
 <Dialog open={!!selectedCustomer} onOpenChange={open => !open && setSelectedCustomer(null)} title={selected?.name || ''} description="Customer details and vehicle information" size="lg" footer={footerButtons}>
 {selected && (
 <div className="space-y-5">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-sm text-on-surface-variant mb-1">Phone</p>
 <p className="font-medium text-on-surface flex items-center gap-1.5">
 <Phone className="w-4 h-4 text-secondary" />
 {selected.phone}
 </p>
 </div>
 <div>
 <p className="text-sm text-on-surface-variant mb-1">Email</p>
 <p className="font-medium text-on-surface">{selected.email}</p>
 </div>
 <div className="col-span-2">
 <p className="text-sm text-on-surface-variant mb-1">Address</p>
 <p className="text-sm text-on-surface">{selected.address}</p>
 </div>
 <div>
 <p className="text-sm text-on-surface-variant mb-1">Total Visits</p>
 <p className="font-medium text-on-surface">{selected.totalVisits}</p>
 </div>
 <div>
 <p className="text-sm text-on-surface-variant mb-1">Outstanding Balance</p>
 <p className={`font-medium ${selected.outstandingBalance > 0 ? 'text-error' : 'text-success'}`}>
 {selected.outstandingBalance > 0 ? `₹${selected.outstandingBalance.toLocaleString()}` : 'No balance'}
 </p>
 </div>
 </div>

 <div>
 <h3 className="text-lg font-semibold text-on-surface mb-3">Vehicles ({getVehicles(selected.id).length})</h3>
 <div className="space-y-2">
 {getVehicles(selected.id).map(v => (
 <div key={v.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-md bg-secondary/10 flex items-center justify-center">
 <Car className="w-4 h-4 text-secondary" />
 </div>
 <div>
 <p className="font-medium text-on-surface">{v.registrationNumber}</p>
 <p className="text-sm text-on-surface-variant">{v.make} {v.model} {v.color ? '· ' + v.color : ''}</p>
 </div>
 </div>
 <button className="text-sm text-secondary hover:underline flex items-center gap-0.5">
 View <ArrowUpRight className="w-3 h-3" />
 </button>
 </div>
 ))}
 {getVehicles(selected.id).length === 0 && (
 <p className="text-sm text-on-surface-variant py-3">No vehicles registered yet.</p>
 )}
 </div>
 </div>

 <div>
 <h3 className="text-lg font-semibold text-on-surface mb-3">Recent Activity</h3>
 <div className="space-y-2">
 {mockJobCards.filter(jc => jc.customerId === selected.id).slice(0, 3).map(jc => (
 <div key={jc.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant">
 <div>
 <p className="font-medium text-on-surface">{jc.jobCardNumber}</p>
 <p className="text-sm text-on-surface-variant">{new Date(jc.createdAt).toLocaleDateString('en-IN')} · {jc.services.length} service(s)</p>
 </div>
 <div className="text-right">
 <p className="text-sm font-medium text-on-surface">₹{jc.totalAmount.toLocaleString()}</p>
 <StatusBadge status={jc.status} />
 </div>
 </div>
 ))}
 {mockJobCards.filter(jc => jc.customerId === selected.id).length === 0 && (
 <p className="text-sm text-on-surface-variant py-3">No job cards yet.</p>
 )}
 </div>
 </div>
 </div>
 )}
 </Dialog>
 </div>
 );
}
