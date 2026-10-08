# WhatsApp — Managed Template Pack: What Changed

| | |
|---|---|
| **Branch** | `feature/whatsapp-managed-templates` (separate working folder: `E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new_whatsapp`) |
| **Commits** | `80fbf0f1` (backend work in progress), `2023428b` (migration, desktop, tests) |
| **Status** | Committed and all tests pass. **Not merged into `main`, not pushed.** Not yet tried against Meta for real. |
| **Date** | 6 October 2026 |

---

## 1. Why

Message templates live on each business's own WhatsApp Business Account (WABA), and Meta must approve every one before it can be sent. Until now, someone had to:

1. create the templates by hand in WhatsApp Manager;
2. type their exact names into Car Spa's settings;
3. hope the variables lined up with what the app sends.

For Trovo's subscription product that doesn't scale: every client and every franchisee would need the same manual setup.

**Decision:** Trovo ships a **fixed, car-spa-specific set of templates** (a "managed pack"). The app creates them on the client's WhatsApp account with one click. There's no template editor; this is the same idea as Twilio's template tools, without the general-purpose designer.

---

## 2. What the user sees (Windows app)

**Settings → WhatsApp** has two additions.

### Meta App ID field
- Next to the Graph API version.
- Saved with the other WhatsApp settings.
- Needed because Meta reviews the invoice template with a sample PDF, and uploading that sample requires the app's ID.

