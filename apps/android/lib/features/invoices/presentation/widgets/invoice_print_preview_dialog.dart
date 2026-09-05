import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_business_logo.dart';
import '../../../settings/models/business_profile_model.dart';
import '../../../settings/providers/settings_provider.dart';
import '../../../settings/providers/settings_state.dart';
import '../../models/invoice_model.dart';
import '../../services/invoice_pdf_generator.dart';

class InvoicePrintPreviewDialog extends ConsumerWidget {
  final Invoice invoice;
  final BusinessProfileModel? businessProfile;

  const InvoicePrintPreviewDialog({
    super.key,
    required this.invoice,
    this.businessProfile,
  });

  static Future<void> show(
    BuildContext context, {
    required Invoice invoice,
  }) async {
    await showDialog<void>(
      context: context,
      useSafeArea: true,
      builder: (ctx) => Dialog.fullscreen(
        child: InvoicePrintPreviewDialog(invoice: invoice),
      ),
    );
  }

  static Future<Uint8List?> _loadLogoBytes(String? logoPath, DateTime? updatedAt) async {
    final resolvedUrl = AppBusinessLogo.resolveLogoUrl(logoPath, updatedAt);
    if (resolvedUrl == null || resolvedUrl.isEmpty) return null;
    try {
      final dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 4),
          receiveTimeout: const Duration(seconds: 4),
        ),
      );
      final response = await dio.get<List<int>>(
        resolvedUrl,
        options: Options(responseType: ResponseType.bytes),
      );
      if (response.data != null) {
        return Uint8List.fromList(response.data!);
      }
    } catch (_) {
      // Fallback cleanly on network error or missing file
    }
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsState = ref.watch(settingsNotifierProvider);
    final profile = businessProfile ??
        (settingsState is SettingsLoaded ? settingsState.profile : null);

    final invoiceNumber = invoice.invoiceNumber ?? (invoice.isDraft ? 'DRAFT' : 'INVOICE');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'Invoice Preview ($invoiceNumber)',
          style: AppTextStyles.headingSmall.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        backgroundColor: AppColors.card,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Close Preview',
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.print_outlined, color: AppColors.primary),
            tooltip: 'Print Invoice',
            onPressed: () async {
              final logoBytes = await _loadLogoBytes(profile?.logoPath, profile?.updatedAt);
              final pdfBytes = await InvoicePdfGenerator.generateInvoicePdf(
                invoice: invoice,
                businessProfile: profile,
                logoBytes: logoBytes,
              );
              await Printing.layoutPdf(
                onLayout: (format) async => pdfBytes,
                name: 'Invoice_${invoice.invoiceNumber ?? invoice.id}.pdf',
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
        pdfFileName: 'Invoice_${invoice.invoiceNumber ?? invoice.id}.pdf',
        build: (format) async {
          final logoBytes = await _loadLogoBytes(profile?.logoPath, profile?.updatedAt);
          return await InvoicePdfGenerator.generateInvoicePdf(
            invoice: invoice,
            businessProfile: profile,
            logoBytes: logoBytes,
            format: format,
          );
        },
      ),
    );
  }
}
