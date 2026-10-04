using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;
using JobCardServiceApp = CarSpaManagement.Api.Application.Services.JobCardService;

namespace CarSpaManagement.Api.Tests;

/// <summary>Shared helpers: create GST / non-GST drafts through the real services and finalize them.</summary>
internal static class SeriesTestHelpers
{
    public static InvoiceService Invoices(AppDbContext db, Guid? userId = null)
    {
        var http = new DefaultHttpContext();
        if (userId is not null)
            http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString())], "Test"));
        return new InvoiceService(db, new RecordingAuditLogService(), new ConfigurationBuilder().Build(),
            new HttpContextAccessor { HttpContext = http }, new NoopWhatsAppService(),
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());
    }

    public static async Task<Guid> CreateDraftAsync(PostgresTestDatabase pg, bool gst)
    {
        Guid customerId, vehicleId, serviceId;
        await using (var db = pg.CreateContext())
        {
            var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
            var customer = new Customer { Name = "Series Test", PhoneNumber = "9000000006" };
            var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = $"TN06{suffix}", Make = "Test", Model = "Car" };
            var service = new Service { Name = $"Wash {suffix}", Category = "Exterior", Price = 1000m, TaxPercentage = 18m, IsActive = true };
            db.AddRange(customer, vehicle, service);
            await db.SaveChangesAsync();
            (customerId, vehicleId, serviceId) = (customer.Id, vehicle.Id, service.Id);
        }

        await using var db2 = pg.CreateContext();
        var jobCard = await new JobCardServiceApp(db2, new RecordingAuditLogService()).CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customerId, VehicleId = vehicleId, IsGstEnabled = gst,
            Services = [new JobCardServiceItemRequest { ServiceId = serviceId }],
        });
        var draft = await Invoices(db2).CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.Equal(gst, draft.IsGstEnabled);
        return draft.Id;
    }

    public static async Task<string> FinalizeAsync(PostgresTestDatabase pg, Guid invoiceId)
    {
        await using var db = pg.CreateContext();
        return (await Invoices(db).GenerateInvoiceAsync(invoiceId)).InvoiceNumber!;
    }

    public static async Task<long> NextNumberAsync(PostgresTestDatabase pg, InvoiceSeriesKind kind)
    {
        await using var db = pg.CreateContext();
        return (await db.InvoiceNumberSeries.AsNoTracking().SingleAsync(s => s.SeriesKind == kind)).NextNumber;
    }

    public static async Task<string> PrefixAsync(PostgresTestDatabase pg, InvoiceSeriesKind kind)
    {
        await using var db = pg.CreateContext();
        return (await db.InvoiceNumberSeries.AsNoTracking().SingleAsync(s => s.SeriesKind == kind)).Prefix;
    }

    public static async Task<Guid> EnsureOwnerAsync(PostgresTestDatabase pg)
    {
        await using var db = pg.CreateContext();
        var owner = await db.Users.FirstOrDefaultAsync(u => u.Role == UserRole.Owner);
        if (owner is not null) return owner.Id;
        owner = new User { FullName = "Owner", Username = "owner", Role = UserRole.Owner, IsActive = true, PasswordHash = "x" };
        db.Users.Add(owner);
        await db.SaveChangesAsync();
        return owner.Id;
    }

    public static async Task PayInFullAsync(PostgresTestDatabase pg, Guid invoiceId)
    {
        await using var db = pg.CreateContext();
        var invoice = await db.Invoices.AsNoTracking().SingleAsync(i => i.Id == invoiceId);
        await Invoices(db).RecordPaymentAsync(invoiceId, new RecordPaymentRequest(invoice.BalanceAmount, "Cash"));
    }

    public static async Task<(int ok, List<Exception> errors, List<string> numbers)> FinalizeConcurrentlyAsync(PostgresTestDatabase pg, IReadOnlyList<Guid> invoiceIds)
    {
        var contexts = invoiceIds.Select(_ => pg.CreateContext()).ToList();
        foreach (var c in contexts) await c.Database.OpenConnectionAsync();
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = invoiceIds.Select((id, i) => Task.Run(async () =>
        {
            await gate.Task;
            return (await Invoices(contexts[i]).GenerateInvoiceAsync(id)).InvoiceNumber!;
        })).ToList();
        gate.SetResult();

        var errors = new List<Exception>();
        var numbers = new List<string>();
        foreach (var t in tasks)
        {
            try { numbers.Add(await t); }
            catch (Exception ex) { errors.Add(ex); }
        }
        foreach (var c in contexts) await c.DisposeAsync();
        return (numbers.Count, errors, numbers);
    }
}

