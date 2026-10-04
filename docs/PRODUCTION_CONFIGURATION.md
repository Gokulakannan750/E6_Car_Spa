# Production Configuration (Phase 0)

This document describes how to run the E6 Car Spa API, Windows app and Android app with
**production** settings. It does not describe the future hosted/franchise architecture.

## 1. Environments

| Setting | Development | Production |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Development` (set by `Properties/launchSettings.json` when using `dotnet run`) | `Production` (the default when the variable is **unset**) |
| Config files loaded | `appsettings.json` + `appsettings.Development.json` + user-secrets | `appsettings.json` + environment variables |
| CORS | Allow any origin | Only `Cors:AllowedOrigins` (`app://carspa` = packaged Windows app) |
| Error details in responses | Yes | No |
| EF Core sensitive SQL logging | Yes | No |
| OpenAPI document | Yes | No |
| HSTS | No | Yes |
| Demo vendors seeded on empty DB | Yes | **No** |
| Startup configuration guard | Warns if Development is reachable on the network | **Refuses to start** with a missing/placeholder DB password; warns about `postgres` superuser and non-HTTPS invoice links |

`dotnet run` uses `launchSettings.json`, which is **development only**. The `http` profile listens on
`0.0.0.0:5298` so Android devices on the LAN can reach a developer machine; the API now logs a
`CONFIGURATION WARNING` when Development mode is reachable from the network. Never serve real users from it.

Start production with the published build, for example:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Production"
$env:ASPNETCORE_URLS = "http://127.0.0.1:5298"          # behind a TLS reverse proxy (see §4)
dotnet CarSpaManagement.Api.dll
```

## 2. Required secrets (environment variables — never commit)

| Variable | Purpose |
|---|---|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string (use the least-privilege role, §3) |
| `JWT_KEY` (or `Jwt__Key`) | JWT signing key, ≥ 32 chars, random (e.g. 64 random bytes base64) |
| `WHATSAPP_ENCRYPTION_KEY` (or `WhatsApp__EncryptionKey`) | AES-GCM key protecting the stored WhatsApp token and Aadhaar numbers. **Do not change it** without re-encrypting existing data. |
| `Database__ApplyMigrationsOnStartup` | `true` (default) or `false` for least-privilege deployments (§3) |
| `Cors__AllowedOrigins__0` … | Only if additional browser origins must call the API |
| `PublicInvoiceBaseUrl` | Base URL used in customer invoice links; should be `https://` |

`appsettings.Production.json`, `appsettings.*.local.json`, `.env*` and `secrets.json` are git-ignored.

Local development stores secrets with .NET user-secrets (outside the repository):

```bash
dotnet user-secrets set "Jwt:Key" "<random>" --project backend/api/CarSpaManagement.Api
```

## 3. Least-privilege database account

The application should not connect as the `postgres` superuser. Create a DML-only role with
[`scripts/db/create-app-role.sql`](../scripts/db/create-app-role.sql) (run it as the database owner), then:

1. Apply migrations with the owner connection (start the API once with the owner connection string and
   `Database__ApplyMigrationsOnStartup=true`, or use an EF Core migration bundle).
2. Run the API day-to-day with `Username=carspa_app` and `Database__ApplyMigrationsOnStartup=false`.
   On startup the API logs an error if migrations are pending.

## 4. HTTPS / TLS

JWTs, customer data and Aadhaar reveals must not cross a network in clear text. Choose one:

- **Reverse proxy (recommended):** IIS (ARR), Caddy or Nginx terminates TLS with a real certificate and
  forwards to `http://127.0.0.1:5298`. The API already honours `X-Forwarded-For/Proto` from loopback proxies.
- **Kestrel directly:** configure `Kestrel:Endpoints:Https` with a certificate (PFX path + password via
  environment variables).
- **LAN-only deployment:** a certificate for a local DNS name (e.g. from an internal CA) installed on the
  server and trusted by the Windows PCs and Android devices. Self-signed certificates must be installed as
  trusted on every device; Android additionally requires the CA in `network_security_config.xml`.

`PublicInvoiceBaseUrl` should point at the HTTPS host that serves public invoice links.

## 5. Where API base URLs are configured

| Client | Location | Production behaviour |
|---|---|---|
| API (links in WhatsApp/public invoices) | `PublicInvoiceBaseUrl` in configuration | `https://invoice.e6carspa.com` in `appsettings.json`; Development overrides to `http://localhost:5173` |
| Windows app | `apps/desktop/renderer/src/lib/api.ts` → `VITE_API_URL` at build time, default `http://localhost:5298` (API on the same PC) | Set `VITE_API_URL` when building if the API runs elsewhere, **and** add that origin to the CSP `connect-src` in `apps/desktop/renderer/index.html` (currently hard-coded to localhost — tracked for Phase 1) |
| Windows app dev proxy | `apps/desktop/renderer/vite.config.ts` → `http://localhost:5298` | Dev server only |
| Android | `apps/android/lib/core/utils/app_environment.dart` → `--dart-define=E6_API_URL=...` | Release builds without `E6_API_URL` now use `AppConstants.defaultProdApiUrl` (`https://api.e6carspa.com/api`) and **never** the development LAN IP. Debug builds keep `http://192.168.1.7:5298/api`. |
| Android cleartext policy | `android/app/src/main/res/xml/network_security_config.xml` (release: HTTPS only) and `android/app/src/debug/res/xml/network_security_config.xml` (debug: localhost, 10.0.2.2, 192.168.1.7 over HTTP) | A release APK can no longer talk to an HTTP-only server unless that host is deliberately added to the main config |

Release Android build example:

```bash
flutter build apk --release --dart-define=E6_API_URL=https://<your-api-host>/api
```

## 6. Demo / seed data

Seeded on an empty database in every environment (production bootstrap): permissions, showroom vehicle and
work types, system preferences, and the default business profile (`DefaultBusinessProfile` in
`appsettings.json`). The three sample vendors are created **only in Development**.

Existing databases are not modified. Databases created before Phase 0 may contain the sample vendors
"Sri Lakshmi Auto Works", "Sri Krishna Wheel Alignment & Tyres" and "Erode Auto Electricians & AC"
(fictitious names and phone numbers). Review them in Settings / Vendors and deactivate them if they are not
real suppliers; they cannot simply be deleted if outside jobs already reference them.
