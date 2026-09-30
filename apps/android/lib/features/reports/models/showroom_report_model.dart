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
      showroomId:
          json['showroomId']?.toString() ??
          json['ShowroomId']?.toString() ??
          '',
      showroomName:
          json['showroomName']?.toString() ??
          json['ShowroomName']?.toString() ??
          '',
      date:
          DateTime.tryParse(
            json['date']?.toString() ?? json['Date']?.toString() ?? '',
          ) ??
          DateTime.now(),
      staffCount: json['staffCount'] as int? ?? json['StaffCount'] as int? ?? 0,
      vehiclesAttended:
          json['vehiclesAttended'] as int? ??
          json['VehiclesAttended'] as int? ??
          0,
      billedAmount:
          ((json['billedAmount'] ?? json['BilledAmount'] ?? 0.0) as num)
              .toDouble(),
      receivedAmount:
          ((json['receivedAmount'] ?? json['ReceivedAmount'] ?? 0.0) as num)
              .toDouble(),
      balanceAmount:
          ((json['balanceAmount'] ?? json['BalanceAmount'] ?? 0.0) as num)
              .toDouble(),
      paymentStatus:
          json['paymentStatus']?.toString() ??
          json['PaymentStatus']?.toString() ??
          'Unpaid',
      attendanceConfirmed:
          json['attendanceConfirmed'] as bool? ??
          json['AttendanceConfirmed'] as bool? ??
          false,
      attendanceConfirmedAt:
          json['attendanceConfirmedAt'] != null ||
              json['AttendanceConfirmedAt'] != null
          ? DateTime.tryParse(
              json['attendanceConfirmedAt']?.toString() ??
                  json['AttendanceConfirmedAt']?.toString() ??
                  '',
            )
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
      totalBilled: ((json['totalBilled'] ?? json['TotalBilled'] ?? 0.0) as num)
          .toDouble(),
      totalReceived:
          ((json['totalReceived'] ?? json['TotalReceived'] ?? 0.0) as num)
              .toDouble(),
      totalOutstanding:
          ((json['totalOutstanding'] ?? json['TotalOutstanding'] ?? 0.0) as num)
              .toDouble(),
      totalVehiclesAttended:
          json['totalVehiclesAttended'] as int? ??
          json['TotalVehiclesAttended'] as int? ??
          0,
      totalAssignments:
          json['totalAssignments'] as int? ??
          json['TotalAssignments'] as int? ??
          0,
      paidDaysCount:
          json['paidDaysCount'] as int? ?? json['PaidDaysCount'] as int? ?? 0,
      partiallyPaidDaysCount:
          json['partiallyPaidDaysCount'] as int? ??
          json['PartiallyPaidDaysCount'] as int? ??
          0,
      unpaidDaysCount:
          json['unpaidDaysCount'] as int? ??
          json['UnpaidDaysCount'] as int? ??
          0,
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
    final rawItems =
        json['items'] as List<dynamic>? ??
        json['Items'] as List<dynamic>? ??
        [];
    return ShowroomReportResponseModel(
      items: rawItems
          .map(
            (item) =>
                ShowroomReportRowModel.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      totalCount: json['totalCount'] as int? ?? json['TotalCount'] as int? ?? 0,
      page: json['page'] as int? ?? json['Page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? json['PageSize'] as int? ?? 20,
      summary: ShowroomReportSummaryModel.fromJson(
        (json['summary'] ?? json['Summary'] ?? {}) as Map<String, dynamic>,
      ),
    );
  }
}

// ── Monthly / Date-Range Showroom Report Models ─────────────────────────────

class MonthlyShowroomServiceItemModel {
  final String workTypeId;
  final String workTypeCode;
  final String workTypeName;
  final int quantity;
  final String? notes;

  const MonthlyShowroomServiceItemModel({
    required this.workTypeId,
    required this.workTypeCode,
    required this.workTypeName,
    required this.quantity,
    this.notes,
  });

