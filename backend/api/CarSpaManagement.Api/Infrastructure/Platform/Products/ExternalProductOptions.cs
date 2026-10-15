using CarSpaManagement.Api.Domain.Platform;

namespace CarSpaManagement.Api.Infrastructure.Platform.Products;

public sealed class ExternalProductOptions
{
    public string Name { get; set; } = "";
    public string DatabasePrefix { get; set; } = "";
    public string TrialPlanCode { get; set; } = "";
    public SeatModel SeatModel { get; set; }
    public List<SeatTypeDefinition> SeatTypes { get; set; } = [];
    public List<FeatureDefinition> Features { get; set; } = [];
    public HashSet<string> Capabilities { get; set; } = [];
    public string MigrateCommand { get; set; } = "";
    public string MigrateArguments { get; set; } = "";
    public string? WorkingDirectory { get; set; }
    // Production default is five minutes; a shorter limit can be configured for tests/fast commands.
    public double MigrateTimeoutSeconds { get; set; } = 300;
    public List<ExternalPlanSeed> SeedPlans { get; set; } = [];
}

public sealed class ExternalPlanSeed
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public int SortOrder { get; set; }
    public string Currency { get; set; } = "INR";
    public long MonthlyPriceMinor { get; set; }
    public long YearlyPriceMinor { get; set; }
    public int IncludedSeats { get; set; }
    public Dictionary<string, ExternalSeatPriceSeed> SeatPrices { get; set; } = [];
    public Dictionary<string, string> Entitlements { get; set; } = [];
}

public sealed class ExternalSeatPriceSeed
{
    public long MonthlyPriceMinor { get; set; }
    public long YearlyPriceMinor { get; set; }
}
