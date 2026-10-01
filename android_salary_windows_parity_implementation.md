# E6 Car Spa — Android Salary / Windows Parity

## 1. Changes Made

A comprehensive audit and implementation was performed to bring the Android Flutter Staff Salary flow into complete behavioral, architectural, and visual parity with the Windows Desktop reference implementation (`apps/desktop/renderer/src/features/staff/SalaryPage.tsx`).

### Files Modified & Created:
1. **`apps/android/lib/features/staff/presentation/widgets/salary_details_bottom_sheet.dart`** *(NEW)*:
   - Implements full parity with Windows `viewingDetailsItem` dialog ("Salary Settlement Receipt" / "Salary Details").
   - Displays gross entered salary, outstanding advance before settlement, advance recovery deduction, net final payable payout, and remaining advance.
   - For settled items, displays historical settlement audit metadata: "Settled on `<date>`, `<time>` by `<settledByName>`", notes, and settlement receipt badge.
   - For eligible unsettled items, provides direct access to proceed to settlement if user has `staff_salary.settle`, `staff.edit`, or `isOwner`.

2. **`apps/android/lib/features/staff/presentation/widgets/enter_salary_bottom_sheet.dart`**:
   - Replaced merged/ambiguous save action with strict dual-action parity:
     - **"Save Salary" Button**: Invokes `POST /api/staff-salary/enter`. Saves entered salary and selected period with status `Ready`, leaving `SettledAt = null` and preserving outstanding advances intact.
     - **"Proceed to Settle" Button**: Prompts the user and transitions to the settlement confirmation dialog if the user has settlement permissions.
   - Updated title dynamically: displays "Edit Staff Salary" when editing existing entries and "Enter Staff Salary" when entering for the first time.
   - Fixed validation to permit ₹0 salary (`numVal >= 0`), exactly matching Windows and backend validation rules (`[Range(0, 999999999.99)]`).
   - Fixed remaining advance calculation to `max(0.0, advance - advanceDeduction)`.

3. **`apps/android/lib/features/staff/presentation/widgets/settle_salary_bottom_sheet.dart`**:
   - Fixed zero-salary validation: allows settling ₹0 salary (`enteredSalary < 0` rejected; `enteredSalary == 0` allowed), removing artificial client-side block.
   - Updated header title to "Confirm Staff Salary Settlement" and button label to "Confirm & Settle Salary" matching Windows terminology.
   - Fixed remaining advance formula to `max(0.0, advance - advanceDeduction)`.

4. **`apps/android/lib/features/staff/presentation/widgets/salary_staff_card.dart`**:
   - Added Salary Period display (`dd MMM yyyy — dd MMM yyyy`) on each card matching the Windows table column.
   - Added dedicated "View Details" button and wired card interactions to open `SalaryDetailsBottomSheet`.
   - Updated permissions to include `staff.edit` (`staff_salary.manage || staff.edit || isOwner`, `staff_salary.settle || staff.edit || isOwner`).
   - For settled records, replaces action buttons with "View Details" and settlement history, preventing duplicate settlement attempts.

5. **`apps/android/lib/features/staff/presentation/pages/staff_salary_tab.dart`**:
   - Fixed status filter chips: replaced obsolete values (`'Unsettled'`, `'WithAdvances'`) with backend-exact status contract: `'All'` ("All Staff"), `'Ready'` ("Ready for Settlement"), `'Settled'` ("Settled"), and `'NotEntered'` ("Not Entered").
   - Enhanced KPI card to include payroll status breakdown banner (`X Settled / Y Total · Z Ready · W Not Entered`) matching Windows.
   - Wired `SalaryDetailsBottomSheet` and forwarded `canSettle` permission flag.

6. **`apps/android/lib/features/staff/providers/staff_salary_providers.dart`**:
   - In `SalaryActionNotifier.settleSalary()`, added invalidation for `staffAdvancesProvider` and silent re-fetch for `staffProvider` in addition to `salaryRosterProvider` and `salarySettlementHistoryProvider(staffId)` so that recovered advances update immediately across tabs.

7. **`apps/android/test/features/staff/staff_salary_parity_test.dart`** *(NEW)*:
   - Added comprehensive automated test suite verifying all 6 required business scenarios.

---

## 2. Windows Reference Flow

Windows Desktop implementation in `apps/desktop/renderer/src/features/staff/SalaryPage.tsx`:

