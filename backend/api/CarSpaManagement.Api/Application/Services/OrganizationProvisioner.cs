using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Application.Services;

/// <summary>
/// Gives a company the starting data it needs: its business profile, system preferences and the standard
/// showroom reference lists. Runs for the company the database context is currently working for, is safe to
/// repeat, and is used both at start-up (for every company) and when a new company is created.
/// </summary>
public class OrganizationProvisioner(AppDbContext db, IConfiguration configuration)
{
    public async Task SeedDefaultsAsync(bool includeDevelopmentDemoData, CancellationToken cancellationToken = default)
    {
        await ShowroomOperationsSeeder.SeedAsync(db);

        // The company's GST and non-GST invoice numbering series (GST/0001 and BILL/0001 by default).
        await new InvoiceNumberAllocator(db).GetOrCreateSeriesAsync(cancellationToken);

        if (!await db.BusinessProfiles.AnyAsync(cancellationToken))
        {
            var section = configuration.GetSection("DefaultBusinessProfile");
            var profile = new BusinessProfile
            {
                Id = Guid.NewGuid(),
                SingletonKey = 1,
                // Nothing company-specific is built in: a new company starts empty (or with the deployment's own
                // DefaultBusinessProfile configuration) and fills in Company Settings.
                BusinessName = section["BusinessName"] ?? string.Empty,
                AddressLine1 = section["AddressLine1"] ?? string.Empty,
                AddressLine2 = section["AddressLine2"],
                City = section["City"] ?? string.Empty,
                State = section["State"] ?? string.Empty,
                PostalCode = section["PostalCode"] ?? string.Empty,
                Phone = section["Phone"] ?? string.Empty,
                Email = section["Email"] ?? string.Empty,
                Gstin = section["Gstin"],
                LogoPath = section["LogoPath"],
                Tagline = section["Tagline"],
                InvoicePrefix = section["InvoicePrefix"] ?? "INV",
                CreatedAt = DateTime.UtcNow
            };
            db.BusinessProfiles.Add(profile);
            await db.SaveChangesAsync(cancellationToken);
            Log.Information("Seeded default business profile ({BusinessName})", profile.BusinessName);
        }

        if (!await db.SystemPreferences.AnyAsync(cancellationToken))
        {
            db.SystemPreferences.Add(new SystemPreference
            {
                Id = Guid.NewGuid(),
                SingletonKey = 1,
                DateFormat = "DD/MM/YYYY",
                TimeFormat = "12h",
                CurrencySymbol = "₹",
                DecimalPrecision = 2,
                DefaultPrintCopies = 1,
                AutoPrintReceipt = true,
                RefreshInterval = 30,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync(cancellationToken);
            Log.Information("Seeded default System Preferences");
        }

        // Development-only demo data: these vendors are fictitious and must never be created in production.
        if (includeDevelopmentDemoData && !await db.Vendors.AnyAsync(cancellationToken))
        {
            db.Vendors.AddRange(
                NewVendor("Sri Lakshmi Auto Works", "9842712345", "Ramesh Kumar", "Perundurai Road, Erode", "Denting & Painting"),
                NewVendor("Sri Krishna Wheel Alignment & Tyres", "9443356789", "Senthil Nathan", "Bhavani Main Road, Erode", "Wheel Alignment & Balancing"),
                NewVendor("Erode Auto Electricians & AC", "9842498765", "Murugan", "Sathy Road, Erode", "Electrical & AC Work"));
            await db.SaveChangesAsync(cancellationToken);
            Log.Information("Seeded DEVELOPMENT demo vendors (not created outside Development)");
        }
    }

    private static Vendor NewVendor(string name, string phone, string contact, string address, string specialty) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        Phone = phone,
        ContactPerson = contact,
        Address = address,
        ServiceSpecialty = specialty,
        IsActive = true,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };
}
