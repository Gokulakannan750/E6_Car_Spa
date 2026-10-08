# SaaS Phase 0 — Tenant Boundary Audit

**Type:** read-only audit. No code, database or migration changes.
**Branch / commit audited:** `main` @ `9b33ccb3` (6 Oct 2026)
**Companion documents:**
- `DETAILING_SOFTWARE_SAAS_FRANCHISE_ARCHITECTURE.md`: target design, Option B
- `E6_RBAC_PERMISSIONS_AUDIT.md`: permissions audit
- `docs/PRICING_AND_PLANS_DRAFT.md`: plans and prices

## Decisions recorded (6 Oct 2026)

| # | Decision | Answer |
|---|---|---|
| 1 | Branding | One Trovo product. **Each client uploads its own logo** and business details. |
| 2 | Offline mode | **Later.** The first SaaS version needs internet at the counter. |
| 3 | Hosting | Indian VPS: Hostinger (KVM 4 shortlisted), MilesWeb, or Navo Hosting (Erode). See the pricing document. |
| 4 | Plans and prices | Draft in `docs/PRICING_AND_PLANS_DRAFT.md` |
| 5 | Franchise WhatsApp | **Each franchisee owns its own WhatsApp number**, connected through Trovo's Embedded Signup |
| 6 | Who becomes the Owner | **Whoever completes first-time setup for a company becomes that company's Owner.** The Owner then creates the company's other users and gives them permissions. (8 Oct 2026) |
| 7 | User limit | **Set by the subscription plan, counting the Owner.** A 3-user plan means the Owner plus 2 more users; the Owner cannot add a third. (8 Oct 2026; see `PRICING_AND_PLANS_DRAFT.md`: Starter 3 users, Professional 10, extra users in packs of 5.) |
| 8 | Invoice and job-card numbering | **Per company**, using the numbering template the company sets in Settings (the existing GST / non-GST prefix fields). Not per branch or per GST registration for now. (8 Oct 2026) |

| 9 | Assumptions confirmed | Only **active** users count toward the limit (deactivating a user frees a seat). At the limit, "Add user" shows a clear message and the server refuses the extra user; the Owner can never be removed to make room. (8 Oct 2026) |
| 10 | Login identity (section 13, item 1) | **Company code.** The sign-in screen asks for the company code once and the device remembers it; after that, username and password as today. Usernames only need to be unique **within a company**. (8 Oct 2026) |

| 11 | Company code and business types | **Code = a plain zero-padded running number:** `0001` (the existing E6 company), `0002`, `0003`... It only identifies the company. **No business types:** this software is for automobile detailing only, so there is no business type field and no supermarket or other-industry modules. (8 Oct 2026; supersedes an earlier idea of `01-0001` with a type prefix.) |

**Build status:** Phase 1 is complete on branch `feature/saas-tenant-foundation` (not merged to `main`). It contains:

- the `Organization` table and a company id on all 36 business tables, with E6's data migrated to company `0001` (checked on a copy of E6's real data, including rollback);
- the company filter on every query, automatic stamping, and refusal to write, move or delete another company's rows;
- refusal to save a record that links to another company's record (same-company checks on every link);
- the company id taken from the signed sign-in token on every request; per-company startup seeding, background work, job-card and invoice numbering, public pages and sign-in lockouts;
- company-code sign-in and first-time setup (the first user becomes the company Owner and is told the company code) on the API, Windows and Android;
- unique rules made per company, and a WhatsApp number that can be connected to only one company platform-wide;
- PostgreSQL row-level security on all 37 company tables as a second lock behind the filters (the API tells the connection which company it works for; with none set, no row is visible or writable).

**Deployment rule:** row-level security is bypassed by PostgreSQL superusers, so a production install must connect as an ordinary (non-superuser) role. The dev database uses the `postgres` superuser, so the lock is not active there; the tests and an end-to-end run connect as an ordinary role to prove it. Future migrations that must touch every company's rows set `app.bypass_rls = 'on'` for that session.

**Still open (later phases):** seat limits and plans, sign-up and onboarding, random company codes, multi-company WhatsApp (Embedded Signup, webhooks), platform admin.

Still open: the product name (not needed until the first installer or Play Store release; "Car Spa Management" is the placeholder).

