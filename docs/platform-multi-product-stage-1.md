# Stage 1 — Generic product catalog: final report

Date: 15 October 2026

Branch: `platform-multi-product`

Status: **Complete. All Stage 1 completion checks passed. Three consecutive full verification runs passed with no crashes.**

## 1. What changed

- `Domain/Platform/ProductCatalogEntities.cs`: added `SeatModel`, `ProductSeatType`, `ProductFeature`, `SubscriptionSeat`, `PlanVersionSeatPrice`, and `SignupOrderSeat`.
- `Domain/Platform/PlatformEntities.cs`: added product trial plan, database prefix, seat model, and capabilities. The database prefix is a plain property, explicitly set to the product key in `CompanyDatabaseProvisioner` when creating the product.
- `Domain/Platform/BillingEntities.cs`: replaced the fixed subscription/sign-up quantities and plan-version price columns with seat collections. Kept `LicenceCounts`, `Subscription.Licences`, and `PlanVersion.UserPriceMinor(AppAccess)` as seat-backed Car Spa adapters.
- `Infrastructure/Platform/PlatformDbContext.cs`: configured the new tables, foreign keys, unique indexes, lower-case seat-code constraint, and seat navigation loading. All five new catalog entity types use application-assigned GUIDs with `ValueGeneratedNever`.
- `PlatformCatalogSeeder.cs`: seeds Car Spa's three seat types and twelve feature definitions with readable labels. Prices use the original seed values; yearly remains ten times monthly. Repeated seeding preserves edited prices and custom labels; previous labels equal to their raw keys are upgraded.
- `PlatformSettingsService.cs`: added optional product scope, product/global/configuration fallback, and cache invalidation after saves.
- `PlanVersionFactory.cs`, `SignupService.cs`, `SubscriptionService.cs`, `PlanChangeApprovals.cs`, and `CatalogReader.cs`: adapted existing Car Spa storage callers to the new seat tables.
- `Controllers/Platform/OwnerSubscriptionController.cs`, `PlatformAdminController.cs`, `PlatformCatalogController.cs`, and `PlatformCompaniesController.cs`: retained existing JSON licence and price fields, computing their values through the adapters.
- Updated existing subscription/plan-change tests. Added `PlatformProductCatalogTests` for fresh schema, seeding, price preservation, old-column removal, existing-row migration upgrades, and settings fallback/cache behavior. Added `SignupSeatTrackingTests` for the root-cause reproduction and actual trial flow. `TestSupport/PlatformTestEnvironment.cs` accepts optional catalog interceptors for these tests.

All production paths above are under `backend/api/CarSpaManagement.Api`; tests are under `backend/tests/CarSpaManagement.Api.Tests`.

### Migrations

1. `20261014170242_GenericProductCatalog`: adds the five tables and product metadata; removes all nine old fixed quantity/price columns.
2. `20261014171320_InitializeProductCatalogDefaults`: repairs existing blank product metadata in SQL before EF reads the enum. Legacy Car Spa rows receive `PerType`, `professional`, their existing key as prefix, and `franchise`. Nonempty metadata is preserved. Future SQL defaults for seat model and trial plan are valid.
3. `20261015034530_UseAssignedProductSeatIds`: records the corrected GUID generation metadata in the EF snapshot/designer. Its empty SQL migration is intentional: key tracking changed, while the physical UUID columns did not.

No previously applied migration was edited or removed. Both direct upgrades from the previous schema and upgrades where the generic migration already ran are covered by PostgreSQL tests.

## 2. Real cause of the concurrency exception

The failure was a zero-row **update of a new `SignupOrderSeat`**, caused by EF's key-generation metadata.

`SetLicences` assigns each new seat a nonempty GUID. Under the original `ValueGeneratedOnAdd` convention, EF discovered those children on an already-saved, tracked trial order and classified them as `Modified`. It issued `UPDATE "SignupOrderSeats" ... WHERE "Id" = <new GUID>` for rows that had never been inserted. Updating zero rows then raised `DbUpdateConcurrencyException`.

The creation path matters: adding a whole new paid-order graph explicitly marks its children `Added`, while discovering children on an existing tracked trial order exercises the problematic inference. This explains the different behavior across paths without requiring a competing writer.

### Evidence concerning the parent order

