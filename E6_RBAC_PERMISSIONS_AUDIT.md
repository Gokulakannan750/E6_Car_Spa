# E6 Car Spa — User Permissions / RBAC Audit

**Type:** audit only. No source code, database, migration, role or permission was changed.
**Date:** 6 October 2026
**Code audited:** branch `main` @ `9b33ccb3`, which already contains Phase 0, Phase 1 GST, GST invoice-number editing and the Showroom vehicle/work-type work.

**Method:**
- Backend: all 26 controllers were parsed and every one of the 178 HTTP endpoints was mapped to its attributes and inline checks. Every service write was mapped to its audit-log call.
- Clients: every permission code referenced in the desktop renderer and the Flutter app was traced to the route, menu and action check that uses it.

**Source of truth:** source code. Existing markdown documents were not relied on.

**Risk levels:** CRITICAL / HIGH / MEDIUM / LOW / INFO.

**What the platform columns mean:**
- "Windows" is the Electron/React desktop and "Android" is the Flutter app.
- A UI check is a convenience only. The **backend is the security boundary**.

---

## 1. Executive Summary

**Overall:** the backend is the strongest layer.
- Every write endpoint carries `[RequirePermission]`, or is deliberately Owner-only with a database-verified check.
- Permissions are re-read from the database on every request, so revocation is immediate.
- Only the Owner can grant permissions, create Managers or change roles.
- The Owner can't be created through the API, deactivated, demoted or deleted.
- Most financial writes are audited.

**No endpoint was found that performs a write with no authorization at all.**

The problems are about **meaning** rather than missing locks:

| # | Finding | Risk |
|---|---|---|
| C-1 | A Manager with `users.edit` can reset any **Staff** user's password, then log in as that Staff user and use permissions the Owner granted to Staff but not to the Manager. This is privilege escalation by account takeover. It is audited, but not prevented. | **CRITICAL** |
| H-1 | `reports.view` alone returns sales, collections, outstanding, showroom revenue and **staff-advance totals and recent advances (names and amounts)**, through `/api/reports/dashboard`. This makes `reports.sales`, `reports.payments`, `reports.showrooms` and `reports.staff_advances` largely ineffective. | HIGH |
| H-2 | `reports.view` alone also returns the monthly billing report (sales/GST/payments) and the outside-jobs report (vendor costs). | HIGH |
| H-3 | `jobcards.edit` lets a user change an outside-job **vendor cost**. That cost is written straight into the **draft invoice line price**, bypassing `invoices.edit_draft` and `invoices.price_override`. | HIGH |
| H-4 | `outsidejobs.view`, `outsidejobs.manage`, `vendors.view` and `vendors.manage` are shown in the Users UI but **enforced nowhere**. Unticking "Manage Vendors" does not stop vendor management, which actually needs `jobcards.edit`. | HIGH |
| H-5 | Setting the **showroom daily bill amount** (a receivable) writes no audit entry. Showroom create/update/activate and staff assignment create/update/remove are also unaudited. | HIGH |

**Further issues:**
- **14 permissions are unused**, all visible in the UI.
- **3 phantom codes** are checked by the clients but don't exist (`staff.manage`, `showrooms.view`, `showrooms.manage`).
- Desktop staff routes are all guarded by the wrong permission, and Windows and Android gate the staff suite and reports differently.
- **Seven Owner-only rules** are hard-coded in code rather than expressed as permissions.
- There is no role template, so every user's permissions are set by hand.

**Before a subscription/module architecture is built:**
- fix C-1 and H-1 to H-5;
- remove dead and phantom codes;
- make report data follow report permissions;
- separate "module enabled" from "user permitted" (today the Owner bypass would swallow any module check).

---

## 2. Current RBAC Architecture

### 2.1 Backend [verified in code]

| Element | Implementation | File |
|---|---|---|
| Stack | ASP.NET Core (.NET 10), EF Core, PostgreSQL | — |
| Authentication | Custom JWT (HMAC-SHA256), 24 h expiry, no refresh token. Claims: `sub`, `nameidentifier`, `name`, `unique_name`, `role`, `isOwner`. | `Application/Services/JwtTokenService.cs:27-35` |
| Login / bootstrap | Anonymous `POST /api/auth/login`; `POST /api/auth/bootstrap` creates the first Owner only when no users exist | `Controllers/AuthController.cs`, `Application/Services/AuthService.cs:22-61` |
| Roles | Enum `UserRole { Owner=1, Manager=2, Staff=3 }`, a single column on `User` | `Domain/Enums/UserRole.cs` |
| Permissions | `Permissions` table (`Code`, `Name`, `Module`, `Description`), seeded idempotently at startup. Codes are added if missing and **never removed or renamed**. | `Infrastructure/Database/PermissionSeeder.cs:12-149`, called from `Program.cs:447` |
| User ↔ permission | `UserPermissions` (UserId, PermissionId), unique pair. **There is no role ↔ permission table**: Manager and Staff have no default permissions; each user gets an individual set. | `Infrastructure/Configurations/UserPermissionConfiguration.cs` |
| Policy | `[RequirePermission("code")]` → dynamic policy `Permission:code` → `PermissionAuthorizationHandler` | `Infrastructure/Authorization/*` |
| Handler logic | Loads the user from the database on every request. Inactive → deny. **Owner → succeed for every permission.** Otherwise succeed only if a `UserPermissions` row with that code exists. | `PermissionAuthorizationHandler.cs:9-56` (Owner rule line 39) |
| Inline checks | `AuthorizeAsync(User, "Permission:invoices.discount")` when a discount is supplied | `InvoicesController.cs:88-94`, `JobCardsController.cs` Create / UpdateServices |
| Owner-only rules | Coded checks (`UserRole.Owner`), **not permissions**: invoice-number change, invoice-series prefixes, staff-attendance unlock, showroom-attendance unlock, working on a locked showroom date, showroom vehicle/work-type management, creating Managers / assigning permissions / changing roles / managing other Managers | `InvoiceService.cs:650-653`, `InvoiceSeriesService.cs:33-36`, `StaffAttendanceController.cs:247`, `ShowroomsController.cs:180`, `ShowroomService.cs:309,624`, `ShowroomVehicleTypesController.cs:22-25`, `ShowroomWorkTypesController.cs:22-25`, `UserService.cs:47-65,149-187,321-330` |
| How Owner is detected | Database (`IsActiveOwnerAsync` or user reload) in Users, Invoice, InvoiceSeries, StaffAttendance and Showrooms. **JWT claim only** in `ShowroomStaffAssignmentsController.cs:19-26`, `ShowroomVehicleTypesController.cs:22-25` and `ShowroomWorkTypesController.cs:22-25`. | — |
| `/api/auth/me` and login | Return `isOwner` plus the permission list. **The Owner receives an empty list**, so clients must special-case `isOwner`. | `AuthService.cs:196-198,221` |
| Audit | `AuditLogService.RecordAsync` with old/new JSON values, user, role and IP; viewer protected by `audit.view` | `Application/Services/AuditLogService.cs`, `Controllers/AuditLogsController.cs` |

### 2.2 Windows desktop

- **Session:** the token is stored through Electron `safeStorage` (`apps/desktop/electron/main.ts:188-215`).
- **`hasPermission(code)`:** returns true for the Owner (`isOwner` or role `Owner`), otherwise checks `user.permissions` (`features/auth/auth-context.tsx:261-270`).
- **Route guard:** `components/auth/RouteGuard.tsx` takes one `requiredPermission` per route (`router/index.tsx`).
- **Menu:** the sidebar filters by `requiresPermission` (`constants/navigation.ts`, `components/shell/Sidebar.tsx:60`).
- **Action checks:** scattered `hasPermission(...)` and `isOwner` calls in feature pages.
- **Users & Permissions UI:** `features/users/UsersManagementPage.tsx`, `UserForm.tsx` and `PermissionSelector.tsx`. The permission list comes from the API (`GET /api/users/permissions`), so **every seeded code is shown**.

### 2.3 Android

- **Session:** `FlutterSecureStorage`.
- **`AuthUser.hasPermission`:** Owner gets everything (`features/auth/models/auth_user.dart`).
- **Router:** `core/navigation/app_router.dart` **has no permission guards**, only authentication and setup redirects. Each screen checks permissions itself, and the home-screen tiles filter by permission (`dashboard_screen.dart:265-330`).
- **Several screens read `user.permissions.contains(...)` directly** instead of `hasPermission`, so the Owner is handled by a separate `isOwner ||` in each place.
- **Users & Permissions UI:** `features/users/presentation/...` (`users_screen.dart`, `user_form_sheet.dart`, `permission_selector.dart`), also driven by the API.

---

## 3. Current Permission Inventory (82 codes)

Columns:
- **Backend** — number of endpoints enforcing the code.
- **Windows / Android** — the code is referenced in that client.
- **UI exposed** — shown in the Users & Permissions selector. That is true for every code, because the selector is driven by the API.

