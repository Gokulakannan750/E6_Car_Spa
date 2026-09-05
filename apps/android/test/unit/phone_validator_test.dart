import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/utils/phone_validator.dart';

void main() {
  group('PhoneValidator Unit Tests', () {
    test('10 digits valid number passes validation', () {
      expect(PhoneValidator.validate('9876543210', isRequired: true), isNull);
      expect(PhoneValidator.validate('9876543210', isRequired: false), isNull);
    });

    test('9 digits is invalid when required', () {
      final error = PhoneValidator.validate('987654321', isRequired: true);
      expect(error, isNotNull);
      expect(error, contains('must be exactly 10 digits'));
    });

    test('9 digits is invalid when optional but provided', () {
      final error = PhoneValidator.validate('987654321', isRequired: false);
      expect(error, isNotNull);
      expect(error, contains('must be exactly 10 digits'));
    });

    test('11 digits is invalid', () {
      final error = PhoneValidator.validate('98765432100', isRequired: true);
      expect(error, isNotNull);
      expect(error, contains('must be exactly 10 digits'));
    });

    test('alphabetic / special characters rejected', () {
      final errorAlpha = PhoneValidator.validate('98765abcde', isRequired: true);
      expect(errorAlpha, isNotNull);
      expect(errorAlpha, contains('must be exactly 10 digits'));

      final errorSymbols = PhoneValidator.validate('+9198765432', isRequired: true);
      expect(errorSymbols, isNotNull);
      expect(errorSymbols, contains('must be exactly 10 digits'));
    });

    test('empty string handled based on isRequired', () {
      expect(PhoneValidator.validate('', isRequired: true), contains('is required'));
      expect(PhoneValidator.validate(null, isRequired: true), contains('is required'));
      expect(PhoneValidator.validate('   ', isRequired: true), contains('is required'));

      expect(PhoneValidator.validate('', isRequired: false), isNull);
      expect(PhoneValidator.validate(null, isRequired: false), isNull);
      expect(PhoneValidator.validate('   ', isRequired: false), isNull);
    });

    test('PhoneValidator.clean strips non-digits and truncates to 10 chars', () {
      expect(PhoneValidator.clean('+91 98765-43210'), '9198765432');
      expect(PhoneValidator.clean('987654321012345'), '9876543210');
      expect(PhoneValidator.clean('abc'), '');
      expect(PhoneValidator.clean(null), '');
    });
  });
}
