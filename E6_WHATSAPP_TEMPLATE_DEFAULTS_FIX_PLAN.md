# E6 Car Spa — WhatsApp Template Defaults & Fallbacks Audit & Fix Plan

## Executive Summary

An audit of default and fallback template references across the E6 Car Spa codebase was conducted to reconcile legacy references to `e6_carspa_invoice_generated` with the official, Meta-approved invoice template **`e6_carspa_invoice_pdf`**.

* **Current Database Configuration:** The active database (`E6CarSpaNew`) already has `InvoiceTemplateName` correctly configured to **`e6_carspa_invoice_pdf`** (Language: `en`).
* **Dispatch Pipeline:** The backend message dispatch pipeline (`WhatsAppService.cs`) is **100% template-structure/component-driven** and contains **zero** hard-coded template name comparisons in its dispatch logic.
* **Scope of Defaults:** Legacy references to `e6_carspa_invoice_generated` exist solely as initial C# entity property defaults, EF Core entity type configuration defaults, lazy seed entity creation in `WhatsAppService.cs`, and frontend React initial state / fallback values.
* **Migration Safety:** All existing EF Core migrations applied to the database are historical and **must remain untouched**. Any update to EF schema defaults will be handled cleanly via a new migration or EF Core model alignment.

---

## Section A: Current Database Invoice Template

Direct query of the active PostgreSQL database (`E6CarSpaNew`, table `WhatsAppConfigurations`, `SingletonKey = 1`) reveals the following configuration:

| Column Name | Database Value | Status |
| :--- | :--- | :--- |
| **`Id`** | `7a856657-eb4b-468b-9cf0-900fbb06819a` | Primary Key |
| **`SingletonKey`** | `1` | Singleton row |
| **`IsEnabled`** | `True` | Active |
| **`PhoneNumberId`** | `1263387163523264` | Meta Phone ID |
| **`BusinessAccountId`** | `1046927407924057` | Meta WABA ID |
| **`GraphApiVersion`** | `v25.0` | Meta API Version |
| **`InvoiceNotificationsEnabled`** | `True` | Active |
| **`PaymentCompletedNotificationsEnabled`** | `True` | Active |
| **`InvoiceTemplateName`** | **`e6_carspa_invoice_pdf`** | **CORRECT & ACTIVE** |
| **`InvoiceTemplateLanguage`** | `en` | **CORRECT** |
| **`PaymentCompletedTemplateName`** | **`e6_car_spa_app`** | **CORRECT & ACTIVE** |
| **`PaymentCompletedTemplateLanguage`** | `en` | **CORRECT** |
| **`HealthStatus`** | `Healthy` | Verified |

> [!NOTE]
> The active database row is already correctly pointing to `e6_carspa_invoice_pdf`. No data correction is needed in the live database row.

---

## Section B: Audit of Every Location Referencing `e6_carspa_invoice_generated`

