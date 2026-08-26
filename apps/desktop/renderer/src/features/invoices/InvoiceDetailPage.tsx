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
	Lock,
	Sparkles,
	Printer,
	XCircle,
	CreditCard,
	Wallet,
	QrCode,
	Building2,
	Download,
	X,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import {
	getInvoiceById,
	updateInvoice,
	generateInvoice,
	recordPayment,
	getBusinessProfile,
	getInvoiceWhatsAppStatus,
	type InvoiceDto,
	type InvoiceStatus,
	type BusinessProfileDto,
	type InvoiceWhatsAppStatusDto,
} from '../../lib/api';
import { InvoicePrintDocument } from './InvoicePrintDocument';
import { ShareInvoiceModal } from './ShareInvoiceModal';

// ─── Status Helpers ──────────────────────────────────────────────────────────
const STATUS_ENUM_MAP: Record<number, InvoiceStatus> = {
	0: 'Draft',
	2: 'Paid',
	3: 'PartiallyPaid',
	4: 'Cancelled',
	6: 'Generated',
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
	if (normalized === 'Generated') return 'generated';
	if (normalized === 'Draft') return 'draft';
	return 'draft';
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
	const [businessProfile, setBusinessProfile] = useState<BusinessProfileDto | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showPrintPreview, setShowPrintPreview] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);
	const [whatsAppStatuses, setWhatsAppStatuses] = useState<InvoiceWhatsAppStatusDto[]>([]);

	// Editable fields (Draft only)
	const [discount, setDiscount] = useState<string>('0');
	const [isGstEnabled, setIsGstEnabled] = useState<boolean>(true);
	const [notes, setNotes] = useState<string>('');

	// Mutation states
	const [isSaving, setIsSaving] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Generate modal & action state
	const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [generateError, setGenerateError] = useState<string | null>(null);

	// Cancel Bill modal state
	const [showCancelConfirm, setShowCancelConfirm] = useState(false);
	const [cancelNotice, setCancelNotice] = useState<string | null>(null);

	// Payment state
	const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'BankTransfer'>('Cash');
	const [paymentAmount, setPaymentAmount] = useState<string>('');
	const [paymentReference, setPaymentReference] = useState<string>('');
	const [isRecordingPayment, setIsRecordingPayment] = useState(false);
	const [paymentError, setPaymentError] = useState<string | null>(null);
	const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);

	// Initial loaded values for modification check
	const [initialGstEnabled, setInitialGstEnabled] = useState<boolean>(true);

	// ─── Fetch Invoice ───────────────────────────────────────────────────────
	const fetchInvoice = useCallback(async () => {
		if (!id) return;
		setLoading(true);
		setError(null);
		try {
			const [data, profileData, waData] = await Promise.all([
				getInvoiceById(id),
				getBusinessProfile().catch(() => null),
				getInvoiceWhatsAppStatus(id).catch(() => [] as InvoiceWhatsAppStatusDto[]),
			]);
			setInvoice(data);
			if (profileData) {
				setBusinessProfile(profileData);
			}
			if (waData) {
				setWhatsAppStatuses(waData);
			}
			setDiscount(String(data.discount ?? 0));
			setNotes(data.notes ?? '');
			setPaymentAmount(String(data.balanceAmount ?? data.totalAmount));

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

	// ─── Lifecycle State Derivation ──────────────────────────────────────────
	const normalizedStatus = useMemo(() => {
		return invoice ? normalizeInvoiceStatus(invoice.status) : 'Draft';
	}, [invoice]);

	const isDraft = useMemo(() => {
		if (!invoice) return true;
		return !invoice.invoiceNumber || normalizedStatus === 'Draft';
	}, [invoice, normalizedStatus]);

	const isCancelled = normalizedStatus === 'Cancelled';
	const isFinalized = !isDraft && !isCancelled;
	const isPaid = normalizedStatus === 'Paid' || (invoice?.paidAmount != null && invoice?.totalAmount != null && invoice.paidAmount >= invoice.totalAmount && invoice.totalAmount > 0);

	// ─── Financial Calculations ──────────────────────────────────────────────
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

		// For finalized invoice, use source of truth from backend
		if (!isDraft) {
			const cgst = invoice.isGstEnabled ? Math.round((invoice.gstAmount / 2) * 100) / 100 : 0;
			const sgst = invoice.isGstEnabled ? Math.round((invoice.gstAmount / 2) * 100) / 100 : 0;
			return {
				subtotal: invoice.subtotal,
				discount: invoice.discount,
				cgst,
				sgst,
				gstAmount: invoice.isGstEnabled ? invoice.gstAmount : 0,
				totalAmount: invoice.totalAmount,
				paidAmount: invoice.paidAmount ?? 0,
				balanceAmount: invoice.balanceAmount ?? Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0)),
				isValidDiscount: true,
			};
		}

		// For Draft invoice, calculate dynamically based on inputs
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
	}, [invoice, isDraft, parsedDiscount, isGstEnabled]);

	// ─── Check if Draft is Modified ──────────────────────────────────────────
	const isModified = useMemo(() => {
		if (!invoice || !isDraft) return false;
		const originalDiscount = invoice.discount ?? 0;
		const originalNotes = invoice.notes ?? '';

		return (
			parsedDiscount !== originalDiscount ||
			isGstEnabled !== initialGstEnabled ||
			notes !== originalNotes
		);
	}, [invoice, isDraft, parsedDiscount, isGstEnabled, initialGstEnabled, notes]);

	// ─── Save Draft Changes ──────────────────────────────────────────────────
	const handleSave = async () => {
		if (!id || !invoice || isSaving || !isDraft) return;
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

	// ─── Generate Invoice ────────────────────────────────────────────────────
	const handleGenerateInvoice = async () => {
		if (!id || isGenerating || !isDraft) return;

		setIsGenerating(true);
		setGenerateError(null);

		try {
			// Save unsaved draft changes first if any
			if (isModified) {
				await updateInvoice(id, {
					discount: parsedDiscount,
					notes: notes.trim() || null,
					isGstEnabled,
				});
			}

			const finalized = await generateInvoice(id);
			setInvoice(finalized);
			setDiscount(String(finalized.discount ?? 0));
			setNotes(finalized.notes ?? '');
			setIsGstEnabled(finalized.isGstEnabled);
			setInitialGstEnabled(finalized.isGstEnabled);
			setPaymentAmount(String(finalized.balanceAmount ?? finalized.totalAmount));
			setShowGenerateConfirm(false);
		} catch (err: unknown) {
			console.warn('Generate invoice error:', err);
			// In case of conflict (already generated), reload from API
			try {
				const reloaded = await getInvoiceById(id);
				if (reloaded && reloaded.invoiceNumber) {
					setInvoice(reloaded);
					setDiscount(String(reloaded.discount ?? 0));
					setNotes(reloaded.notes ?? '');
					setIsGstEnabled(reloaded.isGstEnabled);
					setInitialGstEnabled(reloaded.isGstEnabled);
					setPaymentAmount(String(reloaded.balanceAmount ?? reloaded.totalAmount));
					setShowGenerateConfirm(false);
					return;
				}
			} catch {
				// Ignore reload error and report main error
			}
			const msg = err instanceof Error ? err.message : 'Unable to generate invoice. Please try again.';
			setGenerateError(msg);
		} finally {
			setIsGenerating(false);
		}
	};

	// ─── Print & PDF Actions ─────────────────────────────────────────────────
	const handleOpenPrintPreview = useCallback(() => {
		setShowPrintPreview(true);
	}, []);

	const handleExecutePrint = useCallback(() => {
		window.print();
	}, []);

	const handleSavePdf = useCallback(() => {
		window.print();
	}, []);

	// ─── Record Payment ──────────────────────────────────────────────────────
	const handleRecordPayment = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!id || !isFinalized || isCancelled || isPaid || isRecordingPayment) return;

		const amt = parseFloat(paymentAmount);
		if (isNaN(amt) || amt <= 0) {
			setPaymentError('Payment amount must be greater than ₹0.');
			return;
		}

		if (amt > calculations.balanceAmount) {
			setPaymentError(`Payment amount cannot exceed remaining balance of ${formatCurrency(calculations.balanceAmount)}.`);
			return;
		}

		setIsRecordingPayment(true);
		setPaymentError(null);
		setPaymentFeedback(null);

		try {
			await recordPayment(id, {
				amount: amt,
				paymentMethod,
				reference: paymentReference.trim() || null,
			});

			const updated = await getInvoiceById(id);
			setInvoice(updated);
			setPaymentAmount(String(updated.balanceAmount));
			setPaymentReference('');
			setPaymentFeedback(`Payment of ${formatCurrency(amt)} recorded successfully via ${paymentMethod === 'BankTransfer' ? 'Bank Transfer' : paymentMethod}.`);
			setTimeout(() => setPaymentFeedback(null), 5000);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to record payment. Please try again.';
			setPaymentError(msg);
		} finally {
			setIsRecordingPayment(false);
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
			{/* ── Top Bar / Header (Hidden on Print) ─────────────────────────── */}
			<div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-outline-variant">
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
								{isDraft ? (
									<h1 className="text-2xl font-bold text-on-surface tracking-tight">
										Draft Invoice
									</h1>
								) : (
									<h1 className="text-2xl font-bold font-mono text-on-surface tracking-tight">
										#{invoice.invoiceNumber}
									</h1>
								)}
								<StatusBadge status={isDraft ? 'draft' : getInvoiceStatusSlug(invoice.status, calculations)} />
							</div>
							<div className="flex items-center gap-3 text-xs text-on-surface-variant mt-0.5 flex-wrap">
								{isDraft ? (
									<span className="italic text-on-surface-variant/80">
										Invoice number will be generated when finalized
									</span>
								) : (
									<span className="flex items-center gap-1 text-info font-medium">
										<CheckCircle2 className="w-3.5 h-3.5" />
										Finalized · Locked
									</span>
								)}
								<span>•</span>
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

				{/* Header Actions */}
				<div className="flex items-center gap-2.5">
					{saveSuccess && (
						<div className="flex items-center gap-1.5 text-success text-xs font-semibold bg-success-container/50 px-3 py-1.5 rounded-lg">
							<CheckCircle2 className="w-4 h-4" />
							<span>Draft saved</span>
						</div>
					)}

					{/* ── DRAFT ACTION BAR ─────────────────────────────────────── */}
					{isDraft && !isCancelled && (
						<>
							<Button
								variant="secondary"
								onClick={() => navigate('/invoices')}
							>
								Cancel
							</Button>
							<Button
								variant="secondary"
								onClick={handleSave}
								disabled={!isModified || isSaving || !calculations.isValidDiscount}
								loading={isSaving}
								icon={<Save className="w-4 h-4" />}
							>
								Save Changes
							</Button>
							<Button
								onClick={() => {
									setGenerateError(null);
									setShowGenerateConfirm(true);
								}}
								disabled={isGenerating || !calculations.isValidDiscount}
								icon={<Sparkles className="w-4 h-4" />}
							>
								Generate Invoice
							</Button>
						</>
					)}

					{/* ── GENERATED ACTION BAR ─────────────────────────────────── */}
					{isFinalized && (
						<>
							<Button
								variant="secondary"
								className="text-error hover:bg-error/10 border-error/30"
								onClick={() => setShowCancelConfirm(true)}
								icon={<XCircle className="w-4 h-4" />}
							>
								Cancel Bill
							</Button>
							<Button
								variant="secondary"
								onClick={() => setShowShareModal(true)}
								icon={<QrCode className="w-4 h-4" />}
							>
								Share Invoice
							</Button>
							<Button
								onClick={handleOpenPrintPreview}
								icon={<Printer className="w-4 h-4" />}
							>
								Print Invoice
							</Button>
						</>
					)}

					{/* Cancelled state actions */}
					{isCancelled && (
						<Button
							variant="secondary"
							onClick={() => navigate('/invoices')}
						>
							Back to Invoices
						</Button>
					)}
				</div>
			</div>

			{/* ── Lock Banner for Finalized Invoices (Hidden on Print) ───────── */}
			{isFinalized && (
				<div className="no-print p-3 bg-info-container/20 border border-info/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-info">
					<div className="flex items-center gap-3">
						<Lock className="w-4 h-4 shrink-0" />
						<p className="font-medium">
							<strong>Invoice Finalized:</strong> This invoice can no longer be edited. Official invoice number <strong>{invoice.invoiceNumber}</strong> has been issued.
						</p>
					</div>

					{/* WhatsApp Read-Only Status Badges */}
					{whatsAppStatuses.length > 0 && (
						<div className="flex items-center gap-2 flex-wrap shrink-0">
							{whatsAppStatuses.map((st, idx) => (
								<span
									key={idx}
									className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
										st.status === 'Sent'
											? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
											: st.status === 'Pending' || st.status === 'Processing'
											? 'bg-amber-50 text-amber-700 border border-amber-200'
											: st.status === 'Skipped'
											? 'bg-slate-100 text-slate-600 border border-slate-200'
											: 'bg-rose-50 text-rose-700 border border-rose-200'
									}`}
								>
									<span
										className={`w-1.5 h-1.5 rounded-full ${
											st.status === 'Sent'
												? 'bg-emerald-500'
												: st.status === 'Pending' || st.status === 'Processing'
												? 'bg-amber-500 animate-pulse'
												: st.status === 'Skipped'
												? 'bg-slate-400'
												: 'bg-rose-500'
										}`}
									/>
									WhatsApp {st.messageType === 'InvoiceFinalized' ? 'Invoice' : 'Payment'}: {st.status}
								</span>
							))}
						</div>
					)}
				</div>
			)}

			{/* ── Banner for Cancelled Invoices (Hidden on Print) ───────────── */}
			{isCancelled && (
				<div className="no-print p-3 bg-error-container/20 border border-error/20 rounded-xl flex items-center gap-3 text-xs text-error">
					<AlertCircle className="w-4 h-4 shrink-0" />
					<p className="font-medium">
						This invoice has been <strong>Cancelled</strong>. No further edits or payments are permitted.
					</p>
				</div>
			)}

			{/* ── Error Notification (Hidden on Print) ───────────────────────── */}
			{(saveError || generateError || cancelNotice) && (
				<div className="no-print app-card p-4 border-error/40 bg-error/10 flex items-center gap-3 text-sm text-error">
					<AlertCircle className="w-5 h-5 shrink-0" />
					<p className="flex-1 font-medium">{saveError || generateError || cancelNotice}</p>
					<button
						type="button"
						onClick={() => {
							setSaveError(null);
							setGenerateError(null);
							setCancelNotice(null);
						}}
						className="text-xs underline hover:no-underline"
					>
						Dismiss
					</button>
				</div>
			)}

			{/* ═════════════════════════════════════════════════════════════════ */}
			{/* ── INVOICE DOCUMENT VIEW (Interactive Screen View) ────────────── */}
			{/* ═════════════════════════════════════════════════════════════════ */}
			<div className="no-print app-card bg-white p-6 sm:p-8 space-y-6 shadow-sm border border-outline-variant">
				{/* ── Document Header ───────────────────────────────────────── */}
				<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-outline-variant">
					<div className="space-y-1">
						<h2 className="text-2xl font-bold text-on-surface tracking-tight uppercase">
							{businessProfile?.businessName || 'E6 Car Spa'}
						</h2>
						<p className="text-xs text-on-surface-variant font-medium">
							Premium Auto Detailing &amp; Car Care Solutions
						</p>
						<p className="text-xs text-on-surface-variant">
							{[businessProfile?.addressLine1, businessProfile?.addressLine2, businessProfile?.city, businessProfile?.state].filter(Boolean).join(', ') + (businessProfile?.postalCode ? ` - ${businessProfile.postalCode}` : '')}
						</p>
						<p className="text-xs text-on-surface-variant">
							Phone: {businessProfile?.phone || '+91 9578749449'}
							{businessProfile?.email && <span> &nbsp;|&nbsp; Email: {businessProfile.email}</span>}
							{isGstEnabled && businessProfile?.gstin && <span> &nbsp;|&nbsp; GSTIN: <strong className="font-mono">{businessProfile.gstin}</strong></span>}
						</p>
					</div>

					<div className="sm:text-right space-y-1">
						<span className="inline-block px-3 py-1 bg-surface-container text-on-surface text-xs font-bold uppercase tracking-wider rounded">
							{isDraft ? 'Draft Invoice' : 'Tax Invoice'}
						</span>
						<p className="text-base font-mono font-bold text-on-surface pt-1">
							{invoice.invoiceNumber ? `# ${invoice.invoiceNumber}` : 'Draft (Unfinalized)'}
						</p>
						<p className="text-xs text-on-surface-variant">
							Date: <strong className="text-on-surface">{formatDate(invoice.invoiceDate)}</strong>
						</p>
						<p className="text-xs text-on-surface-variant">
							Job Card: <strong className="font-mono text-on-surface">{invoice.jobCardNumber}</strong>
						</p>
					</div>
				</div>

				{/* ── Bill To & Vehicle Grid ─────────────────────────────────── */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-outline-variant">
					{/* Bill To */}
					<div className="space-y-2">
						<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
							<User className="w-3.5 h-3.5 text-secondary" />
							<span>Bill To (Customer)</span>
						</div>
						<div className="p-3.5 bg-surface-container-low rounded-lg border border-outline-variant/60 space-y-1">
							<p className="text-base font-bold text-on-surface">{invoice.customerName}</p>
							<p className="text-xs font-mono text-on-surface-variant">{invoice.customerPhone}</p>
						</div>
					</div>

					{/* Vehicle Details */}
					<div className="space-y-2">
						<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
							<Car className="w-3.5 h-3.5 text-secondary" />
							<span>Vehicle Details</span>
						</div>
						<div className="p-3.5 bg-surface-container-low rounded-lg border border-outline-variant/60 space-y-1">
							<div className="flex items-center justify-between">
								<p className="text-base font-bold text-on-surface">
									{invoice.vehicleMake} {invoice.vehicleModel}
									{invoice.vehicleVariant ? ` (${invoice.vehicleVariant})` : ''}
								</p>
								{invoice.registrationNumber && (
									<span className="bg-white border border-outline-variant px-2 py-0.5 rounded text-xs font-bold font-mono text-on-surface">
										{invoice.registrationNumber}
									</span>
								)}
							</div>
							{invoice.vehicleColor && (
								<p className="text-xs text-on-surface-variant">Color: {invoice.vehicleColor}</p>
							)}
						</div>
					</div>
				</div>

				{/* ── Service / Item Table ───────────────────────────────────── */}
				<div className="space-y-2">
					<h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
						Service Items &amp; Charges
					</h3>
					<div className="overflow-x-auto rounded-lg border border-outline-variant">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="bg-surface-container-low border-b border-outline-variant text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
									<th className="py-3 px-3 w-12 text-center">#</th>
									<th className="py-3 px-4">Service / Item Description</th>
									<th className="py-3 px-3 text-center w-20">Qty</th>
									<th className="py-3 px-4 text-right w-28">Rate</th>
									<th className="py-3 px-4 text-right w-32">Amount</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-outline-variant/50">
								{(!invoice.items || invoice.items.length === 0) && (
									<tr>
										<td colSpan={5} className="py-8 text-center text-on-surface-variant text-xs">
											No service items recorded on this invoice.
										</td>
									</tr>
								)}
								{invoice.items?.map((item, idx) => {
									const lineItemTotal = item.unitPrice * item.quantity;
									return (
										<tr key={item.id || idx} className="hover:bg-surface-container-low/30">
											<td className="py-3 px-3 text-center text-xs text-on-surface-variant font-mono">
												{idx + 1}
											</td>
											<td className="py-3 px-4">
												<p className="font-medium text-on-surface">{item.description}</p>
											</td>
											<td className="py-3 px-3 text-center font-medium text-xs">
												{item.quantity}
											</td>
											<td className="py-3 px-4 text-right text-xs text-on-surface-variant font-mono">
												{formatCurrency(item.unitPrice)}
											</td>
											<td className="py-3 px-4 text-right font-medium text-on-surface text-sm font-mono">
												{formatCurrency(lineItemTotal)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>

				{/* ── Financial Summary Breakdown & Notes Grid ──────────────── */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
					{/* Left: Notes & Terms Container */}
					<div className="space-y-3">
						<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
							<FileText className="w-3.5 h-3.5 text-secondary" />
							<span>Notes &amp; Terms</span>
						</div>

						{isDraft ? (
							<div className="space-y-1.5">
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
						) : (
							<div className="p-3.5 bg-surface-container-low rounded-lg border border-outline-variant/60 min-h-[5.5rem] text-xs text-on-surface space-y-2">
								<p className="whitespace-pre-wrap font-medium">
									{invoice.notes || 'Thank you for choosing E6 Car Spa! Drive safe and visit again.'}
								</p>
								<p className="text-[10px] text-on-surface-variant pt-2 border-t border-outline-variant/50">
									* This is a computer-generated tax invoice.
								</p>
							</div>
						)}
					</div>

					{/* Right: Detailed Totals Breakdown */}
					<div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/60 space-y-2.5 text-sm">
						{/* Sub Total */}
						<div className="flex justify-between text-on-surface-variant">
							<span>Sub Total</span>
							<span className="font-mono font-medium text-on-surface">
								{formatCurrency(calculations.subtotal)}
							</span>
						</div>

						{/* Discount */}
						<div className="flex justify-between items-center text-on-surface-variant">
							<span className="flex items-center gap-1">
								<Tag className="w-3.5 h-3.5 text-secondary" />
								<span>Discount</span>
							</span>
							{isDraft ? (
								<div className="w-32">
									<input
										type="number"
										min="0"
										step="0.01"
										max={calculations.subtotal}
										value={discount}
										onChange={(e) => setDiscount(e.target.value)}
										className={`form-input py-1 px-2 text-right font-mono text-xs ${
											!calculations.isValidDiscount ? 'border-error ring-1 ring-error' : ''
										}`}
										placeholder="0.00"
									/>
								</div>
							) : (
								<span className="font-mono font-medium text-on-surface">
									{formatCurrency(calculations.discount)}
								</span>
							)}
						</div>

						{/* GST Toggle for Draft */}
						{isDraft && (
							<div className="flex justify-between items-center py-1 border-t border-outline-variant/50">
								<span className="text-xs text-on-surface-variant">GST Enable (18%)</span>
								<button
									type="button"
									onClick={() => setIsGstEnabled((prev) => !prev)}
									className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
										isGstEnabled ? 'bg-secondary' : 'bg-outline-variant'
									}`}
									role="switch"
									aria-checked={isGstEnabled}
								>
									<span
										className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
											isGstEnabled ? 'translate-x-5' : 'translate-x-0'
										}`}
									/>
								</button>
							</div>
						)}

						{/* GST Breakdown (No Taxable Base Display) */}
						{isGstEnabled ? (
							<>
								<div className="flex justify-between text-on-surface-variant text-xs">
									<span>CGST (9%)</span>
									<span className="font-mono font-medium text-on-surface">
										{formatCurrency(calculations.cgst)}
									</span>
								</div>
								<div className="flex justify-between text-on-surface-variant text-xs">
									<span>SGST (9%)</span>
									<span className="font-mono font-medium text-on-surface">
										{formatCurrency(calculations.sgst)}
									</span>
								</div>
							</>
						) : (
							<div className="flex justify-between text-on-surface-variant text-xs">
								<span>GST</span>
								<span className="font-mono font-medium text-on-surface">₹0.00</span>
							</div>
						)}

						{/* Grand Total */}
						<div className="flex justify-between text-base font-bold text-on-surface pt-3 border-t border-outline-variant">
							<span>Grand Total</span>
							<span className="font-mono text-secondary text-lg font-bold">
								{formatCurrency(calculations.totalAmount)}
							</span>
						</div>

						{/* Paid */}
						<div className="flex justify-between text-xs text-on-surface-variant pt-1">
							<span>Paid Amount</span>
							<span className="font-mono font-medium text-success">
								{formatCurrency(calculations.paidAmount)}
							</span>
						</div>

						{/* Balance */}
						<div className="flex justify-between text-sm font-bold pt-2 border-t border-outline-variant/60">
							<span className="text-on-surface">Balance Due</span>
							<span className={`font-mono ${calculations.balanceAmount > 0 ? 'text-error' : 'text-success'}`}>
								{formatCurrency(calculations.balanceAmount)}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* ═════════════════════════════════════════════════════════════════ */}
			{/* ── 5 · COLLECT PAYMENT SECTION (Hidden on Draft & on Print) ───── */}
			{/* ═════════════════════════════════════════════════════════════════ */}
			{isFinalized && !isCancelled && (
				<div className="no-print app-card p-6 space-y-4 border border-outline-variant bg-white">
					<div className="flex items-center justify-between pb-3 border-b border-outline-variant">
						<div className="flex items-center gap-2">
							<div className="w-7 h-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs">
								5
							</div>
							<div>
								<h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
									Collect Payment
								</h3>
								<p className="text-xs text-on-surface-variant">
									Record customer payments and settle invoice balance
								</p>
							</div>
						</div>

						{isPaid ? (
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success-container text-success border border-success/20">
								<Check className="w-3.5 h-3.5" /> Fully Settled
							</span>
						) : (
							<span className="text-xs font-mono font-medium text-on-surface-variant">
								Balance Due: <strong className="text-error font-bold">{formatCurrency(calculations.balanceAmount)}</strong>
							</span>
						)}
					</div>

					{paymentFeedback && (
						<div className="p-3 bg-success-container/30 border border-success/30 rounded-lg text-xs text-success flex items-center gap-2 font-medium">
							<CheckCircle2 className="w-4 h-4 shrink-0" />
							<span>{paymentFeedback}</span>
						</div>
					)}

					{paymentError && (
						<div className="p-3 bg-error-container/30 border border-error/30 rounded-lg text-xs text-error flex items-center justify-between gap-2 font-medium">
							<div className="flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{paymentError}</span>
							</div>
							<button
								type="button"
								onClick={() => setPaymentError(null)}
								className="text-xs underline hover:no-underline"
							>
								Dismiss
							</button>
						</div>
					)}

					{!isPaid ? (
						<form onSubmit={handleRecordPayment} className="space-y-4 pt-1">
							{/* Payment Method Quick Chips */}
							<div className="flex flex-wrap gap-2">
								{(
									[
										{ method: 'Cash', label: 'Cash', icon: Wallet },
										{ method: 'UPI', label: 'UPI / QR', icon: QrCode },
										{ method: 'Card', label: 'Card', icon: CreditCard },
										{ method: 'BankTransfer', label: 'Bank Transfer', icon: Building2 },
									] as const
								).map((m) => {
									const Icon = m.icon;
									const isSelected = paymentMethod === m.method;
									return (
										<button
											key={m.method}
											type="button"
											onClick={() => setPaymentMethod(m.method)}
											className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
												isSelected
													? 'bg-secondary text-white border-secondary shadow-xs'
													: 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-secondary hover:text-on-surface'
											}`}
										>
											<Icon className="w-3.5 h-3.5" />
											<span>{m.label}</span>
										</button>
									);
								})}
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{/* Payment Method Dropdown */}
								<div className="form-field">
									<label className="text-xs font-bold text-on-surface">Payment Method</label>
									<select
										value={paymentMethod}
										onChange={(e) => setPaymentMethod(e.target.value as any)}
										className="form-input text-xs bg-white"
									>
										<option value="Cash">Cash</option>
										<option value="UPI">UPI / QR Code</option>
										<option value="Card">Credit / Debit Card</option>
										<option value="BankTransfer">Bank Transfer</option>
									</select>
								</div>

								{/* Amount */}
								<div className="form-field">
									<label className="text-xs font-bold text-on-surface">Payment Amount (₹)</label>
									<div className="relative">
										<span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-mono text-xs">
											₹
										</span>
										<input
											type="number"
											step="0.01"
											min="0.01"
											max={calculations.balanceAmount}
											value={paymentAmount}
											onChange={(e) => setPaymentAmount(e.target.value)}
											className="form-input pl-7 text-xs font-mono font-medium bg-white"
											placeholder={String(calculations.balanceAmount)}
										/>
									</div>
								</div>

								{/* Reference */}
								<div className="form-field">
									<label className="text-xs font-bold text-on-surface">
										Transaction ID / Reference (Optional)
									</label>
									<input
										type="text"
										value={paymentReference}
										onChange={(e) => setPaymentReference(e.target.value)}
										placeholder={
											paymentMethod === 'UPI'
												? 'e.g. UPI Ref / UTR / Txn ID (Optional)'
												: paymentMethod === 'Card'
													? 'e.g. Auth Code / Last 4 digits (Optional)'
													: paymentMethod === 'BankTransfer'
														? 'e.g. NEFT / IMPS UTR No (Optional)'
														: 'e.g. Cash note / receipt # (Optional)'
										}
										className="form-input text-xs bg-white"
									/>
								</div>
							</div>

							<div className="flex items-center justify-between pt-2">
								<p className="text-xs text-on-surface-variant">
									Recording payment will automatically update invoice status and outstanding balance.
								</p>

								<Button
									type="submit"
									disabled={
										isRecordingPayment ||
										!paymentAmount ||
										parseFloat(paymentAmount) <= 0 ||
										parseFloat(paymentAmount) > calculations.balanceAmount
									}
									icon={isRecordingPayment ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
								>
									{isRecordingPayment ? 'Recording…' : 'Record Payment'}
								</Button>
							</div>
						</form>
					) : (
						<div className="p-4 bg-success-container/20 border border-success/20 rounded-lg text-center space-y-1">
							<p className="text-sm font-bold text-success">Invoice Paid</p>
							<p className="text-xs text-on-surface-variant">This invoice is fully settled. No further payments required.</p>
						</div>
					)}
				</div>
			)}

			{/* ═════════════════════════════════════════════════════════════════ */}
			{/* ── 6 · PAYMENT HISTORY SECTION (Hidden on Draft & on Print) ───── */}
			{/* ═════════════════════════════════════════════════════════════════ */}
			{isFinalized && (
				<div className="no-print app-card p-6 space-y-4 border border-outline-variant bg-white">
					<div className="flex items-center justify-between pb-3 border-b border-outline-variant">
						<div className="flex items-center gap-2">
							<div className="w-7 h-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs">
								<Receipt className="w-4 h-4" />
							</div>
							<div>
								<h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
									Payment History
								</h3>
								<p className="text-xs text-on-surface-variant">
									Audit trail of all recorded transactions for this invoice
								</p>
							</div>
						</div>

						{/* Quick Balance Summary Pills */}
						<div className="flex items-center gap-3 text-xs">
							<span className="text-on-surface-variant">
								Total: <strong className="font-mono text-on-surface">{formatCurrency(calculations.totalAmount)}</strong>
							</span>
							<span className="text-on-surface-variant">
								Paid: <strong className="font-mono text-success">{formatCurrency(calculations.paidAmount)}</strong>
							</span>
							<span className="text-on-surface-variant">
								Balance: <strong className={`font-mono ${calculations.balanceAmount > 0 ? 'text-error' : 'text-success'}`}>{formatCurrency(calculations.balanceAmount)}</strong>
							</span>
						</div>
					</div>

					{/* Payment Transactions Table */}
					{invoice.payments && invoice.payments.length > 0 ? (
						<div className="overflow-x-auto rounded-lg border border-outline-variant">
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="bg-surface-container-low border-b border-outline-variant text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
										<th className="py-2.5 px-4 w-12 text-center">#</th>
										<th className="py-2.5 px-4">Date</th>
										<th className="py-2.5 px-4">Method</th>
										<th className="py-2.5 px-4">Reference / Txn ID</th>
										<th className="py-2.5 px-4 text-right">Amount</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-outline-variant/50">
									{invoice.payments.map((p, idx) => (
										<tr key={p.id || idx} className="hover:bg-surface-container-low/30">
											<td className="py-3 px-4 text-center text-xs text-on-surface-variant font-mono">
												{idx + 1}
											</td>
											<td className="py-3 px-4 text-xs text-on-surface font-medium">
												{formatDate(p.paymentDate || p.createdAt)}
											</td>
											<td className="py-3 px-4">
												<span className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface">
													{p.paymentMethod === 'Cash' && <Wallet className="w-3.5 h-3.5 text-secondary" />}
													{p.paymentMethod === 'UPI' && <QrCode className="w-3.5 h-3.5 text-secondary" />}
													{p.paymentMethod === 'Card' && <CreditCard className="w-3.5 h-3.5 text-secondary" />}
													{p.paymentMethod === 'BankTransfer' && <Building2 className="w-3.5 h-3.5 text-secondary" />}
													{p.paymentMethod === 'BankTransfer' ? 'Bank Transfer' : p.paymentMethod}
												</span>
											</td>
											<td className="py-3 px-4 text-xs font-mono text-on-surface-variant">
												{p.reference || '—'}
											</td>
											<td className="py-3 px-4 text-right font-mono font-bold text-success text-sm">
												{formatCurrency(p.amount)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="py-6 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant rounded-lg">
							No payments recorded yet for this invoice.
						</div>
					)}
				</div>
			)}

			{/* ── Generate Invoice Confirmation Dialog ────────────────────────── */}
			<Dialog
				open={showGenerateConfirm}
				onOpenChange={(open) => !isGenerating && setShowGenerateConfirm(open)}
				title="Generate Invoice?"
				description="Once generated, this invoice will be finalized and locked against edits. An official invoice number will be generated automatically."
				footer={
					<div className="flex items-center justify-end gap-2">
						<Button
							variant="secondary"
							onClick={() => setShowGenerateConfirm(false)}
							disabled={isGenerating}
						>
							Cancel
						</Button>
						<Button
							onClick={handleGenerateInvoice}
							disabled={isGenerating || !calculations.isValidDiscount}
							loading={isGenerating}
							icon={<Sparkles className="w-4 h-4" />}
						>
							{isGenerating ? 'Generating Invoice...' : 'Generate Invoice'}
						</Button>
					</div>
				}
			>
				<div className="space-y-4 text-sm text-on-surface-variant">
					<div className="p-3.5 bg-surface-container-low rounded-lg border border-outline-variant space-y-2">
						<div className="flex justify-between items-center text-xs">
							<span className="text-on-surface-variant">Customer:</span>
							<span className="font-medium text-on-surface">{invoice.customerName}</span>
						</div>
						<div className="flex justify-between items-center text-xs">
							<span className="text-on-surface-variant">Vehicle:</span>
							<span className="font-medium text-on-surface">
								{invoice.vehicleMake} {invoice.vehicleModel} ({invoice.registrationNumber})
							</span>
						</div>
						<div className="flex justify-between items-center text-xs">
							<span className="text-on-surface-variant">GST Mode:</span>
							<span className="font-medium text-on-surface">{isGstEnabled ? '18% GST (ON)' : 'Tax Exempt (OFF)'}</span>
						</div>
						{calculations.discount > 0 && (
							<div className="flex justify-between items-center text-xs">
								<span className="text-on-surface-variant">Discount:</span>
								<span className="font-medium text-on-surface">{formatCurrency(calculations.discount)}</span>
							</div>
						)}
						<div className="flex justify-between items-center pt-2 border-t border-outline-variant text-sm font-semibold">
							<span className="text-on-surface">Grand Total:</span>
							<span className="text-secondary font-bold">{formatCurrency(calculations.totalAmount)}</span>
						</div>
					</div>

					<p className="text-xs text-on-surface-variant">
						Please confirm that all items, discounts, and GST selections are final. After generating, the invoice cannot be modified.
					</p>
				</div>
			</Dialog>

			{/* ── Cancel Bill Confirmation Dialog ─────────────────────────────── */}
			<Dialog
				open={showCancelConfirm}
				onOpenChange={(open) => setShowCancelConfirm(open)}
				title="Cancel Finalized Invoice?"
				description="Are you sure you want to cancel this bill? This action cannot be reversed."
				footer={
					<div className="flex items-center justify-end gap-2">
						<Button
							variant="secondary"
							onClick={() => setShowCancelConfirm(false)}
						>
							No, Keep Bill
						</Button>
						<Button
							className="bg-error hover:bg-error/90 text-white border-transparent"
							onClick={() => {
								setShowCancelConfirm(false);
								setCancelNotice('Invoice cancellation request recorded.');
								setTimeout(() => setCancelNotice(null), 4000);
							}}
						>
							Yes, Cancel Bill
						</Button>
					</div>
				}
			>
				<div className="space-y-2 text-xs text-on-surface-variant">
					<p>
						Cancelling invoice <strong>{invoice.invoiceNumber}</strong> will mark it as void.
					</p>
					<p className="text-error font-medium">
						Note: Only authorized supervisors can void finalized tax invoices.
					</p>
				</div>
			</Dialog>

			{/* ═════════════════════════════════════════════════════════════════ */}
			{/* ── IN-APP A4 PRINT PREVIEW MODAL (Hidden during print) ─────────── */}
			{/* ═════════════════════════════════════════════════════════════════ */}
			{showPrintPreview && (
				<div className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-xs animate-fade-in no-print">
					{/* Top Preview Controls Toolbar */}
					<div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 text-white shadow-md shrink-0">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded-lg bg-[#a11a1a] flex items-center justify-center font-bold text-xs text-white">
								E6
							</div>
							<div>
								<h2 className="text-sm font-bold text-white tracking-tight">
									Print Preview — {invoice.invoiceNumber || 'Draft Invoice'}
								</h2>
								<p className="text-xs text-slate-400">
									A4 Portrait (210 × 297 mm) · {isGstEnabled ? 'Official Tax Invoice' : 'Standard Invoice'}
								</p>
							</div>
						</div>

						{/* Action Buttons: [Print] [Save PDF] [Close] */}
						<div className="flex items-center gap-2.5">
							<Button
								onClick={handleExecutePrint}
								icon={<Printer className="w-4 h-4" />}
								className="bg-[#a11a1a] hover:bg-[#851515] text-white border-transparent shadow-sm"
							>
								Print
							</Button>

							<Button
								variant="secondary"
								onClick={handleSavePdf}
								icon={<Download className="w-4 h-4" />}
								className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
							>
								Save PDF
							</Button>

							<Button
								variant="secondary"
								onClick={() => setShowPrintPreview(false)}
								icon={<X className="w-4 h-4" />}
								className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
							>
								Close
							</Button>
						</div>
					</div>

					{/* Centered A4 Document Canvas */}
					<div className="flex-1 overflow-y-auto p-6 sm:p-10 flex justify-center items-start bg-slate-950/60">
						<div className="shadow-2xl ring-1 ring-black/20 rounded-xs">
							<InvoicePrintDocument invoice={invoice} businessProfile={businessProfile} />
						</div>
					</div>
				</div>
			)}

			{/* ═════════════════════════════════════════════════════════════════ */}
			{/* ── SHARE INVOICE MODAL ────────────────────────────────────────── */}
			{/* ═════════════════════════════════════════════════════════════════ */}
			<ShareInvoiceModal
				isOpen={showShareModal}
				onClose={() => setShowShareModal(false)}
				invoiceId={invoice.id}
				invoiceNumber={invoice.invoiceNumber}
			/>

			{/* ═════════════════════════════════════════════════════════════════ */}
			{/* ── DEDICATED PRINT DOM (Rendered ONLY during physical print) ──── */}
			{/* ═════════════════════════════════════════════════════════════════ */}
			<div className="print-only">
				<InvoicePrintDocument invoice={invoice} businessProfile={businessProfile} />
			</div>
		</div>
	);
}
