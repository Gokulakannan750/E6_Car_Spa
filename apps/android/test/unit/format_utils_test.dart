import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/utils/format_utils.dart';
import 'package:e6_car_spa/features/settings/models/system_preferences_model.dart';

void main() {
  group('FormatUtils Tests', () {
    test('formatCurrency formats with default Rupee symbol and 2 decimals', () {
      expect(FormatUtils.formatCurrency(1250.5), '₹1,250.50');
      expect(FormatUtils.formatCurrency(500), '₹500.00');
    });

    test(
      'formatCurrency formats with 0 decimal precision and Rupee symbol',
      () {
        const prefs = SystemPreferencesModel(decimalPrecision: 0);

        expect(FormatUtils.formatCurrency(1250.5, prefs), '₹1,251');
        expect(FormatUtils.formatCurrency(500, prefs), '₹500');
      },
    );

    test('formatDate formats DD/MM/YYYY, MM/DD/YYYY, and YYYY-MM-DD', () {
      final date = DateTime(2026, 9, 27);

      expect(
        FormatUtils.formatDate(
          date,
          const SystemPreferencesModel(dateFormat: 'DD/MM/YYYY'),
        ),
        '27/09/2026',
      );
      expect(
        FormatUtils.formatDate(
          date,
          const SystemPreferencesModel(dateFormat: 'MM/DD/YYYY'),
        ),
        '09/27/2026',
      );
      expect(
        FormatUtils.formatDate(
          date,
          const SystemPreferencesModel(dateFormat: 'YYYY-MM-DD'),
        ),
        '2026-09-27',
      );
    });

    test('formatTime formats 12h and 24h formats', () {
      final time = DateTime(2026, 9, 27, 14, 30);

      expect(
        FormatUtils.formatTime(
          time,
          const SystemPreferencesModel(timeFormat: '12h'),
        ),
        '02:30 PM',
      );
      expect(
        FormatUtils.formatTime(
          time,
          const SystemPreferencesModel(timeFormat: '24h'),
        ),
        '14:30',
      );
    });

    test('formatDateTime formats combined timestamp', () {
      final dt = DateTime(2026, 9, 27, 14, 30);
      expect(
        FormatUtils.formatDateTime(
          dt,
          const SystemPreferencesModel(
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '12h',
          ),
        ),
        '27/09/2026 02:30 PM',
      );
    });
  });
}
