# Stage 6 follow-up — Owner seats-only changes and new-company dialog

Date: 16 October 2026. Branch: `platform-multi-product`.
Status: **complete**. Forced build and all three sequential baseline runs passed with zero failures/skips. Stage 7 has not started.

## Changes and root cause

`OwnerSubscriptionController.ToTarget` previously constructed zero legacy licence counts when a request supplied seats but omitted licences. `Change` compared those zero counts with active users before the billing service normalized the seats. A new HTTP regression test reproduced the exact 400 response for Starter yearly, seats `{android:2,windows:1,both:3}`, and one active Both owner:

> 1 active users have a Windows + Android licence. Deactivate users or change their app access in Users first.

Both owner and platform-company `ToTarget` methods now derive the compatibility counts through `ProductSeats.LicenceView` when seats are supplied. Explicit seats take precedence if both request shapes are present. Requests using only legacy licences keep their existing conversion and response contracts.

The owner in-use guard now compares effective quantities by seat code against the existing runtime usage reader's seat projection and uses the product seat names in its existing error wording. Missing quantities count as zero. Its indentation is corrected. None and Counted retain their existing behavior; this follow-up does not introduce another product's business-database usage reader.

Reviewed `PlanChangeService.ProposeAsync`, `ChangeByOwnerAsync`, `ApproveAsync`, and `PlatformPlanChangeApprovals`: creation already normalizes seat quantities and the compatibility projection before persisting `SeatsJson`; preview and approval pass those seats through to billing/subscription changes. No further changes to those services are needed. A new HTTP test exercises a seats-only platform proposal, owner-visible generic and legacy projections, approval, and the saved subscription.

The New company dialog no longer renders Unlimited seats above Company name. Its existing plan-section label remains. The mocked test now requires exactly one visible occurrence rather than selecting the first of duplicates.

Files changed:
- `backend/api/CarSpaManagement.Api/Controllers/Platform/OwnerSubscriptionController.cs`
- `backend/api/CarSpaManagement.Api/Controllers/Platform/PlatformCompaniesController.cs`
- `backend/tests/CarSpaManagement.Api.Tests/PlatformOwnerSubscriptionHttpTests.cs`
- `backend/tests/CarSpaManagement.Api.Tests/PlatformPlanChangeHttpTests.cs`
- `apps/platform-admin/src/features/companies/NewCompanyModal.tsx`
- `apps/platform-admin/e2e/mocked/products.spec.ts`
- This report.

## Before/after evidence and development checks

| Scenario | Before | After |
| --- | --- | --- |
| Seats-only Starter yearly change, 2 Android / 1 Windows / 3 Both, one active Both user | New regression reproduced 400 with the exact message above | 200, Applied; saved seats 2/1/3; limit 6; legacy response also 2/1/3 |
| Any of Android, Windows, Both below active usage | Zero legacy counts caused incorrect comparisons for valid requests | 400 with the existing exact per-type message, tested with omitted/null legacy counts and conflicting higher legacy counts |
| Seats-only platform proposal and owner approval | Platform conversion also initially constructed zero legacy counts; service subsequently normalized them | Pending proposal has Both=3 and six generic seats; immediate approval returns 204; Professional saved with seats 2/1/3, limit 6 |
| None new-company paid dialog | Two Unlimited seats labels | Exactly one, in plan section; no seat controls |

Development commands (strictly sequential; PostgreSQL connection supplied only in process environment):

```powershell
dotnet test backend/CarSpaManagement.slnx --filter 'FullyQualifiedName~SeatsOnlyChange_UsesEffectiveQuantities'
dotnet test backend/CarSpaManagement.slnx --filter 'FullyQualifiedName~PlatformOwnerSubscriptionHttpTests|FullyQualifiedName~PlatformPlanChangeHttpTests|FullyQualifiedName~GenericSeatHttpTests'
pnpm --dir apps/platform-admin test:e2e
```

The first command deliberately ran the new regression against the original code: 1 failed, reproducing the bug. An initial development run after the fix had 15 passed / 1 failed because the new approval test incorrectly expected 200 instead of the established 204 for an immediately applied proposal. Corrected that new test's protocol expectation while retaining every saved-seat/limit assertion; no pre-existing assertion changed. The final focused run passed **19/19, zero failed/skipped**, including the unchanged legacy-shape tests, None/Counted end-to-end flows and tracked-parent insert test. Admin mocked browser passed **12/12**, zero failed/skipped.

Backend total increases from Stage 6's 1353 to **1361**: one valid owner change, six below-usage cases, and one proposal/approval round trip. Admin unit count remains 27, browser count 12, signup unit count 7. Stage 0 counts were backend 1313, admin unit 21, browser 4 and signup unit 7.

## Final sequential gate

Forced non-incremental build passed: **0 errors, 9 pre-existing warnings**, 10.70 seconds. These are the existing duplicate using, obsolete check-constraint API, two unread public-controller parameters and five nullable test warnings.

All three complete sequential baseline runs passed. A wrapper checked each command's exit status, backend 1361 passed / 0 failed / 0 skipped, expected frontend counts, and absence of skipped tests before starting the next run. No verification commands overlapped; no implementation or test changes occurred between the forced build and these runs.

| Check | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| Backend passed / failed / skipped | 1361 / 0 / 0 | 1361 / 0 / 0 | 1361 / 0 / 0 |
| Backend duration | 9m32s | 10m39s | 9m50s |
| Admin type-check | Passed | Passed | Passed |
| Admin unit | 27 passed | 27 passed | 27 passed |
| Admin mocked browser | 12 passed | 12 passed | 12 passed |
| Signup type-check | Passed | Passed | Passed |
| Signup unit | 7 passed | 7 passed | 7 passed |
| Whole baseline duration | 10m26s | 11m20s | 10m30s |

Commit: `Stage 6 follow-up: owner seats-only change and dialog nit`. No push or merge. All required checks passed; nothing remains unfinished in this follow-up.

```powershell
dotnet build backend/CarSpaManagement.slnx --no-incremental
& scripts/test-platform-baseline.ps1
& scripts/test-platform-baseline.ps1
& scripts/test-platform-baseline.ps1
```

## Scope and decisions

No migrations or new entities. No changes to billing prices, legacy app contracts, signup website, Windows/Android apps or design. No later stage, push, merge, main change or owner development database access. Existing unrelated launcher/Flutter changes and untracked audit source are excluded. The existing Car Spa usage reader is retained at the compatibility boundary; this fix compares its quantities generically rather than adding external-product authentication or usage infrastructure. Questions for the owner: none.

Logs are ignored under `backend/tests/CarSpaManagement.Api.Tests/bin/`, with prefix `stage6-followup-` (before, focused, focused-final, browser-development, forced-build, baseline-run-1/2/3).
