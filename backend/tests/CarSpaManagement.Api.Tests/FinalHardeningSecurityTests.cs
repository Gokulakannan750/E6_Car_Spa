using System.Security.Claims;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class FinalHardeningSecurityTests
{
    private class TestHostEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "CarSpaManagement.Api";
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = default!;
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = default!;
    }

    private class ThrowingDbUpdateInvoiceService : IInvoiceService
    {
        public Task<InvoiceDto> CreateFromJobCardAsync(CreateInvoiceFromJobCardRequest request, CancellationToken cancellationToken = default)
        {
            var inner = new Exception("violates foreign key constraint fk_invoices_users ON TABLE invoices");
            throw new DbUpdateException("An error occurred while saving the entity changes.", inner);
        }

        public Task<InvoiceDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<InvoiceDto?>(null);
        public Task<InvoiceDto?> GetByNumberAsync(string invoiceNumber, CancellationToken cancellationToken = default) => Task.FromResult<InvoiceDto?>(null);
        public Task<IReadOnlyList<InvoiceListDto>> GetAllAsync(int page, int pageSize, string? search = null, InvoiceStatus? status = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<InvoiceListDto>>(Array.Empty<InvoiceListDto>());
        public Task<int> GetTotalCountAsync(string? search = null, InvoiceStatus? status = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<InvoiceDto?> UpdateAsync(Guid id, UpdateInvoiceRequest request, CancellationToken cancellationToken = default) => Task.FromResult<InvoiceDto?>(null);
        public Task<InvoiceDto> GenerateInvoiceAsync(Guid id, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<PaymentDto> RecordPaymentAsync(Guid invoiceId, RecordPaymentRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<PaymentDto>> GetPaymentsByInvoiceIdAsync(Guid invoiceId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<PaymentDto>>(Array.Empty<PaymentDto>());
        public Task<InvoicePublicLinkResponse> CreatePublicLinkAsync(Guid invoiceId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<InvoicePublicLinkStatusResponse> GetPublicLinkStatusAsync(Guid invoiceId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<bool> RevokePublicLinkAsync(Guid invoiceId, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<InvoicePublicLinkResponse> RotatePublicLinkAsync(Guid invoiceId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<PublicInvoiceDto?> GetPublicInvoiceByTokenAsync(string token, CancellationToken cancellationToken = default) => Task.FromResult<PublicInvoiceDto?>(null);
    }

    private class ThrowingDbUpdateJobCardService : IJobCardService
    {
        public Task<JobCardDto> CreateAsync(CreateJobCardRequest request, CancellationToken cancellationToken = default)
        {
            var inner = new Exception("violates foreign key constraint fk_job_cards_vehicles ON TABLE job_cards");
            throw new DbUpdateException("An error occurred while saving the entity changes.", inner);
        }

        public Task<JobCardDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<JobCardDto?>(null);
        public Task<JobCardPrintDto?> GetForPrintAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<JobCardPrintDto?>(null);
        public Task<JobCardDto?> GetByNumberAsync(string jobCardNumber, CancellationToken cancellationToken = default) => Task.FromResult<JobCardDto?>(null);
        public Task<IReadOnlyList<JobCardListDto>> GetAllAsync(int page, int pageSize, JobCardStatus? status = null, Guid? customerId = null, Guid? vehicleId = null, string? search = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<JobCardListDto>>(Array.Empty<JobCardListDto>());
        public Task<int> GetTotalCountAsync(JobCardStatus? status = null, Guid? customerId = null, Guid? vehicleId = null, string? search = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<IReadOnlyList<JobCardListDto>> GetByCustomerIdAsync(Guid customerId, int page, int pageSize, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<JobCardListDto>>(Array.Empty<JobCardListDto>());
        public Task<IReadOnlyList<JobCardListDto>> GetByVehicleIdAsync(Guid vehicleId, int page, int pageSize, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<JobCardListDto>>(Array.Empty<JobCardListDto>());
        public Task<JobCardDto?> UpdateServicesAsync(Guid id, UpdateJobCardServicesRequest request, CancellationToken cancellationToken = default) => Task.FromResult<JobCardDto?>(null);
        public Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(true);
    }

    private class MockShowroomService : IShowroomService
    {
        public Task<DailyStaffResponse> UnlockAttendanceAsync(Guid showroomId, DateTime date, Guid userId, bool isOwner, CancellationToken ct = default)
        {
            if (!isOwner)
            {
                throw new Application.Common.ForbiddenException("Only the Owner can unlock and correct attendance.");
            }

            return Task.FromResult(new DailyStaffResponse(
                showroomId,
                "Showroom 1",
                date,
                0,
                false,
                null,
                null,
                null,
                Array.Empty<DailyStaffAssignmentDto>()));
        }

        public Task<IReadOnlyList<ShowroomDto>> GetAllAsync(string? search = null, bool? isActive = null, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<ShowroomDto>>(Array.Empty<ShowroomDto>());
        public Task<ShowroomDto?> GetByIdAsync(Guid id, CancellationToken ct = default) => Task.FromResult<ShowroomDto?>(null);
        public Task<ShowroomDto> CreateAsync(CreateShowroomRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<ShowroomDto?> UpdateAsync(Guid id, UpdateShowroomRequest request, CancellationToken ct = default) => Task.FromResult<ShowroomDto?>(null);
        public Task<bool> DeleteAsync(Guid id, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> ToggleActiveAsync(Guid id, CancellationToken ct = default) => Task.FromResult(true);
        public Task<DailyStaffResponse?> GetDailyStaffAsync(Guid showroomId, DateTime date, CancellationToken ct = default) => Task.FromResult<DailyStaffResponse?>(null);
        public Task<DailyStaffAssignmentDto> AssignStaffAsync(Guid showroomId, CreateDailyStaffAssignmentRequest request, bool isOwner = false, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<DailyStaffResponse> ConfirmAttendanceAsync(Guid showroomId, DateTime date, Guid userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<DailyStaffAssignmentDto?> UpdateAssignmentVehiclesAsync(Guid assignmentId, int vehiclesAttended, bool isOwner = false, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> RemoveAssignmentAsync(Guid assignmentId, bool isOwner = false, CancellationToken ct = default) => Task.FromResult(true);
        public Task<ShowroomDailyBillDto?> GetDailyBillAsync(Guid showroomId, DateTime date, CancellationToken ct = default) => Task.FromResult<ShowroomDailyBillDto?>(null);
        public Task<ShowroomDailyBillDto> SetDailyBillAsync(Guid showroomId, DateTime date, SetShowroomDailyBillRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<ShowroomDailyBillDto> RecordPaymentAsync(Guid showroomId, DateTime date, RecordShowroomPaymentRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> DeletePaymentAsync(Guid paymentId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<ShowroomSummaryDto?> GetShowroomSummaryAsync(Guid showroomId, DateTime fromDate, DateTime toDate, CancellationToken ct = default) => Task.FromResult<ShowroomSummaryDto?>(null);
        public Task<IReadOnlyList<ShowroomOutstandingOverviewDto>> GetOutstandingOverviewAsync(DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<ShowroomOutstandingOverviewDto>>(Array.Empty<ShowroomOutstandingOverviewDto>());
    }

    private class PassThroughAuthService : IAuthorizationService
    {
        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements) => Task.FromResult(AuthorizationResult.Success());
        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName) => Task.FromResult(AuthorizationResult.Success());
    }

    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    // ── 1. InvoicesController DbUpdateException Error Sanitization Tests ────

    [Fact]
    public async Task InvoicesController_DbUpdateException_InProduction_HidesSensitiveDatabaseDetails()
    {
        var prodEnv = new TestHostEnvironment { EnvironmentName = Environments.Production };
        var controller = new InvoicesController(new ThrowingDbUpdateInvoiceService(), new PassThroughAuthService(), prodEnv);

        var result = await controller.CreateFromJobCard(Guid.NewGuid(), CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, objectResult.StatusCode);

        // Verify detail is null in production
        var detailProp = objectResult.Value?.GetType().GetProperty("detail")?.GetValue(objectResult.Value);
        Assert.Null(detailProp);

        var errorProp = objectResult.Value?.GetType().GetProperty("error")?.GetValue(objectResult.Value);
        Assert.Equal("Database error", errorProp);
    }

    [Fact]
    public async Task InvoicesController_DbUpdateException_InDevelopment_IncludesDiagnosticDetail()
    {
        var devEnv = new TestHostEnvironment { EnvironmentName = Environments.Development };
        var controller = new InvoicesController(new ThrowingDbUpdateInvoiceService(), new PassThroughAuthService(), devEnv);

        var result = await controller.CreateFromJobCard(Guid.NewGuid(), CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, objectResult.StatusCode);

        var detailProp = objectResult.Value?.GetType().GetProperty("detail")?.GetValue(objectResult.Value) as string;
        Assert.NotNull(detailProp);
        Assert.Contains("violates foreign key constraint", detailProp);
    }

    // ── 2. JobCardsController DbUpdateException Error Sanitization Tests ─────

    [Fact]
    public async Task JobCardsController_DbUpdateException_InProduction_HidesSensitiveDatabaseDetails()
    {
        var prodEnv = new TestHostEnvironment { EnvironmentName = Environments.Production };
        var controller = new JobCardsController(new ThrowingDbUpdateJobCardService(), new PassThroughAuthService(), prodEnv);

        var request = new CreateJobCardRequest
        {
            CustomerId = Guid.NewGuid(),
            VehicleId = Guid.NewGuid(),
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = Guid.NewGuid(), Quantity = 1, DiscountAmount = 0 }
            }
        };

        var result = await controller.Create(request, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, objectResult.StatusCode);

        var detailProp = objectResult.Value?.GetType().GetProperty("detail")?.GetValue(objectResult.Value);
        Assert.Null(detailProp);

        var errorProp = objectResult.Value?.GetType().GetProperty("error")?.GetValue(objectResult.Value);
        Assert.Equal("Database error", errorProp);
    }

    [Fact]
    public async Task JobCardsController_DbUpdateException_InDevelopment_IncludesDiagnosticDetail()
    {
        var devEnv = new TestHostEnvironment { EnvironmentName = Environments.Development };
        var controller = new JobCardsController(new ThrowingDbUpdateJobCardService(), new PassThroughAuthService(), devEnv);

        var request = new CreateJobCardRequest
        {
            CustomerId = Guid.NewGuid(),
            VehicleId = Guid.NewGuid(),
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = Guid.NewGuid(), Quantity = 1, DiscountAmount = 0 }
            }
        };

        var result = await controller.Create(request, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, objectResult.StatusCode);

        var detailProp = objectResult.Value?.GetType().GetProperty("detail")?.GetValue(objectResult.Value) as string;
        Assert.NotNull(detailProp);
        Assert.Contains("violates foreign key constraint", detailProp);
    }

    // ── 3. ShowroomsController UnlockAttendance Authorization Tests ─────────

    [Fact]
    public async Task ShowroomsController_UnlockAttendance_WithActiveOwner_IsAllowed()
    {
        using var db = CreateInMemoryDb();
        var ownerId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = ownerId,
            FullName = "Active Owner",
            Email = "owner@test.com",
            PasswordHash = "hash",
            Role = UserRole.Owner,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new ShowroomsController(new MockShowroomService(), db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, ownerId.ToString()),
                        new Claim(ClaimTypes.Role, "Owner"),
                        new Claim("isOwner", "true")
                    }, "TestAuth"))
                }
            }
        };

        var result = await controller.UnlockAttendance(Guid.NewGuid(), DateTime.UtcNow, null, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task ShowroomsController_UnlockAttendance_WithInactiveOwner_Returns403Forbidden()
    {
        using var db = CreateInMemoryDb();
        var inactiveOwnerId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = inactiveOwnerId,
            FullName = "Deactivated Owner",
            Email = "inactive_owner@test.com",
            PasswordHash = "hash",
            Role = UserRole.Owner,
            IsActive = false // INACTIVE in database
        });
        await db.SaveChangesAsync();

        var controller = new ShowroomsController(new MockShowroomService(), db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, inactiveOwnerId.ToString()),
                        new Claim(ClaimTypes.Role, "Owner"),
                        new Claim("isOwner", "true") // Unexpired JWT claim
                    }, "TestAuth"))
                }
            }
        };

        var result = await controller.UnlockAttendance(Guid.NewGuid(), DateTime.UtcNow, null, CancellationToken.None);
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objectResult.StatusCode);
    }

    [Fact]
    public async Task ShowroomsController_UnlockAttendance_WithManager_Returns403Forbidden()
    {
        using var db = CreateInMemoryDb();
        var managerId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = managerId,
            FullName = "Manager User",
            Email = "manager@test.com",
            PasswordHash = "hash",
            Role = UserRole.Manager,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new ShowroomsController(new MockShowroomService(), db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, managerId.ToString()),
                        new Claim(ClaimTypes.Role, "Manager"),
                        new Claim("isOwner", "false")
                    }, "TestAuth"))
                }
            }
        };

        var result = await controller.UnlockAttendance(Guid.NewGuid(), DateTime.UtcNow, null, CancellationToken.None);
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objectResult.StatusCode);
    }

    [Fact]
    public async Task ShowroomsController_UnlockAttendance_WithStaff_Returns403Forbidden()
    {
        using var db = CreateInMemoryDb();
        var staffId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = staffId,
            FullName = "Staff User",
            Email = "staff@test.com",
            PasswordHash = "hash",
            Role = UserRole.Staff,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new ShowroomsController(new MockShowroomService(), db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, staffId.ToString()),
                        new Claim(ClaimTypes.Role, "Staff"),
                        new Claim("isOwner", "false")
                    }, "TestAuth"))
                }
            }
        };

        var result = await controller.UnlockAttendance(Guid.NewGuid(), DateTime.UtcNow, null, CancellationToken.None);
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objectResult.StatusCode);
    }

    [Fact]
    public async Task ShowroomsController_UnlockAttendance_WithForgedOwnerClaim_Returns403Forbidden()
    {
        using var db = CreateInMemoryDb();
        var staffId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = staffId,
            FullName = "Staff User Trying Privilege Escalation",
            Email = "staff_hacker@test.com",
            PasswordHash = "hash",
            Role = UserRole.Staff, // Staff in DB
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new ShowroomsController(new MockShowroomService(), db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, staffId.ToString()),
                        new Claim(ClaimTypes.Role, "Owner"), // Forged claim
                        new Claim("isOwner", "true")        // Forged claim
                    }, "TestAuth"))
                }
            }
        };

        var result = await controller.UnlockAttendance(Guid.NewGuid(), DateTime.UtcNow, null, CancellationToken.None);
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objectResult.StatusCode);
    }
}