---

## 1. Executive summary

The system is **single-tenant in every layer**:
- no organization or branch identifier on any table
- no organization in the login token
- singletons for business profile, preferences, WhatsApp and number series
- platform-wide unique constraints on business keys

Converting it is a large but tractable refactor, because the codebase has good foundations:

| Foundation | Where |
|---|---|
| One central place for the global filter (`AppDbContext.OnModelCreating` loop over `BaseEntity`) | `Infrastructure/Database/AppDbContext.cs` |
| One central save hook (`SaveChangesAsync`) that stamps `CreatedAt`/`UpdatedAt` | same |
| GUID primary keys everywhere | all entities |
| Business logic in 26 services behind 27 controllers (about 185 endpoints); controllers are thin | `Application/Services`, `Controllers` |
| Little raw SQL (5 call sites) and few filter bypasses (12 call sites) | listed below |
| Permanent invoice-number ledger and immutable finalized invoices | `InvoiceNumberAllocator`, `InvoiceService` |

**Blocking findings:** the first version can't go live without fixing these.

| ID | Finding | Severity |
|---|---|---|
| T1 | 15 business keys are **unique across the whole platform**. A second car spa couldn't register a vehicle, staff member, job-card number, invoice number, attendance-confirmation date or showroom type that another spa already uses. | Critical |
| T2 | **Only one Owner on the entire platform** (`IX_Users_SingleOwner` unique on `Role = Owner`) | Critical |
| T3 | **Usernames are unique platform-wide**; logins have no organization context | Critical |
| T4 | Singletons: `BusinessProfile`, `SystemPreference`, `WhatsAppConfiguration` (`SingletonKey`), `StaffDailyAttendanceConfirmation` (unique `Date`), `InvoiceNumberSeries` (unique `SeriesKind` and prefix) | Critical |
| T5 | Job-card numbers come from a **global PostgreSQL sequence that the app creates at runtime** (`job_card_number_seq`, DDL inside `JobCardService`) | High |
| T6 | 12 `IgnoreQueryFilters()` calls would also bypass a future organization filter | High |
| T7 | `InvoiceNumberAllocation` is **not a `BaseEntity`**, so a filter added in the `BaseEntity` loop wouldn't cover it | High |
| T8 | First-time **bootstrap** endpoint creates the Owner whenever the database has no users. That's unsafe on a shared platform. | High |
| T9 | Hard-coded **E6 identity** in the backend (profile defaults, PDF and invoice fallbacks, WhatsApp template names), desktop (12 files) and Android (10 files plus app ID `com.e6.e6_car_spa`) | High |
| T10 | Public business-profile endpoint is anonymous and returns *the* singleton profile | High |

---

## 2. Entity classification (all 37 entities)

**Scope:**
- **O**: organization-owned (`OrganizationId`)
- **B**: branch-level operations (`OrganizationId` + `BranchId`)
- **C**: child row; inherits its scope from the parent but still gets `OrganizationId`, for row-level security and same-organization foreign-key checks
- **P**: platform or global

