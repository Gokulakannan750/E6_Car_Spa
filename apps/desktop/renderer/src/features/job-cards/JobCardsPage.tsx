import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
	Plus,
	Search,
	FileText,
	RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { getJobCards } from '../../lib/api';
import type { JobCardListDto } from '../../lib/api';

type StatusFilter = 'all' | '0' | '1' | '3' | '5';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
 { key: 'all', label: 'All' },
 { key: '0', label: 'Draft' },
 { key: '1', label: 'In Progress' },
 { key: '3', label: 'Ready' },
 { key: '5', label: 'Delivered' },
];

export function JobCardsPage() {
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
 const [items, setItems] = useState<JobCardListDto[]>([]);
 const [totalCount, setTotalCount] = useState(0);
 const [page, setPage] = useState(1);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const pageSize = 10;

	const loadJobCards = useCallback(async () => {
	 setLoading(true);
	 setError(null);
	 try {
	 const response = await getJobCards({
	 page,
	 pageSize,
	 status: statusFilter !== 'all' ? statusFilter : undefined,
	 search: search.trim() || undefined,
	 });
	 setItems(response.items);
	 setTotalCount(response.totalCount);
	 } catch (err) {
	 setError(err instanceof Error ? err.message : 'Failed to load job cards');
	 } finally {
	 setLoading(false);
	 }
	}, [page, pageSize, statusFilter, search]);

 useEffect(() => {
 loadJobCards();
 }, [loadJobCards]);

 const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

 useEffect(() => {
 if (page > totalPages) setPage(totalPages);
 }, [page, totalPages]);

 const formatCurrency = (value: number) =>
 new Intl.NumberFormat('en-IN', {
 style: 'currency',
 currency: 'INR',
 minimumFractionDigits: 0,
 maximumFractionDigits: 0,
 }).format(value);

 const formatDate = (iso: string) => {
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) return iso;
 return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
 };

 const handleConvertToInvoice = async (jobCard: JobCardListDto) => {
 // TODO: Implement convert to invoice flow
 // For now, show a placeholder message
 alert(`Convert to invoice coming soon!\n\nJob Card: ${jobCard.jobCardNumber}\nCustomer: ${jobCard.customerName}`);
 };

 return (
 <div className="space-y-5">
 <PageHeader
 title="Job Cards"
 description="Track and manage all service job cards"
 breadcrumb={[{ label: 'Home', to: '/dashboard' }, { label: 'Job Cards' }]}
 actions={
 <Link to="/job-cards/new">
 <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
 <Plus className="h-4 w-4" />
 New Job Card
 </button>
 </Link>
 }
 />

 {error && (
 <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
 <FileText className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
 <div className="flex-1">
 <p className="text-sm font-medium text-red-800">Failed to load job cards</p>
 <p className="mt-0.5 text-sm text-red-600">{error}</p>
 </div>
 <button
 onClick={loadJobCards}
 className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
 >
 <RefreshCw className="h-3.5 w-3.5" />
 Retry
 </button>
 </div>
 )}

 <div className="space-y-4">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="relative w-full max-w-md">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
 <input
 type="text"
 value={search}
 onChange={(e) => {
 setSearch(e.target.value);
 setPage(1);
 }}
 placeholder="Search by job card, customer or vehicle..."
 className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
 />
 </div>

 <div className="flex items-center gap-2">
 {STATUS_FILTERS.map((f) => (
 <button
 key={f.key}
 onClick={() => {
 setStatusFilter(f.key);
 setPage(1);
 }}
 className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
 statusFilter === f.key
 ? 'bg-blue-600 text-white'
 : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
 }`}
 >
 {f.label}
 </button>
 ))}
 </div>
 </div>

 {!loading && items.length === 0 && !error && (
 <EmptyState
 icon={<FileText className="h-12 w-12 text-slate-300" />}
 title="No job cards found"
 description="Create your first job card to get started, or adjust your search filters."
 action={
 <Link to="/job-cards/new">
 <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
 <Plus className="h-4 w-4" />
 New Job Card
 </button>
 </Link>
 }
 />
 )}

 {!loading && items.length > 0 && (
 <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
 <th className="whitespace-nowrap px-5 py-3.5 font-semibold">Job Card</th>
 <th className="whitespace-nowrap px-5 py-3.5 font-semibold">Customer</th>
 <th className="whitespace-nowrap px-5 py-3.5 font-semibold">Vehicle</th>
 <th className="whitespace-nowrap px-5 py-3.5 font-semibold text-right">Total</th>
 <th className="whitespace-nowrap px-5 py-3.5 font-semibold">Date</th>
 <th className="whitespace-nowrap px-5 py-3.5 font-semibold text-center">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {items.map((jc) => (
 <tr key={jc.id} className="group hover:bg-blue-50/30 transition-colors">
 <td className="px-5 py-4">
 <Link
 to={`/job-cards/${jc.id}`}
 className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
 >
 {jc.jobCardNumber}
 </Link>
 </td>
 <td className="px-5 py-4">
 <div>
 <p className="font-medium text-slate-900">{jc.customerName}</p>
 <p className="mt-0.5 text-xs text-slate-500">{jc.customerPhone}</p>
 </div>
 </td>
 <td className="px-5 py-4">
 <div className="flex items-center gap-2">
 <span className="text-slate-400">
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6.75a2.25 2.25 0 0 0 2.25-2.25V15m-4.5 6.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H9.75m11.25-7.5h-6m6 0V3.75" />
 </svg>
 </span>
 <span className="text-slate-700">{jc.make} {jc.model}</span>
 </div>
 <p className="mt-0.5 text-xs text-slate-500">{jc.registrationNumber}</p>
 </td>
 <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
 {formatCurrency(jc.totalAmount)}
 </td>
 <td className="whitespace-nowrap px-5 py-4 text-slate-600">
 <div className="flex items-center gap-1.5">
 <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
 </svg>
 {formatDate(jc.createdAt)}
 </div>
 </td>
 <td className="px-5 py-4">
 <div className="flex items-center justify-center">
 <button
 onClick={() => handleConvertToInvoice(jc)}
 className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
 title="Convert to Invoice"
 >
 <FileText className="h-3.5 w-3.5" />
 Convert to Invoice
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {totalCount > pageSize && (
 <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
 <p className="text-xs text-slate-500">
 Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
 </p>
 <div className="flex items-center gap-1">
 <button
 disabled={page <= 1}
 onClick={() => setPage((p) => p - 1)}
 className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
 >
 Previous
 </button>
 {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
 <button
 key={p}
 onClick={() => setPage(p)}
 className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
 p === page
 ? 'bg-blue-600 text-white'
 : 'text-slate-600 hover:bg-slate-100'
 }`}
 >
 {p}
 </button>
 ))}
 <button
 disabled={page >= totalPages}
 onClick={() => setPage((p) => p + 1)}
 className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
 >
 Next
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {loading && (
 <div className="flex items-center justify-center py-20">
 <div className="flex flex-col items-center gap-3">
 <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
 <p className="text-sm text-slate-500">Loading job cards…</p>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