- `GeneratedGuidMapping_ReproducesSeatUpdateFailure_WithoutAnotherWriter` restores the original seat mapping in an isolated test context. With one writer, new seats become `Modified`, emitted SQL contains a seat-table `UPDATE`, and the exception entries are `SignupOrderSeat` entities. The parent order remains present with its original PostgreSQL `xmin` and `Processing` status after rollback.
- `TrialSignup_InsertsAssignedSeatIds_OrderVersionStaysStableDuringProvisioning` calls the real `SignupService.CreateAsync`. An independent connection observes the committed order after saves: its `xmin` is stable throughout provisioning while `Processing`, then changes at completion. Seat commands are inserts, and all three quantities persist correctly.
- The order model has no concurrency token. The subscription lifecycle worker does not write sign-up orders. The paid-order atomic claim checks the paid start mode and `AwaitingPayment` state, so it cannot claim this processing trial. The trial error handler writes `NeedsAttention` only after a setup error. Franchise linking updates franchise-code/link records and can save the shared context; it does not atomically claim the trial order.

**Fix:** configure `ValueGeneratedNever` for `ProductSeatType`, `ProductFeature`, `SubscriptionSeat`, `PlanVersionSeatPrice`, and `SignupOrderSeat`, whose GUIDs are assigned by application code. Removed the earlier trial-specific `AddRange` workaround. No concurrency-exception retry or weakened assertion was introduced.

## 3. Commands and results

The focused root-cause command passed **2 tests**, with no failures or skips:

```powershell
dotnet test backend/CarSpaManagement.slnx --filter FullyQualifiedName~SignupSeatTrackingTests
```

Then ran `scripts/test-platform-baseline.ps1` **three consecutive times**, sequentially, with `CARSPA_TEST_PG_CONNECTION` set to the owner-authorized PostgreSQL test connection. No implementation or test source changed between the three full runs.

Each invocation runs all six required commands:

```powershell
dotnet test backend/CarSpaManagement.slnx
pnpm --dir apps/platform-admin type-check
pnpm --dir apps/platform-admin test
pnpm --dir apps/platform-admin test:e2e
pnpm --dir apps/signup-web type-check
pnpm --dir apps/signup-web test
```

| Check | Final Stage 0 baseline | Full run 1 | Full run 2 | Full run 3 |
| --- | --- | --- | --- | --- |
| Backend | 1,313 passed | 1,319 passed | 1,319 passed | 1,319 passed |
| Backend failures / skips | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Backend duration | 6m 54s | 16m 37s | 10m 17s | 7m 48s |
| Admin TypeScript | Passed | Passed | Passed | Passed |
| Admin unit tests | 21 passed | 21 passed | 21 passed | 21 passed |
| Admin browser tests | 4 passed | 4 passed | 4 passed | 4 passed |
| Sign-up TypeScript | Passed | Passed | Passed | Passed |
| Sign-up unit tests | 7 passed | 7 passed | 7 passed | 7 passed |
| Process/test-host crashes | None | None | None | None |

All three full invocations exited successfully. The backend increase is six regression cases: four catalog/settings/migration cases and two seat-tracking cases. Frontend tests passed unchanged. Fresh-catalog assertions verify the old columns are absent, seat/feature definitions exist, prices keep the yearly multiplier, and reseeding preserves an edited price.

Raw run logs are retained locally under `backend/tests/CarSpaManagement.Api.Tests/bin/stage1-validation-20261015-94f9041a/run-1.log`, `run-2.log`, and `run-3.log`. They are ignored build artifacts and are not committed. `git diff --check` passed.

### Earlier attempts, now resolved

- The first Stage 1 run had 66 failures caused by the null product prefix; the plain property and explicit initialization fixed it.
- The next run had three trial sign-up failures; the key-generation reproduction and correction above resolve them.
- An intervening build could not copy the test DLL because an existing test host held it open. That attempt ran no tests. It was an environment/file-lock failure, separate from the entity-tracking bug; no unidentified process was terminated. The final three full runs had no copy failure, test-host crash, or application test failure.

## 4. Decisions, limits, and deferred work

- Adapted compatibility callers in Stage 1 because removing the old fields otherwise prevents the required build. Product-independent billing and entitlements remain Stage 3 work.
- Existing fixed licence/price data is deliberately not copied, as specified for test data. Existing test catalogs that need a fully reseeded commercial state can be recreated under the audit's authorization; this work did not manually recreate a dev catalog.
- Car Spa metadata remains seeded by the current Car Spa seeder in this stage. Moving product metadata and seed definitions into product modules remains Stage 2 work.
- No Windows, Android, design, or frontend application files were changed. Existing local `.claude/launch.json` and generated Android edits were left untouched and excluded from the commit. The previously untracked audit document is also excluded.
- No server on port 5298 was stopped. PostgreSQL credentials are not stored in code or this report. No push or merge was performed.
- Stages 2 and later were not implemented as part of this Stage 1 repair and verification request.

## 5. Questions for the owner

None blocking Stage 1. Its completion gate is satisfied.
