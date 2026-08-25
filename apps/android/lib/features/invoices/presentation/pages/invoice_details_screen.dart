import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../models/invoice_model.dart';
import '../../providers/invoice_providers.dart';
import '../widgets/edit_draft_bottom_sheet.dart';
import '../widgets/record_payment_bottom_sheet.dart';

class InvoiceDetailsScreen extends ConsumerStatefulWidget {
  final String invoiceId;

  const InvoiceDetailsScreen({
    super.key,
    required this.invoiceId,
  });

  @override
  ConsumerState<InvoiceDetailsScreen> createState() => _InvoiceDetailsScreenState();
}

class _InvoiceDetailsScreenState extends ConsumerState<InvoiceDetailsScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(invoiceDetailsProvider(widget.invoiceId));
    final notifier = ref.read(invoiceDetailsProvider(widget.invoiceId).notifier);

    // Listen for feedback messages
    ref.listen<InvoiceDetailsState>(
      invoiceDetailsProvider(widget.invoiceId),
      (prev, next) {
        if (next.actionSuccessMessage != null && prev?.actionSuccessMessage != next.actionSuccessMessage) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(next.actionSuccessMessage!),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        if (next.errorMessage != null && prev?.errorMessage != next.errorMessage && next.invoice != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(next.errorMessage!),
              backgroundColor: AppColors.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          state.invoice?.invoiceNumber ?? 'Invoice Details',
          style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/quotations-invoices'),
        ),
        actions: [
          if (state.invoice != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: StatusBadge.fromLabel(state.invoice!.status.label),
              ),
            ),
        ],
      ),
      body: _buildBody(context, state, notifier),
      bottomNavigationBar: state.invoice != null ? _buildBottomActions(context, state.invoice!, notifier, state) : null,
    );
  }

  Widget _buildBody(
    BuildContext context,
    InvoiceDetailsState state,
    InvoiceDetailsNotifier notifier,
  ) {
    if (state.isLoading) {
      return const AppLoadingState(message: 'Loading invoice details...');
    }

    if (state.errorMessage != null && state.invoice == null) {
      return AppErrorState(
        message: state.errorMessage ?? 'Invoice not found.',
        onRetry: () => notifier.loadDetails(),
      );
    }

    final invoice = state.invoice!;

    return RefreshIndicator(
      onRefresh: () => notifier.loadDetails(),
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Status Banner (Draft vs Finalized vs Cancelled) ─────────────
            _buildStatusBanner(invoice),
            const SizedBox(height: 16),

            // ── Customer & Vehicle Card ─────────────────────────────────────
            _buildCustomerVehicleCard(invoice),
            const SizedBox(height: 16),

            // ── Job Card Link Bar ───────────────────────────────────────────
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.assignment_outlined, size: 18, color: AppColors.textSecondary),
                      const SizedBox(width: 8),
                      const Text(
                        'Job Card:',
                        style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        invoice.jobCardNumber,
                        style: const TextStyle(
                          fontSize: 13,
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  TextButton(
                    onPressed: () {
                      context.go('/job-cards/${invoice.jobCardId}');
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('View JC', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Service Line Items Section ──────────────────────────────────
            Text(
              'Service Items & Charges (${invoice.items.length})',
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
                itemCount: invoice.items.length,
                separatorBuilder: (_, _) => const Divider(height: 16, color: AppColors.borderLight),
                itemBuilder: (context, index) {
                  final item = invoice.items[index];
                  final lineTotal = item.unitPrice * item.quantity;
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.description,
                              style: AppTextStyles.headingSmall,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '₹${item.unitPrice.toStringAsFixed(2)} × ${item.quantity}',
                              style: AppTextStyles.bodySmall.copyWith(fontFamily: 'monospace'),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '₹${lineTotal.toStringAsFixed(2)}',
                        style: AppTextStyles.headingSmall.copyWith(
                          fontWeight: FontWeight.w700,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 16),

            // ── Financial Breakdown Summary ─────────────────────────────────
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
                    _buildSummaryRow('Subtotal', '₹${invoice.subtotal.toStringAsFixed(2)}'),
                    if (invoice.discount > 0) ...[
                      const SizedBox(height: 8),
                      _buildSummaryRow(
                        'Discount',
                        '-₹${invoice.discount.toStringAsFixed(2)}',
                        isNegative: true,
                      ),
                    ],
                    const SizedBox(height: 8),
                    if (invoice.isGstEnabled) ...[
                      _buildSummaryRow(
                        'CGST (9%)',
                        '₹${((invoice.gstAmount / 2 * 100).round() / 100).toStringAsFixed(2)}',
                      ),
                      const SizedBox(height: 8),
                      _buildSummaryRow(
                        'SGST (9%)',
                        '₹${((invoice.gstAmount / 2 * 100).round() / 100).toStringAsFixed(2)}',
                      ),
                    ] else
                      _buildSummaryRow('GST (Disabled)', '₹0.00'),
                    const Divider(height: 20, color: AppColors.borderLight),
                    _buildSummaryRow(
                      'Grand Total',
                      '₹${invoice.totalAmount.toStringAsFixed(2)}',
                      isBold: true,
                    ),
                    if (invoice.paidAmount > 0) ...[
                      const SizedBox(height: 8),
                      _buildSummaryRow(
                        'Paid Amount',
                        '₹${invoice.paidAmount.toStringAsFixed(2)}',
                        color: AppColors.success,
                      ),
                    ],
                    const SizedBox(height: 8),
                    _buildSummaryRow(
                      'Balance Due',
                      '₹${invoice.balanceAmount.toStringAsFixed(2)}',
                      isBold: true,
                      color: invoice.balanceAmount > 0 ? AppColors.error : AppColors.success,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Notes Section (if any) ──────────────────────────────────────
            if (invoice.notes != null && invoice.notes!.trim().isNotEmpty) ...[
              Text(
                'Notes & Terms',
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
                  invoice.notes!,
                  style: AppTextStyles.bodyMedium,
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── Payment History Section (Finalized Invoices) ────────────────
            if (invoice.isFinalized) ...[
              Text(
                'Payment History (${invoice.payments.length})',
                style: AppTextStyles.headingMedium,
              ),
              const SizedBox(height: 8),
              if (invoice.payments.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Text(
                    'No payments recorded yet for this invoice.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                )
              else
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
                    itemCount: invoice.payments.length,
                    separatorBuilder: (_, _) => const Divider(height: 16, color: AppColors.borderLight),
                    itemBuilder: (context, index) {
                      final payment = invoice.payments[index];
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceAlt,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              payment.method.icon,
                              size: 18,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  payment.method.label,
                                  style: AppTextStyles.headingSmall,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _formatDate(payment.paymentDate),
                                  style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                                ),
                                if (payment.reference != null && payment.reference!.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    'Ref: ${payment.reference}',
                                    style: AppTextStyles.bodySmall.copyWith(
                                      fontFamily: 'monospace',
                                      color: AppColors.textSecondary,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Text(
                            '₹${payment.amount.toStringAsFixed(2)}',
                            style: AppTextStyles.headingSmall.copyWith(
                              fontWeight: FontWeight.w700,
                              fontFamily: 'monospace',
                              color: AppColors.success,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBanner(Invoice invoice) {
    if (invoice.isDraft) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.warning.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
        ),
        child: const Row(
          children: [
            Icon(Icons.edit_document, size: 20, color: AppColors.warning),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Draft Invoice: Not yet finalized. Official invoice number will be issued when generated.',
                style: TextStyle(color: AppColors.warning, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
    }

    if (invoice.isCancelled) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
        ),
        child: const Row(
          children: [
            Icon(Icons.cancel_outlined, size: 20, color: AppColors.error),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'This invoice has been Cancelled. No further payments or edits permitted.',
                style: TextStyle(color: AppColors.error, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primaryContainer.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_outline, size: 20, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Invoice Finalized: Locked against edits. Official #${invoice.invoiceNumber ?? ""} issued.',
              style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerVehicleCard(Invoice invoice) {
    return Card(
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
                        invoice.customerName,
                        style: AppTextStyles.headingMedium,
                      ),
                      Text(
                        invoice.customerPhone,
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
                        invoice.registrationNumber,
                        style: AppTextStyles.headingMedium.copyWith(
                          fontWeight: FontWeight.w700,
                          fontFamily: 'monospace',
                        ),
                      ),
                      Text(
                        invoice.vehicleDisplayName,
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
    );
  }

  Widget _buildSummaryRow(
    String label,
    String value, {
    bool isBold = false,
    bool isNegative = false,
    Color? color,
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
              ? AppTextStyles.displaySmall.copyWith(
                  fontWeight: FontWeight.w800,
                  color: color ?? AppColors.primary,
                  fontFamily: 'monospace',
                )
              : AppTextStyles.bodyMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  fontFamily: 'monospace',
                  color: color ?? (isNegative ? AppColors.error : AppColors.textPrimary),
                ),
        ),
      ],
    );
  }

  Widget _buildBottomActions(
    BuildContext context,
    Invoice invoice,
    InvoiceDetailsNotifier notifier,
    InvoiceDetailsState state,
  ) {
    if (invoice.isDraft) {
      return SafeArea(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Edit Draft'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.primary),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () {
                    EditDraftBottomSheet.show(
                      context,
                      invoice: invoice,
                      onSave: notifier.updateDraft,
                    );
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppButton(
                  label: 'Generate',
                  icon: Icons.auto_awesome_rounded,
                  isLoading: state.isGenerating,
                  onPressed: () => _confirmGenerate(context, invoice, notifier),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (invoice.isFinalized && invoice.balanceAmount > 0) {
      return SafeArea(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: AppButton(
            label: 'Record Payment (₹${invoice.balanceAmount.toStringAsFixed(2)})',
            icon: Icons.payments_outlined,
            isLoading: state.isRecordingPayment,
            onPressed: () {
              RecordPaymentBottomSheet.show(
                context,
                balanceAmount: invoice.balanceAmount,
                onRecordPayment: notifier.recordPayment,
              );
            },
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Future<void> _confirmGenerate(
    BuildContext context,
    Invoice invoice,
    InvoiceDetailsNotifier notifier,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Generate Invoice?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Once generated, this invoice will be finalized and locked against further edits. An official invoice number will be issued.',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
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
                  const Text('Grand Total:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  Text(
                    '₹${invoice.totalAmount.toStringAsFixed(2)}',
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
            child: const Text('Generate Invoice'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await notifier.generateInvoice();
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}
