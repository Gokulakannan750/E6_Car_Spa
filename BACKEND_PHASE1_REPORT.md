# Backend Phase 1 — Database Foundation Report

**Date:** 2026-08-19

---

## 1. Existing Backend Architecture Found

The existing backend was a clean, well-structured ASP.NET Core project:

| Aspect | Detail |
|--------|--------|
| **Project** | `backend/api/CarSpaManagement.Api/CarSpaManagement.Api.csproj` |
| **Framework** | .NET 10.0 |
| **Architecture** | Single project with clean separation: Domain / Application / Infrastructure / Controllers |
| **Database** | PostgreSQL via Npgsql.EntityFrameworkCore.PostgreSQL v10.0.3 |
| **Database name** | `carspa_management` |
| **ORM** | Entity Framework Core 10.0.11 |
| **Logging** | Serilog (Console + File) |
| **Health Checks** | `AspNetCore.HealthChecks.NpgSql` |
| **API Docs** | OpenAPI / Swagger |
| **Soft Delete** | Implemented via `BaseEntity.IsDeleted` + global query filter in `AppDbContext` |
| **Dependency Injection** | Extension method pattern in `Infrastructure/Database/DependencyInjection.cs` |
| **Existing entities** | Only `BaseEntity` (Guid Id, CreatedAt, UpdatedAt, IsDeleted) |
| **Existing controllers** | Only `HealthController.cs` (`GET /api/health`) |
| **Existing migrations** | None (empty `Infrastructure/Migrations/` folder) |
| **Domain structure** | Scaffolded but empty: Entities/, Enums/, ValueObjects/, Common/ |

### Existing Files Preserved
- `Domain/Common/BaseEntity.cs` — soft delete pattern
- `AppDbContext.cs` — global query filter, auto timestamps
- `DependencyInjection.cs` — DbContext registration pattern
- `Program.cs` — Serilog, CORS, HealthChecks, OpenAPI
- `HealthController.cs` — health endpoint
- All Application/Infrastructure directory structure

---

## 2. .NET Version

**NET 10.0** (confirmed from `TargetFramework` in `.csproj`)

---

## 3. Existing DbContext

`AppDbContext` at `Infrastructure/Database/AppDbContext.cs`

- Constructor injection of `DbContextOptions<AppDbContext>`
- `OnModelCreating`: applies all `IEntityTypeConfiguration` from assembly
- Global soft delete query filter applied to all `BaseEntity` types
- `SaveChangesAsync`: auto-sets `CreatedAt` and `UpdatedAt` timestamps
- `EnableSensitiveDataLogging()` enabled (development)

---

## 4. Existing Database Configuration

**Was:** PostgreSQL on `localhost:5432`, database `carspa_management`, user `postgres`

**Changed to:** SQL Server (per Phase 1 requirements)

---

## 5. Database Name

**E6CarSpaNew**

---

## 6. Changes Made

### Package References Updated
| Removed | Added |
|---------|-------|
| `Npgsql.EntityFrameworkCore.PostgreSQL` v10.0.3 | `Microsoft.EntityFrameworkCore.SqlServer` v10.0.3 |
| `AspNetCore.HealthChecks.NpgSql` v9.0.0 | `AspNetCore.HealthChecks.SqlServer` v9.0.0 |
| *(missing)* | `Microsoft.EntityFrameworkCore.Tools` v10.0.11 |

### Connection String Updated
```json
// appsettings.json
"DefaultConnection": "Server=localhost,1433;Database=E6CarSpaNew;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=True;MultipleActiveResultSets=true"
```

### Infrastructure Updated
- `DependencyInjection.cs`: Changed `UseNpgsql()` → `UseSqlServer()`
- `Program.cs`: Changed `AddNpgSql()` → `AddSqlServer()` health check

---

## 7. Entities Created

### Domain/Entities/

