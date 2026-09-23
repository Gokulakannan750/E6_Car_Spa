---
name: Executive Precision Desktop
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002114'
  on-tertiary-container: '#069669'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
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
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
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
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.025em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers a high-performance, native-feel desktop launcher engineered for the operational nerve center of premium automotive care and detailing businesses. Combining the clarity and architectural rigor of executive desktop suites with modern web fluidity, it balances operational utility with aesthetic refinement. 

The aesthetic style is **Corporate / Modern** anchored in tactile, desktop-first ergonomics: crisp hairline dividers, high legibility across dense data, deliberate application color coding, and restrained elevation shifts. The UI communicates reliability, absolute mechanical control, and swift keyboard-or-mouse execution. It replaces consumer-grade playfulness with sharp utility, understated status signifiers, and structured visual modules designed for multi-monitor workstations and point-of-sale environments.

## Colors

The palette establishes an authoritative, high-contrast hierarchy tailored for all-day operational use without visual fatigue.

### Core Canvas & Structure
- **App Canvas**: `#F8FAFC` provides a clinical, pristine desktop backdrop.
- **Section & Shelf Surfaces**: `#F1F5F9` frames nested panes, window chrome, and toolbars.
- **Surface Pure**: `#FFFFFF` isolates active operational cards and primary dialog modals.
- **Primary Ink**: `#0F172A` defines high-contrast text and structural chrome accents.
- **Secondary Ink**: `#334155` provides clear secondary metadata and subtitle weight.
- **Muted Ink / Placeholder**: `#64748B` anchors system status, disabled nodes, and utility metrics.
- **Hairline Border**: `#E2E8F0` defines clean pixel-grid division across panels and inputs.

### Application Module System Accents
Every core software module has a dedicated semantic accent token to facilitate instant spatial recognition:
- **Billing & Point-of-Sale**: `#2563EB` (Cobalt Blue)
- **Staff & Roster Management**: `#059669` (Deep Emerald)
- **Showroom & Bay Tracker**: `#D97706` (Amber Copper)
- **Analytics & Executive Reports**: `#7C3AED` (Royal Violet)
- **System Diagnostics & Settings**: `#475569` (Steel Slate)

Each module accent uses a 10% alpha fill tint for badges, hover states, and inactive indicator halos.

## Typography

The type hierarchy uses **Inter** throughout, paired with a native operating system fallback cascade (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`). 

Key rules:
- **Optical Tracking**: Headings utilize subtle negative tracking (`-0.01em` to `-0.025em`) to retain compactness and punch on standard resolution POS displays.
- **Utility Labels**: All tag badges, keyboard shortcut indicators, and sub-labels employ uppercase or semi-bold micro tracking (`0.025em` to `0.05em`) to ensure legibility down to 10px.
- **Tabular Numerals**: Numerical data, including revenue tallies, license plate strings, and timestamps, must use tabular figures (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during real-time layout updates.

## Layout & Spacing

The layout operates on a desktop-optimized responsive grid system calibrated for multi-pane workflows, 1080p, and 4K desktop environments.

- **Window Chrome Shell**: A top 40px fixed drag-safe window bar combined with a slim 64px persistent vertical utility rail creates the desktop frame.
- **Grid Architecture**: The application launcher dashboard uses an adaptive 12-column grid. Launcher app cards span 4 columns on large desktop viewports (`>= 1280px`), 6 columns on intermediate viewports (`>= 960px`), and 12 columns on compact touchscreen registers (`< 960px`).
- **Rhythm**: Built on a strict 4px sub-grid, layout gaps default to `1.25rem` (20px) to balance high information density with rapid click targeting. Section margins scale between `1.5rem` and `2rem` to isolate utility sidebars from active working canvas zones.

## Elevation & Depth

Visual hierarchy uses a disciplined combination of tonal layers, hairline borders, and targeted directional shadows rather than heavy global blurs.

- **Base Level (Canvas)**: `#F8FAFC` flat surface, no shadow.
- **Chrome / Side Dock**: `#F1F5F9` bordered with a 1px solid stroke (`#E2E8F0`) to the right or bottom.
- **Card Default (Resting)**: `#FFFFFF` with a 1px uniform perimeter stroke (`#E2E8F0`) and an enterprise hairline shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.05)`.
- **Card Active / Hover**: Elevated state on hover or selection: the card rises 2px vertically (`transform: translateY(-2px)`), the border lightens to accent-adjacent tones, and the shadow deepens to an ambient `0 12px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)`.
- **Flyouts & Command Overlays**: Floating menus and command palettes (`Ctrl + K`) sit at the highest elevation: `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.04)` wrapped in `#CBD5E1` borders.

