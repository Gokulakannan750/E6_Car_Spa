# Stage 0 — Branch and baseline

Date: 14 October 2026

## 1. Changes

- Read `docs/Trovo_Platform_Multi_Product_Audit.md` completely, including Parts 1 and 2.
- Created `platform-multi-product` from `main` at `80faac5b`.
- Added this baseline report. No application code changed.
- Added a sequential baseline runner during the owner-authorized timeout investigation.
- Existing changes in `.claude/launch.json`, generated Android files, and the untracked audit document were left untouched and excluded from the stage commit.

## 2. Commands and results

| Command | Result |
| --- | --- |
| `dotnet test backend/CarSpaManagement.slnx` (before the working PostgreSQL connection was supplied) | Passed: 1,112; failed: 0; skipped: 197; total: 1,309 |
| `dotnet test backend/CarSpaManagement.slnx --no-build` (with `CARSPA_TEST_PG_CONNECTION` set) | Passed: 1,313; failed: 0; skipped: 0; total: 1,313; duration: 7m 59s |
| `pnpm --dir apps/platform-admin type-check` | Passed, exit 0 |
| `pnpm --dir apps/platform-admin test` | Passed: 21; failed: 0; 4 test files passed |
| `pnpm --dir apps/platform-admin test:e2e` | Passed: 2; failed: 2; exit 1 |
| `pnpm --dir apps/signup-web type-check` | Passed, exit 0 |
| `pnpm --dir apps/signup-web test` | Passed: 7; failed: 0; 1 test file passed |

Pre-existing browser test failures (no implementation changes had been made):

1. `e2e/mocked/portal.spec.ts:34`: first sign-in, QR setup, new password, dashboard — exceeded the 60-second test timeout. The saved page snapshot shows the dashboard with a loading status.
2. `e2e/mocked/portal.spec.ts:97`: overdue-invoice payment and CSV export — exceeded the 60-second timeout during `signIn`, while filling the password at line 27.

Playwright saved failure context and traces under `apps/platform-admin/test-results/`. These generated artifacts are not included in the commit. Chromium was available; no installation was necessary.

## 3. Skipped or unfinished work

Stages 1–3 have not started. The initial admin browser failure blocked continuation under the owner's exception to rule A.8. Following the authorized investigation, all six checks passed in the complete sequential rerun below. Stage 0's baseline gate is now satisfied.

## 4. Decisions

- The initially supplied `multiproduct` credentials failed authentication. The owner then supplied a working `postgres` test connection; its database-creation permission was verified. No credentials are stored in this report or committed files.
- The backend was first built and tested before the working connection was supplied. The PostgreSQL-enabled rerun uses `--no-build` against that unchanged build.
- No application fixes or retries were made after the browser failures, following the instruction to stop and report on failed checks.
- No push or merge was performed. Port 5298 was not stopped or used for a test API.

## 5. Questions for the owner

The owner authorized investigation and repair of the baseline failures.

## Follow-up — Browser timeout investigation

- The original browser run overlapped the backend build, both TypeScript checks, and both Vitest suites. The admin Vitest run took 86 seconds and the sign-up Vitest run took 52 seconds.
- With those workloads finished, the unchanged `pnpm --dir apps/platform-admin test:e2e` command passed all 4 tests in 14.6 seconds.
- `pnpm --dir apps/platform-admin exec playwright test --project=mocked --repeat-each=3 --workers=1` passed all 12 tests in 35.5 seconds. Individual cases took approximately 1.6–3.2 seconds.
- No repeatable application failure was found. Resource contention during simultaneous test/build processes is the likely explanation for the original timeouts; this is an inference from the timing and successful isolated runs.
- Added `scripts/test-platform-baseline.ps1` to run all six required commands in sequence, requiring the PostgreSQL test connection and stopping on the first nonzero exit code. It does not store or print credentials, weaken assertions, increase timeouts, or automatically retry failures.
- The complete sequential baseline rerun (`scripts/test-platform-baseline.ps1`) passed, exit 0:

| Check | Result |
| --- | --- |
| Full backend, PostgreSQL enabled | 1,313 passed, 0 failed, 0 skipped; 6m 54s |
| Admin TypeScript | Passed |
| Admin unit tests | 21 passed, 0 failed; 8.64s |
| Admin browser tests | 4 passed, 0 failed; 13.3s |
| Sign-up TypeScript | Passed |
| Sign-up unit tests | 7 passed, 0 failed; 2.42s |

The earlier failure records remain above for auditability. The runner and updated report are included in the single amended Stage 0 commit; no application code, test assertions, or timeout values changed.
