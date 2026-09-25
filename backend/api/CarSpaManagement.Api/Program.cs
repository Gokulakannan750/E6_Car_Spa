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
 ValidAudiences = new[] { jwtOptions.Audience, "E6CarSpaMobile", "E6CarSpa" },
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
app.UseAuthorization();
app.UseRateLimiter();

// ── Routes ───────────────────────────────────────────────────────────────────
app.MapHealthChecks("/api/health");
app.MapControllers();

Log.Information("Starting Car Spa Management API");

// Seed demo data if database is empty
using (var scope = app.Services.CreateScope())
{
 try
 {
 		var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
		var env = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();
		await db.Database.MigrateAsync();
		await db.Database.ExecuteSqlRawAsync(@"
			UPDATE ""StaffAdvances"" 
			SET ""Status"" = 'Outstanding' 
			WHERE ""Status"" = 'Pending' OR ""Status"" IS NULL;
			UPDATE ""StaffAdvances""
			SET ""Reason"" = COALESCE(NULLIF(""Description"", ''), NULLIF(""AdvanceType"", ''), 'Staff Advance')
			WHERE ""Reason"" IS NULL OR ""Reason"" = '';
		");
		await PermissionSeeder.SeedAsync(db);
		await ShowroomOperationsSeeder.SeedAsync(db);

		// ── Seed Default Business Profile (Singleton) ────────────────────────
		var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
		var logosDir = Path.Combine(webRoot, "uploads", "logos");
		if (!Directory.Exists(logosDir))
		{
			Directory.CreateDirectory(logosDir);
		}

		var targetLogoPath = Path.Combine(logosDir, "e6-logo.png");
		if (!File.Exists(targetLogoPath))
		{
			var sourceLogo = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "apps", "desktop", "renderer", "public", "e6-logo.png");
			if (File.Exists(sourceLogo))
			{
				try
				{
					File.Copy(sourceLogo, targetLogoPath, true);
				}
				catch (Exception ex)
				{
					Log.Warning(ex, "Could not copy default logo from frontend public directory");
				}
			}
		}

		if (!await db.BusinessProfiles.AnyAsync())
		{
			var profile = new BusinessProfile
			{
				Id = Guid.NewGuid(),
				SingletonKey = 1,
				BusinessName = "E6 Car Spa",
				AddressLine1 = "36, Geetha Nagar Main Road",
				AddressLine2 = "Behind Sakthi Mahal, Perundurai Road",
				City = "Erode",
				State = "Tamil Nadu",
				PostalCode = "638011",
				Phone = "9578749449",
				Email = "e6carspaerd@gmail.com",
				Gstin = null,
				LogoPath = "/uploads/logos/e6-logo.png",
				InvoicePrefix = "INV",
				CreatedAt = DateTime.UtcNow
			};
			db.BusinessProfiles.Add(profile);
			await db.SaveChangesAsync();
			Log.Information("Seeded verified default E6 Car Spa business profile");
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
