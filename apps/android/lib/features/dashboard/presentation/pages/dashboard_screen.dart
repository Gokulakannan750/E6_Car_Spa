import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../customers/presentation/widgets/add_customer_dialog.dart';
import '../../../jobcards/models/job_card_model.dart';
import '../../../reports/models/report_dashboard_model.dart';
import '../../providers/dashboard_providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  String _formatCurrency(double amount) {
    return '₹${amount.toStringAsFixed(2)}';
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '';
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final summaryAsync = ref.watch(dashboardSummaryProvider);
    final recentJobsAsync = ref.watch(dashboardRecentJobsProvider);

    final userName = user?.fullName ?? user?.username ?? 'Team Member';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Center(
                child: Text(
                  'E6',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Dashboard',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                ),
                Text(
                  'Welcome, $userName',
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.normal),
                ),
              ],
            ),
          ],
        ),
        centerTitle: false,
        actions: const [
          AppLogoutAction(),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(dashboardSummaryProvider);
          ref.invalidate(dashboardRecentJobsProvider);
          await Future.wait([
            ref.read(dashboardSummaryProvider.future),
            ref.read(dashboardRecentJobsProvider.future),
          ]);
        },
        child: summaryAsync.when(
          loading: () => const AppLoadingState(message: 'Loading live business dashboard...'),
          error: (err, stack) => AppErrorState(
            message: 'Failed to load live dashboard data: $err',
            onRetry: () {
              ref.invalidate(dashboardSummaryProvider);
              ref.invalidate(dashboardRecentJobsProvider);
            },
          ),
          data: (summary) => _buildDashboardBody(context, ref, summary, recentJobsAsync),
        ),
      ),
    );
  }

  Widget _buildDashboardBody(
    BuildContext context,
    WidgetRef ref,
    DashboardSummaryModel summary,
    AsyncValue<JobCardListResponse> recentJobsAsync,
  ) {
    final activeJobs = summary.jobCardKpis.inProgressJobCards + summary.jobCardKpis.newJobCards;
    final totalCustomers = summary.vehicleActivity.uniqueVehiclesServiced;
    final grossRevenue = summary.sales.grossSubtotal;
    final completedJobs = summary.jobCardKpis.completedJobCards;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Quick Action Row
        Row(
          children: [
            Expanded(
              child: AppButton(
                key: const Key('dashboard_new_job_card_button'),
                label: '+ New Job Card',
                onPressed: () => context.go(AppRoutes.newJobCard),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                key: const Key('dashboard_add_customer_button'),
                style: OutlinedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary, width: 1.2),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: const Icon(Icons.person_add_outlined, size: 18),
                label: const Text('+ Add Customer', style: TextStyle(fontWeight: FontWeight.w600)),
                onPressed: () => AddCustomerDialog.show(context),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // 4 Primary KPI Summary Cards (Desktop Parity from GET /api/reports/dashboard)
        Row(
          children: [
            Expanded(
              child: _buildKpiCard(
                title: 'Total Customers',
                value: '$totalCustomers',
                subtitle: totalCustomers > 0 ? '$totalCustomers unique serviced' : 'No customers yet',
                icon: Icons.people_alt_outlined,
                color: AppColors.primary,
                onTap: () => context.go(AppRoutes.customers),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildKpiCard(
                title: 'Active Jobs',
                value: '$activeJobs',
                subtitle: activeJobs > 0 ? '$activeJobs in progress / new' : 'No active jobs',
                icon: Icons.access_time_rounded,
                color: AppColors.warningDark,
                onTap: () => context.go(AppRoutes.jobCards),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildKpiCard(
                title: 'Revenue (MTD)',
                value: _formatCurrency(grossRevenue),
                subtitle: 'Gross subtotal (MTD)',
                icon: Icons.currency_rupee_rounded,
                color: AppColors.success,
                onTap: () => context.go(AppRoutes.quotationsInvoices),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildKpiCard(
                title: 'Completed',
                value: '$completedJobs',
                subtitle: '$completedJobs delivered',
                icon: Icons.check_circle_outline_rounded,
                color: AppColors.primary,
                onTap: () => context.go(AppRoutes.jobCards),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Financial & Collections Overview Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
            boxShadow: const [
              BoxShadow(
                color: Color(0x05000000),
                blurRadius: 4,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Financial Overview',
                    style: AppTextStyles.headingSmall.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Icon(Icons.account_balance_wallet_outlined, size: 18, color: AppColors.textSecondary),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildFinancialMetric(
                      label: 'Collections (MTD)',
                      value: _formatCurrency(summary.paymentCollection.totalReceived),
                      color: AppColors.success,
                    ),
                  ),
                  Container(width: 1, height: 36, color: AppColors.border),
                  Expanded(
                    child: _buildFinancialMetric(
                      label: 'Outstanding',
                      value: _formatCurrency(summary.outstanding.totalOutstandingCombined),
                      color: AppColors.error,
                    ),
                  ),
                  Container(width: 1, height: 36, color: AppColors.border),
                  Expanded(
                    child: _buildFinancialMetric(
                      label: 'Net Sales (MTD)',
                      value: _formatCurrency(summary.sales.netSales),
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Job Status Breakdown Card (Desktop Parity)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Job Status Distribution',
                style: AppTextStyles.headingSmall.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildStatusPill(
                      label: 'In Progress',
                      count: summary.jobCardKpis.inProgressJobCards,
                      color: const Color(0xFF0453CD),
                      bgColor: const Color(0xFFEFF6FF),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildStatusPill(
                      label: 'Completed',
                      count: summary.jobCardKpis.completedJobCards,
                      color: const Color(0xFF16A34A),
                      bgColor: const Color(0xFFF0FDF4),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _buildStatusPill(
                      label: 'New / Pending',
                      count: summary.jobCardKpis.newJobCards,
                      color: const Color(0xFFD97706),
                      bgColor: const Color(0xFFFFFBEB),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildStatusPill(
                      label: 'Cancelled',
                      count: summary.jobCardKpis.cancelledJobCards,
                      color: const Color(0xFFDC2626),
                      bgColor: const Color(0xFFFEF2F2),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Recent Activity / Recent Job Cards Section
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Job Cards',
              style: AppTextStyles.headingSmall.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            TextButton(
              key: const Key('dashboard_view_all_jobs_button'),
              onPressed: () => context.go(AppRoutes.jobCards),
              child: const Text(
                'View All',
                style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),

        recentJobsAsync.when(
          loading: () => const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          ),
          error: (err, _) => Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Center(
              child: Text(
                'Could not load recent jobs: $err',
                style: const TextStyle(color: AppColors.error, fontSize: 13),
              ),
            ),
          ),
          data: (jobsResponse) {
            final items = jobsResponse.items;
            if (items.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Center(
                  child: Text(
                    'No recent job cards found.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                  ),
                ),
              );
            }
            return Column(
              children: items.map((jc) => _buildRecentJobCard(context, jc)).toList(),
            );
          },
        ),

        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
          boxShadow: const [
            BoxShadow(
              color: Color(0x05000000),
              blurRadius: 4,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: color.withAlpha(25),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(icon, size: 16, color: color),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                fontFamily: value.startsWith('₹') ? 'monospace' : null,
                color: AppColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textTertiary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFinancialMetric({
    required String label,
    required String value,
    required Color color,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              fontFamily: 'monospace',
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPill({
    required String label,
    required int count,
    required Color color,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(50)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
          Text(
            '$count',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              fontFamily: 'monospace',
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentJobCard(BuildContext context, JobCardListItem jc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              jc.jobCardNumber,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontFamily: 'monospace',
                fontSize: 14,
                color: AppColors.primary,
              ),
            ),
            StatusBadge.fromLabel(jc.status.label),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      '${jc.customerName} · ${jc.registrationNumber}',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    _formatCurrency(jc.totalAmount),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'monospace',
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              if (jc.createdAt != null) ...[
                const SizedBox(height: 2),
                Text(
                  _formatDate(jc.createdAt),
                  style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
                ),
              ],
            ],
          ),
        ),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textTertiary, size: 20),
        onTap: () => context.go('/job-cards/${jc.id}'),
      ),
    );
  }
}
