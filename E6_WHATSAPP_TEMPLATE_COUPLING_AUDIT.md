# E6 Car Spa — WhatsApp Template-Name Coupling Audit

**Audit Date:** September 20, 2026  
**Status:** COMPLETE (READ-ONLY AUDIT)  
**Scope:** Evaluation of backend template-name coupling, dynamic component handling, and architectural extensibility for WhatsApp notifications (`InvoiceFinalized` and `PaymentCompleted`).

---

## 1. Executive Summary

This audit assesses whether changing configured Meta WhatsApp template names in the future will require backend source code changes or whether the implementation is dynamic.

### Key Finding
The E6 Car Spa WhatsApp dispatch architecture is **primarily Template-Structure/Component-Driven**, with minor **fallback heuristics** for body variable resolution and initial entity defaults.

* **Template Name Changes:** Changing a template name (e.g. from `e6_carspa_invoice_pdf` to `e6_carspa_invoice_v2` or any newly approved Meta template) in Settings UI / database **will continue to work immediately without any backend code changes**, provided the new template follows a compatible component structure (`DOCUMENT` header or URL button with supported body variable count).
* **Zero Hard-Coded Template Name Comparisons in Dispatch Logic:** `WhatsAppService.cs` does **not** contain conditional logic like `if (template.Name == "e6_carspa_invoice_pdf")`. It queries Meta Graph API dynamically, matches the configured name from database, and constructs the dispatch payload based entirely on the template's inspected components (`HEADER`, `BODY`, `BUTTONS`).

---

## 2. Classification: Template-Name-Driven vs. Component-Driven

The implementation is classified as:

### **Category 3: A Mixture (90% Structure-Driven / 10% Initializer & Heuristic Defaults)**

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WhatsApp Dispatch Flow                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Template Resolution:    100% Dynamic (matches any name via DB)     │
│ 2. Language Matching:      100% Dynamic (matches any lang via DB)     │
│ 3. Header / PDF Handling:  100% Structure-Driven (Format == DOCUMENT)  │
│ 4. URL Button Handling:    100% Structure-Driven (Type == URL & {{1}}) │
│ 5. Body Variable Parser:   Hybrid (Snapshot array + Context heuristics)│
│ 6. Initial Fallback Defaults: Hardcoded Initializers in C# & React     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Direct Answers to Specific Questions

### Question A: If I change `e6_carspa_invoice_pdf` to `e6_carspa_invoice_v2` (with the same structure), will the backend continue working without code changes?

**YES, 100% WITHOUT CODE CHANGES.**

#### Technical Proof:
1. **Dynamic Resolution in `WhatsAppService.cs` (Lines 819-820):**
   ```csharp
   var targetTemplate = templatesResponse.Templates.FirstOrDefault(t =>
       string.Equals(t.Name, templateName, StringComparison.OrdinalIgnoreCase));
   ```
   `templateName` is loaded directly from `config.InvoiceTemplateName`. If the database/Settings UI is updated to `e6_carspa_invoice_v2`, `WhatsAppService` queries Meta, finds `e6_carspa_invoice_v2`, and binds to it.
2. **Dynamic Header & PDF Handling (Lines 910-912, 1023-1121):**
   ```csharp
   var isDocumentHeader = message.MessageType == WhatsAppMessageType.InvoiceFinalized
       && headerComponent != null
       && string.Equals(headerComponent.Format, "DOCUMENT", StringComparison.OrdinalIgnoreCase);
   ```
   Because `e6_carspa_invoice_v2` has `HEADER: DOCUMENT`, the backend automatically generates the PDF via `InvoicePdfGenerator`, uploads to Meta Media API, and attaches the document component.
3. **Dynamic Body Resolution (Lines 985-1015):**
   Resolves the 4 body variables from the message snapshot.
4. **Dispatch:** Dispatches the template payload to Meta Graph API and updates status to `Sent`.

---

### Question B: If the new template has a different structure, exactly what would need to change?

