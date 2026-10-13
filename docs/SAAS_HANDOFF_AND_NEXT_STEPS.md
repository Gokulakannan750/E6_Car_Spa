# Trovo SaaS: status, plan and instructions for continuing the work

**Updated:** 12 Oct 2026 · **Written for:** any developer or AI coding agent (Claude Code, Antigravity, …) that continues
this project when the previous session ends.

**Read this whole file before changing anything.** Then read the documents it points to for the phase you work on.

---

## 0. How to use this document

1. Read §1–§5 (what exists, the rules, how to run and test).
2. Go to §6 and take the **first step that is not marked done**. Do only that step.
3. Before starting a step, check the "Decisions needed from the owner" list for that step. If a decision is missing,
   **stop and ask the owner** (the user). Do not guess business decisions (prices, gateway, email provider, hosting).
4. Work on a feature branch in a separate git worktree (§4). Never on `main`.
5. When the step is done, run every test suite (§3.3), update §6 of this file (mark the step done, with the commit and
   test counts), and report to the owner. **Do not merge or push** unless the owner says so.

Copy-paste prompt for a new agent session: see §9.

---

## 1. What the product is

- **Car Spa Management** by **Trovo Tech Solutions** (Erode, Tamil Nadu): billing, job cards, invoices, staff,
  showroom and franchise software for car detailing businesses.
- Apps: **Windows** (Electron + React, `apps/desktop`), **Android** (Flutter, `apps/android`), one **ASP.NET Core 10 API**
  (`backend/api`) with **PostgreSQL**. The first customer is **E6 Car Spa** (company code `0001`).
- **SaaS goal:** Trovo sells subscriptions. Each customer company gets **its own PostgreSQL database and its own
  database login**. Trovo's own data (companies, plans, subscriptions, invoices to customers, payments, admins, audit)
  lives in a separate **catalog database**. Trovo staff run everything from the **admin portal** (`apps/platform-admin`).

### Business decisions already made (do not change without the owner)

| Topic | Decision |
|---|---|
| Database | Separate database + login per company; catalog database for Trovo's data |
| First login | Trovo creates the company; the customer registers with **company code + one-time registration code** (sent by WhatsApp/phone for now) |
| Trial | 7 days, full Professional |
| Unpaid | 7 days grace (banner), then **read-only** until paid |
| Cancel | Read-only for 90 days, then data deleted on request |
| Pricing (13 Oct) | **Per user licence**, by app: Android only, Windows only, or Windows + Android (one person on both apps = one licence). Bought **one at a time**; every plan includes **at least 1**. A user can sign in only to the apps their licence covers; the company Owner assigns licences to users. Plans: Starter and Professional (Professional includes Outside jobs, Staff advances & salary, WhatsApp automation, Advanced reports, Audit trail). **Starter can buy each of those five as an add-on**; a plan never pays twice for a module. Showroom and Franchise network are add-ons. **Excel/CSV export is free in every plan.** **Real prices: not decided yet** — the seeded prices are placeholders; the owner sets them in Plans & Prices |
| Configuration | Prices, plans, add-ons, trial days, trial users, grace days and renewal-invoice days are set by Trovo in the admin portal. Only the list of features and the licence types are in code |
| Money | Integer paise + currency everywhere |
| GST | Trovo has **no GSTIN**: no GST, invoices titled "Invoice". Seller name **"Trovo Tech Solutions"** (never "Private Limited") |
| Payment gateway | Provider-independent interface; **the gateway with the lowest platform fee**, chosen by the owner before Phase 2.5 (Razorpay is the first candidate) |
| Email | Not decided yet (needed for Phase 2.6) |
| Admin portal address | Not decided yet (e.g. `admin.trovotechsolutions.in`) |
| Branches (one owner, several outlets) | Later; discuss numbering with the first client |
| Franchise | Each franchisee pays Trovo separately; the franchisor sees approved totals read-only |

Full reasoning: `docs/SAAS_PHASE2_PLAN.md` (§1 decisions, §5 lifecycle, §6 entitlements, §7 platform API, §9 security).

---

## 2. Status

