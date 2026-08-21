# CAR SPA MANAGEMENT — STEP 1
## Electron Desktop Foundation + Stitch UI Integration

You are the lead software architect and senior full-stack developer for a new production-grade Windows desktop application called:

**CAR SPA MANAGEMENT**

This is a professional billing, car detailing and automotive service management system.

We already designed and approved the UI in **Google Stitch**.

The Stitch UI is the **visual source of truth**.

The Stitch export ZIP is available in the project/workspace.

**IMPORTANT:**

Before writing application UI code, inspect the Stitch export thoroughly.

Use the Stitch screens, generated HTML/CSS, assets and design documentation as the reference for implementing the desktop UI.

DO NOT redesign the UI.

DO NOT replace the UI with a generic template.

DO NOT create a different dashboard design.

DO NOT invent a different visual language.

Reproduce the approved Stitch design as closely as practical using React, TypeScript, Tailwind CSS and reusable components.

The application will eventually have:

1. Windows desktop application
2. Android application

For this first phase, build only the **Windows desktop application foundation**.

The Android application will be developed later using Flutter and will consume the same ASP.NET Core API.

---

# 1. FINAL TECHNOLOGY STACK

## Windows Desktop

Use:

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui where appropriate
- Lucide React icons

Package the application as a Windows `.exe`.

Use Electron's secure architecture.

The React renderer must NOT have unrestricted Node.js access.

Use:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` where compatible
- preload script
- controlled `contextBridge`

Do not expose unnecessary Electron APIs to the renderer.

---

# 2. BACKEND

Use:

- ASP.NET Core Web API
- .NET 10 LTS
- C#
- REST API
- OpenAPI / Swagger

The Electron application must communicate with the backend through HTTP APIs.

The Electron application must NOT directly access PostgreSQL.

Architecture:

Electron Desktop
        ↓
ASP.NET Core Web API
        ↓
Application Layer
        ↓
Infrastructure
        ↓
PostgreSQL

The future Android application will use exactly the same backend API.

---

# 3. DATABASE

Use:

- PostgreSQL
- Entity Framework Core
- Npgsql

Use Fluent API configurations.

Do not expose EF Core entities directly through the API.

Use DTOs.

Do not create the complete business database schema during this foundation phase.

Only create the minimum infrastructure necessary to establish:

- PostgreSQL connection
- EF Core DbContext
- Dependency injection
- Database configuration
- Migration infrastructure
- Health check

The complete domain/database design will be created in a separate phase before implementing the business modules.

---

# 4. ARCHITECTURE

Use a clean, maintainable architecture.

Repository structure:

```text
CarSpaManagement/
│
├── apps/
│   │
│   └── desktop/
│       │
│       ├── electron/
│       │
│       └── renderer/
│
├── backend/
│   │
│   └── api/
│
├── packages/
│   │
│   ├── shared-types/
│   ├── shared-validation/
│   └── design-tokens/
│
├── docs/
│
├── tests/
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

If you determine that a slightly different structure is technically better, explain the reason before making a major architectural change.

Do not create unnecessary complexity.

---

# 5. FRONTEND ARCHITECTURE

Use:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Lucide React

Use a feature-oriented structure.

Recommended:

```text
renderer/
│
├── src/
│   │
│   ├── app/
│   │
│   ├── components/
│   │
│   ├── features/
│   │   ├── dashboard/
│   │   ├── customers/
│   │   ├── job-cards/
│   │   ├── quotations/
│   │   ├── invoices/
│   │   ├── catalogue/
│   │   ├── staff-advances/
│   │   ├── reports/
│   │   ├── showroom/
│   │   └── settings/
│   │
│   ├── layouts/
│   ├── hooks/
│   ├── services/
│   ├── api/
│   ├── types/
│   ├── utils/
│   ├── styles/
│   └── assets/
```

Do not create one giant component file.

Keep components modular and reusable.

---

# 6. STATE MANAGEMENT

Use Zustand for client-side application state where appropriate.

Do not put every piece of state into a global store.

Use local React state for local UI state.

Prepare the application for server-state management.

Use TanStack Query when implementing API-driven modules.

Do not implement complex state management prematurely during this foundation phase.

---

# 7. FORMS AND VALIDATION

Use:

- React Hook Form
- Zod

