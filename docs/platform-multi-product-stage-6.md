# Stage 6 — Multi-product admin portal

Status: **complete**. The forced build and all three final sequential baseline runs passed with zero failures or skips. Branch: `platform-multi-product`. Work is limited to Stage 6. No Stage 7+, push, merge, or change to main.

## Changes by screen

- **Product context/top bar:** GET `/api/platform/products` loads once per authenticated application session through a cached query. A single product is selected automatically and the selector is hidden. Multiple products expose a top-bar selector and All products. Tab preference uses sessionStorage with guarded reads/writes. Product changes remount screen form state and use separate query cache keys. All blocks new-company input and catalog/settings editing until a product is chosen. Lists remain readable.
- **Companies/dashboard:** list and dashboard requests carry the selected product; mixed company rows and dashboard attention/activity identify their products. Company creation explicitly sends the product. Detail/change dialogs resolve the company's own product, including when opened from All. Catalog lookups cannot borrow another product's plans. Existing reason and owner-approval flows remain.
- **Seats/subscriptions:** UI pricing, quantities, bought-versus-used counts and proposals read generic seats arrays. Writes send a seats object. None has no seat controls/minimum and shows Unlimited seats; Counted shows its single named stepper; PerType renders active definitions in configured order. Actual plan minimums block invalid submits. The persisted default marker preserves Car Spa's one Both seat without product codes in UI logic. Company fees, intervals, live totals and add-ons retain their calculations.
- **Plans/add-ons:** product required on every catalog call. Plan/version price fields use seatPrices per seat definition, with company fee separate from the seat-code dictionary. Boolean entitlement controls and feature labels come from product definitions; unknown labels fall back to their raw keys. Add-on feature choices come from that product, with validation and server errors retained. None hides seat prices/minimum controls. Price history reads generic seat rows.
- **System/settings:** selected product is named in the settings header. Reads/writes are per product. Trial seat quantity is hidden for None and uses the seat term for Counted/PerType. Franchise settings require its capability. Migrations list product badges and use `(productKey, code)` row keys. Run migrations targets only the selected product; Run for all products has an explicit confirmation saying external commands will run. Different schema versions are compared within each product, avoiding a false behind warning merely because products have different schemas.
- **Sign-ups/invoices/audit:** selected product is sent on list requests; mixed rows show a Product column/badge. Sign-up seat counts use generic arrays and None is unlimited. Existing payment, print, CSV and reason workflows remain. Company CSV appends product identity while preserving its existing leading fields.
- **Responsive layout:** compact labeled/icon navigation and top-bar sizing support phone width. Tables scroll horizontally inside their containers; positioned action headers keep hidden accessible labels inside those containers.

`src/lib/catalog.ts` no longer contains FEATURE_LABELS, BOOLEAN_FEATURES, APP_ACCESS or app/platform names. Product and seat types and scoped requests live in `src/lib/types.ts` and `src/lib/api.ts`; context is in `src/features/products/ProductProvider.tsx`.

## Strictly required additive backend fixes

1. GET `/api/platform/companies/{id}` now adds productKey and seatUsage (`code`, `name`, `quantity`, `priceMinor=0`). The existing per-type usage reader is projected at the backend compatibility boundary. Bought prices remain in subscription.seats. Unknown/unavailable usage remains null; no new external business-database reader was introduced. Existing licencesUsed, licences, licencePrices and other response fields are unchanged.
2. GET `/api/platform/products` includes defaultSeat on each seat definition. This exposes the already-persisted Stage 3 follow-up marker so the portal can preserve the Car Spa default without embedding a code.

Existing HTTP coverage gains assertions for exact generic usage quantities, company product identity, and the default marker, alongside all original compatibility assertions. No entity, migration, schema, billing amount, sign-up website, Windows/Android implementation or design file changed.

The API's existing settings field trialLicences and plan minimum field minimumLicences retain their contract names; their UI labels/meaning are generic. The portal no longer reads/writes the fixed licences object, licencePrices object, or Android/Windows/Both price columns.

## Test counts and before/after evidence

