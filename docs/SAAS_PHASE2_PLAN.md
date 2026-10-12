# SaaS Phase 2 — Subscriptions, payments, sign-up and a separate database per customer

**Version:** v2.1 · 12 Oct 2026 (your answers to the open questions added)

**Status:**
- Phases 2.1, 2.2 and 2.3 are **built and merged** into `main`.
- Phase 2.4 (admin portal) is **built and merged** into `main` (12 Oct).
- Phases 2.5–2.7 are planned. **Current status and step-by-step instructions: `docs/SAAS_HANDOFF_AND_NEXT_STEPS.md`.**

**Base:** `main` `1fbfb7bc` (CI green).

**What changed in v2:** this version merges in the review of `docs/Trovo_SaaS_Subscription_Schema_Implementation_Plan.md` (the ChatGPT schema plan) and Antigravity's summary of it. §2 lists what was taken over, what was changed and why.

---

## 1. Decisions

| Topic | Decision | Source |
|---|---|---|
| Database model | **A separate PostgreSQL database for every company**, each with **its own database login** | User, 12 Oct |
| Where billing lives | **Trovo's catalog database `carspa_platform`**. Never in a company's database. | v2 (adapts the schema plan) |
| Who pays | **Every company pays Trovo independently, including every franchisee.** A franchise link never shares or merges a subscription. | Schema plan, confirmed |
| Trial | 7 days, full Professional | User, 12 Oct |
| Failed renewal | 7 days grace with banner and reminders, then **read-only** (view and export only) until paid | User, 12 Oct |
| Plans | **Versioned**: a price change creates a new plan version, and existing subscribers keep their agreed terms until they renew or change plan | Schema plan |
| Money | Integer **minor units** (paise) plus an explicit currency on every amount. For example ₹1,999.00 = `199900` INR. | Schema plan |
| Seats | **Active users** (Owner included). One person on Windows and Android uses **1 seat**. | Schema plan, and our 8 Oct decision |
| Add-ons | Showroom, WhatsApp automation, Franchise network and extra seat packs are **subscription items**, not flags on the company | Schema plan |
| Payment gateway | **Provider-independent interface.** Razorpay is the first candidate; **the final choice is made later**. | User, 12 Oct, and the schema plan |
| Admin portal | **Separate web app** with its own login and 2-step verification, deployed separately from the customer apps | Schema plan |
| First login | Trovo creates the company, and the customer registers with **company code + one-time registration code** | User, 12 Oct (built in 2.1) |
| More products | The catalog has **Products**, so Trovo's other software can use the same platform later | User, 12 Oct (built in 2.1) |
| Branches (one owner, several outlets) | **Later.** Discuss with the first client. | User, 12 Oct |
| Billing intervals | **Monthly and yearly** for every plan and add-on (yearly = 2 months free, per the price draft) | User, 12 Oct |
| GST on Trovo invoices | **None for now**: Trovo has no GSTIN. Invoices are titled "Invoice" (not "Tax Invoice"), with tax 0. A platform setting (GSTIN + rate) switches GST on later, for new invoices only. Note: GST registration is required once turnover passes the threshold (₹20 lakh/year for services); confirm with your accountant. | User, 12 Oct |
| After cancellation | Read-only for **90 days**, then data deleted on request | User, 12 Oct |
| Gateway choice | Whichever has the **lowest platform fee**, decided before 2.5 | User, 12 Oct |
| Email | Not decided. Until then the **registration code is shown in the admin portal/CLI** and Trovo sends it by WhatsApp or phone. Email is added in 2.6 when an address exists. | User, 12 Oct |
| Admin portal address | Not available yet. It runs locally until hosting; a free cPanel subdomain (e.g. `admin.trovotechsolutions.in`) can be added then. | User, 12 Oct |

---

## 2. Review of the schema plan (ChatGPT) and Antigravity's summary

