---
name: Velocity Enterprise
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#44474a'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#75777a'
  outline-variant: '#c5c6ca'
  surface-tint: '#5d5e61'
  primary: '#000101'
  on-primary: '#ffffff'
  primary-container: '#1a1c1e'
  on-primary-container: '#838486'
  inverse-primary: '#c6c6c9'
  secondary: '#0453cd'
  on-secondary: '#ffffff'
  secondary-container: '#356ee7'
  on-secondary-container: '#fefcff'
  tertiary: '#000103'
  on-tertiary: '#ffffff'
  tertiary-container: '#0e1d2d'
  on-tertiary-container: '#77859a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e5'
  primary-fixed-dim: '#c6c6c9'
  on-primary-fixed: '#1a1c1e'
  on-primary-fixed-variant: '#454749'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#b2c5ff'
  on-secondary-fixed: '#001848'
  on-secondary-fixed-variant: '#0040a2'
  tertiary-fixed: '#d4e4fa'
  tertiary-fixed-dim: '#b9c8de'
  on-tertiary-fixed: '#0d1c2d'
  on-tertiary-fixed-variant: '#39485a'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1440px
---

## Brand & Style

The design system is engineered for high-performance automotive service management, blending the precision of luxury car interfaces with the reliability of enterprise SaaS. The brand personality is **sophisticated, authoritative, and frictionless**.

The aesthetic follows a **Modern Corporate** direction with a **Tactile** edge. It utilizes deep layering and subtle metallic accents to evoke the feeling of a premium vehicle dashboard. High-gloss finishes are avoided in favor of matte surfaces and crisp, intentional borders that communicate structural integrity and professional rigor.

## Colors

The palette is anchored by **Deep Charcoal**, used primarily for high-level navigation and dark-mode surfaces to provide a grounded, premium feel. **Metallic Blue** serves as the high-action accent color, used sparingly to draw attention to primary conversions and active states.

- **Primary (Deep Charcoal):** Used for sidebars, footers, and heavy text.
- **Accent (Metallic Blue):** Used for primary buttons, active tab indicators, and progress bars.
- **Surface:** A hierarchy of whites and light greys (#FFFFFF to #F1F5F9) to maintain high legibility in data-heavy environments.
- **Typography:** Deep grey (#333333) is the standard for body text to reduce eye strain while maintaining a high-contrast professional look.

## Typography

The design system utilizes **Inter** for its systematic, utilitarian, and modern qualities. The typographic scale is optimized for high information density without sacrificing clarity. 

Key headers use a tighter letter-spacing to mimic the bold, condensed feel of automotive branding. Labels and micro-copy utilize a subtle uppercase transform with increased tracking to improve scannability in complex data grids and vehicle status reports.

## Layout & Spacing

This design system employs a **Fluid Grid** model with a 12-column layout for desktop. It prioritizes "spacious density"—meaning content is tightly grouped within components (like cards), but those components are separated by generous margins to prevent visual fatigue.

- **Desktop (1280px+):** 12 columns, 24px gutters, 32px outer margins.
- **Tablet (768px-1279px):** 8 columns, 16px gutters, 24px outer margins.
- **Mobile (Up to 767px):** 4 columns, 12px gutters, 16px outer margins.

The spacing rhythm is built on a 4px baseline, ensuring all padding and margins are multiples of 4 (e.g., 8, 12, 16, 24, 32).

## Elevation & Depth

Visual hierarchy is established using **Tonal Layers** supplemented by **Ambient Shadows**.

1. **Level 0 (Background):** #F8F9FA. The foundation for all layouts.
2. **Level 1 (Cards/Tables):** White (#FFFFFF) with a 1px border (#E2E8F0) and a soft, diffused shadow (0px 4px 12px rgba(0, 0, 0, 0.05)).
3. **Level 2 (Dropdowns/Modals):** White (#FFFFFF) with a more pronounced shadow (0px 12px 24px rgba(0, 0, 0, 0.1)) to indicate a change in the Z-axis.
4. **Navigation (Sidebar):** Uses the Primary color (#1A1C1E) with no shadow, but distinguished by its high-contrast background to denote structural permanence.

## Shapes

The shape language is consistently **Rounded**. All container elements, including cards and data modules, utilize a **12px to 16px radius** to soften the industrial feel of the deep charcoal palette.

- **Standard Elements (Buttons, Inputs):** 8px radius.
- **Container Elements (Cards, Tables):** 12px - 16px radius.
- **Badges/Chips:** Full pill-shape for high visual distinction in status tracking.

## Components

### Sidebar & Header
- **Sidebar:** Persistent, #1A1C1E background. Active states use a subtle Metallic Blue vertical bar (4px width) on the left edge. Icons are outlined, 20px in size.
- **Header:** White background, thin bottom border. Global search is a light grey input field with a search icon prefix.

### Buttons
- **Primary:** Metallic Blue (#0052CC) background, White text. High-contrast.
- **Secondary:** Transparent background, 1.5px Charcoal border, Charcoal text.
- **Ghost:** No border or background, blue text. Used for "Cancel" or "Go Back."

### Data Grids & Tables
- High-density rows (48px height) with light hover states (#F1F5F9). 
- First column (usually Vehicle ID or Customer Name) uses bold weight.
- Headers are #64748B, Uppercase, 12px.

### Status Indicators (Badges)
- **Pending:** Soft Yellow background, Dark Amber text.
- **In Progress:** Light Blue background, Metallic Blue text.
- **Completed:** Mint Green background, Deep Emerald text.
- **Cancelled:** Light Red background, Crimson text.

### Charts
- **Automotive Styling:** Line charts use a 2px stroke with a subtle gradient area fill. 
- **KPI Cards:** Display a large numeric value with a secondary "trend" indicator (small sparkline or percentage).