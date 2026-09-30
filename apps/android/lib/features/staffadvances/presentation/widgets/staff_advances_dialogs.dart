import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../staff/models/staff_model.dart';
import '../../../staff/presentation/widgets/add_edit_staff_bottom_sheet.dart';
import '../../../staff/providers/staff_provider.dart';
import '../../models/staff_advance_model.dart';
import '../../providers/staff_advances_provider.dart';
import 'create_advance_bottom_sheet.dart';
import 'obsolete_advance_bottom_sheet.dart';
import 'settle_advance_dialog.dart';
import 'staff_advance_history_sheet.dart';

/// Reusable modal sheets and dialogs for Staff Advances operations.
class StaffAdvancesDialogs {
  const StaffAdvancesDialogs._();

  static void showCreateAdvanceSheet(
    BuildContext context,
    WidgetRef ref,
    List<Staff> activeStaff, {
    String? initialStaffId,
  }) {
    final messenger = ScaffoldMessenger.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return CreateAdvanceBottomSheet(
          activeStaff: activeStaff,
          initialStaffId: initialStaffId,
          onSubmit: (request) async {
            final error = await ref
                .read(staffAdvancesProvider.notifier)
                .createAdvance(request);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff advance disbursed successfully!'),
                  backgroundColor: AppColors.success,
                ),
              );
            }
            return error;
          },
        );
      },
    );
  }

  static void showSettleDialog(
    BuildContext context,
    WidgetRef ref,
    StaffAdvance advance,
  ) {
    final messenger = ScaffoldMessenger.of(context);
    showDialog(
      context: context,
      builder: (context) {
        return SettleAdvanceDialog(
          advance: advance,
          onSettle: (advanceId) async {
            final error = await ref
                .read(staffAdvancesProvider.notifier)
                .settleAdvance(advanceId);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff advance settled successfully!'),
                  backgroundColor: AppColors.success,
                ),
              );
            }
            return error;
          },
        );
      },
    );
  }

  static void showObsoleteSheet(
    BuildContext context,
    WidgetRef ref,
    StaffAdvance advance,
  ) {
    final messenger = ScaffoldMessenger.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return ObsoleteAdvanceBottomSheet(
          advance: advance,
          onObsolete: (advanceId, reason) async {
            final error = await ref
                .read(staffAdvancesProvider.notifier)
                .obsoleteAdvance(advanceId, reason);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff advance marked obsolete.'),
                  backgroundColor: AppColors.error,
                ),
              );
            }
            return error;
          },
        );
      },
    );
  }

  static void showHistorySheet(
    BuildContext context,
    String staffId,
    String staffName,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StaffAdvanceHistorySheet(staffId: staffId, staffName: staffName);
      },
    );
  }

  static void showAddEditStaffSheet(
    BuildContext context,
    WidgetRef ref, [
    Staff? staff,
  ]) {
    final messenger = ScaffoldMessenger.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return AddEditStaffBottomSheet(
          staff: staff,
          onCreate: (request) async {
            final error = await ref
                .read(staffProvider.notifier)
                .createStaff(request);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff member added successfully!'),
                  backgroundColor: AppColors.success,
                ),
              );
            }
            return error;
          },
          onUpdate: (staffId, request) async {
            final error = await ref
                .read(staffProvider.notifier)
                .updateStaff(staffId, request);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff member updated successfully!'),
                  backgroundColor: AppColors.success,
                ),
              );
            }
            return error;
          },
        );
      },
    );
  }
}
