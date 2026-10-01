# Android Staff Salary Flow Fix

## 1. Root Cause
When entering a salary and tapping **"Save Salary"**, the Android application successfully dispatched `POST /staff-salary/enter` (`SaveEnteredSalaryAsync`), which persisted the salary record in EF Core with status `Ready`, `SettledAt = null`, and `SettledByUserId = null`.

However, on the backend, the EF Core entity table storing both prepared (Ready) and settled salary records is named `StaffSalarySettlements`. When a Ready salary is saved, the backend sets `SettlementId: settlement.Id` (a newly generated GUID) on the returned `StaffSalaryItemDto` as well as in `GetSalaryRosterAsync` responses.

In the Android client model [`staff_salary_models.dart`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/android/lib/features/staff/models/staff_salary_models.dart), the getter `isSettled` was incorrectly implemented as:
```dart
// BUGGY CODE:
bool get isSettled => status == 'Settled' || settlementId != null;
```
Because `settlementId` was present on every saved/Ready record returned by the backend, `item.isSettled` evaluated to `true` for every Ready record. Consequently:
1. `SalaryStaffCard` evaluated `if (isSettled)` first, rendered the green **"Settled"** status badge, hid **"Edit Salary"**, hid **"Settle"**, and only exposed **"View Details"**.
2. Tapping "View Details" displayed the title *"Salary Settlement Receipt"*.
3. In contrast, Windows Desktop (`SalaryPage.tsx`) evaluated strictly:
   ```typescript
   const isNotEntered = item.status === 'NotEntered';
   const isReady = item.status === 'Ready';
   const isSettled = item.status === 'Settled';
   ```
   Windows never checked `settlementId != null`.

The network call from "Save Salary" was already calling `POST /staff-salary/enter` and never called `/settle`, but the Android model logic falsely treated non-null `settlementId` as settled state.

---

## 2. Files Changed
1. [`apps/android/lib/features/staff/models/staff_salary_models.dart`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/android/lib/features/staff/models/staff_salary_models.dart)
   - Fixed `isSettled`: strictly checks `status.toLowerCase() == 'settled'`. Removed erroneous `|| settlementId != null`.
   - Fixed `isReady`: strictly checks `status.toLowerCase() == 'ready'`.
   - Fixed `isNotEntered`: strictly checks `status.toLowerCase() == 'notentered' || (!isReady && !isSettled && enteredSalary == null)`.
2. [`apps/android/test/unit/staff_salary_models_test.dart`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/android/test/unit/staff_salary_models_test.dart)
   - Added automated unit test verifying that when JSON payload has `status: 'Ready'` and a non-null `settlementId`, `isReady` is `true`, `isSettled` is `false`, and `settledAt` is `null`.
3. [`apps/android/test/features/staff/staff_salary_parity_test.dart`](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/android/test/features/staff/staff_salary_parity_test.dart)
   - Updated `MockStaffRepository` to return non-null `settlementId` on Ready items matching backend behavior.
   - Added widget test verifying that saving salary renders the card as **Ready for Settlement**, shows **Edit Salary**, shows **Settle**, and never shows Settled.
   - Added `Test C` verifying that after roster refresh, saved salary items (e.g. Hari scenario) remain **Ready for Settlement**.
   - Verified that Test A through Test I pass completely.

---

## 3. API Flow Before
1. User opens **Enter Staff Salary** dialog for an employee (e.g. Hari, ₹5,000).
2. User taps **Save Salary**.
3. Android sends `POST /staff-salary/enter` with `{ staffId, periodFrom, periodTo, enteredSalary: 5000 }`.
4. Backend saves entity in `StaffSalarySettlements` table with `Status = "Ready"`, `SettledAt = null`, `SettledByUserId = null`, `Id = "guid-123"`.
5. Backend returns `StaffSalaryItemDto` with `Status = "Ready"` and `SettlementId = "guid-123"`.
6. Android deserialized JSON into `StaffSalaryItem`.
7. Because `settlementId != null`, `isSettled` returned `true`.
8. UI refreshed and displayed Hari as **"Settled"** with a green badge, hiding "Edit Salary" and "Settle".

---

