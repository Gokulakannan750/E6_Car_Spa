import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { getStaffAdvances, getStaffList, createStaffAdvance } from '../../lib/api';

function formatINR(value: number): string {
 return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type StatusFilter = 'all' | 'Pending' | 'Paid' | 'Partially Paid';

export function StaffAdvancesPage() {
 const qc = useQueryClient();
 const [search, setSearch] = useState('');
 const [page, setPage] = useState(1);
 const [staffFilter, setStaffFilter] = useState('');
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
 const [showModal, setShowModal] = useState(false);

 // Form state
 const [formStaffName, setFormStaffName] = useState('');
 const [formStaffRole, setFormStaffRole] = useState('');
 const [formAdvanceType, setFormAdvanceType] = useState('Emergency');
 const [formDescription, setFormDescription] = useState('');
 const [formAmount, setFormAmount] = useState('');
 const [formAdvanceDate, setFormAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
 const [formPaymentMethod, setFormPaymentMethod] = useState('Cash');
 const [formNotes, setFormNotes] = useState('');
 const [formError, setFormError] = useState('');

 const resetForm = () => {
 setFormStaffName('');
 setFormStaffRole('');
 setFormAdvanceType('Emergency');
 setFormDescription('');
 setFormAmount('');
 setFormAdvanceDate(new Date().toISOString().split('T')[0]);
 setFormPaymentMethod('Cash');
 setFormNotes('');
 setFormError('');
 };

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
 resetForm();
 },
 });

 // Reset page on filter change
 useEffect(() => { setPage(1); }, [staffFilter, statusFilter, search]);

 const handleModalSubmit = async () => {
 setFormError('');
 if (!formStaffName.trim()) { setFormError('Staff name is required.'); return; }
 if (!formAdvanceType.trim()) { setFormError('Advance type is required.'); return; }
 const amt = parseFloat(formAmount);
 if (isNaN(amt) || amt <= 0) { setFormError('Amount must be greater than zero.'); return; }
 if (!formAdvanceDate) { setFormError('Date is required.'); return; }

 try {
 await createMutation.mutateAsync({
 staffName: formStaffName.trim(),
 staffRole: formStaffRole.trim() || undefined,
 advanceType: formAdvanceType.trim(),
 description: formDescription.trim() || undefined,
 amount: amt,
 advanceDate: formAdvanceDate,
 paymentMethod: formPaymentMethod || undefined,
 notes: formNotes.trim() || undefined,
 });
 } catch {
 // onError handled by mutation state
 }
 };

 const openModal = () => {
 resetForm();
 setShowModal(true);
 };

 return (
 <div className="space-y-5 animate-fade-in">
 {/* Page header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold tracking-tight text-headline-lg font-semibold text-on-surface tracking-tight">
 Staff Advances
 </h1>
 <p className="text-sm text-on-surface-variant mt-1">
 Manage employee advances and repayments
 </p>
 </div>
 <Button icon={<Plus className="w-4 h-4" />} onClick={openModal}>
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
 <Button variant="secondary" className="mt-3" onClick={openModal}>Record First Advance</Button>
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
 <Dialog
 open={showModal}
 onOpenChange={(open) => {
 if (!open) { resetForm(); setShowModal(false); }
 }}
 title="Record New Advance"
 description="Create a new staff advance entry"
 footer={
 <>
 <Button variant="secondary" onClick={() => { resetForm(); setShowModal(false); }}>Cancel</Button>
 <Button onClick={handleModalSubmit} loading={createMutation.isPending}>Save Advance</Button>
 </>
 }
 size="lg"
 >
 <NewAdvanceFormFields
 staffName={formStaffName}
 setStaffName={setFormStaffName}
 staffRole={formStaffRole}
 setStaffRole={setFormStaffRole}
 advanceType={formAdvanceType}
 setAdvanceType={setFormAdvanceType}
 description={formDescription}
 setDescription={setFormDescription}
 amount={formAmount}
 setAmount={setFormAmount}
 advanceDate={formAdvanceDate}
 setAdvanceDate={setFormAdvanceDate}
 paymentMethod={formPaymentMethod}
 setPaymentMethod={setFormPaymentMethod}
 notes={formNotes}
 setNotes={setFormNotes}
 formError={formError}
 />
 </Dialog>
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

interface FormFieldProps {
 staffName: string;
 setStaffName: (v: string) => void;
 staffRole: string;
 setStaffRole: (v: string) => void;
 advanceType: string;
 setAdvanceType: (v: string) => void;
 description: string;
 setDescription: (v: string) => void;
 amount: string;
 setAmount: (v: string) => void;
 advanceDate: string;
 setAdvanceDate: (v: string) => void;
 paymentMethod: string;
 setPaymentMethod: (v: string) => void;
 notes: string;
 setNotes: (v: string) => void;
 formError: string;
}

function NewAdvanceFormFields({
 staffName, setStaffName,
 staffRole, setStaffRole,
 advanceType, setAdvanceType,
 description, setDescription,
 amount, setAmount,
 advanceDate, setAdvanceDate,
 paymentMethod, setPaymentMethod,
 notes, setNotes,
 formError,
}: FormFieldProps) {
 return (
 <div className="space-y-4">
 {formError && (
 <div className="flex items-center gap-2 bg-error/10 text-error text-sm rounded-lg px-4 py-2.5">
 <span className="font-medium">{formError}</span>
 </div>
 )}

 <div className="grid grid-cols-2 gap-4">
 <div className="col-span-2 sm:col-span-1">
 <label className="block text-sm font-medium text-on-surface mb-1">Staff Name <span className="text-error">*</span></label>
 <input
 className="input-field"
 value={staffName}
 onChange={e => setStaffName(e.target.value)}
 placeholder="Enter staff name"
 />
 </div>

 <div className="col-span-2 sm:col-span-1">
 <label className="block text-sm font-medium text-on-surface mb-1">Role</label>
 <input
 className="input-field"
 value={staffRole}
 onChange={e => setStaffRole(e.target.value)}
 placeholder="e.g., Senior Technician"
 />
 </div>

 <div className="col-span-2 sm:col-span-1">
 <label className="block text-sm font-medium text-on-surface mb-1">Advance Type <span className="text-error">*</span></label>
 <select className="input-field" value={advanceType} onChange={e => setAdvanceType(e.target.value)}>
 <option value="Emergency">Emergency</option>
 <option value="Salary Advance">Salary Advance</option>
 <option value="Festival">Festival</option>
 <option value="Medical">Medical</option>
 <option value="Other">Other</option>
 </select>
 </div>

 <div className="col-span-2 sm:col-span-1">
 <label className="block text-sm font-medium text-on-surface mb-1">Amount (INR) <span className="text-error">*</span></label>
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
 <label className="block text-sm font-medium text-on-surface mb-1">Date <span className="text-error">*</span></label>
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

 <div className="col-span-2">
 <label className="block text-sm font-medium text-on-surface mb-1">Description</label>
 <textarea
 className="input-field resize-none"
 value={description}
 onChange={e => setDescription(e.target.value)}
 rows={2}
 placeholder="Reason for advance..."
 />
 </div>

 <div className="col-span-2">
 <label className="block text-sm font-medium text-on-surface mb-1">Notes</label>
 <textarea
 className="input-field resize-none"
 value={notes}
 onChange={e => setNotes(e.target.value)}
 rows={2}
 placeholder="Additional notes..."
 />
 </div>
 </div>
 </div>
 );
}
