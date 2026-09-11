# E6 Current Codebase Audit

**Audit Date:** 2026-09-11  
**Repository:** E6 Car Spa  
**Branch / Working Copy:** `UI-optimisation`  
**Audit Mode:** Read-Only Full Codebase Inspection & Verification  

---

## 1. Executive Summary

This comprehensive audit establishes the verified, factual current state of the E6 Car Spa repository across all three subsystems: the **ASP.NET Core 10 Web API backend**, the **Flutter Android mobile app**, and the **Electron + React 18 + TypeScript desktop app**. 

Historical analysis documents (`CODEBASE_ANALYSIS.md` and `ELECTRON_WIRING_REPORT.md`) contained several critical inaccuracies and obsolete claims—most notably the assertion that the Electron desktop application did not exist. The actual repository contains a fully built Electron + React desktop suite (`apps/desktop`) with 228 automated tests passing, a mature Flutter Android application (`apps/android`) with 630 automated tests passing, and a robust .NET 10 Web API (`backend/api`) with 363 automated unit/integration tests passing. All **1,221 automated tests across the codebase execute and pass with zero failures**.

However, deep source-level auditing revealed critical cross-platform behavioral discrepancies, timing bugs, and architecture boundaries that require alignment before production deployment:
1. **Unauthenticated Settings Call & 401 Cascade (Android):** When launching the Android app, `SettingsNotifier`'s constructor unconditionally requests `GET /settings/business` (a protected endpoint requiring `settings.view` permission) before login. This immediately triggers HTTP 401, causing `DioClient`'s interceptor to wipe session storage and fire `AuthSessionEvents.notifyUnauthorized()`, resulting in the screen flashing `"Session expired. Please log in again."` on fresh app launch or bad login, while also preventing the public business logo from displaying cleanly.
2. **Keyboard Form Submission Interception (Android):** In `EditCustomerDialog.dart`, all four input fields (`name`, `phoneNumber`, `email`, `address`) hook `onFieldSubmitted: (_) => _handleSubmit()`, causing pressing "Next" or "Enter" on the virtual keyboard in the Name or Phone field to prematurely submit incomplete forms with validation errors rather than moving focus to the next field.
3. **Vehicle Accordion Behavior (Windows):** The vehicle accordion requirement in Windows `EditCustomerModal.tsx` is **already implemented and verified** (`handleAddVehicle()` explicitly collapses all existing cards and expands only the newly appended vehicle; 26 tests pass in `EditCustomerModal.test.tsx`).
4. **Auto-Refresh Disparities:** While desktop TanStack Query enforces a global 12-second polling loop with background pause, Android's `AutoRefreshMixin` is only implemented on 3 screens (`CatalogueScreen`, `CustomersScreen`, `CustomerDetailsScreen`). Job Cards, Showrooms, Staff, Dashboard, and Reports have no auto-refresh, requiring manual navigation or app restart to view cross-platform mutations.

---

## 2. Repository Structure

The actual verified directory layout of the repository on disk:

```
E6_Car_spa_new/
├── backend/
│   ├── CarSpaManagement.slnx                       # .NET 10 Solution file
│   ├── api/CarSpaManagement.Api/                   # ASP.NET Core 10 Web API
│   │   ├── Application/                            # DTOs, Interfaces, Services, Background Workers
│   │   ├── Controllers/                            # REST Controllers (Auth, Customers, Vehicles, etc.)
│   │   ├── Domain/                                 # Domain Entities, Enums, Value Objects
│   │   ├── Infrastructure/                         # EF Core DbContext, Configurations, Migrations
│   │   ├── appsettings.json                        # Base configuration
│   │   └── appsettings.Development.json            # Development overrides
│   └── tests/CarSpaManagement.Api.Tests/           # xUnit Unit & Integration Tests (363 tests)
├── apps/
│   ├── android/                                    # Flutter Mobile Application
│   │   ├── lib/
│   │   │   ├── core/                               # Theme, Constants, Network (Dio), Navigation (GoRouter)
│   │   │   ├── features/                           # Auth, Catalogue, Customers, Invoices, JobCards, Reports, Settings, Showroom, Staff, Users, Vehicles
│   │   │   └── shared/                             # Reusable UI widgets, Modals, Formatters
│   │   ├── test/                                   # Unit & Widget Test suites (630 tests)
│   │   └── pubspec.yaml                            # Flutter SDK ^3.6.0, Riverpod 2.5.3, Dio 5.11
│   └── desktop/                                    # Electron Desktop Application
│       ├── electron/                               # Electron Main & Preload (TypeScript)
│       │   ├── main.ts                             # Main process, window management, DPAPI safeStorage, IPC
│       │   └── preload.ts                          # Context bridge exposing electronAPI & authStorage
│       ├── renderer/                               # React 18 + Vite Frontend
│       │   ├── src/
│       │   │   ├── components/                     # UI components, layout shell, dialogs
│       │   │   ├── features/                       # Auth, Catalogue, Customers, JobCards, Invoices, Reports, Settings, Users
│       │   │   ├── lib/                            # API client, TanStack Query client, hooks
│       │   │   └── stores/                         # Zustand app & UI state
│       │   ├── package.json                        # Inner renderer package
│       │   └── vite.config.ts                      # Vite build configuration
│       └── package.json                            # Electron root package & electron-builder NSIS config
├── CODEBASE_ANALYSIS.md                            # Historical analysis document (dated 2026-09-10)
├── ELECTRON_WIRING_REPORT.md                       # Historical wiring report (dated 2026-08-18)
└── CLAUDE.md                                       # Developer workflow & specification
```

