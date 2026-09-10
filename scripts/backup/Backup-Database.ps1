<#
.SYNOPSIS
    Automated PostgreSQL Database Backup Script for E6 Car Spa.

.DESCRIPTION
    Creates a compressed custom-format PostgreSQL backup using pg_dump (-F c).
    Validates backup integrity using pg_restore Table of Contents inspection.
    Generates a SHA-256 integrity checksum.
    Applies a safe retention policy (default: 30 days) guaranteeing that the
    latest valid backup is never pruned.
    Redacts credentials from all logs and process listings.

.PARAMETER DatabaseName
    Name of the database to back up. Defaults to 'E6CarSpaNew'.

.PARAMETER HostName
    PostgreSQL server hostname. Defaults to 'localhost'.

.PARAMETER Port
    PostgreSQL server port. Defaults to 5432.

.PARAMETER Username
    PostgreSQL database user. Defaults to 'postgres'.

.PARAMETER Password
    PostgreSQL database password. If omitted, checks $env:PGPASSWORD or dotnet user-secrets.

.PARAMETER BackupDir
    Target directory for backup archives. Defaults to '<RepoRoot>/backups'.

.PARAMETER LogDir
    Target directory for backup execution logs. Defaults to '<RepoRoot>/logs/backup'.

.PARAMETER RetentionDays
    Number of days to retain backups. Defaults to 30.

.PARAMETER PgBinPath
    Path to PostgreSQL bin directory containing pg_dump.exe and pg_restore.exe.
    Auto-detected if omitted.

.EXAMPLE
    .\Backup-Database.ps1
    .\Backup-Database.ps1 -DatabaseName "E6CarSpaNew" -RetentionDays 14
#>

[CmdletBinding()]
param(
    [string]$DatabaseName = "E6CarSpaNew",
    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$Username = "postgres",
    [string]$Password = "",
    [string]$BackupDir = "",
    [string]$LogDir = "",
    [int]$RetentionDays = 30,
    [string]$PgBinPath = ""
)

$ErrorActionPreference = "Stop"

# Determine Repository Root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    $BackupDir = Join-Path $RepoRoot "backups"
}
if ([string]::IsNullOrWhiteSpace($LogDir)) {
    $LogDir = Join-Path $RepoRoot "logs\backup"
}

# Ensure directories exist
if (-not (Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}
if (-not (Test-Path -Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$TodayDate = Get-Date -Format "yyyy-MM-dd"
$LogFile = Join-Path $LogDir "backup-$TodayDate.log"

function Write-BackupLog {
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

    Add-Content -Path $LogFile -Value $LogEntry -Encoding UTF8
}

function Find-PgTool {
    param([string]$ToolName)

    # 1. User-specified path
    if (-not [string]::IsNullOrWhiteSpace($PgBinPath)) {
        $Candidate = Join-Path $PgBinPath $ToolName
        if (Test-Path $Candidate) { return $Candidate }
    }

    # 2. Check PATH environment variable
    $PathTool = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($PathTool) { return $PathTool.Source }

    # 3. Check standard PostgreSQL Windows installations (highest version first)
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

    # Attempt to read from dotnet user-secrets
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
            Write-BackupLog "Could not inspect user-secrets: $_" -Level WARN
        }
    }

    return ""
}

Write-BackupLog "=================================================="
Write-BackupLog "E6 Car Spa — Automated Database Backup Initiated"
Write-BackupLog "Target Database: $DatabaseName on $HostName`:$Port"

# 1. Resolve PostgreSQL Binaries
$PgDumpExe = Find-PgTool "pg_dump.exe"
$PgRestoreExe = Find-PgTool "pg_restore.exe"

if (-not $PgDumpExe) {
    Write-BackupLog "pg_dump.exe not found on PATH or in standard PostgreSQL directories." -Level ERROR
    exit 1
}
if (-not $PgRestoreExe) {
    Write-BackupLog "pg_restore.exe not found. Backup cannot be verified." -Level ERROR
    exit 1
}

Write-BackupLog "Using pg_dump: $PgDumpExe"
Write-BackupLog "Using pg_restore: $PgRestoreExe"

# 2. Resolve Database Password
$DbPassword = Get-DatabasePassword
if ([string]::IsNullOrWhiteSpace($DbPassword)) {
    Write-BackupLog "Database password not provided and could not be resolved from environment or user-secrets." -Level ERROR
    exit 1
}

# 3. Generate Backup Filename
$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$BackupFileName = "${DatabaseName}_${Timestamp}.dump"
$BackupFilePath = Join-Path $BackupDir $BackupFileName
$Sha256FilePath = "${BackupFilePath}.sha256"

Write-BackupLog "Target archive: $BackupFilePath"

# 4. Execute pg_dump
# Use scoped environment variable for PGPASSWORD to avoid leaking credentials in process arguments
$env:PGPASSWORD = $DbPassword

$DumpStartTime = Get-Date
try {
    Write-BackupLog "Executing pg_dump (Format: Custom compressed, Blobs: Yes)..."
    
    $DumpProcess = Start-Process -FilePath $PgDumpExe `
        -ArgumentList @("-h", $HostName, "-p", $Port.ToString(), "-U", $Username, "-F", "c", "-b", "-v", "-f", $BackupFilePath, $DatabaseName) `
        -NoNewWindow -PassThru -Wait -RedirectStandardError (Join-Path $LogDir "pg_dump_stderr.tmp")

    if ($DumpProcess.ExitCode -ne 0) {
        $Stderr = Get-Content (Join-Path $LogDir "pg_dump_stderr.tmp") -Raw -ErrorAction SilentlyContinue
        Write-BackupLog "pg_dump failed with exit code $($DumpProcess.ExitCode): $Stderr" -Level ERROR
        exit $DumpProcess.ExitCode
    }
} finally {
    # Immediately clear PGPASSWORD
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $LogDir "pg_dump_stderr.tmp") -ErrorAction SilentlyContinue
}

