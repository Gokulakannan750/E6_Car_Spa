# Detailing Software — Independent Subscriptions + Franchisor Reporting

## Architecture Study (audit/design only — no code changes)

- **Prepared:** 4 October 2026
- **Scope:** read-only investigation. Nothing was modified, committed, branched or migrated. Code was read with `git show` / `git grep` against branch refs, without checking anything out.
- **Baseline inspected:** `feature/phase-1-billing-gst-correctness` (`c238fa6f`), which contains Phase 0 (`security/phase-0-critical-remediation` @ `843def68`) plus 13 later commits.
- **Also inspected:** `feature/franchise-multitenant` (`f2918f71`), `main`, and `E6_Car_Spa_Franchise_MultiTenant_Plan.md`.

**Labels used throughout:**

- **[Exists]** — verified in the current code.
- **[Recommend]** — proposal in this report.
- **[Decision]** — needs a choice from you, the client, an accountant or a lawyer.

---

## 1. Executive Summary

**Verdict:** Option B is the right long-term architecture. Each franchise is an independent organization with its own subscription, linked to E6 by a separate franchisor relationship. Your proposed separation of organization, subscription, franchise relationship, membership, role and entitlement is fundamentally sound.

It has four weaknesses that would cause rework later if not fixed now:

1. **The paying party must be separate from the subscribing organization.** Your future scenario says "some franchisees pay independently", which implies others don't. If a subscription is hard-wired to "this organization pays", the case where E6 pays for a franchisee needs a schema change. Fix: `Subscription.OrganizationId` (who receives the service) plus `Subscription.BillingAccountId` (who pays).
2. **The franchise relationship must be a consented, time-bounded data-sharing agreement with explicit scopes, not a parent pointer.** A `ParentOrganizationId` on organizations, which the existing plan document implies, turns "franchisor" into "superuser over the subtree". That is exactly the unrestricted access you want to avoid.
3. **The franchisor should see aggregates by default, never live rows.** Cross-tenant reporting should read from a pre-aggregated per-organization summary, not from the operational tables. This is the single biggest security lever in the design.
4. **GST identity belongs to a branch or tax registration, not the organization.** A multi-branch business in two states has two GSTINs, and invoice series follow the GSTIN.

**Where the codebase stands:** it is single-tenant in every layer. There is no organization, tenant, branch or subscription code on any branch. `feature/franchise-multitenant` is the same commit as `main` (`f2918f71`) and sits 11 commits behind Phase 0; its only franchise artefact is a planning document.

The plan document describes **Option A**: an "E6 Car Spa — Master / Head Office" tenant with franchises underneath and a master bypass scope. It should not be implemented as written.

Several current foundations do help: a single global query filter, a single `SaveChanges` hook, GUID primary keys, per-request permission checks, an audit log, the permanent invoice-number ledger, and immutable finalized invoices.

**Effort:** the conversion is a large but tractable refactor of 37 entities. The foundation phase (organization and branch IDs, tenant context, filters, row-level security, composite unique constraints, E6 data backfill) is the critical one. Everything else layers on top without a database rewrite if that phase is done right.

---

## 2. What the current codebase already supports [Exists]

| Area | Current state | Multi-tenant relevance |
|---|---|---|
| Stack | ASP.NET Core (.NET 10) API, EF Core + PostgreSQL, Electron/React desktop, Flutter Android, one shared API | Good. The single API is the right control point. |
| Primary keys | `BaseEntity.Id = Guid.NewGuid()`, plus `CreatedAt`, `UpdatedAt`, `IsDeleted` | Good for multi-tenancy and offline. Clients don't generate IDs yet. |
| Soft delete | One global `HasQueryFilter(!IsDeleted)` applied to every `BaseEntity` via reflection (`AppDbContext`) | One central place to add an organization filter. |
| Timestamps | `SaveChangesAsync` override stamps `CreatedAt` / `UpdatedAt` | One central place to stamp `OrganizationId`. |
| Authentication | Custom JWT (`JwtTokenService`). Claims are `sub`, name, username, role, `isOwner`. 24 h expiry, no refresh token. | No organization claim. |
| Authorization | `PermissionAuthorizationHandler` reloads the user on every request. **Owner always succeeds.** Others need a `UserPermissions` row. 67 permission codes. | Per-request database check is good. Owner bypass is global and must become organization-scoped. |
| Roles | Owner / Manager / Staff enum on `User`. `Username` is globally unique. | Needs memberships. |
| First-run setup | Anonymous `POST /api/auth/bootstrap` creates the first Owner when no users exist | Unsafe for shared SaaS. Replace with platform provisioning. |
| Singletons | `BusinessProfile`, `SystemPreference`, `WhatsAppConfiguration` each have a unique `SingletonKey` | Must become per organization (or per branch). |
| Global uniques | `Vehicle.RegistrationNumber`, `Invoice.InvoiceNumber`, `InvoiceNumberAllocation.NormalizedNumber`, `InvoiceNumberSeries.SeriesKind`, `JobCard.JobCardNumber`, `Staff.StaffMasterId`, showroom vehicle/work-type `Code`, `StaffDailyAttendanceConfirmation.Date`, `User.Username`, `Permission.Code` | All except the last two **break** with more than one business and must become composite (organization + value). |
| Numbering | Global PostgreSQL sequence `job_card_number_seq` (migration starts it at 11). Invoice series per GST / non-GST, locked rows, permanent ledger. | Ledger design is excellent. Needs organization / branch / GSTIN / financial-year scope. |
| Customers | Phone uniqueness checked in code (`PhoneExistsAsync`), not by the database | Must be per organization. |
| Catalogue | Global `Service` (name, category, price, `TaxPercentage`). Job-card lines snapshot name, price and tax. Invoices freeze `TaxRatePercent` (Phase 1). | Snapshotting is good. The catalogue itself is global. |
| WhatsApp | Singleton config. Read via `FirstOrDefault` in ~7 places. One AES key (`WhatsApp:EncryptionKey`). `WhatsAppBackgroundWorker` processes all pending messages globally every 5 s plus an hourly health probe. No webhook. | Must become per organization. The worker needs organization context from the message row. |
| Showroom | 42 endpoints with `showroom.*` permissions. Desktop routes use `RouteGuard requiredPermission="showroom.view"`. 10 entities. A `Showroom` has its own GSTIN — it is a **B2B client site, not a branch**. | No concept of "module enabled". Owners bypass permissions, so every Owner sees Showroom. |
| Reports | `ReportService` (~2,260 lines) queries whole tables (17 direct table roots, about 150 `Where` clauses) | Automatically scoped once an organization filter exists. Cross-organization reporting must be a separate, explicit path. |
| Public endpoints | `/api/public/invoices/{token}` (SHA-256-hashed token) and `/api/public/business-profile` (singleton) | Must resolve the invoice's organization and its profile. |
| Hard-coded E6 identity | PDF and public-invoice fallbacks: "E6 Car Spa", Erode address, phone, email, `e6-logo.png`; `PublicInvoiceBaseUrl` default `invoice.e6carspa.com`; login screen branding; job-card sequence starting at 11 | Must go for a multi-customer product. |
| Files | Logos in `wwwroot/uploads/logos`; Aadhaar documents on local disk paths | Needs per-organization storage keys. |
| Database role | Phase 0 added least-privilege database and production configuration separation | Good base for row-level security. |
| Clients | Desktop stores the token via Electron `safeStorage`; Android uses `FlutterSecureStorage`; permission-driven UI | No organization or branch awareness. |
| Subscriptions / licensing | None | Greenfield. |