Prepare reusable form patterns.

All future business forms should have:

- Client-side validation
- Clear validation messages
- Consistent error states
- Accessible controls

Do not implement the complete business forms yet.

---

# 8. TABLES

Use:

- TanStack Table

The application will contain many data-heavy screens.

Tables must support future:

- Sorting
- Filtering
- Pagination
- Column visibility
- Row actions
- Selection where required

Do not implement all advanced features in placeholder screens yet.

Prepare reusable table components.

---

# 9. CHARTS

Use:

- Recharts

Prepare reusable chart components for future:

- Sales
- Revenue
- Jobs
- Services
- Payments
- Staff performance

Do not create fake business analytics yet.

---

# 10. PDF

The application will eventually generate:

- Quotations
- Invoices
- Payment receipts
- Reports

Do not implement the complete PDF system during this foundation phase.

Prepare an appropriate service boundary for PDF generation.

---

# 11. CORE BUSINESS MODULES

The application will eventually contain:

1. Dashboard
2. Customer Management
3. Job Card Management
4. New Job Card
5. Job Card Details
6. Quotations & Invoices
7. Invoice Editor
8. Service Catalogue
9. Staff Advances
10. Reports & Analytics
11. Showroom
12. Settings

There will also be:

- Authentication
- Users
- Roles
- Permissions
- Notifications
- Audit logging
- Application settings

Do not implement the complete functionality of these modules during Step 1.

Only establish the application shell and navigation.

---

# 12. IMPORTANT BUSINESS WORKFLOW

The primary business workflow is:

```text
Customer
    ↓
Vehicle
    ↓
Job Card
    ↓
Vehicle Inspection
    ↓
Services
    ↓
Quotation
    ↓
Customer Approval
    ↓
Work
    ↓
Quality Check
    ↓
Ready
    ↓
Invoice
    ↓
Payment
    ↓
Vehicle Delivered
```

IMPORTANT:

Staff assignment is NOT required during initial Job Card creation.

The New Job Card workflow should NOT contain staff assignment.

Staff can be assigned later from Job Card Details.

Do not add staff selection to New Job Card unless explicitly instructed later.

---

# 13. STITCH UI — VERY IMPORTANT

Before implementing the React UI:

1. Locate the Stitch export.
2. Inspect every screen.
3. Inspect every `code.html`.
4. Inspect screenshots.
5. Inspect `DESIGN.md` or equivalent design documentation.
6. Identify the existing:
   - Colors
   - Typography
   - Spacing
   - Border radius
   - Shadows
   - Sidebar
   - Header
   - Buttons
   - Cards
   - Tables
   - Forms
   - Status badges
   - Icons
   - Layout patterns
7. Identify reusable design patterns.
8. Do not unnecessarily duplicate components.

The currently approved Stitch screens include:

- Customer Management
- Invoice Editor
- Job Card Details
- Job Card Management — Table View
- Main Dashboard
- New Job Card — No Staff
- Quotations & Invoices
- Reports & Analytics Dashboard
- Service Catalogue
- Settings Module
- Staff Advances Management

There is also a design specification/enterprise design reference in the Stitch export.

Treat the current Stitch version as approved.

Do not redesign it.

---

# 14. DESKTOP UI REQUIREMENTS

This is a Windows desktop application, not a website.

Design and implement for:

Primary target:

**1920 × 1080**

Must remain usable at:

**1366 × 768**

The application should behave like professional desktop business software.

Use:

- Persistent left sidebar
- Desktop-sized tables
- Multi-column layouts
- Resizable content areas
- Scrollable content areas
- Desktop form layouts
- Keyboard-friendly controls
- Mouse-friendly controls
- Toolbars
- Modal dialogs where appropriate
- Context menus where appropriate
- Proper desktop information density

Do NOT use mobile navigation.

Do NOT use bottom navigation.

Do NOT make cards unnecessarily large.

Do NOT make the application look like a marketing website.

The user may use this application for many hours every day.

Prioritize:

- Speed
- Clarity
- Information density
- Readability
- Consistency
- Keyboard/mouse usability

---

# 15. APPLICATION SHELL

Create the main Electron application shell based on the Stitch design.

The shell should contain:

Left navigation:

