---
name: Obsidian Precision Auto
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f22'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#45dfa4'
  on-secondary: '#003825'
  secondary-container: '#00bd85'
  on-secondary-container: '#00452e'
  tertiary: '#ffb3ad'
  on-tertiary: '#68000a'
  tertiary-container: '#ff5451'
  on-tertiary-container: '#5c0008'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#68fcbf'
  secondary-fixed-dim: '#45dfa4'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  title-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
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
    fontWeight: '500'
    lineHeight: 20px
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
  currency-display:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system targets high-growth automotive detailing studios, ceramic coating workshops, and premium car spas across the Indian market. The visual tone balances industrial precision with upscale executive software ergonomics. It projects high-tech command, unwavering operational discipline, and luxury craftsmanship.

The visual direction merges **Minimalism** with **Tonal Layering and Tactical Accents**:
- **Pure Dark Foundation:** Deep obsidian surfaces mitigate glare in high-brightness bay environments, grease-prone mobile operations, and front-desk reception terminals.
- **Precision Metrics:** High numerical legibility, dense structured information cards, and sharp visual contrast to handle fast vehicle intake, technician allocation, and invoicing under pressure.
- **Controlled Vibrancy:** Functional neon and jewel-toned state signifiers (emerald status indicators, cobalt actions, amber alerts) against near-black matte canvases, eliminating visual noise while maintaining immediate scanability.

## Colors

The palette establishes an ultra-dark canvas with distinct functional tiers to preserve hierarchy and guarantee WCAG AA compliance across all touchpoints.

### Base Canvases & Surfaces
- **Canvas Base:** `#09090B` — Absolute background ground layer.
- **Surface Layer 1 (Cards, Modules, Drawers):** `#18181B` — Primary interactive and content containment.
- **Surface Layer 2 (Alternate / Wells / Tables):** `#111113` — Inset areas, table body tracks, and segmented control backgrounds.
- **Surface Hover:** `#27272A` — Hover state for interactive tiles, dropdown rows, and elevated list items.
- **Structural Borders:** `rgba(255, 255, 255, 0.08)` — Delicate separation lines; avoids visual heaviness while preserving clear grid edges.
- **Active / Focus Borders:** `rgba(59, 130, 246, 0.5)` — Highlighting focused controls and selected bay states.

### Brand & Interactive Accents
- **Primary Cobalt:** `#3B82F6` (Hover: `#2563EB`, Active: `#1D4ED8`) — Primary calls-to-action, active bay indicators, navigation highlights.
- **Brand Identity Gradient:** `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)` — Reserved strictly for brand touchpoints, onboarding progress caps, and premium membership / ceramic warranty badges.

### Typography & Icon Colors
- **Text Headings / Crucial Metrics:** `#FFFFFF` — 100% luminance for instantly readable telemetry and vehicle numbers.
- **Text Body:** `#E4E4E7` — High contrast, low eye-strain body text.
- **Text Muted / Secondary:** `#A1A1AA` — Metadata, vehicle VIN/license plate subtext, labels, and timestamps.
- **Text Disabled:** `#52525B` — Inactive controls and unassigned statuses.

### Feedback & Status Tokens
- **Success / Ready / Paid:** `#34D399` (Soft Badge Tint: `rgba(52, 211, 153, 0.10)`)
- **Warning / In-Progress / Pending:** `#FBBF24` (Soft Badge Tint: `rgba(251, 191, 36, 0.10)`)
- **Danger / Urgent / Blocked:** `#F87171` (Soft Badge Tint: `rgba(248, 113, 113, 0.10)`)
- **Informational:** `#60A5FA` (Soft Badge Tint: `rgba(59, 130, 246, 0.10)`)

## Typography

The typography relies entirely on **Inter** to maximize data density, glyph legibility, and tabular clarity across fast-paced garage floor operations.

### Numerical & Currency Formatting Directives
- **Indian Rupee Formatting:** Always apply standard Indian numerical denomination groupings with the ₹ symbol:
  - Format: `₹14,990`, `₹40,960`, `₹1,25,000`, `₹12,45,000`.
  - Symbol alignment: Use non-breaking spaces when preceding numerical figures (`₹14,990`).
- **Tabular Figures:** All financial columns, vehicle license numbers, odometer readings, and bay timers must render using `font-feature-settings: "tnum" 1` to prevent jitter during real-time updates and maintain aligned vertical totals.
- **License Plate Typography:** Indian registration numbers (e.g., `MH 12 AB 1234`, `DL 01 CA 9999`) must always be set in uppercase with tracking `0.05em` and `font-weight: 600`.

## Layout & Spacing

The layout utilizes a structured fluid grid calibrated for field tablets, technician smart-devices, and wide desktop counter displays.

### Layout Model
- **Mobile (Viewport &lt; 768px):** 4-column layout, `1rem` margin, `1rem` gutter. Full-width action sheets, stacked job order cards, and sticky bottom utility bars.
- **Tablet / Workshop Kiosk (768px - 1024px):** 8-column layout, `1.5rem` margin, `1rem` gutter. Two-column booking splits (Bay allocation left, job details right).
- **Desktop / Front Desk (1025px+):** 12-column layout, maximum content container width of `1600px`, `2rem` margin, `1.5rem` gutter. Collapsible tactical sidebar (nav) with live multi-bay Kanban boards.

### Ergonomics & Tap Targets
Every interactive point (toggles, job checklists, service check-offs, payment buttons) adheres to an uncompromising minimum target height of **44px** to accommodate busy operational staff using one hand or wearing protective detailing gloves.