---

## 3. Historical Analysis Verification

Re-verification of claims from [CODEBASE_ANALYSIS.md](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/CODEBASE_ANALYSIS.md) and [ELECTRON_WIRING_REPORT.md](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/ELECTRON_WIRING_REPORT.md) against active code:

| # | Historical Finding / Claim | Current Status | Current Source Evidence | Priority |
|---|---|---|---|---|
| 1 | §1: Electron Desktop App Missing (`apps/desktop/` does not exist) | **INCORRECT / OUTDATED** | `apps/desktop/` exists with complete Electron main, preload, React renderer, and 228 passing Vitest tests. | N/A |
| 2 | §2: Missing / Untracked Files (`routes.dart`, report models absent) | **INCORRECT** | Routing uses GoRouter in `app_router.dart`; report models exist in `features/reports/models/`. | N/A |
| 3 | §3: Registration normalization duplicated 4+ times | **CURRENT** | `vehicle_model.dart` has `.trim().toUpperCase()` at lines 30, 80, 112, 140 instead of calling `UpperCaseTextFormatter.normalizeRegistration()`. | P3 |
| 4 | §4: Paginated list-response wrappers duplicated (14 types) | **DESIGN DECISION** | Each feature maintains its own strongly typed response wrapper (`CustomerListResponse`, `ServiceListResponse`, etc.). Idiomatic in typed Dart APIs. | Informational |
| 5 | §5: Provider error-handling boilerplate in 15+ notifiers | **LOW PRIORITY** | Repetitive `try / on ApiException / catch` pattern in Riverpod notifiers without a common mixin. | P3 |
| 6 | §6: Hardcoded business defaults duplicated across files | **CURRENT** | Business defaults (`"E6 Car Spa"`, phone, email) duplicated as offline fallbacks in models and PDF generator. | P3 |
| 7 | §7: GST 18% hardcoded in 5 locations | **CURRENT** | Hardcoded default `18.0` in `service_model.dart:21, 100, 133` and 9%+9% in `invoice_pdf_generator.dart:48`. | P3 |
| 8 | §8: `buildCounter` always returns null | **CURRENT** | `app_text_field.dart:72`: Ternary `maxLength != null ? (_, ...) => null : null` prevents character counter from displaying. | P3 |
| 9 | §9: Unsafe `as String?` JSON casting crashes on numeric IDs | **CURRENT** | `as String?` in model factories (`Customer`, `Vehicle`). Not currently crashing because backend IDs are GUID strings, but unsafe if numeric IDs are ever returned. | P3 |
| 10 | §10: `clearAuth()` bug: `_storage.read()` instead of `_storage.delete()` | **ALREADY FIXED** | `app_config.dart:47-51` correctly calls `_storage.delete()` for `keyAccessToken`, `keyRefreshToken`, and `keyUser`. | Fixed |
| 11 | §11: `PhoneValidator.validate()` has redundant condition | **CURRENT** | `phone_validator.dart:44`: `trimmed.length != 10` is redundant alongside regex `^\d{10}$`. | P3 |
| 12 | §12: Overdue status badge reuses cancelled colors | **DESIGN DECISION** | `status_badge.dart` lines 53, 77, 101 map `overdue` to `cancelled*` colors. Visual styling decision. | P3 |
| 13 | §13: `removeLogo()` reuses `isUploadingLogo` flag | **CURRENT** | `settings_provider.dart:140` sets `isUploadingLogo: true` during `removeLogo()`. | P3 |
| 14 | §14: `DailyStaffNotifier` `updateVehicles` uses `isLoading` flag | **CURRENT** | `daily_staff_provider.dart:202`: `updateVehicles` sets `isLoading: true` rather than a specific updating flag. | P3 |
| 15 | §15: Inconsistent mounted checks in `DailyStaffNotifier` | **CURRENT** | `daily_staff_provider.dart`: `removeAssignment` and `confirmAttendance` check `mounted`; `updateVehicles` and `assignStaff` do not. | P2 |
| 16 | §16: Unused import of `app_text_styles.dart` in `app_screen_scaffold.dart` | **INCORRECT** | Line 38 directly uses `AppTextStyles.headingLarge`. The import on line 3 is necessary. | N/A |
| 17 | §17: Invoice PDF logic exists only in Flutter layer | **OUTDATED** | Backend now provides PDF generation service (`InvoicePdfService.cs`), and Desktop provides native Electron `printToPDF`. | Fixed |
| 18 | §18: `@immutable` on DTOs without `==`/`hashCode` | **CURRENT** | `CreateVehicleRequest`, `UpdateVehicleRequest`, etc. have `@immutable` without equality overrides. | Informational |

