# Stage 7 — Multi-product public sign-up website

Date: 16 October 2026. Branch: `platform-multi-product`.
Status: **complete**. Forced build, live checks and all three final sequential baseline runs passed with zero failures/skips. No Stage 8 work, push, merge or main change.

## Changes by page

- **Routes/product chooser:** `/pricing/:productKey`, `/signup/:productKey`, and product-scoped plan/review/done routes. `/` and `/signup` automatically select the sole active product; otherwise they show product cards from the public products endpoint. Existing single-product deep links remain supported. Unknown/unavailable products get a friendly page and a chooser link.
- **Product context/state:** public API clients are bound to a product key. Every catalog, quote, franchise-code, signup, test-payment and status call carries that key. `/public/products` is the global discovery call. Query keys include the product; sessionStorage uses `trovo.signup.<productKey>`. Switching products cannot borrow business details, plans, add-ons, seats or order tokens. Initial plan/seat choices come from catalog metadata, including trialPlanCode/defaultSeat. Existing completed-order/reload behavior remains.
- **Pricing:** plan/company fees, seat price rows and feature comparisons come from the selected catalog. Feature labels use the product registry with raw-key fallback. Removed the static feature lists, module order, plan-code taglines and app-specific pricing columns. Billing interval savings use actual generic seat/company prices.
- **Business:** franchise/branch joining choices appear only with the franchise capability. Other products go straight to the business form. Existing consent, field errors, focus behavior and Indian business validation remain. Old franchise state is discarded when the product no longer offers that capability.
- **Plan:** None shows no seat section/controls/minimum and says No per-user charges. Counted has one named stepper. PerType uses the product seat types/prices/default marker and existing plan minimums. Existing accessible quantity labels are generated from the seat names. Live totals remain server quotes; Continue is disabled below minimum or while a changed choice/quote is settling. Requests send a generic seats object, never the old licences object. Add-ons use catalog names and feature labels with raw-key fallback.
- **Review:** generic named quantities, or No per-user charges, with the existing terms, refund links, test-payment warning, totals, retry and processing UI. Editing/back navigation stays within the selected product.
- **Done:** product name, trial plan name and generic seat quantities; download names/URLs come from product branding. None shows no per-user charges. Existing codes, copy/print, payment/trial status and franchise-link results remain.
- **Common branding/links:** `src/lib/config.ts` is the small keyed branding map. Baylior/carspa retain existing name, product URL, legal URLs, logo and installer-help defaults. An isolated runtime key can use VITE_BAYLIOR_PRODUCT_KEY. Unknown products use their catalog productName and generic Trovo links. VITE_PRODUCT_CONFIG accepts per-product name, copy, URLs and named downloads. Existing global VITE_* legal/product overrides remain; old Windows/Android download overrides become named entries for Baylior aliases only. See apps/signup-web/README.md for an example.
- **Accessibility/mobile/CSP:** existing semantic forms, labels, live quote region, field errors, keyboard return link and responsive containers retained. Original return-link assertions at 320/390/768/1366px remain unchanged. CSP stays restrictive; the development websocket allowance now uses Vite's actual port rather than hard-coded 5192. Production still derives the allowed API origin from VITE_API_URL. No relaxed script policy was added.

Primary code locations: apps/signup-web/src/app/App.tsx, state/product.tsx, state/signup.tsx, lib/{api,types,rules,featureNames,config}.ts, components/{Frame,JoiningChoice}.tsx and pages/{PricingPage,BusinessStep,PlanStep,ReviewStep,DonePage}.tsx.

## Additive backend changes and verified endpoints

| Endpoint | Addition/verification |
| --- | --- |
| GET `/api/public/products` | Active products only; exactly key, name, seatModel, capabilities. No IDs, database prefixes, module commands or other internal fields. Hidden when public signup is disabled. |
| GET `/api/public/catalog?product=...` | Adds productKey, seatModel string, active ordered seatTypes with defaultSeat, features (key/label/type), capabilities and trialPlanCode. Existing fields and plan seats retained. Unknown/inactive products return 4xx. Active validation is on the public controller so existing owner catalog reads are not changed. |
| POST `/api/public/signup/quote?product=...` | Rejects inactive/unknown product; quotes only its catalog. Generic seat request already supported. |
| POST `/api/public/signup?product=...` | Creation now explicitly rejects missing/inactive catalog products rather than allowing an inactive row or a SingleAsync failure. Trial and paid selection stays scoped. |
| POST `/api/public/signup/franchise-code?product=...` | Also rejects inactive products; retains runtime product plus franchise capability checks. |
| POST `/api/public/signup/{id}/status?product=...` and `/test-payment?product=...` | Optional product selection is now enforced against the order before reads/payment. Wrong product/token looks like a missing order; inactive product orders cannot be read/paid. Legacy token-only callers remain supported for active products. |

