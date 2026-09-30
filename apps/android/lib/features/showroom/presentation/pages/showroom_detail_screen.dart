import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../../core/utils/auto_refresh_mixin.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../settings/providers/system_preferences_provider.dart';
import '../../models/showroom_model.dart';
import '../../models/showroom_staff_assignment_model.dart';
import '../../providers/daily_staff_provider.dart';
import '../../providers/showroom_billing_provider.dart';
import '../../providers/showroom_operations_provider.dart';
import '../../providers/showroom_provider.dart';
import '../widgets/assign_staff_modal_sheet.dart';
import '../widgets/edit_staff_session_modal_sheet.dart';
import '../widgets/log_vehicle_work_modal_sheet.dart';
import '../widgets/showroom_attendance_tab.dart';
import '../widgets/showroom_billing_tab.dart';
import '../widgets/showroom_date_selector.dart';
import '../widgets/showroom_form_sheet.dart';
import '../widgets/showroom_operations_tab.dart';
import '../widgets/swap_staff_modal_sheet.dart';
import '../widgets/swap_details_modal_sheet.dart';
import '../widgets/showroom_swap_history_modal_sheet.dart';

class ShowroomDetailScreen extends ConsumerStatefulWidget {
  final Showroom showroom;

  const ShowroomDetailScreen({super.key, required this.showroom});

  @override
  ConsumerState<ShowroomDetailScreen> createState() =>
      _ShowroomDetailScreenState();
}

