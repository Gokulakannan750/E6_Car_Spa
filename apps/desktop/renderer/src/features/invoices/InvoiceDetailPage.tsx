import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
	ArrowLeft,
	Receipt,
	User,
	Car,
	FileText,
	CheckCircle2,
	RefreshCw,
	AlertCircle,
	Save,
	Tag,
	Check,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import {
	getInvoiceById,
	updateInvoice,
	type InvoiceDto,
	type InvoiceStatus,
} from '../../lib/api';

// ─── Status Helpers ──────────────────────────────────────────────────────────
const STATUS_ENUM_MAP: Record<number, InvoiceStatus> = {
	0: 'Draft',
	1: 'Sent',
	2: 'Paid',
	3: 'PartiallyPaid',
	4: 'Cancelled',
	5: 'Overdue',
};

function normalizeInvoiceStatus(status: unknown): InvoiceStatus {
	if (typeof status === 'number') {
		return STATUS_ENUM_MAP[status] ?? 'Draft';
	}
	if (typeof status === 'string') {
		const num = Number(status);
		if (!isNaN(num) && status.trim() !== '') {
			return STATUS_ENUM_MAP[num] ?? 'Draft';
		}
		return (status as InvoiceStatus) || 'Draft';
	}
	return 'Draft';
}

function getInvoiceStatusSlug(
	status: unknown,
	calculations?: { paidAmount: number; totalAmount: number; balanceAmount: number }
): string {
	const normalized = normalizeInvoiceStatus(status);
	if (normalized === 'Cancelled') return 'cancelled';

	if (calculations) {
		if (calculations.balanceAmount <= 0 && calculations.paidAmount >= calculations.totalAmount && calculations.totalAmount > 0) {
			return 'paid';
		}
		if (calculations.paidAmount > 0 && calculations.paidAmount < calculations.totalAmount) {
			return 'partially-paid';
		}
	}

	if (normalized === 'Paid') return 'paid';
	if (normalized === 'PartiallyPaid') return 'partially-paid';
	return 'unpaid';
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────
function formatCurrency(value: number) {
	return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
}

export function InvoiceDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();

	// State
	const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Editable fields
	const [discount, setDiscount] = useState<string>('0');
	const [isGstEnabled, setIsGstEnabled] = useState<boolean>(true);
	const [notes, setNotes] = useState<string>('');

	// Mutation states
	const [isSaving, setIsSaving] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Initial loaded values for modification check
	const [initialGstEnabled, setInitialGstEnabled] = useState<boolean>(true);

	// ─── Fetch Invoice ───────────────────────────────────────────────────────
	const fetchInvoice = useCallback(async () => {
		if (!id) return;
		setLoading(true);
		setError(null);
		try {
			const data = await getInvoiceById(id);
			setInvoice(data);
			setDiscount(String(data.discount ?? 0));
			setNotes(data.notes ?? '');

			const gstActive = typeof data.isGstEnabled === 'boolean' ? data.isGstEnabled : true;
			setIsGstEnabled(gstActive);
			setInitialGstEnabled(gstActive);
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to load invoice';
			setError(msg);
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		fetchInvoice();
	}, [fetchInvoice]);

	// ─── Real-Time Recalculations ────────────────────────────────────────────
	const parsedDiscount = useMemo(() => {
		const val = parseFloat(discount);
		return isNaN(val) ? 0 : val;
	}, [discount]);

	const calculations = useMemo(() => {
		if (!invoice) {
			return {
				subtotal: 0,
				discount: 0,
				cgst: 0,
				sgst: 0,
				gstAmount: 0,
				totalAmount: 0,
				paidAmount: 0,
				balanceAmount: 0,
				isValidDiscount: true,
			};
		}

		const subtotal = invoice.subtotal;
		const isValidDiscount = parsedDiscount >= 0 && parsedDiscount <= subtotal;
		const effectiveDiscount = isValidDiscount ? parsedDiscount : (parsedDiscount > subtotal ? subtotal : 0);
		const gstBase = Math.max(0, subtotal - effectiveDiscount);

		const cgst = isGstEnabled ? Math.round(gstBase * 0.09 * 100) / 100 : 0;
		const sgst = isGstEnabled ? Math.round(gstBase * 0.09 * 100) / 100 : 0;
		const gstAmount = isGstEnabled ? (cgst + sgst) : 0;
		const totalAmount = isGstEnabled ? (gstBase + gstAmount) : (subtotal - effectiveDiscount);
		const paidAmount = invoice.paidAmount ?? 0;
		const balanceAmount = Math.max(0, totalAmount - paidAmount);

		return {
			subtotal,
			discount: effectiveDiscount,
			cgst,
			sgst,
			gstAmount,
			totalAmount,
			paidAmount,
			balanceAmount,
			isValidDiscount,
		};
	}, [invoice, parsedDiscount, isGstEnabled]);

	// ─── Check if modified ───────────────────────────────────────────────────
	const isModified = useMemo(() => {
		if (!invoice) return false;
		const originalDiscount = invoice.discount ?? 0;
		const originalNotes = invoice.notes ?? '';

		return (
			parsedDiscount !== originalDiscount ||
			isGstEnabled !== initialGstEnabled ||
			notes !== originalNotes
		);
	}, [invoice, parsedDiscount, isGstEnabled, initialGstEnabled, notes]);

	// ─── Save Changes ────────────────────────────────────────────────────────
	const handleSave = async () => {
		if (!id || !invoice || isSaving) return;
		if (parsedDiscount < 0) {
			setSaveError('Discount cannot be negative.');
			return;
		}
		if (parsedDiscount > invoice.subtotal) {
			setSaveError(`Discount cannot exceed subtotal (${formatCurrency(invoice.subtotal)})`);
			return;
		}

		setIsSaving(true);
		setSaveError(null);
		setSaveSuccess(false);

		try {
			const updated = await updateInvoice(id, {
				discount: parsedDiscount,
				notes: notes.trim() || null,
				isGstEnabled,
			});

			setInvoice(updated);
			setDiscount(String(updated.discount ?? 0));
			setNotes(updated.notes ?? '');
			const gstActive = typeof updated.isGstEnabled === 'boolean' ? updated.isGstEnabled : isGstEnabled;
			setIsGstEnabled(gstActive);
			setInitialGstEnabled(gstActive);
			setSaveSuccess(true);

			setTimeout(() => {
				setSaveSuccess(false);
			}, 3000);
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to save changes';
			setSaveError(msg);
		} finally {
			setIsSaving(false);
		}
	};

	// ─── Render Loading / Error States ───────────────────────────────────────
	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-24 space-y-3">
				<RefreshCw className="w-8 h-8 animate-spin text-secondary" />
				<p className="text-sm font-medium text-on-surface-variant">Loading invoice details...</p>
			</div>
		);
	}

	if (error || !invoice) {
		return (
			<div className="space-y-4 max-w-xl mx-auto py-12">
				<div className="app-card p-6 border-error/30 bg-error/5 text-center space-y-3">
					<AlertCircle className="w-10 h-10 text-error mx-auto" />
					<h2 className="text-lg font-bold text-on-surface">Invoice Not Found</h2>
					<p className="text-sm text-on-surface-variant">{error || 'The requested invoice could not be found.'}</p>
					<div className="flex justify-center gap-3 pt-2">
						<Button variant="secondary" onClick={() => navigate('/invoices')}>
							<ArrowLeft className="w-4 h-4 mr-1" />
							Back to Invoices
						</Button>
						<Button onClick={fetchInvoice}>Retry</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 animate-fade-in pb-12">
			{/* ── Top Bar / Header ───────────────────────────────────────────── */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-outline-variant">
				<div>
					<button
						type="button"
						onClick={() => navigate('/invoices')}
						className="inline-flex items-center text-xs font-semibold text-on-surface-variant hover:text-secondary mb-2 transition-colors"
					>
						<ArrowLeft className="w-3.5 h-3.5 mr-1" />
						Back to Invoices
					</button>
					<div className="flex items-center gap-3 flex-wrap">
						<div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
							<Receipt className="w-5 h-5" />
						</div>
						<div>
							<div className="flex items-center gap-2.5">
								<h1 className="text-2xl font-bold font-mono text-on-surface tracking-tight">
									Invoice #{invoice.invoiceNumber}
								</h1>
								{/* Read-only status badge derived from payment status */}
								<StatusBadge status={getInvoiceStatusSlug(invoice.status, calculations)} />
							</div>
							<div className="flex items-center gap-3 text-xs text-on-surface-variant mt-0.5 flex-wrap">
								<span>
									Job Card:{' '}
									<Link
										to={`/job-cards/${invoice.jobCardId}`}
										className="font-mono font-semibold text-secondary hover:underline"
									>
										{invoice.jobCardNumber}
									</Link>
								</span>
								<span>•</span>
								<span>Invoice Date: {formatDate(invoice.invoiceDate)}</span>
							</div>
						</div>
					</div>
				</div>

				{/* Save Action */}
				<div className="flex items-center gap-3">
					{saveSuccess && (
						<div className="flex items-center gap-1.5 text-success text-xs font-semibold bg-success-container/50 px-3 py-1.5 rounded-lg">
							<CheckCircle2 className="w-4 h-4" />
							<span>Saved successfully</span>
						</div>
					)}
					<Button
						variant="secondary"
						onClick={() => navigate('/invoices')}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={!isModified || isSaving || !calculations.isValidDiscount}
						loading={isSaving}
						icon={<Save className="w-4 h-4" />}
					>
						Save Changes
					</Button>
				</div>
			</div>

			{/* ── Error Notification ────────────────────────────────────────── */}
			{saveError && (
				<div className="app-card p-4 border-error/40 bg-error/10 flex items-center gap-3 text-sm text-error">
					<AlertCircle className="w-5 h-5 shrink-0" />
					<p className="flex-1 font-medium">{saveError}</p>
					<button
						type="button"
						onClick={() => setSaveError(null)}
						className="text-xs underline hover:no-underline"
					>
						Dismiss
					</button>
				</div>
			)}

			{/* ── Meta Info Cards (Customer / Vehicle / Job Card) ────────────── */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* Customer */}
				<div className="app-card p-4 space-y-2">
					<div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
						<User className="w-4 h-4 text-secondary" />
						<span>Customer</span>
					</div>
					<div>
						<p className="text-base font-bold text-on-surface">{invoice.customerName}</p>
						<p className="text-xs font-mono text-on-surface-variant mt-0.5">{invoice.customerPhone}</p>
					</div>
				</div>

				{/* Vehicle */}
				<div className="app-card p-4 space-y-2">
					<div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
						<Car className="w-4 h-4 text-secondary" />
						<span>Vehicle</span>
					</div>
					<div>
						<p className="text-base font-bold text-on-surface">
							{invoice.vehicleMake} {invoice.vehicleModel}
							{invoice.vehicleVariant ? ` (${invoice.vehicleVariant})` : ''}
						</p>
						<div className="flex items-center gap-2 mt-0.5">
							{invoice.registrationNumber && (
								<span className="bg-surface-container px-2 py-0.5 rounded text-xs font-bold font-mono text-on-surface">
									{invoice.registrationNumber}
								</span>
							)}
							{invoice.vehicleColor && (
								<span className="text-xs text-on-surface-variant">{invoice.vehicleColor}</span>
							)}
						</div>
					</div>
				</div>

				{/* Job Card */}
				<div className="app-card p-4 space-y-2">
					<div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
						<FileText className="w-4 h-4 text-secondary" />
						<span>Job Card Reference</span>
					</div>
					<div>
						<Link
							to={`/job-cards/${invoice.jobCardId}`}
							className="text-base font-bold font-mono text-secondary hover:underline inline-flex items-center gap-1"
						>
							{invoice.jobCardNumber}
						</Link>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Invoice Date: {formatDate(invoice.invoiceDate)}
						</p>
					</div>
				</div>
			</div>

			{/* ── Main Layout: Items Table & Sidebar ─────────────────────────── */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* ── Left Column: Service Table & Notes (2 cols) ─────────────── */}
				<div className="lg:col-span-2 space-y-6">
					{/* Service Table */}
					<div className="app-card overflow-hidden">
						<div className="p-4 border-b border-outline-variant bg-surface-container-low/50 flex items-center justify-between">
							<h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
								Service Items ({invoice.items?.length ?? 0})
							</h3>
						</div>
						<div className="overflow-x-auto">
							<table className="app-table">
								<thead>
									<tr>
										<th>Service / Item</th>
										<th className="text-center w-20">Qty</th>
										<th className="text-right">Rate</th>
										<th className="text-right">Total</th>
									</tr>
								</thead>
								<tbody>
									{(!invoice.items || invoice.items.length === 0) && (
										<tr>
											<td colSpan={4} className="py-8 text-center text-on-surface-variant text-xs">
												No items recorded on this invoice.
											</td>
										</tr>
									)}
									{invoice.items?.map((item, idx) => {
										const lineItemTotal = item.unitPrice * item.quantity;
										return (
											<tr key={item.id || idx} className="hover:bg-surface-container-low/30 transition-colors">
												<td className="py-3.5 px-4">
													<p className="font-semibold text-on-surface">{item.description}</p>
												</td>
												<td className="py-3.5 px-3 text-center font-mono text-xs">
													{item.quantity}
												</td>
												<td className="py-3.5 px-4 text-right font-mono text-on-surface text-xs">
													{formatCurrency(item.unitPrice)}
												</td>
												<td className="py-3.5 px-4 text-right font-mono font-bold text-on-surface text-sm">
													{formatCurrency(lineItemTotal)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>

					{/* Notes */}
					<div className="app-card p-5 space-y-3">
						<div className="flex items-center gap-2">
							<FileText className="w-4 h-4 text-secondary" />
							<h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
								Invoice Notes &amp; Terms
							</h3>
						</div>
						<textarea
							rows={4}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Add customer notes, warranty info, or terms of service..."
							className="form-input w-full text-sm resize-none bg-white"
						/>
						<p className="text-[11px] text-on-surface-variant">
							Notes will be printed on the invoice receipt. Click "Save Changes" to apply.
						</p>
					</div>
				</div>

				{/* ── Right Column: GST Control & Summary (1 col) ─────────────── */}
				<div className="space-y-6">
					{/* GST Control Card */}
					<div className="app-card p-5 space-y-3">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
									GST Control
								</h3>
								<p className="text-xs text-on-surface-variant mt-0.5">
									{isGstEnabled ? 'CGST (9%) + SGST (9%) applied' : 'Non-GST billing (tax exempt)'}
								</p>
							</div>

							{/* Toggle switch */}
							<button
								type="button"
								onClick={() => setIsGstEnabled((prev) => !prev)}
								className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
									isGstEnabled ? 'bg-secondary' : 'bg-outline-variant'
								}`}
								role="switch"
								aria-checked={isGstEnabled}
							>
								<span
									className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
										isGstEnabled ? 'translate-x-6' : 'translate-x-0'
									}`}
								/>
							</button>
						</div>

						<div className="pt-2 border-t border-outline-variant/60 flex items-center gap-2">
							<span
								className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
									isGstEnabled
										? 'bg-secondary/10 text-secondary border border-secondary/20'
										: 'bg-surface-container text-on-surface-variant'
								}`}
							>
								{isGstEnabled && <Check className="w-3.5 h-3.5" />}
								GST Enabled: {isGstEnabled ? 'ON' : 'OFF'}
							</span>
						</div>
					</div>

					{/* Financial Summary */}
					<div className="app-card p-5 space-y-4">
						<h3 className="text-sm font-bold text-on-surface uppercase tracking-wider pb-2 border-b border-outline-variant">
							Summary
						</h3>

						<div className="space-y-2.5 text-sm">
							{/* Subtotal */}
							<div className="flex justify-between text-on-surface-variant">
								<span>Subtotal</span>
								<span className="font-mono font-medium text-on-surface">
									{formatCurrency(calculations.subtotal)}
								</span>
							</div>

							{/* Editable Discount */}
							<div className="py-2 border-y border-outline-variant/60 space-y-1.5">
								<div className="flex items-center justify-between">
									<label className="text-xs font-bold text-on-surface flex items-center gap-1">
										<Tag className="w-3.5 h-3.5 text-secondary" />
										<span>Discount ₹</span>
									</label>
									<span className="text-[11px] text-on-surface-variant font-mono">
										Max: {formatCurrency(calculations.subtotal)}
									</span>
								</div>
								<div className="relative">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-mono text-sm">
										₹
									</span>
									<input
										type="number"
										min="0"
										step="0.01"
										max={calculations.subtotal}
										value={discount}
										onChange={(e) => setDiscount(e.target.value)}
										className={`form-input pl-7 pr-3 py-1.5 w-full font-mono text-sm ${
											!calculations.isValidDiscount ? 'border-error ring-1 ring-error' : ''
										}`}
										placeholder="0.00"
									/>
								</div>
								{!calculations.isValidDiscount && (
									<p className="text-[11px] text-error font-medium">
										{parsedDiscount < 0
											? 'Discount cannot be negative.'
											: 'Discount cannot exceed subtotal.'}
									</p>
								)}
							</div>

							{/* CGST 9% (Only visible when GST is ON) */}
							{isGstEnabled && (
								<div className="flex justify-between text-on-surface-variant">
									<span>CGST 9%</span>
									<span className="font-mono font-medium text-on-surface">
										{formatCurrency(calculations.cgst)}
									</span>
								</div>
							)}

							{/* SGST 9% (Only visible when GST is ON) */}
							{isGstEnabled && (
								<div className="flex justify-between text-on-surface-variant">
									<span>SGST 9%</span>
									<span className="font-mono font-medium text-on-surface">
										{formatCurrency(calculations.sgst)}
									</span>
								</div>
							)}

							{/* Grand Total */}
							<div className="flex justify-between text-base font-bold text-on-surface pt-3 border-t border-outline-variant">
								<span>Grand Total</span>
								<span className="font-mono text-secondary text-lg">
									{formatCurrency(calculations.totalAmount)}
								</span>
							</div>

							{/* Paid */}
							<div className="flex justify-between text-xs text-on-surface-variant pt-1">
								<span>Paid</span>
								<span className="font-mono font-medium text-success">
									{formatCurrency(calculations.paidAmount)}
								</span>
							</div>

							{/* Balance */}
							<div className="flex justify-between text-sm font-bold pt-2 border-t border-outline-variant/60">
								<span className="text-on-surface">Balance</span>
								<span className={`font-mono ${calculations.balanceAmount > 0 ? 'text-error' : 'text-success'}`}>
									{formatCurrency(calculations.balanceAmount)}
								</span>
							</div>
						</div>

						{/* Quick Save Button in sidebar */}
						<Button
							className="w-full mt-2"
							onClick={handleSave}
							disabled={!isModified || isSaving || !calculations.isValidDiscount}
							loading={isSaving}
							icon={<Save className="w-4 h-4" />}
						>
							Save Changes
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
