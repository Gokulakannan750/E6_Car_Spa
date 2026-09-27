import 'package:flutter/foundation.dart';

enum ShowroomSessionType {
  fullDay('Full Day', '09:00', '18:00', 9.0),
  morning('Morning', '09:00', '14:00', 5.0),
  afternoon('Afternoon', '14:00', '18:00', 4.0),
  custom('Custom', null, null, null);

  final String label;
  final String? defaultStart;
  final String? defaultEnd;
  final double? defaultHours;

  const ShowroomSessionType(this.label, this.defaultStart, this.defaultEnd, this.defaultHours);
}

double? calculateSessionHours(String startTime, String endTime) {
  final startParts = startTime.split(':').map(int.tryParse).toList();
  final endParts = endTime.split(':').map(int.tryParse).toList();
  if (startParts.length != 2 || endParts.length != 2) return null;
  if (startParts[0] == null || startParts[1] == null || endParts[0] == null || endParts[1] == null) return null;

  final startMins = startParts[0]! * 60 + startParts[1]!;
  final endMins = endParts[0]! * 60 + endParts[1]!;
  if (endMins <= startMins) return null;

  return (endMins - startMins) / 60.0;
}

String formatSessionHours(double hours) {
  final whole = hours.floor();
  final mins = ((hours - whole) * 60).round();
  if (mins > 0) return '${whole}h ${mins}m';
  return '${whole}h';
}

@immutable
class DailyStaffAssignment {
  final String id;
  final String showroomId;
  final String showroomName;
  final String staffId;
  final String staffMasterId;
  final String staffName;
  final String staffPhone;
  final String? staffRole;
  final DateTime date;
  final String startTime;
  final String endTime;
  final double? workingHours;
  final String? workingHoursFormatted;
  final String status;
  final String assignmentType;
  final String? homeShowroomId;
  final String? homeShowroomMasterId;
  final String? homeShowroomName;
  final String? transferReason;
  final String? notes;
  final int vehiclesAttended;
  final DateTime createdAt;

  const DailyStaffAssignment({
    required this.id,
    required this.showroomId,
    required this.showroomName,
    required this.staffId,
    this.staffMasterId = '',
    required this.staffName,
    required this.staffPhone,
    this.staffRole,
    required this.date,
    this.startTime = '09:00',
    this.endTime = '18:00',
    this.workingHours,
    this.workingHoursFormatted,
    this.status = 'Present',
    this.assignmentType = 'Regular',
    this.homeShowroomId,
    this.homeShowroomMasterId,
    this.homeShowroomName,
    this.transferReason,
    this.notes,
    this.vehiclesAttended = 0,
    required this.createdAt,
  });

