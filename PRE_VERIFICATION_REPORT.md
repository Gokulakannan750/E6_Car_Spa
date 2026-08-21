# Car Spa Management — Step 1: Pre-Verification Report

**Date:** 2026-08-18
**Purpose:** Manual verification procedure and dependency analysis before running the application

---

## Critical Finding: Dependencies Are NOT Installed

No `node_modules` exists in the renderer, electron, or root project directories.
You **must** run `pnpm install` first before anything else will work.

---

## Dependency Issue 1: EF Core 9.0.0 on .NET 10 (net10.0)

### Current State

| Package | Current Version | Target Framework |
|---|---|---|
| Microsoft.EntityFrameworkCore | 9.0.0 | net10.0 |
| Npgsql.EntityFrameworkCore.PostgreSQL | 9.0.0 | net10.0 |
| AspNetCore.HealthChecks.NpgSql | 9.0.0 | net10.0 |
| Microsoft.AspNetCore.OpenApi | 9.0.0 | net10.0 |
| Serilog.AspNetCore | 9.0.0 | net10.0 |

### Recommendation: **Upgrade to EF Core 10.0.0 before Step 2**

**Why:**
- EF Core 9 targets .NET 8+. It *can* run on .NET 10 (forward-compatible), but you lose:
 - .NET 10-specific performance improvements in EF Core
 - Potential runtime warnings about framework version mismatches
 - Future migration headaches when Step 2 adds real entities and migrations
- EF Core 10.0.0 (released with .NET 10) is the correct pairing
- The API surface is compatible — no code changes needed beyond the version bumps

### Exact Change Needed (Do NOT apply yet — waiting for approval)

```xml
<PackageReference Include="Microsoft.EntityFrameworkCore" Version="10.0.0" />
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.0" />
<PackageReference Include="AspNetCore.HealthChecks.NpgSql" Version="10.0.0" />
<PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="10.0.0" />
<PackageReference Include="Serilog.AspNetCore" Version="10.0.0" />
```

**Impact:** Zero code changes needed. Just 5 version number updates in the `.csproj` file.

**Status:** Does NOT block current verification — the API builds and runs today with EF Core 9 on .NET 10. Fix before Step 2.

---

## Dependency Issue 2: React 18.3.1 + Tailwind CSS 3.4.17 vs Planned React 19 + Tailwind 4

### React 18.3.1 — Safe to Keep. No Upgrade Needed Right Now.

The codebase uses React 18 APIs exclusively:

| Feature Used | API | React 18 | React 19 |
|---|---|---|---|
| createRoot | `ReactDOM.createRoot()` | ✅ | ✅ |
| Router | `react-router-dom` v6 | ✅ | ✅ |
| State Management | `zustand` v5 | ✅ | ✅ |
| Forms | `react-hook-form` v7 | ✅ | ✅ |

**No React 19 features are used.** Upgrading to React 19 is safe and can be done at any time. It is not blocking.

### Tailwind CSS — There IS a Mismatch. Must Resolve Before Running.

| Source | Claims | Problem |
|---|---|---|
| `package.json` | `"tailwindcss": "^3.4.17"` | Claims v3 |
| `postcss.config.js` | `'@tailwindcss/postcss'` | This is a **Tailwind v4** plugin (v3 uses `tailwindcss` directly) |
| `globals.css` line 1 | `@import "tailwindcss"` | **Tailwind v4** syntax (v3 uses `@tailwind base; @tailwind components; @tailwind utilities;`) |
| `globals.css` lines 3–112 | `@theme { --color-*, --font-size-*, ... }` | **Tailwind v4** CSS-based config (v3 uses JS config only) |
| `tailwind.config.ts` | Plain JS object with `extend` | **Tailwind v3** JS config style |

**The CSS is written for Tailwind v4, but package.json installs v3, and tailwind.config.ts is written for v3. This will break.**

### Recommendation: **Upgrade to Tailwind CSS v4**

Tailwind CSS v4 is already stable and released.

### What Would Need to Change

