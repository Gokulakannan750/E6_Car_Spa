using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Database;

public static class DependencyInjection
{
 public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration configuration)
 {
 var connectionString = configuration.GetConnectionString("DefaultConnection")
 ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

 var isDevelopment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";

 services.AddDbContext<AppDbContext>(options =>
 {
  options.UseNpgsql(connectionString, npgsqlOptions =>
  {
  npgsqlOptions.MigrationsAssembly(typeof(DependencyInjection).Assembly.FullName);
  })
  .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));

  if (isDevelopment)
  {
  options.EnableSensitiveDataLogging();
  }
 });

 return services;
 }
}
