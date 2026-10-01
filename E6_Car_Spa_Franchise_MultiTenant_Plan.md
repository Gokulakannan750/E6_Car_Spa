# E6 Car Spa — Franchise / Multi-Tenant Architecture Plan

## 1. Objective

Convert the existing E6 Car Spa application into a franchise-capable multi-tenant system without rewriting the working Windows + Android application.

Target:

```text
E6 Car Spa — Master / Head Office
        |
        +-- Franchise 1
        |    +-- Users
        |    +-- Customers
        |    +-- Vehicles
        |    +-- Job Cards
        |    +-- Invoices
        |    +-- Payments
        |    +-- Catalogue
        |    +-- Staff
        |    +-- Reports
        |
        +-- Franchise 2
        +-- Franchise N
```

Primary rule: a franchise must never be able to read or modify another franchise's tenant-owned data.

This is a **car-spa franchise platform**, not a generic SaaS conversion for unrelated businesses.

---

## 2. Current Architecture Audit

Latest repository state audited:

- Repository: `Gokulakannan750/E6_Car_Spa`
- Branch: `main`
- Latest audited commit: `cae86d413e27b0ba7035092184f04428f5882c13`
- Backend: ASP.NET Core
- ORM: Entity Framework Core
- Database: PostgreSQL
- Clients: Windows desktop + Flutter Android
- Authentication: custom JWT
- Authorization: custom users/roles/permissions
- Soft delete: `BaseEntity.IsDeleted`
- Current synchronization: shared backend/API architecture

Current `BaseEntity` contains:

```text
Id
CreatedAt
UpdatedAt
IsDeleted
```

There is currently no `TenantId`.

Current `User` has no tenant relationship.

Current `BusinessProfile` is designed as a singleton.

These are the main architectural areas that must change.

---

## 3. Recommended Tenant Architecture

Use:

**Shared PostgreSQL database + shared schema + TenantId isolation.**

Do not create one database or backend deployment per franchise initially.

```text
Windows ──┐
          ├── HTTPS API ── Tenant Context ── PostgreSQL
Android ──┘
```

The database contains tenant-owned records identified by `TenantId`.

Benefits:

- one backend deployment
- one codebase
- one migration system
- easier backups
- easier upgrades
- easier monitoring
- simpler Windows/Android distribution
- strong logical data isolation

---

## 4. New Tenant Entity

Create:

```text
Tenant
```

Suggested fields:

```text
Id
TenantCode
TenantName
LegalName
Phone
Email
Address
City
State
PostalCode
Gstin
LogoPath
IsActive
CreatedAt
UpdatedAt
```

Use:

```text
TenantId = Guid
TenantCode = unique human-readable code
```

Do not use the franchise name as the technical identifier.

---

## 5. User → Tenant

Normal franchise users belong to one tenant.

Conceptually:

```text
User
 └── TenantId
```

Example:

```text
Arun
Role: Manager
Tenant: E6 Erode Franchise
```

The client must never be allowed to freely change its TenantId.

---

## 6. Master / Head Office

The master owner needs a distinct authorization scope.

Possible model:

```text
User
 ├── TenantId = Master Tenant
 └── AccessScope = Master
```

A proper scope/authorization concept is preferred over relying only on a boolean such as `IsMaster`.

The exact model should be finalized before migrations.

---

## 7. Tenant-Owned Data

At minimum, the following should be tenant-scoped.

### Billing

- Customers
- Vehicles
- Services
- Job Cards
- Job Card Services
- Outside Jobs
- Vendors
- Invoices
- Invoice Items
- Payments

### Staff

- Staff
- Staff Advances
- Staff Attendance
- Staff Daily Attendance
- Staff Salary Settlements
- Related staff records

### Showroom

- Showrooms
- Showroom Staff Assignments
- Showroom Daily Attendance
- Showroom Daily Bills
- Showroom Payments
- Showroom Vehicle Types
- Showroom Work Types
- Showroom Staff Work Sessions
- Showroom Staff Swaps
- Showroom Vehicle Work
- Showroom Vehicle Work Items

