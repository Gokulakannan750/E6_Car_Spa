# Baylior Phase 1 content pack

Prepared 14 October 2026 for `SIGNUP_PLAN.md`, Phase 1 only. Status: content and all four screenshots approved by the user on 14 October 2026. Assets verified. Production catalogue/trial confirmation remains a release dependency; use neutral wording until verified. Do not treat this as release approval.

## Identity and page copy

- Product: **Baylior — Business Suite**.
- Tagline: **One suite. Every detail.**
- Attribution: **A product of Trovo Tech Solutions.** Trovo bills and supports the product.
- Hero: **Run your car spa on one suite.**
- Hero description: **Manage customers, vehicles, job cards, invoices, payments and staff with Baylior for Windows and Android. Choose the modules your business needs.**
- Safe actions while production trial availability is unconfirmed: **Sign up**, **View pricing**, **Talk to us**. Enable trial-specific copy only after production confirmation. Do not hard-code trial length or prices.

## Feature blocks and implementation evidence

Paths below are relative to the app repository. Evidence establishes implemented capability, not production entitlement or approval of final marketing copy.

| Block | Proposed copy | Evidence |
|---|---|---|
| Customers and vehicles | Keep customer and vehicle records together with the jobs you create for them. | `apps/desktop/renderer/src/features/customers/`; `apps/desktop/renderer/src/features/job-cards/NewJobCard.tsx` |
| Job cards | Track work from draft and in progress through quality check, ready and delivered. Keep services and job status in the job card. | `apps/desktop/renderer/src/features/job-cards/JobCardDetails.tsx` (status labels); `NewJobCard.tsx` |
| Billing and invoices | Create GST and cash invoices with your business details, service lines and totals. | `apps/desktop/renderer/src/features/invoices/InvoicePrintDocument.tsx` (GST/cash documents and stored tax breakdown) |
| Payments | Record payments and review collections and outstanding invoice balances. | `apps/desktop/renderer/src/features/reports/financialReports.ts` (collections/outstanding); `apps/signup-web/src/lib/featureNames.ts` (cash, UPI, card and bank) |
| Staff and attendance | Maintain your staff directory and record attendance. Add the Staff advances & salary module for advances and salary workflows. | `apps/desktop/renderer/src/features/staff/StaffDirectoryPage.tsx`, `AttendancePage.tsx`, `SalaryPage.tsx`; `features/subscription/subscriptionFeatures.ts` |
| Reports and exports | Review sales, collections and outstanding balances, and export reports to Excel. Additional report access depends on your modules and permissions. | `apps/desktop/renderer/src/features/reports/financialReports.ts`, `excelFinancialReportGenerator.ts`; `features/subscription/subscriptionFeatures.ts` |
| Outside jobs & vendors | Send work to outside vendors and track its cost and your margin. | `apps/signup-web/src/lib/featureNames.ts`; desktop `features/job-cards/OutsideJobsSection.tsx` |
| Staff advances & salary | Track advances and monthly salary, including advance recovery. | `apps/signup-web/src/lib/featureNames.ts`; desktop `features/staff/SalaryPage.tsx` |
| WhatsApp automation | Send invoice and payment messages to customers on WhatsApp. | `apps/signup-web/src/lib/featureNames.ts`; `docs/WHATSAPP_SAAS_DESIGN.md`. Do not claim one-click setup or Meta approval. |
| Advanced reports | Explore GST, staff productivity, job turnaround and margins. | `apps/signup-web/src/lib/featureNames.ts`; desktop `features/reports/`; `features/subscription/subscriptionFeatures.ts` |
| Audit trail | Review recorded actions such as invoice cancellations, payments and attendance changes. | `apps/signup-web/src/lib/featureNames.ts`; `apps/desktop/renderer/src/features/audit/AuditLogPage.tsx`; `backend/api/CarSpaManagement.Api/Domain/Constants/AuditActions.cs`; `Application/Services/AuditLogService.cs`. |
| Showroom / B2B module | Manage dealership showroom work with staff, daily vehicle logs and dealer billing. | `apps/signup-web/src/lib/featureNames.ts`; desktop `features/showroom/`; `features/reports/MonthlyShowroomReportView.tsx` |
| Franchise network | View approved totals shared by your franchise branches. | `apps/signup-web/src/lib/featureNames.ts`; desktop `features/franchise/FranchiseDashboardPage.tsx`; `docs/SAAS_FRANCHISE_VS_BRANCH_DESIGN.md`. Do not imply unrestricted access to branch data. |