- Dashboard
- Customers
- Job Cards
- Quotations & Invoices
- Catalogue
- Staff Advances
- Reports
- Showroom

Bottom:

- Settings

Header:

- Page title
- Breadcrumb where appropriate
- Global search where appropriate
- Notifications
- Current user/profile
- Contextual action buttons

The sidebar, header and page layout must be reusable.

---

# 16. ROUTING

Use a proper React routing solution.

Create routes for:

```text
/dashboard
/customers
/job-cards
/quotations-invoices
/catalogue
/staff-advances
/reports
/showroom
/settings
```

Prepare routes for:

```text
/customers/:id
/job-cards/new
/job-cards/:id
/quotations/:id
/invoices/:id
```

The detailed pages can initially be placeholders.

Do not implement their business functionality yet.

---

# 17. INITIAL PAGES

Create the following pages:

```text
Dashboard
Customers
Job Cards
Quotations & Invoices
Catalogue
Staff Advances
Reports
Showroom
Settings
```

The pages should use the actual Stitch visual language.

Do NOT create generic placeholder cards.

If a page is not yet fully implemented, use a clean page shell consistent with the Stitch design.

---

# 18. REUSABLE COMPONENTS

Create reusable components where they are genuinely useful.

Examples:

- AppShell
- Sidebar
- Header
- PageHeader
- KPI Card
- Status Badge
- Search Box
- Primary Button
- Secondary Button
- Icon Button
- Data Table
- Empty State
- Loading State
- Error State
- Confirmation Dialog
- Modal
- Toast/Notification
- Customer Card
- Vehicle Card
- Job Status Indicator
- Form Field
- Date Picker
- Dropdown
- Tabs

Do not create abstractions simply for the sake of abstraction.

Follow the Stitch design.

---

# 19. DESIGN TOKENS

Create centralized design tokens for:

- Colors
- Typography
- Spacing
- Border radius
- Shadows
- Transitions

Use the actual values derived from the Stitch design wherever possible.

Do not arbitrarily invent a new color palette.

Avoid hard-coded styles scattered throughout components.

---

# 20. ELECTRON SECURITY

Configure Electron securely.

Required:

```text
nodeIntegration: false
contextIsolation: true
sandbox: true
```

Use a preload script.

Use `contextBridge` only for explicitly required functionality.

Do NOT expose the entire Node.js API to React.

Do NOT allow arbitrary renderer-to-main IPC.

Validate IPC inputs.

Do not load arbitrary remote content.

Use a restrictive Content Security Policy where practical.

Do not disable Electron security warnings simply to make development easier.

Keep Electron dependencies current.

---

# 21. ELECTRON PROJECT STRUCTURE

Use something similar to:

```text
apps/desktop/electron/

├── src/
│   ├── main/
│   │   ├── main.ts
│   │   ├── windows/
│   │   ├── ipc/
│   │   └── services/
│   │
│   └── preload/
│       └── preload.ts
│
├── electron-builder.yml
└── package.json
```

The renderer should remain separate from Electron main-process code.

React must not import Electron main-process modules directly.

---

# 22. API FOUNDATION

Create the ASP.NET Core API project.

Initially implement only:

```text
GET /api/health
```

Example response:

```json
{
  "status": "healthy"
}
```

Configure:

- OpenAPI/Swagger
- Dependency Injection
- PostgreSQL configuration
- EF Core
- Health checks
- Centralized exception handling
- Structured logging
- CORS for local Electron development

Do not implement business APIs yet.

---

# 23. DOMAIN FOUNDATION

Create the domain structure:

```text
Domain/
├── Entities/
├── Enums/
├── ValueObjects/
└── Common/
```

Create only the minimum base entity infrastructure.

A base entity may contain:

```text
Id
CreatedAt
UpdatedAt
```

Do not prematurely create every business entity.

The full database/domain model will be designed separately before implementation.

---

# 24. APPLICATION FOUNDATION

Create:

```text
Application/
├── Features/
│   ├── Customers/
│   ├── Vehicles/
│   ├── JobCards/
│   ├── Quotations/
│   ├── Invoices/
│   ├── Catalogue/
│   ├── StaffAdvances/
│   ├── Reports/
│   └── Settings/
│
├── Interfaces/
└── Common/
```

Use feature-oriented organization.

