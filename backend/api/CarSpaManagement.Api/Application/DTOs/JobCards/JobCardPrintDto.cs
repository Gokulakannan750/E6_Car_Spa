using CarSpaManagement.Api.Application.DTOs.Customers;
using CarSpaManagement.Api.Domain.Entities;

namespace CarSpaManagement.Api.Application.DTOs.JobCards;

public record JobCardServicePrintDto(
 Guid Id,
 string ServiceName,
 int Quantity,
 decimal UnitPrice);

public record JobCardPrintDto(
 Guid Id,
 string JobCardNumber,
 CustomerSummaryDto Customer,
 VehicleSummaryDto Vehicle,
 string? Notes,
 IReadOnlyList<JobCardServicePrintDto> Services,
 DateTime CreatedAt);
