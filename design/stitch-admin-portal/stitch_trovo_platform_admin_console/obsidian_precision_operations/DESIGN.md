---
name: Obsidian Precision Operations
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
  secondary: '#ffb3b0'
  on-secondary: '#670211'
  secondary-container: '#881d24'
  on-secondary-container: '#ff9996'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#ffdad8'
  secondary-fixed-dim: '#ffb3b0'
  on-secondary-fixed: '#410006'
  on-secondary-fixed-variant: '#881d24'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
  surface-card: '#18181B'
  surface-alt: '#111113'
  border-subtle: '#27272A'
  border-hairline: rgba(255, 255, 255, 0.08)
  text-heading: '#FFFFFF'
  text-primary: '#E4E4E7'
  text-secondary: '#A1A1AA'
  text-muted: '#71717A'
  primary-hover: '#2563EB'
  status-trial-bg: rgba(59, 130, 246, 0.15)
  status-trial-text: '#60A5FA'
  status-active-bg: rgba(16, 185, 129, 0.15)
  status-active-text: '#34D399'
  status-pastdue-bg: rgba(245, 158, 11, 0.15)
  status-pastdue-text: '#FBBF24'
  status-readonly-bg: rgba(249, 115, 22, 0.15)
  status-readonly-text: '#FB923C'
  status-suspended-bg: rgba(239, 68, 68, 0.15)
  status-suspended-text: '#F87171'
  status-canceled-bg: rgba(113, 113, 122, 0.15)
  status-canceled-text: '#A1A1AA'
  status-registration-bg: rgba(139, 92, 246, 0.15)
  status-registration-text: '#A78BFA'
typography:
  display:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  title-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-default:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-medium:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0em
  table-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  table-header:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  caption-micro:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-2xs: 0.25rem
  space-xs: 0.375rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system drives a mission-critical, enterprise B2B operational back-office for high-velocity car spa and automotive care networks. The audience consists of internal fleet coordinators, platform engineers, and operations managers who handle continuous transactional streams, tenant status metrics, and billing health. 

The aesthetic is rooted in **Minimalism** blended with **Modern Enterprise Technical Density**. It prioritizes deep, low-luminance dark backgrounds (`#09090B`), razor-sharp surface demarcation via 1px border structures, tight typography scales, and tactical micro-accents. Color is functional, not ornamental: vibrant status badges instantly signal operational health without visual noise, while the core cobalt blue action color drives confident execution. The experience feels engineered, rigorous, and completely devoid of decorative friction.

## Colors

The palette is engineered for prolonged use in multi-monitor operational environments, maximizing contrast while eliminating glare.

- **Background Canvas (`#09090B`)**: The foundational low-reflectance surface.
- **Surface Elevation (`#18181B` & `#111113`)**: Structured panels and inset data grids, bound strictly by 1px borders (`rgba(255, 255, 255, 0.08)` or `#27272A`) to ensure distinct planar segregation without muddy drop shadows.
- **Brand Spectrum Gradient**: Reserved exclusively for top-level brand marks, global navigation anchors, and executive highlights: `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)`.
- **Action & Interactive Layer**: High-energy blue (`#3B82F6`) with hover suppression (`#2563EB`) provides unmistakable intent. Destructive states use the tactical coral red (`#F87171`).
- **Telemetry & Status System**: Semantic indicators rely on tinted translucent backgrounds (`15%` opacity) paired with high-luminance foreground text, ensuring instant recognition without overwhelming dense data rows.
- **Typography Luminance**: High-tier white (`#FFFFFF`) for headers, crisp zinc (`#E4E4E7`) for data records, muted gray (`#A1A1AA`) for meta tags, and deep slate (`#71717A`) for inactive timestamps.

## Typography

The type hierarchy is configured for extreme information density, clarity, and rapid scanning.

- **Numeric & Financial Formatting**: Inter must be rendered with `font-feature-settings: "tnum" 1, "cv05" 1` across all analytical grids and ledger lines. Currency figures must follow the Indian Numbering System convention (e.g., ₹1,45,280.00) with the currency symbol set at identical baseline alignment.
- **Table Density**: Table rows utilize `table-data` (13px/18px) to allow simultaneous viewing of at least 15–20 records without scrolling on standard enterprise displays. Headers leverage uppercase tracking (`letter-spacing: 0.04em`) at 12px for immediate column distinction.
- **Hierarchy Anchors**: Titles and KPI summaries scale between 20px and 24px in semi-bold (`600`), establishing clean visual ceilings above complex data grids without wasting vertical territory.

## Layout & Spacing

The architecture operates on a high-density, rigid grid structured for administrative control consoles.

- **Grid Model**: A 12-column fluid grid system across desktop viewports, shifting to an 8-column layout on tablets (768px–1024px) and a single-column stacked format under 768px.
- **Sidebar Integration**: The desktop layout features a fixed 260px administrative navigation drawer, with the core viewport dynamically consuming remaining space with bounded `max-width: 1600px` for wide aspect monitors.
- **Rhythm & Gaps**: Compact spacing is mandatory. Inner component spacing relies heavily on `space-xs` (6px) and `space-sm` (8px) for input padding, while card groupings and data table sections stay anchored to `space-lg` (16px) gaps.
- **Dense Data Partitioning**: Table rows have a standardized height of 40px (compact) or 48px (standard), with horizontal cell padding locked to `12px` (`space-md`).

