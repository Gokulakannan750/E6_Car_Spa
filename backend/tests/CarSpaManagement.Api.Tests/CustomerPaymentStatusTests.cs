using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Customers;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class CustomerPaymentStatusTests
{
    private class DummyAuditLogService : IAuditLogService
    {
        public Task RecordAsync(
            string action,
            string module,
            string description,
            Guid? userId = null,
            string? userName = null,
            string? userRole = null,
            string? entityType = null,
            Guid? entityId = null,
            string? entityReference = null,
            string? oldValues = null,
            string? newValues = null,
            string? metadata = null,
            string outcome = "Success",
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(
            AuditLogQueryParameters query,
            CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException();
        }
    }

    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Customer CreateCustomer(AppDbContext db, string name, string phone)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = name,
            PhoneNumber = phone,
            CreatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);
        return customer;
    }

    private static Vehicle EnsureVehicle(AppDbContext db, Guid customerId)
    {
        var existing = db.Vehicles.Local.FirstOrDefault(v => v.CustomerId == customerId)
            ?? db.Vehicles.FirstOrDefault(v => v.CustomerId == customerId);
        if (existing != null) return existing;

        var v = new Vehicle
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            RegistrationNumber = $"TN01AB{Random.Shared.Next(1000, 9999)}",
            CreatedAt = DateTime.UtcNow
        };
        db.Vehicles.Add(v);
        return v;
    }

    private static Invoice AddInvoice(
        AppDbContext db,
        Guid customerId,
        decimal totalAmount,
        decimal paidAmount,
        InvoiceStatus status = InvoiceStatus.Generated,
        bool isDeleted = false)
    {
        var vehicle = EnsureVehicle(db, customerId);
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            JobCardId = Guid.NewGuid(),
            VehicleId = vehicle.Id,
            Vehicle = vehicle,
            InvoiceNumber = $"INV-{DateTime.UtcNow.Year}-{Random.Shared.Next(100000, 999999)}",
            InvoiceDate = DateTime.UtcNow.Date,
            Subtotal = totalAmount,
            TotalAmount = totalAmount,
            PaidAmount = paidAmount,
            BalanceAmount = Math.Max(0m, totalAmount - paidAmount),
            Status = status,
            IsDeleted = isDeleted,
            CreatedAt = DateTime.UtcNow
        };

        if (paidAmount > 0)
        {
            invoice.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                InvoiceId = invoice.Id,
                Amount = paidAmount,
                PaymentMethod = PaymentMethod.Cash,
                PaymentDate = DateTime.UtcNow,
                IsDeleted = false
            });
        }

        db.Invoices.Add(invoice);
        return invoice;
    }

    [Fact]
    public async Task EdgeCase1_CustomerWithNoInvoices_ReturnsNoInvoicesStatus()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Alice NoInvoices", "9876543210");
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("No Invoices", result.PaymentStatus);
        Assert.Equal(0, result.InvoiceCount);
        Assert.Equal(0m, result.TotalInvoicedAmount);
        Assert.Equal(0m, result.TotalPaidAmount);
        Assert.Equal(0m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase2_CustomerWithOneFullyPaidInvoice_ReturnsPaid()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Bob Paid", "9876543211");
        AddInvoice(db, customer.Id, 2500m, 2500m, InvoiceStatus.Paid);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("Paid", result.PaymentStatus);
        Assert.Equal(1, result.InvoiceCount);
        Assert.Equal(2500m, result.TotalInvoicedAmount);
        Assert.Equal(2500m, result.TotalPaidAmount);
        Assert.Equal(0m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase3_CustomerWith10FullyPaidInvoices_ReturnsPaid()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Charlie 10Paid", "9876543212");
        for (int i = 0; i < 10; i++)
        {
            AddInvoice(db, customer.Id, 1000m, 1000m, InvoiceStatus.Paid);
        }
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("Paid", result.PaymentStatus);
        Assert.Equal(10, result.InvoiceCount);
        Assert.Equal(10000m, result.TotalInvoicedAmount);
        Assert.Equal(10000m, result.TotalPaidAmount);
        Assert.Equal(0m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase4_NinePaidPlusOneUnpaid_ReturnsPaymentDue()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "David 9Paid1Due", "9876543213");
        for (int i = 0; i < 9; i++)
        {
            AddInvoice(db, customer.Id, 1000m, 1000m, InvoiceStatus.Paid);
        }
        // 1 completely unpaid invoice
        AddInvoice(db, customer.Id, 2000m, 0m, InvoiceStatus.Generated);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("Payment Due", result.PaymentStatus);
        Assert.Equal(10, result.InvoiceCount);
        Assert.Equal(11000m, result.TotalInvoicedAmount);
        Assert.Equal(9000m, result.TotalPaidAmount);
        Assert.Equal(2000m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase5_NinePaidPlusOnePartiallyPaid_ReturnsPaymentPending()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Emma 9Paid1Partial", "9876543214");
        for (int i = 0; i < 9; i++)
        {
            AddInvoice(db, customer.Id, 1000m, 1000m, InvoiceStatus.Paid);
        }
        // 1 partially paid invoice (paid 500 of 2000)
        AddInvoice(db, customer.Id, 2000m, 500m, InvoiceStatus.PartiallyPaid);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("Payment Pending", result.PaymentStatus);
        Assert.Equal(10, result.InvoiceCount);
        Assert.Equal(11000m, result.TotalInvoicedAmount);
        Assert.Equal(9500m, result.TotalPaidAmount);
        Assert.Equal(1500m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase6_MultiplePartiallyPaidInvoices_ReturnsPaymentPending()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Frank MultiPartial", "9876543215");
        AddInvoice(db, customer.Id, 2000m, 1000m, InvoiceStatus.PartiallyPaid);
        AddInvoice(db, customer.Id, 3000m, 1500m, InvoiceStatus.PartiallyPaid);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("Payment Pending", result.PaymentStatus);
        Assert.Equal(2, result.InvoiceCount);
        Assert.Equal(5000m, result.TotalInvoicedAmount);
        Assert.Equal(2500m, result.TotalPaidAmount);
        Assert.Equal(2500m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase7_MultipleUnpaidInvoices_ReturnsPaymentDue()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Grace MultiUnpaid", "9876543216");
        AddInvoice(db, customer.Id, 1500m, 0m, InvoiceStatus.Generated);
        AddInvoice(db, customer.Id, 2500m, 0m, InvoiceStatus.Generated);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("Payment Due", result.PaymentStatus);
        Assert.Equal(2, result.InvoiceCount);
        Assert.Equal(4000m, result.TotalInvoicedAmount);
        Assert.Equal(0m, result.TotalPaidAmount);
        Assert.Equal(4000m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase8_OnePaidAndOneUnpaid_ReturnsPaymentDue()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Henry OnePaidOneUnpaid", "9876543217");
        AddInvoice(db, customer.Id, 3000m, 3000m, InvoiceStatus.Paid);
        AddInvoice(db, customer.Id, 2000m, 0m, InvoiceStatus.Generated);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("Payment Due", result.PaymentStatus);
        Assert.Equal(2, result.InvoiceCount);
        Assert.Equal(5000m, result.TotalInvoicedAmount);
        Assert.Equal(3000m, result.TotalPaidAmount);
        Assert.Equal(2000m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase9_TotalTenThousandAndPaymentsTenThousand_ReturnsPaidZeroOutstanding()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Ivy TotalMatch", "9876543218");
        AddInvoice(db, customer.Id, 6000m, 6000m, InvoiceStatus.Paid);
        AddInvoice(db, customer.Id, 4000m, 4000m, InvoiceStatus.Paid);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("Paid", result.PaymentStatus);
        Assert.Equal(0m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase10_TenThousandInvoicedSevenThousandFiveHundredPaid_ReturnsCorrectPendingOrDue()
    {
        using var db = CreateInMemoryDb();
        // Case A: 1 partially paid invoice (10,000 with 7,500 paid) -> Payment Pending
        var custA = CreateCustomer(db, "Jack Partial10k", "9876543219");
        AddInvoice(db, custA.Id, 10000m, 7500m, InvoiceStatus.PartiallyPaid);

        // Case B: 7,500 fully paid + 2,500 completely unpaid -> Payment Due
        var custB = CreateCustomer(db, "Karen Due10k", "9876543220");
        AddInvoice(db, custB.Id, 7500m, 7500m, InvoiceStatus.Paid);
        AddInvoice(db, custB.Id, 2500m, 0m, InvoiceStatus.Generated);

        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var resA = await service.GetByIdAsync(custA.Id);
        var resB = await service.GetByIdAsync(custB.Id);

        Assert.NotNull(resA);
        Assert.Equal("Payment Pending", resA.PaymentStatus);
        Assert.Equal(2500m, resA.TotalOutstandingAmount);

        Assert.NotNull(resB);
        Assert.Equal("Payment Due", resB.PaymentStatus);
        Assert.Equal(2500m, resB.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase11_DeletedInvoices_DoNotAffectCustomerPaymentStatus()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Leo DeletedInv", "9876543221");
        AddInvoice(db, customer.Id, 2000m, 2000m, InvoiceStatus.Paid);
        // Deleted invoice with unpaid balance
        AddInvoice(db, customer.Id, 5000m, 0m, InvoiceStatus.Generated, isDeleted: true);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("Paid", result.PaymentStatus);
        Assert.Equal(1, result.InvoiceCount);
        Assert.Equal(2000m, result.TotalInvoicedAmount);
        Assert.Equal(0m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task EdgeCase12_CancelledAndDraftInvoices_DoNotCreateOutstandingBalance()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Mia CancelledDraft", "9876543222");
        // Cancelled invoice with balance
        AddInvoice(db, customer.Id, 5000m, 0m, InvoiceStatus.Cancelled);
        // Draft invoice with balance
        AddInvoice(db, customer.Id, 3000m, 0m, InvoiceStatus.Draft);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var result = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(result);
        Assert.Equal("No Invoices", result.PaymentStatus);
        Assert.Equal(0, result.InvoiceCount);
        Assert.Equal(0m, result.TotalOutstandingAmount);
    }

    [Fact]
    public async Task GetAllAsync_FilteringByPaymentStatus_WorksCorrectly()
    {
        using var db = CreateInMemoryDb();
        var cNoInv = CreateCustomer(db, "Filter NoInvoices", "9111111111");
        var cPaid = CreateCustomer(db, "Filter Paid", "9222222222");
        AddInvoice(db, cPaid.Id, 1000m, 1000m, InvoiceStatus.Paid);

        var cPending = CreateCustomer(db, "Filter Pending", "9333333333");
        AddInvoice(db, cPending.Id, 2000m, 1000m, InvoiceStatus.PartiallyPaid);

        var cDue = CreateCustomer(db, "Filter Due", "9444444444");
        AddInvoice(db, cDue.Id, 3000m, 0m, InvoiceStatus.Generated);

        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());

        // Test All
        var all = await service.GetAllAsync(1, 10, null, "all");
        Assert.Equal(4, all.Count);
        var totalAll = await service.GetTotalCountAsync(null, "all");
        Assert.Equal(4, totalAll);

        // Test No Invoices
        var noInv = await service.GetAllAsync(1, 10, null, "No Invoices");
        Assert.Single(noInv);
        Assert.Equal("Filter NoInvoices", noInv[0].Name);
        var totalNoInv = await service.GetTotalCountAsync(null, "No Invoices");
        Assert.Equal(1, totalNoInv);

        // Test Paid
        var paidList = await service.GetAllAsync(1, 10, null, "Paid");
        Assert.Single(paidList);
        Assert.Equal("Filter Paid", paidList[0].Name);
        var totalPaid = await service.GetTotalCountAsync(null, "Paid");
        Assert.Equal(1, totalPaid);

        // Test Payment Pending
        var pendingList = await service.GetAllAsync(1, 10, null, "Payment Pending");
        Assert.Single(pendingList);
        Assert.Equal("Filter Pending", pendingList[0].Name);
        var totalPending = await service.GetTotalCountAsync(null, "Payment Pending");
        Assert.Equal(1, totalPending);

        // Test Payment Due
        var dueList = await service.GetAllAsync(1, 10, null, "Payment Due");
        Assert.Single(dueList);
        Assert.Equal("Filter Due", dueList[0].Name);
        var totalDue = await service.GetTotalCountAsync(null, "Payment Due");
        Assert.Equal(1, totalDue);
    }

    [Fact]
    public async Task GetHistoryAsync_ReturnsCalculatedPaymentStatusAndInvoiceCount()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "History Customer", "9998887776");
        AddInvoice(db, customer.Id, 5000m, 2000m, InvoiceStatus.PartiallyPaid);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customer.Id);

        Assert.Equal("History Customer", history.CustomerName);
        Assert.Equal("Payment Pending", history.PaymentStatus);
        Assert.Equal(1, history.InvoiceCount);
        Assert.Equal(5000m, history.TotalInvoicedAmount);
        Assert.Equal(2000m, history.TotalPaidAmount);
        Assert.Equal(3000m, history.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Scenario1_CustomerWithNoInvoices_ListAndDetailMatch()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Scenario1 ZeroInv", "9000000001");
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());

        // Verify GET /api/customers (list)
        var list = await service.GetAllAsync(1, 10);
        var fromList = Assert.Single(list);
        Assert.Equal(0, fromList.InvoiceCount);
        Assert.Equal(0m, fromList.TotalInvoicedAmount);
        Assert.Equal(0m, fromList.TotalPaidAmount);
        Assert.Equal(0m, fromList.TotalOutstandingAmount);
        Assert.Equal("No Invoices", fromList.PaymentStatus);

        // Verify GET /api/customers/{id} (detail)
        var detail = await service.GetByIdAsync(customer.Id);
        Assert.NotNull(detail);
        Assert.Equal(fromList.InvoiceCount, detail.InvoiceCount);
        Assert.Equal(fromList.TotalInvoicedAmount, detail.TotalInvoicedAmount);
        Assert.Equal(fromList.TotalPaidAmount, detail.TotalPaidAmount);
        Assert.Equal(fromList.TotalOutstandingAmount, detail.TotalOutstandingAmount);
        Assert.Equal(fromList.PaymentStatus, detail.PaymentStatus);
    }

    [Fact]
    public async Task Scenario2_FullyPaidTenInvoices_ListAndDetailMatch()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Scenario2 FullyPaid", "9000000002");
        for (int i = 0; i < 10; i++)
        {
            AddInvoice(db, customer.Id, 1500m, 1500m, InvoiceStatus.Paid);
        }
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());

        var list = await service.GetAllAsync(1, 10);
        var fromList = Assert.Single(list);
        Assert.Equal(10, fromList.InvoiceCount);
        Assert.Equal(15000m, fromList.TotalInvoicedAmount);
        Assert.Equal(15000m, fromList.TotalPaidAmount);
        Assert.Equal(0m, fromList.TotalOutstandingAmount);
        Assert.Equal("Paid", fromList.PaymentStatus);

        var detail = await service.GetByIdAsync(customer.Id);
        Assert.NotNull(detail);
        Assert.Equal(10, detail.InvoiceCount);
        Assert.Equal(15000m, detail.TotalInvoicedAmount);
        Assert.Equal(15000m, detail.TotalPaidAmount);
        Assert.Equal(0m, detail.TotalOutstandingAmount);
        Assert.Equal("Paid", detail.PaymentStatus);
    }

    [Fact]
    public async Task Scenario3_TenInvoicesWithOneCompletelyUnpaid_ListAndDetailReturnPaymentDue()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Scenario3 Unpaid", "9000000003");
        for (int i = 0; i < 9; i++)
        {
            AddInvoice(db, customer.Id, 1000m, 1000m, InvoiceStatus.Paid);
        }
        // Total outstanding 5000 with PaidAmount = 0
        AddInvoice(db, customer.Id, 5000m, 0m, InvoiceStatus.Generated);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());

        var list = await service.GetAllAsync(1, 10);
        var fromList = Assert.Single(list);
        Assert.Equal(10, fromList.InvoiceCount);
        Assert.Equal(14000m, fromList.TotalInvoicedAmount);
        Assert.Equal(9000m, fromList.TotalPaidAmount);
        Assert.Equal(5000m, fromList.TotalOutstandingAmount);
        Assert.Equal("Payment Due", fromList.PaymentStatus);

        var detail = await service.GetByIdAsync(customer.Id);
        Assert.NotNull(detail);
        Assert.Equal("Payment Due", detail.PaymentStatus);
        Assert.Equal(5000m, detail.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Scenario4_TenInvoicesWithOnePartiallyPaid_ListAndDetailReturnPaymentPending()
    {
        using var db = CreateInMemoryDb();
        var customer = CreateCustomer(db, "Scenario4 Partial", "9000000004");
        // 9 invoices of 700 fully paid = 6,300 invoiced, 6,300 paid
        // 1 invoice of 2,200 with 700 paid = 1,500 outstanding
        // Total: 10 invoices, 8,500 invoiced, 7,000 paid, 1,500 outstanding, no completely unpaid invoice
        for (int i = 0; i < 9; i++)
        {
            AddInvoice(db, customer.Id, 700m, 700m, InvoiceStatus.Paid);
        }
        AddInvoice(db, customer.Id, 2200m, 700m, InvoiceStatus.PartiallyPaid);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());

        var list = await service.GetAllAsync(1, 10);
        var fromList = Assert.Single(list);
        Assert.Equal(10, fromList.InvoiceCount);
        Assert.Equal(8500m, fromList.TotalInvoicedAmount);
        Assert.Equal(7000m, fromList.TotalPaidAmount);
        Assert.Equal(1500m, fromList.TotalOutstandingAmount);
        Assert.Equal("Payment Pending", fromList.PaymentStatus);

        var detail = await service.GetByIdAsync(customer.Id);
        Assert.NotNull(detail);
        Assert.Equal("Payment Pending", detail.PaymentStatus);
        Assert.Equal(8500m, detail.TotalInvoicedAmount);
        Assert.Equal(7000m, detail.TotalPaidAmount);
        Assert.Equal(1500m, detail.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Scenario5_RealBugRegression_Rahul3Invoices_ListAndDetailReconcileIdenticalTotals()
    {
        using var db = CreateInMemoryDb();
        var rahul = CreateCustomer(db, "Rahul", "1234567890");
        var vehicle = EnsureVehicle(db, rahul.Id);

        // Invoice 1: 4,897.00 invoiced, 4,897.00 paid
        AddInvoice(db, rahul.Id, 4897.00m, 4897.00m, InvoiceStatus.Paid);

        // Invoice 2: 7,852.90 invoiced, 0.00 paid (Generated, completely unpaid)
        AddInvoice(db, rahul.Id, 7852.90m, 0.00m, InvoiceStatus.Generated);

        // Invoice 3: 7,085.90 invoiced, 7,085.90 paid
        AddInvoice(db, rahul.Id, 7085.90m, 7085.90m, InvoiceStatus.Paid);

        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());

        // 1. Verify GET /api/customers (list endpoint)
        var list = await service.GetAllAsync(1, 10);
        Assert.Single(list);
        var fromList = list[0];

        Assert.Equal(3, fromList.InvoiceCount);
        Assert.Equal(19835.80m, fromList.TotalInvoicedAmount);
        Assert.Equal(11982.90m, fromList.TotalPaidAmount);
        Assert.Equal(7852.90m, fromList.TotalOutstandingAmount);
        Assert.Equal("Payment Due", fromList.PaymentStatus);

        // Must never return 0/default values on the list
        Assert.NotEqual(0, fromList.InvoiceCount);
        Assert.NotEqual(0m, fromList.TotalOutstandingAmount);
        Assert.NotEqual("No Invoices", fromList.PaymentStatus);

        // 2. Verify GET /api/customers/{id} (detail endpoint)
        var fromDetail = await service.GetByIdAsync(rahul.Id);
        Assert.NotNull(fromDetail);
        Assert.Equal(fromList.InvoiceCount, fromDetail.InvoiceCount);
        Assert.Equal(fromList.TotalInvoicedAmount, fromDetail.TotalInvoicedAmount);
        Assert.Equal(fromList.TotalPaidAmount, fromDetail.TotalPaidAmount);
        Assert.Equal(fromList.TotalOutstandingAmount, fromDetail.TotalOutstandingAmount);
        Assert.Equal(fromList.PaymentStatus, fromDetail.PaymentStatus);

        // 3. Verify GET /api/customers/by-phone/{phoneNumber}
        var fromPhone = await service.GetByPhoneAsync(rahul.PhoneNumber);
        Assert.NotNull(fromPhone);
        Assert.Equal(fromList.InvoiceCount, fromPhone.InvoiceCount);
        Assert.Equal(fromList.TotalOutstandingAmount, fromPhone.TotalOutstandingAmount);
        Assert.Equal(fromList.PaymentStatus, fromPhone.PaymentStatus);

        // 4. Verify GET /api/customers/by-registration/{reg}
        var fromReg = await service.GetByRegistrationAsync(vehicle.RegistrationNumber);
        Assert.NotNull(fromReg);
        Assert.Equal(fromList.InvoiceCount, fromReg.InvoiceCount);
        Assert.Equal(fromList.TotalOutstandingAmount, fromReg.TotalOutstandingAmount);
        Assert.Equal(fromList.PaymentStatus, fromReg.PaymentStatus);

        // 5. Verify GET /api/customers/{id}/history
        var fromHistory = await service.GetHistoryAsync(rahul.Id);
        Assert.Equal(fromList.InvoiceCount, fromHistory.InvoiceCount);
        Assert.Equal(fromList.TotalInvoicedAmount, fromHistory.TotalInvoicedAmount);
        Assert.Equal(fromList.TotalPaidAmount, fromHistory.TotalPaidAmount);
        Assert.Equal(fromList.TotalOutstandingAmount, fromHistory.TotalOutstandingAmount);
        Assert.Equal(fromList.PaymentStatus, fromHistory.PaymentStatus);

        // 6. Verify Filters
        // A customer with outstanding balance must NOT appear in the Paid filter
        var paidResults = await service.GetAllAsync(1, 10, paymentStatus: "Paid");
        Assert.Empty(paidResults);
        var paidCount = await service.GetTotalCountAsync(paymentStatus: "Paid");
        Assert.Equal(0, paidCount);

        // Rahul must appear in Payment Due
        var dueResults = await service.GetAllAsync(1, 10, paymentStatus: "Payment Due");
        Assert.Single(dueResults);
        Assert.Equal("Rahul", dueResults[0].Name);
        var dueCount = await service.GetTotalCountAsync(paymentStatus: "Payment Due");
        Assert.Equal(1, dueCount);

        // Must not appear in Payment Pending or No Invoices
        var pendingResults = await service.GetAllAsync(1, 10, paymentStatus: "Payment Pending");
        Assert.Empty(pendingResults);
        var noInvResults = await service.GetAllAsync(1, 10, paymentStatus: "No Invoices");
        Assert.Empty(noInvResults);
    }
}