## Shapes

The design system maintains a **Soft (Level 1)** geometric contour language, honoring desktop Windows/Enterprise ergonomics where slightly squared geometries convey precision, data integrity, and screen space efficiency.

- **Standard Elements (Buttons, Inputs, Badges)**: `0.25rem` (4px) corner radius.
- **Medium Panels & Content Cards (`rounded-lg`)**: `0.5rem` (8px) corner radius.
- **Application Suite Launcher Tiles (`rounded-xl`)**: `0.75rem` (12px) corner radius, providing a contemporary frame that softens dense information grids.
- **Window Frame**: Unrounded or 4px subtle clip to align natively with desktop window managers.

## Components

### Desktop Window Title Bar
The top utility chrome bar (36px-40px height) features a non-intrusive drag region, centered active facility selector (`E6 Car Spa - Downtown Flagship`), integrated system status dot (green operational sync), and top-right window controls (minimize, maximize, close) with native hover transitions.

### Launcher Application Cards
Primary interactive touchpoints designed for fast access:
- **Structure**: Surface white background, 12px corner radius, hairline `#E2E8F0` border. Top row houses a 44px tinted accent badge featuring a sharp geometric icon (Cobalt, Emerald, Amber, Violet, Slate).
- **Metadata**: Bold title (16px), 2-line functionality description (13px), and a micro-status pill (e.g., "Active Bays: 6/8", "Pending Sync").
- **Hover Lift**: 2px upward shift with accent-tinted border glow (`1px solid ${moduleAccentColor}`).
- **Action Strip**: Subtly exposed shortcut cue (e.g., `Alt + 1`) positioned in the bottom corner in `label-sm`.

### Buttons
- **Primary**: Solid `#0F172A` background with crisp white typography. Hover: `#1E293B`. Active: `#020617`. Focus: 2px ring offset with `#2563EB`.
- **Module Launchers**: Solid module-colored button (e.g., `#2563EB` for billing) for launching dedicated sub-apps.
- **Secondary / Outline**: `#FFFFFF` fill with `#E2E8F0` border, `#334155` text. Hover: `#F8FAFC` fill, `#CBD5E1` border.
- **Height**: Standard inputs and action buttons sit at a compact 36px desktop height (32px for dense data tables).

### Tag Badges & Status Indicators
- **Application Badges**: 20px height, 4px corner radius, bold 10px tracking. Built with 10% module accent background and solid module accent text (e.g., Violet `#7C3AED` tint for `Reports`).
- **Live Operation Pill**: Dynamic status tags with a pulsing 6px circular dot indicator (Green for online bay availability, Amber for bays undergoing maintenance).

### Minimal Utility Sidebar
- **Geometry**: Compact 56px - 64px width dock.
- **Items**: Vertical icon stack with crisp 20px monochrome icons (`#64748B`). Active item is rendered with an inset left indicator line (3px solid `#2563EB`), dark glyph (`#0F172A`), and subtle `#E2E8F0` background wash.
- **Bottom Stack**: Quick workstation toggle, hardware printer status, and user avatar.

### Input Fields & Search Command Bar
- **Global Search (`Ctrl + K`)**: Large, prominent 44px input resting in the launcher header. Contains hairline borders, magnifying glass prefix, and trailing keyboard shortcut tag (`⌘K` / `Ctrl+K`).
- **Form Inputs**: 36px height, pure white background, hairline border `#CBD5E1`. On focus: border shifts immediately to `#2563EB` with a `0 0 0 1px #2563EB` ring.

### Data Tables & Status Lists
Compact rows (36px - 40px height) featuring alternating row striping (`#FFFFFF` to `#F8FAFC`), hairline horizontal separators, uppercase 11px muted headers, and right-aligned numeric data.