using Microsoft.AspNetCore.Hosting;

namespace CarSpaManagement.Api.Tests.TestSupport;

internal static class ExternalProductTestScript
{
    internal static string? PowerShellPath { get; } = FindPowerShell();
    internal static string? PsqlPath { get; } = FindPsql();
    internal static string Command => PowerShellPath ?? (OperatingSystem.IsWindows() ? "powershell.exe" : "pwsh");

    private static string? OnPath(string executable) =>
        (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(dir => Path.Combine(dir.Trim('"'), executable)).FirstOrDefault(File.Exists);

    private static string? FindPowerShell()
    {
        var found = OnPath(OperatingSystem.IsWindows() ? "powershell.exe" : "pwsh")
            ?? OnPath(OperatingSystem.IsWindows() ? "pwsh.exe" : "powershell");
        if (found is not null || !OperatingSystem.IsWindows()) return found;
        var bundled = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe");
        return File.Exists(bundled) ? bundled : null;
    }

    private static string? FindPsql()
    {
        var found = OnPath(OperatingSystem.IsWindows() ? "psql.exe" : "psql");
        if (found is not null || !OperatingSystem.IsWindows()) return found;
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PostgreSQL");
        if (!Directory.Exists(root)) return null;
        try
        {
            return Directory.EnumerateDirectories(root).OrderByDescending(d => d)
                .Select(dir => Path.Combine(dir, "bin", "psql.exe")).FirstOrDefault(File.Exists);
        }
        catch (UnauthorizedAccessException) { return null; }
    }

    internal static string? ToolSkipReason(string? powerShell, string? psql, bool needsPsql)
    {
        if (powerShell is null) return "External product script test: PowerShell is unavailable; install PowerShell (powershell.exe or pwsh) to run.";
        if (needsPsql && psql is null) return "External product script test: psql is unavailable; install the PostgreSQL client tools and add psql to PATH to run.";
        return null;
    }

    internal static string Arguments(string mode = "context", bool provision = false)
    {
        var script = Path.Combine(AppContext.BaseDirectory, "TestSupport", "Scripts", "external-product-test.ps1");
        var args = $"-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{script}\" -Mode {mode}";
        // Missing tools are handled by discovery-time test attributes, not by configuration enumeration.
        if (provision) args += $" -Psql \"{PsqlPath ?? "psql"}\"";
        return args;
    }
    internal static void Configure(IDictionary<string, string?> settings, string prefix)
    {
        const string section = "Platform:ExternalProducts:demo:";
        settings[section + "Name"] = "Demo";
        settings[section + "DatabasePrefix"] = prefix + "_demo";
        settings[section + "TrialPlanCode"] = "demo_trial";
        settings[section + "SeatModel"] = "None";
        settings[section + "MigrateCommand"] = Command;
        settings[section + "MigrateArguments"] = Arguments(provision: true);
        settings[section + "SeedPlans:0:Code"] = "demo_trial";
        settings[section + "SeedPlans:0:Name"] = "Demo plan";
        settings[section + "SeedPlans:0:MonthlyPriceMinor"] = "1234";
        settings[section + "SeedPlans:0:YearlyPriceMinor"] = "12340";
        settings[section + "Features:0:Key"] = "demo.enabled";
        settings[section + "Features:0:ValueType"] = "Bool";
        settings[section + "Features:0:Label"] = "Demo access";
        settings[section + "Features:0:SortOrder"] = "1";
        settings[section + "SeedPlans:0:Entitlements:demo.enabled"] = "true";
        settings["Platform:SignupEnabled"] = "true";
    }
    internal static void Configure(IWebHostBuilder builder, string prefix)
    {
        var values = new Dictionary<string, string?>();
        Configure(values, prefix);
        foreach (var (key, value) in values) builder.UseSetting(key, value);
    }
}
