# E6 Car Spa — SaaS Readiness Assessment

**Repository:** `Gokulakannan750/E6_Car_Spa`  
**Branch reviewed:** `main`  
**HEAD reviewed:** `6b81eb25ee464fa5d5f52d2c962690013f00523f`  
**Assessment date:** 8 October 2026

## Executive Summary

The current `main` branch is a **mature single-tenant detailing/car-spa application**, but it is **not yet a true multi-tenant SaaS application**.

### Overall SaaS readiness: **4.5 / 10**

### Existing application foundation: **8.5 / 10**

These scores are intentionally different. The application already has strong business functionality, backend architecture, RBAC, security hardening, audit logging, testing, branding customization, WhatsApp integration, Windows desktop support and Android support.

The major missing layer is the actual **SaaS architecture**:

- Organization/Tenant model
- Tenant isolation
- Organization-scoped authentication
- Organization-scoped settings
- Organization-scoped WhatsApp configuration
- Subscription and plan management
- Feature entitlements
- SaaS onboarding
- Franchise relationships
- Platform administration

> **Do not rewrite the application. The current codebase is a strong foundation for converting the E6 application into Trovo Detailing Software SaaS.**

## 1. Current Architecture

```text
Windows Desktop
       │
Android
       │
       ▼
ASP.NET Core API
       │
       ▼
Application Services
       │
       ▼
Entity Framework Core
       │
       ▼
PostgreSQL
```

The backend is organized around Controllers, Application, Domain, Infrastructure, Migrations and Tests. This is a good foundation for SaaS evolution.

## 2. What Is Already Strong

### Business Functionality — 9/10

The current application is already a substantial detailing/car-spa management system covering customers, vehicles, job cards, services, invoices, payments, staff, showroom operations, reports, company settings, WhatsApp integration, audit logging and user management.

### Backend Architecture — 8.5/10

The separation between Controller → Application Service → Domain → EF Core → PostgreSQL provides a good place to introduce Tenant Context, Organization Context, Tenant Authorization and Tenant Database Filtering without rewriting every business feature.

### RBAC — 8.5/10

The system already has Owner, Manager and Staff roles, granular permissions, backend authorization, owner-only operations, permission-based reports, destructive-action authorization, audit logging and privilege-escalation protection.

The existing permission model can largely be retained; the major change is making permissions organization-scoped.

### Security Foundation — 8.5/10

Existing security work includes authentication, JWT, rate limiting, AES encryption, audit logging, authorization, privilege-escalation defenses, sensitive-data protection, WhatsApp token protection and invoice/destructive-operation authorization.

However, tenant isolation itself is a security boundary. Until tenant isolation is implemented and tested, the system cannot be considered SaaS-secure.

## 3. Biggest Missing Piece: Tenant Isolation

The current domain model does not yet have a true organization/tenant boundary. There is no universal `TenantId`, `OrganizationId` or `BusinessId` on the current business entities.

Today the architecture effectively behaves like:

```text
Application
   │
   ├── One business profile
   ├── One settings context
   ├── One WhatsApp configuration
   ├── Users
   ├── Customers
   ├── Vehicles
   ├── Invoices
   └── Other business data
```

A SaaS platform needs:

```text
Trovo Platform
       │
       ├── Organization A
       │      ├── Users
       │      ├── Customers
       │      ├── Vehicles
       │      ├── Invoices
       │      ├── Settings
       │      └── WhatsApp
       │
       ├── Organization B
       │      ├── Users
       │      ├── Customers
       │      ├── Vehicles
       │      ├── Invoices
       │      ├── Settings
       │      └── WhatsApp
       │
       └── Organization C
```

This is the single largest architectural gap.

## 4. Database Architecture — 6/10

PostgreSQL itself is suitable. The problem is that many entities currently assume a single business. Business settings and WhatsApp configuration currently behave as singleton/global records and need to become organization-owned.

Tenant-owned entities will likely include Customers, Vehicles, JobCards, Invoices, Payments, Services, Vendors, Staff, Showrooms, BusinessProfile, SystemPreferences, WhatsAppConfiguration and AuditLogs.

Platform/global entities may include Permissions, Permission definitions, Subscription Plans, Feature definitions and platform configuration.

A complete Tenant Boundary Audit should happen before the first SaaS migration.

## 5. Existing Services Need Tenant Scoping

Current services query tables such as `_db.Customers`, `_db.Vehicles`, `_db.Invoices` and `_db.JobCards` without an organization boundary because there is no tenant context yet.

The SaaS architecture should introduce a centralized tenant context:

```text
Authenticated User
        ↓
Organization Membership
        ↓
Current Tenant Context
        ↓
Authorization
        ↓
EF Core Tenant Filtering
        ↓
Database
```

## 6. Authentication Needs SaaS Scoping

