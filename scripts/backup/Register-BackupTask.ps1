<#
.SYNOPSIS
    Registers a Windows Scheduled Task for automated daily PostgreSQL backups.

.DESCRIPTION
    Creates or updates the 'E6CarSpa_DailyBackup' task in the Windows Task Scheduler.
    Defaults to running daily at 02:00 AM.
    Executes Backup-Database.ps1 with non-interactive execution policy bypass.

.PARAMETER DailyAt
    Daily execution time in 24-hour HH:mm format. Defaults to '02:00'.

.PARAMETER TaskName
    Name of the scheduled task. Defaults to 'E6CarSpa_DailyBackup'.

.EXAMPLE
    .\Register-BackupTask.ps1
    .\Register-BackupTask.ps1 -DailyAt "03:30"
#>

[CmdletBinding()]
param(
    [string]$DailyAt = "02:00",
    [string]$TaskName = "E6CarSpa_DailyBackup"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackupScript = Join-Path $ScriptDir "Backup-Database.ps1"

if (-not (Test-Path $BackupScript)) {
    Write-Error "Backup script not found at expected location: $BackupScript"
    exit 1
}

# Check Administrative privileges
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Warning "Registration requires Administrator privileges to register for SYSTEM or system-wide execution."
    Write-Warning "Attempting to register for current user context ($env:USERNAME)..."
}

# Task Action
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$BackupScript`""

# Task Trigger: Daily at specified time
$Trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt

# Task Settings: Allow run on battery, restart on failure
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 15) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$Description = "Automated daily compressed PostgreSQL backup, integrity check, and retention pruning for E6 Car Spa."

try {
    # Check if task already exists
    $ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($ExistingTask) {
        Write-Host "Scheduled task '$TaskName' already exists. Updating..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    $RunLevel = if ($IsAdmin) { "Highest" } else { "Limited" }
    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel $RunLevel

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Description $Description | Out-Null

    Write-Host "Scheduled task '$TaskName' registered successfully!" -ForegroundColor Green
    Write-Host "  Trigger: Daily at $DailyAt" -ForegroundColor White
    Write-Host "  Action:  $BackupScript" -ForegroundColor White
    Write-Host "  User:    $env:USERNAME" -ForegroundColor White
} catch {
    Write-Error "Failed to register scheduled task: $_"
    exit 1
}

exit 0