  factory MonthlyShowroomServiceItemModel.fromJson(Map<String, dynamic> json) {
    return MonthlyShowroomServiceItemModel(
      workTypeId:
          json['workTypeId']?.toString() ??
          json['WorkTypeId']?.toString() ??
          '',
      workTypeCode:
          json['workTypeCode']?.toString() ??
          json['WorkTypeCode']?.toString() ??
          'SRV',
      workTypeName:
          json['workTypeName']?.toString() ??
          json['WorkTypeName']?.toString() ??
          'Service',
      quantity: json['quantity'] as int? ?? json['Quantity'] as int? ?? 0,
      notes: json['notes']?.toString() ?? json['Notes']?.toString(),
    );
  }
}

class MonthlyShowroomVehicleWorkRowModel {
  final String id;
  final DateTime date;
  final String showroomId;
  final String showroomMasterId;
  final String showroomName;
  final String staffId;
  final String staffMasterId;
  final String staffName;
  final String? staffPhone;
  final String? staffRole;
  final String? homeShowroomName;
  final String? homeShowroomMasterId;
  final String? assignmentType;
  final String? sessionType;
  final String? startTime;
  final String? endTime;
  final double workingHours;
  final String vehicleTypeId;
  final String vehicleTypeCode;
  final String vehicleTypeName;
  final int vehicleQuantity;
  final String servicesSummary;
  final List<MonthlyShowroomServiceItemModel> serviceItems;
  final String? timeRecorded;
  final String? notes;
  final double? dailyBilledAmount;
  final double? dailyCollectedAmount;
  final String paymentStatus;
  final String? swapId;
  final String? originalStaffName;
  final String? replacementStaffName;
  final String? serviceCategory;

  const MonthlyShowroomVehicleWorkRowModel({
    required this.id,
    required this.date,
    required this.showroomId,
    required this.showroomMasterId,
    required this.showroomName,
    required this.staffId,
    required this.staffMasterId,
    required this.staffName,
    this.staffPhone,
    this.staffRole,
    this.homeShowroomName,
    this.homeShowroomMasterId,
    this.assignmentType,
    this.sessionType,
    this.startTime,
    this.endTime,
    this.workingHours = 8.0,
    required this.vehicleTypeId,
    required this.vehicleTypeCode,
    required this.vehicleTypeName,
    required this.vehicleQuantity,
    required this.servicesSummary,
    this.serviceItems = const [],
    this.timeRecorded,
    this.notes,
    this.dailyBilledAmount,
    this.dailyCollectedAmount,
    required this.paymentStatus,
    this.swapId,
    this.originalStaffName,
    this.replacementStaffName,
    this.serviceCategory,
  });