| File | Change | Reason |
|---|---|---|
| `apps/desktop/renderer/package.json` | Change `"tailwindcss": "^3.4.17"` → `"tailwindcss": "^4.0.0"` | Install v4 |
| `apps/desktop/renderer/tailwind.config.ts` | **Delete this file entirely** | Tailwind v4 uses CSS-based config (`@theme` blocks), not JS config |
| `apps/desktop/renderer/postcss.config.js` | No change needed | Already correct for v4 (`@tailwindcss/postcss`) |
| `apps/desktop/renderer/src/styles/globals.css` | No change needed | Already correct for v4 |

**Impact:** Delete 1 file, change 1 version number in `package.json`. The CSS is already written for v4. No component code changes needed.

**Status:** **Blocks frontend build.** Must be fixed before you can run the app.

---

## Summary of Required Changes

| Priority | Change | Files | Blocks? |
|---|---|---|---|
| 1 | `pnpm install` (no `node_modules` exist anywhere) | — | **Yes — blocks everything** |
| 2 | Fix Tailwind mismatch (v3→v4) | `package.json` (1 version), delete `tailwind.config.ts` | **Yes — blocks frontend build** |
| 3 | Upgrade EF Core 9→10 | `.csproj` (5 version numbers) | No — works now, fix before Step 2 |

---

## Manual Verification Procedure

### Prerequisites

Ensure these are installed on your machine:

| Tool | Required Version | Your Version | Status |
|---|---|---|---|
| Node.js | ≥ 18 | v24.12.0 (LTS: Iron) | OK |
| pnpm | ≥ 8 | v11.22.0 | OK |
| .NET SDK | 10.0 | 10.0.400 | OK |
| PostgreSQL | 12+ | (check with `psql --version`) | Verify |
| Git | any | (check with `git --version`) | Verify |

---

## A. Frontend Verification

### Commands

```bash
# Step 1: Open terminal in the project root
E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new

# Step 2: Install all workspace dependencies
pnpm install

# Step 3: Go to renderer
cd apps\desktop\renderer

# Step 4: Start the Vite dev server
pnpm dev
```

### What You Should See

- Terminal shows: `VITE v6.x.x ready in XXX ms`
- Terminal shows: `➜ Local: http://localhost:5173/`
- No red error messages in the terminal

### Success

Open `http://localhost:5173` in a browser. You should see:
- The Car Spa Management login screen
- Stitch-style UI (clean, professional, dark or light themed form)
- "Car Spa Management" branding

### Failure

| Symptom | Likely Cause |
|---|---|
| Red error about `@tailwindcss/postcss` not found | Tailwind v3 installed but CSS expects v4 — needs the v4 upgrade |
| Red error about `tailwindcss` not found | `pnpm install` not run |
| Blank white page | Check browser DevTools console for errors |
| Page loads but no styling (unstyled HTML) | Tailwind CSS not processing — version mismatch |
| Port 5173 already in use | Another process is using the port. Kill it or change the port in `vite.config.ts` |

---

## B. Electron Desktop Application

### Prerequisites

- Terminal 1 must still be running the Vite dev server (from step A above)

### Commands

```bash
# Step 1: Open a NEW terminal in:
E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\apps\desktop\electron

# Step 2: Install electron dependencies
pnpm install

# Step 3: Start Electron
pnpm electron:dev
```

> **Note:** If `electron/package.json` does not exist, it needs to be created first with `electron` and `electron-builder` as dependencies plus a start script.

### What You Should See

- An Electron window opens (approximately 1400×900 pixels)
- DevTools open automatically in the window
- The React app loads from `http://localhost:5173`
- You see the login screen

### Success

- Electron window opens and stays open
- React app renders correctly (login screen visible)
- After mock login: sidebar appears on the left, header at the top, page content in the main area
- Navigation works: clicking sidebar items switches pages
- All 9 module pages load: Dashboard, Customers, Job Cards, Quotations & Invoices, Catalogue, Staff Advances, Reports, Showroom, Settings

### Failure

| Symptom | Likely Cause |
|---|---|
| Electron window doesn't open | Check Electron terminal for errors. Most likely missing `electron/package.json` |
| Window opens but shows "Cannot GET /" | Vite dev server not running on port 5173 |
| Window opens but is blank/white | React app has an error — check DevTools console |
| Window opens but no styling | Same Tailwind v3/v4 mismatch as frontend |
| Window opens and closes immediately | Electron process crashed — check terminal output |

---

## C. ASP.NET Core API

### Commands

