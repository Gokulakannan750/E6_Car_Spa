# Google Stitch prompts — Trovo Platform Admin Portal

How to use:
1. Start a new Stitch project. Choose **Web** and a **desktop** canvas.
2. Paste **Prompt 0** first. It sets the style and the layout shell.
3. Then paste the screen prompts **one at a time** (Prompts 1–12) in the same project, so every screen keeps the same style.
4. When a screen looks right, keep it. If something is off, ask Stitch for a small change, e.g. "make the table denser", "move the button to the top right".
5. Export the project as a ZIP (HTML + screenshots) and put it in the repository folder `design/stitch-admin-portal/`. I then build the real app from it.

All names, numbers and codes in the prompts are **made-up sample data**, only for the design.

---

## Prompt 0 — Style and layout (paste first)

```
Design a desktop web application called "Trovo Platform" — an internal admin console used by staff of Trovo Tech Solutions (a software company) to manage the companies that subscribe to its car spa management software. It is a professional back-office tool used for long working sessions, not a marketing site.

Visual style (dark, matching the brand website trovotechsolutions.in):
- Page background #09090B (near black). Cards and panels #18181B. Subtle alternate surface #111113. Borders 1px rgba(255,255,255,0.08).
- Primary text #E4E4E7, secondary text #A1A1AA, headings #FFFFFF.
- Primary action colour: blue #3B82F6 (hover #2563EB). Accent red #F87171 used sparingly.
- Brand gradient (for the logo mark, active nav indicator and the primary button only): linear-gradient(135deg, #2563EB 0%, #EF4444 100%).
- Font: Inter. Rounded corners 12px for cards, 8px for inputs and buttons, pill shape for status badges.
- Comfortable but information-dense: tables with 44px rows, small 13px table text, clear column headers.
- Status badge colours tuned for dark backgrounds: Trial = blue, Active = green, Past due = amber, Read-only = orange, Suspended = red, Canceled = grey, Awaiting registration = violet.
- Good contrast (WCAG AA) everywhere.

Layout shell for every screen (1440px wide desktop):
- Left sidebar 240px: at the top the Trovo logo mark (gradient) with the text "Trovo Platform". Navigation items with icons: Dashboard, Companies, Invoices, Plans & Prices, Audit Log, Admins, System. The active item has a gradient left indicator and a lighter background. At the bottom: "My account" and "Sign out".
- Top bar 64px: page title and breadcrumb on the left; on the right a global search box ("Search company code or name"), and the signed-in admin's name with a role badge (e.g. "Owner").
- Content area with 24px padding, scrollable.

No mobile layout, no bottom navigation. Money is in Indian rupees with the ₹ symbol and Indian digit grouping (₹1,99,900.00). Dates like "12 Oct 2026".

Start with the Dashboard screen (described next).
```

## Prompt 1 — Dashboard

```
Create the Dashboard screen inside the layout shell.

Top row: 6 compact KPI cards:
- Companies: 42
- Active subscriptions: 31
- On free trial: 6
- Monthly recurring revenue: ₹78,450
- Open invoices: 9 (₹31,200 due)
- Awaiting registration: 3
Each card has a small icon, a label, a big number and a muted sub-line.

Second row, two panels side by side:
- Left (wider): "Subscriptions by status". A horizontal stacked bar or donut with Trial, Active, Past due, Read-only, Suspended, and a legend with counts.
- Right: "Needs attention". A list of items with coloured status dots: "0012 Sunrise Detailing — payment overdue, grace ends 15 Oct", "0018 Moonlight Car Care — read-only since 10 Oct", "0021 Speed Wash — trial ends in 2 days", "System — all company databases up to date" (green). Each item is clickable.

Third row: "Recent activity" table (from the audit log): Time, Admin, Action, Company, Reason. 6 sample rows, e.g. "12 Oct 2026 14:05 · admin@trovo… · Payment recorded · 0002 Sunrise Detailing · UPI ref 4521".
```

## Prompt 2 — Sign in (two steps)

```
Create the Sign in screen. It is shown without the sidebar: full-page dark background with a subtle blue/red radial glow in two corners.

Centered card (400px):
- Step 1: Trovo logo mark and "Trovo Platform", subtitle "Staff sign-in". Fields: Email, Password (with show/hide eye). Primary gradient button "Continue". Small note: "Only for Trovo staff. Every action is recorded."
- Also design Step 2 as a second variant on the same screen: title "Enter your verification code", subtitle "Open your authenticator app and enter the 6-digit code." Six separate digit boxes, button "Verify", link "Use a different account".
- Also design Step 2b, "Set up 2-step verification" (first sign-in): a QR code placeholder, the setup key shown in monospace with a Copy button, steps "1. Open Google Authenticator or Microsoft Authenticator 2. Scan the code 3. Enter the 6-digit code", then the six digit boxes and "Confirm".
- Also design "Choose a new password" (after a one-time password): New password, Confirm password, password rules checklist, button "Save and continue".
- Show an inline error style: "The verification code is not correct."
```

