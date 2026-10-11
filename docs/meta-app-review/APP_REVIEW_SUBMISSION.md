# Meta App Review — Submission Pack for "Trovo Business Messaging"

**Goal:** Advanced Access for `whatsapp_business_messaging` and `whatsapp_business_management`, the "App Review" step under **Become a Partner → Become Tech Provider**.
**Business verification:** ✅ already approved.

---

## Part 1. App settings (App Dashboard → App settings → Basic)

| Field | What to enter |
|---|---|
| App icon | 1024 × 1024 px PNG/JPG of the Trovo logo (plain background, no transparency issues) |
| Display name | Trovo Business Messaging |
| Privacy Policy URL | `https://trovotechsolutions.in/privacy-policy`. Publish `PRIVACY_POLICY.md` there first. |
| Terms of Service URL (recommended) | `https://trovotechsolutions.in/terms`, if you have terms |
| User data deletion | Choose "Data deletion instructions URL": `https://trovotechsolutions.in/data-deletion` (publish `DATA_DELETION.md`) |
| Category | **Business and pages** (pick the closest business/messaging category offered) |
| App domains | `trovotechsolutions.in` |
| Contact email | A working email, ideally `admin@trovotechsolutions.in` |
| Business | Trovo Tech Solutions (verified portfolio) |

Both URLs must load publicly over **https** before you submit. Reviewers open them.

---

## Part 2. Permission descriptions (paste into the App Review form)

### `whatsapp_business_messaging`

**How will your app use this permission?**
> Trovo Business Messaging is used by Trovo's business software for small and medium businesses in India (billing, invoicing and job/order management). Our first product in production serves car spas, detailing studios and automotive service businesses. Each business connects its own WhatsApp Business Account and phone number to our app. Our software then sends two transactional (utility) template messages from the business's own number to that business's customers: (1) when the business generates an invoice, a message with the invoice PDF and the amount due; and (2) when the invoice is fully paid, a payment-received confirmation. Messages are sent only to customers the business has recorded, and only for that customer's own invoice. We do not send marketing messages, and we do not read or reply to conversations.

**How does it add value for users?**
> Small businesses get a professional, automatic receipt on WhatsApp, which their customers prefer to paper or SMS, without typing anything. Customers receive their invoice PDF immediately and a confirmation when they have paid.

**Testing instructions for reviewers**
> Our product is a Windows desktop application used by the business owner and staff, so a public login is not available. The attached screen recording shows the complete flow: connecting the business's WhatsApp details in Settings → WhatsApp, sending a template message from the app, and the message arriving in WhatsApp on the recipient's phone.

### `whatsapp_business_management`

**How will your app use this permission?**
> Our software manages each connected business's message templates on that business's own WhatsApp Business Account. With one action in Settings → WhatsApp ("Create standard templates"), it creates our standard utility templates (invoice ready, with a PDF document header; payment received) through the WhatsApp Business Management API, reads their approval status and any rejection reason, and lets the business switch to them once Meta has approved them. It also reads the account's phone number details and template list to show the connection's health. We only manage the WhatsApp assets the business has shared with our app.

**How does it add value for users?**
> Business owners don't have to design templates or use developer tools. Their notifications are set up correctly in minutes, and they can see whether Meta approved them.

**Testing instructions for reviewers**
> The attached screen recording shows the template being created from our app through the API, its status in our app, and the same template appearing in WhatsApp Manager.

---

## Part 3. Video 1: messaging (`whatsapp_business_messaging`)

**Must show:** the app sending a message, **and** WhatsApp receiving the same message, in one recording.

**Preparation**
- In the app's test number setup (WhatsApp → API Setup), add and verify your own mobile number as a recipient.
- Mirror your phone to the screen (e.g. Windows Phone Link or scrcpy) **or** keep WhatsApp Web open beside the app, so both are visible.
- Use an **approved** template, e.g. `hello_world`, or one of E6's approved templates.
- Recording tool: Windows Snipping Tool (screen recording) or OBS. 1080p, under about 3 minutes, English captions or narration.

**Script**
1. *(5 s)* Show the Car Spa software window with its title visible. Say or caption: "Trovo car spa software using the Trovo Business Messaging app."
2. *(20 s)* Open **Settings → WhatsApp**. Show the connected Phone Number ID and Business Account ID, and the token shown as "Encrypted at rest". **Don't** show the token itself.
3. *(10 s)* Click **Test connection** → "Connected".
4. *(20 s)* Scroll to **Send Test Message**, pick an approved template, enter your verified mobile number, fill the sample values, and click **Send**. Show the success message with the message ID.
5. *(15 s)* Switch to the phone or WhatsApp Web: the **same message arrives**. Keep it on screen for 3–4 seconds.
6. *(Optional, 30 s)* Show the real flow: finalize a test invoice for the test customer, and show the WhatsApp with the invoice PDF arriving.

---

## Part 4. Video 2: template management (`whatsapp_business_management`)

**Must show:** creating a message template through API calls, as a separate video.

**Preparation**
- The standard templates already exist on E6's account, so **"Create standard templates" will be greyed out there.** Point the test copy of the software at the **Test WhatsApp Business Account** (ID `1046927407924057`, test number), which doesn't have them yet.
  - Enter that account's IDs in Settings → WhatsApp of the **test copy** (feature branch), then save.

**Script**
1. *(10 s)* Show the app: **Settings → WhatsApp → Standard Message Templates**, both "Not created".
2. *(15 s)* Click **Create standard templates** → "Standard templates submitted to Meta…"; both show **Pending**.
3. *(20 s)* Switch to **WhatsApp Manager → Message templates** for the same account: `trovo_invoice_ready_v1` and `trovo_payment_received_v1` appear as **In review**. Open one to show the content matches.
4. *(10 s)* Back in the app, click **Refresh status**. If Meta has approved them by then, show **Approved** and click **Use approved templates**.

**Alternative, if anything blocks step 2:** use **Graph API Explorer** with your system-user token to `POST /{waba-id}/message_templates` with a simple utility template, show the JSON response with the `id` and status, then show it in WhatsApp Manager.

---

## Part 5. Submit

1. **Become Tech Provider → App Review → Begin App Review.**
2. Add both permissions with the texts from Part 2, and upload Video 1 and Video 2 to the matching permission.
3. Complete **access verification** if Meta asks for it (business details; it may ask how you'll serve clients: "independent Tech Provider onboarding client businesses via Embedded Signup").
4. Submit. Review usually takes a few days. If Meta rejects with a reason, fix that specific point and resubmit.

**Checklist before submitting**
- [ ] Privacy policy and data-deletion pages live over https
- [ ] App icon, category and contact email set
- [ ] Video 1 shows sending **and** receiving in one recording
- [ ] Video 2 shows the API template creation **and** the template in WhatsApp Manager
- [ ] No access token visible in either video
