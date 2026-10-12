using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// Trovo's maintenance commands, run on the server until the admin console exists:
/// <code>
/// dotnet CarSpaManagement.Api.dll platform create-company "Sunrise Detailing"
/// dotnet CarSpaManagement.Api.dll platform new-registration-code 0002
/// dotnet CarSpaManagement.Api.dll platform adopt-database E6CarSpaNew
/// dotnet CarSpaManagement.Api.dll platform list
/// dotnet CarSpaManagement.Api.dll platform migrate
/// </code>
/// </summary>
public static class PlatformCommandLine
{
    public static async Task<int> RunAsync(IServiceProvider services, string[] args)
    {
        using var scope = services.CreateScope();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<PlatformOptions>>().Value;
        if (!options.Enabled)
        {
            Console.Error.WriteLine("The platform is not enabled (set Platform:Enabled=true and the Platform/PlatformAdmin connection strings).");
            return 2;
        }

        var provisioner = scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>();
        var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var command = args.Length > 0 ? args[0] : "help";

        try
        {
            switch (command)
            {
                case "create-company" when args.Length >= 2:
                {
                    var created = await provisioner.CreateCompanyAsync(string.Join(' ', args[1..]));
                    Console.WriteLine($"Company created: {created.Company.Name}");
                    Console.WriteLine($"  Company code:       {created.Company.Code}");
                    Console.WriteLine($"  Registration code:  {created.RegistrationCode}   (one-time; valid until {created.RegistrationCodeExpiresAt:dd MMM yyyy} UTC)");
                    Console.WriteLine($"  Database:           {created.Company.DatabaseName}");
                    Console.WriteLine("Give the customer the company code and registration code. The registration code is not shown again.");
                    return 0;
                }

                case "new-registration-code" when args.Length == 2:
                {
                    await provisioner.EnsureCatalogAsync();
                    var code = args[1].Trim().ToUpperInvariant();
                    var company = await catalog.Companies.Include(c => c.Product)
                        .FirstOrDefaultAsync(c => c.Product!.Key == options.ProductKey && c.Code == code);
                    if (company is null)
                    {
                        Console.Error.WriteLine($"No company with code {code}.");
                        return 1;
                    }
                    if (company.Status != PlatformCompanyStatus.AwaitingRegistration)
                    {
                        Console.Error.WriteLine($"Company {code} is already registered.");
                        return 1;
                    }
                    var (registrationCode, expiresAt) = await provisioner.IssueRegistrationCodeAsync(company.Id);
                    Console.WriteLine($"New registration code for {company.Code} ({company.Name}): {registrationCode}   (valid until {expiresAt:dd MMM yyyy} UTC; earlier codes no longer work)");
                    return 0;
                }

                case "adopt-database" when args.Length == 2:
                {
                    var company = await provisioner.AdoptDatabaseAsync(args[1]);
                    Console.WriteLine($"Database {company.DatabaseName} is now company {company.Code} ({company.Name}) with its own login {company.DatabaseUser}.");
                    return company.MigrationError is null ? 0 : 1;
                }

                case "migrate":
                {
                    var companies = await provisioner.MigrateAllAsync();
                    foreach (var company in companies)
                    {
                        Console.WriteLine(company.MigrationError is null
                            ? $"  {company.Code}  OK      {company.SchemaVersion}"
                            : $"  {company.Code}  FAILED  {company.MigrationError}");
                    }
                    return companies.Any(c => c.MigrationError is not null) ? 1 : 0;
                }

                case "list":
                {
                    await provisioner.EnsureCatalogAsync();
                    var companies = await catalog.Companies.AsNoTracking().Include(c => c.Product)
                        .Where(c => c.Product!.Key == options.ProductKey).OrderBy(c => c.Code).ToListAsync();
                    Console.WriteLine($"{"Code",-6} {"Status",-22} {"Database",-24} Name");
                    foreach (var c in companies)
                    {
                        var status = c.MigrationError is null ? c.Status.ToString() : "MIGRATION FAILED";
                        Console.WriteLine($"{c.Code,-6} {status,-22} {c.DatabaseName,-24} {c.Name}");
                    }
                    return 0;
                }

                default:
                    Console.WriteLine("""
                        Platform commands:
                          platform create-company <name>        create a company, its database and login; prints the codes
                          platform new-registration-code <code>  replace a company's registration code
                          platform adopt-database <database>    bring an existing one-company database onto the platform
                          platform migrate                       migrate the catalog and every company database
                          platform list                          list companies
                        """);
                    return command == "help" ? 0 : 2;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Failed: {ex.Message}");
            return 1;
        }
    }
}
