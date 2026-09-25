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
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
					Paid
				</span>
			);
		case 'PartiallyPaid':
			return (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
					Partially Paid
				</span>
			);
		case 'Unpaid':
		default:
			return (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
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

	// Search filter for Showrooms directory table
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

	// Map of outstanding data by showroom ID
	const outstandingMap = useMemo(() => {
		const map: Record<string, typeof outstandingList[0]> = {};
		for (const item of outstandingList) {
			map[item.showroomId] = item;
		}
		return map;
	}, [outstandingList]);

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
		onSuccess: (updatedBill) => {
			if (updatedBill && selectedShowroom) {
				qc.setQueryData(['showroomDailyBill', selectedShowroom.id, selectedDate], updatedBill);
			}
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
		onSuccess: (updatedBill) => {
			if (updatedBill && selectedShowroom) {
				qc.setQueryData(['showroomDailyBill', selectedShowroom.id, selectedDate], updatedBill);
			}
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

	// Filtered showrooms for table
	const filteredShowrooms = useMemo(() => {
		if (!showroomFilter.trim()) return showrooms;
		const query = showroomFilter.toLowerCase();
		return showrooms.filter(
			(s) =>
				s.name.toLowerCase().includes(query) ||
				s.address.toLowerCase().includes(query) ||
				(s.masterId && s.masterId.toLowerCase().includes(query)) ||
				(s.phone && s.phone.includes(query))
		);
	}, [showrooms, showroomFilter]);

	// ── Landing State: No Showroom Selected (Global Showroom Billing) ──────────

	if (!selectedShowroom) {
		return (
			<div className="space-y-6">
				{/* ── Page Header ──────────────────────────────────────────────────────── */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/60">
					<div>
						<h1 className="text-xl font-bold text-on-surface tracking-tight">Showroom Billing</h1>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Manage daily dealership billing, payments and outstanding balances.
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

				{/* ── KPI Summary Cards ────────────────────────────────────────────────── */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-1 shadow-xs">
						<span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block">TOTAL BILLED</span>
						<p className="text-2xl font-bold font-mono text-on-surface">
							{outstandingLoading ? '...' : formatINR(globalBillingStats.totalBilled)}
						</p>
						<span className="text-xs text-on-surface-variant block">Across all showrooms</span>
					</div>

					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-1 shadow-xs">
						<span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 block">TOTAL COLLECTED</span>
						<p className="text-2xl font-bold font-mono text-emerald-700">
							{outstandingLoading ? '...' : formatINR(globalBillingStats.totalReceived)}
						</p>
						<span className="text-xs text-on-surface-variant block">Payments received to date</span>
					</div>

					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-1 shadow-xs">
						<span className="text-xs font-semibold uppercase tracking-wider text-rose-800 block">OUTSTANDING</span>
						<p className="text-2xl font-bold font-mono text-rose-700">
							{outstandingLoading ? '...' : formatINR(globalBillingStats.totalOutstanding)}
						</p>
						<span className="text-xs text-on-surface-variant block">Uncollected balance</span>
					</div>

					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-1 shadow-xs">
						<span className="text-xs font-semibold uppercase tracking-wider text-amber-800 block">SHOWROOMS WITH BALANCE</span>
						<p className="text-2xl font-bold font-mono text-amber-700">
							{outstandingLoading ? '...' : `${globalBillingStats.showroomsWithDue}`}
						</p>
						<span className="text-xs text-on-surface-variant block">Pending settlement</span>
					</div>
				</div>

				{/* ── Showroom Billing Table Card ──────────────────────────────────────── */}
				<div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-xs">
					{/* Table Toolbar / Search Area */}
					<div className="p-3.5 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low/40">
						<div className="w-full sm:w-80">
							<SearchInput
								placeholder="Search showrooms by name, address, or Master ID..."
								value={showroomFilter}
								onChange={(e) => setShowroomFilter(e.target.value)}
								onClear={() => setShowroomFilter('')}
								className="w-full text-xs"
							/>
						</div>
					</div>

					{/* Table */}
					<div className="overflow-x-auto">
						<table className="app-table w-full">
							<thead>
								<tr>
									<th className="text-left whitespace-nowrap">SHOWROOM</th>
									<th className="text-left whitespace-nowrap">MASTER ID</th>
									<th className="text-left whitespace-nowrap">STATUS</th>
									<th className="text-left">LOCATION</th>
									<th className="text-right whitespace-nowrap">BILLED</th>
									<th className="text-right whitespace-nowrap">RECEIVED</th>
									<th className="text-right whitespace-nowrap">OUTSTANDING</th>
									<th className="text-center whitespace-nowrap">PAYMENT STATUS</th>
									<th className="text-right whitespace-nowrap">ACTION</th>
								</tr>
							</thead>
							<tbody>
								{showroomsLoading || outstandingLoading ? (
									<tr>
										<td colSpan={9} className="py-12 text-center text-xs text-on-surface-variant">
											Loading showrooms...
										</td>
									</tr>
								) : filteredShowrooms.length === 0 ? (
									<tr>
										<td colSpan={9} className="py-16 text-center text-on-surface-variant text-sm">
											No showrooms found{showroomFilter ? ` matching "${showroomFilter}"` : ''}.
										</td>
									</tr>
								) : (
									filteredShowrooms.map((sr) => {
										const stats = outstandingMap[sr.id] || {
											totalBilled: 0,
											totalReceived: 0,
											outstandingAmount: 0,
											unpaidDaysCount: 0,
										};
										const hasDue = stats.outstandingAmount > 0;

										return (
											<tr
												key={sr.id}
												className="hover:bg-surface-container/40 transition-colors cursor-pointer group"
												onClick={() => handleShowroomSelect(sr.id)}
											>
												{/* SHOWROOM */}
												<td className="py-3 px-3 whitespace-nowrap">
													<div className="flex items-center gap-2">
														<div className="w-7 h-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-secondary group-hover:text-white transition-colors">
															{sr.name.slice(0, 2).toUpperCase()}
														</div>
														<span className="font-semibold text-xs text-on-surface group-hover:text-secondary transition-colors" title={sr.name}>
															{sr.name}
														</span>
													</div>
												</td>

												{/* MASTER ID */}
												<td className="py-3 px-3 whitespace-nowrap">
													<span className="font-mono text-xs font-semibold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant whitespace-nowrap">
														{sr.masterId ? `#${sr.masterId}` : '—'}
													</span>
												</td>

												{/* SHOWROOM ACTIVE STATUS */}
												<td className="py-3 px-3 whitespace-nowrap">
													<StatusBadge status={sr.isActive ? 'Active' : 'Inactive'} />
												</td>

												{/* LOCATION */}
												<td className="py-3 px-3 text-xs text-on-surface-variant max-w-[200px] truncate" title={sr.address || undefined}>
													{sr.address || '—'}
												</td>

												{/* BILLED */}
												<td className="py-3 px-3 font-mono text-sm text-on-surface text-right whitespace-nowrap">
													{formatINR(stats.totalBilled)}
												</td>

												{/* RECEIVED */}
												<td className="py-3 px-3 font-mono text-sm font-semibold text-emerald-700 text-right whitespace-nowrap">
													{formatINR(stats.totalReceived)}
												</td>

												{/* OUTSTANDING */}
												<td className="py-3 px-3 font-mono text-sm font-bold text-rose-700 text-right whitespace-nowrap">
													{formatINR(stats.outstandingAmount)}
												</td>

												{/* PAYMENT STATUS */}
												<td className="py-3 px-3 text-center whitespace-nowrap">
													{hasDue ? (
														<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
															{stats.unpaidDaysCount > 0
																? `${formatINR(stats.outstandingAmount)} Due (${stats.unpaidDaysCount}d)`
																: 'Outstanding Due'}
														</span>
													) : (
														<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
															No Outstanding Balance
														</span>
													)}
												</td>

												{/* ACTION */}
												<td className="py-3 px-3 text-right whitespace-nowrap">
													<Button
														variant="primary"
														size="sm"
														icon={<Receipt className="w-3.5 h-3.5" />}
														onClick={(e) => {
															e.stopPropagation();
															handleShowroomSelect(sr.id);
														}}
													>
														Open Bill
													</Button>
												</td>
											</tr>
										);
									})
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
			{/* Showroom Workspace Header */}
			<div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate('/showroom/bill')}
						className="text-on-surface-variant hover:text-on-surface"
						title="Back to Showroom Billing"
					>
						<ArrowLeft className="w-4 h-4 mr-1" />
						Back
					</Button>

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

						<div className="flex items-center gap-3 text-xs text-on-surface-variant mt-1 flex-wrap">
							<span className="flex items-center gap-1">
								<MapPin className="w-3.5 h-3.5 text-on-surface-variant" />
								{selectedShowroom.address}
							</span>
							{selectedShowroom.phone && (
								<>
									<span className="text-outline-variant">•</span>
									<span className="flex items-center gap-1 font-mono">
										<Phone className="w-3.5 h-3.5 text-on-surface-variant" />
										{selectedShowroom.phone}
									</span>
								</>
							)}
						</div>
					</div>
				</div>

				{/* Right Header Actions */}
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						icon={<CalendarCheck className="w-4 h-4" />}
						onClick={() => navigate(`/showroom/attendance?showroomId=${selectedShowroom.id}&date=${selectedDate}`)}
						title="Open attendance for this showroom"
					>
						Showroom Attendance
					</Button>

					<div className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1.5 rounded-lg border border-outline-variant">
						<Building2 className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
						<select
							aria-label="Quick Switch Showroom"
							value={selectedShowroom.id}
							onChange={(e) => handleShowroomSelect(e.target.value)}
							className="text-xs font-medium text-on-surface bg-transparent border-none focus:outline-none cursor-pointer pr-2"
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

			{/* Navigation Tabs (Showroom-Scoped Only) */}
			<div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
				<button
					type="button"
					onClick={() => setActiveTab('bill')}
					className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
						activeTab === 'bill'
							? 'bg-secondary text-white font-semibold shadow-xs'
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
						className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
							activeTab === 'history'
								? 'bg-secondary text-white font-semibold shadow-xs'
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
					<div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => handleDateChange(addDays(selectedDate, -1))}
								className="p-1.5 rounded-lg bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
								title="Previous Day"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>

							<button
								type="button"
								onClick={() => handleDateChange(getTodayStr())}
								className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer border ${
									selectedDate === getTodayStr()
										? 'bg-secondary text-white border-secondary'
										: 'bg-surface-container text-on-surface-variant border-outline-variant hover:bg-surface-container-high'
								}`}
							>
								Today
							</button>

							<button
								type="button"
								onClick={() => handleDateChange(addDays(selectedDate, 1))}
								className="p-1.5 rounded-lg bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
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
								className="form-input text-xs py-1 px-2.5 bg-surface-container-lowest border-outline-variant rounded-lg"
							/>
						</div>
					</div>

					{/* Daily Financial Summary Block (TODAY'S BILLING) */}
					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 sm:p-5 shadow-xs">
						<div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
							Today&apos;s Billing Summary
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/40">
							<div className="pt-2 sm:pt-0 sm:px-3 first:pl-0 space-y-1">
								<span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider block">Daily Total Bill</span>
								<p className="text-2xl font-bold text-on-surface font-mono">
									{formatINR(dailyBillData?.amount ?? 0)}
								</p>
								<span className="text-xs text-on-surface-variant block">Billed for this date</span>
							</div>

							<div className="pt-3 sm:pt-0 sm:px-3 space-y-1">
								<span className="text-xs font-medium text-emerald-800 uppercase tracking-wider block">Amount Received</span>
								<p className="text-2xl font-bold text-emerald-700 font-mono">
									{formatINR(dailyBillData?.amountReceived ?? 0)}
								</p>
								<span className="text-xs text-on-surface-variant block">Total payments collected</span>
							</div>

							<div className="pt-3 sm:pt-0 sm:px-3 space-y-1">
								<span className="text-xs font-medium text-rose-800 uppercase tracking-wider block">Remaining Balance</span>
								<p className="text-2xl font-bold text-rose-700 font-mono">
									{formatINR(dailyBillData?.balanceAmount ?? 0)}
								</p>
								<span className="text-xs text-on-surface-variant block">Outstanding for this bill</span>
							</div>

							<div className="pt-3 sm:pt-0 sm:px-3 space-y-1">
								<span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider block">Payment Status</span>
								<div className="pt-1">
									{getPaymentStatusBadge(dailyBillData?.status || 'Unpaid')}
								</div>
								<span className="text-xs text-on-surface-variant block pt-1">
									{isPaidInFull ? 'Fully settled' : 'Pending full settlement'}
								</span>
							</div>
						</div>
					</div>

					{/* No Bill Set Notice Banner */}
					{!dailyBillLoading && !hasBill && (
						<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
							<div className="flex items-start gap-3">
								<AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
								<div>
									<h4 className="text-sm font-semibold text-amber-950">No daily bill has been set for this date.</h4>
									<p className="text-xs text-amber-800 mt-0.5">
										Set the daily billing amount to record commercial revenue and receive payments.
									</p>
								</div>
							</div>

							{canManageBilling && (
								<Button
									variant="primary"
									size="sm"
									icon={<Plus className="w-4 h-4" />}
									onClick={openSetBillModal}
									className="shrink-0"
								>
									Set Daily Bill
								</Button>
							)}
						</div>
					)}

					{/* Payment Transactions Section */}
					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden">
						<div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low/40">
							<div>
								<h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
									<CreditCard className="w-4 h-4 text-secondary" />
									Payment Transactions
								</h2>
								<p className="text-xs text-on-surface-variant mt-0.5">
									Payments received for this daily bill.
								</p>
							</div>

							<div className="flex items-center gap-2">
								{canManageBilling && hasBill && (
									<Button
										variant="ghost"
										size="sm"
										onClick={openSetBillModal}
									>
										Edit Daily Bill
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

						{/* Billing Notes if present */}
						{dailyBillData?.notes && (
							<div className="mx-4 my-3 p-3 bg-surface-container rounded-lg border border-outline-variant/60 text-xs text-on-surface">
								<span className="font-semibold mr-2">Billing Notes:</span>
								<span>{dailyBillData.notes}</span>
							</div>
						)}

						{/* Payments Table */}
						<div className="overflow-x-auto">
							<table className="app-table w-full">
								<thead>
									<tr>
										<th>DATE &amp; TIME</th>
										<th>METHOD</th>
										<th>REFERENCE</th>
										<th className="text-right">AMOUNT</th>
										<th>NOTES</th>
										<th className="text-right">ACTIONS</th>
									</tr>
								</thead>
								<tbody>
									{dailyBillLoading ? (
										<tr>
											<td colSpan={6} className="py-8 text-center text-xs text-on-surface-variant">
												Loading payments...
											</td>
										</tr>
									) : !dailyBillData?.payments || dailyBillData.payments.length === 0 ? (
										<tr>
											<td colSpan={6} className="py-8 text-center text-xs text-on-surface-variant">
												<p className="font-semibold text-on-surface">No payments recorded</p>
												<p className="text-xs text-on-surface-variant mt-0.5">Payments made against this daily bill will appear here.</p>
											</td>
										</tr>
									) : (
										dailyBillData.payments.map((p) => (
											<tr key={p.id} className="hover:bg-surface-container/40 transition-colors">
												<td className="text-xs text-on-surface">{formatDateTime(p.paymentDate)}</td>
												<td className="text-xs font-medium text-on-surface">
													<span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface text-xs font-medium border border-outline-variant">
														{p.paymentMethod}
													</span>
												</td>
												<td className="font-mono text-xs text-on-surface-variant">{p.reference || '—'}</td>
												<td className="font-mono text-sm font-bold text-emerald-700 text-right">
													{formatINR(p.amount)}
												</td>
												<td className="text-xs text-on-surface-variant">{p.notes || '—'}</td>
												<td className="text-right">
													{canDeletePayment && (
														<button
															type="button"
															onClick={() => setDeletingPayment(p)}
															className="p-1 rounded-md text-error hover:bg-error-container/40 transition-colors cursor-pointer"
															title="Void payment transaction"
														>
															<Trash2 className="w-4 h-4" />
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
			)}

			{/* ══════════════════════════════════════════════════════════════════════ */}
			{/* TAB 2: BILLING HISTORY & SUMMARY                                       */}
			{/* ══════════════════════════════════════════════════════════════════════ */}
			{activeTab === 'history' && canViewHistory && (
				<div className="space-y-6">
					{/* Presets and Filter Bar */}
					<div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
						<div className="flex items-center gap-2 flex-wrap">
							<span className="font-semibold text-xs text-on-surface-variant uppercase tracking-wider mr-1">Date Range:</span>
							{(['this_month', 'last_month', 'this_week', 'today', 'custom'] as DateRangePreset[]).map(
								(p) => (
									<button
										key={p}
										type="button"
										onClick={() => setHistoryPreset(p)}
										className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
											historyPreset === p
												? 'bg-secondary text-white font-semibold shadow-xs'
												: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high border border-outline-variant'
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
									className="form-input text-xs py-1 px-2.5"
								/>
								<span className="text-xs text-on-surface-variant">to</span>
								<input
									type="date"
									value={customEnd}
									onChange={(e) => setCustomEnd(e.target.value)}
									className="form-input text-xs py-1 px-2.5"
								/>
							</div>
						)}
					</div>

					{/* Summary Metric Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-xs space-y-1">
							<span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider block">Total Billed</span>
							<p className="text-2xl font-bold text-on-surface font-mono">
								{formatINR(summaryData?.totalBilled ?? 0)}
							</p>
							<span className="text-xs text-on-surface-variant block">Over selected range</span>
						</div>

						<div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-xs space-y-1">
							<span className="text-xs text-emerald-800 font-medium uppercase tracking-wider block">Total Received</span>
							<p className="text-2xl font-bold text-emerald-700 font-mono">
								{formatINR(summaryData?.totalReceived ?? 0)}
							</p>
							<span className="text-xs text-on-surface-variant block">Payments collected</span>
						</div>

						<div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-xs space-y-1">
							<span className="text-xs text-rose-800 font-medium uppercase tracking-wider block">Outstanding Balance</span>
							<p className="text-2xl font-bold text-rose-700 font-mono">
								{formatINR(summaryData?.outstandingAmount ?? 0)}
							</p>
							<span className="text-xs text-on-surface-variant block">Unsettled receivables</span>
						</div>
					</div>

					{/* Daily Billing Ledger Table */}
					<div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden">
						<div className="p-4 border-b border-outline-variant bg-surface-container-low/40">
							<h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
								<History className="w-4 h-4 text-secondary" />
								Daily Billing History &amp; Ledger
							</h2>
							<p className="text-xs text-on-surface-variant mt-0.5">
								Breakdown of commercial billing and receipts for each day in range
							</p>
						</div>

						<div className="overflow-x-auto">
							<table className="app-table w-full">
								<thead>
									<tr>
										<th>Date</th>
										<th className="text-right">Billed Amount</th>
										<th className="text-right">Received Amount</th>
										<th className="text-right">Balance</th>
										<th className="text-center">Status</th>
										<th className="text-right">Action</th>
									</tr>
								</thead>
								<tbody>
									{summaryLoading ? (
										<tr>
											<td colSpan={6} className="py-8 text-center text-xs text-on-surface-variant">
												Loading billing history...
											</td>
										</tr>
									) : !summaryData?.dailyHistory || summaryData.dailyHistory.length === 0 ? (
										<tr>
											<td colSpan={6} className="py-8 text-center text-xs text-on-surface-variant">
												No activity records found for this period.
											</td>
										</tr>
									) : (
										summaryData.dailyHistory.map((row) => (
											<tr key={row.date} className="hover:bg-surface-container/40 transition-colors">
												<td className="font-medium text-xs text-on-surface">
													{formatDateHeading(row.date)}
												</td>
												<td className="font-mono text-sm text-on-surface text-right">{formatINR(row.billedAmount)}</td>
												<td className="font-mono text-sm text-emerald-700 font-semibold text-right">
													{formatINR(row.receivedAmount)}
												</td>
												<td className="font-mono text-sm text-rose-700 font-semibold text-right">
													{formatINR(row.balanceAmount)}
												</td>
												<td className="text-center">{getPaymentStatusBadge(row.status)}</td>
												<td className="text-right">
													<button
														type="button"
														onClick={() => {
															handleDateChange(row.date);
															setActiveTab('bill');
														}}
														className="text-secondary hover:text-secondary/80 font-medium px-2.5 py-1 rounded-md bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer text-xs"
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
								className="form-input w-full text-sm font-mono font-bold"
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
								size="sm"
								onClick={() => setShowSetBillModal(false)}
								disabled={setDailyBillMutation.isPending}
							>
								Cancel
							</Button>
							<Button type="submit" variant="primary" size="sm" loading={setDailyBillMutation.isPending}>
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
								className="form-input w-full text-sm font-mono font-bold"
								required
							/>
							<p className="text-xs text-on-surface-variant font-mono">
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
								aria-label="Transaction ID / Reference"
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
								aria-label="Payment Notes"
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
								size="sm"
								onClick={() => setShowRecordPaymentModal(false)}
								disabled={recordPaymentMutation.isPending}
							>
								Cancel
							</Button>
							<Button type="submit" variant="primary" size="sm" loading={recordPaymentMutation.isPending}>
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
						<div className="p-3 rounded-lg bg-error-container/40 border border-error/20 text-xs text-error flex items-start gap-2">
							<AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
							<span>
								Voiding this transaction will restore the remaining balance by {formatINR(deletingPayment.amount)}.
							</span>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/60">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setDeletingPayment(null)}
								disabled={deletePaymentMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="danger"
								size="sm"
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
