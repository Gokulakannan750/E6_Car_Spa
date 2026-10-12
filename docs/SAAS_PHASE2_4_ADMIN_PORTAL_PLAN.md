# Phase 2.4 — Trovo Admin Portal (plan)

Status: **Built** (12 Oct 2026) on branch `feature/saas-admin-portal`, not merged · builds on `main` `3a2ebfed` (Phases 2.1–2.3 merged). Next steps: `docs/SAAS_HANDOFF_AND_NEXT_STEPS.md`.

## 1. What it is
A **separate web app for Trovo staff only**. It is not part of the car spa apps, and customers never see it.

Everything Trovo can do today through the server's `platform …` commands and the `/api/platform` API becomes screens:
- create a company and hand over its codes
- change plans and add-ons
- record payments
- suspend or reactivate a company
- watch revenue and the audit log

The backend API already exists (Phase 2.2). This phase is mostly the front end, plus a few small API additions (§6).

## 2. Technology (same as the Windows app, so no new skills or tools)

| Part | Choice | Why |
|---|---|---|
| Location | `apps/platform-admin` in the same repository (pnpm workspace) | One repo, shared CI, shared design tokens |
| Framework | React 19 + TypeScript + Vite | Same as `apps/desktop/renderer` |
| Styling | Tailwind CSS 4, colours and spacing from `packages/design-tokens` | Looks consistent with the product |
| Data | TanStack Query (server data), TanStack Table (lists) | Already used in the desktop app |
| Forms | React Hook Form + Zod | Same validation pattern as the apps |
| Routing | React Router | Same |
| Icons | Lucide | Same |
| 2-step QR code | `qrcode` (small, widely used) | Shows the authenticator QR at first sign-in |
| Tests | Vitest + Testing Library; Playwright for one end-to-end run | Same as the desktop app |

There is no new backend project: the portal calls the existing API at `/api/platform/*`.

## 3. Security design
- **Sign-in:**
  1. Email and password.
  2. A 6-digit authenticator code, every time.
  3. On first sign-in, the portal shows the QR code to add Trovo to an authenticator app (Google Authenticator, Microsoft Authenticator…).
- **Session:**
  - A 2-hour token, kept **in memory and in `sessionStorage`** (it survives a page refresh, is gone when the browser tab closes, and is never in `localStorage`).
  - Automatic sign-out after **30 minutes without activity**, and when the token expires.
