import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { getStaffAdvances, getStaffList, createStaffAdvance } from '../../lib/api';
import type { StaffDto, CreateStaffAdvanceInput } from '../../lib/api';

function formatINR(value: number): string {
 return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type StatusFilter = 'all' | 'Pending' | 'Paid' | 'Partially Paid';

export default function StaffAdvances() {
 const qc = useQueryClient();
 const [search, setSearch] = useState('');
 const [page, setPage] = useState(1);
 const [staffFilter, setStaffFilter] = useState<string>('');
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
 const [showModal, setShowModal] = useState(false);

 // Staff list for dropdown
 const { data: staffList } = useQuery({
 queryKey: ['staff-list'],
 queryFn: () => getStaffList(),
 });

 // Advances
 const { data: advancesData, isLoading, error } = useQuery({
 queryKey: ['staff-advances', page, staffFilter, statusFilter, search],
 queryFn: () => getStaffAdvances({
 page,
 pageSize: 20,
 staffId: staffFilter || undefined,
 status: statusFilter === 'all' ? undefined : statusFilter,
 search: search || undefined,
 }),
 });

 const advances = advancesData?.items ?? [];
 const totalPages = advancesData ? Math.max(1, Math.ceil(advancesData.totalCount / advancesData.pageSize)) : 1;

 const createMutation = useMutation({
 mutationFn: createStaffAdvance,
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['staff-advances'] });
 setShowModal(false);
 },
 });

 // Reset page on filter change
 useEffect(() => { setPage(1); }, [staffFilter, statusFilter, search]);

 return (
 <div className="space-y-5 animate-fade-in">
 {/* Page header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold tracking-tight text-headline-lg font-semibold text-on-surface">
 Staff Advances
 </h1>
 <p className="text-sm text-on-surface-variant mt-1">
 Manage employee advances and repayments
 </p>
 </div>
 <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>
 Record Advance
 </Button>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-4 gap-4">
 <KpiCard label="Total Advances" value={advancesData ? formatINR(advancesData.items.reduce((s, a) => s + a.amount, 0)) : '—'} />
 <KpiCard label="Outstanding" value={advancesData ? formatINR(advancesData.items.filter(a => a.status === 'Pending').reduce((s, a) => s + a.amount, 0)) : '—'} />
 <KpiCard label="Staff with Advances" value={String(new Set(advancesData?.items.map(a => a.staffId) ?? []).size)} />
 <KpiCard label="Transactions" value={String(advancesData?.totalCount ?? 0)} />
 </div>

 {/* Filters */}
 <div className="app-card p-4">
 <div className="flex items-center gap-3 flex-wrap">
 <div className="flex-1 min-w-[200px] max-w-md">
 <input
 className="input-field w-full"
 placeholder="Search advances..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 />
 </div>
 <select
 value={staffFilter}
 onChange={e => setStaffFilter(e.target.value)}
 className="input-field w-48"
 >
 <option value="">All Staff</option>
 {staffList?.map(s => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 <select
 value={statusFilter}
 onChange={e => setStatusFilter(e.target.value as StatusFilter)}
 className="input-field w-40"
 >
 <option value="all">All Status</option>
 <option value="Pending">Pending</option>
 <option value="Paid">Paid</option>
 <option value="Partially Paid">Partially Paid</option>
 </select>
 </div>
 </div>

 {/* Table */}
 <div className="app-card overflow-hidden">
 <table className="app-table">
 <thead>
 <tr>
 <th>Employee</th>
 <th>Date</th>
 <th>Type</th>
 <th>Amount</th>
 <th>Payment Method</th>
 <th>Status</th>
 <th className="text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {isLoading && (
 <tr><td colSpan={7} className="py-12 text-center text-on-surface-variant">Loading advances...</td></tr>
 )}
 {error && (
 <tr><td colSpan={7} className="py-12 text-center text-error">Failed to load advances.</td></tr>
 )}
 {!isLoading && !error && advances.map(a => (
 <tr key={a.id}>
 <td>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-sm font-semibold">
 {a.staffName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
 </div>
 <div>
 <p className="font-medium text-sm text-on-surface">{a.staffName}</p>
 <p className="text-xs text-on-surface-variant">{a.staffRole ?? ''}</p>
 </div>
 </div>
 </td>
 <td className="text-sm">{new Date(a.advanceDate).toLocaleDateString('en-IN')}</td>
 <td className="text-sm">{a.advanceType}</td>
 <td className="text-sm font-semibold">{formatINR(a.amount)}</td>
 <td className="text-sm text-on-surface-variant">{a.paymentMethod ?? '—'}</td>
 <td>
 <StatusBadge status={a.status === 'Paid' ? 'active' : a.status === 'Pending' ? 'inactive' : 'warning'} />
 </td>
 <td className="text-right">
 <button
 className="text-secondary hover:underline text-sm"
 onClick={() => {}}
 >
 View
 </button>
 </td>
 </tr>
 ))}
 {!isLoading && !error && advances.length === 0 && (
 <tr>
 <td colSpan={7} className="py-16 text-center">
 <p className="text-on-surface-variant text-sm">No staff advances found.</p>
 <Button variant="secondary" className="mt-3" onClick={() => setShowModal(true)}>Record First Advance</Button>
 </td>
 </tr>
 )}
 </tbody>
 </table>

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between px-6 py-3 border-t border-outline-variant">
 <span className="text-sm text-on-surface-variant">
 Page {page} of {totalPages}
 </span>
 <div className="flex gap-2">
 <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded border border-outline text-sm disabled:opacity-40">Prev</button>
 <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded border border-outline text-sm disabled:opacity-40">Next</button>
 </div>
 </div>
 )}
 </div>

 {/* Create Advance Modal */}
 {showModal && (
 <NewAdvanceModal
 staffList={staffList ?? []}
 onClose={() => setShowModal(false)}
 onSave={async (data) => {
 await createMutation.mutateAsync(data);
 }}
 isLoading={createMutation.isPending}
 error={createMutation.error?.message ?? null}
 />
 )}
 </div>
 );
}

