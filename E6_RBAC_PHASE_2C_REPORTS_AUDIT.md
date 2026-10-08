# E6 RBAC Phase 2C — Reports & Permission Granularity Audit
**E6 Car Spa RBAC / Security Hardening**  
**Audit Only — No Code, Tests, Database Schema, or Git History Modified**  
**Baseline Commit:** `7a988cf2` on `main`  
**Date:** October 6, 2026

---

## 1. Executive Summary

Phase 2B successfully established strict data boundaries on job cards and enforced invoice generation integrity (commit `7a988cf2`). 

This Phase 2C audit examines the remaining RBAC boundary concerning **Business Reports, Executive Dashboards, and Export Security**.

### Key Findings
1. **Critical Outside-Job & Vendor Boundary Bypass (P2C-4):**  
   While Phase 2B sealed `GET /api/job-cards/{id}` from exposing outside-job vendor details and wholesale `VendorCost` to callers lacking `outsidejobs.view`, the endpoint `GET /api/reports/outside-jobs` requires **only `reports.view`**. Any user with `reports.view` can directly pull all external vehicle movements, vendor identities, vendor phone numbers, individual wholesale `VendorCost` values, and aggregate vendor expense totals (`TotalVendorCost`).
2. **Dashboard Over-Exposure (P2C-2):**  
   `GET /api/reports/dashboard` requires **only `reports.view`** yet exposes comprehensive executive business data: gross/net sales, GST totals, payment method collection breakdowns, total receivables, showroom revenue, active staff advances balance, and a list of the 10 most recent staff advances containing **staff IDs, full names, roles, exact cash amounts, and sensitive loan/advance reasons**. This renders granular permissions (`reports.sales`, `reports.payments`, `reports.showrooms`, `reports.staff_advances`) ineffective against curious staff members.
3. **Monthly Billing Over-Exposure (P2C-3):**  
   `GET /api/reports/billing/monthly` requires **only `reports.view`** but returns daily sheets of every customer, vehicle, job card, service rate/quantity, and invoice issued in the month, along with total invoice amounts, paid amounts, and pending balances. This bypasses `reports.sales`, `reports.payments`, `reports.invoices`, and `reports.job_cards`.
4. **Client Parity Defects (P2C-6):**  
   * **Windows Desktop:** Completely ignores all 9 granular report permissions. Every report tab is guarded solely by `reports.view`. When a user with `reports.view` but without `reports.showrooms` clicks "Showroom Reports", the desktop attempts to call `GET /api/reports/showroom/monthly`, which the backend rejects with HTTP 403, causing an unhandled UI error.
   * **Android:** Checks granular permissions to toggle feature cards, but the "Outside Jobs" report card is unguarded, and the top-level executive metrics (Billed Sales, Collections, Outstanding, Advances) are rendered directly from `/api/reports/dashboard` without granular checks.
5. **Dormant Export Permission (P2C-5):**  
   `reports.export` exists in the database permission seeder but is **completely unused** across the backend and both clients. All Excel workbooks are generated entirely client-side using JavaScript/Dart libraries, and any user who can view a report tab can export its entire dataset to Excel without restriction.

---

## 2. Complete Report Permission Matrix (P2C-1)

