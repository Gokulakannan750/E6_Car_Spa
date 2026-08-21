import { useState } from 'react';
import { Plus, MoreHorizontal, User } from 'lucide-react';
import { mockStaff } from '../../mock/data/staff';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';

export function StaffAdvancesPage() {
 const [search, setSearch] = useState('');

 const filteredStaff = mockStaff.filter(s => s.status === 'active' && (search ? s.name.toLowerCase().includes(search.toLowerCase()) : true));

 return (
 <div className="space-y-5 animate-fade-in">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold tracking-tight text-headline-lg font-semibold text-on-surface tracking-tight">Staff Advances</h1>
 <p className="text-sm text-on-surface-variant mt-1">Track staff advances and payments</p>
 </div>
 <Button icon={<Plus className="w-4 h-4" />}>Record Advance</Button>
 </div>

 {/* Filters */}
 <div className="app-card p-4">
 <div className="flex items-center gap-3">
 <div className="flex-1 max-w-md">
 <SearchInput placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 </div>
 </div>

 {/* Staff List */}
 <div className="app-card overflow-hidden">
 <table className="app-table">
 <thead>
 <tr>
 <th>Staff</th>
 <th>Role</th>
 <th>Phone</th>
 <th>Total Advances</th>
 <th>Pending</th>
 <th>Status</th>
 <th className="w-10"></th>
 </tr>
 </thead>
 <tbody>
 {filteredStaff.map(s => (
 <tr key={s.id}>
 <td>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
 <User className="w-4 h-4" />
 </div>
 <div>
 <p className="font-medium text-sm text-on-surface font-medium">{s.name}</p>
 <p className="text-sm text-on-surface-variant">{s.email}</p>
 </div>
 </div>
 </td>
 <td className="text-sm">{s.role}</td>
 <td className="text-sm font-mono">{s.phone}</td>
 <td className="text-sm">₹2,500</td>
 <td className="text-sm text-warning font-medium">₹1,000</td>
 <td><StatusBadge status="active" /></td>
 <td><button className="p-1.5 rounded-md hover:bg-surface-container transition-colors"><MoreHorizontal className="w-4 h-4 text-on-surface-variant" /></button></td>
 </tr>
 ))}
 </tbody>
 </table>
 {filteredStaff.length === 0 && (
 <div className="py-12 text-center">
 <p className="text-sm text-on-surface-variant">No staff found.</p>
 </div>
 )}
 </div>
 </div>
 );
}
