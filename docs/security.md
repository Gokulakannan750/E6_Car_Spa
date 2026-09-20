# Security Audit — E6 Car Spa Management

## Architecture Overview

```
┌──────────────┐ HTTP localhost:5298 ┌──────────────┐
│ Electron │ ─────────────────────────────────► │ ASP.NET API │
│ Desktop App │ │ (Kestrel) │
│ │ ◄───────────────────────────────── │ │
└──────────────┘ localhost:5298 └──────┬───────┘
 │
 localhost:5432
 │
 ┌──────────▼──────────┐
 │ PostgreSQL │
 │ (E6CarSpaNew db) │
 └─────────────────────┘
```

- **Electron** loads the React UI locally and calls `http://localhost:5298`
- **API** runs as a local Kestrel process, talks to PostgreSQL
- **PostgreSQL** listens only on localhost (127.0.0.1)
- Everything stays on one machine. No cloud, no internet, no external calls

---

## How It Works Without Internet

This is an **on-premise / local-first** architecture. No internet is needed for any core operation:

1. User opens the Electron app → local React UI loads from disk
2. React makes HTTP requests to `http://localhost:5298` (Kestrel running on the same machine)
3. Kestrel queries PostgreSQL on `localhost:5432`
4. All data stays local. No external calls are made during normal operation

The only internet-dependent features are:
- **WhatsApp integration** (`WhatsAppBackgroundWorker`) — for sending notifications
- **Public invoice links** (`invoice.e6carspa.com`) — if you use the share feature
- **Logo seeding** — the API copies `e6-logo.png` from the renderer's public folder (local file copy, no internet)

---

## HTTPS

| Area | Status | Detail |
|------|--------|--------|
| Dev mode | OK | `RequireHttpsMetadata = false` — correct, since dev uses plain HTTP on localhost |
| Prod mode | OK | `RequireHttpsMetadata = true` — enforced |
| HSTS | OK | `app.UseHsts()` applied in production |
| HTTP Security Headers | Partial | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` are set — but missing `Permissions-Policy`, `X-XSS-Protection`, and HSTS max-age tuning |

**Key gap:** Since this is a localhost-only deployment, HTTPS is not strictly necessary for the API. However, if you ever expose the API to other machines on the LAN, you'll need a TLS certificate. Kestrel HTTPS is not configured right now (no `Listen` with HTTPS, no certificate path).

---

## Authentication & Tokens

| Area | Status | Detail |
|------|--------|--------|
| JWT signing | OK | Symmetric key with `ValidateIssuerSigningKey = true` |
| Issuer/Audience validation | OK | Both validated |
| Token lifetime | Concern | 24 hours (1440 min) — long for a desktop app. If the token leaks, it's valid for a full day. Consider 8 hours or session-based refresh. |
| Clock skew | OK | `TimeSpan.Zero` — no clock skew tolerance |
| Token storage in Electron | Good | Uses `safeStorage` (OS-level encryption via DPAPI on Windows / Keychain on macOS). Falls back to plaintext only if encryption is unavailable, with a console warning |
| Token storage fallback (web) | Acceptable | Falls back to `localStorage` when `window.electronAPI` is absent (browser preview) |

---

## Database Security

| Area | Status | Detail |
|------|--------|--------|
| Connection string | Hardcoded | `appsettings.json` has `Password=CHANGE_ME_DEV` — must be replaced before production |
| Dev vs Prod config | OK | Separate `appsettings.Development.json` exists |
| User-scoped secrets | Missing | No `.NET User Secrets` (`dotnet user-secrets`) configured for local dev. The placeholder password `CHANGE_ME_DEV` suggests it was intended but not completed |
| PostgreSQL access | OK | Default connection is `localhost:5432` — not externally exposed |
| Credentials in git | Risk | If the real PostgreSQL password ever gets committed, it's in git history forever. Use environment variables or a secrets manager |
| DB migration at startup | OK | `db.Database.MigrateAsync()` runs on startup — standard pattern |

---

## CORS

| Area | Status | Detail |
|------|--------|--------|
| Dev CORS | Acceptable | `AllowAnyOrigin` — fine for localhost development |
| Prod CORS | Gap | Only allows `http://localhost:5173` — but in production the Electron app loads `file://` protocol pages or the bundled renderer, not `localhost:5173`. The API won't accept requests from the packaged app unless you add the correct origin or use a no-CORS approach for localhost |
| CORS for Android | Not addressed | The future Flutter app (different origin) would need to be added to the production allowed origins list |

---

## Rate Limiting

| Area | Status | Detail |
|------|--------|--------|
| Login endpoint | OK | 5 requests per 60 seconds per IP |
| Bootstrap endpoint | OK | 3 requests per 60 seconds per IP |
| Public invoice | OK | 30 requests per 60 seconds per IP |
| Account lockout | OK | Backend enforces account locking (423 status with countdown) |
| General API endpoints | Gap | No global rate limit. All non-auth endpoints are unprotected from brute-force or abuse |

---

## Authorization

| Area | Status | Detail |
|------|--------|--------|
| Permission system | OK | Custom `PermissionPolicyProvider` with `[RequirePermission]` attribute |
| JWT role claims | OK | `role` claim validated |
| Policy-based access | OK | Dynamic policies registered |

---

## Electron Security

| Area | Status | Detail |
|------|--------|--------|
| `nodeIntegration` | OK | `false` |
| `contextIsolation` | OK | `true` |
| `sandbox` | OK | `true` |
| Preload script | OK | Controlled `contextBridge` with only needed APIs |
| CSP | Missing | No Content-Security-Policy header set on the BrowserWindow. Without it, inline scripts or unexpected script loads could execute if a renderer vulnerability is found |
| DevTools in production | OK | `openDevTools()` only runs in dev mode |
| IPC validation | Partial | `auth:getToken`/`auth:setToken` are safe. `app:getPath` casts `name as any` — not validated. `app:printJobCard`/`app:printInvoice` accept raw HTML strings — could be a vector if the renderer is compromised |

---

## Network & Connectivity

The app works perfectly without internet. See Architecture Overview above.

---

## Summary: What Needs Fixing

| Priority | Issue | Action |
|----------|-------|--------|
| HIGH | PostgreSQL password is a placeholder | Set real credentials via environment variable or `.NET User Secrets` before any real use |
| HIGH | Production CORS won't work with packaged Electron | Add `null` origin or configure correct origin for packaged app, or use localhost-only binding |
| MEDIUM | JWT token lifetime is 24 hours | Reduce to 8 hours or implement a refresh token mechanism |
| MEDIUM | No CSP on BrowserWindow | Add a Content-Security-Policy meta tag or header |
| MEDIUM | `app:getPath` IPC parameter not validated | Validate the `name` parameter against an allowlist of Electron path names |
| MEDIUM | Hardcoded business profile data in seed | Move business profile seeding to a setup wizard or environment-configurable values |
| LOW | No global API rate limiting | Add a general rate limiter for non-auth endpoints |
| LOW | Missing security headers | Add `Permissions-Policy`, strengthen HSTS |
| LOW | Print IPC accepts raw HTML | Consider sanitizing HTML or restricting to trusted content only |
| LOW | 24-hour JWT has no refresh mechanism | Plan a refresh token flow for the future |
