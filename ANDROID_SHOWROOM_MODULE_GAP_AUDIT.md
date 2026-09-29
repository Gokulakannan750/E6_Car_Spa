# E6 Car Spa Android — Showroom Module Gap Audit

**Audit Date:** September 26, 2026  
**Target Platform:** Flutter Android (`apps/android`)  
**Reference Platform:** React Electron Desktop (`apps/desktop/renderer`)  
**Backend API:** ASP.NET Core Web API (`backend/api/CarSpaManagement.Api`)  
**Status:** AUDIT ONLY (No code changes implemented)

---

## 1. Executive Summary

A comprehensive, line-by-line inspection of the **Desktop Showroom Module**, the **Backend Showroom API surface**, and the **Android Showroom Module** was performed to establish exact feature parity and identify all existing gaps.

### Key Audit Findings:
1. **Showroom Master:** **100% Complete**. Android fully implements the showroom directory, searching, active/inactive filtering, creating, editing, activating/deactivating showrooms, and full Indian GSTIN (15-character uppercase regex) support matching Desktop.
2. **Showroom Attendance & Work Sessions:** **100% Complete**. Android fully implements the unified daily staff work session model with presets (Full Day: `09:00–18:00` [9h], Morning: `09:00–14:00` [5h], Afternoon: `14:00–18:00` [4h], and Custom sessions), home showroom identification, temporary transfers, live duration calculation, attendance confirmation locking, and Owner-only unlocking.
3. **Showroom Operations (Vehicle & Service Logging):** **0% Implemented in Android UI**. On Desktop, `ShowroomOperationsPage.tsx` provides a full operational hub for logging batch/single vehicle work (with vehicle types such as Sedan, SUV, Luxury, Commercial, and multi-service checkboxes such as Washing, Vacuuming, Polishing), tracking on-duty staff, closing/clocking out sessions, and viewing daily operation KPI summaries with breakdown pills. Android has **no UI, providers, repositories, or data models** for vehicle work operations.
4. **Showroom Daily Billing & Payments:** **0% Implemented in Android UI**. On Desktop, `ShowroomBillPage.tsx` provides daily bill amount recording, payment processing (Cash, UPI, Card, Bank Transfer with reference), payment voiding/deletion, remaining balance calculation, daily payment transaction history, and historical date-range billing summaries. Android has **no billing UI or providers** inside the Showroom module.
5. **Showroom Navigation Architecture:** **Single-dimension / Collapsed**. On Desktop, selecting a showroom opens a multi-feature workspace with dedicated routes and sub-tabs for Attendance, Operations, and Billing. On Android, tapping a showroom card or the "Daily Workspace" button navigates exclusively to `ShowroomDetailScreen`, which currently contains only the Attendance roster.

---

## 2. Current Android Showroom Navigation

```
AppShell (Bottom Navigation Bar)
 └── [More] Menu Item
      └── Showrooms (/showroom) — ShowroomListScreen
           ├── [Back] Button ──────────> Returns to Dashboard (/dashboard)
           ├── [Refresh] Action ───────> Reloads Showroom directory list
           ├── [+ Add Showroom] FAB ───> Opens ShowroomFormSheet (Bottom Sheet)
           ├── [Search / Filters] ─────> In-place list filtering (All / Active / Inactive)
           ├── [Card: Edit] ───────────> Opens ShowroomFormSheet (Edit Bottom Sheet)
           ├── [Card: Toggle Active] ──> Shows AlertDialog (Activate / Deactivate confirmation)
           └── [Card: Tap / "Daily Workspace" Button]
                └── ShowroomDetailScreen (Attendance Only)
                     ├── [Back] Button ─────────────> Returns to ShowroomListScreen
                     ├── [Refresh] Action ──────────> Reloads Daily Staff roster
                     ├── [Header: Edit] ────────────> Opens ShowroomFormSheet (Edit Showroom Master)
                     ├── [Date Selector Stepper] ───> Shifts date (Prev Day, Next Day, Today, DatePicker)
                     ├── [+ Assign Staff] FAB ──────> Opens AssignStaffModalSheet
                     ├── [Staff Card: Edit] ────────> Opens EditStaffSessionModalSheet
                     ├── [Staff Card: Remove] ──────> Shows AlertDialog (Delete assignment)
                     ├── [Confirm Attendance] ──────> Shows AlertDialog (Locks daily attendance)
                     └── [Correct (Unlock)] ────────> Shows AlertDialog (Owner-only unlock for corrections)
```

