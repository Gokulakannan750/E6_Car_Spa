# Project Inspection Report — CAR SPA MANAGEMENT

**Date:** 2025-08-19
**Inspector:** Claude Fable 5
**Project:** E6_Car_spa_new

---

## 1. Project Files and Folders

The project root is `E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\`. It contains:

### Structure (matches CLAUDE.md plan)

- `apps/desktop/renderer/src/` — React frontend (partially built)
- `backend/api/CarSpaManagement.Api/` — ASP.NET Core API (well-structured)
- `packages/design-tokens/`, `packages/shared-types/`, `packages/shared-validation/` — placeholder packages
- `stitch_car_spa_management_suite/` — Stitch design export (11 screens)
- `tests/` — placeholder test directories
- Root `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `CLAUDE.md`

### Backend (well-built foundation)

- `Program.cs` — ASP.NET Core 10 app
- `Domain/` — Entities (`Customer`, `Vehicle`, `JobCard`, `JobCardService`, `Service`) + `BaseEntity` + `JobCardStatus` enum (8 values: Draft → Delivered + Cancelled)
- `Application/DTOs/` — Full DTO records for all entities, including `JobCardListDto`, `JobCardListResponse` with pagination
- `Application/Interfaces/` — Service interfaces
- `Application/Services/` — Implemented services with full CRUD + search + filtering
- `Infrastructure/` — EF Core `AppDbContext`, Fluent API configurations, DI setup
- `Controllers/` — REST controllers: Customers, Vehicles, Services, JobCards (with all CRUD endpoints, search, filters, pagination), Health
- `Migrations/` — Initial migration + model snapshot

**Status:** Backend is solid. Job Cards API fully implemented with search, status filter, customer/vehicle filter, date range, pagination. Ready to serve data.

### Frontend (partial implementation)

- `src/lib/api.ts` — Complete API client with all types, 6 API functions (customers, vehicles, services, job cards)
- `src/App.tsx` — Router setup with all routes
- `src/features/job-cards/` — 4 files:
 - `JobCards.tsx` — Simple placeholder
 - `JobCardsPage.tsx` — **Partially implemented** table with mock data, status filters, search bar, pagination, action buttons. Has hardcoded Indian Rupee currency (₹) which conflicts with Stitch's USD ($).
 - `JobCardDetails.tsx` — Placeholder only
 - `NewJobCard.tsx` — **Fully implemented** with phone search, customer/vehicle selection, service selection, calculations. Uses real API calls.
- Other features (dashboard, customers, etc.) — placeholders only
- No Electron shell, no sidebar layout, no design system setup yet

---

## 2. All Stitch Screens Found

11 screens in `stitch_car_spa_management_suite/`:

| # | Screen Folder | Screenshot | code.html |
|---|---|---|---|
| 1 | `main_dashboard/` | ✅ | ✅ |
| 2 | `customer_management/` | ✅ | ✅ |
| 3 | `job_card_management_table_view/` | ✅ | ✅ |
| 4 | `job_card_details_jc_2026_00458/` | ✅ | ✅ |
| 5 | `new_job_card_no_staff/` | ✅ | ✅ |
| 6 | `quotations_invoices/` | ✅ | ✅ |
| 7 | `reports_analytics_dashboard/` | ✅ | ✅ |
| 8 | `service_catalogue/` | ✅ | ✅ |
| 9 | `settings_module/` | ✅ | ✅ |
| 10 | `staff_advances_management/` | ✅ | ✅ |
| 11 | `velocity_enterprise/` | ✅ | ✅ |

Plus a `DESIGN.md` (the design spec/enterprise reference).

---

## 3. Stitch Design Documentation

**`velocity_enterprise/`** — This is the design reference system. It contains:
- `code.html` — Full design system with Tailwind config, colors, typography, spacing, components
- `screen.png` — Visual reference

### Design Tokens (consistent across all screens)

**Colors (Material Design 3 inspired):**
- Primary: `#000101` (near-black)
- Primary Container: `#1a1c1e` (dark charcoal)
- Secondary: `#0453cd` (blue)
- Secondary Container: `#356ee7` (lighter blue — used for active nav)
- Surface: `#f8f9fa`
- Surface Container variants: lowest `#ffffff`, low `#f3f4f5`, high `#e7e8e9`, highest `#e1e3e4`
- Background: `#f8f9fa`
- Error: `#ba1a1a`
- Outline: `#75777a`
- On-surface variants for text hierarchy