| Permission Code | Display Name | Module | Current Backend Endpoint(s) | Current Controller & Action | Service Method | Windows Desktop Usage | Android Mobile Usage | Exact Data Exposed |
|---|---|---|---|---|---|---|---|---|
| `reports.view` | View Reports | Reports | `GET /api/reports/dashboard`<br>`GET /api/reports/outside-jobs`<br>`GET /api/reports/billing/monthly` | `ReportsController.GetDashboardSummary`<br>`ReportsController.GetOutsideJobsReport`<br>`ReportsController.GetMonthlyBillingReport` | `ReportService.GetDashboardSummaryAsync`<br>`ReportService.GetOutsideJobsReportAsync`<br>`ReportService.GetMonthlyBillingReportAsync` | Gates all 5 report tabs (`/reports/billing`, `/reports/staff`, `/reports/showroom`, `/reports/outside-jobs`, `/reports/custom`) and `/reports` route. | Gates Level-1 Suite Tile (`E6 Reports`) and base `reports_screen.dart` scaffold. | Entire company dashboard KPIs, daily billing sheets, customer names, invoices, outside jobs, vendor costs, staff advance names/amounts. |
| `reports.sales` | Sales Report | Reports | `GET /api/reports/sales` | `ReportsController.GetSalesReport` | `ReportService.GetSalesReportAsync` | **Unused** (tab does not exist in navigation; custom view reads from dashboard). | Hides/shows `Sales Revenue` card on `reports_screen.dart`. | Invoices list with subtotal, discount, GST, total, payments received, balance, customer info. |
| `reports.payments` | Payment Collection Report | Reports | `GET /api/reports/payments` | `ReportsController.GetPaymentCollectionReport` | `ReportService.GetPaymentCollectionReportAsync` | **Unused**. | Hides/shows `Payment Collections` card on `reports_screen.dart`. | Payment transactions list, payment method, amount, reference, customer, invoice number, voided status. |
| `reports.invoices` | Outstanding Invoice Report | Reports | `GET /api/reports/invoices/outstanding` | `ReportsController.GetOutstandingInvoicesReport` | `ReportService.GetOutstandingInvoicesReportAsync` | **Unused**. | Hides/shows `Outstanding Invoices` card on `reports_screen.dart`. | Unpaid/partially paid invoices, balance amount, customer phone, days overdue/ageing. |
| `reports.gst` | GST Report | Reports | `GET /api/reports/gst` | `ReportsController.GetGstReport` | `ReportService.GetGstReportAsync` | **Unused**. | Hides/shows `GST & Taxes` card on `reports_screen.dart`. | Taxable base amount, CGST, SGST, IGST, total GST, invoice breakdown. |
| `reports.job_cards` | Job Card Report | Reports | `GET /api/reports/job-cards` | `ReportsController.GetJobCardReport` | `ReportService.GetJobCardReportAsync` | **Unused**. | Hides/shows `Job Cards` card on `reports_screen.dart`. | Job card list, customer, vehicle, status counts, total revenue, converted invoice number. |
| `reports.showrooms` | Showroom Report | Reports | `GET /api/reports/showrooms`<br>`GET /api/reports/showroom/monthly` | `ReportsController.GetShowroomReport`<br>`ReportsController.GetMonthlyShowroomReport` | `ReportService.GetShowroomReportAsync`<br>`ReportService.GetMonthlyShowroomReportAsync` | **Unchecked in navigation**. Tab `/reports/showroom` is gated by `reports.view`; causes HTTP 403 crash if caller lacks `reports.showrooms`. | Hides/shows `Showroom Reports` card on `reports_screen.dart`. | Showroom daily attendance, vehicles attended, staff assignments, daily billing, payments, 7-sheet management workbook data. |
| `reports.staff_productivity` | Staff Productivity Report | Reports | `GET /api/reports/staff-productivity` | `ReportsController.GetStaffProductivityReport` | `ReportService.GetStaffProductivityReportAsync` | **Unused** (Staff tab uses dashboard data). | Hides/shows `Staff Productivity` card on `reports_screen.dart`. | Staff assignments, days present, vehicles attended per staff member, daily averages. |
| `reports.staff_advances` | Staff Advances Report | Reports | `GET /api/reports/staff-advances` | `ReportsController.GetStaffAdvancesReport` | `ReportService.GetStaffAdvancesReportAsync` | **Unused** (Staff tab uses dashboard data). | Hides/shows `Staff Advances` card on `reports_screen.dart`. | Staff advance records, amounts, status, settlement history, reasons, dates. |
| `reports.export` | Export Reports | Reports | **None** (no backend endpoint) | **None** | **None** | **Unused** (Excel download buttons in UI are completely ungated). | **Unused**. | Allows exporting client-side workbooks without permission check. |

---

## 3. Dashboard Analysis (P2C-2)