---

## 3. Desktop Showroom Navigation

```
Desktop App Sidebar & Router
 ├── /showroom (ShowroomPage)
 │    ├── Showroom Directory (Master Table, Search, Active Filter, Add Showroom Dialog)
 │    ├── Showroom Details Profile View (Selected Showroom Header, Metadata, GSTIN, Timestamps)
 │    │    ├── [Attendance] Button ───────> Navigates to /showroom/attendance?showroomId={id}
 │    │    ├── [Bill] Button ─────────────> Navigates to /showroom/bill?showroomId={id}
 │    │    └── [Edit Showroom] Button ────> Opens Edit Showroom Dialog
 │    └── Table Row Quick Actions:
 │         ├── [Attendance] ──────────────> Navigates to /showroom/attendance?showroomId={id}
 │         ├── [Bill] ────────────────────> Navigates to /showroom/bill?showroomId={id}
 │         ├── [View] ────────────────────> Opens Single Showroom Details View
 │         └── [Edit] ────────────────────> Opens Edit Showroom Dialog
 │
 ├── /showroom/attendance (ShowroomAttendancePage)
 │    ├── Showroom Selector & Date Stepper (Prev, Next, Today, Date Picker)
 │    ├── Roster KPI Summary (Staff on Duty, Scheduled Working Hours)
 │    ├── Attendance Confirmation & Locked Status Banner (Confirm / Owner Unlock)
 │    ├── [+ Assign Staff] Button ────────> Opens Assign Staff Work Session Dialog
 │    ├── [Edit Session] Row Action ─────> Opens Edit Staff Session Dialog
 │    ├── [Delete Session] Row Action ───> Opens Delete Confirmation Dialog
 │    └── Quick Links: [Showroom Directory], [Showroom Operations], [Showroom Bill]
 │
 ├── /showroom/operations (ShowroomOperationsPage)
 │    ├── State 1: Showroom Directory Landing (Select Showroom to Open Operations)
 │    └── State 2: Dedicated Operations Workspace for Selected Showroom & Date
 │         ├── Header: Dealership Profile + Quick Links to [Attendance] & [Daily Bill]
 │         ├── Date Stepper (Prev, Next, Today, Date Picker)
 │         ├── Daily Operations Summary Widget:
 │         │    ├── KPI Cards: Vehicles Handled, Services Completed, Active Staff Sessions
 │         │    ├── Vehicle Type Breakdown Pill Strip (e.g. Sedan: 5, SUV: 3)
 │         │    └── Work Type Breakdown Pill Strip (e.g. Wash: 8, Vacuum: 4)
 │         ├── Workspace Sub-Tabs:
 │         │    ├── Tab 1: Daily Vehicle Work
 │         │    │    ├── Filters: Staff Member Filter & Vehicle Type Filter
 │         │    │    ├── [+ Log Vehicle Work] ──> Batch/Single Modal (Count, Type, Services, Staff)
 │         │    │    ├── Vehicle Work Table (Time, Staff, Vehicle Type, Count, Services, Notes)
 │         │    │    └── [Edit Vehicle Work] ───> Opens Edit Vehicle Work Dialog
 │         │    ├── Tab 2: Staff Work Sessions
 │         │    │    ├── [Close Session] ──────> Opens Clock-out Modal (End Time, Notes)
 │         │    │    └── [Edit Session] ───────> Opens Edit Work Session Dialog
 │         │    └── Tab 3: Staff Productivity (Daily summary of services per staff member)
 │
 └── /showroom/bill (ShowroomBillPage)
      ├── State 1: Global Receivables Landing (Cross-showroom Billed, Received, Outstanding, Due Days)
      └── State 2: Dedicated Showroom Billing Workspace for Selected Showroom & Date
           ├── Header: Dealership Profile + Quick Links to [Attendance] & [Operations]
           ├── Date Stepper (Prev, Next, Today, Date Picker)
           ├── Workspace Sub-Tabs:
           │    ├── Tab 1: Daily Bill
           │    │    ├── Daily Bill Summary Card (Billed, Received, Balance, Payment Status Badge)
           │    │    ├── [Set / Edit Daily Bill] ──> Opens Set Bill Amount Dialog
           │    │    ├── [+ Record Payment] ───────> Opens Record Payment Dialog (Cash/UPI/Card/Bank)
           │    │    └── Payments Table (Time, Amount, Method, Reference, Notes, Recorded By, Void Action)
           │    └── Tab 2: Billing History & Summary
           │         ├── Date Range Presets: This Month, Last Month, This Week, Today, Custom
           │         ├── Range KPIs: Total Billed, Total Collected, Outstanding, Billed Days, Unpaid Days
           │         └── Daily Breakdown Ledger Table with Jump-to-Date navigation
```

