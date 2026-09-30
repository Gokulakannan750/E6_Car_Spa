# E6 CAR SPA — COMPLETE CROSS-PLATFORM PAGE, ROUTE & SCREEN DUPLICATION AUDIT

**Audit Date:** September 30, 2026  
**Audit Scope:**  
- Windows Desktop: `apps/desktop/renderer`
- Android Mobile: `apps/android`
- Backend API: `backend/api`  
**Execution Mode:** STRICT AUDIT ONLY — ZERO CODE MODIFIED.

---

## 1. Executive Summary

A comprehensive architectural and functional audit of every route, screen, workspace container, tab, detail page, modal workflow, redirect, and legacy alias was conducted across the Windows Desktop (React + TanStack Router) and Android Mobile (Flutter + GoRouter) codebases.

### Key Audit Findings:
1. **Core Domain Parity:** Both platforms successfully implement all primary functional domains: Dashboard Launcher, Customers, Job Cards, Invoices, Catalogue/Services, Staff Directory, Staff Attendance, Staff Advances, Staff Salary, Showrooms, Reports, Users/RBAC, Company Settings, and System Preferences.
2. **Structural Pattern Differences:**
   - **Windows Desktop:** Utilizes a widescreen multi-workspace model (`launcher`, `billing`, `staff`, `showroom`, `reports`, `settings`). Each Level-2 module has its own independent sidebar navigation with discrete sub-routes.
   - **Android Mobile:** Employs Level-2 Workspace Containers (`BillingScreen`, `StaffScreen`) that host multiple functional modules as scrollable `TabBarView` tabs, coupled with Hub screens (`ReportsScreen`, `SettingsScreen`, `ShowroomListScreen`) for modular navigation.
3. **Confirmed Route Discrepancies & Aliases:**
   - **Invoices Route Naming:** Android canonical route is `/quotations-invoices` while Windows is `/invoices`. Both consume the identical backend endpoint (`/api/invoices`). No separate quotations domain exists.
   - **Staff Advances Duplication:** Android has both `/staff/advances` (Tab 2 of `StaffScreen`) and `/staff-advances` (`StaffAdvancesScreen`). Both embed the identical widget `StaffAdvancesContent()`.
   - **Orphan Screen:** Android retains `/staff/monthly-report` (`MonthlyAttendanceReportScreen`) as a standalone route, but it is not linked from any button/tab in `StaffScreen`.
   - **Redundant Nested Routes:** Android registers 5 nested routes under `/billing` (`/billing/customers`, `/billing/job-cards`, `/billing/invoices`, `/billing/catalogue`, `/billing/services`) which duplicate the top-level routes (`/customers`, `/job-cards`, `/quotations-invoices`, `/catalogue`).
   - **Showroom Divergence:** Windows implements 4 separate pages (`/showroom`, `/showroom/attendance`, `/showroom/operations`, `/showroom/bill`), whereas Android implements a single `ShowroomDetailScreen` with 3 internal tabs. Windows `/showroom/billing` is a redirect to `/showroom/bill`.
   - **Non-Standalone Domains:** Neither **Payments** nor **Vehicles** exists as a standalone page on either platform. Payments is entirely embedded in Invoice Details; Vehicles is entirely embedded in Customer Details and New Job Card.
   - **Obsolete Desktop Prototype Files:** 8 unused/placeholder files exist in Windows desktop (`Customers.tsx`, `JobCards.tsx`, `Settings.tsx`, `Reports.tsx`, `Catalogue.tsx`, `StaffAdvances.tsx`, `Dashboard.tsx`, `Shell.tsx`).

---

## 2. Windows Complete Route Inventory

