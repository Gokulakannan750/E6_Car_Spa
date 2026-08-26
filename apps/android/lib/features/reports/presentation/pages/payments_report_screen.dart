import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../providers/reports_provider.dart';
import '../widgets/report_date_filter.dart';

class PaymentsReportScreen extends ConsumerWidget {
  const PaymentsReportScreen({super.key});

  String _formatCurrency(double value) {
    final formatter = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    );
    return formatter.format(value);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentsAsync = ref.watch(paymentsReportProvider);

    return AppScreenScaffold(
      title: 'Payment Collection Report',
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(paymentsReportProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ReportDateFilter(),
              const SizedBox(height: 16),

              paymentsAsync.when(
                loading: () => const AppLoadingState(message: 'Loading payment collections...'),
                error: (error, _) => AppErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(paymentsReportProvider),
                ),
                data: (report) {
                  final summary = report.summary;
                  final items = report.items;

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Executive Summary
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer,
                          borderRadius: BorderRadius.circular(AppTheme.radiusLG),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'TOTAL COLLECTIONS RECEIVED',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _formatCurrency(summary.totalCollected),
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                color: AppColors.success,
                              ),
                            ),
                            const SizedBox(height: 12),
                            const Divider(color: Color(0xFF1E293B), height: 1),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                _buildSummaryItem('Cash', _formatCurrency(summary.cashAmount)),
                                _buildSummaryItem('UPI', _formatCurrency(summary.upiAmount)),
                                _buildSummaryItem('Card', _formatCurrency(summary.cardAmount)),
                                _buildSummaryItem('Bank', _formatCurrency(summary.bankTransferAmount)),
                              ],
                            ),
                            if (summary.voidedTransactionCount > 0) ...[
                              const SizedBox(height: 8),
                              Text(
                                '${summary.voidedTransactionCount} voided payments excluded (${_formatCurrency(summary.voidedAmount)})',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFFFCA5A5), // Red-300
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Transactions List
                      Text(
                        'Transactions (${report.totalCount})',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 10),

                      if (items.isEmpty)
                        const AppEmptyState(
                          title: 'No payments found',
                          message: 'No payment transactions recorded in this date range.',
                          icon: Icons.payments_outlined,
                        )
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: items.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final p = items[index];
                            final dateFormat = DateFormat('dd MMM yyyy, hh:mm a');

                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.card,
                                borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                                border: Border.all(
                                  color: p.isVoided ? AppColors.error.withValues(alpha: 0.3) : AppColors.border,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: p.isVoided
                                          ? AppColors.error.withValues(alpha: 0.1)
                                          : AppColors.success.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                                    ),
                                    child: Icon(
                                      p.isVoided ? Icons.block : Icons.check_circle_outline,
                                      color: p.isVoided ? AppColors.error : AppColors.success,
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Text(
                                              p.paymentMethod,
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                                color: p.isVoided ? AppColors.textTertiary : AppColors.textPrimary,
                                                decoration: p.isVoided ? TextDecoration.lineThrough : null,
                                              ),
                                            ),
                                            if (p.isVoided) ...[
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                                decoration: BoxDecoration(
                                                  color: AppColors.error.withValues(alpha: 0.1),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: const Text(
                                                  'VOIDED',
                                                  style: TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.w700,
                                                    color: AppColors.error,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${p.customerName} • ${p.invoiceNumber ?? 'Draft Invoice'}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          dateFormat.format(p.paymentDate),
                                          style: const TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w500,
                                            color: AppColors.textTertiary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    _formatCurrency(p.amount),
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: p.isVoided ? AppColors.textTertiary : AppColors.success,
                                      decoration: p.isVoided ? TextDecoration.lineThrough : null,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ],
    );
  }
}
