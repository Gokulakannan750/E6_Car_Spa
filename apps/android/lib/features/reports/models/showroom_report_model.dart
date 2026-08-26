class ShowroomReportRowModel {
  final String showroomId;
  final String showroomName;
  final DateTime date;
  final int staffCount;
  final int vehiclesAttended;
  final double billedAmount;
  final double receivedAmount;
  final double balanceAmount;
  final String paymentStatus;
  final bool attendanceConfirmed;
  final DateTime? attendanceConfirmedAt;

  const ShowroomReportRowModel({
    required this.showroomId,
    required this.showroomName,
    required this.date,
    required this.staffCount,
    required this.vehiclesAttended,
    required this.billedAmount,
    required this.receivedAmount,
    required this.balanceAmount,
    required this.paymentStatus,
    required this.attendanceConfirmed,
    this.attendanceConfirmedAt,
  });

  factory ShowroomReportRowModel.fromJson(Map<String, dynamic> json) {
    return ShowroomReportRowModel(
      showroomId: json['showroomId']?.toString() ?? json['ShowroomId']?.toString() ?? '',
      showroomName: json['showroomName']?.toString() ?? json['ShowroomName']?.toString() ?? '',
      date: DateTime.tryParse(json['date']?.toString() ?? json['Date']?.toString() ?? '') ?? DateTime.now(),
      staffCount: json['staffCount'] as int? ?? json['StaffCount'] as int? ?? 0,
      vehiclesAttended: json['vehiclesAttended'] as int? ?? json['VehiclesAttended'] as int? ?? 0,
      billedAmount: ((json['billedAmount'] ?? json['BilledAmount'] ?? 0.0) as num).toDouble(),
      receivedAmount: ((json['receivedAmount'] ?? json['ReceivedAmount'] ?? 0.0) as num).toDouble(),
      balanceAmount: ((json['balanceAmount'] ?? json['BalanceAmount'] ?? 0.0) as num).toDouble(),
      paymentStatus: json['paymentStatus']?.toString() ?? json['PaymentStatus']?.toString() ?? 'Unpaid',
      attendanceConfirmed: json['attendanceConfirmed'] as bool? ?? json['AttendanceConfirmed'] as bool? ?? false,
      attendanceConfirmedAt: json['attendanceConfirmedAt'] != null || json['AttendanceConfirmedAt'] != null
          ? DateTime.tryParse(json['attendanceConfirmedAt']?.toString() ?? json['AttendanceConfirmedAt']?.toString() ?? '')
          : null,
    );
  }
}

class ShowroomReportSummaryModel {
  final double totalBilled;
  final double totalReceived;
  final double totalOutstanding;
  final int totalVehiclesAttended;
  final int totalAssignments;
  final int paidDaysCount;
  final int partiallyPaidDaysCount;
  final int unpaidDaysCount;

  const ShowroomReportSummaryModel({
    required this.totalBilled,
    required this.totalReceived,
    required this.totalOutstanding,
    required this.totalVehiclesAttended,
    required this.totalAssignments,
    required this.paidDaysCount,
    required this.partiallyPaidDaysCount,
    required this.unpaidDaysCount,
  });

  factory ShowroomReportSummaryModel.fromJson(Map<String, dynamic> json) {
    return ShowroomReportSummaryModel(
      totalBilled: ((json['totalBilled'] ?? json['TotalBilled'] ?? 0.0) as num).toDouble(),
      totalReceived: ((json['totalReceived'] ?? json['TotalReceived'] ?? 0.0) as num).toDouble(),
      totalOutstanding: ((json['totalOutstanding'] ?? json['TotalOutstanding'] ?? 0.0) as num).toDouble(),
      totalVehiclesAttended: json['totalVehiclesAttended'] as int? ?? json['TotalVehiclesAttended'] as int? ?? 0,
      totalAssignments: json['totalAssignments'] as int? ?? json['TotalAssignments'] as int? ?? 0,
      paidDaysCount: json['paidDaysCount'] as int? ?? json['PaidDaysCount'] as int? ?? 0,
      partiallyPaidDaysCount: json['partiallyPaidDaysCount'] as int? ?? json['PartiallyPaidDaysCount'] as int? ?? 0,
      unpaidDaysCount: json['unpaidDaysCount'] as int? ?? json['UnpaidDaysCount'] as int? ?? 0,
    );
  }
}

class ShowroomReportResponseModel {
  final List<ShowroomReportRowModel> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final ShowroomReportSummaryModel summary;

  const ShowroomReportResponseModel({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
    required this.summary,
  });

  factory ShowroomReportResponseModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return ShowroomReportResponseModel(
      items: rawItems.map((item) => ShowroomReportRowModel.fromJson(item as Map<String, dynamic>)).toList(),
      totalCount: json['totalCount'] as int? ?? json['TotalCount'] as int? ?? 0,
      page: json['page'] as int? ?? json['Page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? json['PageSize'] as int? ?? 20,
      summary: ShowroomReportSummaryModel.fromJson((json['summary'] ?? json['Summary'] ?? {}) as Map<String, dynamic>),
    );
  }
}
