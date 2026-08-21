# Car Spa Management Suite

Professional billing, car detailing and automotive service management system for Windows desktop.

## Technology Stack

- **Desktop**: Electron + React + TypeScript + Vite + Tailwind CSS
- **Backend**: ASP.NET Core 10 Web API + PostgreSQL
- **State**: Zustand (client) + TanStack Query (server)
- **Forms**: React Hook Form + Zod
- **Tables**: TanStack Table
- **Charts**: Recharts
- **Icons**: Material Symbols Outlined (Stitch) + Lucide React (supplementary)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development (renderer)
pnpm dev

# Run Electron
pnpm dev:electron

# Build everything
pnpm build:all

# Run tests
pnpm test
```

## Architecture

```
CarSpaManagement/
├── apps/
│ └── desktop/
│ ├── electron/ # Electron main process
│ └── renderer/ # React renderer
├── backend/
│ └── api/ # ASP.NET Core Web API
├── packages/
│ ├── design-tokens/ # Stitch design tokens
│ ├── shared-types/ # Shared TypeScript types
│ └── shared-validation/ # Zod schemas
└── tests/
```

## Step 1 Scope

Application shell + Stitch UI integration + API foundation. No business logic.

See [CLAUDE.md.md](./CLAUDE.md.md) for full specifications.
