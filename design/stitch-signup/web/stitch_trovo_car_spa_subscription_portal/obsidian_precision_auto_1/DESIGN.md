---
name: Obsidian Precision Auto
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
  display:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: '700'
    lineHeight: 3.5rem
    letterSpacing: -0.03em
  display-mobile:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.6rem
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-lg:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
  currency-stat:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system serves an enterprise B2B management operating system engineered specifically for car spas, ceramic coating studios, and professional auto detailing enterprises. Rooted in operational efficiency and automotive craftsmanship, the visual identity embodies high-performance instrumentation, shop-floor durability, and surgical digital precision.

The style fuses **Modern Technical SaaS** with **Tactile Performance Glass**. It leverages deep obsidian and zinc surfaces reminiscent of cleanroom automotive bays, high-gloss clear coats, and anodized aluminum equipment. High-contrast typography paired with luminous semantic indicators ensures instant legibility under harsh garage lighting as well as in direct sunlight on mobile tablets. The interface prioritizes confidence, zero-clutter information architecture, and rapid operational entry through robust 44px+ touch targets built for busy technicians, service advisors, and detailing studio owners.

## Colors

The palette is engineered for pure dark-mode utility, using structured zinc neutrals to create functional depth without eye fatigue:

- **Canvas & Surface Layering:**
  - Base Application Canvas: `#09090B` (pure obsidian backdrop)
  - Secondary/Alternate Well Surface: `#111113` (recessed bay, tables, inactive panels)
  - Card & Container Surface: `#18181B` (elevated work cards, modals, interactive panels)
  - Elevated Popovers/Drawers: `#27272A`
- **Brand Signature Gradient:**
  - `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)` reserved strictly for primary system conversion CTAs, status hero indicators, and the core brand icon mark.
- **Functional Semantics:**
  - Action Primary: `#3B82F6` (Default), `#2563EB` (Hover/Active)
  - Positive/Delivered/Paid: `#34D399` (Emerald Tint)
  - Pending/In-Bay/Inspection Warning: `#FBBF24` (Amber Gold)
  - Critical/Overdue/Blemish Alert: `#F87171` (Crimson Coral)
- **Text & Contrast Hierarchy:**
  - High Emphasis / Headings: `#FFFFFF`
  - Normal Emphasis / Body Text: `#E4E4E7`
  - Mid Emphasis / Field Labels & Metadata: `#A1A1AA`
  - Low Emphasis / Placeholders & De-emphasized Captions: `#71717A`
- **Structural Outlines:**
  - Uniform micro-borders set to `1px solid rgba(255, 255, 255, 0.08)` across all modules, cards, and input frames to establish crisp structural bounds without visually heavy dividers.

## Typography

The typography is built entirely on **Inter** to ensure maximum metric neutrality, dense scanning efficiency, and immaculate legibility on screen interfaces.

- **Numerics & Indian Currency Formatting:**
  - All numerical values, bay timers, job codes, and currency fields must utilize tabular numerals via `font-feature-settings: "tnum" 1`.
  - Financial figures must strictly honor the Indian numbering system formatting: ₹ followed directly by the amount partitioned as `₹XX,XX,XXX` (e.g., `₹14,980`, `₹1,49,500`, `₹1,499`, `₹999`).
  - The Rupee glyph `₹` renders at standard font weight with a non-breaking space before multi-tiered digit batches.
- **Hierarchy Rules:**
  - Headers utilize negative letter-spacing for structural tension and compactness.
  - Form labels and field trackers are displayed with expanded positive tracking (`0.02em` to `0.04em`) in medium/semibold weight for rapid identification during vehicle intake and dispatch.

## Layout & Spacing

The layout utilizes a fluid 12-column responsive grid underpinned by an 8-point base scale (with 4px sub-increments for tighter UI components):

- **Grid Breakpoints & Structure:**
  - **Mobile (<768px):** 4 fluid columns, `1rem` outer canvas margins, `1rem` gutters. Stacks bay tracking cards, single-column workflow checklists, and full-width actions.
  - **Tablet (768px - 1023px):** 8 fluid columns, `1.5rem` canvas margins, `1.5rem` gutters. Accommodates split detail views (e.g., job sheet on left, inspection checklist on right).
  - **Desktop (≥1024px):** 12 fluid columns, `2.5rem` outer canvas margins, `2rem` gutters. Standard operational layout: collapsed navigation bar (64px) or expanded workbench (240px), 8-column main job grid, 4-column live bay telemetry/billing sidebar.
- **Density Rules:**
  - Shop Floor Mode (Intake & Bay Inspection): Spacing shifts toward `space-lg` to prevent accidental clicks when using touch devices in active workshop environments.
  - Analytics & Billing Mode: Data-dense tables condense padding using `space-xs` and `space-sm` for horizontal metric scanning.