```
                 [Salary Page]
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[Enter/Edit Salary]           [Existing Ready Item]
  - Enter salary (>= ₹0)        - Status: Ready
  - Select period dates         - SettledAt: null
  - Add optional notes                 │
       │                               ▼
       ├─────────────────────► [Settle Salary Action]
       │                               │
       ▼                               ▼
 [Save Salary]            [Settlement Confirmation Dialog]
  - Calls /api/.../enter    - Displays gross salary, advance deduction,
  - Status: Ready             net payout, remaining advance
  - SettledAt: null         - User confirms explicitly
  - Advances untouched                 │
                                       ▼
                             [POST /api/.../settle]
                              - Atomic FIFO advance recovery
                              - Status -> Settled
                              - SettledAt populated
```

---

## 3. Android Flow After Changes

The Android flow now mirrors the Windows reference implementation step-by-step:

```
                 STAFF SALARY TAB
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
   [Enter/Edit]                    [Ready Salary]
        │                                 │
   ┌────┴────────────────────────┐        │
   │                             │        │
   ▼                             ▼        ▼
[Save Salary]             [Proceed to Settle]
   │                             │
   │                             ▼
   │                 [Confirm Settlement Dialog]
   │                   - Gross Entered Salary
   │                   - FIFO Advance Recovery Deduction
   │                   - Net Final Payout
   │                   - Remaining Advance Balance
   │                   - Settlement Remarks
   │                             │
   │                             ▼
   │                   [Confirm & Settle]
   │                             │
   ▼                             ▼
 POST /api/staff-salary/enter   POST /api/staff-salary/settle
 - Status: Ready                - Status: Settled
 - SettledAt: null              - SettledAt: DateTime.UtcNow
 - Advances intact              - Advances recovered atomically
```

---

## 4. Save Salary Behavior

> **CONFIRMATION: Save Salary does not settle salary.**

When the user taps "Save Salary" on Android:
1. Calls `POST /api/staff-salary/enter` with `staffId`, `periodFrom`, `periodTo`, `enteredSalary`, and optional `notes`.
2. The record is created/updated with status `Ready`.
3. `SettledAt` remains `null`.
4. `SettledByUserId` remains `null`.
5. Outstanding staff advances are **NOT** recovered or altered.
6. The employee's advance balance is completely unaffected.
7. No payment record is created.
8. Only `salaryRosterProvider` is invalidated to update the UI status to `Ready`.

---

## 5. Settlement Behavior

When the user chooses to settle a salary:
1. The Settle action is only accessible for records with status `Ready` (or via "Proceed to Settle" from the Enter sheet) where the user has permission (`staff_salary.settle`, `staff.edit`, or `isOwner`).
2. An explicit confirmation bottom sheet (`SettleSalaryBottomSheet`) opens showing:
   - Staff member name, role, phone, and period dates.
   - Gross entered salary amount.
   - Applicable advance recovery deduction (`min(advance, salary)`).
   - Final payout amount (`max(0, salary - deduction)`).
   - Remaining advance balance (`max(0, advance - deduction)`).
   - Warning notice that the operation is irreversible and executes FIFO advance recovery.
   - Optional settlement remarks / notes.
3. Upon tapping "Confirm & Settle Salary", `POST /api/staff-salary/settle` is called.
4. After success:
   - Status updates to `Settled`.
   - `salaryRosterProvider`, `salarySettlementHistoryProvider(staffId)`, and `staffAdvancesProvider` are invalidated.
   - `staffProvider` reloads in the background to ensure all staff balance numbers remain synchronized across Directory, Attendance, Advances, and Salary tabs.
   - Settled records no longer display "Settle" or "Edit Salary" buttons; they display "View Details" to inspect the immutable settlement receipt.

---

## 6. Filter Corrections

### Root Cause of Previous Android Filter Bug:
- The backend `StaffSalaryService.cs` filters by:
  `filtered.Where(x => x.Status.ToLowerInvariant() == status.ToLowerInvariant())`.
- Android previously offered ChoiceChips with values `'Unsettled'` and `'WithAdvances'`.
- Since neither `'Unsettled'` nor `'WithAdvances'` exists in the backend status model (`'NotEntered'`, `'Ready'`, `'Settled'`), filtering returned 0 records.

### Corrected Filter Mapping:
| UI Label on Android | Query Value Submitted to Backend | Windows Equivalent | Status Matching |
|---|---|---|---|
| **All Staff** | `'All'` (omitted in query) | `all` | All records |
| **Ready for Settlement** | `'Ready'` | `Ready` | Status == `'Ready'` |
| **Settled** | `'Settled'` | `Settled` | Status == `'Settled'` |
| **Not Entered** | `'NotEntered'` | `NotEntered` | Status == `'NotEntered'` |

Both Windows and Android now query and return identical record sets.

---

## 7. Zero Salary Handling