/// <summary>A freshly migrated database: both series start at 0001 and count independently.</summary>
public class InvoiceNumberSeriesFreshDatabaseTests : IClassFixture<PostgresTestDatabase>
{
    private readonly PostgresTestDatabase _pg;
    public InvoiceNumberSeriesFreshDatabaseTests(PostgresTestDatabase pg) => _pg = pg;

    [PostgresFact]
    public async Task FreshDatabase_StartsGst0001_AndBill0001_AndSeriesAreIndependent()
    {
        await using (var db = _pg.CreateContext())
        {
            var series = await db.InvoiceNumberSeries.AsNoTracking().OrderBy(s => s.SeriesKind).ToListAsync();
            Assert.Collection(series,
                s => { Assert.Equal(InvoiceSeriesKind.Gst, s.SeriesKind); Assert.Equal("GST/", s.Prefix); Assert.Equal(4, s.MinDigits); Assert.Equal(1, s.NextNumber); },
                s => { Assert.Equal(InvoiceSeriesKind.NonGst, s.SeriesKind); Assert.Equal("BILL/", s.Prefix); Assert.Equal(4, s.MinDigits); Assert.Equal(1, s.NextNumber); });
            Assert.Empty(await db.InvoiceNumberAllocations.ToListAsync());
        }

        var gst1 = await SeriesTestHelpers.FinalizeAsync(_pg, await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true));
        var bill1 = await SeriesTestHelpers.FinalizeAsync(_pg, await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false));
        var bill2 = await SeriesTestHelpers.FinalizeAsync(_pg, await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false));
        var gst2 = await SeriesTestHelpers.FinalizeAsync(_pg, await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true));

        Assert.Equal("GST/0001", gst1);
        Assert.Equal("BILL/0001", bill1); // both series can have 0001
        Assert.Equal("BILL/0002", bill2); // non-GST does not move the GST counter ...
        Assert.Equal("GST/0002", gst2);   // ... and vice versa

        await using var read = _pg.CreateContext();
        var ledger = await read.InvoiceNumberAllocations.AsNoTracking().ToListAsync();
        Assert.Equal(4, ledger.Count);
        Assert.All(ledger, a => Assert.Equal(InvoiceNumberAllocationType.Automatic, a.AllocationType));
        Assert.Equal(2, ledger.Count(a => a.SeriesKind == InvoiceSeriesKind.Gst));
    }
}

/// <summary>Concurrency, rollback, cancellation, manual reservations and prefix changes on real PostgreSQL.</summary>
public class InvoiceNumberSeriesPostgresTests : IClassFixture<PostgresTestDatabase>
{
    private readonly PostgresTestDatabase _pg;
    public InvoiceNumberSeriesPostgresTests(PostgresTestDatabase pg) => _pg = pg;

    private static string Fmt(string prefix, long n) => InvoiceNumberRules.FormatSeriesNumber(prefix, 4, n);

