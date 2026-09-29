import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../showroom/providers/showroom_provider.dart';
import '../../models/showroom_report_model.dart';
import '../../providers/reports_provider.dart';
import '../widgets/report_date_filter.dart';

class ShowroomReportScreen extends ConsumerStatefulWidget {
  const ShowroomReportScreen({super.key});

  @override
  ConsumerState<ShowroomReportScreen> createState() => _ShowroomReportScreenState();
}

class _ShowroomReportScreenState extends ConsumerState<ShowroomReportScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
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

  @override
  Widget build(BuildContext context) {
    final reportAsync = ref.watch(monthlyShowroomReportProvider);
    final showroomsState = ref.watch(showroomsProvider);
    final selectedShowroomId = ref.watch(selectedReportShowroomIdProvider);

    return AppScreenScaffold(
      title: 'Showroom Comprehensive Reports',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
          tooltip: 'Refresh Report',
          onPressed: () {
            ref.invalidate(monthlyShowroomReportProvider);
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
                    // 1. Date Range Presets Filter
                    const ReportDateFilter(),
                    const SizedBox(height: 12),

                    // 2. Showroom Selector
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.storefront, size: 18, color: AppColors.primary),
                          const SizedBox(width: 10),
                          const Text(
                            'Showroom:',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String?>(
                                value: selectedShowroomId,
                                isDense: true,
                                isExpanded: true,
                                hint: const Text('All Showrooms', style: TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                                items: [
                                  const DropdownMenuItem<String?>(
                                    value: null,
                                    child: Text('All Showrooms', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                  ),
                                  ...showroomsState.showrooms.map(
                                    (s) => DropdownMenuItem<String?>(
                                      value: s.id,
                                      child: Text(s.name, style: const TextStyle(fontSize: 13)),
                                    ),
                                  ),
                                ],
                                onChanged: (val) {
                                  ref.read(selectedReportShowroomIdProvider.notifier).state = val;
                                },
                              ),
                            ),
                          ),
                        ],
                      ),
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
                  isScrollable: true,
                  labelColor: AppColors.primary,
                  unselectedLabelColor: AppColors.textSecondary,
                  indicatorColor: AppColors.primary,
                  indicatorWeight: 3,
                  labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                  unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                  tabs: const [
                    Tab(text: 'Overview'),
                    Tab(text: 'Vehicles & Services'),
                    Tab(text: 'Staff Productivity'),
                    Tab(text: 'Attendance'),
                    Tab(text: 'Staff Swaps'),
                  ],
                ),
              ),
            ),
          ];
        },
        body: reportAsync.when(
          loading: () => const AppLoadingState(message: 'Generating showroom 7-sheet report...'),
          error: (error, _) => AppErrorState(
            message: error.toString(),
            onRetry: () => ref.invalidate(monthlyShowroomReportProvider),
          ),
          data: (report) {
            if (report.showrooms.isEmpty) {
              return const AppEmptyState(
                title: 'No showroom data',
                message: 'No showroom activity was recorded for the selected period.',
                icon: Icons.storefront_outlined,
              );
            }

            final currentShowroom = report.showrooms.first;

            return TabBarView(
              controller: _tabController,
              children: [
                _buildOverviewTab(currentShowroom),
                _buildVehiclesServicesTab(currentShowroom),
                _buildStaffProductivityTab(currentShowroom),
                _buildAttendanceTab(currentShowroom),
                _buildStaffSwapsTab(currentShowroom),
              ],
            );
          },
        ),
      ),
    );
  }

  // ── Tab 1: Overview ──────────────────────────────────────────────────────────
  Widget _buildOverviewTab(MonthlyShowroomDetailModel showroom) {
    final s = showroom.summary;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primaryContainer,
              borderRadius: BorderRadius.circular(AppTheme.radiusLG),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            showroom.showroomName.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${s.totalVehiclesServiced} Vehicles Serviced',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          _formatCurrency(s.totalBilledAmount),
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF38BDF8),
                          ),
                        ),
                        const Text(
                          'Total Billed',
                          style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(color: Color(0xFF1E293B), height: 1),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildKpiItem('Total Services', s.totalServicesPerformed.toString()),
                    _buildKpiItem('Active Staff', s.totalActiveStaff.toString()),
                    _buildKpiItem('Staff Hours', '${s.totalStaffHours.toStringAsFixed(1)}h'),
                    _buildKpiItem('Swaps', s.totalSwaps.toString()),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Vehicle Type Breakdown
          _buildSectionHeader('Vehicle Type Breakdown', Icons.directions_car_outlined),
          const SizedBox(height: 8),
          if (showroom.vehicleTypeSummary.isEmpty)
            const Text('No vehicle type data available.', style: TextStyle(fontSize: 12, color: AppColors.textTertiary))
          else
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                border: Border.all(color: AppColors.border),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: showroom.vehicleTypeSummary.length,
                separatorBuilder: (context, index) => const Divider(color: AppColors.border, height: 1),
                itemBuilder: (context, index) {
                  final vt = showroom.vehicleTypeSummary[index];
                  return ListTile(
                    dense: true,
                    title: Text(vt.vehicleTypeName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: Text('${vt.totalServices} services • ${vt.totalStaffHours.toStringAsFixed(1)}h', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                    trailing: Text('${vt.totalVehicles} cars', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
                  );
                },
              ),
            ),
          const SizedBox(height: 20),

          // Service Breakdown
          _buildSectionHeader('Service Summary Breakdown', Icons.build_outlined),
          const SizedBox(height: 8),
          if (showroom.serviceSummary.isEmpty)
            const Text('No service data available.', style: TextStyle(fontSize: 12, color: AppColors.textTertiary))
          else
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                border: Border.all(color: AppColors.border),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: showroom.serviceSummary.length,
                separatorBuilder: (context, index) => const Divider(color: AppColors.border, height: 1),
                itemBuilder: (context, index) {
                  final srv = showroom.serviceSummary[index];
                  return ListTile(
                    dense: true,
                    title: Text(srv.serviceName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: Text('${srv.serviceCategory} • ${srv.totalStaffHours.toStringAsFixed(1)}h', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                    trailing: Text('${srv.totalVehicles} cars', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  // ── Tab 2: Vehicles & Services Details ─────────────────────────────────────────
  Widget _buildVehiclesServicesTab(MonthlyShowroomDetailModel showroom) {
    final dateFormat = DateFormat('dd MMM yyyy');
    final items = showroom.vehicleWorks;

    if (items.isEmpty) {
      return const AppEmptyState(
        title: 'No vehicle records',
        message: 'No vehicle work entries logged for this showroom period.',
        icon: Icons.directions_car_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final row = items[index];
        final isSwapped = row.assignmentType == 'Swapped';

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppTheme.radiusMD),
            border: Border.all(
              color: isSwapped ? const Color(0xFFFCD34D) : AppColors.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${dateFormat.format(row.date)} • ${row.vehicleTypeName}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isSwapped ? const Color(0xFFFEF3C7) : AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      isSwapped ? 'Swapped Staff' : 'Regular Staff',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: isSwapped ? const Color(0xFF92400E) : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Staff: ${row.staffName} (${row.staffRole ?? 'Staff'})',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 2),
              Text(
                'Services: ${row.servicesSummary}',
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
              if (isSwapped && row.originalStaffName != null) ...[
                const SizedBox(height: 2),
                Text(
                  'Original Staff: ${row.originalStaffName} • Swap ID: ${row.swapId ?? 'SWP'}',
                  style: const TextStyle(fontSize: 10, color: Color(0xFFD97706)),
                ),
              ],
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${row.vehicleQuantity} vehicle • ${row.workingHours.toStringAsFixed(1)} hrs',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary),
                  ),
                  if (row.notes != null && row.notes!.isNotEmpty)
                    Text(
                      row.notes!,
                      style: const TextStyle(fontSize: 10, fontStyle: FontStyle.italic, color: AppColors.textTertiary),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // ── Tab 3: Staff Productivity ────────────────────────────────────────────────
  Widget _buildStaffProductivityTab(MonthlyShowroomDetailModel showroom) {
    final staffList = showroom.staffSummary;

    if (staffList.isEmpty) {
      return const AppEmptyState(
        title: 'No staff productivity summary',
        message: 'No staff members performed work in this showroom for the selected period.',
        icon: Icons.people_outline,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: staffList.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final staff = staffList[index];

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
                    staff.staffName,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '${staff.workloadSharePercent.toStringAsFixed(1)}% Share',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                '${staff.role ?? 'Staff'} • ${staff.homeShowroom} • ${staff.assignmentType}',
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildStaffStat('Vehicles', staff.totalVehicles.toString()),
                  _buildStaffStat('Services', staff.totalServices.toString()),
                  _buildStaffStat('Hours', '${staff.totalHours.toStringAsFixed(1)}h'),
                  _buildStaffStat('Attendance', '${staff.attendanceDays} days'),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // ── Tab 4: Attendance ────────────────────────────────────────────────────────
  Widget _buildAttendanceTab(MonthlyShowroomDetailModel showroom) {
    final dateFormat = DateFormat('dd MMM yyyy');
    final items = showroom.attendanceRecords;

    if (items.isEmpty) {
      return const AppEmptyState(
        title: 'No attendance records',
        message: 'No attendance records logged for this period.',
        icon: Icons.event_available_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final att = items[index];
        final isConfirmed = att.confirmationStatus.toLowerCase() == 'confirmed';

        return Container(
          padding: const EdgeInsets.all(12),
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
                    att.staffName,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isConfirmed
                          ? AppColors.success.withValues(alpha: 0.1)
                          : AppColors.warning.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      isConfirmed ? 'Confirmed' : 'Pending',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: isConfirmed ? AppColors.success : AppColors.warning,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${dateFormat.format(att.date)} • ${att.attendanceStatus} • ${att.actualHours.toStringAsFixed(1)} hrs',
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
              if (att.confirmedByName != null) ...[
                const SizedBox(height: 2),
                Text(
                  'Confirmed by: ${att.confirmedByName}',
                  style: const TextStyle(fontSize: 10, color: AppColors.textTertiary),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  // ── Tab 5: Staff Swaps ───────────────────────────────────────────────────────
  Widget _buildStaffSwapsTab(MonthlyShowroomDetailModel showroom) {
    final dateFormat = DateFormat('dd MMM yyyy');
    final swaps = showroom.swaps;

    if (swaps.isEmpty) {
      return const AppEmptyState(
        title: 'No staff swaps',
        message: 'No staff swaps were performed for this showroom in the selected date range.',
        icon: Icons.swap_horiz_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: swaps.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final swap = swaps[index];
        final isReversed = swap.status.toLowerCase() == 'reversed';

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppTheme.radiusMD),
            border: Border.all(
              color: isReversed ? const Color(0xFFEF4444) : const Color(0xFFF59E0B),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${dateFormat.format(swap.date)} • ${swap.swapId}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isReversed
                          ? const Color(0xFFFEE2E2)
                          : const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      isReversed ? 'Reversed' : 'Active Swap',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: isReversed ? const Color(0xFFB91C1C) : const Color(0xFF92400E),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Original: ${swap.staffAName}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                  ),
                  const Icon(Icons.arrow_forward, size: 14, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Replacement: ${swap.staffBName}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Period: ${swap.swapStartTime ?? '09:00'} – ${swap.swapEndTime ?? '17:00'} (${swap.swapHours.toStringAsFixed(1)} hrs)',
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
              if (swap.reason != null && swap.reason!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  'Reason: ${swap.reason}',
                  style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textTertiary),
                ),
              ],
              if (isReversed) ...[
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'Reversed by ${swap.reversedByName ?? 'Admin'}: ${swap.reversalReason ?? 'Swap reversed'}',
                    style: const TextStyle(fontSize: 10, color: Color(0xFFB91C1C)),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  // ── Helper Widgets ──────────────────────────────────────────────────────────
  Widget _buildKpiItem(String label, String value) {
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
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ],
    );
  }

  Widget _buildStaffStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textTertiary)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
      ],
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.primary),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _SliverTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;

  _SliverTabBarDelegate(this.tabBar);

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: AppColors.surface,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverTabBarDelegate oldDelegate) {
    return tabBar != oldDelegate.tabBar;
  }
}
