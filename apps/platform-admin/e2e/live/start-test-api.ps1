param(
    [Parameter(Mandatory)][ValidatePattern('^pts6[a-z0-9]{8,16}$')][string]$ProductKey,
    [switch]$CreateOwner,
    [switch]$ResetOwner,
    [ValidateRange(1024,65535)][int]$Port = 5321
)
$ErrorActionPreference = 'Stop'
if (-not $env:CARSPA_TEST_PG_CONNECTION) { throw 'Set CARSPA_TEST_PG_CONNECTION in the process environment.' }
$connection = [System.Data.Common.DbConnectionStringBuilder]::new()
$connection.set_ConnectionString($env:CARSPA_TEST_PG_CONNECTION)
if ($connection.get_Item('Host') -notin @('localhost','127.0.0.1')) { throw 'This helper requires local throwaway PostgreSQL.' }
$connection.set_Item('Database', 'postgres')
$env:ConnectionStrings__PlatformAdmin = $connection.get_ConnectionString()
$connection.set_Item('Database', "${ProductKey}_catalog")
$env:ConnectionStrings__Platform = $connection.get_ConnectionString()
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = "http://localhost:$Port"
$env:Platform__Enabled = 'true'
$env:Platform__ProductKey = $ProductKey
$env:Platform__ProductName = 'Car Spa'
$env:Security__EncryptionKey = 'stage-six-isolated-encryption-test-key'
$env:Jwt__Key = 'stage-six-company-token-signing-test-key-48-characters'
$env:Platform__Jwt__Key = 'stage-six-platform-token-signing-test-key-48-characters'
$env:Logging__LogLevel__Default = 'Warning'
$env:Logging__LogLevel__Microsoft = 'Warning'
$env:Platform__ExternalProducts__demo__Name = 'Demo'
$env:Platform__ExternalProducts__demo__DatabasePrefix = "${ProductKey}_demo"
$env:Platform__ExternalProducts__demo__TrialPlanCode = 'basic'
$env:Platform__ExternalProducts__demo__SeatModel = 'None'
$env:Platform__ExternalProducts__demo__MigrateCommand = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$script = Join-Path $repo 'backend/tests/CarSpaManagement.Api.Tests/TestSupport/Scripts/external-product-test.ps1'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
if (-not (Test-Path -LiteralPath $psql)) { throw 'psql is required for the live external product check.' }
$env:Platform__ExternalProducts__demo__MigrateArguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$script`" -Mode context -Psql `"$psql`""
$env:Platform__ExternalProducts__demo__Features__0__Key = 'demo.enabled'
$env:Platform__ExternalProducts__demo__Features__0__ValueType = 'Bool'
$env:Platform__ExternalProducts__demo__Features__0__Label = 'Project workspace'
$env:Platform__ExternalProducts__demo__Features__0__SortOrder = '1'
$env:Platform__ExternalProducts__demo__SeedPlans__0__Code = 'basic'
$env:Platform__ExternalProducts__demo__SeedPlans__0__Name = 'Demo workspace'
$env:Platform__ExternalProducts__demo__SeedPlans__0__MonthlyPriceMinor = '1234'
$env:Platform__ExternalProducts__demo__SeedPlans__0__YearlyPriceMinor = '12340'
[Environment]::SetEnvironmentVariable('Platform__ExternalProducts__demo__SeedPlans__0__Entitlements__demo.enabled', 'true', 'Process')
$dll = Join-Path $repo 'backend/api/CarSpaManagement.Api/bin/Debug/net10.0/CarSpaManagement.Api.dll'
if ($CreateOwner) {
    & dotnet $dll platform create-admin 'stage6-owner@trovo.test' 'Stage Six Owner'
} elseif ($ResetOwner) {
    & dotnet $dll platform reset-admin 'stage6-owner@trovo.test'
} else {
    & dotnet $dll
}
exit $LASTEXITCODE
