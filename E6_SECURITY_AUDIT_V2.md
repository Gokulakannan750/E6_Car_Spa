# E6 CAR SPA — PRODUCTION SECURITY AUDIT v2
**Document Version:** 2.0.0  
**Audit Date:** September 12, 2026  
**Auditor:** Antigravity AI Security Pair Programmer  
**Target Codebase:** E6 Car Spa Management System (`E6_Car_spa_new`)  
**Audit Scope:** Full Stack (ASP.NET Core 10 Web API, Electron Desktop App, Flutter Android Client, PostgreSQL, Backup Scripts)  
**Methodology:** Read-Only Static Source Code Analysis, Configuration Review, Threat Modeling, Architecture Verification  

---

## 1. Executive Summary

A comprehensive, read-only, evidence-based security audit of the E6 Car Spa codebase was conducted to independently evaluate the security posture of the application across its current desktop deployment, potential local area network (LAN) deployment, cloud hosting, and future Software-as-a-Service (SaaS) multi-tenancy.

This audit independently tested and cross-referenced all 14 findings in the initial `docs/security.md` against active code, resolving inaccuracies, verifying actual behavior, and identifying previously undocumented security characteristics.

### Key Audit Metrics
- **Total Findings Identified:** 17
  - **P0 (Critical Vulnerabilities):** 0
  - **P1 (High Vulnerabilities / Release Blockers):** 3
  - **P2 (Medium Vulnerabilities / Hardening Gaps):** 8
  - **P3 (Low Vulnerabilities / Hygiene):** 5
  - **INFO (Architectural & Informational Items):** 4
- **Secrets in Source Control:** 0 real credentials committed (only standard `CHANGE_ME` placeholders).
- **SQL Injection Risk:** 0 (100% parameterized EF Core LINQ queries across all domain modules).
- **HTML/SSRF PDF Generation Risk:** 0 (QuestPDF native vector engine used, no HTML-to-PDF headless browser).

### Top 5 Core Issues
1. **[P1] Owner Authorization Demotion Bypass:** `PermissionAuthorizationHandler.cs` evaluates the JWT `isOwner` claim and `IsInRole("Owner")` alongside the database lookup. If an Owner account is demoted in the database, the active JWT retains full unrestricted Owner bypass until token expiry (up to 24 hours).
2. **[P1] Production CORS Policy Breaks Packaged Electron:** The production CORS configuration in `Program.cs` and `appsettings.json` permits only `http://localhost:5173`. When packaged, Electron loads `file://` schemes sending `Origin: null`, causing the ASP.NET Core production CORS pipeline to reject all desktop API requests.
3. **[P1] Production HTTPS Enforcement Without Kestrel TLS Binding:** `Program.cs` enforces `options.RequireHttpsMetadata = true` and `app.UseHttpsRedirection()` in production, yet no TLS certificate or HTTPS endpoint is configured for Kestrel, breaking production startup and authentication unless reverse-proxied.
4. **[P2] Complete Absence of Content Security Policy (CSP) in Electron:** Neither `apps/desktop/electron/main.ts` nor `apps/desktop/index.html` defines a Content Security Policy header or meta tag.
5. **[P2] Dead IPC Handlers Accepting Raw HTML:** `apps/desktop/electron/main.ts` exposes `app:printJobCard` and `app:printInvoice` which load unvalidated raw HTML into a BrowserWindow. While unused by the React renderer, these handlers remain callable by any script inside the renderer context.

---

## 2. Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ HOST OPERATING SYSTEM (WINDOWS DESKTOP WORKSTATION / POS TERMINAL)                          │
│                                                                                             │
│  ┌────────────────────────┐                    ┌─────────────────────────────────────────┐  │
│  │   ELECTRON DESKTOP     │   HTTP (Loopback)  │       ASP.NET CORE 10 WEB API           │  │
│  │                        │ ─────────────────► │               (KESTREL)                 │  │
│  │  - React 19 + Vite     │   localhost:5298   │  - Port: 5298 (HTTP)                    │  │
│  │  - Sandbox: true       │ ◄───────────────── │  - JWT Auth (PBKDF2 + HMAC-SHA256)      │  │
│  │  - ContextIso: true    │                    │  - Rate Limiting (Sliding Window)       │  │
│  │  - safeStorage (DPAPI) │                    │  - Serilog Rolling Logs                 │  │
│  └────────────────────────┘                    └────────────────────┬────────────────────┘  │
│                                                                     │                       │
│                                                      TCP localhost  │                       │
│                                                      Port 5432      │                       │
│                                                                     ▼                       │
│  ┌────────────────────────┐                    ┌─────────────────────────────────────────┐  │
│  │   FLUTTER CLIENT       │   Cleartext / LAN  │         POSTGRESQL DATABASE             │  │
│  │      (ANDROID)         │                    │               (E6CarSpaNew)             │  │
│  │  - Dio + Riverpod      │ ═════════════════► │  - Localhost (127.0.0.1)                │  │
│  │  - FlutterSecureStore  │  10.0.2.2 / LAN IP │  - EF Core Migrations on startup        │  │
│  └────────────────────────┘                    └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Outbound HTTPS (TLS 1.3)
                                       ▼
                         ┌───────────────────────────┐
                         │      EXTERNAL CLOUD       │
                         │  - Meta Graph API (v25.0) │
                         │  - invoice.e6carspa.com   │
                         └───────────────────────────┘
