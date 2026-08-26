import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../jobcards/data/job_card_repository.dart';
import '../../jobcards/models/job_card_model.dart';
import '../../reports/data/reports_repository.dart';
import '../../reports/models/report_dashboard_model.dart';

/// Provider for the Authoritative Dashboard Summary from GET /api/reports/dashboard
final dashboardSummaryProvider = FutureProvider.autoDispose<DashboardSummaryModel>((ref) async {
  final reportsRepository = ref.watch(reportsRepositoryProvider);
  return reportsRepository.getDashboardSummary();
});

/// Provider for Recent 5 Job Cards from GET /api/job-cards?page=1&pageSize=5
final dashboardRecentJobsProvider = FutureProvider.autoDispose<JobCardListResponse>((ref) async {
  final jobCardRepository = ref.watch(jobCardRepositoryProvider);
  return jobCardRepository.getJobCards(page: 1, pageSize: 5);
});
