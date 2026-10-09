using CarSpaManagement.Api.Infrastructure.Tenancy;
using System.Text;
using System.Threading.RateLimiting;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Infrastructure.BackgroundJobs;

// Alias to avoid ambiguity with CarSpaManagement.Api.JobCardService
using JobCardSvc = CarSpaManagement.Api.Application.Services.JobCardService;

var builder = WebApplication.CreateBuilder(args);

// ── Kestrel Hardening ────────────────────────────────────────────────────────
builder.WebHost.ConfigureKestrel(options =>
{
	options.AddServerHeader = false;
	options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10 MB global request size cap
});

// ── Forwarded Headers (Proxy-Aware IP Resolution) ───────────────────────────
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
	options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
	// By default, ASP.NET Core restricts KnownProxies/KnownNetworks to loopback (127.0.0.1, ::1),
	// allowing standard reverse proxies (Nginx/Caddy/IIS) to forward genuine client IPs safely
	// without allowing direct external clients to spoof X-Forwarded-For headers.
});

// ── Serilog ──────────────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
 .ReadFrom.Configuration(builder.Configuration)
 .Enrich.FromLogContext()
 .WriteTo.Console()
 .WriteTo.File("logs/carspa-.log", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7)
 .CreateLogger();

builder.Host.UseSerilog();

// ── Production configuration guard ─────────────────────────────────────────
// Refuse to start Production with placeholder credentials; warn about risky settings.
var configuredConnectionString = builder.Configuration.GetConnectionString("DefaultConnection");
StartupConfigurationGuard.ValidateConnectionString(configuredConnectionString, builder.Environment.IsProduction());
StartupConfigurationGuard.ValidatePublicInvoiceBaseUrl(builder.Configuration["PublicInvoiceBaseUrl"], builder.Environment.IsProduction());
foreach (var configurationWarning in StartupConfigurationGuard.GetWarnings(
	configuredConnectionString,
	builder.Environment.IsProduction(),
	builder.Environment.IsDevelopment(),
	builder.Configuration["urls"],
	builder.Configuration["PublicInvoiceBaseUrl"]))
{
	Log.Warning("CONFIGURATION WARNING: {Warning}", configurationWarning);
}

// ── Services ─────────────────────────────────────────────────────────────────
builder.Services.AddControllers(options =>
{
});
builder.Services.AddOpenApi();

// Validation — return ProblemDetails for bad requests
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
 options.InvalidModelStateResponseFactory = context =>
 {
 var problem = new ValidationProblemDetails(context.ModelState)
 {
 Status = StatusCodes.Status400BadRequest,
 Title = "Validation failed"
 };
 return new BadRequestObjectResult(problem);
 };
});

// Database
builder.Services.AddDatabase(builder.Configuration);

// Application services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IVehicleService, VehicleService>();
builder.Services.AddScoped<IServiceService, ServiceService>();
builder.Services.AddScoped<IJobCardService, JobCardSvc>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddScoped<IInvoicePdfGenerator, InvoicePdfGenerator>();
builder.Services.AddScoped<IStaffAdvanceService, StaffAdvanceService>();
builder.Services.AddScoped<IStaffAttendanceService, StaffAttendanceService>();
builder.Services.AddScoped<IStaffSalaryService, StaffSalaryService>();
builder.Services.AddScoped<IShowroomService, ShowroomService>();
builder.Services.AddScoped<IShowroomOperationsService, ShowroomOperationsService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IBusinessProfileService, BusinessProfileService>();
builder.Services.AddScoped<IVendorService, VendorService>();
builder.Services.AddScoped<IFranchiseEntitlement, OrganizationFranchiseEntitlement>();
builder.Services.AddScoped<IFranchiseFigures, PostgresFranchiseFigures>();
builder.Services.AddScoped<IFranchiseReports, FranchiseReportService>();
builder.Services.AddScoped<IFranchiseService, FranchiseService>();
builder.Services.AddScoped<IOutsideJobService, OutsideJobService>();
builder.Services.AddScoped<ISystemPreferenceService, SystemPreferenceService>();
builder.Services.AddScoped<IInvoiceSeriesService, InvoiceSeriesService>();

