<#
.SYNOPSIS
    Unregisters the Windows Scheduled Task for E6 Car Spa database backup.

.PARAMETER TaskName
    Name of the scheduled task. Defaults to 'E6CarSpa_DailyBackup'.

.EXAMPLE
    .\Unregister-BackupTask.ps1
#>

[CmdletBinding()]
param(
    [string]$TaskName = "E6CarSpa_DailyBackup"
)

$ErrorActionPreference = "Stop"

try {
    $ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $ExistingTask) {
        Write-Host "Scheduled task '$TaskName' does not exist. Nothing to unregister." -ForegroundColor Yellow
        exit 0
    }

    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Scheduled task '$TaskName' has been unregistered successfully." -ForegroundColor Green
} catch {
    Write-Error "Failed to unregister scheduled task '$TaskName': $_"
    exit 1
}

exit 0
