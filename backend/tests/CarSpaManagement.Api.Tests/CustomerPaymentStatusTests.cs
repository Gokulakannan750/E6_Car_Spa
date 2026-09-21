using System.Security.Claims;
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

    [Fact]
    public async Task Case1_FullyPaidInvoice_ReturnsPaidStatusAndZeroOutstanding()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var jobCardId = Guid.NewGuid();
        var invoiceId = Guid.NewGuid();

        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" };
        var jobCard = new JobCard { Id = jobCardId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000001", Status = JobCardStatus.Invoiced, TotalAmount = 5000m };
        var invoice = new Invoice
        {
            Id = invoiceId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jobCardId,
            InvoiceNumber = "INV-2026-000001",
            TotalAmount = 5000m,
            PaidAmount = 5000m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid
        };
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoiceId,
            Amount = 5000m,
            PaymentMethod = PaymentMethod.UPI,
            IsDeleted = false
        };
        invoice.Payments.Add(payment);

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        Assert.Single(history.JobCards);
        var item = history.JobCards[0];
        Assert.Equal("Paid", item.PaymentStatus);
        Assert.Equal(5000m, item.InvoiceTotal);
        Assert.Equal(5000m, item.PaidAmount);
        Assert.Equal(0m, item.OutstandingAmount);
        Assert.Equal(0m, history.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Case2_PartiallyPaidInvoice_ReturnsPendingStatusAndCorrectOutstanding()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var jobCardId = Guid.NewGuid();
        var invoiceId = Guid.NewGuid();

        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" };
        var jobCard = new JobCard { Id = jobCardId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000002", Status = JobCardStatus.Invoiced, TotalAmount = 5000m };
        var invoice = new Invoice
        {
            Id = invoiceId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jobCardId,
            InvoiceNumber = "INV-2026-000002",
            TotalAmount = 5000m,
            PaidAmount = 2000m,
            BalanceAmount = 3000m,
            Status = InvoiceStatus.PartiallyPaid
        };
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoiceId,
            Amount = 2000m,
            PaymentMethod = PaymentMethod.Cash,
            IsDeleted = false
        };
        invoice.Payments.Add(payment);

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        Assert.Single(history.JobCards);
        var item = history.JobCards[0];
        Assert.Equal("Partially Paid", item.PaymentStatus);
        Assert.Equal(5000m, item.InvoiceTotal);
        Assert.Equal(2000m, item.PaidAmount);
        Assert.Equal(3000m, item.OutstandingAmount);
        Assert.Equal(3000m, history.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Case3_UnpaidInvoice_ReturnsPendingStatusAndFullOutstanding()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var jobCardId = Guid.NewGuid();
        var invoiceId = Guid.NewGuid();

        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" };
        var jobCard = new JobCard { Id = jobCardId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000003", Status = JobCardStatus.Invoiced, TotalAmount = 5000m };
        var invoice = new Invoice
        {
            Id = invoiceId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jobCardId,
            InvoiceNumber = "INV-2026-000003",
            TotalAmount = 5000m,
            PaidAmount = 0m,
            BalanceAmount = 5000m,
            Status = InvoiceStatus.Generated
        };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        Assert.Single(history.JobCards);
        var item = history.JobCards[0];
        Assert.Equal("Payment Pending", item.PaymentStatus);
        Assert.Equal(5000m, item.InvoiceTotal);
        Assert.Equal(0m, item.PaidAmount);
        Assert.Equal(5000m, item.OutstandingAmount);
        Assert.Equal(5000m, history.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Case4_MultipleInvoices_CalculatesCustomerTotalOutstandingAccurately()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();

        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" };

        var jcAId = Guid.NewGuid();
        var jcBId = Guid.NewGuid();
        var jcA = new JobCard { Id = jcAId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000004", Status = JobCardStatus.Invoiced, TotalAmount = 5000m };
        var jcB = new JobCard { Id = jcBId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000005", Status = JobCardStatus.Invoiced, TotalAmount = 7000m };

        var invAId = Guid.NewGuid();
        var invBId = Guid.NewGuid();
        var invA = new Invoice
        {
            Id = invAId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jcAId,
            InvoiceNumber = "INV-2026-000004",
            TotalAmount = 5000m,
            PaidAmount = 5000m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid
        };
        invA.Payments.Add(new Payment { Id = Guid.NewGuid(), InvoiceId = invAId, Amount = 5000m, PaymentMethod = PaymentMethod.UPI, IsDeleted = false });

        var invB = new Invoice
        {
            Id = invBId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jcBId,
            InvoiceNumber = "INV-2026-000005",
            TotalAmount = 7000m,
            PaidAmount = 3000m,
            BalanceAmount = 4000m,
            Status = InvoiceStatus.PartiallyPaid
        };
        invB.Payments.Add(new Payment { Id = Guid.NewGuid(), InvoiceId = invBId, Amount = 3000m, PaymentMethod = PaymentMethod.Cash, IsDeleted = false });

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.AddRange(jcA, jcB);
        db.Invoices.AddRange(invA, invB);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        Assert.Equal(2, history.JobCards.Count);
        Assert.Equal(4000m, history.TotalOutstandingAmount);
        Assert.Equal(8000m, history.TotalPaidAmount);
        Assert.Equal(12000m, history.TotalInvoicedAmount);
    }

    [Fact]
    public async Task Case5_NoOutstandingInvoices_ReturnsZeroTotalOutstanding()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        Assert.Empty(history.JobCards);
        Assert.Equal(0m, history.TotalOutstandingAmount);
        Assert.Equal(0m, history.TotalPaidAmount);
        Assert.Equal(0m, history.TotalInvoicedAmount);
    }

    [Fact]
    public async Task Case6_SoftDeletedPayment_DoesNotReduceOutstandingAmount()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var jobCardId = Guid.NewGuid();
        var invoiceId = Guid.NewGuid();

        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" };
        var jobCard = new JobCard { Id = jobCardId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000006", Status = JobCardStatus.Invoiced, TotalAmount = 5000m };
        var invoice = new Invoice
        {
            Id = invoiceId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jobCardId,
            InvoiceNumber = "INV-2026-000006",
            TotalAmount = 5000m,
            PaidAmount = 0m,
            BalanceAmount = 5000m,
            Status = InvoiceStatus.Generated
        };
        var deletedPayment = new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoiceId,
            Amount = 5000m,
            PaymentMethod = PaymentMethod.UPI,
            IsDeleted = true // Soft-deleted/voided
        };
        invoice.Payments.Add(deletedPayment);

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        Assert.Single(history.JobCards);
        var item = history.JobCards[0];
        Assert.Equal("Payment Pending", item.PaymentStatus);
        Assert.Equal(0m, item.PaidAmount);
        Assert.Equal(5000m, item.OutstandingAmount);
        Assert.Equal(5000m, history.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Case7_JobCardWithNoInvoice_IsNotReturnedInFinancialHistory()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var jobCardId = Guid.NewGuid();

        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" };
        var jobCard = new JobCard { Id = jobCardId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000007", Status = JobCardStatus.InProgress, TotalAmount = 4500m };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        // Invoices only: Uninvoiced JobCard is NOT returned as a financial history record
        Assert.Empty(history.JobCards);
        Assert.Equal(1, history.TotalJobCards);
        Assert.Equal(0m, history.TotalOutstandingAmount);
        Assert.Equal(0m, history.TotalPaidAmount);
        Assert.Equal(0m, history.TotalInvoicedAmount);
    }

    [Fact]
    public async Task Case8_CancelledInvoice_ReturnsCancelledStatusAndZeroOutstanding()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var jobCardId = Guid.NewGuid();
        var invoiceId = Guid.NewGuid();

        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" };
        var jobCard = new JobCard { Id = jobCardId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000008", Status = JobCardStatus.Ready, TotalAmount = 5000m };
        var invoice = new Invoice
        {
            Id = invoiceId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jobCardId,
            InvoiceNumber = "INV-2026-000008",
            TotalAmount = 5000m,
            PaidAmount = 0m,
            BalanceAmount = 5000m,
            Status = InvoiceStatus.Cancelled
        };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        Assert.Single(history.JobCards);
        var item = history.JobCards[0];
        Assert.Equal("Cancelled", item.PaymentStatus);
        Assert.Equal(invoiceId, item.InvoiceId);
        Assert.Equal(0m, history.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Case9_InvoiceLinkedViaJobCardId_ResolvedCorrectlyEvenIfCustomerIdDiffers()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var otherCustomerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var jobCardId = Guid.NewGuid();
        var invoiceId = Guid.NewGuid();

        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" };
        var jobCard = new JobCard { Id = jobCardId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000009", Status = JobCardStatus.Invoiced, TotalAmount = 6000m };
        
        // Invoice was created referencing the JobCardId, but CustomerId had previous owner
        var invoice = new Invoice
        {
            Id = invoiceId,
            CustomerId = otherCustomerId,
            VehicleId = vehicleId,
            JobCardId = jobCardId,
            InvoiceNumber = "INV-2026-000009",
            TotalAmount = 6000m,
            PaidAmount = 2000m,
            BalanceAmount = 4000m,
            Status = InvoiceStatus.PartiallyPaid
        };
        invoice.Payments.Add(new Payment { Id = Guid.NewGuid(), InvoiceId = invoiceId, Amount = 2000m, PaymentMethod = PaymentMethod.Cash, IsDeleted = false });

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        Assert.Single(history.JobCards);
        var item = history.JobCards[0];
        Assert.Equal("Partially Paid", item.PaymentStatus);
        Assert.Equal(invoiceId, item.InvoiceId);
        Assert.Equal("INV-2026-000009", item.InvoiceNumber);
        Assert.Equal(6000m, item.InvoiceTotal);
        Assert.Equal(2000m, item.PaidAmount);
        Assert.Equal(4000m, item.OutstandingAmount);
        Assert.Equal(4000m, history.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Case10_ExactScenario_Rahul_JC2026000028_INV2026000023_PartiallyPaid()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var jobCardId = Guid.NewGuid();
        var invoiceId = Guid.NewGuid();

        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN12A1234", Make = "Maruti", Model = "Swift" };
        var jobCard = new JobCard { Id = jobCardId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000028", Status = JobCardStatus.Invoiced, TotalAmount = 7085.90m };
        var invoice = new Invoice
        {
            Id = invoiceId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jobCardId,
            InvoiceNumber = "INV-2026-000023",
            TotalAmount = 7085.90m,
            PaidAmount = 2000.00m,
            BalanceAmount = 5085.90m,
            Status = InvoiceStatus.PartiallyPaid
        };
        invoice.Payments.Add(new Payment { Id = Guid.NewGuid(), InvoiceId = invoiceId, Amount = 2000.00m, PaymentMethod = PaymentMethod.UPI, IsDeleted = false });

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        Assert.Single(history.JobCards);
        var item = history.JobCards[0];
        Assert.Equal("JC-2026-000028", item.JobCardNumber);
        Assert.Equal("INV-2026-000023", item.InvoiceNumber);
        Assert.Equal(invoiceId, item.InvoiceId);
        Assert.Equal("Partially Paid", item.PaymentStatus);
        Assert.Equal(7085.90m, item.InvoiceTotal);
        Assert.Equal(2000.00m, item.PaidAmount);
        Assert.Equal(5085.90m, item.OutstandingAmount);
        Assert.Equal(5085.90m, history.TotalOutstandingAmount);
    }

    [Fact]
    public async Task Case11_CustomerWithBothInvoicedAndUninvoicedJobCards_ReturnsOnlyInvoicedItems()
    {
        using var db = CreateInMemoryDb();
        var customerId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var customer = new Customer { Id = customerId, Name = "Rahul", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = vehicleId, CustomerId = customerId, RegistrationNumber = "TN12A1234", Make = "Maruti", Model = "Swift" };

        var jcAId = Guid.NewGuid();
        var jcBId = Guid.NewGuid();
        var jcCId = Guid.NewGuid();

        var jcA = new JobCard { Id = jcAId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000028", Status = JobCardStatus.Invoiced, TotalAmount = 7085.90m };
        var jcB = new JobCard { Id = jcBId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000015", Status = JobCardStatus.Invoiced, TotalAmount = 104030.01m };
        var jcC = new JobCard { Id = jcCId, CustomerId = customerId, VehicleId = vehicleId, JobCardNumber = "JC-2026-000014", Status = JobCardStatus.InProgress, TotalAmount = 4897.00m };

        var invAId = Guid.NewGuid();
        var invBId = Guid.NewGuid();

        var invA = new Invoice
        {
            Id = invAId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jcAId,
            InvoiceNumber = "INV-2026-000023",
            TotalAmount = 7085.90m,
            PaidAmount = 1000.00m,
            BalanceAmount = 6085.90m,
            Status = InvoiceStatus.PartiallyPaid
        };
        invA.Payments.Add(new Payment { Id = Guid.NewGuid(), InvoiceId = invAId, Amount = 1000.00m, PaymentMethod = PaymentMethod.Cash, IsDeleted = false });

        var invB = new Invoice
        {
            Id = invBId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            JobCardId = jcBId,
            InvoiceNumber = "INV-2026-000022",
            TotalAmount = 104030.01m,
            PaidAmount = 104030.01m,
            BalanceAmount = 0.00m,
            Status = InvoiceStatus.Paid
        };
        invB.Payments.Add(new Payment { Id = Guid.NewGuid(), InvoiceId = invBId, Amount = 104030.01m, PaymentMethod = PaymentMethod.UPI, IsDeleted = false });

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.AddRange(jcA, jcB, jcC);
        db.Invoices.AddRange(invA, invB);
        await db.SaveChangesAsync();

        var service = new CustomerService(db, new DummyAuditLogService());
        var history = await service.GetHistoryAsync(customerId);

        // TotalJobCards reflects all 3 job cards
        Assert.Equal(3, history.TotalJobCards);
        // Financial history contains ONLY the 2 invoices, Job Card C (uninvoiced) is NOT present
        Assert.Equal(2, history.JobCards.Count);

        var inv23 = history.JobCards.FirstOrDefault(i => i.InvoiceNumber == "INV-2026-000023");
        Assert.NotNull(inv23);
        Assert.Equal("Partially Paid", inv23.PaymentStatus);
        Assert.Equal(7085.90m, inv23.TotalAmount);
        Assert.Equal(1000.00m, inv23.PaidAmount);
        Assert.Equal(6085.90m, inv23.OutstandingAmount);

        var inv22 = history.JobCards.FirstOrDefault(i => i.InvoiceNumber == "INV-2026-000022");
        Assert.NotNull(inv22);
        Assert.Equal("Paid", inv22.PaymentStatus);
        Assert.Equal(104030.01m, inv22.TotalAmount);
        Assert.Equal(104030.01m, inv22.PaidAmount);
        Assert.Equal(0.00m, inv22.OutstandingAmount);

        Assert.Equal(6085.90m, history.TotalOutstandingAmount);
        Assert.Equal(105030.01m, history.TotalPaidAmount);
        Assert.Equal(111115.91m, history.TotalInvoicedAmount);
    }
}
