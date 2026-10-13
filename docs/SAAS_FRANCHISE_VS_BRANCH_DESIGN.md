# SaaS design: franchise outlets vs direct branches

**Version:** 1.2 (13 Oct 2026)
**Status:** **Approved by the owner on 13 Oct 2026**, with the answers in §7. The franchise sign-up code (Phase 2.8) is
built; branches (Phase 2.9) are not.
**Applies to:** Trovo catalog (`carspa_platform`), company databases (`carspa_t_*`), admin portal
(`apps/platform-admin`), sign-up website (`apps/signup-web`), Windows (`apps/desktop`) and Android (`apps/android`).

---

## 1. Summary

A car spa business grows in one of two ways:

1. **Franchise outlet:** another business uses the brand (e.g. E6 licenses its brand to a franchisee in Salem).
2. **Direct branch:** the same owner opens another workshop (e.g. E6 opens a Perundurai branch).

The two are different customers of Trovo and are stored differently:

- A **franchisee is a separate company**: its own database, login, subscription and payment. The franchisor sees only
  what the franchisee approves. **This is built** (Phase 2.3).
- A **branch is part of the same company**: same database, same subscription, same customers and vehicle history,
  with a `Branches` table and a branch on each operational record. **Not built** (proposed in §3.2).

---

## 2. Comparison

| | Franchise outlet (e.g. E6 Salem) | Direct branch (e.g. E6 Perundurai) |
|---|---|---|
| Legal entity | Separate business | Same business |
| Owner | The franchisee | The same owner |
| GSTIN | Franchisee's own | The company's GSTIN if the branch is in the same state; **its own GSTIN** (same PAN) if in another state |
| Who pays Trovo | The franchisee, for its own subscription | The company, through a branch add-on |
| Database | **Separate database** (`carspa_t_NNNN`) | **Same database** as the company, `Branches` table |
| Data the other side sees | Only the scopes the franchisee grants, read-only | Everything, subject to each user's branch access |
| Customers | Separate | Shared (history, packages and balances visible at every branch) |
| User licences | Its own | The company's licences (per user, any branch) |

---

## 3. Data design

### 3.1 Franchise (built, Phase 2.3)

```
┌──────────────────────────────────────────────────────┐
│ Trovo catalog (carspa_platform)                      │
│   FranchiseLinks: franchisor company → franchisee    │
│     company (company IDs), status, invite token hash │
│   FranchiseLinkScopes: requested / granted / denied  │
└──────────────┬────────────────────────┬──────────────┘
               ▼                        ▼
   carspa_t_0001 (E6, franchisor)   carspa_t_0002 (Salem, franchisee)
   own login and subscription,      own login and subscription
   Franchise network add-on
```

- Links refer to companies by their ID, not by the 4-digit company code.
- Status values: Pending, Active, Declined, Cancelled, Expired, Ended.
- **Scopes** (`FranchiseScopes`):
  - `financial_totals` (the default)
  - `invoice_list`
  - `staff`
  - `customers`

  The franchisee grants or denies each one and can switch it off later.
- **Reading figures** (`CrossDatabaseFranchise.cs`):
  1. The server checks for an Active link with the scope Granted.
  2. It opens the franchisee's database through the normal routing, using the franchisee's own database login, as a
     context that cannot save.
  3. It runs the query inside `SET TRANSACTION READ ONLY`, which only returns totals.
- **What that protection is:** server-side checks plus PostgreSQL's read-only transaction and per-company logins. It is
  not cryptographic; it depends on the server code staying correct, which the tests in `PlatformFranchiseTests` cover.
- **Limit:** the Franchise network add-on allows 10 franchisees; each "10 more" pack adds 10.

### 3.2 Direct branches (proposed)

All branches live in the company's own database. The design copies the existing per-company pattern: 38 entities
carry `OrganizationId`, set automatically on save and filtered automatically.

**New tables** (EF Core entities with Fluent API configuration and migrations; the SQL is only for illustration):