| # | Entity | Scope | Current unique keys / singleton | Change needed |
|---|---|---|---|---|
| 1 | Customer | O | — | Add `OrganizationId` |
| 2 | Vehicle | O | **`RegistrationNumber` global** | Make `(OrganizationId, RegistrationNumber)` unique (T1) |
| 3 | Service (catalogue) | O | — | Add `OrganizationId`; franchisor templates later (phase 6) |
| 4 | JobCard | B | **`JobCardNumber` global**; global sequence | Per-organization counter, `(OrganizationId, JobCardNumber)` (T1, T5) |
| 5 | JobCardService | C | — | Add `OrganizationId` |
| 6 | OutsideJob | B | — | Add organization and branch |
| 7 | Vendor | O | — | Add `OrganizationId` |
| 8 | Staff | O | **`StaffMasterId` global, `PhoneNumber` global** | Make both unique per organization (T1) |
| 9 | StaffAdvance | O | — | Add `OrganizationId` |
| 10 | StaffSalarySettlement | O | (StaffId, PeriodFrom, PeriodTo) | Add `OrganizationId`; key already scoped through Staff |
| 11 | StaffAttendance | O/B | (StaffId, AttendanceDate) | Add organization (and branch if staff work across branches) |
| 12 | StaffDailyAttendanceConfirmation | O/B | **`Date` global (one per day for the whole platform)** | `(OrganizationId[, BranchId], Date)` (T1, T4) |
| 13 | Showroom | O | **`MasterId` global** | `(OrganizationId, MasterId)` (T1) |
| 14 | ShowroomStaffAssignment | C | — | Add `OrganizationId` |
| 15 | ShowroomDailyAttendance | C | (ShowroomId, Date) | Add `OrganizationId` |
| 16 | ShowroomDailyBill | C | — | Add `OrganizationId` |
| 17 | ShowroomPayment | C | — | Add `OrganizationId` |
| 18 | ShowroomVehicleType | O | **`Code` global; `UX_ShowroomVehicleTypes_Name` global** | Composite with `OrganizationId`; seed per organization (T1) |
| 19 | ShowroomWorkType | O | **`Code` global; `UX_ShowroomWorkTypes_Name` global** | Same as 18; `IsOther` row seeded per organization |
| 20 | ShowroomStaffWorkSession | C | — | Add `OrganizationId` |
| 21 | ShowroomStaffSwap | C | **`SwapId` global** (`SWP-yyyyMMdd-n`) | `(OrganizationId, SwapId)` |
| 22 | ShowroomVehicleWork | C | — | Add `OrganizationId` |
| 23 | ShowroomVehicleWorkItem | C | — | Add `OrganizationId` |
| 24 | Invoice | B | **`InvoiceNumber` global**; `JobCardId` unique | `(OrganizationId, InvoiceNumber)`, or per GST registration (decision 25.1 in the architecture document) |
| 25 | InvoiceItem | C | — | Add `OrganizationId` |
| 26 | Payment | B | — | Add organization and branch |
| 27 | User | P/O | **`Username` global; single Owner global** | Users become platform identities; membership × organization × role (phase 2) (T2, T3) |
| 28 | Permission | P | `Code` | Stays platform-wide (the permission catalogue) |
| 29 | UserPermission | O | (UserId, PermissionId) | Moves under membership: (MembershipId, PermissionId) |
| 30 | BusinessProfile | O | **singleton** | One per organization; logo per organization (T4) |
| 31 | AuditLog | O | — | Add `OrganizationId`; platform-admin events kept separately |
| 32 | InvoicePublicLink | O | `TokenHash` global | **Keep global** (the token is the lookup); resolve the organization through the invoice |
| 33 | WhatsAppConfiguration | O/B | **singleton** | Per (organization, optional branch); `PhoneNumberId` unique platform-wide; envelope encryption (T4) |
| 34 | WhatsAppMessage | B | (InvoiceId, MessageType) | Add organization and branch; worker uses the message's organization configuration |
| 35 | SystemPreference | O | **singleton** | One per organization (T4) |
| 36 | InvoiceNumberSeries | O/TaxReg | **`SeriesKind` unique; prefix unique** | Per (organization or GST registration, kind[, financial year]) (T4) |
| 37 | InvoiceNumberAllocation | O/TaxReg | **`NormalizedNumber` global**; not a `BaseEntity` | Per (organization or GST registration, normalized number); **explicit tenant filter** (T7) |

**New platform tables** (from the architecture document):
- `Organization`, `Branch`, `TaxRegistration`
- `Membership` (+ branch scope)
- `BillingAccount`, `Plan`, `Subscription`, `OrganizationEntitlement`
- `FranchiseRelationship`, `OrgMetricsDaily`
- a platform-admin realm

---

## 3. Platform-wide unique constraints to make composite (T1)

From `Infrastructure/Configurations/*.cs` and migrations:

