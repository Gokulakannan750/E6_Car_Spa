import '../../features/invoices/models/invoice_model.dart';

/// Presentation of server-calculated GST. Nothing here calculates tax: every amount comes from the
/// backend (invoice tax breakdown or job-card estimate). Labels match the server PDF and the desktop app.

/// 18 → "18%", 2.5 → "2.5%".
String formatGstRate(double ratePercent) {
  final rounded = double.parse(ratePercent.toStringAsFixed(2));
  final text = rounded == rounded.truncateToDouble()
      ? rounded.toStringAsFixed(0)
      : rounded.toString();
  return '$text%';
}

class GstRow {
  final String label;

  /// Taxable value the row applies to; set only when the invoice has more than one rate.
  final double? taxableAmount;
  final double amount;

  const GstRow(this.label, this.taxableAmount, this.amount);
}

/// "CGST @ 9%" / "SGST @ 9%" per rate actually charged, "GST @ 0%" for 0% lines, and plain
/// "CGST" / "SGST" when a legacy line's rate is unknown.
List<GstRow> gstRows(List<TaxBreakdown> breakdown) {
  final showBase = breakdown.length > 1;
  final rows = <GstRow>[];
  for (final g in breakdown) {
    final base = showBase ? g.taxableAmount : null;
    final rate = g.ratePercent;
    if (rate == null) {
      rows
        ..add(GstRow('CGST', base, g.cgstAmount))
        ..add(GstRow('SGST', base, g.sgstAmount));
    } else if (rate == 0) {
      rows.add(GstRow('GST @ 0%', base, 0));
    } else {
      final half = formatGstRate(rate / 2);
      rows
        ..add(GstRow('CGST @ $half', base, g.cgstAmount))
        ..add(GstRow('SGST @ $half', base, g.sgstAmount));
    }
  }
  return rows;
}

/// e.g. "GST 18%" or "GST 18% + 5% + 0%".
String gstRatesSummary(List<TaxBreakdown> breakdown) {
  final rates = breakdown
      .where((g) => g.ratePercent != null)
      .map((g) => formatGstRate(g.ratePercent!))
      .toList();
  return rates.isEmpty ? 'GST' : 'GST ${rates.join(' + ')}';
}

/// Amount column of an invoice line: qty × rate − line discount (before invoice discount and tax).
double invoiceLineAmount(InvoiceItem item) =>
    (item.unitPrice * item.quantity * 100).round() / 100 - item.discount;