## Elevation & Depth

This design system avoids blurry skeuomorphism, relying entirely on **Tonal Layers** paired with **Low-Contrast Hairline Outlines**:

- **Layer 0 (Base Canvas)**: `#09090B`. The deep void beneath all elements.
- **Layer 1 (Cards, Modules, Panels)**: `#18181B` surface overlay with a crisp `1px solid rgba(255, 255, 255, 0.08)` border. Zero drop shadow is applied; structure is delineated entirely by contrast edges.
- **Layer 2 (Inset Surfaces, Table Headers, Filter Bars)**: Inset background `#111113` surrounded by `#27272A` dividers.
- **Layer 3 (Floating Menus, Modals, Popovers)**: `#18181B` with an elevated border (`rgba(255, 255, 255, 0.14)`) and an ultra-diffused, ambient drop-shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.65), 0 4px 12px -2px rgba(0, 0, 0, 0.4)`. Modals deploy over an ambient backdrop dim of `rgba(0, 0, 0, 0.75)` with a 4px blur filter.

## Shapes

The interface balances sharp technical discipline with refined ergonomics:

- **Cards & Data Panels**: Fixed at `12px` (`rounded-lg`), providing clean visual containment for large datasets without appearing blocky or blunt.
- **Interactive Controls (Inputs, Primary/Secondary Buttons, Select Boxes)**: Locked at `8px` (`rounded-md`), establishing an unambiguous, tactile target standard across administrative forms.
- **Status & Metric Badges**: Explicitly set to pill format (`9999px`), differentiating live operational state indicators from clickable interactive action buttons.
- **Table Cells & Segmented Controls**: Segmented item highlights and table row focus rings retain a disciplined `6px` radius.

## Components

### Buttons
- **Primary Action**: Background `#3B82F6`, text `#FFFFFF`, 8px radius, height 36px (14px font, medium). Hover state triggers `#2563EB`. Active state scales subtly (`scale(0.98)`).
- **Secondary / Outline**: Background transparent, border `1px solid #27272A`, text `#E4E4E7`. Hover transitions to background `#18181B` and border `rgba(255, 255, 255, 0.2)`.
- **Destructive**: Background `rgba(239, 68, 68, 0.1)`, border `1px solid rgba(239, 68, 68, 0.3)`, text `#F87171`. Hover transitions to `#EF4444` with white text.

### Status Badges (Telemetry Indicators)
Rendered as pill-shaped (`9999px`), padding `2px 8px`, 11px font weight 500, with an optional 6px pulsing center dot indicator:
- **Trial**: Background `rgba(59, 130, 246, 0.15)`, text `#60A5FA`
- **Active**: Background `rgba(16, 185, 129, 0.15)`, text `#34D399`
- **Past Due**: Background `rgba(245, 158, 11, 0.15)`, text `#FBBF24`
- **Read-Only**: Background `rgba(249, 115, 22, 0.15)`, text `#FB923C`
- **Suspended**: Background `rgba(239, 68, 68, 0.15)`, text `#F87171`
- **Canceled**: Background `rgba(113, 113, 122, 0.15)`, text `#A1A1AA`
- **Awaiting Registration**: Background `rgba(139, 92, 246, 0.15)`, text `#A78BFA`

### Input Fields & Search Bars
Height 36px, background `#111113`, border `1px solid #27272A`, border radius 8px, text `#E4E4E7`, placeholder `#71717A`. On focus: border transitions to `#3B82F6` accompanied by a `0 0 0 1px #3B82F6` ring. Prefix icons (search, calendar) are rendered at 16px in `#71717A`.

### Enterprise Data Tables
- **Container**: Surface `#18181B`, border `1px solid rgba(255, 255, 255, 0.08)`, radius 12px.
- **Header Row**: Inset surface `#111113`, height 36px, border bottom `1px solid #27272A`, text `#A1A1AA` in 12px uppercase.
- **Body Rows**: Height 44px, border bottom `1px solid rgba(255, 255, 255, 0.04)`, text `#E4E4E7` in 13px tabular figures. Hover state renders background `#1F1F23`.
- **Numeric Columns**: Text right-aligned, monospaced tabular numerals, currency displayed as `₹XX,XX,XXX.00`.

### Cards & Metric Widgets
Solid `#18181B` surface with 12px radius and `rgba(255, 255, 255, 0.08)` border. KPI figures set in 24px semi-bold `#FFFFFF` with delta badges (+12.4%) displayed inline using Active/Suspended tonal chips.

### Checkboxes & Radios
Form controls sized at 16x16px, radius 4px (checkbox) or circular (radio), border `1px solid #71717A`, background `#111113`. Checked state transitions to background `#3B82F6` and border `#3B82F6` with a white checkmark icon.