import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal } from 'lucide-react';
import { mockServices } from '../../mock/data/services';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';

const categories = Array.from(new Set(mockServices.map(s => s.category)));

export function CataloguePage() {
 const [search, setSearch] = useState<string>('');
 const [categoryFilter, setCategoryFilter] = useState('all');
 const [showAddDialog, setShowAddDialog] = useState(false);
 const [newService, setNewService] = useState({ name: '', category: '', basePrice: '', description: '', duration: '' });

 const filtered = useMemo(() => {
 return mockServices.filter(s => {
 if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.category.toLowerCase().includes(search.toLowerCase())) return false;
 if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
 return true;
 });
 }, [search, categoryFilter]);

 return (
 <div className="space-y-5 animate-fade-in">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Service Catalogue</h1>
 <p className="text-sm text-on-surface-variant mt-1">Manage services and pricing</p>
 </div>
 <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddDialog(true)}>Add Service</Button>
 </div>

 <div className="app-card p-4">
 <div className="flex items-center gap-3">
 <div className="flex-1 max-w-md">
 <SearchInput placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <div className="flex items-center gap-1">
 <button onClick={() => setCategoryFilter('all')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${categoryFilter === 'all' ? 'bg-secondary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
 All
 </button>
 {categories.map(c => (
 <button key={c} onClick={() => setCategoryFilter(c)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${categoryFilter === c ? 'bg-secondary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
 {c}
 </button>
 ))}
 </div>
 <div className="ml-auto text-sm text-on-surface-variant">
 {filtered.length} service{filtered.length !== 1 ? 's' : ''}
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filtered.map(s => (
 <div key={s.id} className="app-card p-5 hover:shadow-elevation-2 transition-shadow">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
 <Wrench className="w-5 h-5 text-secondary" />
 </div>
 <div>
 <h3 className="font-medium text-on-surface">{s.name}</h3>
 <p className="text-sm text-on-surface-variant">{s.category} · {s.duration}</p>
 </div>
 </div>
 <StatusBadge status={s.status} />
 </div>
 <p className="text-sm text-on-surface-variant mt-3">{s.description}</p>
 <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/50">
 <span className="font-medium text-on-surface">₹{s.basePrice.toLocaleString()}</span>
 <button className="p-1.5 rounded-md hover:bg-surface-container transition-colors">
 <MoreHorizontal className="w-4 h-4 text-on-surface-variant" />
 </button>
 </div>
 </div>
 ))}
 </div>

 {filtered.length === 0 && (
 <div className="app-card py-12 text-center">
 <p className="text-sm text-on-surface-variant">No services found matching your search.</p>
 </div>
 )}

 <Dialog open={showAddDialog} onOpenChange={setShowAddDialog} title="Add New Service" description="Create a new service for the catalogue" footer={
 <>
 <Button variant="secondary" onClick={() => setShowAddDialog(false)}>Cancel</Button>
 <Button onClick={() => setShowAddDialog(false)}>Save Service</Button>
 </>
 }>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Service Name</label>
 <input className="form-input" placeholder="e.g. Premium Wash" value={newService.name} onChange={e => setNewService(p => ({ ...p, name: e.target.value }))} />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Category</label>
 <select className="form-input" value={newService.category} onChange={e => setNewService(p => ({ ...p, category: e.target.value }))}>
 <option value="">Select category</option>
 {categories.map(c => <option key={c} value={c}>{c}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Base Price (₹)</label>
 <input type="number" className="form-input" placeholder="500" value={newService.basePrice} onChange={e => setNewService(p => ({ ...p, basePrice: e.target.value }))} />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Duration</label>
 <input className="form-input" placeholder="30 min" value={newService.duration} onChange={e => setNewService(p => ({ ...p, duration: e.target.value }))} />
 </div>
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Status</label>
 <select className="form-input">
 <option value="active">Active</option>
 <option value="inactive">Inactive</option>
 </select>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Description</label>
 <textarea className="form-input" placeholder="Brief description..." value={newService.description} onChange={e => setNewService(p => ({ ...p, description: e.target.value }))} />
 </div>
 </div>
 </Dialog>
 </div>
 );
}
