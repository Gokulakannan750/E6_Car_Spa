namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record StaffProductivityServiceItemDto(
    Guid WorkTypeId,
    string WorkTypeCode,
    string WorkTypeName,
    string? ServiceCategory,
    int VehicleCount,
    int ServiceQuantity,
    decimal Hours,
    string AssignmentType,
    string? SwapId,
    string? OriginalStaffName,
    string? ReplacementStaffName
);

public record StaffProductivityVehicleTypeGroupDto(
    Guid VehicleTypeId,
    string VehicleTypeCode,
    string VehicleTypeName,
    int VehicleCount,
    int ServiceQuantity,
    decimal Hours,
    IReadOnlyList<StaffProductivityServiceItemDto> Services
);

public record StaffProductivityWorkRecordDto(
    Guid Id,
    DateTime Date,
    Guid ShowroomId,
    string ShowroomMasterId,
    string ShowroomName,
    Guid StaffId,
    string StaffMasterId,
    string StaffName,
    string? Role,
    string? HomeShowroomName,
    string? WorkingShowroomName,
    Guid VehicleTypeId,
    string VehicleTypeCode,
    string VehicleTypeName,
    Guid WorkTypeId,
    string WorkTypeCode,
    string WorkTypeName,
    string? ServiceCategory,
    int VehicleQuantity,
    int ServiceQuantity,
    string? StartTime,
    string? EndTime,
    decimal WorkingHours,
    string AssignmentType,
    string? SwapId,
    string? OriginalStaffName,
    string? ReplacementStaffName,
    string? Notes
);

public record StaffProductivityRowDto(
    Guid StaffId,
    string StaffMasterId,
    string StaffName,
    string StaffPhone,
    string? Role,
    string? HomeShowroomName,
    string? WorkingShowroomName,
    int DaysAssigned,
    int TotalVehiclesAttended,
    int TotalServicesPerformed,
    decimal TotalWorkingHours,
    decimal DailyAverage,
    IReadOnlyList<StaffProductivityVehicleTypeGroupDto> VehicleTypes,
    IReadOnlyList<StaffProductivityWorkRecordDto> WorkRecords
);

public record StaffProductivityReportResponse(
    IReadOnlyList<StaffProductivityRowDto> Items,
    IReadOnlyList<StaffProductivityWorkRecordDto> GranularRecords,
    int TotalStaff,
    int TotalVehiclesAttended,
    int TotalServicesPerformed,
    decimal TotalStaffHours,
    int TotalDaysAssigned,
    decimal OverallDailyAverage,
    decimal AverageVehiclesPerStaff,
    decimal AverageServicesPerStaff
);