```bash
# Step 1: Open terminal in:
E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backend\api\CarSpaManagement.Api

# Step 2: Restore NuGet packages
dotnet restore

# Step 3: Run the API
dotnet run --urls http://localhost:5000
```

### What You Should See

Console output similar to:
```
info: CarSpaManagement.Api[0]
 Starting Car Spa Management API
info: Microsoft.Hosting.Lifetime[0]
 Application started. Press Ctrl+C to shut down.
info: Microsoft.Hosting.Lifetime[1]
 Hosting environment: Development
info: Microsoft.Hosting.Lifetime[0]
 Content root path: E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backend\api\CarSpaManagement.Api
```

The API will be available at `http://localhost:5000`

### Success

- API starts without build errors or runtime exceptions
- Swagger UI loads at `http://localhost:5000/swagger`
- You see the Swagger page with the `/api/health` endpoint listed

### Failure

| Symptom | Likely Cause |
|---|---|
| Build errors about missing packages | Run `dotnet restore` first |
| `NETSDK1083` or framework error | .NET 10 SDK not properly installed. Verify with `dotnet --version` |
| `ERR_CONNECTION_REFUSED` on swagger | API failed to start — check terminal for exception details |
| App starts but health check fails | PostgreSQL not running (expected — see section D below) |
| `CS0117` or `CS1061` compile errors | Code has bugs — report the exact error message |

---

## D. PostgreSQL Connectivity

### Prerequisites

- PostgreSQL must be installed on your machine
- The API must be running (from step C above)

### Commands

```bash
# Step 1: Verify PostgreSQL is installed and running
psql --version
pg_ctl status

# Step 2: If PostgreSQL is not running, start it:
# Option A — Windows Services:
# Open services.msc, find "PostgreSQL", right-click → Start

# Option B — Command line:
pg_ctl start -D "C:\Program Files\PostgreSQL\<version>\data"

# Step 3: Create the database (if it doesn't exist yet)
psql -U postgres -c "CREATE DATABASE carspa_management;"

# Step 4: With the API running, test the health endpoint:
curl http://localhost:5000/api/health
```

### What You Should See (PostgreSQL Running)

```json
{
 "status": "Healthy",
 "checks": [
 {
 "component": "postgres",
 "status": "Healthy",
 "description": null
 }
 ]
}
```

### What You Should See (PostgreSQL NOT Running)

```json
{
 "status": "Unhealthy",
 "checks": [
 {
 "component": "postgres",
 "status": "Unhealthy",
 "description": "28P01: password authentication failed for user \"postgres\""
 }
 ]
}
```

> **Note:** The "Unhealthy" result when PostgreSQL is offline is **expected and correct behavior**. The health check endpoint is working — it's just reporting that the database is unreachable.

### Success

- API returns JSON response
- PostgreSQL check shows `"status": "Healthy"`
- No connection errors

### Failure

| Symptom | Likely Cause |
|---|---|
| `connection refused` | PostgreSQL is not running. Start it. |
| `password authentication failed for user "postgres"` | PostgreSQL is running but the password in `appsettings.json` is wrong. Fix the password or update the connection string. |
| `database "carspa_management" does not exist` | Run `CREATE DATABASE carspa_management;` in psql |
| `FATAL: role "postgres" does not exist` | PostgreSQL superuser has a different name. Check with `psql -l` and update the connection string. |

---

## Quick-Start: Skip PostgreSQL, Verify App Shell Only

If you want to verify the UI without setting up PostgreSQL:

```bash
# Terminal 1 — Frontend only:
cd E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new
pnpm install
cd apps\desktop\renderer
pnpm dev

# Then open http://localhost:5173 in any browser
```

This verifies: routing, sidebar, header, all 9 pages, Stitch visual language, and component rendering — without needing the backend or database.

---

## Installed Tool Versions (Verified)

| Tool | Version | Status |
|---|---|---|
| Node.js | v24.12.0 (LTS: Iron) | OK |
| pnpm | v11.22.0 | OK |
| .NET SDK | 10.0.400 | OK |
| Electron | 34.3.0 | Configured |
| PostgreSQL | (not verified yet) | Verify manually |

---

*This document is for pre-verification analysis only. No code changes have been made. Awaiting your manual verification results.*