```sql
CREATE TABLE "Branches" (
    "Id" uuid PRIMARY KEY,
    "OrganizationId" uuid NOT NULL,           -- like every company-owned table
    "Code" varchar(10) NOT NULL,              -- 'MAIN', 'PRD'; unique per company
    "Name" varchar(120) NOT NULL,
    "Address" varchar(500),
    "Phone" varchar(20),
    "Gstin" varchar(15),                      -- NULL = use the company's GSTIN (same state)
    "StateCode" varchar(2),                   -- needed when the branch has its own GSTIN
    "IsActive" boolean NOT NULL DEFAULT true,
    "CreatedAt" timestamptz NOT NULL,
    "UpdatedAt" timestamptz
);

-- Which branches a user may work in. No rows = all branches (Owner, or a user given "all branches").
CREATE TABLE "UserBranches" (
    "UserId" uuid NOT NULL REFERENCES "Users"("Id"),
    "BranchId" uuid NOT NULL REFERENCES "Branches"("Id"),
    PRIMARY KEY ("UserId", "BranchId")
);
```

**Records that get a branch.** Each of these entities gets `BranchId` (NOT NULL after the backfill) and a marker
interface `IBranchOwned`:

| Area | Entities |
|---|---|
| Jobs and billing | `JobCards`, `JobCardServices` (via job card), `Invoices`, `InvoiceItems` (via invoice), `Payments` |
| Outside work | `OutsideJobs` |
| Staff | `Staff` (home branch), `StaffAttendances`, `StaffDailyAttendanceConfirmations`, `StaffAdvances`, `StaffSalarySettlements` |
| Showroom | `Showrooms` and their child tables (via showroom) |
| Numbering | `InvoiceNumberSeries`, `InvoiceNumberAllocations` |
| Messaging | `WhatsAppMessages` (for reporting only) |

These stay **company-wide** (no branch):

- `Customers`, `Vehicles`
- `Services` (catalogue; branch prices can come later if needed)
- `Vendors`
- `Users`, `Permissions`
- `BusinessProfiles`
- `WhatsAppConfigurations`
- `AuditLogs` (records the branch in the details)

**Enforcement (so no screen can forget it):**

- An `IBranchContext` per request holds the branches the signed-in user may see: all of them, or the rows in
  `UserBranches`.
- Reads use a global query filter on `IBranchOwned` entities, in the same place as the `OrganizationId` filter. The
  filter is skipped when the user may see all branches.
- On save, a new record gets the user's **current branch**. The server refuses a `BranchId` the user may not use.
- Sign-in stays company code + username. Users with more than one branch pick one after sign-in. The JWT carries the
  allowed branches. A **branch switcher** in the Windows header and the Android app bar changes the current branch,
  with an "All branches" view for users allowed it.

**Moving existing data (one migration, no change to existing numbers):**

1. Create one branch `MAIN` per company, named after the business profile.
2. Set `BranchId = MAIN` on all existing rows, then make the column NOT NULL.
3. Give the existing invoice number series to MAIN **unchanged** (same prefix, same next number). E6's invoice numbers
   and numbering do not change, now or later.

**Invoice numbering:**

- `InvoiceNumberSeries` becomes unique per (company, branch, series kind).
- A new branch gets its own series with its own prefix. The owner chooses the prefix, e.g. `PRD/`. The counter starts
  at 1 for that new series only.
- MAIN keeps its current prefix. Nothing gets renamed to `INV-MAIN-…`.

**GST and printing:**

- The invoice PDF and print show the branch's name, address and phone.
- They show the branch GSTIN when set, otherwise the company's.
- If a branch has its own GSTIN, its invoices must use its own series. GST law requires a separate invoice series per
  GSTIN.

**Reports and screens:**

- Dashboard, sales, GST, payments, staff and attendance reports get a branch filter ("All branches" for users allowed
  it).
- Daily cash and day-close are per branch.

---

## 4. Sign-up and identification

### 4.1 How Trovo tells them apart

The **customer's explicit choice decides**. Matching details are only a warning for Trovo staff, never an automatic
decision: a franchisee may be a relative with the same surname, or share an accountant's email.

