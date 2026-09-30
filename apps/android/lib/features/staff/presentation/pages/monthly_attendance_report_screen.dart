import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../config/routes.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import 'monthly_attendance_report_tab.dart';

/// Dedicated screen wrapper for the Monthly Attendance Report.
/// Preserves deep link `/staff/monthly-report` routing outside the primary Staff Suite TabBar.
class MonthlyAttendanceReportScreen extends StatelessWidget {
  const MonthlyAttendanceReportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Monthly Attendance Report'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          tooltip: 'Back',
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.staff);
            }
          },
        ),
        actions: const [AppLogoutAction()],
      ),
      body: const MonthlyAttendanceReportTab(),
    );
  }
}