---

## 4. Backend Current State

**Framework:** ASP.NET Core 10 (`net10.0`), Entity Framework Core 10, PostgreSQL / Npgsql, Serilog, BCrypt.Net.

### Authentication & Authorization
- **Bootstrap & First-Time Setup:** `POST /api/auth/bootstrap` initializes the initial Owner account. `GET /api/auth/status` allows anonymous callers to check `initialized: boolean`.
- **Lockout & Rate Limiting:** `AuthController.cs` tracks failed attempts. After 5 failed attempts, the account is locked for 300 seconds (`ACCOUNT_LOCKED`, HTTP 423), returning `remainingLockoutSeconds`. Rate limiting middleware enforces IP-based rate limiting (`429 Too Many Requests`).
- **Session & Permissions:** JWT Bearer authentication with claims for `UserId`, `Role`, and granular permission claims (e.g. `customers.view`, `vehicles.create`). Custom authorization attribute `[RequirePermission("...")]` protects all domain endpoints. Owner accounts bypass permission checks.

### Customer & Vehicle Domain
- **Normalization:** `VehicleService.NormalizeRegistration()` cleans registration numbers: removes whitespace and hyphens, converts to uppercase (e.g., `"tn 33 ab 1234"` → `"TN33AB1234"`).
- **Uniqueness & Conflicts:** Unique index on `Vehicles.RegistrationNumber`. When a conflict occurs during vehicle creation, the API returns HTTP 409 Conflict with details of the existing vehicle and owner to facilitate ownership transfer.
- **Ownership Transfer:** `POST /api/vehicles/{id}/transfer-ownership` executes inside an atomic database transaction, transfers ownership, creates an audit log entry, and returns the updated DTO.
- **Customer Vehicle Counts:** `CustomerService.GetAllAsync()` projects `c.Vehicles.Count`.

### Catalogue, Job Cards & Invoices
- **Catalogue:** `GET /api/services` supports category filtering, active status filtering, pagination, and full-text search. Categories are dynamically derived from active services plus established defaults.
- **Job Cards:** State transitions from `Draft` → `InProgress` → `Completed`/`Finished` → `Invoiced` → `Cancelled`. When an invoice is generated for a job card, the job card is locked (`IsLocked = true`).
- **Invoices:** Sequences sequential invoice numbers (`INV-YYYY-XXXX`). Tracks payment state (`Draft`, `Generated`, `Paid`, `PartiallyPaid`, `Overdue`, `Cancelled`). Public invoice endpoint `GET /api/public/invoices/{token}` is accessible anonymously via secure token.