| Permission | Module (seed) | Backend | Windows | Android | UI exposed | Status |
|---|---|---|---|---|---|---|
| `dashboard.view` | Dashboard | — | ✓ | — | ✓ | UI-only |
| `customers.view` | Customers | 5 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `customers.create` | Customers | 1 endpoint(s) | — | — | ✓ | Used |
| `customers.edit` | Customers | 1 endpoint(s) | — | ✓ | ✓ | Used |
| `customers.delete` | Customers | 1 endpoint(s) | — | — | ✓ | Used |
| `vehicles.view` | Vehicles | 4 endpoint(s) | — | — | ✓ | Used |
| `vehicles.create` | Vehicles | 1 endpoint(s) | — | — | ✓ | Used |
| `vehicles.edit` | Vehicles | 2 endpoint(s) | — | — | ✓ | Used |
| `vehicles.delete` | Vehicles | 1 endpoint(s) | — | — | ✓ | Used |
| `jobcards.view` | Job Cards | 13 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `jobcards.create` | Job Cards | 1 endpoint(s) | ✓ | — | ✓ | Used |
| `jobcards.edit` | Job Cards | 10 endpoint(s) | — | ✓ | ✓ | Used (overloaded, see H-3/H-4) |
| `jobcards.delete` | Job Cards | 1 endpoint(s) | — | — | ✓ | Used |
| `jobcards.print` | Job Cards | 1 endpoint(s) | — | — | ✓ | Used |
| `outsidejobs.view` | Job Cards | — | — | — | ✓ | **UNUSED** |
| `outsidejobs.manage` | Job Cards | — | — | — | ✓ | **UNUSED** |
| `vendors.view` | Vendors | — | — | — | ✓ | **UNUSED** |
| `vendors.manage` | Vendors | — | — | — | ✓ | **UNUSED** |
| `catalogue.view` | Catalogue | 3 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `catalogue.create` | Catalogue | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `catalogue.edit` | Catalogue | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `catalogue.delete` | Catalogue | 1 endpoint(s) | — | — | ✓ | Used |
| `invoices.view` | Invoices | 5 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `invoices.edit_draft` | Invoices | 3 endpoint(s) | — | — | ✓ | Used |
| `invoices.generate` | Invoices | 4 endpoint(s) | — | — | ✓ | Used (also controls public links) |
| `invoices.cancel` | Invoices | 1 endpoint(s) | — | — | ✓ | Used |
| `invoices.discount` | Invoices | 3 endpoint(s) | ✓ | — | ✓ | Used (inline) |
| `invoices.price_override` | Invoices | — | — | — | ✓ | **UNUSED** |
| `invoices.record_payment` | Invoices | — | — | — | ✓ | **UNUSED** (duplicate of `payments.record`) |
| `invoices.print` | Invoices | — | — | — | ✓ | **UNUSED** |
| `payments.view` | Payments | 1 endpoint(s) | — | — | ✓ | Used |
| `payments.record` | Payments | 1 endpoint(s) | ✓ | — | ✓ | Used |
| `payments.edit` | Payments | — | — | — | ✓ | **UNUSED** (no feature) |
| `payments.void` | Payments | — | — | — | ✓ | **UNUSED** (no feature) |
| `showroom.view` | Showroom | 16 endpoint(s) | ✓ | ✓ | ✓ | Used (includes receivables) |
| `showroom.manage` | Showroom | 9 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `showroom.assign_staff` | Showroom | 4 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `showroom.edit_attendance` | Showroom | 1 endpoint(s) | ✓ | — | ✓ | Used |
| `showroom.confirm_attendance` | Showroom | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `showroom.manage_billing` | Showroom | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `showroom.record_payment` | Showroom | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `showroom.delete_payment` | Showroom | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `showroom.view_history` | Showroom | 2 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `showroom.record_work` | Showroom | 2 endpoint(s) | — | — | ✓ | Used (backend only) |
| `showroom.edit_work` | Showroom | 1 endpoint(s) | — | — | ✓ | Used (backend only) |
| `showroom.manage_transfers` | Showroom | 3 endpoint(s) | — | — | ✓ | Used (backend only) |
| `staff.view` | Staff | 3 endpoint(s) | — | ✓ | ✓ | Used |
| `staff.view_sensitive` | Staff | 2 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `staff.create` | Staff | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `staff.edit` | Staff | 4 endpoint(s) | ✓ | ✓ | ✓ | Used (UI also treats it as salary rights, see M-5) |
| `staff.delete` | Staff | 1 endpoint(s) | — | — | ✓ | Used |
| `staff.advances` | Staff | — | — | — | ✓ | **UNUSED** (legacy duplicate) |
| `staff_advances.view` | Staff Advances | 4 endpoint(s) | ✓ | ✓ | ✓ | Used (desktop misuses it as staff-suite gate) |
| `staff_advances.create` | Staff Advances | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `staff_advances.edit` | Staff Advances | — | — | — | ✓ | **UNUSED** |
| `staff_advances.delete` | Staff Advances | — | — | — | ✓ | **UNUSED** |
| `staff_advances.settle` | Staff Advances | 1 endpoint(s) | — | ✓ | ✓ | Used |
| `staff_advances.obsolete` | Staff Advances | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `staff_attendance.view` | Staff Attendance | 3 endpoint(s) | — | — | ✓ | Used |
| `staff_attendance.manage` | Staff Attendance | 3 endpoint(s) | — | ✓ | ✓ | Used |
| `staff_attendance.confirm` | Staff Attendance | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `staff_salary.view` | Staff Salary | 3 endpoint(s) | — | — | ✓ | Used |
| `staff_salary.manage` | Staff Salary | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `staff_salary.settle` | Staff Salary | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `reports.view` | Reports | 3 endpoint(s) | ✓ | ✓ | ✓ | Used (**too broad**, H-1/H-2) |
| `reports.sales` | Reports | 1 endpoint(s) | — | ✓ | ✓ | Used |
| `reports.payments` | Reports | 1 endpoint(s) | — | ✓ | ✓ | Used |
| `reports.invoices` | Reports | 1 endpoint(s) | — | ✓ | ✓ | Used |
| `reports.gst` | Reports | 1 endpoint(s) | — | ✓ | ✓ | Used |
| `reports.job_cards` | Reports | 1 endpoint(s) | — | ✓ | ✓ | Used |
| `reports.showrooms` | Reports | 2 endpoint(s) | — | ✓ | ✓ | Used |
| `reports.staff_productivity` | Reports | 1 endpoint(s) | — | ✓ | ✓ | Used |
| `reports.staff_advances` | Reports | 1 endpoint(s) | — | ✓ | ✓ | Used |
| `reports.export` | Reports | — | — | — | ✓ | **UNUSED** |
| `audit.view` | Audit | 1 endpoint(s) | ✓ | — | ✓ | Used (no Android audit screen) |
| `settings.view` | Settings | 6 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `settings.edit` | Settings | — | — | — | ✓ | **UNUSED** |
| `settings.business` | Settings | 7 endpoint(s) | ✓ | ✓ | ✓ | Used (**too broad**, M-15) |
| `users.view` | Users | 3 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `users.create` | Users | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |
| `users.edit` | Users | 1 endpoint(s) | ✓ | ✓ | ✓ | Used (see C-1) |
| `users.deactivate` | Users | 1 endpoint(s) | ✓ | ✓ | ✓ | Used |

**Phantom codes** — checked in clients, but not defined and not grantable:

| Code | Where |
|---|---|
| `staff.manage` | Android: `staff_attendance_tab.dart:149,153`, `staff_salary_tab.dart:151`, `salary_staff_card.dart:49,54` |
| `showrooms.view` | Android `dashboard_screen.dart:302`; Windows `ShowroomOperationsPage.tsx:128` |
| `showrooms.manage` | Windows `ShowroomOperationsPage.tsx:126` |
| `*` (wildcard) | Android `dashboard_screen.dart:267`, `billing_screen.dart:81`; Windows `ShowroomOperationsPage.tsx:129` |

Codes are validated against the `Permissions` table when assigned, so none of these can ever be granted.

**Owner-only rules with no permission:** listed in §2.1 (seven areas).

---

## 4. Current Role Inventory

The system supports exactly **three roles**. Roles are a label plus a few hard-coded rules; **they carry no permission set**. A Manager or Staff user has only the permissions individually ticked for them.

| Role | Current permissions | Intended access (inferred from code) | Excess access | Missing access | Risk |
|---|---|---|---|---|---|
| **Owner** | Everything (handler bypass, both UIs) plus all Owner-only rules | Business owner | Bypasses every permission, including future module checks (blocks entitlements, §22) | No delegation: invoice-number changes, prefixes and attendance unlocks can't be given to a trusted manager. Only one Owner can exist; no transfer or recovery path. | MEDIUM |
| **Manager** | Only what the Owner ticks. Role-based extras: may create **Staff** users (with `users.create`) and edit, reset the password of, or deactivate **Staff** users (with `users.edit` / `users.deactivate`). | Supervisor | With `users.edit`, can take over any Staff account (C-1) | Can never grant permissions (by design) | **CRITICAL** (via C-1) |
| **Staff** | Only what the Owner ticks | Operational user | — | — | LOW |