Files: backend/api/CarSpaManagement.Api/Controllers/Platform/PublicSignupController.cs; Infrastructure/Platform/{CatalogReader,SignupService}.cs. No schema/migration/new entity. Every legacy licences/licencePrices and android/windows/both response field remains. No admin portal, Windows, Android or design source changed.

`PublicMultiProductSignupTests` verifies both directions for catalog, quote, signup, order status and payment, correct amounts/product IDs after payment, exact safe public product fields, metadata/defaults, unknown/inactive rejection across all public operations, and no failed-operation side effects. Existing HTTP/signup/characterization assertions remain.

## Test counts and development evidence

| Check | Stage 0 | Before Stage 7 (Stage 6 follow-up) | Stage 7 verified |
| --- | ---: | ---: | ---: |
| Backend | 1313 | 1361 | 1363 (+2 HTTP tests) |
| Admin unit | 21 | 27 | 27 unchanged |
| Admin mocked browser | 4 | 12 | 12 unchanged |
| Signup unit | 7 | 7 | 11 (+4) |
| Signup mocked browser | Not in baseline | 15 existing scenarios, not in baseline | 21 (+6), now in baseline |
| Signup live | Not in baseline | 3 existing scenarios | 5 (+2 Demo flows) |

Existing numeric assertions are unchanged. The existing browser order assertion changes only licences to seats, with identical quantities. Fixture prices change representation to generic seat arrays; every original numeric unit assertion remains. Existing live Car Spa assertions still verify INR 1797 paid total, app registration/login, Active status, add-on entitlement, trial deduplication, franchise consent/link and granted scopes. Characterization remains 469400 / 4694000 / 729400 / 130000 / 469400; trial 0/0/3, limit 3.

Development results:
- Focused backend public/legacy/characterization: 9 passed, 0 failed/skipped; repeated after final public-controller active-check placement: 9 passed, 0 failed/skipped (42s).
- Signup type-check passed; unit 11/11; mocked browser 21/21, zero skips (17.3s).
- Reviewed signup production build passed (3.69s); offline staging-preflight 8/8 passed.
- First new mocked cases had three locator errors: the button says Fewer, not Less, and Demo's fee and total share the same amount. Fixed only the new locators, preserving the quantities and exact totals.
- First live attempt: 4 passed / 1 failed. The trace showed Continue completing at 24514ms and a generic checkbox query at 24517ms while React's route transition still exposed two plan checkboxes. Added an explicit review-page test-mode-banner wait; no assertions weakened. The next live run passed 5/5 (33.0s); after the final generic download-label review it passed 5/5 again (32.6s), with refreshed screenshots. Only the owned throwaway API was restarted between attempts to reset its rate-limit window; no API rate policy changed.

Because a live timing issue occurred during development, the final gate uses the requested fallback of **three consecutive full baseline runs**, not one. The baseline script now also runs signup-web mocked e2e; its package script selects only the mocked project so live tests cannot be silently skipped or run against a dev API.

## Live setup and exact commands

Used the existing, unchanged apps/platform-admin/e2e/live/start-test-api.ps1. New isolated prefix/runtime product **pts69c9e9788**, catalog **pts69c9e9788_catalog**, Demo database prefix **pts69c9e9788_demo**. This deliberately avoids literal carspa_t_0001 and the owner's catalogs. API **5322**, website **5192**; never used/stopped 5298 or any owner's API. PostgreSQL connection supplied in process environment only, never in a file.

```powershell
# CARSPA_TEST_PG_CONNECTION supplied securely in the process, value omitted.
$env:Platform__SignupEnabled = 'true'
$env:Platform__TestPayments = 'true'
& apps/platform-admin/e2e/live/start-test-api.ps1 -ProductKey pts69c9e9788 -Port 5322
# Website shell:
$env:SIGNUP_API_PROXY = 'http://localhost:5322'
$env:VITE_BAYLIOR_PRODUCT_KEY = 'pts69c9e9788'
pnpm --dir apps/signup-web exec vite --port 5192 --strictPort
# Test shell:
$env:SIGNUP_E2E_URL = 'http://localhost:5192'
$env:SIGNUP_E2E_PRODUCT_KEY = 'pts69c9e9788'
pnpm --dir apps/signup-web exec playwright test --project=live
```

