# Stage 2 â€” Product module registry: implementation and failed verification

Date: 15 October 2026

Branch: `platform-multi-product`

Status: **Complete. Three consecutive full baseline invocations passed, with no failures, skipped tests, or host crashes.** Branch: `platform-multi-product`. Completion commit: `Stage 2: Add product module registry`. No push, merge, or Stage 3 work.

## 1. What changed

All paths below are relative to the repository root.

### Module contract and implementations

The final working-tree locations are:

- `backend/api/CarSpaManagement.Api/Infrastructure/Platform/Products/IProductModule.cs`: `IProductModule`, `IProductModuleRegistry`, `SeatTypeDefinition`, `FeatureDefinition`, and `ProvisionContext`.
- `backend/api/CarSpaManagement.Api/Infrastructure/Platform/Products/ProductModuleRegistry.cs`: `ProductModuleRegistry` and `ProductSelection`. Registers Car Spa under the configured runtime key, including random keys used by existing tests, and reads each external product configuration. Rejects unknown product selection and duplicate keys/prefixes. Creation/catalog requests default only when exactly one module is registered; admin lists allow an omitted product filter.
- `backend/api/CarSpaManagement.Api/Infrastructure/Platform/Products/CarSpaProductModule.cs`: Car Spa metadata, seat/feature definitions, and its existing `AppDbContext` migration, permission seeding, company organization row, and default organization data.
- `backend/api/CarSpaManagement.Api/Infrastructure/Platform/Products/CarSpaCatalogSeed.cs`: moved the existing plan/add-on seed amounts unchanged. Yearly pricing remains ten times monthly. `PlatformCatalogSeeder.cs` is now a compatibility facade; it no longer sets product metadata.
- `backend/api/CarSpaManagement.Api/Infrastructure/Platform/Products/ProductCatalogSeed.cs`: adds missing seat/feature definitions without resetting existing definitions.
- `backend/api/CarSpaManagement.Api/Infrastructure/Platform/Products/ExternalProductOptions.cs`: external command and plan seed configuration.
- `backend/api/CarSpaManagement.Api/Infrastructure/Platform/Products/ExternalCommandProductModule.cs`: asynchronous command execution, company environment variables, PostgreSQL URL supplied only in the child environment, last nonempty stdout line as schema version, five-minute default timeout, shorter configurable test timeout, child termination, and sanitized error truncation to 1,000 characters. No command output or environment is logged by this module.
- `backend/api/CarSpaManagement.Api/Infrastructure/Database/DependencyInjection.cs`: registers the registry and product selection service.

### Metadata ownership

On **first product creation**, `EnsureCatalogAsync` gets these values from its module: `Key`, `Name`, `DatabasePrefix`, `TrialPlanCode`, `SeatModel`, and comma-separated `Capabilities`. It also assigns a new `Id`, `CreatedAt`, and the entity's default `IsActive = true`.

On **every later catalog initialization/start**, it updates **none of those existing product fields**. Admin changes to name, seat model, trial plan, prefix, capabilities, and active state are preserved. Missing module seat definitions, feature definitions, plans, and add-ons are inserted; existing names, labels, types, ordering, active flags, prices, and plan definitions are preserved. A raw-key feature label is no longer rewritten on each start. Fresh definitions use the readable module labels.

The registry's module properties remain configuration defaults; catalog responses and trial selection use persisted product metadata. Database names for new companies use the persisted product prefix. An edited prefix colliding with another catalog product is rejected before database creation.

### Provisioning, routing, and compatibility