Other roles named in the brief (Administrator, Billing Staff, Technician, Accountant, Showroom Staff, Read-only) **don't exist**. The Manager/Staff distinction only affects user-administration rules.

---

## 5. Feature → Permission Matrix

Format: **Backend permission** (endpoint) / Windows UI gate / Android UI gate.

"none" means the action is visible to anyone who can open the screen; the API still enforces the code. "N/A" means the feature doesn't exist.

### E6 Billing

| Feature | Backend | Windows | Android | Notes |
|---|---|---|---|---|
| View customers | `customers.view` | route `customers.view` | `customers.view` | ✓ |
| Create customer | `customers.create` | **none** | **none** | UI shows button to everyone |
| Edit customer | `customers.edit` | **none** | `customers.edit` | Parity gap |
| Delete customer | `customers.delete` (soft delete) | **none** | **none** | |
| View / create / edit / delete vehicle | `vehicles.view/create/edit/delete` | **none** | **none** | Vehicles are created inside the customer dialog; UI unaware |
| Transfer vehicle ownership | `vehicles.edit` | none | none | Ownership transfer arguably deserves its own check (LOW) |
| View job cards | `jobcards.view` | route `jobcards.view` | `jobcards.view` | ✓ |
| Create job card | `jobcards.create` (+ `invoices.discount` if discount) | route `/job-cards/new` `jobcards.create` | none | |
| Edit job-card services | `jobcards.edit` (+ discount) | **none** | `jobcards.edit` | |
| Delete job card | `jobcards.delete` | none | none | |
| Print job card | `jobcards.print` | none | none | |
| Change job-card status / assign staff / complete | **N/A — no endpoint** | — | — | Status only changes as a side effect of invoicing (INFO) |
| View outside jobs | `jobcards.view` | (job-card screens) | (job-card screens) | `outsidejobs.view` unused |
| Send vehicle out / edit / return / cancel / delete outside job | `jobcards.edit` | none | `jobcards.edit` | `outsidejobs.manage` unused (H-4) |
| **Edit vendor cost** | `jobcards.edit` | none | `jobcards.edit` | **Changes draft invoice price** (H-3) |
| View vendors | `jobcards.view` | none | none | `vendors.view` unused |
| Create / edit / delete vendor | `jobcards.edit` | none | none | `vendors.manage` unused (H-4) |
| View invoices | `invoices.view` | route `invoices.view` | `invoices.view` | |
| Create draft invoice ("Mark as Finished") | `invoices.edit_draft` | none | none | |
| Edit draft (discount, GST on/off, notes) / preview | `invoices.edit_draft` (+ `invoices.discount` if discount > 0) | discount field `invoices.discount` | none | GST toggle needs only `edit_draft` (M-8) |
| Finalise / generate | `invoices.generate` | **none** | **none** | |
| Cancel | `invoices.cancel` | **none** | **none** | |
| Delete / void invoice | **N/A** (by design) | — | — | |
| Change invoice number (GST, fully paid) | **Owner only** (service, DB-verified) | `isOwner` | `isOwner` | Not delegable (M-11) |
| Change series prefixes | **Owner only** (service, DB-verified) | `isOwner` | `isOwner` | |
| Print / PDF | client-side from `invoices.view` data | none | none | `invoices.print` unused |
| Share / public link create, rotate, revoke | `invoices.generate`; status read `invoices.view` | none | none | |
| WhatsApp invoice | automatic on generate / full payment (server) | — | — | No manual send endpoint |
| View payments | `payments.view` (list) — but payments are also embedded in `GET /api/invoices/{id}` under `invoices.view` | — | — | `payments.view` is effectively bypassed (LOW) |
| Record payment | `payments.record` | `payments.record` | **none** | Parity gap |
| Edit / reverse payment | **N/A** (`payments.edit` / `void` defined, unused) | — | — | Functional gap (M-17) |
| View catalogue | `catalogue.view` | route `catalogue.view` | `catalogue.view` | |
| Create / edit service (including price) | `catalogue.create` / `edit` | ✓ | ✓ | Price change = `catalogue.edit` (acceptable) |
| Delete service | `catalogue.delete` | none | none | |

### E6 Staff

| Feature | Backend | Windows | Android | Notes |
|---|---|---|---|---|
| Open staff suite | — | route `/staff` → **`staff_advances.view`** | `staff.view` | Mismatch (M-2/M-3) |
| View staff | `staff.view` | (route uses `staff_advances.view`) | `staff.view` | |
| Create / edit / delete staff | `staff.create` / `edit` / `delete` | create/edit ✓, delete none | create/edit ✓ | |
| View / reveal Aadhaar, view document | `staff.view_sensitive` | ✓ | ✓ | ✓ |
| Upload / delete Aadhaar document | `staff.edit` | ✓ | ✓ | |
| Default showroom | `staff.view` / `staff.edit` | | | |
| View attendance / monthly report | `staff_attendance.view` | route `/staff-attendance` → **`staff_advances.view`** | (staff suite) | Wrong gate on desktop |
| Record / edit / delete attendance | `staff_attendance.manage` (+ locked-date rule: Owner only) | **none** | `staff_attendance.manage` or phantom `staff.manage` | |
| Confirm (lock) attendance | `staff_attendance.confirm` | ✓ | ✓ | |
| Unlock attendance | **Owner only** (controller, DB) | `isOwner` | `isOwner` | |
| View advances | `staff_advances.view` | ✓ | ✓ | |
| Create advance | `staff_advances.create` | ✓ | ✓ | |
| Edit / delete advance | **N/A** (codes unused) | | | Obsolete instead |
| Settle advance | `staff_advances.settle` | **none** | ✓ | |
| Obsolete advance (with reason) | `staff_advances.obsolete` | ✓ | ✓ | |
| View salary roster / preview / history | `staff_salary.view` | route `/staff-salary` → **`staff_advances.view`** | (staff suite `staff.view`) | |
| Enter / calculate salary | `staff_salary.manage` | `staff_salary.manage` **or `staff.edit`** | same **or `staff.edit` or phantom** | UI over-grants (M-5) |
| Settle salary (recovers advances) | `staff_salary.settle` | `staff_salary.settle` **or `staff.edit`** | same | UI over-grants (M-5) |
| Modify settled salary | Blocked for everyone (`StaffSalaryService.cs:287-291`) | — | — | ✓ Immutable |

### E6 Showroom

| Feature | Backend | Windows | Android | Notes |
|---|---|---|---|---|
| View showrooms, daily staff, bill, swaps | `showroom.view` | ✓ | ✓ | |
| Create / edit / activate showroom | `showroom.manage` (toggle also reads Owner for lock rules) | ✓ | ✓ | **Not audited** (H-5) |
| Vehicle / work types | `showroom.manage` **and Owner** (JWT claim) | `isOwner` | `isOwner` | Effectively Owner-only |
| Assign / swap / reverse swap / remove staff | `showroom.assign_staff` (+ Owner for locked dates) | ✓ | ✓ | Assign/update/remove **not audited** |
| Edit vehicles-attended count | `showroom.edit_attendance` | ✓ | — | Android parity gap |
| Confirm attendance | `showroom.confirm_attendance` | ✓ | ✓ | |
| Unlock attendance | **Owner only** | ✓ | ✓ | |
| Work sessions (create / update / close) | `showroom.manage_transfers` | **page lets any `showroom.view` user see manage UI** (`ShowroomOperationsPage.tsx:123-130`) | — | M-4 |
| Log / batch log vehicle work | `showroom.record_work` | (same over-broad UI flag) | — | |
| Edit vehicle work | `showroom.edit_work` | (same) | — | |
| Operations summary, showroom summary | `showroom.view_history` | ✓ | ✓ | |
| Set daily bill amount | `showroom.manage_billing` | ✓ | ✓ | **Not audited** (H-5) |
| Record showroom payment | `showroom.record_payment` | ✓ | ✓ | Audited |
| Delete showroom payment | `showroom.delete_payment` | ✓ | ✓ | Audited |
| Edit showroom payment | **N/A** | | | |
| View receivables (`GET /showrooms/outstanding`) | `showroom.view` | ✓ | ✓ | Financial data with view-only right (M-9) |

### E6 Reports

| Report | Backend | Windows | Android | Data actually exposed |
|---|---|---|---|---|
| Dashboard summary (`/reports/dashboard`) | `reports.view` | Reports page (all tabs) | Reports screen | **Sales, collections by method, outstanding, showroom revenue, staff advances (totals plus recent advances with names), top services, revenue timeline** (H-1) |
| Monthly billing Excel (`/reports/billing/monthly`) | `reports.view` | ✓ | ✓ | Invoices, GST, payments (H-2) |
| Outside-jobs report | `reports.view` | ✓ | ✓ | Vendor costs (H-2) |
| Sales | `reports.sales` | not used | ✓ | |
| Payments | `reports.payments` | not used | ✓ | |
| Outstanding invoices | `reports.invoices` | not used | ✓ | |
| GST | `reports.gst` | not used | ✓ | |
| Job cards | `reports.job_cards` | not used | ✓ | |
| Showroom report / monthly | `reports.showrooms` | tab gated by `reports.view` only | ✓ | Desktop tab errors without `reports.showrooms` |
| Staff productivity | `reports.staff_productivity` | tab gated by `reports.view` | ✓ | |
| Staff advances report | `reports.staff_advances` | Staff tab uses the **dashboard** data instead | ✓ | Bypass via H-1 |
| Custom reports | (dashboard data) | `reports.view` | — | |
| Export / download | client-side Excel from data already fetched | anyone with the tab | — | `reports.export` unused (L-4) |