    [PostgresFact]
    public async Task ConcurrentGstFinalizations_GetDistinctConsecutiveNumbers()
    {
        var start = await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst);
        var prefix = await SeriesTestHelpers.PrefixAsync(_pg, InvoiceSeriesKind.Gst);
        var drafts = new List<Guid>();
        for (var i = 0; i < 6; i++) drafts.Add(await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true));

        var (ok, errors, numbers) = await SeriesTestHelpers.FinalizeConcurrentlyAsync(_pg, drafts);

        Assert.Empty(errors);
        Assert.Equal(6, ok);
        Assert.Equal(Enumerable.Range(0, 6).Select(i => Fmt(prefix, start + i)).OrderBy(x => x), numbers.OrderBy(x => x));
        Assert.Equal(start + 6, await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst));
    }

    [PostgresFact]
    public async Task ConcurrentNonGstFinalizations_GetDistinctConsecutiveNumbers()
    {
        var start = await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.NonGst);
        var prefix = await SeriesTestHelpers.PrefixAsync(_pg, InvoiceSeriesKind.NonGst);
        var drafts = new List<Guid>();
        for (var i = 0; i < 6; i++) drafts.Add(await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false));

        var (ok, errors, numbers) = await SeriesTestHelpers.FinalizeConcurrentlyAsync(_pg, drafts);

        Assert.Empty(errors);
        Assert.Equal(6, ok);
        Assert.Equal(Enumerable.Range(0, 6).Select(i => Fmt(prefix, start + i)).OrderBy(x => x), numbers.OrderBy(x => x));
    }

    [PostgresFact]
    public async Task MixedConcurrentFinalizations_EachSeriesStaysConsecutive()
    {
        var gstStart = await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst);
        var billStart = await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.NonGst);
        var drafts = new List<Guid>();
        for (var i = 0; i < 4; i++)
        {
            drafts.Add(await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true));
            drafts.Add(await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false));
        }

        var (ok, errors, numbers) = await SeriesTestHelpers.FinalizeConcurrentlyAsync(_pg, drafts);

        Assert.Empty(errors);
        Assert.Equal(8, ok);
        Assert.Equal(gstStart + 4, await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst));
        Assert.Equal(billStart + 4, await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.NonGst));
        Assert.Equal(8, numbers.Distinct().Count());
    }

    [PostgresFact]
    public async Task GstAndNonGst_DoNotBlockEachOther()
    {
        // Hold the GST series lock in an open transaction; a non-GST finalization must still complete.
        await using var holder = _pg.CreateContext();
        await using var tx = await holder.Database.BeginTransactionAsync();
        await new InvoiceNumberAllocator(holder).LockSeriesAsync(InvoiceSeriesKind.Gst);

        var billDraft = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false);
        var finalize = SeriesTestHelpers.FinalizeAsync(_pg, billDraft);
        var completed = await Task.WhenAny(finalize, Task.Delay(TimeSpan.FromSeconds(10)));

        Assert.Same(finalize, completed);
        Assert.StartsWith(await SeriesTestHelpers.PrefixAsync(_pg, InvoiceSeriesKind.NonGst), await finalize);
        await tx.RollbackAsync();
    }

    [PostgresFact]
    public async Task SameDraftFinalizedConcurrently_ConsumesExactlyOneNumber()
    {
        var start = await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst);
        var draft = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true);

        var (ok, errors, _) = await SeriesTestHelpers.FinalizeConcurrentlyAsync(_pg, [draft, draft]);

        Assert.Equal(1, ok);
        Assert.Contains("already been generated", Assert.IsType<InvalidOperationException>(Assert.Single(errors)).Message);
        Assert.Equal(start + 1, await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst));
        await using var read = _pg.CreateContext();
        Assert.Equal(1, await read.InvoiceNumberAllocations.CountAsync(a => a.InvoiceId == draft));
    }

    [PostgresFact]
    public async Task FailedTransaction_DoesNotConsumeANumber()
    {
        var start = await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.NonGst);
        var draftId = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false);

        await using (var db = _pg.CreateContext())
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var draft = await db.Invoices.SingleAsync(i => i.Id == draftId);
            var number = await new InvoiceNumberAllocator(db).AllocateAutomaticAsync(draft);
            await db.SaveChangesAsync();
            Assert.Equal(1, await db.InvoiceNumberAllocations.CountAsync(a => a.InvoiceNumber == number));
            await tx.RollbackAsync(); // finalization fails after the number was allocated
        }

        Assert.Equal(start, await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.NonGst));
        await using (var read = _pg.CreateContext())
        {
            Assert.Equal(0, await read.InvoiceNumberAllocations.CountAsync(a => a.InvoiceId == draftId));
            Assert.Null((await read.Invoices.AsNoTracking().SingleAsync(i => i.Id == draftId)).InvoiceNumber);
        }

        // The same number is then issued by the next successful finalization: no gap.
        var prefix = await SeriesTestHelpers.PrefixAsync(_pg, InvoiceSeriesKind.NonGst);
        Assert.Equal(Fmt(prefix, start), await SeriesTestHelpers.FinalizeAsync(_pg, draftId));
    }

    [PostgresFact]
    public async Task CancelledInvoice_KeepsItsNumberConsumed()
    {
        var draft = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true);
        var number = await SeriesTestHelpers.FinalizeAsync(_pg, draft);
        await using (var db = _pg.CreateContext())
            await SeriesTestHelpers.Invoices(db).CancelInvoiceAsync(draft);

        await using var read = _pg.CreateContext();
        Assert.Equal(InvoiceStatus.Cancelled, (await read.Invoices.AsNoTracking().SingleAsync(i => i.Id == draft)).Status);
        Assert.True(await new InvoiceNumberAllocator(read).IsConsumedAsync(number, null));
        var next = await SeriesTestHelpers.FinalizeAsync(_pg, await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true));
        Assert.NotEqual(number, next);
    }

    [PostgresFact]
    public async Task ManualRename_ReservesNewNumber_OldNumberStaysConsumed_AndCounterIsUntouched()
    {
        var ownerId = await SeriesTestHelpers.EnsureOwnerAsync(_pg);
        var draft = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true);
        var original = await SeriesTestHelpers.FinalizeAsync(_pg, draft);
        await SeriesTestHelpers.PayInFullAsync(_pg, draft);
        var counterBefore = await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst);

        var custom = $"E6/R/{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        await using (var db = _pg.CreateContext())
            await SeriesTestHelpers.Invoices(db, ownerId).UpdateInvoiceNumberAsync(draft, new UpdateInvoiceNumberRequest(custom));

        Assert.Equal(counterBefore, await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst));
        await using (var read = _pg.CreateContext())
        {
            var ledger = await read.InvoiceNumberAllocations.AsNoTracking().Where(a => a.InvoiceId == draft).ToListAsync();
            Assert.Contains(ledger, a => a.InvoiceNumber == original && a.AllocationType == InvoiceNumberAllocationType.Automatic);
            Assert.Contains(ledger, a => a.InvoiceNumber == custom && a.AllocationType == InvoiceNumberAllocationType.Manual && a.AllocatedByUserId == ownerId);
        }

        // Another paid GST invoice cannot take the replaced (old) number — not even in different case.
        var other = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true);
        await SeriesTestHelpers.FinalizeAsync(_pg, other);
        await SeriesTestHelpers.PayInFullAsync(_pg, other);
        await using (var db = _pg.CreateContext())
        {
            await Assert.ThrowsAsync<ConflictException>(() =>
                SeriesTestHelpers.Invoices(db, ownerId).UpdateInvoiceNumberAsync(other, new UpdateInvoiceNumberRequest(original.ToLowerInvariant())));
        }

        // The renamed invoice itself may return to its own original number.
        await using (var db = _pg.CreateContext())
        {
            var back = await SeriesTestHelpers.Invoices(db, ownerId).UpdateInvoiceNumberAsync(draft, new UpdateInvoiceNumberRequest(original));
            Assert.Equal(original, back.InvoiceNumber);
        }
    }

    [PostgresFact]
    public async Task FutureNumberReservedManually_IsSkippedByAutomaticAllocation()
    {
        var ownerId = await SeriesTestHelpers.EnsureOwnerAsync(_pg);
        var draft = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true);
        await SeriesTestHelpers.FinalizeAsync(_pg, draft);
        await SeriesTestHelpers.PayInFullAsync(_pg, draft);

        var prefix = await SeriesTestHelpers.PrefixAsync(_pg, InvoiceSeriesKind.Gst);
        var next = await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst);
        var future = Fmt(prefix, next); // the very next automatic number
        await using (var db = _pg.CreateContext())
            await SeriesTestHelpers.Invoices(db, ownerId).UpdateInvoiceNumberAsync(draft, new UpdateInvoiceNumberRequest(future));

        var issued = await SeriesTestHelpers.FinalizeAsync(_pg, await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true));
        Assert.Equal(Fmt(prefix, next + 1), issued);
        Assert.Equal(next + 2, await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.Gst));
    }

    [PostgresFact]
    public async Task PrefixChange_ContinuesCounter_AndNeverReusesEarlierNumbers()
    {
        var ownerId = await SeriesTestHelpers.EnsureOwnerAsync(_pg);
        var originalPrefix = await SeriesTestHelpers.PrefixAsync(_pg, InvoiceSeriesKind.NonGst);
        var first = await SeriesTestHelpers.FinalizeAsync(_pg, await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false));
        var counterAfterFirst = await SeriesTestHelpers.NextNumberAsync(_pg, InvoiceSeriesKind.NonGst);

        async Task SetPrefix(string prefix)
        {
            await using var db = _pg.CreateContext();
            var series = await db.InvoiceNumberSeries.SingleAsync(s => s.SeriesKind == InvoiceSeriesKind.NonGst);
            series.Prefix = prefix;
            await db.SaveChangesAsync();
        }

        await SetPrefix("TMP/");
        var underNewPrefix = await SeriesTestHelpers.FinalizeAsync(_pg, await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false));
        Assert.Equal(Fmt("TMP/", counterAfterFirst), underNewPrefix); // counter continues, not reset

        await SetPrefix(originalPrefix);
        var backOnOriginal = await SeriesTestHelpers.FinalizeAsync(_pg, await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false));
        Assert.NotEqual(first, backOnOriginal);
        Assert.Equal(Fmt(originalPrefix, counterAfterFirst + 1), backOnOriginal);

        await using var read = _pg.CreateContext();
        var allocator = new InvoiceNumberAllocator(read);
        Assert.True(await allocator.IsConsumedAsync(first, null));
        Assert.True(await allocator.IsConsumedAsync(underNewPrefix, null));
    }

    [PostgresFact]
    public async Task DatabaseRejectsDuplicateReservations_EvenWithDifferentCase()
    {
        var draft = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: true);
        var number = await SeriesTestHelpers.FinalizeAsync(_pg, draft);

        await using var db = _pg.CreateContext();
        db.InvoiceNumberAllocations.Add(new InvoiceNumberAllocation
        {
            InvoiceId = draft, InvoiceNumber = number.ToLowerInvariant(), NormalizedNumber = number.ToUpperInvariant(),
            SeriesKind = InvoiceSeriesKind.Gst, AllocationType = InvoiceNumberAllocationType.Manual,
        });
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.UniqueViolation, Assert.IsType<PostgresException>(ex.InnerException).SqlState);
    }
}

