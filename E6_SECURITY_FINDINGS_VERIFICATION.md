# E6 CAR SPA — SECURITY FINDINGS VERIFICATION AUDIT
**Document Version:** 1.0.0  
**Verification Date:** September 12, 2026  
**Auditor:** Antigravity AI Security Pair Programmer  
**Target Codebase:** E6 Car Spa Management System (`E6_Car_spa_new`)  
**Audit Scope:** Deep verification of findings from `E6_SECURITY_AUDIT_V2.md` against active source code  
**Mode:** READ-ONLY Code & Architecture Verification (Zero Source/Config Modifications)  

---

## Executive Summary & Key Corrections

This verification audit independently examined the current codebase to validate every P1 and P2 finding reported in `E6_SECURITY_AUDIT_V2.md`. By tracing active execution paths across the ASP.NET Core backend, Electron main/preload/renderer processes, and PostgreSQL domain models, several previous assumptions were corrected:

1. **Owner Demotion Bypass (P1-1 Reclassified to NOT EXPLOITABLE / DESIGN DECISION):**  
   The domain service `UserService.cs` explicitly prohibits changing an Owner's role (`ValidationException("Owner role cannot be changed")`), forbids non-Owners from modifying Owner accounts, and prevents deactivating Owners. Because an Owner account cannot be demoted through any application API, the scenario of a demoted user retaining an active Owner JWT cannot be produced via the software.
2. **RequireHttpsMetadata Misconception (P1-3 Reclassified to FALSE POSITIVE):**  
   In ASP.NET Core's `Microsoft.AspNetCore.Authentication.JwtBearer`, `RequireHttpsMetadata` controls whether HTTPS is enforced when retrieving OpenID Connect discovery documents from an external `Authority` or `MetadataAddress`. Because E6 uses a local symmetric `IssuerSigningKey` and does not configure an `Authority`, `RequireHttpsMetadata = true` is a complete no-op during token validation and does **not** fail over HTTP.
3. **Electron CSP Discovery (P2-1 Reclassified to PARTIALLY CONFIRMED):**  
   Previous audits inspected an orphan root file `apps/desktop/index.html`. The actual active template compiled by Vite (`root: 'renderer'`) is `apps/desktop/renderer/index.html`, which **already contains an active CSP meta tag**. The remaining issue is hardening: removing `'unsafe-inline'` from `script-src`.
4. **Packaged Electron Production CORS (P1-2 CONFIRMED):**  
   Verified that packaged Electron loads from `file:///` (`Origin: null`), which is rejected by the production CORS policy (`AllowedOrigins: ["http://localhost:5173"]`).
5. **Dead Print IPC Handlers (P2-3 CONFIRMED DEAD CODE):**  
   Verified across the entire repository that `app:printJobCard` and `app:printInvoice` are never called by any React component.

---

## 1. Deep Dive: Owner Demotion & JWT Privilege Bypass

### Lifecycle Trace
```
Database (User.Role) ──► Login (AuthService) ──► JWT Issuance (JwtTokenService) ──► Claims
                                                                                       │
PermissionAuthorizationHandler ◄───────────────────────────────────────────────────────┘
  ├── 1. Query db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId)
  ├── 2. if (user == null || !user.IsActive) return; // Immediate Deny
  └── 3. if (user.Role == Owner || context.User.IsInRole("Owner") || claim.isOwner == "true")
```

### Verification Questions & Findings

#### A. Can an Owner actually be demoted?
**NO.** In [`backend/api/CarSpaManagement.Api/Application/Services/UserService.cs`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Application/Services/UserService.cs) lines 185–195:
```csharp
if (isOwner && !string.IsNullOrWhiteSpace(request.Role))
{
    if (user.Role == UserRole.Owner)
    {
        // Owner cannot change their role away from Owner
        if (!request.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase))
        {
            throw new ValidationException("Owner role cannot be changed.");
        }
    }
```
The API explicitly rejects any attempt to change an Owner's role to Manager or Staff.