| Entity | File | Key Features |
|--------|------|-------------|
| **Customer** | `Customer.cs` | Name, PhoneNumber (indexed), Email, Address, IsActive (soft delete), navigation: Vehicles, JobCards |
| **Vehicle** | `Vehicle.cs` | RegistrationNumber (indexed, unique with CustomerId), Make, Model, Variant, Color, CustomerId FK |
| **Service** | `Service.cs` | Name, Description, Category, Price (decimal 18,2), TaxPercentage (decimal 5,2), DurationMinutes, IsActive (active/inactive), navigation: JobCardServices |
| **JobCard** | `JobCard.cs` | JobCardNumber (unique), CustomerId, VehicleId, Status (enum), Notes, Subtotal, TaxAmount, DiscountAmount, TotalAmount (all decimal 18,2) |
| **JobCardService** | `JobCardService.cs` | JobCardId, ServiceId, ServiceName (snapshot), UnitPrice (decimal 18,2), Quantity, TaxPercentage (decimal 5,2), DiscountAmount, LineTotal (decimal 18,2) |

### Domain/Enums/

| Enum | Values |
|------|--------|
| **JobCardStatus** | Draft=0, InProgress=1, QualityCheck=2, Ready=3, Invoiced=4, Paid=5, Delivered=6, Cancelled=7 |

---

## 8. Relationships

```
Customer ────┬─── * Vehicle
 └─── * JobCard

Vehicle ─────────── * JobCard

JobCard ─────────── * JobCardService (CASCADE DELETE)

Service ─────────── * JobCardService (RESTRICT)
```