/// <summary>
/// Migration AddInvoiceNumberSeriesAndAllocations against databases that already contain old-format data:
/// starting counters are calculated per series from IsGstEnabled, every existing number is reserved, and no
/// invoice row is modified. Also verifies rollback.
/// </summary>
public class InvoiceNumberMigrationTests
{
    private const string PreviousMigration = "20260929135000_AddOutsideJobIdToInvoiceItems";
    private const string SeriesMigration = "20261004051221_AddInvoiceNumberSeriesAndAllocations";

    private static async Task<(string connectionString, Func<Task> drop)> CreateEmptyDatabaseAsync()
    {
        var adminCs = PostgresTestEnvironment.AdminConnectionString!;
        var name = $"carspa_test_{Guid.NewGuid():N}";
        var admin = new NpgsqlConnectionStringBuilder(adminCs) { Database = "postgres", Pooling = false }.ConnectionString;
        await using (var conn = new NpgsqlConnection(admin))
        {
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", conn);
            await cmd.ExecuteNonQueryAsync();
        }
        var cs = new NpgsqlConnectionStringBuilder(adminCs) { Database = name }.ConnectionString;
        return (cs, async () =>
        {
            NpgsqlConnection.ClearAllPools();
            await using var conn = new NpgsqlConnection(admin);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", conn);
            await cmd.ExecuteNonQueryAsync();
        });
    }

