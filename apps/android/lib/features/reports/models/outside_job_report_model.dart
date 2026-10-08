class CurrentlyOutsideJobModel {
  final String id;
  final String jobCardId;
  final String jobCardNumber;
  final String vehicleId;
  final String vehicleRegistration;
  final String vehicleModel;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String vendorId;
  final String vendorName;
  final String? vendorPhone;
  final String serviceName;
  final DateTime sentAt;
  final DateTime expectedReturnAt;
  final bool isOverdue;
  final double overdueHours;
  final double? vendorCost;
  final String? notes;

  const CurrentlyOutsideJobModel({
    required this.id,
    required this.jobCardId,
    required this.jobCardNumber,
    required this.vehicleId,
    required this.vehicleRegistration,
    required this.vehicleModel,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.vendorId,
    required this.vendorName,
    this.vendorPhone,
    required this.serviceName,
    required this.sentAt,
    required this.expectedReturnAt,
    required this.isOverdue,
    required this.overdueHours,
    this.vendorCost,
    this.notes,
  });

  factory CurrentlyOutsideJobModel.fromJson(Map<String, dynamic> json) {
    return CurrentlyOutsideJobModel(
      id: json['id']?.toString() ?? json['Id']?.toString() ?? '',
      jobCardId:
          json['jobCardId']?.toString() ?? json['JobCardId']?.toString() ?? '',
      jobCardNumber:
          json['jobCardNumber']?.toString() ??
          json['JobCardNumber']?.toString() ??
          '',
      vehicleId:
          json['vehicleId']?.toString() ?? json['VehicleId']?.toString() ?? '',
      vehicleRegistration:
          json['vehicleRegistration']?.toString() ??
          json['VehicleRegistration']?.toString() ??
          '',
      vehicleModel:
          json['vehicleModel']?.toString() ??
          json['VehicleModel']?.toString() ??
          '',
      customerId:
          json['customerId']?.toString() ??
          json['CustomerId']?.toString() ??
          '',
      customerName:
          json['customerName']?.toString() ??
          json['CustomerName']?.toString() ??
          '',
      customerPhone:
          json['customerPhone']?.toString() ??
          json['CustomerPhone']?.toString() ??
          '',
      vendorId:
          json['vendorId']?.toString() ?? json['VendorId']?.toString() ?? '',
      vendorName:
          json['vendorName']?.toString() ??
          json['VendorName']?.toString() ??
          '',
      vendorPhone:
          json['vendorPhone']?.toString() ?? json['VendorPhone']?.toString(),
      serviceName:
          json['serviceName']?.toString() ??
          json['ServiceName']?.toString() ??
          '',
      sentAt:
          DateTime.tryParse(
            json['sentAt']?.toString() ?? json['SentAt']?.toString() ?? '',
          ) ??
          DateTime.now(),
      expectedReturnAt:
          DateTime.tryParse(
            json['expectedReturnAt']?.toString() ??
                json['ExpectedReturnAt']?.toString() ??
                '',
          ) ??
          DateTime.now(),
      isOverdue:
          json['isOverdue'] as bool? ?? json['IsOverdue'] as bool? ?? false,
      overdueHours:
          (json['overdueHours'] as num?)?.toDouble() ??
          (json['OverdueHours'] as num?)?.toDouble() ??
          0.0,
      vendorCost:
          (json['vendorCost'] as num?)?.toDouble() ??
          (json['VendorCost'] as num?)?.toDouble(),
      notes: json['notes']?.toString() ?? json['Notes']?.toString(),
    );
  }
}

class OutsideJobHistoryReportModel {
  final String id;
  final String jobCardId;
  final String jobCardNumber;
  final String vehicleId;
  final String vehicleRegistration;
  final String vehicleModel;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String vendorId;
  final String vendorName;
  final String serviceName;
  final int status;
  final String statusName;
  final DateTime sentAt;
  final DateTime? returnedAt;
  final DateTime expectedReturnAt;
  final double? durationHours;
  final double? vendorCost;
  final String? sentByUserName;
  final String? returnedByUserName;
  final String? notes;
  final String? returnNotes;

