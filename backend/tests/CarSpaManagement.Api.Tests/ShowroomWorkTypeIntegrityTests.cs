using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Showroom vehicle/work type integrity: unique names, the "Other" flag, and the Other description
/// staying on the Other item only.
/// </summary>
public class ShowroomWorkTypeIntegrityTests
{
    private sealed class NoAudit : IAuditLogService
    {
        public Task RecordAsync(string action, string module, string description, Guid? userId = null, string? userName = null,
            string? userRole = null, string? entityType = null, Guid? entityId = null, string? entityReference = null,
            string? oldValues = null, string? newValues = null, string? metadata = null, string outcome = "Success",
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            Task.FromResult(new PagedResult<AuditLogDto> { Items = new List<AuditLogDto>(), Page = query.Page, PageSize = query.PageSize });
    }

    private sealed record Env(AppDbContext Db, ShowroomOperationsService Service, Showroom Showroom, Staff Staff,
        ShowroomVehicleType Sedan, ShowroomWorkType BodyWash, ShowroomWorkType Other, DateTime Date);

    private static async Task<Env> CreateAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var showroom = new Showroom { Id = Guid.NewGuid(), MasterId = "SR1", Name = "Main", Address = "A", Phone = "9876543210", IsActive = true };
        var staff = new Staff { Id = Guid.NewGuid(), StaffMasterId = "ST1", Name = "Ravi", PhoneNumber = "9876543211", IsActive = true };
        var sedan = new ShowroomVehicleType { Id = Guid.NewGuid(), Code = "SEDAN", Name = "Sedan", IsActive = true };
        var bodyWash = new ShowroomWorkType { Id = Guid.NewGuid(), Code = "BODY_WASH", Name = "Body Wash", IsActive = true };
        var other = new ShowroomWorkType { Id = Guid.NewGuid(), Code = "OTHER", Name = "Other", IsActive = true, IsOther = true };
        var date = DateTime.UtcNow.Date;
        db.AddRange(showroom, staff, sedan, bodyWash, other);
        db.ShowroomStaffAssignments.Add(new ShowroomStaffAssignment { Id = Guid.NewGuid(), ShowroomId = showroom.Id, StaffId = staff.Id, Date = date });
        await db.SaveChangesAsync();
        return new Env(db, new ShowroomOperationsService(db, new NoAudit()), showroom, staff, sedan, bodyWash, other, date);
    }

    private static CreateBatchShowroomVehicleWorkRequest Batch(Env env, IndividualVehicleWorkEntry vehicle) => new()
    {
        StaffId = env.Staff.Id,
        Date = env.Date,
        Vehicles = new List<IndividualVehicleWorkEntry> { vehicle },
    };

    // ── "Other" description stays on the Other item ─────────────────────────

    [Fact]
    public async Task Batch_OtherDescription_IsStoredOnlyOnTheOtherItem()
    {
        var env = await CreateAsync();

        // What the desktop app sends: the per-type note plus the same text as OtherDescription.
        var created = await env.Service.CreateBatchVehicleWorkAsync(env.Showroom.Id, Batch(env, new IndividualVehicleWorkEntry
        {
            VehicleTypeId = env.Sedan.Id,
            WorkTypeIds = new List<Guid> { env.BodyWash.Id, env.Other.Id },
            WorkTypeNotes = new Dictionary<Guid, string> { [env.Other.Id] = "Headlight polish" },
            OtherDescription = "Headlight polish",
        }));

        var items = created.Single().ServiceItems;
        Assert.Null(items.Single(i => i.WorkTypeId == env.BodyWash.Id).Notes);
        Assert.Equal("Headlight polish", items.Single(i => i.WorkTypeId == env.Other.Id).Notes);
    }

