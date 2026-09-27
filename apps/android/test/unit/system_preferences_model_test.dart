import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/settings/models/system_preferences_model.dart';

void main() {
  group('SystemPreferencesModel Contract & Serialization Tests', () {
    test('defaultPreferences provides canonical synchronized defaults', () {
      const defaults = SystemPreferencesModel.defaultPreferences;

      expect(defaults.dateFormat, 'DD/MM/YYYY');
      expect(defaults.timeFormat, '12h');
      expect(defaults.currencySymbol, '₹');
      expect(defaults.decimalPrecision, 2);
      expect(defaults.defaultPrintCopies, 1);
      expect(defaults.autoPrintReceipt, true);
      expect(defaults.refreshInterval, 30);
    });

    test('fromJson deserializes all canonical keys accurately and migrates legacy currency to INR', () {
      final json = {
        'dateFormat': 'YYYY-MM-DD',
        'timeFormat': '24h',
        'currencySymbol': '\$',
        'decimalPrecision': 0,
        'defaultPrintCopies': 3,
        'autoPrintReceipt': false,
        'refreshInterval': 60,
      };

      final model = SystemPreferencesModel.fromJson(json);

      expect(model.dateFormat, 'YYYY-MM-DD');
      expect(model.timeFormat, '24h');
      expect(model.currencySymbol, '₹'); // Strict INR migration
      expect(model.decimalPrecision, 0);
      expect(model.defaultPrintCopies, 3);
      expect(model.autoPrintReceipt, false);
      expect(model.refreshInterval, 60);
    });

    test('toJson produces exact camelCase keys for backend contract parity with strict INR', () {
      const model = SystemPreferencesModel(
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '24h',
        currencySymbol: '₹',
        decimalPrecision: 0,
        defaultPrintCopies: 2,
        autoPrintReceipt: false,
        refreshInterval: 15,
      );

      final json = model.toJson();

      expect(json['dateFormat'], 'MM/DD/YYYY');
      expect(json['timeFormat'], '24h');
      expect(json['currencySymbol'], '₹');
      expect(json['decimalPrecision'], 0);
      expect(json['defaultPrintCopies'], 2);
      expect(json['autoPrintReceipt'], false);
      expect(json['refreshInterval'], 15);
    });

    test('copyWith updates specified fields only', () {
      const model = SystemPreferencesModel.defaultPreferences;
      final updated = model.copyWith(
        currencySymbol: '€',
        decimalPrecision: 0,
        refreshInterval: 0,
      );

      expect(updated.currencySymbol, '€');
      expect(updated.decimalPrecision, 0);
      expect(updated.refreshInterval, 0);
      expect(updated.dateFormat, 'DD/MM/YYYY');
      expect(updated.timeFormat, '12h');
    });

    test('equality and hashCode evaluate properly', () {
      const modelA = SystemPreferencesModel(
        dateFormat: 'DD/MM/YYYY',
        currencySymbol: '₹',
      );
      const modelB = SystemPreferencesModel(
        dateFormat: 'DD/MM/YYYY',
        currencySymbol: '₹',
      );
      const modelC = SystemPreferencesModel(
        dateFormat: 'YYYY-MM-DD',
        currencySymbol: '₹',
      );

      expect(modelA, equals(modelB));
      expect(modelA.hashCode, equals(modelB.hashCode));
      expect(modelA, isNot(equals(modelC)));
    });
  });
}
