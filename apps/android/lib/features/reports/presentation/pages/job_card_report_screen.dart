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

class JobCardReportScreen extends ConsumerWidget {
  const JobCardReportScreen({super.key});

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
    final jobCardsAsync = ref.watch(jobCardsReportProvider);

    return AppScreenScaffold(
      title: 'Job Cards Operations Report',
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(jobCardsReportProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ReportDateFilter(),
              const SizedBox(height: 16),

              jobCardsAsync.when(
                loading: () => const AppLoadingState(message: 'Loading job card operations...'),
                error: (error, _) => AppErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(jobCardsReportProvider),
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
                              'TOTAL JOB CARDS WORKLOAD',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${summary.totalCount} Job Cards',
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
                                _buildSummaryItem('Completed', summary.completedCount.toString(), color: AppColors.success),
                                _buildSummaryItem('In Progress', summary.inProgressCount.toString(), color: AppColors.primaryLight),
                                _buildSummaryItem('Draft', summary.draftCount.toString(), color: AppColors.warning),
                                _buildSummaryItem('Cancelled', summary.cancelledCount.toString(), color: AppColors.error),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                _buildSummaryItem('Invoiced', summary.invoicedCount.toString()),
                                _buildSummaryItem('Estimated Revenue', _formatCurrency(summary.totalRevenue)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Job Cards List
                      Text(
                        'Operational Job Cards (${report.totalCount})',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 10),

                      if (items.isEmpty)
                        const AppEmptyState(
                          title: 'No job cards found',
                          message: 'No job cards created in the selected date range.',
                          icon: Icons.directions_car_outlined,
                        )
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: items.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final jc = items[index];
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
                                        jc.jobCardNumber,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                      StatusBadge.fromLabel(jc.status.label),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${jc.customerName} • ${jc.vehicleRegistration}',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  if (jc.vehicleDetails.isNotEmpty)
                                    Text(
                                      jc.vehicleDetails,
                                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                    ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${dateFormat.format(jc.date)} • ${jc.customerPhone}',
                                    style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
                                  ),
                                  const SizedBox(height: 8),
                                  const Divider(color: AppColors.border, height: 1),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        jc.invoiceNumber != null ? 'Invoice: ${jc.invoiceNumber}' : 'Uninvoiced',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                          color: jc.invoiceNumber != null ? AppColors.success : AppColors.textTertiary,
                                        ),
                                      ),
                                      Text(
                                        _formatCurrency(jc.totalAmount),
                                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
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