    [Fact]
    public async Task Batch_OtherDescriptionAlone_IsNotCopiedOntoOtherWorkTypes()
    {
        var env = await CreateAsync();

        // What the Android app sends: OtherDescription only.
        var created = await env.Service.CreateBatchVehicleWorkAsync(env.Showroom.Id, Batch(env, new IndividualVehicleWorkEntry
        {
            VehicleTypeId = env.Sedan.Id,
            WorkTypeIds = new List<Guid> { env.BodyWash.Id, env.Other.Id },
            OtherDescription = "Headlight polish",
        }));

        var items = created.Single().ServiceItems;
        Assert.Null(items.Single(i => i.WorkTypeId == env.BodyWash.Id).Notes);
        Assert.Equal("Headlight polish", items.Single(i => i.WorkTypeId == env.Other.Id).Notes);
    }

    [Fact]
    public async Task Batch_NoteForAnOrdinaryWorkType_IsKept()
    {
        var env = await CreateAsync();
        var created = await env.Service.CreateBatchVehicleWorkAsync(env.Showroom.Id, Batch(env, new IndividualVehicleWorkEntry
        {
            VehicleTypeId = env.Sedan.Id,
            WorkTypeIds = new List<Guid> { env.BodyWash.Id },
            WorkTypeNotes = new Dictionary<Guid, string> { [env.BodyWash.Id] = "Roof only" },
        }));
        Assert.Equal("Roof only", created.Single().ServiceItems.Single().Notes);
    }

    // ── "Other" is identified by its flag, not its name ─────────────────────

    [Fact]
    public async Task RenamedOtherWorkType_StillRequiresADescription()
    {
        var env = await CreateAsync();
        env.Other.Name = "Miscellaneous";
        env.Other.Code = "MISC";
        await env.Db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ValidationException>(() => env.Service.CreateBatchVehicleWorkAsync(env.Showroom.Id,
            Batch(env, new IndividualVehicleWorkEntry { VehicleTypeId = env.Sedan.Id, WorkTypeIds = new List<Guid> { env.Other.Id } })));
        Assert.Contains("Description of work performed is required", ex.Message);
    }

    [Fact]
    public async Task OrdinaryWorkTypeNamedLikeOther_DoesNotRequireADescription()
    {
        var env = await CreateAsync();
        var lookalike = new ShowroomWorkType { Id = Guid.NewGuid(), Code = "OTHER_POLISH", Name = "Other Polish", IsActive = true };
        env.Db.ShowroomWorkTypes.Add(lookalike);
        await env.Db.SaveChangesAsync();

        var created = await env.Service.CreateBatchVehicleWorkAsync(env.Showroom.Id,
            Batch(env, new IndividualVehicleWorkEntry { VehicleTypeId = env.Sedan.Id, WorkTypeIds = new List<Guid> { lookalike.Id } }));
        Assert.Null(created.Single().ServiceItems.Single().Notes);
    }

    [Fact]
    public async Task WorkTypeDto_ExposesIsOther()
    {
        var env = await CreateAsync();
        var types = await env.Service.GetWorkTypesAsync();
        Assert.True(types.Single(t => t.Id == env.Other.Id).IsOther);
        Assert.False(types.Single(t => t.Id == env.BodyWash.Id).IsOther);
    }

    [Fact]
    public async Task EditingAnOlderOtherItemWithoutDescription_IsAllowed_ButNewlyAddingOtherNeedsOne()
    {
        var env = await CreateAsync();
        var work = new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(), ShowroomId = env.Showroom.Id, StaffId = env.Staff.Id, VehicleTypeId = env.Sedan.Id, Date = env.Date,
        };
        work.ServiceItems.Add(new ShowroomVehicleWorkItem { Id = Guid.NewGuid(), ShowroomVehicleWorkId = work.Id, WorkTypeId = env.Other.Id });
        env.Db.ShowroomVehicleWorks.Add(work);
        await env.Db.SaveChangesAsync();

        // A record saved before the description rule existed can still be edited.
        var updated = await env.Service.UpdateVehicleWorkAsync(env.Showroom.Id, work.Id, new UpdateShowroomVehicleWorkRequest
        {
            Notes = "Corrected note",
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest> { new() { WorkTypeId = env.Other.Id } },
        });
        Assert.Equal("Corrected note", updated!.Notes);

