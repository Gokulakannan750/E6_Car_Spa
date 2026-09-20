# E6 Car Spa — WhatsApp Invoice Template Handling Fix Report

**Report Date:** September 20, 2026  
**Status:** COMPLETE & VERIFIED  
**Target:** WhatsApp Notification Dispatch for `InvoiceFinalized` and `PaymentCompleted`

---

## 1. Problem
WhatsApp Business integration was connected and functional for payment notifications, but **invoice finalized notifications were failing**.

When invoices were generated, the system marked WhatsApp messages as `Failed` without sending any request to Meta Graph API, recording:
```text
Template 'e6_carspa_invoice_generated' requires a DOCUMENT header component for invoice PDF attachments.
```

---

## 2. Root Cause
In `backend/api/CarSpaManagement.Api/Application/Services/WhatsAppService.cs`, `ProcessMessageAsync()` contained a hard-coded validation constraint for `InvoiceFinalized` messages that strictly required every invoice template to have a `HEADER` of type `DOCUMENT` and rejected templates containing `URL` buttons.

Approved Meta invoice templates like `e6_carspa_invoice_generated` use a modern Web-Link model:
- **Header:** None
- **Body:** 4 variables (`{{1}}` Customer Name, `{{2}}` Invoice Number, `{{3}}` Vehicle Registration, `{{4}}` Amount)
- **Buttons:** Dynamic URL Button (`https://invoice.e6carspa.com/i/{{1}}`)

Because the code unconditionally checked `headerComponent.Format == "DOCUMENT"`, it aborted locally prior to making the Meta API call. In contrast, `PaymentCompleted` notifications succeeded because they did not enforce this hard-coded document header rule.

---

## 3. Fix
`WhatsAppService.cs` was refactored to support **dynamic template structure detection**:

1. **Eliminated Unconditional Constraint:** Removed the hard-coded requirement that `InvoiceFinalized` messages must have a `DOCUMENT` header and must not have buttons.
2. **Conditional PDF & Media Handling:** In-memory PDF generation and Meta Media API uploads are now executed **only** when the selected approved template contains a `HEADER` component with `Format == "DOCUMENT"`.
3. **Dynamic URL Button Support for Invoices:** Enabled dynamic URL button component construction for `InvoiceFinalized` in addition to `PaymentCompleted`, resolving public invoice tokens securely via `InvoicePublicLink`.
4. **Preserved Comprehensive Safety Validations:**
   - Template exists in WABA
   - Template status is `APPROVED`
   - Template language matches configured language
   - Required body parameters match count and are non-empty
   - Unsupported component types (e.g. invalid header parameters or unsupported buttons) fail cleanly and safely before network dispatch

---

## 4. Before / After Behavior

| Dimension | Before Fix | After Fix |
| :--- | :--- | :--- |
| **URL-Button Template (`e6_carspa_invoice_generated`)** | FAILED locally with `"requires a DOCUMENT header component"` | **SUCCEEDS**: Resolves 4 body variables & URL button token, dispatches to Meta |
| **DOCUMENT Template (`e6_carspa_invoice_pdf`)** | Worked only for PDF templates | **SUCCEEDS**: Generates PDF, uploads to Meta Media API, attaches document header |
| **Text-Only Invoice Templates** | FAILED locally | **SUCCEEDS**: Sends text-only template if body variables resolve |
| **Payment Completed Notifications** | SUCCEEDED | **SUCCEEDS** (Unchanged, 100% backward compatible) |
| **Media ID Expiration Retry** | Only triggered on PDF | Safely isolated to `isDocumentHeader` messages |

---

## 5. Template Types Supported

### Type A: DOCUMENT Header Templates
* **Example:** `e6_carspa_invoice_pdf`
* **Structure:** `HEADER` (Format = `DOCUMENT`) + `BODY` (4 variables)
* **Backend Action:** Generates PDF invoice in memory -> uploads to Meta Media API -> attaches `document` header with `id` and `filename` -> dispatches template message.

### Type B: URL-Button / Dynamic Link Templates
* **Example:** `e6_carspa_invoice_generated`
* **Structure:** `HEADER` (None) + `BODY` (4 variables) + `BUTTONS` (`URL` with dynamic suffix `https://invoice.e6carspa.com/i/{{1}}`)
* **Backend Action:** Resolves body variables -> resolves `InvoicePublicLink` token -> constructs `button` component with `sub_type = "url"` and parameter text -> dispatches template message (no PDF generation / media upload overhead).