| Check | Stage 0 | Before Stage 6 (Stage 3 follow-up) | Stage 6 |
| --- | ---: | ---: | ---: |
| Backend tests | 1313 | 1353 | 1353 (same count; existing HTTP tests extended) |
| Admin unit | 21 | 21 | 27 (six added) |
| Admin mocked browser | 4 | 4 | 12 (eight added; original four retained) |
| Signup unit | 7 | 7 | 7 (unchanged) |
| Existing live Car Spa scenarios | Not baseline-run | Not baseline-run | 9 passed, 0 skipped (4.3m) |
| New live Demo/screenshots | — | — | 1 passed, 0 skipped (1.3m) |

All numeric assertions remain. The two existing frontend request-body checks change only the contract key from licences to seats and keep the exact quantities. Fixtures now supply product definitions and generic seat arrays. Existing accessible stepper names remain derived from definitions. The live suite now uses the registered owner's approval API, as required by the existing application, while preserving its exact ₹17,970 yearly total, paid status, access restrictions, print, CSV and audit-reason checks. It additionally asserts the proposed plan and successful owner approval. The audit assertion follows the proposal event instead of the obsolete direct-admin-change path.

Development evidence: the focused backend usage test passed 1/1 without skips; admin unit passed 27/27; the final mocked development suite passed **12/12**, 0 failed/skipped (27.5s), including all original four flows and every mixed-list filter/badge check. An initial live attempt hit 429 because registration attempts were missing from the harness's authentication budget. Both registration attempts, password change, and an initial cold-window wait are now budgeted; no API rate limit or assertion was weakened. A development phone review caught the absolute-positioned table-label overflow; its width assertion remains unchanged and the corrected review passed before the final label refresh.

## Live setup and exact commands

The owner authorized port **5322** because another API occupied 5321. The portal used **5192**. Neither the other API nor port 5298 was stopped or used. All database names and company role prefixes are isolated under `pts6b271a8d4`; the runtime product key is deliberately unique, so company code 0001 cannot collide with a dev Car Spa database. Catalog: `pts6b271a8d4_catalog`; Demo database prefix: `pts6b271a8d4_demo`.

Credentials were supplied only through process environment variables, never saved to a file. The following commands omit their values intentionally:

```powershell
# CARSPA_TEST_PG_CONNECTION was supplied securely in this process environment.
& apps/platform-admin/e2e/live/start-test-api.ps1 -ProductKey pts6b271a8d4 -CreateOwner
& apps/platform-admin/e2e/live/start-test-api.ps1 -ProductKey pts6b271a8d4 -Port 5322
# In the portal shell:
$env:PLATFORM_API_PROXY = 'http://localhost:5322'
pnpm --dir apps/platform-admin exec vite --port 5192 --strictPort
# In the bootstrap/test shell:
$env:PLATFORM_E2E_API_URL = 'http://localhost:5322'
$env:PLATFORM_E2E_PORTAL_URL = 'http://localhost:5192'
$env:PLATFORM_E2E_PRODUCT_KEY = 'pts6b271a8d4'
$env:PLATFORM_E2E_OWNER_EMAIL = 'stage6-owner@trovo.test'
# BOOTSTRAP_PASSWORD and OWNER_PASSWORD supplied in environment, not a file.
node apps/platform-admin/e2e/live/bootstrap-owner.mjs
# Returned authenticator secret captured in memory as PLATFORM_E2E_OWNER_TOTP_SECRET.
pnpm --dir apps/platform-admin test:e2e:live
pnpm --dir apps/platform-admin exec playwright test --project=live-products
```

On resumption the throwaway owner's authenticator was reset with `start-test-api.ps1 -ProductKey pts6b271a8d4 -ResetOwner` and bootstrap was repeated; its secrets remain in memory only. The helper registers Demo using Platform__ExternalProducts__demo__... environment settings, PowerShell and the existing external-product-test.ps1/psql convention. Demo has a None seat model, basic plan, Project workspace feature and monthly/yearly fees of 1234/12340 minor units. Its company is created through the actual portal. Explicit all-product migration verifies demo-v1 and Up to date. This does not add demo business-user authentication or token trust.

Original live suite: **9 passed, 0 failed, 0 skipped**, 4.3m. Final Demo review: **1 passed, 0 failed, 0 skipped**, 1.3m. All twelve refreshed screenshots were captured and inspected. The projects are separate and use one live worker; both require explicitly provided owner credentials. Required final baseline runs use the mocked project and cannot count live skips as passes.