  factory MonthlyShowroomVehicleWorkRowModel.fromJson(
    Map<String, dynamic> json,
  ) {
    final rawServices =
        json['serviceItems'] as List<dynamic>? ??
        json['ServiceItems'] as List<dynamic>? ??
        [];
    return MonthlyShowroomVehicleWorkRowModel(
      id: json['id']?.toString() ?? json['Id']?.toString() ?? '',
      date:
          DateTime.tryParse(
            json['date']?.toString() ?? json['Date']?.toString() ?? '',
          ) ??
          DateTime.now(),
      showroomId:
          json['showroomId']?.toString() ??
          json['ShowroomId']?.toString() ??
          '',
      showroomMasterId:
          json['showroomMasterId']?.toString() ??
          json['ShowroomMasterId']?.toString() ??
          '',
      showroomName:
          json['showroomName']?.toString() ??
          json['ShowroomName']?.toString() ??
          '',
      staffId: json['staffId']?.toString() ?? json['StaffId']?.toString() ?? '',
      staffMasterId:
          json['staffMasterId']?.toString() ??
          json['StaffMasterId']?.toString() ??
          '',
      staffName:
          json['staffName']?.toString() ?? json['StaffName']?.toString() ?? '',
      staffPhone:
          json['staffPhone']?.toString() ?? json['StaffPhone']?.toString(),
      staffRole: json['staffRole']?.toString() ?? json['StaffRole']?.toString(),
      homeShowroomName:
          json['homeShowroomName']?.toString() ??
          json['HomeShowroomName']?.toString(),
      homeShowroomMasterId:
          json['homeShowroomMasterId']?.toString() ??
          json['HomeShowroomMasterId']?.toString(),
      assignmentType:
          json['assignmentType']?.toString() ??
          json['AssignmentType']?.toString(),
      sessionType:
          json['sessionType']?.toString() ?? json['SessionType']?.toString(),
      startTime: json['startTime']?.toString() ?? json['StartTime']?.toString(),
      endTime: json['endTime']?.toString() ?? json['EndTime']?.toString(),
      workingHours:
          ((json['workingHours'] ?? json['WorkingHours'] ?? 8.0) as num)
              .toDouble(),
      vehicleTypeId:
          json['vehicleTypeId']?.toString() ??
          json['VehicleTypeId']?.toString() ??
          '',
      vehicleTypeCode:
          json['vehicleTypeCode']?.toString() ??
          json['VehicleTypeCode']?.toString() ??
          'VEH',
      vehicleTypeName:
          json['vehicleTypeName']?.toString() ??
          json['VehicleTypeName']?.toString() ??
          'Vehicle',
      vehicleQuantity:
          json['vehicleQuantity'] as int? ??
          json['VehicleQuantity'] as int? ??
          0,
      servicesSummary:
          json['servicesSummary']?.toString() ??
          json['ServicesSummary']?.toString() ??
          'General',
      serviceItems: rawServices
          .map(
            (s) => MonthlyShowroomServiceItemModel.fromJson(
              s as Map<String, dynamic>,
            ),
          )
          .toList(),
      timeRecorded:
          json['timeRecorded']?.toString() ?? json['TimeRecorded']?.toString(),
      notes: json['notes']?.toString() ?? json['Notes']?.toString(),
      dailyBilledAmount:
          json['dailyBilledAmount'] != null || json['DailyBilledAmount'] != null
          ? ((json['dailyBilledAmount'] ?? json['DailyBilledAmount']) as num)
                .toDouble()
          : null,
      dailyCollectedAmount:
          json['dailyCollectedAmount'] != null ||
              json['DailyCollectedAmount'] != null
          ? ((json['dailyCollectedAmount'] ?? json['DailyCollectedAmount'])
                    as num)
                .toDouble()
          : null,
      paymentStatus:
          json['paymentStatus']?.toString() ??
          json['PaymentStatus']?.toString() ??
          'NoBill',
      swapId: json['swapId']?.toString() ?? json['SwapId']?.toString(),
      originalStaffName:
          json['originalStaffName']?.toString() ??
          json['OriginalStaffName']?.toString(),
      replacementStaffName:
          json['replacementStaffName']?.toString() ??
          json['ReplacementStaffName']?.toString(),
      serviceCategory:
          json['serviceCategory']?.toString() ??
          json['ServiceCategory']?.toString(),
    );
  }
}

class ShowroomAttendanceReportRowModel {
  final DateTime date;
  final String staffId;
  final String staffMasterId;
  final String staffName;
  final String? role;
  final String homeShowroomName;
  final String workingShowroomName;
  final String attendanceStatus;
  final String? scheduledStart;
  final String? scheduledEnd;
  final double scheduledHours;
  final double actualHours;
  final String confirmationStatus;
  final String? confirmedByName;
  final DateTime? confirmedAt;

  const ShowroomAttendanceReportRowModel({
    required this.date,
    required this.staffId,
    required this.staffMasterId,
    required this.staffName,
    this.role,
    required this.homeShowroomName,
    required this.workingShowroomName,
    required this.attendanceStatus,
    this.scheduledStart,
    this.scheduledEnd,
    required this.scheduledHours,
    required this.actualHours,
    required this.confirmationStatus,
    this.confirmedByName,
    this.confirmedAt,
  });

