import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/reports/providers/reports_provider.dart';

void main() {
  group('Reports Provider & Date Filter Tests', () {
    test('ReportDateFilterState computes correct date ranges for presets', () {
      final state7d = ReportDateFilterState.fromPreset(ReportDatePreset.sevenDays);
      expect(state7d.label, 'Last 7 Days');
      expect(state7d.endDate.difference(state7d.startDate).inDays, 6);

      final state30d = ReportDateFilterState.fromPreset(ReportDatePreset.thirtyDays);
      expect(state30d.label, 'Last 30 Days');
      expect(state30d.endDate.difference(state30d.startDate).inDays, 29);

      final stateMonth = ReportDateFilterState.fromPreset(ReportDatePreset.thisMonth);
      expect(stateMonth.label, 'This Month');
      expect(stateMonth.startDate.day, 1);

      final stateYtd = ReportDateFilterState.fromPreset(ReportDatePreset.ytd);
      expect(stateYtd.label, 'Year to Date');
      expect(stateYtd.startDate.month, 1);
      expect(stateYtd.startDate.day, 1);

      final customStart = DateTime(2026, 5, 1);
      final customEnd = DateTime(2026, 5, 15);
      final stateCustom = ReportDateFilterState.fromPreset(
        ReportDatePreset.custom,
        customStart: customStart,
        customEnd: customEnd,
      );
      expect(stateCustom.label, 'Custom Range');
      expect(stateCustom.startDate, customStart);
      expect(stateCustom.endDate, customEnd);
    });

    test('ReportDateFilterNotifier updates presets and custom ranges', () {
      final notifier = ReportDateFilterNotifier();

      expect(notifier.state.preset, ReportDatePreset.thirtyDays);

      notifier.setPreset(ReportDatePreset.sevenDays);
      expect(notifier.state.preset, ReportDatePreset.sevenDays);
      expect(notifier.state.label, 'Last 7 Days');

      notifier.setCustomRange(DateTime(2026, 1, 1), DateTime(2026, 1, 31));
      expect(notifier.state.preset, ReportDatePreset.custom);
      expect(notifier.state.startDate, DateTime(2026, 1, 1));
      expect(notifier.state.endDate, DateTime(2026, 1, 31));
    });
  });
}
