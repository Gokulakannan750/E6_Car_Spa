---
name: Precision Detailing Dark
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
  tertiary: '#45dfa4'
  on-tertiary: '#003825'
  tertiary-container: '#00a574'
  on-tertiary-container: '#003120'
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
  tertiary-fixed: '#68fcbf'
  tertiary-fixed-dim: '#45dfa4'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
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
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
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
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system is engineered for car spa, detailing studio, and automotive workshop operators who manage high-velocity bay scheduling, walk-ins, service tier packages, and subscription billing in India. The interface communicates industrial precision, trust, operational efficiency, and cutting-edge craft.

The aesthetic fuses **Corporate/Modern SaaS ergonomics** with **Dark Industrial High-Contrast styling**:
- Deep obsidian canvas surfaces eliminate glare in bright workshop or service-bay settings.
- Crisp hairline borders structure dense tabular metrics and vehicle workflow cards without visual fatigue.
- Accentuated primary cues—led by high-visibility automotive blues and a signature thermal red-blue gradient—provide unmistakable focal points for active job tickets and primary conversions.
- Data typography and key figures are immediate, scannable, and formatted natively for the Indian automotive market.

## Colors

### Surface & Structural Tokens
- **Canvas Base (`#09090B`)**: Root canvas background.
- **Surface Alt / Sub-canvas (`#111113`)**: Nested bays, inactive slots, sidebars, and grouped content zones.
- **Container / Card Surface (`#18181B`)**: Standard cards, dialogs, drawers, and operational panels.
- **Border / Divider (`rgba(255, 255, 255, 0.08)`)**: 1px structural definition across all interactive containers.
- **Border Hover / Focus (`rgba(255, 255, 255, 0.20)`)**: Interactive card and surface feedback.

### Content & Typography
- **Headings / Emphasized (`#FFFFFF`)**: Section titles, vehicle registration numbers, and total invoice sums.
- **Text Primary (`#E4E4E7`)**: Standard body, customer profiles, line-item titles, table cells.
- **Text Secondary / Muted (`#A1A1AA`)**: Metadata, bay timestamps, service package subtitles, helper text.

### Brand & Interactive Accents
- **Primary Interactive (`#3B82F6`)**: Primary actionable buttons, active navigation, radio fills.
- **Primary Hover (`#2563EB`)**: State transitions for solid primary elements.
- **Brand Signature Gradient**: `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)`, reserved exclusively for brand mark badges, conversion primary CTAs, and active VIP subscription indicators.

### Status & Feedback Tokens
- **Success (`#34D399`)**: Job completed, paid invoices, bay cleared.
- **Warning (`#FBBF24`)**: Bay running overtime, pending approval, low stock alert.
- **Error (`#F87171`)**: Overdue subscription, failed webhook, job canceled.

## Typography

The typography scale utilizes **Inter** throughout all viewports to guarantee uniform font metrics, tabular figure legibility, and effortless scannability across telemetry metrics, vehicle plates, and invoicing.

### Numerical & Currency Formatting
- All operational currency values must use the Indian Rupee symbol prefix (`₹`) with Indian numbering grouping (e.g., `₹40,960`, `₹1,25,000`).
- Figures inside tables, revenue reports, and queue counts must use tabular numeral styling (`font-feature-settings: 'tnum' on, 'cv05' on`).
- License plate and vehicle identification codes should be rendered in `label-md` or `label-lg` with `uppercase` and `font-mono` styling where applicable.

## Layout & Spacing

### Grid & Layout System
- **Desktop (1024px+)**: 12-column responsive grid with a fluid maximum width of 1440px, fixed margins of `2rem` (`margin-desktop`), and gutters of `1.5rem` (`gutter-desktop`).
- **Tablet (768px – 1023px)**: 8-column layout with `1.5rem` outer margins and `1rem` gutters.
- **Mobile (<768px)**: 4-column layout with `1rem` outer margins (`margin`) and `1rem` gutters (`gutter`). Bay board workflows transition to vertical swimlanes or stackable segmented cards.

### Touch & Spatial Guidelines
- A minimum 44px by 44px bounding box is strictly enforced for all tap targets on interactive inputs, status pills, drop-down selections, and table row menu triggers.
- Multi-bay kanban boards utilize horizontal track scrolling with snap points on mobile and full 12-column span grids on desktop.