### "Standard Message Templates" panel
| Column | Meaning |
|---|---|
| Purpose | "Invoice ready (with PDF)" or "Payment received" |
| Template | Meta template name |
| Status | Not created / Pending / Approved / Rejected (with Meta's reason) / Paused / Disabled |
| In use | Whether the app currently sends this template |

**Buttons:**
1. **Create standard templates** submits any missing templates to Meta. Templates that already exist are skipped.
2. **Refresh status** reads the latest approval status from Meta.
3. **Use approved templates** switches the app to the standard templates. It's enabled **only when Meta has approved both.** Until it's clicked, the business's existing templates keep being used, unchanged.

Users without the "manage business settings" permission see the panel read-only.

---

## 3. The templates

| | Invoice ready | Payment received |
|---|---|---|
| Meta name | `trovo_invoice_ready_v1` | `trovo_payment_received_v1` |
| Category / language | UTILITY / `en` | UTILITY / `en` |
| Header | **Document**: the invoice PDF | none |
| Body | Hello {{1}}, your invoice {{2}} for vehicle {{3}} is ready. Total amount: ₹{{4}}. Please find the invoice attached. Thank you! | Hello {{1}}, we have received your payment of ₹{{2}} for invoice {{3}}. Balance due: ₹{{4}}. Thank you! |
| {{1}} … {{4}} | customer name, invoice number, vehicle registration, total amount | customer name, amount received, invoice number, balance |
| Used for | invoice finalized | payment completed |

- **Values when data is missing:**
  - vehicle → `N/A`
  - amounts → `0.00`
  - name → `Customer`
  - invoice number → `INV`

  These are the same defaults as before, so a missing value never blocks a message.
- **Versioned names (`_v1`):** a future wording change ships as `_v2` instead of editing an approved template, so a working template is never broken while Meta re-reviews.

---

## 4. Calls made to Meta (Graph API)

All calls use the WhatsApp settings already saved (Graph version, WABA ID, encrypted access token). The token is decrypted only inside the server.

| Step | Request | Purpose |
|---|---|---|
| Read status | `GET /{version}/{waba-id}/message_templates?fields=name,status,language,rejected_reason&limit=100`, following pagination | Find which standard templates exist, their status and any rejection reason |
| Upload sample PDF, step 1 | `POST /{version}/{app-id}/uploads?file_name=sample-invoice.pdf&file_length=…&file_type=application/pdf` | Start Meta's Resumable Upload session |
| Upload sample PDF, step 2 | `POST /{version}/{upload-session-id}` with headers `Authorization: OAuth <token>` and `file_offset: 0`; body = PDF bytes | Upload the one-page sample invoice; Meta returns a file handle |
| Create template | `POST /{version}/{waba-id}/message_templates` with name, language, category and components (document header with the file handle; body text with example values) | Submit the template for Meta review |

**Unchanged:**
- Sending still uses `POST /{version}/{phone-number-id}/messages`.
- The invoice PDF upload for each message still uses `/media`.
- The app **never edits or deletes** templates on Meta.

---

## 5. Backend changes

### New files
| File | What it does |
|---|---|
| `Application/Common/WhatsAppTemplateCatalog.cs` | The template pack: definitions, example values, and the fixed order of message values for each template |
| `Application/Interfaces/IWhatsAppTemplateProvisioningService.cs` | Service contract: get status, create, activate |
| `Application/Services/WhatsAppTemplateProvisioningService.cs` | Talks to Meta (section 4); builds the status list; creates missing templates; switches the configuration once both are approved; writes audit entries |
| `Migrations/20261006102702_AddWhatsAppMetaAppId.cs` | Adds one nullable column, `MetaAppId` (max 50 characters), to `WhatsAppConfigurations` |

### Changed files
| File | Change |
|---|---|
| `Application/Services/WhatsAppService.cs` | **Sending:** if the template being sent is a standard one, its values are filled in the catalog's fixed order. Any other (custom) template still uses the existing logic, unchanged. Saves and returns `MetaAppId`; the configuration audit entry now includes it. Two helpers (version check, secret masking) opened up for reuse. |
| `Domain/Entities/WhatsAppConfiguration.cs`, `Infrastructure/Configurations/WhatsAppConfigurationConfiguration.cs` | New `MetaAppId` field |
| `Application/DTOs/WhatsApp/WhatsAppDtos.cs` | `MetaAppId` on the settings request and response; new types for the template status list, creation results and activation result |
| `Controllers/WhatsAppSettingsController.cs` | Three new endpoints (below) |
| `Domain/Constants/AuditActions.cs` | `WHATSAPP_TEMPLATES_PROVISIONED`, `WHATSAPP_TEMPLATES_ACTIVATED` |
| `Program.cs` | Registers the new service |

### New endpoints
| Method and route | Permission | Result |
|---|---|---|
| `GET /api/settings/whatsapp/managed-templates` | `settings.view` | Status of each standard template, plus whether switching is allowed |
| `POST /api/settings/whatsapp/managed-templates/provision` | `settings.business` | Creates missing templates; per-template result (Created / AlreadyExists / Failed + reason). Shares the WhatsApp test rate limit. |
| `POST /api/settings/whatsapp/managed-templates/activate` | `settings.business` | Switches invoice and payment notifications to the standard templates; refused unless both are Approved |

The permissions match the existing WhatsApp settings endpoints: viewing needs `settings.view`, changing needs `settings.business`.

---

## 6. Desktop changes

| File | Change |
|---|---|
| `features/settings/ManagedTemplatesPanel.tsx` (new) | The "Standard Message Templates" panel |
| `features/settings/WhatsAppSettingsSection.tsx` | Meta App ID field, loaded and saved with the settings; panel placed above "Available Meta Templates" |
| `lib/api.ts` | `metaAppId` on the settings types; three new API functions and their types |

**Android:** no changes. Android has no WhatsApp settings screen; configuring WhatsApp is an owner/admin task on desktop.

---

## 7. Safety and behaviour guarantees

- **Existing messages keep working.** Nothing changes until someone clicks **Use approved templates**, and the app refuses that until Meta has approved both templates.
- **Custom templates are untouched.** The fixed value order applies only to the two standard template names; every other template goes through the original logic.
- **The token is never exposed:**
  - it isn't returned by any endpoint;
  - it isn't written to logs or audit entries;
  - any Meta error text containing it is masked as `[REDACTED]` (covered by a test).
- **Audited:** creating templates (with each template's outcome) and switching templates (old and new template names) are recorded in the audit log.
- **One fault doesn't block the other:** if the invoice template fails (for example, no App ID), the payment template is still created, and each template's reason is shown.
- **No change** to when WhatsApp messages are sent, or to the queue, retries or invoice PDF attachment.

---

## 8. Tests

**Backend:** `WhatsAppManagedTemplateTests.cs`, 16 tests.
- Template pack:
  - values are filled in the right order, with the right defaults
  - each template has as many example values as variables
- Status:
  - not configured: no call is made to Meta
  - Meta's statuses and rejection reasons are mapped, and "In use" is shown correctly
- Creating:
  - the sample PDF is uploaded and both templates are created with the correct content
  - templates that already exist are skipped
  - a missing App ID fails only the invoice template
  - Meta's error is reported without exposing the token
- Activating:
  - refused until both templates are approved
  - switches the settings and is audited once both are approved
- **End to end:** a real payment message sent with the standard template carries its values in the right order. Disabling the new logic makes this test fail.
- Endpoint permissions: view versus business.

**Desktop:**
- `ManagedTemplatesPanel.test.tsx`, 4 tests:
  - statuses and rejection reason shown
  - create, with per-template failure reasons shown
  - switching only allowed after approval
  - read-only for users who can't manage settings
- `WhatsAppSettingsSection.test.tsx`: Meta App ID is loaded and saved.

**Full suites on the branch:**
- backend 948/948, including the real-PostgreSQL tests
- desktop 563/563, typecheck clean, build succeeds
- Android 882/882, analyzer unchanged

---

## 9. How to try it (needs your Meta details; nothing has been sent to Meta yet)

1. Start the API from the feature branch. The App ID migration applies automatically at startup.
2. In **Settings → WhatsApp**, enter:
   - Phone Number ID
   - WhatsApp Business Account ID
   - **Meta App ID** (App Dashboard → App settings → Basic)
   - the system-user access token

   Use the test account of the **Trovo Business Messaging** app first, and type the token yourself.
3. Click **Create standard templates**. Both templates appear in WhatsApp Manager as **Pending**.
4. Click **Refresh status** until both show **Approved**. That usually takes minutes, at most a day.
5. Click **Use approved templates**.
6. Finalize a test invoice for a customer whose phone is a verified test recipient, and check the WhatsApp message and PDF. Then record a payment and check that message.

---

## 10. Not included / next steps

- **More templates**, such as vehicle ready or job card created, are new entries in the template pack, plus a trigger for when each is sent.
- **Multi-business (SaaS) version:** the same service will run per client, using each client's own WhatsApp account and token from Meta's Embedded Signup (Tech Provider), instead of the single settings record.
- **Webhooks** (delivered and read receipts, real-time template-status updates) are not part of this change. Status is refreshed on demand.
- **Clearing the App ID from the screen** isn't possible: an empty field leaves the saved value unchanged. It can be replaced with a new ID.
- **Merge** `feature/whatsapp-managed-templates` into `main` once the Meta test in section 9 has passed.
