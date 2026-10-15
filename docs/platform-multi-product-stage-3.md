# Stage 3 — generic seats and features

Status: **complete**. All three final sequential baseline runs passed with no failures or skips. Branch: `platform-multi-product`. No later stage, push, merge or change to main.

## Changes and decisions

`Infrastructure/Platform/ProductSeats.cs` centralizes explicit seat validation, reads, persistence and response descriptions. The writer loads the plan, product and seat definitions itself and rejects cross-product plans. `Subscription.Licences` is a read-only view of seat codes for compatibility; its throwing setter was removed. Quote, subscription, sign-up, invoice, plan-change, catalog and recurring-revenue calculations use generic seat rows/prices. Existing Car Spa licence fields and invoice wording remain available.

`PlatformEntitlementService` resolves runtime features from that product's ProductFeature rows. Franchise branch expansion requires the franchise capability. FeatureKeys.All is used only within Car Spa module definitions; the compatibility overload for existing pure Car Spa rule fixtures is explicitly Car Spa-specific. Runtime and company-detail calls supply catalog definitions.

`PlanVersionFactory` validates product features and accepts generic seat prices. Catalog plan and add-on mutations validate the selected product. None/Counted do not offer or accept legacy user packs. The module registry requires exactly one seat type for Counted. None seed plans have zero minimum seats.

`20261015114018_GenericSeatChoices` adds nullable SeatsJson to PlanChangeRequests and SeatsQuoteJson to SignupOrders. Proposal quantities survive approval and scheduling; order snapshots preserve the quoted generic seat prices on reload. No applied migration was edited. No new entity was introduced: existing Guid-keyed seat entities retain ValueGeneratedNever. A tracked-parent insertion test clears navigations and demonstrates that the explicit writer loads dependencies and saves new child rows.

Tests: CarSpaBillingCharacterizationTests, GenericSeatRulesTests and GenericSeatHttpTests. The latter registers a real test product module under an isolated runtime key for both None and Counted. It reuses the Car Spa business schema solely for real owner authentication; its seat and feature catalog is generic. It exercises public quote/paid sign-up/payment/status, stored order rows, invoice totals, entitlement limits, trial start, owner GET/change, renewal and paid plan changes. Existing assertions are unchanged; the one rule fixture using the removed setter now constructs equivalent explicit rows. The legacy no-row pack test and its helper remain unchanged.

## Car Spa before/after

Paid scenario: Starter, Android 2 / Windows 1 / Both 3, no add-ons or GST. Upgrade to the configured trial plan (Car Spa Professional) halfway through a 30-day period. Separate trial company.

| Measurement | Before | After |
| --- | ---: | ---: |
| Per-type licences | 2 / 1 / 3 | 2 / 1 / 3 |
| Paid seat limit | 6 | 6 |
| Monthly quote, minor units | 469400 | 469400 |
| Yearly quote, minor units | 4694000 | 4694000 |
| Upgrade full-period amount, minor units | 729400 | 729400 |
| Half-period upgrade charge, minor units | 130000 | 130000 |
| Renewal invoice, minor units | 469400 | 469400 |
| Trial per-type licences | 0 / 0 / 3 | 0 / 0 / 3 |
| Trial limit / stored quantity | 3 / 3 | 3 / 3 |

The characterization passed on both sides of the implementation, without changing its numeric assertions.

## Behavior by seat model

- **None:** no purchased seat rows or seat invoice lines, no minimum, unlimited SeatLimit=null, empty seats response. Plan/company fees and add-ons remain billable. Trial, paid signup, invoice, renewal, plan change and owner endpoint verified in HTTP/integration tests.
- **Counted:** one registered seat type; purchased quantity is the limit. Trials use the configured trial quantity on that type. The test product's user seats cost 250 minor units each on Basic, plus a 1000 company fee: two seats quote and invoice at 1500; Plus totals 3000. Owner trial starts with three user seats and changes to two. No legacy fallback or user-pack expansion.
- **PerType:** quantities and prices per registered type. New Car Spa trials and paid subscriptions get all three rows, including zero quantities. Plan/owner changes write seats explicitly; renewal retains stored quantities. The old app counts remain read-only projections. Characterization values are unchanged.

## Endpoints and compatibility verification

Every seat array entry contains code, name, quantity and priceMinor. New request seat quantities are a code-to-quantity object; old licence requests remain supported.