| Location | File & Line | Type / Role | Description |
| :--- | :--- | :--- | :--- |
| **1. Domain Entity** | [WhatsAppConfiguration.cs:29](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Domain/Entities/WhatsAppConfiguration.cs#L29) | **Active C# Default** | Property initializer: `public string InvoiceTemplateName { get; set; } = "e6_carspa_invoice_generated";` |
| **2. EF Core Entity Config** | [WhatsAppConfigurationConfiguration.cs:54](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Infrastructure/Configurations/WhatsAppConfigurationConfiguration.cs#L54) | **Active EF Schema Default** | Fluent API configuration: `.HasDefaultValue("e6_carspa_invoice_generated")` |
| **3. Seed / Fallback Creator** | [WhatsAppService.cs:1836](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Application/Services/WhatsAppService.cs#L1836) | **Active Runtime Seed** | Fallback in `GetOrCreateConfigEntityAsync()`: `InvoiceTemplateName = "e6_carspa_invoice_generated"` when creating a new config on clean install |
| **4. Frontend Initial State** | [WhatsAppSettingsSection.tsx:83](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/settings/WhatsAppSettingsSection.tsx#L83) | **UI Initial State** | React state initialization: `useState('e6_carspa_invoice_generated')` before API response loads |
| **5. Frontend Fallback** | [WhatsAppSettingsSection.tsx:104](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/settings/WhatsAppSettingsSection.tsx#L104) | **UI Fallback** | `setInvoiceTemplateName(data.invoiceTemplateName \|\| 'e6_carspa_invoice_generated');` |
| **6. Frontend Unit Tests** | `api.test.ts:1225`, `WhatsAppSettingsSection.test.tsx:28`, `SettingsPage.test.tsx:63` | **Test Fixtures** | Mock data objects in test files |
| **7. Backend Unit Tests** | `WhatsAppProductionNotificationTests.cs`, `WhatsAppTemplateDiscoveryTests.cs` | **Test Scenarios** | Specific test fixtures validating dynamic template handling for text-only/button templates |
| **8. Historical EF Migrations** | `20260824112926_AddWhatsAppIntegration.cs:27`, `.Designer.cs:1293`, `20260908114613...Designer.cs:1295`, `20260908122704...Designer.cs:1302` | **Historical Migrations** | Immutable historical migration records already executed in database |
| **9. Model Snapshot** | `AppDbContextModelSnapshot.cs:1299` | **EF Core Model Snapshot** | EF Core snapshot representing entity metadata |

---

## Section C: Locations That Should Change to `e6_carspa_invoice_pdf`

The following **active default** locations should be updated to ensure any new installation, fallback seed, or UI initial state defaults cleanly to `e6_carspa_invoice_pdf`:

1. **[WhatsAppConfiguration.cs](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Domain/Entities/WhatsAppConfiguration.cs#L29)**
   ```csharp
   // Line 29:
   [MaxLength(100)]
   public string InvoiceTemplateName { get; set; } = "e6_carspa_invoice_pdf";
   ```

2. **[WhatsAppConfigurationConfiguration.cs](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Infrastructure/Configurations/WhatsAppConfigurationConfiguration.cs#L54)**
   ```csharp
   // Line 54:
   builder.Property(c => c.InvoiceTemplateName)
       .HasMaxLength(100)
       .HasDefaultValue("e6_carspa_invoice_pdf")
       .IsRequired();
   ```

3. **[WhatsAppService.cs](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Application/Services/WhatsAppService.cs#L1836)**
   ```csharp
   // In GetOrCreateConfigEntityAsync():
   config = new WhatsAppConfiguration
   {
       Id = Guid.NewGuid(),
       SingletonKey = 1,
       IsEnabled = false,
       PhoneNumberId = string.Empty,
       BusinessAccountId = string.Empty,
       GraphApiVersion = "v25.0",
       InvoiceNotificationsEnabled = true,
       PaymentCompletedNotificationsEnabled = true,
       InvoiceTemplateName = "e6_carspa_invoice_pdf",
       InvoiceTemplateLanguage = "en",
       PaymentCompletedTemplateName = "e6_car_spa_app",
       PaymentCompletedTemplateLanguage = "en",
       CreatedAt = DateTime.UtcNow
   };
   ```

4. **[WhatsAppSettingsSection.tsx](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/settings/WhatsAppSettingsSection.tsx#L83)**
   ```typescript
   // Lines 83-84 & 104-105:
   const [invoiceTemplateName, setInvoiceTemplateName] = useState('e6_carspa_invoice_pdf');
   const [invoiceTemplateLanguage, setInvoiceTemplateLanguage] = useState('en');
   // ...
   setInvoiceTemplateName(data.invoiceTemplateName || 'e6_carspa_invoice_pdf');
   setInvoiceTemplateLanguage(data.invoiceTemplateLanguage || 'en');
   ```

5. **Desktop Unit Test Mocks:**
   - [api.test.ts](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/lib/api.test.ts#L1225)
   - [WhatsAppSettingsSection.test.tsx](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/settings/WhatsAppSettingsSection.test.tsx#L28)
   - [SettingsPage.test.tsx](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/apps/desktop/renderer/src/features/settings/SettingsPage.test.tsx#L63)

---

## Section D: Historical Migrations That Must Remain Untouched

The following files represent historical schema migrations that have already been applied to the PostgreSQL database:

- [20260824112926_AddWhatsAppIntegration.cs](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Migrations/20260824112926_AddWhatsAppIntegration.cs)
- [20260824112926_AddWhatsAppIntegration.Designer.cs](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Migrations/20260824112926_AddWhatsAppIntegration.Designer.cs)
- [20260908114613_AddVehicleRegistrationUniqueIndex.Designer.cs](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Migrations/20260908114613_AddVehicleRegistrationUniqueIndex.Designer.cs)
- [20260908122704_AddWhatsAppHealthMonitoring.Designer.cs](file:///e:/TTS/Projects/Desktop_Apps/E6_Car_spa_new/backend/api/CarSpaManagement.Api/Migrations/20260908122704_AddWhatsAppHealthMonitoring.Designer.cs)

> [!WARNING]
> **IMMUTABILITY PRINCIPLE:**
> Modifying historical migration files that have already been recorded in `__EFMigrationsHistory` can cause checksum mismatches and break migration consistency across production and development environments.
> These files **must NOT be edited**.
> If database column default constraints are to be updated for future schema migrations, an additive EF migration (e.g. `UpdateWhatsAppDefaultTemplateNames`) will be generated.

---

## Section E: Database Configuration Requirements

* **Live Data Row (`WhatsAppConfigurations` table):**
  * `InvoiceTemplateName` is **already set to `e6_carspa_invoice_pdf`**.
  * `InvoiceTemplateLanguage` is **already set to `en`**.
  * `PaymentCompletedTemplateName` is **already set to `e6_car_spa_app`**.
  * `PaymentCompletedTemplateLanguage` is **already set to `en`**.
  * **Result:** **NO SQL UPDATE or data alteration is required** for the current running application.

* **Database Column Default Constraint:**
  * The column default in PostgreSQL is currently `'e6_carspa_invoice_generated'`.
  * Because rows are managed exclusively by EF Core using explicit entity instantiation via `GetOrCreateConfigEntityAsync()` (or updated via Settings UI), the PostgreSQL column default constraint is never triggered in normal application runtime.
  * Updating `WhatsAppConfigurationConfiguration.cs` and adding a new migration is optional but recommended for fresh installs.

---

## Section F: WhatsAppService Dispatch Logic Status

* **Requires Modification?** **NO.**
* **Explanation:**
  1. `WhatsAppService.cs` does **not** rely on hard-coded template names during dispatch.
  2. It reads `config.InvoiceTemplateName` dynamically from the database.
  3. It fetches the template metadata from Meta's API (`/v25.0/{waba_id}/message_templates`).
  4. It inspects whether the template requires a `DOCUMENT` header component, a dynamic `URL` button, or body variables.
  5. If the template has a `DOCUMENT` header (as `e6_carspa_invoice_pdf` does), it automatically generates the PDF with QuestPDF, uploads the file to Meta Media API, and binds the `id` to the document header.
  6. If the template uses a `URL` button (as `e6_carspa_invoice_generated` did), it resolves the public link token and binds the button component.
  7. As proven in `E6_WHATSAPP_TEMPLATE_COUPLING_AUDIT.md`, changing template names in Settings UI to any valid template requires zero code modifications in `WhatsAppService.cs`.

---

## Summary Checklist for Next Execution Phase

When approved to execute:
- [ ] Update `WhatsAppConfiguration.cs` (C# entity default to `e6_carspa_invoice_pdf` / `en`).
- [ ] Update `WhatsAppConfigurationConfiguration.cs` (EF default to `e6_carspa_invoice_pdf` / `en`).
- [ ] Update `WhatsAppService.cs` `GetOrCreateConfigEntityAsync()` fallback default to `e6_carspa_invoice_pdf` / `en` / `e6_car_spa_app` / `en`.
- [ ] Update `WhatsAppSettingsSection.tsx` UI state defaults to `e6_carspa_invoice_pdf` / `en`.
- [ ] Align test fixture mocks in `api.test.ts`, `WhatsAppSettingsSection.test.tsx`, and `SettingsPage.test.tsx`.
- [ ] Run full test suites (`dotnet test` and `pnpm test`) to confirm 100% pass rate.
