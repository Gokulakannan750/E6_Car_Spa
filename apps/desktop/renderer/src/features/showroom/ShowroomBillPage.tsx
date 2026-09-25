import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	Building2,
	Calendar,
	Receipt,
	Plus,
	Trash2,
	ChevronLeft,
	ChevronRight,
	AlertCircle,
	ArrowLeft,
	MapPin,
	Phone,
	History,
	TrendingUp,
	CreditCard,
	CalendarCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { SearchInput } from '../../components/ui/SearchInput';
import { useAuth } from '../auth/auth-context';
import {
	getShowrooms,
	getShowroomDailyBill,
	setShowroomDailyBill,
	recordShowroomPayment,
	deleteShowroomPayment,
	getShowroomSummary,
	getShowroomsOutstanding,
	type ShowroomPaymentDto,
	type SetShowroomDailyBillInput,
	type RecordShowroomPaymentInput,
} from '../../lib/api';

// ── Formatting Utilities ───────────────────────────────────────────────────

function formatINR(val?: number | null): string {
	if (val === null || val === undefined) return '₹0.00';
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		maximumFractionDigits: 2,
	}).format(val);
}

function getTodayStr(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
	const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
	const parts = cleanDate.split('-').map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) return getTodayStr();
	const [year, month, day] = parts;
	const dt = new Date(year, month - 1, day + days);
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function formatDateHeading(dateStr: string): string {
	if (!dateStr) return '';
	const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
	const parts = cleanDate.split('-').map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
	const [year, month, day] = parts;
	const dt = new Date(year, month - 1, day);
	return dt.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
}

function formatDateTime(dateStr?: string | null): string {
	if (!dateStr) return '';
	const dt = new Date(dateStr);
	if (isNaN(dt.getTime())) return dateStr;
	return dt.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

function getPaymentStatusBadge(status: string) {
	switch (status) {
		case 'Paid':
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
					Paid
				</span>
			);
		case 'PartiallyPaid':
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
					Partially Paid
				</span>
			);
		case 'Unpaid':
		default:
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
					Unpaid
				</span>
			);
	}
}

type BillTab = 'bill' | 'history';
type DateRangePreset = 'this_month' | 'last_month' | 'this_week' | 'today' | 'custom';

