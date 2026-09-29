class StaffProductivityServiceItemModel {
  final String workTypeId;
  final String workTypeCode;
  final String workTypeName;
  final String? serviceCategory;
  final int vehicleCount;
  final int serviceQuantity;
  final double hours;
  final String assignmentType;
  final String? swapId;
  final String? originalStaffName;
  final String? replacementStaffName;

  const StaffProductivityServiceItemModel({
    required this.workTypeId,
    required this.workTypeCode,
    required this.workTypeName,
    this.serviceCategory,
    required this.vehicleCount,
    required this.serviceQuantity,
    required this.hours,
    required this.assignmentType,
    this.swapId,
    this.originalStaffName,
    this.replacementStaffName,
  });

  factory StaffProductivityServiceItemModel.fromJson(Map<String, dynamic> json) {
    return StaffProductivityServiceItemModel(
      workTypeId: json['workTypeId']?.toString() ?? json['WorkTypeId']?.toString() ?? '',
      workTypeCode: json['workTypeCode']?.toString() ?? json['WorkTypeCode']?.toString() ?? 'SRV',
      workTypeName: json['workTypeName']?.toString() ?? json['WorkTypeName']?.toString() ?? 'Service',
      serviceCategory: json['serviceCategory']?.toString() ?? json['ServiceCategory']?.toString(),
      vehicleCount: json['vehicleCount'] as int? ?? json['VehicleCount'] as int? ?? 0,
      serviceQuantity: json['serviceQuantity'] as int? ?? json['ServiceQuantity'] as int? ?? 0,
      hours: ((json['hours'] ?? json['Hours'] ?? 0.0) as num).toDouble(),
      assignmentType: json['assignmentType']?.toString() ?? json['AssignmentType']?.toString() ?? 'Regular',
      swapId: json['swapId']?.toString() ?? json['SwapId']?.toString(),
      originalStaffName: json['originalStaffName']?.toString() ?? json['OriginalStaffName']?.toString(),
      replacementStaffName: json['replacementStaffName']?.toString() ?? json['ReplacementStaffName']?.toString(),
    );
  }
}

class StaffProductivityVehicleTypeGroupModel {
  final String vehicleTypeId;
  final String vehicleTypeCode;
  final String vehicleTypeName;
  final int vehicleCount;
  final int serviceQuantity;
  final double hours;
  final List<StaffProductivityServiceItemModel> services;

  const StaffProductivityVehicleTypeGroupModel({
    required this.vehicleTypeId,
    required this.vehicleTypeCode,
    required this.vehicleTypeName,
    required this.vehicleCount,
    required this.serviceQuantity,
    required this.hours,
    required this.services,
  });

  factory StaffProductivityVehicleTypeGroupModel.fromJson(Map<String, dynamic> json) {
    final rawServices = json['services'] as List<dynamic>? ?? json['Services'] as List<dynamic>? ?? [];
    return StaffProductivityVehicleTypeGroupModel(
      vehicleTypeId: json['vehicleTypeId']?.toString() ?? json['VehicleTypeId']?.toString() ?? '',
      vehicleTypeCode: json['vehicleTypeCode']?.toString() ?? json['VehicleTypeCode']?.toString() ?? 'VEH',
      vehicleTypeName: json['vehicleTypeName']?.toString() ?? json['VehicleTypeName']?.toString() ?? 'Standard Vehicle',
      vehicleCount: json['vehicleCount'] as int? ?? json['VehicleCount'] as int? ?? 0,
      serviceQuantity: json['serviceQuantity'] as int? ?? json['ServiceQuantity'] as int? ?? 0,
      hours: ((json['hours'] ?? json['Hours'] ?? 0.0) as num).toDouble(),
      services: rawServices.map((s) => StaffProductivityServiceItemModel.fromJson(s as Map<String, dynamic>)).toList(),
    );
  }
}

class StaffProductivityWorkRecordModel {
  final String id;
  final DateTime date;
  final String showroomId;
  final String showroomMasterId;
  final String showroomName;
  final String staffId;
  final String staffMasterId;
  final String staffName;
  final String? role;
  final String? homeShowroomName;
  final String? workingShowroomName;
  final String vehicleTypeId;
  final String vehicleTypeCode;
  final String vehicleTypeName;
  final String workTypeId;
  final String workTypeCode;
  final String workTypeName;
  final String? serviceCategory;
  final int vehicleQuantity;
  final int serviceQuantity;
  final String? startTime;
  final String? endTime;
  final double workingHours;
  final String assignmentType;
  final String? swapId;
  final String? originalStaffName;
  final String? replacementStaffName;
  final String? notes;

