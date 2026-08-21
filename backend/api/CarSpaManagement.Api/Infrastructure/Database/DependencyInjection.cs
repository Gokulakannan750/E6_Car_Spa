using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Database;

public static class DependencyInjection
{
 public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration configuration)
 {
 var connectionString = configuration.GetConnectionString("DefaultConnection")
 ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

 services.AddDbContext<AppDbContext>(options =>
 options.UseNpgsql(connectionString, npgsqlOptions =>
 {
 npgsqlOptions.MigrationsAssembly(typeof(DependencyInjection).Assembly.FullName);
 })
 .EnableSensitiveDataLogging());

 return services;
 }
}