The current JWT contains user-related information such as User ID, Name, Username, Role and Owner indicator. SaaS authentication must establish and validate organization membership on the server rather than trusting a tenant identifier supplied by a client.

## 7. Owner Role Must Become Organization-Scoped

The current authorization handler gives an active Owner broad permission bypass, which is appropriate for the single-business architecture.

In SaaS, this must become an **Organization Owner**, separate from a **Trovo Platform Admin**. A customer Owner must never receive platform-level privileges.

## 8. Branding — 8/10

Recent commits have significantly improved SaaS readiness by removing hard-coded E6 branding from invoices, job cards, exports, public invoice pages and Android PDFs, and by making company-defined application colours available.

The target architecture should be:

```text
Organization
    │
    ├── BusinessName
    ├── Logo
    ├── BrandColor
    ├── Tagline
    ├── Address
    ├── Phone
    └── Terms
```

rather than hard-coded E6 values.

## 9. Invoice Numbering Needs Tenant Awareness

The application now has `InvoiceNumberSeries` and `InvoiceNumberAllocation`, providing a strong basis for safe invoice numbering.

SaaS requires invoice numbering to be organization-scoped. For example:

```text
Organization A → GST/0001
Organization B → GST/0001
```

Both can be valid because they belong to different organizations.

Future numbering should support the appropriate combination of `TenantId`, `BranchId`, `FinancialYear`, `SeriesKind`, `Prefix` and `NextNumber`.

## 10. WhatsApp Is Not Yet SaaS-Ready

The current WhatsApp implementation is designed around a single configuration. SaaS needs each organization to have its own WABA, phone and access token.

```text
Organization A
    WhatsApp Configuration
        WABA A
        Phone A
        Token A

Organization B
    WhatsApp Configuration
        WABA B
        Phone B
        Token B
```

The background worker must process messages by organization and resolve the corresponding WhatsApp configuration and token.

## 11. WhatsApp Message History Needs Snapshots

For SaaS, historical WhatsApp messages should preserve the sending configuration at the time of sending. Recommended fields include:

```text
TenantId
TemplateNameSnapshot
PhoneNumberIdSnapshot
WabaIdSnapshot
BusinessNameSnapshot
RecipientPhone
MetaMessageId
Status
FailureCode
FailureReason
CreatedAt
SentAt
FailedAt
```

This prevents historical records from becoming ambiguous after a WhatsApp number changes.

## 12. Audit Logs Need Tenant Context

The existing audit log is strong, with UserId, UserName, UserRole, Action, Module, EntityType, EntityId, Description, OldValues, NewValues, Metadata, IP Address and Outcome.

For SaaS, add `TenantId` so platform-level auditing can identify the organization, user, action and entity involved.

## 13. Reports Need Tenant Isolation

The application already has extensive report authorization. SaaS adds another dimension: **permission + tenant**.

A franchise must only see its own reports. Any permitted E6/Trovo management view must use a separate, explicit cross-organization authorization path.

## 14. Public Invoice Links Need Tenant Awareness

The existing public invoice endpoint and rate limiting are good. The public token can remain the external access mechanism, but internally the path must remain:

```text
Public Invoice Token
       ↓
Invoice
       ↓
Organization
```

Public access must never become a route around tenant isolation.

## 15. Subscription Architecture Is Still Missing

A commercial SaaS also needs platform-level concepts such as:

```text
Organization
Subscription
Plan
FeatureEntitlement
SubscriptionStatus
Trial
BillingCustomer
```

Subscription and billing can be implemented after the core tenant boundary is stable.

## 16. Franchise Architecture

The planned franchise model is compatible with SaaS:

```text
Trovo Platform
       │
       └── E6 Main Organization
                 │
                 ├── Franchise A Organization
                 ├── Franchise B Organization
                 └── Franchise C Organization
```

Each franchise remains its own organization with its own users, customers, vehicles, invoices, WhatsApp configuration and subscription where applicable.

The franchise relationship should grant only explicitly permitted management/reporting access and should not automatically grant unrestricted CRUD access.

## 17. Do Not Turn This Into a Generic ERP

The recommended product direction is:

```text
Trovo Detailing Software
       │
       ├── Detailing Business A
       ├── Detailing Business B
       ├── E6 Main
       ├── E6 Franchise A
       └── E6 Franchise B
```

Keep the domain model focused on detailing/car-spa businesses rather than turning it into a generic grocery/restaurant/clothing ERP.

## 18. Detailed SaaS Readiness Score

