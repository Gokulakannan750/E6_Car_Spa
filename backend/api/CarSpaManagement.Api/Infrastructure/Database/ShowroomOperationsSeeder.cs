using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Database;

public static class ShowroomOperationsSeeder
{
    public static readonly (string Code, string Name, int DisplayOrder)[] StandardVehicleTypes =
    [
        ("HATCHBACK", "Hatchback", 1),
        ("SEDAN", "Sedan", 2),
        ("SUV_MUV", "SUV/MUV", 3),
        ("BIKE", "Bike", 4),
        ("SCOOTER", "Scooter", 5)
    ];

    public static readonly (string Code, string Name, string Description, int DisplayOrder)[] StandardWorkTypes =
    [
        ("BODY_WASH", "Body Wash", "Complete exterior body wash and drying", 1),
        ("INTERIOR_CLEANING", "Interior Cleaning", "Interior vacuuming, dashboard and upholstery cleaning", 2),
        ("TEFLON_COATING", "Teflon Coating", "Protective teflon paint sealant application", 3),
        ("CERAMIC_COATING", "Ceramic Coating", "Multi-layer nano ceramic paint protection coating", 4),
        ("WAXING", "Waxing", "High-gloss protective carnauba wax application", 5),
        ("POLISHING", "Polishing", "Machine swirl removal and surface gloss restoration", 6),
        ("OTHER", "Other", "Custom or miscellaneous dealership service task", 7)
    ];

    public static async Task SeedAsync(AppDbContext db)
    {
        // 1. Seed Vehicle Types Idempotently
        var existingVehicleCodes = await db.ShowroomVehicleTypes
            .IgnoreQueryFilters()
            .Select(t => t.Code)
            .ToHashSetAsync();

        var missingVehicleTypes = StandardVehicleTypes
            .Where(vt => !existingVehicleCodes.Contains(vt.Code))
            .Select(vt => new ShowroomVehicleType
            {
                Id = Guid.NewGuid(),
                Code = vt.Code,
                Name = vt.Name,
                DisplayOrder = vt.DisplayOrder,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (missingVehicleTypes.Count > 0)
        {
            await db.ShowroomVehicleTypes.AddRangeAsync(missingVehicleTypes);
            await db.SaveChangesAsync();
            Log.Information("Idempotently seeded {Count} showroom vehicle types into database", missingVehicleTypes.Count);
        }

        // 2. Seed Work Types Idempotently
        var existingWorkCodes = await db.ShowroomWorkTypes
            .IgnoreQueryFilters()
            .Select(w => w.Code)
            .ToHashSetAsync();

        var missingWorkTypes = StandardWorkTypes
            .Where(wt => !existingWorkCodes.Contains(wt.Code))
            .Select(wt => new ShowroomWorkType
            {
                Id = Guid.NewGuid(),
                Code = wt.Code,
                Name = wt.Name,
                Description = wt.Description,
                DisplayOrder = wt.DisplayOrder,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (missingWorkTypes.Count > 0)
        {
            await db.ShowroomWorkTypes.AddRangeAsync(missingWorkTypes);
            await db.SaveChangesAsync();
            Log.Information("Idempotently seeded {Count} showroom work types into database", missingWorkTypes.Count);
        }
    }
}