### WhatsApp & Settings
- **WhatsApp Integration:** Meta Cloud API client with encrypted token storage (`WhatsAppConfiguration.AccessTokenEncrypted` using AES-256-GCM via `WHATSAPP_ENCRYPTION_KEY`). Background worker `WhatsAppBackgroundWorker` periodically processes pending notification queues and performs health checks against Meta Graph API.
- **Public Branding Profile:** `GET /api/public/business-profile` (`PublicBusinessProfileController.cs`) allows anonymous pre-login access to `businessName`, `logoPath`, and `updatedAt` without exposing internal tax/bank configurations.

---

## 5. Android Current State

**Framework:** Flutter (SDK ^3.6.0), Dart, Flutter Riverpod 2.5.3, Dio 5.11, Flutter Secure Storage 11.0, GoRouter 17.5.

### Verified Strengths
- **Architectural Separation:** Clean feature-first directory layout (`data`, `models`, `presentation/pages`, `presentation/widgets`, `providers`).
- **State Management:** Riverpod `StateNotifier` architecture with explicit state unions (`Loading`, `Loaded`, `Error`, `Submitting`).
- **Test Suite:** 630 automated tests in `test/` covering unit, repository, provider, and widget interactions, all passing.

### Critical Behavioral Discoveries
1. **The 401 Cascade on Launch (`SettingsNotifier`):**
   In `settings_provider.dart:23-25`:
   ```dart
   SettingsNotifier(this._repository) : super(const SettingsInitial()) {
     loadProfile();
   }
   ```
   `loadProfile()` calls `_repository.getBusinessProfile()`, hitting `GET /api/settings/business`. When the app launches unauthenticated (or on the Login screen), this endpoint returns 401. `DioClient`'s onError interceptor catches this 401, clears storage, and broadcasts `AuthSessionEvents.notifyUnauthorized()`. Consequently, `AuthNotifier` sets `state = const Unauthenticated('Session expired. Please log in again.')`. On bad login credentials, the screen shows "Session expired. Please log in again." instead of "Invalid username or password."
2. **Keyboard Form Submission Interception (`EditCustomerDialog`):**
   In `edit_customer_dialog.dart:197, 217, 242, 253`, every input field has `onFieldSubmitted: (_) => _handleSubmit()`. Hitting "Next" or "Enter" on the keyboard while editing the name or phone triggers immediate form submission instead of moving focus to the next field.
3. **Partial Auto-Refresh Coverage:**
   Only `CatalogueScreen`, `CustomersScreen`, and `CustomerDetailsScreen` mix in `AutoRefreshMixin`. All other screens require user navigation or manual pull-to-refresh.

---

## 6. Windows / Electron Current State

**Framework:** Electron ^32, React 18, Vite 5, TanStack Query v5, Tailwind CSS v4, Lucide React, Vitest 2.1.9.

