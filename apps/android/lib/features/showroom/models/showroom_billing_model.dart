import 'package:intl/intl.dart';

/// Showroom Payment model representing an individual payment recorded against a daily bill.
class ShowroomPayment {
  final String id;
  final String showroomDailyBillId;
  final double amount;
  final String paymentMethod;
  final String? reference;
  final DateTime paymentDate;
  final String? notes;
  final DateTime createdAt;

  const ShowroomPayment({
    required this.id,
    required this.showroomDailyBillId,
    required this.amount,
    required this.paymentMethod,
    this.reference,
    required this.paymentDate,
    this.notes,
    required this.createdAt,
  });

  factory ShowroomPayment.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is DateTime) return val;
      return DateTime.tryParse(val.toString()) ?? DateTime.now();
    }

    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString()) ?? 0.0;
    }

    return ShowroomPayment(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      showroomDailyBillId:
          (json['showroomDailyBillId'] ?? json['ShowroomDailyBillId'] ?? '')
              .toString(),
      amount: parseDouble(json['amount'] ?? json['Amount']),
      paymentMethod:
          (json['paymentMethod'] ?? json['PaymentMethod'] ?? 'Cash').toString(),
      reference: (json['reference'] ?? json['Reference'])?.toString(),
      paymentDate: parseDate(json['paymentDate'] ?? json['PaymentDate']),
      notes: (json['notes'] ?? json['Notes'])?.toString(),
      createdAt: parseDate(json['createdAt'] ?? json['CreatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'showroomDailyBillId': showroomDailyBillId,
      'amount': amount,
      'paymentMethod': paymentMethod,
      'reference': reference,
      'paymentDate': paymentDate.toIso8601String(),
      'notes': notes,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  String get formattedAmount =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(amount);

  String get formattedDate =>
      DateFormat('dd MMM yyyy, hh:mm a').format(paymentDate.toLocal());
}

/// Showroom Daily Bill representing the daily billed amount and payment reconciliation for a showroom.
class ShowroomDailyBill {
  final String id;
  final String showroomId;
  final String showroomName;
  final DateTime date;
  final double amount;
  final double amountReceived;
  final double balanceAmount;
  final String status; // 'Unpaid' | 'PartiallyPaid' | 'Paid'
  final String? notes;
  final List<ShowroomPayment> payments;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const ShowroomDailyBill({
    required this.id,
    required this.showroomId,
    required this.showroomName,
    required this.date,
    required this.amount,
    required this.amountReceived,
    required this.balanceAmount,
    required this.status,
    this.notes,
    this.payments = const [],
    required this.createdAt,
    this.updatedAt,
  });

  factory ShowroomDailyBill.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is DateTime) return val;
      return DateTime.tryParse(val.toString()) ?? DateTime.now();
    }

    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString()) ?? 0.0;
    }

    List<ShowroomPayment> parsePayments(dynamic val) {
      if (val == null || val is! List) return const [];
      return val
          .map((item) =>
              ShowroomPayment.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    return ShowroomDailyBill(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      showroomId: (json['showroomId'] ?? json['ShowroomId'] ?? '').toString(),
      showroomName:
          (json['showroomName'] ?? json['ShowroomName'] ?? '').toString(),
      date: parseDate(json['date'] ?? json['Date']),
      amount: parseDouble(json['amount'] ?? json['Amount']),
      amountReceived:
          parseDouble(json['amountReceived'] ?? json['AmountReceived']),
      balanceAmount:
          parseDouble(json['balanceAmount'] ?? json['BalanceAmount']),
      status: (json['status'] ?? json['Status'] ?? 'Unpaid').toString(),
      notes: (json['notes'] ?? json['Notes'])?.toString(),
      payments: parsePayments(json['payments'] ?? json['Payments']),
      createdAt: parseDate(json['createdAt'] ?? json['CreatedAt']),
      updatedAt: json['updatedAt'] != null || json['UpdatedAt'] != null
          ? parseDate(json['updatedAt'] ?? json['UpdatedAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'showroomId': showroomId,
      'showroomName': showroomName,
      'date': date.toIso8601String(),
      'amount': amount,
      'amountReceived': amountReceived,
      'balanceAmount': balanceAmount,
      'status': status,
      'notes': notes,
      'payments': payments.map((p) => p.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  bool get isPaid =>
      status.toLowerCase() == 'paid' ||
      (amount > 0 && balanceAmount <= 0.001);

  bool get isPartiallyPaid =>
      status.toLowerCase() == 'partiallypaid' ||
      (amountReceived > 0 && balanceAmount > 0.001);

  bool get isUnpaid =>
      status.toLowerCase() == 'unpaid' ||
      (amountReceived <= 0 && amount > 0);

  String get formattedAmount =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(amount);

  String get formattedReceived =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(amountReceived);

  String get formattedBalance =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(balanceAmount);
}

/// Request DTO for setting/updating daily bill.
class SetShowroomDailyBillRequest {
  final double amount;
  final String? notes;

  const SetShowroomDailyBillRequest({
    required this.amount,
    this.notes,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'amount': amount,
    };
    if (notes != null && notes!.trim().isNotEmpty) {
      map['notes'] = notes!.trim();
    }
    return map;
  }
}

/// Request DTO for recording showroom payment.
class RecordShowroomPaymentRequest {
  final double amount;
  final String paymentMethod;
  final String? reference;
  final DateTime? paymentDate;
  final String? notes;

  const RecordShowroomPaymentRequest({
    required this.amount,
    this.paymentMethod = 'Cash',
    this.reference,
    this.paymentDate,
    this.notes,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'amount': amount,
      'paymentMethod': paymentMethod,
    };
    if (reference != null && reference!.trim().isNotEmpty) {
      map['reference'] = reference!.trim();
    }
    if (paymentDate != null) {
      map['paymentDate'] = paymentDate!.toUtc().toIso8601String();
    }
    if (notes != null && notes!.trim().isNotEmpty) {
      map['notes'] = notes!.trim();
    }
    return map;
  }
}

/// Daily history row in Showroom financial history.
class ShowroomDailyHistoryRow {
  final DateTime date;
  final int staffCount;
  final int totalVehicles;
  final double billedAmount;
  final double receivedAmount;
  final double balanceAmount;
  final String status;
  final bool hasBill;

  const ShowroomDailyHistoryRow({
    required this.date,
    required this.staffCount,
    required this.totalVehicles,
    required this.billedAmount,
    required this.receivedAmount,
    required this.balanceAmount,
    required this.status,
    required this.hasBill,
  });

  factory ShowroomDailyHistoryRow.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is DateTime) return val;
      return DateTime.tryParse(val.toString()) ?? DateTime.now();
    }

    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString()) ?? 0.0;
    }

    int parseInt(dynamic val) {
      if (val == null) return 0;
      if (val is int) return val;
      return int.tryParse(val.toString()) ?? 0;
    }

    return ShowroomDailyHistoryRow(
      date: parseDate(json['date'] ?? json['Date']),
      staffCount: parseInt(json['staffCount'] ?? json['StaffCount']),
      totalVehicles: parseInt(json['totalVehicles'] ?? json['TotalVehicles']),
      billedAmount: parseDouble(json['billedAmount'] ?? json['BilledAmount']),
      receivedAmount:
          parseDouble(json['receivedAmount'] ?? json['ReceivedAmount']),
      balanceAmount:
          parseDouble(json['balanceAmount'] ?? json['BalanceAmount']),
      status: (json['status'] ?? json['Status'] ?? 'Unpaid').toString(),
      hasBill: json['hasBill'] == true || json['HasBill'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'date': date.toIso8601String(),
      'staffCount': staffCount,
      'totalVehicles': totalVehicles,
      'billedAmount': billedAmount,
      'receivedAmount': receivedAmount,
      'balanceAmount': balanceAmount,
      'status': status,
      'hasBill': hasBill,
    };
  }

  String get formattedBilled =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(billedAmount);

  String get formattedReceived =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(receivedAmount);

  String get formattedBalance =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(balanceAmount);

  String get dateString => DateFormat('yyyy-MM-dd').format(date);
}

/// Staff productivity row within Showroom Summary.
class ShowroomStaffProductivity {
  final String staffId;
  final String staffName;
  final String staffPhone;
  final String? staffRole;
  final int daysAssigned;
  final int totalVehiclesAttended;
  final double averageVehiclesPerDay;

  const ShowroomStaffProductivity({
    required this.staffId,
    required this.staffName,
    required this.staffPhone,
    this.staffRole,
    required this.daysAssigned,
    required this.totalVehiclesAttended,
    required this.averageVehiclesPerDay,
  });

  factory ShowroomStaffProductivity.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString()) ?? 0.0;
    }

    int parseInt(dynamic val) {
      if (val == null) return 0;
      if (val is int) return val;
      return int.tryParse(val.toString()) ?? 0;
    }

    return ShowroomStaffProductivity(
      staffId: (json['staffId'] ?? json['StaffId'] ?? '').toString(),
      staffName: (json['staffName'] ?? json['StaffName'] ?? '').toString(),
      staffPhone: (json['staffPhone'] ?? json['StaffPhone'] ?? '').toString(),
      staffRole: (json['staffRole'] ?? json['StaffRole'])?.toString(),
      daysAssigned: parseInt(json['daysAssigned'] ?? json['DaysAssigned']),
      totalVehiclesAttended:
          parseInt(json['totalVehiclesAttended'] ?? json['TotalVehiclesAttended']),
      averageVehiclesPerDay:
          parseDouble(json['averageVehiclesPerDay'] ?? json['AverageVehiclesPerDay']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'staffId': staffId,
      'staffName': staffName,
      'staffPhone': staffPhone,
      'staffRole': staffRole,
      'daysAssigned': daysAssigned,
      'totalVehiclesAttended': totalVehiclesAttended,
      'averageVehiclesPerDay': averageVehiclesPerDay,
    };
  }
}