        // Adding Other to a record that did not have it requires a description.
        var plain = new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(), ShowroomId = env.Showroom.Id, StaffId = env.Staff.Id, VehicleTypeId = env.Sedan.Id, Date = env.Date,
        };
        plain.ServiceItems.Add(new ShowroomVehicleWorkItem { Id = Guid.NewGuid(), ShowroomVehicleWorkId = plain.Id, WorkTypeId = env.BodyWash.Id });
        env.Db.ShowroomVehicleWorks.Add(plain);
        await env.Db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => env.Service.UpdateVehicleWorkAsync(env.Showroom.Id, plain.Id, new UpdateShowroomVehicleWorkRequest
        {
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest> { new() { WorkTypeId = env.BodyWash.Id }, new() { WorkTypeId = env.Other.Id } },
        }));
    }

    // ── Unique names ────────────────────────────────────────────────────────

    [Theory]
    [InlineData("Sedan")]
    [InlineData("  sedan ")]
    [InlineData("SEDAN")]
    public async Task VehicleType_DuplicateName_IsRejected(string name)
    {
        var env = await CreateAsync();
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            env.Service.CreateVehicleTypeAsync(new CreateShowroomVehicleTypeRequest { Name = name, Code = "SEDAN_2" }));
        Assert.Contains("already exists", ex.Message);
    }

    [Fact]
    public async Task VehicleType_RenameToExistingName_IsRejected_ButOwnNameCaseChangeIsAllowed()
    {
        var env = await CreateAsync();
        var suv = await env.Service.CreateVehicleTypeAsync(new CreateShowroomVehicleTypeRequest { Name = "SUV" });

        await Assert.ThrowsAsync<ConflictException>(() =>
            env.Service.UpdateVehicleTypeAsync(suv.Id, new UpdateShowroomVehicleTypeRequest { Name = "sedan" }));

        var renamed = await env.Service.UpdateVehicleTypeAsync(env.Sedan.Id, new UpdateShowroomVehicleTypeRequest { Name = "SEDAN" });
        Assert.Equal("SEDAN", renamed!.Name);
    }

    [Fact]
    public async Task VehicleType_NameOfADeactivatedType_IsStillTaken()
    {
        var env = await CreateAsync();
        await env.Service.ToggleVehicleTypeActiveAsync(env.Sedan.Id);
        await Assert.ThrowsAsync<ConflictException>(() =>
            env.Service.CreateVehicleTypeAsync(new CreateShowroomVehicleTypeRequest { Name = "Sedan" }));
    }

    [Fact]
    public async Task WorkType_DuplicateName_IsRejected_OnCreateAndRename()
    {
        var env = await CreateAsync();
        await Assert.ThrowsAsync<ConflictException>(() =>
            env.Service.CreateWorkTypeAsync(new CreateShowroomWorkTypeRequest { Name = "body wash" }));

        var wax = await env.Service.CreateWorkTypeAsync(new CreateShowroomWorkTypeRequest { Name = "Waxing" });
        await Assert.ThrowsAsync<ConflictException>(() =>
            env.Service.UpdateWorkTypeAsync(wax.Id, new UpdateShowroomWorkTypeRequest { Name = "BODY WASH" }));
    }

    [Fact]
    public async Task WorkType_CreatedThroughTheApi_IsNeverTheOtherType()
    {
        var env = await CreateAsync();
        var created = await env.Service.CreateWorkTypeAsync(new CreateShowroomWorkTypeRequest { Name = "Misc Work", Code = "OTHER_2" });
        Assert.False(created.IsOther);
    }
}

/// <summary>Migration AddShowroomTypeNameUniqueAndIsOther on real PostgreSQL.</summary>
public class ShowroomTypeIntegrityMigrationTests
{
    private const string PreviousMigration = "20261004071148_AddInvoiceItemTaxRatePercent";
    private const string IntegrityMigration = "20261004170844_AddShowroomTypeNameUniqueAndIsOther";

