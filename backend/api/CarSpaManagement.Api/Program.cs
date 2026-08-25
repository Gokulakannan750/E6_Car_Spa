using System.Text;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Infrastructure.BackgroundJobs;

// Alias to avoid ambiguity with CarSpaManagement.Api.JobCardService
using JobCardSvc = CarSpaManagement.Api.Application.Services.JobCardService;

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddScoped<IStaffAdvanceService, StaffAdvanceService>();
builder.Services.AddScoped<IShowroomService, ShowroomService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IBusinessProfileService, BusinessProfileService>();

// WhatsApp Integration
builder.Services.AddSingleton<IAesEncryptionService, AesEncryptionService>();
builder.Services.AddHttpClient<IWhatsAppService, WhatsAppService>();
builder.Services.AddHostedService<WhatsAppBackgroundWorker>();

// Security & Authentication Services
builder.Services.AddScoped<IPasswordHasherService, PasswordHasherService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();

// JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Key"] ?? "E6CarSpa_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "E6CarSpa";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "E6CarSpaDesktop";

builder.Services.AddAuthentication(options =>
{
 options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
 options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
 options.RequireHttpsMetadata = false;
 options.SaveToken = true;
 options.TokenValidationParameters = new TokenValidationParameters
 {
 ValidateIssuerSigningKey = true,
 IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
 ValidateIssuer = true,
 ValidIssuer = jwtIssuer,
 ValidateAudience = true,
 ValidAudiences = new[] { jwtAudience, "E6CarSpaMobile", "E6CarSpa" },
 ValidateLifetime = true,
 ClockSkew = TimeSpan.Zero
 };
});