  const OutsideJobHistoryReportModel({
    required this.id,
    required this.jobCardId,
    required this.jobCardNumber,
    required this.vehicleId,
    required this.vehicleRegistration,
    required this.vehicleModel,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.vendorId,
    required this.vendorName,
    required this.serviceName,
    required this.status,
    required this.statusName,
    required this.sentAt,
    this.returnedAt,
    required this.expectedReturnAt,
    this.durationHours,
    this.vendorCost,
    this.sentByUserName,
    this.returnedByUserName,
    this.notes,
    this.returnNotes,
  });

  factory OutsideJobHistoryReportModel.fromJson(Map<String, dynamic> json) {
    return OutsideJobHistoryReportModel(
      id: json['id']?.toString() ?? json['Id']?.toString() ?? '',
      jobCardId:
          json['jobCardId']?.toString() ?? json['JobCardId']?.toString() ?? '',
      jobCardNumber:
          json['jobCardNumber']?.toString() ??
          json['JobCardNumber']?.toString() ??
          '',
      vehicleId:
          json['vehicleId']?.toString() ?? json['VehicleId']?.toString() ?? '',
      vehicleRegistration:
          json['vehicleRegistration']?.toString() ??
          json['VehicleRegistration']?.toString() ??
          '',
      vehicleModel:
          json['vehicleModel']?.toString() ??
          json['VehicleModel']?.toString() ??
          '',
      customerId:
          json['customerId']?.toString() ??
          json['CustomerId']?.toString() ??
          '',
      customerName:
          json['customerName']?.toString() ??
          json['CustomerName']?.toString() ??
          '',
      customerPhone:
          json['customerPhone']?.toString() ??
          json['CustomerPhone']?.toString() ??
          '',
      vendorId:
          json['vendorId']?.toString() ?? json['VendorId']?.toString() ?? '',
      vendorName:
          json['vendorName']?.toString() ??
          json['VendorName']?.toString() ??
          '',
      serviceName:
          json['serviceName']?.toString() ??
          json['ServiceName']?.toString() ??
          '',
      status: json['status'] as int? ?? json['Status'] as int? ?? 0,
      statusName:
          json['statusName']?.toString() ??
          json['StatusName']?.toString() ??
          '',
      sentAt:
          DateTime.tryParse(
            json['sentAt']?.toString() ?? json['SentAt']?.toString() ?? '',
          ) ??
          DateTime.now(),
      returnedAt: json['returnedAt'] != null || json['ReturnedAt'] != null
          ? DateTime.tryParse(
              json['returnedAt']?.toString() ??
                  json['ReturnedAt']?.toString() ??
                  '',
            )
          : null,
      expectedReturnAt:
          DateTime.tryParse(
            json['expectedReturnAt']?.toString() ??
                json['ExpectedReturnAt']?.toString() ??
                '',
          ) ??
          DateTime.now(),
      durationHours:
          (json['durationHours'] as num?)?.toDouble() ??
          (json['DurationHours'] as num?)?.toDouble(),
      vendorCost:
          (json['vendorCost'] as num?)?.toDouble() ??
          (json['VendorCost'] as num?)?.toDouble(),
      sentByUserName:
          json['sentByUserName']?.toString() ??
          json['SentByUserName']?.toString(),
      returnedByUserName:
          json['returnedByUserName']?.toString() ??
          json['ReturnedByUserName']?.toString(),
      notes: json['notes']?.toString() ?? json['Notes']?.toString(),
      returnNotes:
          json['returnNotes']?.toString() ?? json['ReturnNotes']?.toString(),
    );
  }
}

class OutsideJobVendorSummaryModel {
  final String vendorId;
  final String vendorName;
  final String? phone;
  final int totalJobs;
  final int completedJobs;
  final int currentlyOutside;
  final int overdueJobs;
  final int cancelledJobs;
  final double totalVendorCost;