- **Separate from customers:** company sign-in tokens are refused by the platform API and the other way round. This is already enforced and tested on the server.
- **Roles** (Owner / Billing / Support / ReadOnly): buttons a role may not use are hidden or disabled. The **server still decides**; the UI is only a convenience.
- **Reasons required:** every change asks for a reason, which goes into the audit log.
- **Codes shown once:** the registration code is shown only once after creating a company or issuing a new code, with a "Copy" button and a warning that it will not be shown again.
- **Hosting:**
  - Static files on a separate address (e.g. `admin.trovotechsolutions.in`).
  - A strict Content-Security-Policy (only the API's address); no framing.
  - The API allows this one address through CORS.
  - No secrets in the website's files: only the API address, as build configuration.
- **No customer business data:** the portal only shows platform data (companies, plans, billing, users count), never a company's customers, invoices or job cards.

## 4. Screens

| # | Screen | What you can do | API (exists unless marked) |
|---|---|---|---|
| 1 | **Sign in** | Email + password → authenticator code; first-time QR setup | `POST /platform/auth/login`, `/verify` |
| 2 | **Dashboard** | Totals: <ul><li>companies</li><li>subscriptions by status</li><li>monthly recurring revenue</li><li>open invoices and amount due</li><li>awaiting registration</li><li>migration failures</li><li>recent admin activity</li></ul> | `GET /platform/dashboard` |
| 3 | **Companies** | Search by code or name; filter by status (Trial, Active, Past due, Read-only, Suspended, Awaiting registration) | `GET /platform/companies` |
| 4 | **New company** | Name + start on **free trial** or **paid plan** (plan, monthly/yearly, add-ons, paid until) → shows the company code and **registration code once** | `POST /platform/companies` |
| 5 | **Company detail** | <ul><li>Overview: code, status, database health, registered or not</li><li>Subscription: plan, interval, add-ons, dates, users used / limit</li><li>Billing account</li><li>Invoices and payments</li><li>History (subscription events)</li></ul> | `GET /platform/companies/{id}`, `/billing` |
| 5a | → Change plan / add-ons / extend trial | Dialog with reason | `PUT …/subscription` |
| 5b | → Suspend / Reactivate | Dialog with reason | `PUT …/status` |
| 5c | → Cancel (at period end / now) | Dialog with reason | `POST …/cancel` |
| 5d | → New registration code | Shows the code once | `POST …/registration-code` |
| 5e | → Edit billing details | Name, email, phone, GSTIN, address, state | `PUT …/billing-account` |
| 6 | **Invoices** (inside company) | Issue invoice now, record payment (amount, UPI/NEFT reference, date), void with reason, **print/save invoice** | `POST …/invoices`, `/payments`, `/void`; print view = new (§6) |
| 7 | **All invoices** | Every open or overdue invoice across companies, for follow-up | **new** `GET /platform/invoices?status=` |
| 8 | **Plans & prices** | See Starter/Professional and add-ons with monthly/yearly prices; create a new price version (old subscribers keep theirs) | `GET /platform/plans`, `POST …/versions`, `POST /addons/{code}/prices` |
| 9 | **Audit log** | Who did what, to which company, why, from which IP; filter by company | `GET /platform/audit-logs` (Owner) |
| 10 | **Admins** | List Trovo admins, add an admin (one-time password), reset 2-step verification, deactivate | **new** `/platform/admins` (Owner) |
| 11 | **My account** | Change my password | **new** `POST /platform/auth/change-password` |
| 12 | **System** | Company database migration status; run migrations | `GET /platform/migrations`, `POST …/run` (Owner) |

Money is always shown in rupees (from paise), dates in Indian format (`12 Oct 2026`), and the invoice title follows the GST setting ("Invoice" now, "Tax Invoice" once Trovo has a GSTIN).

## 5. Look and layout
- **Dark theme in Trovo's website style** (your choice, 12 Oct). The colours come from the trovotechsolutions.in tokens (`css/variables.css`): near-black background, dark surfaces, Trovo's red→blue accent gradient. Text contrast is checked for readability (WCAG AA), because the portal is used for long sessions.
- Desktop-first business layout: **left sidebar** (Dashboard, Companies, Invoices, Plans, Audit, Admins, System), a top bar with the signed-in admin and role, and dense tables.
- **Trovo branding** (logo, "Trovo Platform"). No E6 branding.
- Status badges in the same colours everywhere, tuned for the dark background: Trial = blue, Active = green, Past due = amber, Read-only = orange, Suspended = red, Canceled = grey.

## 6. Small backend additions in this phase — ✅ built (12 Oct, branch `feature/saas-admin-portal`)
1. `GET /api/platform/invoices?status=Open|Paid|Void&companyId=` — all invoices across companies.
2. `GET /api/platform/invoices/{id}` — one invoice with lines and payments, for the print view.
3. `/api/platform/admins` (Owner):
   - list
   - create, returning the one-time password once
   - reset 2-step verification (and issue a new one-time password)
   - deactivate or reactivate (you can never deactivate yourself, or the last Owner)
4. `POST /api/platform/auth/change-password`: current + new password, with the same password rules as the apps.
5. **Must change password at first sign-in** with a one-time password (new `MustChangePassword` flag on admins; migration).
6. **CORS** for the portal's address (`Platform:AdminPortalOrigin` setting).
7. Tests for each, including role checks.

**Invoice PDF:** in this phase the portal gets a clean **print view**, so "Print → Save as PDF" in the browser gives a proper invoice. A generated PDF file and email come in 2.5/2.6 with the gateway and email.

## 7. Build order (each step tested before the next)

| Step | Contents | Est. days |
|---|---|---|
| 1 | Scaffold `apps/platform-admin`; sign-in (password → code, QR setup, forced password change); session and idle timeout; layout shell | 2 |
| 2 | Dashboard; Companies list; New company (codes shown once); Company detail overview | 2 |
| 3 | Subscription change, suspend/reactivate, cancel, new registration code, billing details | 1.5 |
| 4 | Invoices: issue, record payment, void, print view; All invoices list | 1.5 |
| 5 | Plans & prices; Audit log; System (migrations); Admins; My account | 1.5 |
| 6 | Tests (unit + one Playwright end-to-end against a test catalog), CI job, README for running and deploying | 1 |
| **Total** | | **8–10** |

## 8. How to run it locally (after step 1)

```bash
pnpm --filter platform-admin dev     # opens http://localhost:5190
```

It talks to an API running in platform mode on the test catalog (never the real E6 database).

## 9. Decisions (12 Oct 2026)
| Question | Answer |
|---|---|
| Look | **Dark, like trovotechsolutions.in** |
| Admins screen | **Yes**: Owner manages Trovo admins in the portal |
| Online address | **Decide later** (during hosting). The portal reads the API address and its own allowed address from configuration, so any subdomain works. |