### Endpoint Details
* **Route:** `GET /api/reports/dashboard`
* **Controller:** [`ReportsController.GetDashboardSummary`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Controllers/ReportsController.cs#L23-L32)
* **Current Attribute:** `[RequirePermission("reports.view")]`
* **Response DTO:** [`DashboardSummaryDto`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Application/DTOs/Reports/DashboardReportDtos.cs#L119-L133)

### Data Exposed Under `reports.view` Alone
1. **Sales (`DashboardSalesDto`):** Gross Subtotal, Total Discount, GST Amount, Net Sales, Payment Collection, Outstanding.
2. **Payment Collections (`DashboardPaymentCollectionDto`):** Total Received, Transaction Count, breakdown by method (`Cash`, `UPI`, `Card`, `BankTransfer`, etc.) with transaction counts and exact rupee totals.
3. **Outstanding (`DashboardOutstandingDto`):** Invoice Outstanding, Showroom Outstanding, Staff Advance Outstanding, Total Combined Outstanding.
4. **Showroom Financials (`DashboardShowroomDto`):** Active Showrooms Count, Staff Assignments Count, Vehicles Attended, Total Billed, Total Received, Total Outstanding, Paid/Partially Paid/Unpaid Day Counts.
5. **Staff Advances (`DashboardStaffAdvanceDto` & `RecentAdvances`):**
   * Total Active Outstanding Amount, Settled Amount, Counts.
   * **List of 10 Recent Staff Advances:** Exposes `StaffId`, `StaffName`, `StaffRole`, `AdvanceDate`, exact monetary `Amount`, `Reason` (e.g., "Family emergency", "Medical loan"), and `Status`.
6. **Top Services (`List<TopServiceItemDto>`):** Service Name, Category, Count, and exact Revenue.
7. **Daily Trend Timeline (`List<DailyTrendPointDto>`):** Daily timeline of Revenue, Collected Amount, and Outstanding Amount.
8. **Recent Activity (`List<RecentActivityItemDto>`):** Latest invoices (with Customer Name, Invoice Number, Total Amount) and latest payments (with Customer Name, Invoice Number, Amount, Payment Method).

### Assessment
* An operational employee (e.g., floor supervisor or receptionist) granted `reports.view` to inspect vehicle throughput and job card volume automatically learns **executive turnover, collections, bank vs cash breakdown, and private personal loan records of all colleagues**.
* Because `GET /api/reports/dashboard` does not check granular permissions, granting `reports.view` effectively supersedes `reports.sales`, `reports.payments`, `reports.showrooms`, and `reports.staff_advances`.

---

## 4. Monthly Billing Analysis (P2C-3)

### Endpoint Details
* **Route:** `GET /api/reports/billing/monthly`
* **Controller:** [`ReportsController.GetMonthlyBillingReport`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Controllers/ReportsController.cs#L229-L250)
* **Current Attribute:** `[RequirePermission("reports.view")]`
* **Response DTO:** [`MonthlyBillingReportResponse`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Application/DTOs/Reports/MonthlyBillingReportDtos.cs#L6-L15)

### Data Exposed Under `reports.view` Alone
1. **Daily Billing Sheets (1 to 31):**
   * **Job Cards:** `JobCardNumber`, `JobCardDate`, `CustomerName`, `VehicleRegistration`, `Vehicle`, `JobCardStatus`, `JobCardTotal`.
   * **Services:** `JobCardNumber`, `InvoiceNumber`, `CustomerName`, `ServiceName`, `Quantity`, `Rate`, `Amount`.
   * **Invoices:** `InvoiceNumber`, `InvoiceDate`, `JobCardNumber`, `CustomerName`, `VehicleRegistration`, `InvoiceStatus`, `InvoiceTotal`, `AmountPaid`, `AmountPending`.
   * **Daily Totals:** Sum of Job Card Totals, Invoice Totals, Amount Paid, Amount Pending.
2. **Monthly Summary:** Total Invoices, Total Invoices Paid/Pending, Total Invoiced Amount, Total Amount Paid, Total Amount Pending.

### Assessment
* A user with `reports.view` who is explicitly denied `reports.invoices`, `reports.sales`, and `reports.payments` can call this single endpoint and retrieve **every transaction, line item, and customer payment record for the entire month**.
* `reports.view` completely bypasses granular billing permissions.

---

## 5. Outside-Job / Vendor Report Analysis (P2C-4)

### Endpoint Details
* **Route:** `GET /api/reports/outside-jobs`
* **Controller:** [`ReportsController.GetOutsideJobsReport`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Controllers/ReportsController.cs#L211-L224)
* **Current Attribute:** `[RequirePermission("reports.view")]`
* **Response DTO:** [`OutsideJobReportResponse`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Application/DTOs/Reports/OutsideJobsReportDtos.cs#L62-L70)

### Data Exposed Under `reports.view` Alone
1. **Currently Outside List (`CurrentlyOutsideJobDto`):**
   * Customer details, vehicle registration, service name.
   * `VendorId`, `VendorName`, `VendorPhone`.
   * Confidential wholesale **`VendorCost`**.
2. **History List (`OutsideJobHistoryReportDto`):**
   * Complete historical record of all outside movements.
   * `VendorName`, Sent/Returned timestamps, user IDs.
   * Confidential wholesale **`VendorCost`**.
3. **Vendor Summary (`OutsideJobVendorSummaryDto`):**
   * Grouped by vendor with phone number, job counts, active counts, overdue counts.
   * Aggregate wholesale **`TotalVendorCost`** per vendor.
4. **Aggregate Totals:** `TotalActiveCost` and `TotalHistoricalCost`.

### Critical Assessment Against Phase 2B
* **Severity: HIGH (Security Boundary Bypass).**
* In Phase 2B, `GET /api/job-cards/{id}` and `GET /api/job-cards/by-number/{num}` were hardened so that callers without `outsidejobs.view` receive `OutsideJobs = null` and cannot see vendor identities or `VendorCost`.
* Furthermore, `/api/job-cards/{id}/outside-jobs` is guarded by `outsidejobs.view`, and `/api/vendors` is guarded by `vendors.view`.
* However, because `GET /api/reports/outside-jobs` requires only `reports.view`, a user lacking `outsidejobs.view` and `vendors.view` can simply query `/api/reports/outside-jobs` and immediately inspect all outside movements, external shop contacts, and vendor wholesale costs.

---

## 6. Export Security Analysis (P2C-5)

### Status of `reports.export`
* **Database / Seeder:** Seeded as `("reports.export", "Export Reports", "Reports", "Allows exporting reports to Excel/PDF")`.
* **Backend Controllers:** **0 endpoints require `reports.export`**.
* **Frontend Clients:** **0 UI guards check `reports.export`**.
* **Excel Architecture:** All 4 report generators in Desktop:
  * [`excelMonthlyBillingGenerator.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/reports/excelMonthlyBillingGenerator.ts)
  * [`excelMonthlyShowroomGenerator.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/reports/excelMonthlyShowroomGenerator.ts)
  * [`excelOutsideJobsGenerator.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/reports/excelOutsideJobsGenerator.ts)
  * [`excelStaffAdvancesGenerator.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/reports/excelStaffAdvancesGenerator.ts)
  run in the browser/renderer process via ExcelJS / XLSX.
* **Assessment:**
  * If a user possesses `reports.view`, they can click "Export Excel" and download the complete raw dataset.
  * Conceptual test: `reports.export = YES`, `reports.gst = NO` — on backend, no export endpoint exists. In UI, export is tied directly to the view tab. If the view tab is open, export is 100% permitted. If the view tab is blocked, export is inaccessible.
  * Therefore, `reports.export` is currently a dead code that provides zero access control.

---

## 7. Windows / Android Parity Analysis (P2C-6)

| Feature / Screen | Backend Requirement | Windows Desktop Enforcement | Android Mobile Enforcement | Parity Status & Defect |
|---|---|---|---|---|
| **Reports Suite Entry** | `reports.view` | Requires `reports.view` | Requires `reports.view` | **Match** |
| **Sales Report** | `reports.sales` | **Ignored** (no separate tab; reads from dashboard) | Hides/shows `Sales Revenue` card | **Mismatch**: Windows exposes sales data via dashboard to `reports.view` holders. |
| **Payment Collections** | `reports.payments` | **Ignored** | Hides/shows `Payment Collections` card | **Mismatch**: Windows exposes collections via dashboard. |
| **Outstanding Invoices** | `reports.invoices` | **Ignored** | Hides/shows `Outstanding Invoices` card | **Mismatch**: Windows exposes receivables via dashboard. |
| **GST Report** | `reports.gst` | **Ignored** | Hides/shows `GST & Taxes` card | **Mismatch**: Windows exposes GST via dashboard. |
| **Job Card Report** | `reports.job_cards` | **Ignored** | Hides/shows `Job Cards` card | **Mismatch** |
| **Showroom Reports Tab** | `reports.showrooms` | **Ignored in navigation** (gated by `reports.view`). Calls backend `reports.showrooms`. | Gated by `reports.showrooms` | **CRITICAL UI DEFECT**: Windows user without `reports.showrooms` can click the tab, but backend returns HTTP 403, causing an error toast / broken UI state. |
| **Staff Reports Tab** | `reports.staff_advances` / `reports.staff_productivity` | **Ignored in navigation** (gated by `reports.view`). Reads advances directly from dashboard. | Separate cards for productivity and advances | **Mismatch**: Windows bypasses staff advance permissions by reading `/api/reports/dashboard`. |
| **Outside Jobs Report** | `reports.view` (backend defect) | Gated by `reports.view` | Gated by `reports.view` (ungated card) | **Match in flaw**: Both clients expose outside jobs to anyone with `reports.view`. |
| **Monthly Billing Tab** | `reports.view` (backend defect) | Gated by `reports.view` | Gated by `reports.view` | **Match in flaw**: Both clients allow full invoice/sales inspection under `reports.view`. |
| **Excel Export Actions** | None (`reports.export` unused) | Ungated | Ungated | **Match in lack of enforcement** |

---

## 8. Exact Backend Endpoints Involved

| HTTP Verb | Path | Controller File | Method | Rate Limiting | Current Attribute |
|---|---|---|---|---|---|
| `GET` | `/api/reports/dashboard` | `ReportsController.cs:23` | `GetDashboardSummary` | Standard | `[RequirePermission("reports.view")]` |
| `GET` | `/api/reports/sales` | `ReportsController.cs:37` | `GetSalesReport` | `reports-heavy` | `[RequirePermission("reports.sales")]` |
| `GET` | `/api/reports/payments` | `ReportsController.cs:55` | `GetPaymentCollectionReport` | `reports-heavy` | `[RequirePermission("reports.payments")]` |
| `GET` | `/api/reports/invoices/outstanding` | `ReportsController.cs:75` | `GetOutstandingInvoicesReport` | `reports-heavy` | `[RequirePermission("reports.invoices")]` |
| `GET` | `/api/reports/gst` | `ReportsController.cs:93` | `GetGstReport` | `reports-heavy` | `[RequirePermission("reports.gst")]` |
| `GET` | `/api/reports/job-cards` | `ReportsController.cs:108` | `GetJobCardReport` | `reports-heavy` | `[RequirePermission("reports.job_cards")]` |
| `GET` | `/api/reports/showrooms` | `ReportsController.cs:127` | `GetShowroomReport` | `reports-heavy` | `[RequirePermission("reports.showrooms")]` |
| `GET` | `/api/reports/staff-productivity` | `ReportsController.cs:145` | `GetStaffProductivityReport` | `reports-heavy` | `[RequirePermission("reports.staff_productivity")]` |
| `GET` | `/api/reports/staff-advances` | `ReportsController.cs:165` | `GetStaffAdvancesReport` | `reports-heavy` | `[RequirePermission("reports.staff_advances")]` |
| `GET` | `/api/reports/showroom/monthly` | `ReportsController.cs:184` | `GetMonthlyShowroomReport` | `reports-heavy` | `[RequirePermission("reports.showrooms")]` |
| `GET` | `/api/reports/outside-jobs` | `ReportsController.cs:211` | `GetOutsideJobsReport` | `reports-heavy` | `[RequirePermission("reports.view")]` |
| `GET` | `/api/reports/billing/monthly` | `ReportsController.cs:229` | `GetMonthlyBillingReport` | `reports-heavy` | `[RequirePermission("reports.view")]` |

---

## 9. Current Authorization Behavior

1. **Controller Level:** `ReportsController` has NO class-level `[RequirePermission]` attribute. Each action has an explicit method-level attribute.
2. **Evaluation Mechanism:** Permissions are evaluated using `[RequirePermission("<code>")]`, which triggers `PermissionAuthorizationHandler` to match claims in the authenticated JWT token.
3. **Hierarchy / Bypass:**
   * Owner accounts possess all permissions automatically (`UserRole.Owner` claim bypass).
   * Non-Owner users require explicit claims in `UserPermission`.
   * Because `/dashboard`, `/billing/monthly`, and `/outside-jobs` specify only `reports.view`, any user with `reports.view` passes authorization without evaluation of their granular permissions.

---

## 10. Security Findings with Severity Ratings

| Finding ID | Severity | Description | Impact |
|---|:---:|---|---|
| **F-P2C-1** | **HIGH** | `GET /api/reports/outside-jobs` requires only `reports.view`. | Bypasses Phase 2B security boundary; exposes external movements, vendor identities, phone numbers, and wholesale `VendorCost` to users lacking `outsidejobs.view`. |
| **F-P2C-2** | **HIGH** | `GET /api/reports/dashboard` requires only `reports.view`. | Exposes executive financial totals, payment breakdowns, showroom revenues, and sensitive personal staff loan/advance records (names, amounts, reasons). |
| **F-P2C-3** | **HIGH** | `GET /api/reports/billing/monthly` requires only `reports.view`. | Bypasses `reports.sales`, `reports.invoices`, `reports.payments`, and `reports.job_cards`; exposes every monthly transaction, line item, and customer payment. |
| **F-P2C-4** | **MEDIUM** | Windows Desktop ignores all granular report permissions. | Navigation tabs are gated only by `reports.view`. Navigating to Showroom Reports causes HTTP 403 API crashes for users without `reports.showrooms`. |
| **F-P2C-5** | **MEDIUM** | Android reports screen leaks executive summary metrics. | Base reports screen unconditionally renders sales, collections, and advance balances from `reportsDashboardProvider` under `reports.view`. |
| **F-P2C-6** | **LOW** | `reports.export` permission is completely dormant / unenforced. | Client-side Excel export buttons are available to any user who can view a report tab. |

---

## 11. Recommended Minimal Implementation (P2C-7)

To adhere strictly to repository design principles, **NO new permission codes, NO schema changes, and NO disruptive architectural refactoring** should be introduced.

### Architectural Solution Options Considered
1. **Option A: Full Role/Permission Redesign (REJECTED)**  
   * Creating new codes (e.g. `reports.dashboard`, `reports.outside_jobs`) would require database migrations, role template changes, and client updates across both platforms. Violates minimal change principle.
2. **Option B: Make Granular Permissions Authoritative with Contextual Dashboard Redaction (RECOMMENDED)**  
   * **Part 1 — Protect Outside Jobs Report:** Change `GET /api/reports/outside-jobs` to require existing permission **`outsidejobs.view`** (or composite `reports.view` + `outsidejobs.view`). If caller lacks `outsidejobs.view`, return HTTP 403. This immediately seals the Phase 2B leak.
   * **Part 2 — Protect Monthly Billing Report:** Change `GET /api/reports/billing/monthly` to require existing permission **`reports.invoices`** (or `reports.sales`). This aligns with the granular permissions already defined in the system.
   * **Part 3 — Contextual Dashboard Redaction in `GetDashboardSummaryAsync`:**
     Instead of splitting the dashboard into multiple endpoints (which would break mobile and desktop caching), evaluate permissions dynamically via `IAuthorizationService` inside the service or controller:
     * If user lacks `reports.sales`: Set `Sales = null` (or zeroed) and redact revenue trend points.
     * If user lacks `reports.payments`: Set `PaymentCollection = null`.
     * If user lacks `reports.showrooms`: Set `Showroom = null`.
     * If user lacks `reports.staff_advances`: Set `StaffAdvances = null` and `RecentAdvances = []`.
     * Operational metrics (`JobCardKpis`, `VehicleActivity`) remain accessible under `reports.view`.
   * **Part 4 — Client Parity Adjustments:**
     * Windows: Update `constants/navigation.ts` and `router/index.tsx` so tabs check the relevant granular codes (`reports.invoices` for Billing, `reports.showrooms` for Showroom, `outsidejobs.view` for Outside Jobs).
     * Android: Check `outsidejobs.view` before displaying the Outside Jobs card on `reports_screen.dart`.

---

## 12. MUST / SHOULD / OPTIONAL Classification

### MUST (Mandatory for Security Boundary Integrity)
* [ ] **P2C-M1:** Require `outsidejobs.view` on `GET /api/reports/outside-jobs`. Prevent confidential vendor identities and wholesale costs from leaking through reports.
* [ ] **P2C-M2:** Require `reports.invoices` (or `reports.sales`) on `GET /api/reports/billing/monthly`. Prevent granular report bypass.
* [ ] **P2C-M3:** Redact sensitive staff advances (`RecentAdvances` and advance balances) in `GET /api/reports/dashboard` when the caller lacks `reports.staff_advances`.

### SHOULD (Recommended for Operational Consistency & Robustness)
* [ ] **P2C-S1:** Contextually redact `Sales`, `PaymentCollection`, and `Showroom` sections in `GET /api/reports/dashboard` when caller lacks the corresponding granular permissions.
* [ ] **P2C-S2:** Align Windows Desktop report navigation guards in `navigation.ts` and `router/index.tsx` to check granular permissions, preventing HTTP 403 crashes on `/reports/showroom`.
* [ ] **P2C-S3:** Guard the Outside Jobs card on Android `reports_screen.dart` with `outsidejobs.view`.

### OPTIONAL (Deferred / Clean-up)
* [ ] **P2C-O1:** Enforce `reports.export` on client-side "Download Excel" buttons in both Desktop and Android, OR formally document that export is tied to view access and deprecate the unused code in a future phase.

---

## 13. Migration Considerations

* **Database Migrations:** **NONE required.** All required permission codes (`reports.view`, `reports.sales`, `reports.invoices`, `reports.showrooms`, `reports.staff_advances`, `outsidejobs.view`) already exist in the database and are seeded by `PermissionSeeder.cs`.
* **Data Migration:** **NONE required.**
* **User Impact:** Existing users with Owner role are completely unaffected. Non-Owner managers who currently view outside jobs in reports must have `outsidejobs.view` assigned (which they already require for operational job cards).

---

## 14. Tests Required for Phase 2C

1. **Outside-Job Report Security Test:**
   * Caller with only `reports.view` → `GET /api/reports/outside-jobs` returns HTTP 403 Forbidden.
   * Caller with `reports.view` + `outsidejobs.view` → `GET /api/reports/outside-jobs` returns HTTP 200 OK.
2. **Monthly Billing Report Security Test:**
   * Caller with only `reports.view` → `GET /api/reports/billing/monthly` returns HTTP 403 Forbidden.
   * Caller with `reports.view` + `reports.invoices` → `GET /api/reports/billing/monthly` returns HTTP 200 OK.
3. **Dashboard Field-Level Redaction Test:**
   * Caller with only `reports.view` → `GET /api/reports/dashboard` returns 200 OK with `JobCardKpis` populated, but `RecentAdvances` empty and financial sections redacted.
   * Caller with `reports.view` + `reports.staff_advances` → `RecentAdvances` populated with staff names and amounts.
   * Caller with `reports.view` + `reports.sales` → `Sales` populated with gross/net revenue.
4. **Showroom Monthly Report Test:**
   * Caller without `reports.showrooms` → `GET /api/reports/showroom/monthly` returns HTTP 403 Forbidden.

---

## 15. Files Likely Requiring Changes (During Implementation)

### Backend
1. `backend/api/CarSpaManagement.Api/Controllers/ReportsController.cs` (update endpoint attributes and authorization checks).
2. `backend/api/CarSpaManagement.Api/Application/Services/ReportService.cs` (incorporate permission checks for contextual dashboard redaction).
3. `backend/api/CarSpaManagement.Api/Application/Interfaces/IReportService.cs` (update signatures if authorization context is passed).
4. `backend/tests/CarSpaManagement.Api.Tests/RbacPhase2cSecurityTests.cs` (new security test suite).

### Desktop Client
1. `apps/desktop/renderer/src/constants/navigation.ts` (assign granular permission requirements to report navigation items).
2. `apps/desktop/renderer/src/router/index.tsx` (align route guards for report paths).
3. `apps/desktop/renderer/src/features/reports/ReportsPage.tsx` (handle redacted dashboard sections gracefully).

### Mobile Client (Android)
1. `apps/android/lib/features/reports/presentation/pages/reports_screen.dart` (guard outside jobs card with `outsidejobs.view` and handle redacted dashboard metrics).

---

## 16. Explicit Audit Confirmation

* **Audit Only Completed.**
* **Zero source code modified.**
* **Zero automated tests modified.**
* **Zero database migrations created.**
* **Zero database schema changes made.**
* **Zero Git commits created.**
* **Current working tree remains clean on `main` at commit `7a988cf2`.**