| Index / key | Location | Becomes |
|---|---|---|
| `Vehicles.RegistrationNumber` | `VehicleConfiguration.cs` | + `OrganizationId` |
| `JobCards.JobCardNumber` | `JobCardConfiguration.cs` | + `OrganizationId` |
| `Invoices.InvoiceNumber` | `InvoiceConfiguration.cs` | + `OrganizationId` (or GST registration) |
| `InvoiceNumberAllocations.NormalizedNumber` | `InvoiceNumberAllocationConfiguration.cs` | + organization or GST registration |
| `InvoiceNumberSeries.SeriesKind`, `UX_InvoiceNumberSeries_Prefix` | config + migration `20261004051221` | + organization or GST registration |
| `Staff.StaffMasterId`, `Staff.PhoneNumber` | `StaffConfiguration.cs` | + `OrganizationId` |
| `Showrooms.MasterId` (`IX_Showrooms_MasterId`) | migration `20260923214500` | + `OrganizationId` |
| `ShowroomStaffSwaps.SwapId` | `ShowroomStaffSwapConfiguration.cs` | + `OrganizationId` |
| `ShowroomVehicleTypes.Code`, `UX_ShowroomVehicleTypes_Name` | config + migration `20261004170844` | + `OrganizationId` |
| `ShowroomWorkTypes.Code`, `UX_ShowroomWorkTypes_Name` | config + migration `20261004170844` | + `OrganizationId` |
| `StaffDailyAttendanceConfirmations.Date` | `StaffDailyAttendanceConfirmationConfiguration.cs` | + organization[, branch] |
| `Users.Username`, `IX_Users_SingleOwner` | `UserConfiguration.cs` | Redesigned in phase 2 (memberships) |
| `SingletonKey` ×3 | `BusinessProfile`, `SystemPreference`, `WhatsAppConfiguration` configurations | Replaced by `OrganizationId` unique |

**Not changed:** `InvoicePublicLinks.TokenHash` (global by design) and `Permissions.Code` (platform-wide).

**Code-level uniqueness checks** (12 `AnyAsync(...)` calls, e.g. `UserService.cs:69`, `ShowroomOperationsService.cs:61-259, 1264-1273`, `JobCardService.cs:643`) become scoped to the organization **automatically** once the organization filter exists, provided they don't use `IgnoreQueryFilters()`.

---

## 4. Query filter, bypasses and raw SQL

**Global filter today:** soft-delete only, applied in a loop over `BaseEntity` types (`AppDbContext.cs`, `ApplySoftDeleteFilter`). Add the organization filter in the same loop, using EF Core 10 **named query filters**, so code that needs to see soft-deleted rows can bypass the soft-delete filter only, not the organization filter.

**Non-`BaseEntity` entities:**
- `InvoiceNumberAllocation` needs an explicit organization filter (T7).
- `Permission` is platform-wide and stays unfiltered.

**`IgnoreQueryFilters()` call sites (T6).** Each must keep the organization filter, either through named filters or an explicit `OrganizationId` predicate:

| File:line | Purpose |
|---|---|
| `Application/Services/InvoiceNumberAllocator.cs:73` | Number already used, including deleted invoices |
| `Application/Services/InvoiceTaxRates.cs:30` | Catalogue tax rates, including deleted services |
| `Application/Services/ShowroomService.cs:59, 567, 715, 1059, 1454, 1458` | MasterId and SwapId uniqueness, historical lookups |
| `Application/Services/StaffAdvanceService.cs:866` | Historical staff lookup |
| `Application/Services/StaffAttendanceService.cs:601` | Historical attendance lookup |
| `Infrastructure/Database/ShowroomOperationsSeeder.cs:33, 59` | Seeding; becomes per-organization provisioning |

**Raw SQL (5 call sites):**

| File:line | What | Change needed |
|---|---|---|
| `InvoiceNumberAllocator.cs:156, 169` | `SELECT … FOR UPDATE` on the series row | Add the organization / GST-registration key to the locked row |
| `InvoiceService.cs:447, 876` | Row locks by invoice Id | None (an Id is already unique) |
| `ShowroomService.cs:1111` | Lock the daily bill by (ShowroomId, Date) | None (a showroom belongs to one organization) |
| `JobCardService.cs:628-637` | `nextval('job_card_number_seq')` plus `CREATE SEQUENCE` at runtime | **Replace** with a per-organization counter row locked `FOR UPDATE`, like `InvoiceNumberSeries`. This also removes runtime DDL, which conflicts with the least-privilege database role from Phase 0. (T5) |
| `Program.cs:439` | Data fix on `StaffAdvances` at every startup | Move into a one-off migration; it would run against every tenant's data on every restart |

