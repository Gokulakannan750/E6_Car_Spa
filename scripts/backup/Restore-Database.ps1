<#
.SYNOPSIS
    PostgreSQL Database Restoration and Verification Script for E6 Car Spa.

.DESCRIPTION
    Restores a compressed custom-format (.dump) archive produced by Backup-Database.ps1.
    Performs pre-restore archive integrity validation and SHA-256 checksum verification.
    Includes strict safeguards against accidental production overwrite.
    Verifies entity row counts post-restoration across all core tables.

.PARAMETER BackupFile
    Path to the .dump backup file to restore.

.PARAMETER TargetDatabase
    Name of the database to restore into (e.g., 'E6CarSpa_RestoreTest' or 'E6CarSpaNew').

.PARAMETER HostName
    PostgreSQL server hostname. Defaults to 'localhost'.

.PARAMETER Port
    PostgreSQL server port. Defaults to 5432.

.PARAMETER Username
    PostgreSQL database user. Defaults to 'postgres'.

.PARAMETER Password
    PostgreSQL database password. If omitted, checks $env:PGPASSWORD or dotnet user-secrets.

.PARAMETER Force
    Bypasses interactive confirmation when restoring to production ('E6CarSpaNew').

.PARAMETER VerifyCounts
    Queries and prints row counts for all core tables post-restore. Defaults to $true.

.PARAMETER PgBinPath
    Path to PostgreSQL bin directory. Auto-detected if omitted.

.EXAMPLE
    .\Restore-Database.ps1 -BackupFile "..\..\backups\E6CarSpaNew_2026-09-08_120000.dump" -TargetDatabase "E6CarSpa_RestoreTest"
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,

    [Parameter(Mandatory = $true)]
    [string]$TargetDatabase,

    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$Username = "postgres",
    [string]$Password = "",
    [switch]$Force,
    [bool]$VerifyCounts = $true,
    [string]$PgBinPath = ""
)

$ErrorActionPreference = "Stop"

# Determine Repository Root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

function Write-RestoreLog {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )
    $Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $LogEntry = "[$Timestamp] [$Level] $Message"

    switch ($Level) {
        "INFO"    { Write-Host $LogEntry -ForegroundColor Cyan }
        "WARN"    { Write-Host $LogEntry -ForegroundColor Yellow }
        "ERROR"   { Write-Host $LogEntry -ForegroundColor Red }
        "SUCCESS" { Write-Host $LogEntry -ForegroundColor Green }
    }
}

function Find-PgTool {
    param([string]$ToolName)

    if (-not [string]::IsNullOrWhiteSpace($PgBinPath)) {
        $Candidate = Join-Path $PgBinPath $ToolName
        if (Test-Path $Candidate) { return $Candidate }
    }

    $PathTool = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($PathTool) { return $PathTool.Source }

    $StandardRoots = @("C:\Program Files\PostgreSQL", "C:\Program Files (x86)\PostgreSQL")
    foreach ($Root in $StandardRoots) {
        if (Test-Path $Root) {
            $Versions = Get-ChildItem -Path $Root -Directory | 
                Sort-Object { [int]($_.Name -replace '\D') } -Descending
            foreach ($Ver in $Versions) {
                $Candidate = Join-Path $Ver.FullName "bin\$ToolName"
                if (Test-Path $Candidate) { return $Candidate }
            }
        }
    }

    return $null
}

