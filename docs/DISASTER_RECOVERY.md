# E6 Car Spa — Disaster Recovery & Database Backup Runbook

## 1. Overview & Service Level Objectives

This operational runbook defines the disaster recovery, backup management, and data restoration procedures for the E6 Car Spa Management Suite.

| Metric | Target | Description |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | $\le$ 24 Hours | Maximum acceptable data loss window. Standard automated backup executes daily at **02:00 AM**. (Configurable down to 1 hour). |
| **Recovery Time Objective (RTO)** | $<$ 15 Minutes | Total time required to reconstitute a functional database from the latest verified archive. Actual restore takes $\approx$ 10–30 seconds. |
| **Archive Format** | Custom Compressed (`-F c`) | Native PostgreSQL binary custom archive with zlib compression, blob preservation, and Table of Contents (TOC) validation. |
| **Default Retention** | 30 Days | Expired archives older than 30 days are pruned automatically. **The newest valid archive is guaranteed to never be pruned.** |
| **Integrity Assurance** | SHA-256 + TOC | Every backup generates a companion `.sha256` checksum and undergoes immediate `pg_restore --list` TOC inspection. |

---

## 2. Directory Structure & Script Inventory

All backup and restoration automation lives under [`scripts/backup/`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/scripts/backup):

```
scripts/backup/
├── Backup-Database.ps1        # Primary automated Windows backup script
├── Restore-Database.ps1       # Automated restoration and integrity verification script
├── Register-BackupTask.ps1    # Registers Windows Scheduled Task (daily at 02:00 AM)
├── Unregister-BackupTask.ps1  # Unregisters Windows Scheduled Task
├── backup-database.sh         # Linux / macOS / Docker POSIX backup script
└── restore-database.sh        # Linux / macOS / Docker POSIX restore script

backups/                       # Storage directory for .dump archives (gitignored)
logs/backup/                   # Daily rotating execution logs (gitignored)
```

---

## 3. Daily Automated Operation (Windows Server / Desktop Host)

### 3.1 Task Registration
To register the automated backup in Windows Task Scheduler:

```powershell
# Run from repository root as Administrator:
pwsh .\scripts\backup\Register-BackupTask.ps1 -DailyAt "02:00"
```

This creates the scheduled task **`E6CarSpa_DailyBackup`**:
- **Trigger**: Every day at 02:00 AM.
- **Action**: Executes `Backup-Database.ps1` with `-ExecutionPolicy Bypass`.
- **Fault Tolerance**: Automatically retries up to 3 times (15-minute intervals) if the host machine was asleep or on battery power.
- **Log Destination**: `logs/backup/backup-YYYY-MM-DD.log`.

### 3.2 Manual / Ad-Hoc Backup Execution
To create an immediate backup before upgrades, migrations, or maintenance:

```powershell
pwsh .\scripts\backup\Backup-Database.ps1
```

Or with custom parameters:
```powershell
pwsh .\scripts\backup\Backup-Database.ps1 -DatabaseName "E6CarSpaNew" -RetentionDays 60
```

---

## 4. Step-by-Step Restoration Procedures

### Scenario A: Test Restoration to Verification Database (Non-Destructive)
Always test recovery to a staging or sandbox database before attempting production restoration.

```powershell
# 1. Identify your backup file:
Get-ChildItem .\backups\*.dump | Sort-Object LastWriteTime -Descending | Select-Object -First 1

# 2. Restore into temporary test database:
pwsh .\scripts\backup\Restore-Database.ps1 `
    -BackupFile "backups\E6CarSpaNew_2026-09-08_120000.dump" `
    -TargetDatabase "E6CarSpa_RestoreTest"
```

The script automatically:
1. Validates the companion `.sha256` checksum.
2. Inspects archive integrity with `pg_restore --list`.
3. Creates the target database `E6CarSpa_RestoreTest` if missing.
4. Restores all tables, constraints, sequences, and indexes.
5. Queries and prints row counts across all 13 core entity tables.

---

### Scenario B: Complete Production Disaster Recovery
In the event of hardware failure, database corruption, or ransomware recovery:

#### Step 1: Install PostgreSQL Engine
Install PostgreSQL 18.x (or corresponding major version). Ensure `C:\Program Files\PostgreSQL\18\bin` contains `pg_restore.exe` and `psql.exe`.

#### Step 2: Ensure PostgreSQL Service is Running
```powershell
Get-Service -Name "postgresql*"
```

#### Step 3: Stop the ASP.NET Core API
To prevent write conflicts during restoration:
```powershell
# If running as a Windows Service or console process:
Stop-Process -Name "CarSpaManagement.Api" -Force -ErrorAction SilentlyContinue
```

