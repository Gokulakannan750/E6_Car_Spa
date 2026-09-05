import 'package:flutter/foundation.dart';

@immutable
class DailyStaffAssignment {
  final String id;
  final String showroomId;
  final String showroomName;
  final String staffId;
  final String staffName;
  final String staffPhone;
  final String? staffRole;
  final DateTime date;
  final int vehiclesAttended;
  final DateTime createdAt;

  const DailyStaffAssignment({
    required this.id,
    required this.showroomId,
    required this.showroomName,
    required this.staffId,
    required this.staffName,
    required this.staffPhone,
    this.staffRole,
    required this.date,
    this.vehiclesAttended = 0,
    required this.createdAt,
  });

  String get initials {
    final parts = staffName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return 'S';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  factory DailyStaffAssignment.fromJson(Map<String, dynamic> json) {
    return DailyStaffAssignment(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      showroomId: json['showroomId'] as String? ?? json['ShowroomId'] as String? ?? '',
      showroomName: json['showroomName'] as String? ?? json['ShowroomName'] as String? ?? '',
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffName: json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      staffPhone: json['staffPhone'] as String? ?? json['StaffPhone'] as String? ?? '',
      staffRole: json['staffRole'] as String? ?? json['StaffRole'] as String?,
      date: json['date'] != null
          ? DateTime.tryParse(json['date'].toString()) ?? DateTime.now()
          : (json['Date'] != null
              ? DateTime.tryParse(json['Date'].toString()) ?? DateTime.now()
              : DateTime.now()),
      vehiclesAttended: (json['vehiclesAttended'] ?? json['VehiclesAttended'] ?? 0) as int,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'showroomId': showroomId,
    'showroomName': showroomName,
    'staffId': staffId,
    'staffName': staffName,
    'staffPhone': staffPhone,
    'staffRole': staffRole,
    'date': date.toIso8601String(),
    'vehiclesAttended': vehiclesAttended,
    'createdAt': createdAt.toIso8601String(),
  };
}

@immutable
class DailyStaffResponse {
  final String showroomId;
  final String showroomName;
  final DateTime date;
  final int totalVehiclesAttended;
  final bool isAttendanceConfirmed;
  final DateTime? attendanceConfirmedAt;
  final String? attendanceConfirmedByUserId;
  final String? attendanceConfirmedByName;
  final List<DailyStaffAssignment> staffAssignments;

  const DailyStaffResponse({
    required this.showroomId,
    required this.showroomName,
    required this.date,
    this.totalVehiclesAttended = 0,
    this.isAttendanceConfirmed = false,
    this.attendanceConfirmedAt,
    this.attendanceConfirmedByUserId,
    this.attendanceConfirmedByName,
    required this.staffAssignments,
  });

  factory DailyStaffResponse.fromJson(Map<String, dynamic> json) {
    final rawList = json['staffAssignments'] as List<dynamic>? ??
        json['StaffAssignments'] as List<dynamic>? ??
        [];

    return DailyStaffResponse(
      showroomId: json['showroomId'] as String? ?? json['ShowroomId'] as String? ?? '',
      showroomName: json['showroomName'] as String? ?? json['ShowroomName'] as String? ?? '',
      date: json['date'] != null
          ? DateTime.tryParse(json['date'].toString()) ?? DateTime.now()
          : (json['Date'] != null
              ? DateTime.tryParse(json['Date'].toString()) ?? DateTime.now()
              : DateTime.now()),
      totalVehiclesAttended: (json['totalVehiclesAttended'] ?? json['TotalVehiclesAttended'] ?? 0) as int,
      isAttendanceConfirmed: (json['isAttendanceConfirmed'] ?? json['IsAttendanceConfirmed'] ?? false) as bool,
      attendanceConfirmedAt: json['attendanceConfirmedAt'] != null
          ? DateTime.tryParse(json['attendanceConfirmedAt'].toString())
          : (json['AttendanceConfirmedAt'] != null
              ? DateTime.tryParse(json['AttendanceConfirmedAt'].toString())
              : null),
      attendanceConfirmedByUserId: json['attendanceConfirmedByUserId'] as String? ?? json['AttendanceConfirmedByUserId'] as String?,
      attendanceConfirmedByName: json['attendanceConfirmedByName'] as String? ?? json['AttendanceConfirmedByName'] as String?,
      staffAssignments: rawList.map((e) => DailyStaffAssignment.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'showroomId': showroomId,
    'showroomName': showroomName,
    'date': date.toIso8601String(),
    'totalVehiclesAttended': totalVehiclesAttended,
    'isAttendanceConfirmed': isAttendanceConfirmed,
    'attendanceConfirmedAt': attendanceConfirmedAt?.toIso8601String(),
    'attendanceConfirmedByUserId': attendanceConfirmedByUserId,
    'attendanceConfirmedByName': attendanceConfirmedByName,
    'staffAssignments': staffAssignments.map((e) => e.toJson()).toList(),
  };
}

@immutable
class CreateDailyStaffAssignmentRequest {
  final String staffId;
  final DateTime date;
  final int vehiclesAttended;

  const CreateDailyStaffAssignmentRequest({
    required this.staffId,
    required this.date,
    this.vehiclesAttended = 0,
  });

  Map<String, dynamic> toJson() => {
    'staffId': staffId,
    'date': date.toIso8601String().split('T').first,
    'vehiclesAttended': vehiclesAttended,
  };
}

@immutable
class UpdateDailyStaffAssignmentRequest {
  final int vehiclesAttended;

  const UpdateDailyStaffAssignmentRequest({
    required this.vehiclesAttended,
  });

  Map<String, dynamic> toJson() => {
    'vehiclesAttended': vehiclesAttended,
  };
}
