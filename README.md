# Evpower

A responsive EV charging and commerce website for Evpower, Ethiopia. Built with Next.js App Router, React, TypeScript, local variable fonts, Lucide icons, and SQLite. No external image, font, or map requests are needed to render the site.

## Run locally

Use **Node.js 24.x** (recommended) or **Node.js 22.13+** (uses `node:sqlite`). The Hostinger compatibility build is tested on Node.js 22.23.4.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The example enables **local demonstration mode**: accounts, bookings, enquiries, product edits, orders, and invoices persist locally, but demo orders do not collect payments or arrange delivery. The demo administration workspace is at `/admin`. Do not expose demo mode to the public. Configuring a Chapa key automatically disables demo administration. The repository is already isolated in a cloud task; use its existing checkout without creating a worktree.

## Included workflows

- Responsive Home, Services, Locations, Shop, product detail, About, Contact, FAQ, privacy and terms pages.
- Shopping cart persisted in local storage; categories, search, sorting, quantity and stock controls.
- Real account registration/sign-in, salted scrypt password hashes, server-side sessions, profile editing, saved addresses, purchase history, fulfilment tracking, booking history, and printable receipts.
- Guest checkout with a private cryptographic receipt link. Totals and stock are validated transactionally on the server.
- Mobile charging / fleet / installation / maintenance booking requests. Times use East Africa Time. Requests remain unconfirmed until staff update them.
- A city-filtered, selectable, zoomable **illustrative station map**, not a road navigation map. Addis Ababa and Adama samples are explicitly unverified. Admin verification requires an HTTPS evidence URL. No live station telemetry is claimed.
- Administration: add/edit products and inventory, order fulfilment, customer contact profiles, payment records, station records, booking status, enquiries, and the site announcement.
- The contact form stores enquiries in the admin dashboard. It does **not** send email notifications. Phone, email and WhatsApp links use the contact information provided by Evpower: 8890, +251 911 049 916, info@evpower.et.

## Website studio: edit without code

After deployment, sign in at `/account` using your administrator account, then open `/admin/editor` (or click **Website editor** on the dashboard).

- **Click content in the preview** to edit headings, paragraphs, link destinations, images, alt descriptions, and input hints. Text controls include weight, italics, colour, and size. Header/footer/call-to-action content is also editable.
- **Page** controls add, reorder (drag or arrow buttons), hide/show, and style sections. Add text, hero, image/story, feature cards, FAQ, and call-to-action sections. Create custom pages and edit their SEO title/description; add a navigation link when ready. Built-in core pages can be hidden but not deleted; Home remains active.
- **Brand** controls the company name, text/image logo, browser icon, announcement, tagline, contact details, WhatsApp, and default SEO.
- **Theme** controls colours, fonts, button corners, and content width. Desktop/mobile preview buttons let you check the result.
- **Navigation** controls link labels, destinations, ordering, and visibility. Additional links appear under a More menu.
- **Images** are uploaded as PNG/JPEG/WebP (8 MB maximum) and stored in the SQLite database. SVG/HTML uploads and executable URLs are rejected. Archived images leave the library but remain available to existing pages/history. Product photos are managed in **Dashboard → Products → Edit**.
- **Save draft** keeps changes private. The preview requires an authenticated administrator (or isolated demo mode). **Publish changes** makes the saved draft public on the next page load; no code build is needed for later content edits.
- **History** restores a published version into the draft for review. It never rolls back products, orders, customers, or payments. Optimistic revision checks prevent a stale editor tab overwriting newer work.

This is a structured visual page editor, not an arbitrary JavaScript/PHP editor. Commerce records and transaction rules remain in the business dashboard; payment credentials, domain/DNS, hosting configuration, and database backups remain hosting responsibilities. Images and editor documents use the same persistent SQLite database as business data: keep `DATABASE_PATH` outside directories replaced by deployment and maintain backups.

The first request adds editor tables and a product-photo column without deleting existing data. The current announcement is migrated into the initial website document. No database access is introduced during the build.

## Hostinger build compatibility

The project uses `next.config.mjs` so loading the configuration does not require native TypeScript transpilation. `npm run build` uses Webpack, and `scripts/prepare-swc.mjs` provisions the matching official SWC WebAssembly package into Next.js’s generated fallback cache. Native SWC is used when available; the verified WASM dependency is available when an older host cannot load the native binary. The same preparation runs before `npm start`. No dependency source or binary verification is disabled. Keep `next` and `@next/swc-wasm-nodejs` pinned to the same version.

Deploy the latest Git commit with a clean dependency/build cache after switching from the previous TypeScript configuration. Do not commit temporary `*.next.config.ts` or `next.config.compiled.js` files. See `deploy/HOSTINGER.md`.

## Database initialization