- `CompanyDatabaseProvisioner.cs`: initializes every module, accepts an explicit product key when creating companies, allocates codes independently per product, builds database names from that product, dispatches migration to the company's module, and supports sequential migration of one product or all products. The connection delegate is restricted to the assigned company database. External migration checks the product prefix. The existing failure recording remains the sign-in gate. EF history-table grants are conditional because external schemas need not have that table. Adoption remains explicitly Car Spa only. `Program.cs` now explicitly migrates only `Platform:ProductKey` at startup, and the provisioner's no-argument overload defaults to the runtime product. The CLI/admin rollout calls explicitly pass null to request all products.
- `CompanyDirectory.cs` and `CompanyRegistrationService.cs`: sign-in/registration remain scoped to the configured runtime product. Directory cache keys now include the runtime product, and registration invalidates the matching scoped key.
- `SubscriptionService.cs`: trial plan and trial/grace/renewal settings use the company's persisted product and product-scoped settings. Only the minimum `SeatModel.None` trial guard needed to provision the Stage 2 dummy product was added; generic seat billing and quoting remain Stage 3.
- `CatalogReader.cs`, `SignupService.cs`, and `OwnerSubscriptionController.cs`: preserve selected/bound product through catalog, sign-up, paid-order completion, and owner catalog lookup. Existing licence/price response fields remain. Trial orders for a no-seat product do not write Car Spa seat adapter rows. Franchise joining remains restricted to the runtime Car Spa product/capability.
- `FranchiseSignupCodes.cs`: reads settings for the signed-in company's product.
- `PlatformCommandLine.cs`: supports `--product` selection for creation, registration-code lookup, lists, and migration; list/migration can cover all products and show the product alongside repeated codes. Adoption rejects an external product selection.

No new catalog entity or schema migration was added. Existing application-assigned GUID mappings remain `ValueGeneratedNever`.

### Endpoints changed

No existing response field was removed.

| Endpoint | Working-tree change |
| --- | --- |
| `GET /api/platform/products` | New authenticated product metadata endpoint: key, name, seat model, trial plan, prefix, active state, seat definitions, feature key/label/type, capabilities. |
| `GET /api/platform/companies` | Optional `product`; omitted means all; list items add `productKey`. |
| `POST /api/platform/companies` | Requires `product` when multiple modules are registered; one-module fallback retained. |
| `GET /api/platform/companies/{id}` | Avoids querying a Car Spa user table for an external product. Existing detail fields retained. |
| `GET /api/platform/dashboard` | Optional product scope applied consistently to companies, subscriptions, open invoices, and company activity. |
| `GET /api/platform/plans` | Product selection with one-module fallback; plan/add-on items add `productKey`. |
| `POST /api/platform/plans/{code}/versions` | Product selection instead of fixed runtime filter. |
| `POST /api/platform/addons/{code}/prices` | Product selection instead of fixed runtime filter. |
| `POST /api/platform/plans`, `PUT /api/platform/plans/{code}` | Product selection for catalog ownership. |
| `POST /api/platform/addons`, `PUT /api/platform/addons/{code}` | Product selection for catalog ownership. |
| `GET`, `PUT /api/platform/settings` | Product-scoped settings with single-module fallback. |
| `GET /api/platform/signups` | Optional product filter; omitted means all; items add `productKey`. |
| `GET /api/platform/invoices` | Optional product filter; omitted means all; items add `productKey`. |
| `GET /api/platform/audit-logs` | Optional product filter on company-targeted records. Global records remain visible without a filter. |
| `GET /api/platform/migrations` | Optional product filter; items add `productKey`. |
| `POST /api/platform/migrations/run` | Optional product filter; omitted migrates all; items add `productKey`. |
| `GET /api/public/catalog` | Product selection with single-module fallback. |
| `POST /api/public/signup/quote` | Product selection forwarded to existing quote service. Generic quoting is deferred. |
| `POST /api/public/signup` | Selected product preserved through provisioning/order creation. |
| `POST /api/public/signup/franchise-code` | Product selection and runtime/capability guard. |
| `POST /api/public/signup/{orderId}/test-payment` | Paid completion provisions the product bound to the order. |
| `GET /api/subscription/self` | Owner catalog uses the company's product explicitly; existing response shape retained. |

### Tests added/updated

