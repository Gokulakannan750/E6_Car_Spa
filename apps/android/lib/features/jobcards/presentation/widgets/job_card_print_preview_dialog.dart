import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdf/pdf.dart';
import 'package:printing/printing.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../invoices/presentation/widgets/invoice_print_preview_dialog.dart';
import '../../../settings/providers/settings_provider.dart';
import '../../../settings/providers/settings_state.dart';
import '../../models/job_card_model.dart';
import '../../services/job_card_pdf_generator.dart';

/// Preview of the job card work order, with a print button.
class JobCardPrintPreviewDialog extends ConsumerWidget {
  final JobCard jobCard;

  const JobCardPrintPreviewDialog({super.key, required this.jobCard});

  static Future<void> show(BuildContext context, {required JobCard jobCard}) {
    return showDialog<void>(
      context: context,
      useSafeArea: true,
      builder: (_) =>
          Dialog.fullscreen(child: JobCardPrintPreviewDialog(jobCard: jobCard)),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsNotifierProvider);
    final profile = settings is SettingsLoaded ? settings.profile : null;
    final fileName = 'JobCard_${jobCard.jobCardNumber}.pdf';

    Future<Uint8List> build(PdfPageFormat format) async {
      final logo = await InvoicePrintPreviewDialog.loadLogoBytes(
        profile?.logoPath,
        profile?.updatedAt,
      );
      return JobCardPdfGenerator.generate(
        jobCard: jobCard,
        businessProfile: profile,
        logoBytes: logo,
        format: format,
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'Job Card ${jobCard.jobCardNumber}',
          style: AppTextStyles.headingSmall.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        backgroundColor: AppColors.card,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: AppColors.textPrimary),
          tooltip: 'Close Preview',
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            key: const Key('job_card_print_button'),
            icon: Icon(Icons.print_outlined, color: AppColors.primary),
            tooltip: 'Print job card',
            onPressed: () async {
              final bytes = await build(PdfPageFormat.a4);
              await Printing.layoutPdf(
                onLayout: (_) async => bytes,
                name: fileName,
              );
            },
          ),
        ],
      ),
      body: PdfPreview(
        maxPageWidth: 700,
        canChangeOrientation: false,
        canChangePageFormat: false,
        canDebug: false,
        dynamicLayout: false,
        pdfFileName: fileName,
        build: build,
      ),
    );
  }
}
