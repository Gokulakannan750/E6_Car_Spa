import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/utils/uppercase_formatter.dart';

void main() {
  group('UpperCaseTextFormatter Unit Tests', () {
    const formatter = UpperCaseTextFormatter();

    test('transforms lowercase characters to uppercase', () {
      const oldValue = TextEditingValue(text: '');
      const newValue = TextEditingValue(
        text: 'tn11as1123',
        selection: TextSelection.collapsed(offset: 10),
      );

      final result = formatter.formatEditUpdate(oldValue, newValue);

      expect(result.text, 'TN11AS1123');
      expect(result.selection.baseOffset, 10);
      expect(result.selection.extentOffset, 10);
    });

    test('preserves uppercase, digits, and spaces', () {
      const oldValue = TextEditingValue(text: 'TN 11');
      const newValue = TextEditingValue(
        text: 'TN 11 as 1123',
        selection: TextSelection.collapsed(offset: 13),
      );

      final result = formatter.formatEditUpdate(oldValue, newValue);

      expect(result.text, 'TN 11 AS 1123');
      expect(result.selection.baseOffset, 13);
    });

    test('preserves cursor position during mid-text typing', () {
      const oldValue = TextEditingValue(
        text: 'TNAS1123',
        selection: TextSelection.collapsed(offset: 2),
      );
      const newValue = TextEditingValue(
        text: 'TN11AS1123',
        selection: TextSelection.collapsed(offset: 4),
      );

      final result = formatter.formatEditUpdate(oldValue, newValue);

      expect(result.text, 'TN11AS1123');
      expect(result.selection.baseOffset, 4);
    });
  });

  group('normalizeRegistration Unit Tests', () {
    test('returns empty string on null or empty input', () {
      expect(normalizeRegistration(null), '');
      expect(normalizeRegistration(''), '');
      expect(normalizeRegistration('   '), '');
    });

    test('trims whitespace and converts to uppercase', () {
      expect(normalizeRegistration('  tn11as1123  '), 'TN11AS1123');
      expect(normalizeRegistration('tn-56-p-3334'), 'TN-56-P-3334');
      expect(normalizeRegistration('ka 01 cd 5678'), 'KA 01 CD 5678');
      expect(normalizeRegistration('TN56P3334'), 'TN56P3334');
    });
  });
}