**Row-level security (defence in depth):** PostgreSQL policies on `OrganizationId`, with a session variable set from the request's organization. The application already connects as a separate least-privilege role (`scripts/db/create-app-role.sql`), which is the role these policies would bind to.

---

## 5. Authentication and request context (T2, T3, T8)

| Item | Today | Needed |
|---|---|---|
| JWT claims (`JwtTokenService.cs`) | sub, name, username, `Role`, `isOwner` | + `org` (active organization), membership ID, branch scope; issuer and audience named for the product, not `E6CarSpa` (`JwtOptions.cs:27-30`) |
| Owner | One platform-wide (`IX_Users_SingleOwner`) | **One Owner per organization**: a membership role |
| Username | Unique platform-wide | Platform identity (email or phone) plus an organization picker after login, or usernames unique per organization plus an organization code at login. **Decision needed.** |
| Bootstrap (`AuthController` `POST /api/auth/bootstrap`, `AuthService.cs:22-32`) | Creates the Owner when the database has no users | **Disabled in SaaS.** Trovo's admin provisions the organization and invites its Owner |
| Permissions | Per user (`UserPermission`) | Per membership; see `E6_RBAC_PERMISSIONS_AUDIT.md` |
| Rate limiting (`Program.cs:190-235`) | Partitioned by IP address | Add partitions per user and per organization (many users share one IP behind shop routers) |

---

## 6. Anonymous endpoints

| Endpoint | Today | Needed |
|---|---|---|
| `PublicInvoicesController` | Invoice by link token | OK; resolve the organization through invoice → organization, and brand the page with that organization's profile |
| `PublicBusinessProfileController` `GET` | Returns **the** singleton profile (T10) | Take an organization reference (from the link, or the organization code for the login page), or remove it |
| `AuthController` status, bootstrap, login | Global | status/bootstrap: platform provisioning; login gains organization handling |

---

## 7. Background jobs, files and integrations

| Area | Today | Needed |
|---|---|---|
| `WhatsAppBackgroundWorker` (`Infrastructure/BackgroundJobs`) | One worker, global queue, one configuration | Load configuration per message's organization; fair per-organization batching and rate limits; health probe per configuration |
| `WhatsAppService` static `_messageLocks` (keyed by message Id) | Fine | None |
| WhatsApp template defaults `e6_carspa_*` (`WhatsAppService.cs:1836-1838`, `WhatsAppConfigurationConfiguration.cs:54,64`) and name stripping `"e6 car spa"` (`WhatsAppService.cs:1592-1645`) | E6-specific | Product-neutral template names created per client account by Embedded Signup provisioning; strip the client's own business name |
| Logo upload (`BusinessProfileService.cs:156-177`) | Local `wwwroot/uploads/logos/logo_<guid>.<ext>` | Per-organization folder (`uploads/<orgId>/logo_…`) or object storage; included in backups. **Required by decision 1 (client uploads logo).** |
| Seeders | `PermissionSeeder` (platform, OK); `ShowroomOperationsSeeder` (global types); default `BusinessProfile` with E6 values | Organization provisioning service seeds per organization: profile, preferences, series, showroom types |

---

## 8. Hard-coded E6 identity (T9)

**Backend**
- `Domain/Entities/BusinessProfile.cs:15,26,42`: defaults "E6 Car Spa", "Erode", the E6 email
- `Application/Services/BusinessProfileService.cs:265,299-306`: E6 fallbacks; `e6-logo.png`
- `Application/Services/InvoicePdfGenerator.cs:62-70`: PDF fallbacks
- `Application/Services/InvoiceService.cs:1228-1235`: public invoice fallbacks
- WhatsApp template names (section 7)
- `Application/Common/JwtOptions.cs:27,30`: issuer and audience