  const StaffProductivityWorkRecordModel({
    required this.id,
    required this.date,
    required this.showroomId,
    required this.showroomMasterId,
    required this.showroomName,
    required this.staffId,
    required this.staffMasterId,
    required this.staffName,
    this.role,
    this.homeShowroomName,
    this.workingShowroomName,
    required this.vehicleTypeId,
    required this.vehicleTypeCode,
    required this.vehicleTypeName,
    required this.workTypeId,
    required this.workTypeCode,
    required this.workTypeName,
    this.serviceCategory,
    required this.vehicleQuantity,
    required this.serviceQuantity,
    this.startTime,
    this.endTime,
    required this.workingHours,
    required this.assignmentType,
    this.swapId,
    this.originalStaffName,
    this.replacementStaffName,
    this.notes,
  });

  factory StaffProductivityWorkRecordModel.fromJson(Map<String, dynamic> json) {
    return StaffProductivityWorkRecordModel(
      id: json['id']?.toString() ?? json['Id']?.toString() ?? '',
      date: DateTime.tryParse(json['date']?.toString() ?? json['Date']?.toString() ?? '') ?? DateTime.now(),
      showroomId: json['showroomId']?.toString() ?? json['ShowroomId']?.toString() ?? '',
      showroomMasterId: json['showroomMasterId']?.toString() ?? json['ShowroomMasterId']?.toString() ?? '',
      showroomName: json['showroomName']?.toString() ?? json['ShowroomName']?.toString() ?? '',
      staffId: json['staffId']?.toString() ?? json['StaffId']?.toString() ?? '',
      staffMasterId: json['staffMasterId']?.toString() ?? json['StaffMasterId']?.toString() ?? '',
      staffName: json['staffName']?.toString() ?? json['StaffName']?.toString() ?? '',
      role: json['role']?.toString() ?? json['Role']?.toString(),
      homeShowroomName: json['homeShowroomName']?.toString() ?? json['HomeShowroomName']?.toString(),
      workingShowroomName: json['workingShowroomName']?.toString() ?? json['WorkingShowroomName']?.toString(),
      vehicleTypeId: json['vehicleTypeId']?.toString() ?? json['VehicleTypeId']?.toString() ?? '',
      vehicleTypeCode: json['vehicleTypeCode']?.toString() ?? json['VehicleTypeCode']?.toString() ?? 'VEH',
      vehicleTypeName: json['vehicleTypeName']?.toString() ?? json['VehicleTypeName']?.toString() ?? 'Vehicle',
      workTypeId: json['workTypeId']?.toString() ?? json['WorkTypeId']?.toString() ?? '',
      workTypeCode: json['workTypeCode']?.toString() ?? json['WorkTypeCode']?.toString() ?? 'SRV',
      workTypeName: json['workTypeName']?.toString() ?? json['WorkTypeName']?.toString() ?? 'Service',
      serviceCategory: json['serviceCategory']?.toString() ?? json['ServiceCategory']?.toString(),
      vehicleQuantity: json['vehicleQuantity'] as int? ?? json['VehicleQuantity'] as int? ?? 0,
      serviceQuantity: json['serviceQuantity'] as int? ?? json['ServiceQuantity'] as int? ?? 0,
      startTime: json['startTime']?.toString() ?? json['StartTime']?.toString(),
      endTime: json['endTime']?.toString() ?? json['EndTime']?.toString(),
      workingHours: ((json['workingHours'] ?? json['WorkingHours'] ?? 0.0) as num).toDouble(),
      assignmentType: json['assignmentType']?.toString() ?? json['AssignmentType']?.toString() ?? 'Regular',
      swapId: json['swapId']?.toString() ?? json['SwapId']?.toString(),
      originalStaffName: json['originalStaffName']?.toString() ?? json['OriginalStaffName']?.toString(),
      replacementStaffName: json['replacementStaffName']?.toString() ?? json['ReplacementStaffName']?.toString(),
      notes: json['notes']?.toString() ?? json['Notes']?.toString(),
    );
  }
}

class StaffProductivityRowModel {
  final String staffId;
  final String staffMasterId;
  final String staffName;
  final String staffPhone;
  final String? role;
  final String? homeShowroomName;
  final String? workingShowroomName;
  final int daysAssigned;
  final int totalVehiclesAttended;
  final int totalServicesPerformed;
  final double totalWorkingHours;
  final double dailyAverage;
  final List<StaffProductivityVehicleTypeGroupModel> vehicleTypes;
  final List<StaffProductivityWorkRecordModel> workRecords;

  const StaffProductivityRowModel({
    required this.staffId,
    this.staffMasterId = '',
    required this.staffName,
    required this.staffPhone,
    this.role,
    this.homeShowroomName,
    this.workingShowroomName,
    required this.daysAssigned,
    required this.totalVehiclesAttended,
    this.totalServicesPerformed = 0,
    this.totalWorkingHours = 0.0,
    required this.dailyAverage,
    this.vehicleTypes = const [],
    this.workRecords = const [],
  });

