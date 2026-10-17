using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class ServiceCategoryTests
{
    [Fact]
    public async Task CategoriesPersistWithoutServices_RejectDuplicates_AndStayInTheirCompany()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var companyA = Guid.NewGuid();
        var companyB = Guid.NewGuid();
        var audit = new RecordingAuditLogService();
        using (var db = new AppDbContext(options, new FixedTenantContext(companyA)))
        {
            db.Organizations.Add(new Organization { Id = companyA, Name = "Company A" });
            await db.SaveChangesAsync();
            var service = new ServiceService(db, audit);
            Assert.Equal("Car Wash", await service.CreateCategoryAsync("  Car Wash  "));
            Assert.Null(await service.CreateCategoryAsync("car wash"));
            Assert.Empty(db.Services);
            Assert.Single(audit.Entries);
        }
        using (var db = new AppDbContext(options, new FixedTenantContext(companyA)))
        {
            var service = new ServiceService(db, audit);
            Assert.Equal(new[] { "Car Wash" }, await service.GetCategoriesAsync());
            db.Services.Add(new Service { Name = "Polish", Category = "Existing Category" });
            await db.SaveChangesAsync();
            Assert.Contains("Existing Category", await service.GetCategoriesAsync());
        }
        using (var db = new AppDbContext(options, new FixedTenantContext(companyB)))
        {
            db.Organizations.Add(new Organization { Id = companyB, Name = "Company B" });
            await db.SaveChangesAsync();
            var service = new ServiceService(db, audit);
            Assert.Empty(await service.GetCategoriesAsync());
            Assert.Equal("Car Wash", await service.CreateCategoryAsync("Car Wash"));
        }
    }
}
