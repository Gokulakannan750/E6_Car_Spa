// ── Showroom Vehicle Type ──────────────────────────────────────────────────

class ShowroomVehicleType {
  final String id;
  final String code;
  final String name;
  final int displayOrder;
  final bool isActive;
  final DateTime createdAt;

  const ShowroomVehicleType({
    required this.id,
    required this.code,
    required this.name,
    this.displayOrder = 0,
    this.isActive = true,
    required this.createdAt,
  });

  factory ShowroomVehicleType.fromJson(Map<String, dynamic> json) {
    return ShowroomVehicleType(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      code: json['code'] as String? ?? json['Code'] as String? ?? '',
      name: json['name'] as String? ?? json['Name'] as String? ?? '',
      displayOrder:
          (json['displayOrder'] as num?)?.toInt() ??
          (json['DisplayOrder'] as num?)?.toInt() ??
          0,
      isActive: json['isActive'] as bool? ?? json['IsActive'] as bool? ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
                ? DateTime.tryParse(json['CreatedAt'].toString()) ??
                      DateTime.now()
                : DateTime.now()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': code,
    'name': name,
    'displayOrder': displayOrder,
    'isActive': isActive,
    'createdAt': createdAt.toIso8601String(),
  };
}

// ── Showroom Work Type ─────────────────────────────────────────────────────

class ShowroomWorkType {
  final String id;
  final String code;
  final String name;
  final String? description;
  final int displayOrder;
  final bool isActive;
  final DateTime createdAt;

  /// Server flag for the free-text "Other" work type; null when an older API does not send it.
  final bool? isOther;

  const ShowroomWorkType({
    required this.id,
    required this.code,
    required this.name,
    this.description,
    this.displayOrder = 0,
    this.isActive = true,
    required this.createdAt,
    this.isOther,
  });

  /// Whether this is the "Other" work type that needs a description. Uses the server flag, so
  /// renaming "Other" does not change it; the code check only covers an older API.
  bool get isOtherType => isOther ?? code.trim().toUpperCase() == 'OTHER';

  factory ShowroomWorkType.fromJson(Map<String, dynamic> json) {
    return ShowroomWorkType(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      code: json['code'] as String? ?? json['Code'] as String? ?? '',
      name: json['name'] as String? ?? json['Name'] as String? ?? '',
      description:
          json['description'] as String? ?? json['Description'] as String?,
      displayOrder:
          (json['displayOrder'] as num?)?.toInt() ??
          (json['DisplayOrder'] as num?)?.toInt() ??
          0,
      isActive: json['isActive'] as bool? ?? json['IsActive'] as bool? ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
                ? DateTime.tryParse(json['CreatedAt'].toString()) ??
                      DateTime.now()
                : DateTime.now()),
      isOther: json['isOther'] as bool? ?? json['IsOther'] as bool?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': code,
    'name': name,
    'description': description,
    'displayOrder': displayOrder,
    'isActive': isActive,
    'createdAt': createdAt.toIso8601String(),
    if (isOther != null) 'isOther': isOther,
  };
}

// ── Showroom Vehicle Work Item ─────────────────────────────────────────────

class ShowroomVehicleWorkItem {
  final String id;
  final String showroomVehicleWorkId;
  final String workTypeId;
  final String workTypeCode;
  final String workTypeName;
  final int quantity;
  final String? notes;
  final DateTime createdAt;

  const ShowroomVehicleWorkItem({
    required this.id,
    required this.showroomVehicleWorkId,
    required this.workTypeId,
    required this.workTypeCode,
    required this.workTypeName,
    this.quantity = 1,
    this.notes,
    required this.createdAt,
  });