### Configuration

- Business Profile
- System Preferences
- WhatsApp Configuration
- Invoice configuration
- Tenant catalogue data

### Audit

- Tenant-scoped audit records

---

## 8. Global Data

Do not blindly add TenantId to every table.

Likely global:

- permission definitions
- application-level metadata
- platform configuration

The exact global/tenant-owned classification must be audited before migrations.

---

## 9. Business Profile

Current BusinessProfile uses a singleton model.

Change the concept to:

```text
Tenant
 └── BusinessProfile
```

Recommended database constraint:

```text
UNIQUE(TenantId)
```

Each tenant has its own business profile.

---

## 10. System Preferences

Preferences should become tenant-specific.

Example:

```text
Tenant A
 ├── Currency
 ├── Date format
 ├── Time format
 └── Refresh interval

Tenant B
 ├── Currency
 ├── Date format
 ├── Time format
 └── Refresh interval
```

---

## 11. Invoice and Job-Card Numbering

Number sequences must be tenant-aware.

Possible model:

```text
Tenant A:
INV-000001
INV-000002

Tenant B:
INV-000001
INV-000002
```

or tenant-prefixed numbers:

```text
E6-ERD-INV-000001
```

The exact format should be configurable per tenant.

Job-card numbering should receive the same treatment.

---

## 12. Catalogue / Services

Services should normally belong to the franchise.

Possible future model:

```text
Master Service Template
        |
        +-- Franchise A catalogue
        +-- Franchise B catalogue
```

Do not implement a complex shared master catalogue unless the business requires it.

---

## 13. Vendors

Vendors must be tenant-scoped.

Example:

```text
Franchise A
 ├── Painting Vendor
 └── Wheel Alignment Vendor

Franchise B
 ├── Painting Vendor
 └── Electrical Vendor
```

A franchise must not see another franchise's vendors.

---

## 14. Authentication

Current:

```text
Login
 ↓
JWT
 ↓
Application
```

Target:

```text
Login
 ↓
JWT with tenant context
 ↓
Tenant-aware API
 ↓
Tenant-scoped data
```

The backend must be authoritative.

Do not trust a client-provided tenantId for authorization.

---

## 15. JWT Claims

Keep claims minimal.

Possible claims:

```text
sub
userId
username
role
tenantId
scope
```

Do not put large business datasets inside the token.

---

## 16. Tenant Context

Create a backend abstraction such as:

```text
ITenantContext
```

Responsibilities:

```text
CurrentTenantId
IsMasterUser
AccessScope
```

Conceptual flow:

```text
Controller
   ↓
Service
   ↓
ITenantContext
   ↓
Current Tenant
   ↓
EF Core query
```

This prevents tenant logic from being duplicated throughout the application.

---

## 17. EF Core Isolation

Tenant-owned queries should effectively behave like:

```text
WHERE TenantId = CurrentTenantId
AND IsDeleted = false
```

Tenant filtering should be centralized.

However, master-level operations need an explicit and audited way to bypass normal tenant filtering.

---

## 18. Save-Time Protection

When creating:

- Customer
- Vehicle
- Job Card
- Invoice
- Payment
- Staff
- Vendor
- etc.

the backend should automatically assign:

```text
TenantId = CurrentTenantId
```

The client should not supply it as an authority.

Updates must prevent normal users from changing TenantId.

---

## 19. Cross-Tenant Security

These must fail for normal franchise users:

```text
GET /api/customers?tenantId=other
PUT /api/jobcards/{otherTenantJobCardId}
GET /api/invoices/{otherTenantInvoiceId}
```

Even if another tenant's UUID is known, access must be denied.

Changing tenantId in:

- request body
- query string
- URL
- headers

must not bypass authorization.

---

## 20. Master Franchise Management

The master application can eventually provide:

```text
Franchise Management
 ├── Create Franchise
 ├── Edit Franchise
 ├── Activate / Deactivate Franchise
 ├── Create/manage franchise owner
 ├── View franchise status
 └── Select authorized franchise context
```

