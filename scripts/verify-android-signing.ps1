<#
.SYNOPSIS
    Verifies Android debug signing and release credential fail-closed behavior.
.DESCRIPTION
    Runs assembleDebug, then requests assembleRelease with all release credential
    sources disabled using a Gradle project property. No local key.properties is
    read or modified, and no signing values are printed.
#>

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$AndroidDir = Join-Path $RepoRoot 'apps\android\android'
$GradleWrapper = Join-Path $AndroidDir 'gradlew.bat'

if (-not (Test-Path -LiteralPath $GradleWrapper -PathType Leaf)) {
    throw "Gradle wrapper not found: $GradleWrapper"
}

Write-Host '==> 1. Verifying assembleDebug succeeds...' -ForegroundColor Cyan
& $GradleWrapper -p $AndroidDir assembleDebug
if ($LASTEXITCODE -ne 0) {
    throw "assembleDebug failed with exit code $LASTEXITCODE."
}
Write-Host 'SUCCESS: assembleDebug completed successfully.' -ForegroundColor Green

Write-Host '==> 2. Verifying assembleRelease fails without credentials...' -ForegroundColor Cyan
$oldValues = @{
    STORE_FILE = $env:STORE_FILE
    KEY_ALIAS = $env:KEY_ALIAS
    STORE_PASSWORD = $env:STORE_PASSWORD
    KEY_PASSWORD = $env:KEY_PASSWORD
}
$env:STORE_FILE = ''
$env:KEY_ALIAS = ''
$env:STORE_PASSWORD = ''
$env:KEY_PASSWORD = ''

try {
    $releaseLogBase = Join-Path $env:TEMP ([Guid]::NewGuid().ToString('N'))
    $releaseStdout = "$releaseLogBase.stdout.log"
    $releaseStderr = "$releaseLogBase.stderr.log"
    $process = Start-Process -FilePath $GradleWrapper `
        -ArgumentList @('-p', $AndroidDir, '-P', 'e6.ignoreReleaseSigningCredentials=true', 'assembleRelease') `
        -NoNewWindow -Wait -PassThru -RedirectStandardOutput $releaseStdout -RedirectStandardError $releaseStderr
    $releaseExit = $process.ExitCode
    $releaseOutput = (Get-Content -LiteralPath $releaseStdout -Raw -ErrorAction SilentlyContinue) + `
        (Get-Content -LiteralPath $releaseStderr -Raw -ErrorAction SilentlyContinue)
    Remove-Item -LiteralPath $releaseStdout, $releaseStderr -Force -ErrorAction SilentlyContinue

    if ($releaseExit -eq 0) {
        throw 'assembleRelease unexpectedly succeeded without credentials.'
    }

    $normalizedReleaseOutput = [regex]::Replace($releaseOutput, '\s+', ' ')
    $expectedFields = @('storeFile', 'keyAlias', 'storePassword', 'keyPassword')
    foreach ($field in $expectedFields) {
        if ($normalizedReleaseOutput -notmatch [regex]::Escape($field)) {
            throw "assembleRelease failed without naming missing field '$field'. Output:`n$releaseOutput"
        }
    }

    if ($normalizedReleaseOutput -notmatch 'Release build failed: Missing required release signing credentials') {
        throw "assembleRelease failed without the expected signing diagnostic. Output:`n$releaseOutput"
    }

    Write-Host 'SUCCESS: assembleRelease failed with all missing credential fields identified.' -ForegroundColor Green
} finally {
    foreach ($name in $oldValues.Keys) {
        if ($null -eq $oldValues[$name]) {
            Remove-Item "Env:\$name" -ErrorAction SilentlyContinue
        } else {
            Set-Item "Env:\$name" $oldValues[$name]
        }
    }
}
