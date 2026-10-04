/// One invoice numbering series (GST or non-GST). The counter is server-controlled and read-only.
class InvoiceSeriesModel {
  final String seriesKind;
  final String prefix;
  final int minDigits;
  final int nextNumber;
  final String nextNumberDisplay;
  final String nextInvoiceNumber;

  const InvoiceSeriesModel({
    required this.seriesKind,
    required this.prefix,
    required this.minDigits,
    required this.nextNumber,
    required this.nextNumberDisplay,
    required this.nextInvoiceNumber,
  });

  factory InvoiceSeriesModel.fromJson(Map<String, dynamic> json) => InvoiceSeriesModel(
        seriesKind: json['seriesKind'] as String? ?? '',
        prefix: json['prefix'] as String? ?? '',
        minDigits: (json['minDigits'] as num?)?.toInt() ?? 4,
        nextNumber: (json['nextNumber'] as num?)?.toInt() ?? 1,
        nextNumberDisplay: json['nextNumberDisplay'] as String? ?? '',
        nextInvoiceNumber: json['nextInvoiceNumber'] as String? ?? '',
      );
}

class InvoiceSeriesSettingsModel {
  final InvoiceSeriesModel gst;
  final InvoiceSeriesModel nonGst;

  const InvoiceSeriesSettingsModel({required this.gst, required this.nonGst});

  factory InvoiceSeriesSettingsModel.fromJson(Map<String, dynamic> json) => InvoiceSeriesSettingsModel(
        gst: InvoiceSeriesModel.fromJson(json['gst'] as Map<String, dynamic>),
        nonGst: InvoiceSeriesModel.fromJson(json['nonGst'] as Map<String, dynamic>),
      );
}