// Dynamic Permission Authorization
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddAuthorization();

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
app.UseSerilogRequestLogging();

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
 ArgumentException or InvalidOperationException => 400,
 UnauthorizedAccessException => 403,
 _ => 500
 };
 context.Response.ContentType = "application/json";
 await context.Response.WriteAsJsonAsync(new
 {
 error = ex is KeyNotFoundException or ArgumentException or InvalidOperationException or UnauthorizedAccessException
 ? ex.Message
 : "An unexpected error occurred.",
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
				Phone = "+91 9578749449",
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

		if (!await db.Services.AnyAsync())
 {
 var s1 = new Service { Id = Guid.NewGuid(), Name = "Level 3 Paint Correction", Category = "Exterior Detailing", Description = "Multi-stage machine compounding and polishing to remove 85-95% of deep scratches, swirl marks, and oxidation. Restores showroom clarity to heavily damaged clear coats.", Price = 5000m, TaxPercentage = 18m, DurationMinutes = 180, IsActive = true };
 var s2 = new Service { Id = Guid.NewGuid(), Name = "Wheels-Off Decontamination", Category = "Exterior Detailing", Description = "Complete removal of wheels for deep cleaning of inner barrels, brake calipers, and suspension components with iron fallout remover and wheel sealant.", Price = 1500m, TaxPercentage = 18m, DurationMinutes = 60, IsActive = true };
 var s3 = new Service { Id = Guid.NewGuid(), Name = "Premium Foam Wash & Wax", Category = "Exterior Detailing", Description = "pH-neutral snow foam pre-wash, two-bucket hand wash, clay bar decontamination, and high-gloss carnauba wax seal.", Price = 1200m, TaxPercentage = 18m, DurationMinutes = 60, IsActive = true };
 var s4 = new Service { Id = Guid.NewGuid(), Name = "Full Interior Deep Detail", Category = "Interior Care", Description = "Dashboard, console, door panels, steam extraction of upholstery and carpets, stain removal, and UV trim conditioning.", Price = 2500m, TaxPercentage = 18m, DurationMinutes = 120, IsActive = true };
 var s5 = new Service { Id = Guid.NewGuid(), Name = "Leather Conditioning Treatment", Category = "Interior Care", Description = "Deep pH-balanced leather cleaning followed by rich conditioner to prevent cracking, fading, and dry leather aging.", Price = 1800m, TaxPercentage = 18m, DurationMinutes = 60, IsActive = true };
 var s6 = new Service { Id = Guid.NewGuid(), Name = "AC Vent Cleaning & Sanitization", Category = "Interior Care", Description = "High-temperature steam sterilization of air conditioning ducts and vents, eliminating bacteria, mold, and unpleasant odours.", Price = 1000m, TaxPercentage = 18m, DurationMinutes = 30, IsActive = true };
 var s7 = new Service { Id = Guid.NewGuid(), Name = "Signature Ceramic Coating (9H)", Category = "Protection Packages", Description = "Application of a 9H hardness professional-grade ceramic layer. Provides up to 5 years of extreme gloss, UV protection, and intense hydrophobic properties.", Price = 15000m, TaxPercentage = 18m, DurationMinutes = 240, IsActive = true };
 var s8 = new Service { Id = Guid.NewGuid(), Name = "Graphene Matrix Coating (10H)", Category = "Protection Packages", Description = "Next-generation graphene oxide coating with exceptional heat dissipation, anti-water spotting, and 7-year surface durability.", Price = 22000m, TaxPercentage = 18m, DurationMinutes = 300, IsActive = true };
 var s9 = new Service { Id = Guid.NewGuid(), Name = "Paint Protection Film (PPF) - Front End", Category = "Protection Packages", Description = "Self-healing TPU film installed on front bumper, full bonnet, front fenders, and mirrors against rock chips and road debris.", Price = 28000m, TaxPercentage = 18m, DurationMinutes = 360, IsActive = true };
 var s10 = new Service { Id = Guid.NewGuid(), Name = "Underbody Anti-Rust Coating", Category = "Protection Packages", Description = "Thick bitumen-based rubberized undercarriage spray protecting the vehicle chassis against corrosion, moisture, and road salt.", Price = 3500m, TaxPercentage = 18m, DurationMinutes = 90, IsActive = true };
 var s11 = new Service { Id = Guid.NewGuid(), Name = "Odour Removal & Ozone Treatment", Category = "Others", Description = "High-output ozone generator treatment to permanently eliminate stubborn smoke, food, pet, and mildew smells from cabin fabric.", Price = 1200m, TaxPercentage = 18m, DurationMinutes = 45, IsActive = true };
 var s12 = new Service { Id = Guid.NewGuid(), Name = "Rat Repellent Under-Bonnet Spray", Category = "Others", Description = "Specialized non-toxic coating applied to engine bay wiring and rubber hoses to deter rodents and pests.", Price = 800m, TaxPercentage = 18m, DurationMinutes = 30, IsActive = true };

 db.Services.AddRange(s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12);
 await db.SaveChangesAsync();
 Log.Information("Seeded {Services} service catalogue items", 12);
 }

 if (!await db.Staff.AnyAsync())
 {
 var st1 = new Staff { Id = Guid.NewGuid(), Name = "Gokulakannan S", PhoneNumber = "+919876543210", Email = "gokul@e6carspa.com", Address = "123, Anna Nagar, Chennai", Role = "Manager", IsActive = true };
 var st2 = new Staff { Id = Guid.NewGuid(), Name = "Ravi Kumar M", PhoneNumber = "+918765432109", Email = "ravi@e6carspa.com", Address = "45, T Nagar, Chennai", Role = "Senior Technician", IsActive = true };
 var st3 = new Staff { Id = Guid.NewGuid(), Name = "Priya Devi R", PhoneNumber = "+917654321098", Email = "priya@e6carspa.com", Address = "78, Velachery, Chennai", Role = "Cashier", IsActive = true };
 var st4 = new Staff { Id = Guid.NewGuid(), Name = "Senthil Nathan V", PhoneNumber = "+914321098765", Email = "senthil@e6carspa.com", Address = "34, K.K. Nagar, Chennai", Role = "Detailer", IsActive = true };

 db.Staff.AddRange(st1, st2, st3, st4);
 await db.SaveChangesAsync();
 Log.Information("Seeded {Staff} staff members", 4);
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
