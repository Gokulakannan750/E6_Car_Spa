# WhatsApp in the Trovo SaaS — Design for Review

| | |
|---|---|
| **Status** | Draft **v0.2** for review. Changed from v0.1: **every client uses its own WhatsApp number**; the Trovo shared number is dropped. |
| **Date** | 7 October 2026 |
| **Owner** | Trovo Tech Solutions |
| **Related** | `docs/WHATSAPP_CLIENT_ONBOARDING_CHECKLIST.md` (send to clients), `docs/PRICING_AND_PLANS_DRAFT.md` §3a (WhatsApp pricing), `docs/WHATSAPP_MANAGED_TEMPLATES_CHANGES.md` (what's built), `DETAILING_SOFTWARE_SAAS_FRANCHISE_ARCHITECTURE.md` §11 |
| **How to review** | Sections 1–8 are the business design. Answer the questions in **section 14**. Sections 9–11 are technical. |

---

## 1. What clients need

Two automatic, **one-way** WhatsApp messages to their customers:

| # | When | Message |
|---|---|---|
| 1 | An invoice is **generated** | Invoice with the **amount due**, with the invoice PDF attached |
| 2 | The invoice is **fully paid** | Payment received / thank you |

- Customers don't reply. For questions they **call the business**, so every message shows the business phone.
- No payment link or QR code for now (section 12).
- Out of scope: marketing, offers, reminders, bulk messages, chat inbox.

---

## 2. Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Trovo is a Meta **Tech Provider** (Meta app "Trovo Business Messaging") | ✅ App created, Trovo business verified; app review in progress |
| D2 | **Every client uses its own WhatsApp number** in its own Meta business account. The client owns the number and pays Meta for its messages. | ✅ Agreed (v0.2) |
| D3 | Trovo **does not** run a shared sending number for clients | ✅ Agreed (v0.2): avoids the Meta policy question, cost risk and shared quality risk |
| D4 | Templates are a **managed pack created and maintained by Trovo** through the software. Clients don't build templates. | ✅ |
| D5 | Clients may request **their own wording**; Trovo reviews and creates it | ✅ |
| D6 | Messages are **utility only** (transactional) | ✅ |
| D7 | Each franchisee is its own organization with its own number | ✅ |
| D8 | Payment link / QR **later** | ✅ |

---

## 3. Who does what

### 3.1 Trovo's role (Tech Provider and software provider)

| Area | Trovo does |
|---|---|
| **Meta connection** | Owns and maintains the Meta app **Trovo Business Messaging**, through which every client's WhatsApp account is connected to the software. Keeps app review and Tech Provider status in good standing. |
| **Software** | Sends the two messages automatically, attaches the invoice PDF, retries failures, records every message and its status, shows WhatsApp health. |
| **Templates** | Designs the standard template pack, **creates it on each client's WhatsApp account** through the software, handles Meta approvals and rejections, and releases new versions (section 4). |
| **Onboarding** | Runs the assisted setup session (`WHATSAPP_CLIENT_ONBOARDING_CHECKLIST.md`). |
| **Support and monitoring** | Watches for expired access, rejected templates, failed messages and low quality ratings; helps the client fix them. |
| **Security** | Stores each client's access token encrypted; never shows or logs it; never asks for clients' Facebook passwords. |

| Trovo does **not** | |
|---|---|
| Own clients' WhatsApp accounts or numbers | They belong to the client |
| Pay or collect clients' Meta message charges | Meta bills the client's card directly |
| Write marketing or promotional messages | Out of scope |
| Answer customers | Customers call the business |

### 3.2 The client's role

| The client | |
|---|---|
| Owns its Meta business account, WhatsApp account and phone number | Created with its own real Facebook account |
| Pays Meta for messages | Card added in WhatsApp Manager (~₹0.12–0.15 per utility message; confirm on Meta's rate card) |
| Keeps business name and phone correct in Company Settings | Used in the messages |
| Collects customer consent | Ticks "Send WhatsApp updates" for customers who agree |
| Requests custom wording if wanted | Trovo creates it (section 4.3) |

---

## 4. Templates: who creates and maintains them

### 4.1 Short answer
**Trovo creates and maintains all templates. Clients never build templates or open Meta's template screens.** The software creates Trovo's standard templates **on the client's own WhatsApp account** (templates always live on the account that sends them) and switches them on once Meta approves.

### 4.2 Standard templates (the default for every client)

| Template | Content |
|---|---|
| `trovo_invoice_ready_v2` (proposed) | Invoice PDF + "Hello {{1}}, your invoice {{2}} for vehicle {{3}} is ready. Amount due: ₹{{4}}. Please find the invoice attached. For any questions, please call us on {{5}}. Thank you!" |
| `trovo_payment_received_v2` (proposed) | "Hello {{1}}, we have received your full payment of ₹{{2}} for invoice {{3}}. For any questions, please call us on {{4}}. Thank you for choosing us!" |

**Values:**
- customer name, invoice number, vehicle, amount due (invoice balance when generated) and amount paid: from the invoice
- business phone: from Company Settings

The sender name at the top of the chat is the client's own WhatsApp display name, e.g. "E6 Car Spa – Salem".

The `_v1` templates already built say "Total amount" and have no phone line. `_v2` is the proposed wording (Q2).

**Lifecycle**

| Step | How |
|---|---|
| Create | **Today:** "Create standard templates" button in the client's Settings → WhatsApp (built). **SaaS:** automatic right after the client connects WhatsApp. |
| Approval | Meta reviews each template, usually within minutes, at most about a day. The status is shown in the app. |
| Switch on | **Today:** "Use approved templates" button (built). **SaaS:** automatic once both are approved. |
| Rejected | The app shows Meta's reason; Trovo fixes the wording and releases a new version. |
| Change wording | Trovo releases `_v3` etc. through a software update; the app creates it on every client's account and switches over after approval. **Approved templates are never edited in place**, so messages never stop during a change. |

### 4.3 Client-specific wording (optional)
1. The client asks for different wording, e.g. C4 Detailers' thank-you.
2. Trovo reviews it: utility only, names the business, no offers, the right fields.
3. Trovo creates it on **that client's** WhatsApp account and assigns it to that client. The other clients are unaffected.
4. Available fields: customer name, invoice number, vehicle, amount due, amount paid, balance, business name, business phone.

A later option is an in-app wording editor, where clients write and Trovo approves before it's submitted (section 12).

### 4.4 Franchise networks
- E6 can choose a **network wording**, which Trovo creates on each participating franchisee's own account.
- Franchisees can opt in (Q5).

---

## 5. When messages are sent

| Trigger | Rule (matches today's behaviour) |
|---|---|
| Invoice generated | Once, when the invoice leaves draft, if WhatsApp is on, the customer has a valid number and has consented |
| Fully paid | Once, when the balance reaches zero. Partial payments send nothing. |
| Invoice number edited later | No automatic resend; a manual "Resend updated invoice" button is possible later |
| Cancelled invoice | No message |

At most one message per (invoice, message type), already enforced in the database.

---

## 6. Franchise model

| | E6 main | E6 franchisee | Independent client (e.g. C4) |
|---|---|---|---|
| Organization / subscription | Own | Own | Own |
| WhatsApp number and Meta account | Own ("E6 Car Spa") | Own (e.g. "E6 Car Spa – Salem", with E6's permission for the brand) | Own |
| Pays Meta | E6 | Franchisee | Client |
| Wording | Standard or own | Standard or E6 network wording | Standard or own |

- **E6 sees summaries only:** messages sent, delivered and failed per franchise. Never their customers or message contents.
- **A franchisee leaving the network** keeps its number and Meta account.

---

## 7. Client onboarding

**Full client checklist:** `docs/WHATSAPP_CLIENT_ONBOARDING_CHECKLIST.md`.

| | **Today (software on the client's PC)** | **SaaS (cloud version)** |
|---|---|---|
| How the account is connected | The client generates a **system-user access token** in **their own** Meta business settings (with Trovo guiding), and it's typed into **their** Car Spa settings with the phone number ID, account ID and App ID | **"Connect WhatsApp" button:** the client logs in to Meta themselves (Embedded Signup); Trovo's server receives access automatically |
| Templates | "Create standard templates" → "Use approved templates" | Automatic |
| Why the difference | "Connect WhatsApp" needs a Trovo server to receive access securely, and Trovo's app secret must never be on client PCs | — |
| Moving from today to SaaS | — | The client clicks "Connect WhatsApp" with the **same number**. Customers notice nothing. |

In both cases:
- Trovo never holds the client's Facebook login.
- Business verification is optional to start: unverified accounts can message about 250 customers a day.

---

## 8. Consent and compliance
- **Opt-in:** send only to customers marked **"Send WhatsApp updates"**, recording who ticked it and when.
- **Opt-out:** unticking stops future messages.
- **Data minimisation** (India DPDP Act):
  - only the needed details in messages
  - the PDF only to the invoice's own customer
  - franchisors see aggregates only
- **Audit:** WhatsApp on/off, template creation and switching, consent changes, and every send or failure are logged. Template audit is already built.

---

## 9. Technical design (SaaS)

| Table | Key fields | Notes |
|---|---|---|
| `WhatsAppConfiguration` (per organization, optional per branch) | WABA ID, phone number ID, encrypted token, enabled flags, health, quality rating | Replaces today's single configuration row |
| `WhatsAppTemplateAssignment` | organization, message type, template name, language, **ordered field keys**, status | Standard or client-specific wording (section 4) |
| `WhatsAppMessage` (exists) | + organization, branch, pricing category reported by Meta | Per-organization history |
| `WhatsAppUsageMonthly` | organization, branch, month, sent, delivered, failed | Franchisor summaries, support |
| `Customer` | + consent flag, time, by whom | Section 8 |

**Sending pipeline**
1. A trigger queues a message with a snapshot of the values.
2. The worker resolves the organization's configuration and template.
3. It sends with **that organization's** token.
4. Processing is fair per organization, so one busy client can't delay others.

**Templates**
- **Reuse** `WhatsAppTemplateProvisioningService` (built).
- In SaaS it runs per organization against the organization's own account, automatically after "Connect WhatsApp".

**Embedded Signup**
1. The Trovo web page opens Meta's signup window with Trovo's configuration.
2. Trovo's server exchanges the returned code for the client's access token, using Trovo's app secret **on the server only**.
3. It stores the account and number IDs and the encrypted token, then provisions the templates.

**Webhooks**
- One HTTPS endpoint for all clients.
- Messages are matched to the organization by phone number ID or account ID.
- It handles message status, template approvals, quality-rating changes and account updates.

**Security**
- Per-organization encryption keys, with the master key outside the database.
- Tokens are never returned or logged (already enforced and tested).

---

## 10. What already exists (built and tested)

Branch `feature/whatsapp-managed-templates` (not yet merged; details in `WHATSAPP_MANAGED_TEMPLATES_CHANGES.md`):
- Standard template pack `_v1`, with a fixed field order.
- One-click creation on a WhatsApp account, including the sample-PDF upload. Tested live on 6 October 2026: both templates submitted and in review at Meta.
- Status display, and "Use approved templates", which only works after approval.
- Audit; tokens never exposed. 16 backend and 5 desktop tests.

The current app already sends both messages, with queue, retries and duplicate protection.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Client's access token expires or is revoked | Health check in the app plus an alert to Trovo support; reconnect (SaaS) or a new token (today) |
| Template rejected | Reason shown; Trovo releases a corrected version |
| Client's number quality drops (customers block or report) | Utility-only wording, consent required; quality shown and alerted (SaaS webhooks) |
| Display name rejected (e.g. franchisee using the E6 brand) | Agree names early; E6's written permission |
| Client finds Meta setup hard | Assisted session with checklist; Trovo guides on screen-share |
| No hosted version yet | Interim manual connection (section 7) until SaaS |

---

## 12. Later
| Feature | Notes |
|---|---|
| Payment link (UPI "Pay now" button) | New template version; needs a public invoice address (SaaS) |
| UPI QR code | Printed inside the invoice PDF; no Meta approval needed |
| More messages (e.g. "vehicle ready") | New trigger plus a new template in the pack |
| In-app wording editor | Client writes, Trovo approves before submitting |
| "Resend updated invoice" | Manual button |

---

## 13. Build order

| Phase | Work | Depends on |
|---|---|---|
| 0 | Finish the live test and merge the managed-template branch; Meta app review and Tech Provider steps | — |
| 0b | `_v2` wording (amount due + phone line), if approved (Q2) | — |
| 1 | Per-organization WhatsApp settings, consent field, usage counts | SaaS tenant foundation |
| 2 | "Connect WhatsApp" (Embedded Signup) + automatic templates | Hosting; Tech Provider approval |
| 3 | Webhooks (status, quality, template updates) | Hosting |
| 4 | Client-specific wording, E6 network wording, franchisor summaries | Phases 1–3; franchise relationships |

---

## 14. Questions for the reviewer

| # | Question | Proposed answer |
|---|---|---|
| Q1 | Is "Amount due" the **balance** when the invoice is generated (advance deducted) or the **total**? | Balance |
| Q2 | Approve the `_v2` wording in section 4.2 (amount due + "call us on {phone}")? | Yes |
| Q3 | Should existing customers be opted in by default, or only after staff ask? | Only after staff ask |
| Q4 | Does E6 main keep its current number and Meta account? | Yes |
| Q5 | E6 network wording: required for franchisees, or offered? | Offered |
| Q6 | How long is per-message history kept? | 24 months, then summary only |
| Q7 | WhatsApp only on Professional, or also on Starter? | Professional (see pricing §3a) |