## Elevation & Depth

Visual depth is achieved through layered tonal surfaces and low-contrast perimeter hairpins rather than heavy drop shadows:

1. **Layer 0 (Canvas)**: `#09090B` — Deep ground.
2. **Layer 1 (Sub-surface / Wells)**: `#111113` — Inset forms, filter rails, empty slot indicators.
3. **Layer 2 (Containers & Cards)**: `#18181B` with `1px solid rgba(255, 255, 255, 0.08)` outline.
4. **Layer 3 (Floating Overlays / Modals / Menus)**: `#1F1F23` with `1px solid rgba(255, 255, 255, 0.12)` and an ambient shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.6)`.

No pure-black or high-opacity black drop shadows are used on standard cards; depth is communicated strictly via tonal contrast and crisp border delineation.

## Shapes

The design uses a dual-tier corner radius strategy:
- **Cards, Panels, Modals, and Workflow Buckets**: Fixed `12px` border radius (`rounded-lg` contextualized).
- **Interactive Controls (Inputs, Primary Buttons, Dropdowns, Datepickers)**: Fixed `8px` border radius.
- **Badges, Service Indicators, and Status Chips**: Pill radius (`9999px`) or `6px` depending on status density.

## Components

### Buttons
- **Brand Hero / Primary Conversion CTA**: Background `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)`, text `#FFFFFF`, radius `8px`, minimum height `44px`. Hover: slight 98% brightness shift and soft brand glow (`0 0 16px rgba(37, 99, 235, 0.35)`).
- **Standard Primary Action**: Background `#3B82F6`, hover `#2563EB`, text `#FFFFFF`, radius `8px`, height `44px`.
- **Secondary / Outlined**: Background `transparent`, border `1px solid rgba(255, 255, 255, 0.12)`, text `#E4E4E7`, hover background `rgba(255, 255, 255, 0.04)`.
- **Destructive**: Background `rgba(248, 113, 113, 0.12)`, border `1px solid rgba(248, 113, 113, 0.3)`, text `#F87171`, hover background `rgba(248, 113, 113, 0.2)`.

### Input Fields
- Height: `44px`.
- Background: `#111113`, border `1px solid rgba(255, 255, 255, 0.08)`, radius `8px`.
- Text: `#E4E4E7`, placeholder `#71717A`.
- Focus state: Border color `#3B82F6` with `0 0 0 1px #3B82F6` ring.
- Leading icons (search, Indian Rupee prefix, calendar) are rendered at 18px in `#A1A1AA`.

### Cards & Service Containers
- Background: `#18181B`.
- Border: `1px solid rgba(255, 255, 255, 0.08)`.
- Radius: `12px`.
- Padding: `1.5rem` desktop, `1rem` mobile.
- Active Bay / Selected Card State: Border highlighted with `rgba(59, 130, 246, 0.6)`.

### Chips & Status Badges
- Height: `24px` to `28px`, minimum tap footprint padded out to `44px` when interactive.
- **In Progress / Active**: Background `rgba(59, 130, 246, 0.12)`, text `#60A5FA`, border `1px solid rgba(59, 130, 246, 0.2)`.
- **Completed / Paid**: Background `rgba(52, 211, 153, 0.12)`, text `#34D399`, border `1px solid rgba(52, 211, 153, 0.2)`.
- **Delayed / Caution**: Background `rgba(251, 191, 36, 0.12)`, text `#FBBF24`, border `1px solid rgba(251, 191, 36, 0.2)`.

### Lists & Data Tables
- Row Height: `56px` to ensure effortless touch selection on mobile/tablets.
- Header: `#111113` surface, text `#A1A1AA`, `11px`, `label-sm`, all caps with letter-spacing `0.04em`.
- Row Border: Bottom border `1px solid rgba(255, 255, 255, 0.05)`. Hover row background `#1F1F23`.

### Selection Controls (Checkboxes & Radios)
- Checkboxes: `20px x 20px` square, `4px` radius, border `rgba(255, 255, 255, 0.2)`, checked background `#3B82F6`.
- Radio Buttons: `20px x 20px` circle, checked ring `#3B82F6` with centered dot `#FFFFFF`.
- Embedded inside a minimum 44px clickable target box.