---
name: Obsidian Precision
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#ffb3ad'
  on-secondary: '#68000a'
  secondary-container: '#a40217'
  on-secondary-container: '#ffaea8'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3ad'
  on-secondary-fixed: '#410004'
  on-secondary-fixed-variant: '#930013'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
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
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
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
  space-xl: 2rem
---

## Brand & Style

This design system serves high-velocity automotive detailing, car spa operations, and administrative oversight. The aesthetic merges utilitarian dark-mode engineering with refined SaaS clarity, projecting reliability, speed, and technical mastery. 

The visual style is **Corporate Modern with High-Contrast Dark Tiers**. Deep zinc substrates eliminate ocular fatigue in indoor bay and desk environments, while crisp white typography and a dynamic high-energy gradient anchor focus onto mission-critical business metrics and conversion actions. The interface communicates institutional credibility, enterprise reliability, and modern tooling tailored specifically for Indian automotive detailing ecosystems.

## Colors

The palette operates across disciplined dark surfaces, calibrated to meet strict WCAG AA standards against true-black and deep-zinc grounds.

### Core Canvas & Surfaces
- **Canvas Base:** `#09090B` — Deep obsidian page backdrop.
- **Card Surface:** `#18181B` — Primary container tier.
- **Alternate Surface:** `#111113` — Recessed areas, secondary panels, and input backings.
- **Surface Border:** `rgba(255, 255, 255, 0.08)` — Structural containment across all components.

### Brand & Interactive Accents
- **Primary Interactive:** `#3B82F6` — Standard active buttons, selected tabs, focus indicators.
- **Primary Interactive Hover:** `#2563EB` — Pressed and hovered operational states.
- **Signature Brand Gradient:** `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)` — Reserved exclusively for brand logo marks, major milestone triggers, and primary promotional CTAs.

### Typography & Iconography
- **Primary Headings:** `#FFFFFF` — Maximum optical contrast for titles and vital counters.
- **Body & High-Emphasis Content:** `#E4E4E7` — Readable, low-glare neutral for continuous scanning.
- **Secondary & Meta Content:** `#A1A1AA` — Labels, subtexts, breadcrumbs, and inactive glyphs.

### Status Indicators
- **Success:** `#34D399` — Completed bookings, paid invoices, operational bay clear.
- **Warning:** `#FBBF24` — Pending approval, bay running over time, low inventory.
- **Error:** `#F87171` — Failed payment, critical vehicle hold, validation rejection.

## Typography

Typography relies entirely on **Inter** to ensure maximum digital legibility across complex schedules, multi-line vehicle spec sheets, and transactional screens.

- **Numerics & Currency:** All currency amounts must render with tabular figures (`font-variant-numeric: tabular-nums`) using the Indian Rupee symbol `₹` alongside Indian numerical grouping (e.g., `₹1,25,000` rather than Western standard).
- **Date Formatting:** Dates must consistently follow standard operational alphanumeric syntax: `DD MMM YYYY` (e.g., `20 Oct 2026`). Numeric-only slash or hyphen configurations are prohibited to eliminate ambiguity.

## Layout & Spacing

The layout model is anchored by a responsive 12-column fluid grid system across desktop viewports, reducing to an 8-column layout on tablet, and a 4-column layout on mobile devices.

### Structural Flow & Grid Rules
- **Desktop (≥1024px):** 12 columns, `gutter: 1.5rem`, outer canvas margins of `2rem` (max-width capped at 1280px for standard forms and 1440px for scheduling grids).
- **Tablet (768px – 1023px):** 8 columns, `gutter: 1rem`, canvas margin `1.5rem`.
- **Mobile (<768px):** 4 columns, `gutter-mobile: 1rem`, canvas margin `1rem`.

### Touch & Accessibility Standards
- Every tap target (buttons, input hits, select triggers, icons) must uphold a strict minimum bounding box of **44px × 44px**.
- Card and form field spacing maintains a relaxed internal rhythm using `space-lg` (24px) for card body padding and `space-md` (16px) for stacked row elements to avoid clustered touch errors during high-speed point-of-sale entries.

## Elevation & Depth

This system intentionally eliminates traditional heavy drop shadows in favor of **Tonal Layers with Subtle Translucent Outlines**. Because the background sits at an ultra-dark value (`#09090B`), physical separation is created through structural contrasts rather than ambient lighting:

