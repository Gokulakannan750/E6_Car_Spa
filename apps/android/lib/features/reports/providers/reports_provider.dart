import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/reports_repository.dart';
import '../models/report_dashboard_model.dart';
import '../models/sales_report_model.dart';
import '../models/payment_report_model.dart';
import '../models/outstanding_invoice_model.dart';
import '../models/gst_report_model.dart';
import '../models/job_card_report_model.dart';
import '../models/showroom_report_model.dart';
import '../models/staff_productivity_report_model.dart';
import '../models/staff_advances_report_model.dart';

enum ReportDatePreset {
  sevenDays,
  thirtyDays,
  thisMonth,
  lastMonth,
  ytd,
  custom,
}

class ReportDateFilterState {
  final ReportDatePreset preset;
  final DateTime startDate;
  final DateTime endDate;
  final String label;

  const ReportDateFilterState({
    required this.preset,
    required this.startDate,
    required this.endDate,
    required this.label,
  });

  static ReportDateFilterState fromPreset(
    ReportDatePreset preset, {
    DateTime? customStart,
    DateTime? customEnd,
  }) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    switch (preset) {
      case ReportDatePreset.sevenDays:
        final start = today.subtract(const Duration(days: 6));
        return ReportDateFilterState(
          preset: preset,
          startDate: start,
          endDate: today,
          label: 'Last 7 Days',
        );
      case ReportDatePreset.thirtyDays:
        final start = today.subtract(const Duration(days: 29));
        return ReportDateFilterState(
          preset: preset,
          startDate: start,
          endDate: today,
          label: 'Last 30 Days',
        );
      case ReportDatePreset.thisMonth:
        final start = DateTime(now.year, now.month, 1);
        return ReportDateFilterState(
          preset: preset,
          startDate: start,
          endDate: today,
          label: 'This Month',
        );
      case ReportDatePreset.lastMonth:
        final start = DateTime(now.year, now.month - 1, 1);
        final end = DateTime(now.year, now.month, 0);
        return ReportDateFilterState(
          preset: preset,
          startDate: start,
          endDate: end,
          label: 'Last Month',
        );
      case ReportDatePreset.ytd:
        final start = DateTime(now.year, 1, 1);
        return ReportDateFilterState(
          preset: preset,
          startDate: start,
          endDate: today,
          label: 'Year to Date',
        );
      case ReportDatePreset.custom:
        final start = customStart ?? DateTime(now.year, now.month, 1);
        final end = customEnd ?? today;
        return ReportDateFilterState(
          preset: preset,
          startDate: start,
          endDate: end,
          label: 'Custom Range',
        );
    }
  }

  ReportDateFilterState copyWith({
    ReportDatePreset? preset,
    DateTime? startDate,
    DateTime? endDate,
    String? label,
  }) {
    return ReportDateFilterState(
      preset: preset ?? this.preset,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      label: label ?? this.label,
    );
  }
}

class ReportDateFilterNotifier extends StateNotifier<ReportDateFilterState> {
  ReportDateFilterNotifier()
      : super(ReportDateFilterState.fromPreset(ReportDatePreset.thirtyDays));

  void setPreset(ReportDatePreset preset) {
    state = ReportDateFilterState.fromPreset(preset);
  }

  void setCustomRange(DateTime start, DateTime end) {
    state = ReportDateFilterState.fromPreset(
      ReportDatePreset.custom,
      customStart: start,
      customEnd: end,
    );
  }
}

final reportDateFilterProvider =
    StateNotifierProvider<ReportDateFilterNotifier, ReportDateFilterState>((ref) {
  return ReportDateFilterNotifier();
});

/// 1. Dashboard Summary Provider
final reportsDashboardProvider = FutureProvider.autoDispose<DashboardSummaryModel>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final filter = ref.watch(reportDateFilterProvider);

  return repository.getDashboardSummary(
    fromDate: filter.startDate,
    toDate: filter.endDate,
  );
});

/// 2. Sales Report Provider
final salesReportProvider = FutureProvider.autoDispose<SalesReportResponseModel>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final filter = ref.watch(reportDateFilterProvider);

  return repository.getSalesReport(
    fromDate: filter.startDate,
    toDate: filter.endDate,
    page: 1,
    pageSize: 100,
  );
});

/// 3. Payment Collection Report Provider
final paymentsReportProvider = FutureProvider.autoDispose<PaymentReportResponseModel>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final filter = ref.watch(reportDateFilterProvider);

  return repository.getPaymentCollectionReport(
    fromDate: filter.startDate,
    toDate: filter.endDate,
    includeVoided: true,
    page: 1,
    pageSize: 100,
  );
});

/// 4. Outstanding Invoices Report Provider
final outstandingInvoicesProvider = FutureProvider.autoDispose<OutstandingInvoiceReportResponseModel>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final filter = ref.watch(reportDateFilterProvider);

  return repository.getOutstandingInvoicesReport(
    fromDate: filter.startDate,
    toDate: filter.endDate,
    page: 1,
    pageSize: 100,
  );
});

/// 5. GST Report Provider
final gstReportProvider = FutureProvider.autoDispose<GstReportModel>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final filter = ref.watch(reportDateFilterProvider);

  return repository.getGstReport(
    fromDate: filter.startDate,
    toDate: filter.endDate,
  );
});

/// 6. Job Cards Report Provider
final jobCardsReportProvider = FutureProvider.autoDispose<JobCardReportResponseModel>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final filter = ref.watch(reportDateFilterProvider);

  return repository.getJobCardReport(
    fromDate: filter.startDate,
    toDate: filter.endDate,
    page: 1,
    pageSize: 100,
  );
});

/// 7. Showrooms Report Provider
final showroomReportProvider = FutureProvider.autoDispose<ShowroomReportResponseModel>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final filter = ref.watch(reportDateFilterProvider);

  return repository.getShowroomReport(
    fromDate: filter.startDate,
    toDate: filter.endDate,
    page: 1,
    pageSize: 100,
  );
});

/// 8. Staff Productivity Report Provider
final staffProductivityProvider = FutureProvider.autoDispose<StaffProductivityReportResponseModel>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final filter = ref.watch(reportDateFilterProvider);

  return repository.getStaffProductivityReport(
    fromDate: filter.startDate,
    toDate: filter.endDate,
  );
});

/// 9. Staff Advances Report Provider
final staffAdvancesReportProvider = FutureProvider.autoDispose<StaffAdvanceReportResponseModel>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final filter = ref.watch(reportDateFilterProvider);

  return repository.getStaffAdvancesReport(
    fromDate: filter.startDate,
    toDate: filter.endDate,
    page: 1,
    pageSize: 100,
  );
});
