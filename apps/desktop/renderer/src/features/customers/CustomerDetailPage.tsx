import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ArrowLeft,
	Phone,
	Mail,
	MapPin,
	Calendar,
	Car,
	Plus,
	Edit3,
	RefreshCw,
	AlertCircle,
	CreditCard,
	CheckCircle2,
	Clock,
	Receipt,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EditCustomerModal } from './EditCustomerModal';
import {
	getCustomerById,
	getVehiclesByCustomer,
	getCustomerHistory,
	type CustomerDto,
	type VehicleDto,
	type CustomerJobCardHistoryItemDto,
} from '../../lib/api';

export function CustomerDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [activityFilter, setActivityFilter] = useState<'all' | 'paid' | 'payment-pending' | 'partially-paid'>('all');
	const [editingCustomer, setEditingCustomer] = useState<CustomerDto | null>(null);

	// ─── Fetch Customer Profile ───────────────────────────────────────────────
	const {
		data: customer,
		isLoading: isLoadingCustomer,
		isError: isCustomerError,
		error: customerError,
		refetch: refetchCustomer,
	} = useQuery({
		queryKey: ['customer', id],
		queryFn: () => getCustomerById(id!),
		enabled: !!id,
	});

	// ─── Fetch Customer Vehicles ──────────────────────────────────────────────
	const {
		data: vehiclesData,
		isLoading: isLoadingVehicles,
	} = useQuery({
		queryKey: ['vehicles-by-customer', id],
		queryFn: () => getVehiclesByCustomer(id!),
		enabled: !!id,
	});
	const vehicles: VehicleDto[] = vehiclesData ?? [];

	// ─── Fetch Customer History (Authoritative Invoices & Payments) ───────────
	const {
		data: customerHistoryData,
		isLoading: isLoadingHistory,
		isError: isHistoryError,
		refetch: refetchHistory,
	} = useQuery({
		queryKey: ['customer-history', id],
		queryFn: () => getCustomerHistory(id!),
		enabled: !!id,
	});
	const customerInvoices: CustomerJobCardHistoryItemDto[] = customerHistoryData?.jobCards ?? [];

	// ─── Filter Logic ─────────────────────────────────────────────────────────
	const isCancelled = (inv: CustomerJobCardHistoryItemDto) =>
		inv.paymentStatus === 'Cancelled' || inv.status === 'Cancelled' || inv.invoiceStatus === 'Cancelled';

	const isPaid = (inv: CustomerJobCardHistoryItemDto) =>
		!isCancelled(inv) &&
		(inv.paymentStatus === 'Paid' ||
			(inv.invoiceTotal != null && (inv.outstandingAmount ?? 0) <= 0 && (inv.paidAmount ?? 0) > 0));

	const isPartiallyPaid = (inv: CustomerJobCardHistoryItemDto) =>
		!isCancelled(inv) &&
		!isPaid(inv) &&
		(inv.paymentStatus === 'Partially Paid' ||
			inv.paymentStatus === 'PartiallyPaid' ||
			((inv.paidAmount ?? 0) > 0 && (inv.outstandingAmount ?? 0) > 0));

	const isPaymentPending = (inv: CustomerJobCardHistoryItemDto) =>
		!isCancelled(inv) &&
		!isPaid(inv) &&
		!isPartiallyPaid(inv) &&
		inv.paymentStatus !== 'Draft' &&
		inv.status !== 'Draft' &&
		inv.invoiceStatus !== 'Draft' &&
		(inv.outstandingAmount ?? 0) > 0 &&
		(inv.paidAmount ?? 0) === 0;

	const isDraft = (inv: CustomerJobCardHistoryItemDto) =>
		!isCancelled(inv) &&
		(inv.paymentStatus === 'Draft' || inv.status === 'Draft' || inv.invoiceStatus === 'Draft');

	const paidCount = customerInvoices.filter(isPaid).length;
	const paymentPendingCount = customerInvoices.filter(isPaymentPending).length;
	const partiallyPaidCount = customerInvoices.filter(isPartiallyPaid).length;
	const allCount = customerInvoices.length;

	const filteredInvoices = customerInvoices.filter((inv) => {
		if (activityFilter === 'all') return true;
		if (activityFilter === 'paid') return isPaid(inv);
		if (activityFilter === 'payment-pending') return isPaymentPending(inv);
		if (activityFilter === 'partially-paid') return isPartiallyPaid(inv);
		return true;
	});

	// ─── Loading State ────────────────────────────────────────────────────────
	if (isLoadingCustomer) {
		return (
			<div className="flex flex-col items-center justify-center py-24 space-y-3">
				<RefreshCw className="w-8 h-8 animate-spin text-secondary" />
				<p className="text-sm font-medium text-on-surface-variant">Loading customer details...</p>
			</div>
		);
	}

	// ─── Error / Not Found State ──────────────────────────────────────────────
	if (isCustomerError || !customer) {
		return (
			<div className="max-w-md mx-auto py-16 text-center space-y-4">
				<div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto">
					<AlertCircle className="w-6 h-6" />
				</div>
				<div>
					<h2 className="text-lg font-bold text-on-surface">Customer Not Found</h2>
					<p className="text-sm text-on-surface-variant mt-1">
						{customerError instanceof Error ? customerError.message : 'The requested customer could not be found.'}
					</p>
				</div>
				<div className="flex justify-center gap-3 pt-2">
					<Button variant="secondary" onClick={() => navigate('/customers')}>
						<ArrowLeft className="w-4 h-4 mr-1.5" />
						Back to Customers
					</Button>
					<Button onClick={() => refetchCustomer()}>Retry</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
			{/* ── Top Navigation & Actions ──────────────────────────────────────── */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-outline-variant">
				<div>
					<button
						type="button"
						onClick={() => navigate('/customers')}
						className="inline-flex items-center text-xs font-semibold text-on-surface-variant hover:text-secondary mb-2 transition-colors cursor-pointer"
					>
						<ArrowLeft className="w-3.5 h-3.5 mr-1" />
						Back to Customers
					</button>
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold text-on-surface tracking-tight">{customer.name}</h1>
						<span className="text-xs font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant/60">
							{customer.phoneNumber}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="secondary"
						icon={<Edit3 className="w-4 h-4" />}
						onClick={() => setEditingCustomer(customer)}
					>
						Edit Customer
					</Button>
					<Button
						icon={<Plus className="w-4 h-4" />}
						onClick={() => {
							const primaryVehicle = vehicles.length > 0 ? vehicles[0] : null;
							navigate('/job-cards/new', {
								state: {
									customer,
									vehicles,
									selectedVehicle: primaryVehicle,
									step: primaryVehicle ? 1 : 0,
								},
							});
						}}
					>
						New Job Card
					</Button>
				</div>
			</div>

			{/* ── Customer Profile Information Card ─────────────────────────────── */}
			<div className="app-card p-5 bg-surface-container-low border border-outline-variant rounded-xl shadow-2xs">
				<h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">
					Customer Profile
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
					<div className="flex items-start gap-3">
						<div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0 mt-0.5">
							<Phone className="w-4 h-4" />
						</div>
						<div>
							<span className="text-xs text-on-surface-variant block font-medium">Phone Number</span>
							<span className="font-semibold text-on-surface font-mono">{customer.phoneNumber}</span>
						</div>
					</div>

					<div className="flex items-start gap-3">
						<div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0 mt-0.5">
							<Mail className="w-4 h-4" />
						</div>
						<div className="min-w-0">
							<span className="text-xs text-on-surface-variant block font-medium">Email Address</span>
							<span className="font-medium text-on-surface truncate block" title={customer.email || undefined}>
								{customer.email || '—'}
							</span>
						</div>
					</div>

					<div className="flex items-start gap-3">
						<div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0 mt-0.5">
							<MapPin className="w-4 h-4" />
						</div>
						<div className="min-w-0">
							<span className="text-xs text-on-surface-variant block font-medium">Billing Address</span>
							<span className="font-medium text-on-surface truncate block" title={customer.address || undefined}>
								{customer.address || '—'}
							</span>
						</div>
					</div>

					<div className="flex items-start gap-3">
						<div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0 mt-0.5">
							<Calendar className="w-4 h-4" />
						</div>
						<div>
							<span className="text-xs text-on-surface-variant block font-medium">Member Since</span>
							<span className="font-medium text-on-surface">
								{new Date(customer.createdAt).toLocaleDateString('en-IN', {
									day: 'numeric',
									month: 'short',
									year: 'numeric',
								})}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* ── Registered Vehicles Section ───────────────────────────────────── */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-base font-bold text-on-surface flex items-center gap-2">
						<Car className="w-4 h-4 text-secondary" />
						Registered Vehicles
						<span className="text-xs font-normal text-on-surface-variant">({vehicles.length})</span>
					</h2>
				</div>

				{isLoadingVehicles ? (
					<div className="py-6 text-center text-on-surface-variant">
						<RefreshCw className="w-5 h-5 animate-spin mx-auto text-secondary mb-1" />
						<p className="text-xs">Loading vehicles...</p>
					</div>
				) : vehicles.length > 0 ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
						{vehicles.map((v) => (
							<div
								key={v.id}
								className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant flex items-center justify-between hover:border-secondary/50 transition-colors shadow-2xs"
							>
								<div className="flex items-center gap-3">
									<div className="p-2 rounded-lg bg-secondary/10 text-secondary shrink-0">
										<Car className="w-4 h-4" />
									</div>
									<div>
										<p className="font-bold text-on-surface font-mono text-sm tracking-wide">{v.registrationNumber}</p>
										<p className="text-xs text-on-surface-variant">
											{v.make} {v.model} {v.variant ? `(${v.variant})` : ''} {v.color ? `· ${v.color}` : ''}
										</p>
									</div>
								</div>
								<Button
									size="sm"
									icon={<Plus className="w-3.5 h-3.5" />}
									onClick={() => {
										navigate('/job-cards/new', {
											state: {
												customer,
												vehicles,
												selectedVehicle: v,
												step: 1,
											},
										});
									}}
									title="Create Job Card for this vehicle"
								>
									Job Card
								</Button>
							</div>
						))}
					</div>
				) : (
					<div className="p-5 text-center text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
						<p className="text-sm">No vehicles registered yet.</p>
					</div>
				)}
			</div>

			{/* ── Recent Activity & Financial History ───────────────────────────── */}
			<div className="space-y-3">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<h2 className="text-base font-bold text-on-surface flex items-center gap-2">
						<Receipt className="w-4 h-4 text-secondary" />
						Recent Activity
						<span className="text-xs font-normal text-on-surface-variant">({allCount} records)</span>
					</h2>

					{/* Filter Chips */}
					<div className="flex items-center gap-1.5 overflow-x-auto pb-1">
						{[
							{ id: 'all', label: 'All', count: allCount },
							{ id: 'paid', label: 'Paid', count: paidCount },
							{ id: 'payment-pending', label: 'Payment Pending', count: paymentPendingCount },
							{ id: 'partially-paid', label: 'Partially Paid', count: partiallyPaidCount },
						].map((tab) => {
							const isSelected = activityFilter === tab.id;
							return (
								<button
									key={tab.id}
									type="button"
									onClick={() => setActivityFilter(tab.id as typeof activityFilter)}
									className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
										isSelected
											? 'bg-secondary text-white shadow-xs'
											: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
									}`}
								>
									<span>{tab.label}</span>
									<span
										className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
											isSelected
												? 'bg-white/20 text-white'
												: 'bg-surface-container-high text-on-surface-variant'
										}`}
									>
										{tab.count}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{isLoadingHistory ? (
					<div className="py-8 text-center text-on-surface-variant">
						<RefreshCw className="w-6 h-6 animate-spin mx-auto text-secondary mb-2" />
						<p className="text-xs">Loading activity and financial records...</p>
					</div>
				) : isHistoryError ? (
					<div className="p-6 text-center text-error border border-error/20 bg-error/5 rounded-xl">
						<p className="text-sm font-medium">Unable to load customer activity.</p>
						<Button variant="secondary" size="sm" className="mt-2" onClick={() => refetchHistory()}>
							Retry
						</Button>
					</div>
				) : filteredInvoices.length > 0 ? (
					<div className="space-y-2.5">
						{filteredInvoices.map((inv) => {
							const invoiceId = inv.invoiceId;
							const invoiceNumber = inv.invoiceNumber || 'INV-UNKNOWN';
							const total = inv.invoiceTotal != null ? inv.invoiceTotal : inv.totalAmount;
							const paid = inv.paidAmount ?? 0;
							const pending = inv.outstandingAmount ?? Math.max(0, total - paid);

							const vehicleDetails = [
								inv.vehicleNumber,
								inv.vehicleModel,
							].filter(Boolean).join(' · ');

							return (
								<div
									key={inv.invoiceId || inv.jobCardId}
									className="p-4 bg-surface-container-low rounded-xl border border-outline-variant hover:border-secondary/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs group"
								>
									{/* Left: Invoice Number (Primary), Job Card Badge (Secondary), Date, Vehicle */}
									<div className="space-y-1">
										<div className="flex items-center gap-2.5 flex-wrap">
											<button
												type="button"
												onClick={() => invoiceId && navigate(`/invoices/${invoiceId}`)}
												className="font-bold text-secondary hover:underline font-mono text-base cursor-pointer"
											>
												{invoiceNumber}
											</button>
											{inv.jobCardNumber && inv.jobCardNumber !== invoiceNumber && (
												<button
													type="button"
													onClick={() => inv.jobCardId && navigate(`/job-cards/${inv.jobCardId}`)}
													className="text-xs font-mono font-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-outline-variant/60 hover:text-secondary cursor-pointer"
													title="View Job Card"
												>
													{inv.jobCardNumber}
												</button>
											)}
										</div>
										<p className="text-xs text-on-surface-variant">
											{new Date(inv.createdAt).toLocaleDateString('en-IN', {
												day: 'numeric',
												month: 'short',
												year: 'numeric',
											})}
											{vehicleDetails ? ` · ${vehicleDetails}` : ''}
										</p>
									</div>

									{/* Right: Authoritative Payment Status & Financial Breakdown */}
									<div className="flex items-center gap-6 md:text-right shrink-0 justify-between md:justify-end">
										<div className="text-xs space-y-0.5 text-on-surface-variant">
											<p>
												Total: <span className="font-medium text-on-surface font-mono">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
											</p>
											<p>
												Paid: <span className="font-medium text-emerald-600 dark:text-emerald-400 font-mono">₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> · Pending: <span className={`font-semibold font-mono ${pending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-on-surface-variant'}`}>₹{pending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
											</p>
										</div>

										{/* Payment Status Badge */}
										<div className="shrink-0">
											{isPaid(inv) && (
												<span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
													<CheckCircle2 className="w-3 h-3" />
													Paid
												</span>
											)}
											{isPartiallyPaid(inv) && (
												<span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
													<Clock className="w-3 h-3" />
													Partially Paid
												</span>
											)}
											{isPaymentPending(inv) && (
												<span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
													<Clock className="w-3 h-3" />
													Payment Pending
												</span>
											)}
											{isDraft(inv) && (
												<span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/60">
													Draft
												</span>
											)}
											{isCancelled(inv) && (
												<span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
													<AlertCircle className="w-3 h-3" />
													Cancelled
												</span>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="py-8 text-center text-on-surface-variant border border-dashed border-outline-variant/60 rounded-xl">
						<p className="text-sm">
							{activityFilter === 'all'
								? 'No invoice records found.'
								: `No ${activityFilter} invoice records found for this customer.`}
						</p>
					</div>
				)}
			</div>

			{/* ── Customer Total Outstanding Balance Summary Card ───────────────── */}
			<div className="pt-2">
				<div
					className={`p-4 rounded-xl border flex items-center justify-between transition-colors shadow-2xs ${
						(customerHistoryData?.totalOutstandingAmount ?? 0) > 0
							? 'bg-amber-500/5 border-amber-500/30'
							: 'bg-surface-container-low border-outline-variant/60'
					}`}
				>
					<div className="flex items-center gap-3">
						<div
							className={`p-2.5 rounded-xl ${
								(customerHistoryData?.totalOutstandingAmount ?? 0) > 0
									? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
									: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
							}`}
						>
							<CreditCard className="w-5 h-5" />
						</div>
						<div>
							<p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
								Total Customer Balance
							</p>
							<p
								className={`text-lg font-bold font-mono ${
									(customerHistoryData?.totalOutstandingAmount ?? 0) > 0
										? 'text-amber-600 dark:text-amber-400'
										: 'text-on-surface'
								}`}
							>
								₹{(customerHistoryData?.totalOutstandingAmount ?? 0).toLocaleString('en-IN', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}
							</p>
						</div>
					</div>

					<div>
						{(customerHistoryData?.totalOutstandingAmount ?? 0) > 0 ? (
							<span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
								<Clock className="w-3.5 h-3.5" />
								Outstanding Balance
							</span>
						) : (
							<span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
								<CheckCircle2 className="w-3.5 h-3.5" />
								All Settled
							</span>
						)}
					</div>
				</div>
			</div>

			{/* ── Edit Customer Modal ──────────────────────────────────────────── */}
			{editingCustomer && (
				<EditCustomerModal
					customer={editingCustomer}
					open={!!editingCustomer}
					onClose={() => setEditingCustomer(null)}
					onSuccess={() => {
						setEditingCustomer(null);
						queryClient.invalidateQueries({ queryKey: ['customer', id] });
						queryClient.invalidateQueries({ queryKey: ['customers'] });
						queryClient.invalidateQueries({ queryKey: ['customer-history', id] });
						queryClient.invalidateQueries({ queryKey: ['vehicles-by-customer', id] });
					}}
				/>
			)}
		</div>
	);
}