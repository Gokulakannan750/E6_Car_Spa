namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record StaffProductivityRowDto(
    Guid StaffId,
    string StaffName,
    string StaffPhone,
    string? Role,
    int DaysAssigned,
    int TotalVehiclesAttended,
    decimal DailyAverage
);

public record StaffProductivityReportResponse(
    IReadOnlyList<StaffProductivityRowDto> Items,
    int TotalStaff,
    int TotalDaysAssigned,
    int TotalVehiclesAttended,
    decimal OverallDailyAverage
);
