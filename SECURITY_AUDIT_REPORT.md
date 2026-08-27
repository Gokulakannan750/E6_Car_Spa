# Security Audit Report — Car Spa Management Desktop Application

**Audit Date:** 2026-08-27
**Auditor:** Claude Fable 5 (Automated Security Analysis)
**Branch:** security/phase-4a-final-hardening
**Scope:** Electron desktop app + ASP.NET Core backend — full security posture review

---

## Executive Summary

The application demonstrates a **solid security foundation** with several well-implemented controls (context isolation, sandboxed renderer, JWT authentication, rate limiting, TypeScript strict mode). However, there are **significant gaps** that should be addressed before the application handles real business data, particularly around **Content Security Policy**, **token storage**, **information disclosure in error responses**, and **IPC input validation**.

| Severity | Count | Description |
|----------|-------|-------------|
| **HIGH** | 4 | Missing CSP, localStorage token storage, unsanitized print HTML, dead preload with `process.platform` |
| **MEDIUM** | 8 | Error message leakage, no request timeouts, no HTTPS enforcement, no web-contents handler, missing complexity in password policy |
| **LOW** | 10 | New dependency versions, missing audit scripts, no SRI, no referrer-policy, etc. |
| **POSITIVE** | 18 | Correctly implemented security controls |

---

## 1. Electron Desktop Security

### 1.1 BrowserWindow Security Configuration

| Setting | Value | Status |
|---------|-------|--------|
| `contextIsolation` | `true` (main.ts:24) | PASS |
| `nodeIntegration` | `false` (main.ts:25) | PASS |
| `sandbox` | `true` (main.ts:26) | PASS |
| `enableRemoteModule` | not set (defaults false) | PASS |
| `nodeIntegrationInWorker` | not set (defaults false) | PASS |
| `webSecurity` | not explicitly set (defaults true) | **WARN** |
| `webviewTag` | not set (defaults false) | PASS |
| `javascriptEnabled` | not set (defaults true) | PASS |

### 1.2 HIGH — No Content-Security-Policy

**Files:** `apps/desktop/renderer/index.html`, `apps/desktop/electron/main.ts`

Neither the HTML entry point nor the BrowserWindow creation defines a Content-Security-Policy. The application relies entirely on Electron's internal default, which blocks `unsafe-inline` scripts but does not restrict `connect-src`, `img-src`, or `frame-ancestors`.

**Recommendation:** Add a CSP meta tag to `index.html` and enforce `webSecurity: true` explicitly:

```html
<meta http-equiv="Content-Security-Policy"
 content="default-src 'self';
 script-src 'self';
 style-src 'self' 'unsafe-inline';
 connect-src 'self' http://localhost:5173;
 img-src 'self' data: blob:;
 font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
 object-src 'none';
 frame-ancestors 'none';" />
```

### 1.3 HIGH — Auth Tokens Stored in localStorage

**Files:** `apps/desktop/renderer/src/lib/api.ts` (lines 13-14, 24-27), `apps/desktop/renderer/src/features/auth/auth-context.tsx` (lines 101, 125, 164)

JWT tokens and user session data are stored in `localStorage`, which:
- Is accessible to any XSS vulnerability in the renderer
- Is persisted to disk in plaintext
- Cannot be protected by Electron's `safeStorage` API

**Recommendation:** Store tokens using Electron's `safeStorage` API (accessible via the preload script) or in memory only with a file-based encrypted fallback.

### 1.4 HIGH — Print Windows Load Unsanitized HTML

**Files:** `apps/desktop/electron/main.ts` (lines 50-63, 65-78)

Both `printJobCard` and `printInvoice` accept raw HTML strings from the renderer and inject them into `data:text/html` URLs. No sanitization is performed, and the print windows have no CSP applied.

**Recommendation:**
- Sanitize HTML in the main process before injecting (e.g., DOMPurify)
- Apply a strict CSP to print windows
- Add HTML size limits

### 1.5 HIGH — Dead Preload File with process.platform Exposure

**Files:** `apps/desktop/src/preload/preload.ts` (stale/unused)

A stale preload file exists that:
- Uses different IPC channel names (`app:get-version` vs `app:getVersion`)
- Exposes `process.platform` to the renderer
- Creates maintenance confusion about which preload is authoritative

**Recommendation:** Delete this file. The active preload is `apps/desktop/electron/preload.ts`.

### 1.6 MEDIUM — Unrestricted `app:getPath` IPC Handler