### Taken over as written
- **Entities:** plans, plan versions and entitlements; billing accounts; subscriptions and subscription items; Trovo SaaS invoices; payment transactions; webhook events; subscription events; platform audit log.
- **Money** in minor units with currency; versioned plans; a dedicated Trovo invoice series (`TROVO/2026-27/0001`), never shared with the `GST/` and `BILL/` invoice numbers.
- **Lifecycle** as explicit states instead of a single `IsActive` flag. Company registration status, subscription status and user status are kept separate.
- **Server-enforced entitlements:** the Windows and Android apps only *show* limits; the server enforces them.
- **Never activate on a browser redirect.** Every payment is verified server-side (signature, then a re-fetch from the gateway). Webhooks are processed idempotently, out-of-order events are safe, and a renewal can never extend a subscription twice.
- **Immutable payment history:** refunds and reversals are new rows, never overwrites.
- **Suspension never deletes business data.**
- **Separate admin portal** with MFA; time-limited, single-use owner invitations (our registration code); an append-only platform audit log.
- **Build the subscription domain and enforcement before the portal UI.**
- **Git and migration safety:** feature branches only, never `ef migrations remove --force`, migrations tested on a copy of the real database, never on production during development.

### Changed, because our architecture differs

| Schema plan says | Our version | Why |
|---|---|---|
| "Extend the existing PostgreSQL database"; "do not create a duplicate tenant database" | Billing tables go in the **catalog database**. Each company keeps **its own business database**. | You chose a separate database per company for the best security (12 Oct). Billing data about all companies must not sit inside any one company's database. |
| `Organization` is the canonical company record; billing tables point at `OrganizationId` | The canonical record is the catalog's **`Companies`** row (built in 2.1). Its `Id` is the same as `Organizations.Id` inside that company's database. Billing tables point at `CompanyId`. | Each company database only knows itself, so cross-company billing must be anchored in the catalog. The id stays identical, so nothing is renumbered. |
| Use RLS and "narrowly privileged access" for billing records | Billing is unreachable from company logins altogether: they can't even connect to the catalog (verified in 2.1). | The separate catalog gives a stronger boundary than row-level rules. |
| `Organization.FranchiseAddOnEnabled` should migrate toward entitlements | The **Franchise network** becomes a subscription item. The flag is kept, read-only and in sync, until all code reads entitlements, then retired. | Avoids two conflicting sources of truth, as the schema plan warns. |
| Plans are global | Plans belong to a **Product** | Several Trovo products (your 12 Oct request) |
| One `Suspended` state for every restriction | **`ReadOnly`** (automatic after grace or an unpaid trial: view and export allowed) is separate from **`Suspended`** (Trovo's manual action: no sign-in) | Matches your 7-day-grace-then-read-only rule, and keeps "unpaid" separate from "blocked". |
| "Phase 1 — stabilize: fix PDF tests and the Android CI wrapper" | **Done.** Commits `fe029d55` and `1fbfb7bc`; CI green on 12 Oct. | — |

### Corrections to Antigravity's summary
- It suggests putting the seat check in `UserService` as `MaxUsers`. The check goes in a shared **entitlement service**, called by `UserService` both when a user is created and when one is reactivated. A single `MaxUsers` number can't express plan seats plus purchased packs.
- It numbers the admin portal 2.5 and drops franchise. Franchise across separate databases is **required before the branch can be merged** (today it only works inside one database), so it moves forward to 2.3 (see §8).
- "Phase 2.1 & 2.2 next": 2.1 is already built (see §8).

---

## 3. Architecture

```
                         ┌──────────────────────────────────────────┐
 Windows / Android ──────┤ API (one server)                          │
 Sign-up / checkout ─────┤  1. company code / token → catalog        │
 Gateway webhooks ───────┤  2. subscription status + entitlements    │
                         │  3. open that company's own DB            │
 Trovo Admin Portal ─────┤ /api/platform/* (platform admins only)    │
 (separate web app)      └──────┬─────────────────────┬──────────────┘
                                │                     │
             ┌──────────────────▼───────┐   ┌─────────▼───────────────────────────┐
             │ carspa_platform (catalog)│   │ carspa_t_0001 (E6)   login t_0001     │
             │ Products, Companies,     │   │ carspa_t_0002        login t_0002     │
             │ RegistrationCodes,       │   │ carspa_t_0003        login t_0003     │
             │ Plans…, Subscriptions…,  │   │ … business data only, one DB + login  │
             │ Invoices, Payments,      │   └──────────────────────────────────────┘
             │ Webhooks, Audit,         │
             │ FranchiseLinks (2.3)     │
             └──────────────────────────┘
```

**Built in 2.1:**
- catalog with Products, Companies and RegistrationCodes
- per-company database and login, created by a provisioner that runs migrations across every company database
- per-request routing to the company's database
- registration with codes
- Windows and Android registration screens

---

## 4. Catalog schema (Phase 2.2 adds everything below "Companies")

Every table has `CreatedAt`; mutable tables also have `UpdatedAt`. Money columns are `bigint` minor units with a `Currency char(3)` next to them.

| Table | Key fields | Constraints / notes |
|---|---|---|
| `Products` *(2.1)* | Key, Name | unique Key |
| `Companies` *(2.1)* | ProductId, Code, Name, Status (AwaitingRegistration / Active / Suspended), DatabaseName, DatabaseUser, DatabasePasswordEncrypted, SchemaVersion, MigrationError | unique (ProductId, Code); unique DatabaseName and DatabaseUser |
| `RegistrationCodes` *(2.1)* | CompanyId, CodeHash, ExpiresAt, UsedAt, RevokedAt, FailedAttempts | single use; hashed |
| `Plans` | ProductId, Code (`starter`, `professional`), Name, IsActive | unique (ProductId, Code) |
| `PlanVersions` | PlanId, Version, Currency, BasePriceMinor, BillingInterval (Month/Year), IncludedSeats, EffectiveFrom, EffectiveTo | unique (PlanId, Version, BillingInterval); **immutable once a subscription uses it** |
| `PlanEntitlements` | PlanVersionId, FeatureKey, ValueType (Bool/Int), Value | unique (PlanVersionId, FeatureKey). Keys come from one central list, for example `showroom.enabled`, `whatsapp_automation.enabled`, `franchise_network.enabled`, `users.max_active`. |
| `AddOns` | ProductId, Code (`showroom`, `whatsapp`, `franchise_network`, `seats_5`), grants FeatureKey/Value | unique (ProductId, Code) |
| `AddOnPrices` | AddOnId, Version, Currency, UnitPriceMinor, BillingInterval, EffectiveFrom/To | versioned like plans |
| `BillingAccounts` | CompanyId, BillingName, BillingEmail, BillingPhone, Gstin?, BillingAddress, StateCode | **one per company in v1** (unique CompanyId), because every company pays for itself |
| `Subscriptions` | CompanyId, BillingAccountId, PlanVersionId, Status, StartedAt, CurrentPeriodStart, CurrentPeriodEnd, TrialEndsAt, GraceEndsAt, CancelAtPeriodEnd, CanceledAt, GatewayProvider?, GatewaySubscriptionId? | **partial unique index: one current subscription per company** (Status not in Canceled/Incomplete-expired); unique (GatewayProvider, GatewaySubscriptionId) |
| `SubscriptionItems` | SubscriptionId, ItemType (AddOn/SeatPack), AddOnPriceId, Quantity, EffectiveFrom, EffectiveTo | history kept; never inherited by franchisees |
| `SubscriptionEvents` | SubscriptionId, EventType, EffectiveAt, ActorType (System/Admin/Gateway/Owner), ActorId, Metadata (jsonb) | append-only |
| `BillingInvoices` | CompanyId, SubscriptionId, InvoiceNumber, Currency, SubtotalMinor, TaxMinor (CGST/SGST or IGST), TotalMinor, AmountDueMinor, Status (Draft/Open/Paid/Void/Uncollectible), PeriodStart/End, IssuedAt, DueAt, PaidAt | unique InvoiceNumber; own series `TROVO/{FY}/{n}`; lines in `BillingInvoiceLines` |
| `PaymentTransactions` | BillingInvoiceId, Provider (Manual/Razorpay/…), ProviderOrderId, ProviderPaymentId, AmountMinor, Currency, Status, PaidAt, RefundedAmountMinor, Reference/Note (manual) | unique (Provider, ProviderPaymentId) and (Provider, ProviderOrderId) when present; refunds are new rows |
| `PaymentWebhookEvents` | Provider, ProviderEventId, PayloadHash, ReceivedAt, ProcessingStatus, ProcessedAt, RetryCount, LastError | unique (Provider, ProviderEventId); no secrets or card data stored |
| `PlatformAdmins` | Email, Name, PasswordHash, TotpSecretEncrypted, Role (Owner/Support/Billing/ReadOnly), IsActive, LastLoginAt | separate from every company's users |
| `PlatformAuditLogs` | AdministratorId, Action, TargetCompanyId, BeforeValues, AfterValues, Reason, CorrelationId, Ip | **append-only**: the catalog's application login gets INSERT/SELECT only (no UPDATE/DELETE) |
| `FranchiseLinks`, `FranchiseLinkScopes` *(2.3)* | moved from company databases | consent, scopes and lifecycle **independent of billing** |

Migrations:
- New catalog migrations only. Company databases are untouched except for the franchise move (2.3).
- E6 is set up as company 0001 on **Professional + Showroom + Franchise network**, with an existing paid period, so nothing changes for E6 on the day of the switch.

---

## 5. Subscription lifecycle and what each state allows

| State | Meaning | Sign-in | Work (create/change) | View & export | Banner |
|---|---|---|---|---|---|
| `Incomplete` | Checkout started, not paid | — (company not yet usable) | — | — | — |
| `Trialing` | 7-day free trial, full Professional | ✅ | ✅ | ✅ | "Trial ends on …" (last 3 days) |
| `Active` | Paid through `CurrentPeriodEnd` | ✅ | ✅ | ✅ | — |
| `PastDue` | Renewal failed; **grace for 7 days** (`GraceEndsAt`) | ✅ | ✅ | ✅ | "Payment failed — pay by …" |
| `ReadOnly` | Grace ended unpaid, or trial ended unpaid | ✅ | ❌ (server refuses with a clear message) | ✅ | "Read-only until payment" |
| `Suspended` | Trovo switched the company off (reason recorded) | ❌ | ❌ | ❌ | — |
| `Canceled` | Ended (at period end or immediately) | per policy: read-only for 90 days, then data export on request | ❌ | ✅ (90 days) | — |

Transitions:
- **Payment confirmed:** Incomplete → Active. Trialing → Active. PastDue or ReadOnly → Active, starting a new paid period.
- **Renewal failed:** Active → PastDue, and `GraceEndsAt` is set to failure + 7 days.
- **A background job (every 15 min) moves:** PastDue → ReadOnly after `GraceEndsAt`, and Trialing → ReadOnly after `TrialEndsAt`.
- **Trovo action:** any state → Suspended (with a reason). Suspended → its previous state on reactivation (with a reason).
- **Cancel:** `CancelAtPeriodEnd` → Canceled at period end, or Canceled immediately.
- Every transition writes a `SubscriptionEvents` row. Admin-triggered transitions also write `PlatformAuditLogs`.

Enforcement:
- One middleware on every company request reads the company's subscription state, cached for 30 s.
- In **ReadOnly** it refuses POST/PUT/PATCH/DELETE, except sign-in, sign-out, payment and export endpoints.
- In **Suspended** it refuses everything, and sign-in returns "This company is suspended. Contact Trovo."
- Windows and Android show the banner from a small `GET /api/subscription/status` call.

---

## 6. Entitlements and seats

- **One `EntitlementService`** resolves, for the current company:
  - whether access is granted (the state table above)
  - which modules are enabled (plan entitlements + active add-on items)
  - the seat limit = `users.max_active` of the plan version + 5 × the quantity of `seats_5` packs
  - whether a grace restriction applies
- **Seats:** active users (`IsActive && !IsDeleted`, Owner counted) are checked when a user is **created** or **reactivated**. At the limit the server refuses: "Your plan allows N users. Add a 5-user pack or deactivate a user." The Owner can never be removed to make room.
- **Modules:** endpoints carry a requirement attribute, for example `[RequiresFeature("showroom.enabled")]`. Windows and Android hide disabled modules using the same keys from `GET /api/subscription/entitlements`.
- **Franchise:** only a company with `franchise_network.enabled` can act as franchisor. A franchisee needs nothing to accept or share. **No inheritance** between linked companies.
- Devices are not licensed in v1. Device tracking can be added later without changing seat rules.

---

## 7. Platform API (`/api/platform/*`) and authorization

- **Authentication:** a separate scheme for platform admins (separate JWT issuer and audience, short-lived tokens, TOTP 2-step verification). A company user's token can never call `/api/platform`, and a platform token can never call company APIs.
- **Roles:**

  | Role | Can do |
  |---|---|
  | Owner | everything |
  | Billing | plans, subscriptions, invoices, payments |
  | Support | companies, registration codes, suspend/reactivate |
  | ReadOnly | view only |

- **Audit:** every mutating call writes `PlatformAuditLogs` with a reason.

| Endpoint | Purpose | Role |
|---|---|---|
| `GET /api/platform/dashboard` | companies, subscriptions by state, MRR, overdue, failed renewals, recent admin actions | any |
| `GET /api/platform/companies` · `GET …/{id}` | search; detail with plan, entitlements, seat usage, billing, franchise links | any |
| `POST /api/platform/companies` | provision a company (database + login + subscription) and issue the registration code | Support+ |
| `POST /api/platform/companies/{id}/registration-code` | issue a new code | Support+ |
| `PUT /api/platform/companies/{id}/status` | suspend or reactivate, with a reason | Support+ |
| `GET/POST /api/platform/plans` · `POST …/plans/{id}/versions` | plans and immutable versions | Billing+ |
| `PUT /api/platform/companies/{id}/subscription` | change plan, seats, add-ons; extend trial | Billing+ |
| `POST /api/platform/companies/{id}/payments/manual` | record a manual payment (bank, UPI) against an invoice | Billing+ |
| `GET /api/platform/companies/{id}/billing` | invoices, payments, reconciliation state | any |
| `GET /api/platform/audit-logs` | search the audit log | Owner |
| `POST /api/platform/migrations/run` · `GET …/status` | migrate company databases; list failures | Owner |
| `POST /api/billing/webhooks/{provider}` | gateway events; signature-verified, **not** a platform-admin endpoint | gateway |
| `POST /api/billing/checkout` | trusted checkout session (server computes price, tax, items) | public / company Owner |

The `platform …` command-line tool from 2.1 stays for server maintenance and emergencies.

---

## 8. Phases

Each phase is built, tested, reviewed, and merged only on your go-ahead.

| Phase | Contents | Status / est. days |
|---|---|---|
| **2.0 Stabilize** | CI green (PDF tests on Linux, Android build files) | ✅ Done (12 Oct) |
| **2.1 Database per company** | <ul><li>catalog with Products, Companies, RegistrationCodes</li><li>per-company database and login (DML-only, no access to other databases or the catalog)</li><li>routing</li><li>multi-database migrations with per-company status</li><li>adopt E6 unchanged (rehearsed on a copy)</li><li>registration with codes: API + Windows + Android</li><li>tests</li></ul> | ✅ **Built**, branch `feature/saas-db-per-company`. Backend 1204, Windows 728, Android 1049 tests pass. |
| **2.2 Subscription domain + enforcement (backend)** | <ul><li>all §4 tables except franchise; seed plans and add-ons from the price draft</li><li>`EntitlementService`; seat check on create and reactivate; module gating on server + Windows + Android</li><li>lifecycle states and the 15-min job</li><li>read-only / suspended middleware; banner endpoint</li><li>`FranchiseAddOnEnabled` → entitlement</li><li>platform-admin authentication (+TOTP), roles, audit log</li><li>`/api/platform` endpoints except checkout and webhooks</li><li>manual invoices and payments (Trovo invoice series)</li><li>E6 set up as company 0001</li></ul> | ✅ **Built** (12 Oct), same branch. Backend 1253, Windows 734, Android 1058 tests pass; checked live (admin TOTP sign-in, invoice + manual payment, suspend, Starter read-only banner and hidden modules). |
| **2.3 Franchise across separate databases** | <ul><li>links and scopes move to the catalog</li><li>the franchisor's dashboard and Excel read the franchisee's database **read-only** through the API, with approved totals only and an audit entry on both sides</li><li>retire the in-database `franchise_financial_totals`</li><li>re-test invite → accept → dashboard with 3 companies</li></ul> | ✅ **Built** (12 Oct), same branch. Backend 1260, Windows 734, Android 1062 tests pass; checked live (invite → accept → dashboard across databases, link only in the catalog). **Merge point reached.** |
| **2.4 Trovo Admin Portal (separate web app)** | <ul><li>`apps/platform-admin` (React + Vite + Tailwind, reusing the design tokens)</li><li>screens: login with 2-step verification, dashboard, companies and detail, plans and versions, subscriptions, billing, audit log, platform settings (gateway status only, no secrets)</li><li>deployed separately (e.g. `admin.trovotechsolutions.in`)</li></ul> | ✅ **Built and merged** (12 Oct). Backend 1268, portal 18 unit + 4 mocked E2E + 8 live E2E tests pass. |
| **2.5 Payment gateway** | <ul><li>`IPaymentGateway` interface + first adapter (Razorpay, if chosen) in test mode</li><li>checkout (one-time and recurring/mandate)</li><li>webhook verification and idempotent processing</li><li>reconciliation against Trovo invoices; daily reconciliation job against gateway settlements</li><li>retries, refunds, reversals, exception list in the portal</li><li>Trovo GST invoice PDF and email</li><li>tests for delayed, duplicate, failed and out-of-order events</li></ul> | 9–12 |
| **2.6 Self sign-up and email** | <ul><li>public sign-up page: business, owner, email + one-time email code</li><li>start the 7-day trial or check out</li><li>company provisioned automatically; welcome email with company code + registration code (48 h)</li><li>trial reminders; renewal and failed-payment emails</li></ul> | 5–7 |
| **2.7 End-to-end validation and rollout** | <ul><li>automated API + Playwright run in gateway test mode: provision → register → work → renew → fail → grace → read-only → pay → active; trial expiry; seat limit; add-on change; refund; cancel; independent franchisor and franchisee subscriptions; isolation and platform-permission tests; recovery from failed provisioning or migration</li><li>backup + restore drill</li><li>E6 rehearsal on a fresh copy of the real database</li><li>CI for backend, Windows, Android and admin portal</li></ul> | 4–6 |
| **Remaining total** | | **41–55** |

Why this order:
- The schema plan says to build the subscription domain before the portal UI.
- Franchise must work across databases before merging.
- The gateway comes after manual billing works end to end, so Trovo can already bill clients by hand from 2.2 on.

---

## 9. Security points
- **Company databases:** random password per company, encrypted in the catalog, never logged. Company logins have DML only, no other databases, and no catalog access (2.1, tested).
- **Production:** the catalog uses its own non-superuser login (not the admin login). A `pg_hba.conf` rule restricts each company login to its own database (set up in the hosting phase).
- **Platform admins:** separate authentication, 2-step verification, roles, short sessions, append-only audit. Cross-company support access is always audited.
- **Gateway:** secrets stay server-side only. Signatures are verified, then the payment is re-checked with the gateway API. Events are deduplicated and out-of-order events are safe. Card and UPI details never touch our servers.
- **Codes:** registration codes are single-use, time-limited and hashed. Sign-up codes are rate-limited.
- **No data loss:** suspension, read-only and cancellation never delete business data.

---

## 10. Open questions

**Answered 12 Oct** (see §1): prices monthly + yearly; no GST for now; 90-day read-only after cancellation; gateway = lowest platform fee; email later; admin address later; separate databases confirmed.

| # | Still open | Needed before |
|---|---|---|
| 1 | Final prices (the draft prices are seeded; they can be changed as data at any time) | going live |
| 2 | Payment gateway: compare platform fees (Razorpay, Cashfree, PayU, PhonePe PG…) | 2.5 |
| 3 | Sending email address + SMTP | 2.6 |
| 4 | Admin portal address (cPanel subdomain) | hosting |
| 5 | Trovo GST registration (when turnover requires it) | when applicable |
| 6 | Branch questions for the first client | later |

## 11. Local testing setup
- **Databases:** local PostgreSQL holds the catalog and several company databases (`carspa_t_9001`…), all throwaway. **`E6CarSpaNew` is never touched.** E6 is rehearsed on a copy.
- **Email:** sent to smtp4dev, a local inbox.
- **Gateway:** test mode only, with webhooks reaching the local machine through a temporary tunnel or by re-fetching the payment.
- **Git:** work only on feature branches. Merge to `main` and push only when you say so. Never `ef migrations remove --force`.
