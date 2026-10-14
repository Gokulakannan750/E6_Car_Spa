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