    private static AppDbContext Context(string cs) => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql(cs)
        .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
        .Options);

    private static async Task<(string cs, Func<Task> drop)> CreateEmptyDatabaseAsync()
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
        return (new NpgsqlConnectionStringBuilder(adminCs) { Database = name }.ConnectionString, async () =>
        {
            NpgsqlConnection.ClearAllPools();
            await using var conn = new NpgsqlConnection(admin);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", conn);
            await cmd.ExecuteNonQueryAsync();
        });
    }

    private static async Task ExecAsync(string cs, string sql)
    {
        await using var conn = new NpgsqlConnection(cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    [PostgresFact]
    public async Task Migration_FlagsOther_RenamesExistingDuplicates_AndEnforcesUniqueNames()
    {
        var (cs, drop) = await CreateEmptyDatabaseAsync();
        try
        {
            await using (var db = Context(cs))
                await db.GetService<IMigrator>().MigrateAsync(PreviousMigration);

            var keptId = Guid.NewGuid();
            var duplicateId = Guid.NewGuid();
            await ExecAsync(cs, $"""
                INSERT INTO "ShowroomVehicleTypes" ("Id","Code","Name","DisplayOrder","IsActive","CreatedAt","IsDeleted") VALUES
                  ('{keptId}','SEDAN','Sedan',1,true,'2026-01-01',false),
                  ('{duplicateId}','SEDAN_OLD','sedan ',2,false,'2026-02-01',false),
                  ('{Guid.NewGuid()}','SEDAN_DEL','SEDAN',3,true,'2026-03-01',true);
                INSERT INTO "ShowroomWorkTypes" ("Id","Code","Name","DisplayOrder","IsActive","CreatedAt","IsDeleted") VALUES
                  ('{Guid.NewGuid()}','OTHER','Other',7,true,'2026-01-01',false),
                  ('{Guid.NewGuid()}','BODY_WASH','Body Wash',1,true,'2026-01-01',false);
                """);

            await using (var db = Context(cs))
            {
                await db.GetService<IMigrator>().MigrateAsync(IntegrityMigration);
                // Carry on to the latest version so the current model (which knows each row's company) can read the data.
                await db.Database.MigrateAsync();
            }

            await using (var read = Context(cs))
            {
                var vehicleTypes = await read.ShowroomVehicleTypes.IgnoreQueryFilters().AsNoTracking().ToDictionaryAsync(v => v.Id);
                Assert.Equal("Sedan", vehicleTypes[keptId].Name);                     // oldest keeps its name
                Assert.Equal("sedan (duplicate 2)", vehicleTypes[duplicateId].Name);   // same row id, suffixed name
                Assert.Equal(3, vehicleTypes.Count);                                   // nothing deleted

                var workTypes = await read.ShowroomWorkTypes.AsNoTracking().ToListAsync();
                Assert.True(workTypes.Single(w => w.Code == "OTHER").IsOther);
                Assert.False(workTypes.Single(w => w.Code == "BODY_WASH").IsOther);
            }

            // The database itself rejects a case-insensitive duplicate among non-deleted rows...
            var ex = await Assert.ThrowsAsync<PostgresException>(() => ExecAsync(cs, $"""
                INSERT INTO "ShowroomWorkTypes" ("Id","Code","Name","DisplayOrder","IsActive","CreatedAt","IsDeleted","OrganizationId")
                VALUES ('{Guid.NewGuid()}','BW2',' BODY WASH',9,true,now(),false,'{DefaultOrganization.Id}');
                """));
            Assert.Equal(PostgresErrorCodes.UniqueViolation, ex.SqlState);

            // ...but a soft-deleted row does not block the name.
            await ExecAsync(cs, $"""
                INSERT INTO "ShowroomWorkTypes" ("Id","Code","Name","DisplayOrder","IsActive","CreatedAt","IsDeleted","OrganizationId")
                VALUES ('{Guid.NewGuid()}','BW3','Body Wash',9,true,now(),true,'{DefaultOrganization.Id}');
                """);

            await using (var db = Context(cs))
                await db.GetService<IMigrator>().MigrateAsync(PreviousMigration);   // rollback works
        }
        finally
        {
            await drop();
        }
    }
}
