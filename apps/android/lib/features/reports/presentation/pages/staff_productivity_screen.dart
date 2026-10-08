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
import '../../models/staff_productivity_report_model.dart';
import '../../providers/reports_provider.dart';
import '../widgets/report_date_filter.dart';

class StaffProductivityScreen extends ConsumerStatefulWidget {
  const StaffProductivityScreen({super.key});

  @override
  ConsumerState<StaffProductivityScreen> createState() =>
      _StaffProductivityScreenState();
}

class _StaffProductivityScreenState
    extends ConsumerState<StaffProductivityScreen> {
  String _searchQuery = '';
  String _selectedAssignmentType = 'all'; // all, regular, swapped
  bool _showGranularLog = false;

  @override
  Widget build(BuildContext context) {
    final productivityAsync = ref.watch(staffProductivityProvider);
    final showroomsState = ref.watch(showroomsProvider);
    final selectedShowroomId = ref.watch(selectedReportShowroomIdProvider);

    return AppScreenScaffold(
      title: 'Staff Productivity & Work Log',
      actions: [
        IconButton(
          icon: Icon(
            _showGranularLog
                ? Icons.view_agenda_outlined
                : Icons.table_chart_outlined,
            color: AppColors.textPrimary,
          ),
          tooltip: _showGranularLog
              ? 'Switch to Grouped View'
              : 'Switch to Detailed Log',
          onPressed: () {
            setState(() {
              _showGranularLog = !_showGranularLog;
            });
          },
        ),
        IconButton(
          icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
          tooltip: 'Refresh',
          onPressed: () {
            ref.invalidate(staffProductivityProvider);
          },
        ),
      ],
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(staffProductivityProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Date Filter
              const ReportDateFilter(),
              const SizedBox(height: 12),

              // 2. Showroom & Assignment Filters Bar
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Showroom Dropdown
                    Row(
                      children: [
                        Icon(
                          Icons.storefront_outlined,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String?>(
                              value: selectedShowroomId,
                              isDense: true,
                              isExpanded: true,
                              hint: const Text(
                                'All Showrooms',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              items: [
                                const DropdownMenuItem<String?>(
                                  value: null,
                                  child: Text(
                                    'All Showrooms',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                ...showroomsState.showrooms.map(
                                  (s) => DropdownMenuItem<String?>(
                                    value: s.id,
                                    child: Text(
                                      s.name,
                                      style: const TextStyle(fontSize: 13),
                                    ),
                                  ),
                                ),
                              ],
                              onChanged: (val) {
                                ref
                                        .read(
                                          selectedReportShowroomIdProvider
                                              .notifier,
                                        )
                                        .state =
                                    val;
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Divider(color: AppColors.border, height: 1),
                    const SizedBox(height: 10),

                    // Filter Chips: Assignment Type & Search
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            decoration: InputDecoration(
                              hintText: 'Search staff name / vehicle...',
                              hintStyle: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textTertiary,
                              ),
                              prefixIcon: const Icon(
                                Icons.search,
                                size: 16,
                                color: AppColors.textTertiary,
                              ),
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 8,
                              ),
                              filled: true,
                              fillColor: AppColors.surfaceAlt,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(
                                  AppTheme.radiusSM,
                                ),
                                borderSide: const BorderSide(
                                  color: AppColors.border,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(
                                  AppTheme.radiusSM,
                                ),
                                borderSide: const BorderSide(
                                  color: AppColors.border,
                                ),
                              ),
                            ),
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textPrimary,
                            ),
                            onChanged: (val) {
                              setState(() {
                                _searchQuery = val.trim().toLowerCase();
                              });
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Assignment filter chip
                        PopupMenuButton<String>(
                          initialValue: _selectedAssignmentType,
                          tooltip: 'Assignment Type Filter',
                          onSelected: (val) {
                            setState(() {
                              _selectedAssignmentType = val;
                            });
                            ref
                                .read(
                                  staffProductivityAssignmentFilterProvider
                                      .notifier,
                                )
                                .state = val == 'all'
                                ? null
                                : val;
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: _selectedAssignmentType != 'all'
                                  ? AppColors.primary.withValues(alpha: 0.15)
                                  : AppColors.surfaceAlt,
                              borderRadius: BorderRadius.circular(
                                AppTheme.radiusSM,
                              ),
                              border: Border.all(
                                color: _selectedAssignmentType != 'all'
                                    ? AppColors.primary
                                    : AppColors.border,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.swap_horiz,
                                  size: 14,
                                  color: _selectedAssignmentType != 'all'
                                      ? AppColors.primary
                                      : AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  _selectedAssignmentType == 'all'
                                      ? 'All'
                                      : (_selectedAssignmentType == 'Swapped'
                                            ? 'Swaps'
                                            : 'Regular'),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: _selectedAssignmentType != 'all'
                                        ? AppColors.primary
                                        : AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          itemBuilder: (context) => [
                            const PopupMenuItem(
                              value: 'all',
                              child: Text('All Work Types'),
                            ),
                            const PopupMenuItem(
                              value: 'Regular',
                              child: Text('Regular Staff Work'),
                            ),
                            const PopupMenuItem(
                              value: 'Swapped',
                              child: Text('Swapped Staff Work'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              productivityAsync.when(
                loading: () => const AppLoadingState(
                  message: 'Calculating staff productivity & work logs...',
                ),
                error: (error, _) => AppErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(staffProductivityProvider),
                ),
                data: (report) {
                  // Filter staff rows
                  final filteredItems = report.items.where((staff) {
                    if (_searchQuery.isNotEmpty) {
                      final matchName = staff.staffName.toLowerCase().contains(
                        _searchQuery,
                      );
                      final matchRole = (staff.role ?? '')
                          .toLowerCase()
                          .contains(_searchQuery);
                      final matchPhone = staff.staffPhone
                          .toLowerCase()
                          .contains(_searchQuery);
                      if (!matchName && !matchRole && !matchPhone) return false;
                    }
                    if (_selectedAssignmentType == 'Swapped') {
                      final hasSwaps = staff.workRecords.any(
                        (r) => r.assignmentType == 'Swapped',
                      );
                      if (!hasSwaps) return false;
                    } else if (_selectedAssignmentType == 'Regular') {
                      final hasRegular = staff.workRecords.any(
                        (r) => r.assignmentType == 'Regular',
                      );
                      if (!hasRegular) return false;
                    }
                    return true;
                  }).toList();

                  // Filter granular records
                  final filteredGranular = report.granularRecords.where((r) {
                    if (_searchQuery.isNotEmpty) {
                      final matchStaff = r.staffName.toLowerCase().contains(
                        _searchQuery,
                      );
                      final matchVeh = r.vehicleTypeName.toLowerCase().contains(
                        _searchQuery,
                      );
                      final matchSrv = r.workTypeName.toLowerCase().contains(
                        _searchQuery,
                      );
                      if (!matchStaff && !matchVeh && !matchSrv) return false;
                    }
                    if (_selectedAssignmentType == 'Swapped' &&
                        r.assignmentType != 'Swapped')
                      return false;
                    if (_selectedAssignmentType == 'Regular' &&
                        r.assignmentType != 'Regular')
                      return false;
                    return true;
                  }).toList();

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Executive Summary KPI Banner
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer,
                          borderRadius: BorderRadius.circular(
                            AppTheme.radiusLG,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'PRODUCTIVITY SUMMARY',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${report.totalVehiclesAttended} Cars',
                                      style: const TextStyle(
                                        fontSize: 24,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                      ),
                                    ),
                                    Text(
                                      '${report.totalServicesPerformed} Services Performed',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ],
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '${report.totalStaffHours.toStringAsFixed(1)}h',
                                      style: const TextStyle(
                                        fontSize: 24,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFF38BDF8),
                                      ),
                                    ),
                                    const Text(
                                      'Total Staff Hours',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            const Divider(color: Color(0xFF1E293B), height: 1),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildSummaryMetric(
                                    'Active Staff',
                                    report.totalStaff.toString(),
                                  ),
                                ),
                                Expanded(
                                  child: _buildSummaryMetric(
                                    'Days Assigned',
                                    report.totalDaysAssigned.toString(),
                                  ),
                                ),
                                Expanded(
                                  child: _buildSummaryMetric(
                                    'Veh / Staff',
                                    report.averageVehiclesPerStaff
                                        .toStringAsFixed(1),
                                  ),
                                ),
                                Expanded(
                                  child: _buildSummaryMetric(
                                    'Srv / Staff',
                                    report.averageServicesPerStaff
                                        .toStringAsFixed(1),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Section Title with Toggle
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              _showGranularLog
                                  ? 'Granular Work Logs (${filteredGranular.length})'
                                  : 'Staff Breakdown (${filteredItems.length})',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          Flexible(
                            child: Text(
                              _showGranularLog
                                  ? 'Individual jobs'
                                  : 'Staff Hierarchy',
                              textAlign: TextAlign.end,
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textTertiary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      if (_showGranularLog)
                        _buildGranularLogList(filteredGranular)
                      else
                        _buildHierarchicalStaffList(filteredItems),
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

  Widget _buildHierarchicalStaffList(List<StaffProductivityRowModel> items) {
    if (items.isEmpty) {
      return const AppEmptyState(
        title: 'No staff productivity records',
        message: 'No vehicle work logs match the selected filter criteria.',
        icon: Icons.people_outline,
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: items.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final staff = items[index];
        final hasSwapWork = staff.workRecords.any(
          (r) => r.assignmentType == 'Swapped',
        );

        return Container(
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppTheme.radiusMD),
            border: Border.all(color: AppColors.border),
          ),
          child: ExpansionTile(
            shape: const Border(),
            collapsedShape: const Border(),
            tilePadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 8,
            ),
            childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            leading: CircleAvatar(
              radius: 18,
              backgroundColor: hasSwapWork
                  ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                  : AppColors.primary.withValues(alpha: 0.1),
              child: Text(
                staff.staffName.isNotEmpty
                    ? staff.staffName[0].toUpperCase()
                    : 'S',
                style: TextStyle(
                  color: hasSwapWork
                      ? const Color(0xFFD97706)
                      : AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            title: Row(
              children: [
                Expanded(
                  child: Text(
                    staff.staffName,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                if (hasSwapWork)
                  Container(
                    margin: const EdgeInsets.only(left: 4),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: const Color(0xFFFCD34D)),
                    ),
                    child: const Text(
                      'Swap Work',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF92400E),
                      ),
                    ),
                  ),
              ],
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 2),
                Text(
                  '${staff.role ?? 'Staff'} • ${staff.workingShowroomName ?? staff.homeShowroomName ?? 'Showroom'}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    _buildMiniBadge(
                      '${staff.totalVehiclesAttended} vehicles',
                      AppColors.primary,
                    ),
                    const SizedBox(width: 6),
                    _buildMiniBadge(
                      '${staff.totalServicesPerformed} services',
                      const Color(0xFF0284C7),
                    ),
                    const SizedBox(width: 6),
                    _buildMiniBadge(
                      '${staff.totalWorkingHours.toStringAsFixed(1)}h',
                      const Color(0xFF10B981),
                    ),
                  ],
                ),
              ],
            ),
            children: [
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 10),

              // Hierarchy: Vehicle Types -> Services
              if (staff.vehicleTypes.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'No vehicle type breakdown available for this staff.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textTertiary,
                    ),
                  ),
                )
              else
                ...staff.vehicleTypes.map((vType) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Vehicle Type Header
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.directions_car_outlined,
                                  size: 14,
                                  color: AppColors.primary,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  vType.vehicleTypeName,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              '${vType.vehicleCount} cars • ${vType.hours.toStringAsFixed(1)}h',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        const Divider(color: AppColors.border, height: 1),
                        const SizedBox(height: 6),

                        // Service Items
                        ...vType.services.map((srv) {
                          final isSwapped = srv.assignmentType == 'Swapped';

                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(
                              children: [
                                const SizedBox(width: 12),
                                const Icon(
                                  Icons.subdirectory_arrow_right,
                                  size: 12,
                                  color: AppColors.textTertiary,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        srv.workTypeName,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      if (isSwapped &&
                                          srv.originalStaffName != null)
                                        Text(
                                          'Swapped for ${srv.originalStaffName} (${srv.swapId ?? 'SWP'})',
                                          style: const TextStyle(
                                            fontSize: 10,
                                            color: Color(0xFFD97706),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                Text(
                                  '${srv.vehicleCount} cars',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  '${srv.hours.toStringAsFixed(1)}h',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ),
                  );
                }),
            ],
          ),
        );
      },
    );
  }

  Widget _buildGranularLogList(List<StaffProductivityWorkRecordModel> records) {
    if (records.isEmpty) {
      return const AppEmptyState(
        title: 'No granular work records',
        message: 'No individual vehicle records match the selected filter.',
        icon: Icons.receipt_long_outlined,
      );
    }

    final dateFormat = DateFormat('dd MMM yyyy');

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: records.length,
      separatorBuilder: (context, index) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final r = records[index];
        final isSwapped = r.assignmentType == 'Swapped';

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppTheme.radiusSM),
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
                    r.staffName,
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
                      color: isSwapped
                          ? const Color(0xFFFEF3C7)
                          : AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      isSwapped ? 'Swapped Staff' : 'Regular Staff',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: isSwapped
                            ? const Color(0xFF92400E)
                            : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${dateFormat.format(r.date)} • ${r.vehicleTypeName} • ${r.workTypeName}',
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                ),
              ),
              if (isSwapped && r.originalStaffName != null) ...[
                const SizedBox(height: 2),
                Text(
                  'Original: ${r.originalStaffName} • Swap ID: ${r.swapId ?? 'SWP'}',
                  style: const TextStyle(
                    fontSize: 10,
                    color: Color(0xFFD97706),
                  ),
                ),
              ],
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${r.vehicleQuantity} vehicle • ${r.serviceQuantity} service',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                  Text(
                    '${r.workingHours.toStringAsFixed(1)} hrs',
                    style: const TextStyle(
                      fontSize: 11,
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

  Widget _buildSummaryMetric(String label, String value) {
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

  Widget _buildMiniBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