  String get initials {
    final parts = staffName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return 'S';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  bool get isTemporaryTransfer =>
      assignmentType.toLowerCase().contains('transfer') ||
      (homeShowroomId != null && homeShowroomId!.isNotEmpty && homeShowroomId != showroomId);

  String get displayHomeShowroom =>
      (homeShowroomName != null && homeShowroomName!.trim().isNotEmpty)
          ? homeShowroomName!
          : showroomName;

  String get displayTimeRange => '$startTime – $endTime';

  String get displayHours {
    if (workingHoursFormatted != null && workingHoursFormatted!.isNotEmpty) {
      return workingHoursFormatted!;
    }
    if (workingHours != null) {
      return formatSessionHours(workingHours!);
    }
    final computed = calculateSessionHours(startTime, endTime);
    if (computed != null) {
      return formatSessionHours(computed);
    }
    return '—';
  }

  factory DailyStaffAssignment.fromJson(Map<String, dynamic> json) {
    final rawHours = json['workingHours'] ?? json['WorkingHours'];
    double? parsedHours;
    if (rawHours is num) {
      parsedHours = rawHours.toDouble();
    } else if (rawHours is String) {
      parsedHours = double.tryParse(rawHours);
    }

    final start = (json['startTime'] as String? ?? json['StartTime'] as String? ?? '09:00').trim();
    final end = (json['endTime'] as String? ?? json['EndTime'] as String? ?? '18:00').trim();

    return DailyStaffAssignment(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      showroomId: json['showroomId'] as String? ?? json['ShowroomId'] as String? ?? '',
      showroomName: json['showroomName'] as String? ?? json['ShowroomName'] as String? ?? '',
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffMasterId: json['staffMasterId'] as String? ?? json['StaffMasterId'] as String? ?? '',
      staffName: json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      staffPhone: json['staffPhone'] as String? ?? json['StaffPhone'] as String? ?? '',
      staffRole: json['staffRole'] as String? ?? json['StaffRole'] as String?,
      date: json['date'] != null
          ? DateTime.tryParse(json['date'].toString()) ?? DateTime.now()
          : (json['Date'] != null
              ? DateTime.tryParse(json['Date'].toString()) ?? DateTime.now()
              : DateTime.now()),
      startTime: start.isNotEmpty ? start : '09:00',
      endTime: end.isNotEmpty ? end : '18:00',
      workingHours: parsedHours,
      workingHoursFormatted: json['workingHoursFormatted'] as String? ?? json['WorkingHoursFormatted'] as String?,
      status: json['status'] as String? ?? json['Status'] as String? ?? 'Present',
      assignmentType: json['assignmentType'] as String? ?? json['AssignmentType'] as String? ?? 'Regular',
      homeShowroomId: json['homeShowroomId'] as String? ?? json['HomeShowroomId'] as String?,
      homeShowroomMasterId: json['homeShowroomMasterId'] as String? ?? json['HomeShowroomMasterId'] as String?,
      homeShowroomName: json['homeShowroomName'] as String? ?? json['HomeShowroomName'] as String?,
      transferReason: json['transferReason'] as String? ?? json['TransferReason'] as String?,
      notes: json['notes'] as String? ?? json['Notes'] as String?,
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
    'staffMasterId': staffMasterId,
    'staffName': staffName,
    'staffPhone': staffPhone,
    'staffRole': staffRole,
    'date': date.toIso8601String(),
    'startTime': startTime,
    'endTime': endTime,
    'workingHours': workingHours,
    'workingHoursFormatted': workingHoursFormatted,
    'status': status,
    'assignmentType': assignmentType,
    'homeShowroomId': homeShowroomId,
    'homeShowroomMasterId': homeShowroomMasterId,
    'homeShowroomName': homeShowroomName,
    'transferReason': transferReason,
    'notes': notes,
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

  double get totalScheduledHours {
    return staffAssignments.fold<double>(0.0, (sum, a) {
      final hours = a.workingHours ?? calculateSessionHours(a.startTime, a.endTime) ?? 0.0;
      return sum + hours;
    });
  }

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
  final String startTime;
  final String endTime;
  final String assignmentType;
  final String? transferReason;
  final String? notes;
  final int vehiclesAttended;

  const CreateDailyStaffAssignmentRequest({
    required this.staffId,
    required this.date,
    this.startTime = '09:00',
    this.endTime = '18:00',
    this.assignmentType = 'Regular',
    this.transferReason,
    this.notes,
    this.vehiclesAttended = 0,
  });

  Map<String, dynamic> toJson() => {
    'staffId': staffId,
    'date': date.toIso8601String().split('T').first,
    'startTime': startTime,
    'endTime': endTime,
    'assignmentType': assignmentType,
    if (transferReason != null && transferReason!.trim().isNotEmpty) 'transferReason': transferReason!.trim(),
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
    'vehiclesAttended': vehiclesAttended,
  };
}

@immutable
class UpdateDailyStaffAssignmentRequest {
  final String? startTime;
  final String? endTime;
  final String? status;
  final String? transferReason;
  final String? notes;
  final int? vehiclesAttended;

  const UpdateDailyStaffAssignmentRequest({
    this.startTime,
    this.endTime,
    this.status,
    this.transferReason,
    this.notes,
    this.vehiclesAttended,
  });

  Map<String, dynamic> toJson() => {
    if (startTime != null) 'startTime': startTime,
    if (endTime != null) 'endTime': endTime,
    if (status != null) 'status': status,
    if (transferReason != null) 'transferReason': transferReason,
    if (notes != null) 'notes': notes,
    if (vehiclesAttended != null) 'vehiclesAttended': vehiclesAttended,
  };
}