## Screenshots

Directory: `docs/platform-multi-product-stage-6-screenshots`. Each view has desktop **1366×768** and phone **390×844** captures. Screens were visually inspected; the live review also asserts no document-level horizontal overflow. Dense tables retain internal horizontal scrolling.

| View | Desktop | Phone |
| --- | --- | --- |
| Product selector/dashboard | [Desktop](platform-multi-product-stage-6-screenshots/desktop-product-selector.png) | [Phone](platform-multi-product-stage-6-screenshots/phone-product-selector.png) |
| Mixed company list/badges | [Desktop](platform-multi-product-stage-6-screenshots/desktop-companies-badges.png) | [Phone](platform-multi-product-stage-6-screenshots/phone-companies-badges.png) |
| New company, None | [Desktop](platform-multi-product-stage-6-screenshots/desktop-new-company-none.png) | [Phone](platform-multi-product-stage-6-screenshots/phone-new-company-none.png) |
| Plans | [Desktop](platform-multi-product-stage-6-screenshots/desktop-plans.png) | [Phone](platform-multi-product-stage-6-screenshots/phone-plans.png) |
| Product settings | [Desktop](platform-multi-product-stage-6-screenshots/desktop-settings.png) | [Phone](platform-multi-product-stage-6-screenshots/phone-settings.png) |
| Migrations | [Desktop](platform-multi-product-stage-6-screenshots/desktop-migrations.png) | [Phone](platform-multi-product-stage-6-screenshots/phone-migrations.png) |

## Final sequential gate

Owned live servers on ports 5322 and 5192 were stopped after the live checks. Forced `dotnet build backend/CarSpaManagement.slnx --no-incremental`: **passed, 0 errors, 9 pre-existing warnings**, 52.00s. Warnings are the existing duplicate using, obsolete check-constraint API, two unread public-controller parameters and five nullable test warnings. All three sequential runs of `scripts/test-platform-baseline.ps1` **passed**, each containing backend tests, admin type-check/unit/mocked browser, and signup type-check/unit. The wrapper also checked the exact pass counts and zero skips before starting the next run. There were no overlapping verification commands and no implementation or assertion changes between runs. Completion commit: `Stage 6: Multi-product admin portal`.

| Final check | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| Backend passed / failed / skipped | 1353 / 0 / 0 | 1353 / 0 / 0 | 1353 / 0 / 0 |
| Backend duration | 10m43s | 9m46s | 9m10s |
| Admin type-check | Passed | Passed | Passed |
| Admin unit | 27 passed | 27 passed | 27 passed |
| Admin mocked browser | 12 passed | 12 passed | 12 passed |
| Signup type-check | Passed | Passed | Passed |
| Signup unit | 7 passed | 7 passed | 7 passed |
| Whole baseline duration | 13m11s | 10m33s | 9m51s |

## Scope/deferred work

No Stage 7+, host split, new product implementation, role scoping or billing-policy change. Stage 3's documented legacy fallback remains untouched. Existing API compatibility fields remain for the apps and sign-up website. The port substitution above was explicitly authorized. All required Stage 6 checks passed. No requirement remains unfinished. Unrelated launcher/Flutter changes and the untracked audit source document are excluded from this stage's commit.

Raw verification logs are ignored under `backend/tests/CarSpaManagement.Api.Tests/bin/`: `stage6-forced-build.log`, `stage6-baseline-run-1.log`, `stage6-baseline-run-2.log`, `stage6-baseline-run-3.log`, `stage6-live-retry.log`, `stage6-live-product-review-final.log`, `stage6-backend-focused.log`, and `stage6-mocked-final-development.log`. The original live suite passed nine scenarios; the separate final product review passed one. Neither result includes skipped tests. The twelve PNGs are included explicitly as report artifacts despite the repository's general PNG ignore rule.

The isolated live catalog and company databases are retained under the documented test prefix for review; only the owned live API/portal processes were stopped. No owner's development catalog or API was used. Final report date: 16 October 2026. Questions for the owner: none. Stage 6 ends here; no later stage started.
