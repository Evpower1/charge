# Deploy Evpower to Hostinger

Target domain: **evpower.et**. This is a source deployment for a **Next.js Node.js application**, not a static HTML or PHP website.

## Confirm the account capabilities first

The user reports a Hostinger Business plan. The agent has not accessed the Hostinger account, and this environment could not retrieve Hostinger's current support documentation because outbound access to that domain is restricted. The plan name alone does not verify the runtime and storage available in this particular account.

In hPanel, check whether the website-creation flow offers a Node.js application. Confirm that it supports:

- Node.js **24.x** (recommended, see `.nvmrc`) or **22.13+**. Node.js 22.23.4 is compatibility-tested.
- A Next.js application with a server process and API routes.
- A private, writable database directory that persists across restarts **and redeployments**. The current application uses SQLite and must run as a single application instance with that persistent storage.
- Application environment variables and HTTPS for evpower.et.

If the account cannot provide these, do not upload the source into `public_html` and expect it to work. The application would need a compatible Node.js service or VPS; a different database adapter would be a separate change if the Node service lacks persistent SQLite storage.

## Upload and configure

1. Keep the existing website in place while preparing the new application. Use a provider preview/staging address if offered. Do not replace the existing domain, change DNS, or remove an old site until the new deployment has been reviewed.
2. Use hPanel's Node.js application deployment flow and choose source ZIP upload if offered. Upload `evpower-hostinger.zip`. `package.json` is at the root of the ZIP. If hPanel only offers Git deployment, use a private Git repository containing this same source; no Git push has been performed by the agent.
3. Select the **Next.js** preset, application root `.` (ZIP root), and **Node.js 24.x** if offered. A current **22.x** release at least 22.13 also works.
4. Use the following commands where hPanel exposes them. If a preset supplies the equivalent commands automatically, retain that preset:

   | Setting | Value |
   | --- | --- |
   | Dependency installation | `npm ci` (include dev dependencies during build) |
   | Build | `npm run build` |
   | Start | `npm start` |
   | Port | Provider-supplied `PORT`; Next.js reads it automatically |

   This is not a static export. Do not select `out` as the publish directory. The app needs the Next.js server, `.next` build, public assets, and runtime dependencies. If the hosting wizard only accepts an Express entry file or static output directory, confirm the supported Next.js deployment method with Hostinger before proceeding.

5. In **application environment settings**, use `deploy/hostinger.env.example` as a reference. Do not place real values into the public file manager or into the ZIP:

   - `NODE_ENV=production`
   - `APP_DEMO_MODE=false` — public demo mode would allow unauthenticated administration.
   - `APP_URL=https://evpower.et` for the final domain. For a provider preview, use its actual HTTPS origin until cutover, then update/rebuild for the final origin. The configured origin must match the browser origin for form submissions to pass security checks.
   - `DATABASE_PATH` set to the actual absolute private persistent path confirmed by the provider. The uppercase placeholder in the example is not a usable path. This location must be available to the application at runtime. The build does not open the database. Do not place customer data under `public_html`, in `/tmp`, or in a directory replaced by deployments.
   - `ADMIN_EMAIL` set to the initial administrator's chosen email.
   - `ADMIN_PASSWORD` set securely to a strong password of at least 12 characters before first startup. The administrator is created when the database is first initialised; log in to confirm, then remove this bootstrap variable from hosting settings. It does not reset an existing account or promote a customer account.
   - `CHAPA_SECRET_KEY` only when the merchant account is ready for payment testing. Leave unset for initial visual review. Checkout is then disabled in production, while the site, contact form, and booking requests remain available. Never enable public demo mode to work around missing payments.

6. Build and start the application. Check the build/runtime logs for a successful startup, missing Node/SQLite support, database directory permissions, and origin misconfiguration. Do not publish log excerpts containing secrets.
7. On the provider's HTTPS preview, confirm page navigation, mobile layout, registration/sign-in, contact and booking submissions, and protected administration. Set `APP_URL` to this preview's HTTPS origin for these checks.

