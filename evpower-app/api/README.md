# Evpower mobile API

Node 24, Fastify and built-in SQLite. This is a separate API and database; it does not modify the published website, WordPress or business cards. The SQLite deployment supports **one API instance on a durable local volume**. For horizontal scaling, migrate the transactional schema and ledger to a managed PostgreSQL service first.

## Run locally

```sh
cd evpower-app/api
npm ci
cp .env.example .env
npm start
```

API health: `http://localhost:4100/health`. Operator dashboard: `/operator/`. If the native project has exported a browser build into `mobile/dist`, review it at `/app/`. Public release pages are `/privacy`, `/support` and `/account-deletion` with `/release-pages.css`.

The application starts empty: no operator account, fabricated live stations, customer money or auto-confirmed booking. Register a customer from the app. Registration works without email delivery, but adding service credit requires a verified email. Configure SMTP to deliver verification/reset codes. Codes and password reset links are never returned by HTTP or logged. A missing SMTP configuration therefore prevents email verification and reset delivery; it must be completed before launch.

Create an operator using a password supplied through stdin, not an argument or a checked-in environment value:

```sh
read -rs -p 'New operator password (12+ characters): ' EVPOWER_OPERATOR_PASSWORD
printf '\n'
printf '%s' "$EVPOWER_OPERATOR_PASSWORD" | npm run admin -- --email operator@YOUR-DOMAIN --name 'Evpower operator' --phone +251XXXXXXXXX --password-stdin
unset EVPOWER_OPERATOR_PASSWORD
```

For a clearly marked local demo, set `DEMO_MODE=true` then run `npm run demo:stations`. The resulting sample pins are not real Evpower stations and have unknown charger status. Demo mode is rejected in production and payments remain disabled in demo mode.

## Security and money

- Scrypt passwords, SHA-256-hashed opaque tokens, 15-minute access sessions, rotating 30-day refresh sessions. Refresh reuse revokes its session family. Logout/password reset/account deletion revoke sessions.
- Ownership checks protect vehicles, addresses, bookings, notifications, payments and wallet. Registration cannot choose an admin role. Requests are validated, body size is capped, rate limits are bounded, SQL values are bound and errors do not leak internals.
- Service credit is integer ETB minor units. The ledger is append-only, debits/refunds are atomic and Chapa credits are idempotent. Client callbacks cannot credit balances. Both exact amount/currency/reference and provider success must verify.
- Account deletion rejects nonzero credit, unreconciled payments and active services. Historical personal data is anonymized; financial ledger entries remain for reconciliation. A defensive late payment to an already deleted account creates an operator refund-review ticket without crediting inaccessible funds.
- SQLite is configured for WAL, foreign keys and a busy timeout. The database file has owner-only permissions; encrypt the host volume and restrict/backup it as customer data. Do not commit or package `.data`, `.env`, database backups or access tokens.

## Chapa

Payments default to disabled, even if the process inherits a `CHAPA_SECRET_KEY`. Enable only with `PAYMENTS_ENABLED=true`, a merchant secret, a distinct `CHAPA_WEBHOOK_SECRET`, and an HTTPS `API_PUBLIC_URL`. Keep all of them on the API host. Native bundles contain only the public API URL.

Configure Chapa to send signed JSON callbacks to `/v1/payments/chapa/webhook`. This adapter expects a hex HMAC-SHA256 of the exact raw JSON body in `chapa-signature` or `x-chapa-signature`, using the configured webhook secret. Confirm the merchant dashboard's signature configuration against Chapa's current documentation and validate the full flow in its sandbox before accepting live funds. The API then independently queries the verification endpoint; a valid signature alone never adds credit.

The return page only asks the customer to return to the app and recheck payment. Pending top-ups are returned by `/v1/wallet` so the customer can recover/recheck them after navigating away or restarting. A failed provider initialization adds no balance and does not block deletion. Verified failed/cancelled payments become terminal; unresolved pending payments must be reconciled with the merchant before deletion. No peer transfers or withdrawals are implemented.

Tests inject a payment provider and never contact Chapa or use the environment's merchant credentials.

## Real charger availability

Create operator-verified stations and connector IDs first. Connect the actual charger management system or OCPP gateway to `POST /v1/integrations/charger-status` using a separate random `TELEMETRY_INGEST_KEY`. Payload:

```json
{"eventId":"provider-event-123","stationId":"STATION_UUID","connectorId":"charger-1","status":"available","observedAt":"2026-11-10T08:00:00Z"}
```

The gateway must send heartbeats/status observations at least every 120 seconds. Missing or older observations are displayed as `unknown`; there is no simulation of live availability. Unknown mappings, replayed events, older statuses and implausible timestamps are rejected. This is a gateway integration endpoint, not a direct OCPP WebSocket server.

## Production deployment

Deploy the image with build context `evpower-app/`, a persistent volume mounted at `/data`, an HTTPS reverse proxy, explicit `API_PUBLIC_URL`, `CORS_ORIGINS`, SMTP, integration configuration and backups. No credentials are baked into the image. Native API calls do not require browser CORS; only approved browser frontends should be listed. Do not put the API or its database on GitHub Pages or an ephemeral filesystem.

```sh
docker build -f api/Dockerfile -t evpower-mobile-api .
# Supply production values through your host's secret manager/environment file.
docker run --env-file /secure/path/evpower-api.env -v evpower-data:/data -p 127.0.0.1:4100:4100 evpower-mobile-api
```

`NODE_ENV=production` rejects missing durable `DATABASE_PATH`, non-HTTPS public URL or demo mode. Set `TRUSTED_PROXY_IPS` to the exact addresses of your own reverse proxy (for example `127.0.0.1,::1` for a local proxy), and keep the API port private. Leave it empty for direct local access. This preserves client-specific rate limits without trusting forwarding headers from arbitrary clients.

## Verification

`npm test` exercises session rotation/reuse, one-time reset/verification, cross-account denial, booking idempotency, invalid scheduling/state transitions, insufficient funds, duplicate/concurrent payment verification, append-only ledger enforcement, atomic refund, pending-payment deletion guards, deleted-account payment review, stale/monotonic charger status and durable restart behavior. The test suite uses temporary in-memory/file databases and injected mail/payment adapters. It does not prove merchant credentials, physical chargers or store release are configured.
