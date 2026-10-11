import 'package:excel/excel.dart';
import 'package:intl/intl.dart';

/// A percentage, shown with one decimal and a % sign.
class Pct {
  final double value;
  const Pct(this.value);
}

/// Colours used across the report workbooks.
class XlsxColors {
  static const dark = '#1E293B';
  static const band = '#E2E8F0';
  static const white = '#FFFFFF';
  static const muted = '#475569';
}

String reportDate(DateTime? d) =>
    d == null ? '' : DateFormat('dd-MMM-yyyy').format(d);

String reportDateTime(DateTime? d) =>
    d == null ? '' : DateFormat('dd-MMM-yyyy hh:mm a').format(d);

/// "Sunrise Detailing" -> "Sunrise_Detailing_"; empty when there is no company name.
String reportFilePrefix(String? companyName) {
  final cleaned = (companyName ?? '')
      .trim()
      .replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_')
      .replaceAll(RegExp(r'^_+|_+$'), '');
  return cleaned.isEmpty ? '' : '${cleaned}_';
}

/// "COMPANY — TITLE", or just the title when the company has no name yet.
String reportTitle(String title, String? companyName) {
  final name = (companyName ?? '').trim();
  return name.isEmpty ? title : '${name.toUpperCase()} — $title';
}

/// Sheet names: at most 31 characters, none of []:*?/\ and no repeats within a workbook.
String uniqueSheetName(String raw, Set<String> used) {
  var base = raw.replaceAll(RegExp(r'[\[\]:*?/\\]'), ' ').trim();
  if (base.isEmpty) base = 'Sheet';
  if (base.length > 31) base = base.substring(0, 31);
  var candidate = base;
  var n = 2;
  while (used.contains(candidate.toLowerCase())) {
    final suffix = ' ($n)';
    final keep = (31 - suffix.length).clamp(1, base.length);
    candidate = base.substring(0, keep) + suffix;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/// Writes rows top to bottom into one worksheet with a few consistent styles.
class XlsxSheet {
  final Sheet sheet;
  final int columns;
  int _row = 0;

  XlsxSheet(this.sheet, {required this.columns});

  int get nextRow => _row;

  static final _money = NumFormat.custom(formatCode: '#,##0.00');
  static final _pct = NumFormat.custom(formatCode: '0.0"%"');

  CellValue? _value(Object? v) {
    if (v == null) return null;
    if (v is Pct) return DoubleCellValue(v.value);
    if (v is int) return IntCellValue(v);
    if (v is double) return DoubleCellValue(v);
    if (v is DateTime) return TextCellValue(reportDate(v));
    return TextCellValue(v.toString());
  }

  CellStyle _style({
    bool bold = false,
    String? fill,
    String? font,
    bool right = false,
    bool center = false,
    NumFormat? format,
    int? size,
  }) => CellStyle(
    bold: bold,
    fontSize: size,
    backgroundColorHex: fill == null
        ? ExcelColor.none
        : ExcelColor.fromHexString(fill),
    fontColorHex: font == null
        ? ExcelColor.none
        : ExcelColor.fromHexString(font),
    horizontalAlign: right
        ? HorizontalAlign.Right
        : center
        ? HorizontalAlign.Center
        : HorizontalAlign.Left,
    numberFormat: format ?? NumFormat.standard_0,
  );

  void _put(int col, Object? value, CellStyle style) {
    final cell = sheet.cell(
      CellIndex.indexByColumnRow(columnIndex: col, rowIndex: _row),
    );
    cell.value = _value(value);
    cell.cellStyle = style;
  }

  /// A heading across the whole width.
  void title(String text) {
    _put(
      0,
      text,
      _style(
        bold: true,
        size: 14,
        fill: XlsxColors.dark,
        font: XlsxColors.white,
      ),
    );
    for (var c = 1; c < columns; c++) {
      _put(c, null, _style(fill: XlsxColors.dark));
    }
    sheet.merge(
      CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: _row),
      CellIndex.indexByColumnRow(columnIndex: columns - 1, rowIndex: _row),
    );
    _row++;
  }

  void subtitle(String text) {
    _put(0, text, _style(font: XlsxColors.muted));
    _row++;
  }

  void blank() => _row++;

  /// A band that names the section below it.
  void section(String text) {
    for (var c = 0; c < columns; c++) {
      _put(c, c == 0 ? text : null, _style(bold: true, fill: XlsxColors.band));
    }
    _row++;
  }

  void header(List<String> labels) {
    for (var c = 0; c < labels.length; c++) {
      _put(
        c,
        labels[c],
        _style(
          bold: true,
          fill: XlsxColors.dark,
          font: XlsxColors.white,
          center: true,
        ),
      );
    }
    _row++;
  }

  /// Whole numbers show as counts, decimals with two places, [Pct] with a % sign, everything else as text.
  void rowOf(List<Object?> values, {bool bold = false}) {
    for (var c = 0; c < values.length; c++) {
      final v = values[c];
      _put(
        c,
        v,
        _style(
          bold: bold,
          fill: bold ? XlsxColors.band : null,
          right: v is num || v is Pct,
          format: v is Pct
              ? _pct
              : v is double
              ? _money
              : NumFormat.standard_0,
        ),
      );
    }
    _row++;
  }

  /// A label and its value, for summary blocks.
  void keyValue(String label, Object? value) {
    _put(0, label, _style(bold: true));
    final v = value;
    _put(
      1,
      v,
      _style(
        right: v is num || v is Pct,
        format: v is Pct
            ? _pct
            : v is double
            ? _money
            : NumFormat.standard_0,
      ),
    );
    _row++;
  }

  void widths(List<double> w) {
    for (var c = 0; c < w.length; c++) {
      sheet.setColumnWidth(c, w[c]);
    }
  }
}

/// A new workbook whose first sheet is named [firstSheet].
({Excel excel, Set<String> used, Sheet first}) newWorkbook(String firstSheet) {
  final excel = Excel.createExcel();
  final used = <String>{};
  final name = uniqueSheetName(firstSheet, used);
  final defaultName = excel.getDefaultSheet() ?? 'Sheet1';
  excel.rename(defaultName, name);
  return (excel: excel, used: used, first: excel[name]);
}
