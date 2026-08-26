import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../providers/reports_provider.dart';
import '../widgets/job_status_chart.dart';
import '../widgets/report_date_filter.dart';
import '../widgets/report_kpi_card.dart';
import '../widgets/revenue_chart.dart';
import '../widgets/top_services_card.dart';

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  String _formatCurrency(double value) {
    final formatter = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    );
    return formatter.format(value);
  }

  bool _hasPermission(WidgetRef ref, String permission) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return false;
    return user.hasPermission(permission);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(reportsDashboardProvider);

    final canViewReports = _hasPermission(ref, 'reports.view');
    final canViewSales = _hasPermission(ref, 'reports.sales');
    final canViewPayments = _hasPermission(ref, 'reports.payments');
    final canViewInvoices = _hasPermission(ref, 'reports.invoices');
    final canViewGst = _hasPermission(ref, 'reports.gst');
    final canViewJobCards = _hasPermission(ref, 'reports.job_cards');
    final canViewShowrooms = _hasPermission(ref, 'reports.showrooms');
    final canViewProductivity = _hasPermission(ref, 'reports.staff_productivity');
    final canViewAdvances = _hasPermission(ref, 'reports.staff_advances');

    if (!canViewReports) {
      return const AppScreenScaffold(
        title: 'Executive Analytics',
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'You do not have permission to view Reports & Business Analytics.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      );
    }

    return AppScreenScaffold(
      title: 'Reports & Analytics',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
          tooltip: 'Refresh Reports',
          onPressed: () {
            ref.invalidate(reportsDashboardProvider);
          },
        ),
      ],
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(reportsDashboardProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Date Filter Bar
              const ReportDateFilter(),
              const SizedBox(height: 16),

              dashboardAsync.when(
                loading: () => const AppLoadingState(message: 'Loading executive metrics...'),
                error: (error, _) => AppErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(reportsDashboardProvider),
                ),
                data: (dashboard) {
                  final sales = dashboard.sales;
                  final invoiceKpis = dashboard.invoiceKpis;
                  final jobKpis = dashboard.jobCardKpis;
                  final paymentCollection = dashboard.paymentCollection;
                  final showroom = dashboard.showroom;
                  final advances = dashboard.staffAdvances;

                  final billedRevenue = sales.netSales;
                  final collections = paymentCollection.totalReceived;
                  final outstanding = sales.outstanding;
                  final totalInvoices = invoiceKpis.generatedCount + invoiceKpis.partiallyPaidCount + invoiceKpis.paidCount;
                  final avgTicket = totalInvoices > 0 ? billedRevenue / totalInvoices : 0.0;
                  final collectionRate = billedRevenue > 0 ? (collections / billedRevenue) * 100 : 0.0;

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 2. Primary 4 Executive KPI Cards Grid
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 1.25,
                        children: [
                          // Billed Revenue
                          ReportKpiCard(
                            title: 'Billed Revenue',
                            amountValue: billedRevenue,
                            subtitle: '$totalInvoices finalized invoices',
                            icon: Icons.receipt_long,
                            accentColor: AppColors.primary,
                            onTap: canViewSales ? () => context.go('/reports/sales') : null,
                          ),
                          // Collections Received
                          ReportKpiCard(
                            title: 'Collections',
                            amountValue: collections,
                            subtitle: '${collectionRate.toStringAsFixed(1)}% collection rate',
                            icon: Icons.trending_up,
                            accentColor: AppColors.success,
                            onTap: canViewPayments ? () => context.go('/reports/payments') : null,
                          ),
                          // Outstanding Balance
                          ReportKpiCard(
                            title: 'Outstanding',
                            amountValue: outstanding,
                            subtitle: 'Pending receivables',
                            icon: Icons.trending_down,
                            accentColor: AppColors.warning,
                            onTap: canViewInvoices ? () => context.go('/reports/outstanding') : null,
                          ),
                          // Operations & Job Cards
                          ReportKpiCard(
                            title: 'Job Cards',
                            stringValue: '${jobKpis.completedJobCards} / ${jobKpis.totalJobCards}',
                            subtitle: 'Avg Ticket: ${_formatCurrency(avgTicket)}',
                            icon: Icons.directions_car,
                            accentColor: const Color(0xFF0284C7), // Sky Blue
                            onTap: canViewJobCards ? () => context.go('/reports/job-cards') : null,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // 3. Secondary Metrics Banner
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _buildMiniMetric(
                              label: 'Staff Advances',
                              value: _formatCurrency(advances.outstandingAmount),
                              color: AppColors.warning,
                              onTap: canViewAdvances ? () => context.go('/reports/staff-advances') : null,
                            ),
                            Container(width: 1, height: 28, color: AppColors.border),
                            _buildMiniMetric(
                              label: 'Showroom Billed',
                              value: _formatCurrency(showroom.totalBilled),
                              color: AppColors.primary,
                              onTap: canViewShowrooms ? () => context.go('/reports/showrooms') : null,
                            ),
                            Container(width: 1, height: 28, color: AppColors.border),
                            _buildMiniMetric(
                              label: 'Vehicles Serviced',
                              value: '${dashboard.vehicleActivity.vehiclesServiced}',
                              color: AppColors.success,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // 4. Charts Row
                      RevenueChart(
                        sales: sales,
                        paymentCollection: paymentCollection,
                      ),
                      const SizedBox(height: 16),

                      JobStatusChart(
                        jobCardKpis: jobKpis,
                      ),
                      const SizedBox(height: 20),

                      // 5. Detailed Sub-Reports Section
                      const Text(
                        'Detailed Analytical Reports',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 12),

                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        childAspectRatio: 2.2,
                        children: [
                          if (canViewSales)
                            _buildReportTile(
                              title: 'Sales Report',
                              subtitle: 'Invoice revenue breakdown',
                              icon: Icons.point_of_sale_outlined,
                              onTap: () => context.go('/reports/sales'),
                            ),
                          if (canViewPayments)
                            _buildReportTile(
                              title: 'Collections',
                              subtitle: 'Payment method breakdown',
                              icon: Icons.payments_outlined,
                              onTap: () => context.go('/reports/payments'),
                            ),
                          if (canViewInvoices)
                            _buildReportTile(
                              title: 'Outstanding',
                              subtitle: 'Ageing & overdue balances',
                              icon: Icons.receipt_outlined,
                              onTap: () => context.go('/reports/outstanding'),
                            ),
                          if (canViewGst)
                            _buildReportTile(
                              title: 'GST Summary',
                              subtitle: 'CGST, SGST tax report',
                              icon: Icons.account_balance_outlined,
                              onTap: () => context.go('/reports/gst'),
                            ),
                          if (canViewJobCards)
                            _buildReportTile(
                              title: 'Job Cards',
                              subtitle: 'Operations & conversions',
                              icon: Icons.build_circle_outlined,
                              onTap: () => context.go('/reports/job-cards'),
                            ),
                          if (canViewShowrooms)
                            _buildReportTile(
                              title: 'Showrooms',
                              subtitle: 'Daily bills & assignments',
                              icon: Icons.storefront_outlined,
                              onTap: () => context.go('/reports/showrooms'),
                            ),
                          if (canViewProductivity)
                            _buildReportTile(
                              title: 'Productivity',
                              subtitle: 'Staff vehicle attendance',
                              icon: Icons.people_outline,
                              onTap: () => context.go('/reports/staff-productivity'),
                            ),
                          if (canViewAdvances)
                            _buildReportTile(
                              title: 'Staff Advances',
                              subtitle: 'Recovery & settlements',
                              icon: Icons.account_balance_wallet_outlined,
                              onTap: () => context.go('/reports/staff-advances'),
                            ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // 6. Recent Operational Activity Feed
                      RecentActivityCard(
                        activities: dashboard.recentActivity,
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

  Widget _buildMiniMetric({
    required String label,
    required String value,
    required Color color,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReportTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusMD),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppTheme.radiusSM),
              ),
              child: Icon(icon, size: 16, color: AppColors.primary),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 16, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }
}