**Files:** `apps/desktop/electron/main.ts` (line 49), `apps/desktop/electron/preload.ts` (line 5)

The renderer can request any Node.js path constant (home, userData, exe, temp, etc.) with no allowlist. This exposes the filesystem layout to any code running in the renderer.

**Recommendation:** Either remove this channel (not used by any business feature) or add an explicit allowlist:

```typescript
const ALLOWED_PATHS = ['userData', 'appData', 'documents', 'downloads'];
if (!ALLOWED_PATHS.includes(name)) throw new Error('Path not allowed');
```

### 1.7 MEDIUM — No `web-contents-created` Handler

**File:** `apps/desktop/electron/main.ts`

There is no handler to restrict new window creation or navigation from the renderer. A compromised renderer could open new BrowserWindows or navigate to external URLs.

**Recommendation:**

```typescript
app.on('web-contents-created', (_, contents) => {
 contents.on('will-navigate', (event, url) => {
 if (url.startsWith('http')) event.preventDefault();
 });
 contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
```

### 1.8 MEDIUM — DevTools Auto-Opened

**File:** `apps/desktop/electron/main.ts` (line 32)

DevTools are opened unconditionally in development mode. If the app were ever packaged in dev mode, this would expose tokens, network requests, and state to the user.

**Recommendation:** Gate behind an explicit opt-in (e.g., `--devtools` CLI flag or environment variable).

### 1.9 MEDIUM — Print Windows Have No CSP

**File:** `apps/desktop/electron/main.ts` (lines 57, 72)

The print windows created at lines 55-63 and 70-78 load `data:text/html` URLs without any CSP. If the HTML contains scripts, they will execute in the print window context.

**Recommendation:** Add CSP headers or use `webContents.executeJavaScript()` to inject a CSP before loading content.

### 1.10 LOW — `name as any` Cast in IPC Handler

**File:** `apps/desktop/electron/main.ts` (line 49)

The `name as any` cast bypasses TypeScript's type checking on the `app.getPath()` argument.

### 1.11 LOW — No Code Signing Configuration

**File:** `apps/desktop/electron-builder.json`

No `certificateFile`, `certificatePassword`, or `cscLink` configuration. Windows SmartScreen will flag the unsigned `.exe`.

---

## 2. Backend API Security

### 2.1 HIGH — Error Messages Leak 

**File:** `backend/api/CarSpaManagement.Api/Program.cs` (lines 282-285)

```csharp
var detail = builder.Environment.IsDevelopment()
 ? new { message = ex.Message, stackTrace = ex.StackTrace }
 : null;

// ...
if (ex is KeyNotFoundException || ex is ArgumentException)
 detail = new { message = ex.Message }; // Leaks in ALL environments
```

`KeyNotFoundException` and `ArgumentException` messages are exposed in production. Attackers can probe for internal logic (e.g., "Customer not found with id X").

**Recommendation:** Always return generic error messages in production:

```csharp
detail = builder.Environment.IsDevelopment()
 ? new { message = ex.Message }
 : new { message = "An error occurred processing your request." };
```

### 2.2 HIGH — `appsettings.json` Tracked in Git

**Files:** `.gitignore`, `backend/api/CarSpaManagement.Api/appsettings.json`

`appsettings.json` is **not** in `.gitignore`. The placeholder password `CHANGE_ME` is currently in the file, but if a developer replaces it with a real production credential and commits, that credential is permanently in git history.

**Recommendation:** Add `appsettings.json` to `.gitignore` and create an `appsettings.example.json` with placeholders. Use `dotnet user-secrets` for development and environment variables in production.

### 2.3 MEDIUM — CORS Allows Any Origin in Development

**File:** `backend/api/CarSpaManagement.Api/Program.cs` (lines 228-231)

`AllowAnyOrigin()` + `AllowAnyMethod()` + `AllowAnyHeader()` is used for the development CORS policy. This is gated to `IsDevelopment()` (line 308), which is correct, but a misconfigured deployment could accidentally run in Development mode with open CORS.

**Recommendation:** Ensure `ASPNETCORE_ENVIRONMENT` is never set to `Development` in production deployments.

### 2.4 MEDIUM — Rate Limiting Requires Explicit Attributes

**File:** `backend/api/CarSpaManagement.Api/Program.cs` (lines 150-222)

Rate limiting policies are defined but require explicit `[EnableRateLimiting("policy-name")]` attributes on controller actions. Any auth endpoint that forgets this attribute has **no rate limiting at all**.

