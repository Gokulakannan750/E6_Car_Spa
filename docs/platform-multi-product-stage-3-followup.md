# Stage 3 follow-up — generic default seat and invoice labels

Status: **complete**. The forced build and all three final sequential baseline runs passed. Branch: platform-multi-product. No later stage started; no push or merge.

## Scope and implementation

Only the two requested seat metadata concerns were changed. No controller, pricing, entitlement, subscription, app, UI or legacy-fallback implementation was changed.

- `ProductSeatType` and `SeatTypeDefinition` gain DefaultSeat (false by default) and optional InvoiceLabel (database maximum 200 characters).
- `ProductSeats.Validate` uses exactly one active default marker for an implicit PerType allocation. No seat code or sort order determines that choice. Missing, inactive or multiple defaults produce a clear ValidationException asking for explicit seats, rather than Single() throwing InvalidOperationException. Explicit quantities keep their existing validation. Counted still uses its sole seat type; None still has no seats.
- CarSpaProductModule marks only both as default. Its existing sort order is unchanged. Its three stored invoice labels are exactly Android user licence, Windows user licence, and Windows + Android user licence.
- ProductSeats.InvoiceLabel reads the stored label, falling back to "{Name} seat" for null/empty/whitespace. Runtime invoice labeling no longer branches on seat codes or names.
- ProductCatalogSeed copies these metadata fields only when inserting a missing definition. It never resets an existing label or default marker, including an admin-cleared label.

## Additive migration and existing catalogs

`20261015154917_ProductSeatDefaultsAndInvoiceLabels` adds DefaultSeat boolean NOT NULL DEFAULT false and InvoiceLabel nullable varchar(200). No applied migration was edited. No entity or Guid key was added; existing ValueGeneratedNever mappings are unchanged.

The new migration initializes existing rows once using the previous runtime rules: PerType rows with code both receive the old implicit default; exact old code/name matches receive the old invoice label. Other rows retain false/null. This compatibility data upgrade preserves existing behavior without assuming a configured product key (tests use random keys). It is not a runtime product-code fallback. Subsequent reseeding preserves admin edits.

A PostgreSQL upgrade test starts with a populated catalog, rolls only this new migration back on throwaway data to the Stage 3 schema, reapplies it, and verifies all three labels and the both default. It then edits the label/default, reseeds, and verifies preservation, including a null label. Applied migration files were not changed.

## Before/after evidence

| Measurement | Stage 3 before | Follow-up after |
| --- | --- | --- |
| Car Spa implicit/default trial seat | both | both, via persisted marker |
| Car Spa monthly quote, minor units | 469400 | 469400 |
| Car Spa yearly quote, minor units | 4694000 | 4694000 |
| Upgrade full-period amount, minor units | 729400 | 729400 |
| Half-period upgrade charge, minor units | 130000 | 130000 |
| Renewal invoice, minor units | 469400 | 469400 |
| Paid licence counts / seat limit | 2/1/3; 6 | 2/1/3; 6 |
| Trial counts / limit | 0/0/3; 3 | 0/0/3; 3 |
| Android invoice wording | Android user licence | Android user licence |
| Windows invoice wording | Windows user licence | Windows user licence |
| Both invoice wording | Windows + Android user licence | Windows + Android user licence |
| Three-type invoice total (one each), minor units | 219700 | 219700 |

The original characterization assertions are unchanged. New invoice assertions check the exact three old prefixes and total. New generic PerType trial tests use operator/reviewer seats with no both: an operator default at SortOrder=20 wins over the reviewer at SortOrder=1; the trial stores three operator seats and invoices 750 minor units using "Licensed operator, Basic (monthly)". Missing, ambiguous and inactive defaults produce ValidationException. These execute the subscription service with a real catalog, not just the string helper. No fake business database/login is created.

## Commands and verification

The owner's PostgreSQL connection was supplied only in the process environment, never stored in a file. No existing assertion was weakened or removed. No frontend tests/source were changed. Pre-existing Android/launcher/audit-file changes were left alone.

- Read docs/platform-multi-product-stage-3.md before changes.
- `dotnet ef migrations add ProductSeatDefaultsAndInvoiceLabels --project backend/api/CarSpaManagement.Api --context PlatformDbContext --output-dir Migrations/Platform`: passed.
- Focused tests (ProductSeatMetadataTests, unchanged CarSpaBillingCharacterizationTests, explicit writer tracked-parent test, SignupSeatTrackingTests): **9 passed, 0 failed, 0 skipped**, 33s.
- An initial focused build was blocked by an already-running testhost locking the API DLL (MSB3027/MSB3021); no tests ran in that attempt. Its process started before our focused build. It was left alone and exited naturally; the focused retry above passed. That blocked attempt is not counted as verification.
- Forced `dotnet build backend/CarSpaManagement.slnx --no-incremental`: **0 errors, 9 existing warnings**, 8.50s. Warnings are the existing duplicate using, obsolete check-constraint API, two unread parameters and five nullable test warnings.

Final sequential `scripts/test-platform-baseline.ps1` results:

| Check | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| Backend passed / failed / skipped | 1353 / 0 / 0 | 1353 / 0 / 0 | 1353 / 0 / 0 |
| Backend duration | 8m46s | 9m11s | 10m08s |
| Admin TypeScript | Passed | Passed | Passed |
| Admin unit | 21 passed | 21 passed | 21 passed |
| Admin browser | 4 passed | 4 passed | 4 passed |
| Signup TypeScript | Passed | Passed | Passed |
| Signup unit | 7 passed | 7 passed | 7 passed |

Final checks ran one at a time, with no implementation or assertion changes between them. All six checks passed in each run; no skips or host crashes occurred. Stage 3 baseline: 1348 backend tests. This follow-up adds five cases and preserves all existing assertions. Raw ignored logs: backend/tests/CarSpaManagement.Api.Tests/bin/stage3-followup-{focused,focused-retry,build,run-1,run-2,run-3}.log.

## Deferred work and exceptions

No new deferred work or policy decision. The Stage 3 legacy entitlement fallback is unchanged. No unrelated cleanup or Stage 6+ work was done. All required checks passed. Completion commit: "Stage 3 follow-up: generic default seat and invoice labels" on platform-multi-product. No push or merge. No work remains in this follow-up.