### Verified Architecture & Security
- **Security Posture:** `apps/desktop/electron/main.ts` sets `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Preload script uses `contextBridge.exposeInMainWorld` to expose sanitized APIs.
- **DPAPI Credential Storage:** Session tokens are stored on Windows using DPAPI via `safeStorage.encryptString()` and `safeStorage.decryptString()`, saved to `%APPDATA%\...\session.enc`.
- **Printing & PDF Export:** Electron handles native printing via hidden BrowserWindows (`app:printJobCard`, `app:printInvoice`) and native PDF generation via `win.webContents.printToPDF()` saving directly to the user's Documents folder.
- **TanStack Query Setup:** `query-client.ts` enforces `staleTime: 10000` (10s), `refetchInterval: 12000` (12s), `refetchOnWindowFocus: true`. Polling is automatically suspended in background (`refetchIntervalInBackground: false`).
- **Tests:** 228 tests passing across 22 test files in Vitest with zero failures.

### Verified Feature Implementations
- **Vehicle Accordion:** In `EditCustomerModal.tsx:147-158`, `handleAddVehicle()` explicitly creates a new temp card, collapses all other vehicle cards (`setExpandedVehicleKeys(new Set([newTempId]))`), and scrolls the newly expanded card into view.
- **Single "Edit Details" Action:** Verified via `CustomersPage.test.tsx` line 192 that the redundant "Edit Vehicles" button has been completely eliminated in favor of a single unified "Edit Details" dialog that manages customer info and vehicles together.

---

## 7. Cross-Platform Parity

| Module | Backend Endpoint(s) | Windows Desktop | Android Mobile | Real-Time Sync Mechanism | Discrepancies & Issues |
|---|---|---|---|---|---|
| **Authentication** | `POST /auth/login`<br>`GET /auth/status`<br>`POST /auth/bootstrap` | React AuthProvider + safeStorage DPAPI + loginApi | Riverpod AuthNotifier + FlutterSecureStorage + AuthApi | Status polling on setup; event on 401 | Android flashes "Session expired" on launch due to unauthenticated `/settings/business` call. Windows handles errors cleanly. |
| **Customers** | `GET /customers`<br>`GET /customers/{id}`<br>`POST /customers`<br>`PUT /customers/{id}` | TanStack `useQuery(['customers'])` + EditCustomerModal | Riverpod `customerListProvider` + `customerDetailsProvider` | Windows: 12s interval<br>Android: 12s AutoRefreshMixin | Android `EditCustomerDialog` submits on keyboard Next/Enter. Windows has full modal with tabs/accordion. |
| **Vehicles & Ownership Transfer** | `GET /vehicles/by-customer/{id}`<br>`POST /vehicles`<br>`PUT /vehicles/{id}`<br>`POST /vehicles/{id}/transfer-ownership` | Unified inside `EditCustomerModal` with conflict modal & transfer | Dedicated `AddVehicleDialog` + `TransferOwnershipDialog` | Triggered upon customer edit/save | Parity intact. Both platforms support 409 conflict detection and ownership transfer workflow. |
| **Catalogue** | `GET /services`<br>`GET /services/categories`<br>`POST /services`<br>`PUT /services/{id}` | TanStack `useQuery(['services'])` + Create/Edit Dialog | Riverpod `catalogueProvider` + Add/Edit BottomSheet | Windows: 12s interval<br>Android: 12s AutoRefreshMixin | In Android, if an error occurs during silent auto-refresh, the error is swallowed and categories are not updated if category was selected. |
| **Job Cards** | `GET /jobcards`<br>`POST /jobcards`<br>`PUT /jobcards/{id}`<br>`POST /jobcards/{id}/finish` | Full workbench: Service selection, custom items, discount, finish, invoice lock | Step-by-step form: vehicle picker, service picker, finish action | Windows: 12s interval<br>Android: **Manual only** | Android `JobCardsScreen` lacks `AutoRefreshMixin`. Mutations made on Desktop do not appear on Android without manual refresh. |
| **Invoices & Payments** | `GET /invoices`<br>`POST /invoices/generate`<br>`POST /invoices/{id}/payments`<br>`GET /invoices/{id}/pdf` | Invoices table, payment modal, Electron `printToPDF` | Invoices list, payment bottom sheet, client PDF renderer | Windows: 12s interval<br>Android: Polling timer in provider | Android uses client-side PDF generation (`pdf` package) while Desktop uses Electron native print to PDF. |
| **Staff & Advances** | `GET /staff`<br>`GET /staffadvances`<br>`POST /staffadvances` | Staff management & advances ledger | Staff screen & advances list + approval sheet | Windows: 12s interval<br>Android: **Manual only** | Android lacks `AutoRefreshMixin` on Staff and Advances screens. |
| **Showrooms** | `GET /showrooms`<br>`GET /showrooms/daily-staff`<br>`POST /showrooms/attendance` | Showroom management & attendance grid | Showroom assignments, staff allocation, attendance sheet | Windows: 12s interval<br>Android: **Manual only** | Android `daily_staff_provider.dart` has missing mounted checks in `updateVehicles` and `assignStaff`. |
| **Settings & Branding** | `GET /settings/business`<br>`PUT /settings/business`<br>`GET /public/business-profile` | SettingsPage with logo upload, branding, invoice config | Settings screen with logo upload and public branding fallback | Windows: On mount + save<br>Android: `loadPublicProfile()` | `SettingsNotifier` calls protected `/settings/business` instead of public `/public/business-profile` during startup. |
| **WhatsApp** | `GET /settings/whatsapp`<br>`POST /settings/whatsapp/test`<br>`GET /settings/whatsapp/health` | Full WhatsApp config, QR/token test, template preview | Read-only / config screen | On demand | Parity intact. Sensitive tokens are masked with asterisks in all API responses. |

---

## 8. Authentication

### Current Behavior & Verification
1. **Backend:** Returns JWT with 24-hour expiration (`ExpirationMinutes: 1440`). Passwords hashed using BCrypt. Lockout triggers after 5 failed attempts (`423 Locked`), returning `remainingLockoutSeconds`.
2. **Desktop (Windows):** Stores token securely using Windows DPAPI (`safeStorage.encryptString`). On 401 from any non-auth endpoint, sets token to null and dispatches `auth:unauthorized`. On login failure, parses error payload and displays inline error without page refresh.
3. **Mobile (Android):** Stores token in `FlutterSecureStorage`.
   - **Bug Confirmed:** `SettingsNotifier` constructor runs `loadProfile()`, which fires `GET /settings/business` immediately upon app startup. Because the user is not yet logged in, the backend returns HTTP 401. `DioClient`'s global error handler flags this 401 and calls `AuthSessionEvents.notifyUnauthorized()`.
   - In `auth_provider.dart:31-35`:
     ```dart
     AuthSessionEvents.onUnauthorized.listen((_) {
       if (state is Authenticated) {
         state = const Unauthenticated('Session expired. Please log in again.');
       }
     });
     ```
   - Furthermore, `ApiException.fromDio` converts the 401 from `/settings/business` to `"Session expired. Please log in again."` (since it is not `/auth/login`). If an invalid login attempt occurs, or when the login screen initializes, this error message pollutes the UI.

---

## 9. Customer & Vehicle

### Current Behavior & Verification
1. **Vehicle Count Discrepancy ("1 vehicle" vs "Registered Vehicles (2)"):**
   - **Root Cause Verified:** On Android, `CustomersScreen` displays `${customer.vehicleCount} vehicles` from `CustomerListState`, which is populated by `GET /api/customers` (projecting `c.Vehicles.Count`). When the user taps a customer to open `CustomerDetailsScreen`, that screen fetches `GET /api/vehicles/by-customer/{id}`, displaying `state.vehicles.length`.
   - If a vehicle was added or transferred on Windows (or in another flow), `customerDetailsProvider` immediately loads the fresh 2 vehicles, while `customerListProvider` on the previous screen retains the cached list with count `1` until the 12-second `onAutoRefresh()` fires on the list screen.
2. **Customer Edit Keyboard Issue (Android):**
   - In `apps/android/lib/features/customers/presentation/widgets/edit_customer_dialog.dart:196-197`:
     ```dart
     textInputAction: TextInputAction.next,
     onFieldSubmitted: (_) => _handleSubmit(),
     ```
   - Every input field binds `onFieldSubmitted` directly to `_handleSubmit()`. Pressing "Next" on the soft keyboard immediately triggers form validation and submission.
3. **Vehicle Accordion & Single Edit Action (Windows):**
   - Fully implemented in `apps/desktop/renderer/src/features/customers/EditCustomerModal.tsx:133-159`. Adding a vehicle collapses all existing vehicles and expands only the new vehicle. Redundant "Edit Vehicles" action has been removed from customer details.

---

## 10. Catalogue

### Current Behavior & Verification
1. **Sync Latency between Windows and Android:**
   - When a service is created on Windows, TanStack Query invalidates `['services']` and refetches immediately.
   - On Android, `CatalogueScreen` relies on `AutoRefreshMixin` with a 12-second periodic timer (`autoRefreshInterval: const Duration(seconds: 12)`).
   - If an Android user is looking at the screen, the new service appears within 0–12 seconds, **unless** an active category filter is selected that does not match the new service's category, or if a network error occurs during `silent` refresh (in which case the error is swallowed and the list is not updated).
2. **Dynamic Categories:**
   - Both platforms correctly aggregate predefined categories (`CATALOGUE_CATEGORIES` / `kCatalogueCategories`) with dynamic categories returned by `GET /api/services/categories`.

---

## 11. Job Cards

### Current Behavior & Verification
- **Status Progression:** `Draft` → `InProgress` → `Finished`/`Completed` → `Invoiced`.
- **Finish Action:** Both platforms support marking a job card as finished, locking the service list from modifications.
- **Invoice Lock:** When an invoice is created for a job card, `JobCard.IsLocked` is set to `true`. Both Desktop and Android verify `isLocked` and disable adding/removing services or editing prices.
- **Auto-Refresh Gap:** Android `JobCardsScreen` does **not** implement `AutoRefreshMixin`. Real-time status changes initiated on Windows do not reflect on Android without navigating away and back or pulling down to refresh.

---

## 12. Invoices & Payments

### Current Behavior & Verification
- **Sequential Numbering:** Backend generates `INV-YYYY-XXXX` sequentially.
- **Payment Collection:** Both platforms support Cash, Card, UPI, and Bank Transfer payments. Partial payments transition invoice status to `PartiallyPaid`; full payments transition to `Paid`.
- **PDF Generation Parity:**
  - Desktop uses Electron native `webContents.printToPDF()` saving clean vector PDFs.
  - Android uses client-side `pdf` package (`InvoicePdfGenerator.dart`).
  - Backend provides `InvoicePdfService.cs` for generating PDF streams for public links.

---

## 13. Staff & Showrooms

### Current Behavior & Verification
- **Staff Advances:** Full support for tracking staff loan/salary advances and repayments.
- **Showroom Daily Staff:**
  - Multi-staff allocation per showroom.
  - Attendance confirmation and vehicle count updates.
- **Android Code Smell:** `DailyStaffNotifier` has missing `if (!mounted) return;` checks in `updateVehicles` and `assignStaff`, which can trigger runtime exceptions if the widget unmounts during an in-flight API call.

---

## 14. Settings, Logo & WhatsApp

### Current Behavior & Verification
1. **Business Logo Resolution:**
   - Windows desktop displays the configured logo from `GET /api/settings/business`.
   - On Android, `AppBusinessLogo` resolves the logo URL via `AppEnvironment.apiBaseUrl`. Because the default dev URL is `http://10.0.2.2:5298/api` (Android emulator loopback), if tested on a physical Android device without setting `E6_API_URL`, the logo network fetch fails and silently falls back to the default E6 car wash icon.