Tenant switching must be authorized by the backend, not merely by a frontend dropdown.

---

## 21. Franchise Module Scope

Current business requirement says franchises do not need the Showroom application.

Therefore:

```text
Master E6 Car Spa
 ├── Billing
 ├── Staff
 ├── Showroom
 ├── Reports
 ├── Settings
 └── Franchise Management

Franchise E6 Car Spa
 ├── Billing
 ├── Staff
 ├── Reports
 └── Settings
```

Module visibility should preferably be permission/scope driven rather than scattered hard-coded conditions.

---

## 22. Android

Android should use the same tenant-aware API.

No tenant authorization logic should be duplicated in Flutter.

Android receives tenant context from the authenticated session.

The app must not be able to override the tenant.

---

## 23. Windows

Windows uses the same tenant-aware API.

For a franchise installation:

```text
Tenant fixed by authenticated user
```

For the master application, a controlled franchise selector can be introduced later.

---

## 24. Synchronization

Existing synchronization architecture can remain.

```text
Windows
   ↕
Backend API
   ↕
PostgreSQL
   ↕
Android
```

Tenant boundaries are added to the synchronization layer.

Sync must never transfer data across tenants.

---

## 25. Franchise Provisioning

Recommended:

```text
Master User
    ↓
Create Franchise
    ↓
Create Tenant
    ↓
Create Business Profile
    ↓
Create default preferences
    ↓
Create franchise owner/admin
    ↓
Seed required tenant configuration
    ↓
Franchise ready
```

---

## 26. First-Time Setup

For a brand-new platform installation:

```text
First Time Setup
      ↓
Create Master/Owner
      ↓
Create Master Tenant
      ↓
Initialize master configuration
```

For a franchise created by head office:

```text
Master creates franchise
      ↓
Franchise tenant created
      ↓
Franchise owner account created
      ↓
Franchise logs in
```

Invitation/activation can be added after the core tenant model is stable.

---

## 27. Database Migration Strategy

Do not make one enormous migration.

Use staged migrations.

### Phase 1 — Tenant Foundation

Create:

```text
Tenants
Tenant context infrastructure
```

### Phase 2 — Identity

Add tenant relationships to:

```text
Users
UserPermissions
```

### Phase 3 — Billing

Add tenant isolation to:

```text
Customers
Vehicles
Services
JobCards
JobCardServices
OutsideJobs
Vendors
Invoices
InvoiceItems
Payments
```

### Phase 4 — Staff

Add tenant isolation to staff-related entities.

### Phase 5 — Showroom

Add tenant isolation to showroom-related entities.

### Phase 6 — Configuration

Add tenant relationships to:

```text
BusinessProfile
SystemPreferences
WhatsAppConfiguration
```

### Phase 7 — Audit and Reports

Make reports and audit records tenant-aware.

---

## 28. Existing Data Migration

Before enabling multi-tenancy:

1. Take a complete database backup.
2. Create the initial/master tenant.
3. Assign existing E6 data to that tenant.
4. Verify all relationships.
5. Run tenant-isolation tests.

Do not perform this migration on production without a tested backup and restore.

---

## 29. Soft Delete

The existing `IsDeleted` behaviour should remain.

Target tenant query rule:

```text
TenantId = CurrentTenantId
AND IsDeleted = false
```

Both isolation and soft-delete behaviour must continue working together.

---

## 30. Reports

Reports must always respect tenant boundaries.

Example:

```text
Franchise A monthly sales
```

must never include Franchise B invoices.

Master reports may aggregate multiple tenants only through explicit master-authorized functionality.

---

## 31. Audit Logs

Audit records should capture tenant context:

```text
TenantId
UserId
Action
Entity
EntityId
Timestamp
IP/device information where already supported
```

Master-level tenant management actions should also be auditable.

---

## 32. Security Testing

Before release, test:

### Read isolation

Tenant A cannot read Tenant B.

### Update isolation

Tenant A cannot update Tenant B.

### Delete isolation

Tenant A cannot delete Tenant B.

### UUID/ID guessing

Knowing another tenant's ID does not grant access.