| Phase | What | Status |
|---|---|---|
| 2.0 | CI fixes | ✅ merged to `main` |
| 2.1 | Database + login per company, registration codes, Windows + Android registration screens | ✅ merged to `main` (a642e41f) |
| 2.2 | Plans, subscriptions, entitlements, seat limits, lifecycle job, read-only/suspended enforcement, platform admin API with 2-step sign-in and roles, manual invoices and payments | ✅ merged to `main` |
| 2.3 | Franchise across separate databases | ✅ merged to `main` |
| 2.4 | **Admin portal web app** + API additions + E2E tests | ✅ merged to `main` and pushed (12 Oct) |
| 2.4b | **Per-user app licences, module add-ons, catalog management, platform settings** (owner's pricing decision, 13 Oct) | ✅ built on branch `feature/saas-user-licences` (worktree `C:\r2e\p25`). **Not merged, not pushed.** |
| 2.5 | Payment gateway | ⏳ next (needs the owner's gateway choice) |
| 2.6 | Self sign-up and email | ⏳ |
| 2.7 | Full end-to-end validation, backups, E6 rehearsal, hosting and rollout | ⏳ |

### Phase 2.4 commits (merged from `feature/saas-admin-portal`, based on `main` 3a2ebfed)

- `574aac75` API for the portal: admins list/create/update/reset, forced password change after a one-time password,
  invoice list/detail with seller details, CORS for `Platform:AdminPortalOrigin`.
- `4bc71bfb` Stitch design export (`design/stitch-admin-portal/`), the visual reference.
- `d86c2806` The portal app; API now ends a platform session immediately when its admin is switched off, changes role
  or is reset; CI job.
- `32f32635` Playwright E2E: mocked suite (CI) + live suite against the real API; this handoff document.

Test counts at the end of 2.4: backend **1268/1268** (with PostgreSQL), portal Vitest **18/18**, portal Playwright
mocked **4/4**, portal live E2E **8/8**. Windows (734) and Android (1062) were not changed in 2.4.

### Phase 2.4b: per-user app licences (branch `feature/saas-user-licences`, based on `main` ee7ac298)

What changed, and where:
- **Catalog:** `PlanVersion` has `AndroidUserPriceMinor`, `WindowsUserPriceMinor`, `BothUserPriceMinor` (plus `PriceMinor` =
  optional company fee, `IncludedSeats` = minimum licences). `Subscription` has `AndroidLicences`, `WindowsLicences`,
  `BothLicences`. New table `PlatformSettings` (`PlatformSettingsService`, limits in code). Migration
  `UserLicencesAndSettings` converted existing subscriptions (one both-apps licence per user allowed before), retired the
  `seats_5` add-on and put placeholder licence prices on the two seeded plans.
- **Company databases:** `Users.AppAccess` (0 = Both, 1 = Android, 2 = Windows; migration `AddUserAppAccess`).
- **Rules:** `UserService.EnsureSeatAvailableAsync` (licence per type on create/reactivate/change; only the Owner changes
  app access); `AuthService.LoginAsync` checks `LoginRequest.App` ("windows"/"android") against the user's access and
  puts it in the token (`app` claim); `PermissionAuthorizationHandler` re-checks it on every protected request;
  `ClientApp` in `Domain/Enums/AppAccess.cs`. Owner at registration takes the best licence bought.
- **Add-ons:** five module add-ons seeded (`outside_jobs`, `staff_advances`, `whatsapp_automation`, `advanced_reports`,
  `audit_trail`); `SubscriptionService.SetAddOnsAsync` refuses a module the plan includes; a plan change drops them.
- **Portal API:** `PlatformCatalogController` (create/update plans and add-ons, GET/PUT settings); licences on
  company create/change and in company detail (`licencesUsed`); licence prices on plan versions.
- **Apps:** Windows sends `app: "windows"`, Android `app: "android"` at sign-in; both have an "App access" choice on the
  Users screen (shown only on the platform) and show the server's message when sign-in is refused.
- **Portal UI:** licence steppers in New company / Change plan with live totals and an "upgrade is cheaper" hint;
  licences bought vs in use on the company page; New plan, New add-on, stop/resume selling; Subscription settings on
  the System page; dialogs scroll inside on 1366×768.

Test counts at the end of 2.4b: backend **1287/1287**, Windows **738**, Android **1066**, portal Vitest **18/18**,
portal Playwright mocked **4/4**, live E2E updated for licences (see §6 Step A2).

---

## 3. Repository, running and testing

### 3.1 Map

```
backend/api/CarSpaManagement.Api/
  Controllers/Platform/        platform admin API (/api/platform/*)
  Infrastructure/Platform/     catalog DbContext, provisioner, subscriptions, entitlements, lifecycle job,
                               admin auth (PlatformSecurity.cs), invoices, CLI (PlatformCommandLine.cs)
  Domain/Platform/             catalog entities (BillingEntities.cs, PlatformEntities.cs), FeatureKeys
  Migrations/Platform/         catalog migrations (company databases use the normal Migrations/)
backend/tests/CarSpaManagement.Api.Tests/   xUnit; Platform*Tests.cs cover the SaaS parts
apps/desktop/ (electron + renderer)         Windows app
apps/android/                               Flutter app
apps/platform-admin/                        admin portal (React 19, Vite 6, Tailwind 4, TanStack Query/Table)
  src/lib/api.ts                            every platform API call
  src/features/*                            one folder per screen
  e2e/mocked, e2e/live                      Playwright suites (see e2e/live/README.md)
design/stitch-admin-portal/                 approved portal design (reference only)
docs/                                       plans; this file
```

### 3.2 Running locally

- **Secrets** (DB connection, JWT key, WhatsApp key) are in `dotnet user-secrets` of the API project, not in
  appsettings. Never commit secrets; never print passwords.
- **Normal (single-company) mode:** `Platform:Enabled` is false by default and the app works as before against the dev
  database `E6CarSpaNew`. **That database contains real E6 data: never run SaaS experiments against it.**
- **Platform mode** (SaaS): set `Platform__Enabled=true`, `ConnectionStrings__Platform` (catalog database),
  `ConnectionStrings__PlatformAdmin` (a login that may create databases and roles, used only by the provisioner) and
  `Platform__Jwt__Key` (48+ random characters, different from `Jwt:Key`). Use **throwaway** database names.
  Recipe: `apps/platform-admin/e2e/live/README.md`.
- **CLI** (same environment): `dotnet run --project backend/api/CarSpaManagement.Api -- platform help`
  (`create-admin`, `reset-admin`, `create-company`, `new-registration-code`, `adopt-database`, `migrate`,
  `run-lifecycle`, `list`).
- **Admin portal:** `pnpm --dir apps/platform-admin dev` (port 5190; `/api` goes to `http://localhost:5298`, or set
  `PLATFORM_API_PROXY`).
- Port **5298** is usually the owner's own running API. Do not stop it; run test APIs on other ports (e.g. 5321).
- The Windows app's Content-Security-Policy only allows the API on 5298.

### 3.3 Tests (run all of them before reporting a step as done)

```bash
# Backend (PostgreSQL tests run only when CARSPA_TEST_PG_CONNECTION points at a server where the user may create databases;
# they create and drop their own carspa_test_* databases)
dotnet test backend/CarSpaManagement.slnx

# Windows
pnpm --dir apps/desktop/renderer type-check
pnpm --dir apps/desktop test

# Android
cd apps/android && flutter analyze && flutter test

# Admin portal
pnpm --dir apps/platform-admin type-check
pnpm --dir apps/platform-admin test
pnpm --dir apps/platform-admin test:e2e          # mocked API, needs: pnpm --dir apps/platform-admin exec playwright install chromium
pnpm --dir apps/platform-admin test:e2e:live     # real API, see e2e/live/README.md
```

CI (`.github/workflows/ci.yml`) runs backend, Windows, Android and the admin portal (including the mocked E2E).

---

## 4. Rules (must follow)

1. **Git:** feature branch in a worktree under a short path (Windows long paths), e.g. `git worktree add C:\r2e\p25 -b
   feature/saas-payment-gateway main`. Commit with clear messages. **Never merge to `main` or push unless the owner
   says so.** Never commit `.claude/launch.json`, `.env`, secrets, build output.
2. **Data safety:** never touch `E6CarSpaNew` (real data) except through the normal app. Never reset or renumber
   existing E6 invoice numbers. Test only on throwaway databases (and drop them afterwards).
3. **EF Core:** never run `dotnet ef migrations remove --force` (it once rolled back a migration in the real dev DB).
   Build first, read each generated migration before applying. Catalog migrations go to `Migrations/Platform`
   (`--context PlatformDbContext --output-dir Migrations/Platform`).
4. **WhatsApp:** do not change the existing WhatsApp invoice behaviour. Changing an invoice number must not send WhatsApp.
5. **Security:** never collect customers' Facebook/Meta passwords or tokens; never log passwords, tokens, card or UPI
   details; gateway secrets stay server-side; verify webhook signatures and re-check payments with the gateway.
6. **Feature mapping:** the plan-feature mapping exists three times and must stay identical: API `PlanFeatureMap`,
   Windows `featureForPermission`, Android `PlanFeatures`.
7. **UI:** follow the approved design (Stitch exports in `design/`); do not invent features shown in mockups that the
   owner did not ask for. Use "Trovo Tech Solutions".
8. **Ask, don't guess,** on prices, gateway, email provider, hosting, legal text.
9. Keep this file updated at the end of each step.

### Known gotchas

- A new `SubscriptionItem` with a preset Guid must be added with `catalog.SubscriptionItems.Add(...)`, not through the
  navigation collection (EF would issue an UPDATE).
- `SqlQuery<long>` on `UPDATE … RETURNING` cannot be composed: use `.ToListAsync()` then `.Single()`.
- Sign-in endpoints allow **5 requests a minute per IP** (`auth-login`), registration 3 a minute (`auth-bootstrap`).
  Tests that sign in often must pace themselves (see `e2e/live/helpers.ts`).
- Platform admin tokens are checked against the database on every request (active, role, reset).
- Android tests: providers that call the network are disabled under `FLUTTER_TEST`.
- Superuser database connections bypass row-level security; RLS is only a second lock (separate databases are the first).
- Line endings: the repo uses CRLF on Windows checkouts; that warning on `git add` is harmless.

---

## 5. Architecture essentials (short)

- **Routing:** each company request carries a token with the company id → `ICompanyDirectory` (cached) → the company's
  connection string → `TenantConnectionInterceptor` switches the EF connection. Company logins are `NOSUPERUSER`,
  DML-only, CONNECT only to their own database.
- **Subscription state** (catalog) → `SubscriptionAccessMiddleware` (read-only refuses writes, suspended refuses all) and
  `PlanFeatureFilter` (per endpoint permission → plan feature). `GET /api/subscription/status` feeds the banners.
- **Lifecycle job** (`SubscriptionLifecycleWorker`, every 15 min): trial end, renewal invoices 7 days before (trial: 3),
  grace, read-only, cancel at period end.
- **Invoices:** `BillingInvoiceService`, numbers `TROVO/{FY}/{n}` from a locked counter row. Payments:
  `SubscriptionService.RecordManualPaymentAsync` (fully paid → activates/renews).
- **Platform admins:** separate JWT scheme `Platform`, password + TOTP always, roles Owner/Billing/Support/ReadOnly,
  forced password change after a one-time password, append-only audit log.

---

## 6. Next steps (in order)

### Step A: Finish Phase 2.4 (owner review, then merge) ✅ merged 12 Oct

- [ ] Owner tests the portal by hand (sign-in with QR, create company, register it from Windows/Android with the codes,
      change plan, issue invoice, record payment, suspend/reactivate, exports, audit log, admins).
- [ ] Fix anything the owner reports.
- [ ] **When the owner says "merge":** in the main checkout, first delete the untracked copies of
      `docs/SAAS_PHASE2_4_ADMIN_PORTAL_PLAN.md` and `docs/STITCH_PROMPTS_ADMIN_PORTAL.md` if the branch contains them
      (otherwise git refuses the merge), then `git merge --no-ff feature/saas-admin-portal`, run all tests, push only
      if told. Remove the worktree afterwards (`git worktree remove C:\r2e\p24`).
- [ ] Clean up throwaway databases from local testing when the owner agrees: `carspa_platform_dev21`,
      `carspa_rehearsal_e6`, `carspa_t_0002`… created by tests, `E6CarSpaFranchiseView`, `E6CarSpaTenantCopy`,
      `carspa_test_whatsapp`, and roles `carspa_t_*` (never `E6CarSpaNew`).

### Step A2: Per-user licences (Phase 2.4b) — owner review, prices, then merge

- [ ] Owner tests: create a company with a mix of licences; in the Windows app give a user "Android only" and check
      that user cannot sign in on Windows but can on Android; try adding more users than licences; buy a module add-on
      on Starter; upgrade to Professional and check the add-on ends; change trial days in System.
- [ ] **Owner sets the real prices** in Plans & Prices (New price on Starter and Professional, and on each add-on).
      The seeded ones are placeholders: Starter ₹999 / ₹699 / ₹499 per user per month (both / Windows / Android),
      Professional ₹1,499 / ₹1,199 / ₹799, module add-ons ₹299, yearly = 10 × monthly.
- [ ] When the owner says "merge": `git merge --no-ff feature/saas-user-licences` in the main checkout, run all
      suites, push only if told, remove worktree `C:\r2e\p25`.
- [ ] Release note for clients: **new Windows and Android app versions are required** on Trovo's platform (old apps do
      not send the app type, so only users with both apps can sign in with them). Single-company servers (E6 today)
      are unaffected.

### Step B: Phase 2.5 Payment gateway (estimate 9–12 days)

**Decisions needed from the owner first:**
1. Which gateway (compare platform fees: Razorpay, Cashfree, PayU, PhonePe PG). 2. Test-mode account keys (the owner
creates the account and enters keys into user-secrets themselves; never ask them to paste secrets into chat).
3. One-off payment links per invoice first, or recurring mandates (autopay) as well.

**Recommended design** (keeps card/UPI data off our servers and works the same in Electron and Flutter):
- `Application/Interfaces/IPaymentGateway`: `CreatePaymentLinkAsync(invoice)`, `VerifyWebhook(rawBody, headers)`,
  `ParseEvent(rawBody)`, `FetchPaymentAsync(providerPaymentId)`, `RefundAsync(...)`. One adapter per provider in
  `Infrastructure/Platform/Gateways/` (e.g. `RazorpayGateway`), selected by `Platform:Gateway:Provider`; keys under
  `Platform:Gateway:<Provider>:*` in secrets.
- **Pay an invoice:** when a renewal invoice is issued (lifecycle job) or on request, create a hosted **payment link**
  for the invoice amount computed on the server; store `ProviderOrderId` on a `PaymentTransactions` row (Pending).
  Windows/Android show **"Pay now"** in the subscription banner and a Billing page for the Owner
  (`GET /api/billing/invoices`, `POST /api/billing/invoices/{id}/pay` → link URL) and open it in the system browser.
  The portal shows the link and can resend it.
- **Webhook** `POST /api/billing/webhooks/{provider}` (anonymous, raw body): verify signature → store in
  `PaymentWebhookEvents` (unique provider + event id, payload hash) → **re-fetch the payment from the gateway API** →
  apply through one shared method used by manual payments too (refactor `RecordManualPaymentAsync` into
  `RecordPaymentAsync(provider, …)`), idempotent on `ProviderPaymentId`. Unknown/mismatched amounts or payments for
  void/paid invoices go to an **exceptions list** (not applied).
- **Reconciliation job** (daily): fetch the gateway's payments for the last 2–3 days, match them to our rows, flag
  differences in the portal.
- **Refunds:** Billing role in the portal → gateway refund → `RefundedAmountMinor`; never reverses business data.
- **Portal:** gateway status (configured, mode, last webhook; no secrets), exceptions list, refund button, payment links.
- **Tests:** invalid signature (rejected, no change), duplicate event (applied once), out-of-order events, amount
  mismatch, payment after void, delayed webhook (re-fetch path), refund partial/full, and a live test in gateway test
  mode extending `e2e/live/saas-flow.spec.ts` (pay the invoice through the test checkout instead of recording it).
- **Done when:** a trial company pays its first invoice through the test checkout and becomes Active without any admin
  action; all suites green; the owner has seen it work.

### Step C: Phase 2.6 Self sign-up and email (estimate 5–7 days)

**Decisions needed:** sending address and SMTP provider; where the sign-up page lives (part of the website, or a small
app like the portal); whether sign-up may start a trial without talking to Trovo.

- `IEmailSender` (SMTP; local testing with smtp4dev), templates for: email verification code, welcome (company code +
  registration code, 48 h), trial ending (3 days), invoice issued (with pay link from 2.5), payment received, payment
  failed / grace / read-only.
- Public sign-up: business name, owner name, phone, email → 6-digit email code (hashed, 10 min, 5 attempts, rate
  limited) → company provisioned automatically on the trial (same provisioner as the portal) → welcome email.
- Abuse limits: per-IP and per-email limits, one trial per email/phone, CAPTCHA only if abuse appears (ask the owner).
- Portal: sign-ups list (source, verified, provisioned), resend welcome email.
- Tests for each step plus a live E2E: sign up → read the email from smtp4dev → register in the API → trial active.

### Step D: Phase 2.7 Validation, hosting and rollout (estimate 4–6 days + hosting)

- Extend the live E2E to the whole lifecycle with time travel (move dates in the throwaway catalog, run
  `platform run-lifecycle`): trial ends → grace → read-only (writes refused, exports allowed) → pay → active; renewal;
  seat limit; add-on change; cancel at period end → 90-day read-only; franchisor and franchisee paying separately;
  a company token cannot reach another company's data or the platform API.
- Recovery: provisioning that fails halfway, a company database that fails to migrate (portal System page), restore
  from backup.
- **Backups:** nightly `pg_dump` of the catalog and every company database, encrypted, copied off the server; a
  restore drill documented in `docs/DISASTER_RECOVERY.md`.
- **E6 move:** rehearse `platform adopt-database` on a fresh copy of E6's real database; check invoice numbers,
  WhatsApp settings and franchise data are unchanged; then do it for real with the owner present.
- **Hosting (VPS, owner chooses provider):** Ubuntu LTS, PostgreSQL 16, API as a systemd service behind nginx with TLS
  (Let's Encrypt), portal as static files on its own subdomain with `X-Frame-Options: DENY` and the CSP header,
  `Platform:AdminPortalOrigin` set, catalog on a non-superuser login, `pg_hba.conf` restricting each company login to
  its own database, firewall (only 80/443/SSH), fail2ban, offsite backups, uptime monitoring, log rotation.
  See `docs/PRODUCTION_CONFIGURATION.md`.
- Windows and Android builds pointed at the production API; release notes; owner sign-off.

### Later (not scheduled)

- Branches inside one company (several outlets, per-branch access and numbering): discuss with the first client.
- GST switch-on when Trovo registers (`Platform:Gstin`, rate; new invoices only).
- Deleting a canceled company's data after 90 days on request (with export first).
- More Trovo products on the same catalog (Products table exists).

---

## 7. Definition of done for any step

- Feature works end to end on a throwaway setup, checked in the real UI (not only unit tests).
- All suites in §3.3 green; new behaviour has tests (unit + API + E2E where it touches the portal or apps).
- No secrets in commits; no changes to unrelated areas; migrations read and reversible.
- This file updated (§2 status, §6 checkboxes) and the owner told what changed, what to test, and what is still open.

---

## 8. Where the details are

| Topic | Document |
|---|---|
| Whole SaaS plan, lifecycle, security | `docs/SAAS_PHASE2_PLAN.md` |
| Schema plan reviewed in 2.x | `docs/Trovo_SaaS_Subscription_Schema_Implementation_Plan.md` |
| Admin portal plan | `docs/SAAS_PHASE2_4_ADMIN_PORTAL_PLAN.md` |
| Portal README / live E2E | `apps/platform-admin/README.md`, `apps/platform-admin/e2e/live/README.md` |
| Prices draft | `docs/PRICING_AND_PLANS_DRAFT.md` |
| Production settings | `docs/PRODUCTION_CONFIGURATION.md`, `docs/DISASTER_RECOVERY.md` |
| Original project instructions | `CLAUDE.md` |

---

## 9. Prompt to give a new agent session

> You are continuing the Trovo Car Spa Management SaaS project in the repository at
> `E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new`. First read `docs/SAAS_HANDOFF_AND_NEXT_STEPS.md` completely, then
> `CLAUDE.md` and the documents listed in its §8 for the step you will work on. Follow the rules in §4 exactly: work in
> a git worktree on a feature branch, never touch the real database `E6CarSpaNew`, never commit secrets, never run
> `ef migrations remove --force`, and never merge or push unless I say so.
>
> Take the first unfinished step in §6. If the step lists "Decisions needed from the owner" that are not answered in
> the document, ask me those questions first and wait. Then make a short plan, build it in small commits, add tests,
> run every test suite in §3.3, check it in the real UI on a throwaway setup, update §2 and §6 of the handoff document,
> and give me a summary: what was built, test results, what I should test by hand, and what is still open.
