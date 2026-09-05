import 'package:flutter/services.dart';

/// Centralized utility for validating and formatting 10-digit phone numbers in the Android app.
class PhoneValidator {
  PhoneValidator._();

  /// Regular expression matching exactly 10 digits.
  static final RegExp exact10DigitsRegex = RegExp(r'^\d{10}$');

  /// Input formatters that enforce numeric-only input and a maximum length of 10 digits.
  static List<TextInputFormatter> get formatters => [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(10),
      ];

  /// Strips any non-digit characters and limits the string to at most 10 digits.
  static String clean(String? val) {
    if (val == null) return '';
    final digits = val.replaceAll(RegExp(r'\D'), '');
    return digits.length > 10 ? digits.substring(0, 10) : digits;
  }

  /// Validates a phone number field.
  ///
  /// - When [isRequired] is true and input is empty, returns "$fieldName is required".
  /// - When input is non-empty, checks that it contains exactly 10 digits.
  /// - When [isRequired] is false and input is empty, returns null (valid).
  static String? validate(
    String? val, {
    bool isRequired = true,
    String fieldName = 'Phone number',
  }) {
    final trimmed = val?.trim() ?? '';

    if (trimmed.isEmpty) {
      if (isRequired) {
        return '$fieldName is required';
      }
      return null;
    }

    final cleanDigits = trimmed.replaceAll(RegExp(r'\D'), '');

    if (cleanDigits.length != 10 || trimmed.length != 10 || !exact10DigitsRegex.hasMatch(trimmed)) {
      return '$fieldName must be exactly 10 digits';
    }

    return null;
  }
}
