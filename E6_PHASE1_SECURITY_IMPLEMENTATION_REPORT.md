# E6 Car Spa — Phase 1 Production Security Hardening Report

**Date:** September 12, 2026  
**Status:** Successfully Implemented & Verified  
**Target Environment:** Windows Electron Desktop Client & Local ASP.NET Core API  
**Authoritative Audits:** `E6_SECURITY_AUDIT_V2.md`, `E6_SECURITY_FINDINGS_VERIFICATION.md`  

---

## Executive Summary

Phase 1 Desktop Production Security Hardening has been completely implemented and rigorously verified across both development and packaged production environments. All changes strictly adhere to the defined scope rules:
- **No database schema modifications**
- **No database data alterations**
- **No PostgreSQL credential alterations**
- **No HTTPS/TLS or LAN networking alterations**
- **No SaaS/multi-tenancy changes**
- **No business logic modifications**
- **Zero regressions on mobile Android traffic** (642/642 tests passing)
- **Packaged Windows Electron executable verified against ASP.NET Core API running in `Production` mode**

---

## 1. Test & Build Results: Baseline vs After Changes

| Suite / Artifact | Baseline (Phase 0) | After Changes (Phase 8 & 9) | Status |
| :--- | :--- | :--- | :--- |
| **Desktop Vitest Suite** (`@carspa/desktop`) | 22 files / 228 tests passed (0 failed) | 22 files / 228 tests passed (0 failed) | **PASS** |
| **Backend .NET Test Suite** (`CarSpaManagement.Api.Tests`) | 363 passed (0 failed) | 365 passed (0 failed, +2 new pipeline tests) | **PASS** |
| **Android Flutter Test Suite** (`apps/android`) | 642 passed (0 failed) | 642 passed (0 failed) | **PASS** |
| **Desktop Production Build** (`pnpm build`) | Succeeded (`dist-renderer`, `dist-electron`) | Succeeded in 15.46s | **PASS** |
| **Windows Packaging** (`electron-builder`) | Succeeded (`win-unpacked`, `Setup.exe`) | Succeeded (`Car Spa Management.exe`, `Setup 1.0.0.exe`) | **PASS** |
| **Packaged Runtime Verification** (Production Mode) | Not runnable without CORS errors | **Fully functional against Production API (HTTP 200/204)** | **PASS** |

---

## 2. Exact Files Modified