#### Step 4: Execute Production Restore
```powershell
pwsh .\scripts\backup\Restore-Database.ps1 `
    -BackupFile "backups\E6CarSpaNew_LATEST.dump" `
    -TargetDatabase "E6CarSpaNew" `
    -Force
```

> [!WARNING]
> Restoring to `E6CarSpaNew` replaces existing data with the state of the backup. The `-Force` flag bypasses the interactive `CONFIRM-OVERWRITE` safety prompt.

#### Step 5: Verify Sequence Numbers
Confirm the invoice sequence counter matches or exceeds the highest generated invoice number:
```sql
SELECT last_value FROM invoice_number_seq;
SELECT MAX(NULLIF(regexp_replace("InvoiceNumber", '\D', '', 'g'), '')::bigint) FROM "Invoices";
```

#### Step 6: Start ASP.NET Core Backend & Verify Desktop / Android
1. Start the API service.
2. Open Windows Desktop application: verify Invoices, Job Cards, and Customer lookup.
3. Open Android app: verify vehicle lookup and staff list.

---

## 5. Core Entity Verification Checklist

After restoration, verify the following 23 database entities:

| Entity / Table | Critical Checks |
| :--- | :--- |
| `Customers` | Phone numbers, Customer names, IsActive flags. |
| `Vehicles` | Registration numbers, Unique index `UX_Vehicles_RegistrationNumber`. |
| `Services` | Master service catalog, prices, and categories. |
| `JobCards` | Active statuses (`Pending`, `InProgress`, `Completed`, `Invoiced`). |
| `JobCardServices` | Associated line items and prices. |
| `Staff` | Active employees, roles, advance balances. |
| `StaffAdvances` | Advance payment history and repayment tracking. |
| `Showrooms` | Active showrooms, contact details. |
| `ShowroomStaffAssignments`| Daily staff showroom assignments. |
| `ShowroomDailyBills` | Daily bills generated for showroom jobs. |
| `ShowroomDailyAttendances`| Staff attendance records at showroom locations. |
| `ShowroomPayments` | Payment receipts from showrooms. |
| `Invoices` | Invoice numbers, Grand totals, Tax calculations, Finalized dates. |
| `InvoiceItems` | Service line items and pricing snapshots. |
| `Payments` | Payment methods (Cash, UPI, Card), transaction references, amounts. |
| `Users` | Admin / Manager / Staff user credentials and password hashes. |
| `Permissions` | Granular permission registry (68 permissions). |
| `UserPermissions` | Role and user permission mappings. |
| `BusinessProfiles` | Shop profile, branding, address, GST, UPI details. |
| `AuditLogs` | Immutable system audit log trail. |
| `InvoicePublicLinks` | Secure public tokens for customer invoice viewing. |
| `WhatsAppConfigurations` | Encrypted Meta Cloud API token, phone ID, WABA ID. |
| `WhatsAppMessages` | Message history, template IDs, Sent/Failed statuses, idempotency keys. |

---

## 6. Offsite Cloud Synchronization (Production Hardening)

To comply with the **3-2-1 backup rule** (3 copies, 2 media types, 1 offsite copy), configure offsite synchronization.

### Option A: AWS S3 Bucket Sync
```powershell
# Daily S3 sync script snippet
aws s3 sync "e:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backups" "s3://e6carspa-backups-secure/postgres/" `
    --exclude "*" --include "*.dump" --include "*.sha256" `
    --storage-class STANDARD_IA
```

### Option B: Azure Blob Storage via AzCopy
```powershell
azcopy sync "e:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backups" "https://e6carspastorage.blob.core.windows.net/backups?<SAS_TOKEN>" `
    --include-pattern "*.dump;*.sha256"
```

### Option C: Secondary Local NAS / External Drive
```powershell
robocopy "e:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backups" "Z:\E6CarSpa_Offsite_Backups" *.dump *.sha256 /XO /R:2 /W:5
```

---

## 7. Incident Response & Troubleshooting

### Issue 1: `pg_dump failed with exit code 1`
- **Cause**: Port 5432 unreachable, or PostgreSQL Windows Service is stopped.
- **Fix**: Check `Get-Service -Name "postgresql*"` and verify service is in `Running` state.

### Issue 2: `password authentication failed for user "postgres"`
- **Cause**: Password changed or user-secrets out of sync.
- **Fix**: Verify password with `dotnet user-secrets list --project backend/api/CarSpaManagement.Api` or export `$env:PGPASSWORD="<password>"`.

### Issue 3: `Archive Table of Contents contains insufficient entries`
- **Cause**: Database was empty or `pg_dump` terminated prematurely due to disk full.
- **Fix**: Inspect available disk space on the backup drive. The retention policy automatically preserves previous valid backups.
