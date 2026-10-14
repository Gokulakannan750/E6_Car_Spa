# Phase 5 staging setup

Status: preparation only. Host, API and disposable catalogue have not been confirmed. Do not enable website integration or deploy production from these examples.

1. Choose a **dedicated signup host**, document root and server. Configure a valid HTTPS certificate. The frontend expects to run at `/`; subdirectory hosting needs separate router/base configuration.
2. Copy `staging.example.json` to a local settings file and replace nulls with confirmed HTTPS addresses. No credentials belong in this file. Select `contact` payment mode unless a disposable staging database is explicitly confirmed for `test` mode.
3. On the API, use ASPNETCORE_ENVIRONMENT=Staging and the Platform settings in `api-staging.settings.example.json`, replacing SignupOrigin with the exact signup origin (no trailing path). Configure existing JWT/encryption secrets, ConnectionStrings:Platform and ConnectionStrings:PlatformAdmin through server secrets. Use a **separate throwaway catalogue and tenant database namespace**. Do not copy production data. TestPayments is false in the template; enable it only for this disposable staging instance. Production refuses test payments regardless of the flag.
4. Build signup-web with the confirmed settings in `.env.staging.local` (ignored by Git):

   ```text
   VITE_API_URL=<apiOrigin, without /api>
   VITE_PRODUCT_URL=<productUrl>
   VITE_TERMS_URL=<termsUrl>
   VITE_REFUND_URL=<refundUrl>
   VITE_PRIVACY_URL=<privacyUrl>
   ```

   Set VITE_WINDOWS_DOWNLOAD_URL and/or VITE_ANDROID_DOWNLOAD_URL only for confirmed installer/store addresses; otherwise retain contact fallback. All VITE values are public; never put secrets there.

   Run `pnpm --dir apps/signup-web exec tsc --noEmit` then `pnpm --dir apps/signup-web exec vite build --mode staging`. Vite inserts the API origin into CSP. `public/.htaccess` is copied into dist for Apache/LiteSpeed SPA fallback; verify rewrite/header modules are supported by the selected host. Other hosts need equivalent fallback, missing-asset 404 and HTTPS configuration.
5. Deploy the staging build only after the target is confirmed. Run the read-only preflight:

   ```text
   node apps/signup-web/scripts/check-staging.mjs --config <local-settings.json> --online
   ```

   It checks catalogue access, CORS, route documents/CSP and link status without creating anything. It does not prove server environment isolation or browser behaviour. HEAD failures must be investigated rather than silently accepted.
6. In the **staging website checkout only**, set `/js/baylior-destinations.js` to the confirmed signupOrigin and integrationVerified=true. Keep production/marketing release gates in place. Confirm the product return link points back to this staging website. No live destination has been selected in this task.
7. Run mocked browser tests (no real backend writes), then direct-route/refresh checks on deployed staging. `/signup/plan`, `/signup/review` and `/signup/done` can redirect when required browser state is absent; that is expected, whereas an HTTP 404 is not.
8. Run the existing `--project=live` suite **only after explicit disposable-catalogue confirmation**. It creates paid/trial/franchise companies, registers Owners and records simulated payments. Remote tests additionally require SIGNUP_E2E_ALLOW_REMOTE=1. Audit its seeded price expectations against the staging catalogue before running. Retain evidence and do not print registration codes or credentials in public reports.

Completion requires real staging HTTPS, fallback, CSP/CORS, catalogue/quote/trial/validation/payment-disabled/codes/return-link checks plus confirmed production release settings. Neither templates nor mocked tests establish completion. Publishing remains Phase 6.