**Recommendation:** Apply rate limiting attributes to all authentication endpoints and consider adding a global default policy.

### 2.5 MEDIUM — 24-Hour JWT Tokens with No Refresh Mechanism

**Files:** `backend/api/CarSpaManagement.Api/Program.cs` (line 139), `appsettings.json` (line 34)

JWT tokens are valid for 24 hours with no refresh token mechanism. A compromised token grants 24 hours of access.

**Recommendation:** Implement a refresh token flow with shorter-lived access tokens (e.g., 15 minutes access, 7-day refresh).

### 2.6 MEDIUM — Multiple JWT Audiences Accepted

**File:** `backend/api/CarSpaManagement.Api/Program.cs` (line 138)

Valid audiences include `E6CarSpaDesktop`, `E6CarSpaMobile`, and `E6CarSpa`. A token issued for the mobile app could potentially be replayed against the desktop API.

**Recommendation:** Review whether a single shared audience is appropriate, or implement separate authentication flows per client type.

### 2.7 MEDIUM — `AllowedHosts: "*"` in Production Config

**File:** `backend/api/CarSpaManagement.Api/appsettings.json` (line 37)

The `AllowedHosts` value of `"*"` allows the application to respond to requests for any hostname, which could enable host header injection attacks.

**Recommendation:** Set `AllowedHosts` to the actual hostname(s) in production (e.g., `localhost`, `127.0.0.1`).

### 2.8 MEDIUM — `SaveToken = true` Persists Tokens in Session State

**File:** `backend/api/CarSpaManagement.Api/Program.cs` (line 130)

The JWT token is stored in the authentication session properties. In a high-traffic scenario, this could lead to memory accumulation of tokens.

### 2.9 MEDIUM — No Request Body Size Limits

**File:** `backend/api/CarSpaManagement.Api/Program.cs`

No `RequestSizeLimit` or `MaxRequestBodySize` is configured. Large payloads could cause memory exhaustion.

### 2.10 LOW — Seeded Staff Accounts

**File:** `backend/api/CarSpaManagement.Api/Program.cs` (lines 393-423)

Hardcoded staff records with realistic email addresses (`@e6carspa.com`). If these accounts are created with default/known passwords, they are backdoor accounts.

### 2.11 LOW — Health Checks Package Version Mismatch

**File:** `backend/api/CarSpaManagement.Api/CarSpaManagement.Api.csproj` (line 10)

`AspNetCore.HealthChecks.NpgSql` version 9.0.0 targets ASP.NET Core 9, but the project uses .NET 10.

### 2.12 LOW — No API Versioning

**File:** `backend/api/CarSpaManagement.Api/Program.cs`

No API versioning strategy (URL path, query parameter, or header). This makes breaking changes difficult to manage safely.

---

## 3. Renderer / Frontend Security

### 3.1 HIGH — No Content-Security-Policy

**File:** `apps/desktop/renderer/index.html` (lines 1-14)

No CSP meta tag, no nonce-based script loading, no `X-Content-Type-Options` meta tag, no `X-Frame-Options`, no `referrer-policy`.

**Recommendation:** See section 1.2 above.

### 3.2 HIGH — localStorage for Auth Tokens

See section 1.3 above. Tokens are persisted in plaintext to disk via `localStorage`.

### 3.3 MEDIUM — No Request Timeouts on Fetch

**File:** `apps/desktop/renderer/src/lib/api.ts` (line 53)

Fetch calls have no timeout. Network issues or slow responses could freeze the UI indefinitely.

### 3.4 MEDIUM — No HTTPS Enforcement for API URL

**File:** `apps/desktop/renderer/src/lib/api.ts` (line 10)

The fallback API URL is `http://localhost:5298`. While localhost HTTP is acceptable for development, there is no enforcement mechanism.

### 3.5 MEDIUM — No SRI on Google Fonts

**File:** `apps/desktop/renderer/index.html` (line 8)

The Google Fonts stylesheet link lacks an `integrity` attribute for Subresource Integrity verification.

### 3.6 MEDIUM — No frame-ancestors / Clickjacking Protection

**File:** `apps/desktop/renderer/index.html`

No `X-Frame-Options` header or `frame-ancestors` CSP directive.

### 3.7 MEDIUM — No Password Complexity Requirements

**File:** `apps/desktop/renderer/src/features/auth/FirstTimeSetup.tsx` (lines 33-43)