  factory ShowroomVehicleWorkItem.fromJson(Map<String, dynamic> json) {
    return ShowroomVehicleWorkItem(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      showroomVehicleWorkId:
          json['showroomVehicleWorkId'] as String? ??
          json['ShowroomVehicleWorkId'] as String? ??
          '',
      workTypeId:
          json['workTypeId'] as String? ?? json['WorkTypeId'] as String? ?? '',
      workTypeCode:
          json['workTypeCode'] as String? ??
          json['WorkTypeCode'] as String? ??
          '',
      workTypeName:
          json['workTypeName'] as String? ??
          json['WorkTypeName'] as String? ??
          '',
      quantity:
          (json['quantity'] as num?)?.toInt() ??
          (json['Quantity'] as num?)?.toInt() ??
          1,
      notes: json['notes'] as String? ?? json['Notes'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
                ? DateTime.tryParse(json['CreatedAt'].toString()) ??
                      DateTime.now()
                : DateTime.now()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'showroomVehicleWorkId': showroomVehicleWorkId,
    'workTypeId': workTypeId,
    'workTypeCode': workTypeCode,
    'workTypeName': workTypeName,
    'quantity': quantity,
    'notes': notes,
    'createdAt': createdAt.toIso8601String(),
  };
}

// ── Showroom Vehicle Work ──────────────────────────────────────────────────

class ShowroomVehicleWork {
  final String id;
  final String showroomId;
  final String showroomMasterId;
  final String showroomName;
  final String staffId;
  final String staffMasterId;
  final String staffName;
  final String vehicleTypeId;
  final String vehicleTypeCode;
  final String vehicleTypeName;
  final String? showroomStaffWorkSessionId;
  final int vehicleQuantity;
  final DateTime date;
  final String? timeRecorded;
  final String? notes;
  final List<ShowroomVehicleWorkItem> serviceItems;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const ShowroomVehicleWork({
    required this.id,
    required this.showroomId,
    this.showroomMasterId = '',
    this.showroomName = '',
    required this.staffId,
    this.staffMasterId = '',
    this.staffName = '',
    required this.vehicleTypeId,
    this.vehicleTypeCode = '',
    this.vehicleTypeName = '',
    this.showroomStaffWorkSessionId,
    this.vehicleQuantity = 1,
    required this.date,
    this.timeRecorded,
    this.notes,
    this.serviceItems = const [],
    required this.createdAt,
    this.updatedAt,
  });

  String get displayStaffName =>
      staffName.isNotEmpty ? staffName : 'Unknown Staff';
  String get displayVehicleType =>
      vehicleTypeName.isNotEmpty ? vehicleTypeName : vehicleTypeCode;
  String get displayTime => timeRecorded != null && timeRecorded!.isNotEmpty
      ? timeRecorded!
      : '${createdAt.toLocal().hour.toString().padLeft(2, '0')}:${createdAt.toLocal().minute.toString().padLeft(2, '0')}';

  String get serviceTypesSummary => serviceItems
      .map((s) => s.workTypeName.isNotEmpty ? s.workTypeName : s.workTypeCode)
      .join(', ');

  factory ShowroomVehicleWork.fromJson(Map<String, dynamic> json) {
    var rawItems =
        json['serviceItems'] as List<dynamic>? ??
        json['ServiceItems'] as List<dynamic>? ??
        [];
    var items = rawItems
        .map((e) => ShowroomVehicleWorkItem.fromJson(e as Map<String, dynamic>))
        .toList();

    return ShowroomVehicleWork(
      id: json['id'] as String? ?? '',
      showroomId:
          json['showroomId'] as String? ?? json['ShowroomId'] as String? ?? '',
      showroomMasterId:
          json['showroomMasterId'] as String? ??
          json['ShowroomMasterId'] as String? ??
          '',
      showroomName:
          json['showroomName'] as String? ??
          json['ShowroomName'] as String? ??
          '',
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffMasterId:
          json['staffMasterId'] as String? ??
          json['StaffMasterId'] as String? ??
          '',
      staffName:
          json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      vehicleTypeId:
          json['vehicleTypeId'] as String? ??
          json['VehicleTypeId'] as String? ??
          '',
      vehicleTypeCode:
          json['vehicleTypeCode'] as String? ??
          json['VehicleTypeCode'] as String? ??
          '',
      vehicleTypeName:
          json['vehicleTypeName'] as String? ??
          json['VehicleTypeName'] as String? ??
          '',
      showroomStaffWorkSessionId:
          json['showroomStaffWorkSessionId'] as String? ??
          json['ShowroomStaffWorkSessionId'] as String?,
      vehicleQuantity:
          (json['vehicleQuantity'] as num?)?.toInt() ??
          (json['VehicleQuantity'] as num?)?.toInt() ??
          1,
      date: json['date'] != null
          ? DateTime.tryParse(json['date'].toString()) ?? DateTime.now()
          : (json['Date'] != null
                ? DateTime.tryParse(json['Date'].toString()) ?? DateTime.now()
                : DateTime.now()),
      timeRecorded:
          json['timeRecorded'] as String? ?? json['TimeRecorded'] as String?,
      notes: json['notes'] as String? ?? json['Notes'] as String?,
      serviceItems: items,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
                ? DateTime.tryParse(json['CreatedAt'].toString()) ??
                      DateTime.now()
                : DateTime.now()),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : (json['UpdatedAt'] != null
                ? DateTime.tryParse(json['UpdatedAt'].toString())
                : null),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'showroomId': showroomId,
    'showroomMasterId': showroomMasterId,
    'showroomName': showroomName,
    'staffId': staffId,
    'staffMasterId': staffMasterId,
    'staffName': staffName,
    'vehicleTypeId': vehicleTypeId,
    'vehicleTypeCode': vehicleTypeCode,
    'vehicleTypeName': vehicleTypeName,
    'showroomStaffWorkSessionId': showroomStaffWorkSessionId,
    'vehicleQuantity': vehicleQuantity,
    'date': date.toIso8601String(),
    'timeRecorded': timeRecorded,
    'notes': notes,
    'serviceItems': serviceItems.map((e) => e.toJson()).toList(),
    'createdAt': createdAt.toIso8601String(),
    if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
  };
}

// ── Operations Requests ────────────────────────────────────────────────────

class CreateShowroomVehicleWorkItemRequest {
  final String workTypeId;
  final int quantity;
  final String? notes;

  const CreateShowroomVehicleWorkItemRequest({
    required this.workTypeId,
    this.quantity = 1,
    this.notes,
  });

  Map<String, dynamic> toJson() => {
    'workTypeId': workTypeId,
    'quantity': quantity,
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
  };
}

class CreateShowroomVehicleWorkRequest {
  final String staffId;
  final String vehicleTypeId;
  final String? showroomStaffWorkSessionId;
  final int vehicleQuantity;
  final DateTime date;
  final String? timeRecorded;
  final String? notes;
  final List<CreateShowroomVehicleWorkItemRequest>? serviceItems;

  const CreateShowroomVehicleWorkRequest({
    required this.staffId,
    required this.vehicleTypeId,
    this.showroomStaffWorkSessionId,
    this.vehicleQuantity = 1,
    required this.date,
    this.timeRecorded,
    this.notes,
    this.serviceItems,
  });

  Map<String, dynamic> toJson() => {
    'staffId': staffId,
    'vehicleTypeId': vehicleTypeId,
    if (showroomStaffWorkSessionId != null &&
        showroomStaffWorkSessionId!.isNotEmpty)
      'showroomStaffWorkSessionId': showroomStaffWorkSessionId,
    'vehicleQuantity': vehicleQuantity,
    'date': date.toIso8601String().split('T').first,
    if (timeRecorded != null && timeRecorded!.isNotEmpty)
      'timeRecorded': timeRecorded,
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
    if (serviceItems != null && serviceItems!.isNotEmpty)
      'serviceItems': serviceItems!.map((e) => e.toJson()).toList(),
  };
}

class UpdateShowroomVehicleWorkRequest {
  final String? staffId;
  final String? vehicleTypeId;
  final String? showroomStaffWorkSessionId;
  final int? vehicleQuantity;
  final DateTime? date;
  final String? timeRecorded;
  final String? notes;
  final List<CreateShowroomVehicleWorkItemRequest>? serviceItems;

  const UpdateShowroomVehicleWorkRequest({
    this.staffId,
    this.vehicleTypeId,
    this.showroomStaffWorkSessionId,
    this.vehicleQuantity,
    this.date,
    this.timeRecorded,
    this.notes,
    this.serviceItems,
  });

  Map<String, dynamic> toJson() => {
    if (staffId != null) 'staffId': staffId,
    if (vehicleTypeId != null) 'vehicleTypeId': vehicleTypeId,
    if (showroomStaffWorkSessionId != null)
      'showroomStaffWorkSessionId': showroomStaffWorkSessionId,
    if (vehicleQuantity != null) 'vehicleQuantity': vehicleQuantity,
    if (date != null) 'date': date!.toIso8601String().split('T').first,
    if (timeRecorded != null) 'timeRecorded': timeRecorded,
    if (notes != null) 'notes': notes,
    if (serviceItems != null)
      'serviceItems': serviceItems!.map((e) => e.toJson()).toList(),
  };
}

class IndividualVehicleWorkEntry {
  final String vehicleTypeId;
  final List<String> workTypeIds;
  final String? notes;
  final Map<String, String>? workTypeNotes;
  final String? otherDescription;

  const IndividualVehicleWorkEntry({
    required this.vehicleTypeId,
    required this.workTypeIds,
    this.notes,
    this.workTypeNotes,
    this.otherDescription,
  });

  Map<String, dynamic> toJson() => {
    'vehicleTypeId': vehicleTypeId,
    'workTypeIds': workTypeIds,
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
    if (workTypeNotes != null && workTypeNotes!.isNotEmpty)
      'workTypeNotes': workTypeNotes,
    if (otherDescription != null && otherDescription!.trim().isNotEmpty)
      'otherDescription': otherDescription!.trim(),
  };
}

class CreateBatchShowroomVehicleWorkRequest {
  final String staffId;
  final String? showroomStaffWorkSessionId;
  final DateTime date;
  final String? timeRecorded;
  final String? notes;
  final List<IndividualVehicleWorkEntry> vehicles;

  const CreateBatchShowroomVehicleWorkRequest({
    required this.staffId,
    this.showroomStaffWorkSessionId,
    required this.date,
    this.timeRecorded,
    this.notes,
    required this.vehicles,
  });

  Map<String, dynamic> toJson() => {
    'staffId': staffId,
    if (showroomStaffWorkSessionId != null &&
        showroomStaffWorkSessionId!.isNotEmpty)
      'showroomStaffWorkSessionId': showroomStaffWorkSessionId,
    'date': date.toIso8601String().split('T').first,
    if (timeRecorded != null && timeRecorded!.isNotEmpty)
      'timeRecorded': timeRecorded,
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
    'vehicles': vehicles.map((e) => e.toJson()).toList(),
  };
}

class CloseShowroomStaffWorkSessionRequest {
  final String? endTime;
  final String? notes;

  const CloseShowroomStaffWorkSessionRequest({this.endTime, this.notes});

  Map<String, dynamic> toJson() => {
    if (endTime != null && endTime!.isNotEmpty) 'endTime': endTime,
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
  };
}

// ── Showroom Operations Summaries & Breakdowns ─────────────────────────────

class VehicleTypeWorkSummary {
  final String vehicleTypeId;
  final String vehicleTypeCode;
  final String vehicleTypeName;
  final int totalVehicles;

  const VehicleTypeWorkSummary({
    required this.vehicleTypeId,
    required this.vehicleTypeCode,
    required this.vehicleTypeName,
    required this.totalVehicles,
  });

  factory VehicleTypeWorkSummary.fromJson(Map<String, dynamic> json) {
    return VehicleTypeWorkSummary(
      vehicleTypeId:
          json['vehicleTypeId'] as String? ??
          json['VehicleTypeId'] as String? ??
          '',
      vehicleTypeCode:
          json['vehicleTypeCode'] as String? ??
          json['VehicleTypeCode'] as String? ??
          '',
      vehicleTypeName:
          json['vehicleTypeName'] as String? ??
          json['VehicleTypeName'] as String? ??
          '',
      totalVehicles:
          (json['totalVehicles'] as num?)?.toInt() ??
          (json['TotalVehicles'] as num?)?.toInt() ??
          0,
    );
  }

  Map<String, dynamic> toJson() => {
    'vehicleTypeId': vehicleTypeId,
    'vehicleTypeCode': vehicleTypeCode,
    'vehicleTypeName': vehicleTypeName,
    'totalVehicles': totalVehicles,
  };
}

class WorkTypeWorkSummary {
  final String workTypeId;
  final String workTypeCode;
  final String workTypeName;
  final int totalQuantity;

  int get totalPerformed => totalQuantity;

  const WorkTypeWorkSummary({
    required this.workTypeId,
    required this.workTypeCode,
    required this.workTypeName,
    required this.totalQuantity,
  });

  factory WorkTypeWorkSummary.fromJson(Map<String, dynamic> json) {
    return WorkTypeWorkSummary(
      workTypeId:
          json['workTypeId'] as String? ?? json['WorkTypeId'] as String? ?? '',
      workTypeCode:
          json['workTypeCode'] as String? ??
          json['WorkTypeCode'] as String? ??
          '',
      workTypeName:
          json['workTypeName'] as String? ??
          json['WorkTypeName'] as String? ??
          '',
      totalQuantity:
          (json['totalQuantity'] as num?)?.toInt() ??
          (json['TotalQuantity'] as num?)?.toInt() ??
          0,
    );
  }

  Map<String, dynamic> toJson() => {
    'workTypeId': workTypeId,
    'workTypeCode': workTypeCode,
    'workTypeName': workTypeName,
    'totalQuantity': totalQuantity,
  };
}

class StaffWorkSummary {
  final String staffId;
  final String staffMasterId;
  final String staffName;
  final int totalSessions;
  final int totalVehiclesHandled;
  final int totalServicesPerformed;

  const StaffWorkSummary({
    required this.staffId,
    required this.staffMasterId,
    required this.staffName,
    required this.totalSessions,
    required this.totalVehiclesHandled,
    required this.totalServicesPerformed,
  });

  factory StaffWorkSummary.fromJson(Map<String, dynamic> json) {
    return StaffWorkSummary(
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffMasterId:
          json['staffMasterId'] as String? ??
          json['StaffMasterId'] as String? ??
          '',
      staffName:
          json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      totalSessions:
          (json['totalSessions'] as num?)?.toInt() ??
          (json['TotalSessions'] as num?)?.toInt() ??
          0,
      totalVehiclesHandled:
          (json['totalVehiclesHandled'] as num?)?.toInt() ??
          (json['TotalVehiclesHandled'] as num?)?.toInt() ??
          0,
      totalServicesPerformed:
          (json['totalServicesPerformed'] as num?)?.toInt() ??
          (json['TotalServicesPerformed'] as num?)?.toInt() ??
          0,
    );
  }

  Map<String, dynamic> toJson() => {
    'staffId': staffId,
    'staffMasterId': staffMasterId,
    'staffName': staffName,
    'totalSessions': totalSessions,
    'totalVehiclesHandled': totalVehiclesHandled,
    'totalServicesPerformed': totalServicesPerformed,
  };
}

class ShowroomOperationsSummary {
  final String showroomId;
  final String showroomMasterId;
  final String showroomName;
  final DateTime fromDate;
  final DateTime toDate;
  final int totalVehiclesHandled;
  final int totalServicesPerformed;
  final int totalActiveStaffSessions;
  final List<VehicleTypeWorkSummary> vehicleTypeBreakdown;
  final List<WorkTypeWorkSummary> workTypeBreakdown;
  final List<StaffWorkSummary> staffProductivityBreakdown;

  const ShowroomOperationsSummary({
    required this.showroomId,
    this.showroomMasterId = '',
    this.showroomName = '',
    required this.fromDate,
    required this.toDate,
    this.totalVehiclesHandled = 0,
    this.totalServicesPerformed = 0,
    this.totalActiveStaffSessions = 0,
    this.vehicleTypeBreakdown = const [],
    this.workTypeBreakdown = const [],
    this.staffProductivityBreakdown = const [],
  });

  bool get isEmpty =>
      totalVehiclesHandled == 0 &&
      totalServicesPerformed == 0 &&
      totalActiveStaffSessions == 0 &&
      vehicleTypeBreakdown.isEmpty &&
      workTypeBreakdown.isEmpty;

  factory ShowroomOperationsSummary.fromJson(Map<String, dynamic> json) {
    var rawVehicles =
        json['vehicleTypeBreakdown'] as List<dynamic>? ??
        json['VehicleTypeBreakdown'] as List<dynamic>? ??
        [];
    var vehicleList = rawVehicles
        .map((e) => VehicleTypeWorkSummary.fromJson(e as Map<String, dynamic>))
        .toList();

    var rawWorks =
        json['workTypeBreakdown'] as List<dynamic>? ??
        json['WorkTypeBreakdown'] as List<dynamic>? ??
        [];
    var workList = rawWorks
        .map((e) => WorkTypeWorkSummary.fromJson(e as Map<String, dynamic>))
        .toList();

    var rawStaff =
        json['staffProductivityBreakdown'] as List<dynamic>? ??
        json['StaffProductivityBreakdown'] as List<dynamic>? ??
        [];
    var staffList = rawStaff
        .map((e) => StaffWorkSummary.fromJson(e as Map<String, dynamic>))
        .toList();

    return ShowroomOperationsSummary(
      showroomId:
          json['showroomId'] as String? ?? json['ShowroomId'] as String? ?? '',
      showroomMasterId:
          json['showroomMasterId'] as String? ??
          json['ShowroomMasterId'] as String? ??
          '',
      showroomName:
          json['showroomName'] as String? ??
          json['ShowroomName'] as String? ??
          '',
      fromDate: json['fromDate'] != null
          ? DateTime.tryParse(json['fromDate'].toString()) ?? DateTime.now()
          : (json['FromDate'] != null
                ? DateTime.tryParse(json['FromDate'].toString()) ??
                      DateTime.now()
                : DateTime.now()),
      toDate: json['toDate'] != null
          ? DateTime.tryParse(json['toDate'].toString()) ?? DateTime.now()
          : (json['ToDate'] != null
                ? DateTime.tryParse(json['ToDate'].toString()) ?? DateTime.now()
                : DateTime.now()),
      totalVehiclesHandled:
          (json['totalVehiclesHandled'] as num?)?.toInt() ??
          (json['TotalVehiclesHandled'] as num?)?.toInt() ??
          0,
      totalServicesPerformed:
          (json['totalServicesPerformed'] as num?)?.toInt() ??
          (json['TotalServicesPerformed'] as num?)?.toInt() ??
          0,
      totalActiveStaffSessions:
          (json['totalActiveStaffSessions'] as num?)?.toInt() ??
          (json['TotalActiveStaffSessions'] as num?)?.toInt() ??
          0,
      vehicleTypeBreakdown: vehicleList,
      workTypeBreakdown: workList,
      staffProductivityBreakdown: staffList,
    );
  }

  Map<String, dynamic> toJson() => {
    'showroomId': showroomId,
    'showroomMasterId': showroomMasterId,
    'showroomName': showroomName,
    'fromDate': fromDate.toIso8601String(),
    'toDate': toDate.toIso8601String(),
    'totalVehiclesHandled': totalVehiclesHandled,
    'totalServicesPerformed': totalServicesPerformed,
    'totalActiveStaffSessions': totalActiveStaffSessions,
    'vehicleTypeBreakdown': vehicleTypeBreakdown
        .map((e) => e.toJson())
        .toList(),
    'workTypeBreakdown': workTypeBreakdown.map((e) => e.toJson()).toList(),
    'staffProductivityBreakdown': staffProductivityBreakdown
        .map((e) => e.toJson())
        .toList(),
  };
}