## Elevation & Depth

This system avoids heavy drop shadows and fuzzy light scattering, relying instead on **Tonal Layers** accented by **Ghost Borders** and subtle ambient glows.

### Elevation Hierarchy
- **Level 0 (Canvas Base):** `#09090B`. Ground viewport plane.
- **Level 1 (Structural Containers):** `#18181B` combined with `1px solid rgba(255, 255, 255, 0.08)`. Default state for cards, tables, vehicle records, and job cards.
- **Level 2 (In-Card Blocks & Input Wells):** `#111113` combined with `1px solid rgba(255, 255, 255, 0.04)`. Secondary panels, line-item summaries, and customer history logs.
- **Level 3 (Dropdown Menus & Modals):** `#18181B` with `1px solid rgba(255, 255, 255, 0.12)` and a muted ambient shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.7)`.
- **Level 4 (Toasts & Global Action Triggers):** `#27272A` with `1px solid rgba(255, 255, 255, 0.18)` and `0 20px 40px -8px rgba(0, 0, 0, 0.9)`.

### Lighting & Borders
No surface uses pure-black borders or drop shadows without opacity clamping. Focus and active states introduce a targeted primary bloom: `box-shadow: 0 0 0 1px #3B82F6, 0 0 16px -2px rgba(59, 130, 246, 0.25)`.

## Shapes

The geometric architecture pairs defined corners with tactical rounded profiles to balance modern softness with professional rigor.

### Radius Assignments
- **Cards, Panels, and Bay Modules:** `12px` (`rounded-lg` per standard scale) — creates clear groupings for distinct jobs and inventory segments.
- **Interactive Controls (Buttons, Inputs, Selects):** `8px` (`rounded-md` equivalent) — gives crisp definition to interactive forms and POS elements.
- **Chips, Status Badges, and Micro Tags:** Fully rounded pill (`9999px`) to immediately differentiate informative tags from rectangular interactive action buttons.
- **Nested Inner Containers:** When a card uses `12px`, nested inset items must use `8px` or `6px` to maintain consistent border concentricity.

## Components

### Buttons
- **Primary Action:** Solid `#3B82F6` fill, `#FFFFFF` text, `8px` radius, `min-height: 44px`. Hover: `#2563EB`. Active: `#1D4ED8`. Focus outline: 2px offset with `#3B82F6`.
- **Secondary / Surface Action:** `#18181B` background with `1px solid rgba(255, 255, 255, 0.08)`, `#E4E4E7` text. Hover: `#27272A` background and border brightens to `rgba(255, 255, 255, 0.16)`.
- **Destructive Action:** Solid `#F87171` text with `rgba(248, 113, 113, 0.10)` background. Hover: Solid `#EF4444` background with `#FFFFFF` text.
- **Icon Buttons:** Fixed 44x44px bounding box, centered icon, `8px` radius.

### Input Fields & Selectors
- **Container:** `min-height: 44px`, background `#111113`, border `1px solid rgba(255, 255, 255, 0.08)`, border radius `8px`, typography `body-md` (`#E4E4E7`).
- **Placeholder:** `#71717A`.
- **Focus State:** Background remains `#111113`, border transitions to `#3B82F6`, glow adds `0 0 0 1px #3B82F6`.
- **Error State:** Border transitions to `#F87171` with message in `body-sm` `#F87171`.

### Cards & Job Slates
- **Structure:** Background `#18181B`, border `1px solid rgba(255, 255, 255, 0.08)`, border radius `12px`, padding `1.25rem`.
- **Hover State (Interactive Cards):** Background shifts to `#27272A` with subtle cursor-pointer trigger; border transitions to `rgba(255, 255, 255, 0.16)`.
- **Header Structure:** Clear separation with title (`title-md`), uppercase license tag badge, and floating right-aligned status chip.

### Chips & Status Badges
- **Shape & Sizing:** Height `24px` to `28px`, padding `0 10px`, border radius `9999px`, font `label-sm`.
- **Ready / Delivered:** Text `#34D399`, background `rgba(52, 211, 153, 0.10)`, border `1px solid rgba(52, 211, 153, 0.20)`.
- **In Detailing / In Wash:** Text `#FBBF24`, background `rgba(251, 191, 36, 0.10)`, border `1px solid rgba(251, 191, 36, 0.20)`.
- **Payment Overdue / Repair Hold:** Text `#F87171`, background `rgba(248, 113, 113, 0.10)`, border `1px solid rgba(248, 113, 113, 0.20)`.

### Checkboxes & Radio Controls
- **Hit Area:** Wrapped in a padded tap target of minimum 44px height and width.
- **Base Box/Circle:** 20px box, `4px` radius for checkbox, `50%` circle for radio. Background `#111113`, border `1px solid rgba(255, 255, 255, 0.2)`.
- **Checked State:** Background `#3B82F6`, border `#3B82F6`, check icon in `#FFFFFF`.

### Service Lists & Kanban Cards
- **Row List Items:** Background `#18181B`, divided by `1px solid rgba(255, 255, 255, 0.04)`. Height per row: Minimum 56px to ensure rapid scanning and thumb touch.
- **Car Detailing Phase Stepper:** Segmented status indicator spanning: *Intake &rarr; Foam Wash &rarr; Paint Correction &rarr; Ceramic Coating &rarr; QC &rarr; Delivered*. Completed steps link via solid `#3B82F6` tracks; pending steps remain `rgba(255, 255, 255, 0.08)`.