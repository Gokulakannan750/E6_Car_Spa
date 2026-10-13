# Project improvement review — 13 October 2026

## Scope

Reviewed the workspace commands, API service/controller structure, desktop HTTP client and Electron file serving, shared desktop preferences, admin session and billing helpers, and Android refresh lifecycle. Exercised the existing module test suites. This is a targeted improvement pass, not a claim that every workflow has been manually audited or tested against a live deployment.

Existing uncommitted launch configuration, generated Flutter registrations, and SaaS planning documents were preserved.

## Implemented improvements

| Area | Problem | Result |
| --- | --- | --- |
| Admin sessions | Invalid expiry/activity timestamps could evade comparisons; activity could revive an idle session. | Corrupt or expired sessions are cleared, and activity cannot renew a timed-out session. |
| Admin billing | Very large typed amounts could overflow or lose integer precision. | Rupee parsing rejects amounts outside JavaScript's safe integer range in paise. |
| Desktop HTTP | Spreading `Headers` or header tuples silently lost caller headers; differently cased overrides could conflict. | Uses the standard `Headers` container and honors caller overrides consistently. |
| Desktop HTTP | Cancelled requests appeared as network failures. | Preserves cancellation errors for callers. Multipart uploads still let the browser choose the boundary. |
| Electron | String-prefix containment allowed sibling directory names sharing the renderer prefix. | Resolves paths and checks their relative relationship to the packaged renderer directory. |
| Shared preferences | Formatting and query infrastructure imported a React settings page; corrupt cached values could crash currency formatting or configure invalid polling. | Dedicated preferences module validates supported values against the API's preference contract. Existing page exports remain compatible. |
| Android refresh | A preference update could restart polling after the app moved into the background. | Background state prevents restarting or executing polling; resume restores the configured interval. Manual mode remains off. |
| Workspace commands | API startup targeted a nonexistent workspace package; root type checking targeted no project configuration. | API startup targets the .NET project. Root type checking covers the desktop and admin projects. Explicit test commands exist for each application. |
| Desktop build checks | Desktop type checking covered the legacy `src` directory rather than the renderer and Electron entry points. | Build and type-check commands now check the renderer and Electron sources explicitly. |
| Report test reliability | The report screen test exhausted its default one-second data-loading wait under concurrent full-suite load. | Waits explicitly for the report row before checking the rest of the screen; all assertions are retained. |

Regression tests cover corrupt/expired sessions, billing overflow, header formats, multipart boundaries, cancellation, path traversal, invalid preferences, and Android background/resume behavior.

## Module assessment

The API separates controllers, application services, DTOs, domain entities, database infrastructure, authorization, tenancy, and platform billing. Retaining these boundaries is preferable to a broad rewrite. Existing regression coverage exercises customer/vehicle ownership, job-card/invoice consistency, payments, staff attendance/salary/advances, showroom operations, reports, role permissions, tenancy, platform subscriptions, and WhatsApp behavior.

The desktop and Android applications already have extensive module tests. Shared authentication, network, preferences, and refresh code affects many workflows, so this pass concentrates changes there rather than changing business rules without a concrete defect.

## Follow-up work supported by this review

1. Restore lint configuration. `pnpm lint` reaches the renderer's installed ESLint 9, but it fails because the repository has no `eslint.config.js`, `.mjs`, or `.cjs`. Establish and measure a lint baseline before enforcing new rules in CI.
2. Consolidate legacy workspace tooling. `migrate` and `db:seed` still reference a nonexistent `@carspa/backend` package. The API has startup migration/bootstrap behavior, including company database provisioning; a replacement migration command needs to account for the deployment's tenancy mode and database-owner privileges. No database operation was performed during this review.
3. Reduce report/export bundle weight. The production desktop build reports large chart/report chunks. Separate spreadsheet export code from report rendering and measure the resulting startup and report-load behavior before changing chunk boundaries.
4. Profile backend reporting and customer-list queries against representative PostgreSQL data. `ReportService` materializes date-filtered job cards for dashboard calculations; `CustomerService` repeats invoice summary predicates across list/count/detail queries. Any consolidation should retain payment-state filtering and tenant isolation tests and include query-plan checks.
5. Exercise end-to-end workflows in the intended deployment environment. PostgreSQL concurrency/row-level-security tests now pass locally; packaged Electron smoke tests, real Android device checks, and live WhatsApp delivery validation remain separate deployment checks.

## Validation

- Initial API suite: 1,094 passed, 170 skipped. Database follow-up: 1,269 passed, zero skipped, zero failures against an isolated PostgreSQL 18 instance, including the new configuration guard and expanded theory cases.
- Admin portal: 21 tests passed; production build passed.
- Final desktop suite: 749 tests passed, zero failures, across 79 test files. Focused Electron/HTTP and preferences/settings/formatting checks also passed.
- Root type checking passed, including renderer, Electron, and admin sources.
- Android refresh tests: 15 passed, including existing catalogue/showroom refresh checks.
- Full Android suite: 1,064 tests passed, zero failures.
- Final desktop production build: passed, including renderer and Electron type checks and bundles. Existing large-chunk warnings remain.
- The report-screen test's asynchronous loading wait was improved after a failure under concurrent suite load; the final full desktop suite passed with that change.
- Lint: blocked by the existing missing ESLint configuration.

## PostgreSQL testing follow-up

The previously skipped tests required `CARSPA_TEST_PG_CONNECTION`. An isolated local PostgreSQL 18 server was created for this run. The full API suite passed with database coverage enabled, all temporary test databases were removed by the fixtures, and the isolated server was stopped after validation.

- CI now provisions PostgreSQL 18 with a health check and enables required database coverage.
- A configuration guard prevents missing or blank connections from silently skipping required database tests.
- CI validates its TRX report for a non-empty test run with zero skips.
- `pnpm test:backend:integration` provides a local command with the same coverage requirements and a separate report for every run.
- Parallel test collections are limited to four; individual concurrency tests retain their simultaneous requests.
- The integration command passed 17 focused payment, tenant-isolation, and configuration checks. Negative checks verified rejection of missing/blank connections and an empty test selection.

Setup and usage are documented in `backend/tests/README.md`. GitHub Actions configuration was updated; the hosted CI job itself was not executed from this workspace.
