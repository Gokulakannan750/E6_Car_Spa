using System;
using System.Collections.Generic;
using System.Linq;
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
using JobCardServiceEntity = CarSpaManagement.Api.Domain.Entities.JobCardService;

namespace CarSpaManagement.Api.Tests;

public class MonthlyBillingReportTests
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
    public async Task Test1_SelectedMonth_With31Days_Generates31Sheets()
    {
        using var db = CreateInMemoryDb();
        var service = new ReportService(db);

        // October 2026 has 31 days
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        Assert.Equal(31, report.DaysInMonth);
        Assert.Equal(31, report.DailySheets.Count);
        Assert.Equal("01-Oct", report.DailySheets[0].SheetName);
        Assert.Equal("31-Oct", report.DailySheets[30].SheetName);
        Assert.Equal("October 2026", report.MonthName);
    }

    [Fact]
    public async Task Test2_SelectedMonth_With30Days_Generates30Sheets()
    {
        using var db = CreateInMemoryDb();
        var service = new ReportService(db);

        // November 2026 has 30 days
        var report = await service.GetMonthlyBillingReportAsync(2026, 11);

        Assert.Equal(30, report.DaysInMonth);
        Assert.Equal(30, report.DailySheets.Count);
        Assert.Equal("01-Nov", report.DailySheets[0].SheetName);
        Assert.Equal("30-Nov", report.DailySheets[29].SheetName);
        Assert.Equal("November 2026", report.MonthName);
    }

    [Fact]
    public async Task Test3_February_LeapYear_Generates29Sheets_AndNonLeap_Generates28Sheets()
    {
        using var db = CreateInMemoryDb();
        var service = new ReportService(db);

        // February 2024 was a leap year
        var leapReport = await service.GetMonthlyBillingReportAsync(2024, 2);
        Assert.Equal(29, leapReport.DaysInMonth);
        Assert.Equal(29, leapReport.DailySheets.Count);
        Assert.Equal("29-Feb", leapReport.DailySheets[28].SheetName);

        // February 2026 is non-leap
        var nonLeapReport = await service.GetMonthlyBillingReportAsync(2026, 2);
        Assert.Equal(28, nonLeapReport.DaysInMonth);
        Assert.Equal(28, nonLeapReport.DailySheets.Count);
        Assert.Equal("28-Feb", nonLeapReport.DailySheets[27].SheetName);
    }

    [Fact]
    public async Task Test4_MonthWithNoBillingActivity_GeneratesAllDailySheets_WithEmptyState()
    {
        using var db = CreateInMemoryDb();
        var service = new ReportService(db);

        var report = await service.GetMonthlyBillingReportAsync(2026, 8);

        Assert.Equal(31, report.DaysInMonth);
        Assert.Equal(31, report.DailySheets.Count);
        Assert.All(report.DailySheets, sheet =>
        {
            Assert.False(sheet.HasActivity);
            Assert.Empty(sheet.JobCards);
            Assert.Empty(sheet.Invoices);
            Assert.Empty(sheet.Services);
            Assert.Equal(0m, sheet.Totals.InvoiceTotal);
            Assert.Equal(0m, sheet.Totals.AmountPaid);
            Assert.Equal(0m, sheet.Totals.AmountPending);
        });

        Assert.Equal(0, report.Summary.TotalJobCardsCreated);
        Assert.Equal(0, report.Summary.TotalInvoices);
        Assert.Equal(0, report.Summary.TotalServicesPerformed);
    }

    [Fact]
    public async Task Test5_MultipleInvoices_OnSameDate_AggregatesCorrectlyInDailySheet()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "John Doe", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN01AB1234" };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);

        var jc1 = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-101", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 10, 15, 9, 0, 0, DateTimeKind.Utc) };
        var jc2 = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-102", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 10, 15, 11, 0, 0, DateTimeKind.Utc) };
        db.JobCards.AddRange(jc1, jc2);

        var inv1 = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-101",
            JobCardId = jc1.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = new DateTime(2026, 10, 15, 0, 0, 0, DateTimeKind.Utc),
            TotalAmount = 1500m,
            PaidAmount = 1500m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid
        };

        var inv2 = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-102",
            JobCardId = jc2.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = new DateTime(2026, 10, 15, 0, 0, 0, DateTimeKind.Utc),
            TotalAmount = 2500m,
            PaidAmount = 1000m,
            BalanceAmount = 1500m,
            Status = InvoiceStatus.PartiallyPaid
        };
        db.Invoices.AddRange(inv1, inv2);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        var day15 = report.DailySheets.First(s => s.Day == 15);
        Assert.True(day15.HasActivity);
        Assert.Equal(2, day15.Invoices.Count);
        Assert.Equal(4000m, day15.Totals.InvoiceTotal);
        Assert.Equal(2500m, day15.Totals.AmountPaid);
        Assert.Equal(1500m, day15.Totals.AmountPending);
    }

    [Fact]
    public async Task Test6_MultipleServices_InOneJobCard_ListsAllServicesIndividually()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Alice", PhoneNumber = "9876543211" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN02CD5678", Make = "Honda", Model = "City" };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);

        var s1 = new Service { Id = Guid.NewGuid(), Name = "Full Wash", Price = 800m };
        var s2 = new Service { Id = Guid.NewGuid(), Name = "Interior Cleaning", Price = 1200m };
        var s3 = new Service { Id = Guid.NewGuid(), Name = "Windshield Polish", Price = 500m };
        db.Services.AddRange(s1, s2, s3);

        var jc = new JobCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = "JC-201",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            CreatedAt = new DateTime(2026, 10, 5, 10, 30, 0, DateTimeKind.Utc),
            Status = JobCardStatus.Ready,
            TotalAmount = 2500m
        };
        db.JobCards.Add(jc);

        var jcs1 = new JobCardServiceEntity { Id = Guid.NewGuid(), JobCardId = jc.Id, ServiceId = s1.Id, ServiceName = "Full Wash", UnitPrice = 800m, Quantity = 1, LineTotal = 800m };
        var jcs2 = new JobCardServiceEntity { Id = Guid.NewGuid(), JobCardId = jc.Id, ServiceId = s2.Id, ServiceName = "Interior Cleaning", UnitPrice = 1200m, Quantity = 1, LineTotal = 1200m };
        var jcs3 = new JobCardServiceEntity { Id = Guid.NewGuid(), JobCardId = jc.Id, ServiceId = s3.Id, ServiceName = "Windshield Polish", UnitPrice = 500m, Quantity = 1, LineTotal = 500m };
        db.JobCardServices.AddRange(jcs1, jcs2, jcs3);

        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        var day5 = report.DailySheets.First(s => s.Day == 5);
        Assert.True(day5.HasActivity);
        Assert.Single(day5.JobCards);
        Assert.Equal(3, day5.JobCards[0].TotalServices);
        Assert.Equal(3, day5.Services.Count);
        Assert.Equal(3, day5.Totals.ServiceCount);
        Assert.Equal(3, day5.Totals.ServiceTotalQuantity);
        Assert.Contains(day5.Services, s => s.ServiceName == "Full Wash" && s.Amount == 800m);
        Assert.Contains(day5.Services, s => s.ServiceName == "Interior Cleaning" && s.Amount == 1200m);
        Assert.Contains(day5.Services, s => s.ServiceName == "Windshield Polish" && s.Amount == 500m);
    }

    [Fact]
    public async Task Test7_PaidInvoice_StatusAndAmounts_Correct()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Mark", PhoneNumber = "9876543212" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN03EF9012" };
        var jc = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-301", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 10, 12, 10, 0, 0, DateTimeKind.Utc) };
        var inv = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-301",
            JobCardId = jc.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = new DateTime(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc),
            TotalAmount = 5000m,
            PaidAmount = 5000m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid
        };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jc);
        db.Invoices.Add(inv);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        Assert.Equal(1, report.Summary.TotalInvoicesPaid);
        Assert.Equal(0, report.Summary.TotalInvoicesPendingPayment);
        Assert.Equal(5000m, report.Summary.TotalInvoiceAmount);
        Assert.Equal(5000m, report.Summary.TotalAmountPaid);
        Assert.Equal(0m, report.Summary.TotalAmountPending);

        var day12 = report.DailySheets.First(s => s.Day == 12);
        Assert.Equal("Paid", day12.Invoices[0].InvoiceStatus);
        Assert.Equal(5000m, day12.Invoices[0].AmountPaid);
        Assert.Equal(0m, day12.Invoices[0].AmountPending);
    }

    [Fact]
    public async Task Test8_PendingInvoice_StatusAndAmounts_Correct()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Sara", PhoneNumber = "9876543213" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN04GH3456" };
        var jc = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-401", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 10, 18, 10, 0, 0, DateTimeKind.Utc) };
        var inv = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-401",
            JobCardId = jc.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = new DateTime(2026, 10, 18, 0, 0, 0, DateTimeKind.Utc),
            TotalAmount = 3000m,
            PaidAmount = 0m,
            BalanceAmount = 3000m,
            Status = InvoiceStatus.Generated
        };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jc);
        db.Invoices.Add(inv);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        Assert.Equal(0, report.Summary.TotalInvoicesPaid);
        Assert.Equal(1, report.Summary.TotalInvoicesPendingPayment);
        Assert.Equal(3000m, report.Summary.TotalInvoiceAmount);
        Assert.Equal(0m, report.Summary.TotalAmountPaid);
        Assert.Equal(3000m, report.Summary.TotalAmountPending);

        var day18 = report.DailySheets.First(s => s.Day == 18);
        Assert.Equal("Generated", day18.Invoices[0].InvoiceStatus);
        Assert.Equal(0m, day18.Invoices[0].AmountPaid);
        Assert.Equal(3000m, day18.Invoices[0].AmountPending);
    }

    [Fact]
    public async Task Test9_PartiallyPaidInvoice_StatusAndAmounts_Correct()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "David", PhoneNumber = "9876543214" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN05IJ7890" };
        var jc = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-501", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 10, 20, 10, 0, 0, DateTimeKind.Utc) };
        var inv = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-501",
            JobCardId = jc.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = new DateTime(2026, 10, 20, 0, 0, 0, DateTimeKind.Utc),
            TotalAmount = 8000m,
            PaidAmount = 5000m,
            BalanceAmount = 3000m,
            Status = InvoiceStatus.PartiallyPaid
        };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jc);
        db.Invoices.Add(inv);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        Assert.Equal(0, report.Summary.TotalInvoicesPaid);
        Assert.Equal(1, report.Summary.TotalInvoicesPendingPayment);
        Assert.Equal(8000m, report.Summary.TotalInvoiceAmount);
        Assert.Equal(5000m, report.Summary.TotalAmountPaid);
        Assert.Equal(3000m, report.Summary.TotalAmountPending);

        var day20 = report.DailySheets.First(s => s.Day == 20);
        Assert.Equal("PartiallyPaid", day20.Invoices[0].InvoiceStatus);
        Assert.Equal(5000m, day20.Invoices[0].AmountPaid);
        Assert.Equal(3000m, day20.Invoices[0].AmountPending);
    }

    [Fact]
    public async Task Test10_MultiplePayments_AgainstOneInvoice_ReflectsAuthoritativePaidAndBalance()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Emma", PhoneNumber = "9876543215" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN06KL1234" };
        var jc = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-601", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 10, 22, 10, 0, 0, DateTimeKind.Utc) };
        var inv = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-601",
            JobCardId = jc.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = new DateTime(2026, 10, 22, 0, 0, 0, DateTimeKind.Utc),
            TotalAmount = 10000m,
            PaidAmount = 7000m, // Authoritative sum of payments: 4000 + 3000
            BalanceAmount = 3000m,
            Status = InvoiceStatus.PartiallyPaid
        };
        var p1 = new Payment { Id = Guid.NewGuid(), InvoiceId = inv.Id, Amount = 4000m, PaymentMethod = PaymentMethod.UPI, PaymentDate = new DateTime(2026, 10, 22, 11, 0, 0, DateTimeKind.Utc) };
        var p2 = new Payment { Id = Guid.NewGuid(), InvoiceId = inv.Id, Amount = 3000m, PaymentMethod = PaymentMethod.Cash, PaymentDate = new DateTime(2026, 10, 22, 15, 0, 0, DateTimeKind.Utc) };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jc);
        db.Invoices.Add(inv);
        db.Payments.AddRange(p1, p2);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        var day22 = report.DailySheets.First(s => s.Day == 22);
        Assert.Single(day22.Invoices);
        Assert.Equal(10000m, day22.Invoices[0].InvoiceTotal);
        Assert.Equal(7000m, day22.Invoices[0].AmountPaid);
        Assert.Equal(3000m, day22.Invoices[0].AmountPending);
    }

    [Fact]
    public async Task Test11_InvoiceWithMultipleServices_AppearsOnceInInvoiceSection_AndServicesInServiceSection()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Rahul", PhoneNumber = "9876543216" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN07MN5678" };
        var jc = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-701", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 10, 25, 9, 0, 0, DateTimeKind.Utc), TotalAmount = 3500m };

        var servA = new Service { Id = Guid.NewGuid(), Name = "Tire Dressing", Price = 500m };
        var servB = new Service { Id = Guid.NewGuid(), Name = "Deep Wash", Price = 3000m };
        db.Services.AddRange(servA, servB);

        var jcsA = new JobCardServiceEntity { Id = Guid.NewGuid(), JobCardId = jc.Id, ServiceId = servA.Id, ServiceName = "Tire Dressing", UnitPrice = 500m, Quantity = 1, LineTotal = 500m };
        var jcsB = new JobCardServiceEntity { Id = Guid.NewGuid(), JobCardId = jc.Id, ServiceId = servB.Id, ServiceName = "Deep Wash", UnitPrice = 3000m, Quantity = 1, LineTotal = 3000m };
        db.JobCardServices.AddRange(jcsA, jcsB);

        var inv = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-701",
            JobCardId = jc.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = new DateTime(2026, 10, 25, 0, 0, 0, DateTimeKind.Utc),
            TotalAmount = 3500m,
            PaidAmount = 3500m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid
        };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jc);
        db.Invoices.Add(inv);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        var day25 = report.DailySheets.First(s => s.Day == 25);

        // Invoice table has exactly 1 entry
        Assert.Single(day25.Invoices);
        Assert.Equal("INV-701", day25.Invoices[0].InvoiceNumber);

        // Services table has 2 entries linked to the invoice
        Assert.Equal(2, day25.Services.Count);
        Assert.All(day25.Services, s => Assert.Equal("INV-701", s.InvoiceNumber));
    }

    [Fact]
    public async Task Test12_Reconciliation_BetweenMonthlySummary_AndDailySheets()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Multi Day Customer", PhoneNumber = "9876543217" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN08OP9012" };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);

        // Create entries on multiple days: 2nd, 10th, 28th
        var days = new[] { 2, 10, 28 };
        decimal expectedInvoiceTotal = 0;
        decimal expectedAmountPaid = 0;
        decimal expectedAmountPending = 0;
        int expectedServices = 0;

        foreach (var d in days)
        {
            var jc = new JobCard
            {
                Id = Guid.NewGuid(),
                JobCardNumber = $"JC-{d}",
                CustomerId = customer.Id,
                VehicleId = vehicle.Id,
                CreatedAt = new DateTime(2026, 10, d, 10, 0, 0, DateTimeKind.Utc),
                Status = JobCardStatus.Ready,
                TotalAmount = d * 100m
            };
            db.JobCards.Add(jc);

            var jcs = new JobCardServiceEntity
            {
                Id = Guid.NewGuid(),
                JobCardId = jc.Id,
                ServiceId = Guid.NewGuid(),
                ServiceName = $"Service-{d}",
                UnitPrice = d * 100m,
                Quantity = 1,
                LineTotal = d * 100m
            };
            db.JobCardServices.Add(jcs);
            expectedServices++;

            var inv = new Invoice
            {
                Id = Guid.NewGuid(),
                InvoiceNumber = $"INV-{d}",
                JobCardId = jc.Id,
                CustomerId = customer.Id,
                VehicleId = vehicle.Id,
                InvoiceDate = new DateTime(2026, 10, d, 0, 0, 0, DateTimeKind.Utc),
                TotalAmount = d * 100m,
                PaidAmount = d * 60m,
                BalanceAmount = d * 40m,
                Status = InvoiceStatus.PartiallyPaid
            };
            db.Invoices.Add(inv);

            expectedInvoiceTotal += d * 100m;
            expectedAmountPaid += d * 60m;
            expectedAmountPending += d * 40m;
        }

        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        // Strict mathematical reconciliation:
        Assert.Equal(report.Summary.TotalInvoices, report.DailySheets.Sum(d => d.Invoices.Count));
        Assert.Equal(report.Summary.TotalJobCardsCreated, report.DailySheets.Sum(d => d.JobCards.Count));
        Assert.Equal(report.Summary.TotalServicesPerformed, report.DailySheets.Sum(d => d.Services.Count));
        Assert.Equal(report.Summary.TotalServiceQuantity, report.DailySheets.Sum(d => d.Totals.ServiceTotalQuantity));
        Assert.Equal(report.Summary.TotalInvoiceAmount, report.DailySheets.Sum(d => d.Totals.InvoiceTotal));
        Assert.Equal(report.Summary.TotalAmountPaid, report.DailySheets.Sum(d => d.Totals.AmountPaid));
        Assert.Equal(report.Summary.TotalAmountPending, report.DailySheets.Sum(d => d.Totals.AmountPending));

        Assert.Equal(expectedInvoiceTotal, report.Summary.TotalInvoiceAmount);
        Assert.Equal(expectedAmountPaid, report.Summary.TotalAmountPaid);
        Assert.Equal(expectedAmountPending, report.Summary.TotalAmountPending);
        Assert.Equal(expectedServices, report.Summary.TotalServicesPerformed);
    }

    [Fact]
    public async Task Test13_NoDuplicateInvoices_WhenJobCardLinked()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Unique Cust", PhoneNumber = "9876543218" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN09QR3456" };
        var jc = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-801", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 10, 14, 10, 0, 0, DateTimeKind.Utc) };
        var inv = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-801",
            JobCardId = jc.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = new DateTime(2026, 10, 14, 0, 0, 0, DateTimeKind.Utc),
            TotalAmount = 2000m,
            PaidAmount = 2000m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid
        };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jc);
        db.Invoices.Add(inv);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        var allInvoicesAcrossSheets = report.DailySheets.SelectMany(d => d.Invoices).ToList();
        Assert.Single(allInvoicesAcrossSheets);
        Assert.Equal("INV-801", allInvoicesAcrossSheets[0].InvoiceNumber);
    }

    [Fact]
    public async Task Test14_NoDuplicateServices_WhenJobCardContainsMultiple()
    {
        using var db = CreateInMemoryDb();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Service Cust", PhoneNumber = "9876543219" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN10ST7890" };
        var jc = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-901", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 10, 16, 10, 0, 0, DateTimeKind.Utc) };
        var jcs1 = new JobCardServiceEntity { Id = Guid.NewGuid(), JobCardId = jc.Id, ServiceId = Guid.NewGuid(), ServiceName = "Wax Polish", UnitPrice = 1000m, Quantity = 2, LineTotal = 2000m };
        var jcs2 = new JobCardServiceEntity { Id = Guid.NewGuid(), JobCardId = jc.Id, ServiceId = Guid.NewGuid(), ServiceName = "Engine Steam", UnitPrice = 750m, Quantity = 1, LineTotal = 750m };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jc);
        db.JobCardServices.AddRange(jcs1, jcs2);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var report = await service.GetMonthlyBillingReportAsync(2026, 10);

        var allServices = report.DailySheets.SelectMany(d => d.Services).ToList();
        Assert.Equal(2, allServices.Count);
        Assert.Equal(3, report.Summary.TotalServiceQuantity);
    }

    [Fact]
    public async Task Test15_ReportsController_BillingMonthly_EndpointReturnsOkResult()
    {
        using var db = CreateInMemoryDb();
        var service = new ReportService(db);
        var controller = new ReportsController(service, new CarSpaManagement.Api.Tests.TestSupport.AllowAllAuthorizationService());

        // Valid query
        var result = await controller.GetMonthlyBillingReport(2026, 10);
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<MonthlyBillingReportResponse>(okResult.Value);
        Assert.Equal(31, response.DaysInMonth);

        // Invalid month
        var badMonth = await controller.GetMonthlyBillingReport(2026, 13);
        Assert.IsType<BadRequestObjectResult>(badMonth);

        // Invalid year
        var badYear = await controller.GetMonthlyBillingReport(1999, 10);
        Assert.IsType<BadRequestObjectResult>(badYear);
    }
}