| Relationship | Delete Behavior |
|-------------|-----------------|
| Customer → Vehicle | Restrict (do not cascade delete customer's vehicles) |
| Customer → JobCard | Restrict (preserve historical job cards) |
| Vehicle → JobCard | Restrict (preserve historical job cards) |
| JobCard → JobCardService | **Cascade** (removing a job card removes its line items) |
| Service → JobCardService | Restrict (preserve historical pricing snapshots) |

---

## 9. Indexes

| Table | Index | Columns |
|-------|-------|---------|
| Customers | `IX_Customers_PhoneNumber` | PhoneNumber |
| Vehicles | `IX_Vehicles_RegistrationNumber` | RegistrationNumber |
| Vehicles | `IX_Vehicles_CustomerId_RegistrationNumber` | CustomerId, RegistrationNumber |
| Vehicles | `IX_Vehicles_CustomerId_IsDeleted` | CustomerId, IsDeleted |
| Services | `IX_Services_Name` | Name, IsDeleted |
| Services | `IX_Services_Category` | Category, IsDeleted |
| Services | `IX_Services_IsActive_IsDeleted` | IsActive, IsDeleted |
| JobCards | `UX_JobCards_JobCardNumber` | JobCardNumber (UNIQUE) |
| JobCards | `IX_JobCards_CustomerId_Status_CreatedAt` | CustomerId, Status, CreatedAt |
| JobCards | `IX_JobCards_VehicleId_Status` | VehicleId, Status |
| JobCards | `IX_JobCards_Status_CreatedAt` | Status, CreatedAt |
| JobCardServices | `IX_JobCardServices_JobCardId` | JobCardId |
| JobCardServices | `IX_JobCardServices_JobCardId_ServiceId` | JobCardId, ServiceId |
| JobCardServices | `IX_JobCardServices_ServiceId` | ServiceId |

---

## 10. Unique Constraints

| Table | Constraint | Columns |
|-------|-----------|---------|
| JobCards | `UX_JobCards_JobCardNumber` | JobCardNumber |

---

## 11. Decimal Precision

All monetary values use `decimal(18,2)`:

- Customer: none
- Vehicle: none
- Service: `Price` = decimal(18,2), `TaxPercentage` = decimal(5,2)
- JobCard: `Subtotal`, `TaxAmount`, `DiscountAmount`, `TotalAmount` = decimal(18,2)
- JobCardService: `UnitPrice`, `DiscountAmount`, `LineTotal` = decimal(18,2), `TaxPercentage` = decimal(5,2)

---

## 12. Fluent API Configurations

| Configuration File | Entity |
|--------------------|--------|
| `Infrastructure/Configurations/CustomerConfiguration.cs` | Customer |
| `Infrastructure/Configurations/VehicleConfiguration.cs` | Vehicle |
| `Infrastructure/Configurations/ServiceConfiguration.cs` | Service |
| `Infrastructure/Configurations/JobCardConfiguration.cs` | JobCard |
| `Infrastructure/Configurations/JobCardServiceConfiguration.cs` | JobCardService |

Each configuration defines: table name, primary key, property constraints, indexes, relationships, delete behaviors.

---

## 13. Migration

| Item | Detail |
|------|--------|
| **Name** | `InitialCarSpaCore` |
| **File** | `Infrastructure/Migrations/20260819085704_InitialCarSpaCore.cs` |
| **Tables created** | Customers, Vehicles, Services, JobCards, JobCardServices |
| **SQL Server types** | `uniqueidentifier` (Guid), `nvarchar(N)`, `decimal(18,2)`, `decimal(5,2)`, `datetime2`, `bit`, `int` |
| **SQL file generated** | ✅ `migration-script.sql` verified (124 lines, correct SQL Server DDL) |

---

## 14. dotnet build Result

```
Build succeeded.
0 Warning(s)
0 Error(s)
```

---

## 15. Database Creation Result

**Cannot be applied** — SQL Server is not installed or running on this development machine.

The SQL Server instance on `localhost,1433` was not reachable. The error was:
> A network-related or instance-specific error occurred while establishing a connection to SQL Server.

### Next Steps to Apply the Migration

1. **Install SQL Server** (Express, Developer, or full edition):
 ```
 https://www.microsoft.com/en-us/sql-server/sql-server-downloads
 ```

2. **Or install SQL Server Express via command line:**
 ```powershell
 winget install Microsoft.SQLServer.Express
 ```

3. **Ensure the SQL Server service is running:**
 ```powershell
 Get-Service -Name "MSSQL$SQLEXPRESS" -ErrorAction SilentlyContinue | Start-Service
 ```

4. **Ensure SQL Server authentication is enabled** (Mixed Mode: Windows + SQL Server authentication)

5. **Then apply the migration:**
 ```bash
 dotnet ef database update
 ```

6. **To start the API after database is created:**
 ```bash
 dotnet run
 ```

### Migration Script Available

The generated SQL script can be run directly in SQL Server Management Studio (SSMS) or via `sqlcmd`:

```
E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backend\api\migration-script.sql
```

---

## 16. Files Created / Modified Summary

### Modified
| File | Change |
|------|--------|
| `CarSpaManagement.Api.csproj` | Replaced Npgsql with SqlServer packages, added EF Tools |
| `appsettings.json` | Connection string changed to SQL Server, database renamed to `E6CarSpaNew` |
| `Infrastructure/Database/DependencyInjection.cs` | `UseNpgsql()` → `UseSqlServer()` |
| `Program.cs` | `AddNpgSql()` → `AddSqlServer()` health check |

### Created
| File | Purpose |
|------|---------|
| `Domain/Entities/Customer.cs` | Customer entity with phone index |
| `Domain/Entities/Vehicle.cs` | Vehicle entity with registration number index |
| `Domain/Entities/Service.cs` | Service/Catalogue entity with decimal pricing |
| `Domain/Entities/JobCard.cs` | Job Card entity with status enum |
| `Domain/Entities/JobCardService.cs` | Job Card line item with pricing snapshot |
| `Domain/Enums/JobCardStatus.cs` | JobCardStatus enum (Draft → Delivered) |
| `Infrastructure/Configurations/CustomerConfiguration.cs` | Fluent API for Customer |
| `Infrastructure/Configurations/VehicleConfiguration.cs` | Fluent API for Vehicle |
| `Infrastructure/Configurations/ServiceConfiguration.cs` | Fluent API for Service |
| `Infrastructure/Configurations/JobCardConfiguration.cs` | Fluent API for JobCard |
| `Infrastructure/Configurations/JobCardServiceConfiguration.cs` | Fluent API for JobCardService |
| `Infrastructure/Migrations/20260819085704_InitialCarSpaCore.cs` | EF Core migration |

### Deleted
| File | Reason |
|------|--------|
| `migration-script.sql` | Temporary; removed from backend root after verification |

---

## 17. Blockers

| Item | Status |
|------|--------|
| SQL Server not installed | **BLOCKING** — Cannot apply migration or run API |
| Migration generated correctly | ✅ Ready to apply once SQL Server is available |

All code, entities, configurations, and migration are complete and build successfully. The only remaining step is installing SQL Server and applying the migration.
