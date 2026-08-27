import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
	Printer,
	Download,
	AlertCircle,
	CheckCircle2,
	Clock,
} from 'lucide-react';
import { getPublicInvoice, type PublicInvoiceDto } from '../../lib/api';

function formatCurrency(val: number): string {
	return '₹' + (val || 0).toLocaleString('en-IN', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function formatDate(isoString?: string | null): string {
	if (!isoString) return '—';
	const d = new Date(isoString);
	if (isNaN(d.getTime())) return isoString;
	const day = String(d.getDate()).padStart(2, '0');
	const month = d.toLocaleString('en-IN', { month: 'short' });
	const year = d.getFullYear();
	return `${day} ${month} ${year}`;
}

export function PublicInvoicePage() {
	const { token } = useParams<{ token: string }>();
	const [invoice, setInvoice] = useState<PublicInvoiceDto | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		if (!token) {
			setNotFound(true);
			setLoading(false);
			return;
		}

		loadInvoice(token);
	}, [token]);

	const loadInvoice = async (publicToken: string) => {
		setLoading(true);
		setNotFound(false);
		try {
			const data = await getPublicInvoice(publicToken);
			setInvoice(data);
		} catch {
			setNotFound(true);
		} finally {
			setLoading(false);
		}
	};

	const handlePrint = () => {
		window.print();
	};

	if (loading) {
		return (
			<div className="h-screen w-full overflow-y-auto bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
				<div className="flex flex-col items-center space-y-4">
					<div className="h-12 w-12 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin" />
					<p className="text-sm font-medium text-slate-400">Loading your invoice...</p>
				</div>
			</div>
		);
	}

	if (notFound || !invoice) {
		return (
			<div className="h-screen w-full overflow-y-auto bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
				<div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
					<div className="h-16 w-16 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto">
						<AlertCircle className="h-8 w-8" />
					</div>
					<div className="space-y-2">
						<h1 className="text-xl font-bold text-white tracking-tight">Invoice Link Unavailable</h1>
						<p className="text-sm text-slate-400 leading-relaxed">
							This invoice link is invalid, expired, or has been revoked. If you believe this is an error, please contact E6 Car Spa.
						</p>
					</div>
					<div className="pt-4 border-t border-slate-800 text-xs text-slate-500 space-y-1">
						<p className="font-semibold text-slate-400">E6 Car Spa &bull; Support</p>
						<p>Phone: +91 9578749449 | Email: e6carspaerd@gmail.com</p>
					</div>
				</div>
			</div>
		);
	}

	const isGst = Boolean(invoice.isGstEnabled);
	const documentTitle = isGst ? 'TAX INVOICE' : 'INVOICE';
	const isPaid = invoice.financials.balanceAmount <= 0 && invoice.financials.paidAmount > 0;
	const isPartial = invoice.financials.paidAmount > 0 && invoice.financials.balanceAmount > 0;

	return (
		<div className="h-screen w-full overflow-y-auto bg-slate-950 text-slate-900 antialiased py-6 px-3 sm:px-6 lg:px-8 print:p-0 print:bg-white print:m-0 print:overflow-visible print:h-auto">
			{/* Non-print Floating Top Actions Bar */}
			<div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 rounded-lg bg-[#a11a1a] flex items-center justify-center text-white font-black text-sm">
						E6
					</div>
					<span className="text-sm font-bold text-white tracking-tight">
						{invoice.business.businessName || 'E6 Car Spa'}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={handlePrint}
						className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-colors"
					>
						<Download className="h-4 w-4" />
						<span>Download PDF / Print</span>
					</button>
				</div>
			</div>

			{/* Main Invoice Card (Rendered for Customer Mobile & Desktop, and Print-Ready) */}
			<div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 print:border-none print:shadow-none print:rounded-none print:max-w-none">
				{/* ── Brand Header Banner ────────────────────────────────────── */}
				<div className="bg-[#a11a1a] text-white p-6 sm:p-8">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
						<div className="flex items-center gap-4">
							{invoice.business.logoUrl && (
								<img
									src={invoice.business.logoUrl}
									alt={invoice.business.businessName}
									className="h-14 w-auto object-contain rounded-md bg-white p-1"
									onError={(e) => {
										(e.target as HTMLElement).style.display = 'none';
									}}
								/>
							)}
							<div>
								<h1 className="text-2xl font-black tracking-tight uppercase">
									{invoice.business.businessName || 'E6 Car Spa'}
								</h1>
								<p className="text-xs text-red-100 font-medium">
									Premium Auto Detailing &amp; Car Care Solutions
								</p>
							</div>
						</div>

						<div className="text-left sm:text-right">
							<span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-xs rounded-md text-xs font-black tracking-wider uppercase mb-1">
								{documentTitle}
							</span>
							<p className="text-xl font-mono font-bold tracking-tight">
								{invoice.invoiceNumber || '—'}
							</p>
							<p className="text-xs text-red-100">
								Date: <span className="font-semibold text-white">{formatDate(invoice.invoiceDate)}</span>
							</p>
						</div>
					</div>
				</div>

				{/* ── Business & Customer Info Grid ──────────────────────────── */}
				<div className="p-6 sm:p-8 space-y-6">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
						{/* Business details */}
						<div className="space-y-1 text-xs text-slate-600">
							<p className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-1">
								Service Center
							</p>
							<p className="font-bold text-slate-900 text-sm">{invoice.business.businessName}</p>
							{invoice.business.addressLine1 && <p>{invoice.business.addressLine1}</p>}
							{invoice.business.addressLine2 && <p>{invoice.business.addressLine2}</p>}
							<p>
								{[invoice.business.city, invoice.business.state].filter(Boolean).join(', ')}
								{invoice.business.postalCode ? ` - ${invoice.business.postalCode}` : ''}
							</p>
							<p className="pt-1">
								Phone: <span className="font-semibold text-slate-900">{invoice.business.phone}</span>
							</p>
							{isGst && invoice.business.gstin && (
								<p className="pt-1 font-bold text-slate-900">
									GSTIN: <span className="font-mono">{invoice.business.gstin}</span>
								</p>
							)}
						</div>

						{/* Customer & Vehicle details */}
						<div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
							<div className="flex items-center justify-between mb-1">
								<p className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
									Billed To
								</p>
								{isPaid ? (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
										<CheckCircle2 className="h-3 w-3" /> PAID
									</span>
								) : isPartial ? (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
										<Clock className="h-3 w-3" /> PARTIAL
									</span>
								) : (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
										UNPAID
									</span>
								)}
							</div>
							<p className="font-bold text-slate-900 text-sm">{invoice.customer.customerName}</p>
							<div className="pt-2 border-t border-slate-200 text-xs">
								<p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
									Vehicle Details
								</p>
								<p className="font-mono font-bold text-slate-900 text-sm">
									{invoice.customer.registrationNumber}
								</p>
								<p className="text-slate-700">{invoice.customer.vehicleName}</p>
							</div>
						</div>
					</div>

					{/* ── Services Itemised Table ────────────────────────────────── */}
					<div>
						<h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
							Services Rendered
						</h3>
						<div className="overflow-x-auto border border-slate-200 rounded-xl">
							<table className="w-full text-left text-xs border-collapse">
								<thead>
									<tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase">
										<th className="py-3 px-4">#</th>
										<th className="py-3 px-4">Service Description</th>
										{isGst && <th className="py-3 px-4 text-center">HSN/SAC</th>}
										<th className="py-3 px-4 text-center">Qty</th>
										<th className="py-3 px-4 text-right">Rate</th>
										<th className="py-3 px-4 text-right">Amount</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{invoice.items.map((item, idx) => (
										<tr key={idx} className="hover:bg-slate-50/50 transition-colors">
											<td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
											<td className="py-3 px-4 font-semibold text-slate-900">{item.description}</td>
											{isGst && (
												<td className="py-3 px-4 text-center font-mono text-slate-600">
													{item.hsnSac || '—'}
												</td>
											)}
											<td className="py-3 px-4 text-center font-medium text-slate-800">{item.quantity}</td>
											<td className="py-3 px-4 text-right font-mono text-slate-700">{formatCurrency(item.rate)}</td>
											<td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
												{formatCurrency(item.amount)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					{/* ── Financial Totals Breakdown ─────────────────────────────── */}
					<div className="flex flex-col sm:flex-row items-start justify-between gap-6 pt-4">
						{/* Notes & Terms */}
						<div className="w-full sm:w-1/2 space-y-3 text-xs text-slate-600">
							{invoice.notes && (
								<div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
									<p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
										Invoice Notes
									</p>
									<p className="text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
								</div>
							)}
							{invoice.termsAndConditions && (
								<div className="text-[11px] text-slate-500 space-y-1">
									<p className="font-semibold text-slate-700">Terms &amp; Conditions:</p>
									<p className="whitespace-pre-line leading-relaxed">{invoice.termsAndConditions}</p>
								</div>
							)}
						</div>

						{/* Totals Table */}
						<div className="w-full sm:w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
							<div className="flex justify-between text-slate-600">
								<span>Subtotal</span>
								<span className="font-mono font-semibold text-slate-900">
									{formatCurrency(invoice.financials.subtotal)}
								</span>
							</div>

							{invoice.financials.discount > 0 && (
								<div className="flex justify-between text-emerald-700 font-medium">
									<span>Discount</span>
									<span className="font-mono font-semibold">
										- {formatCurrency(invoice.financials.discount)}
									</span>
								</div>
							)}

							{/* GST Breakdown (Rendered ONLY when GST is ON) */}
							{isGst && (
								<>
									<div className="flex justify-between text-slate-600">
										<span>Taxable Value</span>
										<span className="font-mono font-semibold text-slate-900">
											{formatCurrency(invoice.financials.taxableValue ?? 0)}
										</span>
									</div>
									<div className="flex justify-between text-slate-600">
										<span>CGST (9%)</span>
										<span className="font-mono font-semibold text-slate-900">
											{formatCurrency(invoice.financials.cgst ?? 0)}
										</span>
									</div>
									<div className="flex justify-between text-slate-600">
										<span>SGST (9%)</span>
										<span className="font-mono font-semibold text-slate-900">
											{formatCurrency(invoice.financials.sgst ?? 0)}
										</span>
									</div>
								</>
							)}

							<div className="h-px bg-slate-200 my-1" />

							<div className="flex justify-between text-sm font-bold text-slate-950">
								<span>Grand Total</span>
								<span className="font-mono text-[#a11a1a] text-base">
									{formatCurrency(invoice.financials.totalAmount)}
								</span>
							</div>

							<div className="flex justify-between text-slate-700 font-medium">
								<span>Amount Paid</span>
								<span className="font-mono font-semibold text-slate-900">
									{formatCurrency(invoice.financials.paidAmount)}
								</span>
							</div>

							<div className="flex justify-between text-sm font-bold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200">
								<span>Balance Due</span>
								<span className="font-mono font-bold text-slate-950">
									{formatCurrency(invoice.financials.balanceAmount)}
								</span>
							</div>
						</div>
					</div>

					{/* ── Footer ─────────────────────────────────────────────────── */}
					<div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
						<div>
							<p className="font-bold text-[#a11a1a] text-sm mb-0.5">
								Thank you for choosing {invoice.business.businessName}!
							</p>
							<p className="text-[11px] text-slate-400">
								This is a computer generated invoice. No physical signature required.
							</p>
						</div>
						<div className="print:hidden">
							<button
								onClick={handlePrint}
								className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition-colors"
							>
								<Printer className="h-3.5 w-3.5" />
								<span>Print Invoice</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default PublicInvoicePage;