export function ShowroomBillPage() {
	const qc = useQueryClient();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { isOwner, hasPermission } = useAuth();

	// Granular Permissions
	const canManageBilling = Boolean(isOwner || hasPermission('showroom.manage_billing') || hasPermission('showroom.manage'));
	const canRecordPayment = Boolean(isOwner || hasPermission('showroom.record_payment') || hasPermission('showroom.manage'));
	const canDeletePayment = Boolean(isOwner || hasPermission('showroom.delete_payment'));
	const canViewHistory = Boolean(isOwner || hasPermission('showroom.view_history') || hasPermission('showroom.view'));

	// Showroom and date parameters
	const activeShowroomId = searchParams.get('showroomId') || '';
	const urlDate = searchParams.get('date');

	// Active tab
	const [activeTab, setActiveTab] = useState<BillTab>('bill');

	// Daily date
	const [selectedDate, setSelectedDate] = useState<string>(urlDate || getTodayStr);

	useEffect(() => {
		if (urlDate && urlDate !== selectedDate) {
			setSelectedDate(urlDate);
		}
	}, [urlDate]);

	// Search filter for Select Showroom landing state
	const [showroomFilter, setShowroomFilter] = useState('');

	// Set Daily Bill modal state
	const [showSetBillModal, setShowSetBillModal] = useState(false);
	const [billAmountInput, setBillAmountInput] = useState<string>('');
	const [billNotesInput, setBillNotesInput] = useState<string>('');
	const [setBillError, setSetBillError] = useState('');

	// Record Payment modal state
	const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
	const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
	const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'BankTransfer'>('Cash');
	const [paymentReference, setPaymentReference] = useState('');
	const [paymentNotes, setPaymentNotes] = useState('');
	const [recordPaymentError, setRecordPaymentError] = useState('');

	// Void Payment confirmation modal state
	const [deletingPayment, setDeletingPayment] = useState<ShowroomPaymentDto | null>(null);

	// History tab presets
	const [historyPreset, setHistoryPreset] = useState<DateRangePreset>('this_month');
	const [customStart, setCustomStart] = useState<string>('');
	const [customEnd, setCustomEnd] = useState<string>('');

	// ── Queries ───────────────────────────────────────────────────────────────

	const { data: showrooms = [], isLoading: showroomsLoading } = useQuery({
		queryKey: ['showrooms'],
		queryFn: () => getShowrooms(),
	});

	const selectedShowroom = useMemo(() => {
		if (!activeShowroomId) return null;
		return showrooms.find((s) => s.id === activeShowroomId) || null;
	}, [showrooms, activeShowroomId]);

	const {
		data: dailyBillData,
		isLoading: dailyBillLoading,
	} = useQuery({
		queryKey: ['showroomDailyBill', selectedShowroom?.id, selectedDate],
		queryFn: () => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return getShowroomDailyBill(selectedShowroom.id, selectedDate);
		},
		enabled: Boolean(selectedShowroom?.id && selectedDate),
	});

	// Date range for History tab
	const { start: historyStart, end: historyEnd } = useMemo(() => {
		const now = new Date();
		if (historyPreset === 'today') {
			const today = getTodayStr();
			return { start: today, end: today };
		}
		if (historyPreset === 'this_week') {
			const dayOfWeek = now.getDay();
			const startDt = new Date(now);
			startDt.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
			const y = startDt.getFullYear();
			const m = String(startDt.getMonth() + 1).padStart(2, '0');
			const d = String(startDt.getDate()).padStart(2, '0');
			return { start: `${y}-${m}-${d}`, end: getTodayStr() };
		}
		if (historyPreset === 'last_month') {
			const startDt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const endDt = new Date(now.getFullYear(), now.getMonth(), 0);
			const y1 = startDt.getFullYear();
			const m1 = String(startDt.getMonth() + 1).padStart(2, '0');
			const d1 = String(startDt.getDate()).padStart(2, '0');
			const y2 = endDt.getFullYear();
			const m2 = String(endDt.getMonth() + 1).padStart(2, '0');
			const d2 = String(endDt.getDate()).padStart(2, '0');
			return { start: `${y1}-${m1}-${d1}`, end: `${y2}-${m2}-${d2}` };
		}
		if (historyPreset === 'custom') {
			return { start: customStart || getTodayStr(), end: customEnd || getTodayStr() };
		}
		// this_month (default)
		const startDt = new Date(now.getFullYear(), now.getMonth(), 1);
		const y = startDt.getFullYear();
		const m = String(startDt.getMonth() + 1).padStart(2, '0');
		const d = String(startDt.getDate()).padStart(2, '0');
		return { start: `${y}-${m}-${d}`, end: getTodayStr() };
	}, [historyPreset, customStart, customEnd]);

	const { data: summaryData, isLoading: summaryLoading } = useQuery({
		queryKey: ['showroomSummary', selectedShowroom?.id, historyStart, historyEnd],
		queryFn: () => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return getShowroomSummary(selectedShowroom.id, historyStart, historyEnd);
		},
		enabled: Boolean(selectedShowroom?.id && activeTab === 'history' && canViewHistory),
	});

	// Global Cross-Showroom Outstanding Query (Runs on global billing landing view)
	const { data: outstandingList = [], isLoading: outstandingLoading } = useQuery({
		queryKey: ['showroomsOutstanding'],
		queryFn: () => getShowroomsOutstanding(),
		enabled: !activeShowroomId,
	});

	// Global metrics for landing view
	const globalBillingStats = useMemo(() => {
		const totalBilled = outstandingList.reduce((acc, item) => acc + (item.totalBilled || 0), 0);
		const totalReceived = outstandingList.reduce((acc, item) => acc + (item.totalReceived || 0), 0);
		const totalOutstanding = outstandingList.reduce((acc, item) => acc + (item.outstandingAmount || 0), 0);
		const showroomsWithDue = outstandingList.filter((item) => item.outstandingAmount > 0).length;
		return { totalBilled, totalReceived, totalOutstanding, showroomsWithDue };
	}, [outstandingList]);

	// ── Mutations ─────────────────────────────────────────────────────────────

	const setDailyBillMutation = useMutation({
		mutationFn: (data: SetShowroomDailyBillInput) => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return setShowroomDailyBill(selectedShowroom.id, selectedDate, data);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showroomDailyBill', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
			setShowSetBillModal(false);
			setSetBillError('');
		},
		onError: (err: any) => {
			setSetBillError(err?.message || 'Failed to update daily bill.');
		},
	});

	const recordPaymentMutation = useMutation({
		mutationFn: (data: RecordShowroomPaymentInput) => {
			if (!selectedShowroom) throw new Error('No showroom selected');
			return recordShowroomPayment(selectedShowroom.id, selectedDate, data);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showroomDailyBill', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
			setShowRecordPaymentModal(false);
			setRecordPaymentError('');
		},
		onError: (err: any) => {
			setRecordPaymentError(err?.message || 'Failed to record payment.');
		},
	});

	const deletePaymentMutation = useMutation({
		mutationFn: (paymentId: string) => deleteShowroomPayment(paymentId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['showroomDailyBill', selectedShowroom?.id, selectedDate] });
			qc.invalidateQueries({ queryKey: ['showroomSummary', selectedShowroom?.id] });
			qc.invalidateQueries({ queryKey: ['showroomsOutstanding'] });
			setDeletingPayment(null);
		},
		onError: (err: any) => {
			alert(err?.message || 'Failed to void payment transaction.');
		},
	});

	// ── Navigation Handlers ───────────────────────────────────────────────────

	function handleShowroomSelect(showroomId: string) {
		const newParams = new URLSearchParams(searchParams);
		if (showroomId) {
			newParams.set('showroomId', showroomId);
		} else {
			newParams.delete('showroomId');
		}
		setSearchParams(newParams);
	}

	function handleDateChange(newDate: string) {
		setSelectedDate(newDate);
		const newParams = new URLSearchParams(searchParams);
		newParams.set('date', newDate);
		setSearchParams(newParams);
	}

	function openSetBillModal() {
		setBillAmountInput(dailyBillData?.amount !== undefined ? String(dailyBillData.amount) : '');
		setBillNotesInput(dailyBillData?.notes || '');
		setSetBillError('');
		setShowSetBillModal(true);
	}

	function handleSetBillSubmit(e: React.FormEvent) {
		e.preventDefault();
		const amt = parseFloat(billAmountInput);
		if (isNaN(amt) || amt < 0) {
			setSetBillError('Please enter a valid bill amount greater than or equal to 0.');
			return;
		}
		setDailyBillMutation.mutate({
			amount: amt,
			notes: billNotesInput.trim() || undefined,
		});
	}

	function openRecordPaymentModal() {
		const balance = dailyBillData?.balanceAmount ?? 0;
		setPaymentAmountInput(balance > 0 ? String(balance) : '');
		setPaymentMethod('Cash');
		setPaymentReference('');
		setPaymentNotes('');
		setRecordPaymentError('');
		setShowRecordPaymentModal(true);
	}

	function handleRecordPaymentSubmit(e: React.FormEvent) {
		e.preventDefault();
		const amt = parseFloat(paymentAmountInput);
		if (isNaN(amt) || amt <= 0) {
			setRecordPaymentError('Please enter a valid payment amount greater than zero.');
			return;
		}
		const remaining = dailyBillData?.balanceAmount ?? 0;
		if (amt > remaining) {
			setRecordPaymentError(`Payment amount cannot exceed the remaining balance of ${formatINR(remaining)}.`);
			return;
		}
		recordPaymentMutation.mutate({
			amount: amt,
			paymentMethod,
			reference: paymentReference.trim() || undefined,
			paymentDate: new Date().toISOString(),
			notes: paymentNotes.trim() || undefined,
		});
	}

	// Filtered showrooms for Select Showroom landing state
	const filteredShowrooms = useMemo(() => {
		if (!showroomFilter) return showrooms;
		const query = showroomFilter.toLowerCase();
		return showrooms.filter(
			(s) =>
				s.name.toLowerCase().includes(query) ||
				s.address.toLowerCase().includes(query) ||
				(s.masterId && s.masterId.toLowerCase().includes(query)) ||
				(s.phone && s.phone.includes(query))
		);
	}, [showrooms, showroomFilter]);

	// ── Landing State: No Showroom Selected (Global Receivables & Showroom Selector) ───

	if (!selectedShowroom) {
		return (
			<div className="space-y-6">
				{/* Page Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h1 className="text-xl font-bold text-on-surface tracking-tight">Showroom Billing &amp; Receivables</h1>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Dealership billing console, cross-showroom accounts receivable, and payment management
						</p>
					</div>

					<Button
						variant="ghost"
						size="sm"
						icon={<ArrowLeft className="w-4 h-4" />}
						onClick={() => navigate('/showroom')}
					>
						Back to Showrooms
					</Button>
				</div>

				{/* Global KPI Summary Cards */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="card p-4 space-y-1">
						<span className="text-xs font-semibold text-on-surface-variant">Total Dealership Billed</span>
						<p className="text-xl font-bold font-mono text-on-surface">
							{outstandingLoading ? '...' : formatINR(globalBillingStats.totalBilled)}
						</p>
						<p className="text-[11px] text-on-surface-variant">Cumulative across all showrooms</p>
					</div>

					<div className="card p-4 space-y-1">
						<span className="text-xs font-semibold text-emerald-800">Total Collected</span>
						<p className="text-xl font-bold font-mono text-emerald-700">
							{outstandingLoading ? '...' : formatINR(globalBillingStats.totalReceived)}
						</p>
						<p className="text-[11px] text-on-surface-variant">Payments received to date</p>
					</div>

					<div className="card p-4 space-y-1">
						<span className="text-xs font-semibold text-rose-800">Outstanding Receivables</span>
						<p className="text-xl font-bold font-mono text-rose-700">
							{outstandingLoading ? '...' : formatINR(globalBillingStats.totalOutstanding)}
						</p>
						<p className="text-[11px] text-on-surface-variant">Uncollected dealership balance</p>
					</div>

					<div className="card p-4 space-y-1">
						<span className="text-xs font-semibold text-amber-800">Dealerships with Balance</span>
						<p className="text-xl font-bold font-mono text-amber-700">
							{outstandingLoading ? '...' : `${globalBillingStats.showroomsWithDue} Showrooms`}
						</p>
						<p className="text-[11px] text-on-surface-variant">Active pending collections</p>
					</div>
				</div>

				{/* Section 1: Cross-Showroom Outstanding Receivables */}
				<div className="card space-y-4">
					<div className="pb-3 border-b border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<h2 className="text-sm font-semibold text-on-surface flex items-center gap-2">
								<TrendingUp className="w-4 h-4 text-secondary" />
								Cross-Showroom Outstanding Receivables
							</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Summary of billed, collected, and outstanding balances across all showroom dealerships
							</p>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs border-collapse">
							<thead>
								<tr className="border-b border-outline-variant/60 bg-surface-container-low/40">
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Dealership</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Location</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant font-mono">Total Billed</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant font-mono">Received</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant font-mono">Outstanding</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant text-center">Unpaid Days</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant text-right">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-outline-variant/40">
								{outstandingLoading ? (
									<tr>
										<td colSpan={7} className="py-8 text-center text-on-surface-variant">
											Loading outstanding overview...
										</td>
									</tr>
								) : outstandingList.length === 0 ? (
									<tr>
										<td colSpan={7} className="py-8 text-center text-on-surface-variant">
											No showroom billing records found.
										</td>
									</tr>
								) : (
									outstandingList.map((item) => (
										<tr key={item.showroomId} className="hover:bg-surface-container/30 transition-colors">
											<td className="py-2.5 px-3 font-medium text-on-surface">
												<span className="font-semibold">{item.showroomName}</span>
											</td>
											<td className="py-2.5 px-3 text-on-surface-variant max-w-xs truncate">
												{item.address}
											</td>
											<td className="py-2.5 px-3 font-mono">{formatINR(item.totalBilled)}</td>
											<td className="py-2.5 px-3 font-mono text-emerald-700 font-semibold">
												{formatINR(item.totalReceived)}
											</td>
											<td className="py-2.5 px-3 font-mono text-rose-700 font-bold">
												{formatINR(item.outstandingAmount)}
											</td>
											<td className="py-2.5 px-3 text-center font-mono">
												{item.unpaidDaysCount > 0 ? (
													<span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold border border-rose-200">
														{item.unpaidDaysCount} days
													</span>
												) : (
													'0'
												)}
											</td>
											<td className="py-2.5 px-3 text-right">
												<button
													type="button"
													onClick={() => handleShowroomSelect(item.showroomId)}
													className="text-secondary hover:text-secondary/80 font-medium px-2 py-1 rounded bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer inline-flex items-center gap-1"
												>
													<Receipt className="w-3 h-3" />
													Open Bill
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Section 2: Showroom Selector Directory */}
				<div className="card space-y-4">
					<div className="pb-3 border-b border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<h2 className="text-sm font-semibold text-on-surface flex items-center gap-2">
								<Receipt className="w-4 h-4 text-secondary" />
								Select a Showroom to Open Billing
							</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Choose a dealership to manage its daily bills, track payments, and review account ledgers
							</p>
						</div>

						<div className="w-full sm:w-72">
							<SearchInput
								placeholder="Search by showroom name, address, or Master ID..."
								value={showroomFilter}
								onChange={(e) => setShowroomFilter(e.target.value)}
							/>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs border-collapse">
							<thead>
								<tr className="border-b border-outline-variant/60 bg-surface-container-low/40">
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant w-28">Master ID</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Showroom Name</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Location</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Contact</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant text-center w-24">Status</th>
									<th className="py-2.5 px-3 font-semibold text-on-surface-variant text-right w-28">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-outline-variant/40">
								{showroomsLoading ? (
									<tr>
										<td colSpan={6} className="py-8 text-center text-on-surface-variant">
											Loading showrooms...
										</td>
									</tr>
								) : filteredShowrooms.length === 0 ? (
									<tr>
										<td colSpan={6} className="py-8 text-center text-on-surface-variant">
											No showrooms found matching &ldquo;{showroomFilter}&rdquo;.
										</td>
									</tr>
								) : (
									filteredShowrooms.map((sr) => (
										<tr
											key={sr.id}
											onClick={() => handleShowroomSelect(sr.id)}
											className="hover:bg-surface-container/30 transition-colors cursor-pointer group"
										>
											<td className="py-2.5 px-3 font-mono font-medium text-on-surface-variant">
												<span className="px-2 py-0.5 rounded bg-surface-container-high text-xs font-semibold border border-outline-variant">
													{sr.masterId ? `#${sr.masterId}` : '—'}
												</span>
											</td>
											<td className="py-2.5 px-3 font-semibold text-on-surface group-hover:text-secondary transition-colors">
												{sr.name}
											</td>
											<td className="py-2.5 px-3 text-on-surface-variant max-w-xs truncate">
												{sr.address}
											</td>
											<td className="py-2.5 px-3 text-on-surface-variant font-mono">
												{sr.phone || '—'}
											</td>
											<td className="py-2.5 px-3 text-center">
												<StatusBadge status={sr.isActive ? 'Active' : 'Inactive'} />
											</td>
											<td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
												<Button
													variant="primary"
													size="sm"
													icon={<Receipt className="w-3.5 h-3.5" />}
													onClick={() => handleShowroomSelect(sr.id)}
												>
													Open Bill
												</Button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		);
	}

	// ── Active Showroom Workspace (Showroom-Specific Billing Only) ───────────────

	const hasBill = dailyBillData && dailyBillData.amount > 0;
	const isPaidInFull = dailyBillData && dailyBillData.balanceAmount === 0 && hasBill;

	return (
		<div className="space-y-6">
			{/* Showroom Header Context Card */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant/60">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => navigate('/showroom')}
						className="p-2 rounded-lg bg-white border border-outline-variant/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer shadow-2xs"
						title="Back to Showrooms Master"
					>
						<ArrowLeft className="w-4 h-4" />
					</button>

					<div>
						<div className="flex items-center gap-2.5 flex-wrap">
							<h1 className="text-xl font-bold text-on-surface tracking-tight">{selectedShowroom.name}</h1>
							<span className="font-mono text-xs font-semibold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant">
								{selectedShowroom.masterId ? `#${selectedShowroom.masterId}` : '—'}
							</span>
							{selectedShowroom.gstin && (
								<span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
									GSTIN: {selectedShowroom.gstin}
								</span>
							)}
							<StatusBadge status={selectedShowroom.isActive ? 'Active' : 'Inactive'} />
						</div>
						<p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5 flex-wrap">
							<MapPin className="w-3.5 h-3.5 shrink-0" />
							<span>{selectedShowroom.address}</span>
							{selectedShowroom.phone && (
								<>
									<span className="mx-1">•</span>
									<Phone className="w-3.5 h-3.5 shrink-0" />
									<span className="font-mono">{selectedShowroom.phone}</span>
								</>
							)}
						</p>
					</div>
				</div>

				{/* Quick Showroom Switcher & Attendance Link */}
				<div className="flex flex-wrap items-center gap-3">
					<Button
						variant="ghost"
						size="sm"
						icon={<CalendarCheck className="w-3.5 h-3.5" />}
						onClick={() => navigate(`/showroom/attendance?showroomId=${selectedShowroom.id}&date=${selectedDate}`)}
						title="Open attendance for this showroom"
					>
						Showroom Attendance
					</Button>

					<div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-outline-variant/80 shadow-2xs">
						<Building2 className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
						<select
							aria-label="Quick Switch Showroom"
							value={selectedShowroom.id}
							onChange={(e) => handleShowroomSelect(e.target.value)}
							className="text-xs font-medium text-on-surface bg-transparent border-none focus:outline-none cursor-pointer pr-4"
						>
							{showrooms.map((s) => (
								<option key={s.id} value={s.id}>
									{s.name} ({s.masterId ? `#${s.masterId}` : '—'})
								</option>
							))}
						</select>
					</div>

					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleShowroomSelect('')}
						className="text-xs text-on-surface-variant"
					>
						Change Showroom
					</Button>
				</div>
			</div>

			{/* Sub-Navigation Tabs (Showroom Scoped Only: Daily Bill & Payments, History) */}
			<div className="flex items-center gap-2 border-b border-outline-variant/60 pb-1">
				<button
					type="button"
					onClick={() => setActiveTab('bill')}
					className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
						activeTab === 'bill'
							? 'bg-secondary text-white shadow-xs'
							: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
					}`}
				>
					<Receipt className="w-3.5 h-3.5" />
					Daily Bill &amp; Payments
				</button>

				{canViewHistory && (
					<button
						type="button"
						onClick={() => setActiveTab('history')}
						className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
							activeTab === 'history'
								? 'bg-secondary text-white shadow-xs'
								: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
						}`}
					>
						<History className="w-3.5 h-3.5" />
						Billing History &amp; Summary
					</button>
				)}
			</div>

			{/* ══════════════════════════════════════════════════════════════════════ */}
			{/* TAB 1: DAILY BILL & PAYMENTS                                           */}
			{/* ══════════════════════════════════════════════════════════════════════ */}
			{activeTab === 'bill' && (
				<div className="space-y-6">
					{/* Date Navigator Bar */}
					<div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low/70 p-3 rounded-xl border border-outline-variant/50">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => handleDateChange(addDays(selectedDate, -1))}
								className="p-1.5 rounded-lg bg-white border border-outline-variant/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer"
								title="Previous Day"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>

							<button
								type="button"
								onClick={() => handleDateChange(getTodayStr())}
								className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer border ${
									selectedDate === getTodayStr()
										? 'bg-secondary text-white border-secondary'
										: 'bg-white text-on-surface-variant border-outline-variant hover:bg-surface-container'
								}`}
							>
								Today
							</button>

							<button
								type="button"
								onClick={() => handleDateChange(addDays(selectedDate, 1))}
								className="p-1.5 rounded-lg bg-white border border-outline-variant/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer"
								title="Next Day"
							>
								<ChevronRight className="w-4 h-4" />
							</button>

							<span className="text-sm font-semibold text-on-surface ml-2">
								{formatDateHeading(selectedDate)}
							</span>
						</div>

						<div className="flex items-center gap-2">
							<Calendar className="w-4 h-4 text-on-surface-variant" />
							<input
								type="date"
								value={selectedDate}
								onChange={(e) => handleDateChange(e.target.value)}
								className="form-input text-xs py-1 px-2.5 bg-white border-outline-variant rounded-lg"
							/>
						</div>
					</div>

					{/* Financial Summary Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
						<div className="card p-4 space-y-1">
							<span className="text-xs text-on-surface-variant font-medium">Daily Total Bill</span>
							<p className="text-2xl font-bold text-on-surface font-mono">
								{formatINR(dailyBillData?.amount ?? 0)}
							</p>
							<span className="text-[11px] text-on-surface-variant">Billed for this date</span>
						</div>

						<div className="card p-4 space-y-1">
							<span className="text-xs text-on-surface-variant font-medium">Amount Received</span>
							<p className="text-2xl font-bold text-emerald-700 font-mono">
								{formatINR(dailyBillData?.amountReceived ?? 0)}
							</p>
							<span className="text-[11px] text-on-surface-variant">Total payments collected</span>
						</div>

						<div className="card p-4 space-y-1">
							<span className="text-xs text-on-surface-variant font-medium">Remaining Balance</span>
							<p className="text-2xl font-bold text-rose-700 font-mono">
								{formatINR(dailyBillData?.balanceAmount ?? 0)}
							</p>
							<span className="text-[11px] text-on-surface-variant">Outstanding for this bill</span>
						</div>

						<div className="card p-4 space-y-1">
							<span className="text-xs text-on-surface-variant font-medium">Payment Status</span>
							<div className="pt-1">
								{getPaymentStatusBadge(dailyBillData?.status || 'Unpaid')}
							</div>
							<span className="text-[11px] text-on-surface-variant">
								{isPaidInFull ? 'Fully settled' : 'Pending full settlement'}
							</span>
						</div>
					</div>

					{/* Daily Bill & Payments Card */}
					<div className="card space-y-5">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/60">
							<div>
								<h2 className="text-sm font-semibold text-on-surface flex items-center gap-2">
									<Receipt className="w-4 h-4 text-secondary" />
									Daily Billing &amp; Payment Records
								</h2>
								<p className="text-xs text-on-surface-variant mt-0.5">
									Commercial accounts receivable for {formatDateHeading(selectedDate)}
								</p>
							</div>

							<div className="flex items-center gap-2">
								{canManageBilling && (
									<Button
										variant="secondary"
										size="sm"
										onClick={openSetBillModal}
									>
										{hasBill ? 'Edit Daily Bill' : 'Set Daily Bill'}
									</Button>
								)}

								{canRecordPayment && (
									<Button
										variant="primary"
										size="sm"
										icon={<Plus className="w-3.5 h-3.5" />}
										onClick={openRecordPaymentModal}
										disabled={!hasBill || isPaidInFull}
									>
										Record Payment
									</Button>
								)}
							</div>
						</div>

						{/* Bill Notes if present */}
						{dailyBillData?.notes && (
							<div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/40 text-xs text-on-surface-variant">
								<span className="font-semibold text-on-surface mr-1.5">Billing Notes:</span>
								<span>{dailyBillData.notes}</span>
							</div>
						)}

						{/* No Bill Set Warning */}
						{!dailyBillLoading && !hasBill && (
							<div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
								<div className="flex items-center gap-2.5">
									<AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
									<div>
										<p className="font-semibold text-amber-950">No daily bill has been set for this date.</p>
										<p className="text-amber-800 mt-0.5">
											Set the daily billing amount to record commercial revenue and receive payments.
										</p>
									</div>
								</div>

								{canManageBilling && (
									<Button
										variant="primary"
										size="sm"
										icon={<Plus className="w-3.5 h-3.5" />}
										onClick={openSetBillModal}
									>
										Set Daily Bill
									</Button>
								)}
							</div>
						)}

						{/* Payments Table */}
						<div className="space-y-3">
							<h3 className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
								<CreditCard className="w-3.5 h-3.5 text-secondary" />
								Payment Transactions
							</h3>

							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="border-b border-outline-variant/60 bg-surface-container-low/40">
											<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Date &amp; Time</th>
											<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Method</th>
											<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Reference</th>
											<th className="py-2.5 px-3 font-semibold text-on-surface-variant font-mono">Amount</th>
											<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Notes</th>
											<th className="py-2.5 px-3 font-semibold text-on-surface-variant text-right">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-outline-variant/40">
										{dailyBillLoading ? (
											<tr>
												<td colSpan={6} className="py-8 text-center text-on-surface-variant">
													Loading payments...
												</td>
											</tr>
										) : !dailyBillData?.payments || dailyBillData.payments.length === 0 ? (
											<tr>
												<td colSpan={6} className="py-8 text-center text-on-surface-variant">
													No payments recorded for this daily bill.
												</td>
											</tr>
										) : (
											dailyBillData.payments.map((p) => (
												<tr key={p.id} className="hover:bg-surface-container/30 transition-colors">
													<td className="py-2.5 px-3 text-on-surface">{formatDateTime(p.paymentDate)}</td>
													<td className="py-2.5 px-3 font-medium text-on-surface">
														<span className="px-2 py-0.5 rounded bg-surface-container text-xs font-medium">
															{p.paymentMethod}
														</span>
													</td>
													<td className="py-2.5 px-3 font-mono text-on-surface-variant">{p.reference || '—'}</td>
													<td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
														{formatINR(p.amount)}
													</td>
													<td className="py-2.5 px-3 text-on-surface-variant">{p.notes || '—'}</td>
													<td className="py-2.5 px-3 text-right">
														{canDeletePayment && (
															<button
																type="button"
																onClick={() => setDeletingPayment(p)}
																className="p-1 rounded text-error hover:bg-error-container/40 transition-colors cursor-pointer"
																title="Void payment transaction"
															>
																<Trash2 className="w-3.5 h-3.5" />
															</button>
														)}
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ══════════════════════════════════════════════════════════════════════ */}
			{/* TAB 2: BILLING HISTORY & SUMMARY                                       */}
			{/* ══════════════════════════════════════════════════════════════════════ */}
			{activeTab === 'history' && canViewHistory && (
				<div className="space-y-6">
					{/* Presets and Filter Bar */}
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low p-3 rounded-xl border border-outline-variant/60 text-xs">
						<div className="flex items-center gap-1.5 flex-wrap">
							<span className="font-semibold text-on-surface mr-1">Date Range:</span>
							{(['this_month', 'last_month', 'this_week', 'today', 'custom'] as DateRangePreset[]).map(
								(p) => (
									<button
										key={p}
										type="button"
										onClick={() => setHistoryPreset(p)}
										className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
											historyPreset === p
												? 'bg-secondary text-white font-semibold shadow-xs'
												: 'bg-white text-on-surface-variant hover:bg-surface-container border border-outline-variant/60'
										}`}
									>
										{p === 'this_month'
											? 'This Month'
											: p === 'last_month'
											? 'Last Month'
											: p === 'this_week'
											? 'This Week'
											: p === 'today'
											? 'Today'
											: 'Custom'}
									</button>
								)
							)}
						</div>

						{historyPreset === 'custom' && (
							<div className="flex items-center gap-2">
								<input
									type="date"
									value={customStart}
									onChange={(e) => setCustomStart(e.target.value)}
									className="form-input text-xs py-1 px-2"
								/>
								<span>to</span>
								<input
									type="date"
									value={customEnd}
									onChange={(e) => setCustomEnd(e.target.value)}
									className="form-input text-xs py-1 px-2"
								/>
							</div>
						)}
					</div>

					{/* Summary Metric Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<div className="card p-4 space-y-1">
							<span className="text-xs text-on-surface-variant font-medium">Total Billed</span>
							<p className="text-2xl font-bold text-on-surface font-mono">
								{formatINR(summaryData?.totalBilled ?? 0)}
							</p>
							<span className="text-[11px] text-on-surface-variant">Over selected range</span>
						</div>

						<div className="card p-4 space-y-1">
							<span className="text-xs text-on-surface-variant font-medium">Total Received</span>
							<p className="text-2xl font-bold text-emerald-700 font-mono">
								{formatINR(summaryData?.totalReceived ?? 0)}
							</p>
							<span className="text-[11px] text-on-surface-variant">Payments collected</span>
						</div>

						<div className="card p-4 space-y-1">
							<span className="text-xs text-on-surface-variant font-medium">Outstanding Balance</span>
							<p className="text-2xl font-bold text-rose-700 font-mono">
								{formatINR(summaryData?.outstandingAmount ?? 0)}
							</p>
							<span className="text-[11px] text-on-surface-variant">Unsettled receivables</span>
						</div>
					</div>

					{/* Daily Billing Ledger Table */}
					<div className="card space-y-4">
						<div className="pb-3 border-b border-outline-variant/60">
							<h2 className="text-sm font-semibold text-on-surface flex items-center gap-2">
								<History className="w-4 h-4 text-secondary" />
								Daily Billing History &amp; Ledger
							</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Breakdown of commercial billing and receipts for each day in range
							</p>
						</div>

						<div className="overflow-x-auto">
							<table className="w-full text-left text-xs border-collapse">
								<thead>
									<tr className="border-b border-outline-variant/60 bg-surface-container-low/40">
										<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Date</th>
										<th className="py-2.5 px-3 font-semibold text-on-surface-variant font-mono">Billed Amount</th>
										<th className="py-2.5 px-3 font-semibold text-on-surface-variant font-mono">Received Amount</th>
										<th className="py-2.5 px-3 font-semibold text-on-surface-variant font-mono">Balance</th>
										<th className="py-2.5 px-3 font-semibold text-on-surface-variant">Status</th>
										<th className="py-2.5 px-3 font-semibold text-on-surface-variant text-right">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-outline-variant/40">
									{summaryLoading ? (
										<tr>
											<td colSpan={6} className="py-8 text-center text-on-surface-variant">
												Loading billing history...
											</td>
										</tr>
									) : !summaryData?.dailyHistory || summaryData.dailyHistory.length === 0 ? (
										<tr>
											<td colSpan={6} className="py-8 text-center text-on-surface-variant">
												No activity records found for this period.
											</td>
										</tr>
									) : (
										summaryData.dailyHistory.map((row) => (
											<tr key={row.date} className="hover:bg-surface-container/30 transition-colors">
												<td className="py-2.5 px-3 font-medium text-on-surface">
													{formatDateHeading(row.date)}
												</td>
												<td className="py-2.5 px-3 font-mono">{formatINR(row.billedAmount)}</td>
												<td className="py-2.5 px-3 font-mono text-emerald-700 font-semibold">
													{formatINR(row.receivedAmount)}
												</td>
												<td className="py-2.5 px-3 font-mono text-rose-700 font-semibold">
													{formatINR(row.balanceAmount)}
												</td>
												<td className="py-2.5 px-3">{getPaymentStatusBadge(row.status)}</td>
												<td className="py-2.5 px-3 text-right">
													<button
														type="button"
														onClick={() => {
															handleDateChange(row.date);
															setActiveTab('bill');
														}}
														className="text-secondary hover:text-secondary/80 font-medium px-2 py-1 rounded bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
													>
														Open Day
													</button>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ══════════════════════════════════════════════════════════════════════ */}
			{/* OPERATIONAL MODALS                                                     */}
			{/* ══════════════════════════════════════════════════════════════════════ */}

			{/* MODAL 1: SET DAILY BILL */}
			{showSetBillModal && (
				<Dialog
					open={showSetBillModal}
					onOpenChange={(open) => {
						if (!open && !setDailyBillMutation.isPending) setShowSetBillModal(false);
					}}
					title="Set Daily Showroom Bill"
					description={`Set the billing amount for ${selectedShowroom.name} on ${formatDateHeading(selectedDate)}`}
				>
					<form onSubmit={handleSetBillSubmit} className="space-y-4 pt-2">
						{setBillError && (
							<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{setBillError}</span>
							</div>
						)}

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Daily Billing Amount (₹) *</label>
							<input
								type="number"
								aria-label="Daily Billing Amount"
								step="0.01"
								min={0}
								placeholder="0.00"
								value={billAmountInput}
								onChange={(e) => setBillAmountInput(e.target.value)}
								className="form-input w-full text-xs font-mono"
								required
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Billing Notes (Optional)</label>
							<input
								type="text"
								placeholder="e.g. Standard billing for wash services"
								value={billNotesInput}
								onChange={(e) => setBillNotesInput(e.target.value)}
								className="form-input w-full text-xs"
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setShowSetBillModal(false)}
								disabled={setDailyBillMutation.isPending}
							>
								Cancel
							</Button>
							<Button type="submit" variant="primary" loading={setDailyBillMutation.isPending}>
								Save Daily Bill
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* MODAL 2: RECORD SHOWROOM PAYMENT */}
			{showRecordPaymentModal && (
				<Dialog
					open={showRecordPaymentModal}
					onOpenChange={(open) => {
						if (!open && !recordPaymentMutation.isPending) setShowRecordPaymentModal(false);
					}}
					title="Record Showroom Payment"
					description={`Record payment transaction received from ${selectedShowroom.name} for ${formatDateHeading(
						selectedDate
					)}`}
				>
					<form onSubmit={handleRecordPaymentSubmit} className="space-y-4 pt-2">
						{recordPaymentError && (
							<div className="p-3 bg-error-container/60 border border-error/30 text-error text-xs rounded-lg flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{recordPaymentError}</span>
							</div>
						)}

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Payment Amount (₹) *</label>
							<input
								type="number"
								aria-label="Payment Amount"
								step="0.01"
								min={0.01}
								placeholder="0.00"
								value={paymentAmountInput}
								onChange={(e) => setPaymentAmountInput(e.target.value)}
								className="form-input w-full text-xs font-mono font-bold"
								required
							/>
							<p className="text-[11px] text-on-surface-variant font-mono">
								Remaining Balance: {formatINR(dailyBillData?.balanceAmount ?? 0)}
							</p>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Payment Method *</label>
							<select
								value={paymentMethod}
								onChange={(e) => setPaymentMethod(e.target.value as any)}
								className="form-input w-full text-xs"
								required
							>
								<option value="Cash">Cash</option>
								<option value="UPI">UPI</option>
								<option value="Card">Card</option>
								<option value="BankTransfer">Bank Transfer</option>
							</select>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Transaction ID / Reference (Optional)</label>
							<input
								type="text"
								placeholder="e.g. UPI Ref / Cheque No"
								value={paymentReference}
								onChange={(e) => setPaymentReference(e.target.value)}
								className="form-input w-full text-xs font-mono"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-on-surface">Notes (Optional)</label>
							<input
								type="text"
								placeholder="e.g. Paid by Showroom Manager"
								value={paymentNotes}
								onChange={(e) => setPaymentNotes(e.target.value)}
								className="form-input w-full text-xs"
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setShowRecordPaymentModal(false)}
								disabled={recordPaymentMutation.isPending}
							>
								Cancel
							</Button>
							<Button type="submit" variant="primary" loading={recordPaymentMutation.isPending}>
								Record Payment
							</Button>
						</div>
					</form>
				</Dialog>
			)}

			{/* MODAL 3: VOID SHOWROOM PAYMENT */}
			{deletingPayment && (
				<Dialog
					open={Boolean(deletingPayment)}
					onOpenChange={(open) => {
						if (!open && !deletePaymentMutation.isPending) setDeletingPayment(null);
					}}
					title="Void Payment Transaction"
					description={`Are you sure you want to void the payment of ${formatINR(deletingPayment.amount)} (${
						deletingPayment.paymentMethod
					})?`}
				>
					<div className="pt-2 space-y-4">
						<div className="p-3 rounded-lg bg-error-container/40 border border-error/20 text-xs text-error flex items-start gap-2.5">
							<AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
							<span>
								Voiding this transaction will restore the remaining balance by {formatINR(deletingPayment.amount)}.
							</span>
						</div>

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setDeletingPayment(null)}
								disabled={deletePaymentMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="danger"
								loading={deletePaymentMutation.isPending}
								onClick={() => deletePaymentMutation.mutate(deletingPayment.id)}
							>
								Void Payment
							</Button>
						</div>
					</div>
				</Dialog>
			)}
		</div>
	);
}