Do not create one enormous Services folder.

---

# 25. INFRASTRUCTURE

Create:

```text
Infrastructure/
├── Database/
├── Configurations/
├── Migrations/
├── Repositories/
└── Services/
```

Configure:

- PostgreSQL
- EF Core
- Npgsql
- Dependency injection
- Fluent API

Prepare migrations.

Do not create the complete business schema yet.

---

# 26. CONFIGURATION

Do not hard-code:

- Database passwords
- API URLs
- Secrets
- WhatsApp credentials
- JWT secrets
- Encryption keys

Use environment/configuration mechanisms.

Prepare:

```text
appsettings.json
appsettings.Development.json
```

The Electron API base URL must be configurable.

Never commit secrets.

---

# 27. LOGGING

Use structured logging.

Prepare Serilog on the backend.

Log:

- API startup
- Application startup
- API requests where appropriate
- Database errors
- Unexpected exceptions
- Important system events

Never log:

- Passwords
- Access tokens
- API secrets
- Database passwords
- Sensitive customer information unnecessarily

---

# 28. TESTING

Prepare:

Frontend:

- Vitest

End-to-end:

- Playwright

Backend:

- xUnit

Create the basic test project structure.

Do not spend time writing large numbers of business tests yet.

At minimum, verify:

- API health endpoint
- Basic application startup
- Basic renderer startup

---

# 29. PACKAGE MANAGEMENT

Use:

**pnpm**

Use a workspace/monorepo structure if appropriate.

Keep dependencies organized.

Do not install unnecessary libraries.

Before adding a package, consider whether an existing dependency or native platform capability is sufficient.

---

# 30. GIT

Create a clean Git repository structure.

Use an appropriate `.gitignore`.

Do not commit:

- node_modules
- build output
- `.env`
- secrets
- database credentials
- generated installers
- temporary files

Create a useful README.

---

# 31. WINDOWS BUILD

Prepare the Electron project to eventually produce:

```text
CarSpaManagement-Setup.exe
```

Use Electron Builder or an equivalent maintained packaging solution.

Do not spend time creating the final installer yet.

At this stage, verify that the Electron application can run in development mode and can be packaged successfully if practical.

---

# 32. IMPORTANT DEVELOPMENT RULES

Work incrementally.

Do not implement the entire application in one pass.

Do not create fake business functionality just to make screens appear complete.

Do not create fake database records that could later be mistaken for real application data.

Do not implement Customer, Job Card, Invoice or Payment business logic during Step 1.

Do not redesign the Stitch UI.

Do not change the overall architecture without explaining why.

If an architectural change is required, explain:

1. What needs to change
2. Why it is necessary
3. What alternatives were considered
4. What impact it has

Then wait for approval before making a major architectural change.

---

# 33. STEP 1 ACCEPTANCE CRITERIA

When finished, the following must work:

### Backend

- ASP.NET Core API builds
- API starts successfully
- PostgreSQL configuration is wired
- EF Core is configured
- `/api/health` returns healthy
- Swagger/OpenAPI loads
- Exception handling works
- Logging works

### Electron

- Electron starts
- React renderer starts
- Electron security configuration is enabled
- Main window opens
- App shell is displayed
- Sidebar works
- Header works
- Navigation works
- All major module routes load
- Stitch visual language is reproduced
- No major console errors

### Pages

These routes must open:

```text
/dashboard
/customers
/job-cards
/quotations-invoices
/catalogue
/staff-advances
/reports
/showroom
/settings
```

### Build

The frontend must build successfully.

The backend must build successfully.

The Electron application must run successfully.

Fix reasonable compilation/build errors before stopping.

---

# 34. FINAL STEP 1 REPORT

When finished, report:

1. Project structure created
2. Technologies installed
3. Electron version
4. Node.js version
5. .NET version
6. PostgreSQL configuration status
7. API health result
8. Electron startup result
9. Routes created
10. Stitch screens/components inspected
11. Reusable components created
12. Any deviations from Stitch
13. Any warnings/errors remaining
14. Exact commands used to run the application
15. Exact commands used to build the application

Then STOP.

Do NOT proceed to Customer Management.

The next instruction will be provided separately.

The next development phase will be:

**STEP 2 — Domain, Database and Customer/Vehicle architecture.**