| Endpoint | Change and evidence |
| --- | --- |
| GET `/api/public/catalog` | Monthly/yearly price objects include seats. None trial count/minimum are zero. Existing public catalog tests and generic owner catalog response pass. |
| POST `/api/public/signup/quote` | Optional generic quantities; quote seats array. None/Counted HTTP tests verify totals and user seat details. Existing Car Spa quote tests pass; the characterization also verifies that generic-only Car Spa seat input returns matching legacy licence counts. |
| POST `/api/public/signup`, order test-payment/status | Generic seat rows and stored seat-price snapshots; result/quote seats. Generic HTTP tests verify paid invoice and unchanged snapshot reload; existing sign-up tests pass. |
| GET `/api/subscription/self` | Seats and nullable seatLimit. None returns null; Counted returns three trial seats then two after owner change. Existing Car Spa owner tests pass. |
| POST `/api/subscription/self/preview`, `/change` | Optional generic quantities. Generic owner changes and existing Car Spa plan-change tests pass. |
| GET `/api/platform/signups` | Stored order seats snapshot added alongside the existing licence total. None/Counted HTTP tests assert equality with the original quote. |
| GET `/api/platform/plans` | Version seats beside existing licence price fields. Existing catalog/licence tests pass. |
| POST `/api/platform/plans`, `/plans/{code}/versions` | Optional seatPrices; ProductFeature validation. Generic factory tests and existing admin plan tests pass. |
| POST `/api/platform/addons` | Product-scoped feature validation. Existing add-on validation tests pass. |
| GET `/api/platform/companies`, `/{id}` | Seat arrays on list/subscription; detail entitlements use product definitions. Existing company HTTP tests pass. |
| Company create/direct change/plan-change routes | Optional generic quantities; proposals persist generic choices and expose seats. Car Spa proposal licence fields are derived from normalized generic quantities. Existing company/plan-change tests pass; generic services test paid changes and renewal. |
| GET `/api/platform/dashboard` | Recurring revenue uses generic seats/prices. Existing dashboard tests pass. |
| Owner proposal response | Generic seats beside existing app licence fields; stopped plans remain displayable while approval validates sale terms. Existing plan-change tests pass. |

No Windows, Android, design, admin portal or sign-up website implementation changed. Existing response fields remain. The test endpoint evidence above comes from the passing development suite; final complete frontend/backend verification results follow below.

## Commands and results

All PostgreSQL tests used the owner's authorized process environment connection; no credential was stored in a file. Checks ran sequentially, with no overlapping agent-started dotnet/pnpm process. Owner API/port 5298 was not stopped.

- `dotnet ef migrations add GenericSeatChoices --project backend/api/CarSpaManagement.Api --context PlatformDbContext --output-dir Migrations/Platform`: successful after correcting the nullable struct compile errors. Only additive columns generated.
- Characterization before: 1 passed, 0 failed, 0 skipped (34s). After: 1 passed, 0 failed, 0 skipped (22s).
- Focused generic/legacy/licence/plan-change/tracking tests: 66 passed, 0 failed, 0 skipped (1m05s).
- Full development `dotnet test backend/CarSpaManagement.slnx`: 1348 passed, 0 failed, 0 skipped (9m47s).
- Forced `dotnet build backend/CarSpaManagement.slnx --no-incremental`: 0 errors, 9 existing warnings (34.38s). Warnings concern the existing WhatsApp duplicate using, franchise check constraint API, two unread public controller parameters and five nullable test warnings.

Earlier full baseline batches passed, but final review added the admin order-list seats field and normalized Car Spa quote/proposal licence fields from generic seat quantities. Their older results are not counted toward the final gate. The updated HTTP/characterization check passed 4/4, then the final characterization/generic/plan-change check passed **17/17, zero failures/skips** (1m20s). All original numeric assertions remain unchanged.

The final forced build passed with **0 errors, 9 existing warnings** (22.23s). All three fresh sequential baseline runs passed against this final source:

| Check | Final run 1 | Final run 2 | Final run 3 |
| --- | --- | --- | --- |
| Backend passed / failed / skipped | 1348 / 0 / 0 | 1348 / 0 / 0 | 1348 / 0 / 0 |
| Backend duration | 9m59s | 9m34s | 9m25s |
| Admin TypeScript | Passed | Passed | Passed |
| Admin unit | 21 passed | 21 passed | 21 passed |
| Admin browser | 4 passed | 4 passed | 4 passed |
| Signup TypeScript | Passed | Passed | Passed |
| Signup unit | 7 passed | 7 passed | 7 passed |

No implementation or assertion changes were made between these final runs. All six commands in each baseline script run passed; no host crash occurred. The completion commit is `Stage 3: Use generic seats and features`.

Stage 0 backend baseline: 1313; Stage 1: 1319; Stage 2: 1337. Stage 3 development suite: 1348 (+11 over Stage 2). Frontend source/tests have not been changed.

Raw verification logs are ignored under `backend/tests/CarSpaManagement.Api.Tests/bin/`: stage3-development.log, stage3-final-build.log, stage3-final-run-1/2/3.log, stage3-verified-build.log and stage3-verified-run-1/2/3.log. Final-source evidence: stage3-complete-focused.log, stage3-complete-build.log and stage3-complete-run-1/2/3.log.

## Deferred clean-up and limitations

Retain the explicitly authorized **legacy Car Spa fallback**: only PerType subscriptions with zero SubscriptionSeat rows and IncludedSeats>0 or a users.max_active plan entitlement use IncludedSeats plus active legacy user packs. Existing rows, even with zero quantities, prevent fallback. None and Counted never use it. The legacy test remains unchanged, and additional tests verify the exclusion. Packs have not been migrated into generic rows or made a generic purchase model. Remove this fallback when the legacy fixtures are rewritten.

Development compile errors were fixed as authorized on resumption, before final verification. No assertions were weakened. No further billing-policy question remains. All Stage 3 Done when items passed. No work remains in this stage. No later stage was started. Commit only on platform-multi-product; do not push or merge.