/// Showroom Financial & Operations Summary model.
class ShowroomSummary {
  final String showroomId;
  final String showroomName;
  final DateTime fromDate;
  final DateTime toDate;
  final int totalDaysWithActivity;
  final int totalStaffAssignments;
  final int totalVehiclesAttended;
  final double averageVehiclesPerDay;
  final double totalBilled;
  final double totalReceived;
  final double outstandingAmount;
  final int paidDaysCount;
  final int partiallyPaidDaysCount;
  final int unpaidDaysCount;
  final List<ShowroomDailyHistoryRow> dailyHistory;
  final List<ShowroomStaffProductivity> staffProductivity;

  const ShowroomSummary({
    required this.showroomId,
    required this.showroomName,
    required this.fromDate,
    required this.toDate,
    required this.totalDaysWithActivity,
    required this.totalStaffAssignments,
    required this.totalVehiclesAttended,
    required this.averageVehiclesPerDay,
    required this.totalBilled,
    required this.totalReceived,
    required this.outstandingAmount,
    required this.paidDaysCount,
    required this.partiallyPaidDaysCount,
    required this.unpaidDaysCount,
    this.dailyHistory = const [],
    this.staffProductivity = const [],
  });

  factory ShowroomSummary.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is DateTime) return val;
      return DateTime.tryParse(val.toString()) ?? DateTime.now();
    }

    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString()) ?? 0.0;
    }

    int parseInt(dynamic val) {
      if (val == null) return 0;
      if (val is int) return val;
      return int.tryParse(val.toString()) ?? 0;
    }

    List<ShowroomDailyHistoryRow> parseHistory(dynamic val) {
      if (val == null || val is! List) return const [];
      return val
          .map((item) =>
              ShowroomDailyHistoryRow.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    List<ShowroomStaffProductivity> parseProductivity(dynamic val) {
      if (val == null || val is! List) return const [];
      return val
          .map((item) =>
              ShowroomStaffProductivity.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    return ShowroomSummary(
      showroomId: (json['showroomId'] ?? json['ShowroomId'] ?? '').toString(),
      showroomName:
          (json['showroomName'] ?? json['ShowroomName'] ?? '').toString(),
      fromDate: parseDate(json['fromDate'] ?? json['FromDate']),
      toDate: parseDate(json['toDate'] ?? json['ToDate']),
      totalDaysWithActivity:
          parseInt(json['totalDaysWithActivity'] ?? json['TotalDaysWithActivity']),
      totalStaffAssignments:
          parseInt(json['totalStaffAssignments'] ?? json['TotalStaffAssignments']),
      totalVehiclesAttended:
          parseInt(json['totalVehiclesAttended'] ?? json['TotalVehiclesAttended']),
      averageVehiclesPerDay:
          parseDouble(json['averageVehiclesPerDay'] ?? json['AverageVehiclesPerDay']),
      totalBilled: parseDouble(json['totalBilled'] ?? json['TotalBilled']),
      totalReceived:
          parseDouble(json['totalReceived'] ?? json['TotalReceived']),
      outstandingAmount:
          parseDouble(json['outstandingAmount'] ?? json['OutstandingAmount']),
      paidDaysCount: parseInt(json['paidDaysCount'] ?? json['PaidDaysCount']),
      partiallyPaidDaysCount:
          parseInt(json['partiallyPaidDaysCount'] ?? json['PartiallyPaidDaysCount']),
      unpaidDaysCount:
          parseInt(json['unpaidDaysCount'] ?? json['UnpaidDaysCount']),
      dailyHistory: parseHistory(json['dailyHistory'] ?? json['DailyHistory']),
      staffProductivity:
          parseProductivity(json['staffProductivity'] ?? json['StaffProductivity']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'showroomId': showroomId,
      'showroomName': showroomName,
      'fromDate': fromDate.toIso8601String(),
      'toDate': toDate.toIso8601String(),
      'totalDaysWithActivity': totalDaysWithActivity,
      'totalStaffAssignments': totalStaffAssignments,
      'totalVehiclesAttended': totalVehiclesAttended,
      'averageVehiclesPerDay': averageVehiclesPerDay,
      'totalBilled': totalBilled,
      'totalReceived': totalReceived,
      'outstandingAmount': outstandingAmount,
      'paidDaysCount': paidDaysCount,
      'partiallyPaidDaysCount': partiallyPaidDaysCount,
      'unpaidDaysCount': unpaidDaysCount,
      'dailyHistory': dailyHistory.map((h) => h.toJson()).toList(),
      'staffProductivity': staffProductivity.map((p) => p.toJson()).toList(),
    };
  }

  String get formattedBilled =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(totalBilled);

  String get formattedReceived =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(totalReceived);

  String get formattedOutstanding =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(outstandingAmount);
}

/// Global Cross-Showroom Outstanding Overview model.
class ShowroomOutstandingOverview {
  final String showroomId;
  final String showroomName;
  final String address;
  final String? phone;
  final bool isActive;
  final double totalBilled;
  final double totalReceived;
  final double outstandingAmount;
  final int unpaidDaysCount;

  const ShowroomOutstandingOverview({
    required this.showroomId,
    required this.showroomName,
    required this.address,
    this.phone,
    required this.isActive,
    required this.totalBilled,
    required this.totalReceived,
    required this.outstandingAmount,
    required this.unpaidDaysCount,
  });

  factory ShowroomOutstandingOverview.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString()) ?? 0.0;
    }

    int parseInt(dynamic val) {
      if (val == null) return 0;
      if (val is int) return val;
      return int.tryParse(val.toString()) ?? 0;
    }

    return ShowroomOutstandingOverview(
      showroomId: (json['showroomId'] ?? json['ShowroomId'] ?? '').toString(),
      showroomName:
          (json['showroomName'] ?? json['ShowroomName'] ?? '').toString(),
      address: (json['address'] ?? json['Address'] ?? '').toString(),
      phone: (json['phone'] ?? json['Phone'])?.toString(),
      isActive: json['isActive'] == true || json['IsActive'] == true,
      totalBilled: parseDouble(json['totalBilled'] ?? json['TotalBilled']),
      totalReceived:
          parseDouble(json['totalReceived'] ?? json['TotalReceived']),
      outstandingAmount:
          parseDouble(json['outstandingAmount'] ?? json['OutstandingAmount']),
      unpaidDaysCount:
          parseInt(json['unpaidDaysCount'] ?? json['UnpaidDaysCount']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'showroomId': showroomId,
      'showroomName': showroomName,
      'address': address,
      'phone': phone,
      'isActive': isActive,
      'totalBilled': totalBilled,
      'totalReceived': totalReceived,
      'outstandingAmount': outstandingAmount,
      'unpaidDaysCount': unpaidDaysCount,
    };
  }

  String get formattedBilled =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(totalBilled);

  String get formattedReceived =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(totalReceived);

  String get formattedOutstanding =>
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2)
          .format(outstandingAmount);
}