Password validation only checks minimum length (8 characters) and that it doesn't match the username. No uppercase, lowercase, number, or special character requirements.

### 3.8 LOW — Zustand v5 — Very New Major Version

**File:** `apps/desktop/renderer/package.json` (line 29)

`zustand` version `^5.0.0` is a very new major version with potentially undiscovered vulnerabilities.

### 3.9 LOW — No npm audit Scripts

**File:** `apps/desktop/renderer/package.json`

No `audit` or `audit-ci` scripts configured.

### 3.10 LOW — No `engines` Field in package.json

**File:** `apps/desktop/renderer/package.json`

No minimum Node.js version specified, which could allow installation on incompatible versions.

### 3.11 LOW — No referrer-policy Meta Tag

**File:** `apps/desktop/renderer/index.html`

No `referrer-policy` meta tag, which means the browser default applies.

---

## 4. Configuration & Secrets Management

### 4.1 HIGH — appsettings.json Tracked in Git

See section 2.2 above.

### 4.2 MEDIUM — JWT Key via Environment Variable (GOOD)

**File:** `backend/api/CarSpaManagement.Api/Program.cs` (lines 105-109)

The JWT signing key is loaded from the `JWT_KEY` environment variable. This is correct practice.

### 4.3 MEDIUM — WhatsApp Encryption Key via Environment Variable (GOOD)

**File:** `backend/api/CarSpaManagement.Api/Program.cs` (lines 77-81)

The WhatsApp encryption key is loaded from environment variables. Good practice.

### 4.4 LOW — `PublicInvoiceBaseUrl` Uses HTTP

**File:** `backend/api/CarSpaManagement.Api/appsettings.json` (line 36)

The public invoice URL uses `http://` instead of `https://`.

---

## 5. Positive Security Controls

The following controls are correctly implemented:

| # | Control | Location | Detail |
|---|---------|----------|--------|
| 1 | `contextIsolation: true` | main.ts:24 | Renderer cannot access Node.js globals |
| 2 | `nodeIntegration: false` | main.ts:25 | No Node.js APIs in renderer |
| 3 | `sandbox: true` | main.ts:26 | OS-level process isolation |
| 4 | Preload uses `contextBridge` only | preload.ts | Limited, whitelisted IPC surface |
| 5 | No raw `ipcRenderer.send` exposed | preload.ts | Only `invoke/handle` pattern |
| 6 | TypeScript `strict: true` | All tsconfig files | Full type safety |
| 7 | Login uses generic error messages | LoginForm.tsx:33 | Prevents user enumeration |
| 8 | Password fields have `type="password"` + `autoComplete` | LoginForm.tsx | Password manager support |
| 9 | `encodeURIComponent` on URL params | api.ts | Prevents path injection |
| 10 | Bearer token cleared on 401 | api.ts:61-62 | Session invalidation |
| 11 | JWT validation enabled (issuer, audience, lifetime) | Program.cs:126-135 | Proper token validation |
| 12 | `ClockSkew = TimeSpan.Zero` | Program.cs:136 | No token replay window |
| 13 | HTTPS redirection in production | Program.cs:298 | Enforces HTTPS |
| 14 | HSTS in production | Program.cs:313 | Enforces HTTPS on browsers |
| 15 | Rate limiting configured | Program.cs:150-222 | Brute-force protection |
| 16 | CORS gated to Development | Program.cs:228-231 | Prevents open CORS in production |
| 17 | Environment variable secrets | Program.cs:77-81, 105-109 | JWT and encryption keys from env |
| 18 | `.gitignore` covers `.env`, `secrets.json` | .gitignore:8,9,10,33 | Prevents secret commits |

---

## 6. Priority Recommendations