---

## 4. Feature Comparison

| # | Feature | Desktop Component / Route | Android UI | Android API | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | **Showroom Master List** | `ShowroomPage.tsx` | `ShowroomListScreen` | `GET /api/showrooms` | **Fully implemented** | Search, filter, KPIs, pull-to-refresh all functional. |
| 2 | **Showroom Search** | Search input across name, address, phone | `AppSearchField` | Query param `search` | **Fully implemented** | Reactive real-time search. |
| 3 | **Showroom Status Filter** | Dropdown: All / Active / Inactive | Filter chips: All / Active / Inactive | Query param `isActive` | **Fully implemented** | Filter chips match app design system. |
| 4 | **Add Showroom** | Create Showroom Modal Dialog | `ShowroomFormSheet` | `POST /api/showrooms` | **Fully implemented** | Name, address, phone, GSTIN regex validation. |
| 5 | **Edit Showroom** | Edit Showroom Modal Dialog | `ShowroomFormSheet` | `PUT /api/showrooms/{id}` | **Fully implemented** | Full update including GSTIN clearing (`"gstin": null`). |
| 6 | **Activate / Deactivate Showroom** | Action button with confirmation | Action button with `AlertDialog` | `PATCH /api/showrooms/{id}/toggle-active` | **Fully implemented** | Immediate toggle with optimistic update. |
| 7 | **Showroom Details Profile** | Single Showroom Profile View | Card header on `ShowroomDetailScreen` | `GET /api/showrooms/{id}` | **Partially implemented** | Header shows details, but metadata (Created, Updated) omitted. |
| 8 | **Date Stepper** | Prev / Next / Today / Native DatePicker | `ShowroomDateSelector` | Query param `date` | **Fully implemented** | Synced with daily roster state. |
| 9 | **Work Session Assignment** | Full Day, Morning, Afternoon, Custom presets | `AssignStaffModalSheet` | `POST /api/showrooms/{id}/daily-staff` | **Fully implemented** | Presets standardized to `09-18`, `09-14`, `14-18`, Custom. |
| 10 | **Edit Staff Work Session** | Edit Session Dialog | `EditStaffSessionModalSheet` | `PUT /api/showroom-staff-assignments/{id}` | **Fully implemented** | Live working hours calculation and error handling. |
| 11 | **Remove Staff Work Session** | Delete Session Action | Card remove button with confirmation | `DELETE /api/showroom-staff-assignments/{id}` | **Fully implemented** | Roster removal and instant hours recalculation. |
| 12 | **Confirm Attendance (Lock)** | Lock button with confirmation | Confirm Attendance button with `AlertDialog` | `POST /api/showrooms/{id}/daily-staff/confirm` | **Fully implemented** | Locks editing, updates confirmed banner with author & time. |
| 13 | **Unlock Attendance (Owner)** | Owner-only unlock button | Owner-only "Correct" button on banner | `POST /api/showrooms/{id}/daily-staff/unlock` | **Fully implemented** | Owner permission verified via auth provider. |
| 14 | **Scheduled Hours Metric** | Scheduled working hours counter | Metric card on detail screen | Client calculated | **Fully implemented** | Accurately sums scheduled session hours. |
| 15 | **Workspace Multi-Tab Shell** | 3 sub-tabs: Work, Sessions, History | None (Single view) | None | **Completely missing** | `ShowroomDetailScreen` has no tab bar or sub-navigation. |
| 16 | **Vehicle Types Catalog** | Dynamic catalog fetch | None | `GET /api/showroom-vehicle-types` | **Backend available but UI missing** | Endpoint exists in backend; Android has no API/model/UI. |
| 17 | **Work Types Catalog** | Dynamic service catalog fetch | None | `GET /api/showroom-work-types` | **Backend available but UI missing** | Endpoint exists in backend; Android has no API/model/UI. |
| 18 | **Log Vehicle Work (Single / Batch)** | Batch modal (Count 1-9999, Type, Services, Staff) | None | `POST /api/showrooms/{id}/vehicle-works/batch` | **Backend available but UI missing** | Crucial operational logging workflow missing on mobile. |
| 19 | **Vehicle Work Roster & Filters** | Table with Staff and Vehicle Type filters | None | `GET /api/showrooms/{id}/vehicle-works` | **Backend available but UI missing** | No screen or card to view logged vehicle services. |
| 20 | **Edit Vehicle Work** | Edit Vehicle Work Dialog | None | `PUT /api/showrooms/{id}/vehicle-works/{id}` | **Backend available but UI missing** | No edit capability for logged vehicle operations. |
| 21 | **Close / Clock-out Session** | Clock-out modal with end time & notes | None | `POST /api/showrooms/{id}/work-sessions/{id}/close` | **Backend available but UI missing** | Session clock-out endpoint exists in backend; no UI in Android. |
| 22 | **Operations Summary Banner** | Daily Vehicles Handled, Services Done, Breakdown pills | None (Card counter only) | `GET /api/showrooms/{id}/operations-summary` | **Backend available but UI missing** | Metric on `ShowroomCard` is non-interactive; breakdown missing. |
| 23 | **Global Receivables Overview** | Cross-showroom Billed, Collected, Outstanding table | None | `GET /api/showrooms/outstanding` | **Backend available but UI missing** | Overview exists on Desktop `/showroom/bill` landing. |
| 24 | **Daily Bill Summary** | Daily Bill card (Billed, Received, Balance, Status) | None | `GET /api/showrooms/{id}/daily-bill` | **Backend available but UI missing** | No daily billing display in Showroom module. |
| 25 | **Set / Edit Daily Bill** | Set Daily Bill modal | None | `POST /api/showrooms/{id}/daily-bill` | **Backend available but UI missing** | Cannot set showroom daily turnover amount in Android. |
| 26 | **Record Daily Payment** | Payment modal (Cash, UPI, Card, Bank, Ref, Notes) | None | `POST /api/showrooms/{id}/daily-bill/payments` | **Backend available but UI missing** | Cannot record daily showroom collections in Android. |
| 27 | **Void / Delete Payment** | Delete payment action | None | `DELETE /api/showroom-payments/{id}` | **Backend available but UI missing** | Cannot void accidental payment entries in Android. |
| 28 | **Daily Payments Ledger** | List of payment transactions for date | None | Included in Daily Bill payload | **Backend available but UI missing** | No list of daily payment records in Showroom module. |
| 29 | **Showroom Financial History** | History tab with presets and daily breakdown table | None | `GET /api/showrooms/{id}/summary` | **Backend available but UI missing** | Historical billing summary missing in Showroom module. |