## Prompt 3 — Companies list

```
Create the Companies screen.

Header row: title "Companies", count "42 companies", and on the right a primary gradient button "+ New company".

Filter bar: search input ("Code or name"), status chips: All, Trial, Active, Past due, Read-only, Suspended, Awaiting registration, Canceled (each with a count).

Dense data table with columns: Code (monospace, e.g. 0002), Company, Plan (Starter / Professional) with interval (Monthly / Yearly), Status (badge), Users (e.g. "4 / 10"), Renews or ends (date), Trial ends, Database (green "OK" or red "Update failed"), and a row actions menu (⋯).

10 sample rows with a mix of statuses. Pagination at the bottom ("1–10 of 42"). Rows are clickable to open the company.
```

## Prompt 4 — New company (dialog + result)

```
Create a "New company" modal dialog over the Companies screen (dimmed background).

Fields:
- Company name (required).
- "How does it start?" Two large selectable cards: "Free trial (7 days, full Professional)" and "Already paid".
- When "Already paid" is selected, show: Plan (Starter / Professional segmented control), Billing (Monthly / Yearly), Add-ons with quantity steppers (Showroom / B2B module ₹999/mo, 5 more users ₹299/mo, Franchise network ₹2,999/mo, 10 more franchise branches ₹1,499/mo), and "Paid until" date.
- A price summary box on the right: plan + add-ons = total per month or year, and the note "No GST (Trovo is not GST-registered)".
- Buttons: "Cancel" and primary "Create company".

Also design the success state as a second dialog: a green check, "Sunrise Detailing is ready", and two highlighted boxes:
- Company code: 0043.
- Registration code: K7QM-4RTX-9PWD, in large monospace, with Copy buttons.
Below them, a warning banner: "The registration code is shown only once. Send it to the customer now (WhatsApp or phone). It works once and expires on 26 Oct 2026." Then a button "Done".
```

## Prompt 5 — Company detail

```
Create the Company detail screen for "0002 · Sunrise Detailing".

Header: back link "Companies", company name with code, status badge "Active", and buttons on the right: "Change plan", "Suspend" (red outline), and a ⋯ menu (New registration code, Cancel subscription, Edit billing details).

Tabs: Overview, Subscription, Invoices, History.

Overview tab (show this one):
- Left column: card "Subscription" with:
  - Plan: Professional · Yearly · ₹19,990/year
  - Period: 12 Oct 2026 – 12 Oct 2027
  - Add-ons as chips: Showroom, Franchise network
  - Users: a progress bar "4 of 10 users"
  - Features list with check/cross icons: WhatsApp automation ✓, Outside jobs ✓, Staff advances ✓, Advanced reports ✓, Audit trail ✓, Showroom ✓, Franchise network ✓ (10 branches)
- Right column:
  - card "Company": company code, registered on 12 Oct 2026, database "carspa_t_0002 · up to date" with a green dot
  - card "Billing details": billing name, email, phone, GSTIN (optional), address, with an "Edit" link
  - card "Next invoice": "TROVO/2026-27/0014 due 5 Oct 2027, ₹22,989" or "No open invoice"
```

## Prompt 6 — Change plan (dialog)

```
Create a "Change subscription" modal for Sunrise Detailing.
- Plan: Starter / Professional (segmented).
- Billing: Monthly / Yearly.
- Add-ons with quantity steppers (as in New company).
- "Extend free trial by" a number of days, shown only for trial companies (show it greyed out here with the hint "Only for companies on a free trial").
- A "What changes" summary: features gained or lost (e.g. "− WhatsApp automation", "+ Showroom"), the new price from the next invoice, and the user limit before → after.
- A required "Reason" text area ("Recorded in the audit log").
- Buttons: Cancel, primary "Save changes".
```

## Prompt 7 — Suspend / Reactivate / Cancel (dialogs)

```
Create three small confirmation dialogs in the same style:
1. "Suspend Sunrise Detailing?" Red warning icon. Text: "Nobody at this company can sign in until you reactivate it. No data is deleted." Required Reason field. Buttons: Cancel, red "Suspend".
2. "Reactivate Sunrise Detailing?" Text: "The company returns to its previous state (Active)." Required Reason. Buttons: Cancel, primary "Reactivate".
3. "Cancel subscription". Radio options "At the end of the paid period (12 Oct 2027)" or "Now". Note: "The company keeps read-only access to its data for 90 days." Required Reason. Buttons: Keep subscription, red "Cancel subscription".
```

