# Phase 3C — Change Checklist: Remove Mock Data & Connect to Backend

**Date:** 2025-08-19
**Status:** Implementation pending

---

## Files Requiring Changes

### 1. Dashboard.tsx — REMOVE ALL MOCK DATA
- [ ] Remove `salesData` array (hardcoded chart data)
- [ ] Remove `todayJobCards` array (6 fake job cards with fake names)
- [ ] Remove `workflowStatus` array (8 fake status counts)
- [ ] Remove `recentActivity` array (4 fake activity items)
- [ ] Remove all hardcoded KPI card values (₹48,500, ₹37,200, etc.)
- [ ] Replace chart with empty state: "No sales data available yet"
- [ ] Replace job cards table with empty state + link to Job Cards page
- [ ] Replace workflow status with empty state
- [ ] Replace recent activity with empty state
- [ ] Keep Stitch-approved visual structure (KPI grid, chart area, table area)

### 2. JobCardsPage.tsx — REMOVE MOCK DATA, CONNECT TO API
- [ ] Remove `jobCards` array (8 hardcoded entries with fake Indian names)
- [ ] Remove hardcoded `₹` currency (use API data)
- [ ] Replace with TanStack Query calling `GET /api/job-cards`
- [ ] Implement real pagination from API response
- [ ] Implement real search calling API
- [ ] Implement real status filter calling API
- [ ] Implement loading state
- [ ] Implement empty state: "No job cards found"
- [ ] Implement error state
- [ ] Wire row click to navigate to `/job-cards/:id`

### 3. JobCardDetails.tsx — CONNECT TO API
- [ ] Remove placeholder "construction" icon and "implementation pending" text
- [ ] Connect to `GET /api/job-cards/{id}` using TanStack Query
- [ ] Display actual job card data from API
- [ ] Implement loading/error/empty states
- [ ] Match Stitch Job Card Details bento grid layout

### 4. CustomersPage.tsx — REMOVE MOCK DATA, CONNECT TO API
- [ ] Remove `customers` array (5 hardcoded entries)
- [ ] Remove hardcoded `₹` currency
- [ ] Connect to `GET /api/customers` with TanStack Query
- [ ] Implement real search, pagination
- [ ] Implement loading/error/empty states
- [ ] Wire "Add Customer" button to customer creation form

### 5. CataloguePage.tsx — REMOVE MOCK DATA, CONNECT TO API
- [ ] Remove `services` array (3 hardcoded entries)
- [ ] Remove hardcoded `₹` prices and image URLs
- [ ] Connect to `GET /api/services` with TanStack Query
- [ ] Implement category filtering from API
- [ ] Implement search
- [ ] Implement loading/error/empty states

### 6. QuotationsInvoices.tsx — REMOVE MOCK DATA
- [ ] Remove `quotations` array (5 fake entries)
- [ ] Remove `invoices` array (4 fake entries)
- [ ] No backend endpoints exist yet — use proper empty states
- [ ] Show "No quotations available yet" / "No invoices available yet"
- [ ] Keep UI structure intact (tabs, search bar, table headers)

### 7. ReportsPage.tsx — REMOVE MOCK DATA
- [ ] Remove `revenueByMonth` chart data
- [ ] Remove `jobsByStatus` chart data
- [ ] Remove `topServices` table data
- [ ] Remove all hardcoded KPI values (₹11,82,000, etc.)
- [ ] No backend reporting endpoints exist yet
- [ ] Show empty states for all chart areas
- [ ] Show "No data available yet — reporting endpoints coming soon"

### 8. StaffAdvancesPage.tsx — REMOVE MOCK DATA
- [ ] Remove `advances` array (5 fake entries)
- [ ] Remove hardcoded `₹` amounts
- [ ] No backend endpoint exists yet
- [ ] Show empty state: "No staff advances recorded yet"
- [ ] Keep summary card structure

### 9. ShowroomPage.tsx — REMOVE "COMING SOON"
- [ ] Remove "Coming Soon" heading and text
- [ ] Remove "implementation pending" references
- [ ] Replace with proper empty state or placeholder UI
- [ ] Keep feature grid structure but remove "Coming Soon" messaging

### 10. NewJobCard.tsx — VERIFY API INTEGRATION
- [ ] Verify phone lookup uses `GET /api/customers/by-phone/{phone}`
- [ ] Verify customer creation uses `POST /api/customers`
- [ ] Verify vehicle creation uses `POST /api/vehicles`
- [ ] Verify vehicle loading uses `GET /api/vehicles/by-customer/{customerId}`
- [ ] Verify service loading uses `GET /api/services`
- [ ] Verify service creation uses `POST /api/services`
- [ ] Verify job card creation uses `POST /api/job-cards`
- [ ] Ensure NO mock/demo data anywhere in the flow
- [ ] Ensure calculations use backend-computed values

### 11. Currency Standardization
- [ ] All currency formatting must use consistent approach
- [ ] Remove hardcoded `₹` symbols from mock data areas
- [ ] Use API-returned values for display
- [ ] Consider: backend returns decimal amounts, frontend formats for display

### 12. Global Search (Shell.tsx / DashboardLayout.tsx)
- [ ] Wire global search to actual API search endpoints
- [ ] Remove placeholder input that does nothing

---

## Backend Endpoints Available (to connect to)

| Resource | List | Get | Create | Update | Delete | Search |
|----------|------|-----|--------|--------|--------|--------|
| Customers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vehicles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Services | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Job Cards | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Quotations | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invoices | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Staff Advances | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reports | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
