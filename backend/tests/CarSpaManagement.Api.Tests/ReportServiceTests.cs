using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class ReportServiceTests
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
    public async Task GetDashboardSummaryAsync_MultiPeriodPaymentAttribution_SeparatesRevenueAndCollectionsByDate()
    {
        // ARRANGE:
        // Invoice created on Sep 1 for ₹10,000.
        // Payment recorded on Oct 5 for ₹10,000.
        using var db = CreateInMemoryDb();

        var customer = new Customer { Id = Guid.NewGuid(), Name = "John Doe", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN01AA1111", Make = "Honda", Model = "City" };
        var jobCard = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-001", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc), Status = JobCardStatus.Invoiced, TotalAmount = 10000m };

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-001",
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            Subtotal = 10000m,
            TotalAmount = 10000m,
            PaidAmount = 10000m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid,
            CreatedAt = new DateTime(2026, 9, 1, 10, 30, 0, DateTimeKind.Utc)
        };

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            Amount = 10000m,
            PaymentMethod = PaymentMethod.UPI,
            PaymentDate = new DateTime(2026, 10, 5, 14, 0, 0, DateTimeKind.Utc),
            CreatedAt = new DateTime(2026, 10, 5, 14, 0, 0, DateTimeKind.Utc)
        };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        var service = new ReportService(db);

        // ACT 1: September Report (Sep 1 to Sep 30)
        var sepReport = await service.GetDashboardSummaryAsync(
            new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 9, 30, 23, 59, 59, DateTimeKind.Utc));

        // ASSERT 1: In September, revenue is ₹10,000, but collections received is ₹0.
        Assert.Equal(10000m, sepReport.InvoiceKpis.TotalInvoicedAmount);
        Assert.Equal(0m, sepReport.PaymentCollection.TotalReceived);

        // ACT 2: October Report (Oct 1 to Oct 31)
        var octReport = await service.GetDashboardSummaryAsync(
            new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 10, 31, 23, 59, 59, DateTimeKind.Utc));

        // ASSERT 2: In October, invoiced revenue is ₹0, but collections received is ₹10,000.
        Assert.Equal(0m, octReport.InvoiceKpis.TotalInvoicedAmount);
        Assert.Equal(10000m, octReport.PaymentCollection.TotalReceived);
        Assert.Equal(1, octReport.PaymentCollection.TransactionCount);
    }

    [Fact]
    public async Task GetDashboardSummaryAsync_VoidedPayments_AreExcludedFromCollections()
    {
        // ARRANGE: Active payment of ₹3,000 + Voided (IsDeleted) payment of ₹2,000
        using var db = CreateInMemoryDb();

        var customer = new Customer { Id = Guid.NewGuid(), Name = "Alice", PhoneNumber = "9876543211" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN01BB2222", Make = "Hyundai", Model = "Creta" };
        var jobCard = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-002", CustomerId = customer.Id, VehicleId = vehicle.Id, CreatedAt = DateTime.UtcNow, Status = JobCardStatus.Invoiced, TotalAmount = 5000m };

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-002",
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = DateTime.UtcNow.Date,
            Subtotal = 5000m,
            TotalAmount = 5000m,
            PaidAmount = 3000m,
            BalanceAmount = 2000m,
            Status = InvoiceStatus.PartiallyPaid,
        };

        var activePayment = new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            Amount = 3000m,
            PaymentMethod = PaymentMethod.Cash,
            PaymentDate = DateTime.UtcNow,
            IsDeleted = false
        };

        var voidedPayment = new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            Amount = 2000m,
            PaymentMethod = PaymentMethod.Card,
            PaymentDate = DateTime.UtcNow,
            IsDeleted = true // Voided
        };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        db.Payments.AddRange(activePayment, voidedPayment);
        await db.SaveChangesAsync();

        var service = new ReportService(db);

        // ACT
        var report = await service.GetDashboardSummaryAsync(DateTime.UtcNow.Date, DateTime.UtcNow.Date);

        // ASSERT: Total received must be strictly ₹3,000.
        Assert.Equal(3000m, report.PaymentCollection.TotalReceived);
        Assert.Equal(1, report.PaymentCollection.TransactionCount);
    }

    [Fact]
    public async Task GetDashboardSummaryAsync_TopServices_AggregatesAuthenticJobCardServices()
    {
        // ARRANGE
        using var db = CreateInMemoryDb();

        var customer = new Customer { Id = Guid.NewGuid(), Name = "Bob", PhoneNumber = "9876543212" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN01CC3333", Make = "BMW", Model = "330i" };
        var service1 = new Service { Id = Guid.NewGuid(), Name = "Ceramic Coating", Category = "Detailing", Price = 5000m };
        var service2 = new Service { Id = Guid.NewGuid(), Name = "Foam Wash", Category = "Washing", Price = 500m };

        var jobCard = new JobCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = "JC-003",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            CreatedAt = DateTime.UtcNow,
            Status = JobCardStatus.Ready,
            TotalAmount = 11000m
        };

        var jcService1 = new CarSpaManagement.Api.Domain.Entities.JobCardService
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            ServiceId = service1.Id,
            ServiceName = "Ceramic Coating",
            UnitPrice = 5000m,
            Quantity = 2,
            DiscountAmount = 0m,
            LineTotal = 10000m
        };

        var jcService2 = new CarSpaManagement.Api.Domain.Entities.JobCardService
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            ServiceId = service2.Id,
            ServiceName = "Foam Wash",
            UnitPrice = 500m,
            Quantity = 2,
            DiscountAmount = 0m,
            LineTotal = 1000m
        };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.Services.AddRange(service1, service2);
        db.JobCards.Add(jobCard);
        db.JobCardServices.AddRange(jcService1, jcService2);
        await db.SaveChangesAsync();

        var reportService = new ReportService(db);

        // ACT
        var report = await reportService.GetDashboardSummaryAsync(DateTime.UtcNow.Date, DateTime.UtcNow.Date);

        // ASSERT: TopServices must return authentic names and revenue
        Assert.NotNull(report.TopServices);
        Assert.Equal(2, report.TopServices.Count);

        var ceramic = report.TopServices.First(s => s.Name == "Ceramic Coating");
        Assert.Equal(10000m, ceramic.Revenue);
        Assert.Equal(2, ceramic.Count);
        Assert.Equal("Detailing", ceramic.Category);

        var wash = report.TopServices.First(s => s.Name == "Foam Wash");
        Assert.Equal(1000m, wash.Revenue);
        Assert.Equal(2, wash.Count);
        Assert.Equal("Washing", wash.Category);
    }

    [Fact]
    public async Task GetDashboardSummaryAsync_StaffAdvances_IsolatesOutstandingAndSettled()
    {
        // ARRANGE
        using var db = CreateInMemoryDb();

        var staff = new Staff { Id = Guid.NewGuid(), Name = "Murugan", PhoneNumber = "9988776655", Role = "Technician" };

        var advance1 = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 2500m,
            AdvanceDate = DateTime.UtcNow.Date,
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "Medical"
        };

        var advance2 = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 1500m,
            AdvanceDate = DateTime.UtcNow.Date,
            Status = StaffAdvanceStatus.Settled,
            Reason = "Travel"
        };

        var advance3 = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 1000m,
            AdvanceDate = DateTime.UtcNow.Date,
            Status = StaffAdvanceStatus.Obsolete,
            Reason = "Voided Advance"
        };

        db.Staff.Add(staff);
        db.StaffAdvances.AddRange(advance1, advance2, advance3);
        await db.SaveChangesAsync();

        var service = new ReportService(db);

        // ACT
        var report = await service.GetDashboardSummaryAsync(DateTime.UtcNow.Date, DateTime.UtcNow.Date);

        // ASSERT
        Assert.Equal(2500m, report.StaffAdvances.OutstandingAmount);
        Assert.Equal(1, report.StaffAdvances.OutstandingCount);
        Assert.Equal(1500m, report.StaffAdvances.SettledAmount);
        Assert.Equal(1, report.StaffAdvances.SettledCount);
        Assert.Equal(1, report.StaffAdvances.ObsoleteCount);
    }
}
