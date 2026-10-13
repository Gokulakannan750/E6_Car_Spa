using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Everyday work in a company's own database on Trovo's platform, where the app connects with the company's own
/// restricted login (row rules apply, unlike a superuser on a single-company server).
/// </summary>
public class PlatformCompanyDatabaseTests : IAsyncLifetime
{
    private PlatformTestEnvironment? _env;
    private PlatformTestEnvironment Env => _env!;

    public Task InitializeAsync()
    {
        if (PostgresTestEnvironment.AdminConnectionString is not null) _env = new PlatformTestEnvironment();
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (_env is not null) await _env.DisposeAsync();
    }

    [PostgresFact]
    public async Task ANewCompany_CanCreateItsFirstJobCards_NumberedFromOne()
    {
        var company = await Env.CreateRegisteredCompanyAsync("First Job Card Spa");
        await using var scope = Env.CompanyScope(company.Id);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var customer = new Customer { Name = "Gj", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = "TN33AA0123", Make = "Maruti", Model = "Swift" };
        var service = new Service { Name = "Full body wash", Price = 500, TaxPercentage = 18, IsActive = true };
        db.AddRange(customer, vehicle, service);
        await db.SaveChangesAsync();

        var jobCards = new CarSpaManagement.Api.Application.Services.JobCardService(db, scope.ServiceProvider.GetRequiredService<IAuditLogService>());
        CreateJobCardRequest Request() => new()
        {
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Services = [new JobCardServiceItemRequest { ServiceId = service.Id, Quantity = 1 }]
        };

        var first = await jobCards.CreateAsync(Request());
        var second = await jobCards.CreateAsync(Request());
        Assert.EndsWith("-000001", first.JobCardNumber);
        Assert.EndsWith("-000002", second.JobCardNumber);
    }
}