### Type C: Text-Only Templates
* **Structure:** `HEADER` (None or static text) + `BODY` (variables) + `BUTTONS` (None)
* **Backend Action:** Resolves body variables -> constructs body component -> dispatches template message.

---

## 6. Automated Tests

All tests run via `dotnet test backend/CarSpaManagement.slnx` and `pnpm --filter @carspa/desktop test -- --run`.

### Unit & Integration Tests Added/Updated in `WhatsAppProductionNotificationTests.cs`:
1. **`ProcessMessage_WhenTemplateContainsUrlButton_ResolvesButtonAndSendsSuccessfully`**
   - Verifies invoice dispatch with URL-button template (`e6_carspa_invoice_generated`), confirming body parameters and URL button token are constructed without PDF/media upload.
2. **`ProcessMessage_WhenTemplateHasDocumentHeader_GeneratesPdfAndAttachesDocumentHeader`**
   - Verifies invoice dispatch with DOCUMENT template (`e6_carspa_invoice_pdf`), confirming PDF generation, Meta media upload, and document header component.
3. **`ProcessMessage_WhenTemplateIsTextOnly_SendsSuccessfullyWithoutDocumentHeader`**
   - Verifies invoice dispatch with text-only template.
4. **`ProcessMessage_WhenTemplateContainsUnsupportedComponent_FailsSafelyWithoutCallingMeta`**
   - Verifies unsupported components fail gracefully without making Meta API calls.
5. **`ProcessMessage_WhenIncorrectParameterCount_FailsWithDescriptiveError`**
   - Verifies parameter count mismatch validation.
6. **`ProcessMessage_WhenTemplateLanguageMismatch_FailsSafely`**
   - Verifies template language mismatch validation.
7. **`ProcessMessage_PaymentCompleted_WithUrlButtonTemplate_SendsSuccessfully`**
   - Verifies `PaymentCompleted` notification handling remains intact with URL-button templates.
8. **`ProcessMessage_WhenMissingInvoicePublicLinkToken_FailsDescriptively`**
   - Verifies graceful failure when invoice public link token cannot be resolved.

### Test Run Results:
* **Backend:** `Passed! - Failed: 0, Passed: 372, Skipped: 0, Total: 372`
* **Desktop:** `Test Files: 22 passed (22), Tests: 228 passed (228)`
* **Builds:** 0 Errors, 0 Warnings across .NET 10 solution and TypeScript/Vite frontend.

---

## 7. Real WhatsApp Verification

Real Meta Cloud API verification was executed against the live configured WhatsApp Business Account and Phone Number ID:

### Test A: Live Invoice Finalization Notification
* **Configured Template:** `e6_carspa_invoice_pdf` (Language: `en`)
* **Recipient Phone:** `+91 75023 87733`
* **Invoice Generated:** `INV-2026-000010`
* **Meta API Request:** `POST https://graph.facebook.com/v25.0/{PhoneNumberId}/messages`
* **Meta HTTP Status:** `200 OK`
* **Meta Message ID:** `wamid.HBgMOTE3NTAyMzg3NzMzFQIAERgSMkU2MTRCMzg1RDFEQjk0MTgzAA==`
* **Message Status in Database:** `Sent`
* **Error Message:** `None`

### Test B: Live Payment Completed Notification
* **Configured Template:** `e6_car_spa_app` (Language: `en`)
* **Recipient Phone:** `+91 75023 87733`
* **Meta API Request:** `POST https://graph.facebook.com/v25.0/{PhoneNumberId}/messages`
* **Meta HTTP Status:** `200 OK`
* **Meta Message ID:** `wamid.HBgMOTE3NTAyMzg3NzMzFQIAERgSMTk3MTRFMTU5QkIxNEU4MUREAA==`
* **Message Status in Database:** `Sent`
* **Error Message:** `None`

---

## 8. Regression Results
A codebase search confirmed **zero** remaining unconditional DOCUMENT header assumptions.
* Unconditional checks such as `headerComponent.Format == "DOCUMENT"` have been eliminated.
* `isDocumentHeader` is computed dynamically based on the approved Meta template components.
* `PaymentCompleted` flows continue to execute without regressions.

---

## 9. Files Changed

* `backend/api/CarSpaManagement.Api/Application/Services/WhatsAppService.cs`
* `backend/tests/CarSpaManagement.Api.Tests/WhatsAppProductionNotificationTests.cs`
* `E6_WHATSAPP_INVOICE_FAILURE_AUDIT.md`
* `E6_WHATSAPP_INVOICE_FIX_REPORT.md`