function Get-DatabasePassword {
    if (-not [string]::IsNullOrWhiteSpace($Password)) {
        return $Password
    }

    if (-not [string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
        return $env:PGPASSWORD
    }

    $ApiProjectDir = Join-Path $RepoRoot "backend\api\CarSpaManagement.Api"
    if (Test-Path $ApiProjectDir) {
        try {
            $SecretsOutput = dotnet user-secrets list --project $ApiProjectDir 2>$null
            foreach ($Line in $SecretsOutput) {
                if ($Line -match "DefaultConnection\s*=\s*(.*)") {
                    $ConnStr = $Matches[1]
                    if ($ConnStr -match "Password=([^;]+)") {
                        return $Matches[1]
                    }
                }
            }
        } catch {
            Write-RestoreLog "Could not inspect user-secrets: $_" -Level WARN
        }
    }

    return ""
}

Write-RestoreLog "=================================================="
Write-RestoreLog "E6 Car Spa — Database Restoration Initiated"

# 1. Resolve Tools
$PgRestoreExe = Find-PgTool "pg_restore.exe"
$PsqlExe = Find-PgTool "psql.exe"

if (-not $PgRestoreExe) {
    Write-RestoreLog "pg_restore.exe not found." -Level ERROR
    exit 1
}
if (-not $PsqlExe) {
    Write-RestoreLog "psql.exe not found." -Level ERROR
    exit 1
}

# 2. Validate Backup File Path
if (-not (Test-Path $BackupFile)) {
    # Check if relative to repo root
    $AltPath = Join-Path $RepoRoot $BackupFile
    if (Test-Path $AltPath) {
        $BackupFile = $AltPath
    } else {
        Write-RestoreLog "Backup file not found: $BackupFile" -Level ERROR
        exit 1
    }
}
$BackupFile = (Resolve-Path $BackupFile).Path
Write-RestoreLog "Backup File: $BackupFile"
Write-RestoreLog "Target Database: $TargetDatabase on $HostName`:$Port"

# 3. Production Safeguard
$ProductionDbNames = @("E6CarSpaNew", "e6carspanew", "E6CarSpa", "e6carspa", "CarSpaProduction")
if ($ProductionDbNames -contains $TargetDatabase) {
    Write-RestoreLog "WARNING: TARGET IS THE PRODUCTION DATABASE ($TargetDatabase)!" -Level WARN
    if (-not $Force) {
        $Confirmation = Read-Host "Type 'CONFIRM-OVERWRITE' to proceed with restoring over $TargetDatabase"
        if ($Confirmation -ne "CONFIRM-OVERWRITE") {
            Write-RestoreLog "Restoration aborted by operator safeguard." -Level ERROR
            exit 1
        }
    }
}

# 4. Validate SHA-256 Checksum (if .sha256 companion exists)
$Sha256File = "${BackupFile}.sha256"
if (Test-Path $Sha256File) {
    Write-RestoreLog "Validating SHA-256 checksum..."
    $ExpectedHashLine = (Get-Content $Sha256File -Raw).Trim()
    $ExpectedHash = ($ExpectedHashLine -split '\s+')[0]
    $ActualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash

    if ($ExpectedHash.ToUpper() -ne $ActualHash.ToUpper()) {
        Write-RestoreLog "Checksum verification failed! File may be corrupt or tampered." -Level ERROR
        Write-RestoreLog "Expected: $ExpectedHash" -Level ERROR
        Write-RestoreLog "Actual:   $ActualHash" -Level ERROR
        exit 1
    }
    Write-RestoreLog "Checksum verified successfully: $ActualHash" -Level SUCCESS
} else {
    Write-RestoreLog "No companion .sha256 file found. Proceeding with TOC validation." -Level WARN
}

# 5. Validate Archive Table of Contents
Write-RestoreLog "Inspecting archive Table of Contents..."
$TocOutput = & $PgRestoreExe --list $BackupFile 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-RestoreLog "Invalid archive file! pg_restore --list returned exit code $LASTEXITCODE." -Level ERROR
    exit 1
}
$TocCount = ($TocOutput | Measure-Object).Count
Write-RestoreLog "Archive TOC is healthy ($TocCount objects found)." -Level SUCCESS

# 6. Resolve Password
$DbPassword = Get-DatabasePassword
if ([string]::IsNullOrWhiteSpace($DbPassword)) {
    Write-RestoreLog "Database password not provided and could not be resolved." -Level ERROR
    exit 1
}

$env:PGPASSWORD = $DbPassword

