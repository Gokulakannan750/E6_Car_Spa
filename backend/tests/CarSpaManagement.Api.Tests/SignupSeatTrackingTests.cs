using System.Data.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class SignupSeatTrackingTests
{
    [PostgresFact]
    public async Task GeneratedGuidMapping_ReproducesSeatUpdateFailure_WithoutAnotherWriter()
    {
        await using var env = new PlatformTestEnvironment();
        Guid orderId;
        await using (var scope = env.Scope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var product = await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().EnsureCatalogAsync();
            var order = NewOrder(product.Id);
            orderId = order.Id;
            db.SignupOrders.Add(order);
            await db.SaveChangesAsync();
        }

        var sql = new SeatCommands();
        var options = new DbContextOptionsBuilder<PlatformDbContext>()
            .UseNpgsql(PlatformTestEnvironment.AdminConnection(env.CatalogDatabase)).AddInterceptors(sql).Options;
        await using var oldMapping = new GeneratedSeatContext(options);
        var persisted = await oldMapping.SignupOrders.SingleAsync(o => o.Id == orderId);
        var originalVersion = await RowVersionAsync(oldMapping, orderId);
        var types = await oldMapping.ProductSeatTypes.ToListAsync();
        Assert.DoesNotContain(oldMapping.Model.FindEntityType(typeof(SignupOrder))!.GetProperties(), p => p.IsConcurrencyToken);
        Assert.Equal(ValueGenerated.OnAdd, oldMapping.Model.FindEntityType(typeof(SignupOrderSeat))!.FindProperty("Id")!.ValueGenerated);
        persisted.Status = SignupStatus.Completed;
        persisted.SetLicences(new LicenceCounts(0, 0, 3), types);
        oldMapping.ChangeTracker.DetectChanges();
        Assert.All(oldMapping.ChangeTracker.Entries<SignupOrderSeat>(), e => Assert.Equal(EntityState.Modified, e.State));

        var failure = await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => oldMapping.SaveChangesAsync());
        Assert.NotEmpty(failure.Entries);
        Assert.All(failure.Entries, e => Assert.IsType<SignupOrderSeat>(e.Entity));
        Assert.Contains(sql.Commands, command => command.Contains("UPDATE \"SignupOrderSeats\""));
        Assert.DoesNotContain(sql.Commands, command => command.Contains("INSERT INTO \"SignupOrderSeats\""));
        Assert.Equal(originalVersion, await RowVersionAsync(oldMapping, orderId));
        Assert.Equal(SignupStatus.Processing, await oldMapping.SignupOrders.AsNoTracking().Where(o => o.Id == orderId).Select(o => o.Status).SingleAsync());
    }

    [PostgresFact]
    public async Task TrialSignup_InsertsAssignedSeatIds_OrderVersionStaysStableDuringProvisioning()
    {
        var probe = new OrderSaves();
        var sql = new SeatCommands();
        await using var env = new PlatformTestEnvironment(options => options.AddInterceptors(probe, sql));
        await using (var scope = env.Scope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            foreach (var type in new[] { typeof(ProductSeatType), typeof(ProductFeature), typeof(SubscriptionSeat), typeof(PlanVersionSeatPrice), typeof(SignupOrderSeat) })
                Assert.Equal(ValueGenerated.Never, db.Model.FindEntityType(type)!.FindProperty("Id")!.ValueGenerated);
            var result = await scope.ServiceProvider.GetRequiredService<SignupService>().CreateAsync(
                new SignupRequest(new SignupBusiness("Seat regression", "Owner", "9876543210", "seats@example.test", "Erode", "Tamil Nadu", null),
                    true, null, true), null);
            Assert.Equal(SignupStatus.Completed, result.Status);
            var persisted = await db.SignupOrders.AsNoTracking().SingleAsync(o => o.Id == result.OrderId);
            Assert.Equal(new LicenceCounts(0, 0, 3), persisted.Licences);
            Assert.Equal(3, persisted.Seats.Count);
            Assert.All(persisted.Seats, s => Assert.NotEqual(Guid.Empty, s.Id));
        }

        var processing = probe.Observed.Where(o => o.Status == SignupStatus.Processing).ToList();
        Assert.True(processing.Count >= 3, "The order must be observed after its initial save and during nested provisioning saves.");
        Assert.Single(processing.Select(o => o.Version).Distinct());
        Assert.Contains(probe.Observed, o => o.Status == SignupStatus.Completed && o.Version != processing[0].Version);
        Assert.Contains(sql.Commands, command => command.Contains("INSERT INTO \"SignupOrderSeats\""));
        Assert.DoesNotContain(sql.Commands, command => command.Contains("UPDATE \"SignupOrderSeats\""));
    }

    private static SignupOrder NewOrder(Guid productId) => new()
    {
        Id = Guid.NewGuid(), ProductId = productId, Start = SignupStart.Trial, Status = SignupStatus.Processing,
        BusinessName = "Tracking regression", OwnerName = "Owner", Mobile = "9876543210", Email = "tracking@example.test",
        City = "Erode", State = "Tamil Nadu", TokenHash = new string('a', 64), CreatedAt = DateTime.UtcNow,
        ExpiresAt = DateTime.UtcNow.AddHours(1)
    };

    private static Task<string> RowVersionAsync(PlatformDbContext db, Guid id) => db.Database.SqlQuery<string>($"""
        SELECT xmin::text AS "Value" FROM "SignupOrders" WHERE "Id" = {id}
        """).SingleAsync();

    private sealed class GeneratedSeatContext(DbContextOptions<PlatformDbContext> options) : PlatformDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            builder.Entity<SignupOrderSeat>().Property(s => s.Id).ValueGeneratedOnAdd();
        }
    }

    // Capture command text only: no order tokens, business details, connection strings, or parameter values.
    private sealed class SeatCommands : DbCommandInterceptor
    {
        public List<string> Commands { get; } = [];
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData data,
            InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("UPDATE \"SignupOrderSeats\"") || command.CommandText.Contains("INSERT INTO \"SignupOrderSeats\""))
                Commands.Add(command.CommandText);
            return ValueTask.FromResult(result);
        }
    }

    private sealed class OrderSaves : SaveChangesInterceptor
    {
        public List<(SignupStatus Status, string Version)> Observed { get; } = [];
        public override async ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData data, int result, CancellationToken cancellationToken = default)
        {
            if (data.Context is not PlatformDbContext db) return result;
            foreach (var entry in db.ChangeTracker.Entries<SignupOrder>())
            {
                // An independent connection sees only committed row versions, not tracked entity values.
                await using var connection = new NpgsqlConnection(db.Database.GetConnectionString());
                await connection.OpenAsync(cancellationToken);
                await using var command = new NpgsqlCommand("SELECT \"Status\", xmin::text FROM \"SignupOrders\" WHERE \"Id\" = @id", connection);
                command.Parameters.AddWithValue("id", entry.Entity.Id);
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                if (await reader.ReadAsync(cancellationToken)) Observed.Add((Enum.Parse<SignupStatus>(reader.GetString(0)), reader.GetString(1)));
            }
            return result;
        }
    }
}