- `ProductModuleTests.cs`: command success, stderr truncation, timeout, redaction/log capture, registry/selection, admin metadata/definition/price preservation, assigned-ID child insertion on a tracked plan version, both directions of code/token/cache isolation, independent company numbering/database names, external company-record identity, migration error persistence, paused sign-in, and later successful recovery.
- `ProductModuleHttpTests.cs`: product metadata, own plan catalogs, required selection, settings isolation, two companies both code `0001`, scoped admin lists, preserved licence fields, and actual API startup remigration.
- `TestSupport/Scripts/external-product-test.ps1`: small external migration script. Its success path uses `psql` to create a minimal company table and row with the supplied company ID, idempotently. Failure modes produce long stderr, echo the connection URL to test redaction, or sleep beyond the configured timeout.
- `TestSupport/ExternalProductTestScript.cs` and the test project copy configuration: configure that script. On this Windows machine it uses Windows PowerShell and the installed PostgreSQL `psql`. Other test machines need `pwsh`/`psql` available.
- `TestSupport/PlatformTestEnvironment.cs`: optional in-memory configuration customization.
- `PlatformHttpTests.cs`: configurable API host, now with one public parameterless constructor and an internal customization constructor. The internal visibility was already present when this resumed turn began and was preserved. A reflection test asserts exactly one public constructor.
- `ProductModuleHttpTests.Startup_MigratesRuntimeProduct_WithoutInvokingFailingOrSlowExternalCommand`: cases for failing and sleeping external commands. The test requires an invocation marker to stay absent during runtime startup, then checks runtime migration, dashboard availability, unchanged external state, and an explicit all-product maintenance call. The earlier incremental-build attempt failed at the absent-marker assertion. Investigation and non-incremental compilation (section 7) resolved that discrepancy without changing these assertions. Both cases now pass, including the explicit maintenance assertions. The marker assertion was not weakened or bypassed.
- `TestSupport/ExternalProductFactAttribute.cs` and tool discovery: command-only tests skip clearly if PowerShell is absent; database/script tests skip clearly if either PowerShell or psql is absent. Missing PostgreSQL connection also produces a clear skip. Registry and metadata-only tests do not execute commands or require those tools. Added missing-tool reason tests. Both tools were present on this machine; resumed run 1 had zero skipped tests.
- `ExternalCommandProductModule.cs`: validates the configured host before use, removing CS8602 without suppressing nullable analysis.

## 2. Commands and results

`git diff --check -- backend` passed. A read-only PostgreSQL role query confirmed the supplied test administrator is a superuser with `CREATEDB`, `CREATEROLE`, and `BYPASSRLS`; the password was supplied through the process environment, never a file.

Investigation used one sequential focused run with temporary diagnostics (2 passed, 0 failed/skipped, 46s). After removing all diagnostics, ran:

```powershell
dotnet build backend/CarSpaManagement.slnx --no-incremental
dotnet test backend/CarSpaManagement.slnx --no-build --filter FullyQualifiedName~Startup_MigratesRuntimeProduct_WithoutInvokingFailingOrSlowExternalCommand
```

The fresh build passed with **0 errors and 9 existing warnings**; the external module's CS8602 warning is absent. Both unchanged startup cases passed without diagnostics (**2 passed, 0 failed/skipped, 54s**).

Then completed three consecutive `scripts/test-platform-baseline.ps1` invocations, strictly one at a time, with `CARSPA_TEST_PG_CONNECTION` set to the authorized connection in the process environment. Each runs:

```powershell
dotnet test backend/CarSpaManagement.slnx
pnpm --dir apps/platform-admin type-check
pnpm --dir apps/platform-admin test
pnpm --dir apps/platform-admin test:e2e
pnpm --dir apps/signup-web type-check
pnpm --dir apps/signup-web test
```

No implementation/test source changed between these final runs. No agent-started dotnet or pnpm checks overlap. Existing owner API processes and port 5298 are left alone.

| Check | Stage 0 baseline | Stage 1 final (each of three runs) | Final run 1 | Final run 2 | Final run 3 |
| --- | --- | --- | --- | --- | --- |
| Backend | 1,313 passed | 1,319 passed | 1,337 passed | 1,337 passed | 1,337 passed |
| Backend failures / skips | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Backend duration | 6m 54s | 16m 37s / 10m 17s / 7m 48s | 16m 25s | 24m 39s | 11m 53s |
| Admin type check | Passed | Passed | Passed | Passed | Passed |
| Admin unit tests | 21 passed | 21 passed | 21 passed | 21 passed | 21 passed |
| Admin browser tests | 4 passed | 4 passed | 4 passed | 4 passed | 4 passed |
| Sign-up type check | Passed | Passed | Passed | Passed | Passed |
| Sign-up unit tests | 7 passed | 7 passed | 7 passed | 7 passed | 7 passed |
| Host crashes | None | None | None | None | None |
| Full invocation duration | — | — | 18m 49s | 26m 37s | 13m 9s |