## Module labels and plan treatment

Local GET catalogue snapshot also confirms these module labels and plan mappings; see RELEASE_SETTINGS.md. Production remains unverified. Source: `backend/api/CarSpaManagement.Api/Infrastructure/Platform/PlatformCatalogSeeder.cs`, `ProfessionalModules`, `Plans`, `AddOns`; cross-checked with `apps/signup-web/src/lib/featureNames.ts` and desktop entitlement mapping. These are seed defaults; admin changes are not overwritten by seeding.

| Catalogue label | Starter default | Professional default | Landing-page qualifier |
|---|---|---|---|
| Outside jobs & vendors | Add-on | Included | Professional, or add-on |
| Staff advances & salary | Add-on | Included | Professional, or add-on |
| WhatsApp automation | Add-on | Included | Professional, or add-on; describe invoice/payment messages |
| Advanced reports | Add-on | Included | Professional, or add-on |
| Audit trail | Add-on | Included | Professional, or add-on |
| Showroom / B2B module | Add-on | Add-on | Add-on, any plan |
| Franchise network (up to 10 franchise branches) | Add-on | Add-on | Add-on, any plan |
| 10 more franchise branches | Add-on | Add-on | Extra branch pack; do not imply standalone network access |

## Other landing-page sections

- Windows and Android: **Choose a Windows, Android or combined licence for each user. View current licence options and prices on the pricing page.** Evidence: signup `lib/rules.ts` and `pages/PlanStep.tsx`.
- How it works: **1. Enter your business details. 2. Choose an available plan or trial. 3. Install the app and register with your company and registration codes.** Evidence: `docs/SIGNUP_API.md`, signup pages BusinessStep, PlanStep and DonePage. Trial wording remains conditional.
- Built for car spas: **Keep your daily jobs together, with optional modules for outside vendors, dealership work and franchise networks.** Apply module qualifiers above.
- Pricing teaser: **Plans for your business. Choose licences and modules on the live pricing page.** No fixed amounts, discounts or trial duration.
- Closing: **Ready to get started?** Actions: Sign up / Talk to us.
- Get the app: **Contact Trovo for the Windows and Android installers.** Replace with verified download/store links when available; do not invent links.

## FAQ draft

- **How does licensing work?** Each user needs a licence for Windows, Android or both. See the pricing page for current options.
- **Is a trial available?** Check the signup page for current trial availability, eligibility and duration. (No static promise before production verification.)
- **Can I add users later?** The Owner can manage the subscription inside the app; available changes and charges are shown there. Evidence: desktop `features/subscription/ChangePlanDialog.tsx`, `OwnerBillingPanel.tsx`.
- **How do I pay?** Follow the payment options shown during signup, or contact Trovo for assistance. Do not advertise a live gateway until configured and verified.
- **Where do I sign in?** Install Baylior on Windows or Android, register with your codes and sign in inside the app. There is no customer web login in this journey.
- **What about privacy?** Read the Privacy Policy for how information is handled. Do not claim encryption, certification, backup guarantees or retention periods without verified policy and operational evidence.
- **How can I get help?** Contact Trovo Tech Solutions using the site's verified contact details.

## E6 permission

User instruction, 14 October 2026: omit the E6 endorsement for now. No “Runs on Baylior” claim, E6 testimonial or customer-logo endorsement is cleared by this pack. Gokul Detailing test screenshots are a separate capture task, not an E6 endorsement.

## Phase 1 acceptance

- [x] Identity and palette checked against `design/brand/README.md`.
- [x] Draft feature copy and seed module mapping prepared with source evidence.
- [x] Website asset selection prepared (see ASSETS.md).
- [x] E6 endorsement omitted by user instruction.
- [x] Four real screenshots captured and approved by the user, including their visible demo fields (14 October 2026).
- [x] User approves screenshot selection (14 October 2026).
- [x] User approves final copy (14 October 2026).
- [x] Production catalogue/trial verification explicitly held in RELEASE_SETTINGS.md as an unresolved release dependency; neutral wording retained. This does not claim production verification has passed.
- [x] Seven website asset copies verified by SHA-256 against design/brand (14 October 2026).

Phase 1 content and assets are approved and ready for Phase 2 local implementation. The production catalogue/trial check from SIGNUP_PLAN.md remains open for release; no trial-specific or fixed availability promises may be published until verified.