| Area | Readiness |
|---|---:|
| Existing business functionality | **9/10** |
| Backend architecture | **8.5/10** |
| Windows desktop | **8.5/10** |
| Android | **8/10** |
| RBAC | **8.5/10** |
| Security foundation | **8.5/10** |
| Audit logging | **8/10** |
| Testing | **8.5/10** |
| Branding / white-label foundation | **8/10** |
| API architecture | **8/10** |
| Database architecture | **6/10** |
| Tenant isolation | **1/10** |
| Organization model | **1/10** |
| SaaS authentication | **3/10** |
| Subscription / billing | **1/10** |
| Feature entitlements | **1/10** |
| Multi-tenant WhatsApp | **2/10** |
| Franchise management | **2/10** |
| SaaS onboarding | **2/10** |
| Production SaaS operations | **4/10** |

### Overall SaaS Readiness: **4.5/10**

## 19. Recommended SaaS Implementation Roadmap

### Phase 1 — Tenant Foundation

Implement:

```text
Organization
Tenant Context
User → Organization Membership
Organization-scoped authentication
Tenant-aware authorization
```

### Phase 2 — Database Tenant Isolation

Add organization ownership to all tenant-owned entities and implement centralized tenant filtering, database constraints and indexes.

### Phase 3 — SaaS Identity and RBAC

Convert Owner, Manager and Staff into organization-scoped roles and introduce a separate platform administrator role.

### Phase 4 — Subscription and Feature Entitlements

Introduce Plans, Subscriptions, Subscription Status, Feature Entitlements, Usage Limits and Trial support.

### Phase 5 — SaaS Onboarding

```text
Sign Up
   ↓
Create Organization
   ↓
Create Owner
   ↓
Select Plan
   ↓
Organization Setup
   ↓
Branding
   ↓
Users
   ↓
WhatsApp
   ↓
Ready
```

### Phase 6 — Multi-Tenant WhatsApp

Implement organization-specific WABA, phone, token, templates, message queue and webhooks, followed by Meta Embedded Signup.

### Phase 7 — Franchise Layer

Implement explicit organization-to-organization franchise relationships with scoped permissions.

## 20. Target Architecture

```text
                         TROVO PLATFORM
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
       Platform Admin                       SaaS Services
                                                 │
                         ┌───────────────────────┼───────────────────────┐
                         │                       │                       │
                  Organizations            Subscriptions          Feature Flags
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   Organization A   Organization B   Organization C
        │                │                │
        ├─ Users         ├─ Users         ├─ Users
        ├─ Customers     ├─ Customers     ├─ Customers
        ├─ Vehicles      ├─ Vehicles      ├─ Vehicles
        ├─ Job Cards     ├─ Job Cards     ├─ Job Cards
        ├─ Invoices      ├─ Invoices      ├─ Invoices
        ├─ Payments      ├─ Payments      ├─ Payments
        ├─ Staff         ├─ Staff         ├─ Staff
        ├─ Settings      ├─ Settings      ├─ Settings
        └─ WhatsApp      └─ WhatsApp      └─ WhatsApp
```

## 21. Final Assessment

### Current state

```text
Strong product
Strong backend
Strong RBAC
Strong security foundation
Strong testing
Good branding foundation
Good WhatsApp foundation
        │
        ▼
Missing SaaS tenant layer
```

### Do NOT

- Rewrite the application
- Start a separate SaaS codebase
- Randomly add `TenantId` to every table
- Convert it into a generic ERP
- Build subscription billing before tenant isolation
- Implement multi-tenant WhatsApp before organization architecture

### DO

1. Perform a complete Tenant Boundary Audit.
2. Design Organization/Tenant entities.
3. Design User → Organization membership.
4. Implement tenant context.
5. Implement centralized database tenant isolation.
6. Convert RBAC to organization scope.
7. Add subscription/feature architecture.
8. Convert WhatsApp to organization scope.
9. Implement SaaS onboarding.
10. Add franchise relationships.

# Final Verdict

> **The E6 Car Spa repository is not yet SaaS-ready as a production multi-tenant platform, but it is a very good foundation for becoming one.**

### Current SaaS readiness: **4.5 / 10**

### Existing software foundation: **8.5 / 10**

### Expected after correct tenant architecture: **8.5–9 / 10**

The remaining work is primarily the **SaaS platform layer**, not rebuilding the existing detailing application.

**Recommended immediate next step:** perform the **Tenant Boundary Audit** against the current `main` branch before writing any SaaS migration code.


---

---

# Review notes (added 8 October 2026, after the assessment above)

These notes were added by Claude Code after checking the assessment against the repository. The text above is unchanged.

## 1. Checked against the code: the assessment holds up

| Claim | Result |
|---|---|
| No `TenantId` / `OrganizationId` on any entity | **Confirmed.** No match anywhere in the backend. |
| Business settings and WhatsApp are singletons | **Confirmed.** `BusinessProfile`, `SystemPreference` and `WhatsAppConfiguration` each carry a `SingletonKey`. |
| Owner bypasses all permission checks | **Confirmed.** `PermissionAuthorizationHandler`: active Owner passes every check. |
| Audit log has no tenant | **Confirmed.** `AuditLog` has no tenant field. |
| Invoice numbering ledger exists | **Confirmed.** `InvoiceNumberSeries` and `InvoiceNumberAllocation`. |
| Size of the codebase | 37 entities, 37 DbSets, 27 controllers, 26 services, about 576 `_db.` query sites. |