## Prompt 8 — Invoices tab and payment

```
Create the Invoices tab of the Company detail screen.

Top: button "Issue next invoice" and a summary "Paid this year ₹19,990 · Open ₹0".

Table: Invoice number (TROVO/2026-27/0001), Period, Issued, Due, Amount, Paid, Status (badge Open / Paid / Void), and actions (Record payment, Print, Void).

Also design a "Record payment" side panel (drawer from the right):
- Invoice TROVO/2026-27/0007, amount due ₹1,999.00.
- Fields: Amount (₹), Method (UPI / Bank transfer / Cash / Cheque), Reference (e.g. UPI ref or UTR, required), Payment date.
- Note: "When the invoice is fully paid, the subscription is renewed automatically."
- Buttons: Cancel, primary "Record payment".

Also design a printable invoice view (white paper on the dark page, A4 proportion):
- From: Trovo Tech Solutions, 37 Gokul Illam, 2 Velampalayam, Erode, Tamil Nadu 638112. Title "INVOICE" (not "Tax Invoice").
- Bill to: the company, with its address and GSTIN if any.
- Invoice number and date; a line table: "Professional plan (yearly), 12 Oct 2026 – 11 Oct 2027", "Showroom / B2B module (yearly)"; totals.
- Footer note "Trovo Tech Solutions is not registered under GST; no GST is charged."
- Buttons above the paper: "Print / Save as PDF", "Close".
```

## Prompt 9 — All invoices

```
Create the Invoices screen (sidebar item "Invoices"): all invoices across companies, for follow-up.
- Filter chips: Open, Overdue, Paid, Void, All. Search by invoice number or company. Date range.
- Summary cards: "Open: 9 invoices · ₹31,200", "Overdue: 3 · ₹8,997", "Collected this month: ₹54,970".
- Table: Invoice number, Company (code + name), Period, Due date (red when overdue), Amount due, Status, and an action "Record payment".
```

## Prompt 10 — Plans & Prices

```
Create the Plans & Prices screen.
- Two plan cards side by side: "Starter" and "Professional". Each shows the monthly and yearly price (Starter ₹999 / ₹9,990, Professional ₹1,999 / ₹19,990), users included (3 / 10), a feature checklist (WhatsApp automation, Outside jobs, Staff advances & salary, Advanced reports, Audit trail), version "v1 since 12 Oct 2026", and a button "New price version".
- Below: "Add-ons" table: Add-on, What it gives, Monthly, Yearly, Version, action "New price".
  - Showroom / B2B module ₹999 / ₹9,990
  - 5 more users ₹299 / ₹2,990
  - Franchise network ₹2,999 / ₹29,990
  - 10 more franchise branches ₹1,499 / ₹14,990
- An info banner: "Changing a price creates a new version. Existing customers keep their current price until their plan is changed."
- A "New price version" dialog: interval, price, users included, feature toggles, required reason.
```

## Prompt 11 — Audit Log

```
Create the Audit Log screen (Owner only).
- Filters: company (searchable select), admin, action type, date range.
- Dense table: Time, Admin (email), Action (e.g. company.suspend, payment.recorded, subscription.changed, platform.signed_in), Company, Reason, IP address.
- Clicking a row opens a right-side drawer showing "Before" and "After" as two side-by-side code blocks (JSON, monospace, syntax-coloured) and the correlation id.
- A note at the top: "This log cannot be edited or deleted."
```

## Prompt 12 — Admins, My account, System

```
Create three more screens in the same style:

1. Admins (Owner only): table of Trovo staff. Columns: Name, Email, Role (Owner / Billing / Support / Read-only), 2-step verification (Set up / Not set up), Last sign-in, Status (Active / Deactivated), and actions (Change role, Reset 2-step verification, Deactivate). Button "+ Add admin" opens a dialog (name, email, role). Its result shows a one-time password once, with Copy and the note "They must change it at first sign-in."

2. My account: profile card (name, email, role), "Change password" form (current, new, confirm, rules checklist), and "2-step verification: On" with the hint "Ask an Owner to reset it if you lose your phone."

3. System (Owner only): "Company databases" table. Columns: Code, Company, Database version, Last updated, Status (green Up to date / red Update failed with the error text). Button "Run updates now" with a confirmation. A small status card: "Catalog database: OK", "Background jobs: last run 5 min ago".
```

---

## After Stitch
Send me the exported ZIP (or put it in `design/stitch-admin-portal/`). I then:
1. Read every screen and its HTML.
2. Turn the colours, spacing and components into reusable React components.
3. Wire them to the real `/api/platform` API, with the security from the plan: sign-in, roles, reasons, codes shown once.
4. Add tests.