### Settings and administration

| Feature | Backend | Windows | Android | Notes |
|---|---|---|---|---|
| View company settings / series / preferences / WhatsApp | `settings.view` | ✓ | ✓ | WhatsApp GET never returns the token (`HasAccessToken` only) ✓ |
| Edit company profile, logo, terms | `settings.business` | ✓ | ✓ | Audited |
| Series prefixes | Owner only | ✓ | ✓ | Audited |
| System preferences edit | `settings.business` | `settings.view` gate on page | — | `settings.edit` unused |
| WhatsApp credentials, templates, test connection, test message | `settings.business` | `settings.business` / `isOwner` | — | Config update audited; tests not (LOW) |
| Users view / create / edit / deactivate | `users.view/create/edit/deactivate` plus Owner rules | ✓ | ✓ | Audited (see M-1) |
| Assign permissions / change role | **Owner only** | ✓ | ✓ | |
| Create / edit roles | **N/A** | | | |
| Audit trail view and filter | `audit.view` | ✓ | — (no screen) | No export |

---

## 6. Backend Authorization Matrix (summary)

All 178 endpoints were classified:

| Class | Count | Endpoints |
|---|---|---|
| `[RequirePermission]` | 165 | All CRUD and financial endpoints |
| Anonymous | 5 | `auth/status`, `auth/bootstrap`, `auth/login`, `public/business-profile`, `public/invoices/{token}` |
| Authenticated only, **with Owner check in code** | 4 | `PUT invoices/{id}/invoice-number`, `PUT settings/invoice-series`, `POST staff-attendance/unlock`, `POST showrooms/{id}/daily-staff/{date}/unlock` — all verified Owner-only by database lookup ✓ |
| Authenticated only (by design) | 1 | `GET auth/me` |
| No auth | 1 | `GET health` |
| Permission **plus** Owner (JWT claim) | 6 | showroom vehicle/work-type create/update/toggle |

**UI says no, but the API allows it?** No case was found where an API accepts a call the user lacks permission for. Every desktop and Android restriction has a backend equivalent or a stricter one.

The real backend issues are cases where the permission **meaning** doesn't match:
- report data leaks (H-1, H-2);
- financial edits through an unrelated permission (H-3, H-4);
- account takeover (C-1).

---

## 7. Windows Authorization Matrix (routes)