function KpiCard({ label, value }: { label: string; value: string }) {
 return (
 <div className="app-card p-4">
 <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
 <p className="text-xl font-semibold text-on-surface">{value}</p>
 </div>
 );
}

function NewAdvanceModal({
 staffList: _staffList,
 onClose,
 onSave,
 isLoading,
 error,
}: {
 staffList: StaffDto[];
 onClose: () => void;
 onSave: (data: CreateStaffAdvanceInput) => Promise<void>;
 isLoading: boolean;
 error: string | null;
}) {
 const [staffName, setStaffName] = useState('');
 const [staffRole, setStaffRole] = useState('');
 const [advanceType, setAdvanceType] = useState('Emergency');
 const [description, setDescription] = useState('');
 const [amount, setAmount] = useState('');
 const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
 const [paymentMethod, setPaymentMethod] = useState('Cash');
 const [notes, setNotes] = useState('');
 const [formError, setFormError] = useState('');

 const submit = async () => {
 setFormError('');
 if (!staffName.trim()) { setFormError('Staff name is required.'); return; }
 if (!advanceType.trim()) { setFormError('Advance type is required.'); return; }
 const amt = parseFloat(amount);
 if (isNaN(amt) || amt <= 0) { setFormError('Amount must be greater than zero.'); return; }
 if (!advanceDate) { setFormError('Date is required.'); return; }

 await onSave({
 staffName: staffName.trim(),
 staffRole: staffRole.trim() || undefined,
 advanceType: advanceType.trim(),
 description: description.trim() || undefined,
 amount: amt,
 advanceDate,
 paymentMethod: paymentMethod || undefined,
 notes: notes.trim() || undefined,
 });
 };

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
 <div className="app-card w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
 <h2 className="text-lg font-semibold text-on-surface mb-4">Record New Advance</h2>

 {formError && <p className="text-sm text-error mb-3">{formError}</p>}
 {error && <p className="text-sm text-error mb-3">{error}</p>}

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Staff Name *</label>
 <input
 className="input-field"
 value={staffName}
 onChange={e => setStaffName(e.target.value)}
 placeholder="Enter staff name"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Role</label>
 <input
 className="input-field"
 value={staffRole}
 onChange={e => setStaffRole(e.target.value)}
 placeholder="e.g., Senior Technician"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Advance Type *</label>
 <select className="input-field" value={advanceType} onChange={e => setAdvanceType(e.target.value)}>
 <option value="Emergency">Emergency</option>
 <option value="Salary Advance">Salary Advance</option>
 <option value="Festival">Festival</option>
 <option value="Medical">Medical</option>
 <option value="Other">Other</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Amount (INR) *</label>
 <input
 type="number"
 className="input-field"
 value={amount}
 onChange={e => setAmount(e.target.value)}
 placeholder="0.00"
 min="0.01"
 step="0.01"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Date *</label>
 <input
 type="date"
 className="input-field"
 value={advanceDate}
 onChange={e => setAdvanceDate(e.target.value)}
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Payment Method</label>
 <select className="input-field" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
 <option value="Cash">Cash</option>
 <option value="Bank Transfer">Bank Transfer</option>
 <option value="UPI">UPI</option>
 <option value="Cheque">Cheque</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Description</label>
 <textarea
 className="input-field"
 value={description}
 onChange={e => setDescription(e.target.value)}
 rows={2}
 placeholder="Reason for advance..."
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-on-surface mb-1">Notes</label>
 <textarea
 className="input-field"
 value={notes}
 onChange={e => setNotes(e.target.value)}
 rows={2}
 placeholder="Additional notes..."
 />
 </div>
 </div>

 <div className="flex gap-3 mt-6">
 <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
 <Button className="flex-1" onClick={submit} loading={isLoading}>Save Advance</Button>
 </div>
 </div>
 </div>
 );
}
