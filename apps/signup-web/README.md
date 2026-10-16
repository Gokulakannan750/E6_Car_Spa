# Trovo sign-up website (`apps/signup-web`)

The public page where a business chooses a plan, user licences (Windows + Android, Windows only, Android only) and
add-ons, then pays or starts the free trial. At the end it shows the **company code** and **registration code**, which
the owner types into the Windows or Android app to create their login.

There is no login and no secret here. The site uses only the public endpoints in [`docs/SIGNUP_API.md`](../../docs/SIGNUP_API.md),
and the server works out every price (the site shows the server's quote). The design comes from the Stitch export in
`design/stitch-signup/`.

## Run locally

The API must have `Platform:SignupEnabled=true`, and on a test machine `Platform:TestPayments=true`.

```bash
pnpm --dir apps/signup-web dev
```

This opens <http://localhost:5192>. `/api` is proxied to `http://localhost:5298`; set `SIGNUP_API_PROXY` to use a
different API.

## Settings (build time, `.env.local` or the build environment)

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | API address in production (https). It is added to the CSP. The API must allow this site's address in `Platform:SignupOrigin`. |
| `VITE_PRODUCT_URL` | The Baylior product page, linked as "About Baylior" in the header and footer. Defaults to `https://trovotechsolutions.in/products/baylior/`, which must be published before going live. |
| `VITE_WINDOWS_DOWNLOAD_URL`, `VITE_ANDROID_DOWNLOAD_URL` | Download links on the final page. If neither is set, a note to contact Trovo shows instead. |
| `VITE_TERMS_URL`, `VITE_REFUND_URL`, `VITE_PRIVACY_URL` | Policy pages. The defaults point to trovotechsolutions.in, and those pages must be published before going live. |

## Tests

```bash
pnpm --dir apps/signup-web test
```

```bash
pnpm --dir apps/signup-web test:e2e --project=mocked
```

```bash
pnpm --dir apps/signup-web test:e2e --project=live
```

- `test`: Vitest unit tests (the field checks).
- `--project=mocked`: Playwright with an in-memory fake API. CI runs this.
- `--project=live`: against the site on 5192 and a running API. It creates real companies and databases, so use it
  **only with a throwaway catalog**. It refuses non-localhost addresses.

## Build

```bash
pnpm --dir apps/signup-web build
```

The output is static files in `dist/`, which can be served from any static host.

## Phase 5 staging preparation

See [`deploy/signup/README.md`](../../deploy/signup/README.md) for the dedicated-host setup, public frontend settings,
API origin/CORS, staging payment mode, read-only preflight and isolation requirements. `public/.htaccess` is copied
into `dist/` for Apache/LiteSpeed SPA fallback; HTTPS and rewrite-module support still need verification on the chosen host.
Do not run live signup tests against the shared development catalogue. The mocked suite covers payment-disabled behaviour
and direct loading/refreshing of every route without real company creation; this does not verify a deployed server's rewrite rules.


## Multi-product routes and branding

`/` and `/signup` select the only active product automatically. With multiple products they show cards from `/api/public/products`. Use `/pricing/<key>` and `/signup/<key>`; subsequent steps remain under that product path. Catalog, quote, franchise check, signup, order status and test payment calls carry `?product=<key>`. Session storage and query caches are isolated by product.

Seat controls, default quantities, minimums and feature labels come from public catalog metadata. None products have no seat controls or minimum. Counted products show one type; PerType products show the active types in configured order. Requests contain `seats`, never the old fixed licence object.

`src/lib/config.ts` owns product branding and links. The `carspa` and `baylior` keys retain Baylior's existing URLs. Set `VITE_BAYLIOR_PRODUCT_KEY` for an isolated/runtime alias. Unknown products use their catalog name and generic Trovo links. `VITE_PRODUCT_CONFIG` is a JSON map keyed by product key, for example:

```json
{"demo":{"name":"Demo","product":"https://example.test/demo/","terms":"https://example.test/terms/","refund":"https://example.test/refund/","downloads":[{"name":"Open Demo","url":"https://example.test/app/"}]}}
```

Existing `VITE_PRODUCT_URL`, `VITE_TERMS_URL`, `VITE_REFUND_URL` and `VITE_PRIVACY_URL` remain global build-time overrides. Legacy `VITE_WINDOWS_DOWNLOAD_URL`/`VITE_ANDROID_DOWNLOAD_URL` become named download entries for Baylior aliases only; other products use the generic downloads array. Keep any custom logo in this site's assets so it respects the existing CSP.

Run `pnpm --dir apps/signup-web test:e2e` for the mocked suite (now also in `scripts/test-platform-baseline.ps1`). The explicitly selected `--project=live` suite requires `SIGNUP_E2E_PRODUCT_KEY=pts6<isolated suffix>` and the local helper setup documented in `docs/platform-multi-product-stage-7.md`. It provisions real throwaway companies and writes desktop/phone report screenshots. Never run it against the owner's development databases.
