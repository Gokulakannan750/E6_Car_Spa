[CmdletBinding()]
param(
    [string]$ConnectionString = $env:CARSPA_TEST_PG_CONNECTION,
    [string]$Filter,
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Debug',
    [switch]$NoRestore,
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    throw 'Set CARSPA_TEST_PG_CONNECTION to an isolated PostgreSQL test server before running integration tests.'
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$projectPath = Join-Path $repositoryRoot 'backend/tests/CarSpaManagement.Api.Tests/CarSpaManagement.Api.Tests.csproj'
$resultsPath = Join-Path $repositoryRoot 'scratch/test-results/backend-integration'
$reportName = 'backend-integration-' + [Guid]::NewGuid().ToString('N') + '.trx'
$previousConnection = $env:CARSPA_TEST_PG_CONNECTION
$previousRequirement = $env:CARSPA_REQUIRE_PG_TESTS
$testExitCode = 1

try {
    $env:CARSPA_TEST_PG_CONNECTION = $ConnectionString
    $env:CARSPA_REQUIRE_PG_TESTS = 'true'
    $testArguments = @(
        'test', $projectPath,
        '--configuration', $Configuration,
        '--logger', "trx;LogFileName=$reportName",
        '--results-directory', $resultsPath
    )
    if ($Filter) { $testArguments += @('--filter', $Filter) }
    if ($NoRestore) { $testArguments += '--no-restore' }
    if ($NoBuild) { $testArguments += '--no-build' }

    & dotnet @testArguments
    $testExitCode = $LASTEXITCODE
    if ($testExitCode -eq 0) {
        [xml]$report = Get-Content -LiteralPath (Join-Path $resultsPath $reportName)
        $counters = $report.TestRun.ResultSummary.Counters
        if ([int]$counters.total -eq 0 -or [int]$counters.notExecuted -gt 0) {
            throw 'Integration coverage is incomplete: the selected tests must execute without skips.'
        }
    }
} finally {
    $env:CARSPA_TEST_PG_CONNECTION = $previousConnection
    $env:CARSPA_REQUIRE_PG_TESTS = $previousRequirement
}

exit $testExitCode