## Before connecting the public domain

- Confirm SQLite data survives a **test redeployment**. Back up before a redeployment and before domain cutover. Configure scheduled database backups outside the application build directory.
- The ZIP excludes all existing SQLite data, customer accounts, sessions, orders, local environment files, and test data. A new installation creates a fresh database with the **sample** catalogue and unverified station entries. Approve actual products, prices, stock, and station evidence before accepting live purchases.
- Verify the administrator can sign in and the public `/api/admin` endpoint rejects access. There is no default administrator password.
- Confirm the domain's DNS is managed where expected. Use the exact target Hostinger provides. Preserve MX, SPF, DKIM, and DMARC records for `info@evpower.et`; do not change nameservers blindly. Domain ownership and DNS access have not been verified by the agent.
- Complete a Chapa merchant sandbox transaction and verify the exact order amount and fulfilment state. The callback is `https://evpower.et/api/payments/verify?tx_ref=...`; the return page is `https://evpower.et/checkout?reference=...`. Chapa checkout supports only the methods enabled for the merchant account. The agent has not performed a live payment.
- Confirm your privacy/returns/warranty terms and statutory tax-invoice process. Current printable receipts are not statutory tax invoices. Enquiries and bookings are saved for admin review; email notifications are not configured.
- Approve the working preview before replacing an existing website or changing DNS. No Hostinger deployment, domain/DNS change, cloud-environment configuration change, or publication has been performed by the agent.

## Recover from the native SWC / glibc build failure

Use the latest commit from the `main` branch. The old `next.config.ts` has been replaced with `next.config.mjs`; the repository contains no generated hashed TypeScript config. Hostinger may retain generated files in a previous build workspace, so request a fresh deployment or clear only its dependency/build cache before retrying. Do not delete your production database or its persistent directory.

Keep install/build/start commands as `npm ci`, `npm run build`, and `npm start`. The build script now selects Webpack (which supports SWC WASM); direct `next build` would choose Turbopack, which requires the native library and does not solve this failure.

The matching official `@next/swc-wasm-nodejs` package is locked at 16.4.5 and installed with npm integrity checks. `scripts/prepare-swc.mjs` copies that verified package into Next.js’s generated WASM fallback cache before build/start. This avoids relying on the host’s failing native SWC or an incomplete automatic WASM download. Do not disable TLS, signature, or integrity checks.

If logs still reference a hashed `*.next.config.ts` file, the old build workspace is still being used. If Node reports that `node:sqlite` is missing, select Node.js 24.x or update the 22.x runtime to at least 22.13. If another build error remains, share its raw log lines with secret values removed.

## Recover from a build-time SQLite lock

Deploy the latest `main` commit. Database initialization now happens on the first request, not when parallel Next.js build workers import server modules. The root layout and product routes explicitly wait for a request before querying the catalogue. Builds do not need access to the runtime `DATABASE_PATH`.

The runtime shares one database connection per process and sets `busy_timeout` before enabling WAL or initializing tables. Schema and seed changes are transactional. Keep the existing database and journal files; SQLite handles recovery. The repository excludes `.data/` and contains no committed SQLite files. This fix does not change `DATABASE_PATH`, delete stored data, or remove the need for persistent storage.

Validation includes a complete Node.js 22/WASM build with `DATABASE_PATH` pointing to an unwritable `/proc` location, proving no database is opened during build. Runtime account/order/booking checks use separate disposable databases.

## Read-only checks after deployment

Run this from a machine with access to the deployed HTTPS site:

```sh
node scripts/check-deployment.mjs https://evpower.et
```

The checker reads pages and public API endpoints only. It does not create accounts, orders, bookings, payments, or change data. It expects production mode, protected administration, secure response headers, a working catalogue, and an anonymous session. A successful check does not verify payment processing, durable backups, DNS ownership, or merchant configuration.

To regenerate the source archive from the checkout:

```sh
python scripts/package-hostinger.py /workspace/evpower-hostinger.zip
```