Final logs are ignored local artifacts in `backend/tests/CarSpaManagement.Api.Tests/bin/stage2-verified-c7aab3ec/`: `fresh-build.log`, `focused.log`, and `run-1.log` through `run-3.log`. All three invocations exited with code 0; every completion gate is satisfied. Backend growth is 18 Stage 2 cases above Stage 1 (24 above Stage 0). No skipped PostgreSQL test is counted as passed.

### Earlier failed attempts, retained for transparency

- Original fixture attempt: **1,303 passed, 29 failed, 0 skipped**, 7m 17s. All 29 failures were xUnit's single-public-constructor rule. It stopped frontend checks and further runs; the owner authorized repair. Log: `bin/stage2-validation-20261015-accc120c/run-1.log` under the test project.
- Earlier resumed incremental attempt: **1,335 passed, 2 failed, 0 skipped**, 11m 56s. The two new startup cases saw a demo invocation before host initialization completed. Frontend checks and further runs stopped. The owner authorized tracing and correction; section 7 records the evidence and build-artifact assessment. Log: `bin/stage2-final-20261015-6e241303/run-1.log` under the test project.

Neither failed attempt counts toward the three final successful invocations. No assertion was weakened or check bypassed.

## 3. Registering another product (configuration example)

The registry reads external products from configuration. For example, supply the following non-secret configuration through the normal configuration providers; no Civil product was actually registered or implemented in this stage:

```json
{
  "Platform": {
    "ProductKey": "carspa",
    "ExternalProducts": {
      "civil": {
        "Name": "Civil",
        "DatabasePrefix": "civil",
        "TrialPlanCode": "standard",
        "SeatModel": "None",
        "SeatTypes": [],
        "Features": [
          { "Key": "projects.enabled", "ValueType": "Bool", "Label": "Projects", "SortOrder": 1 }
        ],
        "Capabilities": [],
        "MigrateCommand": "node",
        "MigrateArguments": "provision-company.js",
        "WorkingDirectory": "E:/Products/Civil/provisioning",
        "SeedPlans": [
          {
            "Code": "standard",
            "Name": "Standard",
            "SortOrder": 1,
            "Currency": "INR",
            "MonthlyPriceMinor": 0,
            "YearlyPriceMinor": 0,
            "IncludedSeats": 0,
            "SeatPrices": {},
            "Entitlements": { "projects.enabled": "true" }
          }
        ]
      }
    }
  }
}
```

The zero amounts are example configuration only, not a Civil pricing decision. An external product with seats may configure `SeatPrices` keyed by its seat code, each with `MonthlyPriceMinor` and `YearlyPriceMinor`; actual generic seat billing remains Stage 3. Configure amounts explicitly: external yearly fees are not silently derived. Car Spa's existing seeds retain their original ten-times multiplier.

The command receives `TROVO_COMPANY_ID`, `TROVO_COMPANY_CODE`, `TROVO_COMPANY_NAME`, `TROVO_DATABASE_NAME`, and `TROVO_ADMIN_DATABASE_URL`. It must create/upgrade only its assigned database, use the supplied company ID for its company record, be idempotent, and print its schema version on the last nonempty stdout line. Default timeout is 300 seconds; `MigrateTimeoutSeconds` may lower it, and registry configuration rejects a value above 300 or at/below zero. The connection URL/password belongs only in the child environment, not arguments or logs. Privileged connection configuration remains in server secrets.

## 4. Deviations, unfinished work, and decisions

