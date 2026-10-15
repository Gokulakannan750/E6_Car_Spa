using Xunit;

namespace CarSpaManagement.Api.Tests.TestSupport;

public sealed class ExternalProductFactAttribute : FactAttribute
{
    public ExternalProductFactAttribute(bool requiresDatabase = false)
    {
        Skip = ExternalProductTestScript.ToolSkipReason(ExternalProductTestScript.PowerShellPath, ExternalProductTestScript.PsqlPath, requiresDatabase);
        if (Skip is null && requiresDatabase && PostgresTestEnvironment.AdminConnectionString is null)
            Skip = $"External product PostgreSQL test: set {PostgresTestEnvironment.ConnectionVariable} to run.";
    }
}

public sealed class ExternalProductTheoryAttribute : TheoryAttribute
{
    public ExternalProductTheoryAttribute()
    {
        Skip = ExternalProductTestScript.ToolSkipReason(ExternalProductTestScript.PowerShellPath, ExternalProductTestScript.PsqlPath, true);
        if (Skip is null && PostgresTestEnvironment.AdminConnectionString is null)
            Skip = $"External product PostgreSQL test: set {PostgresTestEnvironment.ConnectionVariable} to run.";
    }
}