---

## 3. Current franchise / multi-tenant architecture

- **Code:** none. A repository-wide search for tenant, organization, branch, franchise and subscription terms finds nothing on any branch, apart from an unrelated Dart `StreamSubscription` and a "future BranchId" comment on `InvoiceNumberSeries`.
- **`feature/franchise-multitenant`:** the same commit as `main` (`f2918f71`, 2 Oct), an ancestor of Phase 0. It lacks 11 Phase 0 commits (GST calculation fix, payment concurrency, privilege-escalation fix, Aadhaar permission, production configuration) and 13 later ones. **Do not build on it.** Any tenant work should branch from the latest integrated line.
- **The plan document** (`E6_Car_Spa_Franchise_MultiTenant_Plan.md`, ~1,000 lines) is useful and mostly right on mechanics:
  - one shared database and schema with a tenant ID;
  - an `ITenantContext`;
  - an EF filter plus save-time stamping;
  - "never trust a client-supplied tenantId";
  - cross-tenant tests;
  - "do a tenant boundary audit first".

  It is **wrong on topology for your new goal**:
  - it frames "E6 Car Spa Platform" as the owner;
  - it gives a "Master / Head Office" tenant an "AccessScope = Master" that bypasses tenant filtering;
  - "Select authorized franchise context" lets the master open a franchise workspace;
  - Showroom is gated by being the master rather than by an entitlement;
  - there is no subscription, billing account or franchise-relationship lifecycle.

  Reuse its mechanics; replace its topology.

---

## 4. Proposed SaaS architecture [Recommend]

```text
                Trovo Tech — Platform (control plane)
   Plans · Subscriptions · BillingAccounts · Entitlements · Platform admins
                               │ provisions / meters
 ─────────────────────────────────────────────────────────────────────────
                Detailing Software — Tenant plane (shared API + DB)
   Organization (tenant boundary)
     ├─ Branches (outlets; GST registration / invoice series live here)
     ├─ Memberships (User × Org × Role × BranchScope × Permissions)
     ├─ Operational data: customers, vehicles, job cards, invoices, payments,
     │   staff, vendors, showroom (if entitled), WhatsApp config
     └─ OrgMetricsDaily (aggregates, written by the org's own events)
   FranchiseRelationship (Franchisor Org ⇄ Franchisee Org, scopes, dates, status)
     └─ grants read access to the franchisee's OrgMetricsDaily only
   FranchiseNetwork assets (owned by franchisor): service templates, brand kit
```

| Concept | Purpose |
|---|---|
| Organization | Tenant boundary: who owns data |
| Branch | Where operations happen inside an organization |
| BillingAccount | Who pays Trovo |
| Subscription | What an organization is entitled to, and its state |
| Entitlement | Which modules are switched on (derived from subscription, cached on the organization) |
| Membership | Who can act inside which organization |
| FranchiseRelationship | Who may see which aggregated data from whom, and when |

**Deployment:** shared PostgreSQL database and schema, with `OrganizationId` on every tenant-owned row, enforced three ways:

1. API tenant context.
2. EF global filter plus save-time stamping.
3. PostgreSQL row-level security as a backstop.

100 organizations is small for this model. Hide connection resolution behind the tenant context so that a large customer can later get a dedicated database without code changes.

---

## 5. Organization model [Recommend]

```text
Organization: Id, Code (unique, human), DisplayName, LegalName, Status
              (Provisioning/Active/Suspended/Closed), Kind (Independent|Franchisor|Franchisee — informational only),
              DefaultBranchId, BrandingId?, CreatedAt…
```

- **E6 Main is one organization**, not "the platform". Being a franchisor is a **role it plays through relationships**, not a property that grants powers. `Kind` is a UI hint only and is never used for authorization.
- E6 Main both operates outlets and franchises others. Option B handles that naturally. If E6 later wants a non-operating brand entity, that is just another organization.
- **Per organization** (each currently a singleton):
  - business profile (legal or brand name, logo, terms);
  - system preferences;
  - WhatsApp configuration;
  - number-series configuration.
- **Not per organization:** the permission catalogue, plan definitions and platform settings.

