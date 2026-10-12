# Trovo SaaS — Subscription Schema & Implementation Plan

**Project:** E6 Car Spa / Trovo SaaS Platform Admin Portal  
**Subscription model:** Every company, including each franchisee, pays Trovo independently  
**Initial payment approach:** Online payment gateway with automated payment reconciliation  
**Status:** Proposed technical design — validate against the current `main` branch before implementation

> **Review note (12 Oct 2026):** This design was reviewed and merged into `docs/SAAS_PHASE2_PLAN.md` (v2), which is the plan being built. Most of it was taken over as written: entities, minor-unit money, versioned plans, lifecycle, idempotent webhooks, a separate admin portal, and building the domain before the UI. Four points were adapted:
> 1. **Separate database per company.** Every company has its own database and login, chosen 12 Oct. Billing tables live in Trovo's catalog database `carspa_platform`, not in a shared business database.
> 2. **Canonical company record.** It is the catalog `Companies` row, whose id equals `Organizations.Id` in that company's database.
> 3. **Read-only vs Suspended.** `ReadOnly` (automatic after the 7-day grace or an unpaid trial) is kept separate from `Suspended` (Trovo's manual action).
> 4. **Phase 1 is done.** The PDF tests and Android CI were fixed; CI went green on 12 Oct.
>
> See §2 of `SAAS_PHASE2_PLAN.md` for the full comparison.

## 1. Recommended architecture

Build a platform-level billing and licensing layer on top of the existing E6 Car Spa multi-tenant architecture.

Every company pays Trovo independently, including franchisees. Each company has its own subscription, payment history, plan entitlements, and billing account. Franchise relationships and subscription relationships must remain independent.

Recommended architecture:

- **Trovo Platform Admin:** Separate web application for organization management, plans, subscriptions, billing, support, and audit logs.
- **Existing ASP.NET Core backend:** Add protected platform APIs and subscription/billing services.
- **Existing PostgreSQL database:** Extend the existing EF Core data model with billing entities.
- **E6 Windows and Android apps:** Consume entitlement information, while the backend remains the authority for access enforcement.
- **Payment gateway:** Use a provider-independent integration layer. Evaluate Razorpay as the initial India-focused candidate, after validating the required recurring-payment and mandate methods.

Retain the existing backend and repository rather than creating a duplicate backend or tenant database. The Trovo admin portal should be a separate web application with its own authentication and authorization boundary.

## 2. Core design principles

1. **One company identity:** Keep the existing `Organization` entity as the canonical tenant/company record.
2. **Independent billing:** Every organization has its own billing account and subscription under the selected model.
3. **Separate franchise and billing relationships:** A franchisee may be linked to a franchisor operationally but must pay Trovo independently.
4. **Versioned plans:** Existing customers' commercial terms must not change merely because a plan's current price changes.
5. **Server-enforced entitlements:** UI visibility is not security. Every protected backend operation must check the appropriate permission and entitlement.
6. **Separate SaaS and business billing:** Trovo subscription invoices must not share invoice numbering or payment records with E6 customer invoices.
7. **Auditable administration:** Platform-level actions must be logged with actor, target organization, timestamp, and relevant before/after values.
8. **Safe lifecycle handling:** Suspension should restrict access without deleting business data.

## 3. Recommended database schema

The following are proposed entities, not a claim that these tables already exist.

### 3.1 Plans and entitlements

#### `Plans`

Suggested fields:

- `Id`
- `Code`
- `Name`
- `IsActive`
- `CreatedAt`
- `UpdatedAt`

#### `PlanVersions`

Suggested fields:

- `Id`
- `PlanId`
- `Version`
- `Currency`
- `BasePriceMinor`
- `BillingInterval`
- `IncludedSeats`
- `EffectiveFrom`
- `EffectiveTo`
- `CreatedAt`

Use integer minor units for money where appropriate. For example, ₹1,999.00 is `199900` paise. Always store the currency explicitly.

#### `PlanEntitlements`

Suggested fields:

- `Id`
- `PlanVersionId`
- `FeatureKey`
- `ValueType`
- `Value`

Example feature keys:

- `showroom.enabled`
- `whatsapp_automation.enabled`
- `franchise_network.enabled`
- `users.max_active`

Entitlement keys should be centrally defined and validated rather than implemented independently in each controller.

### 3.2 Organization billing and subscriptions

#### Existing `Organizations`

Keep the existing organization as the source of truth for company identity. Do not create a duplicate tenant/company table or place all subscription details directly on `Organization`.

#### `BillingAccounts`

Suggested fields:

- `Id`
- `OrganizationId` — unique for v1
- `BillingName`
- `BillingEmail`
- `BillingPhone`
- `GSTIN` — optional where applicable
- `BillingAddress`
- `CreatedAt`
- `UpdatedAt`

#### `Subscriptions`

Suggested fields:

- `Id`
- `OrganizationId`
- `BillingAccountId`
- `PlanVersionId`
- `Status`
- `StartedAt`
- `CurrentPeriodStart`
- `CurrentPeriodEnd`
- `TrialEndsAt`
- `GraceEndsAt`
- `CancelAtPeriodEnd`
- `CanceledAt`
- `GatewayProvider`
- `GatewaySubscriptionId`
- `CreatedAt`
- `UpdatedAt`

An organization may have historical subscriptions, but it should have at most one current primary subscription unless a future requirement explicitly supports multiple concurrent subscriptions.

#### `SubscriptionItems`

Use this table for add-ons, extra seats, and other purchased quantities.

Suggested fields:

- `Id`
- `SubscriptionId`
- `ItemType`
- `ItemCode`
- `Quantity`
- `UnitPriceMinor`
- `Currency`
- `EffectiveFrom`
- `EffectiveTo`

Do not make franchisees inherit a franchisor's subscription or add-ons. Each organization's own subscription determines its licensed modules.

### 3.3 Invoices and payment processing

#### `BillingInvoices`

These are invoices issued by Trovo for its SaaS service, not E6 customer invoices.

Suggested fields:

- `Id`
- `OrganizationId`
- `SubscriptionId`
- `InvoiceNumber`
- `Currency`
- `SubtotalMinor`
- `TaxMinor`
- `TotalMinor`
- `AmountDueMinor`
- `Status`
- `IssuedAt`
- `DueAt`
- `PaidAt`
- `CreatedAt`

Use a dedicated Trovo SaaS invoice numbering series.

#### `PaymentTransactions`

Suggested fields:

- `Id`
- `BillingInvoiceId`
- `Provider`
- `ProviderOrderId`
- `ProviderPaymentId`
- `AmountMinor`
- `Currency`
- `Status`
- `PaidAt`
- `RefundedAmountMinor`
- `CreatedAt`
- `UpdatedAt`

Keep individual payment attempts separate from the recurring gateway subscription. One recurring subscription can produce many payment attempts.

#### `PaymentWebhookEvents`

Suggested fields:

- `Id`
- `Provider`
- `ProviderEventId`
- `PayloadHash`
- `ReceivedAt`
- `ProcessingStatus`
- `ProcessedAt`
- `RetryCount`
- `LastError`

Store only the data needed for verification, reconciliation, troubleshooting, and audit. Protect sensitive gateway payloads and credentials.

### 3.4 Operational audit and lifecycle events

#### `SubscriptionEvents`

Suggested fields:

- `Id`
- `SubscriptionId`
- `EventType`
- `EffectiveAt`
- `ActorType`
- `ActorId`
- `Metadata`
- `CreatedAt`

Use this to record events such as activation, renewal, plan change, payment failure, suspension, reactivation, and cancellation.

#### `PlatformAuditLogs`

Suggested fields:

- `Id`
- `AdministratorId`
- `Action`
- `TargetOrganizationId`
- `BeforeValues`
- `AfterValues`
- `Reason`
- `CorrelationId`
- `CreatedAt`

Platform audit logs should be append-only for ordinary application users and retained according to a defined policy.

## 4. Database constraints and transaction rules

Implement these protections in the database and application:

1. Unique organization codes.
2. Unique plan version numbers within each plan.
3. Unique gateway event IDs per provider.
4. Unique gateway payment and order references where provided by the gateway.
5. Foreign keys between organizations, subscriptions, invoices, and transactions.
6. A database-backed rule or transactional enforcement ensuring only one current primary subscription per organization.
7. Idempotent processing of gateway events.
8. Transactional updates for invoice settlement, payment recording, and subscription renewal.
9. Immutable transaction history: record refunds and reversals instead of overwriting the original payment.
10. Explicit currency on every monetary record.
11. No hardcoded commercial prices in client applications.
12. No deletion of business data as a side effect of subscription suspension.

## 5. Subscription lifecycle

Use explicit lifecycle states, for example:

- `Incomplete`
- `Trialing`
- `Active`
- `PastDue`
- `Suspended`
- `Canceled`

`Expired` can be represented as an explicit terminal state or derived from the subscription period and access policy. Make the decision consistently in the domain model.

Define transitions deliberately:

- A confirmed initial payment activates the subscription.
- A confirmed renewal extends the paid-through period.
- A failed renewal moves the subscription to `PastDue` according to the billing policy.
- An unresolved failure can enter a grace period.
- At the end of grace, access is restricted or the subscription is suspended.
- A successful recovery payment reactivates access according to policy.
- Cancellation must distinguish cancellation at period end from immediate cancellation.

Do not rely on a single generic `IsActive` flag to represent subscription, organization, and user status.

## 6. Payment gateway and automated reconciliation

Evaluate Razorpay as the initial gateway candidate for India, but keep provider-specific behavior behind an interface. Validate the selected gateway's recurring-payment, mandate, refund, webhook, and settlement capabilities before finalizing provider-specific fields or production behavior.

### Payment flow

1. The customer selects a plan in the checkout flow.
2. The backend calculates price, taxes, add-ons, and seat quantity using trusted plan data.
3. The backend creates the gateway order or recurring-subscription request.
4. The customer completes checkout and any required payment authorization.
5. The backend verifies the gateway signature or authenticated webhook.
6. The webhook event is persisted and processed idempotently.
7. The payment is reconciled against the corresponding Trovo SaaS invoice.
8. The subscription is activated or renewed only after the required payment confirmation.
9. Failed renewals trigger retry and grace-period rules.
10. Reconciliation jobs compare internal records with gateway payment/settlement records and flag discrepancies.

**Never activate a subscription solely because the browser redirects to a success page.** The backend must independently verify the payment.

### Required gateway safeguards

- Verify webhook signatures using the provider's prescribed process.
- Reject invalid signatures.
- Deduplicate events using the provider's event ID.
- Handle duplicate and out-of-order events safely.
- Avoid creating duplicate invoices or extending subscription periods twice.
- Keep recurring gateway subscription IDs separate from individual payment IDs.
- Record failed attempts, refunds, reversals, and reconciliation exceptions.
- Retry transient processing failures safely.
- Alert administrators about events that repeatedly fail processing.
- Never expose secret gateway keys to the browser or desktop/mobile apps.

## 7. Seat and add-on licensing

For v1, count **active application users** as licensed seats and track registered devices separately. This prevents a customer using both Windows and Android from automatically consuming two seats for one person.

Example:

`Seat limit = included seats + (purchased extra seat packs × seats per pack)`

If a plan includes 10 seats and the organization buys two packs of five, its limit is 20 active users.

The backend must enforce the limit when a user is created or reactivated. The UI should display usage, but it must not be the enforcement mechanism.

The backend entitlement service should resolve:

- Whether a module is enabled.
- The maximum active-user count.
- Whether a feature is included or purchased as an add-on.
- Whether the subscription currently grants access.
- Whether a grace-period restriction applies.

A franchisee receives only the modules included in its own subscription and organization configuration. It must not inherit the franchisor's showroom or franchise-management entitlements by default.

## 8. Compatibility with the existing `main` branch

The current architecture includes an `Organization` entity, tenant context and middleware, PostgreSQL row-level security, franchise-link functionality, organization provisioning, and existing showroom and business modules. Verify current files and migrations before implementing.

| Existing component | Recommended treatment |
|---|---|
| `Organization` | Keep as canonical company identity; relate it to billing accounts and subscriptions. |
| `TenantContext` and `TenantResolutionMiddleware` | Retain for tenant-facing requests. Give platform operations a separate authorization path. |
| PostgreSQL RLS | Preserve tenant isolation and explicitly design access rules for billing records and platform operations. |
| `FranchiseLink` | Keep franchise consent, scopes, and link lifecycle independent of billing. |
| `OrganizationProvisioner` | Extend safely to initialize business defaults and subscription/owner setup. |
| `Organization.FranchiseAddOnEnabled` | Migrate carefully toward subscription-backed entitlements. Avoid two conflicting sources of truth; preserve existing behavior during transition. |
| E6 invoice numbering | Keep independent from Trovo SaaS invoice numbering. |

### Platform security

Do not trust a tenant ID supplied by the browser to authorize cross-tenant access.

- Platform endpoints must explicitly authorize the authenticated platform administrator.
- Tenant APIs should continue using the authenticated organization context.
- Use narrowly privileged platform data access rather than a broad RLS bypass for ordinary administrative operations.
- Audit cross-tenant support and administrative access.
- Protect platform admin accounts with MFA where possible.
- Use time-limited, single-use owner invitations instead of emailing passwords.
- Keep payment gateway secrets in server-side secret configuration.

## 9. Proposed platform API endpoints

Use a protected `/api/platform` namespace in the existing backend.

| Endpoint | Purpose |
|---|---|
| `GET /api/platform/dashboard` | Platform metrics and subscription summaries |
| `GET /api/platform/organizations` | Search and filter organizations |
| `POST /api/platform/organizations` | Provision organization and owner invitation |
| `GET /api/platform/organizations/{id}` | View organization and subscription details |
| `GET /api/platform/plans` | List plans and plan versions |
| `POST /api/platform/plans` | Create a plan or plan version |
| `PUT /api/platform/organizations/{id}/subscription` | Change plan, seats, or add-ons |
| `PUT /api/platform/organizations/{id}/status` | Suspend or reactivate access with a reason |
| `POST /api/platform/checkout` | Create a trusted checkout session |
| `POST /api/platform/webhooks/{provider}` | Receive and verify gateway events |
| `GET /api/platform/organizations/{id}/billing` | View invoices, transactions, and reconciliation state |
| `GET /api/platform/audit-logs` | Search platform audit logs |

The webhook endpoint is not an interactive admin endpoint. It must authenticate provider events using the gateway's signature-verification mechanism.

Organization provisioning should be a reliable backend workflow that creates the organization, initializes its business defaults, establishes the initial subscription state, and issues an owner invitation. Handle failures so that partially provisioned organizations are recoverable and auditable.

## 10. Trovo Platform Admin portal

Build a separate web application with its own authentication boundary, deployment configuration, and platform-admin authorization.

Recommended initial screens:

1. **Dashboard:** Active organizations, active subscriptions, overdue payments, monthly recurring revenue, failed renewals, and recent administrative activity.
2. **Organizations:** Search, status, company details, owner invitation status, and subscription summary.
3. **Organization detail:** Plan, entitlements, seat usage, billing history, franchise links, and audited support actions.
4. **Plans and entitlements:** Create plans and immutable plan versions; configure prices, billing interval, included seats, and add-ons.
5. **Subscriptions:** Status, current period, grace period, renewals, plan changes, and cancellation.
6. **Billing:** Trovo SaaS invoices, payment attempts, refunds, gateway references, and reconciliation exceptions.
7. **Audit logs:** Search administrative actions and access history.
8. **Platform settings:** Gateway configuration status and operational settings without exposing secrets.

Do not build all UI screens before the subscription and entitlement domain is stable.

## 11. Implementation roadmap

### Phase 1 — Stabilize and inspect

- Fix the currently recorded backend PDF test failures.
- Fix the Android CI release-wrapper path failure.
- Review tenant and franchise migrations and the current worktree.
- Establish a clean baseline for backend, desktop, and Android CI.

### Phase 2 — Build the subscription domain

- Add plans, plan versions, entitlements, billing accounts, subscriptions, and subscription items.
- Add SaaS invoices, payment transaction records, webhook events, and audit events.
- Create EF Core migrations that preserve existing organization data and franchise relationships.
- Test migrations against a restored staging database.

### Phase 3 — Implement licensing and access enforcement

- Build the shared entitlement service.
- Enforce active-user seat limits in the backend.
- Enforce module entitlements in protected endpoints.
- Implement subscription state transitions and grace-period rules.
- Secure platform-admin authorization and tenant boundaries.

### Phase 4 — Integrate gateway and reconciliation

- Implement checkout and the chosen recurring-payment flow.
- Implement webhook verification and idempotent processing.
- Reconcile payments against Trovo SaaS invoices.
- Implement retry handling, refunds, reversals, and exception reporting.
- Test delayed, duplicate, failed, and out-of-order events.

### Phase 5 — Build the admin portal

- Add platform-admin login and MFA support where feasible.
- Build dashboard, organizations, plan management, subscription detail, billing, and audit screens.
- Connect the portal to the protected platform API.
- Deploy the portal separately from the Windows and Android applications.

### Phase 6 — End-to-end validation and rollout

Test:

- New organization provisioning and owner invitation.
- Independent subscriptions for a franchisor and its franchisee.
- Successful initial payments and renewals.
- Failed renewals, grace periods, suspension, and reactivation.
- Duplicate webhooks and out-of-order events.
- Seat limits and module entitlement changes.
- Refunds, cancellations, and plan changes.
- Tenant data isolation and platform-admin permissions.
- Recovery from failed provisioning or migration.
- Backend, desktop, and Android CI.

## 12. Acceptance criteria

The implementation is not complete until:

- Trovo can provision a company with a unique code, plan, and owner invitation.
- Each organization, including every franchisee, can subscribe and pay independently.
- A verified gateway payment activates or renews only the correct subscription.
- Duplicate or out-of-order webhook events cannot duplicate invoice settlement or extend subscription periods twice.
- Seat limits and add-on entitlements are enforced by the backend.
- Suspended or overdue organizations cannot bypass restrictions through Windows or Android clients.
- Existing E6 business records, invoice sequences, and franchise permissions remain intact.
- Tenant administrators cannot access platform APIs or other organizations' billing data.
- Platform administrative actions are auditable.
- Relevant backend, desktop, and Android CI jobs pass.
- Backup and restore procedures are tested before production rollout.

## 13. Migration and Git safety

- Work on a dedicated integration branch based on the verified `main` branch.
- Preserve existing uncommitted work, untracked migrations, generated Android files, desktop tests, and unrelated documentation.
- Do not stage or commit automatically.
- Do not run destructive cleanup or checkout commands.
- Do not use `dotnet ef migrations remove --force`.
- Do not apply migrations to the actual production database during development.
- Test migrations on a restored staging copy.
- Verify existing data, invoice sequences, RLS behavior, and recovery procedures before production deployment.

## 14. Recommended next deliverable

Before coding, prepare a detailed technical specification containing:

1. PostgreSQL schema and entity relationship diagram.
2. EF Core entity and configuration definitions.
3. Migration and backfill strategy.
4. Subscription lifecycle state machine and transition rules.
5. Entitlement evaluation and seat enforcement rules.
6. Platform API contracts and authorization matrix.
7. Payment gateway adapter, webhook processing, and reconciliation design.
8. Test plan for tenant isolation, payments, subscription lifecycle, and client compatibility.

**Recommendation:** Implement the subscription domain and backend licensing before the portal UI. This gives the portal a reliable source of truth and avoids building screens around business rules that later need to be rewritten.
