---
name: Precision Auto Tech
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
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
  surface-card: '#18181B'
  surface-alt: '#111113'
  surface-border: rgba(255, 255, 255, 0.08)
  text-primary: '#FFFFFF'
  text-body: '#E4E4E7'
  text-secondary: '#A1A1AA'
  status-success: '#34D399'
  status-warning: '#FBBF24'
  status-error: '#F87171'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
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
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system defines a technical, high-performance SaaS operating environment tailored for Indian automotive detailing studios, car spas, and multi-outlet franchises. The visual aesthetic fuses dark-mode utility with automotive precision engineering—evoking professional workshop terminals, clean telemetry panels, and high-velocity workflow control.

The visual direction centers on **Technical Minimalism with Tactile Precision**:
- High-contrast, pitch-black canvases minimize eye fatigue during long desk shifts and grease-lit showroom floors.
- Sharp, semi-transparent hairline borders delineate modular modules without heavy ornamentation.
- Controlled energetic highlights (electric blues and high-octane crimson gradients) guide transactional velocity—creating an authoritative, reliable atmosphere for enterprise shop managers and frontline service advisors.

## Colors

The system uses a pure, high-depth dark architecture. Canvases are anchored by `#09090B`, elevated by a foundational card surface at `#18181B`, and supported by sub-surfaces and table stripes at `#111113`. Outlines strictly utilize a fine line of `1px solid rgba(255, 255, 255, 0.08)` to maintain visual definition across various screen calibrations.

### Accent & Status Applications
- **Primary Action Blue (`#3B82F6`):** Drives standard system actions, interactive states, links, and operational toggles. The active hover state steps down to `#2563EB`.
- **Signature Conversion Gradient:** `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)` is strictly reserved for the brand logo mark, hero checkout actions, and primary annual subscription conversion triggers.
- **Operational Status Tokens:**
  - `status-success` (`#34D399`): Vehicle delivered, payment collected via UPI/Card, bay cleared.
  - `status-warning` (`#FBBF24`): Inspection pending, estimate awaiting approval, low chemical inventory.
  - `status-error` (`#F87171`): Job overdue, failed invoice push, system disconnect.

### Typography Colors
- Headers and key metric figures strictly leverage pure white (`#FFFFFF`) to ensure uncompromised prominence.
- Standard body reading lines rely on `#E4E4E7`, maintaining full WCAG AA legibility against the deep dark card levels.
- Captions, column headings, and secondary data strings sit at `#A1A1AA`.

## Typography

Typography relies on `Inter` across all functional hierarchies. Numerical data, currency values (₹), vehicle registration marks (e.g., `TN 09 CB 1234`), and invoice numbers use tabular figures (`font-variant-numeric: tabular-nums`) to ensure strict columnar vertical alignment inside financial data tables and job card workflows.

Headlines employ slight negative letter tracking (`-0.01em` to `-0.02em`) to generate dense, authoritative visual anchors for subscription package titles and dashboard metric cards.

## Layout & Spacing

The layout is built around a flexible 12-column grid system for large desktop terminals, reflowing into an 8-column setup on tablets and a single fluid column on mobile shop floor devices.

### Grid & Breakpoints
- **Desktop (1200px+):** 12-column grid, 24px (`1.5rem`) gutters, 32px (`2rem`) margins. Max container constraint capped at 1440px for broad administrative overviews.
- **Tablet / Android POS (768px - 1199px):** 8-column layout, 16px gutters, 24px margins. Ideal for bay assignment tablets and counter terminals.
- **Mobile Handheld (360px - 767px):** Single vertical stream, 16px margins, minimum tap target scale enforced across all interactive boundaries.

### Rhythm Principles
- Component groupings utilize structural gaps derived from the standard base 8 unit: 4px (`space-xs`), 8px (`space-sm`), 16px (`space-md`), 24px (`space-lg`), and 32px (`space-xl`).
- High-density tabular sections (e.g., live job cards, inventory audits) condense row heights while maintaining adequate horizontal padding to allow scanability in busy workshop environments.

## Elevation & Depth

