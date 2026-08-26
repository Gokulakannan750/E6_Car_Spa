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

class OutstandingInvoicesScreen extends ConsumerWidget {
  const OutstandingInvoicesScreen({super.key});

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
    final outstandingAsync = ref.watch(outstandingInvoicesProvider);

    return AppScreenScaffold(
      title: 'Outstanding Invoices & Ageing',
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(outstandingInvoicesProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ReportDateFilter(),
              const SizedBox(height: 16),

              outstandingAsync.when(
                loading: () => const AppLoadingState(message: 'Loading outstanding invoices...'),
                error: (error, _) => AppErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(outstandingInvoicesProvider),
                ),
                data: (report) {
                  final summary = report.summary;
                  final items = report.items;

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // KPI Summary Card
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
                              'TOTAL OUTSTANDING BALANCE',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _formatCurrency(summary.totalOutstandingAmount),
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                color: AppColors.warning,
                              ),
                            ),
                            const SizedBox(height: 12),
                            const Divider(color: Color(0xFF1E293B), height: 1),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                _buildSummaryItem('Unpaid Invoices', summary.invoiceCount.toString()),
                                _buildSummaryItem('Total Invoiced', _formatCurrency(summary.totalInvoiceAmount)),
                                _buildSummaryItem('Total Paid', _formatCurrency(summary.totalPaidAmount), color: AppColors.success),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Invoices List
                      Text(
                        'Overdue & Pending Invoices (${report.totalCount})',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 10),

                      if (items.isEmpty)
                        const AppEmptyState(
                          title: 'Zero outstanding receivables',
                          message: 'All customer invoices in this date range are fully settled.',
                          icon: Icons.check_circle_outline,
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
                                        inv.invoiceNumber ?? 'Invoice',
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: inv.ageInDays > 30
                                              ? AppColors.error.withValues(alpha: 0.1)
                                              : AppColors.warning.withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                                        ),
                                        child: Text(
                                          '${inv.ageInDays} days old',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: inv.ageInDays > 30 ? AppColors.error : AppColors.warning,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${inv.customerName} • ${inv.vehicleRegistration}',
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
                                            'Total Billed',
                                            style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
                                          ),
                                          Text(
                                            _formatCurrency(inv.totalAmount),
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                          ),
                                        ],
                                      ),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.center,
                                        children: [
                                          const Text(
                                            'Paid',
                                            style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
                                          ),
                                          Text(
                                            _formatCurrency(inv.paidAmount),
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.success),
                                          ),
                                        ],
                                      ),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          const Text(
                                            'Outstanding',
                                            style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
                                          ),
                                          Text(
                                            _formatCurrency(inv.balanceAmount),
                                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.warning),
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
