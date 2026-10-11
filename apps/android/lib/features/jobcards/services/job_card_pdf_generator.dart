import 'dart:typed_data';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../../invoices/services/invoice_pdf_generator.dart'
    show resolveAccentColor;
import '../../settings/models/business_profile_model.dart';
import '../models/job_card_model.dart';

/// The paper work order handed to the workshop: who and what vehicle, the jobs to tick off, and signatures.
/// Same content as the Windows job card print.
class JobCardPdfGenerator {
  static Future<Uint8List> generate({
    required JobCard jobCard,
    BusinessProfileModel? businessProfile,
    Uint8List? logoBytes,
    PdfPageFormat format = PdfPageFormat.a4,
  }) async {
    final doc = pw.Document();
    final businessName = businessProfile?.businessName.trim() ?? '';
    final accent = PdfColor.fromHex(
      resolveAccentColor(businessProfile?.brandColor),
    );
    final dark = PdfColor.fromHex('#0F172A');
    final muted = PdfColor.fromHex('#475569');
    final border = PdfColor.fromHex('#CBD5E1');
    final headerBg = PdfColor.fromHex('#F1F5F9');

    final vehicle = jobCard.vehicle;
    final model = [
      if (vehicle.make.trim().isNotEmpty) vehicle.make.trim(),
      vehicle.model.trim(),
    ].where((p) => p.isNotEmpty).join(' ');
    final modelLine =
        model +
        ((vehicle.variant?.trim().isNotEmpty ?? false)
            ? ' (${vehicle.variant!.trim()})'
            : '') +
        ((vehicle.color?.trim().isNotEmpty ?? false)
            ? ' - ${vehicle.color!.trim()}'
            : '');
    final phone = jobCard.customer.phoneNumber.trim();
    final notes = jobCard.notes?.trim() ?? '';

    pw.Widget label(String text) => pw.Container(
      color: headerBg,
      padding: const pw.EdgeInsets.all(6),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: 9,
          fontWeight: pw.FontWeight.bold,
          color: muted,
        ),
      ),
    );
    pw.Widget value(String text) => pw.Padding(
      padding: const pw.EdgeInsets.all(6),
      child: pw.Text(
        text.isEmpty ? '-' : text,
        style: pw.TextStyle(fontSize: 10, color: dark),
      ),
    );
    pw.Widget cell(
      String text, {
      bool bold = false,
      pw.TextAlign align = pw.TextAlign.left,
    }) => pw.Padding(
      padding: const pw.EdgeInsets.all(6),
      child: pw.Text(
        text,
        textAlign: align,
        style: pw.TextStyle(
          fontSize: 10,
          color: dark,
          fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
        ),
      ),
    );

    doc.addPage(
      pw.MultiPage(
        pageFormat: format,
        margin: const pw.EdgeInsets.all(28),
        build: (context) => [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Expanded(
                child: pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.center,
                  children: [
                    if (logoBytes != null)
                      pw.Container(
                        width: 44,
                        height: 44,
                        margin: const pw.EdgeInsets.only(right: 10),
                        child: pw.Image(
                          pw.MemoryImage(logoBytes),
                          fit: pw.BoxFit.contain,
                        ),
                      ),
                    if (businessName.isNotEmpty)
                      pw.Expanded(
                        child: pw.Text(
                          businessName.toUpperCase(),
                          style: pw.TextStyle(
                            fontSize: 18,
                            fontWeight: pw.FontWeight.bold,
                            color: accent,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text(
                    'JOB CARD',
                    style: pw.TextStyle(
                      fontSize: 20,
                      fontWeight: pw.FontWeight.bold,
                      color: dark,
                    ),
                  ),
                  pw.Text(
                    'Workshop work order',
                    style: pw.TextStyle(fontSize: 10, color: muted),
                  ),
                  pw.Text(
                    jobCard.jobCardNumber,
                    style: pw.TextStyle(
                      fontSize: 11,
                      fontWeight: pw.FontWeight.bold,
                      color: dark,
                    ),
                  ),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 8),
          pw.Container(height: 2, color: accent),
          pw.SizedBox(height: 12),
          pw.Table(
            border: pw.TableBorder.all(color: border, width: 0.6),
            columnWidths: {
              0: const pw.FlexColumnWidth(1.2),
              1: const pw.FlexColumnWidth(3),
              2: const pw.FlexColumnWidth(1.4),
              3: const pw.FlexColumnWidth(3),
            },
            children: [
              pw.TableRow(
                children: [
                  label('Date'),
                  value(
                    jobCard.createdAt == null
                        ? ''
                        : DateFormat('dd-MM-yyyy').format(jobCard.createdAt!),
                  ),
                  label('Customer'),
                  value(jobCard.customer.name),
                ],
              ),
              pw.TableRow(
                children: [
                  label('Phone'),
                  value(phone),
                  label('Vehicle No'),
                  value(vehicle.registrationNumber),
                ],
              ),
              pw.TableRow(
                children: [
                  label('Model'),
                  value(modelLine),
                  pw.SizedBox(),
                  pw.SizedBox(),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Text(
            'Jobs to be done',
            style: pw.TextStyle(
              fontSize: 12,
              fontWeight: pw.FontWeight.bold,
              color: dark,
            ),
          ),
          pw.SizedBox(height: 6),
          pw.Table(
            border: pw.TableBorder.all(color: border, width: 0.6),
            columnWidths: {
              0: const pw.FixedColumnWidth(28),
              1: const pw.FlexColumnWidth(6),
              2: const pw.FixedColumnWidth(36),
              3: const pw.FixedColumnWidth(50),
            },
            children: [
              pw.TableRow(
                decoration: pw.BoxDecoration(color: headerBg),
                children: [
                  cell('#', bold: true, align: pw.TextAlign.center),
                  cell('Service', bold: true),
                  cell('Qty', bold: true, align: pw.TextAlign.center),
                  cell('Done', bold: true, align: pw.TextAlign.center),
                ],
              ),
              if (jobCard.services.isEmpty)
                pw.TableRow(
                  children: [
                    pw.SizedBox(),
                    cell('No services specified for this job card.'),
                    pw.SizedBox(),
                    pw.SizedBox(),
                  ],
                )
              else
                for (var i = 0; i < jobCard.services.length; i++)
                  pw.TableRow(
                    children: [
                      cell('${i + 1}', align: pw.TextAlign.center),
                      cell(jobCard.services[i].serviceName),
                      cell(
                        '${jobCard.services[i].quantity}',
                        align: pw.TextAlign.center,
                      ),
                      // Left empty so the technician can tick it on paper.
                      pw.SizedBox(height: 22),
                    ],
                  ),
            ],
          ),
          if (notes.isNotEmpty) ...[
            pw.SizedBox(height: 14),
            pw.Text(
              'Customer notes / remarks:',
              style: pw.TextStyle(
                fontSize: 10,
                fontWeight: pw.FontWeight.bold,
                color: muted,
              ),
            ),
            pw.SizedBox(height: 3),
            pw.Text(notes, style: pw.TextStyle(fontSize: 10, color: dark)),
          ],
          pw.SizedBox(height: 48),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              _signature('Customer signature', border, muted),
              _signature('Authorised signature', border, muted),
            ],
          ),
        ],
      ),
    );

    return doc.save();
  }

  static pw.Widget _signature(
    String text,
    PdfColor lineColor,
    PdfColor textColor,
  ) {
    return pw.SizedBox(
      width: 180,
      child: pw.Column(
        children: [
          pw.Container(height: 0.8, color: lineColor),
          pw.SizedBox(height: 3),
          pw.Text(text, style: pw.TextStyle(fontSize: 9, color: textColor)),
        ],
      ),
    );
  }
}
