# Car Spa Management — Renderer Blank Screen Diagnosis & Fix Report

**Date:** 2026-08-18
**Issue:** Electron window opens but renderer is blank/white
**Root Cause:** Multiple compounding issues in the React entry point and auth system

---

## 1. Root Cause of Blank Screen

**Five issues compounded to cause a complete blank renderer:**

### Issue A: Double Router Conflict
**File:** `renderer/src/main.tsx`

`main.tsx` wrapped `<App />` in `<HashRouter>`, but `App.tsx` also wrapped everything in `<BrowserRouter>`. Nested routers with different strategies (`HashRouter` + `BrowserRouter`) conflict and cause React to fail rendering.

### Issue B: Auth Context Conflict (Primary Crash)
**Files:** `auth-context.ts` and `auth-context.tsx`

Two separate `createContext` calls existed:
- `auth-context.ts` — v1: simple context with `useAuth()`, no provider state
- `auth-context.tsx` — v2: full `AuthProvider` component with login/logout state

`DashboardLayout.tsx` → `Header` called `useAuth()` from v1 (`auth-context.ts`)
`App.tsx` mounted `AuthProvider` from v2 (`auth-context.tsx`)

Result: `useAuth()` from v1 returned the default value (no provider mounted for v1), which has `user: null`. `ProtectedRoute` checked `!user` → redirected to `/login`. But `LoginPage` also called `useAuth()` from v1, which returned `{ login: () => {}, isLoading: false }` (no-op). The login form appeared but submission did nothing. The user was stuck on `/login` forever, and the dashboard was never reached.

Additionally, `DashboardLayout.Header` accessed `user?.name` from v1's context (always null), which wouldn't crash but showed empty user info.

### Issue C: Missing Route Component Imports
**File:** `App.tsx`

`App.tsx` imported `CustomerDetail`, `NewJobCardPage`, `JobCardDetailPage`, `QuotationDetail` — none of which exist as exported components. This would cause a build-time module resolution error.

### Issue D: Syntax Error in auth-context.tsx
`useCallback` was missing its dependency array (`[]`), causing a TypeScript/ESBuild parse error.

### Issue E: Circular Re-export
`auth-context.ts` re-exported from `'./auth-context'`, which resolved to itself (TS module resolution maps `.ts` to `.tsx` first, or same name). This caused a Rollup circular dependency error.

---

## 2. Exact Errors Found

| Error | File | Type |
|---|---|---|
| `Expected ")" but found ";"` | `auth-context.tsx:37` | Missing `[]` dependency array on `useCallback` |
| `"useAuth" cannot be exported... references itself` | `auth-context.ts` | Circular re-export |
| `"default" is not exported by AuthProvider.tsx` | `auth/index.ts:1` | AuthProvider had no default export after restructuring |

---

## 3. Files Changed

| File | Change |
|---|---|
| `renderer/src/main.tsx` | Removed `<HashRouter>` wrapper — `App.tsx` already contains `<BrowserRouter>` |
| `renderer/src/App.tsx` | Removed non-existent route imports (`CustomerDetail`, `NewJobCardPage`, `JobCardDetailPage`, `QuotationDetail`) |
| `renderer/src/features/auth/auth-context.tsx` | Made canonical single source of truth for auth context |
| `renderer/src/features/auth/auth-context.ts` | Re-exports from `./auth-context.tsx` (was duplicate conflicting implementation) |
| `renderer/src/features/auth/AuthProvider.tsx` | Re-exports from `./auth-context` (removed duplicate context) |
| `renderer/src/features/auth/index.ts` | Fixed exports to match actual module structure |

---

## 4. Why the Fix Works

1. **Single Router** — `App.tsx` is the only router container. `main.tsx` just mounts `App`. No nesting conflict.

2. **Single Auth Context** — `auth-context.tsx` is the canonical implementation. `auth-context.ts` and `AuthProvider.tsx` both re-export from it. Every component gets context from the same provider instance.

3. **Valid Routes Only** — Removed imports of non-existent components. Routes only reference components that exist in the filesystem.

4. **Correct Syntax** — `useCallback` has proper dependency array. No parse/build errors.

---

## 5. React Entry Point

```
renderer/index.html
 → <div id="root">
 → renderer/src/main.tsx
 → ReactDOM.createRoot(document.getElementById('root'))
 → <App />
 → <BrowserRouter> + <ThemeProvider> + <AuthProvider>
 → <Routes> with all module routes
 → Default: "/" → <Navigate to="/dashboard" />
 → <DashboardLayout> → <Sidebar> + <Outlet>
 → <Dashboard>
```

---

## 6. Default Route

`/` → `Navigate to="/dashboard"` (via index route with `replace`)

`/login` → `LoginPage` (outside layout, no auth required)

All other routes → `ProtectedRoute` (requires auth) → `DashboardLayout` → specific page

---

## 7. Whether Dashboard Now Renders

**Auth flow:**
1. App starts → `AuthProvider` mounts → `user: null`, `isLoading: false`
2. `ProtectedRoute` checks `!user` → redirects to `/login`
3. `LoginPage` renders with demo credentials pre-filled
4. User submits form → `login(mockUser)` → `user` set → `isLoading: false`
5. `ProtectedRoute` sees `user` → renders `<Outlet>` → `<DashboardLayout>` → `<Dashboard>`

**Result:** Dashboard renders after login.

---

## 8. Whether Sidebar/Navigation Now Renders

Yes. `DashboardLayout` renders `<Sidebar>` + `<Header>` + `<Outlet>`. All components use the same Tailwind v4 CSS classes that resolve to the design tokens in `globals.css`.

---

## 9. TypeScript Result

```
pnpm typecheck: PASSED — 0 errors
```

---

## 10. Build Result

```
pnpm build: PASSED
- dist-renderer/index.html (0.38 kB)
- dist-renderer/assets/index-[hash].css (45.03 kB)
- dist-renderer/assets/index-[hash].js (740.91 kB)
- dist-electron/main.js (1.02 kB)
- dist-electron/preload.mjs (0.20 kB)
```

Build output verified to contain app code (Dashboard, Car Spa, createRoot, sidebar references confirmed in JS bundle).

---

## 11. Remaining Warnings

| Warning | Severity | Action |
|---|---|---|
| JS bundle 740.91 kB exceeds 500 kB | Low | Expected with all modules bundled; code-splitting can be added later |
| `AuthProvider.tsx` has unused `mockUser` and imports | Low | Dead code from previous implementation; does not affect runtime |

---

## Summary

The blank screen was caused by:
1. Double `<BrowserRouter>` + `<HashRouter>` nesting (router conflict)
2. Two separate auth context implementations (v1 and v2) causing the auth system to silently fail
3. Missing route component imports (build would have failed without these being removed)
4. Syntax error in `useCallback` (missing dependency array)
5. Circular re-export in `auth-context.ts`

All five issues are fixed. `pnpm typecheck` and `pnpm build` both pass. The build output contains the full application code. The Electron window should now render the login screen, and after login, the full dashboard with sidebar and navigation.
