---
name: Kinetic Clarity
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
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#712ae2'
  on-secondary: '#ffffff'
  secondary-container: '#8a4cfc'
  on-secondary-container: '#fffbff'
  tertiary: '#004d70'
  on-tertiary: '#ffffff'
  tertiary-container: '#006693'
  on-tertiary-container: '#b8e0ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
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
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses a refined, high-trust visual language tailored for modern enterprise workflows and fast-moving teams. The personality centers on precision, momentum, and composure. The interface balances high-velocity B2B efficiency with welcoming tactile polish to reduce cognitive friction during onboarding.

The aesthetic blends **Modern Corporate** structure with **Subtle Dimensionality**:
- **Structured Precision:** Crisp geometry, clear optical hierarchy, and uncompromising contrast ensure rapid comprehension on both handheld and wide desktop screens.
- **Refined Materiality:** Pure white elevated cards sit against cool slate-tinted canvas backdrops, grounded by calibrated ambient shadows rather than harsh physical lines.
- **Dynamic Energy:** Focused focal points leverage an electric indigo-to-violet spectrum to draw user intent directly toward forward progression and primary calls-to-action.

## Colors

The color architecture is built to maximize legibility and signal clarity across onboarding flows:

- **Primary & Secondary (`#4F46E5` & `#7C3AED`):** Form the signature brand gradient and actionable focal points. Used on primary buttons, active steps, brand glyphs, and focus indicators.
- **Tertiary (`#0EA5E9`):** Reserved for contextual helpers, informational badges, and auxiliary progress markers.
- **Neutral (`#0F172A`):** Deep slate-900 baseline for primary headlines and high-contrast text, scaling down to cool slate-500 (`#64748B`) for metadata and slate-200 (`#E2E8F0`) for hair-width borders.
- **Surfaces:** Canvas background uses Slate-50 (`#F8FAFC`), while foreground interaction modules and cards utilize pristine white (`#FFFFFF`) to ensure maximum figure-ground separation.
- **System Feedback:** Error states rely on Red-500 (`#EF4444`) with accompanying Red-50 (`#FEF2F2`) tint fills for accessibility and unambiguous status confirmation.

## Typography

Plus Jakarta Sans governs the entire system to deliver crisp, contemporary geometry combined with humanist softness. It maintains optimal legibility across density tiers:

- **Display & Headlines:** Tightly tracked headings (-0.02em to -0.03em) establish confident hierarchy without overpowering compact mobile viewports.
- **Body:** Sized for rapid scanning and instructional clarity, paired with relaxed line heights (1.5x–1.6x) to avoid eye strain during complex data entry.
- **Labels & Microcopy:** Enhanced letter-spacing on small caps and badges ensures small-footprint legibility on form validation tags and assistive labels.

## Layout & Spacing

A mobile-first fluid layout governs the screen structure:
- **Mobile (<768px):** Single-column flow with `1rem` outer canvas padding. Interactive cards expand across full available width to maximize tap target safety.
- **Tablet (768px - 1024px):** Centers onboarding cards within an 8-column layout with `2rem` screen margins.
- **Desktop (>1024px):** Dual-zone arrangement featuring a 12-column grid. The primary form card occupies a locked maximum width (typically 480px–560px) either centered or paired with a dynamic contextual sidebar highlighting progress and platform social proof.

All vertical and internal component rhythms strictly adhere to 4px/8px modular pacing (`space-xs` through `space-xl`).

## Elevation & Depth

Visual hierarchy uses a refined layering system combining ambient shadows with low-contrast micro-borders:

- **Level 0 (Canvas):** Flat Slate-50 background (`#F8FAFC`).
- **Level 1 (Card / Rest):** Pure white surface framed with a 1px solid Slate-200/80 outline (`rgba(226, 232, 240, 0.8)`) backed by a diffused multi-stop shadow:
  - `0 1px 3px rgba(15, 23, 42, 0.04), 0 10px 24px -4px rgba(15, 23, 42, 0.06)`
- **Level 2 (Dropdowns / Flyouts):** Overlays use deeper z-index lift:
  - `0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 20px 32px -4px rgba(15, 23, 42, 0.1)`
- **Level 3 (Focused Active Fields):** Visual pop achieved through an indigo-tinted glow ring:
  - `0 0 0 3px rgba(79, 70, 229, 0.18)`

## Shapes

The interface implements a balanced geometric curvature (`roundedness: 2`):
- **Small Controls (Buttons, Inputs, Badges):** 0.5rem (8px) border-radius creates tactile, friendly click and touch surfaces.
- **Containers & Onboarding Cards:** 1rem (16px) radius softens larger surfaces while preserving crisp architectural integrity.
- **Pills / Status Chips:** Full pill radius (`9999px`) reserved strictly for transient badges, phase pills, and active step counter chips.

## Components

### Form Cards
- **Base:** Pure white fill, 16px radius, subtle border (`#E2E8F0`), elevated via Level 1 shadow. Mobile displays full-width padding (`1.25rem`); desktop cards provide spacious breathing room (`2.5rem`).

### Input Fields
- **Default:** Slate-50 surface fill, 1px border (`#CBD5E1`), 8px radius, 44px minimum touch height on mobile. Label placed above in `label-lg` Slate-700.
- **Filled:** Pure white surface fill, 1px border (`#94A3B8`), Slate-900 text.
- **Focus:** Pure white surface, 1px border (`#4F46E5`), reinforced by an indigo focus ring (`0 0 0 3px rgba(79, 70, 229, 0.18)`).
- **Error:** 1px border (`#EF4444`), accompanied by an inline alert icon (16px) and microcopy in `label-sm` (`#DC2626`). Focus maintains a soft red glow (`0 0 0 3px rgba(239, 68, 68, 0.15)`).

### Buttons
- **Primary:** Linear brand gradient (135deg, `#4F46E5` to `#7C3AED`), white text (`label-lg`), subtle inner top highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.2)`), active downward scale transition (0.985).
- **Secondary / Ghost:** Transparent base, 1px border (`#E2E8F0`), Slate-700 text, hover shifts to Slate-100 fill.

### Progress Steps & Chips
- Step indicators render as compact pills or connected dot tracks. Active state utilizes indigo tint fills (`#EEF2FF`) with `#4F46E5` typography and iconography; completed steps show a subtle check icon with emerald or indigo tint.

### Checkboxes & Radios
- 20px dimensional square (checkbox) or circle (radio), 1.5px border (`#CBD5E1`). Checked state fills with `#4F46E5` and snaps an animated pure white glyph inside.