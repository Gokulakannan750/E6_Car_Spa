import 'package:flutter/foundation.dart';

@immutable
class DailyStaffAttendanceItem {
  final String staffId;
  final String staffName;
  final String? staffRole;
  final String staffPhoneNumber;
  final bool isActive;
  final String? attendanceId;
  final String status; // 'Present', 'HalfDay', 'Leave', 'Unmarked'
  final String? checkInTime;
  final String? checkOutTime;
  final double? workingHours;
  final String? workingHoursFormatted;
  final String? notes;
  final String attendanceDate;

  const DailyStaffAttendanceItem({
    required this.staffId,
    required this.staffName,
    this.staffRole,
    required this.staffPhoneNumber,
    this.isActive = true,
    this.attendanceId,
    required this.status,
    this.checkInTime,
    this.checkOutTime,
    this.workingHours,
    this.workingHoursFormatted,
    this.notes,
    required this.attendanceDate,
  });

  factory DailyStaffAttendanceItem.fromJson(Map<String, dynamic> json) {
    return DailyStaffAttendanceItem(
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffName: json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      staffRole: json['staffRole'] as String? ?? json['StaffRole'] as String?,
      staffPhoneNumber: json['staffPhoneNumber'] as String? ?? json['StaffPhoneNumber'] as String? ?? '',
      isActive: (json['isActive'] ?? json['IsActive'] ?? true) as bool,
      attendanceId: json['attendanceId'] as String? ?? json['AttendanceId'] as String?,
      status: json['status'] as String? ?? json['Status'] as String? ?? 'Unmarked',
      checkInTime: json['checkInTime'] as String? ?? json['CheckInTime'] as String?,
      checkOutTime: json['checkOutTime'] as String? ?? json['CheckOutTime'] as String?,
      workingHours: (json['workingHours'] ?? json['WorkingHours'] as num?)?.toDouble(),
      workingHoursFormatted: json['workingHoursFormatted'] as String? ?? json['WorkingHoursFormatted'] as String?,
      notes: json['notes'] as String? ?? json['Notes'] as String?,
      attendanceDate: json['attendanceDate'] as String? ?? json['AttendanceDate'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'staffId': staffId,
    'staffName': staffName,
    'staffRole': staffRole,
    'staffPhoneNumber': staffPhoneNumber,
    'isActive': isActive,
    'attendanceId': attendanceId,
    'status': status,
    'checkInTime': checkInTime,
    'checkOutTime': checkOutTime,
    'workingHours': workingHours,
    'workingHoursFormatted': workingHoursFormatted,
    'notes': notes,
    'attendanceDate': attendanceDate,
  };
}

@immutable
class DailyAttendanceSummary {
  final int totalActiveStaff;
  final int presentCount;
  final int halfDayCount;
  final int leaveCount;
  final int unmarkedCount;

  const DailyAttendanceSummary({
    this.totalActiveStaff = 0,
    this.presentCount = 0,
    this.halfDayCount = 0,
    this.leaveCount = 0,
    this.unmarkedCount = 0,
  });

  factory DailyAttendanceSummary.fromJson(Map<String, dynamic> json) {
    return DailyAttendanceSummary(
      totalActiveStaff: (json['totalActiveStaff'] ?? json['TotalActiveStaff'] ?? json['totalStaff'] ?? json['TotalStaff'] ?? 0) as int,
      presentCount: (json['presentCount'] ?? json['PresentCount'] ?? 0) as int,
      halfDayCount: (json['halfDayCount'] ?? json['HalfDayCount'] ?? 0) as int,
      leaveCount: (json['leaveCount'] ?? json['LeaveCount'] ?? 0) as int,
      unmarkedCount: (json['unmarkedCount'] ?? json['UnmarkedCount'] ?? 0) as int,
    );
  }
}

@immutable
class DailyAttendanceResponse {
  final String date;
  final bool isAttendanceConfirmed;
  final DateTime? attendanceConfirmedAt;
  final String? attendanceConfirmedByUserId;
  final String? attendanceConfirmedByName;
  final DailyAttendanceSummary summary;
  final List<DailyStaffAttendanceItem> staffMembers;

  const DailyAttendanceResponse({
    required this.date,
    this.isAttendanceConfirmed = false,
    this.attendanceConfirmedAt,
    this.attendanceConfirmedByUserId,
    this.attendanceConfirmedByName,
    required this.summary,
    required this.staffMembers,
  });

  bool get isConfirmed => isAttendanceConfirmed;

  factory DailyAttendanceResponse.fromJson(Map<String, dynamic> json) {
    DateTime? confirmedAt;
    final rawConfirmed = json['attendanceConfirmedAt'] ?? json['AttendanceConfirmedAt'];
    if (rawConfirmed != null && rawConfirmed is String) {
      confirmedAt = DateTime.tryParse(rawConfirmed);
    }

    final rawList = (json['staffMembers'] ?? json['StaffMembers']) as List<dynamic>? ?? [];

    return DailyAttendanceResponse(
      date: json['date'] as String? ?? json['Date'] as String? ?? '',
      isAttendanceConfirmed: (json['isAttendanceConfirmed'] ?? json['IsAttendanceConfirmed'] ?? false) as bool,
      attendanceConfirmedAt: confirmedAt,
      attendanceConfirmedByUserId: json['attendanceConfirmedByUserId'] as String? ?? json['AttendanceConfirmedByUserId'] as String?,
      attendanceConfirmedByName: json['attendanceConfirmedByName'] as String? ?? json['AttendanceConfirmedByName'] as String?,
      summary: DailyAttendanceSummary.fromJson(
        ((json['summary'] ?? json['Summary']) as Map<String, dynamic>?) ?? {},
      ),
      staffMembers: rawList.map((e) => DailyStaffAttendanceItem.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

@immutable
class MonthlyStaffDailyRecord {
  final String date;
  final int day;
  final String dayOfWeek;
  final String status;
  final String? checkInTime;
  final String? checkOutTime;
  final double? workingHours;
  final String? workingHoursFormatted;
  final String? notes;

  const MonthlyStaffDailyRecord({
    required this.date,
    required this.day,
    required this.dayOfWeek,
    required this.status,
    this.checkInTime,
    this.checkOutTime,
    this.workingHours,
    this.workingHoursFormatted,
    this.notes,
  });

  factory MonthlyStaffDailyRecord.fromJson(Map<String, dynamic> json) {
    return MonthlyStaffDailyRecord(
      date: json['date'] as String? ?? json['Date'] as String? ?? '',
      day: (json['day'] ?? json['Day'] ?? 0) as int,
      dayOfWeek: json['dayOfWeek'] as String? ?? json['DayOfWeek'] as String? ?? '',
      status: json['status'] as String? ?? json['Status'] as String? ?? 'Unmarked',
      checkInTime: json['checkInTime'] as String? ?? json['CheckInTime'] as String?,
      checkOutTime: json['checkOutTime'] as String? ?? json['CheckOutTime'] as String?,
      workingHours: (json['workingHours'] ?? json['WorkingHours'] as num?)?.toDouble(),
      workingHoursFormatted: json['workingHoursFormatted'] as String? ?? json['WorkingHoursFormatted'] as String?,
      notes: json['notes'] as String? ?? json['Notes'] as String?,
    );
  }
}

@immutable
class MonthlyStaffAttendanceItem {
  final String staffId;
  final String name;
  final String? role;
  final String phoneNumber;
  final int presentDays;
  final int halfDays;
  final int leaveDays;
  final int unmarkedDays;
  final int attendanceDays;
  final List<MonthlyStaffDailyRecord> dailyRecords;

  const MonthlyStaffAttendanceItem({
    required this.staffId,
    required this.name,
    this.role,
    required this.phoneNumber,
    this.presentDays = 0,
    this.halfDays = 0,
    this.leaveDays = 0,
    this.unmarkedDays = 0,
    this.attendanceDays = 0,
    this.dailyRecords = const [],
  });

  factory MonthlyStaffAttendanceItem.fromJson(Map<String, dynamic> json) {
    final rawDaily = (json['dailyRecords'] ?? json['DailyRecords']) as List<dynamic>? ?? [];
    return MonthlyStaffAttendanceItem(
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      name: json['name'] as String? ?? json['Name'] as String? ?? '',
      role: json['role'] as String? ?? json['Role'] as String?,
      phoneNumber: json['phoneNumber'] as String? ?? json['PhoneNumber'] as String? ?? '',
      presentDays: (json['presentDays'] ?? json['PresentDays'] ?? 0) as int,
      halfDays: (json['halfDays'] ?? json['HalfDays'] ?? 0) as int,
      leaveDays: (json['leaveDays'] ?? json['LeaveDays'] ?? 0) as int,
      unmarkedDays: (json['unmarkedDays'] ?? json['UnmarkedDays'] ?? 0) as int,
      attendanceDays: (json['attendanceDays'] ?? json['AttendanceDays'] ?? 0) as int,
      dailyRecords: rawDaily.map((e) => MonthlyStaffDailyRecord.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

@immutable
class MonthlyAttendanceSummary {
  final int present;
  final int halfDay;
  final int leave;
  final int unmarked;

  const MonthlyAttendanceSummary({
    this.present = 0,
    this.halfDay = 0,
    this.leave = 0,
    this.unmarked = 0,
  });

  factory MonthlyAttendanceSummary.fromJson(Map<String, dynamic> json) {
    return MonthlyAttendanceSummary(
      present: (json['present'] ?? json['Present'] ?? 0) as int,
      halfDay: (json['halfDay'] ?? json['HalfDay'] ?? 0) as int,
      leave: (json['leave'] ?? json['Leave'] ?? 0) as int,
      unmarked: (json['unmarked'] ?? json['Unmarked'] ?? 0) as int,
    );
  }
}

@immutable
class MonthlyAttendanceReportResponse {
  final int year;
  final int month;
  final String fromDate;
  final String toDate;
  final int totalCalendarDays;
  final int staffCount;
  final MonthlyAttendanceSummary summary;
  final List<MonthlyStaffAttendanceItem> staffAttendance;

  const MonthlyAttendanceReportResponse({
    required this.year,
    required this.month,
    required this.fromDate,
    required this.toDate,
    this.totalCalendarDays = 0,
    this.staffCount = 0,
    required this.summary,
    required this.staffAttendance,
  });

  factory MonthlyAttendanceReportResponse.fromJson(Map<String, dynamic> json) {
    final rawStaff = (json['staffAttendance'] ?? json['StaffAttendance']) as List<dynamic>? ?? [];
    return MonthlyAttendanceReportResponse(
      year: (json['year'] ?? json['Year'] ?? DateTime.now().year) as int,
      month: (json['month'] ?? json['Month'] ?? DateTime.now().month) as int,
      fromDate: json['fromDate'] as String? ?? json['FromDate'] as String? ?? '',
      toDate: json['toDate'] as String? ?? json['ToDate'] as String? ?? '',
      totalCalendarDays: (json['totalCalendarDays'] ?? json['TotalCalendarDays'] ?? 0) as int,
      staffCount: (json['staffCount'] ?? json['StaffCount'] ?? 0) as int,
      summary: MonthlyAttendanceSummary.fromJson(
        ((json['summary'] ?? json['Summary']) as Map<String, dynamic>?) ?? {},
      ),
      staffAttendance: rawStaff.map((e) => MonthlyStaffAttendanceItem.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