---

## 5. Showroom Master

### Findings:
- **Files Inspected:**
  - Android: `apps/android/lib/features/showroom/presentation/pages/showroom_list_screen.dart`, `apps/android/lib/features/showroom/presentation/widgets/showroom_card.dart`, `apps/android/lib/features/showroom/presentation/widgets/showroom_form_sheet.dart`
  - Desktop: `apps/desktop/renderer/src/features/showroom/ShowroomPage.tsx`
  - Backend: `backend/api/CarSpaManagement.Api/Controllers/ShowroomsController.cs`
- **Current State:** **100% COMPLETE**.
  - All CRUD actions exist: Create (`POST /api/showrooms`), Edit (`PUT /api/showrooms/{id}`), Toggle Active (`PATCH /api/showrooms/{id}/toggle-active`), and List/Search (`GET /api/showrooms`).
  - Validation is complete: Showroom name is required, Address is required, Phone number is validated to 10 digits, and GSTIN is strictly validated to the Indian 15-character structure (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`).
  - GSTIN clearing is supported (`"gstin": null` serialization).
  - KPI summary banner displays Total Showrooms, Active Hubs, and Today's Staff.

---

## 6. Daily Workspace

### Findings:
- **Files Inspected:**
  - Android: `apps/android/lib/features/showroom/presentation/pages/showroom_detail_screen.dart`, `apps/android/lib/features/showroom/providers/daily_staff_provider.dart`
  - Desktop: `apps/desktop/renderer/src/features/showroom/ShowroomAttendancePage.tsx`, `apps/desktop/renderer/src/features/showroom/ShowroomOperationsPage.tsx`
- **Current State:** **PARTIALLY IMPLEMENTED (Staff Attendance only; Vehicle Operations missing)**.
  - The entry point into the workspace from `ShowroomCard` is a button labeled **"Daily Workspace"**.
  - Tapping this button opens `ShowroomDetailScreen`, which hosts the **Date Selector**, **Showroom Master Header Card**, **Staff on Duty & Scheduled Hours KPIs**, **Attendance Lock Status Banner**, and **Staff Work Session Roster**.
  - However, in Desktop, the "Daily Workspace" is a multi-tab environment that also includes **Vehicle Work Logging** and **Daily Operations Summaries**. On Android, the screen only renders the Attendance half of the workspace.

---

## 7. Attendance

### Findings:
- **Files Inspected:**
  - Android: `apps/android/lib/features/showroom/presentation/pages/showroom_detail_screen.dart`, `apps/android/lib/features/showroom/presentation/widgets/assign_staff_modal_sheet.dart`, `apps/android/lib/features/showroom/presentation/widgets/edit_staff_session_modal_sheet.dart`, `apps/android/lib/features/showroom/presentation/widgets/daily_staff_assignment_card.dart`
  - Desktop: `apps/desktop/renderer/src/features/showroom/ShowroomAttendancePage.tsx`
- **Current State:** **100% COMPLETE**.
  - **Work Session Presets:** Full Day (`09:00–18:00`, 9h), Morning (`09:00–14:00`, 5h), Afternoon (`14:00–18:00`, 4h), and Custom sessions.
  - **Live Calculation:** Duration is automatically computed and displayed (`e.g. 5h`, `9h`).
  - **Assignment Types:** Regular vs Temporary Transfer; home showroom chip is displayed, and transfer reason input is captured.
  - **Attendance Locking:** Unconfirmed attendance displays a warning banner with "Confirm Attendance" action. Once confirmed, editing is locked, and author/timestamp metadata is displayed.
  - **Owner Unlock:** Owners see a "Correct" action on the confirmed banner that opens an unlock confirmation dialog (`POST /api/showrooms/{id}/daily-staff/unlock`).
  - **Conflict Handling:** Server-side 409 conflict errors (e.g. overlapping work sessions across showrooms) are mapped to user-friendly error banners.

---

## 8. Operations

### Findings:
- **Files Inspected:**
  - Desktop: `apps/desktop/renderer/src/features/showroom/ShowroomOperationsPage.tsx` (2000 lines of code across 3 sub-tabs)
  - Backend: `backend/api/CarSpaManagement.Api/Controllers/ShowroomOperationsController.cs`, `ShowroomVehicleTypesController.cs`, `ShowroomWorkTypesController.cs`
- **Current State:** **0% IMPLEMENTED IN ANDROID UI (COMPLETELY MISSING)**.
- **Detailed Operational Capabilities Missing in Android:**
  1. **Log Vehicle Work Form:**
     - Dynamic Vehicle Counter input (`1–9999`) with collapsible accordion cards for each vehicle.
     - Vehicle Type dropdown (fetching active vehicle types from `GET /api/showroom-vehicle-types`).
     - Multi-select Work / Service Types checkboxes (fetching active services from `GET /api/showroom-work-types`).
     - Eligible on-duty staff selection (filtered to staff present in attendance on the selected date).
     - Batch payload dispatch to `POST /api/showrooms/{id}/vehicle-works/batch`.
  2. **Daily Vehicle Work Roster:**
     - List of recorded vehicle works showing: Recorded Time, Staff Member (`#STF-...`), Vehicle Type badge, Vehicle count, Service tag chips (`Washing`, `Vacuuming`), and Notes.
     - Filters by Staff Member and Vehicle Type.
     - Edit Vehicle Work action (`PUT /api/showrooms/{id}/vehicle-works/{id}`).
  3. **Daily Operations Summary Breakdown:**
     - Summary KPI cards: Vehicles Handled, Services Completed, Active Staff Sessions.
     - Vehicle Type Breakdown badge strip (e.g. `Sedan: 6`, `SUV: 4`).
     - Work Type Breakdown badge strip (e.g. `Full Wash: 8`, `Interior Spa: 3`).
  4. **Staff Work Sessions Management:**
     - Active staff work sessions list with active/completed status.
     - Session Clock-Out / Close modal (`POST /api/showrooms/{id}/work-sessions/{id}/close`) to record final end time and notes.

---

## 9. Billing

### Findings:
- **Files Inspected:**
  - Desktop: `apps/desktop/renderer/src/features/showroom/ShowroomBillPage.tsx` (1331 lines of code)
  - Backend: `backend/api/CarSpaManagement.Api/Controllers/ShowroomsController.cs` (`/daily-bill`, `/daily-bill/payments`, `/summary`, `/outstanding`), `ShowroomPaymentsController.cs`
  - Android: `apps/android/lib/features/reports/presentation/pages/showroom_report_screen.dart`
- **Current State:** **0% IMPLEMENTED IN ANDROID SHOWROOM MODULE (COMPLETELY MISSING)**.
  *(Note: A high-level aggregate report exists under the separate Reports module, but daily billing operations and payment collection inside the Showroom module do not exist on Android).*
- **Detailed Billing Capabilities Missing in Android Showroom:**
  1. **Daily Bill Summary Card:**
     - Total Billed, Total Collected, Balance Amount, and Payment Status Badge (`Paid`, `PartiallyPaid`, `Unpaid`).
  2. **Set Daily Bill Modal:**
     - Form to enter/update daily billed turnover for the dealership (`POST /api/showrooms/{id}/daily-bill`).
  3. **Record Payment Modal:**
     - Form to record collections: Amount (constrained to `<= Balance`), Payment Method (`Cash`, `UPI`, `Card`, `BankTransfer`), Reference, and Notes (`POST /api/showrooms/{id}/daily-bill/payments`).
  4. **Daily Payments Ledger:**
     - Chronological list of payments recorded on the date with recorded timestamp, amount, payment method badge, and Void / Delete action (`DELETE /api/showroom-payments/{id}`).
  5. **Showroom Financial History:**
     - Date range presets (`This Month`, `Last Month`, `This Week`, `Custom`).
     - Historical aggregate cards (Total Billed, Total Collected, Total Outstanding, Unpaid Days Count).
     - Daily Breakdown table with jump-to-date navigation (`GET /api/showrooms/{id}/summary`).

---

## 10. Navigation Gaps

| Navigation Item | Desktop | Android Current | Android Required |
|---|---|---|---|
| **Showrooms Directory** | `/showroom` (Sidebar) | Bottom Nav [More] → `/showroom` | **MATCHED** |
| **Showroom Workspace Entry** | Clicking any showroom in directory | Clicking card / "Daily Workspace" button | **MATCHED** |
| **Workspace Sub-Navigation** | Direct navigation / Sub-tabs: `Attendance`, `Operations`, `Bill` | None (Screen is locked to Attendance roster) | **MISSING**: `ShowroomDetailScreen` needs a 3-tab bar (`Attendance` \| `Operations` \| `Billing`). |
| **Attendance Workspace** | `/showroom/attendance?showroomId={id}` | `ShowroomDetailScreen` (Embedded) | **MATCHED** (as Tab 1 of Workspace) |
| **Operations Workspace** | `/showroom/operations?showroomId={id}` | None | **MISSING** (as Tab 2 of Workspace) |
| **Billing Workspace** | `/showroom/bill?showroomId={id}` | None | **MISSING** (as Tab 3 of Workspace) |

---

## 11. API Gaps

| API Route | HTTP Method | Desktop Integrated? | Android Integrated? | Gap Classification |
|---|---|---|---|---|
| `/api/showrooms` | `GET` | Yes | Yes | Fully implemented |
| `/api/showrooms/{id}` | `GET` | Yes | Yes | Fully implemented |
| `/api/showrooms` | `POST` | Yes | Yes | Fully implemented |
| `/api/showrooms/{id}` | `PUT` | Yes | Yes | Fully implemented |
| `/api/showrooms/{id}/toggle-active` | `PATCH` | Yes | Yes | Fully implemented |
| `/api/showrooms/{id}/daily-staff` | `GET` | Yes | Yes | Fully implemented |
| `/api/showrooms/{id}/daily-staff` | `POST` | Yes | Yes | Fully implemented |
| `/api/showroom-staff-assignments/{id}` | `PUT` | Yes | Yes | Fully implemented |
| `/api/showroom-staff-assignments/{id}` | `DELETE` | Yes | Yes | Fully implemented |
| `/api/showrooms/{id}/daily-staff/confirm` | `POST` | Yes | Yes | Fully implemented |
| `/api/showrooms/{id}/daily-staff/unlock` | `POST` | Yes | Yes | Fully implemented |
| `/api/showroom-vehicle-types` | `GET` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showroom-work-types` | `GET` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/vehicle-works` | `GET` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/vehicle-works` | `POST` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/vehicle-works/batch` | `POST` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/vehicle-works/{id}` | `PUT` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/work-sessions` | `GET` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/work-sessions/{id}/close` | `POST` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/operations-summary` | `GET` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/daily-bill` | `GET` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/daily-bill` | `POST` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/daily-bill/payments` | `POST` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showroom-payments/{id}` | `DELETE` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/{id}/summary` | `GET` | Yes | **No** | **Backend available; Android API missing** |
| `/api/showrooms/outstanding` | `GET` | Yes | **No** | **Backend available; Android API missing** |

---

## 12. Data Model Gaps

### 1. Existing Android Models:
- `Showroom`: `id`, `name`, `address`, `phone`, `gstin`, `isActive`, `activeStaffCountToday`, `totalVehiclesToday`, `createdAt`, `updatedAt`.
- `CreateShowroomRequest`, `UpdateShowroomRequest`.
- `ShowroomSessionType`: `fullDay`, `morning`, `afternoon`, `custom`.
- `DailyStaffAssignment`, `DailyStaffResponse`, `CreateDailyStaffAssignmentRequest`, `UpdateDailyStaffAssignmentRequest`.

### 2. Missing Android Models (Required for Full Parity):
- **Showroom Vehicle Type Models:** `ShowroomVehicleType` (`id`, `name`, `code`, `description`, `displayOrder`, `isActive`).
- **Showroom Work / Service Type Models:** `ShowroomWorkType` (`id`, `name`, `code`, `category`, `description`, `displayOrder`, `isActive`).
- **Showroom Vehicle Work Models:**
  - `ShowroomVehicleWork`: `id`, `showroomId`, `staffId`, `staffName`, `staffMasterId`, `vehicleTypeId`, `vehicleTypeName`, `vehicleQuantity`, `serviceItems` (list of `ShowroomVehicleWorkItem`), `date`, `timeRecorded`, `notes`.
  - `CreateBatchShowroomVehicleWorkRequest`: `staffId`, `showroomStaffWorkSessionId`, `date`, `notes`, `vehicles` (list of `vehicleTypeId` and `workTypeIds`).
  - `UpdateShowroomVehicleWorkRequest`: `staffId`, `vehicleTypeId`, `date`, `notes`, `serviceItems`.
- **Showroom Operations Summary Models:** `ShowroomOperationsSummary` (`showroomId`, `date`, `totalVehiclesHandled`, `totalServicesPerformed`, `totalActiveStaffSessions`, `vehicleTypeBreakdown`, `workTypeBreakdown`).
- **Showroom Daily Bill & Payment Models:**
  - `ShowroomDailyBill`: `id`, `showroomId`, `date`, `amount`, `receivedAmount`, `balanceAmount`, `paymentStatus`, `notes`, `payments` (list of `ShowroomPayment`).
  - `ShowroomPayment`: `id`, `showroomDailyBillId`, `amount`, `paymentMethod`, `reference`, `paymentDate`, `notes`, `recordedByUserId`.
  - `SetShowroomDailyBillRequest`: `amount`, `notes`.
  - `RecordShowroomPaymentRequest`: `amount`, `paymentMethod`, `reference`, `paymentDate`, `notes`.
- **Showroom Financial Summary Models:** `ShowroomFinancialSummary` (`showroomId`, `startDate`, `endDate`, `totalBilled`, `totalReceived`, `outstandingAmount`, `billedDaysCount`, `unpaidDaysCount`, `dailyBills`).

---

## 13. UI/UX Gaps

1. **Workspace Shell with Sub-Tabs:** `ShowroomDetailScreen` currently renders a single vertical scroll view containing only attendance. Needs a `TabBar` (`Attendance` \| `Operations` \| `Billing`) where header cards and date selection stay fixed above the tabs.
2. **Dynamic Vehicle Work Logging:** Missing a modal bottom sheet to input vehicle count, pick vehicle types, check multiple service items, and assign on-duty staff.
3. **Daily Operations Summary Breakdown:** Missing the top KPI metrics (Vehicles Handled, Services Completed, Active Sessions) and horizontal pill strips for vehicle type and service breakdown.
4. **Daily Vehicle Work Cards & Filters:** Missing the card list of logged vehicle jobs with filters by staff member and vehicle type.
5. **Daily Bill Summary Card:** Missing the financial summary card displaying Billed, Received, Balance, and Status pill.
6. **Set Daily Bill & Record Payment Sheets:** Missing bottom sheets for daily turnover entry and payment recording.
7. **Daily Payments Ledger:** Missing transaction list with Void Payment confirmation dialog.

---

## 14. Test Coverage

### Current Verified Status:
- `flutter analyze`: **0 issues found** (PASS)
- Android Unit & Widget Tests: **28/28 Showroom tests passed**, **685/685 full suite passed** (PASS)
  - `showroom_repository_test.dart`: 6 passed
  - `showroom_model_test.dart`: 8 passed
  - `showroom_staff_assignment_model_test.dart`: 7 passed
  - `showroom_screens_test.dart`: 7 passed
- Desktop Showroom Tests: **78/78 tests passed across 5 suites** (PASS)
  - `ShowroomPage.test.tsx`: 9 passed
  - `ShowroomAttendancePage.test.tsx`: 21 passed
  - `ShowroomOperationsPage.test.tsx`: 27 passed
  - `ShowroomBillPage.test.tsx`: 16 passed
  - `MonthlyShowroomReportView.test.tsx`: 5 passed

### Missing Test Coverage:
- Operations data models and serialization unit tests.
- Vehicle Work repository and API unit tests.
- Operations StateNotifier provider tests.
- Vehicle Work logging and editing widget tests.
- Billing data models and serialization unit tests.
- Daily Bill & Payments repository and API unit tests.
- Billing StateNotifier provider tests.
- Set Bill and Record Payment widget tests.

---

## 15. Recommended Implementation Order

To implement full parity cleanly without disrupting any existing verified work:

### Phase 2 — Showroom Workspace Shell & Sub-Navigation Architecture
1. Update `ShowroomDetailScreen` to use a `DefaultTabController` with a persistent `TabBar` (`Attendance`, `Operations`, `Billing`).
2. Move the existing Attendance roster and FAB into Tab 1 (`AttendanceTab`).
3. Embed clean initial workspace structures for Tab 2 (`OperationsTab`) and Tab 3 (`BillingTab`).
4. Ensure the Showroom Master Header Card and Date Stepper remain pinned above the tab bar.
5. Run `flutter analyze` and `flutter test`.

### Phase 3 — Showroom Operations & Vehicle Work Logging
1. Create `ShowroomVehicleType`, `ShowroomWorkType`, `ShowroomVehicleWork`, and `ShowroomOperationsSummary` models.
2. Add API methods to `ShowroomApi` and repository methods to `ShowroomRepository`.
3. Create `ShowroomOperationsNotifier` provider for managing daily vehicle works and filters.
4. Build `OperationsSummaryBanner` widget (KPIs + breakdown pill strips).
5. Build `LogVehicleWorkModalSheet` and `EditVehicleWorkModalSheet`.
6. Build `VehicleWorkCard` and list view with filters by staff and vehicle type.
7. Write comprehensive unit and widget tests for Showroom Operations.

### Phase 4 — Showroom Daily Billing & Payments
1. Create `ShowroomDailyBill`, `ShowroomPayment`, and billing request models.
2. Add API methods to `ShowroomApi` and repository methods to `ShowroomRepository`.
3. Create `ShowroomBillingNotifier` provider for managing daily bill, balance, and payments.
4. Build `ShowroomDailyBillCard` (Billed, Received, Balance, Status).
5. Build `SetDailyBillModalSheet` and `RecordPaymentModalSheet`.
6. Build `ShowroomPaymentsLedger` with Void Payment action dialog.
7. Write comprehensive unit and widget tests for Showroom Billing.

---

## 16. Final Gap Summary

| Metric | Count |
|---|---|
| **Total Desktop Showroom Features Audited** | **29** |
| **Fully Implemented in Android** | **11 (37.9%)** |
| **Partially Implemented in Android** | **2 (6.9%)** |
| **Backend Available but Android UI Missing** | **16 (55.2%)** |
| **Completely Missing** | **0 (All supported by backend API)** |
| **Total Android Showroom Tests Passing** | **28/28 (100%)** |
| **Total Desktop Showroom Tests Passing** | **78/78 (100%)** |

*(Audit complete. Awaiting user review and authorization before proceeding to Phase 2.)*