## Elevation & Depth

Visual hierarchy uses a refined hybrid of **Tonal Layering** and **Subtle Boundary Borders**, eliminating heavy artificial drop shadows in favor of crisp darkroom clarity:

- **Ground Level (Elevation 0):** Pure `#09090B`. Houses application backbones, canvas backgrounds, and sidebar rail underlays.
- **Structural Well (Elevation -1):** `#111113`. Used for inset data grids, tabular row backgrounds on hover, and vehicle checklist drop targets.
- **Card Tier (Elevation 1):** `#18181B` bordered by `1px solid rgba(255, 255, 255, 0.08)`. Default surface for vehicle cards, job trackers, inventory sheets, and metric widgets.
- **Overlay & Modal Tier (Elevation 2):** `#27272A` with an ambient glow shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.12)`.
- **Active Focus & Glow:** Interactive focus rings use action blue with a controlled translucent halo: `box-shadow: 0 0 0 2px #09090B, 0 0 0 4px #3B82F6`.
- **Glass Accents:** Sticky header bars and fixed bottom navigation apply `backdrop-filter: blur(12px)` over `rgba(9, 9, 11, 0.85)` surface opacity with a crisp bottom border of `rgba(255, 255, 255, 0.08)`.

## Shapes

The geometric architecture pairs soft precision corners with crisp technical containers:

- **Cards, Panels & Large Containers:** Standardized at `12px` (`rounded-lg` proportional adjustment). This creates a modern structural envelope without looking toy-like or overly casual.
- **Inputs, Buttons, and Data Table Badges:** Standardized at `8px` (`0.5rem`). This provides precise, machine-tooled affordance for all operational form fields and controls.
- **Pill Shapes:** Strictly reserved for status chips (e.g., "In Ceramic Bay", "Water Spot Removal", "Job Closed") and counter capsules, using full radius (`9999px`).

## Components

### Buttons
- **Touch Target:** Mandatory minimum height of `44px` across all primary and secondary actions to accommodate rapid shop-floor input.
- **Primary Gradient CTA:** Applied to hero operations (e.g., "Create Job Card", "Collect Payment"). Background `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)`, text `#FFFFFF`, border `none`, corner radius `8px`. Active state scales down `0.98`.
- **Secondary Action Button:** Background `#3B82F6`, hover `#2563EB`, text `#FFFFFF`, radius `8px`.
- **Outline / Ghost Button:** Background `transparent`, border `1px solid rgba(255, 255, 255, 0.08)`, text `#E4E4E7`, hover background `rgba(255, 255, 255, 0.04)`.

### Input Fields & Controls
- **Text & Select Inputs:** Minimum height `44px`, background `#111113`, border `1px solid rgba(255, 255, 255, 0.08)`, corner radius `8px`, typography `body-md` (`#E4E4E7`). Placeholder color `#71717A`. Active focus invokes border `#3B82F6` and outer ring.
- **Checkboxes & Radios:** Hit area `44px × 44px` with an inner `20px × 20px` control. Border `1.5px solid rgba(255, 255, 255, 0.2)`. Selected state fills with `#3B82F6` featuring high-contrast white glyph indicators.

### Cards & Workflow Containers
- **Base Card:** Background `#18181B`, border `1px solid rgba(255, 255, 255, 0.08)`, radius `12px`, padding `space-lg`.
- **Job Bay Progress Card:** Features a vehicle model title (`#FFFFFF`), customer metadata (`#A1A1AA`), assigned detailer avatar, and a linear progress tracker with the brand gradient.

### Status Chips & Badges
- **Structure:** Height `26px`, padding `0 10px`, radius `9999px`, font size `label-sm`.
- **Variants:**
  - *Success / Delivered:* Background `rgba(52, 211, 153, 0.12)`, text `#34D399`, border `1px solid rgba(52, 211, 153, 0.25)`.
  - *Warning / In Coating Bay:* Background `rgba(251, 191, 36, 0.12)`, text `#FBBF24`, border `1px solid rgba(251, 191, 36, 0.25)`.
  - *Critical / Dent Pending:* Background `rgba(248, 113, 113, 0.12)`, text `#F87171`, border `1px solid rgba(248, 113, 113, 0.25)`.

### Specialized Automotive Domain Components
- **Vehicle Inspection Mark-Up Pad:** Contrast-heavy vehicle schematic silhouette set on `#111113`, supporting interactive pin markers with semantic color-coding (scratch, paint defect, swirl marks).
- **Service Billing Breakdown Table:** Data-dense tabular list with zebra styling on `#18181B` and `#111113`, right-aligned monetary values rendering currency metrics with `font-feature-settings: "tnum" 1` and clean Indian format (`₹XX,XXX`).