- The latest owner instruction to preserve admin-edited metadata supersedes the audit's earlier instruction to update module metadata on every initialization. Existing product fields and definition labels are therefore preserved.
- Reused the Stage 1 domain `SeatModel` enum rather than introducing a duplicate enum in the products namespace.
- Retained the runtime overload of `CreateCompanyAsync` for old internal callers; admin/public product selection uses the explicit product overload. Startup/default migrations are runtime-scoped. All-product rollout remains an explicit CLI/admin operation, as requested on review.
- A minimal no-seat trial guard is needed to meet Stage 2's dummy-product provisioning check. Generic quotes, invoices, seat limits, entitlement sources, and alternative counted/per-type seat models are not implemented here and remain Stage 3.
- The external test script uses installed PowerShell and PostgreSQL CLI tools. No real external product implementation or Civil business/pricing decision was added.
- The first attempt stopped at its fixture failure. The owner authorized these repairs and a new set of three final runs. No failed assertion was weakened or check bypassed. The earlier incremental resumed run failed on startup isolation; section 7 documents its investigation. All three final full invocations passed. The completion gate is satisfied, and the stage is ready for its single completion commit.
- Windows, Android, `design/`, admin frontend, and sign-up frontend source were not changed. Existing local `.claude/launch.json`, Android-generated edits, and the untracked audit document were left alone.
- Port 5298 was not stopped. No applied migration was edited or removed. No credentials were written to a file. No push, merge, main-branch change, or Stage 3 implementation occurred.

## 5. External migration login privileges and deferred per-database role

`TROVO_ADMIN_DATABASE_URL` contains the **privileged configured `PlatformAdmin` login**, pointed at the company database. Selecting a database in that URL does not restrict the credential to that database. The prefix guard and connection delegate prevent accidental platform dispatch to another database; they do not sandbox a child command holding this credential. External migration commands must be trusted server-side code.

On the authorized test server, `pg_roles` returned `rolsuper = true`, `rolcreatedb = true`, `rolcreaterole = true`, and `rolbypassrls = true` for the administrator. This login can:

- Connect to and read/change catalog and company data across databases, bypassing ordinary permissions and row-level security.
- Create, alter, and drop databases, schemas, tables, and other objects, including existing company schemas.
- Create/administer roles and logins, change grants/ownership, and perform other PostgreSQL superuser operations. Its authority is server-wide.

A production non-superuser platform administrator still needs database-creation/role-management privileges sufficient for the platform's database/login operations, plus ownership or equivalent migration/grant rights on the catalog and company schemas. Its exact reach depends on configured role memberships and grants. This stage does not reduce those privileges for the child command.

A future per-database **migration role** would need:

- Its own `LOGIN` credential and `CONNECT` only to the assigned company database.
- Ownership of its assigned schema/objects, or equivalent DDL rights sufficient for that product's migrations, including migration-history and seed-data access. Existing object ownership must permit later `ALTER`/`DROP` operations. Database `CREATE` is needed only if migrations must create schemas; elevated extensions can be preinstalled separately by the platform administrator.
- `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS`, and no memberships that regain platform-wide privileges. No catalog privileges. Other databases must deny its `CONNECT`, including through `PUBLIC` grants.
- Credential rotation/revocation appropriate to the migration lifecycle, and a child environment that exposes only the scoped credential rather than inherited platform administrator credentials. The platform administrator would retain database/login creation and runtime grants. The company's ordinary business-data login should remain distinct from this DDL-capable migration role.

**No per-database migration role or credential lifecycle was implemented**, as requested. Existing company business-data logins retain their restricted DML permissions.

## 6. Questions for the owner

None blocking Stage 2. All three full runs passed. The exact historical build-race mechanism remains an explicitly qualified inference in section 7 because the old binary was not preserved; this does not affect the verified current runtime-only startup behavior.


## 7. Investigation of the two startup failures (15 October)

Investigation preceded behavior changes. Temporary diagnostics captured stack traces at rollout entry, company migration entry, external-command dispatch, and script entry. They recorded only product keys, company IDs/database names, the marker path, and method stacks; no connection strings, passwords, or environment dump. With only this instrumentation added, the unchanged focused test passed both cases (2 passed, 0 failed/skipped, 46s).

### Complete migration caller inventory