  factory ShowroomAttendanceReportRowModel.fromJson(Map<String, dynamic> json) {
    return ShowroomAttendanceReportRowModel(
      date:
          DateTime.tryParse(
            json['date']?.toString() ?? json['Date']?.toString() ?? '',
          ) ??
          DateTime.now(),
      staffId: json['staffId']?.toString() ?? json['StaffId']?.toString() ?? '',
      staffMasterId:
          json['staffMasterId']?.toString() ??
          json['StaffMasterId']?.toString() ??
          '',
      staffName:
          json['staffName']?.toString() ?? json['StaffName']?.toString() ?? '',
      role: json['role']?.toString() ?? json['Role']?.toString(),
      homeShowroomName:
          json['homeShowroomName']?.toString() ??
          json['HomeShowroomName']?.toString() ??
          '',
      workingShowroomName:
          json['workingShowroomName']?.toString() ??
          json['WorkingShowroomName']?.toString() ??
          '',
      attendanceStatus:
          json['attendanceStatus']?.toString() ??
          json['AttendanceStatus']?.toString() ??
          'Present',
      scheduledStart:
          json['scheduledStart']?.toString() ??
          json['ScheduledStart']?.toString(),
      scheduledEnd:
          json['scheduledEnd']?.toString() ?? json['ScheduledEnd']?.toString(),
      scheduledHours:
          ((json['scheduledHours'] ?? json['ScheduledHours'] ?? 0.0) as num)
              .toDouble(),
      actualHours: ((json['actualHours'] ?? json['ActualHours'] ?? 0.0) as num)
          .toDouble(),
      confirmationStatus:
          json['confirmationStatus']?.toString() ??
          json['ConfirmationStatus']?.toString() ??
          'Pending',
      confirmedByName:
          json['confirmedByName']?.toString() ??
          json['ConfirmedByName']?.toString(),
      confirmedAt: json['confirmedAt'] != null || json['ConfirmedAt'] != null
          ? DateTime.tryParse(
              json['confirmedAt']?.toString() ??
                  json['ConfirmedAt']?.toString() ??
                  '',
            )
          : null,
    );
  }
}

class ShowroomStaffSwapReportRowModel {
  final String swapId;
  final DateTime date;
  final String showroomName;
  final String staffAId;
  final String staffAMasterId;
  final String staffAName;
  final String staffBId;
  final String staffBMasterId;
  final String staffBName;
  final String? originalWorkingTime;
  final String? replacementWorkingTime;
  final String? swapStartTime;
  final String? swapEndTime;
  final double swapHours;
  final String? reason;
  final String? createdByName;
  final DateTime createdAt;
  final String status;
  final String? reversedByName;
  final DateTime? reversedAt;
  final String? reversalReason;

  const ShowroomStaffSwapReportRowModel({
    required this.swapId,
    required this.date,
    required this.showroomName,
    required this.staffAId,
    required this.staffAMasterId,
    required this.staffAName,
    required this.staffBId,
    required this.staffBMasterId,
    required this.staffBName,
    this.originalWorkingTime,
    this.replacementWorkingTime,
    this.swapStartTime,
    this.swapEndTime,
    required this.swapHours,
    this.reason,
    this.createdByName,
    required this.createdAt,
    required this.status,
    this.reversedByName,
    this.reversedAt,
    this.reversalReason,
  });