---

## 6. Subscription model [Recommend]

```text
BillingAccount: Id, Name, GSTIN?, BillingEmail, PaymentProvider ref…
Plan:           Id, Code, Features[], Limits (branches, users, WhatsApp msgs…)
Subscription:   Id, OrganizationId, BillingAccountId, PlanId, Status, TrialEndsAt,
                CurrentPeriodStart/End, GraceEndsAt, CancelledAt, AddOns[]
OrganizationEntitlement (materialised): OrganizationId, FeatureCode, Enabled, Limit, Source, ValidUntil
```

- **Subscriber ≠ payer.** E6 Main, Franchise A and Franchise B each have their own subscription. Usually each has its own billing account. If E6 later pays for Franchise C, only `BillingAccountId` changes. No data moves and no relationship changes.
- **Entitlements are materialized on the organization.** The API checks `OrganizationEntitlement`, never the payment provider, so a billing-system outage can't lock a car spa out mid-day.
- **Start manual.** Trovo staff set the state in an admin screen; automated billing comes later.
- At most one active subscription per organization (enforced by a partial unique index).

---

## 7. Franchise relationship model [Recommend]

```text
FranchiseRelationship:
  Id, FranchisorOrgId, FranchiseeOrgId, Status (Invited|Active|Suspended|Ended),
  InvitedAt, AcceptedAt, AcceptedByUserId, EffectiveFrom, EffectiveTo,
  Scopes[] (e.g. reports.revenue, reports.invoice_counts, reports.payments,
            reports.jobs, reports.services, reports.drilldown_invoices(optional, off by default)),
  AgreementRef, AuditTrail
Unique: one Active relationship per (FranchisorOrgId, FranchiseeOrgId)
```

**Evaluation of your proposal:** correct, provided four rules hold.

1. **It grants no CRUD at all.** It is a data-sharing grant, not a membership. The franchisor's users never get a membership in the franchisee's organization unless the franchisee invites them explicitly and separately (for example, as an auditor). That keeps "franchisor" and "has access" as two distinct, auditable facts.
2. **The franchisee consents.** The franchisor invites; the franchisee owner accepts and sees exactly which scopes are shared. Scope changes need re-acceptance.
3. **It is time-bounded.** All visibility is filtered by `EffectiveFrom` / `EffectiveTo`, which makes ending a relationship clean (section 16).
4. **It is non-transitive.** Franchise A sees nothing of B or of E6 Main. A franchisee can't be a franchisor of its parent's network unless a separate relationship exists. Decide whether one franchisee may belong to two franchisors at once **[Decision]**; the model allows it.

`FranchiseNetwork` (optional, owned by the franchisor) holds shared assets such as service templates and a brand kit. Franchisees adopt them; adopting creates their own rows (sections 9–10).

---

## 8. Branch model [Recommend]

- **Branch** sits inside an organization: name, address, `TaxRegistrationId`, active flag. Every organization gets a default branch, so single-outlet customers never notice branches.
- **TaxRegistration** (GSTIN, state, legal name) is attached to branches. Invoice number series become unique per (organization, tax registration or branch, series kind, financial year) **[Decision with accountant: per GSTIN or per branch, and whether to reset per financial year]**. The Phase 0/1 ledger extends naturally by adding `OrganizationId`, `BranchId` and `FinancialYear` to the series and allocation keys. Today `NormalizedNumber` is globally unique.
- **Operational rows** (job cards, invoices, payments, attendance, outside jobs, WhatsApp messages) carry `BranchId`. Master data (customers, vehicles, services, staff, vendors) carries `OrganizationId` only, with optional branch availability.
- Memberships can be limited to branches (`BranchScope`: all or a list).
- **Do not model franchisees as branches of E6.** That is Option A in disguise and collapses the isolation, billing and exit story.
- **Showroom ≠ Branch.** A `Showroom` is a client dealership site where your staff work under B2B billing. Keep it as Showroom-module data owned by the organization, optionally linked to the serving branch.

---

## 9. Customer and vehicle model

| | Model A: isolated per organization | Model B: shared across the network |
|---|---|---|
| Safety | Strong. One owner per record. | Weaker. Needs a visibility rule on every read. |
| Privacy law | Each business controls its own customers | Shares personal data between separately owned businesses. Under India's DPDP Act this likely needs a lawful basis or consent and a stated purpose **[Decision: legal review]** |
| Ownership at exit | Trivial | Hard. Whose customer is it after the franchise leaves? |
| Scalability | Simple indexes | Cross-org joins and network uniqueness |
| Benefit | — | Network-wide service history ("this car was coated at Franchise A") |

**Recommendation: start with Model A, built so that Model B can be added later as links rather than as a rewrite.**

- `Customer` and `Vehicle` carry `OrganizationId`. Uniqueness becomes per organization: phone per organization in the database, not just in code, and `(OrganizationId, RegistrationNumber)`. Today registration is globally unique, which would wrongly stop two independent shops from serving the same car.
- Add a normalized `RegistrationKey` column now (uppercase, no spaces) and a normalized phone key. These are the natural join keys for later matching.
- **Model B later** = add tables, don't change ownership:
  - `NetworkCustomerLink` / `NetworkVehicleLink` (FranchiseNetworkId, local record, link status, consent record);
  - a read-only "network history" API that returns only summary fields (date, service names, branch name), gated by a relationship scope and customer consent.

  Each organization keeps owning its own copy, so exit stays trivial. A shared master record (true Model B) can be built from these links if ever needed, without touching invoices or job cards, because those already reference local IDs.

---

## 10. Service catalogue model

**Today [Exists]:** one global `Service` table. Job-card lines snapshot name, price and tax, and invoices now freeze `TaxRatePercent` (Phase 1). History is therefore already safe from catalogue changes. That property is what makes any of the options below safe.

