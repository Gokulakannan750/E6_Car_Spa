using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Database;

public static class DependencyInjection
{
 public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration configuration)
 {
 var isDevelopment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";
 var platform = configuration.GetSection(PlatformOptions.SectionName).Get<PlatformOptions>() ?? new PlatformOptions();

 services.Configure<PlatformOptions>(configuration.GetSection(PlatformOptions.SectionName));
 services.AddMemoryCache();

 // One tenant context per request; the database context and the services read the same instance.
 services.AddScoped<TenantContext>();
 services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

 if (platform.Enabled)
 {
  // Trovo's platform: a catalog of companies, and a separate database (with its own login) for each company.
  var catalogConnection = configuration.GetConnectionString("Platform")
  ?? throw new InvalidOperationException("Connection string 'Platform' is required when the platform is enabled.");

  services.AddDbContext<PlatformDbContext>(options => options.UseNpgsql(catalogConnection));
  services.AddScoped<ICompanyDirectory, PlatformCompanyDirectory>();
  services.AddScoped<CompanyDatabaseProvisioner>();
  services.AddScoped<CompanyRegistrationService>();
  services.AddScoped<BillingInvoiceService>();
  services.AddScoped<SubscriptionService>();
  services.AddScoped<PlatformSettingsService>();
  services.AddScoped<PriceQuoteService>();
  services.AddScoped<SignupService>();
  services.AddScoped<PlatformAdminService>();
  services.AddScoped<IEntitlementService, PlatformEntitlementService>();

  services.AddDbContext<AppDbContext>((sp, options) =>
  {
  // No connection string here: each connection is pointed at the current company's database as it opens.
  options.UseNpgsql(npgsqlOptions =>
  {
   npgsqlOptions.MigrationsAssembly(typeof(DependencyInjection).Assembly.FullName);
  })
  .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
  .AddInterceptors(
   new TenantConnectionInterceptor(sp.GetRequiredService<ICompanyDirectory>(), sp.GetService<TenantContext>()),
   new TenantSessionInterceptor());

  if (isDevelopment)
  {
   options.EnableSensitiveDataLogging();
  }
  });

  return services;
 }

 var connectionString = configuration.GetConnectionString("DefaultConnection")
 ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

 services.AddScoped<ICompanyDirectory, SingleDatabaseCompanyDirectory>();
 services.AddScoped<IEntitlementService, UnmanagedEntitlementService>();

 services.AddDbContext<AppDbContext>(options =>
 {
  options.UseNpgsql(connectionString, npgsqlOptions =>
  {
  npgsqlOptions.MigrationsAssembly(typeof(DependencyInjection).Assembly.FullName);
  })
  .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
  .AddInterceptors(new TenantSessionInterceptor());

  if (isDevelopment)
  {
  options.EnableSensitiveDataLogging();
  }
 });

 return services;
 }
}