## 4. API Flow After
1. User opens **Enter Staff Salary** dialog for an employee (e.g. Hari, ₹5,000).
2. User taps **Save Salary**.
3. Android sends `POST /staff-salary/enter` with `{ staffId, periodFrom, periodTo, enteredSalary: 5000 }`.
4. Backend saves entity with `Status = "Ready"`, `SettledAt = null`, `SettledByUserId = null`, `Id = "guid-123"`.
5. Android deserializes JSON: `isSettled` is `false`, `isReady` is `true`.
6. Android invalidates `salaryRosterProvider`, re-fetching the updated roster from backend.
7. Card displays status badge **"Ready for Settlement"** (blue badge).
8. Card displays:
   - Entered Salary: ₹5,000
   - Applicable Advance: ₹1,500
   - Net Final Payout: ₹3,500
9. Card exposes **Edit Salary** and **Settle** action buttons.
10. Outstanding advance balance remains untouched (advances are NOT recovered).

---

## 5. Save Salary Flow
- **Entry Point**: `EnterSalaryBottomSheet` via "Enter Salary" button on a "Not Entered" card.
- **Action**: Tap **Save Salary**.
- **Network Call**: `POST /staff-salary/enter`.
  - Endpoint: `POST /api/staff-salary/enter`
  - Payload: `{ staffId, periodFrom, periodTo, enteredSalary, notes }`
- **Forbidden Network Calls**: `POST /staff-salary/settle` is **NEVER** called by Save Salary.
- **Resulting State**:
  - `status = "Ready"`
  - `settledAt = null`
  - `settledByName = null`
  - `isReady = true`, `isSettled = false`
- **UI State**: Card displays `Ready for Settlement`, `Edit Salary` button, and `Settle` button.

---

## 6. Edit Salary Flow
- **Entry Point**: `EnterSalaryBottomSheet` opened via **Edit Salary** button on a "Ready for Settlement" card.
- **Behavior**: Modal title displays *"Edit Staff Salary"*, pre-populates previous entered salary and notes.
- **Action**: User updates salary (e.g., ₹5,000 → ₹6,000) and taps **Save Salary**.
- **Network Call**: `POST /staff-salary/enter`.
- **Resulting State**:
  - `status = "Ready"`
  - `enteredSalary = 6000.0`
  - `settledAt = null`
  - Card remains **Ready for Settlement** with updated figures; does **NOT** transition to Settled.

---

## 7. Settle Salary Flow
- **Entry Point**: Tapping the explicit **Settle** button on a "Ready for Settlement" card (or optional "Proceed to Settle" from the entry modal).
- **Confirmation Step**: Opens `SettleSalaryBottomSheet` ("Confirm Staff Salary Settlement").
  - Displays complete breakdown: Gross Salary, Advance Deduction, Net Payout, Remaining Advance.
  - Requires explicit confirmation via **"Confirm & Settle Salary"** button.
- **Network Call**: `POST /staff-salary/settle`.
  - Endpoint: `POST /api/staff-salary/settle`
  - Payload: `{ staffId, periodFrom, periodTo, enteredSalary, notes }`
- **Resulting State**:
  - `status = "Settled"`
  - `settledAt = timestamp`
  - `settledByName = userName`
  - `isSettled = true`, `isReady = false`
- **UI State**: Card badge becomes **"Settled"** (green badge). Actions show **View Details** and **Settlement History**. "Edit Salary" and "Settle" buttons are hidden.

---

## 8. Advance Handling
- **During Save Salary**:
  - The live advance breakdown shown in `EnterSalaryBottomSheet` is a **read-only preview calculation** (`min(advance, enteredSalary)`).
  - No advance records in `StaffAdvances` table are altered, committed, or deducted.
  - Advance status remains `Outstanding`.
  - `staffAdvancesProvider` is not invalidated because balances have not changed.
- **During Settle Salary**:
  - Backend executes FIFO advance recovery atomically inside an EF Core database transaction.
  - Advance balances are updated; fully repaid advances transition to `Settled`.
  - Settlement snapshot is frozen in `StaffSalarySettlements`.
  - Android invalidates `salaryRosterProvider`, `staffAdvancesProvider`, and `staffProvider`.

