import React from 'react';
import { type InvoiceDto, type BusinessProfileDto } from '../../lib/api';

interface InvoicePrintDocumentProps {
	invoice: InvoiceDto;
	businessProfile: BusinessProfileDto | null;
}

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
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const year = d.getFullYear();
	return `${day}-${month}-${year}`;
}

export function InvoicePrintDocument({ invoice, businessProfile }: InvoicePrintDocumentProps) {
	const isDraft = invoice.status === 'Draft' || invoice.status === 0;
	const isGst = Boolean(invoice.isGstEnabled);

	// Business Profile details (fallback to default verified details if not loaded yet)
	const businessName = businessProfile?.businessName || 'E6 Car Spa';
	const addressLine1 = businessProfile?.addressLine1 || '36, Geetha Nagar Main Road';
	const addressLine2 = businessProfile?.addressLine2 || 'Behind Sakthi Mahal, Perundurai Road';
	const cityStatePin = [
		businessProfile?.city || 'Erode',
		businessProfile?.state || 'Tamil Nadu',
	].filter(Boolean).join(', ') + (businessProfile?.postalCode ? ` - ${businessProfile.postalCode}` : ' - 638011');
	const phone = businessProfile?.phone || '+91 9578749449';
	const email = businessProfile?.email || 'e6carspaerd@gmail.com';
	const gstin = businessProfile?.gstin?.trim() || null;

	const logoUrl = businessProfile?.logoPath
		? businessProfile.logoPath.startsWith('http')
			? businessProfile.logoPath
			: businessProfile.logoPath.startsWith('/uploads')
				? `http://localhost:5298${businessProfile.logoPath}`
				: businessProfile.logoPath
		: '/e6-logo.png';

	// Header Title
	const documentTitle = isDraft ? 'DRAFT INVOICE' : isGst ? 'TAX INVOICE' : 'INVOICE';

	// Tax calculations (half CGST, half SGST)
	const cgstAmount = isGst ? invoice.gstAmount / 2 : 0;
	const sgstAmount = isGst ? invoice.gstAmount / 2 : 0;

	return (
		<div className="bg-white text-slate-900 font-sans p-8 sm:p-10 w-[210mm] min-h-[297mm] mx-auto box-border flex flex-col justify-between text-xs leading-normal">
			<div>
				{/* ── Header: Brand & Document Meta ─────────────────────────── */}
				<div className="flex items-start justify-between gap-6 pb-4">
					{/* Left: Brand Logo & Verified Business Details */}
					<div className="space-y-1 max-w-[60%]">
						<div className="flex items-center gap-3">
							<img
								src={logoUrl}
								alt={businessName}
								className="h-12 w-auto object-contain rounded-xs"
								onError={(e) => {
									(e.target as HTMLElement).style.display = 'none';
								}}
							/>
							<div>
								<h1 className="text-xl font-bold text-[#a11a1a] tracking-tight uppercase">
									{businessName}
								</h1>
								<p className="text-[11px] text-slate-500 font-medium">
									Premium Auto Detailing &amp; Car Care Solutions
								</p>
							</div>
						</div>

						<div className="text-slate-600 text-[11px] leading-relaxed pt-1">
							{addressLine1 && <p>{addressLine1}</p>}
							{addressLine2 && <p>{addressLine2}</p>}
							<p>{cityStatePin}</p>
							<p>
								Phone: <span className="font-semibold text-slate-800">{phone}</span>
								{email && (
									<span> &nbsp;|&nbsp; Email: <span className="text-slate-800">{email}</span></span>
								)}
							</p>
							{/* GSTIN displayed ONLY when invoice is GST-enabled AND GSTIN exists */}
							{isGst && gstin && (
								<p className="font-bold text-slate-900 pt-0.5">
									GSTIN: <span className="font-mono">{gstin}</span>
								</p>
							)}
						</div>
					</div>

					{/* Right: Document Title, Number, Date, Job Card */}
					<div className="text-right space-y-1">
						<h2 className="text-2xl font-bold text-[#a11a1a] tracking-tight uppercase leading-none">
							{documentTitle}
						</h2>
						<div className="pt-2 text-slate-700 text-xs space-y-0.5">
							<p className="font-semibold">
								Invoice No:{' '}
								<span className="font-mono font-bold text-slate-950 text-sm">
									{invoice.invoiceNumber || (isDraft ? 'DRAFT' : '—')}
								</span>
							</p>
							<p>
								Date: <span className="font-medium text-slate-900">{formatDate(invoice.invoiceDate)}</span>
							</p>
							{invoice.jobCardNumber && (
								<p>
									Job Card:{' '}
									<span className="font-mono font-semibold text-slate-900">
										{invoice.jobCardNumber}
									</span>
								</p>
							)}
						</div>
					</div>
				</div>

				{/* ── Red Accent Divider ──────────────────────────────────────── */}
				<div className="h-[2.5px] bg-[#a11a1a] w-full my-3" />

				{/* ── Bill To & Vehicle Details Grid ──────────────────────────── */}
				<table className="w-full border-collapse border border-slate-300 text-xs mb-6">
					<tbody>
						<tr className="border-b border-slate-300">
							<td className="bg-slate-100 font-bold text-slate-800 p-2.5 border-r border-slate-300 w-28 uppercase text-[10px] tracking-wider">
								Bill To
							</td>
							<td className="p-2.5 border-r border-slate-300 font-bold text-slate-950 w-[40%] text-sm">
								{invoice.customerName}
							</td>
							<td className="bg-slate-100 font-bold text-slate-800 p-2.5 border-r border-slate-300 w-28 uppercase text-[10px] tracking-wider">
								Vehicle Reg No
							</td>
							<td className="p-2.5 font-bold font-mono text-slate-950 text-sm">
								{invoice.registrationNumber || '—'}
							</td>
						</tr>
						<tr>
							<td className="bg-slate-100 font-bold text-slate-800 p-2.5 border-r border-slate-300 uppercase text-[10px] tracking-wider">
								Phone
							</td>
							<td className="p-2.5 border-r border-slate-300 font-mono text-slate-800">
								{invoice.customerPhone || '—'}
							</td>
							<td className="bg-slate-100 font-bold text-slate-800 p-2.5 border-r border-slate-300 uppercase text-[10px] tracking-wider">
								Vehicle Model
							</td>
							<td className="p-2.5 font-medium text-slate-900">
								{[invoice.vehicleMake, invoice.vehicleModel].filter(Boolean).join(' ') || '—'}
								{invoice.vehicleVariant ? ` (${invoice.vehicleVariant})` : ''}
								{invoice.vehicleColor ? ` - ${invoice.vehicleColor}` : ''}
							</td>
						</tr>
					</tbody>
				</table>

				{/* ── Itemised Services Table ─────────────────────────────────── */}
				<div className="mb-6">
					<table className="w-full border-collapse border border-slate-300 text-xs">
						<thead>
							<tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
								<th className="py-2.5 px-3 border-r border-slate-300 w-10 text-center">#</th>
								<th className="py-2.5 px-3 border-r border-slate-300 text-left">Description</th>
								{isGst && (
									<th className="py-2.5 px-3 border-r border-slate-300 text-center w-24">HSN/SAC</th>
								)}
								<th className="py-2.5 px-3 border-r border-slate-300 text-center w-16">Qty</th>
								<th className="py-2.5 px-3 border-r border-slate-300 text-right w-24">Rate</th>
								<th className="py-2.5 px-3 text-right w-28">Amount</th>
							</tr>
						</thead>
						<tbody>
							{(!invoice.items || invoice.items.length === 0) && (
								<tr>
									<td
										colSpan={isGst ? 6 : 5}
										className="py-6 text-center text-slate-500 italic"
									>
										No service items recorded on this invoice.
									</td>
								</tr>
							)}
							{invoice.items?.map((item, idx) => {
								const lineTotal = (item.unitPrice || 0) * (item.quantity || 1);
								const itemHsnSac = (item as unknown as { hsnSac?: string }).hsnSac || '—';

								return (
									<tr key={item.id || idx} className="border-b border-slate-200">
										<td className="py-2.5 px-3 border-r border-slate-300 text-center font-mono text-slate-500">
											{idx + 1}
										</td>
										<td className="py-2.5 px-3 border-r border-slate-300 font-medium text-slate-900">
											{item.description}
										</td>
										{isGst && (
											<td className="py-2.5 px-3 border-r border-slate-300 text-center font-mono text-slate-700">
												{itemHsnSac}
											</td>
										)}
										<td className="py-2.5 px-3 border-r border-slate-300 text-center font-medium text-slate-900">
											{item.quantity}
										</td>
										<td className="py-2.5 px-3 border-r border-slate-300 text-right font-mono text-slate-800">
											{formatCurrency(item.unitPrice)}
										</td>
										<td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-950">
											{formatCurrency(lineTotal)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				{/* ── Financial Summary & Notes ───────────────────────────────── */}
				<div className="flex items-start justify-between gap-6 mb-6">
					{/* Left: Notes / Terms */}
					<div className="w-[50%] space-y-2">
						{invoice.notes && (
							<div className="p-3 bg-slate-50 border border-slate-200 rounded-xs">
								<p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
									Invoice Notes:
								</p>
								<p className="text-xs text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
							</div>
						)}
						<div className="text-[11px] text-slate-500 space-y-1">
							<p className="font-semibold text-slate-700">Terms &amp; Conditions:</p>
							<p>1. Payment is due upon completion of vehicle detailing services.</p>
							<p>2. Goods/services once provided are non-refundable.</p>
							<p>3. Please inspect your vehicle thoroughly prior to delivery handover.</p>
						</div>
					</div>

					{/* Right: Totals Breakdown Table */}
					<div className="w-[45%]">
						<table className="w-full border-collapse border border-slate-300 text-xs">
							<tbody>
								{/* Subtotal */}
								<tr className="border-b border-slate-200">
									<td className="p-2 font-medium text-slate-600 border-r border-slate-300">
										Subtotal
									</td>
									<td className="p-2 text-right font-mono font-semibold text-slate-900">
										{formatCurrency(invoice.subtotal)}
									</td>
								</tr>

								{/* Discount (if applicable) */}
								{invoice.discount > 0 && (
									<tr className="border-b border-slate-200 text-emerald-800 bg-emerald-50/50">
										<td className="p-2 font-medium border-r border-slate-300">
											Discount Applied
										</td>
										<td className="p-2 text-right font-mono font-semibold">
											- {formatCurrency(invoice.discount)}
										</td>
									</tr>
								)}

								{/* GST Rows: Rendered ONLY when isGstEnabled == true */}
								{isGst && (
									<>
										<tr className="border-b border-slate-200 bg-slate-50">
											<td className="p-2 font-medium text-slate-700 border-r border-slate-300">
												Taxable Value
											</td>
											<td className="p-2 text-right font-mono font-semibold text-slate-900">
												{formatCurrency(invoice.taxableAmount)}
											</td>
										</tr>
										<tr className="border-b border-slate-200">
											<td className="p-2 font-medium text-slate-600 border-r border-slate-300">
												CGST (9%)
											</td>
											<td className="p-2 text-right font-mono font-semibold text-slate-900">
												{formatCurrency(cgstAmount)}
											</td>
										</tr>
										<tr className="border-b border-slate-200">
											<td className="p-2 font-medium text-slate-600 border-r border-slate-300">
												SGST (9%)
											</td>
											<td className="p-2 text-right font-mono font-semibold text-slate-900">
												{formatCurrency(sgstAmount)}
											</td>
										</tr>
									</>
								)}

								{/* Grand Total */}
								<tr className="border-b-2 border-slate-400 bg-slate-100">
									<td className="p-2.5 font-bold text-slate-950 border-r border-slate-300 uppercase text-[11px]">
										Grand Total
									</td>
									<td className="p-2.5 text-right font-mono font-bold text-[#a11a1a] text-sm">
										{formatCurrency(invoice.totalAmount)}
									</td>
								</tr>

								{/* Paid Amount */}
								<tr className="border-b border-slate-200">
									<td className="p-2 font-medium text-slate-600 border-r border-slate-300">
										Amount Paid
									</td>
									<td className="p-2 text-right font-mono font-semibold text-slate-900">
										{formatCurrency(invoice.paidAmount)}
									</td>
								</tr>

								{/* Balance Due */}
								<tr className="bg-slate-50">
									<td className="p-2.5 font-bold text-slate-950 border-r border-slate-300">
										Balance Due
									</td>
									<td className="p-2.5 text-right font-mono font-bold text-slate-950 text-sm">
										{formatCurrency(invoice.balanceAmount)}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{/* ── Footer: Thank You & Computer Generated Notice ────────────── */}
			<div className="pt-4 border-t border-slate-200">
				<div className="flex items-center justify-between text-xs text-slate-600">
					<div>
						<p className="font-bold text-[#a11a1a] text-sm tracking-tight mb-0.5">
							Thank you for choosing {businessName}!
						</p>
						<p className="text-[11px] text-slate-400">
							This is a computer generated invoice. No physical signature is required.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