| Option | Pros | Cons |
|---|---|---|
| A. E6's common catalogue only | Brand consistency | Franchisees can't price locally; every edit affects all of them; offline sync is harder |
| B. Each organization fully independent | Simple, isolated | No network-wide reporting by service; brand drift |
| C. Master template with local overrides | Consistency plus local control | Most complex if done as live inheritance |

**Recommendation: option C, implemented as "adopt a template, own the copy".**

```text
ServiceTemplate (owned by franchisor's network): Id, NetworkId, Code, Name, Category, SuggestedPrice, TaxRate, SAC?, Version
Service (owned by each org): Id, OrganizationId, TemplateId?, TemplateVersion?, Name, Price, TaxRate, IsActive, BranchAvailability…
```

- A franchisee "adopts" a template and gets its **own** `Service` row with its own price and tax. Fields can be marked locked by the franchisor (name, SAC) or free (price). Franchise-only services simply have `TemplateId = null`.
- Template updates are offered as "update available" to adopters; nothing changes live.
- Network reports group by `TemplateId`, which gives "ceramic coating revenue across the network".
- **Why not live overrides** (one master row plus an override row read at runtime): this couples every franchisee's job card to the franchisor's data. It needs cross-tenant reads on the hot path and complicates offline sync and exit. The copy-with-link approach has none of that, and a franchisee leaving simply keeps its copies **[Decision: whether adopted services may be kept after exit]**.

---

## 11. WhatsApp model

**Today [Exists]:**

- one `WhatsAppConfiguration` singleton (phone number ID, WABA ID, encrypted token, template names and languages, health status);
- one AES key for all secrets;
- `WhatsAppMessage` linked to an invoice and customer;
- one worker processing all pending messages;
- hourly health probe of the one configuration;
- no inbound webhook;
- public invoice URL base from global configuration.

**Can it be made per organization?** Yes, and the entity shape is already right. Changes needed:

1. `WhatsAppConfiguration` gets `OrganizationId` and an optional `BranchId`; unique on (organization, branch). Resolution order: branch configuration, then organization configuration, then "not configured". The ~7 `FirstOrDefault` reads become a resolver keyed by the invoice's organization and branch.
2. **Secrets: envelope encryption.**
   - Each configuration's token is encrypted with a per-organization data key.
   - Data keys are wrapped by a master key held outside the database (cloud KMS or similar).
   - Store a key ID and version for rotation.
   - Re-encrypt the existing token during migration.

   Never return tokens to clients; the current API already doesn't.
3. `WhatsAppMessage` gets `OrganizationId` and `BranchId`. The worker loads the configuration **from the message's organization**, rate-limits per organization (so one tenant's backlog can't starve others), and logs per organization. The health probe iterates configurations.
4. Templates are per WABA. Template names and languages stay on the configuration; template parameter mapping stays global code.
5. **A future webhook** (delivery and read receipts) routes by `phone_number_id` to the owning configuration. Make `PhoneNumberId` unique across the platform.
6. Public invoice links resolve the invoice, then its organization, then that organization's profile and branding, with a per-organization or platform base URL. Remove the E6 hard-coded fallbacks.
7. **[Decision]** Each tenant brings its own Meta Business account and token, or Trovo onboards tenants via Meta Embedded Signup as a tech provider. The latter is a business and compliance decision with Meta; the data model above supports both.

---

## 12. Showroom feature entitlement model

**Today:** gated only by permissions. Owners bypass permissions, so module availability can't be expressed at all.

**Recommendation:** entitlements are a separate, mandatory layer that **even Owners and platform admins acting as tenant users cannot bypass**.

- Feature codes: `billing`, `job_cards`, `whatsapp`, `reports.advanced`, `showroom_b2b`, `outside_jobs`, `staff_payroll`, `franchise_network`, `multi_branch`, and later `offline_sync`.
- API: a `[RequireFeature("showroom_b2b")]` filter on the 42 showroom endpoints, run **before** permission checks. Background jobs and report queries check it too.
- Clients: `/api/me` returns `features[]`; routes and menus hide accordingly. This is UX only — enforcement is server-side.
- **When a feature is turned off:** data is retained, endpoints return 403 or are read-only **[Decision: read-only window]**, and reports exclude or label the module.
- E6 Main has `showroom_b2b` through its plan or an add-on. Franchises don't by default.

---

## 13. Permission and authorization model

**Today:** a global user with a role and permissions. Owner gets everything. Permissions are checked against the database on every request (good: immediate revocation).

**Recommended layers, evaluated in order on every request:**

1. **Authentication:** JWT with `sub`, `org` (active organization), `mem` (membership ID) and `sid` (session). The organization is chosen at login or by an explicit switch call that issues a new token. **Never accept an organization ID from a header, query string or body.**
2. **Membership check:** the membership exists, is active, belongs to `org`, and the user is active. Reload per request (cache for seconds), as today's handler already does for users.
3. **Organization state:** the organization and subscription allow this class of operation (read / write / financial write; see section 15).
4. **Entitlement:** the feature is enabled.
5. **Permission:** the role or membership has the permission code. **Owner bypass applies only within its own organization** and never crosses into steps 1–4.
6. **Data scope:**
   - EF global filter `OrganizationId == ctx.OrganizationId` (plus `BranchId ∈ ctx.BranchScope` where relevant);
   - save-time stamping of `OrganizationId` (and rejecting changes to it);
   - every foreign key validated as same-organization, so an organization can't attach another organization's vehicle ID to its job card.
7. **Database backstop:**
   - PostgreSQL row-level security policies `organization_id = current_setting('app.org_id')::uuid`;
   - the setting is applied per transaction (`SET LOCAL`) by an EF connection/command interceptor;
   - the app's database role has no `BYPASSRLS`.

   This catches any forgotten filter, raw SQL (there are 7 raw-SQL sites today, mostly `FOR UPDATE` locks plus the job-card sequence) or `IgnoreQueryFilters` call (12 today, which must be audited because they currently bypass only soft delete).