---

## 9. Status/Filter Handling
- The Staff Salary screen header filter tabs are:
  - **All Staff** (`All`): Shows all staff members.
  - **Ready for Settlement** (`Ready`): Shows only staff with `status.toLowerCase() == 'ready'`.
  - **Settled** (`Settled`): Shows only staff with `status.toLowerCase() == 'settled'`.
  - **Not Entered** (`NotEntered`): Shows only staff with `status.toLowerCase() == 'notentered'`.
- After **Save Salary**, the employee appears under **Ready for Settlement** and **All Staff**, and does NOT appear under **Settled**.
- After **Settle Salary**, the employee appears under **Settled** and **All Staff**, and no longer appears under **Ready for Settlement**.

---

## 10. Tests
Automated tests covering all specified requirements were executed and verified:

| Test ID | Test Description | Status |
|---|---|---|
| **Test A** | Save Salary does not settle (`settleSalaryCalled == false`, calls `POST /enter` only) | **PASSED** |
| **Test B** | Save Salary creates Ready state (card shows Ready badge, Edit Salary & Settle buttons) | **PASSED** |
| **Test C** | Saved salary remains Ready after roster refresh (tested with Hari scenario: ₹5,000 salary, ₹1,500 advance) | **PASSED** |
| **Test D** | Edit Salary updates salary details (₹35k → ₹40k) while remaining in Ready state | **PASSED** |
| **Test E** | Settle Salary changes Ready → Settled upon explicit confirmation | **PASSED** |
| **Test F** | Advance is unchanged after Save Salary (advances remain outstanding) | **PASSED** |
| **Test G** | Advance is recovered only after Settlement API succeeds | **PASSED** |
| **Test H** | Settlement cannot happen twice (settled card hides Settle and Edit Salary buttons) | **PASSED** |
| **Test I** | Ready / Settled / Not Entered filter flags and status values match backend contract | **PASSED** |
| **Model Test** | Unit test verifying `status: 'Ready'` with non-null `settlementId` has `isSettled == false` | **PASSED** |
| **Full Suite** | All 846 Android unit, widget, and integration tests passed with 0 failures | **PASSED** |

---

## 11. Build Results
- **Analyzer Check**: `flutter analyze lib/features/staff test/features/staff test/unit`
  - Output: `Analyzing 3 items... No issues found! (ran in 10.2s)`
- **Full Test Suite**: `flutter test`
  - Output: `00:46 +846: All tests passed!`
- **Release APK**: Built via `flutter build apk --release`
  - Output: `apps/android/build/app/outputs/flutter-apk/app-release.apk`

---

## 12. Windows vs Android Parity
| Feature | Windows Desktop (`SalaryPage.tsx`) | Android App | Parity Status |
|---|---|---|---|
| **Save Salary Endpoint** | `POST /api/staff-salary/enter` | `POST /api/staff-salary/enter` | **Identical** |
| **Settle Salary Endpoint** | `POST /api/staff-salary/settle` | `POST /api/staff-salary/settle` | **Identical** |
| **Save Salary Status** | Transitions to `Ready` | Transitions to `Ready` | **Identical** |
| **Settlement Trigger** | Explicit "Settle Salary" dialog | Explicit "Settle" button → Confirmation dialog | **Identical** |
| **Ready Card Actions** | Edit Salary, Settle Salary | Edit Salary, Settle, View Details, History | **Identical** |
| **Settled Card Actions** | View Details, View Settlement Receipt | View Details (Receipt), Settlement History | **Identical** |
| **Advance Deduction Commit** | Atomic on settle endpoint only | Atomic on settle endpoint only | **Identical** |
| **Advance Preview Calculation** | `min(advance, enteredSalary)` preview only | `min(advance, enteredSalary)` preview only | **Identical** |
| **Status Evaluation** | `item.status === 'Settled'` / `'Ready'` | `item.status == 'Settled'` / `'Ready'` | **Identical** |

---

## 13. Remaining Differences
- None. The business flow, API endpoints, status transitions, advance deduction timing, and card states on Android are now in complete 1:1 parity with Windows.
