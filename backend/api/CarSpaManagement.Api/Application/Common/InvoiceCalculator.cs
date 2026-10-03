using CarSpaManagement.Api.Domain.Entities;

namespace CarSpaManagement.Api.Application.Common;

/// <summary>
/// Single authoritative calculation path for job-card and invoice money amounts.
///
/// Per line:
///   Gross    = round(Quantity × UnitPrice)
///   Net      = Gross − LineDiscount                       (fixed-amount line discount)
///   Taxable  = Net − share of the invoice-level discount  (allocated pro rata on Net)
///   CGST     = round(Taxable × Rate / 2 / 100)
///   SGST     = round(Taxable × Rate / 2 / 100)            (intra-state: equal halves)
///   Total    = Taxable + CGST + SGST
/// Invoice totals are the sums of the line values, so header and lines always reconcile.
/// </summary>
public static class InvoiceCalculator
{
    /// <summary>
    /// Rate applied to a GST-enabled line that has no stored rate (job-card lines store 0% when GST was off
    /// at job-card time, and outside/vendor jobs carry no catalogue rate). Matches the existing application
    /// behaviour and the CGST 9% + SGST 9% presentation used on printed invoices.
    /// </summary>
    public const decimal StandardGstRatePercent = 18m;

    /// <summary>
    /// Existing currency rounding: 2 decimal places using .NET's default Math.Round midpoint rule (to even).
    /// Kept unchanged in Phase 0; changing the midpoint rule is a separate business decision.
    /// </summary>
    public const MidpointRounding Rounding = MidpointRounding.ToEven;

    public static decimal Round(decimal value) => Math.Round(value, 2, Rounding);

    public static decimal ResolveGstRate(decimal storedRatePercent) =>
        storedRatePercent > 0 ? storedRatePercent : StandardGstRatePercent;

    public sealed record LineInput(int Quantity, decimal UnitPrice, decimal Discount, decimal TaxRatePercent);

    public sealed record LineResult(
        decimal Gross,
        decimal LineDiscount,
        decimal AllocatedInvoiceDiscount,
        decimal Taxable,
        decimal Cgst,
        decimal Sgst)
    {
        public decimal Net => Gross - LineDiscount;
        public decimal Tax => Cgst + Sgst;
        public decimal Total => Taxable + Tax;
    }

    public sealed record Result(
        IReadOnlyList<LineResult> Lines,
        decimal Subtotal,
        decimal InvoiceDiscount,
        decimal Taxable,
        decimal Cgst,
        decimal Sgst)
    {
        public decimal GstAmount => Cgst + Sgst;
        public decimal Total => Taxable + GstAmount;
    }

    /// <param name="lines">Invoice or job-card lines. Tax rates are ignored when <paramref name="isGstEnabled"/> is false.</param>
    /// <param name="invoiceDiscount">Fixed invoice-level discount (0 for job cards).</param>
    /// <exception cref="ArgumentOutOfRangeException">Negative values, or a discount larger than the amount it reduces.</exception>
    public static Result Calculate(IReadOnlyList<LineInput> lines, decimal invoiceDiscount, bool isGstEnabled)
    {
        ArgumentNullException.ThrowIfNull(lines);

        var gross = new decimal[lines.Count];
        var net = new decimal[lines.Count];
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (line.Quantity <= 0)
                throw new ArgumentOutOfRangeException(nameof(lines), "Service quantity must be greater than zero.");
            if (line.UnitPrice < 0)
                throw new ArgumentOutOfRangeException(nameof(lines), "Unit price cannot be negative.");
            if (line.Discount < 0)
                throw new ArgumentOutOfRangeException(nameof(lines), "Discount amount cannot be negative.");
            if (isGstEnabled && line.TaxRatePercent < 0)
                throw new ArgumentOutOfRangeException(nameof(lines), "Tax rate cannot be negative.");

            gross[i] = Round(line.Quantity * line.UnitPrice);
            var lineDiscount = Round(line.Discount);
            if (lineDiscount > gross[i])
                throw new ArgumentOutOfRangeException(nameof(lines), "Line discount cannot exceed the line amount.");
            net[i] = gross[i] - lineDiscount;
        }

