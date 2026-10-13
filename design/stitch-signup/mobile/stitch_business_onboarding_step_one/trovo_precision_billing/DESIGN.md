---
name: Trovo Precision Billing
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#454655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#757687'
  outline-variant: '#c6c5d8'
  surface-tint: '#3c4ae0'
  primary: '#1c2ac8'
  on-primary: '#ffffff'
  primary-container: '#3b49df'
  on-primary-container: '#d2d4ff'
  inverse-primary: '#bdc2ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#38475c'
  on-tertiary: '#ffffff'
  tertiary-container: '#4f5f75'
  on-tertiary-container: '#c8d9f3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bdc2ff'
  on-primary-fixed: '#000668'
  on-primary-fixed-variant: '#1d2cc9'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  metric-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  metric-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system is engineered for modern Indian enterprise and cross-border B2B SaaS checkout, multi-tier subscription billing, and tax-compliant transaction flows (GST, e-invoicing, SEZ treatments). It communicates institutional reliability, speed, and fiscal precision. 

The core visual style merges **Corporate / Modern** discipline with high-density architectural clarity:
- **Tone:** Authoritative, friction-free, unambiguous, and compliant.
- **Audience:** CFOs, procurement leads, engineering managers, and finance teams across India and global hubs managing high-frequency transactions.
- **Aesthetic Direction:** Crisp hairline card borders, controlled slate/indigo focal anchors, balanced data hierarchy, and an unmistakable emerald signal layer for savings, rebates, and growth incentives.

## Colors

The palette is tuned specifically for high-stakes transactional clarity, preventing cognitive overload during checkout and subscription configuration.

- **Primary (`#3B49DF` - Deep Indigo):** Directs primary intent: checkout confirmations, primary CTAs, active stepper indicators, and radio/checkbox selection states.
- **Secondary (`#10B981` - Emerald Accent):** Reserved strictly for positive financial reinforcement, including "2 months free" incentives, annual discount pills, tax credits applied, and verified bank/UPI success badges.
- **Tertiary (`#64748B` - Slate Neutral):** Structural dividers, inactive stepper paths, secondary metric captions, and metadata labels.
- **Neutral (`#0F172A` - Rich Midnight Slate):** Anchor text, high-contrast headings, currency symbols, and total amounts payable.
- **Surface & Canvas:** Base canvas is `#F8FAFC` (Slate 50), card surfaces rest on `#FFFFFF`, with sub-tier containers resting on `#F1F5F9` (Slate 100).
- **Functional Semantics:** Error states (`#EF4444`) for payment drops or invalid GSTINs; Warning states (`#F59E0B`) for mandate expirations; Info states (`#0EA5E9`) for TDS or withholding disclaimers.

## Typography

Typography balances approachable structural modernism with rigorous tabular functionality. 

- **Display & Headings (Plus Jakarta Sans):** Provides geometric poise and contemporary polish for tier titles, tier pricing, and invoice totals.
- **Body & Controls (Inter):** Maximizes optical legibility at small sizes (11px–14px) for GST breakdowns, terms, form fields, and line items.
- **Tabular Figures:** All financial amounts, currency symbols (₹, $, €), seat counters, and date columns must enforce `font-feature-settings: "tnum" 1, "cv05" 1` to ensure vertical column alignment across billing tables.

## Layout & Spacing

The layout is built upon an 8pt structural rhythm within a 12-column responsive fluid grid.

- **Breakpoints:** Mobile (under 768px), Tablet (768px–1024px), Desktop (1024px+). Max-width container is clamped at 1280px for standard checkout pages and 1440px for multi-column plan selector matrices.
- **Layout Model:**
  - **Desktop Checkout:** 7-column primary workflow (stepper, company/tax info, payment credentials) paired with a 5-column sticky summary rail (order breakdown, coupons, immediate breakdown of IGST/CGST/SGST, and total).
  - **Mobile Checkout:** Single-column vertical stack with a bottom-anchored, condensed order summary sheet showing total payable and instant proceed action.
- **Section Rhythm:** `space-xl` handles top-level segment division; `space-md` anchors field groups and step transitions; `space-sm` separates labels from associated inputs.

