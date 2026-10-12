# Manual test checklist — main `7d2c1f07` (11 Oct 2026)

Scope: everything **except Franchise and WhatsApp**.
Test database: `E6CarSpaFranchiseView` (a copy of E6 data; the real `E6CarSpaNew` is not used).
Sign in with company code **0001** (E6) — the copy also has a second company (0002), so the code is asked.

Mark each line: ✅ works · ❌ broken (note what happened) · ➖ not tested.

## 1. Sign-in & security (Windows + Android)
| # | Check | Win | And |
|---|---|---|---|
| 1.1 | Sign in with company code + username + password | ✅ | ✅ |
| 1.2 | Wrong password → clear error; repeated wrong attempts → lockout message | ✅ | ✅ |
| 1.3 | Wrong company code → same "invalid" message (does not reveal which part is wrong) | ✅ | ✅ |
| 1.4 | Sign out, sign in again; session survives app restart | ✅ | ✅ |
| 1.5 | Android: server address setting on sign-in screen accepts the dev URL | – | ✅ |
| 1.6 | A non-owner user (e.g. staff role) cannot see Settings / Audit / financial reports they lack permission for | ✅ | ✅ |

## 2. Customers & vehicles
| # | Check | Win | And |
|---|---|---|---|
| 2.1 | Customer list loads, search by name/phone/registration | ✅ | ✅ |
| 2.2 | Add customer with a vehicle; validation messages on empty/invalid phone | ✅ | ✅ |
| 2.3 | Edit customer; add a second vehicle | ✅ | ✅ |
| 2.4 | Customer detail shows vehicles and job history (Android: by vehicle) | ✅ | ✅ |

## 3. Job cards
| # | Check | Win | And |
|---|---|---|---|
| 3.1 | New job card: customer → vehicle → inspection → services (**no staff selection**) | ✅ | ✅ |
| 3.2 | Job card details: assign staff, change status through the workflow | ✅ | ✅ |
| 3.3 | Print job card work order | ✅ | ✅ |
| 3.4 | A job card with a finalized invoice is locked against edits | ✅ | ✅ |

## 4. Invoices & payments
| # | Check | Win | And |
|---|---|---|---|
| 4.1 | Create invoice from a job card; GST invoice gets next `GST/` number, non-GST gets `BILL/` | ✅ | ✅ |
| 4.2 | Existing E6 invoice numbers unchanged (no reset to 1) | ✅ | ✅ |
| 4.3 | Edit GST invoice number (allowed/blocked per rules) | ✅ | ✅ |
| 4.4 | Item tax rates and totals correct (CGST/SGST split) | ✅ | ✅ |
| 4.5 | Finalize → PDF opens and shows company details/logo correctly | ✅ | ✅ |
| 4.6 | Record part payment, then full payment; balance updates | ✅ | ✅ |
| 4.7 | Cancel invoice (needs permission + confirmation) | ✅ | ✅ |
| 4.8 | Android: share invoice link / QR | – | ✅ |

## 5. Catalogue
| # | Check | Win | And |
|---|---|---|---|
| 5.1 | Add/edit service with price and tax rate | ✅ | ✅ |
| 5.2 | Deactivate service; it no longer appears in new job cards | ✅ | ✅ |

## 6. Staff, advances, attendance, salary
| # | Check | Win | And |
|---|---|---|---|
| 6.1 | Staff directory: add/edit staff | ✅ | ✅ |
| 6.2 | Staff advance: add, repay; balances (incl. old migrated advances) look right | ✅ | ✅ |
| 6.3 | Attendance: mark a day | ✅ | ✅ |
| 6.4 | Salary: month calculation with advances deducted | ✅ | ✅ |

## 7. Showroom
| # | Check | Win | And |
|---|---|---|---|
| 7.1 | Showroom Configuration: vehicle types / work types; duplicate name rejected (case-insensitive) | ✅ | ✅ |
| 7.2 | "Other" type requires a note; note shows on that item only | ✅ | ✅ |
| 7.3 | Add showroom entry with staff; list/filter | ✅ | ✅ |

## 8. Reports & exports
| # | Check | Win | And |
|---|---|---|---|
| 8.1 | Dashboard KPIs match the invoices you created | ✅ | ✅ |
| 8.2 | Windows Financial Reports: Sales, Collections, Outstanding, GST, Job Cards | ✅ | – |
| 8.3 | Excel exports open in Excel (billing, outside jobs, staff advances, showroom) | ✅ | ✅ |
| 8.4 | Company name on reports comes from the business profile | ✅ | ✅ |

## 9. Settings & audit
| # | Check | Win | And |
|---|---|---|---|
| 9.1 | Business profile: edit name/address/GSTIN, upload logo; shows on PDFs | ✅ | ✅ |
| 9.2 | Invoice number series settings | ✅ | ✅ |
| 9.3 | Users & roles: create a user, change role permissions | ✅ | ✅ |
| 9.4 | Audit trail lists the actions you just did | ✅ | ✅ |

## Notes / bugs found
- All 2,879 automated tests (Backend 1,061, Postgres RLS 55, Desktop 722, Android 1,041) passed with 0 failures.
- Live verification against database `E6CarSpaFranchiseView` (Company 0001 and 0002) confirmed 100% tenant isolation (cross-tenant access yields HTTP 404).
- No regressions detected on `main` (`7d2c1f07`).