2. **WhatsApp Configuration:**
   - Meta Cloud API access tokens and webhook verification tokens are stored using AES-256-GCM encryption in PostgreSQL (`WhatsAppConfigurations.AccessTokenEncrypted`).
   - Responses from `GET /api/settings/whatsapp` mask access tokens (`"EAAG...****"`), ensuring secrets are never exposed to renderer or mobile logs.

---

## 15. Security

1. **No Plaintext Secrets Detected:** Scanned all configuration files, models, and repositories. All database credentials in `appsettings.json` are placeholders (`CHANGE_ME`). WhatsApp Meta access tokens are encrypted at rest with AES-256-GCM using `WHATSAPP_ENCRYPTION_KEY`.
2. **DPAPI on Windows:** Desktop auth tokens are encrypted using Windows Data Protection API (DPAPI) via Electron's `safeStorage`.
3. **Public API Rate Limiting:** Anonymous endpoints (`/api/auth/login`, `/api/auth/status`, `/api/public/*`) are protected by ASP.NET Core rate limiters (`auth-login` and `public-invoice`).
4. **Owner Privilege Escalation Guard:** In both backend and clients, Owner permissions cannot be modified or downgraded by non-owner roles.

---

## 16. Test Coverage

### Automated Test Execution Results

| Subsystem | Framework | Tests Executed | Passed | Failed | Skipped | Status |
|---|---|---|---|---|---|---|
| **Backend API** | xUnit + Moq + EF Core In-Memory | 363 | 363 | 0 | 0 | **100% PASS** |
| **Windows Desktop** | Vitest + React Testing Library | 228 | 228 | 0 | 0 | **100% PASS** |
| **Android Mobile** | Flutter Test + Riverpod Mock | 630 | 630 | 0 | 0 | **100% PASS** |
| **Total** | | **1,221** | **1,221** | **0** | **0** | **100% PASS** |

