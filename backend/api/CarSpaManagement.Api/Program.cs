using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

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
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IVehicleService, VehicleService>();
builder.Services.AddScoped<IServiceService, ServiceService>();
builder.Services.AddScoped<IJobCardService, JobCardSvc>();

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

var app = builder.Build();

// ── Middleware ───────────────────────────────────────────────────────────────
app.UseSerilogRequestLogging();

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

app.UseHttpsRedirection();
app.UseAuthorization();

// ── Routes ───────────────────────────────────────────────────────────────────
app.MapHealthChecks("/api/health");
app.MapControllers();

// ── Global Exception Handler ─────────────────────────────────────────────────
app.Use(async (context, next) =>
{
 try
 {
 await next();
 }
 catch (Exception ex)
 {
 Log.Error(ex, "Unhandled exception");
 context.Response.StatusCode = 500;
 context.Response.ContentType = "application/json";
 await context.Response.WriteAsJsonAsync(new
 {
 error = "An unexpected error occurred.",
 detail = app.Environment.IsDevelopment() ? ex.Message : null
 });
 }
});

Log.Information("Starting Car Spa Management API");

// Seed demo data if database is empty
using (var scope = app.Services.CreateScope())
{
 try
 {
 var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
 await db.Database.MigrateAsync();

 if (!await db.Customers.AnyAsync())
 {
 var c1 = new Customer
 {
 Id = Guid.NewGuid(),
 Name = "Rahul Sharma",
 PhoneNumber = "+919876543210",
 Email = "rahul.sharma@email.com",
 Address = "MG Road, Indiranagar, Bangalore",
 CreatedAt = new DateTime(2024, 01, 15, 10, 0, 0, DateTimeKind.Utc)
 };
 var c2 = new Customer
 {
 Id = Guid.NewGuid(),
 Name = "Priya Patel",
 PhoneNumber = "+919876543211",
 Email = "priya.patel@email.com",
 Address = "Koramangala 5th Block, Bangalore",
 CreatedAt = new DateTime(2024, 02, 20, 14, 30, 0, DateTimeKind.Utc)
 };
 var c3 = new Customer
 {
 Id = Guid.NewGuid(),
 Name = "Arun Kumar",
 PhoneNumber = "+919876543212",
 Email = "arun.k@email.com",
 Address = "Whitefield, Bangalore",
 CreatedAt = new DateTime(2024, 03, 10, 9, 0, 0, DateTimeKind.Utc)
 };
 var c4 = new Customer
 {
 Id = Guid.NewGuid(),
 Name = "Sneha Reddy",
 PhoneNumber = "+919876543213",
 Email = "sneha.r@email.com",
 Address = "HSR Layout, Bangalore",
 CreatedAt = new DateTime(2024, 06, 5, 11, 0, 0, DateTimeKind.Utc)
 };
 var c5 = new Customer
 {
 Id = Guid.NewGuid(),
 Name = "Vikram Singh",
 PhoneNumber = "+919876543214",
 Email = "vikram.s@email.com",
 Address = "Jayanagar 4th Block, Bangalore",
 CreatedAt = new DateTime(2024, 08, 12, 16, 0, 0, DateTimeKind.Utc)
 };

 var v1 = new Vehicle { Id = Guid.NewGuid(), CustomerId = c1.Id, RegistrationNumber = "KA01AB1234", Make = "Maruti Suzuki", Model = "Swift", Variant = "VXi", Color = "Red" };
 var v2 = new Vehicle { Id = Guid.NewGuid(), CustomerId = c2.Id, RegistrationNumber = "KA02CD5678", Make = "Hyundai", Model = "Creta", Variant = "SX", Color = "White" };
 var v3 = new Vehicle { Id = Guid.NewGuid(), CustomerId = c1.Id, RegistrationNumber = "KA01EF9012", Make = "Honda", Model = "City", Variant = "ZX", Color = "Black" };
 var v4 = new Vehicle { Id = Guid.NewGuid(), CustomerId = c3.Id, RegistrationNumber = "KA03GH3456", Make = "Tata", Model = "Nexon", Variant = "XZ+", Color = "Blue" };
 var v5 = new Vehicle { Id = Guid.NewGuid(), CustomerId = c4.Id, RegistrationNumber = "KA04IJ7890", Make = "Toyota", Model = "Innova", Variant = "GX", Color = "Silver" };

 var jc1 = new JobCard { Id = Guid.NewGuid(), CustomerId = c1.Id, VehicleId = v1.Id, JobCardNumber = "JC-2024-001", Subtotal = 4500m, TaxAmount = 810m, DiscountAmount = 0m, TotalAmount = 5310m, Status = JobCardStatus.Delivered, CreatedAt = new DateTime(2024, 08, 1, 9, 0, 0, DateTimeKind.Utc) };
 var jc2 = new JobCard { Id = Guid.NewGuid(), CustomerId = c2.Id, VehicleId = v2.Id, JobCardNumber = "JC-2024-002", Subtotal = 2800m, TaxAmount = 504m, DiscountAmount = 200m, TotalAmount = 3104m, Status = JobCardStatus.Delivered, CreatedAt = new DateTime(2024, 08, 5, 10, 30, 0, DateTimeKind.Utc) };
 var jc3 = new JobCard { Id = Guid.NewGuid(), CustomerId = c1.Id, VehicleId = v3.Id, JobCardNumber = "JC-2024-003", Subtotal = 6500m, TaxAmount = 1170m, DiscountAmount = 500m, TotalAmount = 7170m, Status = JobCardStatus.InProgress, CreatedAt = new DateTime(2024, 08, 10, 11, 0, 0, DateTimeKind.Utc) };
 var jc4 = new JobCard { Id = Guid.NewGuid(), CustomerId = c3.Id, VehicleId = v4.Id, JobCardNumber = "JC-2024-004", Subtotal = 3200m, TaxAmount = 576m, DiscountAmount = 0m, TotalAmount = 3776m, Status = JobCardStatus.Draft, CreatedAt = new DateTime(2024, 08, 12, 14, 0, 0, DateTimeKind.Utc) };
 var jc5 = new JobCard { Id = Guid.NewGuid(), CustomerId = c4.Id, VehicleId = v5.Id, JobCardNumber = "JC-2024-005", Subtotal = 5100m, TaxAmount = 918m, DiscountAmount = 300m, TotalAmount = 5718m, Status = JobCardStatus.Delivered, CreatedAt = new DateTime(2024, 08, 15, 8, 30, 0, DateTimeKind.Utc) };

 db.Customers.AddRange(c1, c2, c3, c4, c5);
 db.Vehicles.AddRange(v1, v2, v3, v4, v5);
 db.JobCards.AddRange(jc1, jc2, jc3, jc4, jc5);
 await db.SaveChangesAsync();

 Log.Information("Seeded {Customers} customers, {Vehicles} vehicles, {JobCards} job cards", 5, 5, 5);
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