  factory ShowroomStaffSwapReportRowModel.fromJson(Map<String, dynamic> json) {
    return ShowroomStaffSwapReportRowModel(
      swapId: json['swapId']?.toString() ?? json['SwapId']?.toString() ?? '',
      date:
          DateTime.tryParse(
            json['date']?.toString() ?? json['Date']?.toString() ?? '',
          ) ??
          DateTime.now(),
      showroomName:
          json['showroomName']?.toString() ??
          json['ShowroomName']?.toString() ??
          '',
      staffAId:
          json['staffAId']?.toString() ?? json['StaffAId']?.toString() ?? '',
      staffAMasterId:
          json['staffAMasterId']?.toString() ??
          json['StaffAMasterId']?.toString() ??
          '',
      staffAName:
          json['staffAName']?.toString() ??
          json['StaffAName']?.toString() ??
          '',
      staffBId:
          json['staffBId']?.toString() ?? json['StaffBId']?.toString() ?? '',
      staffBMasterId:
          json['staffBMasterId']?.toString() ??
          json['StaffBMasterId']?.toString() ??
          '',
      staffBName:
          json['staffBName']?.toString() ??
          json['StaffBName']?.toString() ??
          '',
      originalWorkingTime:
          json['originalWorkingTime']?.toString() ??
          json['OriginalWorkingTime']?.toString(),
      replacementWorkingTime:
          json['replacementWorkingTime']?.toString() ??
          json['ReplacementWorkingTime']?.toString(),
      swapStartTime:
          json['swapStartTime']?.toString() ??
          json['SwapStartTime']?.toString(),
      swapEndTime:
          json['swapEndTime']?.toString() ?? json['SwapEndTime']?.toString(),
      swapHours: ((json['swapHours'] ?? json['SwapHours'] ?? 0.0) as num)
          .toDouble(),
      reason: json['reason']?.toString() ?? json['Reason']?.toString(),
      createdByName:
          json['createdByName']?.toString() ??
          json['CreatedByName']?.toString(),
      createdAt:
          DateTime.tryParse(
            json['createdAt']?.toString() ??
                json['CreatedAt']?.toString() ??
                '',
          ) ??
          DateTime.now(),
      status:
          json['status']?.toString() ?? json['Status']?.toString() ?? 'Active',
      reversedByName:
          json['reversedByName']?.toString() ??
          json['ReversedByName']?.toString(),
      reversedAt: json['reversedAt'] != null || json['ReversedAt'] != null
          ? DateTime.tryParse(
              json['reversedAt']?.toString() ??
                  json['ReversedAt']?.toString() ??
                  '',
            )
          : null,
      reversalReason:
          json['reversalReason']?.toString() ??
          json['ReversalReason']?.toString(),
    );
  }
}

class ShowroomVehicleTypeSummaryModel {
  final String vehicleTypeId;
  final String vehicleTypeCode;
  final String vehicleTypeName;
  final int totalVehicles;
  final int totalServices;
  final double totalStaffHours;
  final double sharePercentage;

  const ShowroomVehicleTypeSummaryModel({
    required this.vehicleTypeId,
    required this.vehicleTypeCode,
    required this.vehicleTypeName,
    required this.totalVehicles,
    required this.totalServices,
    required this.totalStaffHours,
    required this.sharePercentage,
  });

  factory ShowroomVehicleTypeSummaryModel.fromJson(Map<String, dynamic> json) {
    return ShowroomVehicleTypeSummaryModel(
      vehicleTypeId:
          json['vehicleTypeId']?.toString() ??
          json['VehicleTypeId']?.toString() ??
          '',
      vehicleTypeCode:
          json['vehicleTypeCode']?.toString() ??
          json['VehicleTypeCode']?.toString() ??
          '',
      vehicleTypeName:
          json['vehicleTypeName']?.toString() ??
          json['VehicleTypeName']?.toString() ??
          '',
      totalVehicles:
          json['totalVehicles'] as int? ?? json['TotalVehicles'] as int? ?? 0,
      totalServices:
          json['totalServices'] as int? ?? json['TotalServices'] as int? ?? 0,
      totalStaffHours:
          ((json['totalStaffHours'] ?? json['TotalStaffHours'] ?? 0.0) as num)
              .toDouble(),
      sharePercentage:
          ((json['sharePercentage'] ?? json['SharePercentage'] ?? 0.0) as num)
              .toDouble(),
    );
  }
}

class ShowroomServiceSummaryModel {
  final String workTypeId;
  final String serviceCategory;
  final String serviceCode;
  final String serviceName;
  final int totalVehicles;
  final int totalQuantity;
  final double totalStaffHours;
  final double sharePercentage;

  const ShowroomServiceSummaryModel({
    required this.workTypeId,
    required this.serviceCategory,
    required this.serviceCode,
    required this.serviceName,
    required this.totalVehicles,
    required this.totalQuantity,
    required this.totalStaffHours,
    required this.sharePercentage,
  });

