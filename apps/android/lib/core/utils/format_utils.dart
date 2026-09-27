import 'package:intl/intl.dart';
import '../../features/settings/models/system_preferences_model.dart';

class FormatUtils {
  /// Formats a numerical currency value based on canonical System Preferences.
  static String formatCurrency(
    num amount, [
    SystemPreferencesModel? preferences,
  ]) {
    final prefs = preferences ?? SystemPreferencesModel.defaultPreferences;
    final symbol = prefs.currencySymbol;
    final decimals = prefs.decimalPrecision;

    final suffix = decimals > 0 ? '.${'0' * decimals}' : '';
    final formatter = NumberFormat.currency(
      symbol: symbol,
      decimalDigits: decimals,
      customPattern: '$symbol#,##0$suffix',
    );

    return formatter.format(amount);
  }

  /// Formats a DateTime instance into a date string based on canonical System Preferences.
  static String formatDate(
    DateTime date, [
    SystemPreferencesModel? preferences,
  ]) {
    final prefs = preferences ?? SystemPreferencesModel.defaultPreferences;
    final format = prefs.dateFormat;

    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year.toString();

    switch (format) {
      case 'MM/DD/YYYY':
        return '$month/$day/$year';
      case 'YYYY-MM-DD':
        return '$year-$month-$day';
      case 'DD/MM/YYYY':
      default:
        return '$day/$month/$year';
    }
  }

  /// Formats a DateTime instance into a time string based on canonical System Preferences.
  static String formatTime(
    DateTime date, [
    SystemPreferencesModel? preferences,
  ]) {
    final prefs = preferences ?? SystemPreferencesModel.defaultPreferences;
    final format = prefs.timeFormat;

    if (format == '24h') {
      final hours = date.hour.toString().padLeft(2, '0');
      final minutes = date.minute.toString().padLeft(2, '0');
      return '$hours:$minutes';
    }

    final hour12 = date.hour == 0
        ? 12
        : date.hour > 12
            ? date.hour - 12
            : date.hour;
    final hoursStr = hour12.toString().padLeft(2, '0');
    final minutes = date.minute.toString().padLeft(2, '0');
    final ampm = date.hour >= 12 ? 'PM' : 'AM';
    return '$hoursStr:$minutes $ampm';
  }

  /// Formats a DateTime instance into a combined date and time string.
  static String formatDateTime(
    DateTime date, [
    SystemPreferencesModel? preferences,
  ]) {
    return '${formatDate(date, preferences)} ${formatTime(date, preferences)}';
  }
}
