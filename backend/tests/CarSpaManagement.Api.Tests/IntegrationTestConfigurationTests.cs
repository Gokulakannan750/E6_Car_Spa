using CarSpaManagement.Api.Tests.TestSupport;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class IntegrationTestConfigurationTests
{
    [Fact]
    public void RequiredPostgresTestsHaveAConfiguredConnection()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("CARSPA_REQUIRE_PG_TESTS"), "true", StringComparison.OrdinalIgnoreCase))
            return;

        Assert.False(string.IsNullOrWhiteSpace(PostgresTestEnvironment.AdminConnectionString),
            $"PostgreSQL integration tests are required. Set {PostgresTestEnvironment.ConnectionVariable}; otherwise database tests would be silently skipped.");
    }
}