| New Template Structural Difference | Backend Behavior | Code Change Required? | What Needs to Change |
| :--- | :--- | :--- | :--- |
| **Switches from DOCUMENT header to URL-Button (e.g. Web invoice link)** | **Supported dynamically.** Detects `headerComponent == null` & `BUTTONS: URL`, generates invoice token, attaches button, and skips PDF generation. | **NO** | None (Handled dynamically). |
| **Switches to Text-Only (No header, no buttons)** | **Supported dynamically.** Validates body variables and sends text-only template. | **NO** | None (Handled dynamically). |
| **Changes variable count (e.g., 5 body variables instead of 4)** | `QueueInvoiceFinalizedNotificationAsync` currently snapshots 4 variables in `parameters` array. If template has 5 variables, Step 1 array length mismatch occurs; Step 2 attempts contextual English keyword matching from `bodyText`. If the 5th variable is recognizable (e.g. `Due Date: {{5}}` -> `dateVal`), it resolves. If unrecognized, validation rejects. | **MAYBE** | If adding new domain fields (e.g. Tax Breakdown, Discount Amount), snapshot creation in `QueueInvoiceFinalizedNotificationAsync` should include the new fields. |
| **Introduces Dynamic Header Parameters (e.g. `HEADER: TEXT` with `{{1}}`)** | Rejected at line 925 (`"contains unsupported dynamic parameters in header"`). | **YES** | Header text variable resolution logic would need to be added to `WhatsAppService.cs`. |
| **Introduces Quick Reply / Authentication / Flow Buttons** | Unsupported button types are rejected at line 1223. | **YES** | Additional button payload handlers would need to be added for interactive/flow buttons. |
| **Non-English Language Template with non-standard phrasing** | Contextual parser (`ResolveBodyParameters`) checks English keywords (`amount`, `vehicle`, `invoice`, etc.). | **MAYBE** | If snapshot `parameters` array length matches variable count, it succeeds. Otherwise, keywords in other languages are not matched. |

---

### Question C: Every Place Where a Specific Template Name is Hard-Coded

The following is a comprehensive inventory of all hard-coded template name occurrences across the repository:

#### 1. Backend Domain & EF Core Entity Defaults (Initial DB state only)
* **`backend/api/CarSpaManagement.Api/Domain/Entities/WhatsAppConfiguration.cs`**
  * Line 29: `public string InvoiceTemplateName { get; set; } = "e6_carspa_invoice_generated";`
  * Line 35: `public string PaymentCompletedTemplateName { get; set; } = "e6_carspa_payment_completed";`
* **`backend/api/CarSpaManagement.Api/Infrastructure/Configurations/WhatsAppConfigurationConfiguration.cs`**
  * Line 54: `.HasDefaultValue("e6_carspa_invoice_generated")`
  * Line 64: `.HasDefaultValue("e6_carspa_payment_completed")`
* **`backend/api/CarSpaManagement.Api/Application/Services/WhatsAppService.cs`**
  * Line 1836: `InvoiceTemplateName = "e6_carspa_invoice_generated"` (in `GetOrCreateConfigEntityAsync()` fallback)
  * Line 1838: `PaymentCompletedTemplateName = "e6_carspa_payment_completed"`
  * Line 1704 (Comment only): `// Pattern matching e6_car_spa_app: "Thank you {{1}}! Payment of Rs.{{2}} for {{3}} received."`

#### 2. Backend Database Migrations
* **`backend/api/CarSpaManagement.Api/Migrations/20260824112926_AddWhatsAppIntegration.cs`** (Lines 27, 29)
* **`backend/api/CarSpaManagement.Api/Migrations/AppDbContextModelSnapshot.cs`** (Lines 1299, 1339)

#### 3. Desktop UI Initial State Defaults (Client-side fallback before API response)
* **`apps/desktop/renderer/src/features/settings/WhatsAppSettingsSection.tsx`**
  * Line 83: `const [invoiceTemplateName, setInvoiceTemplateName] = useState('e6_carspa_invoice_generated');`
  * Line 85: `const [paymentCompletedTemplateName, setPaymentCompletedTemplateName] = useState('e6_carspa_payment_completed');`
  * Line 104: `setInvoiceTemplateName(data.invoiceTemplateName || 'e6_carspa_invoice_generated');`
  * Line 106: `setPaymentCompletedTemplateName(data.paymentCompletedTemplateName || 'e6_carspa_payment_completed');`

#### 4. Automated Tests
* Unit & integration test mock templates in `WhatsAppProductionNotificationTests.cs`, `WhatsAppTemplateDiscoveryTests.cs`, `SettingsPage.test.tsx`, `WhatsAppSettingsSection.test.tsx`, `api.test.ts`.

---

### Question D: Every Place Where the Backend Dynamically Handles Template Components

1. **Dynamic Meta Template Discovery (`WhatsAppService.cs:235-322`):**
   * Endpoint: `GET https://graph.facebook.com/{version}/{wabaId}/message_templates?limit=100`
   * Discovers all approved templates in the user's WABA dynamically.
2. **Dynamic Component Parsing (`WhatsAppService.cs:2180-2302`):**
   * `ParseTemplateDto()` and `ParseComponentDto()` parse any valid Meta component structure:
     * `HEADER`: format (`DOCUMENT`, `TEXT`, `IMAGE`, `VIDEO`), variables, text.
     * `BODY`: text, variable extraction (`VariableRegex.Matches(text)` -> `{{1}}`..`{{n}}`), example values.
     * `BUTTONS`: `URL`, `PHONE_NUMBER`, dynamic URL variables.
     * `FOOTER`: static text.
