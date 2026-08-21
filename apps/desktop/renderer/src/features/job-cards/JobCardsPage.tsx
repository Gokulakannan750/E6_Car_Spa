import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Calendar, Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import { mockJobCards, type MockJobCard } from '../../mock/data/jobCards';
import { jobCardStatuses } from '../../mock/data/jobCards';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';

export function JobCardsPage() {
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('all');

 const filtered = useMemo(() => {
 return mockJobCards.filter(jc => {
 if (search && !jc.jobCardNumber.toLowerCase().includes(search.toLowerCase()) && !jc.customerName.toLowerCase().includes(search.toLowerCase()) && !jc.registrationNumber.toLowerCase().includes(search.toLowerCase())) return false;
 if (statusFilter !== 'all' && jc.status !== statusFilter) return false;
 return true;
 });
 }, [search, statusFilter]);

 return (
 <div className="space-y-5 animate-fade-in">
 {/* Page Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold tracking-tight text-headline-lg font-semibold text-on-surface tracking-tight">Job Cards</h1>
 <p className="text-sm text-on-surface-variant mt-1">Track and manage all service job cards</p>
 </div>
 <Link to="/job-cards/new">
 <Button icon={<Plus className="w-4 h-4" />}>New Job Card</Button>
 </Link>
 </div>

 {/* Filters */}
 <div className="app-card p-4">
 <div className="flex items-center gap-3">
 <div className="flex-1 max-w-md">
 <SearchInput placeholder="Search by job card, customer or vehicle..." value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <div className="flex items-center gap-1">
 {['all', ...jobCardStatuses.map(s => s.value)].map(s => (
 <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === s ? 'bg-secondary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
 {s === 'all' ? 'All' : jobCardStatuses.find(st => st.value === s)?.label || s}
 </button>
 ))}
 </div>
 <div className="ml-auto text-sm text-on-surface-variant">
 {filtered.length} result{filtered.length !== 1 ? 's' : ''}
 </div>
 </div>
 </div>

 {/* Job Cards Table */}
 <div className="app-card overflow-hidden">
 <div className="overflow-x-auto">
 <table className="app-table">
 <thead>
 <tr>
 <th>Job Card</th>
 <th>Customer</th>
 <th>Vehicle</th>
 <th>Services</th>
 <th>Total</th>
 <th>Status</th>
 <th>Date</th>
 <th className="w-10"></th>
 </tr>
 </thead>
 <tbody>
 {filtered.map(jc => (
 <tr key={jc.id} className="cursor-pointer">
 <td>
 <Link to={`/job-cards/${jc.id}`} className="font-medium text-sm text-secondary font-medium hover:underline">
 {jc.jobCardNumber}
 </Link>
 </td>
 <td>
 <div>
 <p className="font-medium text-sm text-on-surface font-medium">{jc.customerName}</p>
 <p className="text-sm text-on-surface-variant">{jc.customerPhone}</p>
 </div>
 </td>
 <td>
 <div className="flex items-center gap-1.5 text-sm">
 <Car className="w-3.5 h-3.5 text-on-surface-variant" />
 <span className="font-mono text-xs">{jc.registrationNumber}</span>
 <span className="text-on-surface-variant">{jc.make} {jc.model}</span>
 </div>
 </td>
 <td>
 <span className="text-sm">{jc.services.length} item{jc.services.length !== 1 ? 's' : ''}</span>
 </td>
 <td className="font-medium text-sm text-on-surface font-medium">₹{jc.totalAmount.toLocaleString()}</td>
 <td><StatusBadge status={jc.status} /></td>
 <td className="text-sm text-on-surface-variant">
 <div className="flex items-center gap-1">
 <Calendar className="w-3.5 h-3.5" />
 {new Date(jc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
 </div>
 </td>
 <td>
 <button className="p-1.5 rounded-md hover:bg-surface-container transition-colors">
 <MoreHorizontal className="w-4 h-4 text-on-surface-variant" />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {filtered.length === 0 && (
 <div className="py-12 text-center">
 <p className="text-sm text-on-surface-variant">No job cards found matching your search.</p>
 </div>
 )}
 </div>
 </div>
 );
}