  factory ShowroomServiceSummaryModel.fromJson(Map<String, dynamic> json) {
    return ShowroomServiceSummaryModel(
      workTypeId:
          json['workTypeId']?.toString() ??
          json['WorkTypeId']?.toString() ??
          '',
      serviceCategory:
          json['serviceCategory']?.toString() ??
          json['ServiceCategory']?.toString() ??
          'General',
      serviceCode:
          json['serviceCode']?.toString() ??
          json['ServiceCode']?.toString() ??
          '',
      serviceName:
          json['serviceName']?.toString() ??
          json['ServiceName']?.toString() ??
          '',
      totalVehicles:
          json['totalVehicles'] as int? ?? json['TotalVehicles'] as int? ?? 0,
      totalQuantity:
          json['totalQuantity'] as int? ?? json['TotalQuantity'] as int? ?? 0,
      totalStaffHours:
          ((json['totalStaffHours'] ?? json['TotalStaffHours'] ?? 0.0) as num)
              .toDouble(),
      sharePercentage:
          ((json['sharePercentage'] ?? json['SharePercentage'] ?? 0.0) as num)
              .toDouble(),
    );
  }
}

class ShowroomStaffSummaryModel {
  final String staffId;
  final String staffMasterId;
  final String staffName;
  final String? role;
  final String homeShowroom;
  final String assignmentType;
  final int totalVehicles;
  final int totalServices;
  final double totalHours;
  final int attendanceDays;
  final double workloadSharePercent;

  const ShowroomStaffSummaryModel({
    required this.staffId,
    required this.staffMasterId,
    required this.staffName,
    this.role,
    required this.homeShowroom,
    required this.assignmentType,
    required this.totalVehicles,
    required this.totalServices,
    required this.totalHours,
    required this.attendanceDays,
    required this.workloadSharePercent,
  });

  factory ShowroomStaffSummaryModel.fromJson(Map<String, dynamic> json) {
    return ShowroomStaffSummaryModel(
      staffId: json['staffId']?.toString() ?? json['StaffId']?.toString() ?? '',
      staffMasterId:
          json['staffMasterId']?.toString() ??
          json['StaffMasterId']?.toString() ??
          '',
      staffName:
          json['staffName']?.toString() ?? json['StaffName']?.toString() ?? '',
      role: json['role']?.toString() ?? json['Role']?.toString(),
      homeShowroom:
          json['homeShowroom']?.toString() ??
          json['HomeShowroom']?.toString() ??
          '',
      assignmentType:
          json['assignmentType']?.toString() ??
          json['AssignmentType']?.toString() ??
          'Regular',
      totalVehicles:
          json['totalVehicles'] as int? ?? json['TotalVehicles'] as int? ?? 0,
      totalServices:
          json['totalServices'] as int? ?? json['TotalServices'] as int? ?? 0,
      totalHours: ((json['totalHours'] ?? json['TotalHours'] ?? 0.0) as num)
          .toDouble(),
      attendanceDays:
          json['attendanceDays'] as int? ?? json['AttendanceDays'] as int? ?? 0,
      workloadSharePercent:
          ((json['workloadSharePercent'] ?? json['WorkloadSharePercent'] ?? 0.0)
                  as num)
              .toDouble(),
    );
  }
}

class MonthlyShowroomDetailModel {
  final String showroomId;
  final String showroomMasterId;
  final String showroomName;
  final String showroomAddress;
  final String? showroomPhone;
  final String? showroomGstin;
  final MonthlyShowroomSummaryModel summary;
  final List<MonthlyShowroomVehicleWorkRowModel> vehicleWorks;
  final List<ShowroomAttendanceReportRowModel> attendanceRecords;
  final List<ShowroomStaffSwapReportRowModel> swaps;
  final List<ShowroomVehicleTypeSummaryModel> vehicleTypeSummary;
  final List<ShowroomServiceSummaryModel> serviceSummary;
  final List<ShowroomStaffSummaryModel> staffSummary;