class _ShowroomDetailScreenState extends ConsumerState<ShowroomDetailScreen>
    with
        SingleTickerProviderStateMixin,
        WidgetsBindingObserver,
        AutoRefreshMixin<ShowroomDetailScreen> {
  late Showroom _currentShowroom;
  late final TabController _tabController;

  @override
  void onAutoRefresh() {
    ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
    final id = _currentShowroom.id;
    if (_tabController.index == 0) {
      ref.read(dailyStaffProvider(id).notifier).loadDailyStaff(silent: true);
    } else if (_tabController.index == 1) {
      ref
          .read(showroomOperationsProvider(id).notifier)
          .loadOperationsData(silent: true);
    } else if (_tabController.index == 2) {
      ref
          .read(showroomBillingProvider(id).notifier)
          .loadDailyBill(silent: true);
    }
  }

  static const List<Tab> _tabs = [
    Tab(icon: Icon(Icons.fact_check_outlined, size: 18), text: 'Attendance'),
    Tab(
      icon: Icon(Icons.directions_car_outlined, size: 18),
      text: 'Operations',
    ),
    Tab(icon: Icon(Icons.receipt_long_outlined, size: 18), text: 'Billing'),
  ];

  @override
  void initState() {
    super.initState();
    _currentShowroom = widget.showroom;
    _tabController = TabController(length: _tabs.length, vsync: this);
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  bool _hasPermission(String permission) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return false;
    if (user.isOwner) return true;
    return user.hasPermission(permission);
  }

  void _openAssignStaffSheet(DailyStaffState dailyState) {
    final assignedStaffIds = dailyState.staffAssignments
        .map((a) => a.staffId)
        .toSet();

    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => AssignStaffModalSheet(
        showroomId: _currentShowroom.id,
        showroomName: _currentShowroom.name,
        selectedDate: dailyState.selectedDate,
        alreadyAssignedStaffIds: assignedStaffIds,
        onAssign:
            ({
              required staffId,
              required startTime,
              required endTime,
              required assignmentType,
              transferReason,
              notes,
            }) async {
              await ref
                  .read(dailyStaffProvider(_currentShowroom.id).notifier)
                  .assignWorkSession(
                    staffId: staffId,
                    startTime: startTime,
                    endTime: endTime,
                    assignmentType: assignmentType,
                    transferReason: transferReason,
                    notes: notes,
                  );
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Staff work session assigned successfully!'),
                    backgroundColor: AppColors.success,
                  ),
                );
              }
            },
      ),
    );
  }

  void _openEditStaffSessionSheet(DailyStaffAssignment assignment) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => EditStaffSessionModalSheet(
        assignment: assignment,
        showroomName: _currentShowroom.name,
        onUpdate:
            ({
              required startTime,
              required endTime,
              status,
              transferReason,
              notes,
            }) async {
              await ref
                  .read(dailyStaffProvider(_currentShowroom.id).notifier)
                  .updateWorkSession(
                    assignmentId: assignment.id,
                    startTime: startTime,
                    endTime: endTime,
                    status: status,
                    transferReason: transferReason,
                    notes: notes,
                  );
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Work session updated successfully!'),
                    backgroundColor: AppColors.success,
                  ),
                );
              }
            },
      ),
    );
  }

  void _openLogVehicleWorkSheet() {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => LogVehicleWorkModalSheet(
        showroomId: _currentShowroom.id,
        showroomName: _currentShowroom.name,
        selectedDate: ref
            .read(dailyStaffProvider(_currentShowroom.id))
            .selectedDate,
      ),
    ).then((result) {
      if (result == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Vehicle work logged successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    });
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
            content: Text('Staff work session removed successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove work session: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _confirmSubmitAttendance() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(
          'Confirm Attendance?',
          style: AppTextStyles.headingSmall.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        content: const Text(
          'Once attendance is confirmed, staff work sessions and schedule timings for this day cannot be edited.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          FilledButton(
            key: const Key('confirm_dialog_confirm_button'),
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm Attendance'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        await ref
            .read(dailyStaffProvider(_currentShowroom.id).notifier)
            .confirmAttendance();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Attendance confirmed successfully!'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          final msg = e is ApiException
              ? e.message
              : 'Failed to confirm attendance: $e';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(msg), backgroundColor: AppColors.error),
          );
        }
      }
    }
  }

  Future<void> _confirmUnlockAttendance() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(
          'Unlock Attendance for Correction?',
          style: AppTextStyles.headingSmall.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        content: const Text(
          'Unlocking will reopen attendance and vehicle counts for editing. You will need to confirm attendance again when finished.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          FilledButton(
            key: const Key('unlock_dialog_confirm_button'),
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Unlock Attendance'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        await ref
            .read(dailyStaffProvider(_currentShowroom.id).notifier)
            .unlockAttendance();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Attendance unlocked for correction.'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          final msg = e is ApiException
              ? e.message
              : 'Failed to unlock attendance: $e';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(msg), backgroundColor: AppColors.error),
          );
        }
      }
    }
  }

  void _openSwapStaffSheet(
    DailyStaffState dailyState, [
    DailyStaffAssignment? assignment,
  ]) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => SwapStaffModalSheet(
        showroomId: _currentShowroom.id,
        showroomName: _currentShowroom.name,
        selectedDate: dailyState.selectedDate,
        initialStaffA: assignment,
        currentShowroomStaff: dailyState.staffAssignments,
      ),
    );
  }

  void _openSwapDetailsSheet(String swapId, bool canReverse) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => SwapDetailsModalSheet(
        showroomId: _currentShowroom.id,
        swapId: swapId,
        canReverse: canReverse,
      ),
    );
  }

  void _openSwapHistorySheet(bool canReverse) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => ShowroomSwapHistoryModalSheet(
        showroomId: _currentShowroom.id,
        showroomName: _currentShowroom.name,
        canReverse: canReverse,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final preferences = ref.watch(systemPreferencesProvider);
    syncRefreshTimerWithPreferences(preferences.refreshInterval);

    final allShowrooms = ref.watch(showroomsProvider).showrooms;
    final updated = allShowrooms
        .where((s) => s.id == widget.showroom.id)
        .firstOrNull;
    if (updated != null) {
      _currentShowroom = updated;
    }

    final dailyState = ref.watch(dailyStaffProvider(_currentShowroom.id));
    final canAssignStaff = _hasPermission('showroom.assign_staff');
    final canConfirmAttendance = _hasPermission('showroom.confirm_attendance');
    final canManage = _hasPermission('showroom.manage');
    final user = ref.watch(currentUserProvider);
    final isOwner = user?.isOwner ?? false;
    final canLogWork = canAssignStaff || canManage || isOwner;
    final isLocked = dailyState.isAttendanceConfirmed;

    // FAB selection based on active tab
    Widget? activeFab;
    if (_tabController.index == 0 && canAssignStaff && !isLocked) {
      activeFab = FloatingActionButton.extended(
        key: const Key('assign_staff_fab'),
        onPressed: () => _openAssignStaffSheet(dailyState),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.person_add_alt_1_outlined, color: Colors.white),
        label: const Text(
          'Assign Staff',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      );
    } else if (_tabController.index == 1 && canLogWork) {
      activeFab = FloatingActionButton.extended(
        key: const Key('log_vehicle_work_fab'),
        onPressed: _openLogVehicleWorkSheet,
        backgroundColor: AppColors.primary,
        icon: const Icon(
          Icons.directions_car_filled_outlined,
          color: Colors.white,
        ),
        label: const Text(
          'Log Vehicle Work',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      );
    }

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
            onPressed: () {
              ref
                  .read(dailyStaffProvider(_currentShowroom.id).notifier)
                  .loadDailyStaff();
              ref
                  .read(
                    showroomOperationsProvider(_currentShowroom.id).notifier,
                  )
                  .loadOperationsData();
              ref
                  .read(showroomBillingProvider(_currentShowroom.id).notifier)
                  .refresh();
            },
            icon: const Icon(
              Icons.refresh_rounded,
              color: AppColors.textPrimary,
            ),
            tooltip: 'Refresh',
          ),
          const AppLogoutAction(),
        ],
      ),
      floatingActionButton: activeFab,
      body: Column(
        children: [
          // 1. Compact Showroom Master Header Card
          Container(
            margin: const EdgeInsets.fromLTRB(16, 10, 16, 4),
            padding: const EdgeInsets.all(12),
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
                      radius: 18,
                      backgroundColor: _currentShowroom.isActive
                          ? AppColors.primary.withAlpha(25)
                          : AppColors.surfaceAlt,
                      child: Text(
                        _currentShowroom.initials,
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: _currentShowroom.isActive
                              ? AppColors.primary
                              : AppColors.textSecondary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _currentShowroom.name,
                            style: AppTextStyles.bodyLarge.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(
                                Icons.location_on_outlined,
                                size: 12,
                                color: AppColors.textSecondary,
                              ),
                              const SizedBox(width: 3),
                              Expanded(
                                child: Text(
                                  _currentShowroom.address,
                                  style: AppTextStyles.bodySmall.copyWith(
                                    color: AppColors.textSecondary,
                                    fontSize: 11,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
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
                      const SizedBox(width: 2),
                      IconButton(
                        onPressed: _openEditShowroomSheet,
                        icon: const Icon(Icons.edit_outlined, size: 15),
                        color: AppColors.textSecondary,
                        tooltip: 'Edit Showroom',
                        visualDensity: VisualDensity.compact,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (_currentShowroom.phone != null &&
                        _currentShowroom.phone!.isNotEmpty)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.phone_outlined,
                            size: 12,
                            color: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _currentShowroom.phone!,
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textPrimary,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    if (_currentShowroom.phone != null &&
                        _currentShowroom.phone!.isNotEmpty &&
                        _currentShowroom.gstin != null &&
                        _currentShowroom.gstin!.trim().isNotEmpty)
                      const Text(
                        '•',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    if (_currentShowroom.gstin != null &&
                        _currentShowroom.gstin!.trim().isNotEmpty)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.receipt_outlined,
                            size: 12,
                            color: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'GSTIN: ${_currentShowroom.gstin!}',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textPrimary,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    if (_currentShowroom.gstin != null &&
                        _currentShowroom.gstin!.trim().isNotEmpty)
                      const Text(
                        '•',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.calendar_today_outlined,
                          size: 11,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          'Since ${DateFormat('MMM yyyy').format(_currentShowroom.createdAt)}',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontSize: 10.5,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          // 2. Shared Interactive Date Selector
          ShowroomDateSelector(
            selectedDate: dailyState.selectedDate,
            onDateSelected: (newDate) {
              ref
                  .read(dailyStaffProvider(_currentShowroom.id).notifier)
                  .setDate(newDate);
              ref
                  .read(
                    showroomOperationsProvider(_currentShowroom.id).notifier,
                  )
                  .setDate(newDate);
              ref
                  .read(showroomBillingProvider(_currentShowroom.id).notifier)
                  .setDate(newDate);
            },
          ),

          // 3. Workspace TabBar
          Container(
            color: Colors.white,
            child: TabBar(
              controller: _tabController,
              indicatorColor: AppColors.primary,
              indicatorWeight: 2.5,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textSecondary,
              labelStyle: AppTextStyles.bodySmall.copyWith(
                fontWeight: FontWeight.w700,
              ),
              unselectedLabelStyle: AppTextStyles.bodySmall.copyWith(
                fontWeight: FontWeight.w500,
              ),
              tabs: _tabs,
            ),
          ),

          // 4. TabBar Content Views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Tab 1: Attendance
                ShowroomAttendanceTab(
                  showroomId: _currentShowroom.id,
                  canAssignStaff: canAssignStaff,
                  canConfirmAttendance: canConfirmAttendance,
                  isOwner: isOwner,
                  onOpenAssignStaffSheet: () =>
                      _openAssignStaffSheet(dailyState),
                  onOpenEditStaffSessionSheet: _openEditStaffSessionSheet,
                  onRemoveAssignment: _handleRemoveAssignment,
                  onOpenSwapStaffSheet: (assignment) =>
                      _openSwapStaffSheet(dailyState, assignment),
                  onOpenSwapDetailsSheet: (swapId) => _openSwapDetailsSheet(
                    swapId,
                    !isLocked && (isOwner || canAssignStaff),
                  ),
                  onOpenSwapHistorySheet: () => _openSwapHistorySheet(
                    !isLocked && (isOwner || canAssignStaff),
                  ),
                  onConfirmSubmitAttendance: _confirmSubmitAttendance,
                  onConfirmUnlockAttendance: _confirmUnlockAttendance,
                ),

                // Tab 2: Operations
                ShowroomOperationsTab(
                  showroomId: _currentShowroom.id,
                  showroomName: _currentShowroom.name,
                  selectedDate: dailyState.selectedDate,
                  canLogWork: canLogWork,
                  onOpenLogWorkSheet: _openLogVehicleWorkSheet,
                ),

                // Tab 3: Billing
                ShowroomBillingTab(
                  showroom: _currentShowroom,
                  selectedDate: dailyState.selectedDate,
                  onSelectDate: (newDate) {
                    ref
                        .read(dailyStaffProvider(_currentShowroom.id).notifier)
                        .setDate(newDate);
                    ref
                        .read(
                          showroomOperationsProvider(
                            _currentShowroom.id,
                          ).notifier,
                        )
                        .setDate(newDate);
                    ref
                        .read(
                          showroomBillingProvider(_currentShowroom.id).notifier,
                        )
                        .setDate(newDate);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
