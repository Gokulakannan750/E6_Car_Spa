# Public sign-up API (for the customer sign-up website)

Server side for the public website where a business picks a plan, user licences and add-ons, pays (or starts the free
trial) and gets its company code + registration code. Built 13 Oct 2026 on branch `feature/saas-user-licences`. The
website screens come from the Stitch designs (`docs/STITCH_PROMPTS_SIGNUP.md`); the website is `apps/signup-web`.

Code: `Controllers/Platform/PublicSignupController.cs`, `Infrastructure/Platform/SignupService.cs`,
`Infrastructure/Platform/PriceQuoteService.cs`, table `SignupOrders` (catalog). Tests: `PlatformSignupHttpTests.cs`.

## Switches (server configuration)

| Setting | Default | Meaning |
|---|---|---|
| `Platform:SignupEnabled` | false | The public endpoints answer only when true (404 otherwise). |
| `Platform:TestPayments` | false | Allows the "Pay (test)" endpoint. **Always refused in the Production environment**, whatever this says. |
| `Platform:SignupOrigin` | — | The website's address, allowed by CORS (like `Platform:AdminPortalOrigin`). |
| `Platform:SignupOrderHours` | 24 | How long an unpaid order can still be paid. |

Rate limits per IP address: placing orders and paying `public-signup` (10 per 10 minutes); reading prices and quotes
`public-read` (60 per minute).

## Endpoints (anonymous)

### `GET /api/public/catalog`
Plans on sale with their current monthly/yearly prices per licence type (`androidUserPriceMinor`,
`windowsUserPriceMinor`, `bothUserPriceMinor`, `companyFeeMinor`), minimum licences and included modules (feature
keys); add-ons on sale (`code`, `name`, `featureKey`, `isPack`, `perUnit`, monthly/yearly price); `trialDays`,
`trialLicences`, `graceDays`; `chargesGst`; `testPayments` (show the test-mode banner when true); seller name, phone,
email. Money is in paise.

### `POST /api/public/signup/quote`
```json
{ "planCode": "starter", "interval": "Year", "licences": { "android": 2, "windows": 0, "both": 1 }, "addOns": { "outside_jobs": 1 } }
```
Returns the price worked out by the server: `lines` (description, quantity, unitPriceMinor, amountMinor),
`subtotalMinor`, `taxMinor`, `totalMinor`, and `cheaper` (another plan that would cost less with the same licences,
or null). 400 with `{ "error": "…" }` for: unknown or stopped plan/add-on, fewer licences than the plan's minimum,
a module the plan already includes, a module added twice.

### `POST /api/public/signup`
```json
{
  "business": { "name": "Sunrise Detailing", "ownerName": "Arun Kumar", "mobile": "+91 98765 43210",
                "email": "arun@sunrise.in", "city": "Erode", "state": "Tamil Nadu", "gstin": null },
  "startTrial": false,
  "plan": { "planCode": "starter", "interval": "Year", "licences": { "android": 2, "windows": 0, "both": 1 }, "addOns": { "outside_jobs": 1 } },
  "acceptTerms": true
}
```
- **Free trial** (`startTrial: true`, no `plan`): the company is created at once. 201 with `status: "Completed"`,
  `companyCode`, `registrationCode` (shown **only here**), `registrationCodeExpiresAt`, `trialEndsAt`. One trial per
  email and per mobile number (409 otherwise).
- **Paid** (`startTrial: false` with `plan`): 201 with `status: "AwaitingPayment"`, `orderId`, `orderToken` (keep it in
  the browser; it is needed to pay and to read the order), `amountMinor` (fixed now), `quote`, `expiresAt`,
  `testPayments`. **No company exists yet.**
- 400 messages for the fields (shown under the inputs): business name, your name, "Enter a 10-digit mobile number.",
  email, city, state, GSTIN format, "Please accept the Terms and the Refund policy."

### `POST /api/public/signup/{orderId}/test-payment` — test servers only
Body `{ "token": "<orderToken>" }`. Completes the order as if paid: creates the company with the chosen plan, licences
and add-ons for one period from now, fills its billing account from the business details, issues the first invoice
and records the payment against it (provider `Test`). 200 with `companyCode`, `registrationCode` (shown only here),
`paidUntil`, `invoiceNumber`. 404 for a wrong token or when test payments are off; 409 when already paid or expired.

### `POST /api/public/signup/{orderId}/status`
Body `{ "token": "<orderToken>" }`. The order's state for a page reload: `status`, `companyCode` once created, the
quote. The registration code is **never** returned again (if the customer lost it, Trovo issues a new one in the
admin portal).

## What happens behind it

- Prices always come from the server (`PriceQuoteService`), using the same rules as the first invoice.
- A paid order is claimed atomically before the company is created, so two payment calls cannot create two companies.
- If the payment arrived but creating the company failed, the order becomes `NeedsAttention` and shows in the admin
  portal's **Sign-ups** page with the reason; Trovo creates the company by hand and calls the customer.
- Every completed sign-up is in the platform audit log (`signup.trial_started`, `signup.paid`).
- The payment gateway (Phase 2.5) will call `SignupService.CompletePaidAsync(order, provider, reference, amount)` from
  its verified webhook instead of the test payment; nothing else changes.

## Not built yet

Email verification and emails (Phase
2.6), the real payment gateway (Phase 2.5).