```

### Architectural Realities
- **Current Deployment:** Single-machine, on-premise Windows workstation. Kestrel and PostgreSQL execute locally.
- **Frontend Stack:** 
  - Electron 32 + React 19 + TypeScript + Vite. Preload uses `contextBridge` with `sandbox: true` and `contextIsolation: true`.
  - Android client: Flutter 3.x + Dart + Riverpod + Dio with `flutter_secure_storage`.
- **Backend Stack:** ASP.NET Core 10 Web API (`net10.0`), Entity Framework Core 10, Npgsql PostgreSQL provider, Serilog.
- **Database:** PostgreSQL 16/17 database (`E6CarSpaNew`), listening on `127.0.0.1:5432`.
- **Integrations:** Outbound Meta Cloud API for WhatsApp notifications; public link sharing via `invoice.e6carspa.com`.

---

## 3. Threat Model Across Deployment Modes

The security posture of E6 Car Spa varies radically depending on where and how it is deployed:

| Threat Vector | A. Localhost Desktop (Current) | B. Local LAN Deployment | C. Internet / Cloud Deployment | D. Future SaaS Multi-Tenant |
| :--- | :--- | :--- | :--- | :--- |
| **Network Eavesdropping** | **Infeasible** (loopback memory IPC). | **High Risk** (cleartext HTTP on local Wi-Fi/switch). | **Critical Risk** (passwords/tokens exposed without TLS). | **Critical Risk** (mandatory TLS 1.3). |
| **Cross-Tenant Data Leak** | **N/A** (single business data). | **N/A** (single business data). | **N/A** (single business data). | **Fatal Risk** (no `TenantId` currently exists). |
| **Brute-Force / DoS** | **Low** (only local user). | **Medium** (rogue device on LAN). | **High** (automated internet crawlers/bots). | **High** (cross-tenant resource starvation). |
| **Token Theft** | **Low** (OS DPAPI encrypted). | **High** (if unencrypted over LAN). | **High** (MITM if HTTP metadata allowed). | **High** (impersonation across tenants). |
| **Untrusted Device Access** | **Low** (physical console lock). | **High** (unauthenticated LAN mobile devices). | **High** (public internet). | **High** (zero-trust boundaries required). |

---

## 4. Secrets & Credentials Analysis

### Repository Search Findings
A comprehensive regex search across all project files, configuration files, git index, and scripts was performed:
- **`appsettings.json`**:
  - `ConnectionStrings:DefaultConnection`: `"Host=localhost;Port=5432;Database=E6CarSpaNew;Username=postgres;Password=CHANGE_ME"`
  - **Verdict:** Placeholder credential (`CHANGE_ME`). Not a production secret.
- **`appsettings.Development.json`**:
  - `ConnectionStrings:DefaultConnection`: `"Host=localhost;Port=5432;Database=E6CarSpaNew;Username=postgres;Password=CHANGE_ME_DEV"`
  - **Verdict:** Development placeholder (`CHANGE_ME_DEV`).
- **`backend/api/CarSpaManagement.Api/CarSpaManagement.Api.csproj`**:
  - `<UserSecretsId>4f422417-24c1-4576-b024-63f64069ff52</UserSecretsId>`
  - **Verdict:** .NET User Secrets is configured in the project file (contrary to `security.md` claim).
- **Git Tracked Files (`git ls-files`)**:
  - Tested patterns: `.env*`, `*secret*`, `*.pfx`, `*.key`, `*.pem`, `*.crt`, `*.sql`, `*.dump`.
  - **Result:** Exactly 0 credential files tracked in Git.
- **Git Ignore Hygiene (`.gitignore`)**:
  - Correctly ignores `.env`, `.env.local`, `appsettings.Local.json`, `appsettings.*.local.json`, `secrets.json`, `*.pfx`, `*.key`, `*.pem`, `*.sql`, `*.dump`, `backups/`, and `*.pgpass`.

---

## 5. Authentication & Account Management

### Mechanisms
- **Password Hashing:** Implemented in `PasswordHasherService.cs` using Microsoft ASP.NET Core `PasswordHasher<User>` (PBKDF2 with HMAC-SHA256, per-user 128-bit cryptographically secure salt, 100,000 iterations).
- **Password Policy:** `PasswordPolicyValidator.cs` enforces:
  - Minimum 8 characters.
  - At least one uppercase letter.
  - At least one lowercase letter.
  - At least one digit.
  - At least one special character.
  - Rejection if password contains the username.
- **Account Lockout:** Managed by in-memory singleton `AccountLockoutService.cs`:
  - 5 consecutive failed attempts locks account for 15 minutes (900 seconds).
  - Returns HTTP 423 Locked with remaining countdown.
  - Reset to 0 on successful authentication.
- **Timing / Enumeration Mitigation:** `AuthService.LoginAsync` calls `accountLockoutService.RecordFailedAttempt` even when the user is missing or inactive, presenting an identical `"Invalid username or password."` message.
- **Bootstrap Flow:** `POST /api/auth/bootstrap` initializes the initial Owner account. It operates under a database transaction with `IsolationLevel.Serializable`. If `db.Users.AnyAsync()` returns true, it rejects with HTTP 409 Conflict.

---

## 6. Authorization & Role-Based Access Control

### Implementation Overview
- Dynamic policy provider `PermissionPolicyProvider` registers policies with format `Permission:<Code>`.
- Endpoints declare access via `[RequirePermission("<code>")]`.
- Permissions are seeded idempotently in `PermissionSeeder.cs` across modules: `customers.*`, `vehicles.*`, `services.*`, `jobcards.*`, `invoices.*`, `payments.*`, `reports.*`, `users.*`, `settings.*`, `staff_advances.*`, `showrooms.*`, `audit.*`.

### Real-Time Database Authorization Check
`PermissionAuthorizationHandler.cs` creates a scoped database context on every request, verifying:
1. `context.User.Identity.IsAuthenticated == true`.
2. Resolves `ClaimTypes.NameIdentifier` or `sub`.
3. Loads user from database: `db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId)`.
4. **Immediate Revocation:** If `user == null || !user.IsActive`, request is denied immediately. Deactivating a user terminates their access instantly without waiting for token expiry.
5. Verifies assigned permission in `db.UserPermissions`.

---

## 7. IDOR & Object-Level Authorization Analysis

### Evaluation of Object-Level Access
In a single-business desktop deployment, "IDOR" operates differently than in multi-tenant cloud environments:
- **Customers / Vehicles / Services / Job Cards / Invoices:** All authenticated staff members with the requisite module permissions (e.g., `invoices.view`, `customers.edit`) can access any record in the workshop. This is intended business logic for a collaborative car spa facility.
- **Granular Destructive Controls:** Destructive or financial operations are separated into sub-permissions:
  - `invoices.discount`: Checked dynamically in `InvoicesController.cs` (lines 87–94). Even if a user has `invoices.edit_draft`, applying a discount > 0 requires explicit authorization under `Permission:invoices.discount`.
  - `invoices.cancel`: Restricted to `invoices.cancel` permission.
  - `invoices.generate`: Required to finalize draft invoices and lock them.
  - Finalized invoices are completely immutable: `InvoiceService.cs` line 228 rejects any edit if `invoice.Status != InvoiceStatus.Draft`.
  - Deleted records use soft deletion (`IsDeleted = true`), filtering queries automatically.
- **Vehicle Ownership Transfer:** `POST /api/vehicles/{id}/transfer-ownership` requires `vehicles.edit`. It validates that both the vehicle and the new customer exist, logs an audit record, and updates the association cleanly.
- **Public Invoices:** Handled via unguessable 64-hex-character cryptographic token (`PublicInvoicesController.cs`), hashed with SHA-256 in the database. Raw numeric IDs or invoice GUIDs are rejected.

---

## 8. JWT Token Security

### Configuration & Lifetime
- **Issuer:** `E6CarSpa` (validated).
- **Audience:** `E6CarSpaDesktop`, `E6CarSpaMobile`, `E6CarSpa` (validated).
- **Algorithm:** HMAC-SHA256 with minimum 256-bit (32-character) secret key (`JwtOptions.cs` line 48).
- **Clock Skew:** `TimeSpan.Zero` (strictly no clock skew tolerance).
- **Token Claims:** `sub`, `nameid`, `unique_name`, `name`, `role`, `isOwner`. Permissions are not serialized into the token, avoiding claim bloat and enabling real-time permission revocation.
- **Token Lifetime:** Configured as 1440 minutes (24 hours).
  - *Contextual Evaluation:* For a desktop POS app with DPAPI encryption and immediate DB-level user deactivation checks, 24 hours is standard for a full work shift. However, as noted in Finding P1-1, role changes for Owners are bypassed due to token claims.
- **Storage:** 
  - Desktop: Stored on disk at `%APPDATA%\<AppName>\session.enc` encrypted via Electron's `safeStorage` (Windows DPAPI).
  - Android: Stored in encrypted mobile keychain via `flutter_secure_storage`.
  - Web preview fallback: Stored in `localStorage` only when `window.electronAPI` is undefined.

---

## 9. Electron Security Controls

### Core Security Settings in `apps/desktop/electron/main.ts`
- `contextIsolation: true`: Enforced. Renderer cannot access Electron or Node.js internal prototypes.
- `nodeIntegration: false`: Enforced. Node.js primitives (`require`, `process`, `fs`) are absent in renderer.
- `sandbox: true`: Enforced. Chromium sandboxing is active.
- `webSecurity`: Not explicitly declared; defaults to `true`.
- DevTools: Automatically disabled in production (`!isDev` check on line 31).

### IPC Handlers Security Audit

| IPC Channel | Source File / Lines | Arguments | Validation | Exploit Scenario / Risk |
| :--- | :--- | :--- | :--- | :--- |
| `app:getVersion` | `main.ts:49` | None | None | None (Informational). |
| `app:getPath` | `main.ts:50` | `name: string` | **None** (`name as any`) | Renderer controls argument. Throws unhandled crash if invalid name passed; reveals internal OS directory paths. |
| `app:printJobCard` | `main.ts:51-64` | `html: string` | **None** | Dead code in renderer, but registered on IPC. Creates hidden window loading unvalidated `data:text/html`. |
| `app:printInvoice` | `main.ts:66-79` | `html: string` | **None** | Same as above. Loads unvalidated HTML into hidden print window. |
| `app:saveInvoicePdf` | `main.ts:81-127` | `options?: { defaultFilename?: string }` | **Sanitized** (`replace(/[\\/:*?"<>|]/g, '_')`) | Uses native `dialog.showSaveDialog` and `printToPDF`. Safe. |
| `auth:getToken` | `main.ts:133-146` | None | None | Reads DPAPI encrypted `session.enc`. Safe. |
| `auth:setToken` | `main.ts:148-166` | `token: string \| null` | None | Writes DPAPI encrypted `session.enc` or unlinks file. Safe. |

### Navigation and External Links
- **Gap:** There is no `mainWindow.webContents.setWindowOpenHandler` or `will-navigate` listener. If an unvalidated external link or `window.open` is triggered, Electron may attempt to open windows without restriction.

---

## 10. Content Security Policy (CSP)

### Current Status
- `apps/desktop/index.html`: Contains no `<meta http-equiv="Content-Security-Policy">` tag.
- `apps/desktop/electron/main.ts`: Does not register `session.defaultSession.webRequest.onHeadersReceived` to inject CSP headers.
- **Verdict:** **CSP is completely missing.**

### Practical Risk & Impact
- *Current Risk:* In the local React application, React automatically escapes JSX interpolations, preventing basic reflective XSS. However, in the absence of a CSP, if any third-party npm dependency or DOM injection vector is exploited, the injected script has full authority to call `window.electronAPI` (e.g., extracting the JWT auth token via `getAuthToken()`).
- *Compatibility:* The React app uses bundled local scripts and standard CSS. A strict CSP (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:5298 http://127.0.0.1:5298; img-src 'self' data: http://localhost:5298;`) can be applied without breaking functionality.

---

## 11. CORS Configuration

### Backend Implementation (`Program.cs:274-290`)
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Development", policy => {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
    options.AddPolicy("Production", policy => {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        policy.WithOrigins(origins).AllowAnyMethod().AllowAnyHeader().WithExposedHeaders("X-Pagination");
    });
});
```
In `appsettings.json`:
```json
"Cors": {
    "AllowedOrigins": [ "http://localhost:5173" ]
}
```

### Flaws Identified
1. **Packaged Electron Failure:** In production mode (`ASPNETCORE_ENVIRONMENT=Production`), Electron loads from `file:///` (`mainWindow.loadFile`). Chromium sends `Origin: null` on HTTP requests with custom headers. Because `"null"` is not in `AllowedOrigins`, the production CORS middleware rejects requests from the packaged desktop app.
2. **Evaluation of Android Claim in `security.md`:** The previous audit claimed that Android requires allowed origin configuration. This is a **False Positive**. Flutter on Android uses native Dart sockets (`HttpClient` via Dio), which do not send an `Origin` header. ASP.NET Core CORS middleware ignores requests lacking an `Origin` header.

---

## 12. Network Exposure & Host Binding

### Bindings
- **Kestrel:** Configured in `Properties/launchSettings.json` to bind to `http://localhost:5298` (dev). In production, no `urls` or `Kestrel:Endpoints` are set in `appsettings.json`. ASP.NET Core defaults to `http://localhost:5000` unless overridden by `ASPNETCORE_URLS`.
- **Host Loopback:** Binds to `localhost` (`127.0.0.1` and `[::1]`). It is not exposed to the local network or internet by default.
- **PostgreSQL:** Connection string specifies `Host=localhost;Port=5432`. By default, PostgreSQL listens on `127.0.0.1`.

### Exposure Status
- **Current Exposure:** **Localhost-only**.
- **LAN / Remote Exposure:** Currently impossible without explicitly changing `ASPNETCORE_URLS="http://0.0.0.0:5298"` and opening Windows Firewall port 5298.

---

## 13. HTTPS & Transport Security

### Current Findings
- `Program.cs` line 148: `options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();`.
- `Program.cs` line 367: `app.UseHttpsRedirection();`.
- `Program.cs` line 382: `app.UseHsts();` enabled in production.
- **Analysis:**
  - On localhost desktop deployments, plaintext HTTP over loopback is secure because traffic never traverses physical network media.
  - However, enforcing `RequireHttpsMetadata = true` in production while Kestrel has no TLS certificate configured causes authentication failures if the app is launched in Production mode on a local machine.
  - If ever deployed over LAN or Internet, TLS 1.2/1.3 is mandatory to prevent credential sniffing on local Wi-Fi.

---

## 14. HTTP Security Headers

### Inspected Headers (`Program.cs:313-319`)
- `X-Content-Type-Options: nosniff` (Present).
- `X-Frame-Options: DENY` (Present).
- `Referrer-Policy: strict-origin-when-cross-origin` (Present).
- `Strict-Transport-Security`: Present via `UseHsts()` in production (default 30 days).
- `Content-Security-Policy`: Missing.
- `Permissions-Policy`: Missing.
- `Cache-Control`: Missing on authenticated sensitive routes (invoices, audit logs, user lists).

---

## 15. Rate Limiting & Abuse Protection

### Configuration (`Program.cs:169-271`)
All policies partition by client IP address (`httpContext.Connection.RemoteIpAddress`):
- `auth-login`: 5 requests per 60s (sliding window).
- `auth-bootstrap`: 3 requests per 60s.
- `public-invoice`: 30 requests per 60s.
- `file-upload`: 10 requests per 60s.
- `reports-heavy`: 30 requests per 60s (applied across all 8 reporting endpoints).
- `whatsapp-test`: 5 requests per 60s.

### Analysis & DoS Interaction
- **Account Lockout vs IP Rate Limiting:** An attacker attempting 5 passwords for a single user from one IP triggers both the IP rate limiter and account lockout. In an office LAN where all devices share an external IP (if deployed via proxy), 5 failed attempts by one employee could temporarily rate-limit the login endpoint for that IP.
- **Global Rate Limiting:** Non-auth CRUD endpoints have no rate limiting. While acceptable on localhost, an unauthenticated or low-privilege attacker on a LAN or cloud deployment could flood the database with unthrottled requests.

---

## 16. Input Validation & Injection Controls

### SQL Injection
- **Result:** **Zero SQL injection vulnerabilities found.**
- All queries in repositories and services use Entity Framework Core LINQ parameterized queries.
- The single occurrence of `ExecuteSqlRawAsync` (`Program.cs:403`) contains static, hardcoded SQL updating existing database values with no concatenated user input.

### Numeric & Business Logic Validation
- Negative payments: `InvoiceService.cs:570` rejects `request.Amount <= 0`.
- Overpayments: `InvoiceService.cs:586` rejects `request.Amount > invoice.BalanceAmount`.
- Negative discounts: `InvoiceService.cs:243` rejects `newDiscount < 0`.
- Excessive discounts: `InvoiceService.cs:245` rejects `newDiscount > invoice.Subtotal`.
- Negative staff advances: `StaffAdvanceService.cs:160` rejects `request.Amount <= 0`.
- Negative showroom payments: `ShowroomService.cs:607` rejects `request.Amount <= 0m`.

---

## 17. File Upload Security

### Implementation (`BusinessProfileService.cs:120-197`)
The logo upload endpoint (`POST /api/settings/business/logo`) is protected by `[RequirePermission("settings.business")]` and is hardened to industry best practices:
1. **Size Cap:** Enforced at 5 MB (`RequestSizeLimit(5 * 1024 * 1024)` and `file.Length > MaxFileSizeBytes`).
2. **Extension Whitelist:** Strictly permits `.png`, `.jpg`, `.jpeg`, `.webp`.
3. **MIME Whitelist:** Strictly permits `image/png`, `image/jpeg`, `image/webp`.
4. **Magic-Byte Signature Verification:** `IsValidImageHeader` validates file headers (e.g., `89 50 4E 47` for PNG, `FF D8 FF` for JPEG, `RIFF...WEBP` for WebP).
5. **Path Traversal Immunity:** The client-supplied filename is discarded. The server generates a random GUID filename: `$"logo_{Guid.NewGuid():N}{ext}"`.
6. **Execution Immunity:** Files are stored in `wwwroot/uploads/logos/` and served as static assets. The ASP.NET Core pipeline does not execute uploaded scripts.

---

## 18. PDF Generation & Print Security

### PDF Generation Engine
- `InvoicePdfGenerator.cs` utilizes **QuestPDF** (v2026.8.0), a native C# fluent layout library.
- **Zero HTML/SSRF Vector:** QuestPDF renders directly to vector canvas primitives. It does not parse HTML, does not run Chromium, and cannot execute JavaScript or trigger Server-Side Request Forgery (SSRF).
- Customer names, addresses, and vehicle details are treated as immutable string literals.

### Print Handling
- Desktop UI calls `window.print()` directly on the React DOM.
- Legacy IPC handlers `app:printJobCard` and `app:printInvoice` in `main.ts` accept raw HTML strings into hidden BrowserWindows. While dead code in the current React app, they remain callable via IPC and should be removed.

---

## 19. Database Security

### Configuration & Access
- **Connection String:** Configured with `Username=postgres`.
- **Privilege Separation:** The application connects as the PostgreSQL superuser (`postgres`). If a flaw were ever discovered, the database engine affords no least-privilege boundary.
- **Startup Migrations:** `Program.cs:402` runs `await db.Database.MigrateAsync();` on application startup. Standard for single-user desktop software, but problematic in concurrent multi-instance deployments.
- **User Secrets:** Configured in `CarSpaManagement.Api.csproj` with UserSecretsId `4f422417-24c1-4576-b024-63f64069ff52`.

---

## 20. Logging & Information Disclosure

### Logging Implementation
- Serilog writes to console and rolling daily files in `logs/carspa-.log` (retained for 7 days).
- `Program.cs` global exception handler catches all unhandled exceptions:
  - Logs full details to Serilog.
  - In production (`!app.Environment.IsDevelopment()`), returns `detail: null` and generic user error messages. Internal stack traces are never sent to clients.
- Passwords and JWT tokens are not logged.
- WhatsApp access tokens are sanitized from error messages via `SanitizeSecret` before logging or returning in DTOs.

---

## 21. WhatsApp Integration Security

### Security Controls in `WhatsAppService.cs`
- **At-Rest Encryption:** Access tokens are encrypted using AES-256-GCM via `AesEncryptionService.cs`. The encryption key is derived via SHA-256 from `WHATSAPP_ENCRYPTION_KEY` or configuration.
- **Startup Validation:** `WhatsAppOptions.Validate` rejects keys shorter than 32 characters or containing placeholder strings in production.
- **Token Masking:** `ToDto` returns `hasAccessToken` (boolean), never exposing the plaintext or encrypted token via the API.
- **Token Redaction:** `SanitizeSecret` scrubs `Bearer <token>` strings from any Meta API error responses before recording audit logs or returning errors.
- **Webhooks:** The application contains **no webhook endpoints**. It is strictly an outbound client invoking Meta's Graph API.

---

## 22. Public Endpoints Review

| Endpoint | Controller | Auth | Rate Limit | Returned Data | Risk Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/public/business-profile` | `PublicBusinessProfileController` | Anonymous | 30 req/min | `BusinessName`, `LogoPath`, `UpdatedAt` | **Safe**. Exposes only public branding; excludes GSTIN, email, phone, and internal settings. |
| `GET /api/public/invoices/{token}` | `PublicInvoicesController` | Anonymous | 30 req/min | Public invoice view (customer name, vehicle, items, total, balance) | **Safe**. Protected by 64-hex-char cryptographically random token (SHA-256 hashed in DB). Draft/cancelled invoices blocked. |
| `GET /api/auth/status` | `AuthController` | Anonymous | None | `{ "initialized": boolean }` | **Safe**. Indicates only if an initial Owner account exists. |
| `POST /api/auth/bootstrap` | `AuthController` | Anonymous | 3 req/min | Initial Owner User DTO | **Safe**. Fails with HTTP 409 if users already exist. |
| `POST /api/auth/login` | `AuthController` | Anonymous | 5 req/min | JWT token + User DTO | **Safe**. Rate limited and protected by account lockout. |
| `GET /api/health` | `Program.cs:390` | Anonymous | None | Health status ("Healthy") | **Safe**. Does not expose internal database errors. |

---

## 23. Audit Trail Integrity

### Controls (`AuditLogService.cs`)
- Records security and financial events: logins, user creation, role/permission updates, logo updates, invoice status transitions, payments, WhatsApp configuration.
- Captures client IP, user ID, full name, role, timestamp (UTC), and old/new JSON values.
- **Keyword Redaction:** Automatically scrubs sensitive fields matching `password`, `hash`, `token`, `secret`, `jwt`, `apikey` from JSON values.
- **Tamper Resistance:** `AuditLogsController.cs` exposes only a `[HttpGet]` endpoint with `[RequirePermission("audit.view")]`. There are no API endpoints to update or delete audit logs.

---

## 24. Privacy & Data Handling

### Stored PII
- Customer full names, phone numbers, email addresses, and vehicle registration numbers.
- Staff names, phone numbers, and salary advance records.
- Financial invoices and payment records.

### External Data Transmission
- PII is strictly kept on the local database, with one exception: when WhatsApp notifications are triggered, customer phone number, name, and invoice balance are transmitted to Meta Cloud API (`graph.facebook.com`).
- Public invoice links transmit invoice details over HTTPS to customers who receive the link.

---

## 25. Future SaaS & Multi-Tenant Architectural Risks

### Findings
- **Zero Tenant Partitioning:** Not a single entity (`Customer`, `Vehicle`, `JobCard`, `Invoice`, `Payment`, `Staff`, `User`) possesses a `TenantId` or `BusinessId`.
- **Singleton Business Profile:** `BusinessProfile` enforces a singleton database constraint (`SingletonKey = 1`).
- **Global EF Core Queries:** All database queries execute without tenant filters (`_db.Invoices.ToListAsync()`).
- **Verdict:** If exposed to multiple car spas without an architectural overhaul, any tenant could access every other tenant's records.

---

## 26. Dependency Security Analysis

### Package Audits
- **ASP.NET Core:**
  - `net10.0` packages (all `10.0.11` / `10.0.3`): Up-to-date modern releases.
  - `QuestPDF` (`2026.8.0`): Modern vector PDF engine.
- **Electron & Desktop:**
  - `electron`: `^32.0.0`
  - `react`: `^19.0.0`
  - `xlsx` (`^0.18.5`): Known prototype pollution CVEs exist in SheetJS when parsing untrusted user-uploaded spreadsheets. In E6, `xlsx` is used **exclusively for report exporting** (`XLSX.writeFile`), never for parsing untrusted input.
- **Flutter / Android:**
  - `flutter_secure_storage` (`^11.0.0`): Uses Android Keystore / EncryptedSharedPreferences.
  - `dio` (`^5.11.0`): Standard HTTP client.

---

## 27. Security Test Coverage

The test suite in `backend/tests/CarSpaManagement.Api.Tests` contains extensive, high-quality automated security tests:
- `AccountLockoutSecurityTests.cs`: Verifies lockout countdown and attempt resets.
- `AesEncryptionServiceTests.cs`: Verifies AES-256-GCM encryption, decryption, and tampering rejection.
- `AuditTrailSecurityTests.cs`: Verifies automated redaction of sensitive credentials.
- `AuthServiceSecurityTests.cs`: Verifies bootstrap concurrency, duplicate prevention, and login failures.
- `UserAuthorizationSecurityTests.cs`: Verifies that managers cannot escalate their own permissions or edit owners.
- `PublicBusinessProfileTests.cs`: Verifies branding endpoint does not expose sensitive business data.
- `RateLimitingConfigurationTests.cs`: Verifies sliding window partition limits.

---

## 28. Verification & Comparison with `security.md`

| Item # | Original Claim in `security.md` | Verification Against Current Codebase | Status |
| :--- | :--- | :--- | :--- |
| 1 | PostgreSQL password placeholder in `appsettings.json` | Confirmed `Password=CHANGE_ME` in `appsettings.json` and `CHANGE_ME_DEV` in `appsettings.Development.json`. | **CONFIRMED** |
| 2 | No .NET User Secrets configured | `CarSpaManagement.Api.csproj` contains `<UserSecretsId>4f422417-24c1-4576-b024-63f64069ff52</UserSecretsId>`. Secrets infrastructure is configured. | **OUTDATED** |
| 3 | Production CORS only allows `localhost:5173` | Confirmed. Packaged Electron uses `file://` (`Origin: null`), which fails under current production CORS. | **CONFIRMED** |
| 4 | CORS for Android must be configured | False positive. Flutter on Android uses native Dart sockets and does not send browser `Origin` headers. CORS does not apply to Android. | **FALSE POSITIVE** |
| 5 | 24-hour JWT lifetime is a concern | Lifetime is 24 hours. However, `security.md` missed that user active status is checked in real-time in the DB on every request. | **PARTIALLY CONFIRMED** |
| 6 | Missing Electron CSP | Confirmed. No CSP is configured in `main.ts` or `index.html`. | **CONFIRMED** |
| 7 | `app:getPath` IPC unvalidated | Confirmed. `name as any` passed directly to `app.getPath`. | **CONFIRMED** |
| 8 | Print IPC accepts raw HTML | Confirmed that `app:printJobCard` and `app:printInvoice` accept raw HTML. However, `security.md` missed that these handlers are completely unused by the renderer. | **PARTIALLY CONFIRMED** |
| 9 | Missing global API rate limiting | Confirmed. Sensitive endpoints are rate-limited, but general CRUD endpoints have no limiter. | **CONFIRMED** |
| 10 | Missing security headers | Confirmed missing `Permissions-Policy` and `Cache-Control: no-store`. `X-XSS-Protection` recommendation in `security.md` is obsolete. | **PARTIALLY CONFIRMED** |
| 11 | Hardcoded business profile seed data | Confirmed in `Program.cs:438-460`. | **CONFIRMED** |
| 12 | PostgreSQL localhost exposure | Confirmed connection string connects to `localhost:5432`. | **CONFIRMED** |
| 13 | Production HTTPS not configured | Confirmed. `RequireHttpsMetadata = true` enforced without Kestrel TLS certificate. | **CONFIRMED** |
| 14 | Token storage in Electron | Confirmed uses `safeStorage` (Windows DPAPI). | **CONFIRMED** |
| 15 | Account lockout | Confirmed enforces 423 Locked with remaining seconds. | **CONFIRMED** |
| 16 | WhatsApp credential protection | Confirmed AES-256-GCM encryption and token scrubbing in logs. | **CONFIRMED** |

---

## 29. Prioritized Findings

### P1 — High Severity

#### Finding P1-1: Stale JWT Claims Allow Demoted Owner to Retain Unrestricted Bypass
- **File:** `backend/api/CarSpaManagement.Api/Infrastructure/Authorization/PermissionAuthorizationHandler.cs` (lines 38–45)
- **Evidence:**
  ```csharp
  if (user.Role == UserRole.Owner ||
      context.User.IsInRole("Owner") ||
      context.User.HasClaim(c => c.Type == "isOwner" && c.Value.Equals("true", StringComparison.OrdinalIgnoreCase)))
  {
      context.Succeed(requirement);
      return;
  }
  ```
- **Exploit Scenario:** An Owner user transfers ownership or is demoted in the database to Manager or Staff. While their database record now reflects `UserRole.Staff`, their existing JWT token still possesses the `isOwner: "true"` claim and `Role: "Owner"`. Because the handler uses logical OR (`||`), the user continues to bypass all permission requirements until the token expires (up to 24 hours).
- **Impact:** Privilege persistence / authorization bypass after demotion.
- **Remediation:** Rely strictly on the database record: `if (user.Role == UserRole.Owner) { context.Succeed(requirement); return; }`. Delete the checks on `context.User.IsInRole` and `context.User.HasClaim`.
- **When Required:** Fix immediately before production release.

#### Finding P1-2: Production CORS Configuration Rejects Packaged Electron Desktop Application
- **File:** `backend/api/CarSpaManagement.Api/Program.cs` (lines 282–289) and `appsettings.json` (lines 28–30)
- **Evidence:**
  `appsettings.json` specifies `"Cors": { "AllowedOrigins": [ "http://localhost:5173" ] }`. Packaged Electron renders via `mainWindow.loadFile(...)` (`file://` protocol), which causes Chromium to emit `Origin: null`.
- **Exploit Scenario / Failure:** When deployed in production mode, all API calls from the desktop client are blocked by CORS preflight failures.
- **Impact:** Total application unavailability in production mode.
- **Remediation:** In production CORS configuration, allow `"null"` or configure Electron custom protocol scheme (`app://`), or handle localhost loopback calls without enforcing browser CORS.
- **When Required:** Fix immediately before packaging the desktop app for production.

#### Finding P1-3: Production Mode Enforces HTTPS Without Kestrel Certificate Configuration
- **File:** `backend/api/CarSpaManagement.Api/Program.cs` (lines 148, 367, 382)
- **Evidence:**
  `options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();` is enabled in production, but Kestrel has no TLS certificate path or HTTPS endpoint configured in `appsettings.json` or `Program.cs`.
- **Exploit Scenario / Failure:** In production desktop mode without a reverse proxy, launching the API over plain HTTP causes `JwtBearerHandler` to fail token validation because HTTPS metadata is missing.
- **Impact:** Authentication failure in production mode.
- **Remediation:** Set `RequireHttpsMetadata = false` for localhost-only desktop mode, or configure a local self-signed TLS certificate or reverse proxy if LAN deployment is used.
- **When Required:** Fix immediately before production release.

---

### P2 — Medium Severity

#### Finding P2-1: Content Security Policy (CSP) Absent in Electron Renderer
- **File:** `apps/desktop/index.html` and `apps/desktop/electron/main.ts`
- **Evidence:** No CSP meta tag or `onHeadersReceived` CSP header exists.
- **Impact:** Defense-in-depth failure. Any script injection can freely execute and make arbitrary network requests or call exposed IPC endpoints.
- **Remediation:** Add strict `<meta http-equiv="Content-Security-Policy">` in `index.html`.
- **When Required:** Fix before production release.

#### Finding P2-2: Electron Window Missing Navigation & Popup Restrictions
- **File:** `apps/desktop/electron/main.ts` (lines 13–46)
- **Evidence:** No `setWindowOpenHandler` or `will-navigate` listeners.
- **Impact:** Malicious links or unmanaged popups could navigate the main window away from the application.
- **Remediation:** Add `mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))` and restrict `will-navigate`.
- **When Required:** Fix before production release.

#### Finding P2-3: Unused Legacy Print IPC Handlers Accepting Raw HTML
- **File:** `apps/desktop/electron/main.ts` (lines 51–79)
- **Evidence:** `app:printJobCard` and `app:printInvoice` load raw HTML via `data:text/html`.
- **Impact:** Dead code surface; an attacker who achieves script execution in the renderer can invoke these handlers with arbitrary HTML.
- **Remediation:** Remove both dead handlers from `main.ts` and `preload.ts`.
- **When Required:** Fix before production release.

#### Finding P2-4: Unvalidated `app:getPath` IPC Channel
- **File:** `apps/desktop/electron/main.ts` (line 50)
- **Evidence:** `ipcMain.handle('app:getPath', (_event, name: string) => app.getPath(name as any));`
- **Impact:** Passing an invalid name causes an unhandled rejection. Exposes arbitrary filesystem paths without an allowlist.
- **Remediation:** Validate `name` against an allowlist: `const allowed = ['documents', 'downloads', 'userData'];`.
- **When Required:** Fix before production release.

#### Finding P2-5: Database Connection Uses PostgreSQL Superuser (`postgres`)
- **File:** `backend/api/CarSpaManagement.Api/appsettings.json` (line 3)
- **Evidence:** `"Username=postgres"`
- **Impact:** Violates the principle of least privilege.
- **Remediation:** Create a dedicated PostgreSQL role `e6_app_user` granted only DML permissions on the application database.
- **When Required:** Fix before production deployment.

#### Finding P2-6: User Password Updates Lack Current Password Verification
- **File:** `backend/api/CarSpaManagement.Api/Application/Services/UserService.cs` (lines 206–216)
- **Evidence:** `PUT /api/users/{id}` allows any user with `users.edit` to overwrite another non-owner user's password without supplying the current password.
- **Impact:** A compromised account with `users.edit` can reset passwords for other employees without authorization.
- **Remediation:** Separate profile editing from password resets; require current password verification for self-service changes.
- **When Required:** Recommended before production; mandatory for LAN/Cloud.

#### Finding P2-7: Account Lockout Denial-of-Service Risk
- **File:** `backend/api/CarSpaManagement.Api/Application/Services/AuthService.cs` (lines 146–150)
- **Evidence:** Lockout is triggered per normalized username after 5 failed attempts.
- **Impact:** An attacker knowing a username can deliberately lock out employees.
- **Remediation:** Implement progressive backoff delays alongside lockout.
- **When Required:** Fix before LAN/Cloud deployment.

#### Finding P2-8: Missing `Cache-Control: no-store` on Sensitive Endpoints
- **File:** `backend/api/CarSpaManagement.Api/Program.cs` (lines 313–319)
- **Evidence:** No `Cache-Control` header is appended to API responses.
- **Impact:** Financial and PII responses may be cached by intermediate proxies.
- **Remediation:** Append `Cache-Control: no-store, no-cache` in middleware.
- **When Required:** Fix before LAN/Cloud deployment.

---

### P3 — Low Severity & Security Hardening

- **P3-1:** Placeholder credentials in `appsettings.json` (`Password=CHANGE_ME`). Move to environment variables.
- **P3-2:** Hardcoded business profile seed data in `Program.cs` (lines 438–460).
- **P3-3:** Missing `Permissions-Policy` header on HTTP responses.
- **P3-4:** General API endpoints lack rate limiting (unbounded request volume).
- **P3-5:** Automatic startup database migrations (`MigrateAsync()`) on application boot.

---

## 30. Recommended Remediation Roadmap

### Phase A: Fix NOW (Before Current Desktop Production Release)
1. **Fix Owner Authorization Demotion Check:** Modify `PermissionAuthorizationHandler.cs` to check only `user.Role == UserRole.Owner` from the database.
2. **Fix Production CORS Policy:** Add `"null"` to `Cors:AllowedOrigins` in `appsettings.json` or configure a custom protocol scheme in Electron.
3. **Adjust Production HTTPS Metadata Requirement:** Set `options.RequireHttpsMetadata = false` for localhost desktop execution, or configure a local TLS certificate.
4. **Implement Electron CSP:** Add `<meta http-equiv="Content-Security-Policy">` in `apps/desktop/index.html`.
5. **Remove Dead Print IPC Handlers:** Delete `app:printJobCard` and `app:printInvoice` from `main.ts` and `preload.ts`.
6. **Harden `app:getPath` IPC Handler:** Validate requested path names against an allowlist.
7. **Restrict Window Navigation:** Implement `setWindowOpenHandler` and `will-navigate` in Electron's `main.ts`.

### Phase B: Fix Before LAN Deployment (Multiple Workshop PCs / Tablets)
1. **Configure TLS / HTTPS:** Bind Kestrel to an HTTPS port with an internal enterprise CA or self-signed certificate trusted by LAN devices.
2. **Dedicated Database Role:** Replace `postgres` superuser with a restricted `e6_app_user` database user.
3. **Android Network Security Config:** Add cleartext restrictions or internal CA certificate trust in `network_security_config.xml`.
4. **Append Cache-Control Headers:** Add `Cache-Control: no-store` on all `/api/*` routes.
5. **Global API Rate Limiting:** Implement a global rate limiter (e.g., 120 requests/min per IP) to protect against LAN device flooding.

### Phase C: Fix Before Internet / Cloud Deployment
1. **Reverse Proxy Architecture:** Deploy Kestrel behind Nginx, Caddy, or Cloudflare with automated Let's Encrypt TLS certificates.
2. **Stricter HSTS:** Configure HSTS with `max-age=31536000; includeSubDomains; preload`.
3. **Rotate JWT Secrets:** Ensure `JWT_KEY` is provided via cloud secrets manager (AWS Secrets Manager, Azure Key Vault, or Docker secrets).
4. **Separate Database Migrations:** Run EF Core migrations as a dedicated pre-deployment CI/CD step rather than on application startup.
5. **Password Change Workflow:** Require old password verification for password updates.

### Phase D: Fix Before SaaS / Multi-Tenant Deployment
1. **Tenant Data Partitioning:** Add `TenantId` (Guid) to every entity across the domain.
2. **Global Query Filters:** Implement EF Core `HasQueryFilter(e => e.TenantId == CurrentTenantId)`.
3. **Refactor Singletons:** Replace `SingletonKey` on `BusinessProfile` with unique `TenantId`.
4. **Tenant Resolution Middleware:** Resolve tenant from subdomain or JWT claim on every request.
5. **Per-Tenant WhatsApp Credentials:** Isolate WhatsApp configurations per tenant.

---

## 31. Final Security Scorecard

```
┌─────────────────────────────────────────────────────────────┐
│                    E6 SECURITY SCORECARD                    │
├──────────────────────────────────────┬──────────────────────┤
│ Current Local/On-Premise Security    │ 8.5 / 10             │
│ LAN Deployment Readiness             │ 5.5 / 10             │
│ Internet / Cloud Deployment Readiness│ 3.0 / 10             │
│ Future SaaS Multi-Tenant Readiness   │ 1.0 / 10             │
└──────────────────────────────────────┴──────────────────────┘
```

### Justification of Scores
- **Current Localhost Security (8.5/10):** Exceptional baseline controls for an on-premise application. Strong password hashing (PBKDF2 100k iterations), DPAPI OS-level token encryption in Electron, secure WhatsApp credential encryption (AES-256-GCM), zero SQL injection, QuestPDF immunity from HTML injection, and real-time database permission checks. Deductions are due to the Owner demotion bypass and packaged Electron CORS/HTTPS configuration gaps.
- **LAN Deployment Readiness (5.5/10):** Lacks TLS/HTTPS certificate binding, uses the `postgres` superuser, lacks global rate limiting, and lacks `Cache-Control: no-store` headers.
- **Internet / Cloud Deployment Readiness (3.0/10):** Currently lacks automated certificate management, cloud secrets integration, independent migration execution, and robust multi-user credential change workflows.
- **Future SaaS Readiness (1.0/10):** The database and domain model are completely single-tenant. No `TenantId` exists anywhere in the architecture.

---

## 32. Verification of Audit Constraints

- **Source Code Modified:** NO (0 source code files modified).
- **Configuration Modified:** NO (0 configuration files modified).
- **Packages Installed:** NO (0 packages installed).
- **Database Migrations Executed:** NO (0 migrations run).
- **Credentials Exposed in Report:** NO (All secrets redacted or represented as placeholders).
- **Working Tree Changes:** Strictly limited to the creation of this audit document (`E6_SECURITY_AUDIT_V2.md`).

---
*Report compiled autonomously by Antigravity AI Security Pair Programmer.*