**Typography (Inter font):**
- `headline-lg`: 32px/40px, weight 600
- `headline-md`: 24px/32px, weight 600
- `headline-sm`: 20px/28px, weight 600
- `body-md`: 16px/24px, weight 400
- `body-sm`: 14px/20px, weight 400
- `label-md`: 12px/16px, weight 600, letter-spacing 0.05em (uppercase labels)
- `display-lg`: 48px/56px, weight 700

**Spacing:**
- `margin-desktop`: 32px
- `gutter`: 24px
- Base scale: xs=8, sm=12, md=16, lg=24, xl=32

**Border Radius:**
- DEFAULT: 4px, lg: 8px, xl: 12px, full: 9999px

**Icons:** Material Symbols Outlined (filled variant used for active states)

---

## 4. Generated HTML/CSS Files

Every Stitch screen has a `code.html` with embedded Tailwind config. Key findings:

- All use the **same consistent design system** (colors, typography, spacing)
- Sidebar is identical across all screens: `w-64`, fixed, `primary-container` background, Material Symbols icons
- Header is consistent: `h-16`, sticky, search bar (left or center), action buttons (right)
- Card pattern: `rounded-xl`, `border border-outline-variant`, `shadow-sm`, `bg-surface-container-lowest`
- Table pattern: `border-collapse`, uppercase `label-md` headers, `body-md` rows, hover states
- Status badges: pill-shaped, `rounded-full`, colored backgrounds with borders

---

## 5. Assets

- Logo: Car Spa geometric logo (in sidebar of some screens)
- Vehicle/type icons: Material Symbols
- User avatars: Google-hosted placeholder images
- Photo gallery images: High-quality automotive detailing photos in Job Card Details
- All assets are Google-hosted URLs (not local files) — appropriate for Stitch mockups

---

## 6. Stitch Export Sufficiency

**Yes, the export is sufficient** to reproduce the approved UI. You have:
- 11 complete screen mockups with exact HTML/CSS
- Consistent design tokens across all screens
- Every navigation item, button, card, table, and form element represented
- The Job Card Management table view gives the exact table structure needed
- The Job Card Details screen shows the bento grid layout, timeline, and photo gallery
- The New Job Card (no staff) screen shows the customer/vehicle/service flow

---

## 7. Missing Files / Potential Problems

### Gaps to address

1. **Electron shell not built** — No `electron/` directory, no `main.ts`, no `preload.ts`, no `package.json` for the renderer
2. **No design token package** — `packages/design-tokens/` exists but is empty. Need to extract Stitch tokens into a shared package
3. **No shadcn/ui setup** — Components not installed
4. **No Zustand, TanStack Query, React Hook Form, Zod, TanStack Table, Recharts** — Listed in CLAUDE.md but not installed
5. **Currency mismatch** — Stitch uses USD ($), existing `JobCardsPage.tsx` mock data uses INR (₹), `api.ts` uses `toLocaleString('en-IN')`. Should standardize to one currency.
6. **JobCardDetails.tsx** is a placeholder — needs full implementation matching the Stitch bento grid
7. **No layout components** — No Sidebar, Header, or AppShell components yet
8. **No Electron builder config** — For packaging as `.exe`
9. **Missing screens from Stitch export**: "Showroom" — No dedicated Showroom screen folder found. Listed as a nav item but no corresponding Stitch screen directory.

---

## 8. Architecture Understanding

### Electron Desktop (Windows .exe)

- Electron main process → preload script (contextBridge) → React renderer (contextIsolation, no nodeIntegration)
- React renderer communicates ONLY via HTTP to backend API
- React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Lucide icons

### Backend (ASP.NET Core 10)

- Clean architecture: Controllers → Application Services → Domain Entities → Infrastructure (EF Core + PostgreSQL)
- DTOs for all API responses (no direct entity exposure)
- Fluent API configurations
- Initial migration exists
- Controllers: Customers, Vehicles, Services, JobCards (with full CRUD + search + pagination), Health

### Database

- PostgreSQL via Npgsql
- EF Core DbContext with Fluent API
- Initial migration created
- Core entities: Customer, Vehicle, JobCard, JobCardService, Service
- 8-step JobCardStatus enum (Draft → Delivered)

### Communication Flow

```
Electron Renderer (React)
 ↓ HTTP/REST
ASP.NET Core API (Controllers → Services → DbContext)
 ↓
PostgreSQL
```

### Future Android App

Will consume the same API — the API design is already compatible.

---

## Summary

The backend is well-built and ready. The Stitch design export is complete and consistent. The frontend has the API client wired up and a partial Job Cards page, but the full application shell, layout system, and most feature pages need to be built. The main risk area is the missing Showroom Stitch screen.
