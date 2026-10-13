using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// Trovo's maintenance commands, run on the server (the admin portal does the same through /api/platform):
/// <code>
/// platform create-admin you@trovotechsolutions.in "Your Name" [--role Owner]
/// platform create-company "Sunrise Detailing" [--plan professional --interval year --licences both:2,android:3 --addons showroom --paid-until 2027-10-12]
/// platform new-registration-code 0002
/// platform adopt-database E6CarSpaNew --plan professional --interval year --addons showroom,franchise_network [--paid-until 2027-10-12]
/// platform list
/// platform migrate
/// platform run-lifecycle
/// </code>
/// Without --plan a new company starts on the free trial.
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
        var (positional, flags) = Parse(args);
        var command = positional.Count > 0 ? positional[0] : "help";

        try
        {
            switch (command)
            {
                case "create-admin" when positional.Count == 3:
                {
                    await provisioner.EnsureCatalogAsync();
                    var role = flags.TryGetValue("role", out var r) ? Enum.Parse<PlatformAdminRole>(r, ignoreCase: true) : PlatformAdminRole.Owner;
                    var admins = scope.ServiceProvider.GetRequiredService<PlatformAdminService>();
                    var (admin, password) = await admins.CreateAsync(positional[1], positional[2], role);
                    Console.WriteLine($"Administrator created: {admin.Email} ({admin.Role})");
                    Console.WriteLine($"  One-time password: {password}");
                    Console.WriteLine("At the first sign-in to the admin portal they choose a new password and set up 2-step verification with an authenticator app.");
                    return 0;
                }

                case "reset-admin" when positional.Count == 2:
                {
                    var admins = scope.ServiceProvider.GetRequiredService<PlatformAdminService>();
                    var password = await admins.ResetAsync(positional[1]);
                    Console.WriteLine($"New one-time password for {positional[1]}: {password}  (2-step verification must be set up again)");
                    return 0;
                }

                case "create-company" when positional.Count >= 2:
                {
                    var plan = flags.ContainsKey("plan") ? ReadPlan(flags) : null;
                    var created = await provisioner.CreateCompanyAsync(string.Join(' ', positional.Skip(1)), plan);
                    Console.WriteLine($"Company created: {created.Company.Name}");
                    Console.WriteLine($"  Company code:       {created.Company.Code}");
                    Console.WriteLine($"  Registration code:  {created.RegistrationCode}   (one-time; valid until {created.RegistrationCodeExpiresAt:dd MMM yyyy} UTC)");
                    Console.WriteLine($"  Database:           {created.Company.DatabaseName}");
                    Console.WriteLine($"  Subscription:       {(plan is null ? $"free trial ({options.TrialDays} days)" : $"{plan.PlanCode} {plan.Interval}ly, paid until {plan.PaidUntil:dd MMM yyyy}")}");
                    Console.WriteLine("Give the customer the company code and registration code. The registration code is not shown again.");
                    return 0;
                }

                case "new-registration-code" when positional.Count == 2:
                {
                    await provisioner.EnsureCatalogAsync();
                    var code = positional[1].Trim().ToUpperInvariant();
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

                case "adopt-database" when positional.Count == 2:
                {
                    if (!flags.ContainsKey("plan"))
                    {
                        Console.Error.WriteLine("adopt-database needs the company's plan, e.g. --plan professional --interval year --addons showroom,franchise_network");
                        return 2;
                    }
                    var company = await provisioner.AdoptDatabaseAsync(positional[1], ReadPlan(flags));
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

                case "run-lifecycle":
                {
                    await provisioner.EnsureCatalogAsync();
                    var changed = await scope.ServiceProvider.GetRequiredService<SubscriptionService>().RunLifecycleAsync(DateTime.UtcNow);
                    Console.WriteLine($"{changed} subscription(s) changed state.");
                    return 0;
                }

                case "list":
                {
                    await provisioner.EnsureCatalogAsync();
                    var companies = await catalog.Companies.AsNoTracking().Include(c => c.Product)
                        .Where(c => c.Product!.Key == options.ProductKey).OrderBy(c => c.Code).ToListAsync();
                    var subscriptions = await catalog.Subscriptions.AsNoTracking().Include(s => s.PlanVersion!).ThenInclude(v => v.Plan)
                        .Where(s => s.IsCurrent).ToDictionaryAsync(s => s.CompanyId);
                    Console.WriteLine($"{"Code",-6} {"Company",-22} {"Subscription",-30} {"Database",-24} Name");
                    foreach (var c in companies)
                    {
                        var status = c.MigrationError is null ? c.Status.ToString() : "MIGRATION FAILED";
                        var plan = subscriptions.TryGetValue(c.Id, out var s)
                            ? $"{s.PlanVersion?.Plan?.Code} {s.Status} to {s.CurrentPeriodEnd:dd MMM yy}"
                            : "-";
                        Console.WriteLine($"{c.Code,-6} {status,-22} {plan,-30} {c.DatabaseName,-24} {c.Name}");
                    }
                    return 0;
                }

                default:
                    Console.WriteLine("""
                        Platform commands:
                          platform create-admin <email> <name> [--role Owner|Billing|Support|ReadOnly]
                          platform reset-admin <email>
                          platform create-company <name> [--plan <code> --interval month|year --licences both:2,android:1 --addons a,b:2 --paid-until yyyy-mm-dd]
                          platform new-registration-code <code>
                          platform adopt-database <database> --plan <code> --interval month|year [--licences ...] [--addons ...] [--paid-until ...]
                          platform migrate          migrate the catalog and every company database
                          platform run-lifecycle    apply trial/grace/renewal rules now
                          platform list             list companies and subscriptions
                        Without --plan a new company starts on the free trial.
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

    private static CompanyPlan ReadPlan(IReadOnlyDictionary<string, string> flags)
    {
        var interval = flags.TryGetValue("interval", out var i) && i.StartsWith("y", StringComparison.OrdinalIgnoreCase)
            ? BillingInterval.Year
            : BillingInterval.Month;
        var addOns = new Dictionary<string, int>();
        if (flags.TryGetValue("addons", out var list))
        {
            foreach (var part in list.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var pieces = part.Split(':');
                addOns[pieces[0]] = pieces.Length > 1 ? int.Parse(pieces[1]) : 1;
            }
        }
        var paidUntil = flags.TryGetValue("paid-until", out var until)
            ? DateTime.SpecifyKind(DateTime.Parse(until), DateTimeKind.Utc)
            : (interval == BillingInterval.Year ? DateTime.UtcNow.AddYears(1) : DateTime.UtcNow.AddMonths(1));
        LicenceCounts? licences = null;
        if (flags.TryGetValue("licences", out var licenceText))
        {
            // e.g. --licences both:2,android:3
            int both = 0, android = 0, windows = 0;
            foreach (var part in licenceText.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var pieces = part.Split(':');
                var count = pieces.Length > 1 ? int.Parse(pieces[1]) : 1;
                switch (pieces[0].ToLowerInvariant())
                {
                    case "both": both = count; break;
                    case "android": android = count; break;
                    case "windows": windows = count; break;
                    default: throw new ArgumentException($"Unknown licence type '{pieces[0]}' (use both, android or windows).");
                }
            }
            licences = new LicenceCounts(android, windows, both);
        }
        return new CompanyPlan(flags["plan"], interval, addOns, paidUntil, licences);
    }

    private static (List<string> Positional, Dictionary<string, string> Flags) Parse(string[] args)
    {
        var positional = new List<string>();
        var flags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            if (args[i].StartsWith("--", StringComparison.Ordinal))
            {
                var key = args[i][2..];
                flags[key] = i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal) ? args[++i] : "true";
            }
            else
            {
                positional.Add(args[i]);
            }
        }
        return (positional, flags);
    }
}