#### B. Can another user demote an Owner?
**NO.** Line 145 of `UserService.cs` enforces:
```csharp
if (user.Role == UserRole.Owner && !isOwner)
{
    throw new ForbiddenException("Only an Owner can modify an Owner account.");
}
```
Even if a non-Owner possesses the `users.edit` permission, modifying an Owner account returns HTTP 403 Forbidden.

#### C. Can Owner privileges be revoked?
**NO.** Owner privileges are not stored in `UserPermissions`. An active Owner automatically bypasses all permission requirements.

#### D. Can an Owner's role change while an old JWT remains valid?
**Through the application: NO.** There is no endpoint or workflow that modifies an Owner's role.  
**Through direct database tampering: YES.** If a database administrator directly executes `UPDATE "Users" SET "Role" = 3 WHERE "Username" = 'owner'`, the user's role in the database becomes `Staff`.

#### E. Does the old JWT retain `role=Owner` and `isOwner=true`?
**YES.** JWT tokens are stateless signatures. The claims emitted at login remain static until the token expires (up to 24 hours).

#### F. Does `PermissionAuthorizationHandler` trust those stale claims?
**YES.** Lines 39–42 of [`PermissionAuthorizationHandler.cs`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Infrastructure/Authorization/PermissionAuthorizationHandler.cs):
```csharp
if (user.Role == UserRole.Owner ||
    context.User.IsInRole("Owner") ||
    context.User.HasClaim(c => c.Type == "isOwner" && c.Value.Equals("true", StringComparison.OrdinalIgnoreCase)))
{
    context.Succeed(requirement);
    return;
}
```
Because of the logical OR (`||`), if `context.User.IsInRole("Owner")` is true from the JWT claim, authorization succeeds even if `user.Role` in the database is no longer `UserRole.Owner`.

#### G. If the database says Staff but the JWT says Owner, what happens?
The request **succeeds**. The handler grants full unrestricted Owner bypass based on the token claim.

#### H. Does deactivation behave differently from demotion?
**YES.** Lines 33–36 of `PermissionAuthorizationHandler.cs`:
```csharp
var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
if (user == null || !user.IsActive)
{
    return; // Inactive or deleted user denied immediately
}
```
If an account is deactivated (`IsActive = false`) or deleted in the database, the handler **terminates immediately**. The token claims are never evaluated, and access is instantly revoked.

#### I. Is there any intentional business rule requiring Owner JWT bypass?
Yes. The Owner role is modeled as an immutable singleton administrative identity representing the business proprietor.

### Exploitability Verdict
- **Attack Path:** Cannot be executed via any API call or client workflow. It requires direct SQL database access (`UPDATE "Users"`).
- **Classification:** **NOT EXPLOITABLE / DESIGN DECISION (DEFENSE-IN-DEPTH DEFECT)**.
- **Remediation:** For defense-in-depth, line 39 should check only `user.Role == UserRole.Owner`, removing `context.User.IsInRole("Owner")` and `context.User.HasClaim(...)`.

---

## 2. Deep Dive: Production Electron CORS

