using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.OutsideJobs;

public record OutsideJobDto(
    Guid Id,
    Guid JobCardId,
    string JobCardNumber,
    Guid VehicleId,
    string VehicleRegistrationNumber,
    string VehicleMake,
    string VehicleModel,
    Guid CustomerId,
    string CustomerName,
    string CustomerPhone,
    Guid VendorId,
    string VendorName,
    string? VendorPhone,
    Guid? ServiceId,
    string ServiceName,
    OutsideJobStatus Status,
    string StatusName,
    DateTime SentAt,
    DateTime ExpectedReturnAt,
    DateTime? ReturnedAt,
    bool IsOverdue,
    Guid? SentByUserId,
    string? SentByUserName,
    Guid? ReturnedByUserId,
    string? ReturnedByUserName,
    decimal? VendorCost,
    string? Notes,
    string? ReturnNotes,
    string? CancellationReason,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record VehicleLocationDto(
    string Location,
    bool IsOutside,
    Guid? ActiveOutsideJobId,
    Guid? VendorId,
    string? VendorName,
    string? ServiceName,
    DateTime? SentAt,
    DateTime? ExpectedReturnAt,
    bool IsOverdue);

public record CreateOutsideJobRequest(
    [Required]
    Guid VendorId,
    [Required]
    [MaxLength(150)]
    string ServiceName,
    Guid? ServiceId = null,
    DateTime? SentAt = null,
    DateTime? ExpectedReturnAt = null,
    string? SentByType = null,
    Guid? SentByStaffId = null,
    string? SentByStaffName = null,
    decimal? VendorCost = null,
    [MaxLength(1000)]
    string? Notes = null);

public record MarkOutsideJobReturnedRequest(
    DateTime? ReturnedAt,
    decimal? VendorCost,
    [MaxLength(1000)]
    string? ReturnNotes);

public record CancelOutsideJobRequest(
    [Required]
    [MaxLength(500)]
    string Reason);

public record UpdateOutsideJobRequest(
    [Required]
    Guid VendorId,
    [Required]
    [MaxLength(150)]
    string ServiceName,
    Guid? ServiceId,
    [Required]
    DateTime ExpectedReturnAt,
    decimal? VendorCost,
    [MaxLength(1000)]
    string? Notes);

public record OutsideJobListResponse(
    IReadOnlyList<OutsideJobDto> Items,
    int TotalCount,
    int Page,
    int PageSize);
