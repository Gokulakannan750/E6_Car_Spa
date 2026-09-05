import 'dart:typed_data';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../../settings/models/business_profile_model.dart';
import '../models/invoice_model.dart';

class InvoicePdfGenerator {
  static String _formatCurrency(double val) {
    return 'Rs. ${val.toStringAsFixed(2)}';
  }

  static String _formatDate(DateTime date) {
    return DateFormat('dd-MM-yyyy').format(date);
  }

  static Future<Uint8List> generateInvoicePdf({
    required Invoice invoice,
    BusinessProfileModel? businessProfile,
    Uint8List? logoBytes,
    PdfPageFormat format = PdfPageFormat.a4,
  }) async {
    final doc = pw.Document();

    final isDraft = invoice.isDraft;
    final isGst = invoice.isGstEnabled;

    final businessName = businessProfile?.businessName ?? 'E6 Car Spa';
    final addressLine1 = businessProfile?.addressLine1 ?? '36, Geetha Nagar Main Road';
    final addressLine2 = businessProfile?.addressLine2 ?? 'Behind Sakthi Mahal, Perundurai Road';
    final cityStatePin = [
      businessProfile?.city ?? 'Erode',
      businessProfile?.state ?? 'Tamil Nadu',
    ].where((s) => s.isNotEmpty).join(', ') +
        (businessProfile?.postalCode != null && businessProfile!.postalCode.isNotEmpty
            ? ' - ${businessProfile.postalCode}'
            : ' - 638011');
    final phone = businessProfile?.phone ?? '9578749449';
    final email = businessProfile?.email ?? 'e6carspaerd@gmail.com';
    final gstin = businessProfile?.gstin?.trim();

    final documentTitle = isDraft
        ? 'DRAFT INVOICE'
        : isGst
            ? 'TAX INVOICE'
            : 'INVOICE';

    final cgstAmount = isGst ? invoice.gstAmount / 2 : 0.0;
    final sgstAmount = isGst ? invoice.gstAmount / 2 : 0.0;

    final primaryColor = PdfColor.fromHex('#A11A1A');
    final darkTextColor = PdfColor.fromHex('#0F172A');
    final mutedTextColor = PdfColor.fromHex('#475569');
    final borderColor = PdfColor.fromHex('#CBD5E1');
    final tableHeaderBg = PdfColor.fromHex('#F1F5F9');

    doc.addPage(
      pw.MultiPage(
        pageFormat: format,
        margin: const pw.EdgeInsets.all(28),
        build: (context) => [
          // ── Header Section ──────────────────────────────────────────
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Expanded(
                child: pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    if (logoBytes != null) ...[
                      pw.Container(
                        width: 44,
                        height: 44,
                        margin: const pw.EdgeInsets.only(right: 10),
                        child: pw.Image(
                          pw.MemoryImage(logoBytes),
                          fit: pw.BoxFit.contain,
                        ),
                      ),
                    ],
                    pw.Expanded(
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            businessName.toUpperCase(),
                            style: pw.TextStyle(
                              fontSize: 18,
                              fontWeight: pw.FontWeight.bold,
                              color: primaryColor,
                            ),
                          ),
                          pw.SizedBox(height: 2),
                          pw.Text(
                            'Premium Auto Detailing & Car Care Solutions',
                            style: pw.TextStyle(
                              fontSize: 9,
                              color: mutedTextColor,
                              fontWeight: pw.FontWeight.bold,
                            ),
                          ),
                          pw.SizedBox(height: 4),
                          if (addressLine1.isNotEmpty)
                            pw.Text(
                              addressLine1,
                              style: pw.TextStyle(fontSize: 8.5, color: mutedTextColor),
                            ),
                          if (addressLine2.isNotEmpty)
                            pw.Text(
                              addressLine2,
                              style: pw.TextStyle(fontSize: 8.5, color: mutedTextColor),
                            ),
                          pw.Text(
                            cityStatePin,
                            style: pw.TextStyle(fontSize: 8.5, color: mutedTextColor),
                          ),
                          pw.SizedBox(height: 2),
                          pw.Text(
                            'Phone: $phone${email.isNotEmpty ? '  |  Email: $email' : ''}',
                            style: pw.TextStyle(fontSize: 8.5, color: mutedTextColor),
                          ),
                          if (isGst && gstin != null && gstin.isNotEmpty) ...[
                            pw.SizedBox(height: 2),
                            pw.Text(
                              'GSTIN: $gstin',
                              style: pw.TextStyle(
                                fontSize: 8.5,
                                fontWeight: pw.FontWeight.bold,
                                color: darkTextColor,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              pw.SizedBox(width: 16),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text(
                    documentTitle,
                    style: pw.TextStyle(
                      fontSize: 18,
                      fontWeight: pw.FontWeight.bold,
                      color: primaryColor,
                    ),
                  ),
                  pw.SizedBox(height: 6),
                  pw.Text(
                    'Invoice No: ${invoice.invoiceNumber ?? (isDraft ? 'DRAFT' : '—')}',
                    style: pw.TextStyle(
                      fontSize: 10,
                      fontWeight: pw.FontWeight.bold,
                      color: darkTextColor,
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    'Date: ${_formatDate(invoice.invoiceDate)}',
                    style: pw.TextStyle(fontSize: 9, color: mutedTextColor),
                  ),
                  if (invoice.jobCardNumber.isNotEmpty) ...[
                    pw.SizedBox(height: 2),
                    pw.Text(
                      'Job Card: ${invoice.jobCardNumber}',
                      style: pw.TextStyle(
                        fontSize: 9,
                        fontWeight: pw.FontWeight.bold,
                        color: darkTextColor,
                      ),
                    ),
                  ],
                  pw.SizedBox(height: 2),
                  pw.Text(
                    'Status: ${invoice.status.label.toUpperCase()}',
                    style: pw.TextStyle(
                      fontSize: 8.5,
                      fontWeight: pw.FontWeight.bold,
                      color: invoice.isPaid
                          ? PdfColor.fromHex('#16A34A')
                          : invoice.isCancelled
                              ? PdfColor.fromHex('#DC2626')
                              : primaryColor,
                    ),
                  ),
                ],
              ),
            ],
          ),

          pw.SizedBox(height: 8),
          pw.Container(
            height: 2,
            color: primaryColor,
          ),
          pw.SizedBox(height: 10),

          // ── Bill To & Vehicle Details ───────────────────────────────
          pw.Table(
            border: pw.TableBorder.all(color: borderColor, width: 0.8),
            children: [
              pw.TableRow(
                children: [
                  pw.Container(
                    color: tableHeaderBg,
                    padding: const pw.EdgeInsets.all(5),
                    child: pw.Text(
                      'BILL TO',
                      style: pw.TextStyle(
                        fontSize: 8,
                        fontWeight: pw.FontWeight.bold,
                        color: darkTextColor,
                      ),
                    ),
                  ),
                  pw.Container(
                    padding: const pw.EdgeInsets.all(5),
                    child: pw.Text(
                      invoice.customerName,
                      style: pw.TextStyle(
                        fontSize: 9,
                        fontWeight: pw.FontWeight.bold,
                        color: darkTextColor,
                      ),
                    ),
                  ),
                  pw.Container(
                    color: tableHeaderBg,
                    padding: const pw.EdgeInsets.all(5),
                    child: pw.Text(
                      'VEHICLE REG NO',
                      style: pw.TextStyle(
                        fontSize: 8,
                        fontWeight: pw.FontWeight.bold,
                        color: darkTextColor,
                      ),
                    ),
                  ),
                  pw.Container(
                    padding: const pw.EdgeInsets.all(5),
                    child: pw.Text(
                      invoice.registrationNumber.isNotEmpty ? invoice.registrationNumber : '—',
                      style: pw.TextStyle(
                        fontSize: 9,
                        fontWeight: pw.FontWeight.bold,
                        color: darkTextColor,
                      ),
                    ),
                  ),
                ],
              ),
              pw.TableRow(
                children: [
                  pw.Container(
                    color: tableHeaderBg,
                    padding: const pw.EdgeInsets.all(5),
                    child: pw.Text(
                      'PHONE',
                      style: pw.TextStyle(
                        fontSize: 8,
                        fontWeight: pw.FontWeight.bold,
                        color: darkTextColor,
                      ),
                    ),
                  ),
                  pw.Container(
                    padding: const pw.EdgeInsets.all(5),
                    child: pw.Text(
                      invoice.customerPhone.isNotEmpty ? invoice.customerPhone : '—',
                      style: pw.TextStyle(fontSize: 8.5, color: darkTextColor),
                    ),
                  ),
                  pw.Container(
                    color: tableHeaderBg,
                    padding: const pw.EdgeInsets.all(5),
                    child: pw.Text(
                      'VEHICLE MODEL',
                      style: pw.TextStyle(
                        fontSize: 8,
                        fontWeight: pw.FontWeight.bold,
                        color: darkTextColor,
                      ),
                    ),
                  ),
                  pw.Container(
                    padding: const pw.EdgeInsets.all(5),
                    child: pw.Text(
                      [
                        '${invoice.vehicleMake} ${invoice.vehicleModel}'.trim(),
                        if (invoice.vehicleVariant != null && invoice.vehicleVariant!.isNotEmpty)
                          '(${invoice.vehicleVariant})',
                        if (invoice.vehicleColor != null && invoice.vehicleColor!.isNotEmpty)
                          '- ${invoice.vehicleColor}',
                      ].where((s) => s.isNotEmpty).join(' '),
                      style: pw.TextStyle(fontSize: 8.5, color: darkTextColor),
                    ),
                  ),
                ],
              ),
            ],
          ),

          pw.SizedBox(height: 12),

          // ── Services Table (NO per-service GST) ─────────────────────
          pw.Table(
            border: pw.TableBorder.all(color: borderColor, width: 0.8),
            columnWidths: {
              0: const pw.FixedColumnWidth(26),
              1: const pw.FlexColumnWidth(4),
              2: const pw.FixedColumnWidth(40),
              3: const pw.FixedColumnWidth(70),
              4: const pw.FixedColumnWidth(75),
            },
            children: [
              pw.TableRow(
                decoration: pw.BoxDecoration(color: tableHeaderBg),
                children: [
                  _tableHeader('#', align: pw.TextAlign.center),
                  _tableHeader('DESCRIPTION', align: pw.TextAlign.left),
                  _tableHeader('QTY', align: pw.TextAlign.center),
                  _tableHeader('RATE', align: pw.TextAlign.right),
                  _tableHeader('AMOUNT', align: pw.TextAlign.right),
                ],
              ),
              if (invoice.items.isEmpty)
                pw.TableRow(
                  children: [
                    pw.Container(
                      padding: const pw.EdgeInsets.all(10),
                      alignment: pw.Alignment.center,
                      child: pw.Text(
                        'No service items recorded on this invoice.',
                        style: pw.TextStyle(
                          fontSize: 8.5,
                          fontStyle: pw.FontStyle.italic,
                          color: mutedTextColor,
                        ),
                      ),
                    ),
                    pw.Container(),
                    pw.Container(),
                    pw.Container(),
                    pw.Container(),
                  ],
                )
              else
                ...invoice.items.asMap().entries.map((entry) {
                  final idx = entry.key + 1;
                  final item = entry.value;
                  final lineTotal = item.unitPrice * item.quantity;
                  return pw.TableRow(
                    children: [
                      _tableCell('$idx', align: pw.TextAlign.center),
                      _tableCell(item.description, align: pw.TextAlign.left),
                      _tableCell('${item.quantity}', align: pw.TextAlign.center),
                      _tableCell(_formatCurrency(item.unitPrice), align: pw.TextAlign.right),
                      _tableCell(_formatCurrency(lineTotal), align: pw.TextAlign.right, isBold: true),
                    ],
                  );
                }),
            ],
          ),

          pw.SizedBox(height: 12),

          // ── Financial Summary & Terms ───────────────────────────────
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // Left: Notes & Terms
              pw.Expanded(
                flex: 5,
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    if (invoice.notes != null && invoice.notes!.isNotEmpty) ...[
                      pw.Container(
                        padding: const pw.EdgeInsets.all(6),
                        decoration: pw.BoxDecoration(
                          color: tableHeaderBg,
                          borderRadius: const pw.BorderRadius.all(pw.Radius.circular(3)),
                          border: pw.Border.all(color: borderColor, width: 0.6),
                        ),
                        child: pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            pw.Text(
                              'NOTES:',
                              style: pw.TextStyle(
                                fontSize: 7.5,
                                fontWeight: pw.FontWeight.bold,
                                color: mutedTextColor,
                              ),
                            ),
                            pw.SizedBox(height: 2),
                            pw.Text(
                              invoice.notes!,
                              style: pw.TextStyle(fontSize: 8, color: darkTextColor),
                            ),
                          ],
                        ),
                      ),
                      pw.SizedBox(height: 8),
                    ],
                    pw.Text(
                      'TERMS & CONDITIONS:',
                      style: pw.TextStyle(
                        fontSize: 8,
                        fontWeight: pw.FontWeight.bold,
                        color: darkTextColor,
                      ),
                    ),
                    pw.SizedBox(height: 3),
                    pw.Text(
                      businessProfile?.termsAndConditions?.isNotEmpty == true
                          ? businessProfile!.termsAndConditions!
                          : '1. Payment is due upon completion of vehicle detailing services.\n2. Goods/services once provided are non-refundable.\n3. Please inspect your vehicle thoroughly prior to delivery handover.',
                      style: pw.TextStyle(fontSize: 7.5, color: mutedTextColor, lineSpacing: 1.5),
                    ),
                  ],
                ),
              ),
              pw.SizedBox(width: 14),

              // Right: Totals Breakdown Table
              pw.Expanded(
                flex: 5,
                child: pw.Table(
                  border: pw.TableBorder.all(color: borderColor, width: 0.8),
                  children: [
                    _summaryRow('Subtotal', _formatCurrency(invoice.subtotal)),
                    if (invoice.discount > 0)
                      _summaryRow(
                        'Discount Applied',
                        '- ${_formatCurrency(invoice.discount)}',
                        textColor: PdfColor.fromHex('#16A34A'),
                      ),
                    if (isGst) ...[
                      _summaryRow('Taxable Value', _formatCurrency(invoice.taxableAmount)),
                      _summaryRow('CGST (9%)', _formatCurrency(cgstAmount)),
                      _summaryRow('SGST (9%)', _formatCurrency(sgstAmount)),
                    ],
                    _summaryRow(
                      'Grand Total',
                      _formatCurrency(invoice.totalAmount),
                      isBold: true,
                      bgColor: tableHeaderBg,
                      textColor: primaryColor,
                      fontSize: 10,
                    ),
                    _summaryRow('Amount Paid', _formatCurrency(invoice.paidAmount)),
                    _summaryRow(
                      'Balance Due',
                      _formatCurrency(invoice.balanceAmount),
                      isBold: true,
                      bgColor: tableHeaderBg,
                      fontSize: 9.5,
                    ),
                  ],
                ),
              ),
            ],
          ),

          pw.SizedBox(height: 16),
          pw.Divider(color: borderColor, thickness: 0.8),
          pw.SizedBox(height: 4),

          // ── Footer ──────────────────────────────────────────────────
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'Thank you for choosing $businessName!',
                    style: pw.TextStyle(
                      fontSize: 9,
                      fontWeight: pw.FontWeight.bold,
                      color: primaryColor,
                    ),
                  ),
                  pw.Text(
                    'This is a computer generated invoice. No physical signature is required.',
                    style: pw.TextStyle(fontSize: 7.5, color: mutedTextColor),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );

    return doc.save();
  }

  static pw.Widget _tableHeader(String text, {pw.TextAlign align = pw.TextAlign.left}) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 4),
      child: pw.Text(
        text,
        textAlign: align,
        style: pw.TextStyle(
          fontSize: 8,
          fontWeight: pw.FontWeight.bold,
          color: PdfColor.fromHex('#0F172A'),
        ),
      ),
    );
  }

  static pw.Widget _tableCell(
    String text, {
    pw.TextAlign align = pw.TextAlign.left,
    bool isBold = false,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 4),
      child: pw.Text(
        text,
        textAlign: align,
        style: pw.TextStyle(
          fontSize: 8.5,
          fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
          color: PdfColor.fromHex('#0F172A'),
        ),
      ),
    );
  }

  static pw.TableRow _summaryRow(
    String label,
    String value, {
    bool isBold = false,
    PdfColor? bgColor,
    PdfColor? textColor,
    double fontSize = 8.5,
  }) {
    return pw.TableRow(
      decoration: bgColor != null ? pw.BoxDecoration(color: bgColor) : null,
      children: [
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 3.5),
          child: pw.Text(
            label,
            style: pw.TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
              color: PdfColor.fromHex('#0F172A'),
            ),
          ),
        ),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 3.5),
          alignment: pw.Alignment.centerRight,
          child: pw.Text(
            value,
            textAlign: pw.TextAlign.right,
            style: pw.TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
              color: textColor ?? PdfColor.fromHex('#0F172A'),
            ),
          ),
        ),
      ],
    );
  }
}
