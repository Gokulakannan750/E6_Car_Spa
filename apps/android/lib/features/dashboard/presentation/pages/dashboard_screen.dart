import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../customers/presentation/widgets/add_customer_dialog.dart';
import '../../../customers/providers/customer_providers.dart';
import '../../../jobcards/models/job_card_model.dart';
import '../../../jobcards/providers/job_card_providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobCardsState = ref.watch(jobCardListProvider);
    final customersState = ref.watch(customerListProvider);

    final recentJobs = jobCardsState.items.take(5).toList();
    final totalCustomers = customersState.totalCount > 0 ? customersState.totalCount : customersState.customers.length;
    final activeJobs = jobCardsState.items.where((j) => j.status == JobCardStatus.inProgress || j.status == JobCardStatus.qualityCheck).length;
    final completedJobs = jobCardsState.items.where((j) => j.status == JobCardStatus.ready || j.status == JobCardStatus.invoiced || j.status == JobCardStatus.delivered).length;
    final totalRevenue = jobCardsState.items.fold<double>(0.0, (sum, j) => sum + j.totalAmount);

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
            const Text(
              'Dashboard',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
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
          await ref.read(jobCardListProvider.notifier).loadJobCards(refresh: true);
          await ref.read(customerListProvider.notifier).loadCustomers(refresh: true);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Quick Action Row
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: '+ New Job Card',
                    onPressed: () => context.go(AppRoutes.newJobCard),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
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

            // KPI Grid (2x2)
            Row(
              children: [
                Expanded(
                  child: _buildKpiCard(
                    title: 'Total Customers',
                    value: '$totalCustomers',
                    subtitle: totalCustomers > 0 ? '$totalCustomers registered' : 'No customers yet',
                    icon: Icons.people_outline_rounded,
                    onTap: () => context.go(AppRoutes.customers),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard(
                    title: 'Active Jobs',
                    value: '$activeJobs',
                    subtitle: activeJobs > 0 ? '$activeJobs in progress' : 'No active jobs',
                    icon: Icons.access_time_rounded,
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
                    value: '₹${totalRevenue.toStringAsFixed(0)}',
                    subtitle: totalRevenue > 0 ? 'Total recorded sales' : 'No sales yet',
                    icon: Icons.currency_rupee_rounded,
                    onTap: () => context.go(AppRoutes.quotationsInvoices),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard(
                    title: 'Completed',
                    value: '$completedJobs',
                    subtitle: completedJobs > 0 ? '$completedJobs ready/delivered' : 'No completed jobs',
                    icon: Icons.check_circle_outline_rounded,
                    onTap: () => context.go(AppRoutes.jobCards),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Recent Activity Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Recent Job Cards',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                TextButton(
                  onPressed: () => context.go(AppRoutes.jobCards),
                  child: const Text(
                    'View All',
                    style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            if (jobCardsState.isLoading && recentJobs.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (recentJobs.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Center(
                  child: Text(
                    'No recent job cards',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                  ),
                ),
              )
            else
              ...recentJobs.map((jc) => _buildRecentJobCard(context, jc)),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
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
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.accentPill,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(icon, size: 16, color: AppColors.primary),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
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

  Widget _buildRecentJobCard(BuildContext context, JobCardListItem jc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              jc.jobCardNumber,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 15,
                color: AppColors.primary,
              ),
            ),
            StatusBadge.fromLabel(jc.status.label),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  '${jc.customerName} · ${jc.registrationNumber}',
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '₹${jc.totalAmount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textTertiary, size: 20),
        onTap: () => context.go('/job-cards/${jc.id}'),
      ),
    );
  }
}