Source: [`src/router/index.tsx`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/router/index.tsx), [`src/constants/navigation.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/constants/navigation.ts)

| Route | Component | Domain | Workspace | Type | Permission | Canonical? | Duplicate / Alias | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | `LoginPage` | Auth | Public | CANONICAL | None | YES | None | User authentication |
| `/setup` | `FirstTimeSetup` | Auth | Public | CANONICAL | None | YES | None | First-time owner setup |
| `/i/:token` | `PublicInvoicePage` | Invoices | Public | CANONICAL | None | YES | None | Customer public invoice receipt |
| `/` | `Navigate to="/dashboard"` | Dashboard | Launcher | REDIRECT | None | NO | Redirect to `/dashboard` | Root redirect |
| `/dashboard` | `DashboardPage` | Dashboard | Launcher | CANONICAL | `dashboard.view` | YES | None | Level-1 Suite Launcher |
| `/customers` | `CustomersPage` | Customers | Billing | CANONICAL | `customers.view` | YES | None | Customer list & search |
| `/customers/:id` | `CustomerDetailPage` | Customers | Billing | CHILD | `customers.view` | YES | None | Customer details & vehicle management |
| `/job-cards` | `JobCardsPage` | Job Cards | Billing | CANONICAL | `jobcards.view` | YES | None | Job cards list & status board |
| `/job-cards/new` | `NewJobCard` | Job Cards | Billing | CHILD | `jobcards.create` | YES | None | Full job card creation workflow |
| `/job-cards/:id` | `JobCardDetailPage` | Job Cards | Billing | CHILD | `jobcards.view` | YES | None | Job card details & outside job dispatch |
| `/invoices` | `Invoices` | Invoices | Billing | CANONICAL | `invoices.view` | YES | None | Invoice list |
| `/invoices/:id` | `InvoiceDetailPage` | Invoices | Billing | CHILD | `invoices.view` | YES | None | Invoice details, payments & print |
| `/payments` | `Navigate to="/invoices"` | Invoices | Billing | REDIRECT | None | NO | Redirect to `/invoices` | Payments are part of `/invoices/:id` |
| `/catalogue` | `CataloguePage` | Catalogue | Billing | CANONICAL | `catalogue.view` | YES | None | Services catalogue & pricing |
| `/staff` | `StaffDirectoryPage` | Staff | Staff | CANONICAL | `staff_advances.view` | YES | None | Staff directory & profiles |
| `/staff-advances` | `StaffAdvancesPage` | Staff Advances | Staff | CANONICAL | `staff_advances.view` | YES | Duplicates staff suite advances | Staff advances list & history |
| `/staff-attendance` | `AttendancePage` | Staff Attendance | Staff | CANONICAL | `staff_advances.view` | YES | Alias of `/attendance` | Daily attendance tracking |
| `/attendance` | `AttendancePage` | Staff Attendance | Staff | ALIAS | `staff_advances.view` | NO | Alias to `/staff-attendance` | Backward-compatibility alias |
| `/staff-salary` | `SalaryPage` | Staff Salary | Staff | CANONICAL | `staff_advances.view` | YES | Alias of `/salary` | Salary calculations & payouts |
| `/salary` | `SalaryPage` | Staff Salary | Staff | ALIAS | `staff_advances.view` | NO | Alias to `/staff-salary` | Backward-compatibility alias |
| `/reports` | `ReportsPage` | Reports | Reports | CANONICAL | `reports.view` | YES | None | Reports Executive Dashboard view |
| `/reports/business` | `ReportsPage` | Reports | Reports | TAB | `reports.view` | YES | Sub-view of ReportsPage | Business revenue trends |
| `/reports/billing` | `ReportsPage` | Reports | Reports | TAB | `reports.view` | YES | Sub-view of ReportsPage | Billing & payment breakdowns |
| `/reports/staff` | `ReportsPage` | Reports | Reports | TAB | `reports.view` | YES | Sub-view of ReportsPage | Staff productivity metrics |
| `/reports/showroom` | `ReportsPage` | Reports | Reports | TAB | `reports.view` | YES | Sub-view of ReportsPage | Showroom executive summary |
| `/reports/outside-jobs`| `ReportsPage` | Reports | Reports | TAB | `reports.view` | YES | Sub-view of ReportsPage | Outside jobs vendor costs & margins |
| `/reports/custom` | `ReportsPage` | Reports | Reports | TAB | `reports.view` | YES | Sub-view of ReportsPage | Custom date-range reporting |
| `/reports/audit` | `AuditLogPage` | Audit | Reports | ALIAS | `audit.view` | NO | Alias to `/audit` | Reports-prefixed audit trail route |
| `/showroom` | `ShowroomPage` | Showroom | Showroom | CANONICAL | `showroom.view` | YES | None | Showroom list & KPIs |
| `/showroom/attendance`| `ShowroomAttendancePage`| Showroom | Showroom | CANONICAL | `showroom.view` | YES | None | Multi-showroom daily attendance |
| `/showroom/bill` | `ShowroomBillPage` | Showroom | Showroom | CANONICAL | `showroom.view` | YES | None | Showroom daily bills & billing ledger |
| `/showroom/billing` | `Navigate to="/showroom/bill"` | Showroom | Showroom | REDIRECT | None | NO | Redirect to `/showroom/bill` | Legacy spelling alias |
| `/showroom/operations`| `ShowroomOperationsPage`| Showroom | Showroom | CANONICAL | `showroom.view` | YES | None | Vehicle logs & daily work tracking |
| `/audit` | `AuditLogPage` | Audit | Settings | CANONICAL | `audit.view` | YES | None | System-wide audit log |
| `/settings` | `SettingsPage` | Settings | Settings | CANONICAL | `settings.view` | YES | None | Company profile, tax & invoice layout |
| `/settings/users` | `UsersManagementPage` | Users & RBAC | Settings | CANONICAL | `users.view` | YES | None | User accounts & permissions |
| `/settings/whatsapp` | `WhatsAppSettingsPage` | WhatsApp | Settings | CANONICAL | `settings.view` | YES | None | WhatsApp Cloud API configuration |
| `/settings/system` | `SystemPreferencesPage`| Preferences | Settings | CANONICAL | `settings.view` | YES | Windows counterpart to `/settings/preferences` | Polling intervals & regional defaults |
| `*` | `DashboardPage` | Dashboard | Launcher | REDIRECT | `dashboard.view` | NO | Catch-all fallback | Unknown route fallback |

---

## 3. Android Complete Route Inventory

Source: [`apps/android/lib/core/navigation/app_router.dart`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/android/lib/core/navigation/app_router.dart), [`apps/android/lib/config/routes.dart`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/android/lib/config/routes.dart)

| Route | Screen | Domain | Workspace | Tab | Type | Permission | Canonical? | Duplicate / Alias | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | `LoginScreen` | Auth | Public | — | CANONICAL | None | YES | None | Mobile login screen |
| `/setup` | `FirstTimeSetupScreen` | Auth | Public | — | CANONICAL | None | YES | None | Mobile first-time setup |
| `/forgot-password` | `Scaffold` | Auth | Public | — | OBSOLETE | None | NO | Placeholder | Incomplete placeholder screen |
| `/dashboard` | `DashboardScreen` | Dashboard | Launcher (L1) | — | CANONICAL | Auth | YES | None | Level-1 Suite Launcher |
| `/billing` | `BillingScreen` | Billing | Billing Suite (L2)| 0 | CANONICAL | Billing | YES | Base Suite Container | Mounts Customers tab by default |
| `/billing/customers` | `BillingScreen` | Customers | Billing Suite (L2)| 0 | ALIAS | `customers.view` | NO | Duplicate of `/customers` | Redundant nested route |
| `/billing/job-cards` | `BillingScreen` | Job Cards | Billing Suite (L2)| 1 | ALIAS | `jobcards.view` | NO | Duplicate of `/job-cards` | Redundant nested route |
| `/billing/invoices` | `BillingScreen` | Invoices | Billing Suite (L2)| 2 | ALIAS | `invoices.view` | NO | Duplicate of `/quotations-invoices` | Redundant nested route |
| `/billing/catalogue` | `BillingScreen` | Catalogue | Billing Suite (L2)| 3 | ALIAS | `catalogue.view` | NO | Duplicate of `/catalogue` | Redundant nested route |
| `/billing/services` | `BillingScreen` | Catalogue | Billing Suite (L2)| 3 | ALIAS | `catalogue.view` | NO | Duplicate of `/catalogue` | Redundant synonym route |
| `/customers` | `BillingScreen` | Customers | Billing Suite (L2)| 0 | CANONICAL | `customers.view` | YES | None | Primary route to Customers tab |
| `/customers/:id` | `CustomerDetailsScreen`| Customers | Billing Suite | — | CHILD | `customers.view` | YES | None | Standalone customer detail screen |
| `/job-cards` | `BillingScreen` | Job Cards | Billing Suite (L2)| 1 | CANONICAL | `jobcards.view` | YES | None | Primary route to Job Cards tab |
| `/job-cards/new` | `NewJobCardScreen` | Job Cards | Billing Suite | — | CHILD | `jobcards.create` | YES | None | Standalone new job card form |
| `/job-cards/:id` | `JobCardDetailsScreen` | Job Cards | Billing Suite | — | CHILD | `jobcards.view` | YES | None | Standalone job card detail screen |
| `/quotations-invoices` | `BillingScreen` | Invoices | Billing Suite (L2)| 2 | CANONICAL | `invoices.view` | YES (Android) | Android counterpart to Windows `/invoices` | Primary route to Invoices tab |
| `/quotations-invoices/:id`| `InvoiceDetailsScreen` | Invoices | Billing Suite | — | CHILD | `invoices.view` | YES (Android) | Android counterpart to Windows `/invoices/:id` | Standalone invoice detail screen |
| `/catalogue` | `BillingScreen` | Catalogue | Billing Suite (L2)| 3 | CANONICAL | `catalogue.view` | YES | None | Primary route to Catalogue tab |
| `/staff` | `StaffScreen` | Staff | Staff Suite (L2) | 0 | CANONICAL | `staff.view` | YES | None | Staff Suite container, Tab 0 (Directory) |
| `/staff/attendance` | `StaffScreen` | Attendance | Staff Suite (L2) | 1 | TAB | `staff.view` | YES | None | Staff Suite Tab 1 (Attendance) |
| `/staff/advances` | `StaffScreen` | Advances | Staff Suite (L2) | 2 | TAB | `staff_advances.view`| YES | Duplicate of `/staff-advances` | Staff Suite Tab 2 (Advances) |
| `/staff/monthly-report` | `MonthlyAttendanceReportScreen`| Attendance | Staff Suite | — | LEGACY | `staff.view` | NO | Orphan route | Not linked from Staff Suite UI |
| `/staff/salary` | `StaffScreen` | Salary | Staff Suite (L2) | 3 | TAB | `staff.view` | YES | None | Staff Suite Tab 3 (Salary) |
| `/staff-advances` | `StaffAdvancesScreen` | Advances | Legacy Standalone | — | DUPLICATE | `staff_advances.view`| NO | Duplicates `/staff/advances` | Pre-suite standalone screen |
| `/reports` | `ReportsScreen` | Reports | Reports Hub (L2) | — | CANONICAL | `reports.view` | YES | None | Reports category launcher hub |
| `/reports/sales` | `SalesReportScreen` | Reports (Sales)| Reports | — | CHILD | `reports.sales` | YES | None | Dedicated sales report screen |
| `/reports/payments` | `PaymentsReportScreen` | Reports (Pay) | Reports | — | CHILD | `reports.payments` | YES | None | Dedicated payments report screen |
| `/reports/outstanding` | `OutstandingInvoicesScreen`| Reports (Bal) | Reports | — | CHILD | `reports.view` | YES | None | Dedicated receivables screen |
| `/reports/gst` | `GstReportScreen` | Reports (GST) | Reports | — | CHILD | `reports.view` | YES | None | Dedicated GST report screen |
| `/reports/job-cards` | `JobCardReportScreen` | Reports (Jobs) | Reports | — | CHILD | `reports.view` | YES | None | Dedicated job cards report screen |
| `/reports/showrooms` | `ShowroomReportScreen` | Reports (Show) | Reports | — | CHILD | `reports.view` | YES | None | Dedicated showroom report screen |
| `/reports/staff-productivity`| `StaffProductivityScreen`| Reports (Prod) | Reports | — | CHILD | `reports.view` | YES | None | Dedicated productivity screen |
| `/reports/staff-advances` | `StaffAdvancesReportScreen`| Reports (Adv) | Reports | — | CHILD | `reports.view` | YES | None | Dedicated staff advances report |
| `/showroom` | `ShowroomListScreen` | Showroom | Showroom (L2) | — | CANONICAL | `showroom.view` | YES | None | Showroom list (pushes Detail/Receivables)|
| `/settings` | `SettingsScreen` | Settings | Settings Hub (L2)| — | CANONICAL | `settings.view` | YES | None | Settings category launcher hub |
| `/settings/company` | `CompanySettingsScreen`| Settings | Settings | — | CHILD | `settings.view` | YES | Android counterpart to Windows `/settings` | Profile, tax, WhatsApp & invoice |
| `/settings/users` | `UsersScreen` | Users & RBAC | Settings | — | CHILD | `users.view` | YES | None | User accounts & RBAC management |
| `/settings/preferences`| `SystemPreferencesScreen`| Preferences | Settings | — | CHILD | `settings.view` | YES | Android counterpart to Windows `/settings/system`| Polling intervals & regional defaults |

---

## 4. Windows Functional Page Inventory

### Real User-Facing Destinations:
1. **Dashboard Home:** `DashboardPage` (`/dashboard`)
2. **Customers Directory:** `CustomersPage` (`/customers`)
3. **Customer Details & Vehicles:** `CustomerDetailPage` (`/customers/:id`)
4. **Job Cards Management:** `JobCardsPage` (`/job-cards`)
5. **New Job Card Creator:** `NewJobCard` (`/job-cards/new`)
6. **Job Card Details & Outside Jobs:** `JobCardDetails` (`/job-cards/:id`)
7. **Invoices Directory:** `Invoices` (`/invoices`)
8. **Invoice Details & Payments:** `InvoiceDetailPage` (`/invoices/:id`)
9. **Catalogue & Services:** `CataloguePage` (`/catalogue`)
10. **Staff Directory:** `StaffDirectoryPage` (`/staff`)
11. **Staff Advances:** `StaffAdvancesPage` (`/staff-advances`)
12. **Staff Attendance & Monthly Report:** `AttendancePage` (`/staff-attendance`, `/attendance`)
13. **Staff Salary:** `SalaryPage` (`/staff-salary`, `/salary`)
14. **Showroom Hub & Directory:** `ShowroomPage` (`/showroom`)
15. **Showroom Daily Attendance:** `ShowroomAttendancePage` (`/showroom/attendance`)
16. **Showroom Operations (Vehicle Logs):** `ShowroomOperationsPage` (`/showroom/operations`)
17. **Showroom Billing & Ledger:** `ShowroomBillPage` (`/showroom/bill`)
18. **Reports Multi-View Hub:** `ReportsPage` (`/reports`, `/reports/business`, `/reports/billing`, `/reports/staff`, `/reports/showroom`, `/reports/outside-jobs`, `/reports/custom`)
19. **Audit Trail:** `AuditLogPage` (`/audit`, `/reports/audit`)
20. **Company Settings:** `SettingsPage` (`/settings`)
21. **WhatsApp Settings:** `WhatsAppSettingsPage` (`/settings/whatsapp`)
22. **Users & Permissions (RBAC):** `UsersManagementPage` (`/settings/users`)
23. **System Preferences:** `SystemPreferencesPage` (`/settings/system`)
24. **Authentication:** `LoginPage` (`/login`), `FirstTimeSetup` (`/setup`)
25. **Public Portal:** `PublicInvoicePage` (`/i/:token`)

### Unused / Obsolete Windows Files:
- `src/features/customers/Customers.tsx` (Obsolete mockup placeholder)
- `src/features/job-cards/JobCards.tsx` (Obsolete mockup placeholder)
- `src/features/settings/Settings.tsx` (Obsolete mockup placeholder)
- `src/features/catalogue/Catalogue.tsx` (Redundant 1-line wrapper)
- `src/features/reports/Reports.tsx` (Redundant 1-line re-export)
- `src/features/staff-advances/StaffAdvances.tsx` & `StaffAdvancesPage.tsx` (Redundant re-exports)
- `src/features/dashboard/Dashboard.tsx`, `DashboardLayout.tsx`, `Sidebar.tsx` (Early prototype)
- `src/layouts/Shell.tsx` (Early shell superseded by `components/shell/AppLayout.tsx`)

---

## 5. Android Functional Page Inventory

### Classification of All 36 Files in `presentation/pages/`:

| File | Classification | Container / Context | Notes |
| :--- | :--- | :--- | :--- |
| `login_screen.dart` | A. REAL STANDALONE PAGE | Root Auth | User login |
| `first_time_setup_screen.dart` | A. REAL STANDALONE PAGE | Root Auth | Initial database initialization |
| `dashboard_screen.dart` | A. REAL STANDALONE PAGE | Suite Launcher (L1) | Central Level-1 launcher |
| `billing_screen.dart` | B. WORKSPACE CONTAINER | Level-2 Suite | 4-tab container for Billing Suite |
| `customers_screen.dart` | C. TAB CONTENT | BillingScreen Tab 0 | Embedded in Billing Suite |
| `customer_details_screen.dart` | D. DETAIL PAGE | Pushed from Tab 0 | Customer profile, vehicles & jobs |
| `job_cards_screen.dart` | C. TAB CONTENT | BillingScreen Tab 1 | Embedded in Billing Suite |
| `new_job_card_screen.dart` | E. FORM PAGE | Pushed from Tab 1 | 3-step Job card creation wizard |
| `job_card_details_screen.dart` | D. DETAIL PAGE | Pushed from Tab 1 | Job card details, items & outside jobs |
| `invoices_screen.dart` | C. TAB CONTENT | BillingScreen Tab 2 | Embedded in Billing Suite |
| `invoice_details_screen.dart` | D. DETAIL PAGE | Pushed from Tab 2 | Invoice details, payments & sharing |
| `catalogue_screen.dart` | C. TAB CONTENT | BillingScreen Tab 3 | Embedded in Billing Suite |
| `staff_screen.dart` | B. WORKSPACE CONTAINER | Level-2 Suite | 4-tab container for Staff Suite |
| `staff_directory_tab.dart` | C. TAB CONTENT | StaffScreen Tab 0 | Embedded in Staff Suite |
| `staff_attendance_tab.dart` | C. TAB CONTENT | StaffScreen Tab 1 | Embedded in Staff Suite |
| `staff_advances_tab.dart` | C. TAB CONTENT | StaffScreen Tab 2 | Embedded in Staff Suite |
| `staff_salary_tab.dart` | C. TAB CONTENT | StaffScreen Tab 3 | Embedded in Staff Suite |
| `monthly_attendance_report_screen.dart`| G. REDIRECT / LEGACY WRAPPER | Standalone Route | Wraps `MonthlyAttendanceReportTab` |
| `monthly_attendance_report_tab.dart` | C. TAB CONTENT / VIEW | Inside Screen | Attendance matrix view |
| `staff_advances_screen.dart` | H. DUPLICATE FUNCTIONAL SCREEN| Standalone Route | Standalone duplicate of Advances Tab |
| `showroom_list_screen.dart` | A. REAL STANDALONE PAGE | Showroom Level-2 | Showroom list & KPIs |
| `showroom_detail_screen.dart` | D. DETAIL PAGE | Pushed from List | 3-tab container (Att/Ops/Bill) |
| `showroom_receivables_screen.dart` | D. DETAIL PAGE | Pushed from List | Outstanding balances list |
| `reports_screen.dart` | B. WORKSPACE CONTAINER (HUB)| Reports Level-2 | Category grid hub |
| `sales_report_screen.dart` | D. DETAIL PAGE (REPORT) | Pushed from Reports | Standalone sales report |
| `payments_report_screen.dart` | D. DETAIL PAGE (REPORT) | Pushed from Reports | Standalone payments report |
| `outstanding_invoices_screen.dart` | D. DETAIL PAGE (REPORT) | Pushed from Reports | Standalone receivables report |
| `gst_report_screen.dart` | D. DETAIL PAGE (REPORT) | Pushed from Reports | Standalone GST report |
| `job_card_report_screen.dart` | D. DETAIL PAGE (REPORT) | Pushed from Reports | Standalone job cards report |
| `showroom_report_screen.dart` | D. DETAIL PAGE (REPORT) | Pushed from Reports | Standalone showroom report |
| `staff_productivity_screen.dart` | D. DETAIL PAGE (REPORT) | Pushed from Reports | Standalone productivity report |
| `staff_advances_report_screen.dart` | D. DETAIL PAGE (REPORT) | Pushed from Reports | Standalone advances report |
| `settings_screen.dart` | B. WORKSPACE CONTAINER (HUB)| Settings Level-2 | Settings menu hub |
| `company_settings_screen.dart` | D. DETAIL PAGE (SETTINGS) | Pushed from Settings| Profile, GST, WhatsApp, Invoice |
| `users_screen.dart` | D. DETAIL PAGE (SETTINGS) | Pushed from Settings| User management & RBAC |
| `system_preferences_screen.dart` | D. DETAIL PAGE (SETTINGS) | Pushed from Settings| Auto-refresh intervals & regional |

---

## 6. Cross-Platform Parity Matrix

| Functional Domain | Windows Route | Windows Component | Android Route | Android Screen | Same Function? | Status / Discrepancy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Suite Launcher** | `/dashboard` | `DashboardPage` | `/dashboard` | `DashboardScreen` | YES | Parity |
| **Customers** | `/customers` | `CustomersPage` | `/customers` (Tab 0) | `CustomersScreen` | YES | Parity (Desktop Page vs Mobile Tab) |
| **Customer Detail** | `/customers/:id` | `CustomerDetailPage` | `/customers/:id` | `CustomerDetailsScreen` | YES | Parity |
| **Job Cards** | `/job-cards` | `JobCardsPage` | `/job-cards` (Tab 1) | `JobCardsScreen` | YES | Parity (Desktop Page vs Mobile Tab) |
| **New Job Card** | `/job-cards/new` | `NewJobCard` | `/job-cards/new` | `NewJobCardScreen` | YES | Parity |
| **Job Card Detail** | `/job-cards/:id` | `JobCardDetails` | `/job-cards/:id` | `JobCardDetailsScreen` | YES | Parity |
| **Invoices** | `/invoices` | `Invoices` | `/quotations-invoices` (Tab 2)| `InvoicesScreen` | YES | Naming Discrepancy (`/invoices` vs `/quotations-invoices`) |
| **Invoice Detail** | `/invoices/:id` | `InvoiceDetailPage` | `/quotations-invoices/:id` | `InvoiceDetailsScreen` | YES | Naming Discrepancy |
| **Payments** | `/payments` (Redirect) | Managed in Invoice Detail | Not a route | `RecordPaymentBottomSheet` | YES | Parity (Neither is a standalone page) |
| **Vehicles** | Not a route | Managed in Customer/Job Card | Not a route | Managed in Dialogs | YES | Parity (Neither is a standalone page) |
| **Catalogue** | `/catalogue` | `CataloguePage` | `/catalogue` (Tab 3) | `CatalogueScreen` | YES | Parity |
| **Staff Directory**| `/staff` | `StaffDirectoryPage` | `/staff` (Tab 0) | `StaffDirectoryTab` | YES | Parity |
| **Staff Attendance**| `/staff-attendance` | `AttendancePage` | `/staff/attendance` (Tab 1)| `StaffAttendanceTab` | YES | Parity |
| **Staff Advances** | `/staff-advances` | `StaffAdvancesPage` | `/staff/advances` (Tab 2) & `/staff-advances` | `StaffAdvancesTab` & `StaffAdvancesScreen` | YES | Android has duplicate routes |
| **Staff Salary** | `/staff-salary` | `SalaryPage` | `/staff/salary` (Tab 3) | `StaffSalaryTab` | YES | Parity |
| **Monthly Attendance**| Sub-tab in Attendance| `MonthlyAttendanceReportTab`| `/staff/monthly-report` | `MonthlyAttendanceReportScreen` | YES | Windows embeds in Attendance; Android has orphan route |
| **Showroom Hub** | `/showroom` | `ShowroomPage` | `/showroom` | `ShowroomListScreen` | YES | Parity |
| **Showroom Attendance**| `/showroom/attendance`| `ShowroomAttendancePage` | Sub-tab in Showroom Detail| `ShowroomAttendanceTab` | YES | Desktop has separate page; Mobile has detail tab |
| **Showroom Operations**| `/showroom/operations`| `ShowroomOperationsPage` | Sub-tab in Showroom Detail| `ShowroomOperationsTab` | YES | Desktop has separate page; Mobile has detail tab |
| **Showroom Billing**| `/showroom/bill` | `ShowroomBillPage` | Sub-tab in Showroom Detail| `ShowroomBillingTab` | YES | Desktop has separate page; Mobile has detail tab |
| **Showroom Receivables**| Sub-ledger in Bill | Embedded in `ShowroomBillPage`| Pushed from List Screen | `ShowroomReceivablesScreen` | YES | Mobile has dedicated screen; Desktop has tab in Bill |
| **Reports Hub** | `/reports` | `ReportsPage` (Dashboard)| `/reports` | `ReportsScreen` (Category Hub) | YES | Desktop single-page switch; Mobile category hub |
| **Sales Report** | `/reports/business` | `BusinessReportsView` | `/reports/sales` | `SalesReportScreen` | YES | Parity |
| **Payments Report**| `/reports/billing` | `BillingReportsView` | `/reports/payments` | `PaymentsReportScreen` | YES | Parity |
| **Outstanding Report**| `/reports/billing` | `BillingReportsView` | `/reports/outstanding` | `OutstandingInvoicesScreen` | YES | Parity |
| **GST Report** | `/reports/billing` | `BillingReportsView` | `/reports/gst` | `GstReportScreen` | YES | Parity |
| **Job Cards Report**| `/reports/business` | `BusinessReportsView` | `/reports/job-cards` | `JobCardReportScreen` | YES | Parity |
| **Showroom Report**| `/reports/showroom` | `ShowroomReportsView` | `/reports/showrooms` | `ShowroomReportScreen` | YES | Parity |
| **Staff Productivity**| `/reports/staff` | `StaffReportsView` | `/reports/staff-productivity`| `StaffProductivityScreen` | YES | Parity |
| **Staff Advances Report**| `/reports/staff` | `StaffReportsView` | `/reports/staff-advances` | `StaffAdvancesReportScreen` | YES | Parity |
| **Outside Jobs Report**| `/reports/outside-jobs`| `OutsideJobsReportsView`| Not a separate report | Covered in Business/Jobs | Partial | Desktop has dedicated outside-jobs report |
| **Audit Trail** | `/audit` | `AuditLogPage` | Not in Android menu | Not implemented in Android UI | Divergence | Android lacks `/audit` screen; available on Windows & backend |
| **Company Settings**| `/settings` | `SettingsPage` | `/settings/company` | `CompanySettingsScreen` | YES | Desktop on `/settings`, Mobile on `/settings/company` |
| **Users & RBAC** | `/settings/users` | `UsersManagementPage` | `/settings/users` | `UsersScreen` | YES | Parity |
| **WhatsApp Settings**| `/settings/whatsapp`| `WhatsAppSettingsPage` | In Company Settings | Embedded in `CompanySettingsScreen` | YES | Desktop dedicated page; Mobile embedded |
| **System Preferences**| `/settings/system` | `SystemPreferencesPage` | `/settings/preferences` | `SystemPreferencesScreen` | YES | Route naming (`/settings/system` vs `/settings/preferences`) |

---

## 7. Duplicate / Alias Findings

| Function | Route A | Route B | Same Function? | Reason | Canonical Candidate | Action Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Invoices** | Windows `/invoices` | Android `/quotations-invoices` | YES | Early mockup name difference | `/invoices` | Keep both for compatibility; align Android in future |
| **Staff Advances** | Android `/staff/advances` | Android `/staff-advances` | YES | Pre-suite standalone vs Suite tab | `/staff/advances` | Keep `/staff-advances` as compatibility redirect |
| **Staff Attendance**| Windows `/staff-attendance`| Windows `/attendance` | YES | Shorthand alias | `/staff-attendance` | Keep `/attendance` as alias |
| **Staff Salary** | Windows `/staff-salary` | Windows `/salary` | YES | Shorthand alias | `/staff-salary` | Keep `/salary` as alias |
| **Showroom Billing**| Windows `/showroom/bill` | Windows `/showroom/billing` | YES | URL spelling variation | `/showroom/bill` | Keep `/showroom/billing` redirect |
| **Audit Log** | Windows `/audit` | Windows `/reports/audit` | YES | Access from Reports vs Settings | `/audit` | Keep `/reports/audit` alias |
| **Billing Customers**| Android `/customers` | Android `/billing/customers` | YES | Nested GoRoute vs top-level | `/customers` | Keep for backward routing compatibility |
| **Billing Job Cards**| Android `/job-cards` | Android `/billing/job-cards` | YES | Nested GoRoute vs top-level | `/job-cards` | Keep for backward routing compatibility |
| **Billing Invoices** | Android `/quotations-invoices` | Android `/billing/invoices` | YES | Nested GoRoute vs top-level | `/quotations-invoices` | Keep for backward routing compatibility |
| **Billing Catalogue**| Android `/catalogue` | Android `/billing/catalogue` & `/billing/services` | YES | Nested GoRoute vs top-level | `/catalogue` | Keep for backward routing compatibility |

---

## 8. Legacy Route Findings

1. **Android `/staff/monthly-report` (`MonthlyAttendanceReportScreen`):**
   - Implemented as a standalone Scaffold in `monthly_attendance_report_screen.dart`.
   - Never referenced by any tab, action button, or navigation link in `StaffScreen`.
   - On Windows, this exact functionality is cleanly integrated as a secondary tab inside `AttendancePage.tsx`.
2. **Android `/staff-advances` (`StaffAdvancesScreen`):**
   - Complete standalone page with its own AppBar and 2 tabs (`Advances` and `Staff Directory`).
   - Built before the 4-tab `StaffScreen` Level-2 suite container was created.
   - Retained so deep links and external launcher calls still function.
3. **Windows `/showroom/billing`:**
   - Redirects to `/showroom/bill`. Retained for browser bookmarks and legacy links.

---

## 9. Redirect Findings

| Source Route | Platform | Target Route | Status Code / Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `/` | Windows | `/dashboard` | Client replace (`Navigate`) | Root to Level-1 Launcher redirect |
| `/payments` | Windows | `/invoices` | Client replace (`Navigate`) | Legacy / direct URL catch to Invoices |
| `/showroom/billing` | Windows | `/showroom/bill` | Client replace (`Navigate`) | Legacy spelling redirect |
| `*` | Windows | `/dashboard` | Client fallback | 404 / catch-all fallback |
| `/login` | Android | `/dashboard` | RouterNotifier redirect | Auto-redirect authenticated user from auth |
| `/setup` | Android | `/login` | RouterNotifier redirect | Redirect if DB already initialized |

---

## 10. Level-1 / Level-2 Navigation Tree

```
LEVEL 1 — Suite Launcher / Dashboard
│
├── E6 Billing Suite (Level 2)
│   ├── Customers (Desktop Page / Android Tab 0)
│   │   └── Customer Details & Vehicle List (Detail Page)
│   ├── Job Cards (Desktop Page / Android Tab 1)
│   │   ├── New Job Card Form (Creation Page)
│   │   └── Job Card Details & Outside Jobs (Detail Page)
│   ├── Invoices (Desktop `/invoices` / Android `/quotations-invoices` Tab 2)
│   │   ├── Invoice Details & Payments (Detail Page)
│   │   └── Public Invoice Link (`/i/:token`)
│   └── Catalogue / Services (Desktop Page / Android Tab 3)
│
├── E6 Staff Suite (Level 2)
│   ├── Staff Directory (Desktop Page / Android Tab 0)
│   ├── Staff Attendance (Desktop Page / Android Tab 1)
│   │   └── Monthly Attendance Matrix (Desktop Tab / Android Orphan `/staff/monthly-report`)
│   ├── Staff Advances (Desktop Page / Android Tab 2)
│   └── Staff Salary (Desktop Page / Android Tab 3)
│
├── E6 Showroom Suite (Level 2)
│   ├── Showroom Directory (Desktop Page / Android Hub `/showroom`)
│   ├── Showroom Attendance (Desktop Page / Android Detail Tab 0)
│   ├── Showroom Operations (Desktop Page / Android Detail Tab 1)
│   ├── Showroom Billing & Ledger (Desktop Page `/showroom/bill` / Android Detail Tab 2)
│   └── Showroom Receivables (Desktop Ledger Section / Android Sub-Page)
│
├── E6 Reports Suite (Level 2)
│   ├── Reports Launcher (Desktop Dashboard View / Android Category Hub)
│   ├── Sales Reports (Desktop View / Android Standalone Screen)
│   ├── Payments Reports (Desktop View / Android Standalone Screen)
│   ├── Outstanding Balances (Desktop View / Android Standalone Screen)
│   ├── GST Reports (Desktop View / Android Standalone Screen)
│   ├── Job Card Reports (Desktop View / Android Standalone Screen)
│   ├── Showroom Reports (Desktop View / Android Standalone Screen)
│   ├── Staff Productivity Reports (Desktop View / Android Standalone Screen)
│   └── Outside Jobs Reports (Desktop Dedicated View / Android Business View)
│
└── E6 Settings Suite (Level 2)
    ├── Company Settings (Desktop `/settings` / Android `/settings/company`)
    ├── Users & Permissions (Desktop `/settings/users` / Android `/settings/users`)
    ├── WhatsApp Configuration (Desktop `/settings/whatsapp` / Android in Company Settings)
    ├── System Preferences (Desktop `/settings/system` / Android `/settings/preferences`)
    └── Audit Trail (Desktop `/audit` / Backend `/api/audit-logs`)
```

> **Isolation Verification:** There is **NO global bottom navigation** connecting unrelated Level-2 applications on either platform. Android's `AppShell` returns `child` without persistent bottom bars; navigation between suites occurs exclusively via Level-1 Dashboard or top app-bar back actions.

---

## 11. Backend Endpoint Correlation

| Domain | Backend Controller | Primary Endpoints | Windows Consumers | Android Consumers |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `AuthController.cs` | `/api/auth/login`, `/api/auth/setup` | `LoginPage`, `FirstTimeSetup` | `LoginScreen`, `FirstTimeSetupScreen` |
| **Customers** | `CustomersController.cs` | `/api/customers`, `/api/customers/{id}` | `CustomersPage`, `CustomerDetailPage` | `CustomersScreen`, `CustomerDetailsScreen` |
| **Vehicles** | `VehiclesController.cs` | `/api/vehicles`, `/api/vehicles/by-customer/{id}` | `CustomerDetailPage`, `NewJobCard` | `CustomerDetailsScreen`, `NewJobCardScreen` |
| **Job Cards** | `JobCardsController.cs` | `/api/job-cards`, `/api/job-cards/{id}` | `JobCardsPage`, `JobCardDetails`, `NewJobCard` | `JobCardsScreen`, `JobCardDetailsScreen` |
| **Outside Jobs**| `OutsideJobsController.cs` | `/api/outside-jobs`, `/api/vendors` | `OutsideJobsSection` in Job Card Details | `OutsideJobsSection` in Job Card Details |
| **Invoices** | `InvoicesController.cs` | `/api/invoices`, `/api/invoices/{id}`, `/api/invoices/{id}/payments` | `Invoices`, `InvoiceDetailPage` | `InvoicesScreen`, `InvoiceDetailsScreen` |
| **Public Invoice**| `PublicInvoicesController.cs`| `/api/public/invoices/{token}` | `PublicInvoicePage` | `InvoiceDetailsScreen` (Share URL) |
| **Catalogue** | `ServicesController.cs` | `/api/services`, `/api/services/{id}` | `CataloguePage` | `CatalogueScreen` |
| **Staff** | `StaffAdvancesController.cs`| `/api/staff-advances/staff` | `StaffDirectoryPage` | `StaffDirectoryTab`, `StaffAdvancesScreen` |
| **Staff Advances**| `StaffAdvancesController.cs`| `/api/staff-advances` | `StaffAdvancesPage` | `StaffAdvancesTab`, `StaffAdvancesScreen` |
| **Attendance** | `StaffAttendanceController.cs`| `/api/staff/attendance` | `AttendancePage` | `StaffAttendanceTab`, `MonthlyAttendanceReport` |
| **Salary** | `StaffSalaryController.cs`| `/api/staff/salary` | `SalaryPage` | `StaffSalaryTab` |
| **Showrooms** | `ShowroomsController.cs` | `/api/showrooms`, `/api/showrooms/{id}` | `ShowroomPage`, `ShowroomAttendancePage` | `ShowroomListScreen`, `ShowroomDetailScreen` |
| **Showroom Ops**| `ShowroomOperationsController.cs`| `/api/showrooms/{id}/operations` | `ShowroomOperationsPage` | `ShowroomOperationsTab` |
| **Showroom Bills**| `ShowroomsController.cs` | `/api/showrooms/{id}/daily-bills` | `ShowroomBillPage` | `ShowroomBillingTab` |
| **Showroom Pay**| `ShowroomPaymentsController.cs`| `/api/showroom-payments` | `ShowroomBillPage` | `ShowroomBillingTab`, `ReceivablesScreen` |
| **Reports** | `ReportsController.cs` | `/api/reports/*` (dashboard, sales, payments, etc.) | `ReportsPage` | `ReportsScreen`, All 8 Report Screens |
| **Users & RBAC**| `UsersController.cs` | `/api/users`, `/api/users/{id}` | `UsersManagementPage` | `UsersScreen` |
| **Company** | `BusinessProfileController.cs`| `/api/business-profile` | `SettingsPage` | `CompanySettingsScreen` |
| **WhatsApp** | `WhatsAppSettingsController.cs`| `/api/whatsapp-settings` | `WhatsAppSettingsPage` | `CompanySettingsScreen` (WhatsApp section) |
| **Preferences**| `SystemPreferencesController.cs`| `/api/system-preferences` | `SystemPreferencesPage` | `SystemPreferencesScreen` |
| **Audit Logs** | `AuditLogsController.cs` | `/api/audit-logs` | `AuditLogPage` | Not consumed in Android UI |

---

## 12. Pages That Are NOT Actually Standalone Pages

The audit definitively proves that the following are **not standalone pages**, but rather child features, tabs, or modal dialogs:

1. **Payments (`/payments`):**
   - There is NO standalone payments page or top-level `/api/payments` endpoint.
   - Payments are recorded and viewed exclusively in `InvoiceDetailPage.tsx` (Windows) and `InvoiceDetailsScreen.dart` (Android) via modal dialogs (`RecordPaymentBottomSheet`).
   - Windows `/payments` route is a redirect to `/invoices`.
2. **Vehicles (`/vehicles`):**
   - There is NO vehicle route or page on either platform.
   - Vehicles are sub-resources attached to customers. They are created, edited, and selected exclusively inside Customer Details (`CustomerDetailPage` / `CustomerDetailsScreen`) and Job Card creation (`NewJobCard` / `NewJobCardScreen`).
3. **Staff Advances on Android (`/staff-advances`):**
   - The user-facing destination is Tab 2 of `StaffScreen` (`StaffAdvancesTab`).
   - The standalone `/staff-advances` route is a pre-suite legacy screen that duplicates the directory and advances tabs.
4. **WhatsApp Settings on Android:**
   - On Android, WhatsApp configuration is NOT a standalone page; it is a card/section embedded directly within `CompanySettingsScreen`.
5. **Showroom Attendance / Operations / Billing on Android:**
   - On Android, these are NOT standalone routes; they are tabs inside `ShowroomDetailScreen`.

---

## 13. Recommended Canonical Architecture

To maintain cross-platform architectural elegance without breaking current contracts:

1. **Billing Suite:**
   - Canonical Level-2 Container: `/billing`
   - Child Module Routes: `/customers`, `/job-cards`, `/invoices`, `/catalogue`
   - Deprecate `/quotations-invoices` in favor of `/invoices` across both platforms.
2. **Staff Suite:**
   - Canonical Level-2 Container: `/staff`
   - Child Module Routes: `/staff/directory` (or `/staff`), `/staff/attendance`, `/staff/advances`, `/staff/salary`
   - Retain `/staff-advances`, `/attendance`, `/salary` as backward-compatibility aliases.
3. **Showroom Suite:**
   - Canonical Level-2 Container: `/showroom`
   - Canonical Sub-Routes: `/showroom/attendance`, `/showroom/operations`, `/showroom/bill`
   - Retain `/showroom/billing` as redirect to `/showroom/bill`.
4. **Settings Suite:**
   - Canonical Level-2 Container: `/settings`
   - Child Module Routes: `/settings/company`, `/settings/users`, `/settings/whatsapp`, `/settings/preferences` (aligning Windows `/settings/system` with Android `/settings/preferences`).

---

## 14. Safe Cleanup Plan

*(Categorized for future implementation — NO CHANGES PERFORMED IN THIS AUDIT)*

### A. Safe to Remove After Verification (Unused Prototype Files)
- `apps/desktop/renderer/src/features/customers/Customers.tsx` (Mockup placeholder)
- `apps/desktop/renderer/src/features/job-cards/JobCards.tsx` (Mockup placeholder)
- `apps/desktop/renderer/src/features/settings/Settings.tsx` (Mockup placeholder)
- `apps/desktop/renderer/src/features/catalogue/Catalogue.tsx` (Redundant wrapper)
- `apps/desktop/renderer/src/features/reports/Reports.tsx` (Redundant re-export)
- `apps/desktop/renderer/src/features/staff-advances/StaffAdvances.tsx` & `StaffAdvancesPage.tsx` (Redundant re-exports)
- `apps/desktop/renderer/src/features/dashboard/Dashboard.tsx`, `DashboardLayout.tsx`, `Sidebar.tsx` (Obsolete early prototype)
- `apps/desktop/renderer/src/layouts/Shell.tsx` (Obsolete shell)

### B. Keep as Compatibility Redirects
- Windows `/` → `/dashboard`
- Windows `/payments` → `/invoices`
- Windows `/showroom/billing` → `/showroom/bill`
- Windows `/attendance` → `/staff-attendance`
- Windows `/salary` → `/staff-salary`
- Windows `/reports/audit` → `/audit`
- Android `/billing/customers`, `/billing/job-cards`, `/billing/invoices`, `/billing/catalogue`, `/billing/services` → map to canonical tabs in `BillingScreen`

### C. Keep Because It Is a Legitimate Child Route
- `/customers/:id` (Customer Details)
- `/job-cards/new` (New Job Card Wizard)
- `/job-cards/:id` (Job Card Details)
- `/invoices/:id` (Invoice Details)
- `/settings/users` (User Management)
- `/settings/whatsapp` (WhatsApp Config)

### D. Keep Because It Is a Real Standalone Page
- `/login`, `/setup`, `/dashboard`
- `/customers`, `/job-cards`, `/invoices`, `/catalogue`
- `/staff`, `/staff-advances`, `/staff-attendance`, `/staff-salary`
- `/showroom`, `/showroom/attendance`, `/showroom/operations`, `/showroom/bill`
- All 8 dedicated Android Report screens (`/reports/sales`, `/reports/payments`, etc.)
- `/audit` (Windows Audit Log)

### E. Needs User Decision
1. **Android `/quotations-invoices`:** Should the Android route be renamed to `/invoices` to match Windows and the backend `/api/invoices`, keeping `/quotations-invoices` as an alias redirect?
2. **Android `/staff/monthly-report`:** Should this orphan screen be added as a sub-tab inside `StaffAttendanceTab` (matching Windows), or linked explicitly via an action button in the attendance toolbar?
3. **Android Audit Trail:** Should a dedicated `/audit` (`AuditLogScreen`) be added to Android Settings to achieve complete feature parity with Windows `/audit`?
4. **System Preferences Route Casing:** Should Windows `/settings/system` and Android `/settings/preferences` be aligned to a single canonical route (`/settings/preferences`)?

---

## Summary Statistics

- **A. Total Windows routes:** 39 registered routes
- **B. Total Android routes:** 38 registered GoRoutes
- **C. Total canonical user-facing pages:** 25 on Windows, 24 on Android
- **D. Total duplicate / alias routes:** 6 on Windows, 8 on Android
- **E. Total legacy routes:** 2 on Windows (`/showroom/billing`, prototype files), 2 on Android (`/staff-advances`, `/staff/monthly-report`)
- **F. Total redirects:** 3 on Windows, 2 on Android (in router lifecycle)
- **G. Total tabs:** 6 tabs in Windows ReportsPage; 4 tabs in Android BillingScreen, 4 tabs in Android StaffScreen, 3 tabs in Android ShowroomDetailScreen
- **H. Total detail pages:** 3 on Windows (`CustomerDetail`, `JobCardDetail`, `InvoiceDetail`), 4 on Android (`CustomerDetails`, `JobCardDetails`, `InvoiceDetails`, `ShowroomDetail`)
- **I. Total modal-only workflows:** 12 modal dialogs / bottom sheets (Payments, Customer Add/Edit, Vehicle Add/Edit, Outside Job Add/Edit, Service Picker, Staff Add/Edit, Showroom Staff Swap/Assignment)
- **J. Items that should NOT be treated as separate pages:**
  1. Payments (Child of Invoice Details)
  2. Vehicles (Child of Customer Details & Job Cards)
  3. Outside Jobs (Child of Job Card Details)
  4. WhatsApp Settings on Android (Embedded in Company Settings)
  5. Showroom Attendance/Operations/Billing on Android (Embedded in Showroom Details)