| | Franchisee | Direct branch | Independent |
|---|---|---|---|
| How it starts | Franchise sign-up code from the franchisor (§4.2 B), or an invite after registering (§4.2 A) | The Owner adds it inside the app | Normal sign-up |
| Who pays | The franchisee | The company (branch add-on) | Itself |
| New database | Yes | No | Yes |

### 4.2 Connecting a franchisee

#### Method A: invite after registration (built)

1. The franchisee registers and gets its company code (e.g. `0002`).
2. In **Franchise network**, the franchisor enters `0002`, chooses the scopes to request and sends the invite
   (`POST /api/franchise/invites`).
3. The app shows a one-time link `…/franchise-invite/{token}`. The token is stored only as a hash, is single-use and
   expires.
4. The franchisee's **Owner** opens it signed in and grants or denies each scope (`POST /api/franchise/invites/{token}/respond`).

#### Method B: franchise sign-up code on the sign-up website (proposed)

For a new franchisee that has no company yet.

**New catalog table `FranchiseSignupCodes`.** A `FranchiseLinks` row needs the franchisee company to exist, so it
cannot hold this code. The table has these columns:

| Column | Meaning |
|---|---|
| `Id` | — |
| `FranchisorCompanyId` | The franchisor company |
| `CodeHash` | SHA-256 of the code; the code itself is shown once and never stored |
| `RequestedScopes` | The scopes the franchisor asks for |
| `Label` | Optional, e.g. "Salem — Ramesh" |
| `CreatedByUserId`, `CreatedAt` | Who made the code, and when |
| `ExpiresAt` | **1 hour** by default; Trovo can change it in the admin portal (System → `franchise_code_minutes`, 10 minutes to 7 days) |
| `ReservedBySignupOrderId`, `ReservedUntil` | A paid order holds the code while it waits for payment (as long as the order can be paid), so the 1 hour only has to cover entering the code |
| `UsedAt`, `UsedByCompanyId` | Filled in when the company is created and linked |
| `CancelledAt` | Filled in if the franchisor cancels |

The steps:

1. **The franchisor creates the code.** In Franchise network → **Create franchise sign-up code**, they choose the
   requested scopes. The code is long and random, in the same format and strength as registration codes
   (`XXXX-XXXX-XXXX`, letters and digits without look-alikes), e.g. `K7QM-4RTX-9PWD`. A short code like
   `FRAN-E6-8921` can be guessed and is not allowed.
2. The franchisor sends the code to the franchisee themselves (WhatsApp, phone).
3. **The franchisee uses it on the sign-up website.** They choose "Joining a franchise network" and enter the code.
   - `POST /api/public/signup/franchise-code` checks it. The endpoint has its own strict rate limit, and every
     failure gives the same answer.
   - Only a valid code returns the franchisor's display name and the requested scopes.
4. **Consent.** The page lists exactly what the franchisor will see (the scope labels). The franchisee must tick
   **"I allow [franchisor] to see this"**. Without the tick the code isn't used and the sign-up continues as an
   independent company.
5. **When the company is created** (trial or paid), in the same step that provisions the database:
   - The server checks again that the code is unused and unexpired, and that the franchisor still has a free
     franchise slot and an active subscription with the Franchise network add-on.
   - If all of that holds: it marks the code used and creates an **Active** `FranchiseLinks` row, with the consented
     scopes Granted.
   - If any check fails: the company is still created as independent, and the done page says the franchise link
     could not be made, with the reason. The franchisor can then use Method A.
6. The franchisee's Owner can later switch scopes off or end the link, exactly as with Method A.

**Changes to existing code:**

- `SignupOrders` gets `FranchiseSignupCodeId` and `FranchiseConsent` (bool).
- The sign-up quote and order validate the code.
- The admin portal Sign-ups page shows "via franchise code of 0001".

### 4.3 Sign-up website (`apps/signup-web`)

On the Business step:

```
How are you joining?
(•) My own car spa
( ) Joining a franchise network        → code field, then the consent box (§4.2 B)
( ) Adding a branch to my existing Trovo account
```

- **Joining a franchise network:** as in §4.2 B.
- **Adding a branch:** the website has no login and will not get one. Choosing this shows a short message and no
  form: a branch is part of the existing company, the Owner will add it from inside the app (coming with Phase 2.9),
  until then call Trovo.