3. **Dynamic Template & Language Matching (`WhatsAppService.cs:819-867`):**
   * Compares `t.Name` against configured `config.InvoiceTemplateName` / `config.PaymentCompletedTemplateName` (case-insensitive).
   * Compares `t.Language` against configured `config.InvoiceTemplateLanguage` / `config.PaymentCompletedTemplateLanguage`.
4. **Dynamic Header & Media Handling (`WhatsAppService.cs:910-912, 1023-1121`):**
   * Evaluates `isDocumentHeader` boolean dynamically from `headerComponent.Format == "DOCUMENT"`.
   * Only calls `_invoicePdfGenerator.GenerateInvoicePdf()` and `UploadWhatsAppDocumentAsync()` if `isDocumentHeader == true`.
   * Attaches document header component with dynamic `media_id` and filename.
5. **Dynamic Button Component Construction (`WhatsAppService.cs:1134-1228`):**
   * Iterates through `buttonsComponent.Buttons`.
   * Checks `isDynamicUrl = btn.Type == "URL" && (btn.Url.Contains("{{") || btn.Example?.Count > 0)`.
   * Resolves public invoice link token and appends dynamic button component.
6. **Dynamic Payload Assembly (`WhatsAppService.cs:1230-1259`):**
   * Assembles the final `components` array with only the components present in the target template.

---

## 4. Analysis of Body Parameter Resolution (`ResolveBodyParameters`)

The parameter resolution method in `WhatsAppService.cs:1520-1728` uses a three-tier resolution strategy:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Explicit Snapshot Array (`parameters` in TemplateParametersJson)│
├────────────────────────────────────────────────────────────────────────┤
│ If snapshot parameters array length >= expectedVarCount, uses the      │
│ stored parameters array directly.                                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (If count mismatch or empty)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 2: Contextual Keyword Heuristics (inspects bodyText around {{i}}) │
├────────────────────────────────────────────────────────────────────────┤
│ Parses labels before/after {{i}}:                                      │
│ - Greetings ("Hi", "Hello", "Dear")          -> customerName           │
│ - Currency/Amount ("Rs", "₹", "Total", "Due")-> totalAmount/payment    │
│ - Vehicle labels ("Vehicle", "Reg", "Car")   -> vehicleRegistration    │
│ - Invoice labels ("Invoice", "Bill", "Inv")  -> invoiceNumber          │
│ - Date labels ("Date", "Dated", "On")        -> invoiceDate/paymentDate│
│ - Link labels ("View", "Download", "URL")    -> publicUrl              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (If contextual match incomplete)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 3: Positional Fallback Pool                                       │
├────────────────────────────────────────────────────────────────────────┤
│ InvoiceFinalized: [Customer, Invoice#, Vehicle, Total, Date, URL]      │
│ PaymentCompleted: [Customer, PaymentReceived, Vehicle/Invoice#]        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Recommended Smallest Architectural Improvement

To make template switching **100% agnostic to language, variable ordering, and custom parameter counts** without modifying backend code:

### 1. Update Outdated Default Initializers (Housekeeping)
Update the fallback defaults in `WhatsAppConfiguration.cs`, `WhatsAppConfigurationConfiguration.cs`, `WhatsAppService.cs:1836`, and `WhatsAppSettingsSection.tsx` from `"e6_carspa_invoice_generated"` to `"e6_carspa_invoice_pdf"`.

### 2. Optional: Named Parameter Dictionary in Message Snapshot
Instead of relying on a positional `parameters` array or English regex keywords in Tier 2, ensure the snapshot in `QueueInvoiceFinalizedNotificationAsync` and `QueuePaymentCompletedNotificationAsync` provides a rich dictionary of named variables:
```json
{
  "customerName": "Gokula Kannan",
  "invoiceNumber": "INV-2026-000010",
  "vehicleRegistration": "TN33FF9C",
  "totalAmount": "2,950.00",
  "paidAmount": "2,950.00",
  "balanceAmount": "0.00",
  "invoiceDate": "20/09/2026",
  "publicUrl": "https://invoice.e6carspa.com/i/token123"
}
```
*(This named dictionary is already captured in the current message snapshot!)*

---

## 6. Conclusion Summary

```text
AUDIT CONCLUSION:

1. IS THE BACKEND COUPLED TO TEMPLATE NAMES?
   NO. Template matching and dispatch in WhatsAppService.cs is 100% dynamic based on the template name configured in Settings/database.

2. IF A TEMPLATE NAME IS CHANGED (e.g. to e6_carspa_invoice_v2):
   It will work IMMEDIATELY without any backend code changes as long as the new template has a compatible structure (DOCUMENT header or dynamic URL button, with up to 4-6 standard parameters).

3. WHERE DO HARD-CODED STRINGS EXIST?
   Only as initial database column defaults and client-side form initial state fallback values (when no settings have been saved yet).

4. ARE CODE CHANGES REQUIRED TO SWITCH TEMPLATES?
   NO. Template selection is fully controllable via the Settings UI and WhatsAppConfigurations database table.
```
