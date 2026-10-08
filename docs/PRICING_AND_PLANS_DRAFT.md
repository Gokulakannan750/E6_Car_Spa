# Trovo Car Spa Software — Pricing & Plans (DRAFT v0.1)

**Status:** draft for discussion (6 Oct 2026). Prices are proposals to test with E6 and two or three prospects. They are not final.
All prices are in INR and **exclude 18% GST**.

---

## 1. How clients pay and what they get

```text
Client (car spa / franchisee)
  └─ Subscription  →  Plan (Starter / Professional / Franchise Network) + add-ons
        └─ Entitlements: which modules are switched on for that business
              └─ Users & roles (RBAC): what each staff member may do inside those modules
```

- **Subscription = what the business bought** (modules, branches, limits).
- **Roles and permissions = what each user may do.** The two are kept separate, as `E6_RBAC_PERMISSIONS_AUDIT.md` recommends.
- **Billing is per branch (outlet).** A franchisee with one outlet pays for one branch.
- **WhatsApp message charges are paid by the client to Meta directly**, from a card on their own WhatsApp account. Trovo doesn't resell messages.

---

## 2. Plans

| | **Starter** | **Professional** | **Franchise Network** (franchisor add-on) |
|---|---|---|---|
| Intended for | Small single-outlet spa | Growing spa; most clients | Brand owners giving franchises (e.g. E6) |
| Customers & vehicles | ✅ | ✅ | — (included in the franchisor's own plan) |
| Job cards & service catalogue | ✅ | ✅ | |
| GST & non-GST invoices, payments, PDF, print | ✅ | ✅ | |
| Public invoice link | ✅ | ✅ | |
| Outside jobs & vendors | — | ✅ | |
| Staff directory & attendance | ✅ | ✅ | |
| Staff advances & salary settlement | — | ✅ | |
| **WhatsApp automation** (invoice + payment messages, own number via Connect WhatsApp) | — | ✅ | |
| Reports | Basic (sales, payments, outstanding) | All, plus Excel export | Network summary reports |
| Users included | 3 | 10 | — |
| Audit trail | — | ✅ | |
| Own logo and business details on invoices | ✅ | ✅ | ✅ |
| Windows + Android apps | ✅ | ✅ | ✅ |
| Franchisee invitations, consent-based sharing | — | — | ✅ |
| Franchisor dashboard (revenue, jobs and services per franchise; aggregates only) | — | — | ✅ |
| Shared service templates for franchisees | — | — | ✅ (later phase) |

**Add-ons**

| Add-on | For | Notes |
|---|---|---|
| **Showroom / B2B module** | Spas that deploy staff to dealership showrooms | Showrooms, attendance, vehicle work, daily bills, receivables |
| Extra users | Any plan | Per 5 users |
| Extra branch | Any plan | Billed at the plan's per-branch price |

---

## 3. Proposed prices (draft)

| Item | Monthly | Yearly (2 months free) |
|---|---|---|
| Starter, per branch | ₹999 | ₹9,990 |
| Professional, per branch | ₹1,999 | ₹19,990 |
| Showroom / B2B add-on, per branch | ₹999 | ₹9,990 |
| Extra 5 users | ₹299 | ₹2,990 |
| **Franchise Network** (franchisor fee, covers up to 10 franchise branches) | ₹2,999 | ₹29,990 |
| Each additional 10 franchise branches in the network | ₹1,499 | ₹14,990 |
| **One-time onboarding** per business: setup, data import, WhatsApp connection, training | ₹4,999 | — |

**Franchisee pricing:**
- Each franchisee has **its own subscription**, usually Professional.
- A **network discount** of 20% off the plan price makes joining a franchise network cheaper. The franchisor recovers it through the network fee.
- If a franchisor wants to pay for its franchisees, only the billing account changes. No data moves.

**Example: E6 with 3 franchisees**

| Party | Plan | Monthly (excl. GST) |
|---|---|---|
| E6 (1 branch, Professional + Showroom) | ₹1,999 + ₹999 | ₹2,998 |
| E6 Franchise Network fee | | ₹2,999 |
| 3 franchisees × Professional at 20% network discount | 3 × ₹1,599 | ₹4,797 |
| **Total recurring revenue for Trovo** | | **₹10,794 / month** |

---

## 3a. WhatsApp pricing (every client uses its own number)

See `docs/WHATSAPP_SAAS_DESIGN.md` v0.2. Each client has its own WhatsApp number in its own Meta business account. **Meta bills the client directly for messages**, so Trovo charges only for the software and setup, never per message.

| Item | Price (excl. 18% GST) | Notes |
|---|---|---|
| WhatsApp automation (invoice + payment messages, standard templates, status, support) | **Included in Professional** | Starter: not included (Q7 in the design document) |
| One-time WhatsApp setup (assisted session: Meta business, number, display name, templates, test) | **₹2,499**, or included in the ₹4,999 onboarding for new clients | Waived for yearly plans? (to decide) |
| Client-specific wording (Trovo reviews, creates, maintains) | **₹499 per template**, one-time | Optional |
| Later: "WhatsApp Pro" add-on (delivery reports, per-outlet numbers, resend invoice) | ₹199/month | Only once those features exist |
| Message charges | **Paid to Meta by the client** | About ₹0.12–0.15 per utility message; confirm on Meta's India rate card |

**Comparison (spa with 300 invoices/month ≈ 600 messages, first year)**

| | 2Factor Basic (WhatsApp platform) | Trovo, own number |
|---|---|---|
| Setup | ₹3,500 | ₹2,499 (or in onboarding) |
| Monthly WhatsApp fee | ₹999 × 12 = ₹11,988 | ₹0 (in Professional) |
| Messages | ₹0.20 × 7,200 = ₹1,440 (2Factor's rate) | ≈ ₹940, paid to Meta (at ~₹0.13) |
| **WhatsApp cost to the client** | **≈ ₹16,900** | **≈ ₹3,400** |
| Wired to invoices and payments | No; needs integration | Yes, built in |

Trovo's prices sit on top of the Professional plan, which the client pays for the billing software anyway. 2Factor figures are from 2Factor's published price list (7 Oct 2026).

**Why Trovo doesn't charge per message:**
- As a Meta **Tech Provider**, Trovo connects clients' own accounts, and Meta bills each client directly.
- Reselling messages with a markup (as 2Factor does) needs Meta **Solution Partner** status, or a partnership with one. That's possible later, not needed now.

---

## 4. Subscription rules

| Topic | Proposal |
|---|---|
| Trial | 14 days, Professional features, no card needed |
| Billing cycle | Monthly or yearly, in advance |
| Payment methods | **Phase 1:** UPI or bank transfer, marked as paid by Trovo in the admin screen. **Later:** automatic recurring billing through a payment gateway (e.g. Razorpay Subscriptions) |
| Trovo's invoice | GST invoice from Trovo Tech Solutions to the client every billing period |
| Due date and grace | Due on the renewal date. **7-day grace period**, during which everything still works with a banner |
| Suspended | After grace, **read-only**: view, print and export allowed; no new job cards, invoices or payments |
| Cancelled | Data kept **90 days** for export, then deleted; client can download a full export (Excel/CSV + invoice PDFs) |
| Upgrades | Immediate, charged pro-rata. Downgrades take effect at the next renewal |
| Refunds | Yearly plans: pro-rata refund within the first 30 days; afterwards none |
| WhatsApp | Client's own Meta account and card; Trovo's fee covers the software only |

---

## 5. Hosting (Trovo's cost)

**Architecture for the first version:** one Linux VPS running the .NET API, PostgreSQL and Nginx (HTTPS with free Let's Encrypt), plus a small staging server and off-site backups.

### Shortlist

| Provider | Plan | Specs | Price | Notes |
|---|---|---|---|---|
| **Hostinger** | **KVM 4** | 4 vCPU, 16 GB RAM, 200 GB NVMe | **₹1,099/mo intro → ₹2,399/mo renewal** | Weekly backups + 1 snapshot included; root access. Choose an India location if offered at checkout |
| Hostinger | KVM 2 (staging) | smaller | check at checkout | Enough for staging/testing |
| **MilesWeb** | Cloud VPS SM-L3 | 4 vCPU, 16 GB RAM, 200 GB NVMe | ₹699/mo promo (renews higher) | Indian company; confirm renewal price and India data centre |
| MilesWeb | Cloud VPS SM-L2 | 2 vCPU, 8 GB RAM, 100 GB NVMe | ₹499/mo promo | Good staging option |
| **Navo Hosting** (Erode) | Linux VPS Advanced | 8 GB RAM, 250 GB | ₹3,999/mo or ₹34,000/yr | Local, in-person support. Plan is cPanel-oriented: **confirm full root access and Docker/.NET support** before choosing |

**Also worth comparing** (prices not checked here):
- DigitalOcean (Bangalore)
- AWS Lightsail (Mumbai)
- E2E Networks (Indian provider)

These offer more mature backups, snapshots and scaling.

### Recommendation
- **Production:** Hostinger **KVM 4**. Budget at the **renewal price, ₹2,399/mo**, not the intro price.
- **Staging:** MilesWeb SM-L2 or Hostinger KVM 2.
- **Backups:**
  - Nightly PostgreSQL dumps plus the uploaded logos, copied **off the server** to object storage or a second provider.
  - Keep 30 days.
  - Test a restore every month.
- **Capacity (estimate; confirm with a load test):** a car spa creates tens of job cards a day, so one KVM 4 should comfortably serve the first **50–100 branches**. Scale up, or split the database onto its own server, after that.

### Monthly running cost (estimate)

| Item | ₹/month |
|---|---|
| Production VPS (KVM 4, renewal price) | 2,399 |
| Staging VPS | ~500 |
| Off-site backup storage | ~300 |
| Domain + business email (`trovotechsolutions.in`) | ~300 |
| **Total** | **≈ ₹3,500** |

**Break-even:** about **2 Professional branches**. Payment-gateway fees (typically around 2% per transaction; confirm with the gateway) apply once automated billing starts.

---

## 6. Entitlement codes (for the subscription engine)

Module switches only. Permissions stay in RBAC.

| Code | Unlocks | Starter | Professional | Network |
|---|---|---|---|---|
| `billing` | Customers, vehicles, job cards, catalogue, invoices, payments | ✅ | ✅ | — |
| `outside_jobs` | Outside jobs, vendors | — | ✅ | — |
| `staff` | Staff directory, attendance | ✅ | ✅ | — |
| `staff_finance` | Advances, salary settlement | — | ✅ | — |
| `whatsapp` | WhatsApp connection and automation | — | ✅ | — |
| `reports_basic` / `reports_full` | Report sets and export | basic | full | — |
| `audit` | Audit trail | — | ✅ | — |
| `showroom` | Showroom / B2B module | add-on | add-on | — |
| `franchise_network` | Invitations, network dashboard | — | — | ✅ |
| Limits | `max_users`, `max_branches` | 3 / 1 | 10 / per purchase | franchise branches per tier |

---

## 7. To validate before launch
1. Show the plan table and prices to E6 and two or three other spas. Are the price points acceptable for Erode and Tamil Nadu?
2. Is WhatsApp worth keeping out of Starter? Each client pays Meta for its own messages, so Trovo has no message cost either way (§3a).
3. Should Showroom/B2B be an add-on (proposed) or part of Professional?
4. Onboarding fee: charge it, or waive it for yearly plans?
5. Ask Trovo's accountant: GST on subscriptions (SAC code, place of supply) and the invoice format.
6. Confirm hosting renewal prices and the India data-centre location in writing before buying.