**Desktop (`apps/desktop/renderer/src`)**
- Shell and auth: `components/auth/RouteGuard.tsx`, `components/shell/Header.tsx`, `components/shell/Sidebar.tsx`, `features/auth/FirstTimeSetup.tsx`, `features/auth/LoginPage.tsx`
- Pages: `features/dashboard/DashboardPage.tsx`, `features/invoices/InvoiceDetailPage.tsx`, `features/invoices/PublicInvoicePage.tsx`, `features/job-cards/JobCardDetails.tsx`
- Exports: `features/reports/excelMonthlyBillingGenerator.ts`, `features/reports/excelMonthlyShowroomGenerator.ts`
- Data: `constants/catalogue.ts`
- API base URL: `lib/api.ts:7-10` uses `VITE_API_URL` at build time, falling back to `http://localhost:5298`. SaaS needs the cloud URL baked in, or set at sign-in.

**Android (`apps/android/lib`)**
- `core/constants/app_constants.dart`: app name, default URLs including a LAN IP
- Auth: `features/auth/.../first_time_setup_screen.dart`, `login_screen.dart`
- `features/dashboard/.../dashboard_screen.dart`
- Settings: `business_profile_model.dart`, `public_business_profile_model.dart`, `business_info_card.dart`, `settings_provider.dart`
- Showroom: `showroom_list_screen.dart`, `showroom_form_sheet.dart`
- `android/app/build.gradle.kts:18,32`: application ID `com.e6.e6_car_spa`. A product ID such as `in.trovotech.<product>` means **a new Play Store listing**; decide before the first public release.

---

## 9. Reports and franchise visibility

- `ReportService` (12 endpoints) relies on the global filter. It's automatically scoped to the organization once the organization filter exists, as long as no `IgnoreQueryFilters()` is involved.
- **Franchisor reports must not read franchisees' operational tables.** They read `OrgMetricsDaily` aggregates, granted by `FranchiseRelationship` scopes (architecture document §14).

---

## 10. Data migration for E6 (first tenant)

1. Create organization "E6 Car Spa", its default branch and its GST registration from the current `BusinessProfile`.
2. Backfill `OrganizationId` (and `BranchId`) on all 35 tenant tables.
3. Replace the unique indexes (section 3) inside the same migration, **after** the backfill.
4. Convert singletons to E6's per-organization rows. Move `job_card_number_seq`'s current value into E6's counter row.
5. Convert users: create E6 memberships, with the current Owner as E6's Owner, and move `UserPermission` rows to memberships.
6. Re-encrypt the WhatsApp token under E6's data key.
7. **Verify:** row counts per table before and after, no NULL `OrganizationId`, invoice and job-card numbers unchanged, cross-tenant test suite green.

**Approach:**
- E6 currently runs on its own PC database. The SaaS version starts as a **new hosted database**, and E6's data is imported once.
- The PC version keeps running until the switch-over day.

---

## 11. Size of the change

| Area | Count |
|---|---|
| Tenant tables to change | 35 of 37 |
| Unique constraints to redesign | 20 (including 3 singletons) |
| Filter bypasses to review | 12 |
| Raw SQL sites to change | 3 of 5 (allocator lock, job-card sequence, startup data fix) |
| Controllers / endpoints in scope | 27 / about 185 (mostly unchanged; scoped through the filter) |
| Hard-coded identity files | backend 7, desktop 12, Android 11 |

The phase 1 estimate from the architecture document still holds: **4–7 weeks** for one developer, the critical phase.

---

## 12. Recommended order for Phase 1

1. **Cross-tenant test harness first:** two organizations, with every endpoint asserting that it can't see or change the other organization's data.
2. Add `Organization`, `Branch`, `TaxRegistration` and the tenant context, set from the request.
3. Organization filter (named filters) plus save-time stamping plus same-organization foreign-key checks.
4. Add `OrganizationId` / `BranchId` columns with the backfill migration, then the composite unique indexes.
5. Review the 12 bypasses and change the 3 raw SQL sites; job-card counter table.
6. Per-organization singletons and provisioning service; disable bootstrap.
7. PostgreSQL row-level security as a backstop.
8. Remove hard-coded E6 identity (backend first, then clients).

Phase 2 (memberships and organization-scoped login) follows. It depends on decision T3 (login identity) and the RBAC audit.

## 13. Decisions still needed before Phase 1
1. **Login identity:** platform-wide email or phone with an organization picker (recommended), or username plus organization code?
2. **Invoice and job-card numbering scope:** per organization or per GST registration (branch)? Reset each financial year? Ask the accountant.
3. **Product name** and Android application ID, before the first Play Store release.