**Additional rules:**

- **Platform admins (Trovo):** a separate realm and claim. They can manage organizations, subscriptions and entitlements but **cannot read tenant business data** by default. "Break-glass" support access is time-boxed, requires a reason, is recorded in a platform audit log and is visible to the tenant **[Decision]**.
- **Franchisor access:** never through tenant endpoints. It uses a separate `/api/network/*` read-only surface that queries only the aggregate store (section 14), filtered by active relationship, scope and effective dates. Requires the permission `network.reports.view` within the franchisor's own organization.
- **Preventing escalation:**
  - membership and permission edits require `users.edit` within the same organization (Phase 0 already prevents managers granting what they lack — keep that);
  - an Owner can't be created by non-Owners;
  - organization and branch IDs can't be changed through any DTO;
  - tests with known foreign GUIDs must return 404, not 403, so existence isn't leaked.
- **Remove anonymous bootstrap** in SaaS mode. Provisioning creates the organization, default branch and first Owner membership.

---

## 14. Cross-franchise reporting model

| Approach | Fit for this product |
|---|---|
| Live cross-tenant queries on operational tables | ✗ Must bypass tenant isolation on hot tables; the riskiest option |
| Database views over operational tables | ✗ Same isolation problem, just hidden |
| **Aggregated reporting table** | ✓ Recommended |
| Reporting API | ✓ The access layer on top of the aggregate table |
| Cache | Optional on top |

**Recommended: an `OrgMetricsDaily` store plus a network API.**

```text
OrgMetricsDaily: OrganizationId, BranchId, Date (business-local), Currency,
  InvoicesIssued, InvoicesCancelled, GrossSales, Discounts, TaxableValue, Tax,
  NetRevenue, PaymentsByMethod (cash/upi/card/bank), Outstanding,
  JobCardsOpened, JobCardsInvoiced, ServicesByTemplate (jsonb or child table),
  NewCustomers, RepeatCustomers, UpdatedAt
```

- **Writes:** each organization's own events (invoice finalized or cancelled, payment recorded) update its own rows inside the same transaction or via an outbox. A nightly job recomputes the last N days for self-healing. Written under the organization's own tenant context — nothing cross-tenant.
- **Reads:** franchisor dashboard returns rows where organization ∈ active relationships, date is within each relationship's effective window, and only columns whose scope was granted. Totals are calculated over the permitted rows.
- **The franchisee sees the same numbers** on its own dashboard, which builds trust.
- **Scale:** 100 organizations × 365 days × a few branches is about 100–200k rows a year — trivial.
- **Why this is right for this size:** isolation is preserved by construction. The franchisor's code path can't touch an invoice row. It is fast, offline-friendly (summaries are recalculated server-side after sync) and survives relationship changes. Row-level drill-down, if ever granted, is a separate scope with its own audited endpoint.

**Example: E6 Network Dashboard**

| Organization | Revenue | Invoices | Collected |
|---|---|---|---|
| E6 Main | ₹45,000 | 31 | ₹41,200 |
| Franchise A | ₹32,000 | 22 | ₹30,500 |
| Franchise B | ₹28,500 | 19 | ₹26,000 |
| **Network** | **₹105,500** | **72** | **₹97,700** |

Each row shows only granted scopes. Franchises whose relationship ended show history up to their end date only.

**[Decision]** Whether "Network total" includes E6 Main's own figures, or whether those appear only on E6's normal dashboard.

---

## 15. Subscription lifecycle

Proposed states: **Trial → Active → PastDue (grace) → Suspended → Cancelled → (Purged)**. "Expired" is simply the end of a Trial without conversion, so treat it as Suspended.

| | Trial / Active | PastDue (grace, e.g. 7–14 days) | Suspended | Cancelled (retention, e.g. 90 days) |
|---|---|---|---|---|
| Login | ✓ | ✓ with banner | ✓ (read-only) | Owner only, export only |
| New job cards / invoices | ✓ | ✓ | ✗ | ✗ |
| Record payments on existing invoices | ✓ | ✓ | ✓ **[Decision]** — recommend yes, so the shop's customers aren't harmed | ✗ |
| View and print existing invoices, public links | ✓ | ✓ | ✓ | Public links revoked at purge |
| Reports and data export | ✓ | ✓ | ✓ | Export only |
| WhatsApp sending | ✓ | ✓ | ✗ (queue paused) | ✗ |
| Showroom and other add-ons | if entitled | if entitled | read-only | ✗ |
| Franchise relationship | unaffected | unaffected | **unaffected** (the relationship is not billing) | Suspended automatically |
| Franchisor sees reports | ✓ | ✓ | Historical up to suspension (no new data is produced anyway) | Historical within effective window **[Decision]** |
| Data | kept | kept | kept | kept until purge, then deleted per contract |

Rules:

- State is enforced in API middleware (step 3 of section 13). Clients only display it.
- Make data export always available. It reduces lock-in disputes and is good practice.

**If Franchise A stops paying:** A goes Suspended (read-only). Its data stays. E6 keeps seeing A's historical aggregates within the relationship window. A loses operational write access. Payment restores everything instantly, with no data movement.

---

## 16. Franchise relationship lifecycle

**Invited → Active → (Suspended) → Ended.** Ending sets `EffectiveTo`. Nothing is deleted or moved.

