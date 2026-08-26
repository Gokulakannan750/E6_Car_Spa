import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../providers/reports_provider.dart';
import '../widgets/report_date_filter.dart';

class SalesReportScreen extends ConsumerWidget {
  const SalesReportScreen({super.key});

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
    final salesAsync = ref.watch(salesReportProvider);

    return AppScreenScaffold(
      title: 'Sales Revenue Report',
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(salesReportProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ReportDateFilter(),
              const SizedBox(height: 16),

              salesAsync.when(
                loading: () => const AppLoadingState(message: 'Loading sales report...'),
                error: (error, _) => AppErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(salesReportProvider),
                ),
                data: (report) {
                  final summary = report.summary;
                  final items = report.items;

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Executive Summary Card
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
                              'TOTAL SALES REVENUE',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _formatCurrency(summary.totalAmount),
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 12),
                            const Divider(color: Color(0xFF1E293B), height: 1),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                _buildSummaryItem('Invoices', summary.invoiceCount.toString()),
                                _buildSummaryItem('Collected', _formatCurrency(summary.totalPaid), color: AppColors.success),
                                _buildSummaryItem('Balance', _formatCurrency(summary.totalBalance), color: AppColors.warning),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                _buildSummaryItem('Subtotal', _formatCurrency(summary.totalSubtotal)),
                                _buildSummaryItem('Discount', _formatCurrency(summary.totalDiscount)),
                                _buildSummaryItem('GST', _formatCurrency(summary.totalGst)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Invoices List Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Finalized Invoices (${report.totalCount})',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      if (items.isEmpty)
                        const AppEmptyState(
                          title: 'No sales found',
                          message: 'No finalized invoices found in the selected date range.',
                          icon: Icons.receipt_long_outlined,
                        )
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: items.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final inv = items[index];
                            final dateFormat = DateFormat('dd MMM yyyy');

                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.card,
                                borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        inv.invoiceNumber ?? 'Draft',
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                      StatusBadge.fromLabel(inv.status.label),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${inv.customerName} • ${inv.registrationNumber}',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${dateFormat.format(inv.invoiceDate)} • ${inv.customerPhone}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                      color: AppColors.textTertiary,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  const Divider(color: AppColors.border, height: 1),
                                  const SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'Total Amount',
                                            style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
                                          ),
                                          Text(
                                            _formatCurrency(inv.totalAmount),
                                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                                          ),
                                        ],
                                      ),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          const Text(
                                            'Paid / Balance',
                                            style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
                                          ),
                                          Text(
                                            '${_formatCurrency(inv.paidAmount)} / ${_formatCurrency(inv.balanceAmount)}',
                                            style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                              color: inv.balanceAmount > 0 ? AppColors.warning : AppColors.success,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
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

  Widget _buildSummaryItem(String label, String value, {Color? color}) {
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
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: color ?? Colors.white,
          ),
        ),
      ],
    );
  }
}
