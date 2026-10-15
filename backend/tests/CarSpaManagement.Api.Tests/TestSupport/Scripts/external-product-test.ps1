param([string]$Mode = 'context', [string]$Psql, [string]$InvocationMarker)
$ErrorActionPreference = 'Stop'
if ($InvocationMarker) { [IO.File]::AppendAllText($InvocationMarker, $env:TROVO_COMPANY_ID + "`n") }
if ($Mode -eq 'context') { $Mode = $env:TROVO_COMPANY_NAME }
switch ($Mode) {
    'fail' { [Console]::Error.Write('failure-' + ('x' * 1500)); exit 7 }
    'secret' { [Console]::Error.Write($env:TROVO_ADMIN_DATABASE_URL + "`n" + ('e' * 1500)); exit 8 }
    'timeout' { Start-Sleep -Seconds 30; exit 0 }
}
foreach ($name in @('TROVO_COMPANY_ID','TROVO_COMPANY_CODE','TROVO_COMPANY_NAME','TROVO_DATABASE_NAME','TROVO_ADMIN_DATABASE_URL')) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) { exit 9 }
}
if ($Psql) {
    # Mock the external product's idempotent schema migration and company record, using only the child environment.
    $sql = 'CREATE TABLE IF NOT EXISTS company (id uuid PRIMARY KEY, code text NOT NULL, name text NOT NULL); ' +
        "INSERT INTO company VALUES ('$env:TROVO_COMPANY_ID', '$env:TROVO_COMPANY_CODE', 'Demo company') ON CONFLICT (id) DO NOTHING;"
    # Use stdin for SQL and the environment for the connection, never command-line credentials.
    $connection = [Uri]$env:TROVO_ADMIN_DATABASE_URL
    $credentials = $connection.UserInfo.Split(':', 2)
    $env:PGHOST = $connection.Host
    $env:PGPORT = $connection.Port.ToString()
    $env:PGDATABASE = [Uri]::UnescapeDataString($connection.AbsolutePath.TrimStart('/'))
    $env:PGUSER = [Uri]::UnescapeDataString($credentials[0])
    $env:PGPASSWORD = [Uri]::UnescapeDataString($credentials[1])
    $sql | & $Psql -X -q -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
[Console]::Out.WriteLine('migration progress')
[Console]::Out.WriteLine('demo-v1')
[Console]::Out.WriteLine('')
exit 0
