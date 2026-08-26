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

class ShowroomReportScreen extends ConsumerWidget {
  const ShowroomReportScreen({super.key});

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
    final showroomAsync = ref.watch(showroomReportProvider);

    return AppScreenScaffold(
      title: 'Showroom Daily Billing & Staff Report',
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(showroomReportProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ReportDateFilter(),
              const SizedBox(height: 16),

              showroomAsync.when(
                loading: () => const AppLoadingState(message: 'Loading showroom reports...'),
                error: (error, _) => AppErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(showroomReportProvider),
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
                              'SHOWROOM TOTAL BILLED',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _formatCurrency(summary.totalBilled),
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
                                _buildSummaryItem('Collections', _formatCurrency(summary.totalReceived), color: AppColors.success),
                                _buildSummaryItem('Outstanding', _formatCurrency(summary.totalOutstanding), color: AppColors.warning),
                                _buildSummaryItem('Vehicles', summary.totalVehiclesAttended.toString()),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                _buildSummaryItem('Assignments', summary.totalAssignments.toString()),
                                _buildSummaryItem('Paid Days', summary.paidDaysCount.toString(), color: AppColors.success),
                                _buildSummaryItem('Unpaid Days', summary.unpaidDaysCount.toString(), color: AppColors.error),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Showroom Daily Records
                      Text(
                        'Showroom Daily Logs (${report.totalCount})',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 10),

                      if (items.isEmpty)
                        const AppEmptyState(
                          title: 'No showroom records found',
                          message: 'No showroom activity recorded in this date range.',
                          icon: Icons.storefront_outlined,
                        )
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: items.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final row = items[index];
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
                                        row.showroomName,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: row.paymentStatus.toLowerCase() == 'paid'
                                              ? AppColors.success.withValues(alpha: 0.1)
                                              : (row.paymentStatus.toLowerCase() == 'partiallypaid'
                                                  ? AppColors.warning.withValues(alpha: 0.1)
                                                  : AppColors.error.withValues(alpha: 0.1)),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          row.paymentStatus,
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: row.paymentStatus.toLowerCase() == 'paid'
                                                ? AppColors.success
                                                : (row.paymentStatus.toLowerCase() == 'partiallypaid'
                                                    ? AppColors.warning
                                                    : AppColors.error),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${dateFormat.format(row.date)} • ${row.staffCount} Staff Assigned • ${row.vehiclesAttended} Vehicles',
                                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                  ),
                                  const SizedBox(height: 8),
                                  const Divider(color: AppColors.border, height: 1),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Billed: ${_formatCurrency(row.billedAmount)}',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                                      ),
                                      Text(
                                        'Recv: ${_formatCurrency(row.receivedAmount)}',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.success),
                                      ),
                                      Text(
                                        'Bal: ${_formatCurrency(row.balanceAmount)}',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.warning),
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