## Elevation & Depth

Visual hierarchy uses crisp, low-contrast hairline outlines paired with subtle ambient diffusion. The interface avoids aggressive skeuomorphism in favor of sharp financial certainty.

- **Layer 0 (Canvas):** Flat `#F8FAFC` background.
- **Layer 1 (Cards & Panels):** Pure white (`#FFFFFF`) surface framed with a 1px border of `#E2E8F0`. Shadow is faint and ambient: `0 1px 3px 0 rgba(15, 23, 42, 0.04)`.
- **Layer 2 (Selected Plan / Active Card):** Highlighted card boundary with a 1.5px `#3B49DF` border and ambient glow: `0 4px 12px -2px rgba(59, 73, 223, 0.08)`.
- **Layer 3 (Modals, Overlays, Floating Tooltips):** Background `#FFFFFF`, 1px border `#CBD5E1`, elevated by `0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.

## Shapes

The design system employs **Soft** geometry (`roundedness: 1`) to project enterprise stability and institutional precision without feeling dated or overly utilitarian.

- Standard inputs, buttons, segmented controls, and badges use `0.25rem` (4px) to `0.375rem` (6px) border radii.
- Primary pricing containers, billing summary panels, and modal shells use `0.5rem` (8px).
- Status pills, promotional chips ("2 months free"), and circular stepper nodes utilize full pill borders (`9999px`) to visually contrast against structural data boxes.

## Components

### Buttons
- **Primary:** Solid `#3B49DF` with white text. Height: 44px (desktop), 48px (mobile). Focus ring: 2px `#3B49DF` offset by 2px white. Active state darkens to `#2E3BB8`.
- **Secondary:** White background, 1px `#CBD5E1` border, `#0F172A` text. Hover state introduces `#F8FAFC`.
- **Tertiary/Ghost:** Transparent background, `#3B49DF` text with subtle underline or icon glyph for secondary navigational links.

### Segmented Controls (Monthly / Annual Toggle)
- Contained slate track (`#F1F5F9`) with 4px padding.
- Selected tab uses a pure white pill with a 1px border `#E2E8F0` and `0 1px 2px rgba(15, 23, 42, 0.05)` shadow.
- The annual switch option directly houses an inline emerald chip (`#ECFDF5` background, `#047857` text, font size 11px) declaring "Save 20% (2 months free)".

### Stepper Controls
- Horizontal node-and-connector flow on desktop; compact numeric badge on mobile.
- **Completed Step:** `#10B981` node with a checkmark glyph; connector line colored `#10B981`.
- **Active Step:** `#3B49DF` node with step index; connector line neutral `#E2E8F0`.
- **Pending Step:** `#F1F5F9` surface with `#64748B` glyph, border 1px `#CBD5E1`.

### Input Fields & Tax Selectors
- Background `#FFFFFF`, height 42px, border 1px `#CBD5E1`, text `#0F172A`, placeholder `#94A3B8`.
- Dedicated validation prefix/suffix slots for country dials (`+91`), GST auto-validation verification ticks, and currency symbols (`₹`).
- Error state: 1px `#EF4444` border with immediate red helper text below.

### Multi-Tier Pricing & Plan Cards
- Vertical layout with top badge ("Most Popular" or "Enterprise Custom").
- Includes a dedicated header section featuring tier name, tier price, billing periodicity, bulleted feature entitlements, and a direct selection CTA.
- The highlighted tier uses an outer stroke of `#3B49DF` with a subtle top banner.

### Chips & Badges
- **Discount & Savings:** `#ECFDF5` background, `#047857` text, 1px `#A7F3D0` border.
- **Neutral Metadata:** `#F1F5F9` background, `#475569` text.
- **GST Verification Status:** `#EFF6FF` background, `#1D4ED8` text with checkmark icon for "GSTIN Active".

### Checkboxes & Radios
- 18px dimensions. Radios maintain concentric circle indicators; checkboxes show clean white checkmarks on `#3B49DF` background when checked.
- Unchecked states use a 1.5px `#CBD5E1` outline with a `#FFFFFF` fill.