| Route | Guard | Correct guard | Action-level checks | Status |
|---|---|---|---|---|
| `/dashboard` | `dashboard.view` | `dashboard.view` (backend doesn't enforce it) | — | LOW |
| `/customers`, `/customers/:id` | `customers.view` | ✓ | **none** for create/edit/delete | MEDIUM |
| `/job-cards`, `/job-cards/:id` | `jobcards.view` | ✓ | none for edit/delete/print/outside jobs/vendors | MEDIUM |
| `/job-cards/new` | `jobcards.create` | ✓ | — | ✓ |
| `/invoices`, `/invoices/:id` | `invoices.view` | ✓ | `invoices.discount`, `payments.record`, `isOwner` (number); **none** for generate/cancel/edit draft/public link | MEDIUM |
| `/catalogue` | `catalogue.view` | ✓ | create/edit ✓, delete none | LOW |
| `/staff` (`router/index.tsx:186`) | **`staff_advances.view`** | `staff.view` | create/edit/view_sensitive ✓ | MEDIUM |
| `/staff-advances` (:199) | `staff_advances.view` | ✓ | create/obsolete ✓, settle none | LOW |
| `/staff-attendance` (:212) | **`staff_advances.view`** | `staff_attendance.view` | confirm ✓, manage none | MEDIUM |
| `/staff-salary` (:229) | **`staff_advances.view`** | `staff_salary.view` | manage/settle (over-granted to `staff.edit`) | MEDIUM |
| `/reports/billing`, `/reports/outside-jobs`, `/reports/custom` | `reports.view` | per-report | Excel export ungated | HIGH (via backend H-1/H-2) |
| `/reports/staff` (:271) | `reports.view` | `reports.staff_advances` / `staff_productivity` | — | MEDIUM |
| `/reports/showroom` (:284) | `reports.view` | `reports.showrooms` | — | MEDIUM |
| `/showroom`, `/showroom/attendance`, `/showroom/bill` | `showroom.view` | ✓ | ✓ detailed | ✓ |
| `/showroom/operations` | `showroom.view` | ✓ | **canManage = any `showroom.view`** (phantom codes) | MEDIUM |
| `/showroom/configuration` | `showroom.view` | ✓ | `isOwner` | ✓ |
| `/audit` | `audit.view` | ✓ | — | ✓ |
| `/settings`, `/settings/system`, `/settings/whatsapp` | `settings.view` | ✓ | `settings.business` / `isOwner` | ✓ |
| `/settings/users` | `users.view` | ✓ | create/edit/deactivate ✓ | ✓ |

## 8. Android Authorization Matrix (screens)

| Screen | Gate | Correct | Action checks | Status |
|---|---|---|---|---|
| Home tiles | Billing: any of jobcards/invoices/customers/catalogue `.view`; Staff: `staff.view`; Showroom: `showroom.view` or phantom; Reports: `reports.view`; Settings: `settings.view` or `users.view` | mostly ✓ | — | LOW |
| Router | **none** (auth only) | per-route guard | — | MEDIUM: deep links bypass tile filtering; each screen must self-check |
| Customers / details | `customers.view` | ✓ | `customers.edit`; create/delete none | LOW |
| Job cards / details | `jobcards.view` | ✓ | `jobcards.edit` | LOW |
| Invoices / details | `invoices.view` | ✓ | `isOwner` (number); **no** `payments.record`, `invoices.discount`, `generate`, `cancel` checks | MEDIUM |
| Catalogue | `catalogue.view` | ✓ | create/edit ✓ | ✓ |
| Staff suite | `staff.view` | per tab | directory/advances ✓; attendance `staff_attendance.manage` or phantom `staff.manage`; salary over-granted to `staff.edit` or phantom | MEDIUM |
| Staff advances screen | `staff_advances.view` | ✓ | create/settle/obsolete ✓ | ✓ |
| Showroom list / detail / attendance / billing | `showroom.view` | ✓ | detailed checks ✓ (no `edit_attendance`, `record_work`, `edit_work`, `manage_transfers` UI) | LOW |
| Reports | `reports.view` plus **per-report codes** | ✓ | — | ✓ (better than Windows) |
| Settings / company / invoice series | `settings.view` / `settings.business` / `isOwner` | ✓ | — | ✓ |
| Users | `users.view` + create/edit/deactivate | ✓ | — | ✓ |
| Audit trail | **no screen** | — | — | INFO |

---

## 9. Windows vs Android Parity Findings

| Feature | Permission | Backend | Windows | Android | Status |
|---|---|---|---|---|---|
| Staff suite entry | `staff.view` | `staff.view` (list) | `staff_advances.view` | `staff.view` | **Different permission** (M-3) |
| Attendance tab | `staff_attendance.view` | ✓ | `staff_advances.view` | `staff.view` | Different |
| Salary tab | `staff_salary.view` | ✓ | `staff_advances.view` | `staff.view` | Different |
| Mark attendance | `staff_attendance.manage` | ✓ | no UI check | ✓ (+ phantom) | Windows unprotected (UI) |
| Settle advance | `staff_advances.settle` | ✓ | no UI check | ✓ | Windows unprotected (UI) |
| Salary manage / settle | `staff_salary.*` | ✓ | also `staff.edit` | also `staff.edit` and phantom | **Same wrong semantics on both** (M-5) |
| Record payment | `payments.record` | ✓ | ✓ | no UI check | Android unprotected (UI) |
| Discount | `invoices.discount` | ✓ | ✓ | no UI check | Android unprotected (UI) |
| Edit customer | `customers.edit` | ✓ | no UI check | ✓ | Windows unprotected (UI) |
| Edit job card | `jobcards.edit` | ✓ | no UI check | ✓ | Windows unprotected (UI) |
| Reports | per-report codes | per report + broad dashboard | `reports.view` only | per-report | **Different semantics** (M-6) |
| Showroom attendance count edit | `showroom.edit_attendance` | ✓ | ✓ | no UI | Android missing UI |
| Showroom operations | `record_work` / `edit_work` / `manage_transfers` | ✓ | any `showroom.view` sees controls | no operations UI checks | Both weak (UI) |
| Showroom tile / page | `showroom.view` | ✓ | ✓ (+ phantom) | ✓ (+ phantom) | Phantom on both |
| Audit | `audit.view` | ✓ | ✓ | no screen | Feature gap |
| Dashboard | `dashboard.view` | not enforced | route | not used | Inconsistent (L-9) |

Every "unprotected (UI)" row is still enforced by the backend. The impact is confusing 403 errors and shown-but-failing buttons, not a security bypass.

---

## 10. Missing Permissions

Minimum set only — do not create a code per button.

| Needed for | Recommendation | Risk if absent |
|---|---|---|
| Outside-job vendor cost changes | Enforce existing `outsidejobs.manage`, plus a cost-specific check (`outsidejobs.edit_cost`) **or** require `invoices.edit_draft` when the change rewrites a draft invoice | HIGH (H-3) |
| Vendor master | Enforce existing `vendors.view` / `vendors.manage` | HIGH (H-4) |
| Dashboard / report aggregates | Section-level filtering by the existing report codes (no new code) | HIGH (H-1) |
| Invoice-number change, series prefixes, attendance unlocks | Optional delegable permissions (`invoices.change_number`, `settings.invoice_series`, `staff_attendance.unlock`, `showroom.unlock_attendance`) **[Decision]**. Owner-only is acceptable if delegation is never wanted. | MEDIUM (M-11) |
| WhatsApp credentials | `settings.whatsapp` split from `settings.business` | MEDIUM (M-15) |
| GST on/off on an invoice | `invoices.gst_toggle` **or** make it a business-level rule | MEDIUM (M-8) |
| Showroom receivables | `showroom.view_billing` (amounts, receivables) distinct from operational `showroom.view` **[Decision]** | MEDIUM (M-9) |
| Payment correction (when built) | Use existing `payments.void` | — |
| Job-card status / staff assignment (when built) | `jobcards.change_status`, `jobcards.assign_staff` | INFO |

## 11. Overly Broad Permissions

| Permission | Covers today | Problem | Risk |
|---|---|---|---|
| `reports.view` | Dashboard (all financial and staff KPIs), monthly billing, outside jobs | Overrides 8 specific report codes | HIGH |
| `jobcards.edit` | Job-card services, all outside-job writes, vendor master CRUD, **vendor cost → draft invoice price** | Operational and financial rights merged | HIGH |
| `settings.business` | Business profile, logo, system preferences, **WhatsApp access token / WABA**, test messages | Credentials grouped with cosmetic settings | MEDIUM |
| `users.edit` | Profile edits **and password resets** of Staff accounts | Enables C-1 | CRITICAL (via C-1) |
| `showroom.view` | Operations, attendance, **receivables and bills**; on desktop also unlocks management UI | Financial visibility for operators | MEDIUM |
| `invoices.edit_draft` | Discount (no — separate), notes, **GST on/off** | GST classification is compliance-sensitive | MEDIUM |
| `invoices.generate` | Finalise **and** create/rotate/revoke public links | Acceptable; INFO | INFO |
| `staff.edit` (UI only) | Treated by both UIs as salary manage/settle | Mismatched with backend | MEDIUM |

## 12. Unused Permissions (14)

`outsidejobs.view`, `outsidejobs.manage`, `vendors.view`, `vendors.manage`, `invoices.price_override`, `invoices.record_payment`, `invoices.print`, `payments.edit`, `payments.void`, `staff.advances`, `staff_advances.edit`, `staff_advances.delete`, `reports.export`, `settings.edit`.

`dashboard.view` is UI-only on Windows and not enforced by the backend.

All of these are displayed in the Users & Permissions UI, so an Owner can tick them and believe a restriction or grant exists (LOW individually; the first four are HIGH, H-4).

## 13. Duplicate Permissions

| Pair | Notes |
|---|---|
| `invoices.record_payment` ↔ `payments.record` | Only `payments.record` is enforced |
| `staff.advances` ↔ `staff_advances.*` | Legacy single code |
| `settings.edit` ↔ `settings.business` | Only `settings.business` is enforced |
| `invoices.view` ↔ `payments.view` | Invoice detail embeds payments, so `payments.view` adds nothing |
| `outsidejobs.*` ↔ `jobcards.edit` | Semantic duplicates; the wrong one is enforced |
| `vendors.*` ↔ `jobcards.*` | Same |

---

## 14. Financial Security Findings

| ID | Operation | Current permission / role | Backend | Audit | Finding | Risk | Recommended correction |
|---|---|---|---|---|---|---|---|
| H-3 | Vendor cost change | `jobcards.edit` (`OutsideJobsController.cs:178-180`) | ✓ | ✓ (`edit`) | `OutsideJobService.UpdateCostAsync` (`OutsideJobService.cs:415-431`) rewrites the **draft invoice line `UnitPrice`** and recalculates the invoice, so a user without `invoices.edit_draft` can change a customer bill | HIGH | Enforce `outsidejobs.manage`; when a draft invoice exists also require `invoices.edit_draft` (or a cost-specific code) |
| — | Invoice create draft / edit draft | `invoices.edit_draft` | ✓ | ✓ | OK | — | — |
| M-8 | GST on/off on a draft | `invoices.edit_draft` | ✓ | ✓ (old/new) | Converting a GST invoice to non-GST is a compliance decision | MEDIUM | Business rule or `invoices.gst_toggle` |
| — | Discount | `invoices.discount` inline | ✓ | ✓ | OK | — | — |
| — | Generate / finalise | `invoices.generate` | ✓ | ✓ | OK (confirmed-total guard since Phase 1) | — | — |
| — | Cancel | `invoices.cancel` | ✓ | ✓ (reason optional) | Blocked when payments exist ✓ | LOW | Require a reason |
| M-11 | Invoice-number change (GST, paid) | Owner only (`InvoiceService.cs:650-653`, DB-verified) | ✓ | ✓ (`InvoiceNumberChanged`) | Correct but not delegable | INFO / MEDIUM | Optional `invoices.change_number` |
| — | Series prefix change | Owner only (`InvoiceSeriesService.cs:33-36`) | ✓ | ✓ | OK | — | — |
| — | Record payment | `payments.record` | ✓ (row lock) | ✓ | OK | — | — |
| M-17 | Edit / reverse payment | none (feature absent) | — | — | `payments.edit` / `void` defined but no endpoint; errors can't be corrected | MEDIUM | Build void with `payments.void` + reason + audit |
| H-5 | Showroom daily bill | `showroom.manage_billing` | ✓ | **✗** (`ShowroomService.SetDailyBillAsync`, `ShowroomService.cs:1047`) | Receivable amount changed without an audit trail | HIGH | Audit with old/new amount |
| — | Showroom payment record / delete | `showroom.record_payment` / `delete_payment` | ✓ | ✓ | OK | — | — |
| M-9 | Showroom receivables view | `showroom.view` | ✓ | — | Financial view with operational permission | MEDIUM | Billing-view permission |
| — | Staff advance create / settle / obsolete | `staff_advances.*` | ✓ | ✓ | OK | — | — |
| — | Salary enter / settle | `staff_salary.manage` / `settle` | ✓ | ✓ | Settled salary immutable ✓ | — | — |
| M-5 | Salary in UI | `staff.edit` treated as manage/settle | UI only | — | Shown-but-denied; confusing | MEDIUM | Remove `staff.edit` fallback |

## 15. Staff Security Findings

| ID | Finding | File | Risk | Correction |
|---|---|---|---|---|
| M-2 | Desktop routes `/staff`, `/staff-attendance`, `/staff-salary` require `staff_advances.view` | `apps/desktop/renderer/src/router/index.tsx:186,212,229`; `constants/navigation.ts` | MEDIUM | Use `staff.view`, `staff_attendance.view`, `staff_salary.view` |
| M-3 | Android gates the whole staff suite (including salary and attendance tabs) with `staff.view` | `apps/android/lib/features/staff/presentation/pages/staff_screen.dart:41-52,110` | MEDIUM | Gate per tab with the tab's own `.view` |
| M-5 | `staff.edit` grants salary manage/settle UI on both platforms | `features/staff/SalaryPage.tsx:103-104`; `staff_salary_tab.dart:146-151`; `salary_staff_card.dart:44-54` | MEDIUM | Use only `staff_salary.*` |
| M-4b | Phantom `staff.manage` | `staff_attendance_tab.dart:149,153`, `staff_salary_tab.dart:151`, `salary_staff_card.dart:49,54` | LOW | Remove |
| — | Aadhaar reveal and document require `staff.view_sensitive` | `StaffAdvancesController` | ✓ | — |
| — | Attendance unlock / locked-date edit is Owner-only (DB-verified) | `StaffAttendanceController.cs:29-45,247`, `StaffAttendanceService.cs:23-33` | ✓ | Optional delegable code |
| L-10 | Windows `/staff-advances` has no settle button check | `StaffAdvancesPage.tsx` | LOW | Add `staff_advances.settle` check |

## 16. Showroom Security Findings

| ID | Finding | File | Risk | Correction |
|---|---|---|---|---|
| H-5 | Daily bill, showroom create/update/toggle, staff assign/update/remove **not audited** | `Application/Services/ShowroomService.cs:215,280,296,657,773,898,1047` | HIGH | Add audit entries (old/new) |
| M-4 | Operations page: `canManage` true for any `showroom.view`; phantom `showrooms.*` and `*` | `features/showroom/ShowroomOperationsPage.tsx:123-130` | MEDIUM | Use `record_work`, `edit_work` and `manage_transfers` separately |
| M-9 | Receivables and bills visible with `showroom.view` | `ShowroomsController.cs:271-273` (`GetOutstanding`), daily-bill GET | MEDIUM | Billing-view code **[Decision]** |
| L-11 | Owner check from JWT claim (not DB) for assignments and types | `ShowroomStaffAssignmentsController.cs:19-26`, `ShowroomVehicleTypesController.cs:22-25`, `ShowroomWorkTypesController.cs:22-25` | LOW (an Owner can't be demoted) | Use the DB-verified helper like the other controllers |
| L-12 | `showroom.record_work`, `edit_work`, `manage_transfers` have no UI checks on either platform | — | LOW | Add action checks |
| L-13 | Android has no UI for `showroom.edit_attendance` | — | LOW | Parity |

## 17. Outside Jobs Security Findings

| ID | Finding | File | Risk |
|---|---|---|---|
| H-3 | Vendor cost edit (`jobcards.edit`) rewrites draft invoice price | `Controllers/OutsideJobsController.cs:178-180`; `Application/Services/OutsideJobService.cs:415-431` | HIGH |
| H-4 | `outsidejobs.*` / `vendors.*` defined and shown but unenforced; all outside-job and vendor CRUD uses `jobcards.view/edit` | `Controllers/OutsideJobsController.cs` (all actions), `Controllers/VendorsController.cs:20-37+` | HIGH |
| — | All outside-job writes are audited (send/return/cancel/edit/cost/delete); vendors audited | `OutsideJobService.cs`, `VendorService.cs` | ✓ |
| L-14 | Outside-jobs report (vendor costs) needs only `reports.view` | `ReportsController.cs:211-212` | (part of H-2) |

**Correction:**
- Outside-job endpoints: `GET` → `outsidejobs.view`; writes → `outsidejobs.manage`; cost → `outsidejobs.manage`, plus `invoices.edit_draft` when it would alter a draft.
- Vendors: `GET` → `vendors.view`; writes → `vendors.manage`.

## 18. Reports Security Findings

| ID | Finding | File | Risk |
|---|---|---|---|
| H-1 | `/api/reports/dashboard` (`reports.view`) returns `Sales`, `PaymentCollection`, `Showroom`, `StaffAdvances`, `Outstanding`, `RecentAdvances`, `RevenueTimeline`, `TopServices` | `Controllers/ReportsController.cs:23-24`; `Application/DTOs/Reports/DashboardReportDtos.cs:119-133`; `ReportService.GetDashboardSummaryAsync` | HIGH |
| H-2 | `/reports/billing/monthly` and `/reports/outside-jobs` need only `reports.view` | `ReportsController.cs:211-212,229-230` | HIGH |
| M-6 | Desktop gates all report tabs by `reports.view`; Staff/Custom tabs consume dashboard data; Android uses per-report codes | `router/index.tsx:258-297`; `features/reports/StaffReportsView.tsx`, `CustomReportsView.tsx` | MEDIUM |
| L-4 | Excel export is client-side and ungated; `reports.export` unused | `features/reports/*Generator.ts` | LOW (data already visible) — enforce in UI only if export is considered a separate business right |

**Is `reports.view` sufficient?** No. Revenue/GST, collections/receivables, staff money (advances, salary-related) and showroom billing are distinct sensitivities for a car spa: front-desk staff may need job and service counts but not revenue or staff advances.

The **existing** specific codes already express this. The fix is to make the dashboard and combined reports return only the sections the caller is permitted to see. **No new report codes are needed**, except optionally one for "operations KPIs" if the dashboard keeps non-financial counts.

## 19. User Administration Security Findings

| ID | Finding | File | Risk |
|---|---|---|---|
| C-1 | Manager with `users.edit` can set a new password for any **Staff** user (`UserService.cs:157-161` allows non-Owner edits of Staff; `:220-231` changes the password). They can then log in as that Staff user and use permissions the Owner gave to Staff, which the Manager may lack. Audited as `PasswordReset` (`:290-303`) but not prevented. | `Application/Services/UserService.cs` | **CRITICAL** |
| M-1 | When the Owner edits a Manager/Staff user, both UIs always send `permissionCodes` (`UserForm.tsx:87,97`; `user_form_sheet.dart:142,156`). That makes `isPermissionChange` true, and the audit entry records **only permissions**. A **role change in the same save is not recorded** (old/new role missing). | `UserService.cs:233-288` | MEDIUM |
| L-6 | Unknown permission codes are silently ignored on assignment (no error) | `UserService.cs:98-100,242-244` | LOW |
| L-7 | `/me` returns an empty permission list for the Owner; clients special-case `isOwner` everywhere (≥ 40 places) | `AuthService.cs:196-198` | LOW |
| — | Non-Owner can't create Managers, assign permissions, change roles (including their own), or edit other Managers; Owner can't be created, deactivated or demoted; there is no user-delete endpoint | `UserService.cs:47-65,149-187,321-334` | ✓ |
| — | Self-deactivation blocked | `UserService.cs:332-335` | ✓ |
| M-12 | Single Owner, no ownership transfer, no second Owner, no recovery other than direct DB access | `AuthService.cs` bootstrap; `UserService` rules | MEDIUM (operational) |
| INFO | Lockout is in memory (`AccountLockoutService`) and resets on restart | `Application/Services/AccountLockoutService.cs` | INFO |

## 20. Privilege Escalation Findings

| Check | Result |
|---|---|
| Owner can't accidentally lose access | ✓ Can't be deactivated or demoted through the API. ⚠ Losing the Owner password has no in-app recovery (M-12). |
| Last Owner can't be deleted | ✓ No delete endpoint; deactivation blocked |
| Normal users can't promote themselves | ✓ Role changes are Owner-only (`UserService.cs:164-170`) |
| Normal users can't create higher-privileged users | ✓ Managers only by the Owner; Owner never by API |
| Users can't assign permissions they lack | ✓ Only the Owner assigns permissions at all |
| Users can't change their own role | ✓ |
| Permission and role changes audited | ⚠ Permissions yes; role change lost when combined with a permission save (M-1) |
| **Account takeover of lower accounts** | ✗ **C-1**: a Manager resets a Staff password and inherits that Staff user's grants |
| Stale-JWT Owner claims | ✓ Mostly DB-verified; claim-only in 3 showroom controllers (L-11) |
| Permission removal takes effect immediately | ✓ The handler reads the DB per request |

**C-1 correction options [Decision]:**
- (a) only the Owner may reset another user's password;
- (b) a non-Owner may reset only users whose permission set is a **subset** of the caller's;
- (c) resets force "change at next login" and notify the Owner.

(a) is simplest and matches "only the Owner grants rights".

## 21. Audit Logging Findings

| Event | Audited? | Evidence |
|---|---|---|
| User create / update / activate / deactivate / password reset / denied attempts | ✓ | `UserService.cs` |
| Permission changes | ✓ old/new codes | `UserService.cs:261-274` |
| Role changes | ⚠ only when no permission list is sent (M-1) | `UserService.cs:275-288` |
| Invoice draft / update / generate / cancel / number change / public links | ✓ | `InvoiceService.cs` |
| Payments recorded | ✓ | `InvoiceService.RecordPaymentAsync` |
| Payment reversals | N/A (feature absent) | — |
| Salary enter / settle (+ advance recovery) | ✓ | `StaffSalaryService.cs` |
| Staff advances create / settle / obsolete | ✓ | `StaffAdvanceService.cs` |
| Staff create / edit / delete, Aadhaar changes | ✓ | `StaffAdvanceService.cs` |
| Attendance upsert / delete / confirm / unlock | ✓ | `StaffAttendanceService.cs` |
| Vendor cost changes, outside-job lifecycle, vendors | ✓ | `OutsideJobService.cs`, `VendorService.cs` |
| Catalogue, customers, vehicles (incl. ownership transfer), job cards | ✓ | respective services |
| **Showroom daily bill** | **✗** | `ShowroomService.SetDailyBillAsync` (H-5) |
| **Showroom create / update / activate** | **✗** | `ShowroomService.cs:215,280,296` |
| **Showroom staff assign / update / remove** | **✗** | `ShowroomService.cs:657,773,898` |
| Showroom payments record / delete, swaps, confirm / unlock | ✓ | `ShowroomService.cs` |
| Showroom operations (sessions, work, types) | ✓ | `ShowroomOperationsService.cs` |
| Business profile, logo, preferences, invoice series | ✓ | respective services |
| WhatsApp configuration | ✓ | `WhatsAppService.UpdateConfigurationAsync` |
| WhatsApp test connection / test message | ✗ (LOW) | `WhatsAppService` |
| Login success / failure | ✓ | `AuthService.cs` |
| Report access / export | ✗ (INFO — usually not required) | — |

---

## 22. Subscription / RBAC Compatibility

The target is Organization → Subscription → Enabled Modules → Users → Roles → Permissions. These blockers exist today:

1. **Owner bypass in `PermissionAuthorizationHandler.cs:39`.** If module checks are implemented as permissions, the Owner would bypass them. Entitlement checks must be a **separate filter** (e.g. `[RequireFeature]`) evaluated before, and independently of, permissions — never as permission codes.
2. **Hard-coded Owner-only rules (7 areas)** can't be expressed per module, per organization, or by role templates.
3. **No role → permission model.** Plans can't ship sensible defaults ("Billing Staff" preset); every user is configured by hand.
4. **No module ↔ permission mapping.** The seeder's `Module` column is a UI grouping and isn't aligned (outside jobs listed under "Job Cards"; Vendors separate; the Billing suite spans Customers, Vehicles, Job Cards, Invoices, Payments and Catalogue). Each permission needs a declared feature code so that disabling a module also hides its permissions in the Users UI.
5. **Cross-module aggregates** (`/reports/dashboard`) mix Billing, Showroom and Staff data. Once modules are optional, the response must also be filtered by enabled modules, not only by permissions.
6. **Phantom and wildcard codes** in clients (`*`, `staff.manage`, `showrooms.*`) would confuse any future entitlement-to-permission mapping.
7. **Global users / no membership.** This is the tenant topic in `DETAILING_SOFTWARE_SAAS_FRANCHISE_ARCHITECTURE.md`; RBAC must later hang off a membership, not `User.Role`.

**Compatible already:** granular codes; per-request DB evaluation; server-side enforcement; API-driven permission lists in both UIs.

---

## 23. Recommended Permission Taxonomy

Rules:
- Format `module.resource_or_scope.action`, where the module equals the future **feature code**.
- Lowercase snake_case.
- Verbs from a fixed set: `view`, `create`, `edit`, `delete`, `manage` (only where create/edit/delete are always granted together), plus a few explicit sensitive verbs (`settle`, `void`, `confirm`, `unlock`, `change_number`).
- **Keep existing codes where they already fit.** Introduce new names only through aliases or a mapping migration later, never a big-bang rename.

| Feature (module) | Canonical permissions | Map from existing |
|---|---|---|
| `billing` — customers | `customers.view/create/edit/delete` | keep |
| `billing` — vehicles | `vehicles.view/create/edit/delete` (+ optional `vehicles.transfer`) | keep |
| `billing` — job cards | `jobcards.view/create/edit/delete/print` (+ future `jobcards.change_status`, `jobcards.assign_staff`) | keep |
| `billing` — outside jobs | `outsidejobs.view`, `outsidejobs.manage`, `outsidejobs.edit_cost` | enforce existing two; add cost |
| `billing` — vendors | `vendors.view`, `vendors.manage` | enforce existing |
| `billing` — catalogue | `catalogue.view/create/edit/delete` | keep |
| `billing` — invoices | `invoices.view`, `invoices.edit_draft`, `invoices.discount`, `invoices.generate`, `invoices.cancel`, `invoices.change_number` (optional), `invoices.gst_toggle` (optional) | keep; deprecate `invoices.price_override`, `invoices.print`, `invoices.record_payment` |
| `billing` — payments | `payments.view`, `payments.record`, `payments.void` | keep; deprecate `payments.edit` |
| `staff` | `staff.view`, `staff.view_sensitive`, `staff.create`, `staff.edit`, `staff.delete` | keep; deprecate `staff.advances` |
| `staff` — attendance | `staff_attendance.view`, `.manage`, `.confirm`, `.unlock` (optional) | keep |
| `staff` — advances | `staff_advances.view`, `.create`, `.settle`, `.obsolete` | keep; deprecate `.edit`, `.delete` |
| `staff` — salary | `staff_salary.view`, `.manage`, `.settle` | keep |
| `showroom` | `showroom.view`, `showroom.manage`, `showroom.assign_staff`, `showroom.edit_attendance`, `showroom.confirm_attendance`, `showroom.unlock_attendance` (optional), `showroom.record_work`, `showroom.edit_work`, `showroom.manage_transfers`, `showroom.view_billing` (new, optional), `showroom.manage_billing`, `showroom.record_payment`, `showroom.delete_payment`, `showroom.view_history` | keep |
| `reports` | `reports.view` (reports area + **operational** KPIs only), `reports.sales`, `reports.payments`, `reports.invoices`, `reports.gst`, `reports.job_cards`, `reports.showrooms`, `reports.staff_productivity`, `reports.staff_advances`, `reports.outside_jobs` (new or reuse `outsidejobs.view`), `reports.export` (only if enforced) | keep; narrow `reports.view` |
| `settings` | `settings.view`, `settings.business`, `settings.whatsapp` (new), `settings.invoice_series` (optional) | keep; deprecate `settings.edit` |
| `users` | `users.view`, `users.create`, `users.edit`, `users.deactivate`, `users.reset_password` (optional, or Owner-only) | keep |
| `audit` | `audit.view` | keep |
| `dashboard` | `dashboard.view` — **decide:** enforce on a dedicated dashboard endpoint, or deprecate | — |

**Deprecations (9):**
- remove from the UI and later from the seed: `invoices.price_override`, `invoices.print`, `invoices.record_payment`, `payments.edit`, `staff.advances`, `staff_advances.edit`, `staff_advances.delete`, `settings.edit`;
- `reports.export` only if not enforced.

**Naming inconsistencies to accept or clean later (LOW):**
- `jobcards` vs `reports.job_cards`;
- `outsidejobs` (no underscore) vs `staff_advances` (underscore);
- `showroom` (singular) vs `reports.showrooms` (plural) vs phantom `showrooms.*`;
- mixed verbs `manage` / `edit` / `record`;
- seed `Module` "Job Cards" for outside jobs.

## 24. Recommended Role Structure

Keep the three system roles (Owner / Manager / Staff) for user-administration rules, and **add permission templates** (presets) that the Owner applies and can then adjust per user. This needs no new role enum and maps cleanly to subscription plans later.

| Template | Typical permissions |
|---|---|
| **Owner** (system) | Everything; Owner-only actions; the only one who grants permissions |
| **Manager** | Billing view/create/edit, invoices including generate/cancel/discount, payments.record, catalogue.view/edit, staff.view, attendance manage/confirm, advances view/create, reports.* except staff_advances (optional), settings.view, users.view/create (+ deactivate) |
| **Front Desk / Billing** | customers.*, vehicles.*, jobcards.view/create/edit/print, outsidejobs.view, invoices.view/edit_draft/generate, payments.view/record, catalogue.view |
| **Technician / Staff** | jobcards.view, (future) jobcards.change_status, catalogue.view |
| **Accountant / Finance** | invoices.view, payments.view/record/void, reports.sales/payments/invoices/gst, staff_salary.view, staff_advances.view |
| **Showroom Supervisor** | showroom.view, assign_staff, edit_attendance, confirm_attendance, record_work, edit_work, manage_transfers |
| **Showroom Billing** | showroom.view, view_billing, manage_billing, record_payment |
| **Reports Read-only** | reports.view + chosen report codes |

Payroll-sensitive codes (`staff_salary.settle`, `staff_advances.settle`, `staff.view_sensitive`) should never be in a default template other than Owner.

---

## 25. Migration Considerations

- **Existing grants:** users who rely on `jobcards.edit` for outside jobs and vendors will lose access when `outsidejobs.*` / `vendors.*` are enforced. A data migration must grant `outsidejobs.manage` + `vendors.manage` to every user who currently has `jobcards.edit` (and the view equivalents for `jobcards.view`), then let the Owner prune.
- **Reports:** narrowing `reports.view` will hide dashboard sections from users who don't hold the specific codes. Migrate by granting the specific report codes to current `reports.view` holders, then let the Owner prune.
- **Deprecated codes:** remove from the UI first (seeder flag, e.g. `IsDeprecated`), keep the rows for history, delete later. The seeder currently can't remove codes.
- **Phantom codes:** remove from clients in the same release; no data impact.
- **Old clients:** older desktop/Android builds show buttons the backend now denies, which only causes 403s. Ship backend and clients together.
- **C-1 fix:** decide the reset policy before changing it; Managers doing legitimate Staff password resets will need a new path.
- **Audit:** adding showroom audit entries is additive and safe.

## 26. Files Requiring Changes (when approved)

**Backend**

| File | Change |
|---|---|
| `Application/Services/UserService.cs` | C-1 password-reset policy; M-1 audit role + permissions together; reject unknown codes |
| `Controllers/OutsideJobsController.cs` | `outsidejobs.view/manage` (+ cost rule) |
| `Controllers/VendorsController.cs` | `vendors.view/manage` |
| `Application/Services/OutsideJobService.cs` | Cost change on draft invoice requires `invoices.edit_draft` (or decision) |
| `Controllers/ReportsController.cs`, `Application/Services/ReportService.cs`, `Application/DTOs/Reports/DashboardReportDtos.cs` | Section filtering by permission; outside-jobs / billing-monthly codes |
| `Application/Services/ShowroomService.cs` | Audit daily bill, showroom CRUD, assignments |
| `Controllers/ShowroomsController.cs` | Optional `showroom.view_billing` on bill / outstanding reads |
| `Controllers/ShowroomStaffAssignmentsController.cs`, `ShowroomVehicleTypesController.cs`, `ShowroomWorkTypesController.cs` | DB-verified Owner check |
| `Controllers/WhatsAppSettingsController.cs` | Optional `settings.whatsapp` |
| `Controllers/InvoicesController.cs`, `Application/Services/InvoiceService.cs` | Optional `invoices.gst_toggle` / `invoices.change_number` |
| `Infrastructure/Database/PermissionSeeder.cs` (+ migration for grants) | New, deprecated and remapped codes; deprecation flag |
| `Infrastructure/Authorization/PermissionAuthorizationHandler.cs` | Later: keep Owner bypass for permissions only; entitlements separate |
| Tests: `GranularDestructiveAuthorizationTests.cs`, `FinancialAndCatalogueAuthorizationTests.cs`, `ManagerPrivilegeEscalationTests.cs`, `EndpointAuthorizationHardeningTests.cs`, `ApiSecurityHttpTests.cs`, `ReportServiceTests.cs` | New cases |

**Windows (renderer)**

| File | Change |
|---|---|
| `src/router/index.tsx`, `src/constants/navigation.ts` | Staff route guards; per-report guards |
| `src/features/showroom/ShowroomOperationsPage.tsx` | Remove phantom / `*`; use specific codes |
| `src/features/staff/SalaryPage.tsx` | Drop `staff.edit` fallback |
| `src/features/staff/AttendancePage.tsx`, `StaffAdvancesPage.tsx` | `staff_attendance.manage`, `staff_advances.settle` checks |
| `src/features/customers/*`, `src/features/job-cards/*` (incl. `OutsideJobsSection.tsx`), `src/features/invoices/InvoiceDetailPage.tsx` | Action-level checks (create/edit/delete, generate/cancel/edit_draft, outside jobs/vendors) |
| `src/features/reports/ReportsPage.tsx`, `StaffReportsView.tsx`, `CustomReportsView.tsx` | Per-report gating |
| `src/features/users/UserForm.tsx`, `PermissionSelector.tsx` | Hide deprecated codes; templates later |

**Android**

| File | Change |
|---|---|
| `lib/core/navigation/app_router.dart` | Route-level permission redirects |
| `lib/features/staff/presentation/pages/staff_screen.dart`, `staff_attendance_tab.dart`, `staff_salary_tab.dart`, `widgets/salary_staff_card.dart` | Per-tab codes; remove phantom and `staff.edit` fallback |
| `lib/features/dashboard/presentation/pages/dashboard_screen.dart`, `lib/features/billing/presentation/pages/billing_screen.dart` | Remove phantom / `*` |
| `lib/features/invoices/presentation/pages/invoice_details_screen.dart` | `payments.record`, `invoices.discount`, `generate`, `cancel` checks |
| `lib/features/customers/...`, `lib/features/jobcards/...` (outside jobs), `lib/features/showroom/...` | Missing action checks |
| `lib/features/users/presentation/widgets/user_form_sheet.dart`, `permission_selector.dart` | Hide deprecated codes |
| `lib/features/auth/models/auth_user.dart` | Single `hasPermission` used everywhere (remove direct `permissions.contains`) |

## 27. Implementation Order

1. **Security fixes (backend only):**
   - C-1 password-reset policy;
   - H-3 vendor-cost/draft-invoice rule;
   - H-4 enforce `outsidejobs.*` / `vendors.*` with a grant migration;
   - H-5 showroom audit entries;
   - M-1 role audit.
2. **Report data:** H-1/H-2 section-level filtering of the dashboard and combined reports, plus a grant migration.
3. **Client semantics:**
   - remove phantom codes and the `staff.edit` salary fallback;
   - fix desktop staff route guards;
   - per-report gating on desktop;
   - Android route guards and missing action checks.
4. **Hygiene:** deprecation flag, hide 9 unused codes, reject unknown codes, DB-verified Owner checks everywhere, single `hasPermission` on Android.
5. **Delegation and finance decisions:** optional `invoices.change_number`, `*.unlock`, `settings.whatsapp`, `showroom.view_billing`, `invoices.gst_toggle`; build `payments.void`.
6. **Permission templates** (role presets) in Users & Permissions.
7. **Subscription readiness:** feature code per permission; `[RequireFeature]` filter independent of the Owner bypass; dashboards filtered by enabled modules; membership-based RBAC with the tenant work.

## 28. Risk Summary

| ID | Title | Risk |
|---|---|---|
| C-1 | Manager can take over Staff accounts via password reset | **CRITICAL** |
| H-1 | `reports.view` exposes all financial and staff report data via dashboard | HIGH |
| H-2 | Monthly billing and outside-jobs reports need only `reports.view` | HIGH |
| H-3 | Vendor cost (`jobcards.edit`) rewrites draft invoice price | HIGH |
| H-4 | `outsidejobs.*` / `vendors.*` shown but unenforced; vendors managed via `jobcards.edit` | HIGH |
| H-5 | Showroom daily bill and showroom/assignment changes unaudited | HIGH |
| M-1 | Role change not audited when permissions saved together | MEDIUM |
| M-2 | Desktop staff routes guarded by `staff_advances.view` | MEDIUM |
| M-3 | Android staff suite gated by `staff.view` only | MEDIUM |
| M-4 | Showroom operations UI open to any `showroom.view`; phantom codes | MEDIUM |
| M-5 | `staff.edit` treated as salary manage/settle in both UIs | MEDIUM |
| M-6 | Windows/Android report gating differ | MEDIUM |
| M-7 | Many action buttons not permission-aware (Windows customers/job cards/invoices; Android invoices) | MEDIUM |
| M-8 | GST on/off controlled by `invoices.edit_draft` | MEDIUM |
| M-9 | Showroom receivables visible with `showroom.view` | MEDIUM |
| M-10 | Android router has no permission guards | MEDIUM |
| M-11 | Owner-only rules hard-coded; not delegable; block entitlements | MEDIUM |
| M-12 | Single Owner, no transfer/recovery | MEDIUM |
| M-15 | `settings.business` includes WhatsApp credentials | MEDIUM |
| M-17 | No payment void/edit; `payments.edit/void` unused | MEDIUM |
| L-1 | 14 unused codes shown in UI | LOW |
| L-2 | Duplicate codes (record_payment, staff.advances, settings.edit, payments.view) | LOW |
| L-3 | Naming inconsistencies | LOW |
| L-4 | `reports.export` unused; export ungated | LOW |
| L-6 | Unknown codes silently ignored | LOW |
| L-7 | Owner gets empty permission list; `isOwner` special-cased everywhere | LOW |
| L-9 | `dashboard.view` not enforced by backend | LOW |
| L-10–L-14 | Minor UI parity items; claim-based Owner checks | LOW |
| INFO | No job-card status / staff-assignment feature; in-memory lockout; no Android audit screen | INFO |

---

## Final Recommendation

**A. What is currently correct**
- Every write endpoint is authorized on the server.
- Permissions are evaluated from the database on every request.
- Only the Owner grants permissions, creates Managers or changes roles; the Owner can't be removed or demoted.
- Owner-only financial actions (invoice number, prefixes) are verified against the database.
- Settled salary and finalized invoices are immutable.
- Aadhaar access needs `staff.view_sensitive`.
- Most financial and administrative actions are audited with old/new values.
- WhatsApp tokens are never returned.
- Both Users UIs load permissions from the API.

**B. Must be fixed before the subscription architecture**
- C-1, H-1–H-5, M-1.
- Remove phantom codes; fix staff route guards and per-report gating (M-2–M-6).
- Decide which Owner-only rules become permissions (M-11).
- Add a feature code to each permission and design entitlements as a separate filter that the Owner bypass does not cover.

**C. Can be fixed later**
- Optional delegable codes, permission templates, payment void, Android audit screen, naming clean-up, deprecation removal.

**D. Canonical permission taxonomy** — §23: keep the existing granular codes, enforce outside jobs/vendors, narrow `reports.view`, add `outsidejobs.edit_cost`, `settings.whatsapp` and optionally a small set of sensitive-verb codes, and deprecate 9 dead codes.

**E. Role model** — §24: three system roles plus Owner-applied permission templates (Manager, Front Desk/Billing, Technician, Accountant, Showroom Supervisor, Showroom Billing, Reports Read-only).

**F. Phases** — §27: 1 security fixes → 2 report data → 3 client semantics → 4 hygiene → 5 delegation/finance decisions → 6 templates → 7 subscription readiness.

*Audit only. No code, database, migration, role or permission was modified.*
