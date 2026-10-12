# Trovo Platform admin portal

The web console Trovo staff use to run the SaaS: create companies (each gets its own database and a one-time
registration code), manage subscriptions, record bank transfer and UPI payments, print invoices, change plan prices,
and (owners) read the audit log, manage admins and update company databases.

It talks only to the platform API (`/api/platform/*`), which exists only when the API runs with `Platform:Enabled=true`.
The visual design comes from the Stitch export in `design/stitch-admin-portal/`.

## Run locally

1. Start the API in platform mode (catalog connection, `Platform:Enabled=true`, a `Platform:Jwt:Key` different from `Jwt:Key`).
2. Create the first owner if there is none:

   ```bash
   dotnet run --project backend/api/CarSpaManagement.Api -- platform create-admin you@trovotechsolutions.in "Your Name" --role Owner
   ```

3. Start the portal (port 5190). `/api` is proxied to `http://localhost:5298`; set `PLATFORM_API_PROXY` to use another address.

   ```bash
   pnpm --dir apps/platform-admin dev
   ```

The first sign-in asks for the one-time password, then shows a QR code for an authenticator app, then asks for a new
password (at least 12 characters).

## Build for hosting

```bash
VITE_API_URL=https://api.example.com pnpm --dir apps/platform-admin build
```

- `dist/` is a static site. Serve `index.html` for every path (client-side routes).
- `VITE_API_URL` must be https; its origin is written into the page's Content-Security-Policy.
- Set `Platform:AdminPortalOrigin` on the API to the portal's address so the API accepts its requests (CORS).
- Have the web server also send `X-Frame-Options: DENY` and the same Content-Security-Policy as a header.

## Security notes

- The session lives in memory and in this tab's `sessionStorage` only; it ends when the tab closes, after 30 minutes
  without activity, or when the 2-hour token expires.
- The API checks every request against the admin's current state: switching an admin off, changing their role or
  resetting their sign-in ends their session immediately.
- Every change asks for a reason, which goes into the append-only audit log.

## Tests

```bash
pnpm --dir apps/platform-admin type-check
pnpm --dir apps/platform-admin test
```