- **Windows/Backend Behavior**: Both support zero-salary payouts (`[Range(0, 999999999.99)]`). When an employee has ₹0 gross salary, net payout is ₹0.00 and no advance can be deducted.
- **Android Correction**: Removed client-side `enteredSalary <= 0` checks in `EnterSalaryBottomSheet` and `SettleSalaryBottomSheet`.
- Android now allows entering and settling ₹0 salaries, while continuing to reject negative values (`< 0`) with the message: *"Please enter a valid salary amount (₹0 or greater)"*, matching Windows validation exactly.

---

## 8. Date Handling

- Period dates (`periodFrom` and `periodTo`) are derived from `salaryPeriodFromProvider` and `salaryPeriodToProvider` (defaulting to the 1st and last day of the current calendar month).
- When opening `EnterSalaryBottomSheet` or `SettleSalaryBottomSheet`, the exact item's `periodFrom` and `periodTo` are bound directly from the roster model.
- Every API call (`saveEnteredSalary` and `settleSalary`) transmits the same ISO `yyyy-MM-dd` date strings as displayed in the UI.
- No independent or unsynchronized date state can cause discrepancies between display and submission.

---

## 9. Advance Handling

- **Prior to Settlement**:
  - Live calculations compute advance recovery as `min(outstandingAdvance, enteredSalary)` for preview only.
  - Saving salary (`POST /api/staff-salary/enter`) **never** touches advance rows or balances.
- **During Settlement**:
  - `POST /api/staff-salary/settle` executes atomic FIFO deduction on the database.
- **Post-Settlement Refresh**:
  - Android invalidates `staffAdvancesProvider` and calls `staffProvider.loadStaff(silent: true)`, guaranteeing that any subsequent visit to the "Staff Advances" tab or "Directory" tab reflects the updated balance immediately.

---

## 10. Tests

A dedicated parity test suite was implemented in `apps/android/test/features/staff/staff_salary_parity_test.dart` covering all required scenarios:

- **Test 1 — Save Salary**: Verifies ₹35,000 saves as `Ready`, calls `/api/staff-salary/enter`, leaves `SettledAt = null`, does not settle, and leaves advances untouched. **(PASSED)**
- **Test 2 — Edit Salary**: Verifies modifying existing `Ready` salary to ₹40,000 updates without settling. **(PASSED)**
- **Test 3 — Settle Salary**: Verifies ₹40,000 salary with ₹10,000 advance recovers ₹10,000, yields ₹30,000 final payout, and calls `/api/staff-salary/settle`. **(PASSED)**
- **Test 4 — Cannot Settle Twice**: Verifies settled records hide "Settle" and "Edit" buttons and show "View Details". **(PASSED)**
- **Test 5 — Zero Salary**: Verifies ₹0 entered salary is accepted for settlement without client-side rejection. **(PASSED)**
- **Test 6 — Filter Parity**: Verifies Android status filter options map strictly to backend/Windows statuses and obsolete filters are excluded. **(PASSED)**
- **Additional Test — Settlement Receipt**: Verifies `SalaryDetailsBottomSheet` displays settlement audit timestamp, settled by name, and exact calculation breakdown. **(PASSED)**

---

## 11. Build/Analysis Results

- **`flutter analyze lib/features/staff test/features/staff test/widget/staff_suite_widget_test.dart`**:
  `No issues found!` (0 errors, 0 warnings).
- **`flutter test test/features/staff/staff_salary_parity_test.dart`**:
  `00:01 +7: All tests passed!`
- **`flutter test test/unit/staff_salary_models_test.dart test/widget/staff_suite_widget_test.dart`**:
  `00:05 +16: All tests passed!`
- **`flutter test test/features/staff/staff_salary_parity_test.dart test/unit/staff_salary_models_test.dart test/unit/staff_advances_models_test.dart test/unit/staff_advances_repository_test.dart`**:
  `00:02 +33: All tests passed!`
- **`dotnet test tests/CarSpaManagement.Api.Tests --filter "FullyQualifiedName~StaffSalary"`**:
  `Passed! - Failed: 0, Passed: 18, Skipped: 0, Total: 18, Duration: 1 s` (0 backend regressions).

---

## 12. Remaining Differences

Only genuine mobile adaptations necessary for screen size and touch interaction remain:
1. **Presentation Modality**: Windows uses a modal dialog (`<Modal>`); Android uses a scroll-controlled bottom sheet (`showModalBottomSheet`), which is standard for Flutter on mobile devices.
2. **Layout Structure**: Windows renders a desktop data table with horizontal scrolling; Android renders responsive staff cards with a KPI summary card above them for thumb-friendly scrolling.
3. **Filter UI**: Windows uses `<select>` dropdowns; Android uses horizontal `ChoiceChip` widgets for mobile touch usability.
4. **Behavior, business rules, API payloads, validation constraints, and database consequences are 100% identical.**