// WhatsApp Options & Startup Validation
var whatsAppOptions = new WhatsAppOptions();
builder.Configuration.GetSection(WhatsAppOptions.SectionName).Bind(whatsAppOptions);

var envWhatsAppKey = Environment.GetEnvironmentVariable("WHATSAPP_ENCRYPTION_KEY");
if (!string.IsNullOrWhiteSpace(envWhatsAppKey))
{
	whatsAppOptions.EncryptionKey = envWhatsAppKey;
}

WhatsAppOptions.Validate(whatsAppOptions, builder.Environment.IsProduction());

builder.Services.Configure<WhatsAppOptions>(options =>
{
	options.EncryptionKey = whatsAppOptions.EncryptionKey;
});

// WhatsApp Integration
builder.Services.AddSingleton<IAesEncryptionService, AesEncryptionService>();
builder.Services.AddHttpClient<IWhatsAppService, WhatsAppService>();
builder.Services.AddHttpClient<IWhatsAppTemplateProvisioningService, WhatsAppTemplateProvisioningService>();
builder.Services.AddScoped<OrganizationProvisioner>();
builder.Services.AddHostedService<WhatsAppBackgroundWorker>();

// Security & Authentication Services
builder.Services.AddSingleton<IAccountLockoutService, AccountLockoutService>();
builder.Services.AddScoped<IPasswordHasherService, PasswordHasherService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();

// JWT Options & Startup Validation
var jwtOptions = new JwtOptions();
builder.Configuration.GetSection(JwtOptions.SectionName).Bind(jwtOptions);

var envJwtKey = Environment.GetEnvironmentVariable("JWT_KEY");
if (!string.IsNullOrWhiteSpace(envJwtKey))
{
	jwtOptions.Key = envJwtKey;
}

JwtOptions.Validate(jwtOptions, builder.Environment.IsProduction());

builder.Services.Configure<JwtOptions>(options =>
{
	options.Key = jwtOptions.Key;
	options.Issuer = jwtOptions.Issuer;
	options.Audience = jwtOptions.Audience;
	options.ExpirationMinutes = jwtOptions.ExpirationMinutes;
});

// JWT Authentication
builder.Services.AddAuthentication(options =>
{
 options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
 options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
 options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
 options.SaveToken = true;
 options.TokenValidationParameters = new TokenValidationParameters
 {
 ValidateIssuerSigningKey = true,
 IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
 ValidateIssuer = true,
 ValidIssuer = jwtOptions.Issuer,
 ValidateAudience = true,
 ValidAudiences = new[] { jwtOptions.Audience },
 ValidateLifetime = true,
 ClockSkew = TimeSpan.Zero
 };
});

// Dynamic Permission Authorization
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddAuthorization();