  factory StaffProductivityRowModel.fromJson(Map<String, dynamic> json) {
    final rawVTypes = json['vehicleTypes'] as List<dynamic>? ?? json['VehicleTypes'] as List<dynamic>? ?? [];
    final rawRecords = json['workRecords'] as List<dynamic>? ?? json['WorkRecords'] as List<dynamic>? ?? [];

    return StaffProductivityRowModel(
      staffId: json['staffId']?.toString() ?? json['StaffId']?.toString() ?? '',
      staffMasterId: json['staffMasterId']?.toString() ?? json['StaffMasterId']?.toString() ?? '',
      staffName: json['staffName']?.toString() ?? json['StaffName']?.toString() ?? '',
      staffPhone: json['staffPhone']?.toString() ?? json['StaffPhone']?.toString() ?? '',
      role: json['role']?.toString() ?? json['Role']?.toString(),
      homeShowroomName: json['homeShowroomName']?.toString() ?? json['HomeShowroomName']?.toString(),
      workingShowroomName: json['workingShowroomName']?.toString() ?? json['WorkingShowroomName']?.toString(),
      daysAssigned: json['daysAssigned'] as int? ?? json['DaysAssigned'] as int? ?? 0,
      totalVehiclesAttended: json['totalVehiclesAttended'] as int? ?? json['TotalVehiclesAttended'] as int? ?? 0,
      totalServicesPerformed: json['totalServicesPerformed'] as int? ?? json['TotalServicesPerformed'] as int? ?? 0,
      totalWorkingHours: ((json['totalWorkingHours'] ?? json['TotalWorkingHours'] ?? 0.0) as num).toDouble(),
      dailyAverage: ((json['dailyAverage'] ?? json['DailyAverage'] ?? 0.0) as num).toDouble(),
      vehicleTypes: rawVTypes.map((v) => StaffProductivityVehicleTypeGroupModel.fromJson(v as Map<String, dynamic>)).toList(),
      workRecords: rawRecords.map((r) => StaffProductivityWorkRecordModel.fromJson(r as Map<String, dynamic>)).toList(),
    );
  }
}

class StaffProductivityReportResponseModel {
  final List<StaffProductivityRowModel> items;
  final List<StaffProductivityWorkRecordModel> granularRecords;
  final int totalStaff;
  final int totalDaysAssigned;
  final int totalVehiclesAttended;
  final int totalServicesPerformed;
  final double totalStaffHours;
  final double overallDailyAverage;
  final double averageVehiclesPerStaff;
  final double averageServicesPerStaff;

  const StaffProductivityReportResponseModel({
    required this.items,
    this.granularRecords = const [],
    required this.totalStaff,
    required this.totalDaysAssigned,
    required this.totalVehiclesAttended,
    this.totalServicesPerformed = 0,
    this.totalStaffHours = 0.0,
    required this.overallDailyAverage,
    this.averageVehiclesPerStaff = 0.0,
    this.averageServicesPerStaff = 0.0,
  });

  factory StaffProductivityReportResponseModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    final rawGranular = json['granularRecords'] as List<dynamic>? ?? json['GranularRecords'] as List<dynamic>? ?? [];

    return StaffProductivityReportResponseModel(
      items: rawItems.map((item) => StaffProductivityRowModel.fromJson(item as Map<String, dynamic>)).toList(),
      granularRecords: rawGranular.map((r) => StaffProductivityWorkRecordModel.fromJson(r as Map<String, dynamic>)).toList(),
      totalStaff: json['totalStaff'] as int? ?? json['TotalStaff'] as int? ?? 0,
      totalDaysAssigned: json['totalDaysAssigned'] as int? ?? json['TotalDaysAssigned'] as int? ?? 0,
      totalVehiclesAttended: json['totalVehiclesAttended'] as int? ?? json['TotalVehiclesAttended'] as int? ?? 0,
      totalServicesPerformed: json['totalServicesPerformed'] as int? ?? json['TotalServicesPerformed'] as int? ?? 0,
      totalStaffHours: ((json['totalStaffHours'] ?? json['TotalStaffHours'] ?? 0.0) as num).toDouble(),
      overallDailyAverage: ((json['overallDailyAverage'] ?? json['OverallDailyAverage'] ?? 0.0) as num).toDouble(),
      averageVehiclesPerStaff: ((json['averageVehiclesPerStaff'] ?? json['AverageVehiclesPerStaff'] ?? 0.0) as num).toDouble(),
      averageServicesPerStaff: ((json['averageServicesPerStaff'] ?? json['AverageServicesPerStaff'] ?? 0.0) as num).toDouble(),
    );
  }
}