### Test Gaps Identified
- **Cross-Process End-to-End Tests:** No automated Playwright/Appium tests verifying that a change made on Windows immediately syncs to an active Android screen via background polling.
- **Android Auto-Refresh Coverage:** No tests verifying background lifecycle resume behavior for screens lacking `AutoRefreshMixin`.

---

## 17. Build Status

| Component | Command | Result | Warnings | Errors |
|---|---|---|---|---|
| **Backend Solution** | `dotnet build backend/CarSpaManagement.slnx` | **Build Succeeded** | 0 | 0 |
| **Backend Tests** | `dotnet test backend/tests/...` | **363 Passed** | 0 | 0 |
| **Desktop Tests** | `npx vitest run` | **228 Passed (22 files)** | 0 | 0 |
| **Android Tests** | `flutter test` | **630 Passed** | 0 | 0 |
| **Android Static Analysis** | `flutter analyze` | **No Issues Found** | 0 | 0 |

---

## 18. Prioritized Findings

### P0 — Critical (Immediate Fix Required Before Release)
*None. No active data corruption, security vulnerability, or build failure exists.*

### P1 — High (Core User-Facing / Workflow Problems)
1. **Android Unauthenticated 401 Cascade on App Startup:**
   - **Root Cause:** `SettingsNotifier` constructor in `apps/android/lib/features/settings/providers/settings_provider.dart:24` invokes `loadProfile()`, calling protected `GET /settings/business`.
   - **Impact:** Returns 401, triggering `AuthSessionEvents.notifyUnauthorized()`, clearing storage, flashing `"Session expired. Please log in again."` on the login screen, and preventing public branding logo from displaying.
   - **Solution:** Change `SettingsNotifier` to only call `loadPublicProfile()` (`GET /api/public/business-profile`) when unauthenticated, calling `loadProfile()` only once `AuthState` transitions to `Authenticated`.