- The sole production caller of `IProductModule.MigrateCompanyDatabaseAsync` is `CompanyDatabaseProvisioner.MigrateCompanyAsync`. The Car Spa and external modules implement it. Four direct test calls exercise external success, nonzero exit, timeout, and redaction in `ProductModuleTests`.
- Production callers of `CompanyDatabaseProvisioner.MigrateCompanyAsync` are `CreateCompanyAsync`, `AdoptDatabaseAsync`, and the per-company loop in `MigrateAllAsync(string?, CancellationToken)`. The two direct test calls are the failure/recovery checks in `ProductModuleTests`.
- Callers of the rollout are `Program.cs` startup with an explicit runtime key, `PlatformCommandLine`'s explicit migrate command, `PlatformAdminController.RunMigrations`, and the no-argument compatibility overload, which forwards the runtime key. CLI/admin may deliberately pass null for all products.
- `EnsureCatalogAsync` applies catalog migrations, creates missing product metadata, and calls each module's **catalog seeder**. Both seed implementations only add definitions/plans/add-ons and save catalog rows. Neither invokes a company migration or starts a command.
- Hosted services: `SubscriptionLifecycleWorker` waits 30s then runs subscription date/invoice lifecycle work; `WhatsAppBackgroundWorker` resolves active runtime companies and processes messages. Neither calls either company migration method. No hidden hosted migration caller was found.

### Captured execution and test setup

For the timeout case, trace entries 424–438 show `Program.cs:565 -> MigrateAllAsync(requested=pt28fb284eb4, runtime=pt28fb284eb4)`. Its only selected company is the runtime database `pt28fb284eb4_t_0001`. The demo company's earlier setup migration is `CreateCompanyAsync -> MigrateCompanyAsync -> ExternalCommandProductModule`, with `SCRIPT mode=context marker=` (no marker).

Only after startup, the unchanged absent-marker assertion, dashboard request, and persisted-state assertions succeed does trace entry 527 show `requested=<null>`. The captured caller is **`PlatformAdminController.RunMigrations`**, reached through the test's explicit `POST /api/platform/migrations/run`. That operator-requested rollout invokes `MigrateCompanyAsync -> ExternalCommandProductModule.MigrateCompanyDatabaseAsync -> Process.Start -> external-product-test.ps1`, writing the marker for `mode=timeout`. The fail case shows the same sequence at entries 1400 (runtime startup) and 1482 (explicit admin rollout). The two markers use distinct new GUID paths, and the two runtime keys differ from each other and from `demo`. Marker creation is after setup; marker cleanup is in `finally`. No path reuse or runtime/demo key mix-up was observed.

Evidence is retained in the ignored directory `backend/tests/CarSpaManagement.Api.Tests/bin/stage2-investigation-23781e82/`: `trace.log`, `reproduction.log`, and `previous-startup-evidence.log`.

### Root-cause assessment before correction

The earlier run really did execute all-product migration during startup: retained API logs at **14:54:15–14:54:34** record the demo failure before `WhatsAppBackgroundWorker started`/`Application started`, and explicitly report **2 company databases checked**. That rules out the later maintenance request as the explanation for that historical failure. The freshly rebuilt instrumented code instead reports **1 company database checked** at startup, and the captured stack identifies the later demo invocation as the explicit admin request. No behavior or assertion changed between these observations.

The evidence points to a **stale incremental build artifact running earlier startup behavior**, rather than a defective marker assertion or an additional production migration caller. The failed run's API/test outputs were already built (its log emitted no compiler warnings), whereas adding diagnostics forced compilation of both projects and made both unchanged cases pass. Before that rebuild the loaded/copied API DLL timestamp was 14:41:42; the runtime-only source edits were timestamped 14:40:52. A build server had been observed starting at 14:40:23. An in-flight build compiling an earlier source snapshot and finishing after edits is a consistent explanation for incremental checks accepting that older behavior. **That precise build-race mechanism is an inference:** the previous binary was replaced by the diagnostic rebuild, so it cannot now be independently disassembled or checksum-compared. The verified facts are the old all-product startup logs, the current explicit-runtime stack, and passing unchanged tests after forced compilation.

Correction: removed all temporary C# stack capture, diagnostic environment variables, and marker-script logging. Forced a non-incremental build with no other check active, then reran the unchanged focused cases without diagnostics: both passed (54s). All three full baseline invocations subsequently passed all 1,337 backend tests and every frontend check, with no skipped tests or crashes. No further runtime behavior change or test correction was needed; the existing runtime-only startup fix was retained. All Stage 2 completion checks are now satisfied. The previous binary is unavailable, so the precise historical build-race mechanism remains explicitly identified as an inference rather than a proved call-stack fact.