Depth is articulated through tonal layering and delicate ambient surface borders rather than heavy drop shadows:

1. **Base Layer (0dp):** Canvas `#09090B`. Houses primary background structure and navigation sidebars.
2. **Surface Layer (1dp):** `#18181B` combined with `1px solid rgba(255, 255, 255, 0.08)`. Applied to standard content cards, billing matrices, and job card status boards.
3. **Floating Overlays & Modals (2dp):** Surface elevated to `#1F1F23`, encapsulated by `1px solid rgba(255, 255, 255, 0.14)` and an ambient shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.65)`.
4. **Interactive Overlays:** Toast alerts, vehicle lookup drop-downs, and date pickers use a dark, semi-translucent backdrop filter (`backdrop-filter: blur(12px)`) over a `#18181B/90%` tinted substrate.

## Shapes

The design system implements a controlled shape hierarchy:
- **Cards, Modals & Metric Containers:** 12px border radius (`rounded-lg` contextual treatment). This creates a contemporary structure that keeps large data sets organized without appearing overly aggressive.
- **Interactive Controls (Buttons, Inputs, Selects):** 8px border radius (`rounded-md` equivalent under scale 2). Ensures controls look actionable and distinct from their parent containers.
- **Status Pills & Micro Indicators:** Full pill radius (`rounded-full` / `9999px`) to immediately denote non-editable system states, bay assignments, and tags.

## Components

### Buttons
- **Primary Action:** Solid `#3B82F6` fill, white `#FFFFFF` text, 8px border radius, 44px min height. On hover, background shifts to `#2563EB`. Active state scales down slightly (`scale(0.98)`).
- **Brand CTA / Subscription Highlight:** Background styled with `linear-gradient(135deg, #2563EB 0%, #EF4444 100%)`, `#FFFFFF` label text, 48px height, subtle radial glow on hover (`box-shadow: 0 4px 20px rgba(37, 99, 235, 0.35)`).
- **Secondary / Outline:** Background transparent, border `1px solid rgba(255, 255, 255, 0.12)`, text `#E4E4E7`. Hover: background fills with `rgba(255, 255, 255, 0.05)`, border shifts to `rgba(255, 255, 255, 0.25)`.
- **Destructive:** Background `rgba(248, 113, 113, 0.1)`, border `1px solid rgba(248, 113, 113, 0.3)`, text `#F87171`. Hover: background turns to `#F87171`, text turns `#FFFFFF`.

### Input Fields & Controls
- **Text Inputs & Dropdowns:** 44px minimum touch height, background `#111113`, border `1px solid rgba(255, 255, 255, 0.08)`, text `#E4E4E7`, placeholder `#71717A`.
- **Focus State:** Border color switches to `#3B82F6` with a `0 0 0 1px #3B82F6` outer ring.
- **Checkboxes & Radios:** 20px x 20px dimensions, matching dark background, checking to `#3B82F6` with white SVG icons.

### Status Chips & Badges
- Pill-shaped (`border-radius: 9999px`), padding `4px 10px`, font size `12px`, font weight `500`.
- **Washing / Detailing In-Progress:** Background `rgba(59, 130, 246, 0.15)`, text `#60A5FA`.
- **Job Completed:** Background `rgba(52, 211, 153, 0.15)`, text `#34D399`.
- **Approval Pending:** Background `rgba(251, 191, 36, 0.15)`, text `#FBBF24`.
- **Overdue:** Background `rgba(248, 113, 113, 0.15)`, text `#F87171`.

### Data Cards & Job Cards
- Background `#18181B`, border `1px solid rgba(255, 255, 255, 0.08)`, 12px border radius, padding `20px`.
- Vehicle plate containers display registration marks with high contrast (e.g., `#111113` surface, `#FFFFFF` mono-tracked text, subtle 4px corner radius).

### Financial Displays & Invoices
- Indian Rupee symbol (`₹`) is explicitly paired with localized Indian numbering formatting (e.g., `₹1,50,000` rather than western millions grouping).
- GST breakdown rows leverage `#A1A1AA` secondary typography with right-aligned tabular numbers.