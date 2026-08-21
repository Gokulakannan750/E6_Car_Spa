# Phase 3A — Stitch UI Inspection Report

**Phase:** Backend Phase 3A — Job Card UI ↔ API Integration (Pre-Implementation Inspection)
**Date:** 2026-08-19
**Status:** STOPPED — Awaiting decisions on mismatches before implementation

---

## 1. Exact Stitch File Containing New Job Card UI

**File:** `stitch_car_spa_management_suite/new_job_card_no_staff/code.html`

The filename `new_job_card_no_staff` explicitly confirms: **no staff selection** in this workflow. This is the authoritative visual source of truth for the New Job Card screen.

---

## 2. Stitch Screen Structure

```
┌──────────────────────────────────────────────────────┐
│ SIDEBAR (fixed, w-64, bg-primary-container #1a1c1e) │
│ - CAR SPA logo │
│ - Navigation: Dashboard, Job Cards, Quotations... │
│ - Job Cards is ACTIVE (blue left border) │
├──────────────────────────────────────────────────────┤
│ HEADER (sticky, h-16, border-b) │
│ - "CAR SPA MANAGEMENT" brand │
│ - Global search input │
│ - Notifications bell + New Job Card button + │
│ Add Customer button + User avatar │
├──────────────────────────────────────────────────────┤
│ MAIN CONTENT (scrollable, p-8 desktop) │
│ │
│ ┌─ Page Header ──────────────────────────────────┐ │
│ │ "New Job Card" (headline-lg, bold) │ │
│ │ "Job Card Number: JC-2026-00458" (with tag) │ │
│ │ [Cancel] │ │
│ └─────────────────────────────────────────────────┘ │
│ │
│ ┌─ Stepper ──────────────────────────────────────┐ │
│ │ ① Customer & Vehicle (ACTIVE, blue) │ │
│ │ │───────│ │ │
│ │ ② Services (grey) │ │
│ │ │───────│ │ │
│ │ ③ Review (grey) │ │
│ └─────────────────────────────────────────────────┘ │
│ │
│ ┌─ Step 1: Customer & Vehicle ──────────────────┐ │
│ │ ┌──────────────┐ ┌──────────────┐ │ │
│ │ │ LEFT COLUMN │ │ RIGHT COLUMN │ │ │
│ │ │ │ │ │ │ │
│ │ │ Select │ │ Reg Number * │ │ │
│ │ │ Customer * │ │ Odometer * │ │ │
│ │ │ [search...] │ │ Fuel Level │ │ │
│ │ │ │ │ Expected │ │ │
│ │ │ Select │ │ Delivery * │ │ │
│ │ │ Vehicle * │ │ │ │ │
│ │ │ [dropdown] │ │ │ │ │
│ │ │ (disabled) │ │ │ │ │
│ │ │ │ │ │ │ │
│ │ │ [+ Create │ │ │ │ │
│ │ │ new │ │ │ │ │
│ │ │ customer] │ │ │ │ │
│ │ └──────────────┘ └──────────────┘ │ │
│ └─────────────────────────────────────────────────┘ │
│ │
│ ┌─ Step 2: Services ────────────────────────────┐ │
│ │ [Search services...] [+ Add Service] │ │
│ │ ┌──────────────────────────────────────────┐ │ │
│ │ │ Service Name | Qty | Rate | Disc | Tax │ │ │
│ │ │ | | | | |Tot│ │ │
│ │ │ Premium Wash | [1] | 45.00| [0] | 10% |49.5│ │
│ │ │ Interior Cln | [1] | 80.00| [5] | 10% |82.5│ │
│ │ └──────────────────────────────────────────┘ │ │
│ │ ┌──────────────────────┐ │ │
│ │ │ Subtotal │ │ │
│ │ │ Discount │ │ │
│ │ │ Tax │ │ │
│ │ │ TOTAL │ │ │
│ │ └──────────────────────┘ │ │
│ └─────────────────────────────────────────────────┘ │
│ │
│ ┌─ Step 3: Review ─────────────────────────────┐ │
│ │ ┌─────────────────┐ ┌─────────────────────┐ │ │
│ │ │ Customer&Vehicle│ │ Services Summary │ │ │
│ │ │ - Customer: │ │ - Premium Wash $49 │ │ │
│ │ │ - Vehicle: │ │ - Interior Cln $82 │ │ │
│ │ │ - Reg No: │ │ │ │ │
│ │ │ - Odometer: │ │ Subtotal: $125 │ │ │
│ │ │ - Delivery: │ │ Discount: -$5 │ │ │
│ │ │ │ │ Tax: $12 │ │ │
│ │ │ Inspection: │ │ FINAL: $132 (blue) │ │ │
│ │ │ - Damages: │ │ │ │ │
│ │ │ - Complaint: │ │ │ │ │
│ │ └─────────────────┘ └─────────────────────┘ │ │
│ └─────────────────────────────────────────────────┘ │
│ │
│ ┌─ Bottom Action Bar ───────────────────────────┐ │
│ │ [Save Draft] [Create Job Card ✓] │ │
│ └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 3. Existing UI Fields

### Customer Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Search customer | text input | No | Placeholder: "Search by name, phone, or email..." |
| Create new customer | button (text link) | — | Opens inline new customer form |

### Vehicle Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Select Vehicle | dropdown | Yes | Disabled until customer selected |
| Helper text | — | — | "Please select a customer to view their registered vehicles." |

### Vehicle Details (Right Column)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Registration Number | text input (uppercase) | Yes | Placeholder: "e.g. MH-01-AB-1234" |
| Current Odometer (KM) | number input | Yes | Suffix: "KM" |
| Fuel Level | range slider (0-100) | No | Default: 50%, shows "Full" label |
| Expected Delivery Date | datetime-local | Yes | — |

### Services Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Search services | text input | No | Placeholder: "Search services..." |
| Add Service | button (primary) | — | Opens service selection |
| Service Name | table cell | — | Readonly display |
| Qty | number input | — | Min=1, editable |
| Rate ($) | table cell | — | Readonly display (catalogue price) |
| Discount ($) | number input | — | Min=0, editable |
| Tax (%) | table cell | — | Readonly display |
| Total ($) | table cell | — | Calculated display |
| Delete | button (red, trash icon) | — | Removes service row |

### Totals Panel
| Field | Notes |
|-------|-------|
| Subtotal | Sum of (Rate × Qty) |
| Discount | Sum of all discounts (shown as negative) |
| Tax | Calculated on (Subtotal - Discount) |
| Total | Subtotal - Discount + Tax (bold, secondary color) |

### Review Section
| Card | Fields |
|------|--------|
| Customer & Vehicle | Customer, Vehicle, Reg No, Odometer, Expected Delivery |
| Inspection & Complaint | Damages Reported, Complaint text |
| Services Summary | Each service line item + subtotal/discount/tax/final estimate |

### Action Bar
| Button | Style |
|--------|-------|
| Save Draft | secondary button |
| Create Job Card | primary blue + check_circle icon |

---

## 4. Existing Buttons/Actions

| Button | Style | Location | Icon |
|--------|-------|----------|------|
| Cancel | border, grey text | Page header | — |
| Create new customer | text link, blue | Customer section | add |
| Add Service | primary blue | Services section | add |
| Save Draft | secondary | Bottom bar | — |
| Create Job Card | primary blue | Bottom bar | check_circle |

---

## 5. Stitch UI → Backend API Mapping

| Stitch UI Element | Backend API | Status |
|-------------------|-------------|--------|
| Customer search by phone | `GET /api/customers/by-phone/{phoneNumber}` | ✅ Exists |
| Customer search by name/email | No endpoint | ❌ **MISSING** |
| Vehicle dropdown | `GET /api/vehicles/by-customer/{customerId}` | ✅ Exists |
| Create new customer | `POST /api/customers` | ✅ Exists |
| Create new vehicle | `POST /api/vehicles` | ✅ Exists |
| Service catalogue | `GET /api/services` | ✅ Exists |
| Create new service | `POST /api/services` | ✅ Exists |
| Create Job Card | `POST /api/job-cards` | ✅ Exists (but missing fields) |
| Save Draft | No draft status | ❌ **MISSING** |

---

## 6. Mismatches Between Stitch UI and Backend API

### CRITICAL — Backend DTOs Missing Fields

The backend `CreateJobCardRequest` DTO is missing fields that the Stitch UI requires:

| Stitch Field | Backend CreateJobCardRequest | Impact |
|--------------|------------------------------|--------|
| Registration Number | ❌ Not present | Cannot store vehicle reg number at job card level |
| Current Odometer (KM) | ❌ Not present | Cannot track vehicle condition at intake |
| Fuel Level | ❌ Not present | Cannot record fuel level |
| Expected Delivery Date | ❌ Not present | Cannot schedule delivery |
| Complaint/Damages | ❌ Not present (Notes exists but not structured) | Cannot store inspection details |
| Inspection data | ❌ Not present | No inspection tracking |

### MODERATE — UI/API Behavioral Mismatches

| Issue | Stitch UI | Backend | Resolution Needed |
|-------|-----------|---------|-------------------|
| Customer search | "Search by name, phone, or email" | Only `by-phone` endpoint | Need to add `by-name` endpoint or handle in UI |
| Services table | Editable Rate, Discount, Tax | Backend uses catalogue price + per-service discount | UI must show catalogue price, allow discount only |
| "Save Draft" button | Present in Stitch | No draft status in backend | Either remove button or add draft status to backend |
| 3-step wizard | Stepper with 3 steps | Single POST endpoint | UI can be wizard or single form |
| "Create new customer" | Inline form expected | Separate POST required | Need inline customer creation form in UI |
| Vehicle creation | Implied in "Create new customer" flow | Separate POST /api/vehicles required | Need inline vehicle creation form in UI |

### MINOR — Presentation Differences

| Issue | Stitch | Backend |
|-------|--------|---------|
| Currency symbol | Shows `$` (USD) | Backend has no currency field |
| Tax display | Shows "Tax (10%)" as column | Backend stores `TaxPercentage` per service |
| Discount | Shows as editable `$` input | Backend stores `DiscountAmount` per service |

---

## 7. Key Decisions Required Before Implementation

### Decision 1: Add Missing Fields to Backend DTOs?
**Fields needed:** RegistrationNumber, Odometer, FuelLevel, ExpectedDeliveryDate, Notes (complaint)
- **Option A:** Add to `CreateJobCardRequest` — requires backend changes
- **Option B:** Remove from Stitch UI — violates "Do NOT redesign the UI"
- **Option C:** Add to JobCard entity — requires migration

### Decision 2: Customer Search by Name/Email?
- **Option A:** Add `GET /api/customers/by-name/{name}` endpoint
- **Option B:** Use `GET /api/customers?search={query}` and filter client-side
- **Option C:** Keep phone-only search (deviates from Stitch)

### Decision 3: "Save Draft" Button?
- **Option A:** Add `Draft` status to JobCardStatus enum
- **Option B:** Remove from UI (deviates from Stitch)
- **Option C:** Keep button but make it non-functional placeholder

### Decision 4: Wizard vs Single Page?
- **Option A:** 3-step wizard matching Stitch exactly
- **Option B:** Single-page form (simpler, matches current React patterns)
- **Option C:** Hybrid — sections on one page, stepper as visual only

### Decision 5: Currency Symbol?
- **Option A:** Use ₹ (INR) — this is an Indian car spa
- **Option B:** Use $ to match Stitch
- **Option C:** Make configurable

### Decision 6: Customer Creation Flow?
- **Option A:** Inline form within New Job Card page
- **Option B:** Navigate to Customers page (violates workflow requirement)
- **Option C:** Modal dialog

---

## 8. Existing Frontend Architecture Summary

### Files Found (All Placeholders)

| File | Status |
|------|--------|
| `apps/desktop/renderer/src/features/job-cards/NewJobCard.tsx` | **PLACEHOLDER** |
| `apps/desktop/renderer/src/features/job-cards/JobCards.tsx` | **PLACEHOLDER** |
| `apps/desktop/renderer/src/features/job-cards/JobCardDetails.tsx` | **PLACEHOLDER** |

### Existing Infrastructure

| Component | Status |
|-----------|--------|
| React Router | ✅ Configured (`/job-cards/new` → NewJobCard) |
| Design Tokens | ✅ `packages/design-tokens/src/tokens.ts` |
| Global CSS | ✅ Tailwind v4 with component classes (btn-primary, kpi-card, data-card, status-badge, etc.) |
| Material Symbols | ✅ Configured |
| Electron | ✅ Dev server on port 5173 |

### Missing Infrastructure

| Component | Status |
|-----------|--------|
| API client | ❌ None exists |
| fetch wrapper | ❌ None exists |
| Service layer | ❌ None exists |
| API hooks | ❌ None exists |
| Zustand stores | ❌ None exists |
| Environment config | ❌ No .env files |
| React Query | ✅ Package installed, not configured |

### Available Libraries (in package.json)

| Library | Version | Status |
|---------|---------|--------|
| @tanstack/react-query | v5.59 | ✅ Installed, not configured |
| @tanstack/react-table | v8.17 | ✅ Installed |
| zustand | v5.0 | ✅ Installed |
| react-hook-form | v7.54 | ✅ Installed |
| @hookform/resolvers | v3.9 | ✅ Installed |
| zod | v3.23 | ✅ Installed |
| recharts | v2.13 | ✅ Installed |
| lucide-react | v0.468 | ✅ Installed |
| material-symbols | v0.20 | ✅ Installed |

---

## 9. Backend API Confirmed Working

| Endpoint | Status |
|----------|--------|
| `GET /api/health` | ✅ Healthy |
| `GET /api/customers` | ✅ Returns all customers |
| `GET /api/customers/{id}` | ✅ Works |
| `GET /api/customers/by-phone/{phoneNumber}` | ✅ Returns customer or 404 |
| `POST /api/customers` | ✅ Creates customer |
| `GET /api/vehicles` | ✅ Returns all vehicles |
| `GET /api/vehicles/by-customer/{customerId}` | ✅ Returns customer vehicles |
| `POST /api/vehicles` | ✅ Creates vehicle |
| `GET /api/services` | ✅ Returns services (paginated) |
| `POST /api/services` | ✅ Creates service |
| `GET /api/job-cards` | ✅ Returns list (empty currently) |
| `GET /api/job-cards/{id}` | ✅ Works |
| `POST /api/job-cards` | ✅ Creates job card |
| `PUT /api/job-cards/{id}/services` | ✅ Updates services |
| `DELETE /api/job-cards/{id}` | ✅ Soft deletes |

**API Base URL:** `http://localhost:5298`

---

## 10. Recommended Implementation Plan (Pending Decisions)

Once decisions are made on the 6 open items above:

1. Create API client (`apps/desktop/renderer/src/lib/api-client.ts`)
2. Create React Query client setup
3. Create TypeScript types matching backend DTOs
4. Implement NewJobCard.tsx following Stitch UI exactly:
 - Step 1: Customer & Vehicle (with inline creation)
 - Step 2: Services (with inline service creation)
 - Step 3: Review & Summary
 - Bottom action bar

---

## 11. Next Steps

**Awaiting your decisions on:**
1. Missing backend fields — add to DTO or remove from UI?
2. Customer search by name — add endpoint or use existing search?
3. Save Draft — implement or remove?
4. Wizard vs single page?
5. Currency symbol — ₹ or $?
6. Customer creation flow — inline, modal, or navigate?
