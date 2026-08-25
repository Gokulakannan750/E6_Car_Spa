import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../invoices/data/invoice_repository.dart';
import '../../../invoices/providers/invoice_providers.dart';
import '../../models/job_card_model.dart';
import '../../providers/job_card_providers.dart';

class JobCardDetailsScreen extends ConsumerStatefulWidget {
  final String jobCardId;

  const JobCardDetailsScreen({
    super.key,
    required this.jobCardId,
  });

  @override
  ConsumerState<JobCardDetailsScreen> createState() => _JobCardDetailsScreenState();
}

class _JobCardDetailsScreenState extends ConsumerState<JobCardDetailsScreen> {
  bool _isConverting = false;

  Future<void> _handleConvertToInvoice(JobCard jc) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Convert to Invoice?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'A new Draft Invoice will be created for Job Card ${jc.jobCardNumber}. All services and customer details will be transferred.',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Amount:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  Text(
                    '₹${jc.totalAmount.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontFamily: 'monospace',
                      color: AppColors.primary,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Convert'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isConverting = true);

    try {
      final invoice = await ref.read(invoiceRepositoryProvider).createFromJobCard(jc.id);

      if (!mounted) return;

      ref.read(invoiceListProvider.notifier).loadInvoices();
      ref.read(jobCardDetailsProvider(widget.jobCardId).notifier).loadDetails();
      ref.read(jobCardListProvider.notifier).loadJobCards();

      context.go('/quotations-invoices/${invoice.id}');
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      ref.read(jobCardDetailsProvider(widget.jobCardId).notifier).loadDetails();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to convert job card to invoice.'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isConverting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(jobCardDetailsProvider(widget.jobCardId));
    final notifier = ref.read(jobCardDetailsProvider(widget.jobCardId).notifier);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          state.jobCard?.jobCardNumber ?? 'Job Card Details',
          style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/job-cards'),
        ),
        actions: [
          if (state.jobCard != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: StatusBadge.fromLabel(state.jobCard!.status.label),
              ),
            ),
        ],
      ),
      body: _buildBody(context, state, notifier),
      bottomNavigationBar: state.jobCard != null ? _buildBottomBar(context, state.jobCard!) : null,
    );
  }

  Widget? _buildBottomBar(BuildContext context, JobCard jc) {
    final hasInvoice = jc.invoiceId != null && jc.invoiceId!.trim().isNotEmpty;
    final isCancelled = jc.status == JobCardStatus.cancelled;

    if (hasInvoice) {
      return SafeArea(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: AppButton(
            label: jc.invoiceNumber != null && jc.invoiceNumber!.isNotEmpty
                ? 'View Invoice (#${jc.invoiceNumber})'
                : 'View Draft Invoice',
            icon: Icons.receipt_long_rounded,
            onPressed: () {
              context.go('/quotations-invoices/${jc.invoiceId}');
            },
          ),
        ),
      );
    }

    if (!isCancelled) {
      return SafeArea(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: AppButton(
            label: 'Convert to Invoice',
            icon: Icons.receipt_outlined,
            isLoading: _isConverting,
            onPressed: () => _handleConvertToInvoice(jc),
          ),
        ),
      );
    }

    return null;
  }

  Widget _buildBody(
    BuildContext context,
    JobCardDetailsState state,
    JobCardDetailsNotifier notifier,
  ) {
    if (state.isLoading) {
      return const AppLoadingState(message: 'Loading Job Card details...');
    }

    if (state.errorMessage != null || state.jobCard == null) {
      return AppErrorState(
        message: state.errorMessage ?? 'Job Card not found.',
        onRetry: () => notifier.loadDetails(),
      );
    }

    final jc = state.jobCard!;

    return RefreshIndicator(
      onRefresh: () => notifier.loadDetails(),
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Customer & Vehicle Card ─────────────────────────────────────
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.border, width: 1),
              ),
              color: AppColors.card,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    // Customer
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.primaryContainer,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.person, color: AppColors.textOnPrimary, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                jc.customer.name,
                                style: AppTextStyles.headingMedium,
                              ),
                              Text(
                                jc.customer.phoneNumber,
                                style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 20, color: AppColors.borderLight),
                    // Vehicle
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceAlt,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.directions_car, color: AppColors.textPrimary, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                jc.vehicle.registrationNumber,
                                style: AppTextStyles.headingMedium.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontFamily: 'monospace',
                                ),
                              ),
                              Text(
                                jc.vehicle.displayName,
                                style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Services Section ────────────────────────────────────────────
            Text(
              'Services & Line Items (${jc.services.length})',
              style: AppTextStyles.headingMedium,
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.border, width: 1),
              ),
              color: AppColors.card,
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.all(12),
                itemCount: jc.services.length,
                separatorBuilder: (_, _) => const Divider(height: 16, color: AppColors.borderLight),
                itemBuilder: (context, index) {
                  final svc = jc.services[index];
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              svc.serviceName,
                              style: AppTextStyles.headingSmall,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '₹${svc.unitPrice.toStringAsFixed(2)} × ${svc.quantity}'
                              '${svc.discountAmount > 0 ? ' · Disc: -₹${svc.discountAmount.toStringAsFixed(2)}' : ''}'
                              ' · GST: ${svc.taxPercentage.toInt()}%',
                              style: AppTextStyles.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '₹${svc.lineTotal.toStringAsFixed(2)}',
                        style: AppTextStyles.headingSmall.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 16),

            // ── Financial Summary ───────────────────────────────────────────
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.border, width: 1),
              ),
              color: AppColors.card,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildSummaryRow('Subtotal', '₹${jc.subtotal.toStringAsFixed(2)}'),
                    if (jc.discountAmount > 0) ...[
                      const SizedBox(height: 8),
                      _buildSummaryRow(
                        'Discount',
                        '-₹${jc.discountAmount.toStringAsFixed(2)}',
                        isNegative: true,
                      ),
                    ],
                    const SizedBox(height: 8),
                    _buildSummaryRow('Tax (GST)', '₹${jc.taxAmount.toStringAsFixed(2)}'),
                    const Divider(height: 20, color: AppColors.borderLight),
                    _buildSummaryRow(
                      'Total Amount',
                      '₹${jc.totalAmount.toStringAsFixed(2)}',
                      isBold: true,
                    ),
                  ],
                ),
              ),
            ),

            // ── Notes Section (if present) ──────────────────────────────────
            if (jc.notes != null && jc.notes!.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(
                'Notes / Instructions',
                style: AppTextStyles.headingMedium,
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  jc.notes!,
                  style: AppTextStyles.bodyMedium,
                ),
              ),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(
    String label,
    String value, {
    bool isBold = false,
    bool isNegative = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: isBold
              ? AppTextStyles.headingMedium
              : AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        Text(
          value,
          style: isBold
              ? AppTextStyles.displaySmall.copyWith(fontWeight: FontWeight.w800, color: AppColors.primary)
              : AppTextStyles.bodyMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: isNegative ? AppColors.error : AppColors.textPrimary,
                ),
        ),
      ],
    );
  }
}