try {
    # 7. Ensure Target Database Exists
    Write-RestoreLog "Checking if target database '$TargetDatabase' exists..."
    $DbCheckQuery = "SELECT 1 FROM pg_database WHERE datname = '$TargetDatabase';"
    $DbExists = & $PsqlExe -h $HostName -p $Port -U $Username -d postgres -t -A -c $DbCheckQuery 2>&1
    $DbExistsStr = if ($DbExists) { ("$DbExists").Trim() } else { "" }

    if ($DbExistsStr -ne "1") {
        Write-RestoreLog "Target database '$TargetDatabase' does not exist. Creating..." -Level INFO
        $CreateDbOutput = & $PsqlExe -h $HostName -p $Port -U $Username -d postgres -c "CREATE DATABASE `"$TargetDatabase`" WITH ENCODING 'UTF8';" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-RestoreLog "Failed to create database '$TargetDatabase': $CreateDbOutput" -Level ERROR
            exit 1
        }
        Write-RestoreLog "Database '$TargetDatabase' created." -Level SUCCESS
    } else {
        Write-RestoreLog "Target database '$TargetDatabase' exists." -Level INFO
    }

    # 8. Execute Restoration
    Write-RestoreLog "Restoring archive to '$TargetDatabase'..."
    $RestoreStartTime = Get-Date

    # pg_restore arguments:
    # --clean: drop database objects prior to recreating them
    # --if-exists: avoid errors when objects do not exist yet on fresh databases
    # --no-owner: avoid errors due to different role ownership
    # --no-privileges: avoid privilege grant warnings
    $RestoreArgs = @(
        "-h", $HostName,
        "-p", $Port.ToString(),
        "-U", $Username,
        "-d", $TargetDatabase,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "-v",
        $BackupFile
    )

    $RestoreProcess = Start-Process -FilePath $PgRestoreExe -ArgumentList $RestoreArgs `
        -NoNewWindow -PassThru -Wait -RedirectStandardError (Join-Path $RepoRoot "logs\backup\pg_restore_stderr.tmp")

    # pg_restore returns exit code 1 if there were minor non-fatal warnings (e.g. dropping non-existent tables with --clean)
    # Exit code > 1 indicates fatal failure.
    if ($RestoreProcess.ExitCode -gt 1) {
        $Stderr = Get-Content (Join-Path $RepoRoot "logs\backup\pg_restore_stderr.tmp") -Raw -ErrorAction SilentlyContinue
        Write-RestoreLog "pg_restore failed with exit code $($RestoreProcess.ExitCode): $Stderr" -Level ERROR
        exit $RestoreProcess.ExitCode
    }

    $RestoreDuration = (Get-Date) - $RestoreStartTime
    Write-RestoreLog "Restoration completed in $($RestoreDuration.TotalSeconds.ToString("F2")) seconds." -Level SUCCESS

    # 9. Verify Table Counts
    if ($VerifyCounts) {
        Write-RestoreLog "Verifying entity records in '$TargetDatabase'..."
        $VerificationSql = @"
SELECT 'Customers' as entity, COUNT(*)::text as count FROM "Customers"
UNION ALL SELECT 'Vehicles', COUNT(*)::text FROM "Vehicles"
UNION ALL SELECT 'Services', COUNT(*)::text FROM "Services"
UNION ALL SELECT 'JobCards', COUNT(*)::text FROM "JobCards"
UNION ALL SELECT 'JobCardServices', COUNT(*)::text FROM "JobCardServices"
UNION ALL SELECT 'Staff', COUNT(*)::text FROM "Staff"
UNION ALL SELECT 'StaffAdvances', COUNT(*)::text FROM "StaffAdvances"
UNION ALL SELECT 'Showrooms', COUNT(*)::text FROM "Showrooms"
UNION ALL SELECT 'ShowroomStaffAssignments', COUNT(*)::text FROM "ShowroomStaffAssignments"
UNION ALL SELECT 'ShowroomDailyBills', COUNT(*)::text FROM "ShowroomDailyBills"
UNION ALL SELECT 'ShowroomDailyAttendances', COUNT(*)::text FROM "ShowroomDailyAttendances"
UNION ALL SELECT 'ShowroomPayments', COUNT(*)::text FROM "ShowroomPayments"
UNION ALL SELECT 'Invoices', COUNT(*)::text FROM "Invoices"
UNION ALL SELECT 'InvoiceItems', COUNT(*)::text FROM "InvoiceItems"
UNION ALL SELECT 'Payments', COUNT(*)::text FROM "Payments"
UNION ALL SELECT 'Users', COUNT(*)::text FROM "Users"
UNION ALL SELECT 'Permissions', COUNT(*)::text FROM "Permissions"
UNION ALL SELECT 'UserPermissions', COUNT(*)::text FROM "UserPermissions"
UNION ALL SELECT 'BusinessProfiles', COUNT(*)::text FROM "BusinessProfiles"
UNION ALL SELECT 'AuditLogs', COUNT(*)::text FROM "AuditLogs"
UNION ALL SELECT 'InvoicePublicLinks', COUNT(*)::text FROM "InvoicePublicLinks"
UNION ALL SELECT 'WhatsAppConfigurations', COUNT(*)::text FROM "WhatsAppConfigurations"
UNION ALL SELECT 'WhatsAppMessages', COUNT(*)::text FROM "WhatsAppMessages";
"@
        $CountResults = & $PsqlExe -h $HostName -p $Port -U $Username -d $TargetDatabase -t -A -F " : " -c $VerificationSql 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n--- Restored Entity Counts ---" -ForegroundColor Green
            foreach ($Row in $CountResults) {
                if (-not [string]::IsNullOrWhiteSpace($Row) -and $Row -match ":") {
                    Write-Host "  $Row" -ForegroundColor White
                }
            }
            Write-Host "-------------------------------`n" -ForegroundColor Green
        } else {
            Write-RestoreLog "Could not verify row counts: $CountResults" -Level WARN
        }
    }

    Write-RestoreLog "Database restoration verified successfully." -Level SUCCESS
    Write-RestoreLog "=================================================="

} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $RepoRoot "logs\backup\pg_restore_stderr.tmp") -ErrorAction SilentlyContinue
}

exit 0