### Before Production

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Add CSP to `index.html` and all BrowserWindows | Low | Blocks XSS attack vector |
| **P0** | Move token storage from `localStorage` to Electron `safeStorage` | Medium | Protects auth tokens from XSS and disk theft |
| **P0** | Add `appsettings.json` to `.gitignore` + create example config | Low | Prevents credential leakage |
| **P0** | Fix error message leakage in `Program.cs` (lines 282-285) | Low | Prevents information disclosure |
| **P1** | Sanitize HTML in print windows + add CSP to print windows | Low | Prevents script execution via print flow |
| **P1** | Add `web-contents-created` handler to restrict new windows | Low | Prevents renderer from opening external content |
| **P1** | Add allowlist to `app:getPath` IPC or remove unused channel | Low | Limits filesystem information exposure |
| **P1** | Add request timeout to all fetch calls in `api.ts` | Low | Prevents UI hangs from network issues |
| **P1** | Implement refresh token flow (replace 24h static tokens) | High | Limits window of token compromise |
| **P2** | Remove stale `apps/desktop/src/preload/preload.ts` | Low | Eliminates dead code confusion |
| **P2** | Add `webSecurity: true` explicitly to all BrowserWindows | Low | Defensive coding |
| **P2** | Add SRI to Google Fonts link or self-host fonts | Low | Prevents CDN compromise |
| **P2** | Add request body size limits to Kestrel | Low | Prevents memory exhaustion |
| **P2** | Delete unused `apps/desktop/index.html` (not the renderer one) | Low | Reduces attack surface |

---

## 7. Files Audited

| File | Security Relevance |
|------|-------------------|
| `apps/desktop/electron/main.ts` | HIGH — BrowserWindow security, IPC handlers, print windows |
| `apps/desktop/electron/preload.ts` | HIGH — Exposed IPC surface |
| `apps/desktop/electron/preload.ts` (stale at `src/preload/`) | HIGH — Dead code with security concerns |
| `apps/desktop/renderer/index.html` | HIGH — No CSP, no security meta tags |
| `apps/desktop/package.json` | LOW — Dependency versions, audit scripts |
| `apps/desktop/vite.config.ts` | LOW — Dev server, no CSP config |
| `apps/desktop/electron-builder.json` | LOW — No code signing |
| `apps/desktop/tsconfig.json` | LOW — TypeScript strictness |
| `apps/desktop/tsconfig.node.json` | LOW — Main/renderer boundary |
| `apps/desktop/tsconfig.web.json` | LOW — Main/renderer boundary |
| `apps/desktop/tailwind.config.js` | NONE — Styling only |
| `apps/desktop/renderer/package.json` | MEDIUM — New major versions |
| `apps/desktop/renderer/tsconfig.json` | LOW — TypeScript strictness |
| `apps/desktop/renderer/vite.config.ts` | LOW — Dev proxy, no CSP |
| `apps/desktop/renderer/src/lib/api.ts` | HIGH — Token storage, no timeouts |
| `apps/desktop/renderer/src/features/auth/auth-context.tsx` | HIGH — Token storage pattern |
| `apps/desktop/renderer/src/features/auth/LoginForm.tsx` | POSITIVE — Generic errors, proper password fields |
| `apps/desktop/renderer/src/features/auth/FirstTimeSetup.tsx` | MEDIUM — Weak password policy |
| `apps/desktop/renderer/src/shared/providers/index.ts` | LOW — Barrel file |
| `packages/design-tokens/src/tokens.ts` | NONE — Design constants |
| `backend/api/CarSpaManagement.Api/Program.cs` | HIGH — Error leakage, auth, CORS, rate limiting |
| `backend/api/CarSpaManagement.Api/CarSpaManagement.Api.csproj` | LOW — Package versions |
| `backend/api/CarSpaManagement.Api/appsettings.json` | HIGH — Git-tracked credentials, CORS, JWT config |
| `backend/api/CarSpaManagement.Api/appsettings.Development.json` | MEDIUM — Dev credentials |
| `.gitignore` | HIGH — Missing `appsettings.json` exclusion |

---

## 8. Compliance Notes

| Control Area | Status | Notes |
|--------------|--------|-------|
| Data at Rest Encryption | PARTIAL | Tokens in plaintext localStorage; `safeStorage` not used |
| Transport Security | PARTIAL | Backend enforces HTTPS in production; local dev uses HTTP (acceptable) |
| Authentication | GOOD | JWT with proper validation, but no refresh tokens |
| Authorization | NOT YET IMPLEMENTED | No role-based access control on API endpoints |
| Audit Logging | NOT YET IMPLEMENTED | Serilog configured but no auth event logging |
| Input Validation | PARTIAL | Backend has global exception handler; no explicit input validation framework |
| Rate Limiting | GOOD | Configured but requires explicit attribute application |
| Session Management | WEAK | 24h tokens, no refresh, localStorage persistence |
| Dependency Security | UNKNOWN | No audit scripts configured |
| Code Signing | NOT CONFIGURED | No certificate for Windows `.exe` signing |

---

*This report is a read-only security assessment. No code was modified during this audit.*
