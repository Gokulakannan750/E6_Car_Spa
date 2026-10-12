import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/Button';
import { ErrorState, LoadingState } from '@/components/Surface';
import { api } from '@/lib/api';
import { date, money } from '@/lib/format';

/**
 * A printable copy of one of Trovo's invoices. Opens in the same tab: the session lives in this tab only. White paper layout; the browser's
 * "Save as PDF" makes the PDF. Trovo has no GSTIN yet, so the title is "Invoice" and no tax lines appear
 * unless the invoice carries tax.
 */
export function InvoicePrintPage() {
	const { id = '' } = useParams();
	const navigate = useNavigate();
	const query = useQuery({ queryKey: ['invoice', id], queryFn: () => api.invoice(id) });

	useEffect(() => {
		if (query.data) document.title = `${query.data.invoice.invoiceNumber} · Trovo`;
	}, [query.data]);

	if (query.isPending) return <LoadingState />;
	if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

	const { invoice: inv, seller, companyCode, companyName, billToAddress, billToGstin } = query.data;
	const paid = inv.payments.filter((p) => p.status === 'Succeeded' || p.status === 'PartiallyRefunded');
	const isVoid = inv.status === 'Void';

	return (
		<div className="min-h-full bg-surface-alt py-8 print:bg-white print:py-0">
			<div className="no-print mx-auto mb-4 flex max-w-[800px] justify-between px-4">
				<Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/invoices'))}>
					Back
				</Button>
				<Button variant="primary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
					Print / Save as PDF
				</Button>
			</div>
			<article className="relative mx-auto max-w-[800px] bg-white px-12 py-10 text-[13px] leading-5 text-zinc-900 shadow-2xl print:max-w-none print:px-0 print:py-0 print:shadow-none">
				{isVoid && (
					<div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
						<span className="rotate-[-24deg] text-[120px] font-black tracking-widest text-red-500/15">VOID</span>
					</div>
				)}
				<header className="flex items-start justify-between gap-6 border-b border-zinc-200 pb-6">
					<div>
						<img src="/trovo-logo.webp" alt="" className="mb-3 size-12 rounded-md" />
						<div className="text-[16px] font-semibold">{seller.name}</div>
						<div className="max-w-[300px] whitespace-pre-line text-zinc-600">{seller.address}</div>
						<div className="text-zinc-600">
							{seller.phone} · {seller.email}
						</div>
						{seller.gstin && <div className="text-zinc-600">GSTIN {seller.gstin}</div>}
					</div>
					<div className="text-right">
						<h1 className="text-[28px] font-bold tracking-tight">{inv.title || 'Invoice'}</h1>
						<dl className="tabular mt-2 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5 text-zinc-600">
							<dt>Number</dt>
							<dd className="font-mono font-semibold text-zinc-900">{inv.invoiceNumber}</dd>
							<dt>Issued</dt>
							<dd>{date(inv.issuedAt)}</dd>
							<dt>Due</dt>
							<dd>{date(inv.dueAt)}</dd>
							<dt>Status</dt>
							<dd className="font-semibold text-zinc-900">{isVoid ? 'Void' : inv.status === 'Paid' ? `Paid ${date(inv.paidAt)}` : inv.status}</dd>
						</dl>
					</div>
				</header>

				<section className="grid grid-cols-2 gap-6 py-6">
					<div>
						<div className="mb-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Bill to</div>
						<div className="font-semibold">{inv.billToName || companyName}</div>
						{billToAddress && <div className="whitespace-pre-line text-zinc-600">{billToAddress}</div>}
						{billToGstin && <div className="text-zinc-600">GSTIN {billToGstin}</div>}
						<div className="text-zinc-600">Company code {companyCode}</div>
					</div>
					{inv.periodStart && (
						<div className="text-right">
							<div className="mb-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Service period</div>
							<div className="tabular">
								{date(inv.periodStart)} – {date(inv.periodEnd)}
							</div>
						</div>
					)}
				</section>

				<table className="w-full border-collapse">
					<thead>
						<tr className="border-y border-zinc-300 text-left text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
							<th className="py-2">Description</th>
							<th className="py-2 text-right">Qty</th>
							<th className="py-2 text-right">Rate</th>
							<th className="py-2 text-right">Amount</th>
						</tr>
					</thead>
					<tbody className="tabular">
						{inv.lines.map((line, index) => (
							<tr key={index} className="border-b border-zinc-100">
								<td className="py-2 pr-4">{line.description}</td>
								<td className="py-2 text-right">{line.quantity}</td>
								<td className="py-2 text-right">{money(line.unitPriceMinor, inv.currency)}</td>
								<td className="py-2 text-right">{money(line.amountMinor, inv.currency)}</td>
							</tr>
						))}
					</tbody>
				</table>

				<div className="tabular mt-4 ml-auto w-72">
					<div className="flex justify-between py-1">
						<span className="text-zinc-600">Subtotal</span>
						<span>{money(inv.subtotalMinor, inv.currency)}</span>
					</div>
					{inv.taxMinor > 0 && (
						<div className="flex justify-between py-1">
							<span className="text-zinc-600">Tax{inv.taxRatePercent ? ` (${inv.taxRatePercent}%)` : ''}</span>
							<span>{money(inv.taxMinor, inv.currency)}</span>
						</div>
					)}
					<div className="flex justify-between border-t border-zinc-300 py-2 text-[15px] font-bold">
						<span>Total</span>
						<span>{money(inv.totalMinor, inv.currency)}</span>
					</div>
					{paid.map((p) => (
						<div key={p.id} className="flex justify-between py-0.5 text-zinc-600">
							<span>Paid {date(p.paidAt)}</span>
							<span>− {money(p.amountMinor - p.refundedAmountMinor, inv.currency)}</span>
						</div>
					))}
					{!isVoid && (
						<div className="mt-1 flex justify-between border-t border-zinc-200 py-2 font-semibold">
							<span>Amount due</span>
							<span>{money(inv.amountDueMinor, inv.currency)}</span>
						</div>
					)}
				</div>

				<footer className="mt-10 border-t border-zinc-200 pt-4 text-[11px] text-zinc-500">
					{inv.taxMinor === 0 && !seller.gstin && <p>No GST is charged on this invoice.</p>}
					<p>Questions about this invoice: {seller.email} · {seller.phone}</p>
					<p className="mt-1">Thank you for using Trovo.</p>
				</footer>
			</article>
		</div>
	);
}