SQLite is opened lazily on the first request through `getDb()`, never when Next.js imports modules during build-time page collection. Server-rendered catalogue queries wait for a request. A successful build does not require access to the runtime database directory and does not bootstrap accounts or seed data. Run `npm run test:build-no-db` to check this against a deliberately unusable database path. One connection is shared across server bundles in each process, including production. Initialization sets a 10-second busy timeout before lock-taking operations and performs schema/seed/admin bootstrap changes in one transaction. Existing data is retained, and SQLite manages journal recovery; do not delete database/journal files to work around a build failure.

## Production

1. Use a persistent, writable volume for `DATABASE_PATH`. The default is `.data/evpower.sqlite`. Back up the SQLite database consistently; SQLite’s backup API or `VACUUM INTO` is preferable to copying an active database without its WAL. This application targets one Node deployment with persistent storage, not ephemeral serverless instances.
2. Set `APP_DEMO_MODE=false`. Set `APP_URL` to the canonical public **HTTPS** origin. Session cookies are Secure on HTTPS. Configure the reverse proxy to preserve the public host/origin, and serve only via HTTPS.
3. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` of at least 12 characters securely before the initial startup. An administrator is created only when that email does not already exist; an existing customer is never silently promoted. Remove `ADMIN_PASSWORD` after provisioning. No default administrator password exists.
4. Add `CHAPA_SECRET_KEY` securely on the server (never prefix with `NEXT_PUBLIC_`). Enable required payment methods in the Chapa merchant dashboard. Allow server HTTPS egress to `api.chapa.co`, and browser navigation to Chapa’s hosted checkout. The integration initializes a hosted ETB payment and independently verifies its reference, status, currency, and exact amount before marking an order paid. The callback is `/api/payments/verify?tx_ref=…`; the customer returns to `/checkout?reference=…`.
5. Replace the **sample catalogue** with approved products, stock, specifications and prices. Verify station operating details and evidence before publishing them. The current station explorer is illustrative, not a geographical basemap. Receipts are **not statutory tax invoices**; integrate the business’s approved tax invoicing process if required.
6. Review commercial, privacy, returns, warranty, tax, and delivery terms with the business. Confirm Chapa in a merchant sandbox and complete a real payment/refund acceptance check before launch. Live Chapa execution has not been verified without credentials.
7. Configure an email delivery service if enquiry, booking, or order email notifications are required. A password recovery/email verification flow is not included; the current site provides registration, login, and account support via the team.

```sh
npm run typecheck
npm run build
npm start
```

No payment details are stored by Evpower. Secrets remain server-side. APIs use schema validation, bounded request bodies, origin checks, rate limits for public submission/authentication endpoints, parameterised SQL, protected cookies, and per-order authorisation. Keep the runtime/dependencies updated and add deployment-level request limits and monitoring for public traffic.

## Editor validation

Run against disposable local databases only. Bootstrap the secure instance on port 3002 with a test `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then supply those same values as `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` to `npm run test:cms`. Alternatively, `TEST_ADMIN_CREDENTIALS_FILE` can reference a private local JSON fixture with `email` and `password` keys. Never use production credentials or production customer data for these tests.

`npm run test:cms` covers draft isolation, administrator/customer permissions, unsafe content rejection, optimistic concurrency, raster media uploads, page publication/visibility/SEO, product photos, and version restoration. `python -u tests/editor-browser.py` exercises the live editor, draft/public separation, undo/redo, theme/mobile previews, section management, custom pages, navigation, image uploads, and history restoration. The browser script reads the private test fixture named by `TEST_ADMIN_CREDENTIALS_FILE` (the cloud test workspace uses a generated file under `/tmp`).

## Validation

`npm run typecheck` checks TypeScript. `npm run build` compiles all server and client routes. API integration tests use **separate disposable databases**, not your development or production database:

```sh
# Build first. Run these in separate terminals:
APP_DEMO_MODE=true APP_URL=http://localhost:3001 DATABASE_PATH=/tmp/evpower-test-demo.sqlite npm start -- --port 3001
APP_DEMO_MODE=false APP_URL=http://localhost:3002 DATABASE_PATH=/tmp/evpower-test-secure.sqlite npm start -- --port 3002
npm test
```

Delete only those disposable database files before a clean rerun. Tests cover registration, sign-in, session revocation, account isolation, address persistence, origin/body guards, server-priced checkout, stock updates, private guest receipts, booking validation, enquiry storage, station verification requirements, and production administration/payment gating. Tests never make a live payment.

For the full browser suite, install Python Playwright and Chromium, then run `python -u tests/browser.py` against the disposable demo instance on port 3001. The suite exercises all 13 pages, responsive layouts at 320/390/768px, mobile navigation, registration, filtering, cart controls, checkout, invoices, booking, map interactions, contact enquiries, account history, saved addresses, and admin edits. It deliberately changes only the disposable test data.

The hero is an original generated image optimised to WebP; charger artwork is illustrative SVG. All fonts are bundled locally. Browser/mobile checks were performed with Chromium and Playwright in the cloud workspace.
