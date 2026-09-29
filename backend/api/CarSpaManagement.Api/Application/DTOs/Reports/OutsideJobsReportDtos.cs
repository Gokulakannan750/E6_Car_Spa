using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record CurrentlyOutsideJobDto(
    Guid Id,
    Guid JobCardId,
    string JobCardNumber,
    Guid VehicleId,
    string VehicleRegistration,
    string VehicleModel,
    Guid CustomerId,
    string CustomerName,
    string CustomerPhone,
    Guid VendorId,
    string VendorName,
    string? VendorPhone,
    string ServiceName,
    DateTime SentAt,
    DateTime ExpectedReturnAt,
    bool IsOverdue,
    double OverdueHours,
    decimal? VendorCost,
    string? Notes);

public record OutsideJobHistoryReportDto(
    Guid Id,
    Guid JobCardId,
    string JobCardNumber,
    Guid VehicleId,
    string VehicleRegistration,
    string VehicleModel,
    Guid CustomerId,
    string CustomerName,
    string CustomerPhone,
    Guid VendorId,
    string VendorName,
    string ServiceName,
    OutsideJobStatus Status,
    string StatusName,
    DateTime SentAt,
    DateTime? ReturnedAt,
    DateTime ExpectedReturnAt,
    double? DurationHours,
    decimal? VendorCost,
    string? SentByUserName,
    string? ReturnedByUserName,
    string? Notes,
    string? ReturnNotes);

public record OutsideJobVendorSummaryDto(
    Guid VendorId,
    string VendorName,
    string? Phone,
    int TotalJobs,
    int CompletedJobs,
    int CurrentlyOutside,
    int OverdueJobs,
    int CancelledJobs,
    decimal TotalVendorCost);

public record OutsideJobReportResponse(
    IReadOnlyList<CurrentlyOutsideJobDto> CurrentlyOutside,
    IReadOnlyList<OutsideJobHistoryReportDto> History,
    IReadOnlyList<OutsideJobVendorSummaryDto> VendorSummary,
    int TotalOutsideCount,
    int TotalOverdueCount,
    decimal TotalActiveCost,
    decimal TotalHistoricalCost);
