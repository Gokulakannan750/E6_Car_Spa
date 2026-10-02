import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../models/outside_job_report_model.dart';
import '../../providers/reports_provider.dart';
import '../widgets/report_date_filter.dart';

class OutsideJobsReportScreen extends ConsumerStatefulWidget {
  const OutsideJobsReportScreen({super.key});

  @override
  ConsumerState<OutsideJobsReportScreen> createState() =>
      _OutsideJobsReportScreenState();
}

class _OutsideJobsReportScreenState
    extends ConsumerState<OutsideJobsReportScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _formatCurrency(double value) {
    final formatter = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    );
    return formatter.format(value);
  }

  String _formatDateTime(DateTime date) {
    return DateFormat('dd MMM yyyy, hh:mm a').format(date);
  }

  String _formatDuration(double? hours) {
    if (hours == null) return '—';
    if (hours < 1) {
      final m = (hours * 60).round();
      return '${m}m';
    }
    final h = hours.floor();
    final m = ((hours - h) * 60).round();
    return m > 0 ? '${h}h ${m}m' : '${h}h';
  }

  @override
  Widget build(BuildContext context) {
    final reportAsync = ref.watch(outsideJobsReportProvider);

    return AppScreenScaffold(
      title: 'Outside Jobs & Movements',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
          tooltip: 'Refresh Report',
          onPressed: () {
            ref.invalidate(outsideJobsReportProvider);
          },
        ),
      ],
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) {
          return [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 1. Date Filter
                    const ReportDateFilter(),
                    const SizedBox(height: 16),

                    // 2. Summary KPI Cards
                    reportAsync.maybeWhen(
                      data: (report) {
                        final totalMovements =
                            report.totalOutsideCount + report.history.length;
                        final completedCount =
                            report.history
                                .where(
                                  (h) =>
                                      h.status == 2 ||
                                      h.statusName.toLowerCase() == 'returned',
                                )
                                .length;
                        final totalCost =
                            report.totalActiveCost +
                            report.totalHistoricalCost;

                        return Column(
                          children: [
                            GridView.count(
                              crossAxisCount: 2,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              crossAxisSpacing: 10,
                              mainAxisSpacing: 10,
                              childAspectRatio: 1.35,
                              children: [
                                _buildSummaryCard(
                                  title: 'Total Movements',
                                  value: '$totalMovements',
                                  subtitle: 'In selected period',
                                  icon: Icons.local_shipping,
                                  color: AppColors.primary,
                                ),
                                _buildSummaryCard(
                                  title: 'Currently Outside',
                                  value: '${report.totalOutsideCount}',
                                  subtitle: 'At external shops',
                                  icon: Icons.timelapse,
                                  color: AppColors.warning,
                                ),
                                _buildSummaryCard(
                                  title: 'Overdue Outside',
                                  value: '${report.totalOverdueCount}',
                                  subtitle: 'Past return time',
                                  icon: Icons.warning_amber_rounded,
                                  color: AppColors.error,
                                  isHighlighted: report.totalOverdueCount > 0,
                                ),
                                _buildSummaryCard(
                                  title: 'Returned',
                                  value: '$completedCount',
                                  subtitle: 'Back in showroom',
                                  icon: Icons.check_circle_outline,
                                  color: AppColors.success,
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.card,
                                borderRadius: BorderRadius.circular(
                                  AppTheme.radiusMD,
                                ),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Row(
                                    children: [
                                      Icon(
                                        Icons.payments_outlined,
                                        size: 18,
                                        color: AppColors.primary,
                                      ),
                                      SizedBox(width: 8),
                                      Text(
                                        'Total Vendor Operational Cost',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Text(
                                    _formatCurrency(totalCost),
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        );
                      },
                      orElse: () => const SizedBox.shrink(),
                    ),
                  ],
                ),
              ),
            ),
            SliverPersistentHeader(
              pinned: true,
              delegate: _SliverTabBarDelegate(
                TabBar(
                  controller: _tabController,
                  labelColor: AppColors.primary,
                  unselectedLabelColor: AppColors.textSecondary,
                  indicatorColor: AppColors.primary,
                  indicatorWeight: 3,
                  labelStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                  unselectedLabelStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                  tabs: const [
                    Tab(text: 'Currently Outside'),
                    Tab(text: 'Movement History'),
                    Tab(text: 'Vendor Summary'),
                  ],
                ),
              ),
            ),
          ];
        },
        body: reportAsync.when(
          loading: () => const AppLoadingState(
            message: 'Loading outside jobs reports...',
          ),
          error: (error, _) => AppErrorState(
            message: error.toString(),
            onRetry: () => ref.invalidate(outsideJobsReportProvider),
          ),
          data: (report) {
            return TabBarView(
              controller: _tabController,
              children: [
                _buildCurrentlyOutsideTab(report.currentlyOutside),
                _buildMovementHistoryTab(report.history),
                _buildVendorSummaryTab(report.vendorSummary),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildSummaryCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
    bool isHighlighted = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isHighlighted ? color.withValues(alpha: 0.1) : AppColors.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusMD),
        border: Border.all(
          color: isHighlighted ? color : AppColors.border,
          width: isHighlighted ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title.toUpperCase(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: isHighlighted ? color : AppColors.textSecondary,
                  letterSpacing: 0.5,
                ),
              ),
              Icon(icon, size: 16, color: color),
            ],
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentlyOutsideTab(List<CurrentlyOutsideJobModel> jobs) {
    if (jobs.isEmpty) {
      return const AppEmptyState(
        title: 'All vehicles in showroom',
        message: 'No vehicles are currently out at external workshops.',
        icon: Icons.check_circle_outline,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: jobs.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final job = jobs[index];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppTheme.radiusMD),
            border: Border.all(
              color: job.isOverdue ? AppColors.error : AppColors.border,
              width: job.isOverdue ? 1.5 : 1.0,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.directions_car,
                        size: 16,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        job.vehicleRegistration,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color:
                          job.isOverdue
                              ? AppColors.error.withValues(alpha: 0.1)
                              : AppColors.warning.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color:
                            job.isOverdue
                                ? AppColors.error
                                : AppColors.warning,
                      ),
                    ),
                    child: Text(
                      job.isOverdue ? 'OVERDUE' : 'OUTSIDE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color:
                            job.isOverdue
                                ? AppColors.error
                                : AppColors.warning,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${job.vehicleModel} • Customer: ${job.customerName}',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 8),

              // Vendor & Service
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Vendor: ${job.vendorName}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          'Service: ${job.serviceName}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (job.vendorCost != null)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text(
                          'Vendor Cost',
                          style: TextStyle(
                            fontSize: 10,
                            color: AppColors.textTertiary,
                          ),
                        ),
                        Text(
                          _formatCurrency(job.vendorCost!),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 8),

              // Sent and Return Times
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Sent: ${_formatDateTime(job.sentAt)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Text(
                      'Due: ${_formatDateTime(job.expectedReturnAt)}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color:
                            job.isOverdue
                                ? AppColors.error
                                : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // Job Card Link
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () {
                    context.push('/job-cards/${job.jobCardId}');
                  },
                  icon: const Icon(Icons.open_in_new, size: 14),
                  label: Text('Job Card #${job.jobCardNumber}'),
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMovementHistoryTab(List<OutsideJobHistoryReportModel> history) {
    if (history.isEmpty) {
      return const AppEmptyState(
        title: 'No movement history',
        message: 'No external movements were completed in this period.',
        icon: Icons.history,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: history.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final item = history[index];
        final isReturned =
            item.status == 2 || item.statusName.toLowerCase() == 'returned';

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
                    '${item.vehicleRegistration} • ${item.vehicleModel}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color:
                          isReturned
                              ? AppColors.success.withValues(alpha: 0.1)
                              : AppColors.textSecondary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      item.statusName,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color:
                            isReturned
                                ? AppColors.success
                                : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Customer: ${item.customerName} • Vendor: ${item.vendorName}',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              Text(
                'Service: ${item.serviceName}',
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textTertiary,
                ),
              ),
              const SizedBox(height: 8),
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Duration: ${_formatDuration(item.durationHours)}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  if (item.vendorCost != null)
                    Text(
                      'Cost: ${_formatCurrency(item.vendorCost!)}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVendorSummaryTab(
    List<OutsideJobVendorSummaryModel> vendorSummaries,
  ) {
    if (vendorSummaries.isEmpty) {
      return const AppEmptyState(
        title: 'No vendor data',
        message: 'No vendor transactions found in this period.',
        icon: Icons.storefront_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: vendorSummaries.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final v = vendorSummaries[index];

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
                    v.vendorName,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    _formatCurrency(v.totalVendorCost),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildVendorStat('Total', '${v.totalJobs}', AppColors.textPrimary),
                  _buildVendorStat('Active', '${v.currentlyOutside}', AppColors.warning),
                  _buildVendorStat('Overdue', '${v.overdueJobs}', AppColors.error),
                  _buildVendorStat('Done', '${v.completedJobs}', AppColors.success),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVendorStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: AppColors.textTertiary),
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
    );
  }
}

class _SliverTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar _tabBar;

  _SliverTabBarDelegate(this._tabBar);

  @override
  double get minExtent => _tabBar.preferredSize.height;

  @override
  double get maxExtent => _tabBar.preferredSize.height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(color: AppColors.surface, child: _tabBar);
  }

  @override
  bool shouldRebuild(_SliverTabBarDelegate oldDelegate) {
    return false;
  }
}
