# Baylior product page and customer sign-up plan

Location: this plan lives in the app repository (`docs/SIGNUP_PLAN.md`), moved here from the website folder on
14 Oct 2026. Website work (product menu, Baylior page, home band) is done in the website repository `E:\TTS\Projects\Websites\TrovoTech_Solutions`;
sign-up app work is done here in `apps/signup-web`. "The app repository" below means this repository.

Status: proposed; planning only. Branches: `singup-phase1` here, `sign-up-plan` in the website repository. Updated
14 Oct 2026 (after the Baylior branding was merged
into the app repository's `main`).

## Goal

Visitors to trovotechsolutions.in discover **Baylior**, Trovo Tech Solutions' business software for car wash and
detailing businesses, understand what it does, and sign up through the existing sign-up application.

- **Baylior** — Business Suite. Tagline: **One suite. Every detail.** A product of Trovo Tech Solutions.
- **E6 Car Spa is a customer**, not the product. E6 stays in the Portfolio as a delivered project. It may say it
  runs on Baylior and link to the product page, but only with E6's agreement.
- **Model:** Zoho's product journey. Products open from the top menu, and each product has a dedicated landing page
  with Sign Up calls to action. References:
  - <https://www.zoho.com/crm/crmplus/?src=zGlobalAllProducts> (landing page)
  - Zoho's Products menu (discovery)

  Apply the patterns with Trovo/Baylior branding and original copy, not copied text or layout details.

## One product now: how this differs from Zoho

Zoho has hundreds of products, so its menu needs search, categories and a "Recent launches" grid. Trovo has one
product today, so:

- The **Products menu opens a single featured Baylior panel** instead of a catalogue. It shows the logo, tagline,
  one-line description, the main areas as quick links into the product page, and the Sign Up and View Pricing
  buttons.
- **No product directory page yet.** "Products" is a button that opens the panel; an **Explore Baylior** link
  inside the panel goes to the Baylior page. A `/products/`
  directory, categories and search come back when there is a second product (see "Growing to more products").
- The **Baylior page carries most of the weight**, like Zoho's product landing pages.

## Current setup

- Website: static HTML, shared CSS and JavaScript, Apache/LiteSpeed rules in `.htaccess`; no build step.
- Existing navigation: Home, About, Services, Portfolio, Contact.
- Sign-up application: `E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\apps\signup-web` (React, TypeScript, Vite).
  - **Already branded Baylior** (app repository `main`, 14 Oct 2026):
    - Baylior logo in the header and the browser tab icon
    - "Run your car spa on Baylior" with the tagline "One suite. Every detail."
    - the blue/cyan palette
    - page titles

    "Trovo" remains only where it is the company: billing, support and the footer. An earlier inspection saw the
    old "Trovo / Car Spa Management" header because the branding was still on a feature branch; it is now merged.
  - Routes:

    | Route | Page |
    |---|---|
    | `/` | Pricing |
    | `/signup` | "How are you joining?" (own car spa / franchise outlet / branch) and business details |
    | `/signup/plan` | Plan and users |
    | `/signup/review` | Review and pay |
    | `/signup/done` | Registration codes and downloads |

- **Brand files** are in the app repository's `design/brand` folder
  (`E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\design\brand`):

  | File | Use |
  |---|---|
  | `baylior-logo-original.webp` | The approved logo (glow version): hero, marketing, share image |
  | `baylior-mark.svg` | Flat "B" mark with the brand gradient: Products panel, small logo spots |
  | `baylior-icon.svg`, `baylior-app-icon-512.png` | Mark on a dark rounded square: icons, favicon |
  | `baylior-lockup-on-dark.svg`, `baylior-lockup-on-light.svg` | Mark + "Baylior / BUSINESS SUITE" side by side: headers |
  | `baylior-mark-mono-dark.svg`, `baylior-mark-mono-white.svg` | One colour: print and black-and-white use |
  | `README.md` | Colour guide and usage |

  Copy the files the website needs into the website repository (e.g. `assets/baylior/` in `E:\TTS\Projects\Websites\TrovoTech_Solutions`); do not link
  across repositories.
- Prices, plans, add-ons and trial length come from the API. Marketing pages must not show fixed prices.
- There is no web login. Owners use the company code and registration code from sign-up in the Windows or Android
  app. After that, the Owner manages the subscription inside the app.
- Existing uncommitted changes in the website repository (`E:\TTS\Projects\Websites\TrovoTech_Solutions`) were present before planning. Preserve them and
  review them separately.

## Customer journey

```
Website (any page) → Products ▾ → Baylior panel → Baylior page
   → Sign up free / View pricing → sign-up app → registration codes → install and register in the Windows/Android app
```

Header on every page, in the Zoho style:
- **Left:** Trovo logo · Products ▾ · Services · Portfolio · About · Contact.
- **Right:** "Get the app" (link) and **Sign up** (button).
- "Sign in" is replaced by **"Get the app"**: existing customers sign in inside the Baylior app, so a web "Sign in"
  would mislead. It opens the download section of the Baylior page. If a web customer area exists later, it becomes
  "Sign in".

## Website experience

### 1. Products menu (desktop panel, mobile expandable)

**Left column:** the Baylior logo, "One suite. Every detail.", a one-line description, and the **Sign up free**
and **View pricing** buttons, plus a clear **Explore Baylior** link to the landing page.

**Right column:** quick links to sections of the Baylior page, each with a small icon:

| Link | Covers |
|---|---|
| Billing and invoices | GST and cash invoices, payments |
| Job cards | Vehicle in, services, status, delivery |
| Customers and vehicles | Customer and vehicle records |
| Staff | Attendance, advances and salary |
| Reports | Standard and advanced reports |
| Franchise and showroom | Franchise network and dealer/showroom work |

**Footer of the panel:** "Built by Trovo Tech Solutions · More products coming".

**Behaviour:**
- Use a standard disclosure button with `aria-expanded` and `aria-controls`; open with Enter or Space and
  navigate links with Tab/Shift+Tab. Arrow-key navigation is optional for this disclosure.
- Escape and clicking outside close the panel.
- Return focus to the Products button when Escape closes the panel; closed panel links must not be focusable.
- Clear focus states.
- On mobile it is an expandable section with the same links.

### 2. Baylior landing page (`/products/baylior/`, the main page)

Sections, modelled on Zoho's product pages:

1. **Hero.**
   - Baylior logo, then the headline (e.g. "Run your car spa on one suite") and the tagline.
   - Buttons: **Sign up free** (primary), **View pricing**, and **Talk to us** (WhatsApp or phone).
   - The product mockup or real screenshots.
   - A small "Windows · Android" note.
2. **Sticky product bar** (like Zoho's sub-navigation): Overview · Features · How it works · Pricing · FAQ, with
   **Sign up** on the right.
3. **What it does**: feature blocks grounded in what the software actually does today.
   - Customers and vehicles; job cards from vehicle in to delivery; GST and cash invoices; payments.
   - Staff and attendance; standard reports and Excel/CSV exports.
   - Additional modules, labelled exactly as the catalogue sells them (checked 14 Oct 2026; re-check against the
     production catalogue at release, since Trovo can change plans in the admin portal):

     | Module | Starter | Professional | Label on the page |
     |---|---|---|---|
     | Outside jobs and vendors | Add-on | Included | "Professional, or add-on" |
     | Staff advances and salary | Add-on | Included | "Professional, or add-on" |
     | WhatsApp invoice and payment messages | Add-on | Included | "Professional, or add-on" |
     | Advanced reports | Add-on | Included | "Professional, or add-on" |
     | Audit trail | Add-on | Included | "Professional, or add-on" |
     | Showroom / B2B | Add-on | Add-on | "Add-on, any plan" |
     | Franchise network (extra branches in packs of 10) | Add-on | Add-on | "Add-on, any plan" |
4. **Windows and Android**: one licence per user — Windows, Android, or both. Explained without prices; link to
   the pricing page.
5. **How it works**, in three steps:
   1. Sign up with your business details.
   2. Choose a plan or start the free trial.
   3. Install the app and register with your codes.
6. **Built for car spas**: franchise networks, outside jobs, showroom/dealer work. Only real capabilities.
7. **Pricing teaser**: "Plans for every size", with a link to the live pricing page. No fixed numbers on this page.
8. **FAQ**: trial, licences, adding users later, payment, data and privacy, support.
9. **Closing call to action**: "Start your free trial" with Sign up free and Talk to us.
10. **Get the app**: Windows download and Play Store links once available. Until then, "Call Trovo for the
    installers", the same fallback the sign-up app uses.

**Rules for the page:**
- Trial wording is conditional: use "Sign up free" or "Start free trial" only after confirming a trial is
  available in the intended production API configuration (today: a 7-day trial of full Professional, set in the
  admin portal). Otherwise use "Sign up" or "View pricing".
  This rule applies to all menu, header, home page and landing page calls to action in this plan.
  Since the marketing site is static, confirm this at release and update the copy if availability changes;
  direct visitors to the signup app for current trial eligibility and duration.
- Use verified screenshots and claims only. No invented testimonials, customer counts or statistics.
- WhatsApp: describe the invoice and payment messages. Do not promise one-click WhatsApp connection until Meta
  approves the app.
- Colours: keep the Trovo site's layout, header and footer, but use **Baylior's own colours** inside the product
  menu and on the product page: blue `#2D6BFF` and cyan `#14C8F0`, magenta `#D63AF9` for small accents only, night
  `#0A0F1C` for dark areas (the "Baylior cyan" palette, `design/brand/README.md`). The sign-up site already uses
  it. Keep the existing Trovo palette on company pages.
- Add metadata, a canonical link, a sitemap entry, `SoftwareApplication` structured data (without prices) and a
  share image using the Baylior logo for WhatsApp and LinkedIn previews.

### 3. Home page and Portfolio

- Home: add a "Baylior" product band (logo, tagline, Learn more, Sign up free) near the top.
- Portfolio: the E6 Car Spa card stays a client project. With E6's agreement, add "Runs on Baylior →".

## Sign-up application changes (in the app repository)

- Baylior header, tagline, colours and page titles: **done** (merged 14 Oct 2026).
- A configurable **"← Baylior" link** in the sign-up header back to the product page (`VITE_PRODUCT_URL`). No URL
  is hard-coded.
- Check the wording matches the product page: Baylior is the product, Trovo is the company that bills and supports.
- No signup flow redesign is planned. Pricing, plans and the trial all come from the server.

## Hosting the sign-up app

Recommended: a dedicated subdomain. The domain is **to be decided later**. Options:
- `signup.trovotechsolutions.in`
- a Baylior domain such as `signup.baylior.in` or `get.baylior.in`, if Trovo registers one (check availability first)

Whichever is chosen:
- **Sign up** links to `https://<signup host>/signup`; **View pricing** links to `https://<signup host>/`.
- The sign-up source stays in its own repository, with its own build and release.
- **SPA fallback:** the host must serve `index.html` for app routes (e.g. `/signup/plan` on refresh) and real
  files normally. On Apache/LiteSpeed, add a rewrite rule in that host's `.htaccess`: if the request is not an
  existing file or folder, serve `/index.html`.
- A same-domain path (e.g. `/signup/` on the main site) needs a coordinated change of Vite's base path, the router's
  base name and the Apache fallback. Do not copy the current build into a sub-folder without those changes.

## Growing to more products (later)

When Trovo adds a second product:
- the Products menu becomes a small catalogue: categories plus product cards, still without Zoho's search until
  there are many products
- `/products/` becomes a directory page
- each product gets its own landing page in the same template
- the platform side is planned in the app repository's handoff, Step E (one admin portal and catalog for several
  products)

## Release dependencies

- **Decide the sign-up domain**, and whether Baylior gets its own domain.
- **Server set-up:**
  - production API address with HTTPS
  - `VITE_API_URL` and `VITE_PRODUCT_URL`
  - API `Platform:SignupEnabled`, plus the sign-up host in `Platform:SignupOrigin`
  - check the CSP
- **Payment:** online payment (gateway, Phase 2.5), or the existing "contact Trovo" fallback. Test payments belong
  on staging only.
- **Downloads:** Windows installer link (with code signing) and the Play Store listing, or keep the contact
  fallback.
- **Policy pages:** publish the Terms, Refund Policy and Privacy pages (Terms and Refund are drafted in the website repository,
  not yet uploaded; the refund rules need Trovo's confirmation and a review) and configure their URLs in the
  sign-up app.
- **Screenshots and copy:** approved real screenshots and product copy.
- **Catalogue check:** re-confirm module availability and production trial settings before publishing related
  claims (brand files and palette are settled; see "Current setup").

## Phased implementation after plan agreement

Each phase produces a reviewable result. Complete its checks before progressing to work that depends on it.
Local implementation can proceed before a production signup domain is chosen; publishing signup calls to
action requires a verified destination. Phases 2 and 3 stay in local preview until that integration is ready.

### Phase 1 — Confirm product content and assets

Progress, 14 October 2026: feature copy and all four retaken screenshots approved by the user; seven website brand assets copied and hash-verified. E6 endorsement omitted. See signup-phase1/REVIEW.md. Content/assets are ready for Phase 2 local preview. Production catalogue and trial verification remain unresolved release dependencies; retain neutral signup wording until verified.


- Brand files and colour guide: **ready** in the app repository's `design/brand` (see "Current setup"); copy
  the ones the website needs.
- Confirm the product name, tagline, screenshots and feature copy.
- Re-check module availability (table in the landing-page section) and trial wording against the production
  catalogue/configuration.
- Record E6's permission status; omit the "Runs on Baylior" endorsement if permission is unavailable.

**Deliverable:** confirmed content and asset list, with unresolved release settings recorded separately.
**Complete when:** every planned product claim has supporting evidence and usable brand assets are available.

### Phase 2 — Build the Baylior landing page

- Build `/products/baylior/` with the hero, product navigation, feature sections, platform/licence explanation,
  onboarding steps, pricing teaser, FAQ and downloads/contact fallback.
- Add metadata, canonical URL, structured data, share image and sitemap entry.
- Prepare configurable signup/pricing destinations for integration in Phase 5. Preview-only placeholders
  must be clearly identified and must not reach production.

**Deliverable:** a complete local product-page preview.
**Complete when:** desktop/mobile layout, content, anchors, accessibility and metadata have been reviewed.

### Phase 3 — Connect the company website

Phase 3 implementation prepared 14 October 2026 on signup-phase3 in the website repository: shared Products panels, header actions, footer links and home band are ready for local review. Source, DOM and browser checks (desktop, phone, keyboard) pass. See SIGNUP_PHASE3_STATUS.md. Phase 3 is complete as a local preview; the website's product presentation will be redesigned before upload.


- Add the accessible Products disclosure and Baylior panel to shared headers, plus footer product links.
- Add "Get the app", signup actions and the home page Baylior band.
- Keep E6 in Portfolio; add its Baylior link only if the agreed permission is recorded.
- Check nested-page asset paths and preserve existing website changes.

**Deliverable:** a navigable local website with the Baylior discovery journey.
**Complete when:** navigation works across existing and new pages on desktop/mobile, keyboard operation passes,
and existing page links and redirects remain correct.

### Phase 4 — Align the existing signup app

- Baylior branding, page titles and colours are **already done** (merged 14 Oct 2026); review the wording only.
- Add the configurable product-page return link (`VITE_PRODUCT_URL`).
- Preserve the existing business, plan, trial/payment and registration-code flow.
- Run the production build, unit tests and existing mocked browser tests.

**Deliverable:** a verified signup build matching the product page.
**Complete when:** branding and return links are correct and the relevant build/tests pass.

### Phase 5 — Configure hosting and verify integration

- Choose the signup host and configure staging HTTPS, SPA fallback, API URL, allowed origin and CSP.
- Configure policy links and download URLs, or the documented contact fallback.
- Confirm the available payment mode and use staging-only test payments for payment testing.
- Connect the website signup/pricing actions to the staging signup destination.
- Verify catalogue, quotes, trial eligibility, validation, payment-disabled behaviour, registration codes,
  return links and direct loading/refresh of every signup route. Use a throwaway catalogue for company creation.

**Deliverable:** a working staging journey from the company website through signup to application setup.
**Complete when:** integration checks pass and every release dependency has a confirmed production setting.

### Phase 6 — Release and check production

- Publish the required policy pages and deploy the verified signup build with production settings.
- Confirm signup availability before publishing the website's live signup/pricing links.
- Publish the Baylior page, site navigation and home page band; verify public URLs, redirects, share metadata,
  downloads/contact fallback and API catalogue access.
- Do not run company-creation or payment tests against real customer data. Retain the previous website and
  signup releases so they can be restored if production checks reveal a problem.

**Deliverable:** the live Baylior discovery and signup journey.
**Complete when:** public navigation and signup route checks pass, production payment configuration is verified,
and no unresolved release dependency remains.

## Suggested first milestone

Complete Phases 1–3 for a reviewable local website. Then complete Phases 4–5 for an integrated staging journey,
and Phase 6 for launch. This allows page design review before hosting and production setup are finished.

## Verification

- **Website:**
  - desktop and mobile Products menu with keyboard use, Escape and outside click
  - all product links and anchors
  - responsive layout, metadata, structured data and share previews
  - existing pages and redirects still working
- **Sign-up app:**
  - direct load and refresh of every route on the chosen host
  - unit tests, mocked browser tests and a production build
  - on staging: catalogue, quote, trial, payment-disabled state, validation messages, registration codes and
    download links
- **Live company creation:** only against a throwaway catalogue, as the sign-up README requires.

## Decisions

Decided:
- The product is **Baylior** (by Trovo Tech Solutions).
- Zoho-style journey adapted for one product: a Products panel, no directory yet, the Baylior page as the main
  page.
- E6 is a customer in the Portfolio.
- Brand files and the "Baylior cyan" palette (`design/brand` in the app repository).
- Module labels per the table in the landing-page section (re-check at release).

Open:
- **Sign-up domain:** later.
- **Approved screenshots and copy.**
- **Production trial setting** for the trial calls to action.
- **E6's agreement** to be named as a customer.
- **Release readiness:** payment, download links and policy pages.

No website implementation, sign-up changes, commits or deployment were made during this planning task.


