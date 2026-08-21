import { useState } from 'react';
import { Plus, Search, MoreHorizontal, MapPin, Phone, Users, UserPlus, Calendar } from 'lucide-react';
import { mockStaff } from '../../mock/data/staff';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';

interface MockShowroom {
 id: string;
 name: string;
 address: string;
 phone: string;
 status: 'active' | 'inactive';
 staffIds: string[];
}

const mockShowrooms: MockShowroom[] = [
 { id: 'sr1', name: 'Anna Nagar Showroom', address: '12, 2nd Avenue, Anna Nagar, Chennai', phone: '044-12345678', status: 'active', staffIds: ['st1', 'st2', 'st5'] },
 { id: 'sr2', name: 'T Nagar Showroom', address: '45, Usman Road, T Nagar, Chennai', phone: '044-87654321', status: 'active', staffIds: ['st3', 'st4'] },
 { id: 'sr3', name: 'Velachery Showroom', address: '78, Velachery Main Road, Chennai', phone: '044-23456789', status: 'inactive', staffIds: ['st1'] },
];

export function ShowroomPage() {
 const [search, setSearch] = useState('');
 const [selectedShowroom, setSelectedShowroom] = useState<string | null>(null);
 const [showAssignDialog, setShowAssignDialog] = useState(false);
 const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
 const [assignStaff, setAssignStaff] = useState<string[]>([]);

 const filtered = mockShowrooms.filter(s => search ? s.name.toLowerCase().includes(search.toLowerCase()) : true);
 const selected = selectedShowroom ? mockShowrooms.find(s => s.id === selectedShowroom) : null;

 const openAssignDialog = () => {
 setAssignStaff(selected?.staffIds || []);
 setShowAssignDialog(true);
 };

 const detailFooter = (
 <>
 <Button variant="secondary" onClick={() => setSelectedShowroom(null)}>Close</Button>
 <Button icon={<UserPlus className="w-4 h-4" />} onClick={openAssignDialog}>Manage Staff</Button>
 </>
 );

 const assignFooter = (
 <>
 <Button variant="secondary" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
 <Button onClick={() => setShowAssignDialog(false)}>Save Assignments</Button>
 </>
 );

 return (
 <div className="space-y-5 animate-fade-in">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Showroom</h1>
 <p className="text-sm text-on-surface-variant mt-1">Manage showrooms and staff assignments</p>
 </div>
 <Button icon={<Plus className="w-4 h-4" />}>Add Showroom</Button>
 </div>

 <div className="app-card p-4">
 <div className="flex items-center gap-3">
 <div className="flex-1 max-w-md">
 <SearchInput placeholder="Search showrooms..." value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <div className="text-sm text-on-surface-variant">
 {filtered.length} showroom{filtered.length !== 1 ? 's' : ''}
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filtered.map(sr => (
 <div key={sr.id} className="app-card p-5 hover:shadow-elevation-2 transition-shadow">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
 <MapPin className="w-5 h-5 text-secondary" />
 </div>
 <div>
 <h3 className="font-medium text-on-surface">{sr.name}</h3>
 <p className="text-sm text-on-surface-variant">{sr.address}</p>
 </div>
 </div>
 <StatusBadge status={sr.status === 'active' ? 'active' : 'inactive'} />
 </div>

 <div className="mt-4 space-y-2">
 <div className="flex items-center gap-2 text-sm text-on-surface-variant">
 <Phone className="w-3.5 h-3.5" />
 {sr.phone}
 </div>
 <div className="flex items-center gap-2 text-sm text-on-surface-variant">
 <Users className="w-3.5 h-3.5" />
 {sr.staffIds.length} staff assigned today
 </div>
 </div>

 <div className="flex items-center gap-2 mt-4 pt-3 border-t border-outline-variant/50">
 <button onClick={() => setSelectedShowroom(sr.id)} className="flex-1 text-center py-1.5 rounded-md text-sm font-medium text-secondary hover:bg-secondary/5 transition-colors">
 View Details
 </button>
 <button onClick={() => { setSelectedShowroom(sr.id); setTimeout(() => setShowAssignDialog(true), 0); }} className="flex-1 text-center py-1.5 rounded-md text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors">
 Assign Staff
 </button>
 </div>
 </div>
 ))}
 </div>

 {filtered.length === 0 && (
 <div className="app-card py-12 text-center">
 <p className="text-sm text-on-surface-variant">No showrooms found matching your search.</p>
 </div>
 )}

 {/* Showroom Details Dialog */}
 <Dialog open={!!selectedShowroom && !showAssignDialog} onOpenChange={open => !open && setSelectedShowroom(null)} title={selected?.name || ''} description="Showroom details and staff" size="lg" footer={detailFooter}>
 {selected && (
 <div className="space-y-5">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-sm text-on-surface-variant mb-1">Address</p>
 <p className="text-sm text-on-surface">{selected.address}</p>
 </div>
 <div>
 <p className="text-sm text-on-surface-variant mb-1">Phone</p>
 <p className="text-sm text-on-surface">{selected.phone}</p>
 </div>
 </div>

 <div>
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-lg font-semibold text-on-surface">Assigned Staff</h3>
 </div>
 <div className="space-y-2">
 {mockStaff.filter(st => selected.staffIds.includes(st.id)).map(st => (
 <div key={st.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary text-sm font-medium">
 {st.name.split(' ').map(n => n[0]).join('')}
 </div>
 <div>
 <p className="font-medium text-on-surface">{st.name}</p>
 <p className="text-sm text-on-surface-variant">{st.role}</p>
 </div>
 </div>
 <StatusBadge status={st.status} />
 </div>
 ))}
 {selected.staffIds.length === 0 && (
 <p className="text-sm text-on-surface-variant py-3">No staff assigned to this showroom.</p>
 )}
 </div>
 </div>
 </div>
 )}
 </Dialog>

 {/* Staff Assignment Dialog */}
 <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog} title="Daily Staff Assignment" description={selected ? `Assign staff for ${selected.name}` : ''} size="md" footer={assignFooter}>
 {selected && (
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Date</label>
 <div className="relative">
 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
 <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} className="form-input pl-9" />
 </div>
 </div>
 <div>
 <p className="text-sm text-on-surface-variant mb-2">Available Staff</p>
 <div className="space-y-2">
 {mockStaff.filter(s => s.status === 'active').map(st => {
 const isAssigned = assignStaff.includes(st.id);
 return (
 <label key={st.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant cursor-pointer hover:border-secondary/30 transition-colors">
 <div className="flex items-center gap-3">
 <input type="checkbox" checked={isAssigned} onChange={e => setAssignStaff(prev => e.target.checked ? [...prev, st.id] : prev.filter(id => id !== st.id))} className="w-4 h-4 rounded border-outline-variant text-secondary" />
 <div>
 <p className="font-medium text-on-surface">{st.name}</p>
 <p className="text-sm text-on-surface-variant">{st.role}</p>
 </div>
 </div>
 {isAssigned && <StatusBadge status="active" />}
 </label>
 );
 })}
 </div>
 </div>
 </div>
 )}
 </Dialog>
 </div>
 );
}