### Current Production Architecture
1. **Window Loading ([`apps/desktop/electron/main.ts:31-36`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/electron/main.ts#L31-L36)):**
   ```ts
   if (isDev) {
     mainWindow.loadURL('http://localhost:5173');
   } else {
     mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
   }
   ```
2. **Origin Header Sent:** When Chromium loads a document from `file:///` and issues `fetch('http://localhost:5298/api/...')` with custom headers (`Authorization: Bearer ...`, `Content-Type: application/json`), Chromium treats this as a cross-origin request and emits:
   ```http
   Origin: null
   ```
3. **Backend CORS Policy ([`Program.cs:282-289`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Program.cs#L282-L289) & [`appsettings.json:28-30`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/appsettings.json#L28-L30)):**
   ```csharp
   options.AddPolicy("Production", policy => {
       var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
       policy.WithOrigins(origins).AllowAnyMethod().AllowAnyHeader().WithExposedHeaders("X-Pagination");
   });
   ```
   `appsettings.json` contains:
   ```json
   "Cors": {
     "AllowedOrigins": [ "http://localhost:5173" ]
   }
   ```
4. **Failure Mechanism:** The incoming preflight `OPTIONS` request contains `Origin: null`. Because `"null"` is absent from `AllowedOrigins`, ASP.NET Core `CorsMiddleware` omits the `Access-Control-Allow-Origin` header in its response. Chromium blocks the request, resulting in `TypeError: Failed to fetch` in the renderer.

### Solution Evaluation Matrix

| Solution | Implementation | Security Implications | Viability |
| :--- | :--- | :--- | :--- |
| **1. Allow `Origin: null`** | Add `"null"` to `Cors:AllowedOrigins` | Permitting `null` in a general web app allows sandboxed iframes or data URIs from external websites to make authenticated requests. On localhost-only desktop, risk is limited, but violates security hygiene. | Sub-optimal |
| **2. Custom App Scheme** | Register privileged scheme `app://` (`protocol.registerSchemesAsPrivileged`) and load `app://carspa/index.html` | **Highest Security.** The browser emits `Origin: app://carspa`. External websites cannot forge this origin. ASP.NET Core explicitly whitelists `"app://carspa"`. | **Recommended** |
| **3. Loopback Bypass in Backend** | Custom CORS policy in ASP.NET Core permitting loopback connections (`IPAddress.IsLoopback(context.Connection.RemoteIpAddress)`) | Clean, but requires custom middleware logic in C#. | Good Alternative |
| **4. IPC API Proxy** | Route all API calls through Electron main process via IPC | Eliminates CORS entirely (Node.js does not enforce CORS). Requires rewriting `api.ts`. | Unnecessarily complex |

- **Classification:** **CONFIRMED ARCHITECTURAL DEFECT (RELEASE BLOCKER)**.
- **Recommended Action:** Implement Solution 2 (Custom protocol scheme `app://carspa`) or Solution 3.

---

## 3. Deep Dive: HTTPS & `RequireHttpsMetadata`

### Analysis of Microsoft JwtBearer Internals
The previous audit reported that `options.RequireHttpsMetadata = !builder.Environment.IsDevelopment()` breaks JWT authentication over HTTP in production.

**Code Verification ([`Program.cs:146-161`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Program.cs#L146-L161)):**
```csharp
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
        ValidateIssuer = true,
        ValidIssuer = jwtOptions.Issuer,
        ValidateAudience = true,
        ValidAudiences = new[] { jwtOptions.Audience, "E6CarSpaMobile", "E6CarSpa" },
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});
```

### Technical Verification of ASP.NET Core Behavior
1. **What `RequireHttpsMetadata` Actually Does:**  
   In .NET `JwtBearerHandler`, `RequireHttpsMetadata` controls whether HTTPS is enforced **when fetching OpenID Connect configuration documents** from `options.Authority` or `options.MetadataAddress` (e.g., `https://identity.example.com/.well-known/openid-configuration`).
2. **Authority / MetadataAddress in E6:**  
   E6 does **not** specify `options.Authority` or `options.MetadataAddress`. The signing key is a locally configured `SymmetricSecurityKey`.
3. **Incoming Request Validation:**  
   `JwtBearerHandler` validates the `Authorization: Bearer <token>` header locally by verifying HMAC-SHA256 signature, expiry, issuer, and audience. It **never** inspects `HttpContext.Request.IsHttps` or `RequireHttpsMetadata` during token decryption and validation.
4. **Behavior of `UseHttpsRedirection()`:**  
   In `Program.cs` line 367, `app.UseHttpsRedirection()` executes. If Kestrel is listening only on HTTP port 5298 and no HTTPS port is configured via environment variables, `HttpsRedirectionMiddleware` logs a warning (`"Failed to determine the https port for redirect."`) and allows the request to proceed over HTTP without failure.
5. **Verdict on Original P1-3:**  
   - Does JWT authentication fail because of `RequireHttpsMetadata`? **NO.**
   - Does Production mode start over HTTP? **YES.**
   - **Classification:** **FALSE POSITIVE / ARCHITECTURAL MISCONCEPTION**.

---

## 4. Deep Dive: Electron Content Security Policy (CSP)

### Discovery: The Dual `index.html` Files
The repository contains two `index.html` files:
1. `apps/desktop/index.html` (Orphan root file, 13 lines, no CSP).
2. `apps/desktop/renderer/index.html` (**Active Vite root template**, 16 lines).

In [`apps/desktop/vite.config.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/vite.config.ts) line 9:
```ts
export default defineConfig({
  root: 'renderer',
  publicDir: 'public',
  ...
```
Vite builds exclusively from `apps/desktop/renderer/index.html`!

### Inspection of Active CSP ([`apps/desktop/renderer/index.html:5`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/index.html#L5))
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: http://localhost:5298 https://localhost:7012 blob:; connect-src 'self' http://localhost:5298 https://localhost:7012 ws://localhost:5173 http://localhost:5173;" />
```

### Analysis
- **Is CSP missing?** **NO.** The claim in `security.md` and `E6_SECURITY_AUDIT_V2.md` that CSP is missing was caused by inspecting the orphan file `apps/desktop/index.html`.
- **Hardening Issue:** The active CSP includes `'unsafe-inline'` in `script-src`. Vite bundles all application code into external chunks (`/src/main.tsx`), meaning inline scripts are not required in production.
- **Proposed Hardened CSP (No `'unsafe-inline'` for scripts):**
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: http://localhost:5298 https://localhost:7012 blob:; connect-src 'self' http://localhost:5298 https://localhost:7012 ws://localhost:5173 http://localhost:5173;" />
  ```
- **Classification:** **PARTIALLY CONFIRMED (POLICY PRESENT, HARDENING REQUIRED)**.

---

## 5. Deep Dive: Electron IPC Security

### Complete IPC Handlers Audit

| Channel | File & Lines | Implementation | Used by Renderer? | Security Verdict |
| :--- | :--- | :--- | :---: | :--- |
| `app:getVersion` | `main.ts:49` | `app.getVersion()` | No | Safe |
| `app:getPath` | `main.ts:50` | `app.getPath(name as any)` | **No** | Unused. Throws unhandled error on invalid name. |
| `app:printJobCard` | `main.ts:51-64` | Loads unvalidated HTML into hidden window | **No (Dead Code)** | Unused. Attack surface to be removed. |
| `app:printInvoice` | `main.ts:66-79` | Loads unvalidated HTML into hidden window | **No (Dead Code)** | Unused. Attack surface to be removed. |
| `app:saveInvoicePdf`| `main.ts:81-127` | Native save dialog + `printToPDF` | **Yes** | Safe (sanitizes filenames). |
| `auth:getToken` | `main.ts:133-146`| Reads DPAPI encrypted `session.enc` | **Yes** | Safe |
| `auth:setToken` | `main.ts:148-166`| Writes DPAPI encrypted `session.enc` | **Yes** | Safe |

### Dead Code Confirmation
A repository-wide grep confirms that `app:printJobCard` and `app:printInvoice` are **never called** in any `.tsx`, `.ts`, or component file. The desktop application handles printing directly in the browser window using `window.print()` ([`InvoiceDetailPage.tsx:468`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/invoices/InvoiceDetailPage.tsx#L468)) and PDF saving via `app:saveInvoicePdf`.

### Paths Needed for `app:getPath`
The application only ever accesses:
1. `'documents'` (for default PDF export destination).
2. `'userData'` (for encrypted token storage `session.enc`).
Because the renderer never invokes `app:getPath`, it can either be removed or restricted to an allowlist:
```ts
const ALLOWED_PATHS = new Set(['documents', 'userData']);
ipcMain.handle('app:getPath', (_event, name: string) => {
    if (!ALLOWED_PATHS.has(name)) throw new Error('Unauthorized path request');
    return app.getPath(name as any);
});
```

---

## 6. Deep Dive: Navigation & Popup Security

### Active Code Inspection
In [`apps/desktop/renderer/src/features/invoices/ShareInvoiceModal.tsx`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/invoices/ShareInvoiceModal.tsx) line 150:
```ts
const handleOpen = () => {
    if (activeUrl) {
        window.open(activeUrl, '_blank', 'noopener,noreferrer');
    }
};
```
When `window.open` is called from the renderer and no `setWindowOpenHandler` is defined in `main.ts`:
- **Default Electron Behavior:** Electron spawns an unmanaged new `BrowserWindow` within the Electron process rather than launching the user's default system browser (Chrome/Edge).
- **Security Implication:** If `activeUrl` were manipulated or pointed to an untrusted web page, the untrusted page would render inside an Electron window context.

### Recommended Fix in `main.ts`
```ts
import { shell } from 'electron';

mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url);
    }
    return { action: 'deny' };
});

mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.origin !== 'http://localhost:5173' && parsed.protocol !== 'file:') {
        event.preventDefault();
    }
});
```
- **Classification:** **CONFIRMED (HARDENING GAP)**.

---

## 7. Deep Dive: User Password Management

### Code & Policy Trace
- **Password Updates ([`UsersController.cs:78`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Controllers/UsersController.cs#L78) & [`UserService.cs:206-216`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Application/Services/UserService.cs#L206-L216)):**
  - Requires `[RequirePermission("users.edit")]`.
  - Non-Owners cannot modify Owner accounts: `if (user.Role == UserRole.Owner && !isOwner) throw new ForbiddenException(...)`.
  - An administrator (Owner or Manager with `users.edit`) can set a new password for any non-Owner account.
- **Is this a vulnerability?**
  **NO.** This is an **intentional administrative reset workflow**. In car spa POS environments, floor staff frequently forget credentials. Requiring the forgotten old password on an administrative employee reset screen would render the administrative reset function unusable.
- **Missing Feature vs Vulnerability:**
  What is currently absent is a dedicated **self-service password change endpoint** (`POST /api/auth/change-password`) where an individual staff member changes their own password by providing their current password.
- **Classification:** **DESIGN DECISION (LEGITIMATE ADMINISTRATIVE FUNCTIONALITY)**.

---

## 8. Deep Dive: Account Lockout & DoS Interaction

### Operational Mechanics
- **Account Lockout ([`AccountLockoutService.cs:8-10`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Application/Services/AccountLockoutService.cs#L8-L10)):**
  - Triggered after 5 failed login attempts within a 15-minute window.
  - Lockout duration: 5 minutes (300 seconds).
  - Tracked in-memory per normalized username.
- **IP Rate Limiter ([`Program.cs:182-195`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Program.cs#L182-L195)):**
  - 5 requests per 60 seconds per client IP address.

### Deployment Scenarios

| Deployment | DoS Feasibility | Impact Analysis |
| :--- | :---: | :--- |
| **A. Localhost Desktop** | **Infeasible** | Only the physical terminal user interacts with the app. An attacker cannot remotely lock out accounts. |
| **B. Office LAN** | **Low-Medium** | A device on the LAN can attempt 5 failed logins for `owner` and lock the account for 5 minutes. The attacker's IP is also rate-limited for 60 seconds. |
| **C. Internet / Cloud** | **High** | Bots cycling through external IPs can lock out known usernames indefinitely. |
| **D. SaaS Multi-Tenant** | **High** | A malicious tenant knowing a competitor's username could lock them out if usernames are globally shared. |

- **Classification:** **DEPLOYMENT-DEPENDENT**. Acceptable for current desktop mode; requires progressive backoff and CAPTCHA before cloud deployment.

---

## 9. Complete Permission Matrix

The application defines 63 distinct permissions across 12 functional modules in [`PermissionSeeder.cs`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Infrastructure/Database/PermissionSeeder.cs).

### Role Entitlements

| Functional Module | Owner | Manager (Assigned by Owner) | Staff (Assigned by Owner) |
| :--- | :---: | :---: | :---: |
| **Dashboard** (`dashboard.view`) | Full | Configurable | Configurable |
| **Customers** (`customers.view/create/edit/delete`) | Full | Full (typical) | View / Create / Edit |
| **Vehicles** (`vehicles.view/create/edit/delete`) | Full | Full (typical) | View / Create / Edit |
| **Job Cards** (`jobcards.view/create/edit/delete/print`) | Full | Full (typical) | View / Create / Edit / Print |
| **Catalogue** (`catalogue.view/create/edit/delete`) | Full | View / Edit | View only |
| **Invoices** (`invoices.view/edit_draft/generate/cancel/print`) | Full | View / Edit / Generate / Print | View / Print |
| **Discounts & Price Overrides** (`invoices.discount`, `price_override`) | Full | Discretionary | Denied (default) |
| **Payments** (`payments.view/record/edit/void`) | Full | View / Record | View / Record |
| **Showrooms** (`showroom.view/manage/billing/payment/attendance`) | Full | Full (typical) | View / Attendance |
| **Staff & Advances** (`staff.*`, `staff_advances.*`) | Full | Advances View/Create | Denied (default) |
| **Reports** (`reports.view/sales/gst/productivity/export`) | Full | Discretionary | Denied |
| **Settings** (`settings.view/edit/business`) | Full | View only (typical) | Denied |
| **User Administration** (`users.view/create/edit/deactivate`) | Full | Denied (Owner-only for roles/perms) | Denied |
| **Audit Trail** (`audit.view`) | Full | Discretionary | Denied |

- **Business Alignment:** Fully consistent with professional car detailing workshop operations.

---

## 10. Financial Operations & Immutability

### Verification of Controls in `InvoiceService.cs`
- **Draft Creation:** Requires `invoices.edit_draft`.
- **Finalized Invoice Immutability ([`InvoiceService.cs:228-230`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Application/Services/InvoiceService.cs#L228-L230)):**
  ```csharp
  if (invoice.Status != InvoiceStatus.Draft || !string.IsNullOrEmpty(invoice.InvoiceNumber))
      throw new InvalidOperationException("Finalized invoices cannot be modified.");
  ```
  Once an invoice is generated, discounts, taxable amounts, GST, and service line items can **never** be edited.
- **Granular Discount Authorization:** Even if a user has `invoices.edit_draft`, modifying an invoice with a discount > 0 explicitly verifies `Permission:invoices.discount` in `InvoicesController.cs` line 89.
- **Payment Immutability:** Payments are append-only. There is **no endpoint** to edit or delete an invoice payment record.
- **Negative Values:** Line 570 rejects `request.Amount <= 0`. Overpayments exceeding balance are rejected (line 586).
- **Classification:** **CONFIRMED SECURE**.

---

## 11. Vehicle Ownership Transfer Lifecycle

### Verification of `VehicleService.TransferOwnershipAsync`
1. **Permission:** `[RequirePermission("vehicles.edit")]`.
2. **Entity Existence:** Validates vehicle exists and is not soft-deleted (`!v.IsDeleted`). Validates target customer exists and is not soft-deleted.
3. **Atomicity:** Wrapped in a database transaction (`BeginTransactionAsync`).
4. **Historical Record Preservation:**  
   `JobCard` entities store both `CustomerId` and `VehicleId`. Transferring a vehicle updates `Vehicle.CustomerId`, but **historical job cards and invoices retain their original `CustomerId`**. Historical invoices and job cards remain permanently linked to the customer who owned the vehicle at the time of service.
5. **Audit Trail:** Records previous and new customer IDs and names in the audit log.
6. **Classification:** **CONFIRMED SECURE**.

---

## 12. Public Endpoints Verification

| Endpoint | Controller | Auth | Rate Limit | Data Exposed | Security Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/public/business-profile` | `PublicBusinessProfileController` | Anonymous | 30 req/min | `BusinessName`, `LogoPath`, `UpdatedAt` | **Safe.** Strictly public branding. Phone, email, address, and GSTIN excluded. |
| `GET /api/public/invoices/{token}` | `PublicInvoicesController` | Anonymous | 30 req/min | Public invoice DTO | **Safe.** Requires 64-hex unguessable token (SHA-256 hashed in DB). Draft/cancelled invoices return 404. |
| `GET /api/auth/status` | `AuthController` | Anonymous | None | `{ "initialized": bool }` | **Safe.** Simple boolean indicating if an Owner exists. |
| `POST /api/auth/bootstrap` | `AuthController` | Anonymous | 3 req/min | Initial Owner User DTO | **Safe.** Fails with 409 Conflict if users exist. |
| `POST /api/auth/login` | `AuthController` | Anonymous | 5 req/min | JWT token + User DTO | **Safe.** Rate limited + account lockout. |
| `GET /api/health` | `Program.cs` | Anonymous | None | "Healthy" | **Safe.** Standard health check. |

---

## 13. Database Privilege Review

- **Connection String:** Configured with `Username=postgres` (PostgreSQL superuser).
- **Exposure:** Bound to `Host=localhost;Port=5432`.
- **Application Requirement:** The application uses standard Entity Framework Core operations. It does **not** require superuser privileges.
- **Severity Classification:**
  - **Localhost:** **P3 (Low)**. On a dedicated single-user workstation, the OS user already has root/administrative access to the local disk.
  - **LAN:** **P2 (Medium)**. If port 5432 is reachable by other LAN devices, using `postgres` allows database-level privilege abuse if credentials are intercepted.
  - **Cloud / SaaS:** **P1 (High)**. Mandatory to use a least-privilege role (`e6_app_user`) granted only DML privileges.

---

## 14. Final Re-Classification of Findings

| Finding Reference | Original Severity | Verified Classification | Summary Rationale |
| :--- | :---: | :---: | :--- |
| **P1-1: Owner Demotion Bypass** | P1 | **NOT EXPLOITABLE / DESIGN DECISION** | `UserService.cs` forbids demoting Owners. The scenario cannot be reached via the API. Minor defense-in-depth cleanup recommended. |
| **P1-2: Production Electron CORS** | P1 | **CONFIRMED** | Packaged Electron emits `Origin: null` from `file:///`, which production CORS rejects. Release blocker. |
| **P1-3: RequireHttpsMetadata** | P1 | **FALSE POSITIVE** | In .NET JwtBearer, `RequireHttpsMetadata` applies only to external OIDC discovery, not local symmetric keys. Auth works fine over HTTP. |
| **P2-1: Missing Electron CSP** | P2 | **PARTIALLY CONFIRMED** | CSP is already present in `renderer/index.html`. Only requires hardening to remove `'unsafe-inline'`. |
| **P2-2: Window Navigation / Popups** | P2 | **CONFIRMED** | `ShareInvoiceModal.tsx` calls `window.open`, spawning unmanaged Electron windows without `setWindowOpenHandler`. |
| **P2-3: Dead Print IPC Handlers** | P2 | **CONFIRMED (DEAD CODE)** | `app:printJobCard` and `app:printInvoice` accept raw HTML, but are completely unused by the renderer. Dead attack surface. |
| **P2-4: Unvalidated `app:getPath`** | P2 | **CONFIRMED (DEAD CODE)** | Unvalidated `name as any`, but never invoked by the renderer. |
| **P2-5: Database Superuser** | P2 | **DEPLOYMENT-DEPENDENT** | Connecting as `postgres` is acceptable on localhost desktop, but should be replaced before LAN/Cloud. |
| **P2-6: Password Reset Verification** | P2 | **DESIGN DECISION** | Administrative password reset by design does not require old password. Self-service password change is a missing feature. |
| **P2-7: Account Lockout DoS** | P2 | **DEPLOYMENT-DEPENDENT** | Acceptable on localhost; requires progressive delays before multi-user LAN or cloud exposure. |
| **P2-8: Missing Cache-Control** | P2 | **DEPLOYMENT-DEPENDENT** | Low risk on localhost; should be added for LAN/Cloud proxies. |

---

## 15. Actionable Remediation Roadmap

### Group 1: MUST FIX BEFORE CURRENT PRODUCTION (Desktop Release)
1. **Fix Production CORS for Electron:** Configure custom protocol scheme `app://carspa` or allow `"null"` for packaged desktop execution.
2. **Restrict Electron Popups & Navigation:** Add `mainWindow.webContents.setWindowOpenHandler` in `main.ts` to delegate external URLs to `shell.openExternal`.
3. **Remove Dead Print IPC Handlers:** Remove `app:printJobCard` and `app:printInvoice` from `main.ts` and `preload.ts`.
4. **Harden Active Electron CSP:** Remove `'unsafe-inline'` from `script-src` in `apps/desktop/renderer/index.html` and delete orphan root `apps/desktop/index.html`.
5. **Harden `PermissionAuthorizationHandler.cs` (Defense-in-Depth):** Check only `user.Role == UserRole.Owner` from the database.

### Group 2: FIX BEFORE LAN DEPLOYMENT (Multiple Devices / Tablets)
1. **Dedicated Database Role:** Create and use `e6_app_user` with restricted DML privileges instead of `postgres`.
2. **Configure TLS / HTTPS:** Bind Kestrel to an HTTPS port with trusted local certificates if tablets access the API over Wi-Fi.
3. **Append Cache-Control Headers:** Add `Cache-Control: no-store` on authenticated API routes.
4. **Global API Rate Limiting:** Implement a baseline rate limiter (e.g., 120 req/min/IP) for general endpoints.

### Group 3: FIX BEFORE CLOUD / INTERNET DEPLOYMENT
1. **Reverse Proxy Architecture:** Host Kestrel behind Nginx or Caddy with automated Let's Encrypt TLS.
2. **Account Lockout Hardening:** Implement progressive backoff delays to mitigate lockout DoS.
3. **Dedicated Self-Service Password Change:** Add `POST /api/auth/change-password` requiring current password verification.
4. **External Secrets Management:** Inject `JWT_KEY` and `WHATSAPP_ENCRYPTION_KEY` from environment variables / secrets manager.

### Group 4: FIX BEFORE SAAS / MULTI-TENANT DEPLOYMENT
1. **Tenant ID Schema Migration:** Add `TenantId` column across all domain entities.
2. **Global EF Core Query Filters:** Implement automatic tenant scoping (`HasQueryFilter`).
3. **Tenant Resolution Middleware:** Resolve tenant from subdomain or JWT header on every request.

---

## 16. Verification of Audit Constraints

- **Source Code Modified:** **NO** (0 source files modified).
- **Configuration Modified:** **NO** (0 configuration files modified).
- **Database Modified:** **NO** (0 migrations or data changes executed).
- **Packages Installed:** **NO** (0 packages installed).
- **Credentials Exposed:** **NO** (All credentials redacted or represented as placeholders).

---
*Report compiled autonomously by Antigravity AI Security Pair Programmer.*
