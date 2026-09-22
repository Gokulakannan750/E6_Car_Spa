using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Claims;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class StaffAadhaarValidationAndSecurityTests
{
    private class CapturingAuditLogService : IAuditLogService
    {
        public List<CapturedAuditLog> RecordedLogs { get; } = new();

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
            RecordedLogs.Add(new CapturedAuditLog
            {
                Action = action,
                Module = module,
                Description = description,
                UserId = userId,
                UserName = userName,
                UserRole = userRole,
                EntityType = entityType,
                EntityId = entityId,
                EntityReference = entityReference,
                OldValues = oldValues,
                NewValues = newValues,
                Metadata = metadata,
                Outcome = outcome
            });
            return Task.CompletedTask;
        }

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(
            AuditLogQueryParameters query,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new PagedResult<AuditLogDto>
            {
                Items = new List<AuditLogDto>(),
                TotalCount = 0,
                Page = query.Page,
                PageSize = query.PageSize
            });
        }
    }

    public class CapturedAuditLog
    {
        public string Action { get; set; } = "";
        public string Module { get; set; } = "";
        public string Description { get; set; } = "";
        public Guid? UserId { get; set; }
        public string? UserName { get; set; }
        public string? UserRole { get; set; }
        public string? EntityType { get; set; }
        public Guid? EntityId { get; set; }
        public string? EntityReference { get; set; }
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public string? Metadata { get; set; }
        public string Outcome { get; set; } = "";
    }

    private static (AppDbContext db, IStaffAdvanceService service, CapturingAuditLogService auditLog, IAesEncryptionService encryptionService) CreateTestContext()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        var inMemorySettings = new Dictionary<string, string?>
        {
            { "Security:EncryptionKey", Convert.ToBase64String(Encoding.UTF8.GetBytes("12345678901234567890123456789012")) }
        };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        services.AddSingleton<IConfiguration>(configuration);
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        var auditLog = new CapturingAuditLogService();
        services.AddSingleton<IAuditLogService>(auditLog);
        services.AddSingleton<IAesEncryptionService, AesEncryptionService>();
        services.AddSingleton(typeof(ILogger<>), typeof(NullLogger<>));
        services.AddScoped<IStaffAdvanceService, StaffAdvanceService>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var service = provider.GetRequiredService<IStaffAdvanceService>();
        var encryptionService = provider.GetRequiredService<IAesEncryptionService>();

        return (db, service, auditLog, encryptionService);
    }

    private static IFormFile CreateMockFormFile(string fileName, string contentType, byte[] content)
    {
        var stream = new MemoryStream(content);
        return new FormFile(stream, 0, content.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    [Fact]
    public async Task Test01_MissingAadhaar_OnNewStaff_IsRejected()
    {
        var (db, service, _, _) = CreateTestContext();
        var req = new CreateStaffRequest { Name = "Ramesh", PhoneNumber = "9876543210", AadhaarNumber = "" };

        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.CreateStaffMemberAsync(req));
        Assert.Contains("Aadhaar", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Test02_AadhaarWith11Digits_IsRejected()
    {
        var (db, service, _, _) = CreateTestContext();
        var req = new CreateStaffRequest { Name = "Ramesh", PhoneNumber = "9876543210", AadhaarNumber = "12345678901" };

        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.CreateStaffMemberAsync(req));
        Assert.Contains("12", ex.Message);
    }

    [Fact]
    public async Task Test03_AadhaarWith13Digits_IsRejected()
    {
        var (db, service, _, _) = CreateTestContext();
        var req = new CreateStaffRequest { Name = "Ramesh", PhoneNumber = "9876543210", AadhaarNumber = "1234567890123" };

        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.CreateStaffMemberAsync(req));
        Assert.Contains("12", ex.Message);
    }

    [Fact]
    public async Task Test04_AadhaarWithLetters_IsRejected()
    {
        var (db, service, _, _) = CreateTestContext();
        var req = new CreateStaffRequest { Name = "Ramesh", PhoneNumber = "9876543210", AadhaarNumber = "12345678901A" };

        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.CreateStaffMemberAsync(req));
        Assert.Contains("12", ex.Message);
    }

    [Fact]
    public async Task Test05_AadhaarWithSpaces_IsNormalizedAndAccepted()
    {
        var (db, service, _, encryptionService) = CreateTestContext();
        var req = new CreateStaffRequest { Name = "Ramesh", PhoneNumber = "9876543210", AadhaarNumber = "1234 5678 9012" };

        var staff = await service.CreateStaffMemberAsync(req);
        Assert.NotNull(staff);
        Assert.Equal("XXXX XXXX 9012", staff.AadhaarMasked);

        var entity = await db.Staff.FindAsync(staff.Id);
        Assert.NotNull(entity?.AadhaarNumberEncrypted);
        Assert.Equal("123456789012", encryptionService.Decrypt(entity!.AadhaarNumberEncrypted!));
    }

    [Fact]
    public async Task Test06_AadhaarWithHyphens_IsNormalizedAndAccepted()
    {
        var (db, service, _, encryptionService) = CreateTestContext();
        var req = new CreateStaffRequest { Name = "Ramesh", PhoneNumber = "9876543210", AadhaarNumber = "1234-5678-9012" };

        var staff = await service.CreateStaffMemberAsync(req);
        Assert.NotNull(staff);
        Assert.Equal("XXXX XXXX 9012", staff.AadhaarMasked);

        var entity = await db.Staff.FindAsync(staff.Id);
        Assert.NotNull(entity?.AadhaarNumberEncrypted);
        Assert.Equal("123456789012", encryptionService.Decrypt(entity!.AadhaarNumberEncrypted!));
    }

    [Fact]
    public async Task Test07_Valid12DigitAadhaar_IsAcceptedAndEncryptedAtRest()
    {
        var (db, service, _, encryptionService) = CreateTestContext();
        var req = new CreateStaffRequest { Name = "Suresh", PhoneNumber = "9876543211", AadhaarNumber = "987654321098" };

        var staff = await service.CreateStaffMemberAsync(req);
        Assert.NotNull(staff);
        Assert.Equal("XXXX XXXX 1098", staff.AadhaarMasked);

        var entity = await db.Staff.FindAsync(staff.Id);
        Assert.NotNull(entity?.AadhaarNumberEncrypted);
        Assert.DoesNotContain("987654321098", entity!.AadhaarNumberEncrypted!); // Not plaintext in DB
        Assert.Equal("987654321098", encryptionService.Decrypt(entity.AadhaarNumberEncrypted!));
    }

    [Fact]
    public async Task Test08_ValidAadhaar_WithoutDocument_CreationSucceeds()
    {
        var (db, service, _, _) = CreateTestContext();
        var req = new CreateStaffRequest { Name = "Vikas", PhoneNumber = "9876543212", AadhaarNumber = "555566667777" };

        var staff = await service.CreateStaffMemberAsync(req);
        Assert.False(staff.HasAadhaarDocument);
        Assert.Null(staff.AadhaarDocumentFileName);
    }

    [Fact]
    public async Task Test09_ValidAadhaar_WithPdfDocument_Succeeds()
    {
        var (db, service, _, _) = CreateTestContext();
        var pdfBytes = Encoding.ASCII.GetBytes("%PDF-1.4 Mock PDF Content");
        var file = CreateMockFormFile("aadhaar.pdf", "application/pdf", pdfBytes);

        var req = new CreateStaffRequest { Name = "Praveen", PhoneNumber = "9876543213", AadhaarNumber = "111122223333", AadhaarFile = file };
        var staff = await service.CreateStaffMemberAsync(req);

        Assert.True(staff.HasAadhaarDocument);
        Assert.Equal("aadhaar.pdf", staff.AadhaarDocumentFileName);
        Assert.Equal("application/pdf", staff.AadhaarDocumentContentType);
    }

    [Fact]
    public async Task Test10_ValidAadhaar_WithJpgDocument_Succeeds()
    {
        var (db, service, _, _) = CreateTestContext();
        var jpgBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46 };
        var file = CreateMockFormFile("aadhaar.jpg", "image/jpeg", jpgBytes);

        var req = new CreateStaffRequest { Name = "Dinesh", PhoneNumber = "9876543214", AadhaarNumber = "222233334444", AadhaarFile = file };
        var staff = await service.CreateStaffMemberAsync(req);

        Assert.True(staff.HasAadhaarDocument);
        Assert.Equal("aadhaar.jpg", staff.AadhaarDocumentFileName);
    }

    [Fact]
    public async Task Test11_ValidAadhaar_WithPngDocument_Succeeds()
    {
        var (db, service, _, _) = CreateTestContext();
        var pngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00 };
        var file = CreateMockFormFile("aadhaar.png", "image/png", pngBytes);

        var req = new CreateStaffRequest { Name = "Manoj", PhoneNumber = "9876543215", AadhaarNumber = "333344445555", AadhaarFile = file };
        var staff = await service.CreateStaffMemberAsync(req);

        Assert.True(staff.HasAadhaarDocument);
        Assert.Equal("aadhaar.png", staff.AadhaarDocumentFileName);
    }

    [Fact]
    public async Task Test12_UnsupportedExtension_IsRejected()
    {
        var (db, service, _, _) = CreateTestContext();
        var exeBytes = Encoding.ASCII.GetBytes("MZ executable header content");
        var file = CreateMockFormFile("aadhaar.exe", "application/x-msdownload", exeBytes);

        var req = new CreateStaffRequest { Name = "Hacker", PhoneNumber = "9876543216", AadhaarNumber = "444455556666", AadhaarFile = file };
        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.CreateStaffMemberAsync(req));

        Assert.Contains("Unsupported", ex.Message);
    }

    [Fact]
    public async Task Test13_InvalidFileSignature_IsRejected()
    {
        var (db, service, _, _) = CreateTestContext();
        // Claims to be PDF by filename but has invalid magic bytes
        var badBytes = Encoding.ASCII.GetBytes("This is not a real PDF");
        var file = CreateMockFormFile("fake.pdf", "application/pdf", badBytes);

        var req = new CreateStaffRequest { Name = "Sneaky", PhoneNumber = "9876543217", AadhaarNumber = "555566667777", AadhaarFile = file };
        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.CreateStaffMemberAsync(req));

        Assert.Contains("signature", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Test14_FileOver5Mb_IsRejected()
    {
        var (db, service, _, _) = CreateTestContext();
        var largeBytes = new byte[6 * 1024 * 1024]; // 6 MB
        // Set valid PDF header
        var pdfHeader = Encoding.ASCII.GetBytes("%PDF-1.4");
        Array.Copy(pdfHeader, largeBytes, pdfHeader.Length);

        var file = CreateMockFormFile("huge.pdf", "application/pdf", largeBytes);

        var req = new CreateStaffRequest { Name = "BigFile", PhoneNumber = "9876543218", AadhaarNumber = "666677778888", AadhaarFile = file };
        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.CreateStaffMemberAsync(req));

        Assert.Contains("5 MB", ex.Message);
    }

    [Fact]
    public async Task Test15_StaffList_DoesNotContainFullAadhaar()
    {
        var (db, service, _, _) = CreateTestContext();
        await service.CreateStaffMemberAsync(new CreateStaffRequest { Name = "User1", PhoneNumber = "9876543219", AadhaarNumber = "123456789012" });

        var list = await service.GetStaffAsync();
        var staff = Assert.Single(list);

        Assert.Equal("XXXX XXXX 9012", staff.AadhaarMasked);
    }

    [Fact]
    public async Task Test16_StaffDetails_DoesNotContainFullAadhaar()
    {
        var (db, service, _, _) = CreateTestContext();
        var created = await service.CreateStaffMemberAsync(new CreateStaffRequest { Name = "User2", PhoneNumber = "9876543220", AadhaarNumber = "999988887777" });

        var staff = await service.GetStaffByIdAsync(created.Id);
        Assert.NotNull(staff);
        Assert.Equal("XXXX XXXX 7777", staff.AadhaarMasked);
    }

    [Fact]
    public async Task Test17_StaffDetails_ReturnsMaskedAadhaar()
    {
        var (db, service, _, _) = CreateTestContext();
        var created = await service.CreateStaffMemberAsync(new CreateStaffRequest { Name = "User3", PhoneNumber = "9876543221", AadhaarNumber = "112233445566" });

        var staff = await service.GetStaffByIdAsync(created.Id);
        Assert.NotNull(staff);
        Assert.Equal("XXXX XXXX 5566", staff.AadhaarMasked);
    }

    [Fact]
    public void Test18_UnauthorizedUser_CannotRevealAadhaar_RequiresSensitivePermission()
    {
        var method = typeof(StaffAdvancesController).GetMethod(nameof(StaffAdvancesController.RevealStaffAadhaar));
        Assert.NotNull(method);
        var attr = (RequirePermissionAttribute?)Attribute.GetCustomAttribute(method, typeof(RequirePermissionAttribute));
        Assert.NotNull(attr);
        Assert.Equal("Permission:staff.view_sensitive", attr.Policy);
    }

    [Fact]
    public async Task Test19_AuthorizedSensitiveUser_CanRevealAadhaar()
    {
        var (db, service, _, _) = CreateTestContext();
        var created = await service.CreateStaffMemberAsync(new CreateStaffRequest { Name = "User5", PhoneNumber = "9876543223", AadhaarNumber = "987612345678" });

        var controller = new StaffAdvancesController(service);
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim("permissions", "staff.view_sensitive")
        }, "TestAuth"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        var result = await controller.RevealStaffAadhaar(created.Id, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<StaffAadhaarRevealDto>(okResult.Value);

        Assert.Equal("987612345678", dto.AadhaarNumber);
        Assert.Equal(created.Id, dto.StaffId);
    }

    [Fact]
    public async Task Test20_AadhaarNeverAppearsInLogs()
    {
        var (db, service, auditLog, _) = CreateTestContext();
        var aadhaar = "888877776666";
        await service.CreateStaffMemberAsync(new CreateStaffRequest { Name = "User6", PhoneNumber = "9876543224", AadhaarNumber = aadhaar });

        foreach (var log in auditLog.RecordedLogs)
        {
            Assert.DoesNotContain(aadhaar, log.Description);
            Assert.DoesNotContain(aadhaar, log.NewValues ?? "");
            Assert.DoesNotContain(aadhaar, log.OldValues ?? "");
            Assert.DoesNotContain(aadhaar, log.Metadata ?? "");
        }
    }

    [Fact]
    public async Task Test21_AadhaarNeverAppearsInAuditEventData()
    {
        var (db, service, auditLog, _) = CreateTestContext();
        var staff = await service.CreateStaffMemberAsync(new CreateStaffRequest { Name = "User7", PhoneNumber = "9876543225", AadhaarNumber = "777788889999" });

        var userId = Guid.NewGuid();
        await service.RevealStaffAadhaarAsync(staff.Id, userId);

        var revealAudit = auditLog.RecordedLogs.Find(l => l.Action == "staff.aadhaar_viewed");
        Assert.NotNull(revealAudit);
        Assert.DoesNotContain("777788889999", revealAudit.Description);
        Assert.DoesNotContain("777788889999", revealAudit.Metadata ?? "");
    }

    [Fact]
    public async Task Test22_ExistingStaff_WithNullAadhaar_StillLoadsCorrectly()
    {
        var (db, service, _, _) = CreateTestContext();
        var existingStaff = new Staff
        {
            Id = Guid.NewGuid(),
            Name = "Old Staff",
            PhoneNumber = "9876543226",
            AadhaarNumberEncrypted = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Staff.Add(existingStaff);
        await db.SaveChangesAsync();

        var list = await service.GetStaffAsync();
        var found = Assert.Single(list, s => s.Id == existingStaff.Id);

        Assert.Null(found.AadhaarMasked);
        Assert.False(found.HasAadhaarDocument);
    }

    [Fact]
    public async Task Test23_ExistingStaff_CanLaterAddAadhaar()
    {
        var (db, service, _, encryptionService) = CreateTestContext();
        var existingStaff = new Staff
        {
            Id = Guid.NewGuid(),
            Name = "Old Staff 2",
            PhoneNumber = "9876543227",
            AadhaarNumberEncrypted = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Staff.Add(existingStaff);
        await db.SaveChangesAsync();

        var updateReq = new UpdateStaffRequest { AadhaarNumber = "1234 4321 5678" };
        var updated = await service.UpdateStaffMemberAsync(existingStaff.Id, updateReq);

        Assert.Equal("XXXX XXXX 5678", updated.AadhaarMasked);

        var entity = await db.Staff.FindAsync(existingStaff.Id);
        Assert.NotNull(entity?.AadhaarNumberEncrypted);
        Assert.Equal("123443215678", encryptionService.Decrypt(entity!.AadhaarNumberEncrypted!));
    }

    [Fact]
    public async Task Test24_DocumentDeletion_RemovesPhysicalFileAndDatabaseReference()
    {
        var (db, service, _, _) = CreateTestContext();
        var pdfBytes = Encoding.ASCII.GetBytes("%PDF-1.4 Test PDF for Deletion");
        var file = CreateMockFormFile("delete_me.pdf", "application/pdf", pdfBytes);

        var staff = await service.CreateStaffMemberAsync(new CreateStaffRequest { Name = "User8", PhoneNumber = "9876543228", AadhaarNumber = "121212121212", AadhaarFile = file });

        var entity = await db.Staff.FindAsync(staff.Id);
        Assert.NotNull(entity?.AadhaarDocumentPath);
        Assert.True(File.Exists(entity!.AadhaarDocumentPath));

        var updated = await service.DeleteStaffAadhaarDocumentAsync(staff.Id, Guid.NewGuid());
        Assert.False(updated.HasAadhaarDocument);
        Assert.Null(updated.AadhaarDocumentFileName);

        var reloaded = await db.Staff.FindAsync(staff.Id);
        Assert.Null(reloaded?.AadhaarDocumentPath);
        Assert.False(File.Exists(entity.AadhaarDocumentPath)); // Physically deleted
    }

    [Fact]
    public async Task Test25_DocumentReplacement_RemovesAndReplacesOldFileCorrectly()
    {
        var (db, service, _, _) = CreateTestContext();
        var pdfBytes = Encoding.ASCII.GetBytes("%PDF-1.4 Original File");
        var file1 = CreateMockFormFile("original.pdf", "application/pdf", pdfBytes);

        var staff = await service.CreateStaffMemberAsync(new CreateStaffRequest { Name = "User9", PhoneNumber = "9876543229", AadhaarNumber = "343434343434", AadhaarFile = file1 });

        var entity1 = await db.Staff.FindAsync(staff.Id);
        var oldFilePath = entity1!.AadhaarDocumentPath!;
        Assert.True(File.Exists(oldFilePath));

        var pngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01 };
        var file2 = CreateMockFormFile("new_copy.png", "image/png", pngBytes);

        var updated = await service.UploadStaffAadhaarDocumentAsync(staff.Id, file2, Guid.NewGuid());
        Assert.True(updated.HasAadhaarDocument);
        Assert.Equal("new_copy.png", updated.AadhaarDocumentFileName);

        var entity2 = await db.Staff.FindAsync(staff.Id);
        Assert.NotEqual(oldFilePath, entity2!.AadhaarDocumentPath);
        Assert.False(File.Exists(oldFilePath)); // Old file removed
        Assert.True(File.Exists(entity2.AadhaarDocumentPath)); // New file exists
    }
}

