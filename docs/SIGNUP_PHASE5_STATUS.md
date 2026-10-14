# Phase 5 — local preparation

14 October 2026. Branch `signup-phase5` created from current Phase 4 work in the app repository and from current main in the website repository. No staging host has been chosen. No staging API exists. Preparation only; Phase 5 is not complete.

## Confirmed by user

- Prepare locally while hosting is undecided.
- Existing APIs on localhost:5321 and localhost:5298 use Development/platform mode, signup and test payments enabled.
- Both use `carspa_platform_dev21` on localhost:5432, which contains manual test companies. It is **not disposable**. Do not create test companies or drop databases there.
- Destructive live-flow tests need a separate throwaway catalogue on its own port, with cleanup of that catalogue and only its generated company databases afterwards. No such isolated environment has been configured in this task. User-secrets remain private.

## Decisions (14 October 2026)

- Sign-up address: `https://signup.trovotechsolutions.in/` at the root of its own host (matches this preparation; no `/baylior/` path).
- Downloads: real download links will be used (Windows installer and Android); the addresses are still to be supplied.
- Terms, Refund, Privacy and Data deletion pages approved for publishing; committed to the website repository (6ffe462). Terms now match the built plan-change rules and name Baylior.
- Still open: where the API runs, and the staging payment mode.

## Prepared

- Dedicated-host Apache/LiteSpeed SPA rewrite file in signup-web/public, copied by the production build.
- Explicit-null staging settings manifest and API configuration example; no host invented or configured.
- Read-only staging preflight that checks configuration and, optionally, catalogue/CORS/SPA/CSP/link status without creating companies or payments.
- Setup/verification runbook at deploy/signup/README.md.
- Mocked tests for payment-disabled behaviour and direct load/refresh of every signup route, alongside existing paid/trial/validation/registration-code coverage.

## Still required

Host/server choice, staging HTTPS and API, verified policy/product/download destinations (or approved installer contact fallback), isolated disposable live-test environment, actual deployed SPA/CSP/CORS checks, website staging destination configuration, live registration flows and confirmed production release settings. Website links remain disabled placeholders. No companies created, no databases dropped and no deployment performed by this task.

## Checks executed

- Production build and TypeScript: passed; dist/.htaccess copy confirmed.
- Unit tests: 7 passed.
- Mocked browser tests: 15 passed (including payment-disabled behaviour and direct route load/refresh recovery).
- Offline preflight cases: 8 passed.
- The unconfigured example intentionally fails readiness with “signupOrigin is not confirmed.” No online preflight or live signup tests were run.
