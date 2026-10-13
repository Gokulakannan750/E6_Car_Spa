# Live end-to-end tests (admin portal + API + PostgreSQL)

`saas-flow.spec.ts` drives the real portal against a real platform API. In order it checks:

1. An Owner signs in (password + authenticator code).
2. A company is created on the free trial; the company code and one-time registration code are read from the dialog.
3. The customer registers with those codes (`POST /api/auth/register`); the same code cannot be used twice.
4. The customer signs in with the company code; their subscription is `Trialing`.
5. Trovo changes the plan to Starter yearly with 1 Windows + Android and 1 Android licence plus Outside jobs, issues the invoice (₹17,970 at placeholder prices) and records a bank payment.
6. The customer's subscription is `Active` on `starter` with Outside jobs on; an Android-only user can sign in from Android but not Windows.
7. The invoice print view shows Trovo Tech Solutions.
8. Suspend blocks the customer's sign-in; reactivate restores it.
9. The Companies and Invoices CSV exports contain the company and the paid invoice.
10. The audit log shows every step, with the reason.
11. A new Support admin is added, signs in for the first time (QR setup + new password), has no owner pages, and is switched off.

**Every run creates a new company and its database.** Run it only against a throwaway catalog on your own machine.
The tests refuse any address that is not `localhost` unless `PLATFORM_E2E_ALLOW_REMOTE=1`.

## Run

1. Start the API in platform mode against a throwaway catalog, for example on port 5321:

   ```bash
   ASPNETCORE_ENVIRONMENT=Development \
   Platform__Enabled=true \
   ConnectionStrings__Platform="Host=localhost;Database=carspa_platform_e2e;Username=...;Password=..." \
   ConnectionStrings__PlatformAdmin="Host=localhost;Database=postgres;Username=...;Password=..." \
   Platform__Jwt__Key="<48+ random characters, different from Jwt:Key>" \
   ASPNETCORE_URLS=http://localhost:5321 \
   dotnet run --project backend/api/CarSpaManagement.Api --no-launch-profile
   ```

2. Create an Owner once (`platform create-admin`, same environment variables), sign in once in the portal to set up
   the authenticator, and keep the authenticator key (shown under the QR code) and your password.
3. Start the portal pointing at that API:

   ```bash
   PLATFORM_API_PROXY=http://localhost:5321 pnpm --dir apps/platform-admin dev
   ```

4. Run:

   ```bash
   PLATFORM_E2E_OWNER_EMAIL=you@example.com \
   PLATFORM_E2E_OWNER_PASSWORD='...' \
   PLATFORM_E2E_OWNER_TOTP_SECRET='ABCD...' \
   pnpm --dir apps/platform-admin test:e2e:live
   ```

Optional: `PLATFORM_E2E_PORTAL_URL` (default `http://localhost:5190`) and `PLATFORM_E2E_API_URL` (default: the portal,
whose dev server forwards `/api`).

The API allows 5 sign-in requests a minute from one address, so the run waits between sign-ins; it takes about 3
minutes. Without the three `PLATFORM_E2E_OWNER_*` variables the live tests are skipped.

## The mocked suite

`pnpm --dir apps/platform-admin test:e2e` runs `e2e/mocked/` against an in-memory fake API (no database). It runs in CI.