1. **Base Floor (Canvas):** `#09090B` — Neutral backplane.
2. **Level 1 (Cards, Tables, Structural Containers):** `#18181B` enclosed within a clean `1px solid rgba(255, 255, 255, 0.08)` border.
3. **Level 2 (Dropdowns, Floating Overlays, Modals):** `#1F1F23` with a crisp `1px solid rgba(255, 255, 255, 0.12)` border and an ambient low-diffusion shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.6)`.
4. **Recessed Elements (Inputs, Data wells):** `#111113` with `1px solid rgba(255, 255, 255, 0.08)`.

Transitions between elevated surfaces must remain sharp, instant, and clean without glow artifacts or light skeuomorphic edges.

## Shapes

The interface utilizes a tiered geometric curvature logic to establish natural nesting relationships:

- **Cards and Structural Modals:** Explicitly styled with **12px** corner rounding (`rounded-lg`), delivering modern software structure without excessive softness.
- **Controls and Inputs:** Form inputs, buttons, action chips, and dropdown toggles utilize **8px** corner rounding (`rounded-md`).
- **Status Tags & Micro Badges:** Rounded at **4px** to maintain high legibility and sharp utility status.
- **Circular Indicators:** Avatars and step numbering tags use **50% (full pill)** circles.

## Components

### 1. Header & Navigation Bar
- **Surface:** Backed by `#09090B` with a bottom border of `1px solid rgba(255, 255, 255, 0.08)`.
- **Identity Block:** Left-aligned. Features the Trovo logo mark filled with the brand gradient (`linear-gradient(135deg, #2563EB 0%, #EF4444 100%)`), paired with "Trovo" in typography level `headline-md` (`#FFFFFF`) and subtitle "Car Spa Management" in `body-sm` (`#A1A1AA`).
- **Utility Actions:** Right-aligned. Displays "Already registered? Download the app" and "Contact: +91 90426 72148" rendered in `body-md` (`#A1A1AA`), with phone and links shifting to `#E4E4E7` on hover. Minimum tap height: 44px.

### 2. Multi-Step Onboarding Indicator
- **Structure:** Horizontal progress chain containing 3 dedicated operational nodes:
  - `1 Your business`
  - `2 Plan & users`
  - `3 Review & pay`
- **Active Step:** Step number enclosed in a 32px circular badge using `#3B82F6` with bold white numeral; step label in `label-lg` (`#FFFFFF`).
- **Completed Step:** Circle filled with `#34D399` carrying a white checkmark icon; connecting track turns `#34D399`.
- **Inactive Step:** Circle filled with `#18181B` with a `1px solid rgba(255, 255, 255, 0.12)` border and `#A1A1AA` text; label set in `body-md` (`#A1A1AA`).

### 3. Buttons
- **Primary Gradient CTA:** Applied to hero-level decisions and final purchase steps. Background: `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)`, text `#FFFFFF`, radius 8px, min-height 44px, font `label-lg`.
- **Operational Primary:** Background `#3B82F6`, hover `#2563EB`, text `#FFFFFF`, radius 8px, min-height 44px.
- **Secondary / Ghost:** Background `#18181B`, border `1px solid rgba(255, 255, 255, 0.08)`, text `#E4E4E7`, hover background `#1F1F23`.

### 4. Input Fields & Selectors
- **Container:** Height 44px, radius 8px, background `#111113`, border `1px solid rgba(255, 255, 255, 0.08)`.
- **States:** 
  - Text: `#E4E4E7`, Placeholder: `#A1A1AA`.
  - Focused: Border transitions to `#3B82F6` with a `0 0 0 1px #3B82F6` focus ring.
  - Error: Border transitions to `#F87171` with error message rendered below in `body-sm` (`#F87171`).

### 5. Cards & Data Wells
- **Card Styling:** Background `#18181B`, radius 12px, border `1px solid rgba(255, 255, 255, 0.08)`, padding `1.5rem` (`24px`).
- **Inner Data Wells:** Recessed regions within cards use surface `#111113` with radius 8px to segregate sub-metrics and service packages.

### 6. Checkboxes & Radio Buttons
- **Touch Target:** Centered inside a 44px hit-box. Visual control size is 20px × 20px.
- **Visuals:** Border `1.5px solid rgba(255, 255, 255, 0.2)` over `#111113`. When active: Background `#3B82F6` with an `#FFFFFF` check glyph or inner radio dot.

### 7. Footer
- **Layout & Structure:** Enclosed with top border `1px solid rgba(255, 255, 255, 0.08)`, padding `2rem 0`.
- **Content:**
  - Left meta: "© 2026 Trovo Tech Solutions · Erode, Tamil Nadu" in `body-sm` (`#A1A1AA`).
  - Right links: "Terms", "Privacy policy", "Refund policy", "Contact", and "info@trovotechsolutions.in" styled in `body-sm` (`#A1A1AA`), transitioning to `#FFFFFF` on hover.