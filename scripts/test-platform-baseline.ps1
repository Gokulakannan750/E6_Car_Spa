# Run the audit's baseline checks sequentially. Browser timing is sensitive to
# simultaneous backend builds and Vitest workers on the development machine.
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:CARSPA_TEST_PG_CONNECTION)) {
    throw 'Set CARSPA_TEST_PG_CONNECTION to a PostgreSQL test connection with database-creation permission.'
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    & dotnet test backend/CarSpaManagement.slnx
    if ($LASTEXITCODE -ne 0) { throw 'Backend baseline failed.' }

    & pnpm --dir apps/platform-admin type-check
    if ($LASTEXITCODE -ne 0) { throw 'Admin TypeScript check failed.' }

    & pnpm --dir apps/platform-admin test
    if ($LASTEXITCODE -ne 0) { throw 'Admin unit tests failed.' }

    & pnpm --dir apps/platform-admin test:e2e
    if ($LASTEXITCODE -ne 0) { throw 'Admin browser tests failed.' }

    & pnpm --dir apps/signup-web type-check
    if ($LASTEXITCODE -ne 0) { throw 'Sign-up TypeScript check failed.' }

    & pnpm --dir apps/signup-web test
    if ($LASTEXITCODE -ne 0) { throw 'Sign-up unit tests failed.' }

    & pnpm --dir apps/signup-web test:e2e
    if ($LASTEXITCODE -ne 0) { throw 'Sign-up browser tests failed.' }
}
finally {
    Pop-Location
}