$DumpDuration = (Get-Date) - $DumpStartTime
Write-BackupLog "pg_dump completed in $($DumpDuration.TotalSeconds.ToString("F2")) seconds."

# 5. Verify Backup Existence and Size
if (-not (Test-Path $BackupFilePath)) {
    Write-BackupLog "Backup file was not created: $BackupFilePath" -Level ERROR
    exit 1
}

$BackupItem = Get-Item $BackupFilePath
$FileSizeBytes = $BackupItem.Length
$FileSizeMB = ($FileSizeBytes / 1MB).ToString("F2")

if ($FileSizeBytes -le 0) {
    Write-BackupLog "Backup file is empty (0 bytes): $BackupFilePath" -Level ERROR
    Remove-Item $BackupFilePath -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-BackupLog "Backup archive created successfully ($FileSizeMB MB, $FileSizeBytes bytes)."

# 6. Verify Backup Integrity via pg_restore Table of Contents
Write-BackupLog "Validating archive integrity via pg_restore Table of Contents..."
try {
    $TocOutput = & $PgRestoreExe --list $BackupFilePath 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-BackupLog "Archive verification failed! pg_restore --list returned exit code $LASTEXITCODE." -Level ERROR
        Write-BackupLog "Output: $TocOutput" -Level ERROR
        exit 1
    }

    $EntryCount = ($TocOutput | Measure-Object).Count
    if ($EntryCount -le 5) {
        Write-BackupLog "Archive Table of Contents contains insufficient entries ($EntryCount). Integrity suspect." -Level ERROR
        exit 1
    }

    Write-BackupLog "Archive TOC verified: $EntryCount schema and data objects validated." -Level SUCCESS
} catch {
    Write-BackupLog "Archive verification threw an exception: $_" -Level ERROR
    exit 1
}

# 7. Generate SHA-256 Checksum
Write-BackupLog "Generating SHA-256 checksum..."
$Sha256Hash = (Get-FileHash -Path $BackupFilePath -Algorithm SHA256).Hash
Set-Content -Path $Sha256FilePath -Value "$Sha256Hash *$BackupFileName" -Encoding UTF8
Write-BackupLog "SHA-256: $Sha256Hash" -Level SUCCESS

# 8. Apply Retention Policy
# Safeguard: Never delete the newest backup, even if older than retention threshold.
Write-BackupLog "Applying retention policy ($RetentionDays days)..."
$ExistingBackups = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_*.dump" |
    Sort-Object LastWriteTime -Descending

if ($ExistingBackups.Count -le 1) {
    Write-BackupLog "Only $($ExistingBackups.Count) backup(s) present. No retention pruning needed."
} else {
    $NewestBackup = $ExistingBackups[0]
    $ExpirationCutoff = (Get-Date).AddDays(-$RetentionDays)
    $PrunedCount = 0

    # Skip the first (newest) item always
    for ($i = 1; $i -lt $ExistingBackups.Count; $i++) {
        $OldBackup = $ExistingBackups[$i]
        if ($OldBackup.LastWriteTime -lt $ExpirationCutoff) {
            Write-BackupLog "Pruning expired backup: $($OldBackup.Name) (Created: $($OldBackup.LastWriteTime))" -Level WARN
            Remove-Item $OldBackup.FullName -Force
            $AssociatedSha = "$($OldBackup.FullName).sha256"
            if (Test-Path $AssociatedSha) {
                Remove-Item $AssociatedSha -Force
            }
            $PrunedCount++
        }
    }

    Write-BackupLog "Retention check complete. $PrunedCount expired backup(s) pruned. Latest backup preserved: $($NewestBackup.Name)."
}

Write-BackupLog "Database backup completed successfully." -Level SUCCESS
Write-BackupLog "Archive: $BackupFilePath ($FileSizeMB MB)"
Write-BackupLog "Checksum: $Sha256FilePath"
Write-BackupLog "=================================================="

exit 0