// Rate Limiting on Authentication Endpoints
builder.Services.AddRateLimiter(rateLimiterOptions =>
{
	rateLimiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
	rateLimiterOptions.OnRejected = async (context, cancellationToken) =>
	{
		context.HttpContext.Response.ContentType = "application/json";
		await context.HttpContext.Response.WriteAsJsonAsync(new
		{
			error = "Too many authentication requests from this IP address. Please try again later.",
			retryAfter = 60
		}, cancellationToken: cancellationToken);
	};

	rateLimiterOptions.AddPolicy("auth-login", httpContext =>
	{
		var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
		return RateLimitPartition.GetSlidingWindowLimiter(
			partitionKey: ipAddress,
			factory: _ => new SlidingWindowRateLimiterOptions
			{
				PermitLimit = 5,
				Window = TimeSpan.FromSeconds(60),
				SegmentsPerWindow = 6,
				QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
				QueueLimit = 0
			});
	});

	rateLimiterOptions.AddPolicy("auth-bootstrap", httpContext =>
	{
		var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
		return RateLimitPartition.GetSlidingWindowLimiter(
			partitionKey: ipAddress,
			factory: _ => new SlidingWindowRateLimiterOptions
			{
				PermitLimit = 3,
				Window = TimeSpan.FromSeconds(60),
				SegmentsPerWindow = 6,
				QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
				QueueLimit = 0
			});
	});

	rateLimiterOptions.AddPolicy("public-invoice", httpContext =>
	{
		var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
		return RateLimitPartition.GetSlidingWindowLimiter(
			partitionKey: ipAddress,
			factory: _ => new SlidingWindowRateLimiterOptions
			{
				PermitLimit = 30,
				Window = TimeSpan.FromSeconds(60),
				SegmentsPerWindow = 6,
				QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
				QueueLimit = 0
			});
	});

	rateLimiterOptions.AddPolicy("whatsapp-test", httpContext =>
	{
		var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
		return RateLimitPartition.GetSlidingWindowLimiter(
			partitionKey: ipAddress,
			factory: _ => new SlidingWindowRateLimiterOptions
			{
				PermitLimit = 5,
				Window = TimeSpan.FromSeconds(60),
				SegmentsPerWindow = 6,
				QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
				QueueLimit = 0
			});
	});

	rateLimiterOptions.AddPolicy("file-upload", httpContext =>
	{
		var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
		return RateLimitPartition.GetSlidingWindowLimiter(
			partitionKey: ipAddress,
			factory: _ => new SlidingWindowRateLimiterOptions
			{
				PermitLimit = 10,
				Window = TimeSpan.FromSeconds(60),
				SegmentsPerWindow = 6,
				QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
				QueueLimit = 0
			});
	});

	rateLimiterOptions.AddPolicy("reports-heavy", httpContext =>
	{
		var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
		return RateLimitPartition.GetSlidingWindowLimiter(
			partitionKey: ipAddress,
			factory: _ => new SlidingWindowRateLimiterOptions
			{
				PermitLimit = 30,
				Window = TimeSpan.FromSeconds(60),
				SegmentsPerWindow = 6,
				QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
				QueueLimit = 0
			});
	});
});

// CORS
builder.Services.AddCors(options =>
{
 options.AddPolicy("Development", policy =>
 {
 policy.AllowAnyOrigin()
 .AllowAnyMethod()
 .AllowAnyHeader();
 });
 options.AddPolicy("Production", policy =>
 {
 var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
 policy.WithOrigins(origins)
 .AllowAnyMethod()
 .AllowAnyHeader()
 .WithExposedHeaders("X-Pagination");
 });
});

// Health checks
builder.Services.AddHealthChecks()
 .AddNpgSql(
 connectionString: builder.Configuration.GetConnectionString("DefaultConnection") ?? string.Empty,
 name: "postgres",
 tags: new[] { "db", "postgres" });

var webRootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
if (!Directory.Exists(webRootPath))
{
    Directory.CreateDirectory(webRootPath);
}
builder.Environment.WebRootPath = webRootPath;

var app = builder.Build();

// ── Middleware ───────────────────────────────────────────────────────────────
app.UseForwardedHeaders();
app.UseSerilogRequestLogging();

// HTTP Security Headers
app.Use(async (context, next) =>
{
	context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
	context.Response.Headers.Append("X-Frame-Options", "DENY");
	context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
	await next();
});

// Global Exception Handler must wrap all downstream middleware & endpoints
app.Use(async (context, next) =>
{
 try
 {
 await next();
 }
	catch (Exception ex)
	{
		Log.Error(ex, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);
		if (!context.Response.HasStarted)
		{
			context.Response.StatusCode = ex switch
			{
				KeyNotFoundException => 404,
				CarSpaManagement.Api.Application.Common.NotFoundException => 404,
				ArgumentException => 400,
				CarSpaManagement.Api.Application.Common.ValidationException => 400,
				UnauthorizedAccessException => 403,
				CarSpaManagement.Api.Application.Common.UnauthorizedException => 401,
				CarSpaManagement.Api.Application.Common.ForbiddenException => 403,
				CarSpaManagement.Api.Application.Common.ConflictException => 409,
				_ => 500
			};
			context.Response.ContentType = "application/json";
			var userErrorMessage = ex switch
			{
				KeyNotFoundException => ex.Message,
				CarSpaManagement.Api.Application.Common.NotFoundException => ex.Message,
				ArgumentException => ex.Message,
				CarSpaManagement.Api.Application.Common.ValidationException => ex.Message,
				UnauthorizedAccessException => "Access denied.",
				CarSpaManagement.Api.Application.Common.UnauthorizedException => ex.Message,
				CarSpaManagement.Api.Application.Common.ForbiddenException => ex.Message,
				CarSpaManagement.Api.Application.Common.ConflictException => ex.Message,
				_ => "An unexpected error occurred."
			};
			await context.Response.WriteAsJsonAsync(new
			{
				error = userErrorMessage,
				detail = app.Environment.IsDevelopment() ? ex.Message : null
			});
		}
	}
});

