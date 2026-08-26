import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/staff_advances_repository.dart';
import '../models/staff_advance_model.dart';

final staffAdvanceHistoryProvider =
    FutureProvider.family<StaffAdvanceHistory, String>((ref, staffId) async {
  final repository = ref.watch(staffAdvancesRepositoryProvider);
  try {
    return await repository.getStaffAdvanceHistory(staffId);
  } catch (e) {
    if (e is ApiException) {
      throw Exception(e.message);
    }
    throw Exception(e.toString());
  }
});