1. [`apps/desktop/electron/main.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/electron/main.ts)
2. [`apps/desktop/electron/preload.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/electron/preload.ts)
3. [`apps/desktop/renderer/index.html`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/index.html)
4. [`apps/desktop/renderer/src/types/electron.d.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/types/electron.d.ts)
5. [`apps/desktop/renderer/src/test/setup.ts`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/test/setup.ts)
6. [`backend/api/CarSpaManagement.Api/appsettings.json`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/appsettings.json)
7. [`backend/api/CarSpaManagement.Api/Infrastructure/Authorization/PermissionAuthorizationHandler.cs`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Infrastructure/Authorization/PermissionAuthorizationHandler.cs)
8. [`backend/tests/CarSpaManagement.Api.Tests/StaleJwtOwnerDefenseTests.cs`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/tests/CarSpaManagement.Api.Tests/StaleJwtOwnerDefenseTests.cs) (New automated test)

---

## 3. Production CORS: Root Cause & Solution

### Root Cause
In production, Electron packaged builds previously loaded renderer assets via `file:///` (`mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'))`). In Chromium, requests from `file://` contexts emit `Origin: null` on CORS-enabled HTTP fetch requests. Because the ASP.NET Core production CORS policy only allowed `http://localhost:5173`, all mutating and credentialed API calls from the packaged desktop renderer were rejected during CORS preflight (`OPTIONS`), breaking the desktop application in production.

### Chosen Solution
1. **Registered Custom Privileged Scheme:** Before `app.whenReady()`, registered `app` as a standard, secure, fetch-enabled, CORS-enabled protocol scheme:
   ```typescript
   protocol.registerSchemesAsPrivileged([
     {
       scheme: 'app',
       privileges: {
         standard: true,
         secure: true,
         supportFetchAPI: true,
         corsEnabled: true,
         stream: true,
       },
     },
   ]);
   ```
2. **Controlled Protocol Handler with Traversal Defense & SPA Fallback:**
   Inside `app.whenReady()`, implemented `protocol.handle('app', ...)` resolving strictly to `renderer/dist-renderer`:
   - Validates `url.host === 'carspa'`
   - Sanitizes path traversals (`path.normalize` and escaping guards)
   - Checks file existence: returns static asset or falls back to `index.html` for client-side routing
   - Uses `net.fetch(pathToFileURL(filePath).toString())` for streaming and automatic MIME resolution
3. **Loaded Controlled Production Origin:**
   Changed production loading in `main.ts` to `mainWindow.loadURL('app://carspa/index.html')`.
4. **Backend Production CORS Whitelist:**
   Added `"app://carspa"` to `Cors:AllowedOrigins` in `backend/api/CarSpaManagement.Api/appsettings.json`:
   ```json
   "Cors": {
     "AllowedOrigins": [
       "http://localhost:5173",
       "app://carspa"
     ]
   }
   ```

### Why This is Safer Than Allowing `Origin: null`
- Allowing `Origin: null` in CORS exposes the local API to any web page, sandboxed iframe, or local HTML file opened by the user, because sandboxed iframes also emit `Origin: null`.
- `app://carspa` creates a strictly controlled, isolated origin that can only originate from the local packaged Electron binary. Arbitrary websites cannot impersonate `app://carspa` in a standard browser.
- No wildcard (`*`) or `AllowAnyOrigin` is used in production.

---

## 4. Electron Navigation & Popup Hardening

### Changes Made in `apps/desktop/electron/main.ts`
1. **Blocked Unmanaged Popups & Handled External Links:**
   Registered `setWindowOpenHandler`:
   ```typescript
   mainWindow.webContents.setWindowOpenHandler((details) => {
     try {
       const parsed = new URL(details.url);
       if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
         shell.openExternal(details.url);
       }
     } catch (err) {
       console.error('Invalid URL in window.open:', err);
     }
     return { action: 'deny' };
   });
   ```
   - Intercepts `window.open` calls (such as `ShareInvoiceModal.tsx: window.open(activeUrl, '_blank')`).
   - Delegates public invoice URLs to the user's default system web browser.
   - Returns `{ action: 'deny' }` so that arbitrary child `BrowserWindow` instances cannot spawn inside Electron.
2. **Main Window Navigation Guard:**
   Registered `will-navigate`:
   - In development: permits navigation to `http://localhost:5173` (Vite dev server & HMR).
   - In production: permits navigation to `app://carspa` (application internal routing).
   - Any navigation to external HTTP/HTTPS URLs within the Electron window is prevented (`event.preventDefault()`) and redirected to `shell.openExternal(navigationUrl)`.

---

## 5. Dead Print IPC Handlers Removed

### Verification & Removal
- Grep across the entire codebase confirmed that `app:printJobCard` and `app:printInvoice` were never invoked by any renderer component.
- The UI handles printing via standard `window.print()` and native PDF generation via `electronAPI.saveInvoicePdf` (`app:saveInvoicePdf`).
- Removed `ipcMain.handle('app:printJobCard', ...)` and `ipcMain.handle('app:printInvoice', ...)` from `apps/desktop/electron/main.ts`.
- Removed `printJobCard` and `printInvoice` from `apps/desktop/electron/preload.ts`, `renderer/src/types/electron.d.ts`, and `renderer/src/test/setup.ts`.
- Preserved `app:saveInvoicePdf` intact.

---

## 6. `app:getPath` IPC Channel Decision

### Verification & Removal
- Search across the renderer proved that no React component or frontend hook calls `window.electronAPI.getPath`.
- Exposing `app.getPath(name as any)` with an unvalidated argument represented an unnecessary attack surface allowing filesystem structure enumeration.
- Removed `ipcMain.handle('app:getPath', ...)` from `main.ts` and pruned `getPath` from `preload.ts`, `electron.d.ts`, and `setup.ts`.
- Internal main process calls to `app.getPath('documents')` and `app.getPath('userData')` (used for invoice PDF saving and safeStorage encryption) were preserved.

---

## 7. CSP Hardening

### Verification of Template
- Active template: `apps/desktop/renderer/index.html` (configured via `root: 'renderer'` in `vite.config.ts`).
- Checked root `apps/desktop/index.html`: referenced by `apps/desktop/tailwind.config.js` (`content: ['./index.html', ...]`). Left untouched per user directive to prevent build-tool disruption.

### Hardening in `apps/desktop/renderer/index.html`
- **BEFORE:**
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: http://localhost:5298 https://localhost:7012 blob:; connect-src 'self' http://localhost:5298 https://localhost:7012 ws://localhost:5173 http://localhost:5173;" />
  ```
- **AFTER:**
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: http://localhost:5298 https://localhost:7012 blob:; connect-src 'self' http://localhost:5298 https://localhost:7012 ws://localhost:5173 http://localhost:5173;" />
  ```
- Removed `'unsafe-inline'` from `script-src`.
- Verified in the packaged app: Vite outputs module scripts `<script type="module" crossorigin src="./assets/index-...js">` from `'self'`, which load without CSP errors.
- Maintained `'unsafe-inline'` in `style-src` for dynamic CSS/inline styles.

---

## 8. Owner Authorization Defense-in-Depth

### Change in `PermissionAuthorizationHandler.cs`
- **BEFORE:**
  ```csharp
  // 1. OWNER RULE: Active Owner bypasses all permission checks automatically
  if (user.Role == UserRole.Owner ||
      context.User.IsInRole("Owner") ||
      context.User.HasClaim(c => c.Type == "isOwner" && c.Value.Equals("true", StringComparison.OrdinalIgnoreCase)))
  {
      context.Succeed(requirement);
      return;
  }
  ```
- **AFTER:**
  ```csharp
  // 1. OWNER RULE: Active Owner bypasses all permission checks automatically based on current database record
  if (user.Role == UserRole.Owner)
  {
      context.Succeed(requirement);
      return;
  }
  ```
- **RATIONALE:** The database record for the requesting user is already queried during every request (`db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId)`). Checking only `user.Role == UserRole.Owner` guarantees that demoted or non-owner users cannot bypass permission enforcement by presenting stale or forged JWT claims.
- **AUTOMATED PIPELINE TEST:** Added `backend/tests/CarSpaManagement.Api.Tests/StaleJwtOwnerDefenseTests.cs` testing the full ASP.NET Core `IAuthorizationService` pipeline:
  - Asserts that a user with database `Role = UserRole.Staff` holding JWT claims `role = "Owner"` and `isOwner = "true"` is **denied** access when the required permission is absent (`authResult.Succeeded == false`).
  - Asserts that a genuine database `UserRole.Owner` is **granted** access (`authResult.Succeeded == true`).

---

## 9. Packaged Production Electron Verification

Executed the Windows packaged distribution (`release/win-unpacked/Car Spa Management.exe`) against the ASP.NET Core backend running with `ASPNETCORE_ENVIRONMENT=Production` on `http://localhost:5298`:

### Verified Runtime Traffic
```
[11:36:13 INF] Now listening on: http://localhost:5298
[11:36:13 INF] Hosting environment: Production
...
[11:39:35 INF] HTTP OPTIONS /api/auth/status responded 204 in 0.0978 ms
[11:39:35 INF] HTTP GET /api/auth/status responded 200 in 4.0255 ms
[11:39:35 INF] HTTP OPTIONS /api/auth/me responded 204 in 0.0750 ms
[11:39:36 INF] HTTP GET /api/auth/me responded 200 in 263.5270 ms
[11:39:36 INF] HTTP OPTIONS /api/reports/dashboard responded 204 in 0.0708 ms
[11:39:36 INF] HTTP OPTIONS /api/job-cards responded 204 in 0.0546 ms
[11:39:36 INF] HTTP GET /api/job-cards responded 200 in 144.1194 ms
[11:39:36 INF] HTTP GET /api/reports/dashboard responded 200 in 199.6939 ms
[11:39:51 INF] HTTP OPTIONS /api/settings/business responded 204 in 0.6235 ms
[11:39:51 INF] HTTP GET /api/settings/business responded 200 in 100.5947 ms
[11:39:51 INF] HTTP GET /uploads/logos/logo_c11d883f27cc4f53acc49f7d1cb23dc9.png responded 304 in 4.3802 ms
```

### Verification Checklist
- [x] Application launches without errors
- [x] Renderer loads from `app://carspa/index.html`
- [x] No CSP violations preventing script execution
- [x] SafeStorage session restored (`auth:getToken` -> `GET /api/auth/me`)
- [x] Preflight (OPTIONS) requests succeed with `Access-Control-Allow-Origin: app://carspa`
- [x] `Origin: null` correctly denied
- [x] Dashboard KPI data loaded via API (200 OK)
- [x] Job cards loaded via API (200 OK)
- [x] Settings & business profile loaded via API (200 OK)
- [x] Business logo loaded from backend (`/uploads/logos/...`) (304 OK)
- [x] External URLs intercepted and routed to `shell.openExternal`
- [x] Unmanaged popups blocked with `{ action: 'deny' }`

---

## 10. Items Deliberately Deferred to Later Phases

Per the strict Phase 1 scope rules, the following items are intentionally deferred:
- HTTPS/TLS and Kestrel certificates (Phase: Network/Deployment)
- Dedicated least-privilege PostgreSQL user (Phase: Database/Infrastructure)
- Progressive account lockout and CAPTCHA (Phase: Authentication Roadmap)
- Global API rate limiting / reverse proxy configuration (Phase: LAN & Cloud Deployment)
- Multi-tenancy / SaaS tenant filters and schemas (Phase: Multi-tenant SaaS)
- Self-service password reset (Phase: Account Self-Service)

---

## 11. Conclusion & Git Scope Verification

The Phase 1 hardening is minimal, safe, and fully validated. Only 7 source files were modified, 1 unit test file added, and zero unwanted artifacts or credentials committed. The desktop application is now production-ready for packaging and local execution.
