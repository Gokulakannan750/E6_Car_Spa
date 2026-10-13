# Backend tests

Run the full API suite with `pnpm test:backend` or:

```powershell
dotnet test backend/tests/CarSpaManagement.Api.Tests
```

Without `CARSPA_TEST_PG_CONNECTION`, the real PostgreSQL tests are skipped. These tests cover transactions, concurrent payments, invoice numbering, migrations, database constraints, row-level security, and platform/company provisioning. EF InMemory does not exercise those database behaviors.

## Run with PostgreSQL

Use an isolated PostgreSQL 18 server. The test login must have permission to create/drop databases and roles. Tests create temporary `carspa_test_<guid>` databases and randomly named platform/company databases, apply migrations, and remove the databases after use. Some security tests also create dedicated test roles. Do not point this suite at a production database server.

Example for a local test server on port 55439:

```powershell
$env:CARSPA_TEST_PG_CONNECTION = 'Host=127.0.0.1;Port=55439;Database=postgres;Username=postgres;Password=your-test-password;CommandTimeout=180'
pnpm test:backend:integration
```

The integration command refuses to run without a connection, enables `CARSPA_REQUIRE_PG_TESTS`, preserves the test runner's exit code, and requires a non-empty test report with zero skips. Each run writes its own TRX report under `scratch/test-results/backend-integration`. PowerShell 7 (`pwsh`) is required for the wrapper; the direct `dotnet test` command works on other platforms when the same environment variables are set.

Run a specific area when investigating a failure:

```powershell
pwsh -NoProfile -File scripts/test-backend-integration.ps1 -Filter 'FullyQualifiedName~PaymentConcurrencyPostgresTests|FullyQualifiedName~RowLevelSecurityPostgresTests'
```

The runner limits parallel test collections to four to avoid overwhelming the database with simultaneous schema migrations. Individual concurrency tests still issue simultaneous payment/invoice requests.

## CI

The backend job provisions PostgreSQL 18 with a health check and sets both test environment variables. `IntegrationTestConfigurationTests` fails when database tests are required but no connection is configured, preventing a missing connection from turning database coverage into a successful run with skipped tests. The job also verifies that its TRX report has tests and no skipped results. Test failures fail the CI job, and its report is uploaded for diagnosis.