### 4.4 Adding a branch (inside the apps, Owner only)

1. Settings → Subscription → **Add branch**: name, code, address, phone, and optionally a GSTIN with its state.
2. The branch add-on quantity goes up by one. As with every add-on change today, the new price applies from the next
   invoice (no proration in v1). Charging for part of the current period would be a separate decision.
3. The branch is created at once (paid plans only; a trial cannot add branches) and its invoice series is set up.
4. The Owner assigns users to branches in Users.

### 4.5 Admin portal (`apps/platform-admin`)

- **Company page badges:**
  - Franchisor (number of linked franchisees)
  - Franchisee (linked to company 0001)
  - Independent

  Also shown: number of branches.
- **Duplicate warning:** when Trovo staff create a company whose owner mobile, email or GSTIN matches an existing
  company, the portal warns: *"This matches company 0001. If it is the same business, add a branch there instead."*
  Staff can still continue. This is a warning only.

---

## 5. Pricing

- Prices are set by the owner in the admin portal (Plans and add-ons), not in this document or in code.
- Built:
  - **Franchise network** add-on (10 franchisees)
  - **10 more franchise branches** pack
- Proposed: a **Branch** add-on bought by quantity (one unit per extra branch, like the franchise pack adds 10),
  unlocking a new `branches.limit` feature. MAIN is included. User licences stay per user and are not tied to a branch.

---

## 6. Implementation plan (after approval)

Phases 2.5–2.7 stay as in `docs/SAAS_HANDOFF_AND_NEXT_STEPS.md` (gateway, self sign-up and email, validation and
rollout). This work comes after them.

- [x] **Phase 2.3:** franchise links across databases, scopes, read-only figures, franchisee limit.
- [x] **Phase 2.8 — Franchise sign-up code** (built 13 Oct 2026, branch `feature/saas-user-licences`):
  - [x] `FranchiseSignupCodes` table and catalog migration `FranchiseSignupCodes`
  - [x] `GET/POST /api/franchise/signup-codes`, `POST /api/franchise/signup-codes/{id}/cancel` (franchise.view / franchise.manage)
  - [x] public `POST /api/public/signup/franchise-code`, rate limit `public-code` (10 per 10 minutes per address)
  - [x] link creation when the company is created (trial at once, paid on payment)
  - [x] `SignupOrders` fields
  - [x] Windows and Android: make, list and withdraw codes (Franchise → Network)
  - [x] sign-up website: "How are you joining?" choice, code check, consent box; result on the done page
  - [x] portal: Sign-ups shows the franchise code and whether it linked; System has the code lifetime
  - [x] tests:
    - guessing and rate limit
    - expired, used and cancelled codes
    - franchisor full or lapsed (the company is created as independent)
    - consent unticked
    - two sign-ups racing for one code (only one links)
- [ ] **Phase 2.9 — Branches** (about 3–4 weeks; plan the details with E6 as the first user: numbering prefixes,
      day-close, staff moving between branches):
  - [ ] `Branches`, `UserBranches`, `BranchId` on the entities in §3.2
  - [ ] the MAIN backfill migration (verify on a copy of the E6 database that every invoice number is unchanged)
  - [ ] `IBranchContext`, query filter, stamping on save, refusal of branches the user may not use
  - [ ] invoice series per branch; branch details and GSTIN on PDFs and prints
  - [ ] branch filter on dashboard and reports; daily cash per branch
  - [ ] branch switcher and user–branch assignment in Windows and Android
  - [ ] Branch add-on in the catalog and the Add branch flow
  - [ ] tests:
    - a restricted user can't read or write another branch (API and both apps)
    - Owner sees all branches
    - numbering is independent per branch
    - E6's existing numbers are unchanged after migration
    - reports total correctly per branch and for all branches

## 7. Owner's answers (13 Oct 2026)

1. **Approved** as written.
2. Branch invoice prefixes and per-branch day-close: **decide later** (with E6, before Phase 2.9).
3. A trial **cannot** add branches.
4. Franchise sign-up code lifetime: **not 30 days — 1 hour** by default (changeable in the admin portal).
