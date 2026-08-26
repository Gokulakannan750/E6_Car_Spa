import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../models/showroom_model.dart';
import '../../models/showroom_staff_assignment_model.dart';
import '../../providers/daily_staff_provider.dart';
import '../../providers/showroom_provider.dart';
import '../widgets/assign_staff_modal_sheet.dart';
import '../widgets/daily_staff_assignment_card.dart';
import '../widgets/showroom_date_selector.dart';
import '../widgets/showroom_form_sheet.dart';

class ShowroomDetailScreen extends ConsumerStatefulWidget {
  final Showroom showroom;

  const ShowroomDetailScreen({
    super.key,
    required this.showroom,
  });

  @override
  ConsumerState<ShowroomDetailScreen> createState() => _ShowroomDetailScreenState();
}

class _ShowroomDetailScreenState extends ConsumerState<ShowroomDetailScreen> {
  late Showroom _currentShowroom;

  @override
  void initState() {
    super.initState();
    _currentShowroom = widget.showroom;
  }

  bool _hasPermission(String permission) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return false;
    if (user.isOwner) return true;
    return user.hasPermission(permission);
  }

  void _openAssignStaffSheet(DailyStaffState dailyState) {
    final assignedStaffIds =
        dailyState.staffAssignments.map((a) => a.staffId).toSet();

    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => AssignStaffModalSheet(
        showroomName: _currentShowroom.name,
        selectedDate: dailyState.selectedDate,
        alreadyAssignedStaffIds: assignedStaffIds,
        onAssign: (staffId, initialVehicles) async {
          await ref
              .read(dailyStaffProvider(_currentShowroom.id).notifier)
              .assignStaff(
                staffId: staffId,
                vehiclesAttended: initialVehicles,
              );
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Staff member assigned successfully!'),
                backgroundColor: AppColors.success,
              ),
            );
          }
        },
      ),
    );
  }

  void _openEditShowroomSheet() {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => ShowroomFormSheet(
        showroom: _currentShowroom,
        onUpdate: (id, request) async {
          final updated = await ref
              .read(showroomsProvider.notifier)
              .updateShowroom(id, request);
          if (updated != null && mounted) {
            setState(() {
              _currentShowroom = updated;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Showroom updated successfully!'),
                backgroundColor: AppColors.success,
              ),
            );
          }
        },
      ),
    );
  }

  Future<void> _handleRemoveAssignment(DailyStaffAssignment assignment) async {
    try {
      await ref
          .read(dailyStaffProvider(_currentShowroom.id).notifier)
          .removeAssignment(assignment.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Staff assignment removed successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove assignment: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dailyState = ref.watch(dailyStaffProvider(_currentShowroom.id));
    final canAssignStaff = _hasPermission('showroom.assign_staff');
    final canManage = _hasPermission('showroom.manage');

    final dateHeading = DateFormat('dd MMM yyyy').format(dailyState.selectedDate);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          _currentShowroom.name,
          style: AppTextStyles.headingMedium.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
          overflow: TextOverflow.ellipsis,
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        actions: [
          IconButton(
            onPressed: () => ref
                .read(dailyStaffProvider(_currentShowroom.id).notifier)
                .loadDailyStaff(),
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textPrimary),
            tooltip: 'Refresh Roster',
          ),
          const AppLogoutAction(),
        ],
      ),
      floatingActionButton: canAssignStaff
          ? FloatingActionButton.extended(
              onPressed: () => _openAssignStaffSheet(dailyState),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.person_add_alt_1_outlined, color: Colors.white),
              label: const Text(
                'Assign Staff',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref
            .read(dailyStaffProvider(_currentShowroom.id).notifier)
            .loadDailyStaff(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // 1. Showroom Master Header Card
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withAlpha(4),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: _currentShowroom.isActive
                              ? AppColors.primary.withAlpha(25)
                              : AppColors.surface,
                          child: Text(
                            _currentShowroom.initials,
                            style: AppTextStyles.headingSmall.copyWith(
                              color: _currentShowroom.isActive
                                  ? AppColors.primary
                                  : AppColors.textSecondary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _currentShowroom.name,
                                style: AppTextStyles.headingSmall.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.location_on_outlined,
                                    size: 13,
                                    color: AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      _currentShowroom.address,
                                      style: AppTextStyles.bodySmall.copyWith(
                                        color: AppColors.textSecondary,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        StatusBadge(
                          label: _currentShowroom.isActive ? 'Active' : 'Inactive',
                          type: _currentShowroom.isActive
                              ? StatusType.completed
                              : StatusType.cancelled,
                          isCompact: true,
                        ),
                        if (canManage) ...[
                          const SizedBox(width: 4),
                          IconButton(
                            onPressed: _openEditShowroomSheet,
                            icon: const Icon(Icons.edit_outlined, size: 16),
                            color: AppColors.textSecondary,
                            tooltip: 'Edit Showroom',
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ],
                    ),
                    if (_currentShowroom.phone != null &&
                        _currentShowroom.phone!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(
                            Icons.phone_outlined,
                            size: 13,
                            color: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _currentShowroom.phone!,
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w500,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // 2. Interactive Date Selector
            SliverToBoxAdapter(
              child: ShowroomDateSelector(
                selectedDate: dailyState.selectedDate,
                onDateSelected: (newDate) {
                  ref
                      .read(dailyStaffProvider(_currentShowroom.id).notifier)
                      .setDate(newDate);
                },
              ),
            ),

            // 3. Daily Summary Metrics Banner
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Row(
                  children: [
                    _buildMetricCard(
                      title: 'Staff on Duty',
                      value: '${dailyState.totalStaffCount}',
                      icon: Icons.people_alt_outlined,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 8),
                    _buildMetricCard(
                      title: 'Vehicles Attended',
                      value: '${dailyState.totalVehiclesAttended}',
                      icon: Icons.directions_car_outlined,
                      color: AppColors.info,
                    ),
                  ],
                ),
              ),
            ),

            // 4. Section Heading: "Staff on Duty"
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Staff on Duty',
                          style: AppTextStyles.headingSmall.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withAlpha(25),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${dailyState.totalStaffCount}',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Text(
                      dateHeading,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 5. Daily Staff Assignments List / States
            if (dailyState.isLoading)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(32.0),
                    child: CircularProgressIndicator(),
                  ),
                ),
              )
            else if (dailyState.errorMessage != null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                        const SizedBox(height: 12),
                        Text(
                          dailyState.errorMessage!,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.bodyMedium.copyWith(color: AppColors.error),
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton.icon(
                          onPressed: () => ref
                              .read(dailyStaffProvider(_currentShowroom.id).notifier)
                              .loadDailyStaff(),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Try Again'),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else if (dailyState.staffAssignments.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: AppEmptyState(
                    title: 'No staff assigned for $dateHeading',
                    message:
                        'Tap "+ Assign Staff" below to schedule staff members to this showroom for this date.',
                    icon: Icons.people_outline,
                    actionLabel: canAssignStaff ? 'Assign Staff' : null,
                    onAction: canAssignStaff
                        ? () => _openAssignStaffSheet(dailyState)
                        : null,
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.only(bottom: 88, top: 2),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (itemContext, index) {
                      final assignment = dailyState.staffAssignments[index];
                      return DailyStaffAssignmentCard(
                        assignment: assignment,
                        canManage: canAssignStaff,
                        onRemove: () => _handleRemoveAssignment(assignment),
                      );
                    },
                    childCount: dailyState.staffAssignments.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(4),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withAlpha(20),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: AppTextStyles.headingSmall.copyWith(
                      fontWeight: FontWeight.w800,
                      color: color,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