  const MonthlyShowroomDetailModel({
    required this.showroomId,
    required this.showroomMasterId,
    required this.showroomName,
    required this.showroomAddress,
    this.showroomPhone,
    this.showroomGstin,
    required this.summary,
    this.vehicleWorks = const [],
    this.attendanceRecords = const [],
    this.swaps = const [],
    this.vehicleTypeSummary = const [],
    this.serviceSummary = const [],
    this.staffSummary = const [],
  });

  factory MonthlyShowroomDetailModel.fromJson(Map<String, dynamic> json) {
    final rawWorks =
        json['vehicleWorks'] as List<dynamic>? ??
        json['VehicleWorks'] as List<dynamic>? ??
        [];
    final rawAtt =
        json['attendanceRecords'] as List<dynamic>? ??
        json['AttendanceRecords'] as List<dynamic>? ??
        [];
    final rawSwaps =
        json['swaps'] as List<dynamic>? ??
        json['Swaps'] as List<dynamic>? ??
        [];
    final rawVt =
        json['vehicleTypeSummary'] as List<dynamic>? ??
        json['VehicleTypeSummary'] as List<dynamic>? ??
        [];
    final rawSrv =
        json['serviceSummary'] as List<dynamic>? ??
        json['ServiceSummary'] as List<dynamic>? ??
        [];
    final rawSt =
        json['staffSummary'] as List<dynamic>? ??
        json['StaffSummary'] as List<dynamic>? ??
        [];

    return MonthlyShowroomDetailModel(
      showroomId:
          json['showroomId']?.toString() ??
          json['ShowroomId']?.toString() ??
          '',
      showroomMasterId:
          json['showroomMasterId']?.toString() ??
          json['ShowroomMasterId']?.toString() ??
          '',
      showroomName:
          json['showroomName']?.toString() ??
          json['ShowroomName']?.toString() ??
          '',
      showroomAddress:
          json['showroomAddress']?.toString() ??
          json['ShowroomAddress']?.toString() ??
          '',
      showroomPhone:
          json['showroomPhone']?.toString() ??
          json['ShowroomPhone']?.toString(),
      showroomGstin:
          json['showroomGstin']?.toString() ??
          json['ShowroomGstin']?.toString(),
      summary: MonthlyShowroomSummaryModel.fromJson(
        (json['summary'] ?? json['Summary'] ?? {}) as Map<String, dynamic>,
      ),
      vehicleWorks: rawWorks
          .map(
            (w) => MonthlyShowroomVehicleWorkRowModel.fromJson(
              w as Map<String, dynamic>,
            ),
          )
          .toList(),
      attendanceRecords: rawAtt
          .map(
            (a) => ShowroomAttendanceReportRowModel.fromJson(
              a as Map<String, dynamic>,
            ),
          )
          .toList(),
      swaps: rawSwaps
          .map(
            (s) => ShowroomStaffSwapReportRowModel.fromJson(
              s as Map<String, dynamic>,
            ),
          )
          .toList(),
      vehicleTypeSummary: rawVt
          .map(
            (v) => ShowroomVehicleTypeSummaryModel.fromJson(
              v as Map<String, dynamic>,
            ),
          )
          .toList(),
      serviceSummary: rawSrv
          .map(
            (s) =>
                ShowroomServiceSummaryModel.fromJson(s as Map<String, dynamic>),
          )
          .toList(),
      staffSummary: rawSt
          .map(
            (s) =>
                ShowroomStaffSummaryModel.fromJson(s as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}

class MonthlyShowroomSummaryModel {
  final int totalVehiclesServiced;
  final int totalWorkEntries;
  final int totalServicesPerformed;
  final int totalActiveStaff;
  final double totalBilledAmount;
  final double totalCollectedAmount;
  final double totalOutstandingAmount;
  final int totalBillingDays;
  final int paidDaysCount;
  final int partiallyPaidDaysCount;
  final int unpaidDaysCount;
  final double totalStaffHours;
  final int totalAttendanceDays;
  final int totalSwaps;

  const MonthlyShowroomSummaryModel({
    required this.totalVehiclesServiced,
    required this.totalWorkEntries,
    required this.totalServicesPerformed,
    required this.totalActiveStaff,
    required this.totalBilledAmount,
    required this.totalCollectedAmount,
    required this.totalOutstandingAmount,
    required this.totalBillingDays,
    required this.paidDaysCount,
    required this.partiallyPaidDaysCount,
    required this.unpaidDaysCount,
    this.totalStaffHours = 0.0,
    this.totalAttendanceDays = 0,
    this.totalSwaps = 0,
  });

  factory MonthlyShowroomSummaryModel.fromJson(Map<String, dynamic> json) {
    return MonthlyShowroomSummaryModel(
      totalVehiclesServiced:
          json['totalVehiclesServiced'] as int? ??
          json['TotalVehiclesServiced'] as int? ??
          0,
      totalWorkEntries:
          json['totalWorkEntries'] as int? ??
          json['TotalWorkEntries'] as int? ??
          0,
      totalServicesPerformed:
          json['totalServicesPerformed'] as int? ??
          json['TotalServicesPerformed'] as int? ??
          0,
      totalActiveStaff:
          json['totalActiveStaff'] as int? ??
          json['TotalActiveStaff'] as int? ??
          0,
      totalBilledAmount:
          ((json['totalBilledAmount'] ?? json['TotalBilledAmount'] ?? 0.0)
                  as num)
              .toDouble(),
      totalCollectedAmount:
          ((json['totalCollectedAmount'] ?? json['TotalCollectedAmount'] ?? 0.0)
                  as num)
              .toDouble(),
      totalOutstandingAmount:
          ((json['totalOutstandingAmount'] ??
                      json['TotalOutstandingAmount'] ??
                      0.0)
                  as num)
              .toDouble(),
      totalBillingDays:
          json['totalBillingDays'] as int? ??
          json['TotalBillingDays'] as int? ??
          0,
      paidDaysCount:
          json['paidDaysCount'] as int? ?? json['PaidDaysCount'] as int? ?? 0,
      partiallyPaidDaysCount:
          json['partiallyPaidDaysCount'] as int? ??
          json['PartiallyPaidDaysCount'] as int? ??
          0,
      unpaidDaysCount:
          json['unpaidDaysCount'] as int? ??
          json['UnpaidDaysCount'] as int? ??
          0,
      totalStaffHours:
          ((json['totalStaffHours'] ?? json['TotalStaffHours'] ?? 0.0) as num)
              .toDouble(),
      totalAttendanceDays:
          json['totalAttendanceDays'] as int? ??
          json['TotalAttendanceDays'] as int? ??
          0,
      totalSwaps: json['totalSwaps'] as int? ?? json['TotalSwaps'] as int? ?? 0,
    );
  }
}

class MonthlyShowroomReportResponseModel {
  final int year;
  final int month;
  final String monthName;
  final DateTime fromDate;
  final DateTime toDate;
  final List<MonthlyShowroomDetailModel> showrooms;

  const MonthlyShowroomReportResponseModel({
    required this.year,
    required this.month,
    required this.monthName,
    required this.fromDate,
    required this.toDate,
    required this.showrooms,
  });

  factory MonthlyShowroomReportResponseModel.fromJson(
    Map<String, dynamic> json,
  ) {
    final rawShowrooms =
        json['showrooms'] as List<dynamic>? ??
        json['Showrooms'] as List<dynamic>? ??
        [];
    return MonthlyShowroomReportResponseModel(
      year: json['year'] as int? ?? json['Year'] as int? ?? DateTime.now().year,
      month:
          json['month'] as int? ??
          json['Month'] as int? ??
          DateTime.now().month,
      monthName:
          json['monthName']?.toString() ?? json['MonthName']?.toString() ?? '',
      fromDate:
          DateTime.tryParse(
            json['fromDate']?.toString() ?? json['FromDate']?.toString() ?? '',
          ) ??
          DateTime.now(),
      toDate:
          DateTime.tryParse(
            json['toDate']?.toString() ?? json['ToDate']?.toString() ?? '',
          ) ??
          DateTime.now(),
      showrooms: rawShowrooms
          .map(
            (s) =>
                MonthlyShowroomDetailModel.fromJson(s as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