        var subtotal = net.Sum();
        var discount = Round(invoiceDiscount);
        if (discount < 0)
            throw new ArgumentOutOfRangeException("Discount", "Discount cannot be negative.");
        if (discount > subtotal)
            throw new ArgumentOutOfRangeException("Discount", "Discount cannot exceed subtotal.");

        var allocation = AllocateDiscount(net, discount);

        var results = new LineResult[lines.Count];
        for (var i = 0; i < lines.Count; i++)
        {
            var taxable = net[i] - allocation[i];
            var halfRate = isGstEnabled ? lines[i].TaxRatePercent / 2m : 0m;
            var cgst = Round(taxable * halfRate / 100m);
            var sgst = Round(taxable * halfRate / 100m);
            results[i] = new LineResult(gross[i], gross[i] - net[i], allocation[i], taxable, cgst, sgst);
        }

        return new Result(
            results,
            subtotal,
            discount,
            results.Sum(r => r.Taxable),
            results.Sum(r => r.Cgst),
            results.Sum(r => r.Sgst));
    }

    /// <summary>
    /// Splits a fixed invoice-level discount across lines in proportion to their net amounts.
    /// Rounding remainder goes to the largest line so the shares always sum exactly to the discount.
    /// </summary>
    private static decimal[] AllocateDiscount(decimal[] net, decimal discount)
    {
        var shares = new decimal[net.Length];
        var totalNet = net.Sum();
        if (discount == 0 || totalNet == 0) return shares;

        var largest = Array.IndexOf(net, net.Max());
        decimal allocated = 0;
        for (var i = 0; i < net.Length; i++)
        {
            if (i == largest) continue;
            shares[i] = Math.Min(net[i], Round(discount * net[i] / totalNet));
            allocated += shares[i];
        }
        shares[largest] = discount - allocated;
        return shares;
    }

    /// <summary>
    /// Recalculates a draft invoice's line and header amounts from its active lines.
    /// Service lines take the job-card line's GST rate (falling back to the standard rate when the stored
    /// rate is 0); outside/vendor-job lines use the standard rate. Legacy invoices that never had line
    /// records keep their stored header totals; invoices whose lines were all removed total zero.
    /// </summary>
    public static void ApplyToInvoice(Invoice invoice, IEnumerable<JobCardService>? jobCardLines)
    {
        if (invoice.InvoiceItems.Count == 0) return;

        var items = invoice.InvoiceItems.Where(i => !i.IsDeleted).ToList();
        if (items.Count == 0)
        {
            invoice.Subtotal = invoice.TaxableAmount = invoice.GstAmount = invoice.TotalAmount = 0m;
            invoice.BalanceAmount = 0m;
            return;
        }

        var ratesByService = (jobCardLines ?? Enumerable.Empty<JobCardService>())
            .Where(l => !l.IsDeleted)
            .GroupBy(l => l.ServiceId)
            .ToDictionary(g => g.Key, g => g.First().TaxPercentage);

        decimal RateFor(InvoiceItem item)
        {
            if (!invoice.IsGstEnabled || item.OutsideJobId.HasValue || item.ServiceId is null)
                return StandardGstRatePercent;
            return ResolveGstRate(ratesByService.GetValueOrDefault(item.ServiceId.Value));
        }

        var result = Calculate(
            items.Select(i => new LineInput(i.Quantity, i.UnitPrice, i.Discount, RateFor(i))).ToList(),
            invoice.Discount,
            invoice.IsGstEnabled);

        for (var i = 0; i < items.Count; i++)
        {
            items[i].TaxableAmount = result.Lines[i].Taxable;
            items[i].TaxAmount = result.Lines[i].Tax;
            items[i].TotalAmount = result.Lines[i].Total;
        }

        invoice.Subtotal = result.Subtotal;
        invoice.Discount = result.InvoiceDiscount;
        invoice.TaxableAmount = result.Taxable;
        invoice.GstAmount = result.GstAmount;
        invoice.TotalAmount = result.Total;
        invoice.BalanceAmount = Math.Max(0m, invoice.TotalAmount - invoice.PaidAmount);
    }
}
