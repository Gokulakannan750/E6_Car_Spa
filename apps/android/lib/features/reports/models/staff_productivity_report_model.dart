class StaffProductivityRowModel {
  final String staffId;
  final String staffName;
  final String staffPhone;
  final String? role;
  final int daysAssigned;
  final int totalVehiclesAttended;
  final double dailyAverage;

  const StaffProductivityRowModel({
    required this.staffId,
    required this.staffName,
    required this.staffPhone,
    this.role,
    required this.daysAssigned,
    required this.totalVehiclesAttended,
    required this.dailyAverage,
  });

  factory StaffProductivityRowModel.fromJson(Map<String, dynamic> json) {
    return StaffProductivityRowModel(
      staffId: json['staffId']?.toString() ?? json['StaffId']?.toString() ?? '',
      staffName: json['staffName']?.toString() ?? json['StaffName']?.toString() ?? '',
      staffPhone: json['staffPhone']?.toString() ?? json['StaffPhone']?.toString() ?? '',
      role: json['role']?.toString() ?? json['Role']?.toString(),
      daysAssigned: json['daysAssigned'] as int? ?? json['DaysAssigned'] as int? ?? 0,
      totalVehiclesAttended: json['totalVehiclesAttended'] as int? ?? json['TotalVehiclesAttended'] as int? ?? 0,
      dailyAverage: ((json['dailyAverage'] ?? json['DailyAverage'] ?? 0.0) as num).toDouble(),
    );
  }
}

class StaffProductivityReportResponseModel {
  final List<StaffProductivityRowModel> items;
  final int totalStaff;
  final int totalDaysAssigned;
  final int totalVehiclesAttended;
  final double overallDailyAverage;

  const StaffProductivityReportResponseModel({
    required this.items,
    required this.totalStaff,
    required this.totalDaysAssigned,
    required this.totalVehiclesAttended,
    required this.overallDailyAverage,
  });

  factory StaffProductivityReportResponseModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return StaffProductivityReportResponseModel(
      items: rawItems.map((item) => StaffProductivityRowModel.fromJson(item as Map<String, dynamic>)).toList(),
      totalStaff: json['totalStaff'] as int? ?? json['TotalStaff'] as int? ?? 0,
      totalDaysAssigned: json['totalDaysAssigned'] as int? ?? json['TotalDaysAssigned'] as int? ?? 0,
      totalVehiclesAttended: json['totalVehiclesAttended'] as int? ?? json['TotalVehiclesAttended'] as int? ?? 0,
      overallDailyAverage: ((json['overallDailyAverage'] ?? json['OverallDailyAverage'] ?? 0.0) as num).toDouble(),
    );
  }
}
