class SystemPreferencesModel {
  final String dateFormat;
  final String timeFormat;
  final String currencySymbol;
  final int decimalPrecision;
  final int defaultPrintCopies;
  final bool autoPrintReceipt;
  final int refreshInterval; // in seconds, 0 = manual

  const SystemPreferencesModel({
    this.dateFormat = 'DD/MM/YYYY',
    this.timeFormat = '12h',
    this.currencySymbol = '₹',
    this.decimalPrecision = 2,
    this.defaultPrintCopies = 1,
    this.autoPrintReceipt = true,
    this.refreshInterval = 30,
  });

  static const SystemPreferencesModel defaultPreferences = SystemPreferencesModel();

  SystemPreferencesModel copyWith({
    String? dateFormat,
    String? timeFormat,
    String? currencySymbol,
    int? decimalPrecision,
    int? defaultPrintCopies,
    bool? autoPrintReceipt,
    int? refreshInterval,
  }) {
    return SystemPreferencesModel(
      dateFormat: dateFormat ?? this.dateFormat,
      timeFormat: timeFormat ?? this.timeFormat,
      currencySymbol: currencySymbol ?? this.currencySymbol,
      decimalPrecision: decimalPrecision ?? this.decimalPrecision,
      defaultPrintCopies: defaultPrintCopies ?? this.defaultPrintCopies,
      autoPrintReceipt: autoPrintReceipt ?? this.autoPrintReceipt,
      refreshInterval: refreshInterval ?? this.refreshInterval,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dateFormat': dateFormat,
      'timeFormat': timeFormat,
      'currencySymbol': currencySymbol,
      'decimalPrecision': decimalPrecision,
      'defaultPrintCopies': defaultPrintCopies,
      'autoPrintReceipt': autoPrintReceipt,
      'refreshInterval': refreshInterval,
    };
  }

  factory SystemPreferencesModel.fromJson(Map<String, dynamic> json) {
    return SystemPreferencesModel(
      dateFormat: json['dateFormat'] as String? ?? 'DD/MM/YYYY',
      timeFormat: json['timeFormat'] as String? ?? '12h',
      currencySymbol: json['currencySymbol'] as String? ?? '₹',
      decimalPrecision: json['decimalPrecision'] as int? ?? 2,
      defaultPrintCopies: json['defaultPrintCopies'] as int? ?? 1,
      autoPrintReceipt: json['autoPrintReceipt'] as bool? ?? true,
      refreshInterval: json['refreshInterval'] as int? ?? 30,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SystemPreferencesModel &&
          runtimeType == other.runtimeType &&
          dateFormat == other.dateFormat &&
          timeFormat == other.timeFormat &&
          currencySymbol == other.currencySymbol &&
          decimalPrecision == other.decimalPrecision &&
          defaultPrintCopies == other.defaultPrintCopies &&
          autoPrintReceipt == other.autoPrintReceipt &&
          refreshInterval == other.refreshInterval;

  @override
  int get hashCode =>
      dateFormat.hashCode ^
      timeFormat.hashCode ^
      currencySymbol.hashCode ^
      decimalPrecision.hashCode ^
      defaultPrintCopies.hashCode ^
      autoPrintReceipt.hashCode ^
      refreshInterval.hashCode;
}