The overall score (4.5 / 10 for SaaS readiness, 8.5 / 10 for the foundation) is a fair reading.

## 2. What the assessment does not mention

1. **The recommended next step has already been done.** The assessment ends by recommending a Tenant Boundary Audit. That audit exists: `docs/SAAS_PHASE0_TENANT_AUDIT.md` (6 October 2026). It classifies all 37 entities and lists ten findings (T1 to T10) that the assessment does not capture, in particular:
   - **T1:** 15 business keys are unique across the whole platform (vehicle registration, staff, job-card number, invoice number and others), so a second company could not use values another company already has.
   - **T2:** only one Owner is allowed on the entire platform (a unique index).
   - **T3:** usernames are unique platform-wide, and login has no organization context.
   - **T5:** job-card numbers come from one global PostgreSQL sequence created at runtime.
   - **T6/T7:** 12 `IgnoreQueryFilters()` calls and one table outside the base entity would bypass a tenant filter.
   - **T8:** the first-time bootstrap endpoint creates an Owner whenever the database has no users, which is unsafe on a shared platform.
   - **T10:** the anonymous public profile endpoint returns the single profile.
2. **Three decisions are still open before Phase 1** (from that audit): login identity (email or phone plus an organization picker, or username plus organization code), invoice and job-card numbering scope (per organization or per GST registration, and whether it resets each financial year, to be confirmed with the accountant), and the product name.
3. **Companion planning documents already exist:** `DETAILING_SOFTWARE_SAAS_FRANCHISE_ARCHITECTURE.md` (target design and per-phase estimates), `E6_Car_Spa_Franchise_MultiTenant_Plan.md`, and `docs/PRICING_AND_PLANS_DRAFT.md`.

## 3. Things that changed after the commit the assessment reviewed

The assessment reviewed `6b81eb25`. Since then, `main` moved to `fbac90ee`:

- The sign-in token names, WhatsApp default template names, the invoice link address, the sample database name and the Android app name no longer name E6.
- The Android application ID is now `com.carspapro.management`.
- Each company can upload its own login page picture (Windows and Android).

This closes most of finding T9 (hard-coded E6 identity), so the branding score is now a little higher than 8/10. What remains: internal code names such as the Flutter package name, and the Android default production server address, which each company's build must set.

## 4. Effort estimate

These figures come from the project's own planning documents (`DETAILING_SOFTWARE_SAAS_FRANCHISE_ARCHITECTURE.md`, section "phases") for **one developer including tests**, converted at 5 working days a week. They are planning ranges, not promises.

| Phase | What | Weeks | Working days |
|---|---|---:|---:|
| Audit | Tenant Boundary Audit | done | done |
| 1 | Tenant foundation: organization, tenant context, filter, columns, composite unique indexes, cross-tenant test harness | 4–7 | 20–35 |
| 2 | Identity: memberships, organization-scoped login, platform admin separate from organization Owner | 2–3 | 10–15 |
| 3 | Per-organization settings, numbering and WhatsApp configuration | 2–4 | 10–20 |
| | **Minimum to onboard a second company by hand (phases 1–3)** | **8–14** | **40–70** |
| 4 | Subscriptions and feature entitlements | 2–3 | 10–15 |
| 5 | Self-service sign-up and onboarding | about 2–3 (not separately estimated in the planning documents; assumption) | 10–15 |
| 6 | Multi-tenant WhatsApp: per-company queue and Embedded Signup, webhooks | included in phase 3 plus about 2 | about 10 |
| 7 | Franchise network | 3–4 | 15–20 |
| | **Full list in this assessment (phases 1–7)** | **about 19–29** | **about 95–145** |

Not included: automated billing (2–3 weeks), customer links across the network (3–4 weeks), offline-first (8–14 weeks).

What can add calendar time without adding work: Meta's review of the Tech Provider app and its Embedded Signup access, setting up and securing the hosted server, waiting for the accountant's numbering decision, and your review and testing of each phase.

## 5. Suggested order, using what already exists

1. Settle the three open decisions (section 2).
2. Build the cross-tenant test harness first (two organizations, every endpoint asserting it cannot see or change the other's data).
3. Add the organization and tenant context, then the filter and the columns, then the composite unique indexes.
4. Review the 12 filter bypasses and the 3 raw SQL sites; disable the bootstrap endpoint.
5. Only after phase 1 is solid: memberships and login, then per-organization configuration and WhatsApp, then plans and onboarding.