### Client tampering

Changing tenantId in a request does not grant access.

### Disabled tenant

Users of an inactive tenant cannot continue normal access.

### Master access

Master operations work only with explicit master authorization.

---

## 33. Development Branch

Do not develop directly on `main`.

Create:

```text
feature/multi-tenant-franchise
```

All tenant migrations and changes should be developed there.

---

## 34. Implementation Order

```text
STEP 0
Create feature/multi-tenant-franchise
        ↓
STEP 1
Tenant database model
        ↓
STEP 2
Tenant context service
        ↓
STEP 3
Authentication + JWT tenant claims
        ↓
STEP 4
User → Tenant relationship
        ↓
STEP 5
EF Core tenant isolation
        ↓
STEP 6
Core Billing tenant migration
        ↓
STEP 7
Staff tenant migration
        ↓
STEP 8
Showroom/configuration tenant migration
        ↓
STEP 9
Master franchise management
        ↓
STEP 10
Windows tenant UI
        ↓
STEP 11
Android tenant/session updates
        ↓
STEP 12
Cross-tenant security tests
        ↓
STEP 13
Backup/restore and migration testing
        ↓
STEP 14
Pilot with one franchise
        ↓
STEP 15
Additional franchise rollout
```

---

## 35. Required First Audit Before Coding

Before writing the first tenant migration, perform a complete **Tenant Boundary Audit**.

For every entity/table document:

```text
Entity
Tenant-owned?
Global?
Tenant relationship
Current foreign keys
API endpoints
Read operations
Write operations
Delete operations
Report usage
Sync usage
```

This is the most important immediate step.

Do not start adding TenantId until this audit is approved.

---

## 36. Decisions Required Before Implementation

Confirm:

1. Is the original E6 Car Spa operation Tenant #1?
2. Does the master owner see all franchise financial data?
3. Can the master open a franchise's full Billing workspace?
4. Can a franchise owner create franchise users?
5. Can the master edit a franchise's business profile?
6. Should invoice numbering be independent per franchise?
7. Should job-card numbering be independent per franchise?
8. Should services be independently maintained by each franchise?
9. Should vendors be independent per franchise?
10. Should franchise staff be completely isolated?
11. Are franchise users created by the master or through an invitation?
12. Should the master be able to run cross-franchise consolidated reports?

These decisions affect the final database and authorization design.

---

## 37. Final Target Architecture

```text
                    E6 Car Spa Platform
                           |
                    Authentication
                           |
                     Tenant Context
                           |
          +----------------+----------------+
          |                                 |
   Master / Head Office                 Franchise
          |                                 |
   Franchise Management              Tenant Workspace
          |                                 |
          +----------------+----------------+
                           |
                     ASP.NET Core API
                           |
                   Tenant-aware Services
                           |
                     EF Core Filters
                           |
                       PostgreSQL
                           |
                 +---------+---------+
                 |                   |
             Tenant A             Tenant B
               data                data
```

---

## 38. Success Criteria

The implementation is complete only when:

- Existing Windows functionality still works.
- Existing Android functionality still works.
- Master users can manage franchises.
- Franchise users can log in normally.
- Franchise users see only their own data.
- Customers are isolated.
- Vehicles are isolated.
- Job cards are isolated.
- Invoices are isolated.
- Payments are isolated.
- Staff are isolated.
- Vendors are isolated.
- Reports are isolated.
- Settings are isolated.
- Synchronization is tenant-safe.
- Android and Windows respect tenant context.
- Fresh-database migrations work.
- Existing data can be migrated safely.
- Backup/restore has been tested.
- Cross-tenant security tests pass.

---

## 39. Immediate Next Step

**Do not start coding the multi-tenant changes yet.**

First complete and review the **Tenant Boundary Audit**.

Only after that should we implement:

```text
TenantId
    ↓
Tenant Context
    ↓
JWT changes
    ↓
EF Core isolation
    ↓
Database migrations
    ↓
Master/Franchise UI
```

This keeps the existing working E6 Car Spa system intact and minimizes rework.