    private static AppDbContext Context(string cs) => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql(cs)
        .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
        .Options);

    private sealed record LegacyInvoice(string? Number, bool Gst, InvoiceStatus Status, bool Deleted = false);

    /// <summary>Inserts old-format invoices with raw SQL against the pre-migration schema.</summary>
    private static async Task<List<Guid>> SeedLegacyAsync(string cs, IEnumerable<LegacyInvoice> invoices, (int index, string oldNumber)? renamed = null)
    {
        var ids = new List<Guid>();
        await using var conn = new NpgsqlConnection(cs);
        await conn.OpenAsync();
        var customerId = Guid.NewGuid();
        await Exec(conn, "INSERT INTO \"Customers\" (\"Id\",\"Name\",\"PhoneNumber\",\"CreatedAt\",\"IsDeleted\") VALUES (@id,'Legacy','9000000007',now(),false)", ("id", customerId));
        var i = 0;
        foreach (var inv in invoices)
        {
            var vehicleId = Guid.NewGuid();
            var jobCardId = Guid.NewGuid();
            var invoiceId = Guid.NewGuid();
            await Exec(conn, "INSERT INTO \"Vehicles\" (\"Id\",\"CustomerId\",\"RegistrationNumber\",\"Make\",\"Model\",\"CreatedAt\",\"IsDeleted\") VALUES (@id,@c,@r,'M','M',now(),false)",
                ("id", vehicleId), ("c", customerId), ("r", $"TN07LG{i:D4}"));
            await Exec(conn, "INSERT INTO \"JobCards\" (\"Id\",\"JobCardNumber\",\"CustomerId\",\"VehicleId\",\"Status\",\"Subtotal\",\"TaxAmount\",\"DiscountAmount\",\"TotalAmount\",\"CreatedAt\",\"IsDeleted\") VALUES (@id,@n,@c,@v,4,0,0,0,0,now(),false)",
                ("id", jobCardId), ("n", $"JC-LG-{i:D4}"), ("c", customerId), ("v", vehicleId));
            await Exec(conn, @"INSERT INTO ""Invoices"" (""Id"",""InvoiceNumber"",""JobCardId"",""CustomerId"",""VehicleId"",""InvoiceDate"",""Subtotal"",""Discount"",""TaxableAmount"",""GstAmount"",""TotalAmount"",""PaidAmount"",""BalanceAmount"",""Status"",""IsGstEnabled"",""CreatedAt"",""UpdatedAt"",""IsDeleted"")
                VALUES (@id,@num,@jc,@c,@v,'2026-09-01',1000,0,1000,180,1180,0,1180,@status,@gst,'2026-09-01T10:00:00Z','2026-09-02T10:00:00Z',@del)",
                ("id", invoiceId), ("num", (object?)inv.Number ?? DBNull.Value), ("jc", jobCardId), ("c", customerId), ("v", vehicleId),
                ("status", (int)inv.Status), ("gst", inv.Gst), ("del", inv.Deleted));
            ids.Add(invoiceId);
            i++;
        }

        if (renamed is { } r)
        {
            await Exec(conn, @"INSERT INTO ""AuditLogs"" (""Id"",""TimestampUtc"",""Action"",""Module"",""Description"",""EntityType"",""EntityId"",""OldValues"",""NewValues"",""Outcome"",""CreatedAt"",""IsDeleted"")
                VALUES (@id,'2026-09-03T10:00:00Z','INVOICE_NUMBER_CHANGED','Invoices','renamed','Invoice',@e,@old,@new,'Success',now(),false)",
                ("id", Guid.NewGuid()), ("e", ids[r.index]), ("old", $"{{\"invoiceNumber\":\"{r.oldNumber}\"}}"), ("new", "{\"invoiceNumber\":\"x\"}"));
        }
        return ids;
    }

    private static async Task Exec(NpgsqlConnection conn, string sql, params (string name, object value)[] args)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (name, value) in args) cmd.Parameters.AddWithValue(name, value);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task<List<(Guid id, string? number, bool gst, int status, decimal total, DateTime? updated, bool deleted)>> SnapshotInvoicesAsync(string cs)
    {
        await using var conn = new NpgsqlConnection(cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT \"Id\",\"InvoiceNumber\",\"IsGstEnabled\",\"Status\",\"TotalAmount\",\"UpdatedAt\",\"IsDeleted\" FROM \"Invoices\" ORDER BY \"Id\"", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        var rows = new List<(Guid, string?, bool, int, decimal, DateTime?, bool)>();
        while (await reader.ReadAsync())
            rows.Add((reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetString(1), reader.GetBoolean(2), reader.GetInt32(3),
                reader.GetDecimal(4), reader.IsDBNull(5) ? null : reader.GetDateTime(5), reader.GetBoolean(6)));
        return rows;
    }

    [PostgresFact]
    public async Task ExistingE6LikeData_CountersPerSeries_AllNumbersReserved_InvoicesUnchanged()
    {
        var (cs, drop) = await CreateEmptyDatabaseAsync();
        try
        {
            await using (var db = Context(cs))
                await db.GetService<IMigrator>().MigrateAsync(PreviousMigration);

            // Mirrors E6: one shared old series with GST and non-GST interleaved, plus edge cases.
            await SeedLegacyAsync(cs,
            [
                new("INV-2026-000001", Gst: true, InvoiceStatus.Paid),
                new("INV-2026-000002", Gst: false, InvoiceStatus.Paid),
                new("INV-2026-000003", Gst: false, InvoiceStatus.Paid),
                new("INV-2026-000004", Gst: true, InvoiceStatus.Cancelled),           // cancelled still consumes
                new("INV-2026-000005", Gst: true, InvoiceStatus.Generated),
                new("INV-2026-000009", Gst: false, InvoiceStatus.PartiallyPaid, Deleted: true), // soft-deleted still consumes
                new("E6/CUSTOM/7", Gst: true, InvoiceStatus.Paid),                    // renamed; old number in audit log
                new("OLD/77", Gst: false, InvoiceStatus.Paid),                        // non-standard format: reserved, no counter effect
                new(null, Gst: true, InvoiceStatus.Draft),                            // draft: nothing to reserve
            ], renamed: (6, "INV-2026-000008"));

            var before = await SnapshotInvoicesAsync(cs);

            await using (var db = Context(cs))
                await db.GetService<IMigrator>().MigrateAsync(SeriesMigration);

            Assert.Equal(before, await SnapshotInvoicesAsync(cs)); // no invoice row changed

            await using var read = Context(cs);
            var series = await read.InvoiceNumberSeries.AsNoTracking().ToDictionaryAsync(s => s.SeriesKind);
            // GST: old-format GST numbers 1, 4, 5 and renamed-away 8 → next 9. Non-GST: 2, 3, 9 → next 10.
            Assert.Equal(9, series[InvoiceSeriesKind.Gst].NextNumber);
            Assert.Equal(10, series[InvoiceSeriesKind.NonGst].NextNumber);
            Assert.Equal("GST/", series[InvoiceSeriesKind.Gst].Prefix);
            Assert.Equal("BILL/", series[InvoiceSeriesKind.NonGst].Prefix);
            Assert.All(series.Values, s => Assert.Equal(4, s.MinDigits));

            var ledger = await read.InvoiceNumberAllocations.AsNoTracking().ToListAsync();
            Assert.Equal(9, ledger.Count); // 8 current numbers + the renamed-away INV-2026-000008
            Assert.All(ledger, a => Assert.Equal(InvoiceNumberAllocationType.Legacy, a.AllocationType));
            Assert.Equal(InvoiceSeriesKind.Gst, ledger.Single(a => a.InvoiceNumber == "INV-2026-000008").SeriesKind);
            Assert.Equal(InvoiceSeriesKind.NonGst, ledger.Single(a => a.InvoiceNumber == "OLD/77").SeriesKind);
            Assert.Null(ledger.Single(a => a.InvoiceNumber == "OLD/77").CounterValue);
            Assert.Equal(4, ledger.Single(a => a.InvoiceNumber == "INV-2026-000004").CounterValue);

            var allocator = new InvoiceNumberAllocator(read);
            foreach (var number in new[] { "INV-2026-000004", "INV-2026-000008", "inv-2026-000009", "E6/CUSTOM/7", "OLD/77" })
                Assert.True(await allocator.IsConsumedAsync(number, null), number);
        }
        finally { await drop(); }
    }

    [PostgresFact]
    public async Task OnlyGstOrOnlyNonGstHistory_TheOtherSeriesStartsAt1()
    {
        var (cs, drop) = await CreateEmptyDatabaseAsync();
        try
        {
            await using (var db = Context(cs))
                await db.GetService<IMigrator>().MigrateAsync(PreviousMigration);
            await SeedLegacyAsync(cs, [new("INV-2025-000041", Gst: true, InvoiceStatus.Paid), new("INV-2026-000042", Gst: true, InvoiceStatus.Paid)]);

            await using (var db = Context(cs))
                await db.GetService<IMigrator>().MigrateAsync(SeriesMigration);

            await using var read = Context(cs);
            var series = await read.InvoiceNumberSeries.AsNoTracking().ToDictionaryAsync(s => s.SeriesKind);
            Assert.Equal(43, series[InvoiceSeriesKind.Gst].NextNumber); // across years: highest numeric part + 1
            Assert.Equal(1, series[InvoiceSeriesKind.NonGst].NextNumber);
        }
        finally { await drop(); }
    }

    [PostgresFact]
    public async Task Rollback_RemovesOnlyTheNewTables_AndKeepsInvoices()
    {
        var (cs, drop) = await CreateEmptyDatabaseAsync();
        try
        {
            await using (var db = Context(cs))
                await db.GetService<IMigrator>().MigrateAsync(PreviousMigration);
            await SeedLegacyAsync(cs, [new("INV-2026-000001", Gst: true, InvoiceStatus.Paid)]);
            var before = await SnapshotInvoicesAsync(cs);

            await using (var db = Context(cs))
            {
                await db.GetService<IMigrator>().MigrateAsync(SeriesMigration);
                await db.GetService<IMigrator>().MigrateAsync(PreviousMigration); // roll back
            }

            Assert.Equal(before, await SnapshotInvoicesAsync(cs));
            await using var conn = new NpgsqlConnection(cs);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(
                "SELECT to_regclass('\"InvoiceNumberSeries\"') IS NULL AND to_regclass('\"InvoiceNumberAllocations\"') IS NULL AND to_regclass('invoice_number_seq') IS NOT NULL", conn);
            Assert.True((bool)(await cmd.ExecuteScalarAsync())!);
        }
        finally { await drop(); }
    }
}