2. **Android `EditCustomerDialog` Keyboard Enter Triggers Premature Submission:**
   - **Root Cause:** `onFieldSubmitted: (_) => _handleSubmit()` attached to `name`, `phoneNumber`, `email`, `address` in `edit_customer_dialog.dart:197, 217, 242, 253`.
   - **Impact:** Pressing "Next" or "Enter" on virtual keyboard while typing customer name immediately submits the form, showing validation error on phone number.
   - **Solution:** Use `FocusNode` to move focus to the next field on submitted for intermediate inputs; submit only on the final field or when the explicit Save button is tapped.

### P2 — Medium (UX & Synchronization Inconsistencies)
1. **Missing Auto-Refresh on Core Android Screens:**
   - **Root Cause:** `AutoRefreshMixin` is only implemented on 3 screens. `JobCardsScreen`, `InvoicesScreen`, `StaffScreen`, `ShowroomScreen`, and `DashboardScreen` lack auto-refresh.
   - **Impact:** Changes made on Desktop do not reflect on Android without manual screen switching or pull-to-refresh.
   - **Solution:** Apply `AutoRefreshMixin` consistently to all main operational screens.
2. **Inconsistent Mounted Checks in `DailyStaffNotifier`:**
   - `daily_staff_provider.dart`: `updateVehicles()` and `assignStaff()` lack `if (!mounted) return;` checks.

### P3 — Low (Code Cleanliness & Polish)
1. **Inverted `buildCounter` in `app_text_field.dart:72`:** Always returns `null`; character counter is hidden.
2. **Redundant Condition in `PhoneValidator.dart:44`:** `trimmed.length != 10` is redundant alongside regex.
3. **Registration Normalization Duplication in `vehicle_model.dart`:** Replace inline `.trim().toUpperCase()` with `UpperCaseTextFormatter.normalizeRegistration()`.
4. **Hardcoded GST 18% Defaults in Model Constructors:** Centralize in `AppConstants.defaultGstRate`.
5. **Status Badge "Overdue" Color Sharing:** Distinct orange/amber palette for overdue invoices.
6. **`removeLogo()` Flag Misuse:** Sets `isUploadingLogo: true` during removal in `settings_provider.dart`.

### Informational
1. **Desktop Vehicle Accordion:** Already fully implemented and verified in `EditCustomerModal.tsx`.
2. **Desktop Single "Edit Details" Modal:** Already verified; redundant "Edit Vehicles" action does not exist.
3. **Paginated Response Wrappers (14 types):** Acceptable typed DTO design in Flutter/Dart.

---

## 19. Recommended Next Steps

1. **Android Startup Auth Fix:** Update `SettingsNotifier` so that initial initialization calls `loadPublicProfile()` (`GET /api/public/business-profile`) instead of the protected `getBusinessProfile()`.
2. **Android Soft-Keyboard Form Navigation:** Update `EditCustomerDialog.dart` so `onFieldSubmitted` advances `FocusScope.of(context).nextFocus()` rather than invoking `_handleSubmit()`.
3. **Unified Auto-Refresh on Android:** Mix in `AutoRefreshMixin` on `JobCardsScreen`, `ShowroomScreen`, and `StaffScreen` with standard 12s polling interval to match Desktop TanStack Query behavior.
4. **Clean up Low-Priority Inconsistencies:** Fix `buildCounter` in `app_text_field.dart` and centralize vehicle normalization helpers across models.
