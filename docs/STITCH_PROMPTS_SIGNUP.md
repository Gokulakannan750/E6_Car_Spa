# Google Stitch prompts — Trovo customer sign-up and buy website

The public website where a car spa business chooses a plan, user licences and add-ons, pays (or starts the free trial),
and receives the two codes it needs to register in the Windows or Android app.

How to use:
1. Start a new Stitch project. Choose **Web**.
2. Paste **Prompt 0** first. It sets the style and the page frame.
3. Then paste the screen prompts **one at a time** (Prompts 1–7) in the same project, so every screen keeps the same style.
4. Customers will often use a **phone**. After the desktop screens look right, ask Stitch for **mobile versions of
   Prompts 2, 3, 4 and 6** ("make a 390px-wide mobile version of this screen").
5. When a screen looks right, keep it. For small fixes ask, e.g. "make the summary sticky", "bigger Pay button".
6. Export the project as a ZIP (HTML + screenshots) and put it in `design/stitch-signup/`. I build the real site from it.

All names, numbers and codes below are **sample data for the design only**. Prices are the current placeholders; the
real ones come from Plans & Prices in the admin portal.

Please keep these rules (so the design matches what we build):
- Seller name is **"Trovo Tech Solutions"** (never "Private Limited").
- **No GST** is charged yet: show "No GST charged", never "GST 18%".
- **Do not add** things we are not building now: customer login/password on this website, saved cards, autopay,
  coupons/promo codes, live chat, testimonials with fake names, "trusted by 500+ businesses" numbers.

---

## Prompt 0 — Style and page frame (paste first)

```
Design a public website called "Trovo" where car spa and car detailing businesses in India buy a subscription to Trovo's car spa management software (billing, job cards, invoices, staff, showroom, franchise; Windows and Android apps). It must feel trustworthy, simple and quick: a business owner should finish signing up in under 3 minutes, often on a phone.

Visual style (dark, matching the brand website trovotechsolutions.in and the Trovo admin portal):
- Page background #09090B. Cards #18181B, alternate surface #111113, borders 1px rgba(255,255,255,0.08).
- Text #E4E4E7, secondary #A1A1AA, headings #FFFFFF.
- Primary action blue #3B82F6 (hover #2563EB). Success green #34D399. Warning amber #FBBF24. Error #F87171.
- Brand gradient for the logo mark and the single main button on each screen: linear-gradient(135deg, #2563EB 0%, #EF4444 100%).
- Font Inter. Rounded corners 12px for cards, 8px for inputs and buttons. Generous spacing, large tap targets (44px), clear labels above inputs, helpful error messages under fields.
- WCAG AA contrast.

Page frame for every screen (desktop 1440px, centred content max 1120px):
- Top bar: Trovo logo mark (gradient) with "Trovo" and the subtitle "Car Spa Management"; on the right a text link "Already registered? Download the app" and a "Contact" link (phone +91 90426 72148).
- Sign-up screens (Prompts 2–4) show a 3-step progress indicator under the top bar: 1 Your business · 2 Plan & users · 3 Review & pay.
- Footer: "© 2026 Trovo Tech Solutions · Erode, Tamil Nadu", links Terms, Privacy policy, Refund policy, Contact, and "info@trovotechsolutions.in".

Money in Indian rupees with ₹ and Indian digit grouping (₹14,980). Dates like "20 Oct 2026".

Start with the Pricing page (described next).
```

## Prompt 1 — Pricing page

```
Create the Pricing page.

Hero: heading "Run your car spa on Trovo", sub-line "Billing, job cards, invoices, staff and WhatsApp in one place — on Windows and Android. Start with a 7-day free trial." Two buttons: "Start free trial" (gradient) and "See plans" (outline).

A Monthly / Yearly toggle with the note "Yearly: 2 months free".

Explain the price model in one short line above the plans: "You pay per user. Each user needs a licence for the Android app, the Windows app, or both."

Two plan cards side by side:
1) Starter — "For washing and detailing centres". A small price table per user per month: Windows + Android ₹999 · Windows only ₹699 · Android only ₹499. Includes: customers & vehicles, job cards, GST and cash invoices, payments, staff and attendance, basic reports, Excel/CSV export. Button "Choose Starter".
2) Professional (badge "Most popular") — "For full detailing studios". Per user per month: Windows + Android ₹1,499 · Windows only ₹1,199 · Android only ₹799. Everything in Starter plus: WhatsApp invoice & payment messages, outside jobs & vendors, staff advances & salary, advanced reports (GST, productivity, margins), audit trail. Button "Choose Professional".

Below: "Add-ons" as compact cards with monthly price: Showroom / B2B dealership module ₹999 · Franchise network (up to 10 franchise branches) ₹2,999 · 10 more franchise branches ₹1,499. A line: "On Starter you can also add any Professional module for ₹299 each: WhatsApp, Outside jobs, Staff advances & salary, Advanced reports, Audit trail."

A comparison table (Starter vs Professional) with ticks for the modules listed above.

A short FAQ (4 items, collapsed): "What is a user licence?" (one person; a Windows + Android licence lets one person use both apps) · "What happens after the free trial?" (choose a plan; if unpaid, 7 days of grace, then read-only — your data is never deleted) · "Can I add users later?" (yes, contact Trovo or buy more) · "Is GST charged?" (No GST is charged at present).
```

## Prompt 2 — Step 1: Your business