app.UseHttpsRedirection();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webRootPath),
    RequestPath = ""
});

if (app.Environment.IsDevelopment())
{
 app.MapOpenApi();
 app.UseCors("Development");
}
else
{
 app.UseCors("Production");
 app.UseHsts();
}

app.UseAuthentication();
app.UseMiddleware<CarSpaManagement.Api.Infrastructure.Tenancy.TenantResolutionMiddleware>();
app.UseAuthorization();
app.UseRateLimiter();

// ── Routes ───────────────────────────────────────────────────────────────────
app.MapHealthChecks("/api/health");
app.MapControllers();

Log.Information("Starting Car Spa Management API");

// Apply migrations and production bootstrap data (permissions, reference lists, business profile, preferences).
// Demo data (sample vendors) is seeded only in Development.
using (var scope = app.Services.CreateScope())
{
 try
 {
 		var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
		var env = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();
		// Least-privilege deployments set Database:ApplyMigrationsOnStartup=false: migrations are then applied
		// by the database owner during deployment, and the DML-only application role never needs DDL rights.
		if (builder.Configuration.GetValue("Database:ApplyMigrationsOnStartup", true))
		{
			await db.Database.MigrateAsync();
		}
		else
		{
			var pendingMigrations = (await db.Database.GetPendingMigrationsAsync()).ToList();
			if (pendingMigrations.Count > 0)
			{
				Log.Error("Database has {Count} pending migrations ({Migrations}) and automatic migration is disabled. Apply them with the database owner role before using the application.",
					pendingMigrations.Count, string.Join(", ", pendingMigrations));
			}
		}
		await db.Database.ExecuteSqlRawAsync(@"
			UPDATE ""StaffAdvances"" 
			SET ""Status"" = 'Outstanding' 
			WHERE ""Status"" = 'Pending' OR ""Status"" IS NULL;
			UPDATE ""StaffAdvances""
			SET ""Reason"" = COALESCE(NULLIF(""Description"", ''), NULLIF(""AdvanceType"", ''), 'Staff Advance')
			WHERE ""Reason"" IS NULL OR ""Reason"" = '';
		");
		await PermissionSeeder.SeedAsync(db);

		// ── Per-company starting data ─────────────────────────────────────────
		var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
		foreach (var uploadFolder in new[] { "logos", "login" })
		{
			var folder = Path.Combine(webRoot, "uploads", uploadFolder);
			if (!Directory.Exists(folder))
			{
				Directory.CreateDirectory(folder);
			}
		}

		// A database with no company yet (a brand-new install) is set up by first-time setup, which creates the
		// first company and its starting data. Every existing company is topped up here on each start.
		var scopeFactory = scope.ServiceProvider.GetRequiredService<IServiceScopeFactory>();
		var organizationIds = await db.Organizations.Where(o => o.IsActive).Select(o => o.Id).ToListAsync();
		foreach (var organizationId in organizationIds)
		{
			using var organizationScope = scopeFactory.CreateTenantScope(organizationId);
			var provisioner = organizationScope.ServiceProvider.GetRequiredService<OrganizationProvisioner>();
			await provisioner.SeedDefaultsAsync(env.IsDevelopment());
		}
	}
 catch (Exception ex)
 {
 Log.Error(ex, "Seeding failed: {Message}", ex.Message);
 }
}

try
{
 app.Run();
}
catch (Exception ex)
{
 Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
 Log.CloseAndFlush();
}
