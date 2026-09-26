using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.DTOs.Reports;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class MonthlyShowroomReportTests
{
    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new AppDbContext(options);
    }

    [Fact]
    public async Task GetMonthlyShowroomReportAsync_FiltersCorrectCalendarMonth_AndIsolatesShowrooms()
    {
        using var db = CreateInMemoryDb();

        // 1. Showrooms
        var showroomHonda = new Showroom { Id = Guid.NewGuid(), MasterId = "SHR0001", Name = "Honda Dealership", Address = "123 Auto St", IsActive = true };
        var showroomSkoda = new Showroom { Id = Guid.NewGuid(), MasterId = "SHR0002", Name = "Skoda Dealership", Address = "456 German St", IsActive = true };
        db.Showrooms.AddRange(showroomHonda, showroomSkoda);

        // 2. Staff
        var staff1 = new Staff { Id = Guid.NewGuid(), StaffMasterId = "ST001A", Name = "Kavitha", PhoneNumber = "9876500001", Role = "Senior Tech" };
        var staff2 = new Staff { Id = Guid.NewGuid(), StaffMasterId = "ST002B", Name = "Ramesh", PhoneNumber = "9876500002", Role = "Junior Tech" };
        db.Staff.AddRange(staff1, staff2);

        // 3. Vehicle & Work Types
        var carType = new ShowroomVehicleType { Id = Guid.NewGuid(), Code = "CAR", Name = "Sedan", DisplayOrder = 1, IsActive = true };
        var suvType = new ShowroomVehicleType { Id = Guid.NewGuid(), Code = "SUV", Name = "Compact SUV", DisplayOrder = 2, IsActive = true };
        var washWork = new ShowroomWorkType { Id = Guid.NewGuid(), Code = "WASH", Name = "Full Body Wash", DisplayOrder = 1, IsActive = true };
        var polishWork = new ShowroomWorkType { Id = Guid.NewGuid(), Code = "POLISH", Name = "Teflon Polish", DisplayOrder = 2, IsActive = true };
        db.ShowroomVehicleTypes.AddRange(carType, suvType);
        db.ShowroomWorkTypes.AddRange(washWork, polishWork);

        // 4. Vehicle works in September 2026 for Honda (2 entries = 3 vehicles)
        var workHonda1 = new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomHonda.Id,
            StaffId = staff1.Id,
            VehicleTypeId = carType.Id,
            VehicleQuantity = 2,
            Date = new DateTime(2026, 9, 15, 0, 0, 0, DateTimeKind.Utc),
            TimeRecorded = "10:30",
            Notes = "VIP Customer cars",
            ServiceItems = new List<ShowroomVehicleWorkItem>
            {
                new() { Id = Guid.NewGuid(), WorkTypeId = washWork.Id, Quantity = 2 },
                new() { Id = Guid.NewGuid(), WorkTypeId = polishWork.Id, Quantity = 2 }
            }
        };

        var workHonda2 = new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomHonda.Id,
            StaffId = staff2.Id,
            VehicleTypeId = suvType.Id,
            VehicleQuantity = 1,
            Date = new DateTime(2026, 9, 20, 0, 0, 0, DateTimeKind.Utc),
            TimeRecorded = "14:15",
            ServiceItems = new List<ShowroomVehicleWorkItem>
            {
                new() { Id = Guid.NewGuid(), WorkTypeId = washWork.Id, Quantity = 1 }
            }
        };

        // 5. Work in August (outside month window - should NOT appear in Sep)
        var workHondaAug = new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomHonda.Id,
            StaffId = staff1.Id,
            VehicleTypeId = carType.Id,
            VehicleQuantity = 5,
            Date = new DateTime(2026, 8, 31, 0, 0, 0, DateTimeKind.Utc),
            ServiceItems = new List<ShowroomVehicleWorkItem> { new() { Id = Guid.NewGuid(), WorkTypeId = washWork.Id, Quantity = 5 } }
        };

        // 6. Work for Skoda in September
        var workSkoda = new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomSkoda.Id,
            StaffId = staff2.Id,
            VehicleTypeId = suvType.Id,
            VehicleQuantity = 4,
            Date = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Utc),
            ServiceItems = new List<ShowroomVehicleWorkItem> { new() { Id = Guid.NewGuid(), WorkTypeId = washWork.Id, Quantity = 4 } }
        };

        // 7. Daily Bills & Payments
        var hondaBill = new ShowroomDailyBill
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomHonda.Id,
            Date = new DateTime(2026, 9, 15, 0, 0, 0, DateTimeKind.Utc),
            Amount = 5000m,
            Payments = new List<ShowroomPayment>
            {
                new() { Id = Guid.NewGuid(), Amount = 5000m, PaymentMethod = PaymentMethod.BankTransfer, PaymentDate = new DateTime(2026, 9, 15, 0, 0, 0, DateTimeKind.Utc) }
            }
        };

        var skodaBill = new ShowroomDailyBill
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomSkoda.Id,
            Date = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Utc),
            Amount = 8000m,
            Payments = new List<ShowroomPayment>
            {
                new() { Id = Guid.NewGuid(), Amount = 4000m, PaymentMethod = PaymentMethod.UPI, PaymentDate = new DateTime(2026, 9, 11, 0, 0, 0, DateTimeKind.Utc) }
            }
        };

        db.ShowroomVehicleWorks.AddRange(workHonda1, workHonda2, workHondaAug, workSkoda);
        db.ShowroomDailyBills.AddRange(hondaBill, skodaBill);
        await db.SaveChangesAsync();

        var service = new ReportService(db);

        // ACT 1: Query specifically for Honda in September 2026
        var hondaReport = await service.GetMonthlyShowroomReportAsync(2026, 9, showroomHonda.Id);

        // ASSERT 1: Only Honda returned, August records excluded
        Assert.Single(hondaReport.Showrooms);
        var hondaDetail = hondaReport.Showrooms[0];
        Assert.Equal("Honda Dealership", hondaDetail.ShowroomName);
        Assert.Equal(3, hondaDetail.Summary.TotalVehiclesServiced); // 2 + 1
        Assert.Equal(2, hondaDetail.Summary.TotalWorkEntries);
        Assert.Equal(5, hondaDetail.Summary.TotalServicesPerformed); // 2 + 2 + 1
        Assert.Equal(5000m, hondaDetail.Summary.TotalBilledAmount);
        Assert.Equal(5000m, hondaDetail.Summary.TotalCollectedAmount);
        Assert.Equal(0m, hondaDetail.Summary.TotalOutstandingAmount);
        Assert.Equal(1, hondaDetail.Summary.PaidDaysCount);
        Assert.Equal(2, hondaDetail.VehicleWorks.Count);

        // Verify work item formatting
        var firstWork = hondaDetail.VehicleWorks.First(w => w.Date.Day == 15);
        Assert.Equal("Kavitha", firstWork.StaffName);
        Assert.Equal("ST001A", firstWork.StaffMasterId);
        Assert.Equal("Sedan", firstWork.VehicleTypeName);
        Assert.Equal(2, firstWork.VehicleQuantity);
        Assert.Equal("Paid", firstWork.PaymentStatus);
        Assert.Equal(5000m, firstWork.DailyBilledAmount);
        Assert.Contains("Full Body Wash (2)", firstWork.ServicesSummary);
        Assert.Contains("Teflon Polish (2)", firstWork.ServicesSummary);

        // ACT 2: Query All Showrooms in September 2026
        var allReport = await service.GetMonthlyShowroomReportAsync(2026, 9, null);

        // ASSERT 2: Both showrooms returned with overall totals
        Assert.Equal(2, allReport.Showrooms.Count);
        Assert.Equal(2, allReport.OverallSummary.TotalShowrooms);
        Assert.Equal(7, allReport.OverallSummary.TotalVehiclesServiced); // 3 (Honda) + 4 (Skoda)
        Assert.Equal(3, allReport.OverallSummary.TotalWorkEntries); // 2 + 1
        Assert.Equal(9, allReport.OverallSummary.TotalServicesPerformed); // 5 + 4
        Assert.Equal(13000m, allReport.OverallSummary.TotalBilledAmount); // 5000 + 8000
        Assert.Equal(9000m, allReport.OverallSummary.TotalCollectedAmount); // 5000 + 4000
        Assert.Equal(4000m, allReport.OverallSummary.TotalOutstandingAmount); // 13000 - 9000
    }

    [Fact]
    public async Task GetMonthlyShowroomReportAsync_LeapYearFebruary_Handles29DaysCorrectly()
    {
        using var db = CreateInMemoryDb();

        var showroom = new Showroom { Id = Guid.NewGuid(), MasterId = "SHR0003", Name = "Erode Hub", Address = "Erode Central", IsActive = true };
        db.Showrooms.Add(showroom);

        var staff = new Staff { Id = Guid.NewGuid(), StaffMasterId = "ST003C", Name = "Murugan", PhoneNumber = "9876500003", Role = "Tech" };
        db.Staff.Add(staff);

        var bikeType = new ShowroomVehicleType { Id = Guid.NewGuid(), Code = "BIKE", Name = "Motorcycle", DisplayOrder = 1, IsActive = true };
        var washWork = new ShowroomWorkType { Id = Guid.NewGuid(), Code = "WASH", Name = "Wash", DisplayOrder = 1, IsActive = true };
        db.ShowroomVehicleTypes.Add(bikeType);
        db.ShowroomWorkTypes.Add(washWork);

        // Leap day work: Feb 29, 2028
        var leapDayWork = new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroom.Id,
            StaffId = staff.Id,
            VehicleTypeId = bikeType.Id,
            VehicleQuantity = 10,
            Date = new DateTime(2028, 2, 29, 0, 0, 0, DateTimeKind.Utc),
            ServiceItems = new List<ShowroomVehicleWorkItem> { new() { Id = Guid.NewGuid(), WorkTypeId = washWork.Id, Quantity = 10 } }
        };
        db.ShowroomVehicleWorks.Add(leapDayWork);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyShowroomReportAsync(2028, 2, showroom.Id);

        Assert.Equal("February 2028", report.MonthName);
        Assert.Equal(29, report.ToDate.Day);
        Assert.Single(report.Showrooms);
        Assert.Equal(10, report.Showrooms[0].Summary.TotalVehiclesServiced);
        Assert.Single(report.Showrooms[0].VehicleWorks);
    }

    [Fact]
    public async Task GetMonthlyShowroomReportAsync_EmptyMonth_ReturnsZeroedSummaries()
    {
        using var db = CreateInMemoryDb();

        var showroom = new Showroom { Id = Guid.NewGuid(), MasterId = "SHR0004", Name = "Salem Hub", Address = "Salem", IsActive = true };
        db.Showrooms.Add(showroom);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyShowroomReportAsync(2026, 1, showroom.Id);

        Assert.Equal("January 2026", report.MonthName);
        Assert.Single(report.Showrooms);
        var detail = report.Showrooms[0];
        Assert.Equal(0, detail.Summary.TotalVehiclesServiced);
        Assert.Equal(0, detail.Summary.TotalWorkEntries);
        Assert.Equal(0, detail.Summary.TotalServicesPerformed);
        Assert.Equal(0m, detail.Summary.TotalBilledAmount);
        Assert.Equal(0m, detail.Summary.TotalCollectedAmount);
        Assert.Equal(0m, detail.Summary.TotalOutstandingAmount);
        Assert.Empty(detail.VehicleWorks);
        Assert.Empty(detail.DailyBills);
    }

    [Fact]
    public async Task ReportsController_GetMonthlyShowroomReport_ValidatesYearAndMonthBounds()
    {
        using var db = CreateInMemoryDb();
        var service = new ReportService(db);
        var controller = new ReportsController(service);

        // Invalid month 13
        var badMonthResult = await controller.GetMonthlyShowroomReport(2026, 13);
        var badMonthObj = Assert.IsType<BadRequestObjectResult>(badMonthResult);
        Assert.NotNull(badMonthObj.Value);

        // Invalid month 0
        var zeroMonthResult = await controller.GetMonthlyShowroomReport(2026, 0);
        Assert.IsType<BadRequestObjectResult>(zeroMonthResult);

        // Invalid year 1999
        var badYearResult = await controller.GetMonthlyShowroomReport(1999, 5);
        Assert.IsType<BadRequestObjectResult>(badYearResult);

        // Valid year and month
        var validResult = await controller.GetMonthlyShowroomReport(2026, 9);
        var okObj = Assert.IsType<OkObjectResult>(validResult);
        Assert.IsType<MonthlyShowroomReportResponse>(okObj.Value);
    }
}
