import 'package:flutter/services.dart';

/// Formatter that automatically converts all input text to uppercase
/// while preserving the current text selection / cursor position.
class UpperCaseTextFormatter extends TextInputFormatter {
  const UpperCaseTextFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return TextEditingValue(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}

/// Helper function to trim and uppercase vehicle registration numbers.
String normalizeRegistration(String? reg) {
  return (reg ?? '').trim().toUpperCase();
}