| After ending | Recommendation |
|---|---|
| Franchise A's subscription and data | Untouched. A becomes an independent customer. |
| E6's view of A | History for the relationship period only, or nothing **[Decision: contractual]**. Either is a simple filter on `EffectiveTo`. |
| Adopted service templates | A keeps its copies (they're its own rows); the template link is cleared or frozen **[Decision]** |
| Branding | A's business profile is A's; if E6 brand assets must be removed, that's a manual step plus a checklist **[Decision]** |
| Network customer links (if Model B is ever used) | Links deactivated; each side keeps its own local records |
| Re-joining | A new relationship row with new dates; history is preserved |

Because the relationship never owned data or the subscription, exit is a one-row change. That is the main reason Option B beats Option A.

---

## 17. Offline-first compatibility

Option B fits offline sync well: every record has a single owning organization and branch, so a device syncs one partition.

**Metadata needed [Recommend; design columns now, build sync later]:**

| Field | Where | Why |
|---|---|---|
| `Id` (client-generated GUID or UUIDv7) | All synced rows | Create offline without collisions. GUIDs already exist; generation moves to the client. |
| `OrganizationId`, `BranchId` | All tenant rows | Partition key. **The server re-validates; it never trusts the device.** |
| `DeviceId` | Registered `Device` table (org, branch, user, revoked flag) | Bind sync to approved devices; revoke lost tablets |
| `ClientMutationId` (idempotency key) | Every write | Safe retries |
| `CreatedByUserId` / `UpdatedByUserId`, `OriginDeviceId` | Most rows | Audit and conflict context |
| `ServerVersion` (monotonic sequence per organization) | All rows | Incremental pull ("changes since version X") |
| `UpdatedAt` (server-assigned) | All rows | Display only; don't use device clocks for ordering |
| `IsDeleted` / `DeletedAt` tombstones | All rows | Already soft-deleted, which is good |
| `SyncStatus` | **Client-side only** | Pending / synced / conflict |

**Per-entity strategy:**

| Entity | Offline behaviour |
|---|---|
| Organization, subscription, entitlements | Pulled as a **signed entitlement token** with an offline grace period (e.g. 72 h – 7 days). Beyond it the app goes read-only. Never editable offline. |
| Franchise relationship and network reports | Server-only; network dashboards need connectivity |
| Branch, users, permissions | Pulled; changes online only |
| Customer, vehicle | Editable offline. Field-level last-writer-wins by server order, plus conflict log. Duplicate detection on sync using normalized phone and registration keys. |
| Job card | Editable offline while Draft |
| Invoice | **The hard part.** GST invoices need a final number at issue. Options: (a) per-device sub-series (e.g. `GST/ERD-T2/0001`), or (b) pre-allocated number blocks leased to the device. Both fit the existing ledger. "Provisional number, finalized on sync" is likely **not acceptable** if the bill is handed over offline **[Decision with accountant]**. Finalized invoices are immutable, which makes them append-only and easy to sync. |
| Payment | Append-only; server re-validates the balance and flags over-payment conflicts |
| WhatsApp | Queued locally as an intent; **sent only by the server after sync**. Tokens never reach devices. |
| Reporting | Local reports from the local database; official reports and aggregates from the server after sync |

Design decisions that keep offline possible later: client-generated IDs, `OrganizationId` and `BranchId` on every row, immutable finalized documents, a server version column, and branch- or device-aware numbering.

---

## 18. Database changes required [Recommend — design only]

**New control-plane tables:**

- `Organizations`, `Branches`, `TaxRegistrations`
- `BillingAccounts`, `Plans`, `PlanFeatures`, `Subscriptions`, `SubscriptionAddOns`, `OrganizationEntitlements`
- `Memberships`, `MembershipPermissions` (replacing `UserPermissions`), `MembershipBranches`
- `FranchiseRelationships`, `FranchiseRelationshipScopes`
- `FranchiseNetworks`, `ServiceTemplates`
- `Devices` (later)
- `PlatformAuditLog`, `OrgMetricsDaily`

**Changes to existing tables:**

- `OrganizationId` (NOT NULL after backfill) on every tenant-owned table, about 33 of the 37 entities. Only `Permission` and plan/platform tables stay global. `User` becomes a global identity; membership carries the organization.
- `BranchId` on job cards, invoices, payments, invoice series and allocations, attendance, outside jobs, WhatsApp messages and configuration, and showroom operational rows.
- **Composite uniques** replace the global ones listed in section 2, e.g. `(OrganizationId, RegistrationKey)`, `(OrganizationId, InvoiceNumber)`, `(OrganizationId, JobCardNumber)`, showroom codes per organization, attendance confirmation per (organization, branch, date).
- The **global `job_card_number_seq`** is replaced by a per-(organization, branch) counter table using the same lock-and-ledger pattern as invoice series.
- Singletons become `UNIQUE(OrganizationId)` (or `(OrganizationId, BranchId)` for WhatsApp).
- Indexes lead with `OrganizationId` on all large tables.
- **Row-level security** policies on tenant tables; database role without `BYPASSRLS`; a separate role for platform jobs.
- Normalized keys: `Customer.PhoneKey`, `Vehicle.RegistrationKey`. `Service.TemplateId`.
- Later (sync): `ServerVersion`, `ClientMutationId`, `OriginDeviceId`.

**Data migration:** create the E6 Main organization, default branch and tax registration; backfill every row; map existing users to memberships (current Owner → Owner of E6 Main); move singletons, series, ledger and the job-card counter to E6 Main; re-encrypt the WhatsApp token.

---

## 19. API changes required

- `ITenantContext` (organization, membership, branch scope, flags), populated by middleware from verified claims. Background jobs set it **from the row** they process.
- **Authentication:**
  - login returns the user's memberships;
  - `POST /auth/select-organization` issues an organization-scoped token;
  - add refresh tokens;
  - remove anonymous bootstrap (SaaS mode).
- `/api/me`: organization, branch scope, permissions, features, subscription state, offline token (later).
- **Middleware order:** organization state → `[RequireFeature]` → `[RequirePermission]` (Owner bypass limited to its own organization).
- **EF:**
  - organization filter alongside the soft-delete filter;
  - save stamping and immutability of `OrganizationId`;
  - same-organization foreign key validation helper;
  - row-level security session interceptor;
  - audit of all 12 `IgnoreQueryFilters` and 7 raw-SQL sites.
- **Per-organization resolution:** business profile, preferences, number series, WhatsApp configuration and worker, public invoice/profile endpoints, PDF branding. Remove E6 hard-coded fallbacks.
- **New surfaces:**
  - `/api/platform/*` (Trovo admins: organizations, plans, subscriptions, entitlements);
  - `/api/network/*` (franchisor: relationships, invitations, aggregate reports);
  - `/api/franchise/*` (franchisee: accept/decline, scope view).
- `ReportService`: unchanged queries become tenant-scoped automatically. Add the `OrgMetricsDaily` writer and network report endpoints.
- **Tests:** cross-tenant read, update, delete and ID-guessing suites; filter-bypass detection; row-level security tests on real PostgreSQL (the existing PostgreSQL test fixture is a good base).

---

## 20. Desktop changes required

- Login flow with organization (and branch) picker when the user has several memberships; switching re-issues the token. Store only the token in `safeStorage` (already done).
- **Branding from the organization profile:** remove "E6 CAR SPA" login branding and fallbacks; product name "Detailing Software"; optional white-label logo on login after organization resolution.
- Routes and menus driven by `features[]` plus permissions. The existing `RouteGuard requiredPermission` becomes permission + feature.
- Subscription-state banner and read-only mode.
- New screens: Network Dashboard (franchisor), relationship invitations (both sides), organization settings (branches, tax registrations), WhatsApp per organization or branch.
- Number-series settings per branch / GSTIN / financial year.
- API base URL stays configurable; one shared SaaS endpoint by default.

---

## 21. Android changes required

Mirrors the desktop:

- organization selection at login;
- feature-driven navigation (`app_router.dart` showroom routes behind a feature check);
- subscription banner and read-only handling;
- Network Dashboard (read-only, franchisor);
- remove E6 hard-coding and make branding dynamic.

No tenant logic in Flutter beyond display. Later, the offline database (Drift / SQLite) with the metadata from section 17.

---

## 22. Security risks

| Risk | Current exposure | Mitigation |
|---|---|---|
| Missing organization filter on one query | High during migration (12 `IgnoreQueryFilters`, 7 raw-SQL sites, background worker) | EF filter + row-level security + cross-tenant test suite + code review rule |
| Owner bypass becomes cross-tenant superuser | Exists globally today | Scope bypass to the membership's organization; entitlements and state never bypassed |
| Organization ID spoofed from client | N/A today | Only from verified token; DTOs never carry it; immutable on save |
| Cross-organization foreign key injection (attach another org's vehicle ID) | N/A today | Same-organization foreign key validation; row-level security also blocks reads of foreign rows |
| Franchisor over-reach | — | Aggregate-only store, scopes, consent, effective dates, audit |
| Platform admin data access | — | No tenant reads by default; audited break-glass |
| One global WhatsApp encryption key | Exists | Per-organization envelope encryption; key versioning |
| Anonymous bootstrap creates an Owner | Exists | Disabled in SaaS; provisioning only |
| Public invoice shows wrong business (singleton profile / E6 fallbacks) | Exists | Resolve organization from invoice; remove fallbacks |
| Global unique constraints leak existence ("registration already exists" across tenants) | Exists | Per-organization uniques |
| Background worker without tenant context | Exists | Context from row; per-organization limits |
| Lockout state in memory | Exists | Persist / distribute per user (needed with several API instances) |
| Noisy neighbour (one tenant's reports or WhatsApp backlog) | — | Per-organization rate limits; aggregate table for heavy reports |

---

## 23. Migration risks

- **Backfill correctness:** every existing row must land in E6 Main. A missed table becomes invisible, or worse, visible to the wrong tenant if defaults are wrong. Mitigation: NOT NULL with no default after backfill, and row counts verified per table.
- **Behaviour changes:**
  - Owner semantics change;
  - showroom becomes entitlement-gated (E6 Main must receive it, or it disappears);
  - invoice numbering keys change. Existing numbers must stay valid and reserved; the ledger must be migrated, not regenerated.
- **Job-card numbering:** moving from the global sequence to a per-organization counter must start after E6's current maximum.
- **WhatsApp:** token re-encryption; a configuration mistake silently stops invoice messages, so a health check must run after migration.
- **Clients:** old desktop and Android builds without organization awareness. Mitigation: E6 Main as the implicit default organization for single-membership users during a transition window, then force the upgrade.
- **Phase 0/1 regressions:** the large surface needs the existing ~845 backend, 550 desktop and 869 Android tests plus new isolation tests passing at each step.
- **Branch drift:** the stale `feature/franchise-multitenant` branch must not be used; start from the latest integrated branch.

---

## 24. What can be changed later without major rewrite

These are cheap later **if** organization and branch IDs, memberships, entitlements, template links and the aggregate store exist from the first tenant phase:

- moving from Model A to Model B for customers and vehicles (add link tables);
- catalogue option B to C (templates are optional links);
- who pays for whom (`BillingAccountId`);
- adding or removing paid modules (entitlement rows);
- per-branch vs per-organization WhatsApp (nullable `BranchId` resolution);
- extra report scopes or metrics (columns in the aggregate table, recomputable);
- dedicated database for a large customer (connection resolver behind tenant context);
- automated payment provider (Subscription already abstract);
- offline sync (metadata pre-planned).

**Hard to change later** — get these right first:

- the tenant boundary unit (Organization);
- `OrganizationId` everywhere;
- membership-based identity;
- relationship-not-hierarchy for franchising;
- the GST / numbering scope (organization vs branch vs GSTIN vs financial year).

---

## 25. Decisions to finalize before implementation

1. Invoice and job-card numbering scope: per organization, branch or GSTIN? Reset per financial year? (Accountant.)
2. Customer and vehicle sharing: start with Model A? Is consent-based network history wanted at all? (Legal: DPDP.)
3. Catalogue: confirm "adopt template, own copy"; which fields the franchisor may lock.
4. Franchisor scopes: default set; is invoice-level drill-down ever allowed?
5. Does the franchisor keep historical reports after a relationship ends? For how long?
6. Can one franchisee belong to two franchisors?
7. Subscription policy: grace length; is recording payments allowed when suspended; retention period before purge; export format.
8. Platform admin data-access policy (break-glass rules).
9. WhatsApp onboarding: tenant's own Meta account vs Trovo Embedded Signup.
10. Plans and feature list, including whether Showroom/B2B is an add-on or a plan tier.
11. Branding: white-label per organization vs "Detailing Software" with organization logo.
12. Is E6 Main itself an operating organization and a franchisor (recommended), or is a separate brand organization needed?
13. Offline numbering approach (device sub-series vs number blocks), if offline is in scope within 12 months.

---

## 26. Recommended implementation phases

| # | Phase | Scope |
|---|---|---|
| 0 | Tenant boundary audit (as the existing plan says) | Classify all 37 entities: owner, branch-scoped?, unique keys, raw SQL / filter bypasses, endpoints, reports, files |
| 1 | **Tenant foundation** | Organization, Branch, TaxRegistration; `OrganizationId` / `BranchId` on all tenant tables; backfill E6 Main; composite uniques; tenant context; EF filter + stamping + same-organization foreign key checks; row-level security; cross-tenant test suite; remove E6 hard-coding |
| 2 | Identity and memberships | Memberships, organization-scoped tokens, Owner bypass scoped, organization picker (desktop + Android), refresh tokens, disable bootstrap, platform admin realm |
| 3 | Per-organization configuration | Business profile, preferences, number series + ledger + job-card counter per scope, WhatsApp per organization/branch with envelope encryption and worker context, public links per organization |
| 4 | Subscriptions and entitlements (manual billing) | Plans, subscriptions, billing accounts, entitlements, state middleware, `RequireFeature`, Showroom as add-on, Trovo admin screens |
| 5 | Franchise network | Relationships with invitation and consent, scopes, `OrgMetricsDaily` writer + backfill, network API, franchisor dashboards (desktop + Android) |
| 6 | Catalogue templates | Templates, adoption, update offers, network service reports |
| 7 | Multi-branch operations | Branch-scoped memberships, branch numbering UI, branch reports |
| 8 | Automated subscription billing | Payment provider, invoices to tenants, dunning → PastDue/Suspended automation |
| 9 | Customer/vehicle network links (only if decided) | Link tables, consent, network history API |
| 10 | Offline-first | Device registry, sync metadata, sync engine, offline entitlement token, offline numbering |

---

## 27. Estimated complexity of each phase

Relative estimates for one experienced developer working with the current codebase and test suites. They assume the decisions in section 25 are made first. Treat them as planning ranges, not quotes.

| Phase | Complexity | Rough effort | Main risk |
|---|---|---|---|
| 0 Audit | Low | 3–5 days | Thoroughness |
| 1 Tenant foundation | **Very high** | 4–7 weeks | Missed filter; backfill; constraint changes |
| 2 Identity / memberships | High | 2–3 weeks | Owner semantics; client login flows |
| 3 Per-organization configuration | High | 2–4 weeks | Numbering / ledger migration; WhatsApp keys |
| 4 Subscriptions / entitlements | Medium | 2–3 weeks | Policy correctness; Showroom gating |
| 5 Franchise network | Medium–high | 3–4 weeks | Aggregate accuracy; scope enforcement |
| 6 Catalogue templates | Medium | 1.5–2.5 weeks | Update semantics |
| 7 Multi-branch | Medium | 2–3 weeks | Branch scoping in reports and numbering |
| 8 Automated billing | Medium | 2–3 weeks | Payment provider edge cases |
| 9 Network customer links | High | 3–4 weeks | Privacy / consent; matching quality |
| 10 Offline-first | **Very high** | 8–14 weeks | Conflicts, numbering, sync security |

---

## Appendix — Option A vs Option B

| Criterion | **A: E6 owns franchise subscriptions and branches** | **B: independent subscriptions + franchisor relationship** |
|---|---|---|
| Matches "Trovo sells to anyone" | ✗ E6 sits at the top of a hierarchy | ✓ every customer is a peer |
| Franchise pays Trovo directly | Awkward (billing tied to E6's tree) | ✓ native; plus `BillingAccountId` lets E6 pay where it wants |
| Data isolation between franchisees | Weaker: franchises are branches or children of E6; the master scope bypasses filters | ✓ hard boundary per organization; franchisor reads aggregates only |
| Franchise leaves E6 | Data and users must be extracted from E6's tenant; subscription re-created | ✓ end one relationship row; nothing moves |
| Showroom only for E6 | Encoded as "master" privileges | ✓ an entitlement any organization can buy |
| Independent customers (no franchisor) | Special case | ✓ the default case |
| 100 businesses, 20 networks, mixed payers, multi-branch | Hierarchies of hierarchies; mixing billing and access | ✓ organizations × relationships × billing accounts × branches compose cleanly |
| Implementation cost | Slightly lower at first | Slightly higher at first (relationship + aggregates) |
| Long-term risk | High: rework when the first franchise leaves or pays separately | Low |

**Recommendation: Option B**, with the four refinements from the executive summary:

- subscriber ≠ payer;
- relationship = consented, scoped, time-bounded grant (never CRUD);
- franchisor reads aggregates, not operational rows;
- GST and numbering scoped to branch / tax registration.

The existing plan document's mechanics (tenant ID, tenant context, EF filter, save stamping, isolation tests, audit first) remain valid. Its master-tenant topology should be replaced.