  const OutsideJobVendorSummaryModel({
    required this.vendorId,
    required this.vendorName,
    this.phone,
    required this.totalJobs,
    required this.completedJobs,
    required this.currentlyOutside,
    required this.overdueJobs,
    required this.cancelledJobs,
    required this.totalVendorCost,
  });

  factory OutsideJobVendorSummaryModel.fromJson(Map<String, dynamic> json) {
    return OutsideJobVendorSummaryModel(
      vendorId:
          json['vendorId']?.toString() ?? json['VendorId']?.toString() ?? '',
      vendorName:
          json['vendorName']?.toString() ??
          json['VendorName']?.toString() ??
          '',
      phone: json['phone']?.toString() ?? json['Phone']?.toString(),
      totalJobs: json['totalJobs'] as int? ?? json['TotalJobs'] as int? ?? 0,
      completedJobs:
          json['completedJobs'] as int? ?? json['CompletedJobs'] as int? ?? 0,
      currentlyOutside:
          json['currentlyOutside'] as int? ??
          json['CurrentlyOutside'] as int? ??
          0,
      overdueJobs:
          json['overdueJobs'] as int? ?? json['OverdueJobs'] as int? ?? 0,
      cancelledJobs:
          json['cancelledJobs'] as int? ?? json['CancelledJobs'] as int? ?? 0,
      totalVendorCost:
          (json['totalVendorCost'] as num?)?.toDouble() ??
          (json['TotalVendorCost'] as num?)?.toDouble() ??
          0.0,
    );
  }
}

class OutsideJobReportResponseModel {
  final List<CurrentlyOutsideJobModel> currentlyOutside;
  final List<OutsideJobHistoryReportModel> history;
  final List<OutsideJobVendorSummaryModel> vendorSummary;
  final int totalOutsideCount;
  final int totalOverdueCount;
  final double totalActiveCost;
  final double totalHistoricalCost;

  const OutsideJobReportResponseModel({
    required this.currentlyOutside,
    required this.history,
    required this.vendorSummary,
    required this.totalOutsideCount,
    required this.totalOverdueCount,
    required this.totalActiveCost,
    required this.totalHistoricalCost,
  });

  factory OutsideJobReportResponseModel.fromJson(Map<String, dynamic> json) {
    return OutsideJobReportResponseModel(
      currentlyOutside:
          (json['currentlyOutside'] as List<dynamic>?)
              ?.map(
                (e) => CurrentlyOutsideJobModel.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList() ??
          (json['CurrentlyOutside'] as List<dynamic>?)
              ?.map(
                (e) => CurrentlyOutsideJobModel.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList() ??
          [],
      history:
          (json['history'] as List<dynamic>?)
              ?.map(
                (e) => OutsideJobHistoryReportModel.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList() ??
          (json['History'] as List<dynamic>?)
              ?.map(
                (e) => OutsideJobHistoryReportModel.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList() ??
          [],
      vendorSummary:
          (json['vendorSummary'] as List<dynamic>?)
              ?.map(
                (e) => OutsideJobVendorSummaryModel.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList() ??
          (json['VendorSummary'] as List<dynamic>?)
              ?.map(
                (e) => OutsideJobVendorSummaryModel.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList() ??
          [],
      totalOutsideCount:
          json['totalOutsideCount'] as int? ??
          json['TotalOutsideCount'] as int? ??
          0,
      totalOverdueCount:
          json['totalOverdueCount'] as int? ??
          json['TotalOverdueCount'] as int? ??
          0,
      totalActiveCost:
          (json['totalActiveCost'] as num?)?.toDouble() ??
          (json['TotalActiveCost'] as num?)?.toDouble() ??
          0.0,
      totalHistoricalCost:
          (json['totalHistoricalCost'] as num?)?.toDouble() ??
          (json['TotalHistoricalCost'] as num?)?.toDouble() ??
          0.0,
    );
  }
}