The helper registers Demo through Platform__ExternalProducts__demo__... with SeatModel None, basic trial plan, Project workspace feature, monthly/yearly company fees 1234/12340, the existing PowerShell/psql external script and isolated database prefix. No Civil registration or Stage 8 product was added. Car Spa paid/trial and Demo paid/trial were completed from the real site. Demo paid yearly was INR 123.40 with no seat lines; both Demo trials and paid signups returned company/registration codes. Demo's external test schema has no business-user authentication; adding that belongs to its own runtime and is not claimed here.

Final live project: **5 passed, 0 failed, 0 skipped, 32.6s**, one worker. All fourteen screenshots were captured and inspected. The owned API and website listeners were stopped before the final build/baselines. The isolated databases remain for review, including companies from development attempts.

## Screenshots

Directory docs/platform-multi-product-stage-7-screenshots. Full-page captures with viewport **1366x768** and **390x844**; the live harness also asserts document width never exceeds the viewport.

| View | Desktop | Phone |
| --- | --- | --- |
| Product chooser | [Desktop](platform-multi-product-stage-7-screenshots/desktop-chooser.png) | [Phone](platform-multi-product-stage-7-screenshots/phone-chooser.png) |
| Car Spa plan | [Desktop](platform-multi-product-stage-7-screenshots/desktop-carspa-plan.png) | [Phone](platform-multi-product-stage-7-screenshots/phone-carspa-plan.png) |
| Demo plan, no seats | [Desktop](platform-multi-product-stage-7-screenshots/desktop-demo-plan.png) | [Phone](platform-multi-product-stage-7-screenshots/phone-demo-plan.png) |
| Car Spa review | [Desktop](platform-multi-product-stage-7-screenshots/desktop-review.png) | [Phone](platform-multi-product-stage-7-screenshots/phone-review.png) |
| Car Spa done | [Desktop](platform-multi-product-stage-7-screenshots/desktop-done.png) | [Phone](platform-multi-product-stage-7-screenshots/phone-done.png) |
| Demo review | [Desktop](platform-multi-product-stage-7-screenshots/desktop-demo-review.png) | [Phone](platform-multi-product-stage-7-screenshots/phone-demo-review.png) |
| Demo done | [Desktop](platform-multi-product-stage-7-screenshots/desktop-demo-done.png) | [Phone](platform-multi-product-stage-7-screenshots/phone-demo-done.png) |

## Final sequential gate

Forced `dotnet build backend/CarSpaManagement.slnx --no-incremental` passed: **0 errors, 8 pre-existing warnings**, 20.75s. Remaining warnings are the duplicate using, obsolete check-constraint API, one unread public-controller parameter and five nullable test warnings. The formerly unread catalog parameter is now used by the public product list.

All three consecutive full baseline runs passed. Each run's exit status, expected counts and zero skips were checked before the next run began. No test/build commands overlapped, the live hosts were stopped, and no implementation/assertion changes were made after the forced build or between runs.

| Final check | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| Backend passed / failed / skipped | 1363 / 0 / 0 | 1363 / 0 / 0 | 1363 / 0 / 0 |
| Backend duration | 10m41s | 11m18s | 10m26s |
| Admin type-check | Passed | Passed | Passed |
| Admin unit | 27 passed | 27 passed | 27 passed |
| Admin mocked browser | 12 passed | 12 passed | 12 passed |
| Signup type-check | Passed | Passed | Passed |
| Signup unit | 11 passed | 11 passed | 11 passed |
| Signup mocked browser | 21 passed | 21 passed | 21 passed |
| Whole baseline duration | 11m56s | 12m23s | 11m35s |

All required Stage 7 checks passed. No requested Stage 7 item is unfinished. Completion commit: `Stage 7: Multi-product sign-up website`. No push or merge.

```powershell
dotnet build backend/CarSpaManagement.slnx --no-incremental
& scripts/test-platform-baseline.ps1
& scripts/test-platform-baseline.ps1
& scripts/test-platform-baseline.ps1
```

Raw logs are ignored under backend/tests/CarSpaManagement.Api.Tests/bin/ with stage7- prefix, including backend-reviewed, signup-build-reviewed, preflight, live-reviewed, final-forced-build and final-baseline-run-1/2/3. Screenshots are explicitly included despite the repository PNG ignore rule.

## Scope and deferred work

No Stage 8, new real product/runtime, host split, role scope, payment gateway, new billing policy or schema work. The Stage 3 legacy pack fallback is unchanged. Existing application/API compatibility fields remain, overriding Part 2's old Stage 7 outline about removing them, as the owner's current instruction explicitly requires. Unrelated launcher/Flutter changes and the untracked audit source are excluded from the commit. Development compile errors were corrected before verification. No security, isolation or billing policy was guessed. Questions for the owner: none.