```
Create sign-up step 1 "Your business" (progress indicator on step 1).

A single card with the heading "Tell us about your business" and these fields:
- Business name * (placeholder "Sunrise Detailing") — hint "Shown on your invoices. You can change it later."
- Your name * ("Arun Kumar")
- Mobile number * with +91 prefix ("98765 43210")
- Email * ("arun@sunrisedetailing.in") — hint "We send your invoices and receipts here."
- City * ("Erode") and State * (dropdown, "Tamil Nadu")
- GSTIN (optional) ("33ABCDE1234F1Z5") — hint "Only if you want it on Trovo's invoices to you."

Show one field in an error state as an example: mobile number "Enter a 10-digit mobile number."

Buttons: "Continue" (gradient, right) and a text link "Back to plans" (left).
Under the card a small reassurance line with a lock icon: "Your details are used only for your Trovo account and invoices."
```

## Prompt 3 — Step 2: Plan and users

```
Create sign-up step 2 "Plan & users" (progress indicator on step 2). Two columns: choices on the left (wide), a sticky order summary on the right.

Left column:
1) Billing: Monthly / Yearly segmented control (Yearly selected, note "2 months free").
2) Plan: two selectable cards, Starter and Professional (Professional selected), each showing "from ₹7,990 per user / year" and a one-line list of its modules.
3) User licences — heading with a one-line explanation "Each person who uses the software needs one licence. A Windows + Android licence lets one person use both apps. At least 1."
   Three rows, each with the licence name, price per user per year and a – [ 2 ] + stepper:
   - Windows + Android · ₹14,990 per user/yr · quantity 1
   - Windows only · ₹11,990 per user/yr · quantity 0
   - Android only · ₹7,990 per user/yr · quantity 2
   Under it a small line: "3 users in total. You decide later which person gets which licence."
4) Add-ons: rows with checkbox and price: Showroom / B2B module ₹9,990/yr (checked) · Franchise network ₹29,990/yr · and greyed rows "WhatsApp automation — included in Professional", "Outside jobs — included in Professional".

Right column (sticky summary card, title "Your order"):
- Professional · Yearly
- Windows + Android user licence 1 × ₹14,990 = ₹14,990
- Android only user licence 2 × ₹7,990 = ₹15,980
- Showroom / B2B module ₹9,990
- Divider, "Total per year ₹40,960" (large), "No GST charged".
- Two buttons stacked: "Continue to payment" (gradient) and "Start 7-day free trial instead" (outline) with the hint "Full Professional for 7 days with 3 users. No payment now."

Also show, inside the summary, an example of a helpful hint box (green): "Tip: Professional includes these modules and would cost less than Starter with these add-ons."
```

## Prompt 4 — Step 3: Review and pay

```
Create sign-up step 3 "Review & pay" (progress indicator on step 3).

Left (wide):
- "Your business" summary card: Sunrise Detailing · Arun Kumar · +91 98765 43210 · arun@sunrisedetailing.in · Erode, Tamil Nadu — with an "Edit" link.
- "Your plan" summary card: Professional · Yearly · 3 user licences (1 Windows + Android, 2 Android only) · Showroom / B2B module — with an "Edit" link.
- A checkbox: "I agree to the Terms and the Refund policy" (links).

Right (sticky):
- "Amount to pay" card: Total ₹40,960 for 1 year (20 Oct 2026 – 19 Oct 2027), "No GST charged", "Billed by Trovo Tech Solutions".
- Big gradient button "Pay ₹40,960".
- Under it: "You'll get your company code and registration code right after payment."

Also design the TEST MODE variant of this screen: an amber banner across the top "Test mode — no real money is taken. Payment is simulated." and the button text "Pay ₹40,960 (test)".
```

## Prompt 5 — Payment in progress and payment failed

```
Create two small states for the payment step, as centred cards on the same page frame:

1) Processing: a spinner, "Confirming your payment…", sub-line "Please don't close this page. This usually takes a few seconds."

2) Failed: a red alert icon, "Payment didn't go through", the reason line "Your bank declined the payment." (sample), and two buttons "Try again" (gradient) and "Change plan" (outline). A help line "Money taken but this page failed? Call +91 90426 72148 with your mobile number — we'll sort it out."
```

## Prompt 6 — Success: your company is ready

```
Create the success page shown after payment.

A large green check, heading "Sunrise Detailing is ready", sub-line "Paid ₹40,960 · Professional · Yearly · valid until 19 Oct 2027".

A highlighted card "Your codes — save them now" with two large monospaced values, each with a Copy button:
- Company code: 0007
- One-time registration code: K7QM-4RTX-9PWD
A warning line: "The registration code works once and expires on 3 Nov 2026. Keep it private."

"What to do next" as 3 numbered steps with icons:
1. Install the app — two buttons "Download for Windows" and "Get it on Android".
2. Open the app and choose "Register your company", then enter the company code and the registration code.
3. Create your owner username and password. Then add your staff and give each one a licence (Windows + Android, Windows or Android).

Secondary buttons: "Download invoice" (outline) and "Print this page".
A small line at the bottom: "Need help? Call +91 90426 72148 or email info@trovotechsolutions.in."
```

## Prompt 7 — Success: free trial started

```
Create the variant of the success page for the free trial.

Heading "Your 7-day free trial has started", sub-line "Full Professional with 3 users until 27 Oct 2026. No payment taken."
Same "Your codes — save them now" card (company code 0008, registration code H3TB-8KWQ-2MZD, Copy buttons) and the same 3 "What to do next" steps.
An info box (blue): "Before the trial ends, choose a plan and pay. If you don't, you get 7 more days to pay, then the software becomes read-only. Your data is never deleted."
Button "See plans and prices" (outline).
```

---

Later (not needed now): an email-verification step ("Enter the 6-digit code we sent to arun@…") will be added in
Phase 2.6 once Trovo's sending email is set up, and the real gateway's payment screen replaces the test payment in
Phase 2.5. The rest of the design stays the same.
