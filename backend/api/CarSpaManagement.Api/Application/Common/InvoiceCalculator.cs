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
    /// Rate for lines that have no catalogue service of their own: outside/vendor-job lines, and the single
    /// synthetic line of a legacy draft invoice that was stored without line records. It is NOT a fallback for
    /// catalogue services: a service configured at 0% is taxed at 0% (see <see cref="ResolveServiceRate"/>).
    /// </summary>
    public const decimal StandardGstRatePercent = 18m;

    /// <summary>
    /// Existing currency rounding: 2 decimal places using .NET's default Math.Round midpoint rule (to even).
    /// Kept unchanged in Phase 0; changing the midpoint rule is a separate business decision.
    /// </summary>
    public const MidpointRounding Rounding = MidpointRounding.ToEven;

    public static decimal Round(decimal value) => Math.Round(value, 2, Rounding);

    /// <summary>
    /// GST rate for a catalogue-service line. A job-card line keeps the rate it was created with, but stores 0%
    /// both for a 0% service and for a job card created with GST switched off; in the second case the service's
    /// configured catalogue rate is the rate that applies once the invoice is a GST invoice. 0% stays 0%.
    /// </summary>
    public static decimal ResolveServiceRate(decimal jobCardLineRatePercent, decimal catalogueRatePercent) =>
        jobCardLineRatePercent > 0 ? jobCardLineRatePercent : catalogueRatePercent;

    /// <summary>CGST/SGST halves of a stored line tax amount. Exact for lines produced by <see cref="Calculate"/>.</summary>
    public static (decimal Cgst, decimal Sgst) SplitTax(decimal taxAmount)
    {
        var cgst = Round(taxAmount / 2m);
        return (cgst, taxAmount - cgst);
    }

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

    /// <summary>Taxable value and tax of all lines charged at one GST rate. A null rate means the rate is unknown (legacy line).</summary>
    public sealed record TaxGroup(decimal? RatePercent, decimal Taxable, decimal Cgst, decimal Sgst)
    {
        public decimal Tax => Cgst + Sgst;
    }

    /// <summary>
    /// Groups line values by GST rate for display (highest rate first, unknown last). Uses the given (stored)
    /// line amounts only — it never recalculates tax — so its totals always equal the sums of the lines.
    /// </summary>
    public static IReadOnlyList<TaxGroup> SummarizeByRate(IEnumerable<(decimal? RatePercent, decimal Taxable, decimal Tax)> lines) =>
        lines
            .GroupBy(l => l.RatePercent)
            .Select(g =>
            {
                var halves = g.Select(l => SplitTax(l.Tax)).ToList();
                return new TaxGroup(g.Key, g.Sum(l => l.Taxable), halves.Sum(h => h.Cgst), halves.Sum(h => h.Sgst));
            })
            .OrderBy(g => g.RatePercent is null)
            .ThenByDescending(g => g.RatePercent)
            .ToList();

    /// <summary>
    /// Rate-wise tax summary of a stored invoice, for display (DTOs, PDF, print, public page). Uses only the stored
    /// line and header values — a finalized invoice is never recalculated. When the stored lines do not account for
    /// the stored header GST (legacy invoices without line tax), the header GST is shown as one group of unknown rate.
    /// </summary>
    public static IReadOnlyList<TaxGroup> SummarizeStoredInvoice(Invoice invoice)
    {
        if (!invoice.IsGstEnabled) return [];

        var lines = invoice.InvoiceItems.Where(it => !it.IsDeleted).ToList();
        if (lines.Count > 0 && lines.Sum(l => l.TaxAmount) == invoice.GstAmount)
            return SummarizeByRate(lines.Select(l => (l.TaxRatePercent, l.TaxableAmount, l.TaxAmount)));

        if (invoice.GstAmount == 0m) return [];
        var (cgst, sgst) = SplitTax(invoice.GstAmount);
        return [new TaxGroup(null, invoice.TaxableAmount, cgst, sgst)];
    }

    /// <summary>Display form of a rate: 18 → "18%", 2.5 → "2.5%".</summary>
    public static string FormatRate(decimal ratePercent) =>
        ratePercent.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture) + "%";

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
    /// Recalculates a draft invoice's line and header amounts from its active lines, and records on each line
    /// the GST rate that was applied (0 on a non-GST invoice). Service lines use <paramref name="serviceRates"/>
    /// (see <see cref="ResolveServiceRate"/>); outside/vendor-job lines use the standard rate. Legacy invoices
    /// that never had line records keep their stored header totals; invoices whose lines were all removed total zero.
    /// Must only be used on drafts: finalized invoices keep their stored amounts and rates.
    /// </summary>
    /// <exception cref="InvalidOperationException">A GST service line has no rate in <paramref name="serviceRates"/>.</exception>
    public static void ApplyToInvoice(Invoice invoice, IReadOnlyDictionary<Guid, decimal> serviceRates)
    {
        if (invoice.InvoiceItems.Count == 0) return;

        var items = invoice.InvoiceItems.Where(i => !i.IsDeleted).ToList();
        if (items.Count == 0)
        {
            invoice.Subtotal = invoice.TaxableAmount = invoice.GstAmount = invoice.TotalAmount = 0m;
            invoice.BalanceAmount = 0m;
            return;
        }

        decimal RateFor(InvoiceItem item)
        {
            if (!invoice.IsGstEnabled) return 0m;
            if (item.OutsideJobId.HasValue || item.ServiceId is null) return StandardGstRatePercent;
            if (serviceRates.TryGetValue(item.ServiceId.Value, out var rate)) return rate;
            throw new InvalidOperationException($"The GST rate for '{item.Description}' could not be determined. Check the service in the catalogue.");
        }

        var rates = items.Select(RateFor).ToList();
        var result = Calculate(
            items.Select((i, index) => new LineInput(i.Quantity, i.UnitPrice, i.Discount, rates[index])).ToList(),
            invoice.Discount,
            invoice.IsGstEnabled);

        for (var i = 0; i < items.Count; i++)
        {
            items[i].TaxRatePercent = rates[i];
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
